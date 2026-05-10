-- 00299_guardian_w0_cleanup_and_w1_complete.sql
--
-- Phase 1: Pre-Launch (W0) komplett aus DB löschen
-- Phase 2: 4 neue W1-Wächter anlegen (Vex/Nara/Hex/Tarq) → 9 Wächter total
--
-- Final-Verteilung W1 (9 Stück):
--   Faction: 3 gossenbund, 3 kronenwacht, 3 netzhueter (perfekt balanced)
--   Type:    2 infantry, 1 cavalry, 2 marksman, 1 mage, 1 siege, 2 collector
--   Rarity:  1 advanced, 2 elite, 4 epic, 2 legendary

BEGIN;

-- ============================================================
-- PHASE 1: W0 (Pre-Launch) Cleanup
-- ============================================================

-- 1.1 user_guardians der W0-Archetypes löschen
--    → CASCADE räumt: arena_battles, guardian_trust, guardian_equipment,
--      guardian_skill_levels, guardian_talents, runner_fights
--    → SET NULL für: rally_participants, player_base_rallies,
--      saga_garrisons, saga_marches, saga_user_positions
DELETE FROM user_guardians
WHERE archetype_id IN (SELECT id FROM guardian_archetypes WHERE wave_number = 0);

-- 1.2 W0-Archetypes löschen — CASCADE räumt talent_nodes + archetype_skills
DELETE FROM guardian_archetypes WHERE wave_number = 0;

-- ============================================================
-- PHASE 2: 4 neue W1-Wächter
-- ============================================================

-- 6. Vex-Datenreiterin — Epic, Cavalry, Netzhüter
--    Cyber-Bike-Reiterin, hackt im Vorbeifahren
INSERT INTO guardian_archetypes (
  id, name, emoji, rarity,
  base_hp, base_atk, base_def, base_spd,
  ability_id, ability_name, ability_desc,
  lore, role, guardian_type, faction,
  specialization_tags, troop_capacity_base, troop_capacity_per_level,
  is_flying, wave_number, released_at,
  gather_yield_mult, gather_speed_mult
) VALUES (
  'gs1_vex', 'Vex-Datenreiterin', '🏍️', 'epic',
  950, 200, 160, 200,
  'gs1_vex_sig', 'Daten-Charge',
  'Schwerer Cyber-Bike-Sturm — Kavallerie-Charge mit +30% Schaden gegen Scharfschützen für 6 Sekunden. Stiehlt im Vorbeifahren 5% Energie pro Treffer.',
  'Ehemalige Kurierin der Datenkartelle. Reitet jetzt für die Netzhüter und kennt jeden Tunnel der Bandbreitenraster.',
  'kavalier', 'cavalry', 'netzhueter',
  ARRAY['cavalry','mobility','pvp'], 1100, 110,
  false, 1, now(),
  1.00, 1.00
);

-- 7. Nara-Quellseherin — Legendary, Marksman, Netzhüter
--    Holo-Visor, sieht durch Wände, ignoriert Verteidigung
INSERT INTO guardian_archetypes (
  id, name, emoji, rarity,
  base_hp, base_atk, base_def, base_spd,
  ability_id, ability_name, ability_desc,
  lore, role, guardian_type, faction,
  specialization_tags, troop_capacity_base, troop_capacity_per_level,
  is_flying, wave_number, released_at,
  gather_yield_mult, gather_speed_mult
) VALUES (
  'gs1_nara', 'Nara-Quellseherin', '🎯', 'legendary',
  1400, 320, 180, 140,
  'gs1_nara_sig', 'Algorithmus-Schuss',
  'Markiert ein Ziel — der nächste Scharfschützen-Schuss durchschlägt 40% Verteidigung und richtet 380% Schaden an. Trifft auch verdeckte Ziele.',
  'Ehemalige Quell-Analystin. Sieht Datenströme als Linien — und schießt dort, wo der Algorithmus schwach ist.',
  'paladin', 'marksman', 'netzhueter',
  ARRAY['marksman','pvp','skills'], 1500, 150,
  false, 1, now(),
  1.00, 1.00
);

-- 8. Hex-Schrottbrecherin — Epic, Siege, Gossenbund
--    Belagerungs-Mechs aus Slum-Schrott
INSERT INTO guardian_archetypes (
  id, name, emoji, rarity,
  base_hp, base_atk, base_def, base_spd,
  ability_id, ability_name, ability_desc,
  lore, role, guardian_type, faction,
  specialization_tags, troop_capacity_base, troop_capacity_per_level,
  is_flying, wave_number, released_at,
  gather_yield_mult, gather_speed_mult
) VALUES (
  'gs1_hex', 'Hex-Schrottbrecherin', '💥', 'epic',
  1100, 260, 220, 70,
  'gs1_hex_sig', 'Schrott-Bombardement',
  'Wirft eine Salve aus Schrott-Granaten — 220% Belagerungs-Schaden gegen Strukturen in einem Radius. +50% Schaden gegen Mauern.',
  'Schraubt Belagerungs-Mechs aus Tunnel-Schrott zusammen. Niemand baut schneller — und niemand baut hässlicher.',
  'krieger', 'siege', 'gossenbund',
  ARRAY['siege','aoe','rally'], 1200, 120,
  false, 1, now(),
  1.00, 1.00
);

-- 9. Tarq-Datenschütze — Elite, Marksman, Netzhüter
--    Cyber-Sniper für Sec-Posten via Drone-Cam
INSERT INTO guardian_archetypes (
  id, name, emoji, rarity,
  base_hp, base_atk, base_def, base_spd,
  ability_id, ability_name, ability_desc,
  lore, role, guardian_type, faction,
  specialization_tags, troop_capacity_base, troop_capacity_per_level,
  is_flying, wave_number, released_at,
  gather_yield_mult, gather_speed_mult
) VALUES (
  'gs1_tarq', 'Tarq-Datenschütze', '🔭', 'elite',
  650, 180, 120, 160,
  'gs1_tarq_sig', 'Drohnen-Sicht',
  'Markiert Ziele über Drohnen-Cam — Scharfschützen erhalten +25% Krit-Chance und +15% Schaden gegen Kavallerie für 30 Sekunden.',
  'Wartungstechniker für Wach-Drohnen. Sah einmal zu viel — und schießt seither zurück.',
  'schurke', 'marksman', 'netzhueter',
  ARRAY['marksman','gathering','mobility'], 800, 80,
  false, 1, now(),
  1.00, 1.00
);

COMMIT;
