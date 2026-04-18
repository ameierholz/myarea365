import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { bboxOf, fetchHighwaysInBBox } from "@/lib/overpass";
import { matchWaysToTrace, type LngLat } from "@/lib/geo-matching";

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

  return NextResponse.json({
    new_segments: newSegments,
    total_new: newSegments.length,
    total_length_m: totalLength,
    matched_total: matched.length, // wieviele Ways gematcht wurden (inkl. bereits beanspruchter)
  });
}
