import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/chat/poll — Body: { room_id, question, options, multi_choice?, closes_at? } */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const body = await req.json() as {
    room_id?: string; question?: string; options?: string[];
    multi_choice?: boolean; closes_at?: string;
  };
  if (!body.room_id || !body.question || !Array.isArray(body.options) || body.options.length < 2) {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  }
  const { data, error } = await sb.rpc("chat_create_poll", {
    p_room_id: body.room_id, p_question: body.question, p_options: body.options,
    p_multi_choice: body.multi_choice ?? false, p_closes_at: body.closes_at ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, message_id: data });
}
