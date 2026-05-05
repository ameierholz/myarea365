import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/chat/messages/:id/pin — Body: { unpin? } */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({})) as { unpin?: boolean };
  const { error } = await sb.rpc("chat_pin_message", { p_message_id: id, p_unpin: body.unpin ?? false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
