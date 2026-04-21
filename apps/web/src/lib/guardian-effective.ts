// Pure compute: effektive Wächter-Stats aus Basis + Level + Talenten + Skills + Equipment
// Mirrors battle-engine buildCombatant (ohne archetype-spezifische Passivboni-Anwendung in Runde 0).

import { statsAtLevel, type GuardianArchetype, type GuardianType } from "@/lib/guardian";

export type SkillLevelRow = { skill_id: string; level: number };
export type ArchetypeSkillRow = { id: string; skill_slot: "active" | "passive" | "combat" | "role" | "expertise" };
export type TalentRow = { node_id: string; rank: number };
export type TalentNodeRow = { id: string; effect_key: string; effect_per_rank: number };

export type EffectiveStats = {
  base: { hp: number; atk: number; def: number; spd: number };
  equipment: { hp: number; atk: number; def: number; spd: number };
  effective: { hp: number; atk: number; def: number; spd: number };
  // Delta zum Basis-Wert in absoluten Punkten (für UI „+X")
  delta: { hp: number; atk: number; def: number; spd: number };
  // Talent-/Skill-Prozent-Summen zur Transparenz
  bonusPct: { hp: number; atk: number; def: number; spd: number; crit: number };
};

const EMPTY_EQUIP = { hp: 0, atk: 0, def: 0, spd: 0 };

export function computeEffectiveStats(
  archetype: GuardianArchetype,
  level: number,
  skillRows: SkillLevelRow[],
  skillCatalog: ArchetypeSkillRow[],
  talentRows: TalentRow[],
  talentNodes: TalentNodeRow[],
  equipment: { hp: number; atk: number; def: number; spd: number } = EMPTY_EQUIP,
): EffectiveStats {
  const base = statsAtLevel(archetype, level);

  // Skill-Slot-Mapping
  const slotByScenario: Record<string, "active" | "passive" | "combat" | "role" | "expertise"> = {};
  for (const s of skillCatalog) slotByScenario[s.id] = s.skill_slot;
  const skillLvl = { active: 0, passive: 0, combat: 0, role: 0, expertise: 0 };
  for (const r of skillRows) {
    const slot = slotByScenario[r.skill_id];
    if (slot) skillLvl[slot] = Math.max(skillLvl[slot], r.level);
  }

  // Talent-Aggregation
  const nodeById: Record<string, TalentNodeRow> = {};
  for (const n of talentNodes) nodeById[n.id] = n;
  const tal = {
    hp_pct: 0, atk_pct: 0, def_pct: 0, spd_pct: 0,
    crit_pct: 0, all_stats_pct: 0,
  };
  for (const row of talentRows) {
    if (row.rank <= 0) continue;
    const node = nodeById[row.node_id];
    if (!node) continue;
    const eff = Number(node.effect_per_rank ?? 0) * row.rank;
    switch (node.effect_key) {
      case "hp_pct":  tal.hp_pct  += eff; break;
      case "atk_pct": tal.atk_pct += eff; break;
      case "def_pct": tal.def_pct += eff; break;
      case "spd_pct": tal.spd_pct += eff; break;
      case "crit_pct":
      case "crit_chance": tal.crit_pct += eff; break;
      case "all_stats_pct":
        tal.hp_pct += eff; tal.atk_pct += eff; tal.def_pct += eff; tal.spd_pct += eff; break;
      default: break;
    }
  }

  // Passive-Skill-Typ-Bonus (mirror engine)
  let passiveDefBonus = 0, passiveSpdBonus = 0, passiveCrit = 0;
  const typ = archetype.guardian_type as GuardianType | null;
  if (skillLvl.passive > 0) {
    if      (typ === "infantry") passiveDefBonus = 0.03 * skillLvl.passive;
    else if (typ === "cavalry")  passiveSpdBonus = 0.03 * skillLvl.passive;
    else if (typ === "marksman") passiveCrit     = 0.02 * skillLvl.passive;
    // mage → skill_dmg (nicht in HP/ATK/DEF/SPD sichtbar)
  }

  const hp  = Math.round((base.hp  + equipment.hp)  * (1 + tal.hp_pct));
  const atk = Math.round((base.atk + equipment.atk) * (1 + tal.atk_pct));
  const def = Math.round((base.def + equipment.def) * (1 + tal.def_pct) * (1 + passiveDefBonus));
  const spd = Math.round((base.spd + equipment.spd) * (1 + tal.spd_pct) * (1 + passiveSpdBonus));

  return {
    base,
    equipment,
    effective: { hp, atk, def, spd },
    delta: { hp: hp - base.hp, atk: atk - base.atk, def: def - base.def, spd: spd - base.spd },
    bonusPct: {
      hp: tal.hp_pct,
      atk: tal.atk_pct,
      def: tal.def_pct + passiveDefBonus,
      spd: tal.spd_pct + passiveSpdBonus,
      crit: tal.crit_pct + passiveCrit,
    },
  };
}
