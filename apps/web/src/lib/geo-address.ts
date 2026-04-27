/**
 * Reverse-Geocoding lat/lng → kurze deutsche Straßen-Adresse via Nominatim.
 * Beispielausgabe: "Senftenberger Ring 50" oder "Senftenberger Ring".
 *
 * Nominatim-Regeln einhalten: 1 Req/s, eindeutiger User-Agent.
 */

import { NOMINATIM_USER_AGENT } from "./geo-plz";

export async function resolveAddressFromCoords(lat: number, lng: number): Promise<string | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "json");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("zoom", "18");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "de");

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: { "User-Agent": NOMINATIM_USER_AGENT },
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  let data: unknown;
  try { data = await res.json(); } catch { return null; }

  const addr = (data as { address?: { road?: string; house_number?: string; pedestrian?: string; footway?: string } }).address;
  if (!addr) return null;
  const street = addr.road ?? addr.pedestrian ?? addr.footway;
  if (!street) return null;
  return addr.house_number ? `${street} ${addr.house_number}` : street;
}
