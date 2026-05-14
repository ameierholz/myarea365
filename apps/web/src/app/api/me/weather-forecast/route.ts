import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/me/weather-forecast
 *   → 3-Tage-Wettervorhersage für die aktive Stadt des Users.
 *     Premium-User (premium_forecast_until > now) bekommen 5 Tage.
 *     Mock-Provider deterministisch, OpenWeatherMap-Hook via Edge-Function.
 */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  const [forecastRes, premiumRes] = await Promise.all([
    sb.rpc("get_user_forecast"),
    sb.rpc("has_premium_forecast"),
  ]);

  if (forecastRes.error) {
    return NextResponse.json({ ok: false, error: forecastRes.error.message }, { status: 500 });
  }

  const isPremium = premiumRes.data === true;
  const limit = isPremium ? 5 : 3;
  const days = (forecastRes.data ?? []).slice(0, limit);

  // Mark as forecast-checked for daily quest
  void sb.rpc("bump_quest_progress", { p_user_id: user.id, p_metric: "forecast_checked", p_amount: 1 });

  return NextResponse.json({ ok: true, days, isPremium, totalAvailable: forecastRes.data?.length ?? 0 });
}
