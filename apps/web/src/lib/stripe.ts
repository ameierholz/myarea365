import Stripe from "stripe";

let _stripe: Stripe | null = null;
export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  _stripe = new Stripe(key, {
    apiVersion: "2026-03-25.dahlia",
    maxNetworkRetries: 2,  // Stripe SDK retry mit exponential backoff für transiente Fehler
    timeout: 15_000,
  });
  return _stripe;
}

/** Retry-Wrapper für Stripe-Calls mit exponential backoff bei 5xx/Network. */
export async function withStripeRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const err = e as { type?: string; statusCode?: number };
      const retriable = err?.type === "StripeConnectionError"
        || err?.type === "StripeAPIError"
        || (err?.statusCode != null && err.statusCode >= 500);
      if (!retriable || i === attempts - 1) throw e;
      await new Promise((r) => setTimeout(r, 250 * Math.pow(2, i)));
    }
  }
  throw lastErr;
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
      || sku.startsWith("badge_")
      || sku === "shop_basis" || sku === "shop_pro" || sku === "shop_ultra"
      || sku === "social_pro_monthly" || sku === "analytics_pro_monthly"
      || sku === "competitor_monthly"
      || sku === "arena_monthly") {
    return "subscription";
  }
  return "payment";
}
