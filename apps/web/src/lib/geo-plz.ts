/**
 * Reverse-Geocoding Koordinaten → deutsche 5-stellige PLZ via Nominatim.
 *
 * Wird asynchron vom /api/cron/resolve-plz-Job aufgerufen, nicht im
 * Hot-Path von /api/walk/segments — damit GPS-Tracks ohne Latenz-Penalty
 * gespeichert werden. PLZ füllt sich innerhalb weniger Minuten nach.
 *
 * Nominatim-Regeln (https://operations.osmfoundation.org/policies/nominatim/):
 *  - 1 Request/Sekunde max (der Caller muss Delays einhalten)
 *  - Eindeutiger User-Agent mit Kontakt
 *  - Keine Parallel-Requests
 */

export const NOMINATIM_USER_AGENT = "MyArea365/1.0 (support@myarea365.de)";

export async function resolvePlzFromCoords(
  lat: number,
  lng: number,
): Promise<string | null> {
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
      // Nominatim kann mal 10 s brauchen
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    return null;
  }

  if (!res.ok) return null;

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return null;
  }

  const addr = (data as { address?: { postcode?: unknown; country_code?: unknown } }).address;
  if (!addr) return null;

  // Nur deutsche PLZ — Nominatim liefert auch AT/CH an Grenzen
  if (typeof addr.country_code === "string" && addr.country_code !== "de") return null;

  const raw = addr.postcode;
  if (typeof raw !== "string") return null;
  // Nominatim liefert manchmal "10827" oder "10827-10829" oder "1082" (führende Null fehlt)
  const clean = raw.replace(/[^0-9]/g, "").slice(0, 5).padStart(5, "0");
  if (!/^[0-9]{5}$/.test(clean)) return null;
  return clean;
}

export function normalizeStreetName(name: string | null | undefined): string | null {
  if (!name) return null;
  const trimmed = name.trim().toLowerCase();
  if (trimmed.length === 0) return null;
  return trimmed;
}
