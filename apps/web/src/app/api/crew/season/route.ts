import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/crew/season?crew_id=... → aktuelle Season-Standings + eigenes Ranking */
export async function GET(req: NextRequest) {
  const sb = await createClient();
  const crewId = new URL(req.url).searchParams.get("crew_id");
  if (!crewId) return NextResponse.json({ error: "crew_id required" }, { status: 400 });

  // Aktuelle Season finden / anlegen
  const { data: seasonId } = await sb.rpc("current_crew_season");
  if (!seasonId) return NextResponse.json({ error: "no_season" }, { status: 500 });

  const { data: season } = await sb.from("crew_seasons").select("*").eq("id", seasonId).maybeSingle();
  const { data: standings } = await sb.from("crew_season_standings")
    .select("crew_id, tier, points, duel_wins, war_wins, territories_claimed, crew:crew_id(id, name, color)")
    .eq("season_id", seasonId)
    .order("points", { ascending: false })
    .limit(100);

  const myEntry = (standings ?? []).findIndex((s) => (s as { crew_id: string }).crew_id === crewId);
  const my = myEntry >= 0 ? (standings![myEntry] as unknown as { crew_id: string; tier: string; points: number; duel_wins: number; war_wins: number; territories_claimed: number }) : null;

  return NextResponse.json({
    season,
    standings: standings ?? [],
    my_rank: myEntry >= 0 ? myEntry + 1 : null,
    my_entry: my,
  });
}
