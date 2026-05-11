-- 00356_boss_district_link.sql
-- Boss → Bezirk fest verknüpfen, damit Frontend ohne Geometry-Lookup den
-- Bezirk-Namen anzeigen kann (Marker-Label, Filter, Statistiken).

ALTER TABLE public.boss_raids
  ADD COLUMN IF NOT EXISTS district_id bigint REFERENCES public.city_districts(id);

CREATE INDEX IF NOT EXISTS idx_boss_raids_district ON public.boss_raids(district_id);

-- Manuelle Zuordnung der 13 Berliner Bezirks-Bosse (alle an bekannten Landmarken).
-- Mitte hat 2 Bosse (Brandenburger Tor + Alex), alle anderen Bezirke 1.
UPDATE public.boss_raids b SET district_id = d.id
FROM public.city_districts d
WHERE d.city_slug = 'berlin' AND b.name IN (
  'Schattenwächter des Alex',
  'Berserker am Brandenburger Tor'
) AND d.name = 'Mitte';

UPDATE public.boss_raids b SET district_id = d.id
FROM public.city_districts d
WHERE d.city_slug = 'berlin' AND b.name = 'Brückenbestie der Oberbaum' AND d.name = 'Friedrichshain-Kreuzberg';

UPDATE public.boss_raids b SET district_id = d.id
FROM public.city_districts d
WHERE d.city_slug = 'berlin' AND b.name = 'Mauerpark-Schrecken' AND d.name = 'Pankow';

UPDATE public.boss_raids b SET district_id = d.id
FROM public.city_districts d
WHERE d.city_slug = 'berlin' AND b.name = 'Hexe von Charlottenburg' AND d.name = 'Charlottenburg-Wilmersdorf';

UPDATE public.boss_raids b SET district_id = d.id
FROM public.city_districts d
WHERE d.city_slug = 'berlin' AND b.name = 'Zitadellen-Drache' AND d.name = 'Spandau';

UPDATE public.boss_raids b SET district_id = d.id
FROM public.city_districts d
WHERE d.city_slug = 'berlin' AND b.name = 'Geist vom Schlachtensee' AND d.name = 'Steglitz-Zehlendorf';

UPDATE public.boss_raids b SET district_id = d.id
FROM public.city_districts d
WHERE d.city_slug = 'berlin' AND b.name = 'Tempelhofer Titan' AND d.name = 'Tempelhof-Schöneberg';

UPDATE public.boss_raids b SET district_id = d.id
FROM public.city_districts d
WHERE d.city_slug = 'berlin' AND b.name = 'Hermannplatz-Hydra' AND d.name = 'Neukölln';

UPDATE public.boss_raids b SET district_id = d.id
FROM public.city_districts d
WHERE d.city_slug = 'berlin' AND b.name = 'Müggelturm-Moloch' AND d.name = 'Treptow-Köpenick';

UPDATE public.boss_raids b SET district_id = d.id
FROM public.city_districts d
WHERE d.city_slug = 'berlin' AND b.name = 'Marzahner Maschinist' AND d.name = 'Marzahn-Hellersdorf';

UPDATE public.boss_raids b SET district_id = d.id
FROM public.city_districts d
WHERE d.city_slug = 'berlin' AND b.name = 'Tierpark-Tyrann' AND d.name = 'Lichtenberg';

UPDATE public.boss_raids b SET district_id = d.id
FROM public.city_districts d
WHERE d.city_slug = 'berlin' AND b.name = 'Tegeler Seeungeheuer' AND d.name = 'Reinickendorf';
