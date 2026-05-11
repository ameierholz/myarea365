/**
 * ETL: OSM-Terrain-Polygone → Supabase city_terrain_polygons
 *
 * Imports reale Topografie (Industrie, Park, Wasser, Universitäten, Krankenhäuser,
 * Regierungsgebäude, Tourismus, Warenhäuser, Wohngebiete, Wälder) als Polygone.
 * `get_terrain_at(city, lat, lng)` macht dann ST_Contains-Lookup mit Priority.
 *
 * Usage (alle aktiven Städte aus DB):
 *   pnpm tsx scripts/etl-terrain-polygons.ts
 *
 * Usage (eine Stadt):
 *   pnpm tsx scripts/etl-terrain-polygons.ts berlin
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

const sb = createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false } });

const OVERPASS = "https://overpass-api.de/api/interpreter";

// Tag-Queries: nur Polygone (way + relation), keine LineStrings (highway/railway separat, später).
const TAG_QUERIES: Record<string, string> = {
  water:       `way["natural"="water"]; rel["natural"="water"];`,
  hospital:    `way["amenity"="hospital"]; rel["amenity"="hospital"];`,
  government:  `way["amenity"~"^(townhall|courthouse)$"]; rel["amenity"~"^(townhall|courthouse)$"]; way["building"="government"];`,
  university:  `way["amenity"~"^(university|college)$"]; rel["amenity"~"^(university|college)$"];`,
  park:        `way["leisure"="park"]; rel["leisure"="park"];`,
  forest:      `way["landuse"="forest"]; way["natural"="wood"]; rel["landuse"="forest"]; rel["natural"="wood"];`,
  tourism:     `way["tourism"~"^(museum|attraction|gallery)$"]; rel["tourism"~"^(museum|attraction|gallery)$"];`,
  warehouse:   `way["building"="warehouse"];`,
  industrial:  `way["landuse"="industrial"]; rel["landuse"="industrial"];`,
  commercial:  `way["landuse"~"^(commercial|retail)$"]; rel["landuse"~"^(commercial|retail)$"];`,
  residential: `way["landuse"="residential"]; rel["landuse"="residential"];`,
};

type OverpassNode = { lat: number; lon: number };
type OverpassEl = {
  type: "node" | "way" | "relation";
  id: number;
  geometry?: OverpassNode[];
  members?: Array<{ type: string; ref: number; role: string; geometry?: OverpassNode[] }>;
  tags?: Record<string, string>;
};

function bboxQuery(tagBlock: string, bbox: string): string {
  // Ersetze Selektor-Sätze um bbox: way["X"="Y"]; → way["X"="Y"](bbox);
  const expanded = tagBlock.replace(/(way|rel|relation)(\[[^\]]+\](?:\[[^\]]+\])*);/g,
    (_m, kind, sel) => `${kind}${sel}(${bbox});`);
  return `[out:json][timeout:180];(${expanded});out geom;`;
}

function toPolygon(el: OverpassEl): GeoJSON.Polygon | GeoJSON.MultiPolygon | null {
  if (el.type === "way" && el.geometry) {
    const ring = el.geometry.map((p) => [p.lon, p.lat]);
    if (ring.length < 4) return null;
    const first = ring[0], last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
    if (ring.length < 4) return null;
    return { type: "Polygon", coordinates: [ring] } as GeoJSON.Polygon;
  }
  if (el.type === "relation" && el.members) {
    // Relation mit outer-Rings — vereinfacht: jedes outer-Way als eigener Ring
    const outerRings: number[][][] = [];
    for (const m of el.members) {
      if (m.role !== "outer" || !m.geometry) continue;
      const ring = m.geometry.map((p) => [p.lon, p.lat]);
      if (ring.length < 4) continue;
      const f = ring[0], l = ring[ring.length - 1];
      if (f[0] !== l[0] || f[1] !== l[1]) ring.push(f);
      if (ring.length < 4) continue;
      outerRings.push(ring);
    }
    if (outerRings.length === 0) return null;
    if (outerRings.length === 1) {
      return { type: "Polygon", coordinates: [outerRings[0]] } as GeoJSON.Polygon;
    }
    return { type: "MultiPolygon", coordinates: outerRings.map((r) => [r]) } as GeoJSON.MultiPolygon;
  }
  return null;
}

async function callOverpass(query: string): Promise<Response> {
  return fetch(OVERPASS, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
      "User-Agent": "MyArea365-ETL/1.0 (+https://myarea365.de)",
    },
    body: "data=" + encodeURIComponent(query),
  });
}

async function fetchWithRetry(query: string, attempts = 3): Promise<Response | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await callOverpass(query);
      if (res.ok) return res;
      // 504 (timeout) → try way-only; 429 (rate limit) → wait + retry
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 30_000));
        continue;
      }
      if (res.status === 504 && i === 0) {
        // try way-only (strip rel[...]) on first 504
        const wayOnly = query.replace(/(rel|relation)\[[^\]]+\](?:\[[^\]]+\])*\([^)]*\);\s*/g, "");
        if (wayOnly !== query) {
          await new Promise((r) => setTimeout(r, 2000));
          const res2 = await callOverpass(wayOnly);
          if (res2.ok) return res2;
        }
      }
      // Other errors → final attempt with simpler query
      if (i === attempts - 1) return res;
      await new Promise((r) => setTimeout(r, 5000 * (i + 1)));
    } catch {
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  return null;
}

async function fetchTag(citySlug: string, tag: string, bbox: string): Promise<number> {
  const query = bboxQuery(TAG_QUERIES[tag], bbox);
  const start = Date.now();
  const res = await fetchWithRetry(query);
  if (!res || !res.ok) {
    const status = res?.status ?? "no-response";
    console.log(`    ERROR: ${status} after retries`);
    return 0;
  }
  const data = await res.json() as { elements: OverpassEl[] };

  type FeaturePayload = {
    primary_tag: string;
    osm_id: number;
    osm_type: string;
    name: string | null;
    geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  };
  const features: FeaturePayload[] = [];
  for (const el of data.elements ?? []) {
    const geom = toPolygon(el);
    if (!geom) continue;
    features.push({
      primary_tag: tag,
      osm_id: el.id,
      osm_type: el.type === "relation" ? "relation" : "way",
      name: el.tags?.name ?? null,
      geometry: geom,
    });
  }
  const fetchTime = Math.round((Date.now() - start) / 1000);
  if (features.length === 0) {
    console.log(`    0 polygons (${fetchTime}s fetch, no features)`);
    return 0;
  }

  // Batched upsert
  let total = 0;
  for (let i = 0; i < features.length; i += 150) {
    const chunk = features.slice(i, i + 150);
    const { data: count, error } = await sb.rpc("upsert_terrain_polygons", {
      p_city_slug: citySlug,
      p_features: chunk,
    });
    if (error) {
      console.log(`    upsert error chunk ${i}: ${error.message}`);
      continue;
    }
    total += (count as number) ?? 0;
  }
  const totalTime = Math.round((Date.now() - start) / 1000);
  console.log(`    ${total}/${features.length} polygons (${fetchTime}s fetch, ${totalTime}s total)`);
  return total;
}

async function importCity(slug: string, tagFilter: string[] | null) {
  const { data: city, error } = await sb.from("cities")
    .select("slug,name,bounds_sw_lat,bounds_sw_lng,bounds_ne_lat,bounds_ne_lng")
    .eq("slug", slug).single();
  if (error || !city) {
    console.error(`City ${slug} not found: ${error?.message}`);
    return;
  }
  const bbox = `${city.bounds_sw_lat},${city.bounds_sw_lng},${city.bounds_ne_lat},${city.bounds_ne_lng}`;
  console.log(`\n=== ${city.name} (${city.slug}) === bbox=${bbox}`);
  let total = 0;
  const tags = tagFilter ?? Object.keys(TAG_QUERIES);
  for (const tag of tags) {
    if (!TAG_QUERIES[tag]) { console.log(`  ${tag}... UNKNOWN TAG`); continue; }
    process.stdout.write(`  ${tag}...\n`);
    const n = await fetchTag(city.slug, tag, bbox);
    total += n;
    await new Promise((r) => setTimeout(r, 3000));
  }
  console.log(`=== ${city.name}: ${total} total polygons imported ===\n`);
}

async function main() {
  // Usage: tsx etl-terrain-polygons.ts [city] [tag1 tag2 ...]
  const target = process.argv[2];
  const tagFilter = process.argv.slice(3).length > 0 ? process.argv.slice(3) : null;
  const cities = target ? [target] : (await sb.from("cities").select("slug").eq("is_active", true)).data?.map((c) => c.slug) ?? [];
  for (const slug of cities) {
    await importCity(slug, tagFilter);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
