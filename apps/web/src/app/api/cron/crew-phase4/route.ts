import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vercel-Cron (stündlich): Crew Phase-4 Ticks.
 *   1. tick_blackmarket_income     — passive Income in crew_treasury
 *   2. tick_end_due_crew_wars      — abgelaufene Kriege beenden + Winner
 *   3. tick_siege_repeater_attacks — Belagerungs-Repeater feuern auf Bases
 *
 * Auth: Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "supabase_env_missing" }, { status: 500 });

  const sb = createAdminClient(url, key, { auth: { persistSession: false } });
  const [{ data: income }, { data: wars }, { data: sieges }] = await Promise.all([
    sb.rpc("tick_blackmarket_income"),
    sb.rpc("tick_end_due_crew_wars"),
    sb.rpc("tick_siege_repeater_attacks"),
  ]);
  return NextResponse.json({
    ok: true,
    blackmarkets_ticked: income ?? 0,
    wars_ended: wars ?? 0,
    siege_attacks_fired: sieges ?? 0,
  });
}
