import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/guardian/detail/:guardianId
 * Returns guardian + archetype + talent-nodes + player talents + archetype-skills + player skill-levels + siegel inventory
 */
export async function GET(_req: Request, ctx: { params: Promise<{ guardianId: string }> }) {
  const { guardianId } = await ctx.params;
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: guardian } = await sb.from("user_guardians")
    .select("id, user_id, crew_id, archetype_id, custom_name, level, xp, wins, losses, current_hp_pct, wounded_until, is_active, acquired_at, source, talent_points_available, talent_points_spent, last_respec_at, archetype:archetype_id(id, name, emoji, rarity, guardian_type, role, base_hp, base_atk, base_def, base_spd, ability_id, ability_name, ability_desc, lore)")
    .eq("id", guardianId).maybeSingle();
  if (!guardian) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const archetypeId = (guardian as { archetype_id: string }).archetype_id;

  const [{ data: nodes }, { data: talents }, { data: skills }, { data: skillLevels }, { data: siegel }] = await Promise.all([
    sb.from("talent_nodes")
      .select("id, archetype_id, branch, tier, slot, name, description, max_rank, effect_key, effect_per_rank, requires_node_id")
      .eq("archetype_id", archetypeId).order("branch").order("tier"),
    sb.from("guardian_talents").select("node_id, rank").eq("guardian_id", guardianId),
    sb.from("archetype_skills")
      .select("id, archetype_id, skill_slot, name, description, effect_key, base_value, per_level_value, rage_cost")
      .eq("archetype_id", archetypeId),
    sb.from("guardian_skill_levels").select("skill_id, level").eq("guardian_id", guardianId),
    sb.from("user_siegel").select("*").eq("user_id", auth.user.id).maybeSingle(),
  ]);

  return NextResponse.json({
    guardian,
    talent_nodes: nodes ?? [],
    guardian_talents: talents ?? [],
    archetype_skills: skills ?? [],
    guardian_skill_levels: skillLevels ?? [],
    siegel: siegel ?? { user_id: auth.user.id, siegel_infantry: 0, siegel_cavalry: 0, siegel_marksman: 0, siegel_mage: 0, siegel_universal: 0 },
  });
}

/**
 * POST /api/guardian/detail/:guardianId
 * Body: { action: "spend_talent", node_id } | { action: "respec", force?: boolean } | { action: "upgrade_skill", skill_id }
 */
export async function POST(req: Request, ctx: { params: Promise<{ guardianId: string }> }) {
  const { guardianId } = await ctx.params;
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json() as
    | { action: "spend_talent"; node_id: string }
    | { action: "respec"; force?: boolean }
    | { action: "upgrade_skill"; skill_id: string };

  if (body.action === "spend_talent") {
    const { data, error } = await sb.rpc("spend_talent_point", { p_guardian_id: guardianId, p_node_id: body.node_id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
  if (body.action === "respec") {
    const { data, error } = await sb.rpc("respec_talents", { p_guardian_id: guardianId, p_force: body.force ?? false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
  if (body.action === "upgrade_skill") {
    const { data, error } = await sb.rpc("upgrade_skill", { p_guardian_id: guardianId, p_skill_id: body.skill_id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
  return NextResponse.json({ error: "bad_action" }, { status: 400 });
}
