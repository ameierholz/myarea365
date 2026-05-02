import type { SupabaseClient } from "@supabase/supabase-js";
import { ACHIEVEMENTS, streakBonusXp, getCurrentHappyHour } from "@/lib/game-config";

export type WalkBonusResult = {
  baseXp: number;
  streakBonus: number;
  happyHourMult: number;
  boostMult: number;
  crewBoostMult: number;
  totalMult: number;
  finalXp: number;
  newAchievements: Array<{ id: string; name: string; xp: number; icon: string }>;
  achievementXp: number;
};

type UserStatsRow = {
  id: string;
  xp?: number | null;
  streak_days?: number | null;
  streak_best?: number | null;
  total_walks?: number | null;
  total_distance_m?: number | null;
  longest_run_m?: number | null;
  xp_boost_until?: string | null;
  xp_boost_multiplier?: number | null;
  current_crew_id?: string | null;
};

export async function computeAndApplyWalkBonuses(
  sb: SupabaseClient,
  userId: string,
  baseXp: number,
  walkDistanceM: number,
  territoriesCount: number,
): Promise<WalkBonusResult> {
  const { data: user } = await sb.from("users")
    .select("id, xp, streak_days, streak_best, total_walks, total_distance_m, longest_run_m, xp_boost_until, xp_boost_multiplier, current_crew_id")
    .eq("id", userId)
    .single<UserStatsRow>();

  const streak = user?.streak_days ?? 0;
  const streakBonus = streakBonusXp(streak);

  const happyHour = getCurrentHappyHour();
  const happyHourMult = happyHour?.active ? happyHour.multiplier : 1;

  const boostActive = user?.xp_boost_until && new Date(user.xp_boost_until).getTime() > Date.now();
  const boostMult = boostActive ? Number(user?.xp_boost_multiplier ?? 1) : 1;

  let crewBoostMult = 1;
  if (user?.current_crew_id) {
    const { data: crew } = await sb.from("crews")
      .select("xp_boost_until, xp_boost_multiplier")
      .eq("id", user.current_crew_id)
      .single<{ xp_boost_until: string | null; xp_boost_multiplier: number | null }>();
    if (crew?.xp_boost_until && new Date(crew.xp_boost_until).getTime() > Date.now()) {
      crewBoostMult = Number(crew.xp_boost_multiplier ?? 1);
    }

    // Crew-Synergie-Buff: +1% pro aktivem Mitglied (24h), max +25%
    try {
      const { data: synergy } = await sb.rpc("get_crew_synergy");
      const buffPct = (synergy as { buff_pct?: number } | null)?.buff_pct ?? 0;
      if (buffPct > 0) {
        crewBoostMult = Math.max(crewBoostMult, 1 + buffPct / 100);
      }
    } catch { /* fail-open */ }
  }

  // Mentor-Bonus: +50 Münzen für Mentee + Mentor wenn Mentee läuft
  try {
    await sb.rpc("process_mentor_walk_bonus", { p_mentee_user_id: userId });
  } catch { /* fail-open */ }

  // Personal- und Crew-Boost kombinieren sich NICHT (max, nicht Produkt)
  // Verhindert 2× + 2× = 4× Exploit
  const boostCombined = Math.max(boostMult, crewBoostMult);
  const totalMult = happyHourMult * boostCombined;
  const finalXp = Math.round((baseXp + streakBonus) * totalMult);

  // Saison-XP: halbiertes finalXp wandert in Saison-Pass
  try {
    await sb.rpc("add_season_xp", { p_user_id: userId, p_amount: Math.round(finalXp / 2) });
  } catch { /* fail-open */ }

  // Echte Zähler aus 3-Ebenen-Modell holen
  const [{ count: segmentCount }, { count: streetCount }, { count: polyCount }] = await Promise.all([
    sb.from("street_segments").select("id", { count: "exact", head: true }).eq("user_id", userId),
    sb.from("streets_claimed").select("id", { count: "exact", head: true }).eq("user_id", userId),
    sb.from("territory_polygons").select("id", { count: "exact", head: true }).eq("claimed_by_user_id", userId),
  ]);

  // Stats nach dem Walk (für Achievement-Check)
  const newStats = {
    total_walks: (user?.total_walks ?? 0) + 1,
    total_distance_m: (user?.total_distance_m ?? 0) + walkDistanceM,
    longest_run_m: Math.max(user?.longest_run_m ?? 0, walkDistanceM),
    streak_best: Math.max(user?.streak_best ?? 0, streak),
    territories: polyCount ?? territoriesCount,
    segments: segmentCount ?? 0,
    streets: streetCount ?? 0,
  };

  // Bestehende Achievements laden
  const { data: existing } = await sb.from("user_achievements")
    .select("achievement_id")
    .eq("user_id", userId);
  const existingIds = new Set((existing ?? []).map((r: { achievement_id: string }) => r.achievement_id));

  const newlyUnlocked: WalkBonusResult["newAchievements"] = [];
  for (const a of ACHIEVEMENTS) {
    if (existingIds.has(a.id)) continue;
    const statKey = a.stat;
    const current = statKey === "lifetime_km" ? newStats.total_distance_m / 1000
      : statKey === "longest_km" ? newStats.longest_run_m / 1000
      : statKey === "territories" ? newStats.territories
      : statKey === "segments" ? newStats.segments
      : statKey === "streets" ? newStats.streets
      : statKey === "streak_best" ? newStats.streak_best
      : statKey === "total_walks" ? newStats.total_walks
      : 0;
    if (current >= a.target) {
      newlyUnlocked.push({ id: a.id, name: a.name, xp: a.xp, icon: a.icon });
    }
  }

  // Achievement-Rows einfügen
  if (newlyUnlocked.length > 0) {
    await sb.from("user_achievements").insert(
      newlyUnlocked.map((a) => ({
        user_id: userId,
        achievement_id: a.id,
        xp_awarded: a.xp,
      })),
    );
  }
  const achievementXp = newlyUnlocked.reduce((s, a) => s + a.xp, 0);

  // Referral-Reward wenn dies der erste Walk des Users ist und er referred wurde
  const firstWalk = (user?.total_walks ?? 0) === 0;
  if (firstWalk) {
    const { data: ref } = await sb.from("referrals")
      .select("id, referrer_id, status")
      .eq("referred_user_id", userId)
      .maybeSingle<{ id: string; referrer_id: string; status: string }>();
    if (ref && ref.status !== "rewarded") {
      await sb.from("referrals").update({
        status: "rewarded",
        rewarded_at: new Date().toISOString(),
        reward_xp: 500,
      }).eq("id", ref.id);
      const { data: refUser } = await sb.from("users").select("xp").eq("id", ref.referrer_id).single<{ xp: number | null }>();
      await sb.from("users").update({ xp: (refUser?.xp ?? 0) + 500 }).eq("id", ref.referrer_id);
    }
  }

  return {
    baseXp,
    streakBonus,
    happyHourMult,
    boostMult,
    crewBoostMult,
    totalMult,
    finalXp,
    newAchievements: newlyUnlocked,
    achievementXp,
  };
}
