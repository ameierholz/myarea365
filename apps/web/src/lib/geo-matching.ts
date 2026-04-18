/**
 * Geo-Matching: GPS-Trace auf OSM-Ways mappen.
 * Pure Funktionen — keine Side-Effects, keine DB.
 */

import type { OsmWay } from "@/lib/overpass";

export type LngLat = { lat: number; lng: number };

const EARTH_R = 6371000; // m

function toRad(d: number): number { return (d * Math.PI) / 180; }

export function haversineM(a: LngLat, b: LngLat): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const c =
    s1 * s1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2 * s2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(c)));
}

// Punkt-zu-Segment-Distanz in Metern (lokale äquirektanguläre Näherung)
function pointToSegmentM(p: LngLat, a: LngLat, b: LngLat): number {
  const lat0 = toRad((a.lat + b.lat) / 2);
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos(lat0);
  const px = (p.lng - a.lng) * mPerDegLng;
  const py = (p.lat - a.lat) * mPerDegLat;
  const bx = (b.lng - a.lng) * mPerDegLng;
  const by = (b.lat - a.lat) * mPerDegLat;
  const len2 = bx * bx + by * by;
  if (len2 === 0) return Math.hypot(px, py);
  const t = Math.max(0, Math.min(1, (px * bx + py * by) / len2));
  const dx = px - t * bx;
  const dy = py - t * by;
  return Math.hypot(dx, dy);
}

export function minDistancePointToPolyline(p: LngLat, poly: LngLat[]): number {
  let best = Infinity;
  for (let i = 0; i < poly.length - 1; i++) {
    const d = pointToSegmentM(p, poly[i], poly[i + 1]);
    if (d < best) best = d;
  }
  return best;
}

export function polylineLengthM(poly: LngLat[]): number {
  let s = 0;
  for (let i = 0; i < poly.length - 1; i++) s += haversineM(poly[i], poly[i + 1]);
  return s;
}

export type MatchedWay = {
  osm_way_id: number;
  street_name: string | null;
  highway: string;
  nodes: LngLat[];    // Geometrie des Ways
  length_m: number;
  coverage: number;   // 0..1 — Anteil Way-Punkte nah am Trace
};

/**
 * Matcht OSM-Ways gegen einen GPS-Trace.
 * Ein Way gilt als "gelaufen" wenn >= minCoverage seiner Punkte in <= maxDistM Nähe zum Trace sind.
 */
export function matchWaysToTrace(
  ways: OsmWay[],
  trace: LngLat[],
  maxDistM = 25,
  minCoverage = 0.6,
): MatchedWay[] {
  if (trace.length < 2) return [];
  const out: MatchedWay[] = [];
  for (const w of ways) {
    if (w.nodes.length < 2) continue;
    let near = 0;
    for (const n of w.nodes) {
      if (minDistancePointToPolyline(n, trace) <= maxDistM) near++;
    }
    const coverage = near / w.nodes.length;
    if (coverage < minCoverage) continue;
    out.push({
      osm_way_id: w.id,
      street_name: w.name,
      highway: w.highway ?? "unknown",
      nodes: w.nodes.map((n) => ({ lat: n.lat, lng: n.lng })),
      length_m: Math.round(polylineLengthM(w.nodes)),
      coverage,
    });
  }
  return out;
}
