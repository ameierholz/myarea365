import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/saga/generate-map { bracket_id }
 *
 * Holt Quartier-Polygone (admin_level=10) + Brücken/Tunnel aus OSM via Overpass
 * für die Bracket-City. Erzeugt:
 *   - saga_zones (district + spawn + apex + gate)
 *   - saga_zone_adjacency (Polygon-Berührungen)
 *   - Crew-Spawn-Zuordnung
 *
 * Lange-laufende Operation (~30s pro Stadt). Vercel-Function-Timeout 60s.
 */
export const maxDuration = 60;

type LngLat = { lat: number; lng: number };
type ZoneSeed = {
  osm_id: number | null;
  name: string;
  centroid_lat: number;
  centroid_lng: number;
  polygon: number[][];
};

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

export async function POST(req: NextRequest) {
  await requireStaff();
  const sb = await createClient();
  const { bracket_id } = await req.json();
  if (!bracket_id) return NextResponse.json({ ok: false, error: "bracket_id required" }, { status: 400 });

  const { data: bracket } = await sb.from("saga_brackets")
    .select("id, city_slug, crew_count")
    .eq("id", bracket_id).single();
  if (!bracket) return NextResponse.json({ ok: false, error: "bracket_not_found" }, { status: 404 });

  // Bestehende Zonen löschen (Idempotenz)
  await sb.from("saga_zones").delete().eq("bracket_id", bracket_id);

  const { data: city } = await sb.from("saga_city_pool")
    .select("*").eq("slug", bracket.city_slug).single();
  if (!city) return NextResponse.json({ ok: false, error: "city_not_found" }, { status: 404 });

  // Overpass-Query: admin_level=10 (Quartier) + bridges/tunnels in Stadt-BBox
  const bbox = `${city.bbox_south},${city.bbox_west},${city.bbox_north},${city.bbox_east}`;
  const query = `
    [out:json][timeout:50];
    (
      relation["admin_level"="10"](${bbox});
      relation["admin_level"="9"](${bbox});
    );
    out geom;
  `;

  let osmJson: { elements?: Array<{ type: string; id: number; tags?: Record<string, string>; members?: Array<{ type: string; geometry?: Array<{ lat: number; lon: number }> }> }> };
  try {
    const r = await fetch(OVERPASS_URL, {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
    if (!r.ok) throw new Error(`Overpass ${r.status}`);
    osmJson = await r.json();
  } catch (e) {
    return NextResponse.json({ ok: false, error: "overpass_failed", detail: String(e) }, { status: 502 });
  }

  // Zonen aus OSM-Relations bauen
  const districts: ZoneSeed[] = [];
  for (const el of osmJson.elements ?? []) {
    if (el.type !== "relation" || !el.tags) continue;
    const name = el.tags.name ?? el.tags["name:de"] ?? `Quartier ${el.id}`;

    // Outer way der Multipolygon-Relation als Polygon
    const outer = (el.members ?? []).find((m) => m.type === "way" && m.geometry && m.geometry.length > 2);
    if (!outer?.geometry) continue;

    const polygon = outer.geometry.map((p) => [p.lat, p.lon]);
    if (polygon.length < 3) continue;

    const cLat = polygon.reduce((s, p) => s + p[0], 0) / polygon.length;
    const cLng = polygon.reduce((s, p) => s + p[1], 0) / polygon.length;

    districts.push({
      osm_id: el.id,
      name,
      centroid_lat: cLat,
      centroid_lng: cLng,
      polygon,
    });
  }

  // Fallback wenn keine admin_level=10 vorhanden: Hex-Grid
  if (districts.length < 8) {
    return NextResponse.json({
      ok: false,
      error: "insufficient_districts",
      found: districts.length,
      hint: "Stadt hat zu wenig Quartiere in OSM — bitte manuell oder Hex-Grid-Fallback nutzen.",
    }, { status: 422 });
  }

  // Ringe zuweisen: nach Distanz vom Apex sortieren
  const apexLat = Number(city.apex_lat);
  const apexLng = Number(city.apex_lng);
  const distFromApex = (z: ZoneSeed) =>
    Math.hypot(z.centroid_lat - apexLat, z.centroid_lng - apexLng);
  districts.sort((a, b) => distFromApex(a) - distFromApex(b));

  // Verteilung: ring 0 = 1 Apex, ring 1 = ~10%, ring 2 = ~25%, ring 3 = ~30%, ring 4 = ~35%
  const total = districts.length;
  const ringRanges: Array<{ ring: number; count: number }> = [
    { ring: 1, count: Math.max(2, Math.floor(total * 0.10)) },
    { ring: 2, count: Math.max(4, Math.floor(total * 0.25)) },
    { ring: 3, count: Math.max(6, Math.floor(total * 0.30)) },
    { ring: 4, count: total },  // Rest
  ];

  // Erste Zone = Apex
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
  });

  let cursor = 1;
  for (const r of ringRanges) {
    const slice = districts.slice(cursor, cursor + r.count);
    const isOuterRing = r.ring === 4;
    for (let i = 0; i < slice.length; i++) {
      const d = slice[i];
      // Spawn-Zonen am äußersten Ring (Crew-Anzahl zugewiesen via spawn_zone_id später)
      const isSpawn = isOuterRing && i < bracket.crew_count;
      inserts.push({
        bracket_id,
        osm_id: d.osm_id,
        name: d.name,
        zone_kind: isSpawn ? "spawn" : "district",
        ring: r.ring,
        centroid_lat: d.centroid_lat,
        centroid_lng: d.centroid_lng,
        polygon: d.polygon,
        resource_bonus_pct: r.ring === 1 ? 25 : r.ring === 2 ? 15 : r.ring === 3 ? 10 : 5,
        resource_kind: ["tech_schrott", "komponenten", "krypto", "bandbreite"][i % 4],
      });
    }
    cursor += r.count;
    if (cursor >= total) break;
  }

  const { data: insertedZones, error: insErr } = await sb.from("saga_zones")
    .insert(inserts).select("id, ring, zone_kind, centroid_lat, centroid_lng, polygon");
  if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });

  // Tor-Zonen zwischen den Ringen synthetisch erzeugen (1 Tor pro Ring-Übergang)
  // Vereinfacht: Tor liegt zwischen jedem Ring(N+1)-Quartier und seinem nächsten Ring(N)-Nachbar
  // Hier nur eine simple Demo-Variante: 3 globale Tor-Zonen zwischen Ring 4→3, 3→2, 2→1
  const ringMap = new Map<number, typeof insertedZones>();
  for (const z of insertedZones ?? []) {
    const arr = ringMap.get(z.ring) ?? [];
    arr.push(z);
    ringMap.set(z.ring, arr);
  }

  const gateInserts: Array<Record<string, unknown>> = [];
  for (let r = 4; r > 0; r--) {
    const inner = ringMap.get(r - 1) ?? [];
    const outer = ringMap.get(r) ?? [];
    if (inner.length === 0 || outer.length === 0) continue;

    // Pro innerer Zone: ein Tor zur nächsten äußeren Zone in der Nähe
    const cInner = inner[0];
    const cOuter = outer[0];
    const tLat = (Number(cInner.centroid_lat) + Number(cOuter.centroid_lat)) / 2;
    const tLng = (Number(cInner.centroid_lng) + Number(cOuter.centroid_lng)) / 2;

    gateInserts.push({
      bracket_id,
      osm_id: null,
      name: r === 4 ? "Stadtrand-Tor" : r === 3 ? "Ring-Brücke" : r === 2 ? "Innenstadt-Tunnel" : "Apex-Tor",
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
      gate_phase: 5 - r,  // ring 4→3 = phase 1, 3→2 = phase 2, 2→1 = phase 3, 1→0 = phase 4
      gate_state: "closed",
    });
  }

  if (gateInserts.length > 0) {
    await sb.from("saga_zones").insert(gateInserts);
  }

  // Crew-Spawn-Zuweisung: pro Bracket-Crew einer Spawn-Zone
  const spawns = (insertedZones ?? []).filter((z) => z.zone_kind === "spawn");
  const { data: bcrews } = await sb.from("saga_bracket_crews")
    .select("crew_id").eq("bracket_id", bracket_id);
  for (let i = 0; i < (bcrews ?? []).length && i < spawns.length; i++) {
    await sb.from("saga_bracket_crews")
      .update({ spawn_zone_id: spawns[i].id })
      .eq("bracket_id", bracket_id)
      .eq("crew_id", bcrews![i].crew_id);
    await sb.from("saga_zones")
      .update({ owner_crew_id: bcrews![i].crew_id })
      .eq("id", spawns[i].id);
  }

  // Adjacency: vereinfacht — Zonen mit Centroid-Distanz < threshold sind benachbart
  // Echte Polygon-Berührung wäre teurer, hier Centroid-Heuristik
  const allZones = (insertedZones ?? []).concat(
    gateInserts.map((g) => ({ ...g, id: undefined } as unknown as { id: string; ring: number; zone_kind: string; centroid_lat: number; centroid_lng: number; polygon: number[][] }))
  );

  // Re-fetch alle Zonen (inkl. gates)
  const { data: zonesFinal } = await sb.from("saga_zones")
    .select("id, ring, zone_kind, centroid_lat, centroid_lng")
    .eq("bracket_id", bracket_id);

  if (zonesFinal) {
    const adjPairs: Array<{ zone_a: string; zone_b: string; via_gate_zone: string | null }> = [];
    const threshold = 0.025; // ~2.5km Quartier-Mitten-Abstand
    for (let i = 0; i < zonesFinal.length; i++) {
      for (let j = i + 1; j < zonesFinal.length; j++) {
        const a = zonesFinal[i];
        const b = zonesFinal[j];
        if (a.zone_kind === "gate" && b.zone_kind === "gate") continue;
        const d = Math.hypot(Number(a.centroid_lat) - Number(b.centroid_lat), Number(a.centroid_lng) - Number(b.centroid_lng));
        if (d > threshold) continue;
        if (Math.abs(a.ring - b.ring) > 1) continue; // nur benachbarte Ringe
        // via_gate: wenn ringA != ringB, brauchts ein Tor in ring=min(a,b)
        let viaGate: string | null = null;
        if (a.ring !== b.ring) {
          const minRing = Math.min(a.ring, b.ring);
          const gate = zonesFinal.find((z) => z.zone_kind === "gate" && z.ring === minRing);
          viaGate = gate?.id ?? null;
        }
        adjPairs.push({ zone_a: a.id, zone_b: b.id, via_gate_zone: viaGate });
      }
    }
    if (adjPairs.length > 0) {
      await sb.from("saga_zone_adjacency").insert(adjPairs);
    }
  }

  return NextResponse.json({
    ok: true,
    bracket_id,
    city: city.name,
    zones_total: (zonesFinal ?? []).length,
    spawn_zones: spawns.length,
    crews_assigned: Math.min(bcrews?.length ?? 0, spawns.length),
    gates: gateInserts.length,
  });
}
