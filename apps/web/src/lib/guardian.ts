// ═══════════════════════════════════════════════════════════════
// Wächter-System (CoD/RoK-Rework)
// Rarity:   advanced / elite / epic / legendary  (common/rare/legend legacy-mapped)
// Typ:      infantry / cavalry / marksman / mage / siege / collector
// Faction:  gossenbund / kronenwacht / netzhueter (3 Wächter-Fraktionen, separat vom Spielstil)
// Wellen:   Wächter werden in Wellen released (W0=Pre-Launch, W1=erste Welle …)
// Level-Cap 60, 1 Talentpunkt pro Level-Up
// ═══════════════════════════════════════════════════════════════

export type GuardianRarity = "advanced" | "elite" | "epic" | "legendary";
export type LegacyRarity = "common" | "rare" | "legend";
export type AnyRarity = GuardianRarity | LegacyRarity;

// Wächtertyp = Truppentyp (urban-Banditen-Thema).
// 6 Klassen — 4 Combat (RPS) + 2 non-combat.
export type GuardianType = "infantry" | "cavalry" | "marksman" | "siege" | "collector" | "architect";
export type GuardianRole = "dps" | "tank" | "support" | "balanced";
export type GuardianClassId = "tank" | "support" | "ranged" | "melee";
export type GuardianGender = "male" | "female" | "neutral";
export type GuardianFaction = "gossenbund" | "kronenwacht" | "netzhueter";

export type GuardianArchetype = {
  id: string;
  name: string;
  emoji: string;
  rarity: AnyRarity;
  guardian_type: GuardianType | null;
  class_id?: GuardianClassId | null;
  role: GuardianRole | null;
  species?: string | null;
  gender?: GuardianGender | null;
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
  // RoK/CoD-Rework
  faction?: GuardianFaction | null;
  specialization_tags?: string[] | null;
  troop_capacity_base?: number | null;
  troop_capacity_per_level?: number | null;
  is_flying?: boolean | null;
  wave_number?: number | null;
  released_at?: string | null;
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
  kind?: "eternal" | "seasonal";
  season_id?: string | null;
};

export type GuardianWithArchetype = CrewGuardian & { archetype: GuardianArchetype };

// ─────────────────────────────────────────────────────────────
// Legacy-Mapping: alte Werte auf neue spiegeln (DB kann noch common/rare/legend enthalten)
// ─────────────────────────────────────────────────────────────
export function normalizeRarity(r: AnyRarity): GuardianRarity {
  if (r === "advanced") return "advanced";
  if (r === "common" || r === "rare" || r === "elite") return "elite";
  if (r === "legend" || r === "legendary") return "legendary";
  return "epic";
}

type RarityMeta = { label: string; color: string; glow: string };

// 4 Stufen: Fortgeschritten (grün) / Elite (blau) / Episch (lila) / Legendär (gold)
// Legacy-Werte werden auf neue Skala gespiegelt damit alte Callsites nicht brechen.
export const RARITY_META: Record<AnyRarity, RarityMeta> = {
  advanced:  { label: "Fortgeschritten", color: "#4ade80", glow: "rgba(74,222,128,0.40)" },
  elite:     { label: "Elite",           color: "#60a5fa", glow: "rgba(96,165,250,0.50)" },
  epic:      { label: "Episch",          color: "#a855f7", glow: "rgba(168,85,247,0.55)" },
  legendary: { label: "Legendär",        color: "#FFD700", glow: "rgba(255,215,0,0.65)" },
  // Legacy — auf neue Skala gespiegelt
  common:    { label: "Elite",           color: "#60a5fa", glow: "rgba(96,165,250,0.50)" },
  rare:      { label: "Elite",           color: "#60a5fa", glow: "rgba(96,165,250,0.50)" },
  legend:    { label: "Legendär",        color: "#FFD700", glow: "rgba(255,215,0,0.65)" },
};

// 3 Wächter-Fraktionen (separat vom User-Spielstil — Set-Bonus-System)
// Hinweis: DB-IDs (gossenbund/kronenwacht/netzhueter) bleiben als interne Keys.
// Nur die UI-Labels sind moderne real-life-Begriffe (kein Fantasy/kein Cyberpunk).
export const FACTION_META: Record<GuardianFaction, { label: string; emoji: string; color: string; theme: string }> = {
  gossenbund:  { label: "Untergrund",  emoji: "🔗", color: "#FF6B4A", theme: "Gangs, Slum, Tunnel-Viertel" },
  kronenwacht: { label: "Stadtwache",  emoji: "🛡️", color: "#FFD700", theme: "Polizei, Sicherheit, Etablissement" },
  netzhueter:  { label: "Hacker-Crew", emoji: "💻", color: "#22D1C3", theme: "Tech, Daten, Cyber-Spezialisten" },
};

// Legacy-Label-Helper (falls alte Daten noch common/rare/legend haben)
export function rarityMeta(r: AnyRarity) {
  return RARITY_META[normalizeRarity(r)];
}

// ─────────────────────────────────────────────────────────────
// Wächtertyp-Counter (4-class RPS, +25% / -15%) — spiegelt _class_counter_mult in DB.
// Türsteher > Schütze > Kurier > Brecher > Türsteher
// Sammler + Konstrukteur sind non-combat (keine Counter).
// ─────────────────────────────────────────────────────────────
export const TYPE_META: Record<GuardianType, { label: string; icon: string; color: string }> = {
  infantry:  { label: "Türsteher",    icon: "🥷", color: "#60a5fa" },
  cavalry:   { label: "Kurier",       icon: "🏍️", color: "#fb923c" },
  marksman:  { label: "Schütze",      icon: "🎯", color: "#4ade80" },
  siege:     { label: "Brecher",      icon: "🔨", color: "#f59e0b" },
  collector: { label: "Sammler",      icon: "📦", color: "#22D1C3" },
  architect: { label: "Konstrukteur", icon: "🏗️", color: "#a855f7" },
};

/** Was kontert mein Wächtertyp (return null wenn non-combat). */
export function typeCounters(t: GuardianType): GuardianType | null {
  if (t === "infantry") return "marksman";
  if (t === "marksman") return "cavalry";
  if (t === "cavalry")  return "siege";
  if (t === "siege")    return "infantry";
  return null;
}

/** Was kontert mich (return null wenn non-combat). */
export function typeCounteredBy(t: GuardianType): GuardianType | null {
  if (t === "infantry") return "siege";
  if (t === "marksman") return "infantry";
  if (t === "cavalry")  return "marksman";
  if (t === "siege")    return "cavalry";
  return null;
}

export function typeCounter(attacker: GuardianType, defender: GuardianType): number {
  if (typeCounters(attacker) === defender) return 1.25;
  if (typeCounteredBy(attacker) === defender) return 0.85;
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
       : t === "siege" || t === "collector" || t === "architect" ? inv.siegel_universal
       : 0;
}
