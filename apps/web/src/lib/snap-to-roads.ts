/**
 * Snap-to-Roads Client-Utility.
 * Ruft die Next.js-API-Route an, die Mapbox Map Matching verwendet.
 * Implementation-agnostic: wenn wir später auf OSRM oder anderes umstellen,
 * bleibt dieses Interface gleich — nur die Server-Route ändert sich.
 */

export type Coord = { lat: number; lng: number };

export type SnappedRoute = {
  path: Coord[];           // Gematchte Polyline auf Straßen/Wegen
  distance_m: number;      // Exakte Strecke vom Provider
  duration_s: number;      // Geschätzte Dauer (zu Fuß)
  streets: string[];       // Straßennamen entlang der Route
  confidence: number;      // 0–1, Match-Qualität
};

/**
 * Snappt eine GPS-Trace auf die tatsächlichen Straßen/Gehwege.
 * Gibt null zurück wenn der Service nicht verfügbar oder Route nicht matchbar.
 * Bei null → Fallback auf rohe GPS-Daten.
 */
export async function snapToRoads(coords: Coord[]): Promise<SnappedRoute | null> {
  if (coords.length < 2) return null;

  try {
    const res = await fetch("/api/snap-to-roads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coords }),
    });
    if (!res.ok) {
      console.warn("snap-to-roads failed:", res.status);
      return null;
    }
    return (await res.json()) as SnappedRoute;
  } catch (e) {
    console.warn("snap-to-roads error:", e);
    return null;
  }
}
