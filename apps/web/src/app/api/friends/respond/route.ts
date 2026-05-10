import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/friends/respond
 *  Body: { request_id: uuid, action: "accept" | "decline" }
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  const body = await req.json() as { request_id?: string; action?: string };
  if (!body.request_id || !/^[0-9a-f-]{36}$/i.test(body.request_id)) {
    return NextResponse.json({ ok: false, error: "invalid_request_id" }, { status: 400 });
  }
  if (body.action !== "accept" && body.action !== "decline") {
    return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
  }
  const fn = body.action === "accept" ? "accept_friend_request" : "decline_friend_request";
  const { data, error } = await sb.rpc(fn, { p_request_id: body.request_id });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
