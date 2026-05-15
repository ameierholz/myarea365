-- 00389_kurier_streifen_cron.sql
-- Kurier-Streifen-Spawn-Tick: alle 10 Minuten via pg_cron + http_post den
-- Next.js-Endpoint /api/kurier/spawn-tick aufrufen. Der Endpoint cleant
-- expirierte Streifen und füllt aktive Städte auf 4 Patrouillen auf.
--
-- WICHTIG: braucht ENV-Var APP_BASE_URL (https://myarea365.de in prod,
-- http://localhost:3000 lokal) + CRON_SECRET als Auth-Header.

DO $$
DECLARE v_jobname text;
BEGIN
  FOR v_jobname IN
    SELECT jobname FROM cron.job WHERE jobname LIKE 'ma365-kurier-%'
  LOOP
    PERFORM cron.unschedule(v_jobname);
  END LOOP;
END $$;

-- Konfigurierbare Settings aus public.app_config oder ENV; hier minimal:
-- wir nutzen einen Settings-Helper falls vorhanden, sonst hardcoded URL.
SELECT cron.schedule(
  'ma365-kurier-spawn-tick',
  '*/10 * * * *',
  $$
    SELECT net.http_post(
      url := coalesce(
        current_setting('app.base_url', true),
        'https://myarea365.de'
      ) || '/api/kurier/spawn-tick',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-cron-secret', coalesce(current_setting('app.cron_secret', true), '')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    );
  $$
);
