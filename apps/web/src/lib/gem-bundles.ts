// Edelstein-Pakete fuer Echtgeld-Kauf via Stripe.
// SKU-Format: "gems_<amount>" — der Webhook schreibt die Edelsteine gut.

export type GemBundle = {
  sku: string;
  gems: number;           // Basis-Menge
  bonus: number;          // Extra-Gems als Mengen-Bonus
  price_cents: number;    // EUR
  badge?: "best_value" | "most_popular" | "starter";
};

// Faire Bundles: Grundrate ~100 Gems / EUR, Bonus nur moderat
// (5-18%). Damit kann selbst das größte Paket nur einen Bruchteil
// des Katalogs kaufen — kein P2W.
export const GEM_BUNDLES: readonly GemBundle[] = [
  { sku: "gems_100",  gems:  100, bonus:    0, price_cents:  99,  badge: "starter" },
  { sku: "gems_500",  gems:  500, bonus:   25, price_cents:  499 },
  { sku: "gems_1200", gems: 1100, bonus:  100, price_cents:  999, badge: "most_popular" },
  { sku: "gems_2500", gems: 2200, bonus:  300, price_cents: 1999 },
  { sku: "gems_6000", gems: 4500, bonus:  700, price_cents: 3999, badge: "best_value" },
];

export function findGemBundle(sku: string): GemBundle | null {
  return GEM_BUNDLES.find((b) => b.sku === sku) ?? null;
}

export function totalGemsOfBundle(b: GemBundle): number {
  return b.gems + b.bonus;
}
