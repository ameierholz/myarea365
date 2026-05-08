-- ════════════════════════════════════════════════════════════════════════
-- Boost-Buildings entfernen — ein Building pro RSS, einfaches Design
-- ════════════════════════════════════════════════════════════════════════
-- Phase A (00287) hatte _per_km-Buildings auf _boost_pct umgestellt. Das war
-- konzeptionell doppelt: Recycling-Hof (saegewerk) produziert Holz/h flat,
-- Park-Pfad (wald_pfad) addierte +%. Beide für Holz, in der gleichen Kategorie.
--
-- Vereinfachung: nur die _per_hour-Buildings bleiben. Wald-Pfad / Wegerast /
-- Mond-Kapelle werden komplett gelöscht. Cascade-Delete aus 00079 entfernt
-- automatisch alle base_buildings + building_queue-Einträge dazu.
-- ════════════════════════════════════════════════════════════════════════

DELETE FROM public.buildings_catalog
WHERE id IN ('wald_pfad', 'gasthaus', 'kloster');

-- Sanity
SELECT id, category, effect_key
FROM public.buildings_catalog
WHERE category = 'production'
ORDER BY sort;
