// Edelstein-Pakete fuer Echtgeld-Kauf via Stripe.
// SKU-Format: "gems_<amount>" — der Webhook schreibt die Edelsteine gut.

export type GemBundle = {
  sku: string;
  gems: number;           // Basis-Menge
  bonus: number;          // Extra-Gems als Mengen-Bonus
  price_cents: number;    // EUR
  badge?: "best_value" | "most_popular" | "starter";
};

export const GEM_BUNDLES: readonly GemBundle[] = [
  { sku: "gems_100",  gems:  100, bonus:    0, price_cents:  99,  badge: "starter" },
  { sku: "gems_500",  gems:  500, bonus:   50, price_cents:  399 },
  { sku: "gems_1200", gems: 1200, bonus:  150, price_cents:  799, badge: "most_popular" },
  { sku: "gems_2500", gems: 2500, bonus:  400, price_cents: 1499 },
  { sku: "gems_6000", gems: 6000, bonus: 1200, price_cents: 2999, badge: "best_value" },
];

export function findGemBundle(sku: string): GemBundle | null {
  return GEM_BUNDLES.find((b) => b.sku === sku) ?? null;
}

export function totalGemsOfBundle(b: GemBundle): number {
  return b.gems + b.bonus;
}
