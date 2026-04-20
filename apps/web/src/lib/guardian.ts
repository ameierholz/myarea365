// ═══════════════════════════════════════════════════════════════
// Wächter-System (CoD/RoK-Rework)
// Rarity:   elite / epic / legendary  (common/rare/legend legacy-mapped)
// Typ:      infantry / cavalry / marksman / mage
// Level-Cap 60, 1 Talentpunkt pro Level-Up
// ═══════════════════════════════════════════════════════════════

export type GuardianRarity = "elite" | "epic" | "legendary";
export type LegacyRarity = "common" | "rare" | "legend";
export type AnyRarity = GuardianRarity | LegacyRarity;

export type GuardianType = "infantry" | "cavalry" | "marksman" | "mage";
export type GuardianRole = "dps" | "tank" | "support" | "balanced";

export type GuardianArchetype = {
  id: string;
  name: string;
  emoji: string;
  rarity: AnyRarity;
  guardian_type: GuardianType | null;
  role: GuardianRole | null;
  base_hp: number;
  base_atk: number;
  base_def: number;
  base_spd: number;
  ability_id: string;
  ability_name: string;
  ability_desc: string;
  lore: string | null;
  image_url?: string | null;
  video_url?: string | null;
};

export type CrewGuardian = {
  id: string;
  user_id: string;
  crew_id: string | null;
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
  talent_points_available: number;
  talent_points_spent: number;
  last_respec_at: string | null;
};

export type GuardianWithArchetype = CrewGuardian & { archetype: GuardianArchetype };

// ─────────────────────────────────────────────────────────────
// Legacy-Mapping: alte Werte auf neue spiegeln (DB kann noch common/rare/legend enthalten)
// ─────────────────────────────────────────────────────────────
export function normalizeRarity(r: AnyRarity): GuardianRarity {
  if (r === "common" || r === "rare" || r === "elite") return "elite";
  if (r === "legend" || r === "legendary") return "legendary";
  return "epic";
}

type RarityMeta = { label: string; color: string; glow: string };

// Inklusive Legacy-Werten, damit ältere Callsites (item_catalog, guardian_drops)
// nicht gebrochen werden. Alle Legacy-Werte mappen auf die neue 3-Stufen-Skala.
export const RARITY_META: Record<AnyRarity, RarityMeta> = {
  elite:     { label: "Elite",      color: "#22D1C3", glow: "rgba(34,209,195,0.45)" },
  epic:      { label: "Episch",     color: "#a855f7", glow: "rgba(168,85,247,0.55)" },
  legendary: { label: "Legendär",   color: "#FFD700", glow: "rgba(255,215,0,0.65)" },
  // Legacy — auf neue Skala gespiegelt
  common:    { label: "Elite",      color: "#22D1C3", glow: "rgba(34,209,195,0.45)" },
  rare:      { label: "Elite",      color: "#22D1C3", glow: "rgba(34,209,195,0.45)" },
  legend:    { label: "Legendär",   color: "#FFD700", glow: "rgba(255,215,0,0.65)" },
};

// Legacy-Label-Helper (falls alte Daten noch common/rare/legend haben)
export function rarityMeta(r: AnyRarity) {
  return RARITY_META[normalizeRarity(r)];
}

// ─────────────────────────────────────────────────────────────
// Typen: Stein-Schere-Papier (+25% / -25%)
// Infanterie → Kavallerie → Scharfschütze → Infanterie
// Magier = Wildcard (neutral gegen alle, keine eigenen Counter)
// ─────────────────────────────────────────────────────────────
export const TYPE_META: Record<GuardianType, { label: string; icon: string; color: string }> = {
  infantry: { label: "Infanterie",    icon: "🛡️", color: "#60a5fa" },
  cavalry:  { label: "Kavallerie",    icon: "🐎", color: "#fb923c" },
  marksman: { label: "Scharfschütze", icon: "🏹", color: "#4ade80" },
  mage:     { label: "Magier",        icon: "🔮", color: "#c084fc" },
};

export function typeCounter(attacker: GuardianType, defender: GuardianType): number {
  if (attacker === "mage" || defender === "mage") return 1.0; // Magier neutral
  if (attacker === "infantry" && defender === "cavalry") return 1.25;
  if (attacker === "cavalry"  && defender === "marksman") return 1.25;
  if (attacker === "marksman" && defender === "infantry") return 1.25;
  if (defender === "infantry" && attacker === "cavalry") return 0.75;
  if (defender === "cavalry"  && attacker === "marksman") return 0.75;
  if (defender === "marksman" && attacker === "infantry") return 0.75;
  return 1.0;
}

// ─────────────────────────────────────────────────────────────
// Level-Scaling: jedes Level +6% HP, +4% ATK/DEF, +2% SPD
// (leicht reduziert gegenüber alter Kurve, da Level-Cap verdoppelt)
// ─────────────────────────────────────────────────────────────
export function statsAtLevel(a: GuardianArchetype, level: number) {
  const hpMult  = 1 + (level - 1) * 0.06;
  const atkMult = 1 + (level - 1) * 0.04;
  const defMult = 1 + (level - 1) * 0.04;
  const spdMult = 1 + (level - 1) * 0.02;
  return {
    hp:  Math.round(a.base_hp  * hpMult),
    atk: Math.round(a.base_atk * atkMult),
    def: Math.round(a.base_def * defMult),
    spd: Math.round(a.base_spd * spdMult),
  };
}

export const GUARDIAN_LEVEL_CAP = 60;

// XP bis zum nächsten Level — quadratisch skalierend (wie DB-RPC)
export function xpForLevel(level: number): number {
  return Math.round(100 * Math.pow(level, 1.6));
}

export function levelFromXp(totalXp: number): { level: number; xpInLevel: number; xpToNext: number } {
  let level = 1;
  let remaining = totalXp;
  while (level < GUARDIAN_LEVEL_CAP) {
    const need = xpForLevel(level);
    if (remaining < need) return { level, xpInLevel: remaining, xpToNext: need };
    remaining -= need;
    level++;
  }
  return { level: GUARDIAN_LEVEL_CAP, xpInLevel: 0, xpToNext: 0 };
}

// ─────────────────────────────────────────────────────────────
// Talentbaum: Node-Struktur
// ─────────────────────────────────────────────────────────────
export type TalentBranch = "primary" | "secondary" | "utility";

export type TalentNode = {
  id: string;
  archetype_id: string;
  branch: TalentBranch;
  tier: number;
  slot: number;
  name: string;
  description: string;
  max_rank: number;
  effect_key: string;
  effect_per_rank: number;
  requires_node_id: string | null;
};

export type GuardianTalent = { guardian_id: string; node_id: string; rank: number };

export const BRANCH_META: Record<TalentBranch, { label: string; color: string; icon: string }> = {
  primary:   { label: "Spezialisierung", color: "#FF2D78", icon: "⚔️" },
  secondary: { label: "Typ-Synergie",    color: "#22D1C3", icon: "🔷" },
  utility:   { label: "Utility",         color: "#FFD700", icon: "✨" },
};

// ─────────────────────────────────────────────────────────────
// Skills
// ─────────────────────────────────────────────────────────────
export type SkillSlot = "active" | "passive" | "combat" | "role" | "expertise";

export type ArchetypeSkill = {
  id: string;
  archetype_id: string;
  skill_slot: SkillSlot;
  name: string;
  description: string;
  effect_key: string;
  base_value: number;
  per_level_value: number;
  rage_cost: number;
};

export type GuardianSkillLevel = { guardian_id: string; skill_id: string; level: number };

export const SKILL_SLOT_META: Record<SkillSlot, { label: string; order: number; icon: string }> = {
  active:    { label: "Aktiv",     order: 1, icon: "⚡" },
  passive:   { label: "Passiv",    order: 2, icon: "🛡️" },
  combat:    { label: "Kampf",     order: 3, icon: "⚔️" },
  role:      { label: "Rolle",     order: 4, icon: "🎭" },
  expertise: { label: "Expertise", order: 5, icon: "💎" },
};

// Skill-Upgrade-Kosten (in Siegeln)
export function skillUpgradeCost(currentLevel: number, isExpertise: boolean): number {
  const base = [5, 10, 20, 40, 80][currentLevel] ?? 0;
  return isExpertise ? base * 2 : base;
}

// ─────────────────────────────────────────────────────────────
// Siegel-Typen
// ─────────────────────────────────────────────────────────────
export type SiegelType = "infantry" | "cavalry" | "marksman" | "mage" | "universal";

export const SIEGEL_META: Record<SiegelType, { label: string; icon: string; color: string }> = {
  infantry:  { label: "Infanterie-Siegel",    icon: "🛡️", color: "#60a5fa" },
  cavalry:   { label: "Kavallerie-Siegel",    icon: "🐎", color: "#fb923c" },
  marksman:  { label: "Scharfschützen-Siegel",icon: "🏹", color: "#4ade80" },
  mage:      { label: "Magier-Siegel",        icon: "🔮", color: "#c084fc" },
  universal: { label: "Universal-Siegel",     icon: "⚡", color: "#FFD700" },
};

export type UserSiegel = {
  user_id: string;
  siegel_infantry: number;
  siegel_cavalry: number;
  siegel_marksman: number;
  siegel_mage: number;
  siegel_universal: number;
};

export function siegelForType(inv: UserSiegel | null | undefined, t: GuardianType): number {
  if (!inv) return 0;
  return t === "infantry" ? inv.siegel_infantry
       : t === "cavalry"  ? inv.siegel_cavalry
       : t === "marksman" ? inv.siegel_marksman
       : t === "mage"     ? inv.siegel_mage
       : 0;
}
