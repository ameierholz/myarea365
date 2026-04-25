import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/base/me
 * Liefert eigene Base + Gebäude + Resourcen + Queue + VIP + Chests in einem Call.
 * Triggert get_or_create_base + finish_building (auto-finalisiert abgelaufene Builds).
 */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  // 1) Base + (auto-create) + finish overdue builds
  const { data: baseId, error: baseErr } = await sb.rpc("get_or_create_base");
  if (baseErr) return NextResponse.json({ error: baseErr.message }, { status: 500 });
  await sb.rpc("finish_building");

  // 2) Parallel laden
  const [base, buildings, queue, resources, vip, vipThresholds, catalog, chests] = await Promise.all([
    sb.from("bases").select("id, plz, level, exp, layout_json").eq("id", baseId as string).maybeSingle(),
    sb.from("base_buildings").select("id, building_id, position_x, position_y, level, status, last_collected_at").eq("base_id", baseId as string),
    sb.from("building_queue").select("id, building_id, action, target_level, started_at, ends_at, finished").eq("base_id", baseId as string).eq("finished", false).order("ends_at"),
    sb.from("user_resources").select("wood, stone, gold, mana, speed_tokens, updated_at").eq("user_id", user.id).maybeSingle(),
    sb.from("vip_progress").select("vip_level, vip_points, daily_login_streak, last_login_at, total_spent_eur").eq("user_id", user.id).maybeSingle(),
    sb.from("vip_tier_thresholds").select("vip_level, required_points, daily_chest_silver, daily_chest_gold, resource_bonus_pct, buildtime_bonus_pct").order("vip_level"),
    sb.from("buildings_catalog").select("id, name, emoji, description, category, scope, max_level, base_cost_wood, base_cost_stone, base_cost_gold, base_cost_mana, base_buildtime_minutes, effect_key, effect_per_level, required_base_level, sort").eq("scope", "solo").order("sort"),
    sb.from("treasure_chests").select("id, kind, source, obtained_at, opens_at, opened_at, payload").eq("owner_user_id", user.id).is("opened_at", null).order("obtained_at", { ascending: false }),
  ]);

  return NextResponse.json({
    ok: true,
    base:        base.data,
    buildings:   buildings.data ?? [],
    queue:       queue.data ?? [],
    resources:   resources.data ?? { wood: 0, stone: 0, gold: 0, mana: 0, speed_tokens: 0 },
    vip:         vip.data ?? { vip_level: 0, vip_points: 0, daily_login_streak: 0, last_login_at: null, total_spent_eur: 0 },
    vip_thresholds: vipThresholds.data ?? [],
    catalog:     catalog.data ?? [],
    chests:      chests.data ?? [],
  });
}
