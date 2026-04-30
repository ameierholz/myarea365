import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/crews/turf/rally/active
 * Liefert aktive Crew-Repeater-Rallies des aktuellen Users
 * (Angreifer ODER Verteidiger). Tickt vorab den Lifecycle.
 */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ rallies: [] });

  const { data, error } = await sb.rpc("get_active_crew_repeater_rallies");
  if (error) {
    return NextResponse.json({ error: error.message, rallies: [] }, { status: 500 });
  }
  const obj = data as { rallies?: unknown[] } | null;
  return NextResponse.json({ rallies: obj?.rallies ?? [] });
}
