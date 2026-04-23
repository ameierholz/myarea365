import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS = new Set([
  "discount_percent",
  "free_item",
  "wegemuenzen_unlock",
  "gebietsruf_unlock",
  "crew_emblem",
]);

/**
 * GET  /api/shop/crew-rewards?shop_id=...  → { rewards: [...], top_crews: [...] }
 * POST /api/shop/crew-rewards              → upsert 1 Tier
 * DELETE /api/shop/crew-rewards?id=...     → remove Tier
 */
export async function GET(req: NextRequest) {
  const sb = await createClient();
  const shopId = new URL(req.url).searchParams.get("shop_id");
  if (!shopId) return NextResponse.json({ rewards: [], top_crews: [] });

  const [{ data: rewards }, { data: top }] = await Promise.all([
    sb.from("shop_crew_rewards")
      .select("id, tier, threshold, label, reward_kind, reward_value_int, reward_value_text, active")
      .eq("shop_id", shopId)
      .order("tier", { ascending: true }),
    sb.rpc("get_top_crews_for_shop", { p_shop_id: shopId, p_limit: 10 }),
  ]);

  return NextResponse.json({
    rewards: rewards ?? [],
    top_crews: top ?? [],
  });
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "auth" }, { status: 401 });

  const body = await req.json() as {
    shop_id: string;
    tier: number;
    threshold: number;
    label: string;
    reward_kind: string;
    reward_value_int?: number | null;
    reward_value_text?: string | null;
    active?: boolean;
  };

  if (!body.shop_id) return NextResponse.json({ ok: false, error: "missing_shop_id" }, { status: 400 });
  if (![1, 2, 3].includes(body.tier)) return NextResponse.json({ ok: false, error: "invalid_tier" }, { status: 400 });
  if (!(body.threshold > 0)) return NextResponse.json({ ok: false, error: "invalid_threshold" }, { status: 400 });
  if (!KINDS.has(body.reward_kind)) return NextResponse.json({ ok: false, error: "invalid_kind" }, { status: 400 });
  if (!body.label || body.label.trim().length < 2) return NextResponse.json({ ok: false, error: "invalid_label" }, { status: 400 });

  // Ownership-Check
  const { data: shop } = await sb.from("local_businesses")
    .select("id").eq("id", body.shop_id).eq("owner_id", user.id).maybeSingle();
  if (!shop) return NextResponse.json({ ok: false, error: "not_owner" }, { status: 403 });

  const { data, error } = await sb.from("shop_crew_rewards")
    .upsert({
      shop_id: body.shop_id,
      tier: body.tier,
      threshold: body.threshold,
      label: body.label.trim(),
      reward_kind: body.reward_kind,
      reward_value_int: body.reward_value_int ?? null,
      reward_value_text: body.reward_value_text?.trim() || null,
      active: body.active ?? true,
    }, { onConflict: "shop_id,tier" })
    .select("*").single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, reward: data });
}

export async function DELETE(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "auth" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });

  const { error } = await sb.from("shop_crew_rewards").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
