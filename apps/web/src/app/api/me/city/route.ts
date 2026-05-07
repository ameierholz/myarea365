import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/me/city — Heimat-Stadt + Map-Bounds des eingeloggten Users.
 *
 * Liefert die Stadt-Konfiguration aus `cities` basierend auf `users.home_city_slug`.
 * Das ist die Map-Bounding-Box die der User auf seiner Heimat-Karte sehen darf.
 *
 * Response:
 *   {
 *     city: {
 *       slug, name, bounds: [[swLng,swLat],[neLng,neLat]],
 *       center: [lng, lat], default_zoom, min_zoom, max_zoom,
 *     } | null,    // null wenn User noch keine PLZ → city zugeordnet hat
 *   }
 */
export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // 1) home_city_slug des Users laden
  const { data: u } = await sb
    .from("users")
    .select("home_city_slug")
    .eq("id", auth.user.id)
    .maybeSingle();

  const slug = (u as { home_city_slug?: string | null } | null)?.home_city_slug;
  if (!slug) return NextResponse.json({ city: null });

  // 2) City-Config laden
  const { data: c, error } = await sb
    .from("cities")
    .select("slug, name, bounds_sw_lng, bounds_sw_lat, bounds_ne_lng, bounds_ne_lat, default_center_lng, default_center_lat, default_zoom, min_zoom, max_zoom, is_active")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !c) return NextResponse.json({ city: null });

  type Row = {
    slug: string; name: string;
    bounds_sw_lng: number; bounds_sw_lat: number;
    bounds_ne_lng: number; bounds_ne_lat: number;
    default_center_lng: number; default_center_lat: number;
    default_zoom: number; min_zoom: number; max_zoom: number;
  };
  const row = c as Row;

  return NextResponse.json({
    city: {
      slug: row.slug,
      name: row.name,
      bounds: [
        [row.bounds_sw_lng, row.bounds_sw_lat],
        [row.bounds_ne_lng, row.bounds_ne_lat],
      ] as [[number, number], [number, number]],
      center: [row.default_center_lng, row.default_center_lat] as [number, number],
      default_zoom: row.default_zoom,
      min_zoom: row.min_zoom,
      max_zoom: row.max_zoom,
    },
  });
}
