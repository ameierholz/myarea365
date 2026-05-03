import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/runner/monthly-packs
 * Returns: { skus: [...], owned: [{ id, sku, expires_at, last_claimed_date, total_claims, can_claim_today }] }
 */
export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [skuQ, ownedQ] = await Promise.all([
    sb.from("monthly_pack_skus")
      .select("sku, name, price_eur, duration_days, daily_gems, daily_coins, daily_items, instant_gems, instant_coins, sort_order")
      .eq("active", true).order("sort_order"),
    sb.from("user_monthly_packs")
      .select("id, sku, started_at, expires_at, last_claimed_date, total_claims, active")
      .eq("user_id", auth.user.id).eq("active", true)
      .order("started_at", { ascending: false }),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const owned = (ownedQ.data ?? []).map((o) => ({
    ...o,
    can_claim_today: !o.last_claimed_date || o.last_claimed_date < today,
  }));

  return NextResponse.json({ skus: skuQ.data ?? [], owned });
}

/**
 * POST /api/runner/monthly-packs
 * Body: { action: "purchase" | "claim_all", sku?: string }
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) as { action?: string; sku?: string } | null;
  if (!body?.action) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  if (body.action === "purchase" && body.sku) {
    const { data, error } = await sb.rpc("purchase_monthly_pack", {
      p_user_id: auth.user.id, p_sku: body.sku,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (data !== true) return NextResponse.json({ error: "sku_not_found" }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "claim_all") {
    const { data, error } = await sb.rpc("claim_monthly_packs", { p_user_id: auth.user.id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, results: data ?? [] });
  }

  return NextResponse.json({ error: "bad_request" }, { status: 400 });
}
