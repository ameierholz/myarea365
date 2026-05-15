-- 00386_saga_cron_schedule.sql
-- Saga-Lifecycle: 8 pg_cron-Jobs scharfschalten.
-- Ohne diese ist die CvC-Karte statisch — Märsche kommen nie an, Tore öffnen
-- nicht, Apex-Hold-Timer läuft nicht, Action Points resetten nicht.
-- Idempotent: alte Job-Versionen werden vor dem Neu-Anlegen entfernt.

DO $$
DECLARE
  v_jobname text;
BEGIN
  -- Bestehende Saga-Jobs sauber entfernen (alte Versionen / Doppelungen)
  FOR v_jobname IN
    SELECT jobname FROM cron.job WHERE jobname LIKE 'ma365-saga-%'
  LOOP
    PERFORM cron.unschedule(v_jobname);
  END LOOP;
END $$;

-- ── 1) Marsch-Resolution: alle 30s — wenn ein Marsch arrives_at erreicht,
--    löst der RPC Kampf/Verstärkung/Sammeln aus.
SELECT cron.schedule(
  'ma365-saga-resolve-marches',
  '*/1 * * * *',  -- pg_cron unterstützt min. 1 min — schneller via Edge-Function später
  $$ SELECT public.saga_resolve_arrived_marches(); $$
);

-- ── 2) Phase-Progression: alle 10min — Tore öffnen sich nach Zeitplan
--    (auftakt_ends, dann je 1/7 der Hauptphase pro Tor-Phase).
SELECT cron.schedule(
  'ma365-saga-advance-phases',
  '*/10 * * * *',
  $$ SELECT public.saga_advance_phases(); $$
);

-- ── 3) Apex-Hold-Check: alle 5min — prüft ob eine Crew den Apex lange genug hält
SELECT cron.schedule(
  'ma365-saga-check-apex',
  '*/5 * * * *',
  $$ SELECT public.saga_check_apex_holds(); $$
);

-- ── 4) Buff-Ablauf: alle 5min — entfernt abgelaufene Buffs
SELECT cron.schedule(
  'ma365-saga-buff-tick',
  '*/5 * * * *',
  $$ SELECT public.saga_buff_tick(); $$
);

-- ── 5) Holy-Site-Tick: alle 10min — wendet Holy-Site-Boni auf Owner-Crew an
SELECT cron.schedule(
  'ma365-saga-holy-tick',
  '*/10 * * * *',
  $$ SELECT public.saga_holy_tick(); $$
);

-- ── 6) Action-Points-Reset: täglich 04:00 UTC — jeder User bekommt sein
--    Tageslimit zurück (vergleichbar mit RoK Daily Reset).
SELECT cron.schedule(
  'ma365-saga-ap-reset',
  '0 4 * * *',
  $$ SELECT public.saga_ap_reset(); $$
);

-- ── 7) Augur-Milestone-Rewards: täglich 02:00 UTC — verteilt Diamanten/Schlüssel
--    für erreichte Crew-Meilensteine.
SELECT cron.schedule(
  'ma365-saga-augur-rewards',
  '0 2 * * *',
  $$ SELECT public.saga_distribute_augur_rewards(); $$
);

-- ── 8) Bracket-Finalisierung: täglich 03:00 UTC — schließt Brackets ab,
--    deren main_ends/apex_window_ends/awards_ends in der Vergangenheit liegen,
--    setzt winner_crew_id und verteilt Saison-Belohnungen.
SELECT cron.schedule(
  'ma365-saga-finalize',
  '0 3 * * *',
  $$ SELECT public.saga_finalize_brackets(); $$
);
