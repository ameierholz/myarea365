import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { requireStaff } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/saga/generate-map { bracket_id }
 *
 * Holt aus OSM via Overpass:
 *   - Quartier-Polygone (admin_level=10 oder 9 — Multipolygon-aware: größter Outer)
 *   - Reale Brücken/Tunnel (highway=motorway/trunk/primary/secondary) als Tor-Kandidaten
 *
 * Erzeugt:
 *   - saga_zones (district + spawn + apex + gate) — Spawns nach Himmelsrichtung verteilt
 *   - saga_zone_adjacency (Centroid-Distanz < threshold + Ring-Nachbarschaft)
 *
 * Fallback: wenn admin_level=10/9 < 8 Quartiere → Hex-Grid tilt die BBox
 *
 * Lange Operation (~30s pro Stadt). Vercel-Function-Timeout 60s.
 */
export const maxDuration = 60;

type ZoneSeed = {
  osm_id: number | null;
  name: string;
  centroid_lat: number;
  centroid_lng: number;
  polygon: number[][];
};

type GateCandidate = {
  osm_id: number;
  name: string;
  centroid_lat: number;
  centroid_lng: number;
  kind: "bridge" | "tunnel";
};

type OsmMember = {
  type: string;
  role?: string;
  geometry?: Array<{ lat: number; lon: number }>;
};

type OsmRelation = { type: "relation"; id: number; tags?: Record<string, string>; members?: OsmMember[] };
type OsmWay = { type: "way"; id: number; tags?: Record<string, string>; geometry?: Array<{ lat: number; lon: number }> };
type OsmElement = OsmRelation | OsmWay;

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// ════════════════════════════════════════════════════════════════
// Geo-Helpers
// ════════════════════════════════════════════════════════════════

/** Polygon-Umfang (Bogenmaß-Heuristik, gut genug zum Ranking nach Größe). */
function polygonPerimeter(poly: Array<{ lat: number; lon: number }>): number {
  let sum = 0;
  for (let i = 1; i < poly.length; i++) {
    const dLat = poly[i].lat - poly[i - 1].lat;
    const dLng = poly[i].lon - poly[i - 1].lon;
    sum += Math.hypot(dLat, dLng);
  }
  return sum;
}

function centroidOf(poly: number[][]): { lat: number; lng: number } {
  const lat = poly.reduce((s, p) => s + p[0], 0) / poly.length;
  const lng = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  return { lat, lng };
}

/** Multipolygon-Outer-Way: nimmt den längsten outer-Way als Hauptpolygon.
 *  Funktioniert für admin-Multipolygon-Relations mit Inseln/Löchern (z.B. Berlin/Spree). */
function pickLargestOuterPolygon(rel: OsmRelation): number[][] | null {
  // Strict: nur "outer" — verhindert dass Inner-Holes (z.B. Tempelhofer Feld
  // innerhalb Tempelhof-Schöneberg) als Hauptpolygon gewählt werden.
  const outers = (rel.members ?? []).filter(
    (m): m is OsmMember & { geometry: Array<{ lat: number; lon: number }> } =>
      m.type === "way" && !!m.geometry && m.geometry.length > 2 && m.role === "outer",
  );
  if (outers.length === 0) {
    // Fallback: manche admin_level=9-Relations haben keine expliziten Rollen — dann das längste ways nehmen.
    const anyWays = (rel.members ?? []).filter(
      (m): m is OsmMember & { geometry: Array<{ lat: number; lon: number }> } =>
        m.type === "way" && !!m.geometry && m.geometry.length > 2,
    );
    if (anyWays.length === 0) return null;
    anyWays.sort((a, b) => polygonPerimeter(b.geometry) - polygonPerimeter(a.geometry));
    return anyWays[0].geometry.map((p) => [p.lat, p.lon]);
  }
  outers.sort((a, b) => polygonPerimeter(b.geometry) - polygonPerimeter(a.geometry));
  return outers[0].geometry.map((p) => [p.lat, p.lon]);
}

/** Bin nach Kompass-Sektor: Winkel von Apex aus, in `sectors` gleich große Tortenstücke. */
function compassSector(lat: number, lng: number, apexLat: number, apexLng: number, sectors: number): number {
  const angle = Math.atan2(lat - apexLat, lng - apexLng); // -π..π
  const norm = (angle + 2 * Math.PI) % (2 * Math.PI);    // 0..2π
  return Math.floor((norm / (2 * Math.PI)) * sectors);
}

/** Hex-Grid-Fallback: tilt eine BBox mit Pointy-Top-Hexagons.
 *  Liefert Liste von Hex-Centroids + Polygonen, gefiltert auf BBox-Innenbereich. */
function hexGridFallback(
  bbox: { south: number; west: number; north: number; east: number },
  approxCount: number,
): ZoneSeed[] {
  const latSpan = bbox.north - bbox.south;
  const lngSpan = bbox.east - bbox.west;
  // Hex-Radius so wählen, dass ~approxCount Hexagons reinpassen
  const area = latSpan * lngSpan;
  const hexArea = area / approxCount;
  // Pointy-top Hex: A = 3√3/2 * r²  ⇒  r = √(A / (3√3/2)) = √(2A / (3√3))
  const r = Math.sqrt((2 * hexArea) / (3 * Math.sqrt(3)));
  const w = Math.sqrt(3) * r;       // Hex-Breite (flat-to-flat)
  const h = 2 * r;                  // Hex-Höhe (Spitze zu Spitze)
  const vStep = h * 0.75;

  const hexes: ZoneSeed[] = [];
  let row = 0;
  for (let lat = bbox.south + r; lat < bbox.north - r; lat += vStep, row++) {
    const offset = row % 2 === 0 ? 0 : w / 2;
    for (let lng = bbox.west + w / 2 + offset; lng < bbox.east - w / 2; lng += w) {
      const polygon: number[][] = [];
      for (let i = 0; i < 6; i++) {
        const ang = (Math.PI / 3) * i + Math.PI / 6; // pointy-top
        polygon.push([lat + r * Math.sin(ang), lng + r * Math.cos(ang)]);
      }
      hexes.push({
        osm_id: null,
        name: `Sektor ${hexes.length + 1}`,
        centroid_lat: lat,
        centroid_lng: lng,
        polygon,
      });
    }
  }
  return hexes;
}

// ════════════════════════════════════════════════════════════════
// Overpass-Fetch — kombinierte Query für Districts + Bridges + Tunnels
// ════════════════════════════════════════════════════════════════

async function runOverpass(query: string): Promise<{ elements: OsmElement[] }> {
  const r = await fetch(OVERPASS_URL, {
    method: "POST",
    body: `data=${encodeURIComponent(query)}`,
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      // Overpass-Mirrors verlangen einen identifizierenden User-Agent —
      // ohne den kommt schnell 406/429.
      "User-Agent": "myarea365.de/saga-map-generator (contact: a.meierholz@gmail.com)",
    },
  });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`Overpass ${r.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
  }
  return r.json();
}

async function fetchOsmData(bbox: string): Promise<{ elements: OsmElement[] }> {
  // Zwei separate Queries statt einer kombinierten — die kombinierte rief
  // 406 "Out-of-memory / complexity" hervor für große Städte wie Berlin.
  // maxsize:268435456 = 256 MB pro Query (Default 512 MB ist mehr als nötig).
  // ── Query A: Quartiere (admin_level=10 + 9) ─────────────────────────────
  const queryDistricts = `
    [out:json][timeout:60][maxsize:268435456];
    (
      relation["admin_level"="10"](${bbox});
      relation["admin_level"="9"](${bbox});
    );
    out geom;
  `;
  // ── Query B: Brücken + Tunnel auf wichtigen Straßen ─────────────────────
  const queryGates = `
    [out:json][timeout:60][maxsize:268435456];
    (
      way["bridge"="yes"]["highway"~"motorway|trunk|primary|secondary"](${bbox});
      way["tunnel"="yes"]["highway"~"motorway|trunk|primary|secondary"](${bbox});
    );
    out geom;
  `;

  const [a, b] = await Promise.all([runOverpass(queryDistricts), runOverpass(queryGates)]);
  return { elements: [...(a.elements ?? []), ...(b.elements ?? [])] };
}

// ════════════════════════════════════════════════════════════════
// POST /api/admin/saga/generate-map
// ════════════════════════════════════════════════════════════════

function getServiceSb() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("missing_service_role_env");
  return createServiceClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  await requireStaff();
  // Service-Role: saga_zones/adjacency/mega_camps haben nur public-READ-Policies,
  // INSERTs müssen RLS umgehen. Auth via requireStaff() oben.
  const sb = getServiceSb();
  const { bracket_id } = await req.json();
  if (!bracket_id) return NextResponse.json({ ok: false, error: "bracket_id required" }, { status: 400 });

  const { data: bracket } = await sb.from("saga_brackets")
    .select("id, city_slug, crew_count")
    .eq("id", bracket_id).single();
  if (!bracket) return NextResponse.json({ ok: false, error: "bracket_not_found" }, { status: 404 });

  // Idempotenz: bestehende Zonen + Adjacency löschen
  await sb.from("saga_zones").delete().eq("bracket_id", bracket_id);

  const { data: city } = await sb.from("saga_city_pool")
    .select("*").eq("slug", bracket.city_slug).single();
  if (!city) return NextResponse.json({ ok: false, error: "city_not_found" }, { status: 404 });

  const bbox = `${city.bbox_south},${city.bbox_west},${city.bbox_north},${city.bbox_east}`;
  let osmJson: { elements: OsmElement[] };
  try {
    osmJson = await fetchOsmData(bbox);
  } catch (e) {
    return NextResponse.json({ ok: false, error: "overpass_failed", detail: String(e) }, { status: 502 });
  }

  // ── 1) Quartiere aus admin_level-Relations ───────────────────────────────
  const districts: ZoneSeed[] = [];
  for (const el of osmJson.elements) {
    if (el.type !== "relation" || !el.tags) continue;
    const name = el.tags.name ?? el.tags["name:de"] ?? `Quartier ${el.id}`;
    const polygon = pickLargestOuterPolygon(el);
    if (!polygon || polygon.length < 3) continue;
    const c = centroidOf(polygon);
    districts.push({ osm_id: el.id, name, centroid_lat: c.lat, centroid_lng: c.lng, polygon });
  }

  // Hex-Grid-Fallback wenn OSM zu dünn ist (kleine Städte wie Cottbus/Görlitz/Trier)
  let usedFallback = false;
  if (districts.length < 8) {
    usedFallback = true;
    const fallbackCount = Math.max(40, bracket.crew_count * 8); // ~8 Quartiere pro Crew
    const hexes = hexGridFallback(
      {
        south: Number(city.bbox_south),
        west: Number(city.bbox_west),
        north: Number(city.bbox_north),
        east: Number(city.bbox_east),
      },
      fallbackCount,
    );
    if (hexes.length < 8) {
      return NextResponse.json({
        ok: false,
        error: "insufficient_districts_and_hex_failed",
        osm_districts: districts.length,
        hex_count: hexes.length,
      }, { status: 422 });
    }
    districts.push(...hexes);
  }

  // ── 2) Brücken/Tunnel aus way-Elements als Tor-Kandidaten ────────────────
  const gateCandidates: GateCandidate[] = [];
  for (const el of osmJson.elements) {
    if (el.type !== "way" || !el.geometry || el.geometry.length < 2) continue;
    const tags = el.tags ?? {};
    const isBridge = tags.bridge === "yes";
    const isTunnel = tags.tunnel === "yes";
    if (!isBridge && !isTunnel) continue;
    // Centroid = Mittelpunkt der Way-Punkte
    const cLat = el.geometry.reduce((s, p) => s + p.lat, 0) / el.geometry.length;
    const cLng = el.geometry.reduce((s, p) => s + p.lon, 0) / el.geometry.length;
    const baseName = tags.name ?? tags["name:de"] ?? (isBridge ? "Brücke" : "Tunnel");
    gateCandidates.push({
      osm_id: el.id,
      name: baseName,
      centroid_lat: cLat,
      centroid_lng: cLng,
      kind: isBridge ? "bridge" : "tunnel",
    });
  }

  // ── 3) Apex setzen + Districts nach Apex-Distanz in Ringe einteilen ──────
  const apexLat = Number(city.apex_lat);
  const apexLng = Number(city.apex_lng);
  const distFromApex = (lat: number, lng: number) => Math.hypot(lat - apexLat, lng - apexLng);
  districts.sort((a, b) => distFromApex(a.centroid_lat, a.centroid_lng) - distFromApex(b.centroid_lat, b.centroid_lng));

  // ── 3a) Camps anlegen (4 Quadranten — RoK-Style 4-Camp-System) ───────────
  //   Sektor 0 = Ost-Nord, 1 = Nord-West, 2 = West-Süd, 3 = Süd-Ost
  //   (atan2(lat-aLat, lng-aLng) → 0..2π / 4)
  const CAMP_DEFS = [
    { camp_index: 0, name: "Sturm-Brigade",  color_hex: "#06B6D4", barrier_theme: "wall" },   // NE — cyan/storm
    { camp_index: 1, name: "Eis-Allianz",    color_hex: "#A5B4FC", barrier_theme: "wall" },   // NW — light blue/ice
    { camp_index: 2, name: "Schmiede-Pakt",  color_hex: "#FF6B4A", barrier_theme: "wall" },   // SW — orange/fire
    { camp_index: 3, name: "Wald-Bund",      color_hex: "#22c55e", barrier_theme: "wall" },   // SE — green/forest
  ];
  await sb.from("saga_camps").delete().eq("bracket_id", bracket_id);
  const { data: createdCamps, error: campErr } = await sb.from("saga_camps").insert(
    CAMP_DEFS.map((c) => ({ ...c, bracket_id })),
  ).select("id, camp_index");
  if (campErr) return NextResponse.json({ ok: false, error: `camps_create_failed: ${campErr.message}` }, { status: 500 });
  const campByQuadrant = new Map<number, string>();
  for (const c of createdCamps ?? []) campByQuadrant.set(c.camp_index as number, c.id as string);
  const quadrantOf = (lat: number, lng: number) => compassSector(lat, lng, apexLat, apexLng, 4);
  const campIdOf = (lat: number, lng: number) => campByQuadrant.get(quadrantOf(lat, lng)) ?? null;

  // Verteilung: ring 0 = Apex-Quartier, dann ~10/25/30/35% in Ring 1..4
  const total = districts.length;
  const ringRanges: Array<{ ring: number; count: number }> = [
    { ring: 1, count: Math.max(2, Math.floor(total * 0.10)) },
    { ring: 2, count: Math.max(4, Math.floor(total * 0.25)) },
    { ring: 3, count: Math.max(6, Math.floor(total * 0.30)) },
    { ring: 4, count: total },
  ];

  // Apex (ring 0) — erstes Quartier, aber Polygon des nähesten Quartiers nutzen
  // Hinweis: Batch-Inserts mit unterschiedlichen Keys werden von supabase-js
  // mit NULL aufgefüllt → NOT-NULL-Booleans IMMER explizit setzen.
  const apexSeed = districts[0];
  const inserts: Array<Record<string, unknown>> = [];
  inserts.push({
    bracket_id,
    osm_id: apexSeed.osm_id,
    name: city.apex_name,
    zone_kind: "apex",
    ring: 0,
    centroid_lat: apexLat,
    centroid_lng: apexLng,
    polygon: apexSeed.polygon,
    resource_bonus_pct: 50,
    resource_kind: "krypto",
    is_holy_site: false,
    is_gather_tile: false,
    camp_id: null,   // Apex ist neutral, kein Camp
  });

  // Sammeln aller Ring-4-Districts für spätere Spawn-Verteilung nach Kompass
  const outerRingDistricts: ZoneSeed[] = [];

  // Sammeln pro Ring für spätere Holy-Site / Gather-Tile / Behemoth-Zuordnung
  const insertsByRing = new Map<number, Array<Record<string, unknown>>>();

  let cursor = 1;
  for (const r of ringRanges) {
    const slice = districts.slice(cursor, cursor + r.count);
    const isOuterRing = r.ring === 4;
    for (const d of slice) {
      if (isOuterRing) outerRingDistricts.push(d);
      const row: Record<string, unknown> = {
        bracket_id,
        osm_id: d.osm_id,
        name: d.name,
        zone_kind: "district", // Spawns bekommen ihren zone_kind separat (Kompass-Verteilung unten)
        ring: r.ring,
        centroid_lat: d.centroid_lat,
        centroid_lng: d.centroid_lng,
        polygon: d.polygon,
        resource_bonus_pct: r.ring === 1 ? 25 : r.ring === 2 ? 15 : r.ring === 3 ? 10 : 5,
        resource_kind: ["tech_schrott", "komponenten", "krypto", "bandbreite"][outerRingDistricts.length % 4],
        is_holy_site: false,
        is_gather_tile: false,
        camp_id: campIdOf(d.centroid_lat, d.centroid_lng),
      };
      inserts.push(row);
      const ringArr = insertsByRing.get(r.ring) ?? [];
      ringArr.push(row);
      insertsByRing.set(r.ring, ringArr);
    }
    cursor += r.count;
    if (cursor >= total) break;
  }

  // ── 3b) Holy Sites: 3 prestige-Quartiere in Ring 1+2 mit Buffs ───────────
  // Heuristik: zentralste (= apex-näheste) Ring-1/2-Zonen sind Wahrzeichen-Cluster.
  type HolyBuff = { kind: string; pct: number };
  const HOLY_BUFFS: HolyBuff[] = [
    { kind: "march_speed", pct: 8 },     // Crew-weite Marsch-Geschwindigkeit
    { kind: "gather_yield", pct: 12 },   // Crew-weite Sammel-Ausbeute
    { kind: "defense_bonus", pct: 10 },  // Verteidigungs-Bonus auf eigenen Zonen
    { kind: "training_speed", pct: 15 }, // Truppen-Bau-Geschwindigkeit
  ];
  const holyTargets: Array<Record<string, unknown>> = [];
  const r1 = insertsByRing.get(1) ?? [];
  const r2 = insertsByRing.get(2) ?? [];
  if (r1.length > 0) holyTargets.push(r1[0]);                    // tiefstes Wahrzeichen
  if (r2.length > 0) holyTargets.push(r2[0]);
  if (r2.length > 1) holyTargets.push(r2[Math.floor(r2.length / 2)]);
  for (let i = 0; i < holyTargets.length; i++) {
    const buff = HOLY_BUFFS[i % HOLY_BUFFS.length];
    holyTargets[i].is_holy_site = true;
    holyTargets[i].holy_buff_kind = buff.kind;
    holyTargets[i].holy_buff_pct = buff.pct;
  }

  // ── 3c) Gather Tiles: 1/3 der Ring-3/4-Zonen sind ergiebige Sammelpunkte ──
  // Resource-Kind matcht die Zone, Yield skaliert mit Ring (innen mehr).
  const RING_GATHER_YIELD = { 3: 8000, 4: 5000 } as Record<number, number>;
  const RING_GATHER_CAPACITY = { 3: 400_000, 4: 250_000 } as Record<number, number>;
  for (const r of [3, 4]) {
    const arr = insertsByRing.get(r) ?? [];
    // Jedes dritte Quartier als Gather-Tile (deterministisch über Index)
    for (let i = 0; i < arr.length; i += 3) {
      const z = arr[i];
      // Spawn-Zonen NICHT zu Gather-Tiles machen (sonst kann sich Crew nicht bewegen)
      if (z.zone_kind === "spawn") continue;
      z.is_gather_tile = true;
      z.gather_yield_per_hour = RING_GATHER_YIELD[r];
      z.gather_kind = z.resource_kind;
      z.gather_capacity = RING_GATHER_CAPACITY[r];
      z.gather_remaining = RING_GATHER_CAPACITY[r];
    }
  }

  // ── 4) Spawn-Verteilung nach Himmelsrichtung ──────────────────────────────
  // Outer-Ring-Districts in `crew_count` Kompass-Sektoren binnen,
  // pro Sektor das am weitesten vom Apex entfernte Quartier zur Spawn-Zone machen.
  const sectorCount = Math.max(2, bracket.crew_count); // mind. 2 (Theorie-Mindest)
  const sectorBins: ZoneSeed[][] = Array.from({ length: sectorCount }, () => []);
  for (const d of outerRingDistricts) {
    const s = compassSector(d.centroid_lat, d.centroid_lng, apexLat, apexLng, sectorCount);
    sectorBins[s].push(d);
  }
  const spawnSeeds: ZoneSeed[] = [];
  for (const bin of sectorBins) {
    if (bin.length === 0) continue;
    bin.sort((a, b) =>
      distFromApex(b.centroid_lat, b.centroid_lng) - distFromApex(a.centroid_lat, a.centroid_lng),
    );
    spawnSeeds.push(bin[0]);
  }
  // Markiere die spawns: finde sie in `inserts` (nach polygon-Referenz) und ändere zone_kind
  const spawnOsmIds = new Set(spawnSeeds.map((s) => s.osm_id));
  const spawnByCentroid = new Set(spawnSeeds.map((s) => `${s.centroid_lat.toFixed(5)},${s.centroid_lng.toFixed(5)}`));
  for (const ins of inserts) {
    if (ins.zone_kind !== "district") continue;
    const key = `${(ins.centroid_lat as number).toFixed(5)},${(ins.centroid_lng as number).toFixed(5)}`;
    if ((ins.osm_id != null && spawnOsmIds.has(ins.osm_id as number)) || spawnByCentroid.has(key)) {
      ins.zone_kind = "spawn";
    }
  }

  const { data: insertedZones, error: insErr } = await sb.from("saga_zones")
    .insert(inserts).select("id, ring, zone_kind, centroid_lat, centroid_lng, polygon");
  if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });

  // ── 5) Echte Tore aus OSM-Brücken/Tunneln pro Ring-Übergang ──────────────
  // Berechne Distanz vom Apex für jeden Brücken/Tunnel-Kandidaten + grenz auf
  // die Distanz-Range pro Ring-Übergang ein.
  type RingZ = { id: string; ring: number; zone_kind: string; centroid_lat: number; centroid_lng: number };
  const zonesByRing = new Map<number, RingZ[]>();
  for (const z of insertedZones ?? []) {
    const r = (z.ring as number) ?? 4;
    const arr = zonesByRing.get(r) ?? [];
    arr.push({
      id: z.id as string,
      ring: r,
      zone_kind: z.zone_kind as string,
      centroid_lat: Number(z.centroid_lat),
      centroid_lng: Number(z.centroid_lng),
    });
    zonesByRing.set(r, arr);
  }

  // Pro Ring: max-Distanz vom Apex zum Outer-Edge = Ring-Grenze
  const ringMaxDist = new Map<number, number>();
  for (const [r, arr] of zonesByRing) {
    const max = Math.max(...arr.map((z) => distFromApex(z.centroid_lat, z.centroid_lng)));
    ringMaxDist.set(r, max);
  }

  const gateInserts: Array<Record<string, unknown>> = [];
  // Ringe 4→3, 3→2, 2→1, 1→0 — jeweils ein Tor (oder mehrere)
  for (let r = 4; r > 0; r--) {
    const outerMax = ringMaxDist.get(r) ?? 0;
    const innerMax = ringMaxDist.get(r - 1) ?? 0;
    if (outerMax <= 0 || innerMax <= 0) continue;

    // Kandidaten: Brücken/Tunnel mit Apex-Distanz zwischen innerMax*0.85 und outerMax*1.0
    // (~zwischen-den-Ringen). Filtert deutlich aus.
    const lo = innerMax * 0.85;
    const hi = outerMax * 1.05;
    const matching = gateCandidates.filter((g) => {
      const d = distFromApex(g.centroid_lat, g.centroid_lng);
      return d >= lo && d <= hi;
    });

    // Pro Ring max 4 Tore — verteilt nach Kompass (max 1 pro Quadrant N/O/S/W)
    const perQuadrant: GateCandidate[][] = [[], [], [], []];
    for (const g of matching) {
      const q = compassSector(g.centroid_lat, g.centroid_lng, apexLat, apexLng, 4);
      perQuadrant[q].push(g);
    }
    for (const q of perQuadrant) {
      if (q.length === 0) continue;
      // Für die Übersichtlichkeit nur das längste/repräsentativste Tor pro Quadrant
      q.sort((a, b) => a.name.length - b.name.length); // willkürlich, könnte später nach Way-Länge gehen
      const picked = q[0];
      gateInserts.push({
        bracket_id,
        osm_id: picked.osm_id,
        name: picked.name,
        zone_kind: "gate",
        ring: r - 1,
        centroid_lat: picked.centroid_lat,
        centroid_lng: picked.centroid_lng,
        polygon: [
          [picked.centroid_lat - 0.0008, picked.centroid_lng - 0.0008],
          [picked.centroid_lat - 0.0008, picked.centroid_lng + 0.0008],
          [picked.centroid_lat + 0.0008, picked.centroid_lng + 0.0008],
          [picked.centroid_lat + 0.0008, picked.centroid_lng - 0.0008],
        ],
        resource_bonus_pct: 0,
        gate_kind: picked.kind,
        gate_phase: 5 - r,
        gate_state: "closed",
        is_holy_site: false,
        is_gather_tile: false,
        camp_id: campIdOf(picked.centroid_lat, picked.centroid_lng),
      });
    }

    // Falls keine realen Tore im Distance-Band: synthetisches Fallback-Tor (alter Modus)
    if (matching.length === 0) {
      const innerZones = zonesByRing.get(r - 1) ?? [];
      const outerZones = zonesByRing.get(r) ?? [];
      if (innerZones.length === 0 || outerZones.length === 0) continue;
      const cInner = innerZones[0];
      const cOuter = outerZones[0];
      const tLat = (cInner.centroid_lat + cOuter.centroid_lat) / 2;
      const tLng = (cInner.centroid_lng + cOuter.centroid_lng) / 2;
      gateInserts.push({
        bracket_id,
        osm_id: null,
        name: r === 4 ? "Stadtrand-Tor" : r === 3 ? "Ring-Passage" : r === 2 ? "Innenstadt-Tor" : "Apex-Tor",
        zone_kind: "gate",
        ring: r - 1,
        centroid_lat: tLat,
        centroid_lng: tLng,
        polygon: [
          [tLat - 0.001, tLng - 0.001],
          [tLat - 0.001, tLng + 0.001],
          [tLat + 0.001, tLng + 0.001],
          [tLat + 0.001, tLng - 0.001],
        ],
        resource_bonus_pct: 0,
        gate_kind: r === 2 ? "tunnel" : "bridge",
        gate_phase: 5 - r,
        gate_state: "closed",
        is_holy_site: false,
        is_gather_tile: false,
        camp_id: campIdOf(tLat, tLng),
      });
    }
  }

  if (gateInserts.length > 0) {
    const { error: gateErr } = await sb.from("saga_zones").insert(gateInserts);
    if (gateErr) return NextResponse.json({ ok: false, error: gateErr.message }, { status: 500 });
  }

  // ── 6) Crew-Spawn + Camp-Element + Voronoi-Camp-Zuordnung ─────────────────
  // Pro Crew: Spawn-Zone, Camp-Element (Fire/Ice/Storm/Earth/…) und Banner-Emoji.
  // Reihenfolge der Crews matcht die Reihenfolge der Spawn-Zonen (Kompass N→O→S→W…).
  const CAMP_ELEMENTS = [
    { element: "fire",    emoji: "🔥",   name: "Feuer-Camp"    },
    { element: "ice",     emoji: "❄️",   name: "Eis-Camp"      },
    { element: "storm",   emoji: "🌪️",  name: "Sturm-Camp"    },
    { element: "earth",   emoji: "🪨",   name: "Stein-Camp"    },
    { element: "thunder", emoji: "⚡",   name: "Blitz-Camp"    },
    { element: "shadow",  emoji: "🌑",   name: "Schatten-Camp" },
    { element: "wind",    emoji: "💨",   name: "Wind-Camp"     },
    { element: "water",   emoji: "💧",   name: "Wasser-Camp"   },
  ];
  const spawns = (insertedZones ?? []).filter((z) => z.zone_kind === "spawn");
  const { data: bcrews } = await sb.from("saga_bracket_crews")
    .select("crew_id").eq("bracket_id", bracket_id);

  // Map: spawn-zone-id → crew-id (für Voronoi-Lookup unten)
  const spawnToCrewId = new Map<string, string>();

  for (let i = 0; i < (bcrews ?? []).length && i < spawns.length; i++) {
    const crewId = bcrews![i].crew_id;
    const spawnZone = spawns[i];
    const camp = CAMP_ELEMENTS[i % CAMP_ELEMENTS.length];
    spawnToCrewId.set(spawnZone.id as string, crewId);

    await sb.from("saga_bracket_crews")
      .update({
        spawn_zone_id: spawnZone.id,
        camp_element: camp.element,
        camp_emoji: camp.emoji,
        camp_name: camp.name,
      })
      .eq("bracket_id", bracket_id)
      .eq("crew_id", crewId);
    await sb.from("saga_zones")
      .update({ owner_crew_id: crewId, camp_crew_id: crewId })
      .eq("id", spawnZone.id);
  }

  // Voronoi-Camp-Zuordnung: jede District-Zone wird der nächsten Spawn-Zone
  // zugeordnet. Apex bleibt neutral (KEIN Camp). Gates auch nicht.
  const campAssignments = new Map<string, string[]>(); // crew_id → [zone_ids]
  for (const z of insertedZones ?? []) {
    if (z.zone_kind !== "district") continue;
    let nearestCrewId: string | null = null;
    let nearestDist = Infinity;
    for (const sp of spawns) {
      const d = Math.hypot(
        Number(z.centroid_lat) - Number(sp.centroid_lat),
        Number(z.centroid_lng) - Number(sp.centroid_lng),
      );
      if (d < nearestDist) {
        nearestDist = d;
        nearestCrewId = spawnToCrewId.get(sp.id as string) ?? null;
      }
    }
    if (nearestCrewId) {
      const arr = campAssignments.get(nearestCrewId) ?? [];
      arr.push(z.id as string);
      campAssignments.set(nearestCrewId, arr);
    }
  }
  for (const [crewId, zoneIds] of campAssignments) {
    if (zoneIds.length === 0) continue;
    await sb.from("saga_zones")
      .update({ camp_crew_id: crewId })
      .in("id", zoneIds);
  }

  // ── 7) Adjacency (Centroid-Distanz + Ring-Nachbarschaft) ─────────────────
  const { data: zonesFinal } = await sb.from("saga_zones")
    .select("id, ring, zone_kind, centroid_lat, centroid_lng")
    .eq("bracket_id", bracket_id);

  if (zonesFinal) {
    const adjPairs: Array<{ zone_a: string; zone_b: string; via_gate_zone: string | null }> = [];
    const threshold = 0.025;
    for (let i = 0; i < zonesFinal.length; i++) {
      for (let j = i + 1; j < zonesFinal.length; j++) {
        const a = zonesFinal[i];
        const b = zonesFinal[j];
        if (a.zone_kind === "gate" && b.zone_kind === "gate") continue;
        const d = Math.hypot(Number(a.centroid_lat) - Number(b.centroid_lat), Number(a.centroid_lng) - Number(b.centroid_lng));
        if (d > threshold) continue;
        if (Math.abs(a.ring - b.ring) > 1) continue;
        let viaGate: string | null = null;
        if (a.ring !== b.ring) {
          const minRing = Math.min(a.ring, b.ring);
          // Tor im selben Quadrant bevorzugen
          const gates = zonesFinal.filter((z) => z.zone_kind === "gate" && z.ring === minRing);
          if (gates.length > 0) {
            // Wähle das Tor mit minimaler Distanz zum Pair-Centroid
            const midLat = (Number(a.centroid_lat) + Number(b.centroid_lat)) / 2;
            const midLng = (Number(a.centroid_lng) + Number(b.centroid_lng)) / 2;
            gates.sort((g1, g2) => {
              const d1 = Math.hypot(Number(g1.centroid_lat) - midLat, Number(g1.centroid_lng) - midLng);
              const d2 = Math.hypot(Number(g2.centroid_lat) - midLat, Number(g2.centroid_lng) - midLng);
              return d1 - d2;
            });
            viaGate = gates[0].id;
          }
        }
        adjPairs.push({ zone_a: a.id, zone_b: b.id, via_gate_zone: viaGate });
      }
    }
    if (adjPairs.length > 0) {
      await sb.from("saga_zone_adjacency").insert(adjPairs);
    }
  }

  // ── 7b) Camp-Walls: vorberechnete Wand-Segmente zwischen Zonen verschiedener Camps ──
  // Idee: zwischen zwei adjacent zones die VERSCHIEDENEN Camps angehören legen wir ein
  // kurzes Wand-Segment, perpendicular zur Verbindungslinie der beiden Centroiden,
  // mittig zwischen ihnen. Frontend rendert das als Eiswand/Felsen-Wall.
  await sb.from("saga_camp_walls").delete().eq("bracket_id", bracket_id);
  const { data: zonesWithCamp } = await sb.from("saga_zones")
    .select("id, camp_crew_id, centroid_lat, centroid_lng, zone_kind")
    .eq("bracket_id", bracket_id);
  if (zonesWithCamp && zonesWithCamp.length > 0) {
    const zoneById = new Map(zonesWithCamp.map((z) => [z.id as string, z]));
    // Wand-Stil pro Stadt: bei Wasserstädten = "river" für Fluss-Trennungen.
    const citySlug = (city as { slug: string }).slug;
    const wallKind: "river" | "rock" | "wall" | "ice" | "forest" =
      ["hamburg", "bremen", "berlin", "duesseldorf"].includes(citySlug) ? "river" :
      ["muenchen", "stuttgart"].includes(citySlug) ? "rock" :
      "wall";
    const wallInserts: Array<Record<string, unknown>> = [];
    // Alle Adjacencies dieses Brackets holen — saga_zone_adjacency hat keine
    // bracket_id-Spalte, wir filtern client-seitig über die zone-id-Map.
    const zoneIdSet = new Set(zonesWithCamp.map((z) => z.id as string));
    const { data: allAdjRaw } = await sb.from("saga_zone_adjacency")
      .select("zone_a, zone_b")
      .in("zone_a", Array.from(zoneIdSet));
    const allAdj = (allAdjRaw ?? []).filter((a) => zoneIdSet.has(a.zone_b as string));
    const seen = new Set<string>();
    for (const adj of allAdj) {
      const za = zoneById.get(adj.zone_a as string);
      const zb = zoneById.get(adj.zone_b as string);
      if (!za || !zb) continue;
      // Gates und Apex bleiben neutral — kein Wall durch Tor oder Wahrzeichen
      if (za.zone_kind === "gate" || zb.zone_kind === "gate") continue;
      if (za.zone_kind === "apex" || zb.zone_kind === "apex") continue;
      // Beide müssen Camp-Crew-IDs haben und sie müssen UNTERSCHIEDLICH sein
      if (!za.camp_crew_id || !zb.camp_crew_id) continue;
      if (za.camp_crew_id === zb.camp_crew_id) continue;
      const key = [adj.zone_a, adj.zone_b].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      const aLat = Number(za.centroid_lat);
      const aLng = Number(za.centroid_lng);
      const bLat = Number(zb.centroid_lat);
      const bLng = Number(zb.centroid_lng);
      const mLat = (aLat + bLat) / 2;
      const mLng = (aLng + bLng) / 2;
      // Perpendicular-Vector: (-dLng, dLat) — bei lat-lng als x/y rotiert um 90°
      const dLat = bLat - aLat;
      const dLng = bLng - aLng;
      const len = Math.hypot(dLat, dLng) || 1e-9;
      // Wand-Länge ~Berlin-Quartier-Breite, damit die Wand visuell die echte
      // Grenze überdeckt statt als kurzer Strich daneben zu stehen.
      const halfWall = 0.009; // ~1km bei Berlin-Breite
      const pLat = (-dLng / len) * halfWall;
      const pLng = (dLat / len) * halfWall;
      wallInserts.push({
        bracket_id,
        zone_a: adj.zone_a,
        zone_b: adj.zone_b,
        wall_kind: wallKind,
        midpoint_lat: mLat,
        midpoint_lng: mLng,
        point_a_lat: mLat + pLat,
        point_a_lng: mLng + pLng,
        point_b_lat: mLat - pLat,
        point_b_lng: mLng - pLng,
      });
    }
    if (wallInserts.length > 0) {
      await sb.from("saga_camp_walls").insert(wallInserts);
    }
  }

  // ── 8) Behemoth-Spawns: PvE-Mega-Bosse in Ring-2-Zonen ────────────────────
  // 3 Behemoths verteilt nach Kompass (max 1 pro Quadrant). HP skaliert mit
  // Crew-Anzahl — 4 Crews ⇒ ~120k HP, 8 Crews ⇒ ~240k HP.
  await sb.from("saga_mega_camps").delete().eq("bracket_id", bracket_id);
  const ring2 = (zonesFinal ?? []).filter(
    (z) => z.ring === 2 && z.zone_kind === "district",
  );
  // Pro Quadrant max 1 Behemoth
  const ring2ByQuadrant: typeof ring2[] = [[], [], [], []];
  for (const z of ring2) {
    const q = compassSector(Number(z.centroid_lat), Number(z.centroid_lng), apexLat, apexLng, 4);
    ring2ByQuadrant[q].push(z);
  }
  const behemothCamps: Array<Record<string, unknown>> = [];
  const hpPerCamp = 30_000 * bracket.crew_count;
  for (const q of ring2ByQuadrant) {
    if (behemothCamps.length >= 3) break;
    if (q.length === 0) continue;
    const z = q[0];
    behemothCamps.push({
      bracket_id,
      zone_id: z.id,
      spawned_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 14 * 86400000).toISOString(), // 14 Tage
      hp_total: hpPerCamp,
      hp_remaining: hpPerCamp,
      status: "active",
    });
  }
  if (behemothCamps.length > 0) {
    await sb.from("saga_mega_camps").insert(behemothCamps);
  }

  // Stats für Response
  const holyCount = inserts.filter((i) => i.is_holy_site === true).length;
  const gatherCount = inserts.filter((i) => i.is_gather_tile === true).length;
  const { count: wallsCount } = await sb.from("saga_camp_walls")
    .select("id", { count: "exact", head: true }).eq("bracket_id", bracket_id);

  return NextResponse.json({
    ok: true,
    bracket_id,
    city: city.name,
    zones_total: (zonesFinal ?? []).length,
    districts_from_osm: !usedFallback ? districts.length : null,
    used_hex_fallback: usedFallback,
    spawn_zones: spawns.length,
    crews_assigned: Math.min(bcrews?.length ?? 0, spawns.length),
    gates: gateInserts.length,
    gate_candidates_found: gateCandidates.length,
    sectors: sectorCount,
    holy_sites: holyCount,
    gather_tiles: gatherCount,
    behemoths: behemothCamps.length,
    camp_walls: wallsCount ?? 0,
  });
}
