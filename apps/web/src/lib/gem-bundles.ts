// Diamant-Pakete fuer Echtgeld-Kauf via Stripe.
// SKU-Format: "gems_<amount>" — der Webhook schreibt die Diamanten gut.

export type GemBundle = {
  sku: string;
  gems: number;           // Basis-Menge
  bonus: number;          // Extra-Gems als Mengen-Bonus
  price_cents: number;    // EUR
  badge?: "best_value" | "most_popular" | "starter" | "supporter";
};

// Faire Staffelung — kein P2W, Top-Paket ist Supporter-Gönner (teurer pro Gem).
//  0.99 €  = 100 Gems/€     (Starter 1:1)
//  4.99 €  = 105 Gems/€
//  9.99 €  = 115 Gems/€     (Beliebt)
// 19.99 €  = 120 Gems/€
// 39.99 €  = 125 Gems/€     (Bester Wert)
// 99.99 €  =  75 Gems/€     (Supporter — Aufpreis unterstützt das Projekt)
export const GEM_BUNDLES: readonly GemBundle[] = [
  { sku: "gems_100",   gems:   100, bonus:    0, price_cents:   99, badge: "starter" },
  { sku: "gems_500",   gems:   500, bonus:   25, price_cents:  499 },
  { sku: "gems_1200",  gems:  1100, bonus:   50, price_cents:  999, badge: "most_popular" },
  { sku: "gems_2500",  gems:  2200, bonus:  200, price_cents: 1999 },
  { sku: "gems_6000",  gems:  4500, bonus:  500, price_cents: 3999, badge: "best_value" },
  { sku: "gems_7500",  gems:  6000, bonus: 1500, price_cents: 9999, badge: "supporter" },
];

export function findGemBundle(sku: string): GemBundle | null {
  return GEM_BUNDLES.find((b) => b.sku === sku) ?? null;
}

export function totalGemsOfBundle(b: GemBundle): number {
  return b.gems + b.bonus;
}
