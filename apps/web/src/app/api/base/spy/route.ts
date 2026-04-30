import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/base/spy
 * Body: { defender_user_id: string }
 *
 * Startet einen Späher, der von der eigenen Base auf Straßen zum Verteidiger
 * läuft, dort späht und zurückkehrt. Inbox-Bericht erst bei Rückkehr.
 * Routing wird hier serverseitig via Mapbox Walking Directions geholt.
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = (await req.json()) as { defender_user_id?: string };
  if (!body.defender_user_id) {
    return NextResponse.json({ error: "missing_defender" }, { status: 400 });
  }

  // Eigene + Verteidiger-Base-Koordinaten holen, um Mapbox-Walking-Route zu fetchen.
  const [{ data: myBase }, { data: defBase }] = await Promise.all([
    sb.from("bases").select("lat, lng").eq("owner_user_id", user.id).order("created_at").limit(1).maybeSingle<{ lat: number; lng: number }>(),
    sb.from("bases").select("lat, lng").eq("owner_user_id", body.defender_user_id).order("created_at").limit(1).maybeSingle<{ lat: number; lng: number }>(),
  ]);

  let routeDist: number | null = null;
  let routeGeom: { type: "LineString"; coordinates: [number, number][] } | null = null;

  if (myBase && defBase) {
    const token = process.env.MAPBOX_ACCESS_TOKEN;
    if (token) {
      try {
        const coords = `${myBase.lng},${myBase.lat};${defBase.lng},${defBase.lat}`;
        const mb = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/walking/${coords}?access_token=${token}&geometries=geojson&overview=full`,
          { signal: AbortSignal.timeout(8_000) }
        );
        if (mb.ok) {
          const j = (await mb.json()) as { routes?: Array<{ geometry: typeof routeGeom; distance: number }> };
          const r = j.routes?.[0];
          if (r) {
            routeGeom = r.geometry as typeof routeGeom;
            routeDist = Math.round(r.distance);
          }
        }
      } catch { /* Routing optional → RPC fällt auf Luftlinie zurück */ }
    }
  }

  const { data, error } = await sb.rpc("start_player_base_scout", {
    p_defender_user_id: body.defender_user_id,
    p_route_distance_m: routeDist,
    p_route_geom_geojson: routeGeom,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
