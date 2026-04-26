import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/crew/base/position
 * Body: { lat: number, lng: number }
 * Nur Crew-Lead (owner/admin) darf platzieren.
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = (await req.json()) as { lat?: number; lng?: number };
  if (typeof body.lat !== "number" || typeof body.lng !== "number") {
    return NextResponse.json({ error: "invalid_position" }, { status: 400 });
  }

  const { data, error } = await sb.rpc("set_crew_base_position", { p_lat: body.lat, p_lng: body.lng });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
