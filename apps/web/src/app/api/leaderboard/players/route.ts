import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const revalidate = 60;

/**
 * GET /api/leaderboard/players?metric=level|xp|ansehen|bandits_killed|members_killed&faction=gossenbund|kronenwacht|netzhueter
 *
 * Top-100 Spieler nach CvC-Metrik. Optional gefiltert nach Wächter-Fraktion.
 * Privacy-Filter: nur Profile mit `privacy_leaderboard != false` und `is_banned = false`.
 */
export async function GET(req: Request) {
  const sb = await createClient();
  const url = new URL(req.url);
  const metric = url.searchParams.get("metric") || "level";
  const faction = url.searchParams.get("faction");

  const orderCol =
      metric === "xp"             ? "xp"
    : metric === "ansehen"        ? "ansehen"
    : metric === "bandits_killed" ? "bandits_killed"
    : metric === "members_killed" ? "members_killed"
    :                               "level";

  let q = sb.from("users")
    .select("username, display_name, guardian_faction, level, xp, ansehen, bandits_killed, members_killed")
    .neq("privacy_leaderboard", false)
    .neq("is_banned", true)
    .not("username", "is", null)
    .order(orderCol, { ascending: false })
    .limit(100);

  if (faction === "gossenbund" || faction === "kronenwacht" || faction === "netzhueter") {
    q = q.eq("guardian_faction", faction);
  }

  const { data } = await q;
  return NextResponse.json({ players: data ?? [] });
}
