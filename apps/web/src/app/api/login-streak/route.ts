import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { bumpQuestProgress } from "@/lib/quests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/login-streak — Status (current_streak, can_claim, rewards-Kalender) */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  const { data, error } = await sb.rpc("get_login_streak_status");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** POST /api/login-streak — Reward für heute claimen */
export async function POST() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  const { data, error } = await sb.rpc("claim_login_streak");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const j = data as { ok?: boolean };
  if (!j?.ok) return NextResponse.json(j, { status: 400 });

  // Quest-Progress: Login-Tag zählt für daily_login + side_login_30_days.
  await bumpQuestProgress(sb, user.id, "login_days", 1);

  return NextResponse.json(j);
}
