import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimitSmart, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/friends/request
 *  Body: { to_user: uuid }  → Anfrage senden (oder ggf. Auto-Accept wenn Gegen-Anfrage existiert)
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  const rl = await rateLimitSmart(`friend:req:${user.id}`, 30, 60_000);
  const limited = rateLimitResponse(rl);
  if (limited) return limited;

  const body = await req.json() as { to_user?: string };
  if (!body.to_user) return NextResponse.json({ ok: false, error: "missing_to_user" }, { status: 400 });
  if (!/^[0-9a-f-]{36}$/i.test(body.to_user)) {
    return NextResponse.json({ ok: false, error: "invalid_uuid" }, { status: 400 });
  }
  const { data, error } = await sb.rpc("send_friend_request", { p_to_user: body.to_user });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
