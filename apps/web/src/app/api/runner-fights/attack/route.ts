import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runBattle, type BattleInput } from "@/lib/battle-engine";
import { loadGuardianBattleContext } from "@/lib/guardian-battle-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { defender_guardian_id: string };

/**
 * POST /api/runner-fights/attack
 * Führt einen Runner-Fight gegen den gewählten Gegner-Wächter durch.
 * Tagesstatus + Gem-Abzug werden via runner_fight_settle RPC geregelt.
 */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "auth" }, { status: 401 });

  const { defender_guardian_id } = await req.json() as Body;
  if (!defender_guardian_id) return NextResponse.json({ ok: false, error: "missing_defender" }, { status: 400 });

  // Tagesstatus sicherstellen
  await sb.rpc("runner_fight_reset_if_needed", { p_user_id: user.id });

  const [{ data: state }, { data: gems }] = await Promise.all([
    sb.from("runner_fight_state").select("fights_used_today").eq("user_id", user.id).maybeSingle(),
    sb.from("user_gems").select("gems").eq("user_id", user.id).maybeSingle(),
  ]);
  const used = state?.fights_used_today ?? 0;
  const { data: nextCost } = await sb.rpc("runner_fight_next_gem_cost", { p_used: used });
  const cost = typeof nextCost === "number" ? nextCost : 0;
  if (cost === -1) return NextResponse.json({ ok: false, error: "daily_limit_reached", message: "Tageslimit von 30 Fights erreicht." }, { status: 429 });
  if (cost > 0 && (gems?.gems ?? 0) < cost) {
    return NextResponse.json({ ok: false, error: "not_enough_gems", message: `Kostet ${cost} Gems.`, needed: cost, have: gems?.gems ?? 0 }, { status: 402 });
  }

  async function fetchGuardian(guardianId: string) {
    const { data } = await sb.from("user_guardians")
      .select("id, user_id, archetype_id, level, xp, current_hp_pct, wounded_until, is_active")
      .eq("id", guardianId).maybeSingle();
    if (!data) return null;
    const { data: arch } = await sb.from("guardian_archetypes").select("*").eq("id", data.archetype_id).single();
    const { data: eqRows } = await sb.from("guardian_equipment")
      .select("slot, user_item_id, user_items!inner(item_id, item_catalog!inner(bonus_hp, bonus_atk, bonus_def, bonus_spd))")
      .eq("guardian_id", data.id);
    const bonuses = { hp: 0, atk: 0, def: 0, spd: 0 };
    for (const row of (eqRows ?? []) as unknown as Array<{ user_items: { item_catalog: { bonus_hp: number; bonus_atk: number; bonus_def: number; bonus_spd: number } } }>) {
      const ic = row.user_items?.item_catalog;
      if (!ic) continue;
      bonuses.hp  += ic.bonus_hp ?? 0;
      bonuses.atk += ic.bonus_atk ?? 0;
      bonuses.def += ic.bonus_def ?? 0;
      bonuses.spd += ic.bonus_spd ?? 0;
    }
    return { ...data, archetype: arch, item_bonuses: bonuses };
  }

  // Angreifer-Wächter = aktiver Wächter des Users
  const { data: myGuardian } = await sb.from("user_guardians")
    .select("id").eq("user_id", user.id).eq("is_active", true).maybeSingle();
  if (!myGuardian) return NextResponse.json({ ok: false, error: "no_active_guardian" }, { status: 400 });

  const [gA, gB] = await Promise.all([fetchGuardian(myGuardian.id), fetchGuardian(defender_guardian_id)]);
  if (!gA || !gB) return NextResponse.json({ ok: false, error: "guardian_missing" }, { status: 404 });
  if (gA.user_id === gB.user_id) return NextResponse.json({ ok: false, error: "cant_attack_self" }, { status: 400 });
  if (gA.wounded_until && new Date(gA.wounded_until).getTime() > Date.now()) {
    return NextResponse.json({ ok: false, error: "wounded" }, { status: 400 });
  }

  const levelSpread = Math.abs(gA.level - gB.level);
  if (levelSpread > 3) return NextResponse.json({ ok: false, error: "level_gap", detail: "Max ±3 Level erlaubt." }, { status: 403 });

  // Kontext (Talents+Skills) für beide laden, keine Power-Zone-Buffs bei Runner-Fights
  const [ctxA, ctxB] = await Promise.all([
    loadGuardianBattleContext(sb, gA.id),
    loadGuardianBattleContext(sb, gB.id),
  ]);

  const inputA: BattleInput = {
    guardian: { id: gA.id, level: gA.level, current_hp_pct: gA.current_hp_pct, archetype: gA.archetype },
    is_home: false, crew_member_count: 1,
    item_bonuses: gA.item_bonuses,
    skill_levels: ctxA.skill_levels,
    talent_bonuses: ctxA.talent_bonuses,
  };
  const inputB: BattleInput = {
    guardian: { id: gB.id, level: gB.level, current_hp_pct: gB.current_hp_pct, archetype: gB.archetype },
    is_home: false, crew_member_count: 1,
    item_bonuses: gB.item_bonuses,
    skill_levels: ctxB.skill_levels,
    talent_bonuses: ctxB.talent_bonuses,
  };

  const seed = `rf:${user.id}:${gB.user_id}:${Date.now()}`;
  const result = runBattle(inputA, inputB, seed);
  const winnerUserId = result.winner === "A" ? user.id : result.winner === "B" ? gB.user_id : null;

  // Settle via RPC (schreibt runner_fights, inkrementiert Status, zieht Gems ab, vergibt Loot)
  const { data: settled, error: settleErr } = await sb.rpc("runner_fight_settle", {
    p_attacker_id: user.id,
    p_defender_id: gB.user_id,
    p_attacker_guardian_id: gA.id,
    p_defender_guardian_id: gB.id,
    p_winner_user_id: winnerUserId,
    p_seed: seed,
    p_rounds: result.rounds,
    p_gems_paid: cost,
  });
  if (settleErr) return NextResponse.json({ ok: false, error: settleErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    rounds: result.rounds,
    winner: result.winner,
    final_hp_a: result.final_hp_a,
    final_hp_b: result.final_hp_b,
    settle: settled,
    gems_paid: cost,
  });
}
