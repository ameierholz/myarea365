// Klassen-System fuer Waechter (ersetzt perspektivisch infantry/cavalry/marksman/mage).
// Counter-Kette: Tank > Melee > Support > Ranged > Tank
// Jeder Buff wirkt passiv sobald ein Waechter der Klasse aktiv ist bzw. im Team steht.

export type GuardianClass = "tank" | "support" | "ranged" | "melee";

export type ClassMeta = {
  id: GuardianClass;
  label: string;
  icon: string;
  color: string;
  buff_name: string;
  buff_desc: string;
  counter: GuardianClass;      // diese Klasse schlaegt (1.25x)
  sub_archetypes: string[];    // Beispiel-Namenswelten fuer Waechter-Archetypen
};

export const GUARDIAN_CLASSES: Record<GuardianClass, ClassMeta> = {
  tank: {
    id: "tank",
    label: "Tank",
    icon: "🛡️",
    color: "#60a5fa",
    buff_name: "Bollwerk",
    buff_desc: "+20% DEF · +10% HP · −30% Schaden von Nahkämpfern",
    counter: "melee",
    sub_archetypes: ["Krieger", "Ritter", "Paladin", "Berserker"],
  },
  support: {
    id: "support",
    label: "Support",
    icon: "✨",
    color: "#a855f7",
    buff_name: "Segen",
    buff_desc: "Heilt aktive Verbündete +5% HP pro Runde · +15% Team-DEF-Aura",
    counter: "ranged",
    sub_archetypes: ["Priester", "Schamane", "Kleriker", "Orakel"],
  },
  ranged: {
    id: "ranged",
    label: "Fernkampf",
    icon: "🏹",
    color: "#4ade80",
    buff_name: "Präzision",
    buff_desc: "+20% Krit-Chance · Erstschlag in Runde 1",
    counter: "tank",
    sub_archetypes: ["Magier", "Bogenschütze", "Hexer", "Runenmeister"],
  },
  melee: {
    id: "melee",
    label: "Nahkampf",
    icon: "⚔️",
    color: "#FF6B4A",
    buff_name: "Blutrausch",
    buff_desc: "+25% ATK · +10% SPD · Blutung 3 Runden (DoT)",
    counter: "support",
    sub_archetypes: ["Schurke", "Mönch", "Samurai", "Ninja"],
  },
};

export function classCounter(attacker: GuardianClass | null | undefined, defender: GuardianClass | null | undefined): number {
  if (!attacker || !defender || attacker === defender) return 1.0;
  if (GUARDIAN_CLASSES[attacker].counter === defender) return 1.25;
  if (GUARDIAN_CLASSES[defender].counter === attacker) return 0.75;
  return 1.0;
}

// Mapping Legacy guardian_type → neue Klasse (best-effort).
// Wird nach dem 60-Archetyp-Rename obsolet.
export function legacyTypeToClass(t: string | null | undefined): GuardianClass | null {
  switch (t) {
    case "infantry": return "tank";
    case "cavalry":  return "melee";
    case "marksman": return "ranged";
    case "mage":     return "ranged";
    default:         return null;
  }
}
