import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/shop/quests?business_id=X
 * Listet aktive Quests eines Shops + eigene Completion-Count.
 */
export async function GET(req: NextRequest) {
  const sb = await createClient();
  const url = new URL(req.url);
  const businessId = url.searchParams.get("business_id");
  if (!businessId) return NextResponse.json({ quests: [] });

  const { data: quests } = await sb.from("shop_quests")
    .select("id, title, description, article_pattern, reward_xp, reward_loot_rarity, expires_at, max_completions_per_user")
    .eq("business_id", businessId)
    .eq("active", true)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("reward_xp", { ascending: false });

  const { data: { user } } = await sb.auth.getUser();
  let completions: Record<string, number> = {};
  if (user && quests && quests.length > 0) {
    const ids = quests.map((q) => q.id);
    const { data: comps } = await sb.from("shop_quest_completions")
      .select("quest_id")
      .eq("user_id", user.id)
      .in("quest_id", ids);
    for (const c of comps ?? []) {
      completions[c.quest_id] = (completions[c.quest_id] ?? 0) + 1;
    }
  }

  return NextResponse.json({
    quests: (quests ?? []).map((q) => ({ ...q, my_completions: completions[q.id] ?? 0 })),
  });
}
