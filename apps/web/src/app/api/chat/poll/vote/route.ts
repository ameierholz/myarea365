import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/chat/poll/vote — Body: { message_id, option_index, remove? } */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const body = await req.json() as { message_id?: string; option_index?: number; remove?: boolean };
  if (!body.message_id || typeof body.option_index !== "number") {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  }
  const { error } = await sb.rpc("chat_vote_poll", {
    p_message_id: body.message_id, p_option_index: body.option_index, p_remove: body.remove ?? false,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
