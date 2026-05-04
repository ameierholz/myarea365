import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const revalidate = 60;

/**
 * GET /api/leaderboard/shop-leagues
 *   → Liste aller aktiven Shop-Liga-Saisons mit Top-Crew + Battle-Counter.
 *
 * GET /api/leaderboard/shop-leagues?business_id=…
 *   → Aktuelle Standings (Top-10) der laufenden Woche für einen einzelnen Shop.
 */
export async function GET(req: Request) {
  const sb = await createClient();
  const url = new URL(req.url);
  const businessId = url.searchParams.get("business_id");

  if (businessId) {
    // Single-Shop-View: aktuelle Standings + Shop-Meta
    const [{ data: season }, { data: shop }] = await Promise.all([
      sb.from("shop_league_seasons")
        .select("id, business_id, starts_at, ends_at, total_battles")
        .eq("business_id", businessId)
        .eq("status", "active")
        .maybeSingle<{ id: string; business_id: string; starts_at: string; ends_at: string; total_battles: number }>(),
      sb.from("local_businesses")
        .select("id, name, address, logo_url, lat, lng")
        .eq("id", businessId)
        .maybeSingle<{ id: string; name: string; address: string | null; logo_url: string | null; lat: number; lng: number }>(),
    ]);
    if (!season) return NextResponse.json({ shop, season: null, standings: [] });

    const { data: standings } = await sb.from("shop_league_standings")
      .select(`
        crew_id, wins, losses, score,
        crews:crew_id ( name, color, custom_emblem_url, member_count )
      `)
      .eq("season_id", season.id)
      .order("score", { ascending: false })
      .order("losses", { ascending: true })
      .limit(10);

    return NextResponse.json({ shop, season, standings: standings ?? [] });
  }

  // Übersicht: alle aktiven Shop-Liga-Saisons mit Top-Crew
  const { data: seasons } = await sb.from("shop_league_seasons")
    .select(`
      id, business_id, starts_at, ends_at, total_battles,
      local_businesses:business_id ( name, address, logo_url )
    `)
    .eq("status", "active")
    .order("total_battles", { ascending: false })
    .limit(50);

  if (!seasons || seasons.length === 0) {
    return NextResponse.json({ leagues: [] });
  }

  const seasonIds = seasons.map((s) => (s as { id: string }).id);
  const { data: topRows } = await sb.from("shop_league_standings")
    .select(`
      season_id, crew_id, wins, losses, score,
      crews:crew_id ( name, color, custom_emblem_url )
    `)
    .in("season_id", seasonIds)
    .order("score", { ascending: false });

  const topByseason = new Map<string, unknown>();
  for (const r of topRows ?? []) {
    const sid = (r as { season_id: string }).season_id;
    if (!topByseason.has(sid)) topByseason.set(sid, r);
  }

  const leagues = seasons.map((s) => {
    const sid = (s as { id: string }).id;
    return { ...s, leader: topByseason.get(sid) ?? null };
  });

  return NextResponse.json({ leagues });
}
