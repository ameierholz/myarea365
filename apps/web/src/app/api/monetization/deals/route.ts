import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/monetization/deals
 * Liefert alle aktiven Deals + (wenn eingeloggt) den User-Progress.
 */
export async function GET() {
  const sb = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const isoWeek = (() => {
    const d = new Date();
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + yearStart.getUTCDay() + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
  })();

  const [seasonalRes, thresholdsRes, themedRes, tiersRes, dailyRes, bpSeasonRes, subsRes, userRes] = await Promise.all([
    sb.from("monetization_seasonal_packs").select("*").eq("active", true).order("starts_at", { ascending: false }).limit(1),
    sb.from("monetization_gem_thresholds").select("*").order("sort"),
    sb.from("monetization_themed_packs").select("*").eq("active", true).order("sort"),
    sb.from("monetization_gem_tiers").select("*").eq("active", true).order("sort"),
    sb.from("monetization_daily_deals").select("*").eq("deal_date", today).order("slot"),
    sb.from("monetization_battle_pass_seasons").select("*").eq("active", true).limit(1),
    sb.from("monetization_subscriptions").select("*").eq("active", true).order("sort"),
    sb.auth.getUser(),
  ]);

  const userId = userRes.data.user?.id ?? null;
  let progress: Record<string, unknown> = {};
  if (userId) {
    const [thresholdProg, themedToday, dailyClaimed, bpProg, subStatus] = await Promise.all([
      sb.from("monetization_gem_threshold_progress").select("*").eq("user_id", userId).eq("week_iso", isoWeek).maybeSingle(),
      sb.from("monetization_themed_pack_purchases").select("pack_id, purchased_at").eq("user_id", userId).gte("purchased_at", `${today}T00:00:00Z`),
      sb.from("monetization_daily_deal_purchases").select("deal_id").eq("user_id", userId),
      sb.from("monetization_battle_pass_progress").select("*").eq("user_id", userId).maybeSingle(),
      sb.from("monetization_subscription_status").select("*").eq("user_id", userId).maybeSingle(),
    ]);
    progress = {
      gem_threshold: thresholdProg.data,
      themed_purchased_today: (themedToday.data ?? []).map((r) => r.pack_id),
      daily_purchased: (dailyClaimed.data ?? []).map((r) => r.deal_id),
      battle_pass: bpProg.data,
      subscription: subStatus.data,
    };
  }

  return NextResponse.json({
    seasonal:    seasonalRes.data?.[0] ?? null,
    thresholds:  thresholdsRes.data ?? [],
    themed:      themedRes.data ?? [],
    tiers:       tiersRes.data ?? [],
    daily:       dailyRes.data ?? [],
    battle_pass_season: bpSeasonRes.data?.[0] ?? null,
    subscriptions: subsRes.data ?? [],
    progress,
    week_iso: isoWeek,
  });
}
