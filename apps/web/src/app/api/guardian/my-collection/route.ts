import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/guardian/my-collection
 * Neue einheitliche Collection-API (CoD-Rework).
 * Liefert:
 * - owned:       Wächter des Users (user_guardians) mit archetype-Details
 * - archetypes:  alle 60 Archetypen (für "noch nicht erbeutet")
 * - active_id:   ID des aktiven Wächters
 */
export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [{ data: owned }, { data: archetypes }] = await Promise.all([
    sb.from("user_guardians")
      .select("id, archetype_id, custom_name, level, xp, wins, losses, is_active, talent_points_available, acquired_at, archetype:archetype_id(id, name, emoji, rarity, guardian_type, role, base_hp, base_atk, base_def, base_spd, ability_name, image_url, video_url)")
      .eq("user_id", auth.user.id)
      .order("acquired_at"),
    sb.from("guardian_archetypes")
      .select("id, name, emoji, rarity, guardian_type, role, base_hp, base_atk, base_def, base_spd, ability_name, ability_desc, lore, image_url, video_url")
      .order("rarity").order("name"),
  ]);

  const active = (owned ?? []).find((g: { is_active: boolean }) => g.is_active);

  return NextResponse.json({
    owned: owned ?? [],
    archetypes: archetypes ?? [],
    active_id: active ? (active as { id: string }).id : null,
  });
}

/**
 * POST /api/guardian/my-collection
 * Body: { action: "activate", guardian_id }
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json() as { action: "activate"; guardian_id: string };
  if (body.action === "activate") {
    // Reihenfolge wichtig wegen idx_user_guardian_active (unique where is_active):
    // 1) Alle aktiven deaktivieren — MIT select() damit wir sehen ob RLS greift
    const { data: deactRows, error: deactErr } = await sb.from("user_guardians")
      .update({ is_active: false })
      .eq("user_id", auth.user.id)
      .eq("is_active", true)
      .select("id");
    if (deactErr) return NextResponse.json({ error: `deactivate: ${deactErr.message}` }, { status: 500 });

    // 2) Gewählten aktivieren
    const { data: actRows, error } = await sb.from("user_guardians")
      .update({ is_active: true })
      .eq("id", body.guardian_id)
      .eq("user_id", auth.user.id)
      .select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!actRows || actRows.length === 0) {
      return NextResponse.json({
        error: `Wächter nicht gefunden oder keine Update-Berechtigung (deaktiviert: ${deactRows?.length ?? 0})`,
      }, { status: 404 });
    }
    return NextResponse.json({ ok: true, deactivated: deactRows?.length ?? 0 });
  }
  return NextResponse.json({ error: "bad_action" }, { status: 400 });
}
