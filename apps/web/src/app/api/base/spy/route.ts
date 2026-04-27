import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/base/spy
 * Body: { defender_user_id: string }
 * → ruft RPC spy_player_base auf, kostet 500 Gold, liefert Intel.
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = (await req.json()) as { defender_user_id?: string };
  if (!body.defender_user_id) {
    return NextResponse.json({ error: "missing_defender" }, { status: 400 });
  }

  const { data, error } = await sb.rpc("spy_player_base", {
    p_defender_user_id: body.defender_user_id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
