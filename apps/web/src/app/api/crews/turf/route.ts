import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/crews/turf?bbox=minLat,minLng,maxLat,maxLng
 * → Repeater-Pins + Turf-Polygons im Sichtbereich.
 */
export async function GET(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const url = new URL(req.url);
  const bbox = url.searchParams.get("bbox") ?? "";
  const parts = bbox.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
    return NextResponse.json({ error: "bad_bbox" }, { status: 400 });
  }
  const [minLat, minLng, maxLat, maxLng] = parts;

  const [reps, turf, blocks, summary] = await Promise.all([
    sb.rpc("get_crew_repeaters_in_bbox", {
      p_min_lat: minLat, p_min_lng: minLng, p_max_lat: maxLat, p_max_lng: maxLng,
    }),
    sb.rpc("get_crew_turf_polygons", {
      p_min_lat: minLat, p_min_lng: minLng, p_max_lat: maxLat, p_max_lng: maxLng,
    }),
    // Phase 3: Block-Turf — leer wenn city_blocks-Tabelle noch nicht ETL'd wurde
    sb.rpc("get_crew_blocks_in_bbox", {
      p_min_lat: minLat, p_min_lng: minLng, p_max_lat: maxLat, p_max_lng: maxLng,
    }),
    sb.rpc("my_crew_repeater_summary"),
  ]);

  return NextResponse.json({
    repeaters: reps.data ?? [],
    turf: turf.data ?? [],
    blocks: blocks.data ?? [],
    summary: summary.data ?? null,
  });
}

/**
 * POST /api/crews/turf
 * Body: { lat, lng, kind?: 'hq'|'repeater'|'mega', label?: string }
 * → place_crew_repeater
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = (await req.json()) as { lat?: number; lng?: number; kind?: string; label?: string };
  if (typeof body.lat !== "number" || typeof body.lng !== "number") {
    return NextResponse.json({ error: "missing_coords" }, { status: 400 });
  }
  const { data, error } = await sb.rpc("place_crew_repeater", {
    p_lat: body.lat,
    p_lng: body.lng,
    p_kind: body.kind ?? "repeater",
    p_label: body.label ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
