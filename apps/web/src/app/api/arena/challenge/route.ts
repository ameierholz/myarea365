import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runBattle, type BattleInput } from "@/lib/battle-engine";
import { xpForLevel } from "@/lib/guardian";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/arena/challenge
 * Body: { business_id: string, defender_crew_id: string }
 *
 * - Pruefen: Arena aktiv, beide Crews eligible, Waechter nicht verwundet
 * - 1 Kampf/Tag-Cap pro Angreifer/Verteidiger/Arena
 * - Battle-Engine laufen lassen, Ergebnis speichern
 * - Guardian-Stats updaten (wins/losses/xp/level/wounded)
 * - Streak-Counter updaten
 */
export async function POST(req: Request) {
  let body: { business_id: string; defender_crew_id: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const { business_id, defender_crew_id } = body;
  if (!business_id || !defender_crew_id) return NextResponse.json({ error: "business_id + defender_crew_id required" }, { status: 400 });

  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Profil → eigene Crew
  const { data: profile } = await sb.from("users")
    .select("current_crew_id")
    .eq("id", auth.user.id)
    .single<{ current_crew_id: string | null }>();
  const attacker_crew_id = profile?.current_crew_id;
  if (!attacker_crew_id) return NextResponse.json({ error: "not_in_crew" }, { status: 400 });
  if (attacker_crew_id === defender_crew_id) return NextResponse.json({ error: "same_crew" }, { status: 400 });

  // Arena-Status
  const { data: arena } = await sb.from("shop_arenas")
    .select("id, status, expires_at")
    .eq("business_id", business_id)
    .maybeSingle<{ id: string; status: string; expires_at: string }>();
  if (!arena || arena.status !== "active" || new Date(arena.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "arena_inactive" }, { status: 400 });
  }

  // Eligibility beider Crews (Deal in 7d)
  const { data: attElig } = await sb.rpc("arena_eligibility", { p_crew_id: attacker_crew_id, p_business_id: business_id });
  const { data: defElig } = await sb.rpc("arena_eligibility", { p_crew_id: defender_crew_id, p_business_id: business_id });
  const aE = attElig as { eligible: boolean };
  const dE = defElig as { eligible: boolean };
  if (!aE?.eligible) return NextResponse.json({ error: "attacker_not_eligible" }, { status: 403 });
  if (!dE?.eligible) return NextResponse.json({ error: "defender_not_eligible" }, { status: 403 });

  // 1 Kampf pro Crew pro Arena pro Tag
  const since = new Date(Date.now() - 24 * 3600000).toISOString();
  const { count: recentCount } = await sb.from("arena_battles")
    .select("id", { count: "exact", head: true })
    .eq("arena_id", arena.id)
    .eq("challenger_crew_id", attacker_crew_id)
    .gte("created_at", since);
  if ((recentCount ?? 0) > 0) return NextResponse.json({ error: "cooldown", detail: "24h Cooldown pro Arena" }, { status: 429 });

  // Guardians holen
  async function fetchGuardianWithArchetype(crewId: string) {
    const { data } = await sb.from("crew_guardians")
      .select("id, crew_id, archetype_id, level, xp, wins, losses, current_hp_pct, wounded_until, is_active")
      .eq("crew_id", crewId)
      .eq("is_active", true)
      .maybeSingle();
    if (!data) return null;
    const { data: arch } = await sb.from("guardian_archetypes")
      .select("*")
      .eq("id", data.archetype_id)
      .single();
    return { ...data, archetype: arch };
  }

  const gA = await fetchGuardianWithArchetype(attacker_crew_id);
  const gB = await fetchGuardianWithArchetype(defender_crew_id);
  if (!gA || !gB) return NextResponse.json({ error: "guardian_missing" }, { status: 500 });
  if (gA.wounded_until && new Date(gA.wounded_until).getTime() > Date.now()) {
    return NextResponse.json({ error: "wounded", detail: "Dein Waechter ist noch verwundet" }, { status: 400 });
  }
  if (gB.wounded_until && new Date(gB.wounded_until).getTime() > Date.now()) {
    return NextResponse.json({ error: "defender_wounded" }, { status: 400 });
  }

  // Crew-Mitgliederanzahl fuer Rudel
  async function countMembers(crewId: string): Promise<number> {
    const { count } = await sb.from("users").select("id", { count: "exact", head: true }).eq("current_crew_id", crewId);
    return count ?? 1;
  }
  const [attCount, defCount] = await Promise.all([countMembers(attacker_crew_id), countMembers(defender_crew_id)]);

  // is_home: vereinfacht — immer false (koennte Shop-Stadt vs. Crew-Stadt werden)
  const inputA: BattleInput = {
    guardian: { id: gA.id, level: gA.level, current_hp_pct: gA.current_hp_pct, archetype: gA.archetype },
    is_home: false, crew_member_count: attCount,
  };
  const inputB: BattleInput = {
    guardian: { id: gB.id, level: gB.level, current_hp_pct: gB.current_hp_pct, archetype: gB.archetype },
    is_home: false, crew_member_count: defCount,
  };

  const seed = `${business_id}:${attacker_crew_id}:${defender_crew_id}:${Date.now()}`;
  const result = runBattle(inputA, inputB, seed);
  const winnerCrewId = result.winner === "A" ? attacker_crew_id : result.winner === "B" ? defender_crew_id : null;

  // Battle speichern
  const { data: battleRow, error: battleErr } = await sb.from("arena_battles").insert({
    arena_id: arena.id,
    business_id,
    challenger_crew_id: attacker_crew_id,
    defender_crew_id: defender_crew_id,
    challenger_guardian_id: gA.id,
    defender_guardian_id: gB.id,
    winner_crew_id: winnerCrewId,
    seed,
    rounds: result.rounds,
    xp_awarded: result.xp_awarded,
    challenger_trigger_user_id: auth.user.id,
  }).select("id").single<{ id: string }>();
  if (battleErr) return NextResponse.json({ error: "battle_save_failed", detail: battleErr.message }, { status: 500 });

  // Guardians updaten
  async function applyOutcome(g: NonNullable<typeof gA>, won: boolean, finalHp: number) {
    const hpPct = Math.max(0, Math.round((finalHp / 1) * 100 / Math.max(1, g.archetype.base_hp * (1 + (g.level - 1) * 0.08))));
    const newXp = won ? g.xp + result.xp_awarded : g.xp + Math.round(result.xp_awarded * 0.25);
    let newLevel = g.level;
    let xpOverflow = newXp;
    while (newLevel < 30 && xpOverflow >= xpForLevel(newLevel)) {
      xpOverflow -= xpForLevel(newLevel);
      newLevel++;
    }
    const wounded = !won && finalHp <= 0 ? new Date(Date.now() + 24 * 3600000).toISOString() : null;
    await sb.from("crew_guardians").update({
      level: newLevel, xp: xpOverflow,
      wins: won ? g.wins + 1 : g.wins,
      losses: !won ? g.losses + 1 : g.losses,
      current_hp_pct: Math.max(10, Math.min(100, hpPct)),
      wounded_until: wounded,
    }).eq("id", g.id);
  }

  const aWon = result.winner === "A";
  const bWon = result.winner === "B";
  await Promise.all([
    applyOutcome(gA, aWon, result.final_hp_a),
    applyOutcome(gB, bWon, result.final_hp_b),
  ]);

  // Arena-Zaehler + Streak
  await sb.from("shop_arenas").update({ total_battles: (await sb.from("shop_arenas").select("total_battles").eq("id", arena.id).single()).data?.total_battles ?? 0 + 1 }).eq("id", arena.id);
  // Vereinfachter Streak-Update
  if (winnerCrewId) {
    const { data: streak } = await sb.from("arena_streaks")
      .select("id, consecutive_wins")
      .eq("attacker_crew_id", winnerCrewId === attacker_crew_id ? attacker_crew_id : defender_crew_id)
      .eq("defender_crew_id", winnerCrewId === attacker_crew_id ? defender_crew_id : attacker_crew_id)
      .maybeSingle<{ id: string; consecutive_wins: number }>();
    if (streak) {
      await sb.from("arena_streaks").update({ consecutive_wins: streak.consecutive_wins + 1, last_battle_at: new Date().toISOString() }).eq("id", streak.id);
    } else {
      await sb.from("arena_streaks").insert({
        attacker_crew_id: winnerCrewId === attacker_crew_id ? attacker_crew_id : defender_crew_id,
        defender_crew_id: winnerCrewId === attacker_crew_id ? defender_crew_id : attacker_crew_id,
        consecutive_wins: 1,
      });
    }
  }

  return NextResponse.json({
    battle_id: battleRow.id,
    winner: result.winner,
    winner_crew_id: winnerCrewId,
    rounds: result.rounds,
    xp_awarded: result.xp_awarded,
    final_hp_a: result.final_hp_a,
    final_hp_b: result.final_hp_b,
  });
}
