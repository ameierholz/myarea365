import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/city-blocks?bbox=minLat,minLng,maxLat,maxLng
 * → Alle Stadt-Blocks im Sichtbereich (id + GeoJSON-Geometry + street_class).
 * Wird im Repeater-Placement-Mode genutzt um die Block-Grenzen zu zeichnen
 * und den Block unter dem Cursor zu highlighten.
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

  const { data, error } = await sb.rpc("get_city_blocks_in_bbox", {
    p_min_lat: minLat, p_min_lng: minLng, p_max_lat: maxLat, p_max_lng: maxLng,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ blocks: data ?? [] });
}
