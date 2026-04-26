import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/base/position
 * Body: { lat: number, lng: number }
 * Setzt die Map-Position der eigenen Runner-Base und ermittelt
 * die Postleitzahl per Reverse-Geocoding (Nominatim).
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = (await req.json()) as { lat?: number; lng?: number };
  if (typeof body.lat !== "number" || typeof body.lng !== "number") {
    return NextResponse.json({ error: "invalid_position" }, { status: 400 });
  }

  const { data, error } = await sb.rpc("set_base_position", { p_lat: body.lat, p_lng: body.lng });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Reverse-Geocoding (Nominatim) — best effort, blockiert nicht den Erfolg
  let plz: string | null = null;
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${body.lat}&lon=${body.lng}&zoom=14&addressdetails=1`;
    const r = await fetch(url, {
      headers: { "User-Agent": "myarea365.de (contact: a.meierholz@gmail.com)", "Accept-Language": "de" },
      signal: AbortSignal.timeout(4000),
    });
    if (r.ok) {
      const j = await r.json() as { address?: { postcode?: string } };
      const code = j.address?.postcode?.trim();
      if (code) {
        plz = code;
        await sb.rpc("set_base_plz", { p_plz: code });
      }
    }
  } catch { /* PLZ ist optional — Position-Setzen war erfolgreich */ }

  return NextResponse.json({ ...data, plz });
}
