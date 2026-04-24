import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tierForMmr } from "@/lib/mmr-tiers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/runner/mmr/leaderboard?limit=50
 * Top-N Runner sortiert nach MMR, mit Username/DisplayName/Avatar.
 */
export async function GET(req: Request) {
  const sb = await createClient();
  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") ?? 50)));

  const { data, error } = await sb.from("runner_mmr")
    .select("user_id, mmr, games, wins, losses, peak_mmr, users:user_id(username, display_name, avatar_url, faction, team_color, supporter_tier)")
    .gt("games", 0)
    .order("mmr", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Row = {
    user_id: string; mmr: number; games: number; wins: number; losses: number; peak_mmr: number;
    users: { username: string | null; display_name: string | null; avatar_url: string | null; faction: string | null; team_color: string | null; supporter_tier: string | null } | Array<{ username: string | null; display_name: string | null; avatar_url: string | null; faction: string | null; team_color: string | null; supporter_tier: string | null }> | null;
  };

  const entries = (data as Row[] | null ?? []).map((r, i) => {
    const u = Array.isArray(r.users) ? r.users[0] : r.users;
    const totalGames = r.wins + r.losses;
    const winRate = totalGames > 0 ? Math.round((r.wins / totalGames) * 100) : 0;
    return {
      rank: i + 1,
      user_id: r.user_id,
      username: u?.username ?? null,
      display_name: u?.display_name ?? null,
      avatar_url: u?.avatar_url ?? null,
      faction: u?.faction ?? null,
      team_color: u?.team_color ?? null,
      supporter_tier: u?.supporter_tier ?? null,
      mmr: r.mmr,
      games: r.games,
      wins: r.wins,
      losses: r.losses,
      win_rate: winRate,
      peak_mmr: r.peak_mmr,
      tier: tierForMmr(r.mmr),
    };
  });

  return NextResponse.json({ entries, count: entries.length });
}
