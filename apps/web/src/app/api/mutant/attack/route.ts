import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimitSmart, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/mutant/attack
 * Body: { mutant_id: number, troops: number, guardian_id?: string }
 *
 * Banditen-Style: Spieler schickt X Truppen + optional Wächter → Server
 * löst Kampf sofort über attack_mutant-RPC auf.
 *
 * Rate-Limit: 12 Attacks/min/User.
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const rl = await rateLimitSmart(`mutant-attack:${user.id}`, 12, 60_000);
  const limited = rateLimitResponse(rl);
  if (limited) return limited;

  let body: { mutant_id?: number; troops?: number; guardian_id?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const { mutant_id, troops, guardian_id } = body;
  if (typeof mutant_id !== "number" || typeof troops !== "number") {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }
  if (troops < 1) return NextResponse.json({ error: "troops_min_1" }, { status: 400 });

  const { data, error } = await sb.rpc("attack_mutant", {
    p_mutant_id: mutant_id,
    p_troops: troops,
    p_guardian_id: guardian_id ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? { ok: true });
}
