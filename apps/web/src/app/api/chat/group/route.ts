import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/chat/group — Body: { name, member_ids[] } → neue Gruppe anlegen */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const body = await req.json() as { name?: string; member_ids?: string[] };
  if (!body.name || !Array.isArray(body.member_ids)) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }
  const { data, error } = await sb.rpc("chat_create_group", { p_name: body.name, p_member_ids: body.member_ids });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, room_id: data });
}
