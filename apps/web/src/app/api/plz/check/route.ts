import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/plz/check?plz=10827 — Prüft ob für eine PLZ ein aktiver Server existiert.
 * Public (für Sign-Up nutzbar bevor User authentifiziert ist).
 *
 * Response:
 *   {
 *     has_city: boolean,                                    // direkter Match gefunden
 *     city: { slug, name } | null,                          // bei Match
 *     suggestion: { slug, name, distance_km } | null,       // bei No-Match: nächste Stadt
 *   }
 */
export async function GET(req: NextRequest) {
  const plz = (req.nextUrl.searchParams.get("plz") || "").trim();
  if (!/^[0-9]{5}$/.test(plz)) {
    return NextResponse.json({
      has_city: false, city: null, suggestion: null, error: "invalid_plz",
    }, { status: 400 });
  }

  const sb = await createClient();
  const { data, error } = await sb.rpc("check_plz_city", { p_plz: plz });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Row = {
    has_city: boolean;
    city_slug: string | null; city_name: string | null;
    suggestion_slug: string | null; suggestion_name: string | null;
    suggestion_distance_km: number | null;
  };
  const row = (Array.isArray(data) ? data[0] : data) as Row | null;
  if (!row) return NextResponse.json({ has_city: false, city: null, suggestion: null });

  return NextResponse.json({
    has_city: row.has_city,
    city: row.has_city && row.city_slug ? {
      slug: row.city_slug, name: row.city_name ?? row.city_slug,
    } : null,
    suggestion: !row.has_city && row.suggestion_slug ? {
      slug: row.suggestion_slug,
      name: row.suggestion_name ?? row.suggestion_slug,
      distance_km: row.suggestion_distance_km,
    } : null,
  });
}
