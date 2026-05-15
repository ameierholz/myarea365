import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchWalkingRoute } from "@/lib/mapbox-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteGeom = { type: "LineString"; coordinates: [number, number][] };

/**
 * POST /api/gather/start
 * Body: { node_id, guardian_id, troop_count, user_lat, user_lng,
 *         route_distance_m?, route_geom? }
 *
 * Kernregel (Konzept): Märsche dürfen NUR Straßen/Wege benutzen — niemals
 * Luftlinie. Wenn Client keine Route mitliefert, holt der Server selbst über
 * Mapbox Walking-Directions (mit Postgres-Cache). Schlägt das fehl, wird der
 * Marsch verweigert statt mit Luftlinie zu starten.
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth_required" }, { status: 401 });

  let body: {
    node_id?: number; guardian_id?: string; troop_count?: number;
    user_lat?: number; user_lng?: number;
    route_distance_m?: number; route_geom?: RouteGeom;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const { node_id, guardian_id, troop_count, user_lat, user_lng } = body;
  let { route_distance_m, route_geom } = body;
  if (typeof node_id !== "number" || typeof guardian_id !== "string" || typeof troop_count !== "number" || typeof user_lat !== "number" || typeof user_lng !== "number") {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }
  if (troop_count < 1) return NextResponse.json({ error: "troop_count_min_1" }, { status: 400 });

  // Ziel-Koordinaten aus DB holen (Client-Werte sind nicht trustworthy für Routing)
  const { data: nodeRow } = await sb
    .from("resource_nodes")
    .select("lat, lng")
    .eq("id", node_id)
    .maybeSingle<{ lat: number; lng: number }>();
  if (!nodeRow) return NextResponse.json({ error: "node_not_found" }, { status: 404 });

  // Validate client-provided route (must be a real LineString with >=2 points)
  const clientRouteValid =
    route_geom?.type === "LineString" &&
    Array.isArray(route_geom.coordinates) &&
    route_geom.coordinates.length >= 2 &&
    typeof route_distance_m === "number" &&
    route_distance_m > 0;

  if (!clientRouteValid) {
    // Server-Side-Fallback: selbst über Mapbox routen
    const sr = await fetchWalkingRoute(user_lat, user_lng, nodeRow.lat, nodeRow.lng);
    if (sr) {
      route_geom = sr.geometry;
      route_distance_m = sr.distance_m;
    } else {
      console.error("[gather/start] routing_unavailable", {
        user_id: user.id, node_id, from: [user_lat, user_lng], to: [nodeRow.lat, nodeRow.lng],
        has_token: !!process.env.MAPBOX_ACCESS_TOKEN,
      });
      return NextResponse.json({
        error: "routing_unavailable",
        message: "Keine Lauf-Route gefunden — Mapbox antwortet nicht. Versuche es in einem Moment erneut.",
      }, { status: 503 });
    }
  }

  const { data, error } = await sb.rpc("start_gather_march", {
    p_node_id: node_id,
    p_guardian_id: guardian_id,
    p_troop_count: troop_count,
    p_user_lat: user_lat,
    p_user_lng: user_lng,
    p_route_distance_m: route_distance_m ?? null,
    p_route_geom_geojson: route_geom && route_geom.type === "LineString"
      ? JSON.stringify(route_geom)
      : null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Quest-Progress: Marsch zur Resource-Node gestartet — inkl. Wetter-bewusste
  // Variante (marches_in_<condition>) für Daily-Wetter-Quests.
  void sb.rpc("bump_quest_with_weather", {
    p_user_id: user.id,
    p_base_metric: "marches_started",
    p_weather_prefix: "marches_in",
    p_amount: 1,
  });

  return NextResponse.json(data ?? { ok: true });
}
