/**
 * ETL: OSM-Stadtbezirke → Supabase city_districts
 *
 * Holt Stadt-Boundary (admin_level=4 für Berlin/Hamburg, 6 für München) +
 * Bezirke (admin_level=9). Der upsert_districts-RPC filtert dann spatial,
 * sodass nur Bezirke INNERHALB der echten Stadtgrenze importiert werden
 * (keine Umlandgemeinden).
 *
 * Usage:
 *   pnpm tsx scripts/etl-districts.ts             # alle aktiven Cities
 *   pnpm tsx scripts/etl-districts.ts berlin
 *
 * ENV: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
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

const CITY_BOUNDARY_LEVEL: Record<string, number> = {
  berlin: 4,    // Bundesland (Stadtstaat)
  hamburg: 4,   // Bundesland (Stadtstaat)
  muenchen: 6,  // Kreisfreie Stadt
};
const DISTRICT_LEVEL: Record<string, number> = {
  berlin: 9,    // 12 Bezirke
  hamburg: 9,   // 7 Bezirke
  muenchen: 9,  // 25 Stadtbezirke
};

type OverpassNode = { lat: number; lon: number };
type OverpassEl = {
  type: "node" | "way" | "relation";
  id: number;
  geometry?: OverpassNode[];
  members?: Array<{ type: string; ref: number; role: string; geometry?: OverpassNode[] }>;
  tags?: Record<string, string>;
};

function toPolygon(el: OverpassEl): GeoJSON.Polygon | GeoJSON.MultiPolygon | null {
  if (el.type === "way" && el.geometry) {
    const ring = el.geometry.map((p) => [p.lon, p.lat]);
    if (ring.length < 4) return null;
    const f = ring[0], l = ring[ring.length - 1];
    if (f[0] !== l[0] || f[1] !== l[1]) ring.push(f);
    if (ring.length < 4) return null;
    return { type: "Polygon", coordinates: [ring] };
  }
  if (el.type === "relation" && el.members) {
    const outers: number[][][] = [];
    for (const m of el.members) {
      if (m.role !== "outer" || !m.geometry) continue;
      const ring = m.geometry.map((p) => [p.lon, p.lat]);
      if (ring.length < 4) continue;
      const f = ring[0], l = ring[ring.length - 1];
      if (f[0] !== l[0] || f[1] !== l[1]) ring.push(f);
      if (ring.length < 4) continue;
      outers.push(ring);
    }
    if (outers.length === 0) return null;
    if (outers.length === 1) return { type: "Polygon", coordinates: [outers[0]] };
    return { type: "MultiPolygon", coordinates: outers.map((r) => [r]) };
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

async function fetchAdminPolygons(adminLevel: number, bbox: string): Promise<Array<{ el: OverpassEl; geom: GeoJSON.Polygon | GeoJSON.MultiPolygon }>> {
  const query = `[out:json][timeout:180];
(rel["boundary"="administrative"]["admin_level"="${adminLevel}"](${bbox}););
out geom;`;
  const res = await callOverpass(query);
  if (!res.ok) { console.log(`    HTTP ${res.status}`); return []; }
  const data = await res.json() as { elements: OverpassEl[] };
  const out: Array<{ el: OverpassEl; geom: GeoJSON.Polygon | GeoJSON.MultiPolygon }> = [];
  for (const el of data.elements ?? []) {
    const geom = toPolygon(el);
    if (!geom) continue;
    out.push({ el, geom });
  }
  return out;
}

/**
 * Hole City-Boundary via Nominatim (besser als Overpass für große Polygone —
 * Bundesland-Polygone wie Berlin/Hamburg crashen Overpass mit 504).
 */
async function fetchCityBoundaryNominatim(cityName: string): Promise<{ name: string; geom: GeoJSON.Polygon | GeoJSON.MultiPolygon; osm_id: number; osm_type: string } | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityName)}&format=geojson&polygon_geojson=1&limit=1&featuretype=city&addressdetails=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": "MyArea365-ETL/1.0 (+https://myarea365.de)" },
  });
  if (!res.ok) { console.log(`    Nominatim HTTP ${res.status}`); return null; }
  const data = await res.json() as {
    features: Array<{
      geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
      properties: { name?: string; osm_id?: number; osm_type?: string };
    }>;
  };
  const f = data.features?.[0];
  if (!f || !f.geometry) return null;
  if (f.geometry.type !== "Polygon" && f.geometry.type !== "MultiPolygon") return null;
  return {
    name: f.properties?.name ?? cityName,
    geom: f.geometry,
    osm_id: f.properties?.osm_id ?? 0,
    osm_type: f.properties?.osm_type ?? "relation",
  };
}

async function importCity(slug: string) {
  const { data: city, error } = await sb.from("cities")
    .select("slug,name,bounds_sw_lat,bounds_sw_lng,bounds_ne_lat,bounds_ne_lng")
    .eq("slug", slug).single();
  if (error || !city) { console.error(`City ${slug} not found`); return; }

  const bbox = `${city.bounds_sw_lat},${city.bounds_sw_lng},${city.bounds_ne_lat},${city.bounds_ne_lng}`;
  const boundaryLevel = CITY_BOUNDARY_LEVEL[slug] ?? 4;
  const districtLevel = DISTRICT_LEVEL[slug] ?? 9;

  console.log(`\n=== ${city.name} (${slug}) === bbox=${bbox}`);

  // Step 1: City boundary via Nominatim (vermeidet Overpass-504 für Bundesländer)
  const cityName = slug === "muenchen" ? "München" : city.name;
  console.log(`  boundary via Nominatim name="${cityName}"...`);
  const cityMatch = await fetchCityBoundaryNominatim(cityName);
  if (!cityMatch) { console.log("  ⚠ no city boundary found"); return; }

  const { error: bErr } = await sb.rpc("upsert_city_boundary", {
    p_city_slug: slug,
    p_geometry: cityMatch.geom,
  });
  if (bErr) { console.log(`  boundary upsert error: ${bErr.message}`); return; }
  console.log(`  boundary set: ${cityMatch.name}`);
  // Nominatim rate-limit: 1 req/sec
  await new Promise((r) => setTimeout(r, 1500));

  await new Promise((r) => setTimeout(r, 2500));

  // Step 2: Districts via area-query (vermeidet bbox-Fragmentation + 504-Timeouts)
  console.log(`  districts via area="${cityName}" admin_level=${districtLevel}...`);
  const areaQuery = `[out:json][timeout:180];
area["name"="${cityName}"]["admin_level"="${boundaryLevel}"]->.searchArea;
(rel(area.searchArea)["boundary"="administrative"]["admin_level"="${districtLevel}"];);
out geom;`;
  let districts: Array<{ el: OverpassEl; geom: GeoJSON.Polygon | GeoJSON.MultiPolygon }> = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await callOverpass(areaQuery);
    if (res.ok) {
      const data = await res.json() as { elements: OverpassEl[] };
      for (const el of data.elements ?? []) {
        const geom = toPolygon(el);
        if (geom) districts.push({ el, geom });
      }
      break;
    }
    console.log(`    attempt ${attempt + 1}: HTTP ${res.status}, retry in 10s...`);
    await new Promise((r) => setTimeout(r, 10000));
  }
  console.log(`  ${districts.length} candidate districts (will be spatially filtered)`);

  if (districts.length === 0) return;

  const features = districts.map(({ el, geom }) => ({
    osm_id: el.id,
    osm_type: el.type === "relation" ? "relation" : "way",
    name: el.tags?.name ?? "Unbenannt",
    geometry: geom,
  }));

  let total = 0;
  for (let i = 0; i < features.length; i += 50) {
    const chunk = features.slice(i, i + 50);
    const { data: count, error: uErr } = await sb.rpc("upsert_districts", {
      p_city_slug: slug,
      p_features: chunk,
    });
    if (uErr) { console.log(`  upsert error: ${uErr.message}`); continue; }
    total += (count as number) ?? 0;
  }
  console.log(`=== ${city.name}: ${total} districts upserted (spatial-filtered) ===`);
}

async function main() {
  const target = process.argv[2];
  const cities = target ? [target] : (await sb.from("cities").select("slug").eq("is_active", true)).data?.map((c) => c.slug) ?? [];
  for (const slug of cities) {
    await importCity(slug);
    await new Promise((r) => setTimeout(r, 3000));
  }

  console.log("\nInitial rotate_sanctuaries...");
  const { data: count, error } = await sb.rpc("rotate_sanctuaries");
  if (error) { console.log(`Rotate error: ${error.message}`); return; }
  console.log(`Rotated: ${count} sanctuaries.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
