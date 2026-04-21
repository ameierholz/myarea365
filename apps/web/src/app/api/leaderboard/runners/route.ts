import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/leaderboard/runners?metric=xp|km|walks|level
 * Top-Runner nach ausgewählter Metrik.
 */
export async function GET(req: Request) {
  const sb = await createClient();
  const url = new URL(req.url);
  const metric = url.searchParams.get("metric") || "xp";
  const faction = url.searchParams.get("faction");

  const orderCol = metric === "km" ? "total_distance_m"
                  : metric === "walks" ? "total_walks"
                  : metric === "level" ? "level"
                  : "total_xp";

  let q = sb.from("v_public_profiles")
    .select("username, display_name, faction, total_distance_m, total_walks, total_xp, level")
    .order(orderCol, { ascending: false })
    .limit(100);

  if (faction === "syndicate" || faction === "vanguard") q = q.eq("faction", faction);

  const { data } = await q;
  return NextResponse.json({ runners: data ?? [] });
}
