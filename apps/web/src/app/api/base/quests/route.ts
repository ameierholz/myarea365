import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/base/quests — heutige Quests + Definitions zusammen */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  // Lazy assign — wenn heute noch keine, leg 4 an
  await sb.rpc("ensure_daily_quests");

  const today = new Date().toISOString().slice(0, 10);
  const [quests, definitions] = await Promise.all([
    sb.from("user_daily_quests")
      .select("id, quest_id, progress, target, claimed, created_at")
      .eq("user_id", user.id).eq("quest_date", today).order("created_at"),
    sb.from("quest_definitions")
      .select("id, name, description, emoji, quest_type, target, reward_wood, reward_stone, reward_gold, reward_mana"),
  ]);

  return NextResponse.json({
    ok: true,
    quests: quests.data ?? [],
    definitions: definitions.data ?? [],
  });
}
