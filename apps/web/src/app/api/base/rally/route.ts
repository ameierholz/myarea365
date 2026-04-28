import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/base/rally
 * Body: { defender_user_id: string; troops: Record<string, number>; prep_seconds: number }
 * → start_player_base_rally — startet Crew-Aufgebot.
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = (await req.json()) as {
    defender_user_id?: string;
    troops?: Record<string, number>;
    prep_seconds?: number;
    guardian_id?: string | null;
  };
  if (!body.defender_user_id || !body.troops || !body.prep_seconds) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }

  const { data, error } = await sb.rpc("start_player_base_rally", {
    p_defender_user_id: body.defender_user_id,
    p_prep_seconds: body.prep_seconds,
    p_troops: body.troops,
    p_guardian_id: body.guardian_id ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** GET /api/base/rally → aktives Crew-Aufgebot des aktuellen Users (oder null) */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const { data, error } = await sb.rpc("get_active_player_base_rally");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rally: data });
}
