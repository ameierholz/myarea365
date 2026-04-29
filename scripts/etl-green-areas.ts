/**
 * ETL: Grünflächen aus OSM/Overpass → Supabase green_areas
 *
 * Wegelager spawnen NUR auf solchen Flächen (Parks, Wälder, Wiesen, Spielplätze).
 *
 * Usage:
 *   pnpm tsx scripts/etl-green-areas.ts <city> <minLat> <minLng> <maxLat> <maxLng>
 *
 * Beispiel — Berlin komplett (~5-10 min):
 *   pnpm tsx scripts/etl-green-areas.ts berlin 52.34 13.09 52.68 13.76
 *
 * ENV:
 *   SUPABASE_URL              = https://dqxfbsgusydmaaxdrgxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY = <service_role_key>
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("ENV fehlen: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length !== 5) {
  console.error("Usage: pnpm tsx scripts/etl-green-areas.ts <city> <minLat> <minLng> <maxLat> <maxLng>");
  process.exit(1);
}
const [city, minLatS, minLngS, maxLatS, maxLngS] = args;
const minLat = Number(minLatS), minLng = Number(minLngS);
const maxLat = Number(maxLatS), maxLng = Number(maxLngS);
if ([minLat, minLng, maxLat, maxLng].some((n) => Number.isNaN(n))) {
  console.error("BBox muss aus Zahlen bestehen");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false } });

// Tag-Filter für Grünflächen: Parks, Wälder, Wiesen, Erholungsflächen, Friedhöfe, Spielplätze
const overpassQuery = `
[out:json][timeout:180];
(
  way["leisure"~"^(park|garden|playground|nature_reserve|recreation_ground)$"](${minLat},${minLng},${maxLat},${maxLng});
  way["landuse"~"^(forest|grass|meadow|recreation_ground|cemetery|allotments|village_green)$"](${minLat},${minLng},${maxLat},${maxLng});
  way["natural"~"^(wood|grassland|scrub|heath)$"](${minLat},${minLng},${maxLat},${maxLng});
  rel ["leisure"~"^(park|garden|playground|nature_reserve|recreation_ground)$"](${minLat},${minLng},${maxLat},${maxLng});
  rel ["landuse"~"^(forest|grass|meadow|recreation_ground|cemetery|allotments|village_green)$"](${minLat},${minLng},${maxLat},${maxLng});
  rel ["natural"~"^(wood|grassland|scrub|heath)$"](${minLat},${minLng},${maxLat},${maxLng});
);
out geom;
`.trim();

type OverpassMember = { type: string; ref: number; role: string; geometry?: Array<{ lat: number; lon: number }> };
type OverpassElement = {
  type: "way" | "relation";
  id: number;
  geometry?: Array<{ lat: number; lon: number }>;
  members?: OverpassMember[];
  tags?: Record<string, string>;
};

function classifyKind(tags: Record<string, string> = {}): string {
  if (tags.leisure === "park" || tags.leisure === "garden") return "park";
  if (tags.leisure === "playground") return "playground";
  if (tags.leisure === "recreation_ground" || tags.landuse === "recreation_ground") return "recreation";
  if (tags.leisure === "nature_reserve") return "nature_reserve";
  if (tags.landuse === "forest" || tags.natural === "wood") return "forest";
  if (tags.landuse === "grass" || tags.landuse === "meadow" || tags.natural === "grassland" || tags.landuse === "village_green") return "meadow";
  if (tags.natural === "scrub" || tags.natural === "heath") return "scrub";
  if (tags.landuse === "cemetery") return "cemetery";
  if (tags.landuse === "allotments") return "allotments";
  return "park";
}

function ringToWkt(ring: Array<{ lat: number; lon: number }>): string | null {
  if (!ring || ring.length < 4) return null;
  const closed = ring[0].lat === ring[ring.length - 1].lat && ring[0].lon === ring[ring.length - 1].lon
    ? ring : [...ring, ring[0]];
  const coords = closed.map((p) => `${p.lon} ${p.lat}`).join(", ");
  return `POLYGON((${coords}))`;
}

function elementToWkt(el: OverpassElement): string | null {
  if (el.type === "way") {
    return ringToWkt(el.geometry ?? []);
  }
  // relation: erste outer-Ring nehmen (multipolygon support nur rudimentär)
  if (el.type === "relation" && el.members) {
    const outer = el.members.find((m) => m.role === "outer" && m.geometry && m.geometry.length >= 4);
    if (outer?.geometry) return ringToWkt(outer.geometry);
  }
  return null;
}

async function fetchOverpass(): Promise<OverpassElement[]> {
  console.log(`[ETL] Overpass-Query Grünflächen: bbox ${minLat},${minLng},${maxLat},${maxLng}`);
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
      "User-Agent": "MyArea365-ETL/1.0 (+https://myarea365.de)",
    },
    body: "data=" + encodeURIComponent(overpassQuery),
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}: ${await res.text().catch(() => "?")}`);
  const j = (await res.json()) as { elements?: OverpassElement[] };
  const els = (j.elements ?? []).filter((e) => (e.type === "way" || e.type === "relation"));
  console.log(`[ETL] Overpass lieferte ${els.length} Elemente`);
  return els;
}

async function main() {
  const elements = await fetchOverpass();
  if (elements.length === 0) { console.warn("[ETL] Keine Grünflächen gefunden — fertig"); return; }

  // Bestehende Grünflächen für diese Stadt entsorgen (ETL ist idempotent)
  const { error: delErr } = await sb.from("green_areas").delete().eq("city", city);
  if (delErr) console.warn(`[ETL] Delete-Warnung: ${delErr.message}`);

  const rows: Array<{ osm_id: number; name: string | null; kind: string; city: string; geom: string }> = [];
  for (const el of elements) {
    const wkt = elementToWkt(el);
    if (!wkt) continue;
    rows.push({
      osm_id: el.id,
      name: el.tags?.name ?? null,
      kind: classifyKind(el.tags ?? {}),
      city,
      geom: `SRID=4326;${wkt}`,
    });
  }
  console.log(`[ETL] ${rows.length} valide Grünflächen-Polygone, schreibe in DB...`);

  const CHUNK = 250;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await sb.from("green_areas").insert(chunk);
    if (error) { console.error(`[ETL] Insert-Fehler chunk ${i / CHUNK}: ${error.message}`); throw error; }
    console.log(`[ETL] Inserted ${Math.min(i + CHUNK, rows.length)}/${rows.length}`);
  }
  console.log(`[ETL] ✅ Fertig — ${rows.length} Grünflächen für "${city}" importiert`);
}

main().catch((err) => { console.error("[ETL] ❌ Fehler:", err); process.exit(1); });
