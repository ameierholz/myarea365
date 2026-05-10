import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — Status (aktive Saison, today_tasks, progress, rewards) */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  const { data, error } = await sb.rpc("get_mighty_governor_status");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** POST — Body: { action: "claim", threshold: number } */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  const body = await req.json() as { action?: string; threshold?: number };
  if (body.action === "claim" && typeof body.threshold === "number") {
    const { data, error } = await sb.rpc("claim_mighty_reward", { p_threshold: body.threshold });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
  return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
}
