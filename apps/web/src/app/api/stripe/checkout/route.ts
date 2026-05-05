import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe, buildLineItem, skuMode } from "@/lib/stripe";
import { resolveSkuPrice } from "@/lib/monetization";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as {
    sku?: unknown; crew_id?: unknown; business_id?: unknown; ui_mode?: unknown;
  } | null;
  const sku = typeof body?.sku === "string" ? body.sku : null;
  const crew_id = typeof body?.crew_id === "string" ? body.crew_id : undefined;
  const business_id = typeof body?.business_id === "string" ? body.business_id : undefined;
  const ui_mode = body?.ui_mode === "embedded" ? "embedded" as const : "hosted" as const;

  if (!sku) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // SECURITY: Preis + Name werden ausschließlich serverseitig aus dem Katalog
  // aufgelöst. Ein Client kann damit keine 1-Cent-Preise erzwingen.
  const resolved = resolveSkuPrice(sku);
  if (!resolved) {
    return NextResponse.json({ error: "Unknown SKU" }, { status: 400 });
  }
  const amount_cents = resolved.price;
  const name = resolved.name;

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Rate-Limit: 10 Checkout-Inits pro Minute pro User — normaler Kaufflow braucht 1-2.
  const rl = rateLimit(`checkout:${user.id}`, 10, 60_000);
  const blocked = rateLimitResponse(rl);
  if (blocked) return blocked;

  const mode = skuMode(sku);
  const lineItem = buildLineItem(sku, name, amount_cents, mode);

  const origin = req.headers.get("origin") ?? "https://myarea365.de";
  const isEmbedded = ui_mode === "embedded";
  const session = await getStripe().checkout.sessions.create({
    mode,
    line_items: [lineItem],
    ui_mode: isEmbedded ? "embedded_page" : "hosted_page",
    ...(isEmbedded
      ? { return_url: `${origin}/karte?checkout=success&sku=${sku}&session_id={CHECKOUT_SESSION_ID}` }
      : {
          success_url: `${origin}/karte?checkout=success&sku=${sku}`,
          cancel_url: `${origin}/karte?checkout=cancel`,
        }),
    client_reference_id: user.id,
    customer_email: user.email ?? undefined,
    metadata: { sku, user_id: user.id, crew_id: crew_id ?? "", business_id: business_id ?? "" },
    ...(mode === "subscription" ? { subscription_data: { metadata: { sku, user_id: user.id, crew_id: crew_id ?? "", business_id: business_id ?? "" } } } : {}),
  });

  // Purchase-Record anlegen (pending)
  await sb.from("purchases").insert({
    user_id: user.id,
    crew_id: crew_id ?? null,
    business_id: business_id ?? null,
    product_sku: sku,
    product_name: name,
    amount_cents,
    currency: "EUR",
    status: "pending",
    stripe_session_id: session.id,
  });

  return NextResponse.json({
    url: session.url,
    client_secret: session.client_secret,
  });
}
