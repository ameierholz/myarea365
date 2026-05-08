-- ════════════════════════════════════════════════════════════════════════
-- Buildings-Catalog: Walking-Bezug aus Beschreibungen entfernen
-- ════════════════════════════════════════════════════════════════════════
-- Walking-Mechanik wurde in die Runner-App ausgelagert (siehe Pivot-Memo
-- 2026-04-29). Begleiter-Halle hatte "nach jedem Lauf" — neutralisiert.
--
-- Die _per_km-Buildings (wald_pfad, gasthaus, kloster) werden in 00290
-- komplett aus dem Catalog entfernt — siehe dort.
-- ════════════════════════════════════════════════════════════════════════

UPDATE buildings_catalog
SET description = 'Aktive Begleiter erhalten mehr Erfahrung nach jedem Kampf und Resource-Sammeln.'
WHERE id = 'waechter_halle';

SELECT id, description FROM buildings_catalog WHERE id = 'waechter_halle';
