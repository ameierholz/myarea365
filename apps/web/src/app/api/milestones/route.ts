import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — eigene Milestone-Liste (recharge + spend) */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  const { data, error } = await sb.rpc("list_my_milestones");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** POST — Body: { kind: "recharge"|"spend", threshold: number } */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  const body = await req.json() as { kind?: string; threshold?: number };
  if (!body.kind || typeof body.threshold !== "number") {
    return NextResponse.json({ ok: false, error: "missing_params" }, { status: 400 });
  }
  const { data, error } = await sb.rpc("claim_milestone", { p_kind: body.kind, p_threshold: body.threshold });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
