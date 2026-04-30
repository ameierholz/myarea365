import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteGeom = { type: "LineString"; coordinates: [number, number][] };

/**
 * POST /api/gather/start
 * Body: { node_id, guardian_id, troop_count, user_lat, user_lng,
 *         route_distance_m?, route_geom? }
 *
 * route_distance_m + route_geom: optional, kommen aus /api/route (Mapbox-Walking-
 * Directions). Wenn übergeben, nutzt RPC echte Straßen-Distanz. Sonst Fallback
 * auf Luftlinie × 1.4 (Detour-Faktor).
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

  const { node_id, guardian_id, troop_count, user_lat, user_lng, route_distance_m, route_geom } = body;
  if (typeof node_id !== "number" || typeof guardian_id !== "string" || typeof troop_count !== "number" || typeof user_lat !== "number" || typeof user_lng !== "number") {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }
  if (troop_count < 1) return NextResponse.json({ error: "troop_count_min_1" }, { status: 400 });

  const { data, error } = await sb.rpc("start_gather_march", {
    p_node_id: node_id,
    p_guardian_id: guardian_id,
    p_troop_count: troop_count,
    p_user_lat: user_lat,
    p_user_lng: user_lng,
    p_route_distance_m: typeof route_distance_m === "number" ? route_distance_m : null,
    p_route_geom_geojson: route_geom && route_geom.type === "LineString"
      ? JSON.stringify(route_geom)
      : null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? { ok: true });
}
