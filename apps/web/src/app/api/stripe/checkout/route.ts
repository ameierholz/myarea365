import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe, buildLineItem, skuMode } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { sku, name, amount_cents, crew_id, ui_mode } = await req.json() as {
    sku: string; name: string; amount_cents: number; crew_id?: string; ui_mode?: "hosted" | "embedded";
  };
  if (!sku || !name || typeof amount_cents !== "number") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const mode = skuMode(sku);
  const lineItem = buildLineItem(sku, name, amount_cents, mode);

  const origin = req.headers.get("origin") ?? "https://myarea365.de";
  const isEmbedded = ui_mode === "embedded";
  const session = await getStripe().checkout.sessions.create({
    mode,
    line_items: [lineItem],
    ui_mode: isEmbedded ? "embedded_page" : "hosted_page",
    ...(isEmbedded
      ? { return_url: `${origin}/dashboard?checkout=success&sku=${sku}&session_id={CHECKOUT_SESSION_ID}` }
      : {
          success_url: `${origin}/dashboard?checkout=success&sku=${sku}`,
          cancel_url: `${origin}/dashboard?checkout=cancel`,
        }),
    client_reference_id: user.id,
    customer_email: user.email ?? undefined,
    metadata: { sku, user_id: user.id, crew_id: crew_id ?? "" },
    ...(mode === "subscription" ? { subscription_data: { metadata: { sku, user_id: user.id, crew_id: crew_id ?? "" } } } : {}),
  });

  // Purchase-Record anlegen (pending)
  await sb.from("purchases").insert({
    user_id: user.id,
    crew_id: crew_id ?? null,
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
