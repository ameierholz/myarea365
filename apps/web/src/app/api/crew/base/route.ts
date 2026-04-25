import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/crew/base
 * Liefert die Crew-Base des aktuellen Users.
 * Wenn der User in mehreren Crews ist, nimmt die zuerst gefundene
 * (sollte eindeutig sein, aber defensiv codieren).
 */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  // Crew bestimmen
  const { data: cm } = await sb.from("crew_members")
    .select("crew_id, crews!inner(id, name)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle<{ crew_id: string; crews: { id: string; name: string } | { id: string; name: string }[] }>();

  if (!cm?.crew_id) {
    return NextResponse.json({ ok: true, crew: null, base: null, buildings: [], queue: [], resources: null, catalog: [] });
  }

  // Base sicherstellen
  const { data: baseId, error: baseErr } = await sb.rpc("get_or_create_crew_base", { p_crew_id: cm.crew_id });
  if (baseErr) return NextResponse.json({ error: baseErr.message }, { status: 500 });

  const [base, buildings, queue, resources, catalog] = await Promise.all([
    sb.from("crew_bases").select("id, plz_cluster, level, exp, layout_json").eq("id", baseId as string).maybeSingle(),
    sb.from("crew_base_buildings").select("id, building_id, position_x, position_y, level, status, last_collected_at").eq("crew_base_id", baseId as string),
    sb.from("crew_building_queue").select("id, building_id, action, target_level, started_at, ends_at, finished").eq("crew_base_id", baseId as string).eq("finished", false).order("ends_at"),
    sb.from("crew_resources").select("wood, stone, gold, mana, updated_at").eq("crew_id", cm.crew_id).maybeSingle(),
    sb.from("buildings_catalog").select("id, name, emoji, description, category, scope, max_level, base_cost_wood, base_cost_stone, base_cost_gold, base_cost_mana, base_buildtime_minutes, effect_key, effect_per_level, required_base_level, sort").eq("scope", "crew").order("sort"),
  ]);

  const crewMeta = Array.isArray(cm.crews) ? cm.crews[0] : cm.crews;

  return NextResponse.json({
    ok: true,
    crew:        crewMeta ?? null,
    base:        base.data,
    buildings:   buildings.data ?? [],
    queue:       queue.data ?? [],
    resources:   resources.data ?? { wood: 0, stone: 0, gold: 0, mana: 0 },
    catalog:     catalog.data ?? [],
  });
}
