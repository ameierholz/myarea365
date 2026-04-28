/**
 * ETL: Stadt-Blocks aus OSM/Overpass → Supabase city_blocks
 *
 * Workflow:
 *  1. Query Overpass-API für alle highway-Ways im BBox
 *  2. Insert in _etl_osm_ways (Staging) — chunked
 *  3. Call etl_polygonize_city_blocks(city) → bildet Blocks via PostGIS ST_Polygonize
 *
 * Usage:
 *   pnpm tsx scripts/etl-city-blocks.ts <city> <minLat> <minLng> <maxLat> <maxLng>
 *
 * Beispiel — Berlin Mitte:
 *   pnpm tsx scripts/etl-city-blocks.ts berlin 52.50 13.36 52.55 13.43
 *
 * Beispiel — komplett Berlin (LANG, ~30 min):
 *   pnpm tsx scripts/etl-city-blocks.ts berlin 52.34 13.09 52.68 13.76
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
  console.error("Usage: pnpm tsx scripts/etl-city-blocks.ts <city> <minLat> <minLng> <maxLat> <maxLng>");
  process.exit(1);
}
const [city, minLatS, minLngS, maxLatS, maxLngS] = args;
const minLat = Number(minLatS), minLng = Number(minLngS);
const maxLat = Number(maxLatS), maxLng = Number(maxLngS);
if ([minLat, minLng, maxLat, maxLng].some((n) => Number.isNaN(n))) {
  console.error("BBox muss aus Zahlen bestehen");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL!, SERVICE_KEY!, {
  auth: { persistSession: false },
});

// Highway-Klassen die als Block-Begrenzung dienen.
// Pfade/Footways AUSSCHLIESSEN — die liegen oft mitten im Block.
const HIGHWAY_FILTER = '["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|service|pedestrian)$"]';

const overpassQuery = `
[out:json][timeout:180];
(
  way${HIGHWAY_FILTER}(${minLat},${minLng},${maxLat},${maxLng});
);
out geom;
`.trim();

type OverpassWay = {
  type: "way";
  id: number;
  geometry?: Array<{ lat: number; lon: number }>;
  tags?: Record<string, string>;
};

type OverpassResponse = {
  elements?: OverpassWay[];
};

async function fetchOverpass(): Promise<OverpassWay[]> {
  console.log(`[ETL] Overpass-Query: bbox ${minLat},${minLng},${maxLat},${maxLng}`);
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
      // Overpass blockt anonyme Requests — User-Agent identifiziert die App
      "User-Agent": "MyArea365-ETL/1.0 (+https://myarea365.de)",
    },
    body: "data=" + encodeURIComponent(overpassQuery),
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}: ${await res.text().catch(() => "?")}`);
  const j = (await res.json()) as OverpassResponse;
  const ways = (j.elements ?? []).filter((e) => e.type === "way" && Array.isArray(e.geometry) && e.geometry.length >= 2);
  console.log(`[ETL] Overpass lieferte ${ways.length} Ways`);
  return ways;
}

function wayToWkt(way: OverpassWay): string | null {
  if (!way.geometry || way.geometry.length < 2) return null;
  const coords = way.geometry.map((p) => `${p.lon} ${p.lat}`).join(",");
  return `LINESTRING(${coords})`;
}

async function stageWays(ways: OverpassWay[]): Promise<number> {
  // Erst gestagte Ways dieser City löschen (idempotent)
  await sb.from("_etl_osm_ways").delete().eq("city", city);

  const CHUNK = 200;
  let inserted = 0;
  for (let i = 0; i < ways.length; i += CHUNK) {
    const chunk = ways.slice(i, i + CHUNK);
    const rows = chunk
      .map((w) => {
        const wkt = wayToWkt(w);
        if (!wkt) return null;
        return {
          city,
          geom: wkt,
          highway: w.tags?.highway ?? null,
          name: w.tags?.name ?? null,
        };
      })
      .filter((x): x is { city: string; geom: string; highway: string | null; name: string | null } => x !== null);

    // Direktes insert klappt nicht weil geom-Column geometry ist — wir brauchen ST_GeomFromText.
    // Lösung: ein RPC `etl_insert_ways(rows jsonb)` der den cast macht.
    // Wir rufen das RPC an Stelle eines normalen inserts.
    const { error } = await sb.rpc("etl_insert_ways", { p_rows: rows });
    if (error) {
      console.error(`[ETL] Insert-Fehler chunk ${i}:`, error.message);
      throw error;
    }
    inserted += rows.length;
    process.stdout.write(`[ETL] gestaged ${inserted}/${ways.length}\r`);
  }
  console.log(`\n[ETL] Insgesamt ${inserted} Ways gestaged`);
  return inserted;
}

async function polygonize() {
  console.log(`[ETL] Polygonize city_blocks (alle Straßen) ...`);
  const { data: blockRes, error: blockErr } = await sb.rpc("etl_polygonize_city_blocks", {
    p_city: city,
    p_min_area_m2: 200,
    p_max_area_m2: 200000,
  });
  if (blockErr) throw blockErr;
  console.log(`[ETL] city_blocks:`, JSON.stringify(blockRes, null, 2));

  // WICHTIG: city_blocks-ETL löscht _etl_osm_ways am Ende → wir müssen
  // die Ways nochmal stagen für den neighborhood-pass. Daher: hier nicht
  // mehr machen, stattdessen in stageWays() den Workflow umkehren.
}

async function polygonizeNeighborhoods() {
  console.log(`[ETL] Polygonize neighborhood_blocks (nur Hauptstraßen) ...`);
  const { data, error } = await sb.rpc("etl_polygonize_neighborhood_blocks", {
    p_city: city,
    p_min_area_m2: 50000,
    p_max_area_m2: 5000000,
  });
  if (error) throw error;
  console.log(`[ETL] neighborhood_blocks:`, JSON.stringify(data, null, 2));
}

(async () => {
  try {
    const ways = await fetchOverpass();
    if (ways.length === 0) {
      console.log("[ETL] Keine Ways im BBox — abbruch.");
      return;
    }
    await stageWays(ways);
    // Reihenfolge wichtig: neighborhood ZUERST (city_blocks löscht staging am Ende)
    await polygonizeNeighborhoods();
    await polygonize();
    console.log("[ETL] ✅ Fertig.");
  } catch (e) {
    console.error("[ETL] ❌ Fehler:", e);
    process.exit(1);
  }
})();
