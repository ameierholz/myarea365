export type CrewFactionId = "pfadfinder" | "waechterorden" | "stadtlaeufer" | "mystiker";

export type CrewFactionMeta = {
  id: CrewFactionId;
  name: string;
  icon: string;
  color: string;
  tagline: string;
  buff: string;
  buffDetail: string;
};

export const CREW_FACTIONS: Record<CrewFactionId, CrewFactionMeta> = {
  pfadfinder: {
    id: "pfadfinder",
    name: "Pfadfinder",
    icon: "🏃",
    color: "#4ade80",
    tagline: "Laufen ist unser Weg.",
    buff: "+10 % 🪙 Wegemünzen beim Laufen",
    buffDetail: "Jeder Walk gibt 10 % mehr Wegemünzen für alle Crew-Mitglieder.",
  },
  waechterorden: {
    id: "waechterorden",
    name: "Wächter-Orden",
    icon: "⚔️",
    color: "#FF6B4A",
    tagline: "Der Orden kämpft vereint.",
    buff: "+5 % HP & ATK",
    buffDetail: "Alle Wächter der Crew-Mitglieder haben 5 % mehr HP und 5 % mehr Angriff.",
  },
  stadtlaeufer: {
    id: "stadtlaeufer",
    name: "Stadtläufer",
    icon: "🏙️",
    color: "#22D1C3",
    tagline: "Jede Straße ein Siegel.",
    buff: "+15 % Siegel-Drops",
    buffDetail: "Beim Looten von Kisten & Boss-Raids gibt es 15 % mehr Siegel.",
  },
  mystiker: {
    id: "mystiker",
    name: "Mystiker",
    icon: "🔮",
    color: "#a855f7",
    tagline: "Wissen ist Macht.",
    buff: "+10 % Wächter-XP",
    buffDetail: "Wächter der Mitglieder leveln 10 % schneller.",
  },
};

export const ALL_CREW_FACTIONS: CrewFactionId[] = ["pfadfinder","waechterorden","stadtlaeufer","mystiker"];

export const CREW_FACTION_SWITCH_COST_GEMS = 1200;
export const CREW_FACTION_SWITCH_COOLDOWN_DAYS = 30;
