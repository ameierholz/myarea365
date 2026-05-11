-- 00321_architects_to_wave1.sql
-- Konstrukteure (gs2_*) sind Launch-Wächter und gehören zu W1, nicht zu einer
-- späteren Welle. wave_number auf 1 setzen.

BEGIN;
UPDATE public.guardian_archetypes SET wave_number = 1 WHERE wave_number = 2;
COMMIT;
