import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { NOMINATIM_USER_AGENT } from "@/lib/geo-plz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function reverseGeocodeFull(lat: number, lng: number): Promise<{
  street: string | null; city: string | null; postcode: string | null; suburb: string | null;
} | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "json");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("zoom", "18");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "de");
  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": NOMINATIM_USER_AGENT },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const data = await res.json() as {
      address?: {
        road?: string; house_number?: string; pedestrian?: string; footway?: string;
        city?: string; town?: string; village?: string; municipality?: string;
        postcode?: string; suburb?: string; city_district?: string; neighbourhood?: string;
      };
    };
    const addr = data.address;
    if (!addr) return null;
    const street = addr.road ?? addr.pedestrian ?? addr.footway ?? null;
    const fullStreet = street && addr.house_number ? `${street} ${addr.house_number}` : street;
    const city = addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? null;
    const suburb = addr.suburb ?? addr.city_district ?? addr.neighbourhood ?? null;
    return { street: fullStreet, city, postcode: addr.postcode ?? null, suburb };
  } catch {
    return null;
  }
}

/**
 * GET /api/heimat/poi?lat=&lng=
 *   → POI-Info für Tap-Action-Card:
 *     - reverse-geocoded address (city + street + suburb + postcode)
 *     - crew-owner (Crew-Turf oder territory-claim)
 *     - nearby base (Spieler-Base in 200m Umkreis)
 */
export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const url = new URL(req.url);
  const lat = parseFloat(url.searchParams.get("lat") ?? "");
  const lng = parseFloat(url.searchParams.get("lng") ?? "");
  if (!isFinite(lat) || !isFinite(lng)) {
    return NextResponse.json({ error: "invalid_coords" }, { status: 400 });
  }

  const [poiRes, addr] = await Promise.all([
    sb.rpc("heimat_poi_at", { p_lat: lat, p_lng: lng }),
    reverseGeocodeFull(lat, lng),
  ]);

  return NextResponse.json({
    ok: true,
    poi: poiRes.data ?? null,
    address: addr,
  });
}
