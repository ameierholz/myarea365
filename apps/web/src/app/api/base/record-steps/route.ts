import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/base/record-steps — Body: { steps: int, source?: 'healthkit'|'googlefit'|'manual'|'wheelchair' } */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = (await req.json()) as { steps?: number; source?: string };
  if (typeof body.steps !== "number" || body.steps <= 0) {
    return NextResponse.json({ error: "invalid_steps" }, { status: 400 });
  }

  const { data, error } = await sb.rpc("record_step_session", {
    p_steps: body.steps,
    p_source: body.source ?? "manual",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
