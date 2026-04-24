import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validate, str, int, uuid, oneOf } from "@/lib/validate";

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

  const raw = await req.json().catch(() => null);
  const v = validate(raw, {
    shop_id: uuid(),
    title: str({ min: 3, max: 120 }),
    description: str({ max: 1000, optional: true }),
    xp_cost: int({ min: 0, max: 100000 }),
    frequency: oneOf(FREQ, { optional: true }),
    max_redemptions: int({ min: 1, max: 100000, optional: true }),
    active_until: str({ max: 40, optional: true }),
    min_order_amount_cents: int({ min: 0, max: 1000000, optional: true }),
  });
  if (!v.ok) return NextResponse.json({ ok: false, error: "invalid", issues: v.issues }, { status: 400 });

  const { data, error } = await sb.from("shop_deals").insert({
    shop_id: v.data.shop_id,
    title: v.data.title!.trim(),
    description: v.data.description?.trim() || null,
    xp_cost: v.data.xp_cost,
    frequency: v.data.frequency ?? "weekly",
    max_redemptions: v.data.max_redemptions ?? null,
    active_until: v.data.active_until ?? null,
    min_order_amount_cents: v.data.min_order_amount_cents ?? null,
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
