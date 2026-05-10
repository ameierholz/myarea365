-- 00301_artwork_slots_class_faction.sql
--
-- 1) 2 fehlende Klassen-Slots ergänzen (mage, collector — kamen im
--    Wächter-Rebrand 2026-05-12 dazu, wurden im Artwork-Tool vergessen)
-- 2) 3 neue Faction-Slots für die Wächter-Fraktionen
-- 3) Klassen-Namen modernisieren: alte Walking-App-Begriffe
--    (Türsteher/Kuriere/Schleuderer/Brecher) → neutrale Standard-Begriffe
--    passend zum Real-Life-Setting

BEGIN;

-- 0) Constraint erweitern damit category 'faction' erlaubt ist
ALTER TABLE ui_icon_slots DROP CONSTRAINT ui_icon_slots_category_check;
ALTER TABLE ui_icon_slots ADD CONSTRAINT ui_icon_slots_category_check
  CHECK (category = ANY (ARRAY['stat','class','action','badge','misc','quick','crew_tab','building','silhouette','karte_base','trophy','faction']));

-- ── Klassen-Rename auf neutrale moderne Begriffe ──
UPDATE ui_icon_slots SET name = 'Infanterie',     description = 'Klassen-Icon für Infanterie-Wächter (Front/Garrison)' WHERE id = 'class_infantry';
UPDATE ui_icon_slots SET name = 'Kavallerie',     description = 'Klassen-Icon für Kavallerie-Wächter (Bike/Charger)' WHERE id = 'class_cavalry';
UPDATE ui_icon_slots SET name = 'Scharfschütze',  description = 'Klassen-Icon für Marksman-Wächter (Sniper/Distanz)' WHERE id = 'class_marksman';
UPDATE ui_icon_slots SET name = 'Belagerung',     description = 'Klassen-Icon für Siege-Wächter (Mauer-Brecher/AoE)' WHERE id = 'class_siege';

-- ── 2 fehlende Klassen-Slots ergänzen ──
INSERT INTO ui_icon_slots (id, category, name, description, fallback_emoji, sort) VALUES
  ('class_mage',      'class', 'Magier',  'Klassen-Icon für Mage-Wächter (Drohnen/Magie/Caster)', '🪄', 24),
  ('class_collector', 'class', 'Sammler', 'Klassen-Icon für Collector-Wächter (Wegelager/Farming)', '📦', 25)
ON CONFLICT (id) DO NOTHING;

-- ── 3 Faction-Slots ergänzen ──
INSERT INTO ui_icon_slots (id, category, name, description, fallback_emoji, sort) VALUES
  ('faction_gossenbund',  'faction', 'Untergrund',  'Fraktion-Icon Untergrund (Gangs, Slum, Tunnel-Viertel)',           '🔗', 30),
  ('faction_kronenwacht', 'faction', 'Stadtwache',  'Fraktion-Icon Stadtwache (Polizei, Sicherheit, Etablissement)',    '🛡️', 31),
  ('faction_netzhueter',  'faction', 'Hacker-Crew', 'Fraktion-Icon Hacker-Crew (Tech, Daten, Cyber-Spezialisten)',      '💻', 32)
ON CONFLICT (id) DO NOTHING;

COMMIT;
