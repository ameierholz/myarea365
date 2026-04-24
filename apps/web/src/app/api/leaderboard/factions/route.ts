import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const revalidate = 60;

/**
 * GET /api/leaderboard/factions
 * Aggregierte Stats je Fraktion (Gossenbund/Kronenwacht).
 * DB-Werte sind heute 'gossenbund'/'kronenwacht'; aelterer Kunden mit
 * Legacy 'syndicate'/'vanguard' bleiben rueckwaerts kompatibel.
 */
export async function GET() {
  const sb = await createClient();

  const { data } = await sb.from("v_public_profiles")
    .select("faction, total_distance_m, total_xp, level");

  const agg = new Map<"gossenbund" | "kronenwacht", { runners: number; xp: number; distance_m: number; levels: number }>();
  agg.set("gossenbund",  { runners: 0, xp: 0, distance_m: 0, levels: 0 });
  agg.set("kronenwacht", { runners: 0, xp: 0, distance_m: 0, levels: 0 });
  for (const r of data ?? []) {
    const raw = (r.faction ?? "").toLowerCase();
    const bucket: "gossenbund" | "kronenwacht" | null =
      raw === "gossenbund" || raw === "syndicate" ? "gossenbund" :
      raw === "kronenwacht" || raw === "vanguard" ? "kronenwacht" : null;
    if (!bucket) continue;
    const cur = agg.get(bucket)!;
    cur.runners += 1;
    cur.xp += r.total_xp ?? 0;
    cur.distance_m += r.total_distance_m ?? 0;
    cur.levels += r.level ?? 0;
  }

  const factions = (["gossenbund", "kronenwacht"] as const).map((id) => {
    const a = agg.get(id)!;
    return {
      id,
      name: id === "gossenbund" ? "Gossenbund" : "Kronenwacht",
      emoji: id === "gossenbund" ? "🗝️" : "👑",
      color: id === "gossenbund" ? "#22D1C3" : "#FFD700",
      runners: a.runners,
      total_xp: a.xp,
      total_km: Math.round(a.distance_m / 1000),
      avg_level: a.runners > 0 ? Math.round(a.levels / a.runners) : 0,
    };
  });

  return NextResponse.json({ factions });
}
