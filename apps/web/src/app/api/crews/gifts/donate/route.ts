import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_COST = 200;

/** POST /api/crews/gifts/donate
 *  Body: { cost?: number }
 *  Member zahlt Diamanten → erzeugt Rare-Crew-Gift für alle Members.
 */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  let body: { cost?: number } = {};
  try { body = await req.json() as { cost?: number }; } catch { /* noop */ }
  const cost = typeof body.cost === "number" && Number.isFinite(body.cost) ? Math.floor(body.cost) : DEFAULT_COST;

  const { data, error } = await sb.rpc("donate_crew_gift", { p_cost: cost });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data ?? {});
}
