import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/mutant/active?bbox=south,west,north,east
 *
 * Liefert alle aktiven Mutanten (status='walking') innerhalb der BBox.
 * route_geom wird als GeoJSON-LineString zurückgegeben (für Walker-Variante);
 * static-Mutanten haben route_geom=NULL und werden über origin_lat/lng verortet.
 */
export async function GET(req: Request) {
  const sb = await createClient();
  const url = new URL(req.url);
  const bboxParam = url.searchParams.get("bbox");

  // Default: ganze Welt — verhindert dass der Client bei jedem Pan/Zoom eine
  // neue bbox schickt und Mutanten ausserhalb der Viewport-bbox aus dem Cache
  // entfernt werden (→ Springen-Effekt). Bei 1350 Mutanten ist der Payload
  // ueberschaubar, Mapbox cullt visuell nativ ohne dass wir DOM-Marker
  // entfernen muessen.
  let south = -90, west = -180, north = 90, east = 180;

  if (bboxParam) {
    const parts = bboxParam.split(",").map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      [south, west, north, east] = parts;
    }
  }

  const { data, error } = await sb.rpc("mutants_in_bbox", {
    p_south: south, p_west: west, p_north: north, p_east: east,
  });
  if (error) {
    // Fallback: einfacher Centroid-Filter ohne PostGIS, langsamer aber portabler
    const fb = await sb
      .from("mutants")
      .select("id, city_slug, npc_kind, spawn_terrain, origin_lat, origin_lng, target_lat, target_lng, started_at, finishes_at, status, loot_tier, hp, troop_count")
      .eq("status", "walking")
      .gte("origin_lat", south).lte("origin_lat", north)
      .gte("origin_lng", west).lte("origin_lng", east)
      .order("started_at", { ascending: false })
      .limit(500);
    return NextResponse.json({ mutants: fb.data ?? [], fallback: true });
  }

  return NextResponse.json({ mutants: data ?? [] });
}
