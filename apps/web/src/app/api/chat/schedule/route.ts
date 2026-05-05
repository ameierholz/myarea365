import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/chat/schedule — Body: { room_id, body, scheduled_for, reply_to_id? } */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const body = await req.json() as {
    room_id?: string; body?: string; scheduled_for?: string;
    reply_to_id?: string; attachments?: unknown;
  };
  if (!body.room_id || !body.body || !body.scheduled_for) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }
  const { data, error } = await sb.rpc("chat_schedule_message", {
    p_room_id: body.room_id, p_body: body.body, p_scheduled_for: body.scheduled_for,
    p_attachments: body.attachments ?? null, p_reply_to_id: body.reply_to_id ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, schedule_id: data });
}

/** GET /api/chat/schedule → eigene scheduled-list */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const { data } = await sb.from("chat_scheduled_messages")
    .select("*").eq("user_id", user.id).is("dispatched_at", null).is("cancelled_at", null)
    .order("scheduled_for", { ascending: true });
  return NextResponse.json({ scheduled: data ?? [] });
}

/** DELETE /api/chat/schedule?id=... → cancel */
export async function DELETE(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  const { error } = await sb.from("chat_scheduled_messages")
    .update({ cancelled_at: new Date().toISOString() })
    .eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
