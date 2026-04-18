import Stripe from "stripe";

let _stripe: Stripe | null = null;
export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  _stripe = new Stripe(key, { apiVersion: "2026-03-25.dahlia" });
  return _stripe;
}

// Stripe Price-IDs je SKU (im Stripe-Dashboard anzulegen oder per stripe fixtures)
// Fallback: dynamische Price via price_data, damit es ohne Dashboard-Setup läuft.
export type StripeLineItem =
  | { price: string; quantity: number }
  | {
      price_data: {
        currency: string;
        product_data: { name: string; metadata?: Record<string, string> };
        unit_amount: number;
        recurring?: { interval: "month" | "year" };
      };
      quantity: number;
    };

export function buildLineItem(
  sku: string,
  name: string,
  amountCents: number,
  mode: "payment" | "subscription",
): StripeLineItem {
  // Falls Price-ID per ENV gemappt ist, die benutzen:
  const envKey = `STRIPE_PRICE_${sku.toUpperCase()}`;
  const priceId = process.env[envKey];
  if (priceId) return { price: priceId, quantity: 1 };

  // Sonst dynamisch — funktioniert für payment mode problemlos,
  // für subscription nur wenn Stripe das erlaubt (Test-Mode).
  return {
    price_data: {
      currency: "eur",
      product_data: { name, metadata: { sku } },
      unit_amount: amountCents,
      ...(mode === "subscription" ? { recurring: { interval: sku.includes("yearly") ? "year" as const : "month" as const } } : {}),
    },
    quantity: 1,
  };
}

export function skuMode(sku: string): "payment" | "subscription" {
  // Abos: monatliche Pläne + Supporter-Badges
  if (sku === "plus_monthly" || sku === "plus_yearly"
      || sku === "crew_pro_monthly" || sku === "crew_pro_yearly"
      || sku.startsWith("badge_")) {
    return "subscription";
  }
  return "payment";
}
