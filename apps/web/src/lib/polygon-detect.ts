/**
 * Polygon/Ring-Detection fuer Territorien.
 *
 * V1 (simpel): Wenn der aktuelle Walk-Trace Start und Ende nah beieinander hat
 * (Luftlinie < 80m) und mindestens 3 unterschiedliche Strassen beruehrt hat,
 * zaehlt der Trace selbst als geschlossenes Polygon → 1 Territorium.
 *
 * V2 (spaeter): Graph-Cycle-Detection ueber ALLE beanspruchten Segmente eines
 * Users — so schliessen sich Ringe auch wenn sie aus mehreren getrennten Walks bestehen.
 */

import { haversineM, polylineLengthM, type LngLat } from "@/lib/geo-matching";

export function centroidOf(poly: LngLat[]): LngLat {
  let lat = 0, lng = 0, n = 0;
  for (const p of poly) { lat += p.lat; lng += p.lng; n++; }
  return { lat: lat / n, lng: lng / n };
}

// Ray-casting point-in-polygon
export function pointInPolygon(pt: LngLat, poly: LngLat[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].lng, yi = poly[i].lat;
    const xj = poly[j].lng, yj = poly[j].lat;
    const intersect = (yi > pt.lat) !== (yj > pt.lat)
      && pt.lng < ((xj - xi) * (pt.lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export type DetectedPolygon = {
  polygon: LngLat[];   // geschlossener Ring (erster und letzter Punkt identisch)
  area_m2: number;
};

const CLOSE_LOOP_MAX_M = 80;
const MIN_STREETS_FOR_TERRITORY = 3;

/**
 * Shoelace-Formel fuer Flaeche eines Polygons auf der Erde (aequirektangulare Naeherung).
 */
export function polygonAreaM2(poly: LngLat[]): number {
  if (poly.length < 3) return 0;
  const lat0 = (poly.reduce((s, p) => s + p.lat, 0) / poly.length) * Math.PI / 180;
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos(lat0);
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const ax = a.lng * mPerDegLng, ay = a.lat * mPerDegLat;
    const bx = b.lng * mPerDegLng, by = b.lat * mPerDegLat;
    s += ax * by - bx * ay;
  }
  return Math.abs(s) / 2;
}

export function detectPolygonFromWalk(
  trace: LngLat[],
  matchedStreetNames: string[],
): DetectedPolygon | null {
  if (trace.length < 10) return null;
  const start = trace[0];
  const end = trace[trace.length - 1];
  if (haversineM(start, end) > CLOSE_LOOP_MAX_M) return null;

  const distinctStreets = new Set(matchedStreetNames.filter(Boolean));
  if (distinctStreets.size < MIN_STREETS_FOR_TERRITORY) return null;

  const totalLen = polylineLengthM(trace);
  if (totalLen < 300) return null; // winzige Loops ignorieren

  const closed = [...trace, trace[0]];
  const area = polygonAreaM2(closed);
  if (area < 500) return null; // <500 m² nicht als Territorium zaehlen

  return { polygon: closed, area_m2: Math.round(area) };
}
