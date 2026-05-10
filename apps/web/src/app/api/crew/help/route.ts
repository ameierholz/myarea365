import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — Liste offener Crew-Help-Requests */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  const { data, error } = await sb.rpc("list_crew_help_requests");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** POST — { action: "request"|"give", ... } */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  const body = await req.json() as { action?: string; job_kind?: string; job_id?: string; max_helps?: number; request_id?: string };
  if (body.action === "request") {
    if (!body.job_kind || !body.job_id) return NextResponse.json({ ok: false, error: "missing_params" }, { status: 400 });
    const { data, error } = await sb.rpc("request_crew_help", { p_job_kind: body.job_kind, p_job_id: body.job_id, p_max_helps: body.max_helps ?? 30 });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
  if (body.action === "give") {
    if (!body.request_id) return NextResponse.json({ ok: false, error: "missing_request_id" }, { status: 400 });
    const { data, error } = await sb.rpc("give_crew_help", { p_request_id: body.request_id });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
  return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
}
