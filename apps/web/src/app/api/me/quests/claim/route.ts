import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/me/quests/claim — body: { quest_id: uuid }
 *   → Zahlt Quest-Rewards aus (gems/wood/stone/gold/mana/speed_token/xp/item)
 *     und markiert claimed_at. Validiert dass die Quest completed ist.
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  let body: { quest_id?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "bad_body" }, { status: 400 }); }

  if (!body.quest_id) return NextResponse.json({ ok: false, error: "missing_quest_id" }, { status: 400 });

  const { data, error } = await sb.rpc("claim_quest", { p_quest_id: body.quest_id });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
