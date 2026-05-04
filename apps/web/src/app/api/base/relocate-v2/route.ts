import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/base/relocate-v2
 * Body: { lat: number; lng: number }
 *
 * Cooldown 24h, Kosten 50 Krypto, max. 5 km Radius.
 * Token-Modell entfällt (entkoppelt von /api/base/relocate).
 */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json() as { lat?: number; lng?: number };
  if (typeof body.lat !== "number" || typeof body.lng !== "number") {
    return NextResponse.json({ error: "invalid_position" }, { status: 400 });
  }

  const { data, error } = await sb.rpc("relocate_base_v2", {
    p_lat: body.lat,
    p_lng: body.lng,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
