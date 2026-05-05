import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/chat/messages/:id — Body: { body } → editieren */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json() as { body?: string };
  const { error } = await sb.rpc("chat_edit_message", { p_message_id: id, p_new_body: body.body ?? "" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE /api/chat/messages/:id — Soft-delete */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const { id } = await ctx.params;
  const { error } = await sb.rpc("chat_delete_message", { p_message_id: id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
