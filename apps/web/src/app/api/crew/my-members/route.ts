import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/crew/my-members
 * Liefert die Mit-Mitglieder der eigenen Crew (ohne mich selbst).
 * Kompakt für Dropdowns / Donate-UI.
 */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const { data: myRow } = await sb.from("crew_members").select("crew_id").eq("user_id", user.id).maybeSingle();
  if (!myRow?.crew_id) return NextResponse.json({ ok: true, members: [] });

  const { data, error } = await sb
    .from("crew_members")
    .select("user_id, user:user_id(display_name, username)")
    .eq("crew_id", myRow.crew_id)
    .neq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Row = { user_id: string; user: { display_name: string | null; username: string | null } | { display_name: string | null; username: string | null }[] | null };
  const members = ((data ?? []) as Row[]).map((r) => {
    const u = Array.isArray(r.user) ? r.user[0] : r.user;
    return { user_id: r.user_id, display_name: u?.display_name || u?.username || "Crew-Mitglied" };
  });
  return NextResponse.json({ ok: true, members });
}
