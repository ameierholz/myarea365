/**
 * Walk-Resource-Klassifizierer.
 *
 * Wird CLIENTSEITIG vor dem Speichern eines Walks aufgerufen, um die Polyline
 * in OSM-Tag-Buckets zu zerlegen:
 *   - km_in_park        → Holz-Drop
 *   - km_in_residential → Stein-Drop
 *   - km_in_commercial  → Gold-Drop
 *   - km_near_water     → Mana-Drop
 *
 * Strategie: Für jedes Polyline-Segment den dominanten OSM-Land-Use-Tag via Overpass-API
 * abfragen (oder vorgehaltene Vector-Tiles, sobald wir welche haben). Hier ist erstmal
 * eine Stub-Implementierung mit einer einfachen "alles ist Wohngebiet"-Heuristik —
 * echte OSM-Klassifizierung kommt in einem Folge-Patch (braucht Caching, sonst zu viele
 * Overpass-Queries).
 */

export type ResourceSegments = {
  km_in_park: number;
  km_in_residential: number;
  km_in_commercial: number;
  km_near_water: number;
};

export type LatLng = { lat: number; lng: number };

/** Haversine-Distanz in km. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Polyline-Gesamtlänge in km. */
export function polylineLengthKm(points: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distanceKm(points[i - 1], points[i]);
  return total;
}

/**
 * STUB: ohne OSM-Lookup verteilen wir alles auf "residential" als Default.
 * Sobald Overpass-/Tile-Lookup verfügbar ist, wird das pro Segment getagged.
 */
export function classifyPolylineStub(points: LatLng[]): ResourceSegments {
  const km = polylineLengthKm(points);
  return {
    km_in_park: 0,
    km_in_residential: km,
    km_in_commercial: 0,
    km_near_water: 0,
  };
}

/**
 * Echte Klassifizierung: lädt für die Bounding-Box der Polyline alle OSM-Polygone
 * mit landuse / leisure / natural-Tags und prüft pro Segment in welchem Polygon es liegt.
 *
 * Implementierung kommt in einem Folge-Patch — braucht:
 *  1. Overpass-API-Client (oder eigener PostGIS-Cache)
 *  2. Polygon-In-Polygon Geometrie-Lib (z.B. @turf/boolean-point-in-polygon)
 *  3. Throttling/Caching damit wir Overpass nicht hammern
 */
export async function classifyPolyline(points: LatLng[]): Promise<ResourceSegments> {
  // TODO: echte OSM-Klassifizierung. Bis dahin Stub.
  return classifyPolylineStub(points);
}
