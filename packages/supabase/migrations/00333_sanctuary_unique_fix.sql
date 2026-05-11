-- 00333_sanctuary_unique_fix.sql
-- ON CONFLICT braucht non-partial unique constraint. Alte hardcoded
-- Sanctuaries (ohne district_id) löschen, dann full unique constraint.

DELETE FROM public.sanctuaries WHERE district_id IS NULL;

DROP INDEX IF EXISTS public.sanctuaries_district_unique;
ALTER TABLE public.sanctuaries
  ADD CONSTRAINT sanctuaries_district_unique UNIQUE (district_id);
