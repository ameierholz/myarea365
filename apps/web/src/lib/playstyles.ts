// Spielstile (Player-Archetypen) — gewählt bei Registrierung.
// Schreibt in `users.faction` Spalte (legacy-Name, neue Werte).
//
// Konzept: Country / Stadt / Dorf / Crews / Banden — Strategie-Aufbauspiel.
// Die 4 Archetypen geben dem Spieler einen klaren Rollen-Fokus + sanften Soft-Buff.
// Buffs sind initial nur "deklariert" — Aktivierung in späterer Migration (siehe TODO).

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
      "+5 % Bau-Geschwindigkeit deiner Gebäude",
      "+5 % Resourcen-Produktion in deiner Heimat-Stadt",
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
      "+5 % Wächter-Schaden im Aufgebot",
      "+5 % Beute beim Plündern von Wegelagern",
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
      "+5 % Forschungs-Geschwindigkeit",
      "Tarn-Bonus bei Spionage-Marschen auf andere Crews",
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
      "+10 % Crew-Beitrag bei gemeinsamen Aktionen",
      "Erweiterte Reichweite der Don-Aura wenn deine Crew herrscht",
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
