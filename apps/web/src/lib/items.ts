import type { GuardianRarity } from "@/lib/guardian";

// 9 Slots total (Legacy helm/armor/amulet + 6 neue)
// DB hat armor -> chest, amulet -> neck ge-migrated. TS ist schon am neuen Stand.
export type ItemSlot =
  | "helm"       // Kopf
  | "chest"      // Brust
  | "hands"      // Hände
  | "shoulders"  // Schulter
  | "boots"      // Schuhe
  | "wrist"      // Handgelenk
  | "neck"       // Kette
  | "ring"       // Ring
  | "weapon";    // Waffe

export const ALL_SLOTS: ItemSlot[] = [
  "helm", "chest", "hands", "shoulders", "boots", "wrist", "neck", "ring", "weapon",
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
  helm:      { label: "Kopf",       icon: "⛑️", order: 1 },
  shoulders: { label: "Schulter",   icon: "🎽", order: 2 },
  chest:     { label: "Brust",      icon: "🛡️", order: 3 },
  hands:     { label: "Hände",      icon: "🧤", order: 4 },
  wrist:     { label: "Handgelenk", icon: "⌚", order: 5 },
  neck:      { label: "Kette",      icon: "📿", order: 6 },
  ring:      { label: "Ring",       icon: "💍", order: 7 },
  boots:     { label: "Schuhe",     icon: "👟", order: 8 },
  weapon:    { label: "Waffe",      icon: "⚔️", order: 9 },
};
