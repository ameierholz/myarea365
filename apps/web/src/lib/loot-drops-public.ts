/**
 * Öffentliche Drop-Rate-Transparenz (EU DSA / Loot-Box-Gesetzgebung).
 *
 * Auch wenn alle Drops in MyArea365 GRATIS sind (kein Geld-Einsatz),
 * legen wir proaktiv sämtliche Drop-Chancen und Rewards offen.
 * Diese Datei ist die "Single Source of Truth" und wird 1:1 auf
 * /loot-drops gerendert.
 *
 * Änderungen an DB-Drop-Tabellen MÜSSEN hier gespiegelt werden.
 */

export type LootRarity = "none" | "common" | "rare" | "epic" | "legend";

export const RARITY_LABEL: Record<LootRarity, string> = {
  none: "Kein Drop",
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legend: "Legendary",
};

export const RARITY_COLOR: Record<LootRarity, string> = {
  none: "#8B8FA3",
  common: "#9ba8c7",
  rare: "#5ddaf0",
  epic: "#a855f7",
  legend: "#FFD700",
};

/**
 * 1️⃣ Deal-Redemption-Loot (nach QR-Einlösung bei Shop)
 * Server-RPC: award_redemption_loot (Migration 00017)
 * Roll nach random() — Chancen und Rewards identisch in DB hinterlegt.
 */
export const REDEMPTION_LOOT_TABLE: Array<{
  rarity: LootRarity;
  chance_pct: number;
  xp_reward: number;
  note?: string;
}> = [
  { rarity: "none",   chance_pct: 60.0, xp_reward: 0,    note: "Kein Guardian-Loot dieses Mal" },
  { rarity: "common", chance_pct: 25.0, xp_reward: 100 },
  { rarity: "rare",   chance_pct: 10.0, xp_reward: 300 },
  { rarity: "epic",   chance_pct:  4.0, xp_reward: 800 },
  { rarity: "legend", chance_pct:  1.0, xp_reward: 2500 },
];

/**
 * 2️⃣ Equipment-Drop bei Rare+ Redemption-Loot
 * Server-RPC: drop_equipment_item (Migration 00018).
 * Zusätzlich zu XP bekommt der Runner ab "rare" ein zufälliges
 * Item aus item_catalog in der gleichen Rarity-Klasse.
 */
export const EQUIPMENT_DROP_NOTE =
  "Bei Rare / Epic / Legendary zusätzlich: 1 zufälliges Equipment-Item " +
  "aus dem Item-Katalog der gleichen Rarity-Klasse. Slot (Helm/Rüstung/Amulett) " +
  "sowie Stats (HP/ATK/DEF/SPD) sind pro Item fest im Katalog hinterlegt.";

/**
 * 3️⃣ Map-Loot-Drops (Kisten auf der Karte)
 * Client-Spawn alle 90-120s in 450m Radius um User.
 * Rarity-Verteilung durch gewichtetes Array:
 *   common × 3 + rare × 2 + epic × 1 + legendary × 1
 * => 3/7, 2/7, 1/7, 1/7 ≈ 42.9% / 28.6% / 14.3% / 14.3%
 * Auto-Pickup bei ≤30m Entfernung. Rewards sind zur Zeit rein
 * visuell (Demo, +25 XP flat). Produktive Rewards in der nächsten
 * Version: per Rarity staged, identisch zur Redemption-Tabelle.
 */
export const MAP_LOOT_CRATE_TABLE: Array<{
  rarity: LootRarity;
  chance_pct: number;
  reward: string;
  kinds: string[];
}> = [
  { rarity: "common", chance_pct: 42.9, reward: "+25 🪙 (Demo)", kinds: ["📦 Wegemünzen-Pack"] },
  { rarity: "rare",   chance_pct: 28.6, reward: "+25 🪙 (Demo)", kinds: ["🎁 Speed-Boost", "🎁 Mystery-Ticket"] },
  { rarity: "epic",   chance_pct: 14.3, reward: "+25 🪙 (Demo)", kinds: ["💎 Wegemünzen-Pack", "💎 Mystery-Ticket"] },
  { rarity: "legend", chance_pct: 14.3, reward: "+25 🪙 (Demo)", kinds: ["👑 Mystery-Ticket"] },
];

/**
 * 4️⃣ Mystery-Box (Shop-Kauf, bewusst mit festem Preis)
 * Shop-Kauf € 1,99 - enthält 1 garantiertes Item mit folgender Verteilung:
 * (implementiert in monetization.ts MYSTERY_BOX_CHANCES - hier nur Transparenz)
 */
export const MYSTERY_BOX_TABLE: Array<{
  rarity: LootRarity;
  chance_pct: number;
  reward: string;
}> = [
  { rarity: "common", chance_pct: 50.0, reward: "Standard-Item (Helm/Rüstung/Amulett)" },
  { rarity: "rare",   chance_pct: 30.0, reward: "Rare-Item +5 HP/ATK/DEF/SPD" },
  { rarity: "epic",   chance_pct: 15.0, reward: "Epic-Item +10 HP/ATK/DEF/SPD" },
  { rarity: "legend", chance_pct:  5.0, reward: "Legendary-Item +20 HP/ATK/DEF/SPD" },
];

/**
 * 5️⃣ Arena-Win-Loot (automatisch nach 3-Sieg-Streak)
 * Guardian fusioniert + trophy unlock, keine Random-Rolls.
 * 100% deterministisch.
 */
export const ARENA_WIN_REWARDS: Array<{ condition: string; reward: string }> = [
  { condition: "1. Sieg gegen Shop-Arena",  reward: "+500 Wächter-XP (garantiert)" },
  { condition: "3-Sieg-Streak gleicher Shop", reward: "Legendary Trophy + Wächter-Fusion" },
  { condition: "Boss-Raid Beteiligung",     reward: "Anteilig 100-5000 XP je nach Schaden + Legendary Loot bei Sieg" },
];

/** Meta-Info für die Public-Page */
export const LOOT_DISCLOSURE_META = {
  last_updated: "2026-04-20",
  legal_note:
    "MyArea365 verkauft keine kostenpflichtigen Loot-Boxen mit Zufallsinhalt. " +
    "Alle Zufalls-Drops sind gratis (Bewegung als 'Währung'). Trotzdem legen wir " +
    "vollständig offen, was mit welcher Chance droppen kann. Transparenz ist " +
    "Pflicht – auch bei Gratis-Mechaniken. Stand: 2026-04-20. " +
    "Belgien, Niederlande und Spanien haben Loot-Boxen bereits reguliert; die EU " +
    "plant im Rahmen des Digital Fairness Act verbindliche Transparenz-Regeln.",
  contact: "a.meierholz@gmail.com",
} as const;
