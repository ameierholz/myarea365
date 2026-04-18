export type GuardianRarity = "common" | "rare" | "epic" | "legend";

export type GuardianArchetype = {
  id: string;
  name: string;
  emoji: string;
  rarity: GuardianRarity;
  base_hp: number;
  base_atk: number;
  base_def: number;
  base_spd: number;
  ability_id: string;
  ability_name: string;
  ability_desc: string;
  lore: string | null;
};

export type CrewGuardian = {
  id: string;
  crew_id: string;
  archetype_id: string;
  custom_name: string | null;
  level: number;
  xp: number;
  wins: number;
  losses: number;
  current_hp_pct: number;
  wounded_until: string | null;
  is_active: boolean;
  acquired_at: string;
  source: "initial" | "captured" | "fused" | "purchased";
};

export type GuardianWithArchetype = CrewGuardian & { archetype: GuardianArchetype };

export const RARITY_META: Record<GuardianRarity, { label: string; color: string; glow: string }> = {
  common: { label: "Gewöhnlich", color: "#8B8FA3", glow: "rgba(139,143,163,0.35)" },
  rare:   { label: "Selten",     color: "#22D1C3", glow: "rgba(34,209,195,0.45)" },
  epic:   { label: "Episch",     color: "#a855f7", glow: "rgba(168,85,247,0.55)" },
  legend: { label: "Legendär",   color: "#FFD700", glow: "rgba(255,215,0,0.65)" },
};

// Level-Scaling: jedes Level +8% HP, +6% ATK/DEF, +3% SPD
export function statsAtLevel(a: GuardianArchetype, level: number) {
  const hpMult  = 1 + (level - 1) * 0.08;
  const atkMult = 1 + (level - 1) * 0.06;
  const defMult = 1 + (level - 1) * 0.06;
  const spdMult = 1 + (level - 1) * 0.03;
  return {
    hp:  Math.round(a.base_hp  * hpMult),
    atk: Math.round(a.base_atk * atkMult),
    def: Math.round(a.base_def * defMult),
    spd: Math.round(a.base_spd * spdMult),
  };
}

// XP bis zum nächsten Level — quadratisch skalierend
export function xpForLevel(level: number): number {
  return Math.round(100 * Math.pow(level, 1.6));
}

export function levelFromXp(totalXp: number): { level: number; xpInLevel: number; xpToNext: number } {
  let level = 1;
  let remaining = totalXp;
  while (level < 30) {
    const need = xpForLevel(level);
    if (remaining < need) return { level, xpInLevel: remaining, xpToNext: need };
    remaining -= need;
    level++;
  }
  return { level: 30, xpInLevel: 0, xpToNext: 0 };
}
