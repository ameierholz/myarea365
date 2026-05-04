import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const revalidate = 60;

/**
 * GET /api/leaderboard/turf-war
 * Liefert die laufende Crew-Saison + Top-50 Standings.
 * Gefüttert aus crew_seasons + crew_season_standings (00044 + 00248).
 */
export async function GET() {
  const sb = await createClient();

  // Aktive Saison (es läuft immer genau eine pro Monat — current_crew_season() auto-creates)
  const { data: active } = await sb.from("crew_seasons")
    .select("id, year, month, starts_at, ends_at")
    .eq("status", "active")
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; year: number; month: number; starts_at: string; ends_at: string }>();

  if (!active) {
    return NextResponse.json({ season: null, standings: [] });
  }

  // Standings + Crew-Meta in einem Roundtrip
  const { data: rows } = await sb.from("crew_season_standings")
    .select(`
      crew_id, points, war_wins, duel_wins, territories_claimed, tier, final_rank,
      crews:crew_id ( name, color, custom_emblem_url, member_count )
    `)
    .eq("season_id", active.id)
    .order("points", { ascending: false, nullsFirst: false })
    .limit(50);

  return NextResponse.json({ season: active, standings: rows ?? [] });
}
