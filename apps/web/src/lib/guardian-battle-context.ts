// Lädt Skill-Level + Talent-Bonuses eines Wächters für die Battle-Engine.
// Aggregiert talent_nodes.effect_key × rank × effect_per_rank zu BattleInput-tauglichen Feldern.

import type { SupabaseClient } from "@supabase/supabase-js";

export type SkillLevels = {
  active: number;
  passive: number;
  combat: number;
  role: number;
  expertise: number;
};

export type TalentBonuses = {
  hp_pct: number;
  atk_pct: number;
  def_pct: number;
  spd_pct: number;
  crit_pct: number;
  crit_dmg: number;
  dmg_reduction: number;
  evade_pct: number;
  start_rage: number;
  regen_pct: number;
  thorns_pct: number;
  heal_on_hit: number;
  counter_pct: number;
  skill_dmg: number;
  r1_atk_pct: number;
  late_atk: number;
  rage_gen: number;
  pen_pct: number;
  dot_dmg: number;
  vs_full_hp: number;
  vs_weak: number;
  vs_infantry: number;
  vs_cavalry: number;
  vs_marksman: number;
  vs_mage: number;
  stun_resist: number;
  debuff_cleanse: number;
  berserker_key: number;
  bollwerk_key: number;
  awaken_key: number;
  symbiose_key: number;
};

const EMPTY_SKILLS: SkillLevels = { active: 0, passive: 0, combat: 0, role: 0, expertise: 0 };
const EMPTY_TALENTS: TalentBonuses = {
  hp_pct: 0, atk_pct: 0, def_pct: 0, spd_pct: 0,
  crit_pct: 0, crit_dmg: 0, dmg_reduction: 0, evade_pct: 0, start_rage: 0,
  regen_pct: 0, thorns_pct: 0, heal_on_hit: 0, counter_pct: 0, skill_dmg: 0,
  r1_atk_pct: 0, late_atk: 0, rage_gen: 0, pen_pct: 0, dot_dmg: 0, vs_full_hp: 0, vs_weak: 0,
  vs_infantry: 0, vs_cavalry: 0, vs_marksman: 0, vs_mage: 0,
  stun_resist: 0, debuff_cleanse: 0,
  berserker_key: 0, bollwerk_key: 0, awaken_key: 0, symbiose_key: 0,
};

/**
 * Lädt Skill-Levels (0-5) über alle 5 Slots und aggregierte Talent-Bonuses.
 * Rückgabe nutzt ausschließlich Keys, die die Engine aktuell unterstützt.
 * `all_stats_pct` wird gleichmäßig auf hp/atk/def/spd verteilt.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadGuardianBattleContext(sb: SupabaseClient<any, any, any>, guardianId: string): Promise<{ skill_levels: SkillLevels; talent_bonuses: TalentBonuses }> {
  const [{ data: skillRows }, { data: talentRows }] = await Promise.all([
    sb.from("guardian_skill_levels")
      .select("level, skill_id, archetype_skills!inner(skill_slot)")
      .eq("guardian_id", guardianId),
    sb.from("guardian_talents")
      .select("rank, talent_nodes!inner(effect_key, effect_per_rank)")
      .eq("guardian_id", guardianId)
      .gt("rank", 0),
  ]);

  const skills: SkillLevels = { ...EMPTY_SKILLS };
  for (const row of (skillRows ?? []) as unknown as Array<{ level: number; archetype_skills: { skill_slot: keyof SkillLevels } }>) {
    const slot = row.archetype_skills?.skill_slot;
    if (slot && slot in skills) skills[slot] = Math.max(skills[slot], row.level ?? 0);
  }

  const talents: TalentBonuses = { ...EMPTY_TALENTS };
  for (const row of (talentRows ?? []) as unknown as Array<{ rank: number; talent_nodes: { effect_key: string; effect_per_rank: number } }>) {
    const key = row.talent_nodes?.effect_key;
    const eff = Number(row.talent_nodes?.effect_per_rank ?? 0) * (row.rank ?? 0);
    if (!key || !eff) continue;
    switch (key) {
      case "hp_pct":         talents.hp_pct        += eff; break;
      case "atk_pct":        talents.atk_pct       += eff; break;
      case "def_pct":        talents.def_pct       += eff; break;
      case "spd_pct":        talents.spd_pct       += eff; break;
      case "crit_pct":
      case "crit_chance":    talents.crit_pct      += eff; break;
      case "crit_dmg":       talents.crit_dmg      += eff; break;
      case "dmg_reduction":  talents.dmg_reduction += eff; break;
      case "evade_pct":
      case "evade":          talents.evade_pct     += eff; break;
      case "start_rage":     talents.start_rage    += eff; break;
      case "all_stats_pct":
        talents.hp_pct  += eff;
        talents.atk_pct += eff;
        talents.def_pct += eff;
        talents.spd_pct += eff;
        break;
      case "regen_pct":    talents.regen_pct    += eff; break;
      case "thorns_pct":   talents.thorns_pct   += eff; break;
      case "heal_on_hit":  talents.heal_on_hit  += eff; break;
      case "counter_pct":  talents.counter_pct  += eff; break;
      case "skill_dmg":    talents.skill_dmg    += eff; break;
      case "r1_atk_pct":   talents.r1_atk_pct   += eff; break;
      case "late_atk":     talents.late_atk     += eff; break;
      case "rage_gen":     talents.rage_gen     += eff; break;
      case "pen_pct":      talents.pen_pct      += eff; break;
      case "dot_dmg":      talents.dot_dmg      += eff; break;
      case "vs_full_hp":    talents.vs_full_hp    += eff; break;
      case "vs_weak":       talents.vs_weak       += eff; break;
      case "vs_infantry":   talents.vs_infantry   += eff; break;
      case "vs_cavalry":    talents.vs_cavalry    += eff; break;
      case "vs_marksman":   talents.vs_marksman   += eff; break;
      case "vs_mage":       talents.vs_mage       += eff; break;
      case "stun_resist":   talents.stun_resist   += eff; break;
      case "debuff_cleanse":talents.debuff_cleanse+= eff; break;
      // Keystone-Flags (rank>0 aktiviert, effect_per_rank ist 1.0 = Flag)
      case "berserker_key": talents.berserker_key += eff; break;
      case "bollwerk_key":  talents.bollwerk_key  += eff; break;
      case "awaken_key":    talents.awaken_key    += eff; break;
      case "symbiose_key":  talents.symbiose_key  += eff; break;
      default: break;
    }
  }

  return { skill_levels: skills, talent_bonuses: talents };
}
