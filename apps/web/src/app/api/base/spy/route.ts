import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchWalkingRoute } from "@/lib/mapbox-route";
import { rateLimitSmart, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/base/spy
 * Body: { defender_user_id: string }
 * Startet einen Späher (siehe start_player_base_scout). Mapbox-Walking-Route
 * läuft via cached Helper (~11m Grid in mapbox_route_cache).
 * Rate-Limit: 6 Späher pro Minute pro User.
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const rl = await rateLimitSmart(`spy:${user.id}`, 6, 60_000);
  const blocked = rateLimitResponse(rl);
  if (blocked) return blocked;

  const body = (await req.json()) as { defender_user_id?: string };
  if (!body.defender_user_id) {
    return NextResponse.json({ error: "missing_defender" }, { status: 400 });
  }

  const [{ data: myBase }, { data: defBase }] = await Promise.all([
    sb.from("bases").select("lat, lng").eq("owner_user_id", user.id).order("created_at").limit(1).maybeSingle<{ lat: number; lng: number }>(),
    sb.from("bases").select("lat, lng").eq("owner_user_id", body.defender_user_id).order("created_at").limit(1).maybeSingle<{ lat: number; lng: number }>(),
  ]);
  if (!myBase) return NextResponse.json({ error: "no_own_base" }, { status: 400 });
  if (!defBase) return NextResponse.json({ error: "no_target_base" }, { status: 404 });

  // Kern-Konzept: Späher muss Straßen nutzen. Kein Luftlinie-Fallback.
  const route = await fetchWalkingRoute(myBase.lat, myBase.lng, defBase.lat, defBase.lng);
  if (!route) {
    console.error("[base/spy] routing_unavailable", {
      user_id: user.id, from: [myBase.lat, myBase.lng], to: [defBase.lat, defBase.lng],
      has_token: !!process.env.MAPBOX_ACCESS_TOKEN,
    });
    return NextResponse.json({
      error: "routing_unavailable",
      message: "Keine Lauf-Route gefunden — Mapbox antwortet nicht. Versuche es in einem Moment erneut.",
    }, { status: 503 });
  }

  const { data, error } = await sb.rpc("start_player_base_scout", {
    p_defender_user_id: body.defender_user_id,
    p_route_distance_m: route.distance_m,
    p_route_geom_geojson: route.geometry,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
