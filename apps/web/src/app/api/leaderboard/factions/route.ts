import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const revalidate = 60;

type FactionId = "gossenbund" | "kronenwacht" | "netzhueter";

const FACTION_META: Record<FactionId, { name: string; emoji: string; color: string }> = {
  gossenbund:  { name: "Gossenbund",  emoji: "🔗", color: "#22D1C3" },
  kronenwacht: { name: "Kronenwacht", emoji: "🛡️", color: "#FFD700" },
  netzhueter:  { name: "Netzhüter",   emoji: "📡", color: "#FF2D78" },
};

/**
 * GET /api/leaderboard/factions
 * Aggregierte Stats je Wächter-Fraktion (Gossenbund/Kronenwacht/Netzhüter).
 * Metriken: Mitglieder, Ø Level, Gesamt-Ansehen, Gesamt-XP.
 */
export async function GET() {
  const sb = await createClient();

  const { data } = await sb.from("users")
    .select("guardian_faction, level, xp, ansehen")
    .neq("is_banned", true)
    .not("guardian_faction", "is", null);

  const agg = new Map<FactionId, { members: number; xp: number; ansehen: number; levels: number }>();
  for (const id of Object.keys(FACTION_META) as FactionId[]) {
    agg.set(id, { members: 0, xp: 0, ansehen: 0, levels: 0 });
  }
  for (const r of data ?? []) {
    const id = r.guardian_faction as FactionId | null;
    if (!id || !(id in FACTION_META)) continue;
    const cur = agg.get(id)!;
    cur.members += 1;
    cur.xp += Number(r.xp ?? 0);
    cur.ansehen += Number(r.ansehen ?? 0);
    cur.levels += r.level ?? 0;
  }

  const factions = (Object.keys(FACTION_META) as FactionId[]).map((id) => {
    const a = agg.get(id)!;
    return {
      id,
      ...FACTION_META[id],
      members: a.members,
      total_xp: a.xp,
      total_ansehen: a.ansehen,
      avg_level: a.members > 0 ? Math.round(a.levels / a.members) : 0,
    };
  });

  return NextResponse.json({ factions });
}
