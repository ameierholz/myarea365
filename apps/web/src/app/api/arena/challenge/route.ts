import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import { runBattle, type BattleInput } from "@/lib/battle-engine";
import { xpForLevel } from "@/lib/guardian";

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
 * POST /api/arena/challenge
 * Body: { business_id, defender_user_id }
 *
 * Runner-Level-Kampf: 1 Runner fordert 1 Runner heraus.
 * Beide Crews müssen eligible sein (Deal in 7T). Crew-Stats profitieren
 * vom Sieg (Siege zählen dem Runner UND seiner aktuellen Crew).
 */
export async function POST(req: Request) {
  try {
    return await handleChallenge(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[arena/challenge]", e);
    return NextResponse.json({ error: "internal", detail: msg }, { status: 500 });
  }
}

async function handleChallenge(req: Request) {
  let body: { business_id: string; defender_user_id: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const { business_id, defender_user_id } = body;
  if (!business_id || !defender_user_id) return NextResponse.json({ error: "business_id + defender_user_id required" }, { status: 400 });

  const userClient = await createClient();
  const { data: auth } = await userClient.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = admin();

  const attacker_user_id = auth.user.id;
  if (attacker_user_id === defender_user_id) return NextResponse.json({ error: "same_user" }, { status: 400 });

  // Profile beider Runner (Crew-Kontext)
  const { data: attProfile } = await sb.from("users").select("current_crew_id").eq("id", attacker_user_id).single<{ current_crew_id: string | null }>();
  const { data: defProfile } = await sb.from("users").select("current_crew_id").eq("id", defender_user_id).single<{ current_crew_id: string | null }>();

  // Arena aktiv?
  const { data: arena } = await sb.from("shop_arenas")
    .select("id, status, expires_at")
    .eq("business_id", business_id)
    .maybeSingle<{ id: string; status: string; expires_at: string }>();
  if (!arena || arena.status !== "active" || new Date(arena.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "arena_inactive" }, { status: 400 });
  }

  // Eligibility: beide Crews müssen eingelöst haben (wenn Runner in Crew sind)
  async function eligibleViaCrew(crewId: string | null): Promise<boolean> {
    if (!crewId) return false;
    const { data } = await sb.rpc("arena_eligibility", { p_crew_id: crewId, p_business_id: business_id });
    return (data as { eligible: boolean })?.eligible ?? false;
  }
  const attCrewEligible = await eligibleViaCrew(attProfile?.current_crew_id ?? null);
  const defCrewEligible = await eligibleViaCrew(defProfile?.current_crew_id ?? null);
  if (!attCrewEligible) return NextResponse.json({ error: "attacker_not_eligible" }, { status: 403 });
  if (!defCrewEligible) return NextResponse.json({ error: "defender_not_eligible" }, { status: 403 });

  // 1 Kampf pro Arena pro Angreifer/Tag
  const since = new Date(Date.now() - 24 * 3600000).toISOString();
  const { count: recentCount } = await sb.from("arena_battles")
    .select("id", { count: "exact", head: true })
    .eq("arena_id", arena.id)
    .eq("challenger_user_id", attacker_user_id)
    .gte("created_at", since);
  if ((recentCount ?? 0) > 0) return NextResponse.json({ error: "cooldown", detail: "24h Cooldown pro Arena" }, { status: 429 });

  async function fetchGuardian(userId: string) {
    const { data } = await sb.from("user_guardians")
      .select("id, user_id, crew_id, archetype_id, level, xp, wins, losses, current_hp_pct, wounded_until, is_active")
      .eq("user_id", userId).eq("is_active", true).maybeSingle();
    if (!data) return null;
    const { data: arch } = await sb.from("guardian_archetypes").select("*").eq("id", data.archetype_id).single();
    return { ...data, archetype: arch };
  }

  const gA = await fetchGuardian(attacker_user_id);
  const gB = await fetchGuardian(defender_user_id);
  if (!gA || !gB) return NextResponse.json({ error: "guardian_missing" }, { status: 500 });
  if (gA.wounded_until && new Date(gA.wounded_until).getTime() > Date.now()) {
    return NextResponse.json({ error: "wounded", detail: "Dein Wächter ist noch verwundet" }, { status: 400 });
  }
  if (gB.wounded_until && new Date(gB.wounded_until).getTime() > Date.now()) {
    return NextResponse.json({ error: "defender_wounded", detail: "Der gegnerische Wächter ist noch verwundet" }, { status: 400 });
  }

  async function countMembers(crewId: string | null): Promise<number> {
    if (!crewId) return 1;
    const { count } = await sb.from("users").select("id", { count: "exact", head: true }).eq("current_crew_id", crewId);
    return count ?? 1;
  }
  const [attCount, defCount] = await Promise.all([countMembers(attProfile?.current_crew_id ?? null), countMembers(defProfile?.current_crew_id ?? null)]);

  const inputA: BattleInput = {
    guardian: { id: gA.id, level: gA.level, current_hp_pct: gA.current_hp_pct, archetype: gA.archetype },
    is_home: false, crew_member_count: attCount,
  };
  const inputB: BattleInput = {
    guardian: { id: gB.id, level: gB.level, current_hp_pct: gB.current_hp_pct, archetype: gB.archetype },
    is_home: false, crew_member_count: defCount,
  };

  const seed = `${business_id}:${attacker_user_id}:${defender_user_id}:${Date.now()}`;
  const result = runBattle(inputA, inputB, seed);
  const winnerUserId = result.winner === "A" ? attacker_user_id : result.winner === "B" ? defender_user_id : null;
  const winnerCrewId = winnerUserId === attacker_user_id ? (attProfile?.current_crew_id ?? null) : winnerUserId === defender_user_id ? (defProfile?.current_crew_id ?? null) : null;

  const { data: battleRow, error: battleErr } = await sb.from("arena_battles").insert({
    arena_id: arena.id,
    business_id,
    challenger_user_id: attacker_user_id,
    defender_user_id: defender_user_id,
    challenger_crew_id: attProfile?.current_crew_id ?? null,
    defender_crew_id: defProfile?.current_crew_id ?? null,
    challenger_guardian_id: gA.id,
    defender_guardian_id: gB.id,
    winner_crew_id: winnerCrewId,
    seed,
    rounds: result.rounds,
    xp_awarded: result.xp_awarded,
    challenger_trigger_user_id: attacker_user_id,
  }).select("id").single<{ id: string }>();
  if (battleErr || !battleRow) return NextResponse.json({ error: "battle_save_failed", detail: battleErr?.message ?? "no row" }, { status: 500 });

  async function applyOutcome(g: NonNullable<typeof gA>, won: boolean, finalHp: number) {
    const maxHp = Math.round(g.archetype.base_hp * (1 + (g.level - 1) * 0.08));
    const hpPct = Math.max(0, Math.round((finalHp / maxHp) * 100));
    const newXp = won ? g.xp + result.xp_awarded : g.xp + Math.round(result.xp_awarded * 0.25);
    let newLevel = g.level;
    let xpOverflow = newXp;
    while (newLevel < 30 && xpOverflow >= xpForLevel(newLevel)) {
      xpOverflow -= xpForLevel(newLevel);
      newLevel++;
    }
    const wounded = !won && finalHp <= 0 ? new Date(Date.now() + 24 * 3600000).toISOString() : null;
    await sb.from("user_guardians").update({
      level: newLevel, xp: xpOverflow,
      wins: won ? g.wins + 1 : g.wins,
      losses: !won ? g.losses + 1 : g.losses,
      current_hp_pct: Math.max(10, Math.min(100, hpPct)),
      wounded_until: wounded,
    }).eq("id", g.id);
  }

  await Promise.all([
    applyOutcome(gA, result.winner === "A", result.final_hp_a),
    applyOutcome(gB, result.winner === "B", result.final_hp_b),
  ]);

  const { data: arenaRow } = await sb.from("shop_arenas").select("total_battles").eq("id", arena.id).single<{ total_battles: number }>();
  await sb.from("shop_arenas").update({ total_battles: (arenaRow?.total_battles ?? 0) + 1 }).eq("id", arena.id);

  // Streak + Fusion/Trophy
  let fusionResult: { kind: "fusion" | "trophy"; description: string } | null = null;
  if (winnerUserId) {
    const winnerSide = winnerUserId === attacker_user_id ? "A" : "B";
    const loserUserId = winnerSide === "A" ? defender_user_id : attacker_user_id;
    const loserGuardian = winnerSide === "A" ? gB : gA;
    const winnerGuardian = winnerSide === "A" ? gA : gB;

    const { data: streak } = await sb.from("arena_streaks")
      .select("id, consecutive_wins")
      .eq("attacker_user_id", winnerUserId)
      .eq("defender_user_id", loserUserId)
      .maybeSingle<{ id: string; consecutive_wins: number }>();
    await sb.from("arena_streaks").update({ consecutive_wins: 0, last_battle_at: new Date().toISOString() })
      .eq("attacker_user_id", loserUserId).eq("defender_user_id", winnerUserId);
    const newStreak = (streak?.consecutive_wins ?? 0) + 1;
    if (streak) {
      await sb.from("arena_streaks").update({ consecutive_wins: newStreak, last_battle_at: new Date().toISOString() }).eq("id", streak.id);
    } else {
      await sb.from("arena_streaks").insert({ attacker_user_id: winnerUserId, defender_user_id: loserUserId, consecutive_wins: 1 });
    }

    if (newStreak >= 3) {
      const sameArchetype = winnerGuardian.archetype_id === loserGuardian.archetype_id;
      if (sameArchetype) {
        const boostedLevel = Math.min(30, winnerGuardian.level + 1);
        await sb.from("user_guardians").update({ level: boostedLevel, xp: 0, source: "fused" }).eq("id", winnerGuardian.id);
        fusionResult = { kind: "fusion", description: `Fusion! Dein ${winnerGuardian.archetype.name} ist jetzt Level ${boostedLevel}.` };
      } else {
        await sb.from("guardian_trophies").insert({
          user_id: winnerUserId,
          crew_id: winnerSide === "A" ? (attProfile?.current_crew_id ?? null) : (defProfile?.current_crew_id ?? null),
          archetype_id: loserGuardian.archetype_id,
          captured_from_crew_id: loserGuardian.crew_id,
          captured_level: loserGuardian.level,
        });
        fusionResult = { kind: "trophy", description: `Trophäe erobert: ${loserGuardian.archetype.name} (Lv ${loserGuardian.level}).` };
        await sb.from("user_guardians").update({
          wounded_until: new Date(Date.now() + 7 * 86400000).toISOString(),
        }).eq("id", loserGuardian.id);
      }
      await sb.from("arena_streaks").update({ consecutive_wins: 0 })
        .eq("attacker_user_id", winnerUserId).eq("defender_user_id", loserUserId);
      await sb.from("arena_battles").update({ guardian_captured_id: loserGuardian.id }).eq("id", battleRow.id);
    }
  }

  return NextResponse.json({
    battle_id: battleRow.id,
    winner: result.winner,
    winner_user_id: winnerUserId,
    rounds: result.rounds,
    xp_awarded: result.xp_awarded,
    final_hp_a: result.final_hp_a,
    final_hp_b: result.final_hp_b,
    fusion: fusionResult,
  });
}
