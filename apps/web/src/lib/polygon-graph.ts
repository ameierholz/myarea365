/**
 * V2 Polygon-Detection via Graph-Cycle ueber ALLE User-/Crew-Segmente.
 *
 * Approach: Fuer jedes neu beanspruchte Segment die beiden Endpunkte.
 * Wenn im Graph (ohne dieses Segment) bereits ein Pfad zwischen den Endpunkten
 * existiert → neues Segment schliesst einen Zyklus.
 * Shortest-Path via BFS liefert den kuerzesten Ring.
 */

import { haversineM, type LngLat } from "@/lib/geo-matching";

export type GraphSegment = {
  id: string;
  geom: LngLat[];       // Polyline des Segments
};

type NodeKey = string;

// Endpunkte auf ~5m-Raster runden damit GPS-Rauschen egal ist
function nodeKey(p: LngLat): NodeKey {
  // ~5m: Breitengrad 0.00005 ≈ 5.5m
  const lat = Math.round(p.lat * 20000) / 20000;
  const lng = Math.round(p.lng * 20000) / 20000;
  return `${lat},${lng}`;
}

function keyToLngLat(k: NodeKey): LngLat {
  const [la, ln] = k.split(",").map(Number);
  return { lat: la, lng: ln };
}

type Graph = Map<NodeKey, Array<{ to: NodeKey; segId: string; geom: LngLat[] }>>;

function buildGraph(segments: GraphSegment[]): Graph {
  const g: Graph = new Map();
  for (const s of segments) {
    if (s.geom.length < 2) continue;
    const a = nodeKey(s.geom[0]);
    const b = nodeKey(s.geom[s.geom.length - 1]);
    if (a === b) continue;
    if (!g.has(a)) g.set(a, []);
    if (!g.has(b)) g.set(b, []);
    g.get(a)!.push({ to: b, segId: s.id, geom: s.geom });
    g.get(b)!.push({ to: a, segId: s.id, geom: [...s.geom].reverse() });
  }
  return g;
}

/**
 * BFS zwischen a und b, `excludeSegId` ausgeschlossen.
 * Gibt Liste von Segment-IDs (ohne excludeSegId) + zusammengesetzte Polyline zurueck.
 */
function shortestPath(
  g: Graph,
  a: NodeKey,
  b: NodeKey,
  excludeSegId: string,
  maxDepth = 20,
): { segIds: string[]; polyline: LngLat[] } | null {
  if (!g.has(a) || !g.has(b)) return null;
  const prev = new Map<NodeKey, { from: NodeKey; segId: string; geom: LngLat[] }>();
  const visited = new Set<NodeKey>([a]);
  const queue: Array<{ node: NodeKey; depth: number }> = [{ node: a, depth: 0 }];
  while (queue.length) {
    const { node, depth } = queue.shift()!;
    if (node === b) break;
    if (depth >= maxDepth) continue;
    for (const e of g.get(node) ?? []) {
      if (e.segId === excludeSegId) continue;
      if (visited.has(e.to)) continue;
      visited.add(e.to);
      prev.set(e.to, { from: node, segId: e.segId, geom: e.geom });
      queue.push({ node: e.to, depth: depth + 1 });
    }
  }
  if (!prev.has(b)) return null;
  const segIds: string[] = [];
  const reversePolyParts: LngLat[][] = [];
  let cur = b;
  while (cur !== a) {
    const p = prev.get(cur);
    if (!p) return null;
    segIds.unshift(p.segId);
    reversePolyParts.unshift(p.geom);
    cur = p.from;
  }
  // Polyline zusammensetzen
  const polyline: LngLat[] = [];
  for (let i = 0; i < reversePolyParts.length; i++) {
    const part = reversePolyParts[i];
    if (i === 0) polyline.push(...part);
    else polyline.push(...part.slice(1));
  }
  return { segIds, polyline };
}

export type CycleFound = {
  segment_ids: string[];
  polygon: LngLat[]; // geschlossener Ring (erster = letzter Punkt)
};

/**
 * Findet neue Zyklen die durch die neu eingefuegten Segmente geschlossen wurden.
 * Gibt hoechstens EIN Zyklus pro new-segment zurueck (den kuerzesten).
 */
export function findNewCycles(
  allSegments: GraphSegment[],
  newSegmentIds: Set<string>,
  alreadyClaimedSegmentSets: Array<string[]>,
): CycleFound[] {
  if (newSegmentIds.size === 0) return [];
  const graph = buildGraph(allSegments);
  const segById = new Map(allSegments.map((s) => [s.id, s]));
  const alreadyKeys = new Set(alreadyClaimedSegmentSets.map((ids) => [...ids].sort().join("|")));
  const results: CycleFound[] = [];

  for (const newId of newSegmentIds) {
    const seg = segById.get(newId);
    if (!seg || seg.geom.length < 2) continue;
    const a = nodeKey(seg.geom[0]);
    const b = nodeKey(seg.geom[seg.geom.length - 1]);
    const path = shortestPath(graph, a, b, newId);
    if (!path) continue;
    const allIds = [...path.segIds, newId].sort();
    const key = allIds.join("|");
    if (alreadyKeys.has(key)) continue;
    // Polygon = path.polyline + seg.geom reversed (damit geschlossener Ring)
    const polygon: LngLat[] = [
      ...path.polyline,
      ...[...seg.geom].reverse().slice(1),
    ];
    // Explizit schliessen
    if (
      polygon.length > 0 &&
      (polygon[0].lat !== polygon[polygon.length - 1].lat ||
        polygon[0].lng !== polygon[polygon.length - 1].lng)
    ) {
      polygon.push(polygon[0]);
    }
    // Min. Umfang 200m (sonst Mikro-Schleifen)
    let per = 0;
    for (let i = 0; i < polygon.length - 1; i++) per += haversineM(polygon[i], polygon[i + 1]);
    if (per < 200) continue;
    results.push({ segment_ids: allIds, polygon });
    alreadyKeys.add(key); // Duplikate aus mehreren new-segments vermeiden
  }
  return results;
}
