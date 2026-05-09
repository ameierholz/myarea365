import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const revalidate = 60;

/**
 * GET /api/leaderboard/guardians-by-category
 * Beste Wächter pro Typ und pro Rarität — jeweils Top 5.
 */
export async function GET() {
  const sb = await createClient();

  const types = ["infantry", "cavalry", "marksman", "mage"] as const;
  const rarities = ["elite", "epic", "legendary"] as const;

  const selectCols = "id, user_id, archetype_id, level, wins, losses, guardian_archetypes!inner(name, emoji, rarity, guardian_type), users:user_id(username, display_name, team_color)";

  const [byType, byRarity] = await Promise.all([
    Promise.all(
      types.map((t) =>
        sb.from("user_guardians")
          .select(selectCols)
          .eq("is_active", true)
          .eq("guardian_archetypes.guardian_type", t)
          .order("level", { ascending: false })
          .order("wins", { ascending: false })
          .limit(5)
          .then((r) => ({ type: t, rows: r.data ?? [] })),
      ),
    ),
    Promise.all(
      rarities.map((r) =>
        sb.from("user_guardians")
          .select(selectCols)
          .eq("is_active", true)
          .eq("guardian_archetypes.rarity", r)
          .order("level", { ascending: false })
          .order("wins", { ascending: false })
          .limit(5)
          .then((res) => ({ rarity: r, rows: res.data ?? [] })),
      ),
    ),
  ]);

  return NextResponse.json({ by_type: byType, by_rarity: byRarity });
}
