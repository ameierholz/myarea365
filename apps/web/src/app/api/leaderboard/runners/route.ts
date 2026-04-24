import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const revalidate = 60;

/**
 * GET /api/leaderboard/runners?metric=wegemuenzen|gebietsruf|sessionehre|km|walks|level
 * Top-Runner nach ausgewählter Metrik.
 * Legacy: metric=xp wird auf wegemuenzen gemappt.
 */
export async function GET(req: Request) {
  const sb = await createClient();
  const url = new URL(req.url);
  const metric = url.searchParams.get("metric") || "wegemuenzen";
  const faction = url.searchParams.get("faction");

  const orderCol =
      metric === "km"          ? "total_distance_m"
    : metric === "walks"       ? "total_walks"
    : metric === "level"       ? "level"
    : metric === "gebietsruf"  ? "gebietsruf"
    : metric === "sessionehre" ? "sessionehre"
    :                            "wegemuenzen";

  let q = sb.from("v_public_profiles")
    .select("username, display_name, faction, total_distance_m, total_walks, total_xp, wegemuenzen, gebietsruf, sessionehre, level")
    .order(orderCol, { ascending: false })
    .limit(100);

  if (faction === "syndicate" || faction === "vanguard" || faction === "kronenwacht" || faction === "gossenbund") q = q.eq("faction", faction);

  const { data } = await q;
  return NextResponse.json({ runners: data ?? [] });
}
