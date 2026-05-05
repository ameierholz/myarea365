import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/chat/messages/:id/report — Body: { reason, body? } */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json() as { reason?: string; body?: string };
  if (!body.reason) return NextResponse.json({ error: "missing_reason" }, { status: 400 });
  const { data, error } = await sb.rpc("chat_report_message", {
    p_message_id: id, p_reason: body.reason, p_body: body.body ?? null
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, report_id: data });
}
