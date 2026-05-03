import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [survQ, doneQ] = await Promise.all([
    sb.from("surveys").select("*").eq("active", true).order("created_at", { ascending: false }),
    sb.from("user_survey_completions").select("survey_id, completed_at").eq("user_id", auth.user.id),
  ]);
  return NextResponse.json({ surveys: survQ.data ?? [], completed: doneQ.data ?? [] });
}

export async function POST(req: Request) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null) as { survey_id?: string; response?: unknown } | null;
  if (!body?.survey_id) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const { data, error } = await sb.rpc("complete_survey", {
    p_survey_id: body.survey_id, p_response: body.response ?? {},
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
