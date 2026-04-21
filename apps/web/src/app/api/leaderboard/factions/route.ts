import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/leaderboard/factions
 * Aggregierte Stats je Fraktion (Nachtpuls/Sonnenwacht).
 */
export async function GET() {
  const sb = await createClient();

  const { data } = await sb.from("v_public_profiles")
    .select("faction, total_distance_m, total_xp, level");

  const agg = new Map<string, { runners: number; xp: number; distance_m: number; levels: number }>();
  for (const r of data ?? []) {
    const f = r.faction ?? "unaligned";
    const cur = agg.get(f) ?? { runners: 0, xp: 0, distance_m: 0, levels: 0 };
    cur.runners += 1;
    cur.xp += r.total_xp ?? 0;
    cur.distance_m += r.total_distance_m ?? 0;
    cur.levels += r.level ?? 0;
    agg.set(f, cur);
  }

  const factions = ["syndicate", "vanguard"].map((id) => {
    const a = agg.get(id) ?? { runners: 0, xp: 0, distance_m: 0, levels: 0 };
    return {
      id,
      name: id === "syndicate" ? "Nachtpuls" : "Sonnenwacht",
      emoji: id === "syndicate" ? "🌙" : "☀️",
      color: id === "syndicate" ? "#22D1C3" : "#FF6B4A",
      runners: a.runners,
      total_xp: a.xp,
      total_km: Math.round(a.distance_m / 1000),
      avg_level: a.runners > 0 ? Math.round(a.levels / a.runners) : 0,
    };
  });

  return NextResponse.json({ factions });
}
