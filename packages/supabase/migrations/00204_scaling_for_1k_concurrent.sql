-- ─── 00204: Scaling für 1000+ concurrent ────────────────────────────
-- 1) pg_cron-Jobs für alle Lifecycle-Ticks (statt Read-time-Triggern)
-- 2) Mapbox-Walking-Route-Cache (~11m Grid)
-- 3) Partielle Indizes auf Hot-Path-Queries
-- 4) Active-Read-RPCs ohne tick (Cron übernimmt)

-- ── 1) pg_cron-Jobs ────────────────────────────────────────────────
do $$ begin
  -- Idempotent: bestehende Jobs entfernen vor Re-Schedule
  perform cron.unschedule(jobname) from cron.job
   where jobname in ('ma365-tick-gather-marches','ma365-tick-player-base-scouts',
                     'ma365-resolve-crew-rallies','ma365-resolve-pb-rallies',
                     'ma365-resolve-stronghold','ma365-respawn-strongholds',
                     'ma365-purge-mapbox-routes');
exception when others then null; end $$;

select cron.schedule('ma365-tick-gather-marches',     '10 seconds', $$ select public.tick_gather_marches(); $$);
select cron.schedule('ma365-tick-player-base-scouts', '10 seconds', $$ select public.tick_player_base_scouts(); $$);
select cron.schedule('ma365-resolve-crew-rallies',    '10 seconds', $$ select public.resolve_due_crew_repeater_rallies(); $$);
select cron.schedule('ma365-resolve-pb-rallies',      '10 seconds', $$ select public.resolve_due_player_base_rallies(); $$);
select cron.schedule('ma365-resolve-stronghold',      '10 seconds', $$ select public.resolve_due_rallies(); $$);
select cron.schedule('ma365-respawn-strongholds',     '* * * * *',  $$ select public.respawn_due_strongholds(); $$);

-- ── 2) Mapbox-Route-Cache ──────────────────────────────────────────
create table if not exists public.mapbox_route_cache (
  from_lat numeric(8,4) not null,
  from_lng numeric(8,4) not null,
  to_lat   numeric(8,4) not null,
  to_lng   numeric(8,4) not null,
  distance_m   integer not null,
  geom_geojson jsonb   not null,
  created_at   timestamptz not null default now(),
  primary key (from_lat, from_lng, to_lat, to_lng)
);
create index if not exists idx_mbroute_age on public.mapbox_route_cache(created_at);
-- RLS an: keine Policies → nur service_role kann lesen/schreiben.
-- Der mapbox-route.ts-Helper nutzt explizit service_role, alle anderen
-- Roles (anon/authenticated) sehen nichts. Verhindert Cache-Scraping.
alter table public.mapbox_route_cache enable row level security;

create or replace function public.purge_old_mapbox_routes()
returns int language plpgsql security definer as $body$
declare v_n int;
begin
  delete from public.mapbox_route_cache where created_at < now() - interval '30 days';
  get diagnostics v_n = row_count;
  return v_n;
end $body$;
grant execute on function public.purge_old_mapbox_routes() to authenticated;

select cron.schedule('ma365-purge-mapbox-routes', '15 3 * * *', $$ select public.purge_old_mapbox_routes(); $$);

-- ── 3) Partielle Indizes (Hot-Path) ───────────────────────────────
create index if not exists idx_pbs_user_active        on public.player_base_scouts(attacker_user_id) where status in ('marching','scouting','returning');
create index if not exists idx_pbs_due                on public.player_base_scouts(returns_at)        where status in ('marching','scouting','returning');
create index if not exists idx_crr_attacker_active    on public.crew_repeater_rallies(attacker_crew_id) where status in ('preparing','marching','fighting');
create index if not exists idx_pbr_crew_active        on public.player_base_rallies(crew_id)          where status in ('preparing','marching','fighting');
create index if not exists idx_rallies_crew_active    on public.rallies(crew_id)                       where status in ('preparing','marching','fighting');
create index if not exists idx_gm_user_active         on public.gather_marches(user_id)                where status in ('marching','gathering','returning');
create index if not exists idx_gm_arrives_due         on public.gather_marches(arrives_at)             where status = 'marching';
create index if not exists idx_gm_finishes_due        on public.gather_marches(finishes_at)            where status = 'gathering';
create index if not exists idx_gm_returns_due         on public.gather_marches(returns_at)             where status = 'returning';

-- ── 4) Tick-freie Active-Read-RPCs (Definitionen siehe Production) ──
-- get_active_player_base_scouts, get_active_crew_repeater_rallies,
-- get_active_rally_for_user wurden umgestellt — sie tickten vorher selbst
-- vor jedem Read. Jetzt nur noch Read, Tick übernimmt cron alle 10s.
