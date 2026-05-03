import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const today = new Date().toISOString().slice(0, 10);
  const [thrQ, actQ] = await Promise.all([
    sb.from("daily_activity_thresholds").select("*").order("level"),
    sb.from("user_daily_activity").select("*").eq("user_id", auth.user.id).eq("date", today).maybeSingle(),
  ]);
  return NextResponse.json({
    thresholds: thrQ.data ?? [],
    today: actQ.data ?? { date: today, points: 0, claimed_levels: [] },
  });
}

export async function POST(req: Request) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null) as { action?: string; level?: number; points?: number } | null;
  if (body?.action === "claim" && typeof body.level === "number") {
    const { data, error } = await sb.rpc("claim_activity_reward", { p_level: body.level });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
  if (body?.action === "add_points" && typeof body.points === "number") {
    const { data, error } = await sb.rpc("add_activity_points", { p_user_id: auth.user.id, p_points: body.points });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, total: data });
  }
  return NextResponse.json({ error: "bad_request" }, { status: 400 });
}
