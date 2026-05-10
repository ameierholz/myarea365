// Spielstile (Player-Archetypen) — gewählt bei Registrierung.
// Schreibt in `users.faction` Spalte (legacy-Name, neue Werte).
//
// Konzept: Country / Stadt / Dorf / Crews / Banden — Strategie-Aufbauspiel.
// Die 4 Archetypen geben dem Spieler einen klaren Rollen-Fokus + sanften Soft-Buff.
//
// Aktivierung in Migration 00289_playstyle_buffs.sql — Helper-Function
// public.playstyle_buff(uid, kind) wird in start_building, start_research,
// _collect_one_building, _reserve_user_troops, spy_player_base,
// tick_gather_marches, donate_to_crew_member aufgerufen.
//
// LIVE-Buffs (in DB aktiv):
//   architect:  -5% Bauzeit, +5% Resourcen-Yield
//   warlord:    +5% Truppen-Damage, +5% Plünder-Beute
//   strategist: -5% Forschungszeit, Spionage gratis (statt 500 Gold)
//   diplomat:   +10% Wert deiner Crew-Spenden
//
// PHASE-4 (Stub im Helper, Mechanik kommt mit Don-System):
//   diplomat: +20 % stärkere Don-Aura (5%→6% all-stats wenn Don)

export type PlaystyleId = "architect" | "warlord" | "strategist" | "diplomat";

export type PlaystyleMeta = {
  id: PlaystyleId;
  /** UI-Label (deutsch — i18n erfolgt im Component). */
  label: string;
  icon: string;
  /** Hex-Farbe für Akzent in UI. */
  color: string;
  /** 1-2 Wörter Spielfokus, e.g. "Wirtschaft · Aufbau". */
  motto: string;
  /** Buff-Name (kurz, wirkt wie Skill-Title). */
  buff_name: string;
  /** 2 Buff-Stichpunkte (Soft-Bonus, ~5-10 %). */
  buff_lines: [string, string];
};

export const PLAYSTYLES: Record<PlaystyleId, PlaystyleMeta> = {
  architect: {
    id: "architect",
    label: "Architekt",
    icon: "🏗️",
    color: "#FFD700", // gold — Reichtum / Aufbau
    motto: "Wirtschaft · Aufbau",
    buff_name: "Meisterbau",
    buff_lines: [
      "−5 % Bauzeit aller Gebäude",
      "+5 % Yield beim Einsammeln deiner Produktions-Gebäude",
    ],
  },
  warlord: {
    id: "warlord",
    label: "Warlord",
    icon: "⚔️",
    color: "#FF6B4A", // pin-orange — Kampf / Aggression
    motto: "Krieg · Eroberung",
    buff_name: "Schlachtruf",
    buff_lines: [
      "+5 % Truppen-Damage in Rallies und Trupps",
      "+5 % Beute aus Wegelager-Plünderzügen",
    ],
  },
  strategist: {
    id: "strategist",
    label: "Stratege",
    icon: "🧠",
    color: "#22D1C3", // teal — Wissen / Strategie
    motto: "Forschung · Spionage",
    buff_name: "Vorausschau",
    buff_lines: [
      "−5 % Forschungszeit",
      "Spionage kostet dich 0 Krypto (statt 500)",
    ],
  },
  diplomat: {
    id: "diplomat",
    label: "Diplomat",
    icon: "🤝",
    color: "#a855f7", // purple — Bündnisse / Diplomatie
    motto: "Crew · Allianzen",
    buff_name: "Verbündete",
    buff_lines: [
      "+10 % Wert deiner Resourcen-Spenden an Crew-Mitglieder",
      "Stärkere Don-Aura (+20 % Bonus auf all-stats wenn deine Crew Don ist)",
    ],
  },
};

export const ALL_PLAYSTYLES: PlaystyleMeta[] = [
  PLAYSTYLES.architect,
  PLAYSTYLES.warlord,
  PLAYSTYLES.strategist,
  PLAYSTYLES.diplomat,
];

// Legacy-Werte aus alten Benutzerprofilen weich auf neuen Stil mappen
// (für Anzeige — keine harte Migration).
export function normalizePlaystyle(raw: string | null | undefined): PlaystyleId | null {
  if (!raw) return null;
  const v = raw.toLowerCase();
  if (v === "architect" || v === "warlord" || v === "strategist" || v === "diplomat") {
    return v as PlaystyleId;
  }
  // Legacy: alte Faktionen weich auf neue Stile mappen
  if (v === "kronenwacht" || v === "vanguard" || v === "sonnenwacht") return "architect";  // Halten/Pflegen → Aufbau
  if (v === "gossenbund"  || v === "syndicate" || v === "nachtpuls") return "warlord";    // Erobern/Vorstoßen → Krieg
  return null;
}
