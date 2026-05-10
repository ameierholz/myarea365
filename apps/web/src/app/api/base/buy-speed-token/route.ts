import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/base/buy-speed-token
 *
 * Kauft 1 Speed-Token für 2000 Krypto (Gems). Speed-Tokens sind Pflicht-RSS
 * für den finalen Sprung zur Max-Stufe (z.B. Lv 24 → 25), zusätzlich zu
 * den normalen Bau-Resourcen.
 */
export async function POST() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  const { data, error } = await sb.rpc("buy_speed_token");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const result = data as { ok?: boolean; error?: string; cost_gems?: number; gems_remaining?: number; need?: number; have?: number };
  if (!result?.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
