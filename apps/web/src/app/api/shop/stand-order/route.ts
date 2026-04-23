import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VARIANT_PRICES: Record<string, { label: string; price_cents: number }> = {
  a5_table: { label: "Acryl-Aufsteller A5 (Tisch)", price_cents: 1290 },
  a4_table: { label: "Acryl-Aufsteller A4 (Tisch)", price_cents: 1890 },
  a4_wall:  { label: "Acryl-Schild A4 (Wand)",       price_cents: 2190 },
};

type Body = {
  shop_id: string;
  variant: string;
  quantity: number;
  recipient_name: string;
  recipient_company?: string | null;
  street: string;
  zip: string;
  city: string;
  notes?: string | null;
};

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "auth" }, { status: 401 });

  const body = await req.json() as Body;
  const v = VARIANT_PRICES[body.variant];
  if (!v) return NextResponse.json({ ok: false, error: "invalid_variant" }, { status: 400 });
  const qty = Math.max(1, Math.min(20, Number(body.quantity) || 1));
  if (!body.recipient_name || !body.street || !body.zip || !body.city) {
    return NextResponse.json({ ok: false, error: "missing_address" }, { status: 400 });
  }

  // Shop-Ownership prüfen
  const { data: shop } = await sb.from("local_businesses")
    .select("id, name, owner_id").eq("id", body.shop_id).maybeSingle();
  if (!shop) return NextResponse.json({ ok: false, error: "shop_not_found" }, { status: 404 });
  if (shop.owner_id !== user.id) return NextResponse.json({ ok: false, error: "not_owner" }, { status: 403 });

  const totalCents = v.price_cents * qty;
  const skuName = `${v.label} · ${qty}× · ${shop.name}`;

  const origin = req.headers.get("origin") ?? "https://myarea365.de";
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{
      price_data: {
        currency: "eur",
        product_data: { name: skuName },
        unit_amount: totalCents,
      },
      quantity: 1,
    }],
    success_url: `${origin}/shop/${shop.id}/qr?stand_ordered=1`,
    cancel_url: `${origin}/shop/${shop.id}/qr?stand_cancel=1`,
    client_reference_id: user.id,
    customer_email: user.email ?? undefined,
    shipping_address_collection: { allowed_countries: ["DE","AT","CH"] },
    metadata: {
      type: "stand_order",
      shop_id: shop.id,
      user_id: user.id,
      variant: body.variant,
      quantity: String(qty),
    },
  });

  const { data: order, error } = await sb.from("shop_stand_orders").insert({
    shop_id: shop.id,
    user_id: user.id,
    variant: body.variant,
    quantity: qty,
    recipient_name: body.recipient_name,
    recipient_company: body.recipient_company ?? null,
    street: body.street,
    zip: body.zip,
    city: body.city,
    country: "DE",
    notes: body.notes ?? null,
    status: "pending",
    price_cents: totalCents,
    stripe_session_id: session.id,
  }).select("id").single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, order_id: order.id, checkout_url: session.url });
}
