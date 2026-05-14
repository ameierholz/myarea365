import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const revalidate = 3600;

/**
 * GET /api/specialty-catalog
 *   → Liefert den Wächter-Wetter-Specialty-Catalog (6 Optionen).
 *     Public-Read, leichtgewichtig, lange cachbar.
 */
export async function GET() {
  const sb = await createClient();
  const { data, error } = await sb
    .from("guardian_weather_specialties")
    .select("code, label, emoji, weather, description")
    .order("code");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, options: data ?? [] });
}
