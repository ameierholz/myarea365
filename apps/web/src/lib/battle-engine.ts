/**
 * Deterministische Kampf-Engine (CoD-Style Rage-System).
 * Gleicher Seed + gleiche Inputs → gleicher Ausgang.
 * Läuft server-seitig (verifizierbar) und client-seitig (für Replay-Animation).
 *
 * Mechanik:
 *   • Runden-basiert (max 15 Runden, sonst HP-Vergleich)
 *   • Typ-Counter: ±25% Schaden (Infanterie → Kavallerie → Scharfschütze → Infanterie, Magier neutral)
 *   • Rage-Bar 0-1000: Angriff +100, erlittener Treffer +50, bei 1000 triggert Aktiv-Skill
 *   • Talent-Stats werden flach als item_bonuses reingereicht (API-Schicht berechnet aus talents+equipment)
 */

import { statsAtLevel, typeCounter, type GuardianArchetype, type GuardianType } from "@/lib/guardian";

export type BattleInput = {
  guardian: {
    id: string;
    level: number;
    current_hp_pct: number;
    archetype: GuardianArchetype;
  };
  is_home: boolean;
  crew_member_count: number;
  item_bonuses?: { hp: number; atk: number; def: number; spd: number };
  // CoD-Ergänzungen:
  skill_levels?: Partial<Record<"active" | "passive" | "combat" | "role" | "expertise", number>>;
  talent_bonuses?: {
    hp_pct?: number; atk_pct?: number; def_pct?: number; spd_pct?: number;
    crit_pct?: number; crit_dmg?: number; dmg_reduction?: number; evade_pct?: number;
    start_rage?: number;
    // Ergänzte Keys (seit Talent-Engine-Erweiterung)
    regen_pct?: number;         // Heilt X% von HpMax pro Runde
    thorns_pct?: number;        // X% erlittenen Schaden zurück an Angreifer
    heal_on_hit?: number;       // X% des ausgeteilten Schadens als Heilung
    counter_pct?: number;       // Chance X einen Konter-Angriff auszulösen
    skill_dmg?: number;         // +X% Schaden auf Active/Expertise-Skill
    r1_atk_pct?: number;        // +X% ATK nur in Runde 1
    late_atk?: number;          // +X% ATK ab Runde 6
    rage_gen?: number;          // +X% Rage-Generierung
    pen_pct?: number;           // Ignoriert X% der gegnerischen DEF
    dot_dmg?: number;           // +X% auf DoT-Ticks (Gift, Flamme)
    vs_full_hp?: number;        // +X% Schaden wenn Gegner auf >95% HP
    vs_weak?: number;           // +X% Schaden wenn Gegner <50% HP (Coup de Grâce)
    vs_infantry?: number;
    vs_cavalry?: number;
    vs_marksman?: number;
    vs_mage?: number;
    stun_resist?: number;       // Chance X Stuns zu widerstehen
    debuff_cleanse?: number;    // Chance X pro Runde Debuffs abzuschütteln
    // Keystone-Talente (archetyp-spezifisch, boolean-like — rank>0 = aktiv)
    berserker_key?: number;     // HP<30% → +50% ATK (DPS)
    bollwerk_key?: number;      // 1× pro Kampf: absorbiert tödlichen Treffer (Tank)
    awaken_key?: number;        // 1× pro Kampf: volle Rage zu Runde 3 (Support)
    symbiose_key?: number;      // HP 40-60% → +10% aller Stats (Balanced)
  };
};

export type SideStatus = {
  poisonStacks: number;
  stunned: boolean;
  bollwerkReady: boolean;  // Bollwerk-Keystone noch verfügbar
  awakenReady: boolean;    // Erwachen-Keystone noch verfügbar
  inBerserker: boolean;    // HP<30% UND Berserker-Keystone aktiv
  inSymbiose: boolean;     // HP 40-60% UND Symbiose-Keystone aktiv
  phoenixReady: boolean;   // Wiedergeburt-Ability verfügbar
  nineLivesReady: boolean; // Neun-Leben-Ability verfügbar
};

export type RoundEvent = {
  round: number;
  actor: "A" | "B";
  action: string;            // "attack" | "special" | "heal" | "miss" | "crit" | "ult" | "flame" | "poison" | "revive" | "stunned"
  damage: number;
  hp_a_after: number;
  hp_b_after: number;
  rage_a_after?: number;
  rage_b_after?: number;
  note?: string;
  status_a?: SideStatus;
  status_b?: SideStatus;
};

export type BattleResult = {
  winner: "A" | "B" | "draw";
  rounds: RoundEvent[];
  final_hp_a: number;
  final_hp_b: number;
  xp_awarded: number;
  type_advantage: "A" | "B" | "neutral";
};

// Mulberry32 PRNG
function patchStatusFrom(rounds: RoundEvent[], fromIdx: number, ca: Combatant, cb: Combatant): void {
  const sa = snapshotStatus(ca);
  const sb = snapshotStatus(cb);
  for (let i = fromIdx; i < rounds.length; i++) {
    if (!rounds[i].status_a) rounds[i].status_a = sa;
    if (!rounds[i].status_b) rounds[i].status_b = sb;
  }
}

function snapshotStatus(c: Combatant): SideStatus {
  const hpPct = c.hp / c.hpMax;
  return {
    poisonStacks: c.state.poisonStacks,
    stunned: c.state.stunned,
    bollwerkReady: c.talents.bollwerkKey && !c.state.bollwerkUsed,
    awakenReady: c.talents.awakenKey && !c.state.awakenUsed,
    inBerserker: c.talents.berserkerKey && hpPct < 0.3,
    inSymbiose: c.talents.symbioseKey && hpPct >= 0.4 && hpPct <= 0.6,
    phoenixReady: c.abilityId === "rebirth" && !c.state.phoenixUsed,
    nineLivesReady: c.abilityId === "nineleaves" && !c.state.nineLivesUsed,
  };
}

function mulberry32(seed: number): () => number {
  let t = seed;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (Math.imul(r + ((r ^ (r >>> 7)) >>> 0), 61 | r) ^ r) >>> 0;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

type Combatant = {
  label: "A" | "B";
  id: string;
  hp: number;
  hpMax: number;
  atk: number;
  def: number;
  spd: number;
  abilityId: string;
  archetypeType: GuardianType | null;
  // Skill-Stufen (0-5)
  skillLvl: { active: number; passive: number; combat: number; role: number; expertise: number };
  // Talent-Buffs
  talents: {
    critPct: number;
    critDmg: number;
    dmgReduction: number;
    evadePct: number;
    regenPct: number;
    thornsPct: number;
    healOnHit: number;
    counterPct: number;
    skillDmg: number;
    r1AtkPct: number;
    lateAtk: number;
    rageGen: number;
    penPct: number;
    dotDmg: number;
    vsFullHp: number;
    vsWeak: number;
    vsType: Partial<Record<GuardianType, number>>;
    stunResist: number;
    debuffCleanse: number;
    berserkerKey: boolean;
    bollwerkKey: boolean;
    awakenKey: boolean;
    symbioseKey: boolean;
  };
  // Rage
  rage: number;
  rageMax: number;
  ultFired: boolean;
  // Legacy Ability-State
  state: {
    rageStacks: number;
    poisonStacks: number;
    phoenixUsed: boolean;
    stunned: boolean;
    nineLivesUsed: boolean;
    bollwerkUsed: boolean;
    awakenUsed: boolean;
  };
  isHome: boolean;
  crewCount: number;
  role: string | null;
};

function pctBonus(val: number | undefined, base: number): number {
  if (!val) return base;
  return base * (1 + val);
}

function buildCombatant(label: "A" | "B", input: BattleInput): Combatant {
  const s = statsAtLevel(input.guardian.archetype, input.guardian.level);
  const b = input.item_bonuses ?? { hp: 0, atk: 0, def: 0, spd: 0 };
  const t = input.talent_bonuses ?? {};
  const sk = input.skill_levels ?? {};

  // Skill-Passive: +X% auf Stats je nach Typ
  const passiveLvl = sk.passive ?? 0;
  let passiveDefBonus = 0, passiveSpdBonus = 0, passiveCrit = 0, passiveSkillDmg = 0;
  const typ = input.guardian.archetype.guardian_type;
  if (passiveLvl > 0) {
    if (typ === "infantry") passiveDefBonus = 0.03 * passiveLvl;
    else if (typ === "cavalry") passiveSpdBonus = 0.03 * passiveLvl;
    else if (typ === "marksman") passiveCrit = 0.02 * passiveLvl;
    else if (typ === "mage") passiveSkillDmg = 0.03 * passiveLvl;
  }

  const hpMax = Math.round(pctBonus(t.hp_pct, s.hp + b.hp));
  const hpStart = Math.max(1, Math.round(hpMax * (input.guardian.current_hp_pct / 100)));
  const atk = Math.round(pctBonus(t.atk_pct, s.atk + b.atk));
  const def = Math.round(pctBonus(t.def_pct, s.def + b.def) * (1 + passiveDefBonus));
  const spd = Math.round(pctBonus(t.spd_pct, s.spd + b.spd) * (1 + passiveSpdBonus));

  const startRage = Math.min(500, t.start_rage ?? 0);

  return {
    label,
    id: input.guardian.id,
    hp: hpStart,
    hpMax,
    atk,
    def,
    spd,
    abilityId: input.guardian.archetype.ability_id,
    archetypeType: typ,
    role: input.guardian.archetype.role,
    skillLvl: {
      active: sk.active ?? 0,
      passive: passiveLvl,
      combat: sk.combat ?? 0,
      role: sk.role ?? 0,
      expertise: sk.expertise ?? 0,
    },
    talents: {
      critPct: (t.crit_pct ?? 0) + passiveCrit,
      critDmg: t.crit_dmg ?? 0,
      dmgReduction: t.dmg_reduction ?? 0,
      evadePct: t.evade_pct ?? 0,
      regenPct: t.regen_pct ?? 0,
      thornsPct: t.thorns_pct ?? 0,
      healOnHit: t.heal_on_hit ?? 0,
      counterPct: t.counter_pct ?? 0,
      skillDmg: (t.skill_dmg ?? 0) + passiveSkillDmg,
      r1AtkPct: t.r1_atk_pct ?? 0,
      lateAtk: t.late_atk ?? 0,
      rageGen: t.rage_gen ?? 0,
      penPct: t.pen_pct ?? 0,
      dotDmg: t.dot_dmg ?? 0,
      vsFullHp: t.vs_full_hp ?? 0,
      vsWeak: t.vs_weak ?? 0,
      vsType: {
        infantry: t.vs_infantry ?? 0,
        cavalry:  t.vs_cavalry  ?? 0,
        marksman: t.vs_marksman ?? 0,
        mage:     t.vs_mage     ?? 0,
      },
      stunResist: t.stun_resist ?? 0,
      debuffCleanse: t.debuff_cleanse ?? 0,
      berserkerKey: (t.berserker_key ?? 0) > 0,
      bollwerkKey:  (t.bollwerk_key  ?? 0) > 0,
      awakenKey:    (t.awaken_key    ?? 0) > 0,
      symbioseKey:  (t.symbiose_key  ?? 0) > 0,
    },
    rage: startRage,
    rageMax: 1000,
    ultFired: false,
    state: { rageStacks: 0, poisonStacks: 0, phoenixUsed: false, stunned: false, nineLivesUsed: false, bollwerkUsed: false, awakenUsed: false },
    isHome: input.is_home,
    crewCount: input.crew_member_count,
  };
}

/** Rollen-Skill: +X% Schaden gegen bestimmte Typen */
function roleBonus(attacker: Combatant, defender: Combatant): number {
  const lvl = attacker.skillLvl.role;
  if (lvl === 0 || !attacker.archetypeType || !defender.archetypeType) return 1.0;
  const per = attacker.archetypeType === "mage" ? 0.02 : 0.03;
  if (attacker.archetypeType === "infantry" && defender.archetypeType === "cavalry") return 1 + lvl * per;
  if (attacker.archetypeType === "cavalry" && defender.archetypeType === "marksman") return 1 + lvl * per;
  if (attacker.archetypeType === "marksman" && defender.archetypeType === "infantry") return 1 + lvl * per;
  if (attacker.archetypeType === "mage") return 1 + lvl * per;
  return 1.0;
}

function computeDamage(
  attacker: Combatant, defender: Combatant, rng: () => number, round: number
): { dmg: number; crit: boolean; note?: string; evaded?: boolean } {
  let atk = attacker.atk;
  let def = defender.def;
  let crit = false;
  let note: string | undefined;

  // Defender: Ausweichen (Talent + ability "evade")
  if (defender.talents.evadePct > 0 && rng() < defender.talents.evadePct) {
    return { dmg: 0, crit: false, note: "Ausgewichen (Talent)", evaded: true };
  }
  if (defender.abilityId === "evade" && rng() < 0.2) {
    return { dmg: 0, crit: false, note: "Ausgewichen!", evaded: true };
  }

  // Attacker Ability-Modifiers (Legacy-Set)
  switch (attacker.abilityId) {
    case "firststrike":
      if (round === 1) { atk *= 2; crit = true; note = "Erstschlag!"; }
      break;
    case "ambush":
      if (round === 1) { atk *= 1.5; note = "Hinterhalt!"; }
      break;
    case "nightsight": {
      const hour = new Date().getUTCHours() + 1;
      if (hour >= 20 || hour < 6) { atk *= 1.3; note = "Nachtsicht"; }
      break;
    }
    case "loyal":
      if (attacker.hp / attacker.hpMax < 0.5) { atk *= 1.15; note = "Treuer Biss"; }
      break;
    case "pack":
      atk *= 1 + Math.min(0.5, attacker.crewCount * 0.1);
      if (attacker.crewCount > 0) note = `Rudel (${attacker.crewCount})`;
      break;
    case "fortress":
      if (attacker.isHome) { /* DEF-Bonus bei Defender separat */ }
      break;
    case "rage":
      atk *= 1 + Math.min(0.4, attacker.state.rageStacks * 0.05);
      if (attacker.state.rageStacks > 0) note = `Wut ${attacker.state.rageStacks}`;
      break;
    case "focus":
      if (rng() < 0.25) { def *= 0.5; crit = true; note = "Fokus-Krit"; }
      break;
    case "stealth":
      if (rng() < 0.25) { atk *= 2; note = "Doppelschlag!"; }
      break;
    case "swarm":
      if (round === 1) { atk *= 2; note = "Schwarm"; }
      break;
  }

  // Defender ability modifiers
  switch (defender.abilityId) {
    case "wall":
      if (round === 1) { def *= 1.2; note = (note ? note + " · " : "") + "Bollwerk"; }
      break;
    case "fortress":
      if (defender.isHome) def *= 1.3;
      break;
  }

  // Krit-Check (Basis 10% + Talent-Bonus)
  const critChance = 0.10 + attacker.talents.critPct;
  if (!crit && rng() < critChance) crit = true;
  const critMult = crit ? (1.5 + attacker.talents.critDmg) : 1;

  // Typ-Counter (±25%)
  let typeMult = 1.0;
  if (attacker.archetypeType && defender.archetypeType) {
    typeMult = typeCounter(attacker.archetypeType, defender.archetypeType);
    if (typeMult > 1.0) note = (note ? note + " · " : "") + "Typ-Vorteil";
    else if (typeMult < 1.0) note = (note ? note + " · " : "") + "Typ-Nachteil";
  }

  // Rollen-Skill-Bonus
  const roleMult = roleBonus(attacker, defender);

  // DMG-Reduktion (Talent)
  const reduction = 1 - (defender.talents.dmgReduction ?? 0);

  // r1_atk_pct / late_atk — Runden-basierte ATK-Talente
  if (round === 1 && attacker.talents.r1AtkPct > 0) atk *= 1 + attacker.talents.r1AtkPct;
  if (round >= 6 && attacker.talents.lateAtk > 0) atk *= 1 + attacker.talents.lateAtk;

  // Keystone: Berserker — HP<30% → +50% ATK (DPS)
  if (attacker.talents.berserkerKey && attacker.hp / attacker.hpMax < 0.3) {
    atk *= 1.5;
    note = (note ? note + " · " : "") + "🔥 Berserker";
  }

  // Keystone: Symbiose — HP 40-60% → +10% aller Stats (Balanced)
  const attHpPct = attacker.hp / attacker.hpMax;
  if (attacker.talents.symbioseKey && attHpPct >= 0.4 && attHpPct <= 0.6) {
    atk *= 1.1;
  }
  const defHpPct = defender.hp / defender.hpMax;
  if (defender.talents.symbioseKey && defHpPct >= 0.4 && defHpPct <= 0.6) {
    def *= 1.1;
  }

  // vs_full_hp — Bonus gegen volle HP
  if (defender.hp / defender.hpMax > 0.95 && attacker.talents.vsFullHp > 0) {
    atk *= 1 + attacker.talents.vsFullHp;
    note = (note ? note + " · " : "") + "Erster Treffer";
  }

  // vs_weak — Coup de Grâce gegen verwundete Gegner
  if (defender.hp / defender.hpMax < 0.5 && attacker.talents.vsWeak > 0) {
    atk *= 1 + attacker.talents.vsWeak;
    note = (note ? note + " · " : "") + "Gnadenstoß";
  }

  // vs_TYP — Typ-spezifischer Bonus (zusätzlich zu Typ-Counter)
  if (defender.archetypeType) {
    const typBonus = attacker.talents.vsType[defender.archetypeType] ?? 0;
    if (typBonus > 0) atk *= 1 + typBonus;
  }

  // Penetration (Talent) — ignoriert X% DEF
  if (attacker.talents.penPct > 0) def *= Math.max(0, 1 - attacker.talents.penPct);

  // Formel: atk*crit*typ*role*reduction - def/2, min 1
  const raw = atk * critMult * typeMult * roleMult * reduction - def / 2;
  const dmg = Math.max(1, Math.round(raw));
  return { dmg, crit, note };
}

function applyDot(c: Combatant, source: Combatant, rounds: RoundEvent[], roundNum: number): void {
  const dotAmp = 1 + (source.talents.dotDmg ?? 0);
  if (source.abilityId === "flame") {
    const burn = Math.round(c.hpMax * 0.1 * dotAmp);
    c.hp = Math.max(0, c.hp - burn);
    rounds.push({
      round: roundNum, actor: source.label, action: "flame", damage: burn,
      hp_a_after: source.label === "A" ? source.hp : c.hp,
      hp_b_after: source.label === "B" ? source.hp : c.hp,
      note: "🔥 Flamme",
    });
  }
  if (source.abilityId === "poison" && c.state.poisonStacks < 3) {
    c.state.poisonStacks++;
  }
  if (c.state.poisonStacks > 0 && source.abilityId === "poison") {
    const pois = Math.round(c.hpMax * 0.05 * c.state.poisonStacks * dotAmp);
    c.hp = Math.max(0, c.hp - pois);
    rounds.push({
      round: roundNum, actor: source.label, action: "poison", damage: pois,
      hp_a_after: source.label === "A" ? source.hp : c.hp,
      hp_b_after: source.label === "B" ? source.hp : c.hp,
      note: `☠️ Gift ×${c.state.poisonStacks}`,
    });
  }
}

function checkSurvival(c: Combatant, rounds: RoundEvent[], round: number): void {
  if (c.hp > 0) return;
  // Keystone: Bollwerk — 1× pro Kampf tödlichen Treffer auf 1 HP absorbieren (Tank)
  if (c.talents.bollwerkKey && !c.state.bollwerkUsed) {
    c.hp = 1; c.state.bollwerkUsed = true;
    rounds.push({
      round, actor: c.label, action: "revive", damage: 0,
      hp_a_after: c.label === "A" ? c.hp : 0,
      hp_b_after: c.label === "B" ? c.hp : 0,
      note: "🛡️ Bollwerk — tödlicher Treffer absorbiert",
    });
    return;
  }
  if (c.abilityId === "nineleaves" && !c.state.nineLivesUsed) {
    c.hp = 1; c.state.nineLivesUsed = true;
    rounds.push({
      round, actor: c.label, action: "revive", damage: 0,
      hp_a_after: c.label === "A" ? c.hp : 0,
      hp_b_after: c.label === "B" ? c.hp : 0,
      note: "🐈 Neun Leben — überlebt mit 1 HP",
    });
  }
  if (c.abilityId === "rebirth" && !c.state.phoenixUsed) {
    c.hp = c.hpMax; c.state.phoenixUsed = true;
    rounds.push({
      round, actor: c.label, action: "revive", damage: 0,
      hp_a_after: c.label === "A" ? c.hp : 0,
      hp_b_after: c.label === "B" ? c.hp : 0,
      note: "🔥 Wiedergeburt — voll geheilt",
    });
  }
}

/** Aktiv-Skill (Ult) triggern bei 1000 Rage */
function fireUltimate(
  attacker: Combatant, defender: Combatant, rounds: RoundEvent[], round: number
): void {
  if (attacker.rage < attacker.rageMax) return;
  attacker.rage = 0;
  const activeLvl = Math.max(1, attacker.skillLvl.active);
  // Skalierung: Basis-Schaden = atk × 3, pro Active-Level +20%
  const ultMult = 3.0 * (1 + (activeLvl - 1) * 0.20);
  // Typ-Counter wirkt auch auf Ult
  const typeMult = (attacker.archetypeType && defender.archetypeType)
    ? typeCounter(attacker.archetypeType, defender.archetypeType) : 1.0;
  // Expertise: +25% pro Stufe
  const expMult = 1 + attacker.skillLvl.expertise * 0.25;

  // Skill-Dmg-Talent: +X% auf Active/Expertise-Schaden
  const skillDmgMult = 1 + (attacker.talents.skillDmg ?? 0);
  // Penetration wirkt auch auf Ult
  const defAfterPen = defender.def * Math.max(0, 1 - (attacker.talents.penPct ?? 0));

  const raw = attacker.atk * ultMult * typeMult * expMult * skillDmgMult - defAfterPen * 0.25;
  const dmg = Math.max(1, Math.round(raw));
  defender.hp = Math.max(0, defender.hp - dmg);
  rounds.push({
    round, actor: attacker.label, action: "ult", damage: dmg,
    hp_a_after: attacker.label === "A" ? attacker.hp : defender.hp,
    hp_b_after: attacker.label === "B" ? attacker.hp : defender.hp,
    rage_a_after: attacker.label === "A" ? attacker.rage : defender.rage,
    rage_b_after: attacker.label === "B" ? attacker.rage : defender.rage,
    note: `💥 ULT — ${attacker.abilityId.toUpperCase()}`,
  });
  attacker.ultFired = true;
}

/** Combat-Skill: zusätzliche Rage-Generation nach Event */
function combatSkillRage(c: Combatant, event: "on_crit" | "on_hit" | "per_round" | "low_hp"): number {
  const lvl = c.skillLvl.combat;
  if (lvl === 0 || !c.role) return 0;
  if (c.role === "dps" && event === "on_crit") return 50 + lvl * 10;
  if (c.role === "tank" && event === "on_hit") return 30 + lvl * 10;
  if (c.role === "support" && event === "per_round") return 20 + lvl * 5;
  if (c.role === "balanced" && event === "low_hp" && c.hp / c.hpMax < 0.5) return 40 + lvl * 10;
  return 0;
}

export function runBattle(a: BattleInput, b: BattleInput, seed: string): BattleResult {
  const rng = mulberry32(seedFromString(seed));
  const ca = buildCombatant("A", a);
  const cb = buildCombatant("B", b);
  const rounds: RoundEvent[] = [];

  // Initiative
  let firstIsA: boolean;
  if (ca.abilityId === "echolot") firstIsA = true;
  else if (cb.abilityId === "echolot") firstIsA = false;
  else if (ca.abilityId === "firststrike") firstIsA = true;
  else if (cb.abilityId === "firststrike") firstIsA = false;
  else firstIsA = ca.spd >= cb.spd;

  const typeAdv: "A" | "B" | "neutral" =
    (ca.archetypeType && cb.archetypeType)
      ? (typeCounter(ca.archetypeType, cb.archetypeType) > 1 ? "A"
         : typeCounter(cb.archetypeType, ca.archetypeType) > 1 ? "B" : "neutral")
      : "neutral";

  const MAX_ROUNDS = 15;
  for (let round = 1; round <= MAX_ROUNDS && ca.hp > 0 && cb.hp > 0; round++) {
    // Keystone: Erwachen — 1× pro Kampf volle Rage zu Beginn Runde 3 (Support)
    if (round === 3) {
      for (const c of [ca, cb]) {
        if (c.talents.awakenKey && !c.state.awakenUsed && c.hp > 0) {
          c.rage = c.rageMax;
          c.state.awakenUsed = true;
          rounds.push({
            round, actor: c.label, action: "special", damage: 0,
            hp_a_after: ca.hp, hp_b_after: cb.hp,
            rage_a_after: ca.rage, rage_b_after: cb.rage,
            note: "✨ Erwachen — volle Rage",
          });
        }
      }
    }

    // Regen + Debuff-Cleanse zu Beginn der Runde
    for (const c of [ca, cb]) {
      // Regen
      if (c.talents.regenPct > 0 && c.hp > 0 && c.hp < c.hpMax) {
        const heal = Math.round(c.hpMax * c.talents.regenPct);
        const before = c.hp;
        c.hp = Math.min(c.hpMax, c.hp + heal);
        if (c.hp > before) {
          rounds.push({
            round, actor: c.label, action: "heal", damage: c.hp - before,
            hp_a_after: ca.hp, hp_b_after: cb.hp, note: "💚 Regen",
          });
        }
      }
      // Debuff-Cleanse: Stun + ein Gift-Stack abschütteln
      if (c.talents.debuffCleanse > 0 && (c.state.stunned || c.state.poisonStacks > 0) && rng() < c.talents.debuffCleanse) {
        c.state.stunned = false;
        if (c.state.poisonStacks > 0) c.state.poisonStacks--;
        rounds.push({
          round, actor: c.label, action: "special", damage: 0,
          hp_a_after: ca.hp, hp_b_after: cb.hp, note: "✨ Debuff abgeschüttelt",
        });
      }
    }

    // Support-Rolle: per-round Rage
    ca.rage = Math.min(ca.rageMax, ca.rage + combatSkillRage(ca, "per_round"));
    cb.rage = Math.min(cb.rageMax, cb.rage + combatSkillRage(cb, "per_round"));

    const order = firstIsA ? [ca, cb] : [cb, ca];
    for (const attacker of order) {
      const defender = attacker.label === "A" ? cb : ca;
      if (attacker.hp <= 0 || defender.hp <= 0) continue;

      if (attacker.state.stunned) {
        attacker.state.stunned = false;
        rounds.push({
          round, actor: attacker.label, action: "stunned", damage: 0,
          hp_a_after: ca.hp, hp_b_after: cb.hp, note: "😵 Betäubt",
        });
        continue;
      }

      // Ult-Trigger PRIORITÄT: wenn Rage voll, feuert vor dem Auto-Attack
      if (attacker.rage >= attacker.rageMax) {
        fireUltimate(attacker, defender, rounds, round);
        if (defender.hp <= 0) {
          checkSurvival(defender, rounds, round);
          if (defender.hp <= 0) break;
        }
      }

      // Auto-Attack
      const { dmg, crit, note, evaded } = computeDamage(attacker, defender, rng, round);

      if (!evaded && dmg > 0) {
        defender.hp = Math.max(0, defender.hp - dmg);
        // Legacy: Berserker-Rage-Stacks
        if (defender.abilityId === "rage") defender.state.rageStacks = Math.min(8, defender.state.rageStacks + 1);
        // Sturzflug: 30% stun — stun_resist reduziert die Chance
        if (attacker.abilityId === "dive" && rng() < 0.3) {
          const resisted = defender.talents.stunResist > 0 && rng() < defender.talents.stunResist;
          if (!resisted) defender.state.stunned = true;
        }

        // Rage-Aufbau (mit Talent rage_gen)
        const rageBoostA = 1 + (attacker.talents.rageGen ?? 0);
        const rageBoostD = 1 + (defender.talents.rageGen ?? 0);
        attacker.rage = Math.min(attacker.rageMax, attacker.rage + Math.round(100 * rageBoostA));
        defender.rage = Math.min(defender.rageMax, defender.rage + Math.round(50 * rageBoostD));

        // Combat-Skill Bonus-Rage
        if (crit) attacker.rage = Math.min(attacker.rageMax, attacker.rage + combatSkillRage(attacker, "on_crit"));
        defender.rage = Math.min(defender.rageMax, defender.rage + combatSkillRage(defender, "on_hit"));
        if (defender.hp / defender.hpMax < 0.5) {
          defender.rage = Math.min(defender.rageMax, defender.rage + combatSkillRage(defender, "low_hp"));
        }

        // Heal-on-Hit (Lifesteal) — Attacker heilt X% des ausgeteilten Schadens
        if (attacker.talents.healOnHit > 0 && attacker.hp > 0) {
          const heal = Math.round(dmg * attacker.talents.healOnHit);
          const before = attacker.hp;
          attacker.hp = Math.min(attacker.hpMax, attacker.hp + heal);
          if (attacker.hp > before) {
            rounds.push({
              round, actor: attacker.label, action: "heal", damage: attacker.hp - before,
              hp_a_after: ca.hp, hp_b_after: cb.hp, note: "🩸 Lifesteal",
            });
          }
        }

        // Thorns — Angreifer bekommt X% des erlittenen Schadens zurück
        if (defender.talents.thornsPct > 0 && attacker.hp > 0) {
          const back = Math.max(1, Math.round(dmg * defender.talents.thornsPct));
          attacker.hp = Math.max(0, attacker.hp - back);
          rounds.push({
            round, actor: defender.label, action: "attack", damage: back,
            hp_a_after: ca.hp, hp_b_after: cb.hp, note: "🌵 Dornen",
          });
        }

        // Counter-Angriff — Chance auf Gegenschlag (halber Schaden, kein Crit)
        if (defender.hp > 0 && defender.talents.counterPct > 0 && rng() < defender.talents.counterPct) {
          const counter = Math.max(1, Math.round((defender.atk - attacker.def / 2) * 0.5));
          attacker.hp = Math.max(0, attacker.hp - counter);
          rounds.push({
            round, actor: defender.label, action: "attack", damage: counter,
            hp_a_after: ca.hp, hp_b_after: cb.hp, note: "⚔️ Konter",
          });
        }
      }

      rounds.push({
        round, actor: attacker.label,
        action: evaded ? "miss" : dmg === 0 ? "miss" : crit ? "crit" : "attack",
        damage: evaded ? 0 : dmg,
        hp_a_after: ca.hp, hp_b_after: cb.hp,
        rage_a_after: ca.rage, rage_b_after: cb.rage,
        note,
      });

      // DoTs
      if (!evaded) applyDot(defender, attacker, rounds, round);

      // Survival (Phoenix, Neun Leben, Keystone-Bollwerk)
      checkSurvival(defender, rounds, round);
      if (defender.hp <= 0) break;
    }
    // Status aller in dieser Runde emittierten Events patchen
    // (setzt Snapshots vom Ende der Runde — reicht für UI-Buff/Debuff-Anzeige)
    patchStatusFrom(rounds, 0, ca, cb);
  }

  let winner: "A" | "B" | "draw";
  if (ca.hp > 0 && cb.hp <= 0) winner = "A";
  else if (cb.hp > 0 && ca.hp <= 0) winner = "B";
  else if (ca.hp === cb.hp) winner = "draw";
  else winner = ca.hp > cb.hp ? "A" : "B";

  const xpBase = 500 + (winner === "draw" ? 0 : 500);
  return {
    winner, rounds,
    final_hp_a: ca.hp, final_hp_b: cb.hp,
    xp_awarded: xpBase,
    type_advantage: typeAdv,
  };
}
