/**
 * Overpass-API-Wrapper — holt OSM-Highway-Ways in einem Bounding-Box.
 * Wird fürs Segment-Matching nach einem Lauf verwendet.
 */

export type OsmNode = { id: number; lat: number; lng: number };
export type OsmWay = {
  id: number;
  name: string | null;
  highway: string | null;
  nodes: OsmNode[]; // bereits mit Koordinaten aufgelöst
};

type OverpassElement =
  | { type: "node"; id: number; lat: number; lon: number }
  | { type: "way"; id: number; nodes: number[]; tags?: Record<string, string> };

type OverpassResponse = { elements: OverpassElement[] };

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// Padding um die Bounding-Box (Grad), damit Ways am Rand nicht abgeschnitten werden
const BBOX_PAD = 0.0015;

export type BBox = { minLat: number; minLng: number; maxLat: number; maxLng: number };

export function bboxOf(coords: Array<{ lat: number; lng: number }>): BBox {
  let minLat = 90, minLng = 180, maxLat = -90, maxLng = -180;
  for (const c of coords) {
    if (c.lat < minLat) minLat = c.lat;
    if (c.lat > maxLat) maxLat = c.lat;
    if (c.lng < minLng) minLng = c.lng;
    if (c.lng > maxLng) maxLng = c.lng;
  }
  return {
    minLat: minLat - BBOX_PAD,
    minLng: minLng - BBOX_PAD,
    maxLat: maxLat + BBOX_PAD,
    maxLng: maxLng + BBOX_PAD,
  };
}

export async function fetchHighwaysInBBox(bbox: BBox): Promise<OsmWay[]> {
  const q = `
    [out:json][timeout:20];
    (
      way["highway"](${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng});
    );
    out body;
    >;
    out skel qt;
  `;

  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "data=" + encodeURIComponent(q),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  const data = (await res.json()) as OverpassResponse;

  const nodeMap = new Map<number, { lat: number; lng: number }>();
  for (const el of data.elements) {
    if (el.type === "node") nodeMap.set(el.id, { lat: el.lat, lng: el.lon });
  }

  const ways: OsmWay[] = [];
  for (const el of data.elements) {
    if (el.type !== "way") continue;
    const highway = el.tags?.highway ?? null;
    // Nur begehbare Wege/Straßen
    if (!highway || ["motorway", "motorway_link", "trunk", "trunk_link"].includes(highway)) continue;
    const nodes: OsmNode[] = [];
    for (const nid of el.nodes) {
      const n = nodeMap.get(nid);
      if (n) nodes.push({ id: nid, lat: n.lat, lng: n.lng });
    }
    if (nodes.length < 2) continue;
    ways.push({
      id: el.id,
      name: el.tags?.name ?? null,
      highway,
      nodes,
    });
  }
  return ways;
}
