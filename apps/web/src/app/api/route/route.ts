import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/route?from=lat,lng&to=lat,lng
 *
 * Proxy für Mapbox Directions API (walking profile). Hält den
 * MAPBOX_ACCESS_TOKEN serverseitig.
 *
 * Antwort: { ok: true, geometry: GeoJSON LineString, distance_m, duration_s, steps }
 *          { ok: false, error: string }
 */
export async function GET(req: Request) {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) return NextResponse.json({ ok: false, error: "missing_mapbox_token" }, { status: 500 });

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!from || !to) return NextResponse.json({ ok: false, error: "missing_params" }, { status: 400 });

  const parse = (s: string): [number, number] | null => {
    const [latStr, lngStr] = s.split(",");
    const lat = Number(latStr);
    const lng = Number(lngStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return [lat, lng];
  };
  const fromLL = parse(from);
  const toLL = parse(to);
  if (!fromLL || !toLL) return NextResponse.json({ ok: false, error: "bad_coords" }, { status: 400 });

  // Mapbox erwartet lng,lat (nicht lat,lng)
  const coords = `${fromLL[1]},${fromLL[0]};${toLL[1]},${toLL[0]}`;
  const mbUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${coords}?` +
    `access_token=${token}&geometries=geojson&overview=full&steps=true&language=de`;

  let res: Response;
  try {
    res = await fetch(mbUrl, { signal: AbortSignal.timeout(8_000) });
  } catch {
    return NextResponse.json({ ok: false, error: "mapbox_timeout" }, { status: 504 });
  }
  if (!res.ok) {
    let mbBody = "";
    try { mbBody = (await res.text()).slice(0, 200); } catch { /* nichts */ }
    // 403 ist fast immer Token ohne directions-Scope oder URL-Restriction
    const hint = res.status === 403
      ? "Mapbox-Token fehlen die Directions-Rechte oder eine URL-Restriction blockt localhost. In Mapbox-Account → Token-Settings: Scope 'directions:read' aktivieren, URL-Restrictions ggf. um localhost erweitern."
      : undefined;
    return NextResponse.json({
      ok: false,
      error: `mapbox_${res.status}`,
      mapbox_body: mbBody,
      hint,
    }, { status: 502 });
  }

  type MbStep = {
    maneuver?: { instruction?: string };
    distance?: number;
  };
  type MbRoute = {
    geometry: { type: "LineString"; coordinates: [number, number][] };
    distance: number;
    duration: number;
    legs: Array<{ steps?: MbStep[] }>;
  };
  type MbResp = { routes?: MbRoute[]; code?: string };
  const json = (await res.json()) as MbResp;
  const route = json.routes?.[0];
  if (!route) return NextResponse.json({ ok: false, error: json.code ?? "no_route" }, { status: 404 });

  const steps = (route.legs?.[0]?.steps ?? [])
    .map((s) => ({ instruction: s.maneuver?.instruction ?? "", distance_m: Math.round(s.distance ?? 0) }))
    .filter((s) => s.instruction);

  return NextResponse.json({
    ok: true,
    geometry: route.geometry,
    distance_m: Math.round(route.distance),
    duration_s: Math.round(route.duration),
    steps,
  });
}
