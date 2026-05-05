import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/chat/pm — Body: { other_user_id } → existierender oder neuer 1:1-Room */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const body = await req.json() as { other_user_id?: string };
  if (!body.other_user_id) return NextResponse.json({ error: "missing_user_id" }, { status: 400 });
  const { data, error } = await sb.rpc("chat_create_pm", { p_other_user: body.other_user_id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, room_id: data });
}
