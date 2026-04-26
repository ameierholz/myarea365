import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/base/quests/claim — Body: { quest_id: uuid (user_daily_quests.id) } */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = (await req.json()) as { quest_id?: string };
  if (!body.quest_id) return NextResponse.json({ error: "missing_quest_id" }, { status: 400 });

  const { data, error } = await sb.rpc("claim_quest", { p_quest_id: body.quest_id });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
