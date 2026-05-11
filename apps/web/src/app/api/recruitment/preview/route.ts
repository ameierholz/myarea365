import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/recruitment/preview?tier=silver|gold
 * Liefert die Belohnungsvorschau-Tabelle + aktuellen Pity-Stand.
 */
export async function GET(req: NextRequest) {
  const sb = await createClient();
  const url = new URL(req.url);
  const tier = url.searchParams.get("tier");
  if (tier !== "silver" && tier !== "gold") {
    return NextResponse.json({ ok: false, error: "invalid_tier" }, { status: 400 });
  }

  const { data, error } = await sb.rpc("get_pull_preview", { p_tier: tier });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // Schlüssel + Truhe + Marken-Stand mitliefern für UI
  const { data: { user } } = await sb.auth.getUser();
  let stock: { chests: number; keys: number; medals: Array<{ archetype_id: string; name: string; emoji: string; rarity: string; count: number; required: number }> } = {
    chests: 0, keys: 0, medals: [],
  };
  if (user) {
    const [chests, medalsRaw] = await Promise.all([
      sb.from("user_inventory_items")
        .select("item_id, count")
        .eq("user_id", user.id)
        .in("item_id", [`chest_${tier}`, `key_${tier}`]),
      sb.from("user_guardian_medals")
        .select("archetype_id, count, archetype:guardian_archetypes(name, emoji, rarity)")
        .eq("user_id", user.id),
    ]);
    const chestCount = (chests.data ?? []).find((r) => r.item_id === `chest_${tier}`)?.count ?? 0;
    const keyCount = (chests.data ?? []).find((r) => r.item_id === `key_${tier}`)?.count ?? 0;
    stock = {
      chests: chestCount,
      keys: keyCount,
      medals: ((medalsRaw.data ?? []) as unknown as Array<{
        archetype_id: string;
        count: number;
        archetype: { name: string; emoji: string; rarity: string } | null;
      }>).map((m) => ({
        archetype_id: m.archetype_id,
        name: m.archetype?.name ?? m.archetype_id,
        emoji: m.archetype?.emoji ?? "🛡",
        rarity: m.archetype?.rarity ?? "common",
        count: m.count,
        required: { advanced: 3, elite: 5, epic: 10, legendary: 20 }[m.archetype?.rarity ?? "elite"] ?? 5,
      })),
    };
  }

  return NextResponse.json({ ...(data as object), stock });
}
