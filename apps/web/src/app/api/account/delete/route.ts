import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let _admin: SupabaseClient | null = null;
function admin(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin creds missing");
  _admin = createAdminClient(url, key, { auth: { persistSession: false } });
  return _admin;
}

/**
 * POST /api/account/delete
 * DSGVO Art. 17 — Self-Service-Kontolöschung.
 *
 * Ablauf (Soft-Delete mit 14-Tage-Grace wie in Datenschutzerklärung angekündigt):
 *   1. Markiert users.deletion_requested_at = now().
 *   2. Anonymisiert öffentliches Profil sofort (username → "deleted_<short>", display_name geleert).
 *   3. Cron-Job (separat) entfernt nach 14 Tagen Roh-Daten und auth.users-Eintrag.
 *   4. User wird ausgeloggt.
 *
 * Body: { confirm: "DELETE" } — expliziter Text-Confirmation, verhindert CSRF-Fehlbedienung.
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) as { confirm?: string } | null;
  if (body?.confirm !== "DELETE") {
    return NextResponse.json({ error: "confirmation_required", detail: 'Body must contain { "confirm": "DELETE" }.' }, { status: 400 });
  }

  const id = user.id;
  const shortId = id.slice(0, 8);
  const anonymizedName = `deleted_${shortId}`;

  // 1) Markierung + Anonymisierung öffentlicher Felder (Service-Role, weil RLS
  //    möglicherweise auch Writes auf sensible Flags blockt).
  const sbAdmin = admin();
  await sbAdmin.from("users").update({
    deletion_requested_at: new Date().toISOString(),
    username: anonymizedName,
    display_name: null,
    bio: null,
    avatar_url: null,
    banner_url: null,
    privacy_leaderboard: false,
    privacy_searchable: false,
  }).eq("id", id);

  // 2) Crew-Austritt (damit Crew-Slots nicht blockiert bleiben)
  await sbAdmin.from("crew_members").delete().eq("user_id", id);
  await sbAdmin.from("users").update({ current_crew_id: null }).eq("id", id);

  // 3) Session beenden
  await sb.auth.signOut();

  return NextResponse.json({
    ok: true,
    scheduled_for_full_deletion_at: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
    note: "Dein Konto ist als gelöscht markiert. Rohdaten werden innerhalb von 14 Tagen endgültig entfernt.",
  });
}
