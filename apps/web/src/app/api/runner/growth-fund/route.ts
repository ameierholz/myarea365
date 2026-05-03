import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/runner/growth-fund
 * Returns: { milestones, purchased, claimed[], current_rank }
 */
export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [msQ, userQ, gfQ] = await Promise.all([
    sb.from("growth_fund_milestones").select("id, required_rank_id, gems_reward, sort_order").order("sort_order"),
    sb.from("users").select("xp").eq("id", auth.user.id).maybeSingle<{ xp: number | null }>(),
    sb.from("user_growth_fund").select("purchased_at, claimed_milestones").eq("user_id", auth.user.id).maybeSingle<{ purchased_at: string; claimed_milestones: number[] }>(),
  ]);

  const xp = userQ.data?.xp ?? 0;
  const currentRank =
    xp >= 250000 ? 10 : xp >= 100000 ? 9 :
    xp >=  50000 ?  8 : xp >=  25000 ? 7 :
    xp >=  10000 ?  6 : xp >=   5000 ? 5 :
    xp >=   2500 ?  4 : xp >=   1000 ? 3 :
    xp >=    300 ?  2 : 1;

  return NextResponse.json({
    milestones: msQ.data ?? [],
    purchased: !!gfQ.data?.purchased_at,
    purchased_at: gfQ.data?.purchased_at ?? null,
    claimed: gfQ.data?.claimed_milestones ?? [],
    current_rank: currentRank,
    user_xp: xp,
  });
}

/**
 * POST /api/runner/growth-fund
 * Body: { action: "purchase" | "claim", milestone_id?: int }
 *
 * purchase: Phase-1 Direkt-Activate (Phase-2 Stripe).
 * claim:    Holt Gems für einen freigeschalteten Meilenstein.
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) as { action?: string; milestone_id?: number } | null;
  if (!body?.action) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  if (body.action === "purchase") {
    const { error } = await sb.rpc("purchase_growth_fund", { p_user_id: auth.user.id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "claim" && typeof body.milestone_id === "number") {
    const { data, error } = await sb.rpc("claim_growth_fund_milestone", {
      p_user_id: auth.user.id, p_milestone_id: body.milestone_id,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.claimed) return NextResponse.json({ error: row?.error ?? "claim_failed" }, { status: 400 });
    return NextResponse.json({ ok: true, gems: row.gems });
  }

  return NextResponse.json({ error: "bad_request" }, { status: 400 });
}
