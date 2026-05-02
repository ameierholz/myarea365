import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/crew/synergy
 * Liefert Crew-Aktivitäts-Synergie: aktive Mitglieder in 24h → XP-Buff,
 * inaktive Mitglieder werden namentlich gelistet.
 */
export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await sb.rpc("get_crew_synergy");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
