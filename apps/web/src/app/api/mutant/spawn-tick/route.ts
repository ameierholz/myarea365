import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/mutant/spawn-tick
 *
 * Spawnt STATIC Mutant-NPCs an realen OSM-Features (Parks/Industriegebieten/Wäldern).
 * Ersatz für die alten Wegelager — flächendeckende Verteilung über die Stadt.
 *
 * Pro Stadt:
 *   1. Cleanup expired Mutanten
 *   2. Aktuelle aktive Count holen
 *   3. Wenn < city.mutant_target: aus OSM Overpass POIs holen, random spawnen
 *   4. Tier nach Gewichtung (Bronze 60% / Silber 25% / Gold 12% / Platin 3%)
 *
 * Auth: x-cron-secret oder service-role.
 */
function getServiceSb() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("missing_service_role_env");
  return createServiceClient(url, key, { auth: { persistSession: false } });
}

type City = {
  slug: string;
  bounds_sw_lat: number; bounds_sw_lng: number;
  bounds_ne_lat: number; bounds_ne_lng: number;
  mutant_target: number;
  mutant_season_started_at: string;
};

// Server-Level: Saison-Start → +1 pro Stunde, Cap 30. Skaliert HP/Loot.
function computeMutantLevel(seasonStartIso: string): number {
  const hours = (Date.now() - new Date(seasonStartIso).getTime()) / 3_600_000;
  return Math.min(30, Math.max(1, Math.floor(hours) + 1));
}

type TierDef = { tier: "bronze" | "silver" | "gold" | "platinum"; weight: number; hp: number; troop_count: number };
const TIERS: TierDef[] = [
  { tier: "bronze",   weight: 60, hp: 1000,  troop_count: 200 },
  { tier: "silver",   weight: 25, hp: 4000,  troop_count: 600 },
  { tier: "gold",     weight: 12, hp: 12000, troop_count: 1800 },
  { tier: "platinum", weight: 3,  hp: 40000, troop_count: 5000 },
];

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

type OsmPoi = { lat: number; lng: number; terrain: string };

function pickTier(): TierDef {
  const total = TIERS.reduce((s, t) => s + t.weight, 0);
  let r = Math.random() * total;
  for (const t of TIERS) {
    r -= t.weight;
    if (r <= 0) return t;
  }
  return TIERS[0];
}

// Slug → OSM area name. Wichtig: muss EXAKT der Stadt-Name in OSM sein
// (admin_level=4 für Stadtstaaten, =6 für kreisfreie Städte).
const CITY_OSM_NAME: Record<string, string> = {
  berlin: "Berlin",
  hamburg: "Hamburg",
  muenchen: "München",
};

async function fetchOsmPois(city: City): Promise<OsmPoi[]> {
  // Statt rechteckiger Bbox die echte Admin-Grenze nutzen — sonst landen
  // POIs in Nachbarbezirken (z.B. Potsdam/Werder bei Berlin-Bbox).
  // POI-Mix bewusst breit: dichte Stadtgebiete (Mitte/Wedding/Friedrichshain)
  // haben kaum Parks/Industrie, aber viele Schulen/Plätze/Kirchen/Commercial-
  // Areale. Sonst bleibt das Grid-Center der Stadt leer.
  const areaName = CITY_OSM_NAME[city.slug] ?? city.slug;
  const query = `
    [out:json][timeout:60][maxsize:268435456];
    area["name"=${JSON.stringify(areaName)}]["admin_level"~"^(4|6)$"]->.city;
    (
      // Grün-/Industrie-Flächen (Stadt-Rand + Bezirke)
      way["leisure"="park"](area.city);
      relation["leisure"="park"](area.city);
      way["leisure"="garden"](area.city);
      way["leisure"="playground"](area.city);
      way["leisure"="sports_centre"](area.city);
      way["landuse"="industrial"](area.city);
      way["landuse"="commercial"](area.city);
      way["landuse"="retail"](area.city);
      way["landuse"="forest"](area.city);
      way["landuse"="cemetery"](area.city);
      way["natural"="wood"](area.city);

      // Urban-POIs (innenstadt: Schulen, Krankenhäuser, Universitäten, Plätze)
      way["amenity"="school"](area.city);
      way["amenity"="university"](area.city);
      way["amenity"="college"](area.city);
      way["amenity"="hospital"](area.city);
      way["amenity"="marketplace"](area.city);
      way["amenity"="place_of_worship"](area.city);
      way["building"="industrial"](area.city);
      way["building"="warehouse"](area.city);
      way["place"="square"](area.city);
    );
    out center;
  `;
  try {
    const r = await fetch(OVERPASS_URL, {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "User-Agent": "myarea365.de/mutant-spawn (contact: a.meierholz@gmail.com)",
      },
    });
    if (!r.ok) {
      console.error("[mutant-spawn] overpass-fail", r.status, await r.text().catch(() => ""));
      return [];
    }
    type OsmEl = {
      type: string; lat?: number; lon?: number;
      center?: { lat: number; lon: number };
      tags?: Record<string, string>;
    };
    const j = (await r.json()) as { elements?: OsmEl[] };
    const pois: OsmPoi[] = [];
    for (const el of j.elements ?? []) {
      const lat = el.lat ?? el.center?.lat;
      const lng = el.lon ?? el.center?.lon;
      if (lat == null || lng == null) continue;
      const tags = el.tags ?? {};
      const terrain =
        tags.leisure === "park" ? "park"
        : tags.leisure === "garden" ? "park"
        : tags.leisure === "playground" ? "park"
        : tags.leisure === "sports_centre" ? "park"
        : tags.landuse === "industrial" ? "industrial"
        : tags.landuse === "commercial" ? "industrial"
        : tags.landuse === "retail" ? "industrial"
        : tags.landuse === "forest" ? "forest"
        : tags.landuse === "cemetery" ? "park"
        : tags.natural === "wood" ? "forest"
        : tags.amenity === "school" ? "school"
        : tags.amenity === "university" ? "school"
        : tags.amenity === "college" ? "school"
        : tags.amenity === "hospital" ? "hospital"
        : tags.amenity === "marketplace" ? "square"
        : tags.amenity === "place_of_worship" ? "square"
        : tags.building === "industrial" ? "industrial"
        : tags.building === "warehouse" ? "industrial"
        : tags.place === "square" ? "square"
        : "park";
      pois.push({ lat, lng, terrain });
    }
    return pois;
  } catch (e) {
    console.error("[mutant-spawn] overpass-throw", String(e));
    return [];
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Verteilt n Items gleichmäßig über die Stadt-Bbox via Grid-Binning.
 * Berlin/Hamburg haben 12/7 Bezirke + viele Ortsteile — ohne Grid clustern
 * POIs in Wald-/Industrie-Bezirken (z.B. Köpenick) und der Westen ist leer.
 *
 * CELLS×CELLS-Grid: für n=600 mit 5×5 = 25 Zellen → 24 pro Zelle.
 * Bins mit weniger POIs als Soll werden „leergesammelt", der Rest aus
 * volleren Bins aufgefüllt → kein Bezirk wird komplett übersprungen.
 */
function pickEvenlyDistributed(
  pois: OsmPoi[],
  city: City,
  target: number,
  cells: number,
): OsmPoi[] {
  if (pois.length <= target) return shuffle(pois);
  const dLat = (city.bounds_ne_lat - city.bounds_sw_lat) / cells;
  const dLng = (city.bounds_ne_lng - city.bounds_sw_lng) / cells;
  // Index pro Zelle
  const bins: OsmPoi[][] = Array.from({ length: cells * cells }, () => []);
  for (const p of pois) {
    const i = Math.max(0, Math.min(cells - 1, Math.floor((p.lat - city.bounds_sw_lat) / dLat)));
    const j = Math.max(0, Math.min(cells - 1, Math.floor((p.lng - city.bounds_sw_lng) / dLng)));
    bins[i * cells + j].push(p);
  }
  const perCell = Math.ceil(target / (cells * cells));
  const picked: OsmPoi[] = [];
  const leftover: OsmPoi[] = [];
  for (const bin of bins) {
    if (bin.length === 0) continue;
    const shuffled = shuffle(bin);
    picked.push(...shuffled.slice(0, perCell));
    if (shuffled.length > perCell) leftover.push(...shuffled.slice(perCell));
  }
  // Falls einige Zellen leer waren oder pro-Zelle-Cap nicht erreicht wurde, mit
  // Resten aus volleren Zellen auf target auffüllen.
  if (picked.length < target) {
    const need = target - picked.length;
    picked.push(...shuffle(leftover).slice(0, need));
  }
  return picked.slice(0, target);
}

export async function POST(req: Request) {
  const cronSecret = req.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;
  if (expected && cronSecret && cronSecret !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sb = getServiceSb();
  await sb.rpc("mutants_cleanup_expired");

  const { data: cities } = await sb.from("cities")
    .select("slug, bounds_sw_lat, bounds_sw_lng, bounds_ne_lat, bounds_ne_lng, mutant_target, mutant_season_started_at")
    .eq("is_active", true);
  if (!cities || cities.length === 0) {
    return NextResponse.json({ ok: true, spawned: 0, error: "no_active_cities" });
  }

  const { data: counts } = await sb.from("mutants")
    .select("city_slug").eq("status", "walking");
  const byCity = new Map<string, number>();
  for (const r of counts ?? []) {
    byCity.set(r.city_slug as string, (byCity.get(r.city_slug as string) ?? 0) + 1);
  }

  const totalsByCity: Array<{ city: string; target: number; level: number; pois_found: number; spawned: number }> = [];

  for (const city of cities as City[]) {
    const cityLevel = computeMutantLevel(city.mutant_season_started_at);
    const have = byCity.get(city.slug) ?? 0;
    const need = Math.max(0, city.mutant_target - have);
    if (need === 0) {
      totalsByCity.push({ city: city.slug, target: city.mutant_target, level: cityLevel, pois_found: 0, spawned: 0 });
      continue;
    }

    const pois = await fetchOsmPois(city);
    if (pois.length === 0) {
      totalsByCity.push({ city: city.slug, target: city.mutant_target, level: cityLevel, pois_found: 0, spawned: 0 });
      continue;
    }

    // Grid-binning für gleichmäßige Verteilung. 7×7 = 49 Zellen → feinere
    // Granularität als 5×5, damit Innenstadt-Bezirke (Mitte/Wedding) eigene
    // Cells bekommen und nicht von Köpenick-POI-Massen geschluckt werden.
    const toSpawn = pickEvenlyDistributed(pois, city, need, 7);
    const rows = toSpawn.map((p) => {
      const tier = pickTier();
      // Level-Scaling: HP/Truppen × level (linear), Loot × sqrt(level) (langsamer)
      return {
        city_slug: city.slug,
        npc_kind: "static",
        spawn_terrain: p.terrain,
        origin_lat: p.lat, origin_lng: p.lng,
        target_lat: p.lat, target_lng: p.lng,
        route_distance_m: null,
        finishes_at: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
        status: "walking",
        loot_tier: tier.tier,
        hp: tier.hp * cityLevel,
        troop_count: tier.troop_count * cityLevel,
        level: cityLevel,
      };
    });

    if (rows.length > 0) {
      const { error } = await sb.from("mutants").insert(rows);
      if (error) {
        console.error("[mutant-spawn] insert-fail", city.slug, error.message);
      }
    }
    totalsByCity.push({ city: city.slug, target: city.mutant_target, level: cityLevel, pois_found: pois.length, spawned: rows.length });
  }

  return NextResponse.json({
    ok: true,
    cities: totalsByCity,
  });
}
