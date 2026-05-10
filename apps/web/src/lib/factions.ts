// Legacy-Walking-Fraktion-Datei — wird noch von einigen Leaderboards/Charts referenziert.
// Die ECHTE Wächter-Fraktion-Logik liegt in lib/guardian.ts (FACTION_META) mit 3 Werten.
// DB-IDs (gossenbund/kronenwacht) bleiben als interne Keys. Nur UI-Labels modernisiert.

export type FactionId = "kronenwacht" | "gossenbund";

export type FactionMeta = {
  id: FactionId;
  label: string;
  icon: string;
  color: string;
  buff_name: string;
  buff_desc: string;
  vibe: string;  // Kurzer Stil-Text (UI-Tooltip)
};

export const FACTIONS: Record<FactionId, FactionMeta> = {
  kronenwacht: {
    id: "kronenwacht",
    label: "Stadtwache",
    icon: "🛡️",
    color: "#FFD700",
    buff_name: "Beständig",
    buff_desc: "Bonus für lange gehaltene Gebiete · deine Claims verblassen langsamer.",
    vibe: "Wurzeln schlagen, Gebiete halten, das Viertel pflegen.",
  },
  gossenbund: {
    id: "gossenbund",
    label: "Untergrund",
    icon: "🔗",
    color: "#22D1C3",
    buff_name: "Raubzug",
    buff_desc: "Bonus beim Erobern neuer Gebiete · übermalst gegnerische Claims schneller.",
    vibe: "Grenzen verschieben, fremdes Revier erobern, nie stehenbleiben.",
  },
};

export const ALL_FACTIONS: FactionMeta[] = [FACTIONS.kronenwacht, FACTIONS.gossenbund];

// Legacy-Werte aus alten Benutzerprofilen auf neue Fraktion mappen.
export function normalizeFaction(raw: string | null | undefined): FactionId | null {
  if (!raw) return null;
  const v = raw.toLowerCase();
  if (v === "kronenwacht" || v === "vanguard" || v === "sonnenwacht" || v === "sun_watch" || v === "sunwatch") return "kronenwacht";
  if (v === "gossenbund" || v === "syndicate" || v === "nachtpuls" || v === "night_pulse" || v === "nightpulse") return "gossenbund";
  return null;
}
