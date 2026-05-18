-- ════════════════════════════════════════════════════════════════════
-- Bugfix: Mutant-HP/Truppen falsch für level > 1
-- ────────────────────────────────────────────────────────────────────
-- Symptom: User besiegt einen Platin-Stufe-20-Mutant solo mit ~860k Angriff,
-- obwohl die intendierte HP 800.000 sein sollte. DB-Inspektion zeigt:
--   platinum L20: hp=20.000  (statt 800.000), troops=2.000  (statt 100.000)
--   gold     L12: hp=12.000  (statt 144.000), troops=1.200  (statt  21.600)
--   silver   L7:  hp= 7.000  (statt  28.000), troops=  700  (statt   4.200)
-- Alle level>1-Datensätze verwenden offenbar `hp = 1000 × level` und
-- `troops = 100 × level` — egal welches Tier.
--
-- Vermutlich Rest aus einer früheren Spawn-Tick-Version. Der heutige Code
-- (apps/web/src/app/api/mutant/spawn-tick/route.ts:275-276) berechnet
-- korrekt `tier.hp * cityLevel`, neue Spawns sind also fein.
--
-- Fix: Backfill aller Mutanten via mutant_tier_def(tier, level).
-- resolve_due_rallies (00395) liest mutants.hp/troop_count — nach dem
-- Backfill sind alle Werte konsistent. Loot-Berechnung lief ohnehin
-- schon korrekt via award_mutant_loot(tier, level, ...), war nie betroffen.
-- ════════════════════════════════════════════════════════════════════

UPDATE public.mutants m
   SET hp          = td.hp,
       troop_count = td.troop_count
  FROM public.mutant_tier_def(m.loot_tier, m.level) td
 WHERE m.hp <> td.hp OR m.troop_count <> td.troop_count;
