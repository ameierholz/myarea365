import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/friends/remove — Body: { other_user: uuid } */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  const body = await req.json() as { other_user?: string };
  if (!body.other_user || !/^[0-9a-f-]{36}$/i.test(body.other_user)) {
    return NextResponse.json({ ok: false, error: "invalid_uuid" }, { status: 400 });
  }
  const { data, error } = await sb.rpc("remove_friend", { p_other_user: body.other_user });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
