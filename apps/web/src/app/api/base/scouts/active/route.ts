import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/base/scouts/active
 * Liefert aktive Späher des Users. Tickt vorab den Lifecycle.
 */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ scouts: [] });

  const { data, error } = await sb.rpc("get_active_player_base_scouts");
  if (error) return NextResponse.json({ error: error.message, scouts: [] }, { status: 500 });
  const obj = data as { scouts?: unknown[] } | null;
  return NextResponse.json({ scouts: obj?.scouts ?? [] });
}
