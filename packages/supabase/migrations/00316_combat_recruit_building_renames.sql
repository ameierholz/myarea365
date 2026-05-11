-- 00316_combat_recruit_building_renames.sql
--
-- Combat-Tab Rekrutierungs-Gebäude: kombinierte Namen statt nur Theme-Wörter,
-- damit auf den ersten Blick erkennbar ist, welche Truppenklasse rauskommt.
-- (User-Feedback: "Bar/Garage/Gym/Werkhof verwirrt — was wird hier gebaut?")
--
-- Bonus-Bugfix wurde im Frontend gemacht: troops_per_train + base_hp_flat +
-- main_building_level werden jetzt als absolute Werte angezeigt
-- (vorher fälschlich als Prozent → "+10 Trupps" wurde zu "+1000%").

UPDATE buildings_catalog SET name='Türsteher-Bar'   WHERE id='kaserne';            -- Infantry
UPDATE buildings_catalog SET name='Kurier-Garage'   WHERE id='stall';              -- Cavalry
UPDATE buildings_catalog SET name='Schleuder-Gym'   WHERE id='schiessstand';       -- Marksman
UPDATE buildings_catalog SET name='Brecher-Werkhof' WHERE id='belagerungsschuppen'; -- Siege
