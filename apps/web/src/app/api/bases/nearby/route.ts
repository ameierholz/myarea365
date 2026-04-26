import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/bases/nearby?bbox=minLng,minLat,maxLng,maxLat
 * Liefert sichtbare Runner+Crew-Bases im Map-Viewport.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const bbox = url.searchParams.get("bbox");
  if (!bbox) return NextResponse.json({ error: "missing_bbox" }, { status: 400 });

  const parts = bbox.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
    return NextResponse.json({ error: "invalid_bbox" }, { status: 400 });
  }
  const [minLng, minLat, maxLng, maxLat] = parts;

  const sb = await createClient();
  const { data, error } = await sb.rpc("get_bases_in_bbox", {
    p_min_lat: minLat, p_min_lng: minLng,
    p_max_lat: maxLat, p_max_lng: maxLng,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
