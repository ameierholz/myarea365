import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/me/weather-boost/activate
 *   Body: { itemCode: string }
 *   → Verbraucht 1× Wetter-Schutz-Item, aktiviert den entsprechenden Buff
 *     (Eintrag in user_weather_boosts). Bumpt Quest weather_boost_used.
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  let body: { itemCode?: string };
  try { body = await req.json(); } catch { body = {}; }
  const itemCode = body.itemCode?.trim();
  if (!itemCode) return NextResponse.json({ ok: false, error: "missing_item_code" }, { status: 400 });

  const { data, error } = await sb.rpc("activate_weather_boost", { p_item_code: itemCode });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (data && typeof data === "object" && (data as { ok?: boolean }).ok !== true) {
    return NextResponse.json(data, { status: 400 });
  }
  void sb.rpc("bump_quest_progress", { p_user_id: user.id, p_metric: "weather_boost_used", p_amount: 1 });
  return NextResponse.json(data);
}
