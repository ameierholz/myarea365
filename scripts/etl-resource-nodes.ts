/**
 * ETL: Resource-Node-POIs aus OSM/Overpass → Supabase resource_nodes
 *
 * Mappt 4 OSM-POI-Typen auf unsere 4 Crew-Resourcen:
 *   industrial=scrap_yard / landuse=industrial → Tech-Schrott
 *   man_made=works / building=industrial       → Komponenten
 *   amenity=atm / amenity=bank                 → Krypto
 *   building=data_center / telecom-Tags        → Bandbreite
 *
 * Usage:
 *   pnpm tsx scripts/etl-resource-nodes.ts <city> <minLat> <minLng> <maxLat> <maxLng>
 *
 * Beispiel — Berlin komplett:
 *   pnpm tsx scripts/etl-resource-nodes.ts berlin 52.34 13.09 52.68 13.76
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
  console.error("Usage: pnpm tsx scripts/etl-resource-nodes.ts <city> <minLat> <minLng> <maxLat> <maxLng>");
  process.exit(1);
}
const [city, minLatS, minLngS, maxLatS, maxLngS] = args;
const minLat = Number(minLatS), minLng = Number(minLngS);
const maxLat = Number(maxLatS), maxLng = Number(maxLngS);

const sb = createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false } });

// 4 Overpass-Queries, eine pro Resource-Typ
const QUERIES: Array<{ kind: string; resource_type: string; query: string }> = [
  {
    kind: "scrapyard", resource_type: "wood",
    query: `
      node["industrial"="scrap_yard"](${minLat},${minLng},${maxLat},${maxLng});
      way ["industrial"="scrap_yard"](${minLat},${minLng},${maxLat},${maxLng});
      node["amenity"="recycling"]["recycling_type"="centre"](${minLat},${minLng},${maxLat},${maxLng});
    `,
  },
  {
    kind: "factory", resource_type: "stone",
    query: `
      way ["man_made"="works"](${minLat},${minLng},${maxLat},${maxLng});
      way ["building"="industrial"](${minLat},${minLng},${maxLat},${maxLng});
      way ["building"="warehouse"](${minLat},${minLng},${maxLat},${maxLng});
    `,
  },
  {
    kind: "atm", resource_type: "gold",
    query: `
      node["amenity"="atm"](${minLat},${minLng},${maxLat},${maxLng});
      node["amenity"="bank"](${minLat},${minLng},${maxLat},${maxLng});
    `,
  },
  {
    kind: "datacenter", resource_type: "mana",
    query: `
      node["telecom"](${minLat},${minLng},${maxLat},${maxLng});
      way ["telecom"](${minLat},${minLng},${maxLat},${maxLng});
      way ["building"="data_center"](${minLat},${minLng},${maxLat},${maxLng});
      node["man_made"="communications_tower"](${minLat},${minLng},${maxLat},${maxLng});
      node["man_made"="tower"]["tower:type"="communication"](${minLat},${minLng},${maxLat},${maxLng});
    `,
  },
];

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number; lon?: number;
  center?: { lat: number; lon: number };
  geometry?: Array<{ lat: number; lon: number }>;
  tags?: Record<string, string>;
};

function elementCenter(el: OverpassElement): { lat: number; lng: number } | null {
  if (el.type === "node" && el.lat != null && el.lon != null) return { lat: el.lat, lng: el.lon };
  if (el.center) return { lat: el.center.lat, lng: el.center.lon };
  if (el.geometry && el.geometry.length > 0) {
    const avg = el.geometry.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lon }), { lat: 0, lng: 0 });
    return { lat: avg.lat / el.geometry.length, lng: avg.lng / el.geometry.length };
  }
  return null;
}

async function fetchOverpassFor(query: string): Promise<OverpassElement[]> {
  const fullQuery = `[out:json][timeout:180]; (${query}); out center;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
      "User-Agent": "MyArea365-ETL/1.0 (+https://myarea365.de)",
    },
    body: "data=" + encodeURIComponent(fullQuery),
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}: ${await res.text().catch(() => "?")}`);
  const j = (await res.json()) as { elements?: OverpassElement[] };
  return j.elements ?? [];
}

async function main() {
  console.log(`[ETL] Resource-Nodes Berlin: bbox ${minLat},${minLng},${maxLat},${maxLng}`);

  // Bestehende Nodes für Stadt entsorgen (idempotent)
  const { error: delErr } = await sb.from("resource_nodes").delete().eq("city", city);
  if (delErr) console.warn(`[ETL] Delete-Warnung: ${delErr.message}`);

  let totalInserted = 0;
  for (const q of QUERIES) {
    console.log(`[ETL] → ${q.kind} (resource: ${q.resource_type})`);
    const elements = await fetchOverpassFor(q.query);
    console.log(`[ETL]   Overpass lieferte ${elements.length} Elemente`);

    const rows: Array<{ osm_id: number; city: string; kind: string; resource_type: string; name: string | null; lat: number; lng: number; level: number; total_yield: number; current_yield: number }> = [];
    for (const el of elements) {
      const c = elementCenter(el);
      if (!c) continue;
      // Level = 1..10 zufällig (höhere Levels seltener)
      const lvlRoll = Math.random();
      const level = lvlRoll < 0.55 ? 1 + Math.floor(Math.random() * 3)        // 1-3 (55%)
                   : lvlRoll < 0.85 ? 4 + Math.floor(Math.random() * 3)        // 4-6 (30%)
                   : lvlRoll < 0.97 ? 7 + Math.floor(Math.random() * 2)        // 7-8 (12%)
                   :                  9 + Math.floor(Math.random() * 2);       // 9-10 (3%)
      const yield_ = Math.max(1000, 1000 * level * (level + 1) / 2);
      rows.push({
        osm_id: el.id, city, kind: q.kind, resource_type: q.resource_type,
        name: el.tags?.name ?? null,
        lat: c.lat, lng: c.lng,
        level, total_yield: yield_, current_yield: yield_,
      });
    }

    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { error } = await sb.from("resource_nodes").insert(chunk);
      if (error) { console.error(`[ETL] Insert-Fehler ${q.kind} chunk ${i / CHUNK}: ${error.message}`); throw error; }
    }
    console.log(`[ETL]   ${rows.length} Nodes für ${q.kind} eingefügt`);
    totalInserted += rows.length;
  }

  console.log(`[ETL] ✅ Fertig — ${totalInserted} Resource-Nodes für "${city}" importiert`);
}

main().catch((err) => { console.error("[ETL] ❌ Fehler:", err); process.exit(1); });
