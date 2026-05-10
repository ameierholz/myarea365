import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — Stages-Liste + eigener Progress */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  const [stagesR, progressR] = await Promise.all([
    sb.from("expedition_stages").select("*").order("stage_idx"),
    sb.from("user_expedition_progress").select("stage_idx, best_stars, completed_at").eq("user_id", user.id),
  ]);
  return NextResponse.json({ ok: true, stages: stagesR.data ?? [], progress: progressR.data ?? [] });
}

/** POST — Body: { stage_idx } → Stage spielen */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  const body = await req.json() as { stage_idx?: number };
  if (typeof body.stage_idx !== "number") return NextResponse.json({ ok: false, error: "missing_stage_idx" }, { status: 400 });
  const { data, error } = await sb.rpc("run_expedition_stage", { p_stage_idx: body.stage_idx });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
