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
 * 1️⃣ Deal-Redemption-Loot (nach QR-Einlösung bei Partner-Shop)
 * Server-RPC: award_redemption_loot (Migration 00017)
 * Roll nach random() — Chancen und Rewards identisch in DB hinterlegt.
 */
export const REDEMPTION_LOOT_TABLE: Array<{
  rarity: LootRarity;
  chance_pct: number;
  xp_reward: number;
  note?: string;
}> = [
  { rarity: "none",   chance_pct: 60.0, xp_reward: 0,    note: "Kein Wächter-Loot dieses Mal" },
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
  "sowie Stats (Leben/Angriff/Verteidigung/Tempo) sind pro Item fest im Katalog hinterlegt.";

/**
 * 3️⃣ Map-Loot-Drops (Kisten auf der Karte)
 * Client-Spawn alle 90-120s in 450m Radius um User.
 * Rarity-Verteilung durch gewichtetes Array:
 *   common × 63 + rare × 25 + epic × 10 + legendary × 2
 * => 63% / 25% / 10% / 2%  (Legendary "mega selten")
 * Auto-Pickup bei ≤30m Entfernung.
 */
export const MAP_LOOT_CRATE_TABLE: Array<{
  rarity: LootRarity;
  chance_pct: number;
  reward: string;
  kinds: string[];
}> = [
  { rarity: "common", chance_pct: 63.0, reward: "Resourcen + kleine Diamanten",  kinds: ["📦 Tech-Schrott / Komponenten / Krypto"] },
  { rarity: "rare",   chance_pct: 25.0, reward: "Resourcen + Speed-Boost",        kinds: ["🎁 Bauzeit-Verkürzer", "🎁 Wahl-Box-Ticket"] },
  { rarity: "epic",   chance_pct: 10.0, reward: "Diamanten-Paket + Material",     kinds: ["💎 Diamanten-Drop", "💎 Wahl-Box-Ticket"] },
  { rarity: "legend", chance_pct:  2.0, reward: "Großes Diamanten-Paket + Siegel", kinds: ["👑 Wahl-Box-Ticket"] },
];

/**
 * 4️⃣ Wahl-Box (Shop-Kauf € 2,99)
 *
 * **Umbau April 2026:** Die ehemals randomisierte „Mystery-Box" wurde durch eine
 * deterministische Wahl-Box ersetzt — User wählt VOR dem Kauf eine von 11 fixen
 * Belohnungen. Damit fällt das Produkt explizit nicht mehr unter die Loot-Box-
 * Regulierung von Belgien (KGBC 2018), Niederlande (KSA), Spanien
 * (Ley 13/2011) und die kommenden EU Digital-Fairness-Act-Regeln.
 *
 * Liste rein zur Transparenz — der User sieht sie auch direkt im Shop-Modal
 * vor dem Klick auf „Auswählen".
 */
export const WAHL_BOX_OPTIONS: Array<{ icon: string; title: string; value: string }> = [
  { icon: "💎", title: "500 Diamanten",          value: "Direkt aufs Konto" },
  { icon: "💎", title: "200 Diamanten",          value: "Direkt aufs Konto" },
  { icon: "💎", title: "50 Diamanten",           value: "Direkt aufs Konto" },
  { icon: "🔧", title: "10 000 Tech-Schrott",   value: "Resource für Bauen" },
  { icon: "⚙️", title: "10 000 Komponenten",    value: "Resource für Bauen" },
  { icon: "₿",  title: "5 000 Krypto",          value: "Resource für Bauen" },
  { icon: "📡", title: "5 000 Bandbreite",      value: "Resource für Forschen" },
  { icon: "⚡", title: "48 h Bauzeit-Verkürzer", value: "Beschleunigt Bauen für 48 h" },
  { icon: "🔮", title: "Wächter-XP-Boost",      value: "+2.500 XP für deinen Wächter" },
  { icon: "✨", title: "Pin-Theme freischalten", value: "Eines aus 18 Auras (Cosmetic)" },
  { icon: "🎨", title: "Map-Icon freischalten",  value: "Strategie-Marker (Cosmetic)" },
];

/**
 * 5️⃣ Arena/PvP-Win-Loot (automatisch nach 3-Sieg-Streak)
 * Wächter fusioniert + trophy unlock, keine Random-Rolls.
 * 100% deterministisch.
 */
export const ARENA_WIN_REWARDS: Array<{ condition: string; reward: string }> = [
  { condition: "1. Sieg in Wächter-Arena",     reward: "+500 Wächter-XP (garantiert) + 1 Siegel" },
  { condition: "3-Sieg-Streak gleicher Gegner", reward: "Legendary Trophy + Wächter-Fusion" },
  { condition: "Wegelager-Plünderung (Crew-Raid)", reward: "Loot proportional zum eigenen Schaden — Tech-Schrott / Komponenten / Diamanten / Siegel" },
  { condition: "Boss-Raid Beteiligung",         reward: "Anteilig 100-5000 XP je nach Schaden + Legendary Loot bei Sieg" },
];

/**
 * 6️⃣ Saison-Belohnungen (deterministisch, nicht zufällig)
 *
 * Die drei Saison-Systeme verteilen am Ende jeder Saison feste Belohnungen
 * an die Top-Plätze. Quelle: season_reward_tiers (in /admin/seasons live
 * editierbar). Hier sind die aktuell aktiven Werte gespiegelt.
 */
export const SEASON_REWARDS_TABLE: Array<{
  system: string;
  cadence: string;
  tier: string;
  reward: string;
}> = [
  { system: "👑 Stadt-Server-Saison",     cadence: "pro Ära (~30-60 Tage)",            tier: "Don-Crew (Throne-Holder)",  reward: "Don-Titel + Aura für gesamte Crew + 5 000 💎 für Crew-Pool" },
  { system: "👑 Stadt-Server-Saison",     cadence: "—",                                tier: "Top-3 Crews",               reward: "2 500 💎 + Saison-Trophy für jeden Member" },
  { system: "👑 Stadt-Server-Saison",     cadence: "—",                                tier: "Top-4 bis Top-10 Crews",    reward: "1 000 💎 + Saison-Badge" },
  { system: "👑 Stadt-Server-Saison",     cadence: "—",                                tier: "Teilnahme (Crew aktiv)",    reward: "250 💎 + Hall-of-Fame-Eintrag" },

  { system: "⚔️ CvC (Crew vs Crew)",      cadence: "wöchentlich pro CvC-Map",          tier: "#1 Champion-Crew",          reward: "1 500 💎 + 50 Universal-Siegel + Titel" },
  { system: "⚔️ CvC (Crew vs Crew)",      cadence: "—",                                tier: "#2-3 Finalisten",           reward: "750 💎 + 25 Siegel" },
  { system: "⚔️ CvC (Crew vs Crew)",      cadence: "—",                                tier: "#4-10 Halbfinale",          reward: "300 💎 + 10 Siegel" },
  { system: "⚔️ CvC (Crew vs Crew)",      cadence: "—",                                tier: "#11-50 Aufgebot",           reward: "100 💎 + 3 Siegel" },
  { system: "⚔️ CvC (Crew vs Crew)",      cadence: "—",                                tier: "Teilnahme (≥1 Match)",      reward: "30 💎 + 1 Siegel" },

  { system: "🛡️ Wächter-Arena-Saison",    cadence: "monatlich (1. d. M. 01:00 UTC)",   tier: "#1 Champion",               reward: "500 💎 + 50 Universal-Siegel + Titel" },
  { system: "🛡️ Wächter-Arena-Saison",    cadence: "—",                                tier: "#2-3 Gladiator",            reward: "300 💎 + 25 Siegel" },
  { system: "🛡️ Wächter-Arena-Saison",    cadence: "—",                                tier: "#4-10 Kriegsmeister",       reward: "150 💎 + 10 Siegel" },
  { system: "🛡️ Wächter-Arena-Saison",    cadence: "—",                                tier: "#11-50 Veteran",            reward: "50 💎 + 3 Siegel" },
  { system: "🛡️ Wächter-Arena-Saison",    cadence: "—",                                tier: "#51-100 Top-100",           reward: "20 💎 + 1 Siegel" },
];

/** Meta-Info für die Public-Page */
export const LOOT_DISCLOSURE_META = {
  last_updated: "2026-05-09",
  legal_note:
    "MyArea365 verkauft keine kostenpflichtigen Loot-Boxen mit Zufallsinhalt. " +
    "Die kostenpflichtige Wahl-Box (€ 2,99) ist deterministisch — der User wählt " +
    "VOR dem Kauf, was er bekommt; kein Zufalls-Roll. Diamanten-Pakete sind " +
    "ebenfalls deterministisch (feste Diamanten-Menge pro Preis). Alle übrigen " +
    "Zufalls-Drops (Karten-Truhen, Wegelager-Loot, Arena-Belohnungen) sind " +
    "gratis und werden durch Spielen erworben. Trotzdem legen wir vollständig " +
    "offen, was mit welcher Chance droppen kann. Transparenz ist Pflicht — auch " +
    "bei Gratis-Mechaniken. Belgien (KGBC 2018), Niederlande (KSA) und Spanien " +
    "(Ley 13/2011) haben bezahlte Loot-Boxen bereits reguliert; die EU plant " +
    "im Rahmen des Digital Fairness Act verbindliche Transparenz-Regeln.",
  contact: "a.meierholz@gmail.com",
} as const;
