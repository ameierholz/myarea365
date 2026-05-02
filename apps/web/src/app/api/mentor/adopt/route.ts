import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({})) as { mentee_user_id?: string };
  if (!body.mentee_user_id) return NextResponse.json({ error: "missing_mentee_user_id" }, { status: 400 });
  const { data, error } = await sb.rpc("create_mentor_relationship", { p_mentee_user_id: body.mentee_user_id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
