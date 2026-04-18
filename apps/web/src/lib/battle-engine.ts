/**
 * Deterministische Kampf-Engine. Gleicher Seed + gleiche Inputs → gleicher Ausgang.
 * Laeuft server-seitig (verifizierbar) und client-seitig (fuer Replay-Animation).
 */

import { statsAtLevel, type GuardianArchetype } from "@/lib/guardian";

export type BattleInput = {
  guardian: {
    id: string;
    level: number;
    current_hp_pct: number;
    archetype: GuardianArchetype;
  };
  is_home: boolean;          // Shop in eigener Stadt der Crew?
  crew_member_count: number; // fuer Rudel-Alpha
  item_bonuses?: { hp: number; atk: number; def: number; spd: number }; // aus equipped items
};

export type RoundEvent = {
  round: number;
  actor: "A" | "B";
  action: string;            // "attack" | "special" | "heal" | "miss" | "crit"
  damage: number;
  hp_a_after: number;
  hp_b_after: number;
  note?: string;
};

export type BattleResult = {
  winner: "A" | "B" | "draw";
  rounds: RoundEvent[];
  final_hp_a: number;
  final_hp_b: number;
  xp_awarded: number;
};

// Einfacher seeded PRNG (Mulberry32)
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
  // Ability-Zustand
  state: {
    rageStacks: number;       // baer
    poisonStacks: number;     // ratte (anwendbar)
    phoenixUsed: boolean;     // phoenix
    stunned: boolean;         // wyvern-sturzflug auf gegner
    nineLivesUsed: boolean;   // stadtkatze
  };
  isHome: boolean;
  crewCount: number;
};

function buildCombatant(label: "A" | "B", input: BattleInput): Combatant {
  const s = statsAtLevel(input.guardian.archetype, input.guardian.level);
  const b = input.item_bonuses ?? { hp: 0, atk: 0, def: 0, spd: 0 };
  const hpMax = s.hp + b.hp;
  const hpStart = Math.max(1, Math.round(hpMax * (input.guardian.current_hp_pct / 100)));
  return {
    label,
    id: input.guardian.id,
    hp: hpStart,
    hpMax,
    atk: s.atk + b.atk,
    def: s.def + b.def,
    spd: s.spd + b.spd,
    abilityId: input.guardian.archetype.ability_id,
    state: { rageStacks: 0, poisonStacks: 0, phoenixUsed: false, stunned: false, nineLivesUsed: false },
    isHome: input.is_home,
    crewCount: input.crew_member_count,
  };
}

function computeDamage(attacker: Combatant, defender: Combatant, rng: () => number, round: number): { dmg: number; crit: boolean; note?: string } {
  let atk = attacker.atk;
  let def = defender.def;
  let crit = false;
  let note: string | undefined;

  // Pre-Damage Ability-Modifier (Attacker)
  switch (attacker.abilityId) {
    case "firststrike":
      if (round === 1) { atk *= 2; crit = true; note = "Erstschlag!"; }
      break;
    case "ambush":
      if (round === 1) { atk *= 1.5; note = "Hinterhalt!"; }
      break;
    case "nightsight": {
      const hour = new Date().getUTCHours() + 1; // CET
      if (hour >= 20 || hour < 6) { atk *= 1.3; note = "Nachtsicht"; }
      break;
    }
    case "loyal":
      if (attacker.hp / attacker.hpMax < 0.5) { atk *= 1.15; note = "Treuer Biss"; }
      break;
    case "pack":
      atk *= 1 + Math.min(0.5, attacker.crewCount * 0.1);
      if (attacker.crewCount > 0) note = `Rudel (${attacker.crewCount} Mitglieder)`;
      break;
    case "fortress":
      if (attacker.isHome) { def += defender.def * 0.3; /* eigenes DEF oben */ }
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

  // Pre-Damage Ability-Modifier (Defender)
  switch (defender.abilityId) {
    case "wall":
      if (round === 1) { def *= 1.2; note = (note ? note + " · " : "") + "Bollwerk"; }
      break;
    case "evade":
      if (rng() < 0.2) return { dmg: 0, crit: false, note: "Ausgewichen!" };
      break;
    case "fortress":
      if (defender.isHome) def *= 1.3;
      break;
  }

  // Kritischer Hit (10% Basis, außer bereits forced)
  if (!crit && rng() < 0.1) { crit = true; }
  const critMult = crit ? 1.5 : 1;

  // Damage-Formel: atk*crit - def/2, minimum 1
  const raw = atk * critMult - def / 2;
  const dmg = Math.max(1, Math.round(raw));
  return { dmg, crit, note };
}

function applyDot(c: Combatant, source: Combatant, rounds: RoundEvent[], roundNum: number): void {
  // Drache: Flamme — Gegner verliert 10% HP/Runde (ignoriert DEF)
  if (source.abilityId === "flame") {
    const burn = Math.round(c.hpMax * 0.1);
    c.hp = Math.max(0, c.hp - burn);
    rounds.push({
      round: roundNum, actor: source.label, action: "flame", damage: burn,
      hp_a_after: source.label === "A" ? source.hp : c.hp,
      hp_b_after: source.label === "B" ? source.hp : c.hp,
      note: "🔥 Flamme",
    });
  }
  // Ratte: Gift — 5% HP/Runde, max 3 Stacks
  if (source.abilityId === "poison" && c.state.poisonStacks < 3) {
    c.state.poisonStacks++;
  }
  if (c.state.poisonStacks > 0) {
    const pois = Math.round(c.hpMax * 0.05 * c.state.poisonStacks);
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
  // Stadtkatze: Nine-Lives
  if (c.abilityId === "nineleaves" && !c.state.nineLivesUsed) {
    c.hp = 1;
    c.state.nineLivesUsed = true;
    rounds.push({
      round, actor: c.label, action: "revive", damage: 0,
      hp_a_after: c.label === "A" ? c.hp : 0,
      hp_b_after: c.label === "B" ? c.hp : 0,
      note: "🐈 Neun Leben — überlebt mit 1 HP",
    });
  }
  // Phoenix: Wiedergeburt
  if (c.abilityId === "rebirth" && !c.state.phoenixUsed) {
    c.hp = c.hpMax;
    c.state.phoenixUsed = true;
    rounds.push({
      round, actor: c.label, action: "revive", damage: 0,
      hp_a_after: c.label === "A" ? c.hp : 0,
      hp_b_after: c.label === "B" ? c.hp : 0,
      note: "🔥 Wiedergeburt — voll geheilt",
    });
  }
}

export function runBattle(a: BattleInput, b: BattleInput, seed: string): BattleResult {
  const rng = mulberry32(seedFromString(seed));
  const ca = buildCombatant("A", a);
  const cb = buildCombatant("B", b);
  const rounds: RoundEvent[] = [];

  // Wer zuerst? Echolot oder firststrike oder speed
  let firstIsA: boolean;
  if (ca.abilityId === "echolot") firstIsA = true;
  else if (cb.abilityId === "echolot") firstIsA = false;
  else if (ca.abilityId === "firststrike") firstIsA = true;
  else if (cb.abilityId === "firststrike") firstIsA = false;
  else firstIsA = ca.spd >= cb.spd;

  const MAX_ROUNDS = 15;
  for (let round = 1; round <= MAX_ROUNDS && ca.hp > 0 && cb.hp > 0; round++) {
    const order = firstIsA ? [ca, cb] : [cb, ca];
    for (const attacker of order) {
      const defender = attacker.label === "A" ? cb : ca;
      if (attacker.hp <= 0 || defender.hp <= 0) continue;

      // Stun-Check
      if (attacker.state.stunned) {
        attacker.state.stunned = false;
        rounds.push({
          round, actor: attacker.label, action: "stunned", damage: 0,
          hp_a_after: ca.hp, hp_b_after: cb.hp, note: "😵 Betäubt",
        });
        continue;
      }

      const { dmg, crit, note } = computeDamage(attacker, defender, rng, round);
      if (dmg > 0) {
        defender.hp = Math.max(0, defender.hp - dmg);
        // Rage-Stacks beim Defender
        if (defender.abilityId === "rage") defender.state.rageStacks = Math.min(8, defender.state.rageStacks + 1);
        // Wyvern Sturzflug: 30% stun
        if (attacker.abilityId === "dive" && rng() < 0.3) {
          defender.state.stunned = true;
        }
      }

      rounds.push({
        round, actor: attacker.label,
        action: dmg === 0 ? "miss" : crit ? "crit" : "attack",
        damage: dmg,
        hp_a_after: ca.hp, hp_b_after: cb.hp,
        note,
      });

      // DoTs / Spezial-Effekte nach Angriff
      applyDot(defender, attacker, rounds, round);

      // Survival-Check
      checkSurvival(defender, rounds, round);
      if (defender.hp <= 0) break;
    }
  }

  let winner: "A" | "B" | "draw";
  if (ca.hp > 0 && cb.hp <= 0) winner = "A";
  else if (cb.hp > 0 && ca.hp <= 0) winner = "B";
  else if (ca.hp === cb.hp) winner = "draw";
  else winner = ca.hp > cb.hp ? "A" : "B";

  const xpBase = 500 + (winner === "draw" ? 0 : 500);
  return {
    winner,
    rounds,
    final_hp_a: ca.hp,
    final_hp_b: cb.hp,
    xp_awarded: xpBase,
  };
}
