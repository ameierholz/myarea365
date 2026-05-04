-- 00251: Altes Saga-Modell droppen
--
-- Migration 00250 baute Stadt-vs-Stadt mit User-direkt-zu-Stadt-Zuordnung
-- + km-basierter Etappen-Akkumulation. Das war das falsche Modell.
--
-- Echtes Modell (00252+): RoK-KvK-Style mit Bracket-Matchmaking,
-- realer OSM-Stadt-Map pro Bracket, Truppen-Marsch, Repeater/Hauptgebäude,
-- Tor-Zonen aus Brücken/Tunneln, 40-Tage-Lifecycle.
--
-- Nichts davon lief produktiv — risikofrei droppbar.

drop view if exists public.saga_standings cascade;

drop function if exists public.saga_finalize_season(uuid) cascade;
drop function if exists public.saga_finalize_buildup(uuid) cascade;
drop function if exists public.saga_create_season(text, timestamptz, jsonb) cascade;
drop function if exists public.saga_join_city(uuid) cascade;
drop function if exists public.saga_contribute_walk(int) cascade;
drop function if exists public.saga_get_active_season() cascade;
drop function if exists public._saga_check_stage_unlock(uuid) cascade;

drop table if exists public.saga_progress_log cascade;
drop table if exists public.saga_camp_points cascade;
drop table if exists public.saga_members cascade;
drop table if exists public.saga_cities cascade;
drop table if exists public.saga_seasons cascade;

-- Reward-Tier-Zeilen für 'saga' bleiben — werden vom neuen System weiter genutzt.
