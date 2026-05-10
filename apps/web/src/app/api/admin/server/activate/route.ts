import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/server/activate
 *  Body: { slug, name, bounds_sw_lng, bounds_sw_lat, bounds_ne_lng, bounds_ne_lat,
 *          center_lng, center_lat, plz_prefixes: string[], default_zoom?: number }
 */
export async function POST(req: Request) {
  await requireAdmin();
  const sb = await createClient();
  const b = await req.json() as {
    slug?: string; name?: string;
    bounds_sw_lng?: number; bounds_sw_lat?: number;
    bounds_ne_lng?: number; bounds_ne_lat?: number;
    center_lng?: number; center_lat?: number;
    plz_prefixes?: string[]; default_zoom?: number;
  };
  const need: Array<keyof typeof b> = ["slug","name","bounds_sw_lng","bounds_sw_lat","bounds_ne_lng","bounds_ne_lat","center_lng","center_lat"];
  for (const k of need) if (b[k] === undefined) return NextResponse.json({ ok: false, error: `missing_${String(k)}` }, { status: 400 });

  const { data, error } = await sb.rpc("activate_city_server", {
    p_slug: b.slug, p_name: b.name,
    p_bounds_sw_lng: b.bounds_sw_lng, p_bounds_sw_lat: b.bounds_sw_lat,
    p_bounds_ne_lng: b.bounds_ne_lng, p_bounds_ne_lat: b.bounds_ne_lat,
    p_center_lng: b.center_lng, p_center_lat: b.center_lat,
    p_plz_prefixes: b.plz_prefixes ?? [], p_default_zoom: b.default_zoom ?? 12,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
