import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/crews/turf/attack
 * Body: { repeater_id: string, troops: Record<string, number> }
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = (await req.json()) as { repeater_id?: string; troops?: Record<string, number> };
  if (!body.repeater_id || !body.troops) return NextResponse.json({ error: "missing_params" }, { status: 400 });

  const { data, error } = await sb.rpc("attack_crew_repeater", {
    p_repeater_id: body.repeater_id,
    p_troops: body.troops,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
