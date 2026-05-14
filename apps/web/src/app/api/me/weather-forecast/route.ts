import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/me/weather-forecast
 *   → 5-Tage-Wettervorhersage für die aktive Stadt des Users (gratis für alle).
 *     Mock-Provider deterministisch, OpenWeatherMap-Hook via Edge-Function.
 */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  const { data, error } = await sb.rpc("get_user_forecast");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const days = (data ?? []).slice(0, 5);

  void sb.rpc("bump_quest_progress", { p_user_id: user.id, p_metric: "forecast_checked", p_amount: 1 });

  return NextResponse.json({ ok: true, days });
}
