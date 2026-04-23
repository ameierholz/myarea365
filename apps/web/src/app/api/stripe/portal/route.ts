import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/stripe/portal
 * Body: { business_id?: string }
 * Erstellt eine Stripe-Customer-Portal-Session für Self-Service-Billing
 * (Rechnungen ansehen, Kündigung, Zahlungsmittel ändern).
 *
 * Ermittelt den Stripe-Customer aus der zuletzt erfolgreichen purchase.
 */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { business_id?: string };

  // Find latest paid purchase for this user (or business if given) to resolve customer id
  let q = sb.from("purchases").select("stripe_session_id").eq("status", "paid").order("created_at", { ascending: false }).limit(1);
  if (body.business_id) q = q.eq("business_id", body.business_id);
  else q = q.eq("user_id", user.id);
  const { data: rows } = await q;
  const sessionId = rows?.[0]?.stripe_session_id;
  if (!sessionId) {
    return NextResponse.json({ error: "no_stripe_customer", message: "Noch keine Zahlung. Erst ein Abo/Paket kaufen." }, { status: 404 });
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (!customerId) return NextResponse.json({ error: "no_customer" }, { status: 404 });

  const origin = req.headers.get("origin") ?? "https://myarea365.de";
  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/shop/billing`,
  });

  return NextResponse.json({ url: portal.url });
}
