import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  level: number;
  faction: string | null;
  crew_id: string | null;
  crew_name: string | null;
  crew_color: string | null;
  wins: number;
  losses: number;
  honor: number;
};

/**
 * GET /api/leaderboard/hall-of-honor
 * S&F-Style all-time-Rangliste: gesummiert über runner_fights + arena_battles.
 * Ehre = Siege × Level-Multiplier.
 */
export async function GET() {
  const sb = await createClient();

  // Runner-Fights: zählen wie oft jemand gewonnen hat
  const { data: rfRows } = await sb.from("runner_fights")
    .select("attacker_id, defender_id, winner_user_id")
    .limit(5000);

  const winsByUser = new Map<string, number>();
  const lossesByUser = new Map<string, number>();
  for (const r of rfRows ?? []) {
    const att = (r as { attacker_id: string }).attacker_id;
    const def = (r as { defender_id: string }).defender_id;
    const w = (r as { winner_user_id: string | null }).winner_user_id;
    if (w === att) {
      winsByUser.set(att, (winsByUser.get(att) ?? 0) + 1);
      lossesByUser.set(def, (lossesByUser.get(def) ?? 0) + 1);
    } else if (w === def) {
      winsByUser.set(def, (winsByUser.get(def) ?? 0) + 1);
      lossesByUser.set(att, (lossesByUser.get(att) ?? 0) + 1);
    }
  }

  const userIds = new Set<string>([...winsByUser.keys(), ...lossesByUser.keys()]);
  if (userIds.size === 0) return NextResponse.json({ rows: [] });

  const { data: users } = await sb.from("users")
    .select("id, username, display_name, level, faction, current_crew_id")
    .in("id", Array.from(userIds));

  const crewIds = (users ?? []).map((u) => (u as { current_crew_id: string | null }).current_crew_id).filter((x): x is string => !!x);
  const uniqCrewIds = Array.from(new Set(crewIds));
  const { data: crews } = uniqCrewIds.length > 0
    ? await sb.from("crews").select("id, name, color").in("id", uniqCrewIds)
    : { data: [] as Array<{ id: string; name: string | null; color: string | null }> };
  const crewMap = new Map((crews ?? []).map((c) => [(c as { id: string }).id, c]));

  const rows: Row[] = (users ?? []).map((u) => {
    const uu = u as { id: string; username: string | null; display_name: string | null; level: number; faction: string | null; current_crew_id: string | null };
    const wins = winsByUser.get(uu.id) ?? 0;
    const losses = lossesByUser.get(uu.id) ?? 0;
    const crew = uu.current_crew_id ? crewMap.get(uu.current_crew_id) as { name: string | null; color: string | null } | undefined : null;
    return {
      user_id: uu.id,
      username: uu.username,
      display_name: uu.display_name,
      level: uu.level,
      faction: uu.faction,
      crew_id: uu.current_crew_id,
      crew_name: crew?.name ?? null,
      crew_color: crew?.color ?? null,
      wins,
      losses,
      honor: wins * (Math.max(1, uu.level)) * 10,
    };
  });

  rows.sort((a, b) => b.honor - a.honor);
  return NextResponse.json({ rows: rows.slice(0, 100) });
}
