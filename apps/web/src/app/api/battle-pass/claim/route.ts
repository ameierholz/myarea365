import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST — Body: { season_id, level, track: "free"|"premium"|"premium_plus" } */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  const body = await req.json() as { season_id?: string; level?: number; track?: string };
  if (!body.season_id || typeof body.level !== "number" || !body.track) {
    return NextResponse.json({ ok: false, error: "missing_params" }, { status: 400 });
  }
  const { data, error } = await sb.rpc("claim_battle_pass_level", {
    p_season_id: body.season_id, p_level: body.level, p_track: body.track,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
