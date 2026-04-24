// Fraktionen (kronenwacht / gossenbund) mit mechanischen Buffs.
// Zugehoerigkeit steht auf public.users.faction.

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
    label: "Kronenwacht",
    icon: "👑",
    color: "#FFD700",
    buff_name: "Beständig",
    buff_desc: "Bonus-Wegemünzen für lange gehaltene Straßenzüge · deine Gebiete verblassen langsamer (Farb-Zerfall bremsen)",
    vibe: "Wurzeln schlagen, Gebiete halten, das Viertel pflegen.",
  },
  gossenbund: {
    id: "gossenbund",
    label: "Gossenbund",
    icon: "🗝️",
    color: "#22D1C3",
    buff_name: "Raubzug",
    buff_desc: "Bonus-Wegemünzen beim Erobern neuer Straßen · übermalst gegnerische Straßen schneller",
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
