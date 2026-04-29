import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/resource-nodes/nearby?bbox=minLng,minLat,maxLng,maxLat
 * Liefert alle aktiven (nicht erschöpften) Resource-Nodes im BBox.
 */
export async function GET(req: Request) {
  const sb = await createClient();
  const url = new URL(req.url);
  const bboxStr = url.searchParams.get("bbox");
  if (!bboxStr) return NextResponse.json({ error: "bbox_required" }, { status: 400 });

  const [minLng, minLat, maxLng, maxLat] = bboxStr.split(",").map(Number);
  if ([minLng, minLat, maxLng, maxLat].some(Number.isNaN)) {
    return NextResponse.json({ error: "bbox_invalid" }, { status: 400 });
  }

  const { data, error } = await sb.from("resource_nodes")
    .select("id, kind, resource_type, name, lat, lng, level, total_yield, current_yield, depleted_at")
    .is("depleted_at", null)
    .gte("lat", minLat).lte("lat", maxLat)
    .gte("lng", minLng).lte("lng", maxLng)
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ nodes: data ?? [] });
}
