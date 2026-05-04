import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/heimat/reinforce — Body: { defender_user_id, troops, guardian_id? } */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json() as {
    defender_user_id?: string;
    troops?: Record<string, number>;
    guardian_id?: string | null;
  };
  if (!body.defender_user_id || !body.troops) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }

  const { data, error } = await sb.rpc("send_base_reinforcement", {
    p_defender_user_id: body.defender_user_id,
    p_troops: body.troops,
    p_guardian_id: body.guardian_id ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
