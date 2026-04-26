import type { AnyRarity } from "@/lib/guardian";
// Items können noch Legacy-Raritäten haben (common/rare/legend) — akzeptiere alle.
type GuardianRarity = AnyRarity;

// 8 Slots — synchron mit DB-Migration 00078 (helm/chest/legs/boots/gloves/weapon/necklace/ring).
export type ItemSlot =
  | "helm"      // Kopf
  | "chest"     // Brust
  | "legs"      // Beine
  | "boots"     // Schuhe
  | "gloves"    // Hände
  | "weapon"    // Waffe
  | "necklace"  // Kette
  | "ring";     // Ring

export const ALL_SLOTS: ItemSlot[] = [
  "helm", "chest", "legs", "gloves", "boots", "weapon", "necklace", "ring",
];

export type ItemCatalogRow = {
  id: string;
  name: string;
  emoji: string;
  slot: ItemSlot;
  rarity: GuardianRarity;
  bonus_hp: number;
  bonus_atk: number;
  bonus_def: number;
  bonus_spd: number;
  lore: string | null;
  cosmetic_only?: boolean;
};

export type UserItem = {
  id: string;
  user_id: string;
  item_id: string;
  acquired_at: string;
  source: "drop" | "purchased" | "crafted" | "initial";
  catalog?: ItemCatalogRow;
};

export type EquippedItems = Partial<Record<ItemSlot, (UserItem & { catalog: ItemCatalogRow }) | null>>;

export function sumEquipmentBonus(eq: EquippedItems): { hp: number; atk: number; def: number; spd: number } {
  const out = { hp: 0, atk: 0, def: 0, spd: 0 };
  for (const slot of ALL_SLOTS) {
    const it = eq[slot];
    if (!it) continue;
    // cosmetic_only -> keine Stat-Boni (Anti-P2W)
    if (it.catalog.cosmetic_only) continue;
    out.hp  += it.catalog.bonus_hp;
    out.atk += it.catalog.bonus_atk;
    out.def += it.catalog.bonus_def;
    out.spd += it.catalog.bonus_spd;
  }
  return out;
}

export const SLOT_META: Record<ItemSlot, { label: string; icon: string; order: number }> = {
  helm:     { label: "Kopf",   icon: "⛑️",  order: 1 },
  chest:    { label: "Brust",  icon: "🛡️", order: 2 },
  legs:     { label: "Beine",  icon: "👖",  order: 3 },
  gloves:   { label: "Hände",  icon: "🧤",  order: 4 },
  boots:    { label: "Schuhe", icon: "👟",  order: 5 },
  weapon:   { label: "Waffe",  icon: "⚔️",  order: 6 },
  necklace: { label: "Kette",  icon: "📿",  order: 7 },
  ring:     { label: "Ring",   icon: "💍",  order: 8 },
};
