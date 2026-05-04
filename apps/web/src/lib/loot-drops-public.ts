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
  "sowie Stats (Leben/Angriff/Verteidigung/Tempo) sind pro Item fest im Katalog hinterlegt.";

/**
 * 3️⃣ Map-Loot-Drops (Kisten auf der Karte)
 * Client-Spawn alle 90-120s in 450m Radius um User.
 * Rarity-Verteilung durch gewichtetes Array:
 *   common × 63 + rare × 25 + epic × 10 + legendary × 2
 * => 63% / 25% / 10% / 2%  (Legendary "mega selten")
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
  { rarity: "common", chance_pct: 63.0, reward: "+25 🪙 (Demo)", kinds: ["📦 Wegemünzen-Pack"] },
  { rarity: "rare",   chance_pct: 25.0, reward: "+25 🪙 (Demo)", kinds: ["🎁 Speed-Boost", "🎁 Mystery-Ticket"] },
  { rarity: "epic",   chance_pct: 10.0, reward: "+25 🪙 (Demo)", kinds: ["💎 Wegemünzen-Pack", "💎 Mystery-Ticket"] },
  { rarity: "legend", chance_pct:  2.0, reward: "+25 🪙 (Demo)", kinds: ["👑 Mystery-Ticket"] },
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
  { icon: "🪙", title: "10 000 Wegemünzen",    value: "Direkt aufs Konto" },
  { icon: "🪙", title: "2 000 Wegemünzen",     value: "Direkt aufs Konto" },
  { icon: "🪙", title: "500 Wegemünzen",       value: "Direkt aufs Konto" },
  { icon: "⚡", title: "48 h × 2 Boost",       value: "Doppelte Wegemünzen für 48 h" },
  { icon: "⚡", title: "24 h × 2 Boost",       value: "Doppelte Wegemünzen für 24 h" },
  { icon: "❄️", title: "5 Streak-Freezes",     value: "Schützen deinen Tages-Streak" },
  { icon: "📣", title: "10 Crew-Shouts",       value: "Aufmerksamkeit ziehen" },
  { icon: "✨", title: "Goldener Trail",       value: "Permanent — Cosmetic" },
  { icon: "💚", title: "Neon Trail",           value: "Permanent — Cosmetic" },
  { icon: "💫", title: "30 Tage Aura",         value: "Sichtbar auf der Karte" },
  { icon: "🌈", title: "30 Tage Rainbow-Name", value: "Animierter Display-Name" },
];

/**
 * 5️⃣ Arena-Win-Loot (automatisch nach 3-Sieg-Streak)
 * Guardian fusioniert + trophy unlock, keine Random-Rolls.
 * 100% deterministisch.
 */
export const ARENA_WIN_REWARDS: Array<{ condition: string; reward: string }> = [
  { condition: "1. Sieg in Shop-Liga",  reward: "+500 Wächter-XP (garantiert)" },
  { condition: "3-Sieg-Streak gleicher Shop", reward: "Legendary Trophy + Wächter-Fusion" },
  { condition: "Boss-Raid Beteiligung",     reward: "Anteilig 100-5000 XP je nach Schaden + Legendary Loot bei Sieg" },
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
  { system: "🏆 Shop-Liga", cadence: "wöchentlich (Mo 00:05 UTC)", tier: "Crew #1",        reward: "5 000 🏴 / Mitglied" },
  { system: "🏆 Shop-Liga", cadence: "—",                            tier: "Crew #2",        reward: "2 500 🏴 / Mitglied" },
  { system: "🏆 Shop-Liga", cadence: "—",                            tier: "Crew #3",        reward: "1 000 🏴 / Mitglied" },
  { system: "🏆 Shop-Liga", cadence: "—",                            tier: "Teilnahme (≥1 Sieg)", reward: "250 🏴 / Mitglied" },
  { system: "⚔️ Arena-Saison", cadence: "monatlich (1. d. M. 01:00 UTC)", tier: "#1 Champion",   reward: "500 💎 + 50 Universal-Siegel + Titel" },
  { system: "⚔️ Arena-Saison", cadence: "—",                          tier: "#2-3 Gladiator", reward: "300 💎 + 25 Siegel" },
  { system: "⚔️ Arena-Saison", cadence: "—",                          tier: "#4-10 Kriegsmeister", reward: "150 💎 + 10 Siegel" },
  { system: "⚔️ Arena-Saison", cadence: "—",                          tier: "#11-50 Veteran", reward: "50 💎 + 3 Siegel" },
  { system: "⚔️ Arena-Saison", cadence: "—",                          tier: "#51-100 Top-100", reward: "20 💎 + 1 Siegel" },
  { system: "🏴 Turf-Krieg-Liga", cadence: "monatlich (Mo 00:10 UTC)", tier: "Crew #1",         reward: "10 000 🏴 / Mitglied" },
  { system: "🏴 Turf-Krieg-Liga", cadence: "—",                       tier: "Crew #2-3",       reward: "5 000 🏴 / Mitglied" },
  { system: "🏴 Turf-Krieg-Liga", cadence: "—",                       tier: "Crew #4-10",      reward: "2 500 🏴 / Mitglied" },
  { system: "🏴 Turf-Krieg-Liga", cadence: "—",                       tier: "Crew #11-50",     reward: "1 000 🏴 / Mitglied" },
  { system: "🏴 Turf-Krieg-Liga", cadence: "—",                       tier: "Teilnahme (≥1 War-Sieg / ≥3 Areas)", reward: "250 🏴 / Mitglied" },
];

/** Meta-Info für die Public-Page */
export const LOOT_DISCLOSURE_META = {
  last_updated: "2026-05-04",
  legal_note:
    "MyArea365 verkauft keine kostenpflichtigen Loot-Boxen mit Zufallsinhalt. " +
    "Die kostenpflichtige Wahl-Box (€ 2,99) ist deterministisch — der User wählt " +
    "VOR dem Kauf, was er bekommt; kein Zufalls-Roll. Alle übrigen Zufalls-Drops " +
    "sind gratis (Bewegung als „Währung\"). Trotzdem legen wir vollständig offen, " +
    "was mit welcher Chance droppen kann. Transparenz ist Pflicht – auch bei " +
    "Gratis-Mechaniken. Belgien (KGBC 2018), Niederlande (KSA) und Spanien " +
    "(Ley 13/2011) haben bezahlte Loot-Boxen bereits reguliert; die EU plant " +
    "im Rahmen des Digital Fairness Act verbindliche Transparenz-Regeln.",
  contact: "a.meierholz@gmail.com",
} as const;
