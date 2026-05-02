import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import { runBattle, type BattleInput } from "@/lib/battle-engine";
import { GUARDIAN_LEVEL_CAP } from "@/lib/guardian";
import { loadGuardianBattleContext } from "@/lib/guardian-battle-context";
import { getPowerZoneBuffs } from "@/lib/power-zone-buffs";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

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
  let body: { business_id: string; defender_user_id: string; attacker_lat?: number; attacker_lng?: number; double_down?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const { business_id, defender_user_id, attacker_lat, attacker_lng, double_down = false } = body;
  if (!business_id || !defender_user_id) return NextResponse.json({ error: "business_id + defender_user_id required" }, { status: 400 });

  const userClient = await createClient();
  const { data: auth } = await userClient.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = admin();

  const attacker_user_id = auth.user.id;
  if (attacker_user_id === defender_user_id) return NextResponse.json({ error: "same_user" }, { status: 400 });

  // Rate-Limit: 20 Arena-Kämpfe pro Minute pro Angreifer (10 gratis/Tag + 💎-Puffer,
  // danach greifen sowieso die semantischen Limits in runner_fight_settle).
  const rl = rateLimit(`arena:${attacker_user_id}`, 20, 60_000);
  const blocked = rateLimitResponse(rl);
  if (blocked) return blocked;

  // Proximity-Check: Attacker muss innerhalb 2km vom Shop sein
  // (Ein Crew-Mitglied in der Naehe reicht - der Angreifer vertritt die Crew)
  if (typeof attacker_lat === "number" && typeof attacker_lng === "number") {
    const { data: prox } = await sb.rpc("arena_proximity_ok", {
      p_user_lat: attacker_lat, p_user_lng: attacker_lng,
      p_business_id: business_id, p_radius_m: 2000,
    });
    if (!prox) {
      return NextResponse.json({ error: "too_far", detail: "Du musst innerhalb 2 km vom Shop sein, um die Arena zu betreten." }, { status: 403 });
    }
  } else {
    return NextResponse.json({ error: "location_required", detail: "Deine Position wird benötigt um die Arena zu betreten. Bitte GPS erlauben." }, { status: 400 });
  }

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

  // Eligibility: Runner darf kaempfen wenn ER SELBST oder EIN CREW-MITGLIED in 7T
  // hier eingeloest hat. Das foerdert Shop-Traffic ueber die ganze Crew.
  async function isEligible(userId: string, crewId: string | null): Promise<boolean> {
    const since = new Date(Date.now() - 3 * 86400000).toISOString();
    // selbst eingeloest?
    const { count: ownCount } = await sb.from("deal_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("business_id", business_id)
      .eq("status", "verified")
      .gte("verified_at", since);
    if ((ownCount ?? 0) > 0) return true;
    // Ueber Crew eligible?
    if (!crewId) return false;
    const { data } = await sb.rpc("arena_eligibility", { p_crew_id: crewId, p_business_id: business_id });
    return (data as { eligible: boolean })?.eligible ?? false;
  }
  const [attEligible, defEligible] = await Promise.all([
    isEligible(attacker_user_id, attProfile?.current_crew_id ?? null),
    isEligible(defender_user_id, defProfile?.current_crew_id ?? null),
  ]);
  if (!attEligible) return NextResponse.json({ error: "not_eligible", detail: "Weder du noch deine Crew hat hier in den letzten 3 Tagen eingelöst" }, { status: 403 });
  if (!defEligible) return NextResponse.json({ error: "defender_not_eligible", detail: "Der Gegner ist nicht eligible" }, { status: 403 });

  // Revenge-Sperre 6h: Verteidiger darf Angreifer in 6h nicht wieder herausfordern (und umgekehrt)
  const revengeSince = new Date(Date.now() - 6 * 3600000).toISOString();
  const { count: revengeCount } = await sb.from("arena_battles")
    .select("id", { count: "exact", head: true })
    .eq("challenger_user_id", defender_user_id)
    .eq("defender_user_id", attacker_user_id)
    .gte("created_at", revengeSince);
  if ((revengeCount ?? 0) > 0) {
    return NextResponse.json({ error: "revenge_locked", detail: "6h Revenge-Sperre: Dieser Gegner hat dich gerade angegriffen — warte kurz." }, { status: 429 });
  }

  // Weekly-Cap: max 1 Kampf gegen denselben Verteidiger pro Woche
  const weekSince = new Date(Date.now() - 7 * 86400000).toISOString();
  const { count: weeklyCount } = await sb.from("arena_battles")
    .select("id", { count: "exact", head: true })
    .eq("challenger_user_id", attacker_user_id)
    .eq("defender_user_id", defender_user_id)
    .gte("created_at", weekSince);
  if ((weeklyCount ?? 0) > 0) {
    return NextResponse.json({ error: "weekly_cap", detail: "Du hast diesen Runner diese Woche schon herausgefordert." }, { status: 429 });
  }

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
    // Equipped Items + Bonuses
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

  const gA = await fetchGuardian(attacker_user_id);
  const gB = await fetchGuardian(defender_user_id);
  if (!gA || !gB) return NextResponse.json({ error: "guardian_missing" }, { status: 500 });
  if (gA.wounded_until && new Date(gA.wounded_until).getTime() > Date.now()) {
    return NextResponse.json({ error: "wounded", detail: "Dein Wächter ist noch verwundet" }, { status: 400 });
  }
  if (gB.wounded_until && new Date(gB.wounded_until).getTime() > Date.now()) {
    return NextResponse.json({ error: "defender_wounded", detail: "Der gegnerische Wächter ist noch verwundet" }, { status: 400 });
  }

  // Level-Spread-Cap: max 5 Level Differenz — verhindert Stomps
  const levelSpread = Math.abs(gA.level - gB.level);
  if (levelSpread > 5) {
    return NextResponse.json({
      error: "level_gap",
      detail: `Level-Differenz zu groß (${levelSpread}). Max. ±5 erlaubt — sonst wär's unfair.`,
    }, { status: 403 });
  }

  async function countMembers(crewId: string | null): Promise<number> {
    if (!crewId) return 1;
    const { count } = await sb.from("users").select("id", { count: "exact", head: true }).eq("current_crew_id", crewId);
    return count ?? 1;
  }
  const [attCount, defCount] = await Promise.all([countMembers(attProfile?.current_crew_id ?? null), countMembers(defProfile?.current_crew_id ?? null)]);

  // Skill-Levels + Talent-Bonuses aus DB laden (sonst kämpfen alle Wächter ohne Progression-Boni)
  // Power-Zone-Buffs aus aktueller Position des Angreifers (nur Attacker hat GPS übermittelt)
  const [ctxA, ctxB, zoneA, potionsARes, potionsBRes] = await Promise.all([
    loadGuardianBattleContext(sb, gA.id),
    loadGuardianBattleContext(sb, gB.id),
    getPowerZoneBuffs(sb, attacker_lat ?? null, attacker_lng ?? null),
    sb.rpc("get_active_potions", { p_user_id: attacker_user_id }),
    sb.rpc("get_active_potions", { p_user_id: defender_user_id }),
  ]);

  // Aktive Tränke als Talent-Bonus einrechnen (additiv, keys matchen BattleInput)
  type PotionRow = { effect_key: string; effect_value: number };
  function mergePotions(ctx: typeof ctxA, rows: PotionRow[] | null | undefined) {
    for (const row of rows ?? []) {
      const key = row.effect_key as keyof typeof ctx.talent_bonuses;
      const val = Number(row.effect_value ?? 0);
      if (key in ctx.talent_bonuses) {
        (ctx.talent_bonuses as unknown as Record<string, number>)[key] =
          ((ctx.talent_bonuses as unknown as Record<string, number>)[key] ?? 0) + val;
      }
    }
    return ctx;
  }
  mergePotions(ctxA, potionsARes.data as PotionRow[] | null);
  mergePotions(ctxB, potionsBRes.data as PotionRow[] | null);

  // Power-Zone-Buffs flach auf item_bonuses addieren (beide sind Stat-Bonuses)
  const itemA = {
    hp:  (gA.item_bonuses?.hp  ?? 0) + zoneA.hp,
    atk: (gA.item_bonuses?.atk ?? 0) + zoneA.atk,
    def: (gA.item_bonuses?.def ?? 0) + zoneA.def,
    spd: (gA.item_bonuses?.spd ?? 0) + zoneA.spd,
  };

  const inputA: BattleInput = {
    guardian: { id: gA.id, level: gA.level, current_hp_pct: gA.current_hp_pct, archetype: gA.archetype },
    is_home: false, crew_member_count: attCount,
    item_bonuses: itemA,
    skill_levels: ctxA.skill_levels,
    talent_bonuses: ctxA.talent_bonuses,
  };
  const inputB: BattleInput = {
    guardian: { id: gB.id, level: gB.level, current_hp_pct: gB.current_hp_pct, archetype: gB.archetype },
    is_home: false, crew_member_count: defCount,
    item_bonuses: gB.item_bonuses,
    skill_levels: ctxB.skill_levels,
    talent_bonuses: ctxB.talent_bonuses,
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

  // Phase-1-Boni berechnen
  const isUnderdog = result.winner === "A" ? gA.level < gB.level : result.winner === "B" ? gB.level < gA.level : false;
  const underdogBonus = isUnderdog ? 200 : 0;
  // Glückstreffer: Verlierer hat weniger als 20% HP (knapp verloren)
  const loserFinalHp = result.winner === "A" ? result.final_hp_b : result.final_hp_a;
  const loserMaxHp = (() => {
    const g = result.winner === "A" ? gB : gA;
    return Math.round(g.archetype.base_hp * (1 + (g.level - 1) * 0.06)) + (g.item_bonuses?.hp ?? 0);
  })();
  const closeLoss = result.winner !== "draw" && (loserFinalHp / loserMaxHp) < 0.20;
  const closeBonus = closeLoss ? 100 : 0;

  async function applyOutcome(g: NonNullable<typeof gA>, won: boolean, finalHp: number, side: "A" | "B") {
    const baseMaxHp = Math.round(g.archetype.base_hp * (1 + (g.level - 1) * 0.06));
    const maxHp = baseMaxHp + (g.item_bonuses?.hp ?? 0);
    const hpPct = Math.max(0, Math.round((finalHp / maxHp) * 100));
    let xpGain = won ? result.xp_awarded : Math.round(result.xp_awarded * 0.25);

    if (won) {
      xpGain += underdogBonus;
      // Double-Down: Angreifer hat Risiko eingelegt → +50% XP bei Sieg
      if (double_down && side === "A") xpGain = Math.round(xpGain * 1.5);
    } else {
      // Glückstreffer-Trostpreis für Verlierer bei knapper Niederlage
      xpGain += closeBonus;
    }

    // Verwundung: Standard 24h, Double-Down-Verlierer 48h
    let woundHours = 0;
    if (!won && finalHp <= 0) woundHours = 24;
    if (!won && double_down && side === "A") woundHours = 48;
    const wounded = woundHours > 0 ? new Date(Date.now() + woundHours * 3600000).toISOString() : null;

    await sb.from("user_guardians").update({
      wins: won ? g.wins + 1 : g.wins,
      losses: !won ? g.losses + 1 : g.losses,
      current_hp_pct: Math.max(10, Math.min(100, hpPct)),
      wounded_until: wounded,
    }).eq("id", g.id);

    if (xpGain > 0 && g.level < GUARDIAN_LEVEL_CAP) {
      await sb.rpc("apply_guardian_xp", { p_guardian_id: g.id, p_xp: xpGain });
    }
  }

  // Session-Score updaten (zählt Kämpfe in aktuelle Arena-Session ein)
  if (winnerUserId && result.winner !== "draw") {
    const loserUserId = winnerUserId === attacker_user_id ? defender_user_id : attacker_user_id;
    const loserCrewId = winnerUserId === attacker_user_id ? (defProfile?.current_crew_id ?? null) : (attProfile?.current_crew_id ?? null);
    await sb.rpc("record_arena_session_battle", {
      p_winner_user_id: winnerUserId,
      p_loser_user_id: loserUserId,
      p_winner_crew_id: winnerCrewId,
      p_loser_crew_id: loserCrewId,
      p_fusion: false,
      p_trophy: false,
    });
  }

  // Aktive Tränke des Verlierers konsumieren (Haltbarkeit 1h, aber auch Verlust bei Niederlage)
  if (result.winner === "A") {
    await sb.rpc("consume_active_potions", { p_user_id: defender_user_id });
  } else if (result.winner === "B") {
    await sb.rpc("consume_active_potions", { p_user_id: attacker_user_id });
  }

  await Promise.all([
    applyOutcome(gA, result.winner === "A", result.final_hp_a, "A"),
    applyOutcome(gB, result.winner === "B", result.final_hp_b, "B"),
  ]);

  // Siegel + Diamanten für den Sieger (typ-spezifisch basierend auf Gegner-Typ)
  let arenaRewards: {
    ok: boolean; siegel_type?: string; siegel_amount?: number; universal_siegel?: number; gems?: number;
  } | null = null;
  if (winnerUserId) {
    const winnerMaxHp = winnerUserId === attacker_user_id
      ? Math.round(gA.archetype.base_hp * (1 + (gA.level - 1) * 0.06)) + (gA.item_bonuses?.hp ?? 0)
      : Math.round(gB.archetype.base_hp * (1 + (gB.level - 1) * 0.06)) + (gB.item_bonuses?.hp ?? 0);
    const winnerFinalHp = winnerUserId === attacker_user_id ? result.final_hp_a : result.final_hp_b;
    const hpRatio = winnerFinalHp / Math.max(1, winnerMaxHp);
    const margin: "close" | "clear" | "flawless" = hpRatio > 0.8 ? "flawless" : hpRatio > 0.4 ? "clear" : "close";
    const loserArchetypeId = winnerUserId === attacker_user_id ? gB.archetype_id : gA.archetype_id;
    const { data: rewards } = await sb.rpc("arena_grant_rewards", {
      p_winner_user_id: winnerUserId,
      p_loser_archetype_id: loserArchetypeId,
      p_margin: margin,
    });
    arenaRewards = rewards as typeof arenaRewards;
  }

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
        const boostedLevel = Math.min(GUARDIAN_LEVEL_CAP, winnerGuardian.level + 1);
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

  // Sessionehre — Arena-spezifische Währung, entkoppelt von Wegemünzen/Gebietsruf.
  // Win: +50 % des battle-xp. Loss: −20 %. Floor bei 0 via RPC.
  let sessionehreWinnerDelta = 0;
  let sessionehreLoserDelta = 0;
  if (winnerUserId && result.winner !== "draw") {
    const loserUserId = winnerUserId === attacker_user_id ? defender_user_id : attacker_user_id;
    sessionehreWinnerDelta = Math.max(10, Math.round(result.xp_awarded * 0.5));
    sessionehreLoserDelta  = -Math.max(5, Math.round(result.xp_awarded * 0.2));
    await Promise.all([
      sb.rpc("bump_sessionehre", { p_user_id: winnerUserId, p_delta: sessionehreWinnerDelta }),
      sb.rpc("bump_sessionehre", { p_user_id: loserUserId,  p_delta: sessionehreLoserDelta  }),
    ]);
  }

  return NextResponse.json({
    battle_id: battleRow.id,
    winner: result.winner,
    winner_user_id: winnerUserId,
    rounds: result.rounds,
    xp_awarded: result.xp_awarded,
    sessionehre_winner_delta: sessionehreWinnerDelta,
    sessionehre_loser_delta: sessionehreLoserDelta,
    final_hp_a: result.final_hp_a,
    final_hp_b: result.final_hp_b,
    fusion: fusionResult,
    rewards: arenaRewards,
    bonuses: {
      underdog: underdogBonus,
      close_loss: closeBonus,
      double_down: double_down,
    },
    type_advantage: result.type_advantage,
  });
}
