import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { bboxOf, fetchHighwaysInBBox } from "@/lib/overpass";
import { matchWaysToTrace, type LngLat } from "@/lib/geo-matching";
import { detectPolygonFromWalk, centroidOf, pointInPolygon } from "@/lib/polygon-detect";
import { findNewCycles } from "@/lib/polygon-graph";
import { polygonAreaM2 } from "@/lib/polygon-detect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/walk/segments
 * Body: { trace: Array<{lat,lng}>, walk_id?: string }
 *
 * Matcht GPS-Trace gegen OSM-Ways via Overpass, speichert NEUE Segmente
 * in street_segments (Unique-Constraint dedupliziert automatisch) und gibt
 * die neu beanspruchten Segmente + aggregierte Zaehler zurueck.
 */
export async function POST(req: Request) {
  let body: { trace: LngLat[]; walk_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { trace, walk_id } = body;
  if (!Array.isArray(trace) || trace.length < 2) {
    return NextResponse.json({ error: "trace required (>=2 points)" }, { status: 400 });
  }

  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = auth.user.id;

  // Crew des Users fuer Territorium-Besitz
  const { data: profile } = await sb.from("users")
    .select("current_crew_id")
    .eq("id", userId)
    .single<{ current_crew_id: string | null }>();
  const crewId = profile?.current_crew_id ?? null;

  // 1) OSM-Highways im Bounding-Box holen
  const bbox = bboxOf(trace);
  let ways;
  try {
    ways = await fetchHighwaysInBBox(bbox);
  } catch (e) {
    return NextResponse.json({ error: "overpass_failed", detail: String(e) }, { status: 502 });
  }

  // 2) Matching: welche Ways wurden gelaufen?
  const matched = matchWaysToTrace(ways, trace, 25, 0.6);
  if (matched.length === 0) {
    return NextResponse.json({ new_segments: [], total_new: 0, total_length_m: 0 });
  }

  // 3) Einfuegen — Unique-Constraint (user_id, osm_way_id, segment_index=0)
  //    verhindert Doppelclaims. Wir koennen alle einfuegen, nur neue landen.
  const rows = matched.map((w) => ({
    user_id: userId,
    crew_id: crewId,
    osm_way_id: w.osm_way_id,
    segment_index: 0,
    street_name: w.street_name,
    geom: w.nodes,
    length_m: w.length_m,
    walk_id: walk_id ?? null,
    xp_awarded: 50,
  }));

  const { data: inserted, error } = await sb
    .from("street_segments")
    .upsert(rows, { onConflict: "user_id,osm_way_id,segment_index", ignoreDuplicates: true })
    .select("id, osm_way_id, street_name, length_m");

  if (error) {
    return NextResponse.json({ error: "insert_failed", detail: error.message }, { status: 500 });
  }

  const newSegments = inserted ?? [];
  const totalLength = newSegments.reduce((s, r) => s + (r.length_m ?? 0), 0);

  // Reclaim-XP: Ways die vom User schon beansprucht waren, bekommen zeit-abhängigen Bonus.
  const newWayIds = new Set(newSegments.map((s) => s.osm_way_id));
  const reclaimWayIds = matched
    .map((m) => m.osm_way_id)
    .filter((id) => !newWayIds.has(id));
  let reclaimSummary: { reclaim_count: number; reclaim_xp: number; segments_cooldown: number } | null = null;
  if (reclaimWayIds.length > 0) {
    const { data: reclaimRes } = await sb.rpc("process_segment_reclaims", {
      p_user_id: userId,
      p_osm_way_ids: reclaimWayIds,
    });
    if (Array.isArray(reclaimRes) && reclaimRes[0]) {
      reclaimSummary = reclaimRes[0] as typeof reclaimSummary;
    }
  }

  // Phase 3: Strassenzug-Detection.
  // Fuer jede Strasse mit neu beanspruchten Segmenten pruefen ob alle Ways dieser Strasse
  // (die Overpass im Walk-BBox geliefert hat) vom User beansprucht sind.
  const newStreetNames = new Set<string>();
  for (const s of newSegments) if (s.street_name) newStreetNames.add(s.street_name);

  const newlyClaimedStreets: Array<{ street_name: string; segments_count: number; total_length_m: number }> = [];

  if (newStreetNames.size > 0) {
    const waysByStreet = new Map<string, typeof matched>();
    for (const m of matched) {
      if (!m.street_name) continue;
      if (!newStreetNames.has(m.street_name)) continue;
      const arr = waysByStreet.get(m.street_name) ?? [];
      arr.push(m);
      waysByStreet.set(m.street_name, arr);
    }
    // Alle im BBox existierenden Ways pro Strasse (auch nicht-gelaufene!) — dafuer alle Overpass-Ways heranziehen
    const allWaysByStreet = new Map<string, number[]>();
    for (const w of ways) {
      if (!w.name || !newStreetNames.has(w.name)) continue;
      const arr = allWaysByStreet.get(w.name) ?? [];
      arr.push(w.id);
      allWaysByStreet.set(w.name, arr);
    }

    for (const streetName of newStreetNames) {
      // Pruefen ob streets_claimed bereits existiert
      const { data: already } = await sb.from("streets_claimed")
        .select("id").eq("user_id", userId).eq("street_name", streetName).maybeSingle();
      if (already) continue;

      const bboxWays = allWaysByStreet.get(streetName) ?? [];
      if (bboxWays.length < 1) continue;

      // Wieviele dieser Ways hat der User insgesamt schon beansprucht?
      const { data: claimedRows } = await sb.from("street_segments")
        .select("osm_way_id")
        .eq("user_id", userId)
        .eq("street_name", streetName);
      const claimedIds = new Set((claimedRows ?? []).map((r: { osm_way_id: number }) => r.osm_way_id));

      const allCovered = bboxWays.every((id) => claimedIds.has(id));
      if (!allCovered) continue;

      const segCount = bboxWays.length;
      const lenM = Math.round(
        bboxWays.reduce((s, id) => {
          const w = ways.find((x) => x.id === id);
          if (!w) return s;
          let dist = 0;
          for (let i = 0; i < w.nodes.length - 1; i++) {
            const a = w.nodes[i], b = w.nodes[i + 1];
            const dLat = (b.lat - a.lat) * Math.PI / 180;
            const dLng = (b.lng - a.lng) * Math.PI / 180;
            const lat0 = (a.lat + b.lat) / 2 * Math.PI / 180;
            const x = dLng * Math.cos(lat0) * 6371000;
            const y = dLat * 6371000;
            dist += Math.hypot(x, y);
          }
          return s + dist;
        }, 0)
      );

      const { error: streetErr } = await sb.from("streets_claimed").insert({
        user_id: userId,
        crew_id: crewId,
        street_name: streetName,
        segments_count: segCount,
        total_length_m: lenM,
        walk_id: walk_id ?? null,
        xp_awarded: 250,
      });
      if (!streetErr) {
        newlyClaimedStreets.push({ street_name: streetName, segments_count: segCount, total_length_m: lenM });
      }
    }
  }

  // Phase 4 V1: Einzelwalk-Loop (Trace selbst schliesst sich)
  const matchedStreetNames = matched
    .map((m) => m.street_name)
    .filter((n): n is string => !!n);
  const detected = detectPolygonFromWalk(trace, matchedStreetNames);

  // Phase 4 V2: Graph-Cycle ueber ALLE Segmente des Users.
  // Liest alle Segmente des Users, baut Graph, findet neue Zyklen die durch die
  // neu eingefuegten Segmente geschlossen werden.
  type AllSeg = { id: string; geom: LngLat[] };
  const { data: allSegs } = await sb.from("street_segments")
    .select("id, geom")
    .eq("user_id", userId)
    .returns<AllSeg[]>();
  const newIdSet = new Set(newSegments.map((s) => s.id));

  // Bereits existierende Polygon-Segment-Sets (damit wir nicht duplizieren)
  const { data: existingPolys } = await sb.from("territory_polygons")
    .select("segment_ids")
    .eq("claimed_by_user_id", userId)
    .returns<Array<{ segment_ids: string[] }>>();
  const existingSets = (existingPolys ?? []).map((p) => p.segment_ids);

  const v2Cycles = findNewCycles(allSegs ?? [], newIdSet, existingSets);

  // Aktive Polygone fuer Overlap-Check (inkl. fremder Nutzer/Crews)
  const { data: activeTerritories } = await sb.from("territory_polygons")
    .select("id, polygon, owner_user_id, owner_crew_id")
    .eq("status", "active")
    .returns<Array<{ id: string; polygon: LngLat[]; owner_user_id: string | null; owner_crew_id: string | null }>>();

  const createdTerritories: Array<{ id: string; area_m2: number; stole_from: boolean; pending_crew: boolean }> = [];

  async function insertPolygon(polygon: LngLat[], segmentIds: string[]) {
    const area = polygonAreaM2(polygon);
    if (area < 500) return;
    const center = centroidOf(polygon);

    // Steal-Check: ueberlappt das neue Polygon ein aktives?
    let stoleFromUserId: string | null = null;
    let stoleFromCrewId: string | null = null;
    const toMarkStolen: string[] = [];
    for (const t of activeTerritories ?? []) {
      if (!Array.isArray(t.polygon) || t.polygon.length < 3) continue;
      const otherCentroid = centroidOf(t.polygon);
      if (pointInPolygon(center, t.polygon) || pointInPolygon(otherCentroid, polygon)) {
        // Nur stehlen wenn ANDERER Besitzer
        const sameUser = t.owner_user_id === userId;
        const sameCrew = crewId && t.owner_crew_id === crewId;
        if (sameUser || sameCrew) continue;
        toMarkStolen.push(t.id);
        stoleFromUserId = t.owner_user_id;
        stoleFromCrewId = t.owner_crew_id;
      }
    }

    let perimeter = 0;
    for (let i = 0; i < polygon.length - 1; i++) {
      const a = polygon[i], b = polygon[i + 1];
      const dLat = (b.lat - a.lat) * Math.PI / 180;
      const dLng = (b.lng - a.lng) * Math.PI / 180;
      const lat0 = (a.lat + b.lat) / 2 * Math.PI / 180;
      const x = dLng * Math.cos(lat0) * 6371000;
      const y = dLat * 6371000;
      perimeter += Math.hypot(x, y);
    }

    // Crew-Pflicht: Solo-Runner bekommen das Polygon als "pending_crew" (sichtbar ohne XP).
    // Beim Crew-Beitritt wird via RPC promote_pending_territories() auf 'active' upgegradet.
    const isPending = !crewId;
    const { data: terr, error: terrErr } = await sb.from("territory_polygons").insert({
      owner_user_id: isPending ? null : userId,
      owner_crew_id: crewId,
      polygon,
      area_m2: Math.round(area),
      perimeter_m: Math.round(perimeter),
      segment_ids: segmentIds,
      walk_id: walk_id ?? null,
      claimed_by_user_id: userId,
      xp_awarded: isPending ? 0 : 500,
      status: isPending ? "pending_crew" : "active",
      stolen_from_user_id: stoleFromUserId,
      stolen_from_crew_id: stoleFromCrewId,
      stolen_at: toMarkStolen.length > 0 ? new Date().toISOString() : null,
    }).select("id, area_m2").single<{ id: string; area_m2: number }>();

    if (terrErr || !terr) return;

    // Alte ueberlappende Polygone deaktivieren
    if (toMarkStolen.length > 0) {
      await sb.from("territory_polygons")
        .update({ status: "stolen", stolen_at: new Date().toISOString() })
        .in("id", toMarkStolen);
    }

    createdTerritories.push({ id: terr.id, area_m2: terr.area_m2, stole_from: toMarkStolen.length > 0, pending_crew: isPending });
  }

  // V1 zuerst (nur wenn V2 nichts lieferte)
  if (detected && v2Cycles.length === 0) {
    await insertPolygon(detected.polygon, newSegments.map((s) => s.id));
  }
  // V2 Zyklen
  for (const c of v2Cycles) {
    await insertPolygon(c.polygon, c.segment_ids);
  }

  return NextResponse.json({
    new_segments: newSegments,
    total_new: newSegments.length,
    total_length_m: totalLength,
    matched_total: matched.length,
    newly_claimed_streets: newlyClaimedStreets,
    new_territory: createdTerritories[0] ?? null, // Backcompat
    new_territories: createdTerritories,
    reclaim: reclaimSummary,
  });
}
