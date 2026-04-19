import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/leaderboard/guardians
 * Drei Ranglisten in einem Call:
 * - top_level: Wächter mit höchstem Level (inkl. Runner-Info)
 * - most_played: Wächter mit meisten Arena-Kämpfen (wins+losses)
 * - top_win_rate: Wächter mit bester Win-Rate (min 5 Kämpfe)
 */
export async function GET() {
  const sb = await createClient();

  const [topLevel, mostPlayed, winRate] = await Promise.all([
    sb.from("user_guardians")
      .select("id, user_id, archetype_id, level, xp, wins, losses, guardian_archetypes(name, emoji, rarity), users:user_id(username, display_name, team_color)")
      .eq("is_active", true)
      .order("level", { ascending: false })
      .order("xp", { ascending: false })
      .limit(20),
    sb.from("user_guardians")
      .select("id, user_id, archetype_id, level, wins, losses, guardian_archetypes(name, emoji, rarity), users:user_id(username, display_name, team_color)")
      .eq("is_active", true)
      .order("wins", { ascending: false })
      .limit(20),
    sb.rpc("guardian_win_rate_leaderboard"),
  ]);

  return NextResponse.json({
    top_level: topLevel.data ?? [],
    most_played: mostPlayed.data ?? [],
    top_win_rate: winRate.data ?? [],
  });
}
