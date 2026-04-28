import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/crews/turf/rally — start rally
 * Body: { repeater_id, prep_seconds, troops }
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = (await req.json()) as {
    repeater_id?: string;
    prep_seconds?: number;
    troops?: Record<string, number>;
  };
  if (!body.repeater_id || !body.prep_seconds || !body.troops) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }

  const { data, error } = await sb.rpc("start_crew_repeater_rally", {
    p_repeater_id: body.repeater_id,
    p_prep_seconds: body.prep_seconds,
    p_troops: body.troops,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
