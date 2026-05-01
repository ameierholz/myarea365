/**
 * Server-side Helper: Mapbox Walking Directions zwischen zwei Koordinaten,
 * mit Postgres-Cache (~11m Grid-Auflösung). Bei Cache-Hit: kein Mapbox-Call.
 *
 * Liefert null bei Fehler — Caller fällt dann auf Luftlinie zurück.
 */
import { createClient as createServiceClient } from "@supabase/supabase-js";

type RouteResult = { geometry: { type: "LineString"; coordinates: [number, number][] }; distance_m: number };

function getServiceClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !srk) return null;
  return createServiceClient(url, srk, { auth: { persistSession: false } });
}

const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

export async function fetchWalkingRoute(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number,
): Promise<RouteResult | null> {
  const fLat = round4(fromLat), fLng = round4(fromLng);
  const tLat = round4(toLat),   tLng = round4(toLng);

  // 1. Cache-Lookup
  const sb = getServiceClient();
  if (sb) {
    try {
      const { data: cached } = await sb
        .from("mapbox_route_cache")
        .select("distance_m, geom_geojson")
        .eq("from_lat", fLat).eq("from_lng", fLng)
        .eq("to_lat", tLat).eq("to_lng", tLng)
        .maybeSingle<{ distance_m: number; geom_geojson: RouteResult["geometry"] }>();
      if (cached) return { distance_m: cached.distance_m, geometry: cached.geom_geojson };
    } catch { /* Cache-Lookup darf nicht blockieren */ }
  }

  // 2. Mapbox API
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) return null;
  let result: RouteResult | null = null;
  try {
    const coords = `${fromLng},${fromLat};${toLng},${toLat}`;
    const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${coords}?access_token=${token}&geometries=geojson&overview=full`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!r.ok) return null;
    const j = (await r.json()) as { routes?: Array<{ geometry: RouteResult["geometry"]; distance: number }> };
    const rt = j.routes?.[0];
    if (rt) result = { geometry: rt.geometry, distance_m: Math.round(rt.distance) };
  } catch {
    return null;
  }

  // 3. Cache-Write (best-effort, blockiert nicht)
  if (sb && result) {
    sb.from("mapbox_route_cache")
      .upsert({
        from_lat: fLat, from_lng: fLng, to_lat: tLat, to_lng: tLng,
        distance_m: result.distance_m, geom_geojson: result.geometry,
      }, { onConflict: "from_lat,from_lng,to_lat,to_lng" })
      .then(() => { /* ok */ }, () => { /* ignore */ });
  }
  return result;
}
