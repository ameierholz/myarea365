/**
 * Öffentliche Drop-Rate-Transparenz (EU Digital Fairness Act,
 * Belgien KGBC 2018, Niederlande KSA, Spanien Ley 13/2011).
 *
 * Auswahl-Prinzip: Sämtliche kostenpflichtigen Box-Käufe in MyArea365
 * sind deterministisch — der Käufer sieht VOR der Bezahlung, was er
 * bekommt. Es gibt keine bezahlten Loot-Boxen mit Zufallsinhalt.
 *
 * Gratis-Belohnungen aus Wächter-Arena, Wegelager-Plünderung und
 * Boss-Raids sind leistungs-basiert (proportional zum eigenen
 * Schaden) — kein Zufalls-Roll, alle Werte hier offen einsehbar.
 *
 * Diese Datei ist die Single Source of Truth und wird 1:1 auf
 * /loot-drops gerendert. Änderungen an DB-Drop-Tabellen MÜSSEN hier
 * gespiegelt werden.
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
 * 1️⃣ Auswahl-Prinzip — Übersicht aller kostenpflichtigen Box-Käufe
 *
 * Jeder dieser Artikel ist deterministisch: der Käufer sieht VOR der
 * Bezahlung den exakten Inhalt. Damit fallen sie nicht unter die
 * Loot-Box-Regulierung von BE/NL/ES.
 */
export const PAID_DETERMINISTIC_ITEMS: Array<{
  icon: string;
  title: string;
  mechanic: string;
}> = [
  { icon: "💎", title: "Diamanten-Pakete",      mechanic: "Feste Diamanten-Menge pro Preis (z. B. 500 💎 für € 4,99). Kein Roll." },
  { icon: "🎁", title: "Wahl-Box (€ 2,99)",     mechanic: "User wählt VOR dem Kauf eine von aktuell 11 fixen Belohnungen aus." },
  { icon: "🎫", title: "Monthly Pass",           mechanic: "Täglicher Reward + monatliche Diamanten — feste Liste, kein Zufall." },
  { icon: "📦", title: "Tagesangebote (Bronze/Silber/Gold/SUPER)", mechanic: "Jedes Bundle hat fest definierte Items + Diamanten (gelegentlich mit Kosmetik-Bonus). Inhalt sichtbar vor Kauf." },
];

/**
 * 2️⃣ Wahl-Box (€ 2,99) — Auswahl-Prinzip
 *
 * Umbau April 2026: ehemals randomisierte „Mystery-Box" wurde zur
 * deterministischen Wahl-Box. User wählt VOR dem Kauf eine von 11
 * Belohnungen — kein Zufalls-Roll, keine Loot-Mechanik im rechtlichen
 * Sinne. Liste rein zur Transparenz; sie ist im Shop-Modal direkt
 * vor dem Klick auf „Auswählen" sichtbar.
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
 * 3️⃣ Arena, Wegelager & Boss-Raid-Loot (GRATIS, leistungs-basiert)
 *
 * Wächter-Arena = deterministisch (1-Sieg, 3-Sieg-Streak).
 * Wegelager-Plünderung + Boss-Raid = anteilig zum eigenen Schaden.
 */
export const ARENA_WIN_REWARDS: Array<{ condition: string; reward: string }> = [
  { condition: "1. Sieg in Wächter-Arena",         reward: "+500 Wächter-XP (garantiert) + 1 Siegel" },
  { condition: "3-Sieg-Streak gleicher Gegner",     reward: "Legendary Trophy + Wächter-Fusion" },
  { condition: "Wegelager-Plünderung (Crew-Raid)",  reward: "Loot proportional zum eigenen Schaden — Tech-Schrott / Komponenten / Diamanten / Siegel" },
  { condition: "Boss-Raid Beteiligung",             reward: "Anteilig 100-5000 XP je nach Schaden + Legendary Loot bei Sieg" },
];

/**
 * 4️⃣ Saison-Belohnungen (deterministisch, nicht zufällig)
 *
 * Die drei Saison-Systeme verteilen am Ende jeder Saison feste
 * Belohnungen an Top-Plätze. Quelle: season_reward_tiers
 * (in /admin/seasons live editierbar). Hier sind die aktuell
 * aktiven Werte gespiegelt.
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
    "MyArea365 verkauft keine Loot-Boxen mit Zufallsinhalt. Jeder " +
    "kostenpflichtige Box-Kauf folgt dem Auswahl-Prinzip — der Käufer " +
    "sieht VOR der Bezahlung exakt, was er bekommt (Diamanten-Pakete, " +
    "Wahl-Box € 2,99, Monthly Pass, Tagesangebote). Damit fallen " +
    "unsere Käufe explizit nicht unter die Loot-Box-Regulierung von " +
    "Belgien (KGBC 2018), Niederlande (KSA) oder Spanien (Ley 13/2011). " +
    "Bei den GRATIS-Mechaniken (Wächter-Arena, Wegelager-Plünderung, " +
    "Boss-Raids) sind die Belohnungen leistungs-basiert (proportional " +
    "zum eigenen Schaden) — alle Werte sind hier offen einsehbar. " +
    "Wir gehen damit über die kommenden EU-Digital-Fairness-Act-Regeln " +
    "hinaus.",
  contact: "a.meierholz@gmail.com",
} as const;
