import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/me/weather-effects
 *   → Single-Roundtrip-Bundle für UI: aktuelle Wetter-Condition, Tageszeit,
 *     alle Wirtschafts-/Bewegungs-Multipliers, aktive User-Boosts.
 */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  const [bundleRes, boostsRes] = await Promise.all([
    sb.rpc("get_weather_effects_bundle"),
    sb.from("user_weather_boosts")
      .select("effect, expires_at, value_pct")
      .eq("user_id", user.id)
      .gt("expires_at", new Date().toISOString()),
  ]);

  if (bundleRes.error) {
    return NextResponse.json({ ok: false, error: bundleRes.error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    bundle: bundleRes.data,
    activeBoosts: boostsRes.data ?? [],
  });
}
