import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FREQ = ["daily","weekly","monthly","quarterly","unlimited"] as const;

/**
 * GET /api/shop/deals?shop_id=...
 * Listet alle Deals eines Shops (Owner oder öffentlich, je nach RLS).
 */
export async function GET(req: NextRequest) {
  const sb = await createClient();
  const shopId = new URL(req.url).searchParams.get("shop_id");
  if (!shopId) return NextResponse.json({ error: "missing_shop_id" }, { status: 400 });

  const { data, error } = await sb.from("shop_deals")
    .select("id, shop_id, title, description, xp_cost, max_redemptions, redemption_count, active_until, active, frequency, created_at")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deals: data ?? [] });
}

/**
 * POST /api/shop/deals
 * Body: { shop_id, title, description, xp_cost, frequency, max_redemptions?, active_until? }
 * RLS erzwingt, dass der eingeloggte User Owner des shops ist.
 */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "auth" }, { status: 401 });

  const body = await req.json() as {
    shop_id: string; title: string; description?: string;
    xp_cost: number; frequency: string;
    max_redemptions?: number; active_until?: string;
  };

  if (!body.shop_id || !body.title || body.title.trim().length < 3) {
    return NextResponse.json({ ok: false, error: "invalid_title" }, { status: 400 });
  }
  if (typeof body.xp_cost !== "number" || body.xp_cost < 0) {
    return NextResponse.json({ ok: false, error: "invalid_xp_cost" }, { status: 400 });
  }
  const freq = FREQ.includes(body.frequency as typeof FREQ[number]) ? body.frequency : "weekly";

  const minOrder = typeof (body as unknown as { min_order_amount_cents?: number }).min_order_amount_cents === "number"
    ? (body as unknown as { min_order_amount_cents: number }).min_order_amount_cents
    : null;

  const { data, error } = await sb.from("shop_deals").insert({
    shop_id: body.shop_id,
    title: body.title.trim(),
    description: body.description?.trim() || null,
    xp_cost: body.xp_cost,
    frequency: freq,
    max_redemptions: body.max_redemptions ?? null,
    active_until: body.active_until ?? null,
    min_order_amount_cents: minOrder,
    active: true,
  }).select("*").single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, deal: data });
}

/**
 * PATCH /api/shop/deals
 * Body: { id, title?, description?, xp_cost?, frequency?, active?, active_until? }
 */
export async function PATCH(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "auth" }, { status: 401 });

  const body = await req.json() as { id: string } & Record<string, unknown>;
  if (!body.id) return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string")       patch.title = body.title.trim();
  if (typeof body.description === "string") patch.description = body.description.trim();
  if (typeof body.xp_cost === "number")     patch.xp_cost = body.xp_cost;
  if (typeof body.active === "boolean")     patch.active = body.active;
  if (typeof body.active_until === "string")patch.active_until = body.active_until;
  if (typeof body.frequency === "string" && FREQ.includes(body.frequency as typeof FREQ[number]))
    patch.frequency = body.frequency;
  if (typeof body.max_redemptions === "number") patch.max_redemptions = body.max_redemptions;
  if (body.min_order_amount_cents === null || typeof body.min_order_amount_cents === "number") {
    patch.min_order_amount_cents = body.min_order_amount_cents;
  }

  const { data, error } = await sb.from("shop_deals").update(patch).eq("id", body.id).select("*").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, deal: data });
}

/**
 * DELETE /api/shop/deals?id=...
 */
export async function DELETE(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "auth" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });

  const { error } = await sb.from("shop_deals").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
