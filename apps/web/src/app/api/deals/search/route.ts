import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const revalidate = 30;  // Edge-Cache 30s — Filter-Queries sind teuer

const SORTS = new Set(["distance", "price_asc", "popular", "newest"]);

/**
 * GET /api/deals/search?country=DE&state=Berlin&city=Berlin&zip=10965&category=Café&lat=&lng=&radius_km=5&q=cappuccino&sort=distance&limit=50&offset=0
 */
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;

  const params = {
    p_country:    sp.get("country") || null,
    p_state:      sp.get("state") || null,
    p_city:       sp.get("city") || null,
    p_zip:        sp.get("zip") || null,
    p_category:   sp.get("category") || null,
    p_lat:        sp.get("lat") ? Number(sp.get("lat")) : null,
    p_lng:        sp.get("lng") ? Number(sp.get("lng")) : null,
    p_radius_km:  sp.get("radius_km") ? Number(sp.get("radius_km")) : null,
    p_q:          sp.get("q") || null,
    p_sort:       SORTS.has(sp.get("sort") ?? "") ? sp.get("sort") : "distance",
    p_limit:      Math.min(100, Math.max(1, Number(sp.get("limit") ?? 50))),
    p_offset:     Math.max(0, Number(sp.get("offset") ?? 0)),
  };

  const sb = await createClient();
  const { data, error } = await sb.rpc("search_deals", params);
  if (error) return NextResponse.json({ deals: [], error: error.message }, { status: 500 });

  return NextResponse.json({ deals: data ?? [] });
}
