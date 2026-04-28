-- ════════════════════════════════════════════════════════════════════
-- TROOPS-CATALOG CLEANUP — alte Pre-Set-D-Truppen entfernen
-- ════════════════════════════════════════════════════════════════════
-- Set D (Migration 00122) führte 20 saubere troop_ids ein:
-- inf_t1..t5, cav_t1..t5, mks_t1..t5, sg_t1..t5
-- Die alten 11 IDs (miliz, schwerttraeger, paladin, reiter, lanzenreiter,
-- drachenreiter, jaeger, langbogenschuetze, arkanschuetze, arkanwerfer,
-- katapult) blieben aber als Duplikate bestehen und tauchten doppelt im
-- Truppen-Picker auf. Diese Migration:
--   1) Mappt vorhandene user_troops + crew_troops + queue counts auf die
--      Set-D-Pendants (Counts werden addiert, niemand verliert was)
--   2) Löscht die alten Catalog-Rows (CASCADE räumt FK-Reste)
-- ════════════════════════════════════════════════════════════════════

do $$
declare
  v_map jsonb := jsonb_build_object(
    'miliz',           'inf_t1',  -- Lehrling
    'schwerttraeger',  'inf_t2',  -- Türsteher
    'paladin',         'inf_t3',  -- Schichtleiter
    'reiter',          'cav_t1',  -- Botenjunge
    'lanzenreiter',    'cav_t2',  -- Kurier
    'drachenreiter',   'cav_t3',  -- Eilkurier
    'jaeger',          'mks_t1',  -- Steinewerfer
    'langbogenschuetze','mks_t2', -- Schleuderer
    'arkanschuetze',   'mks_t3',  -- Scharfwerfer
    'arkanwerfer',     'sg_t4',   -- Vorschlaghammer
    'katapult',        'sg_t4'    -- Vorschlaghammer (zweites Mapping)
  );
  k text;
  v text;
begin
  for k, v in select * from jsonb_each_text(v_map) loop
    -- 1) user_troops: counts addieren auf neue ID, alte Row löschen
    insert into public.user_troops (user_id, troop_id, count)
    select user_id, v, count
      from public.user_troops
     where troop_id = k
    on conflict (user_id, troop_id) do update
      set count = public.user_troops.count + excluded.count;

    delete from public.user_troops where troop_id = k;

    -- 2) crew_troops: gleiches Schema
    insert into public.crew_troops (crew_id, troop_id, count)
    select crew_id, v, count
      from public.crew_troops
     where troop_id = k
    on conflict (crew_id, troop_id) do update
      set count = public.crew_troops.count + excluded.count;

    delete from public.crew_troops where troop_id = k;

    -- 3) Trainings-Queue: laufende Aufträge auf neue ID umbiegen
    update public.troop_training_queue set troop_id = v where troop_id = k;
  end loop;

  -- 4) Catalog-Rows löschen (FKs sind jetzt leer)
  delete from public.troops_catalog
   where id in (
     'miliz','schwerttraeger','paladin',
     'reiter','lanzenreiter','drachenreiter',
     'jaeger','langbogenschuetze','arkanschuetze',
     'arkanwerfer','katapult'
   );
end $$;
