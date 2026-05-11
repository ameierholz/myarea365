-- 00334_sanctuary_daily_cron.sql
-- pg_cron Job: täglich 00:00 Europe/Berlin (= 23:00 UTC im Winter / 22:00 UTC
-- im Sommer). Vereinfacht: 22:00 UTC + 23:00 UTC, beide Jobs sind idempotent
-- (rotate_sanctuaries macht UPSERT pro Bezirk). Doppelte Rotation um den
-- DST-Switch ist harmlos — beide schreiben gleichen Zustand.

DO $$
BEGIN
  PERFORM cron.unschedule('sanctuary-rotate-summer');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('sanctuary-rotate-winter');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'sanctuary-rotate-summer',
  '0 22 * * *',
  $$SELECT public.rotate_sanctuaries();$$
);

SELECT cron.schedule(
  'sanctuary-rotate-winter',
  '0 23 * * *',
  $$SELECT public.rotate_sanctuaries();$$
);
