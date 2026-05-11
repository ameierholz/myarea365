-- 00318_buildtime_rebalance_by_importance.sql
-- Phase 2: Bauzeit-Rebalancing.
-- Vorher: alle base_buildtime_minutes=1 → Lv1 instant für alle Gebäude.
-- Nachher: differenzierte Base + leicht gesenkte Growth-Werte. Wichtige Gebäude
-- brauchen länger zu bauen — Lv25 bleibt mit Modifiers im 1.5-7.5-Tage-Korridor.

BEGIN;

-- Cosmetic (Statue/Brunnen/Shop): instant-feel
UPDATE buildings_catalog SET base_buildtime_minutes = 1,  buildtime_growth = 1.20 WHERE category = 'cosmetic';

-- Production (Sägewerk/Steinbruch/Goldmine/Mana-Quelle ×3): leichte Bauten
UPDATE buildings_catalog SET base_buildtime_minutes = 3,  buildtime_growth = 1.32 WHERE category = 'production';

-- Storage: mittlere Bauten
UPDATE buildings_catalog SET base_buildtime_minutes = 4,  buildtime_growth = 1.32 WHERE category = 'storage';

-- Combat — Standard
UPDATE buildings_catalog SET base_buildtime_minutes = 6,  buildtime_growth = 1.34 WHERE category = 'combat';

-- Combat — Trivial-Override (Arena/Training/Hospital/Wächter-Halle)
UPDATE buildings_catalog SET base_buildtime_minutes = 3,  buildtime_growth = 1.30 WHERE id IN ('trainingsplatz','arena_halle','waechter_halle','hospital');

-- Combat — Train-Speed-Override (Bogen/Schwert)
UPDATE buildings_catalog SET base_buildtime_minutes = 5,  buildtime_growth = 1.32 WHERE id IN ('bogenschuetzenstand','schwertkampflager');

-- Combat — Recruit (Türsteher-Bar/Kurier-Garage/Schleuder-Gym/Brecher-Werkhof)
UPDATE buildings_catalog SET base_buildtime_minutes = 8,  buildtime_growth = 1.34 WHERE id IN ('kaserne','stall','schiessstand','belagerungsschuppen');

-- Combat — Defense-Walls
UPDATE buildings_catalog SET base_buildtime_minutes = 8,  buildtime_growth = 1.32 WHERE id IN ('stadtmauer','wachturm','crew_stadtmauer');

-- Combat — Core (Bergfried/Crew-HQ/Drohnen-Werkstatt/Tempel/Signal-Bake)
UPDATE buildings_catalog SET base_buildtime_minutes = 15, buildtime_growth = 1.36 WHERE id IN ('bergfried','crew_bergfried','ballistenwerk','tempel_himmlisch','sammel_leuchtfeuer','spaeher_wachposten','crew_hospital');

-- Utility — Standard
UPDATE buildings_catalog SET base_buildtime_minutes = 5,  buildtime_growth = 1.34 WHERE category = 'utility';

-- Utility — Trivial-Override
UPDATE buildings_catalog SET base_buildtime_minutes = 3,  buildtime_growth = 1.30 WHERE id IN ('schwarzes_brett','schmiede','laufturm','augurstein','goblin_markt');

-- Utility — Heavy (Akademie/Crew-Akademie/Crew-Zentrum)
UPDATE buildings_catalog SET base_buildtime_minutes = 10, buildtime_growth = 1.36 WHERE id IN ('akademie','crew_akademie','allianz_zentrum');

-- Burg — Most important
UPDATE buildings_catalog SET base_buildtime_minutes = 20, buildtime_growth = 1.40 WHERE id = 'burg';

COMMIT;
