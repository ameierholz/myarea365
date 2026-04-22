import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runBattle, type BattleInput } from "@/lib/battle-engine";
import { loadGuardianBattleContext } from "@/lib/guardian-battle-context";
import { bumpMissionProgressBatch } from "@/lib/missions";

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

  const isBot = defender_guardian_id.startsWith("bot-");

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

  const gA = await fetchGuardian(myGuardian.id);
  if (!gA) return NextResponse.json({ ok: false, error: "guardian_missing" }, { status: 404 });
  if (gA.wounded_until && new Date(gA.wounded_until).getTime() > Date.now()) {
    return NextResponse.json({ ok: false, error: "wounded" }, { status: 400 });
  }

  // Bot-Gegner: synthesizen aus bot-<archetype>-<level>-<rest>
  let gB: Awaited<ReturnType<typeof fetchGuardian>> | null;
  if (isBot) {
    const match = defender_guardian_id.match(/^bot-([^-]+(?:-[^-]+)*?)-(\d+)-/);
    const archetypeId = match?.[1];
    const botLevel = match?.[2] ? parseInt(match[2]) : gA.level;
    if (!archetypeId) return NextResponse.json({ ok: false, error: "invalid_bot_id" }, { status: 400 });
    const { data: arch } = await sb.from("guardian_archetypes").select("*").eq("id", archetypeId).single();
    if (!arch) return NextResponse.json({ ok: false, error: "bot_archetype_missing" }, { status: 400 });
    gB = {
      id: defender_guardian_id,
      user_id: "bot",
      archetype_id: archetypeId,
      level: botLevel,
      xp: 0,
      current_hp_pct: 100,
      wounded_until: null,
      is_active: true,
      archetype: arch,
      item_bonuses: { hp: 0, atk: 0, def: 0, spd: 0 },
    } as Awaited<ReturnType<typeof fetchGuardian>>;
  } else {
    gB = await fetchGuardian(defender_guardian_id);
    if (!gB) return NextResponse.json({ ok: false, error: "guardian_missing" }, { status: 404 });
    if (gA.user_id === gB.user_id) return NextResponse.json({ ok: false, error: "cant_attack_self" }, { status: 400 });
  }

  const levelSpread = Math.abs(gA.level - gB!.level);
  if (levelSpread > 3) return NextResponse.json({ ok: false, error: "level_gap", detail: "Max ±3 Level erlaubt." }, { status: 403 });

  // Kontext (Talents+Skills) für Angreifer. Bots bekommen leeren Kontext (keine Talents/Skills in DB).
  const ctxA = await loadGuardianBattleContext(sb, gA.id);
  const ctxB = isBot
    ? { skill_levels: { active: 1, passive: 1, combat: 1, role: 1, expertise: 0 }, talent_bonuses: {} as Record<string, number> }
    : await loadGuardianBattleContext(sb, gB!.id);

  const inputA: BattleInput = {
    guardian: { id: gA.id, level: gA.level, current_hp_pct: gA.current_hp_pct, archetype: gA.archetype },
    is_home: false, crew_member_count: 1,
    item_bonuses: gA.item_bonuses,
    skill_levels: ctxA.skill_levels,
    talent_bonuses: ctxA.talent_bonuses,
  };
  const inputB: BattleInput = {
    guardian: { id: gB!.id, level: gB!.level, current_hp_pct: gB!.current_hp_pct, archetype: gB!.archetype },
    is_home: false, crew_member_count: 1,
    item_bonuses: gB!.item_bonuses,
    skill_levels: ctxB.skill_levels,
    talent_bonuses: ctxB.talent_bonuses,
  };

  const seed = `rf:${user.id}:${gB!.user_id}:${Date.now()}`;
  const result = runBattle(inputA, inputB, seed);
  const winnerUserId = result.winner === "A" ? user.id : result.winner === "B" ? gB!.user_id : null;

  // Settle: Bot = lightweight in-memory, echter Gegner = RPC mit Persistierung
  let settled: unknown;
  if (isBot) {
    const won = winnerUserId === user.id;
    const xp = won ? Math.max(40, 60 + gB!.level * 8) : 15;
    const rarity: "none"|"common"|"rare"|"epic"|"legendary" = won ? (gB!.level > gA.level ? "rare" : "common") : "common";
    const siegelType = ["universal", "infantry", "cavalry", "marksman", "mage"][Math.floor(Math.random() * 5)];

    // XP + Win/Loss auf aktiven Wächter
    await sb.from("user_guardians").update({
      xp: gA.xp + xp,
      wins: won ? undefined : undefined, // PostgREST ignoriert undefined
    }).eq("id", gA.id);
    if (won) {
      await sb.from("user_guardians").update({ xp: gA.xp + xp }).eq("id", gA.id);
    }

    // Siegel inkrementieren
    await sb.from("user_siegel").upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });
    const siegelCol = `siegel_${siegelType}`;
    const { data: curSiegel } = await sb.from("user_siegel").select(siegelCol).eq("user_id", user.id).maybeSingle();
    const curVal = (curSiegel as Record<string, number> | null)?.[siegelCol] ?? 0;
    await sb.from("user_siegel").update({ [siegelCol]: curVal + 1, updated_at: new Date().toISOString() }).eq("user_id", user.id);

    // Material-Drop (rarity-abhängig)
    await sb.rpc("roll_material_drop", { p_user_id: user.id, p_context_rarity: rarity });

    // Tagesstatus + Gems
    const { data: curState } = await sb.from("runner_fight_state").select("fights_used_today, gems_spent_today").eq("user_id", user.id).maybeSingle<{ fights_used_today: number; gems_spent_today: number }>();
    await sb.from("runner_fight_state").update({
      fights_used_today: (curState?.fights_used_today ?? 0) + 1,
      gems_spent_today: (curState?.gems_spent_today ?? 0) + cost,
      updated_at: new Date().toISOString(),
    }).eq("user_id", user.id);
    if (cost > 0) {
      await sb.from("user_gems").update({ gems: (gems?.gems ?? 0) - cost }).eq("user_id", user.id);
    }
    settled = { ok: true, won, xp, rarity, siegel_type: siegelType, item_id: null, user_item_id: null, is_bot: true };
  } else {
    const { data: rpcSettled, error: settleErr } = await sb.rpc("runner_fight_settle", {
      p_attacker_id: user.id,
      p_defender_id: gB!.user_id,
      p_attacker_guardian_id: gA.id,
      p_defender_guardian_id: gB!.id,
      p_winner_user_id: winnerUserId,
      p_seed: seed,
      p_rounds: result.rounds,
      p_gems_paid: cost,
    });
    if (settleErr) return NextResponse.json({ ok: false, error: settleErr.message }, { status: 500 });
    settled = rpcSettled;
    // Material-Drop basierend auf Loot-Rarity
    const rarity = (rpcSettled as { rarity?: string } | null)?.rarity ?? "common";
    if (rarity !== "none") {
      await sb.rpc("roll_material_drop", { p_user_id: user.id, p_context_rarity: rarity });
    }
  }

  // Missions-Progress: Arena-Sieg trackt Dailies + Weeklies
  if (winnerUserId === user.id) {
    await bumpMissionProgressBatch(sb, user.id, [
      { metric: "arena_wins",        amount: 1 },
      { metric: "weekly_arena_wins", amount: 1 },
    ]);
  }

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
