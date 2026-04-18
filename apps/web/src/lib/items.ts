import type { GuardianRarity } from "@/lib/guardian";

export type ItemSlot = "helm" | "armor" | "amulet";

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
};

export type UserItem = {
  id: string;
  user_id: string;
  item_id: string;
  acquired_at: string;
  source: "drop" | "purchased" | "crafted" | "initial";
  catalog?: ItemCatalogRow;
};

export type EquippedItems = {
  helm: (UserItem & { catalog: ItemCatalogRow }) | null;
  armor: (UserItem & { catalog: ItemCatalogRow }) | null;
  amulet: (UserItem & { catalog: ItemCatalogRow }) | null;
};

export function sumEquipmentBonus(eq: EquippedItems): { hp: number; atk: number; def: number; spd: number } {
  const out = { hp: 0, atk: 0, def: 0, spd: 0 };
  for (const slot of ["helm", "armor", "amulet"] as const) {
    const it = eq[slot];
    if (!it) continue;
    out.hp  += it.catalog.bonus_hp;
    out.atk += it.catalog.bonus_atk;
    out.def += it.catalog.bonus_def;
    out.spd += it.catalog.bonus_spd;
  }
  return out;
}

export const SLOT_META: Record<ItemSlot, { label: string; icon: string }> = {
  helm:   { label: "Helm",      icon: "⛑️" },
  armor:  { label: "Rüstung",   icon: "🛡️" },
  amulet: { label: "Amulett",   icon: "📿" },
};
