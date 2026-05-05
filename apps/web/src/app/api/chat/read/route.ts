import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/chat/read — Body: { room_id, message_id? } */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const body = await req.json() as { room_id?: string; message_id?: string };
  if (!body.room_id) return NextResponse.json({ error: "missing_room_id" }, { status: 400 });
  const { error } = await sb.rpc("chat_mark_read", { p_room_id: body.room_id, p_message_id: body.message_id ?? null });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
