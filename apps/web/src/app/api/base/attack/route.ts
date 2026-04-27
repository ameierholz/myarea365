import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/base/attack
 * Body: { defender_user_id: string; troops: Record<string, number> }
 * → ruft RPC attack_player_base auf, sperrt Truppen, legt March an.
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = (await req.json()) as { defender_user_id?: string; troops?: Record<string, number> };
  if (!body.defender_user_id || !body.troops) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }

  const { data, error } = await sb.rpc("attack_player_base", {
    p_defender_user_id: body.defender_user_id,
    p_troops: body.troops,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** GET /api/base/attack → laufende + letzte 10 Angriffe (in/out) */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const { data, error } = await sb
    .from("player_base_attacks")
    .select("*")
    .or(`attacker_user_id.eq.${user.id},defender_user_id.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ attacks: data ?? [] });
}
