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
};

const EMPTY_SKILLS: SkillLevels = { active: 0, passive: 0, combat: 0, role: 0, expertise: 0 };
const EMPTY_TALENTS: TalentBonuses = {
  hp_pct: 0, atk_pct: 0, def_pct: 0, spd_pct: 0,
  crit_pct: 0, crit_dmg: 0, dmg_reduction: 0, evade_pct: 0, start_rage: 0,
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
      // Unterstützte aber engine-seitig (noch) nicht verarbeitete Keys werden ignoriert:
      // rage_gen, regen_pct, thorns_pct, heal_on_hit, counter_pct, stun_resist, dot_dmg,
      // pen_pct, r1_atk_pct, late_atk, debuff_cleanse, skill_dmg, vs_*, *_key
      default: break;
    }
  }

  return { skill_levels: skills, talent_bonuses: talents };
}
