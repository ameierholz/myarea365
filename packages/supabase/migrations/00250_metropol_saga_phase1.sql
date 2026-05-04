-- 00250: Metropol-Saga Phase 1 — Skelett
--
-- Stadt-vs-Stadt Saison-System. 4–8 echte Großstädte treten pro Saison
-- in einem kollektiven Bewegungs-Wettbewerb gegeneinander an.
--
-- Lifecycle:
--   pending  → buildup (-7d) → main (14d) → awards (2d) → finalized
--
-- Phase 1 baut nur das Skelett:
--   - Tabellen für Saisons, Städte, Members, Progress, Camp-Punkte
--   - Reward-Tier-Erweiterung (system='saga')
--   - Lifecycle-RPCs als Stubs
--   - Finalize-Funktion mit Tier-Lookup
--
-- Public-UI + echte Karten-Visualisierung kommen in Phase 2.

-- ════════════════════════════════════════════════════════════════
-- 1) saga_seasons — Eine Saison pro 23-Tage-Cycle
-- ════════════════════════════════════════════════════════════════
create table if not exists public.saga_seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'pending'
    check (status in ('pending','buildup','main','awards','finalized')),
  buildup_starts timestamptz not null,
  main_starts    timestamptz not null,
  main_ends      timestamptz not null,
  awards_ends    timestamptz not null,
  winner_city_id uuid,
  buildup_winner_city_id uuid,
  city_count int not null default 4 check (city_count between 2 and 16),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_saga_seasons_status on public.saga_seasons(status, main_starts);

alter table public.saga_seasons enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='saga_seasons' and policyname='saga_seasons_public_read') then
    create policy saga_seasons_public_read on public.saga_seasons for select using (true);
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════
-- 2) saga_cities — Pro Saison N Städte
-- ════════════════════════════════════════════════════════════════
create table if not exists public.saga_cities (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.saga_seasons(id) on delete cascade,
  name text not null,
  slug text not null,
  color_hex text not null default '#22D1C3',
  current_stage int not null default 4 check (current_stage between 0 and 4),
  camp_points_total bigint not null default 0,
  main_distance_m bigint not null default 0,
  member_count int not null default 0,
  final_rank int,
  reached_finish_at timestamptz,
  unique (season_id, slug)
);

create index if not exists idx_saga_cities_season on public.saga_cities(season_id, main_distance_m desc);

alter table public.saga_cities enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='saga_cities' and policyname='saga_cities_public_read') then
    create policy saga_cities_public_read on public.saga_cities for select using (true);
  end if;
end $$;

alter table public.saga_seasons
  add constraint saga_seasons_winner_fk
  foreign key (winner_city_id) references public.saga_cities(id) on delete set null deferrable initially deferred;

alter table public.saga_seasons
  add constraint saga_seasons_buildup_winner_fk
  foreign key (buildup_winner_city_id) references public.saga_cities(id) on delete set null deferrable initially deferred;

-- ════════════════════════════════════════════════════════════════
-- 3) saga_members — Welcher User läuft für welche Stadt
-- ════════════════════════════════════════════════════════════════
create table if not exists public.saga_members (
  user_id uuid not null references public.users(id) on delete cascade,
  season_id uuid not null references public.saga_seasons(id) on delete cascade,
  city_id uuid not null references public.saga_cities(id) on delete cascade,
  joined_at timestamptz not null default now(),
  camp_points bigint not null default 0,
  stage_points bigint not null default 0,   -- Hauptphase-Beitrag (km × multi)
  total_distance_m bigint not null default 0,
  primary key (user_id, season_id)
);

create index if not exists idx_saga_members_city on public.saga_members(city_id, stage_points desc);
create index if not exists idx_saga_members_user on public.saga_members(user_id);

alter table public.saga_members enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='saga_members' and policyname='saga_members_self_read') then
    create policy saga_members_self_read on public.saga_members for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='saga_members' and policyname='saga_members_public_read_aggregate') then
    create policy saga_members_public_read_aggregate on public.saga_members for select using (true);
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════
-- 4) saga_camp_points — Trainingscamp-Etappen (3 Phasen)
-- ════════════════════════════════════════════════════════════════
create table if not exists public.saga_camp_points (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.saga_seasons(id) on delete cascade,
  city_id uuid not null references public.saga_cities(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  phase text not null check (phase in ('scouting','supplies','conditioning')),
  points bigint not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_saga_camp_points_city on public.saga_camp_points(city_id, phase);

alter table public.saga_camp_points enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='saga_camp_points' and policyname='saga_camp_points_public_read') then
    create policy saga_camp_points_public_read on public.saga_camp_points for select using (true);
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════
-- 5) saga_progress_log — Audit-Log für Stage-Aufstiege & Meilensteine
-- ════════════════════════════════════════════════════════════════
create table if not exists public.saga_progress_log (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.saga_seasons(id) on delete cascade,
  city_id uuid not null references public.saga_cities(id) on delete cascade,
  event_kind text not null check (event_kind in ('stage_unlock','finish_reached','buildup_won','main_won')),
  stage_reached int,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_saga_progress_log_city on public.saga_progress_log(city_id, created_at desc);

alter table public.saga_progress_log enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='saga_progress_log' and policyname='saga_progress_log_public_read') then
    create policy saga_progress_log_public_read on public.saga_progress_log for select using (true);
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════
-- 6) Reward-Tiers für Saga
-- ════════════════════════════════════════════════════════════════
alter table public.season_reward_tiers
  drop constraint if exists season_reward_tiers_system_check;

alter table public.season_reward_tiers
  add constraint season_reward_tiers_system_check
  check (system in ('shop_league','arena','turf_war','saga'));

insert into public.season_reward_tiers (system, rank_min, rank_max, gebietsruf, gems, siegel_universal, participation_only, label) values
  ('saga', 1, 1,    0, 1500, 100, false, 'Sieger-Stadt'),
  ('saga', 2, 2,    0,  800,  50, false, 'Silber-Stadt'),
  ('saga', 3, 3,    0,  400,  25, false, 'Bronze-Stadt'),
  ('saga', 4, 9999, 0,  100,   5, true,  'Teilnehmer-Stadt')
on conflict (system, rank_min) do nothing;

-- ════════════════════════════════════════════════════════════════
-- 7) RPC: saga_get_active_season
-- ════════════════════════════════════════════════════════════════
create or replace function public.saga_get_active_season()
returns table (
  id uuid, name text, status text,
  buildup_starts timestamptz, main_starts timestamptz, main_ends timestamptz, awards_ends timestamptz,
  city_count int
)
language sql stable as $$
  select s.id, s.name, s.status,
         s.buildup_starts, s.main_starts, s.main_ends, s.awards_ends,
         s.city_count
    from public.saga_seasons s
   where s.status in ('pending','buildup','main','awards')
   order by s.main_starts asc
   limit 1
$$;

grant execute on function public.saga_get_active_season() to anon, authenticated, service_role;

-- ════════════════════════════════════════════════════════════════
-- 8) RPC: saga_join_city — User tritt einer Stadt bei
-- ════════════════════════════════════════════════════════════════
create or replace function public.saga_join_city(p_city_id uuid)
returns table (ok boolean, message text)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_season_id uuid;
  v_status text;
  v_existing uuid;
begin
  if v_user is null then
    return query select false, 'not_authenticated'; return;
  end if;

  select c.season_id, s.status into v_season_id, v_status
    from public.saga_cities c
    join public.saga_seasons s on s.id = c.season_id
   where c.id = p_city_id
   limit 1;

  if v_season_id is null then
    return query select false, 'city_not_found'; return;
  end if;

  if v_status not in ('pending','buildup','main') then
    return query select false, 'season_closed'; return;
  end if;

  select city_id into v_existing
    from public.saga_members
   where user_id = v_user and season_id = v_season_id;

  if v_existing is not null then
    return query select false, 'already_joined'; return;
  end if;

  insert into public.saga_members (user_id, season_id, city_id)
  values (v_user, v_season_id, p_city_id);

  update public.saga_cities
     set member_count = member_count + 1
   where id = p_city_id;

  return query select true, 'joined';
end $$;

grant execute on function public.saga_join_city(uuid) to authenticated, service_role;

-- ════════════════════════════════════════════════════════════════
-- 9) RPC: saga_contribute_walk — Wird vom Walk-Tick aufgerufen
-- ════════════════════════════════════════════════════════════════
create or replace function public.saga_contribute_walk(p_distance_m int)
returns table (
  contributed boolean,
  city_id uuid,
  phase text,
  buildup_phase text,
  stage_points_added bigint,
  camp_points_added bigint
)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_season public.saga_seasons%rowtype;
  v_city_id uuid;
  v_buildup_phase text;
  v_now timestamptz := now();
  v_camp_added bigint := 0;
  v_stage_added bigint := 0;
  v_multi numeric := 1.0;
begin
  if v_user is null or p_distance_m is null or p_distance_m <= 0 then
    return query select false, null::uuid, null::text, null::text, 0::bigint, 0::bigint; return;
  end if;

  -- aktive Saison ermitteln
  select * into v_season
    from public.saga_seasons
   where status in ('buildup','main')
   order by main_starts asc
   limit 1;

  if v_season.id is null then
    return query select false, null::uuid, null::text, null::text, 0::bigint, 0::bigint; return;
  end if;

  -- Mitglied?
  select sm.city_id into v_city_id
    from public.saga_members sm
   where sm.user_id = v_user and sm.season_id = v_season.id;

  if v_city_id is null then
    return query select false, null::uuid, v_season.status, null::text, 0::bigint, 0::bigint; return;
  end if;

  -- Heimvorteil-Buff während Hauptphase?
  if v_season.status = 'main' and v_season.buildup_winner_city_id = v_city_id then
    v_multi := 1.15;
  end if;

  if v_season.status = 'buildup' then
    -- Buildup hat 3 Sub-Phasen: Tag 1-3 = scouting, 3-5 = supplies, 5-7 = conditioning
    v_buildup_phase := case
      when v_now < v_season.buildup_starts + interval '2 days 9 hours' then 'scouting'
      when v_now < v_season.buildup_starts + interval '4 days 18 hours' then 'supplies'
      else 'conditioning'
    end;

    -- 1 Camp-Point pro 100 m
    v_camp_added := (p_distance_m / 100)::bigint;

    insert into public.saga_camp_points (season_id, city_id, user_id, phase, points)
    values (v_season.id, v_city_id, v_user, v_buildup_phase, v_camp_added);

    update public.saga_members
       set camp_points = camp_points + v_camp_added,
           total_distance_m = total_distance_m + p_distance_m
     where user_id = v_user and season_id = v_season.id;

    update public.saga_cities
       set camp_points_total = camp_points_total + v_camp_added
     where id = v_city_id;

  else  -- main phase
    -- Stage-Points = Distanz × Heimvorteil-Multi (1 km = 10 pts)
    v_stage_added := ((p_distance_m::numeric / 100) * v_multi)::bigint;

    update public.saga_members
       set stage_points = stage_points + v_stage_added,
           total_distance_m = total_distance_m + p_distance_m
     where user_id = v_user and season_id = v_season.id;

    update public.saga_cities
       set main_distance_m = main_distance_m + p_distance_m
     where id = v_city_id;

    -- Stage-Aufstieg prüfen (jeder Checkpoint kostet 50 000 km kollektiv = 500 000 000 m)
    -- Phase 1 vereinfacht: alle 100 km Stadt-Distanz pro Member = 1 Stage-Schritt
    -- (echte Schwellen werden in Phase 2 dynamisch konfiguriert)
    perform public._saga_check_stage_unlock(v_city_id);
  end if;

  return query select true, v_city_id, v_season.status, v_buildup_phase, v_stage_added, v_camp_added;
end $$;

grant execute on function public.saga_contribute_walk(int) to authenticated, service_role;

-- ════════════════════════════════════════════════════════════════
-- 10) Helper: Stage-Unlock prüfen
-- ════════════════════════════════════════════════════════════════
create or replace function public._saga_check_stage_unlock(p_city_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_city public.saga_cities%rowtype;
  v_threshold_per_stage bigint;
  v_completed_stages int;
  v_target_stage int;
begin
  select * into v_city from public.saga_cities where id = p_city_id;
  if v_city.id is null or v_city.current_stage = 0 then
    return;
  end if;

  -- Phase-1-Schwelle: 50 000 m × member_count pro Stage (abgemildert für kleine Mock-Tests)
  v_threshold_per_stage := greatest(50000, 50000 * greatest(v_city.member_count, 1));

  v_completed_stages := least(4, (v_city.main_distance_m / v_threshold_per_stage)::int);
  v_target_stage := greatest(0, 4 - v_completed_stages);

  if v_target_stage < v_city.current_stage then
    update public.saga_cities
       set current_stage = v_target_stage,
           reached_finish_at = case when v_target_stage = 0 and reached_finish_at is null then now() else reached_finish_at end
     where id = p_city_id;

    insert into public.saga_progress_log (season_id, city_id, event_kind, stage_reached, payload)
    values (
      v_city.season_id,
      p_city_id,
      case when v_target_stage = 0 then 'finish_reached' else 'stage_unlock' end,
      v_target_stage,
      jsonb_build_object('total_distance_m', v_city.main_distance_m)
    );
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════
-- 11) RPC: saga_finalize_buildup — bestimmt Buildup-Sieger
-- ════════════════════════════════════════════════════════════════
create or replace function public.saga_finalize_buildup(p_season_id uuid default null)
returns table (season_id uuid, buildup_winner_city_id uuid, buildup_winner_name text)
language plpgsql security definer set search_path = public as $$
declare
  v_season public.saga_seasons%rowtype;
  v_winner_id uuid;
  v_winner_name text;
begin
  if p_season_id is null then
    select * into v_season
      from public.saga_seasons
     where status = 'buildup' and main_starts <= now()
     order by main_starts asc limit 1;
  else
    select * into v_season from public.saga_seasons where id = p_season_id;
  end if;

  if v_season.id is null then
    return;
  end if;

  select c.id, c.name into v_winner_id, v_winner_name
    from public.saga_cities c
   where c.season_id = v_season.id
   order by c.camp_points_total desc, c.member_count desc
   limit 1;

  update public.saga_seasons
     set status = 'main',
         buildup_winner_city_id = v_winner_id,
         updated_at = now()
   where id = v_season.id;

  insert into public.saga_progress_log (season_id, city_id, event_kind, payload)
  values (v_season.id, v_winner_id, 'buildup_won', jsonb_build_object('camp_points', (select camp_points_total from saga_cities where id = v_winner_id)));

  return query select v_season.id, v_winner_id, v_winner_name;
end $$;

grant execute on function public.saga_finalize_buildup(uuid) to service_role;

-- ════════════════════════════════════════════════════════════════
-- 12) RPC: saga_finalize_season — Saison-Ende, Belohnungen verteilen
-- ════════════════════════════════════════════════════════════════
create or replace function public.saga_finalize_season(p_season_id uuid default null)
returns table (
  finalized_season_id uuid,
  winner_city_id uuid,
  total_users_rewarded int
)
language plpgsql security definer set search_path = public as $$
declare
  v_season public.saga_seasons%rowtype;
  v_users_rewarded int := 0;
  v_city record;
  v_rank int;
  v_reward record;
  v_member record;
begin
  if p_season_id is null then
    select * into v_season
      from public.saga_seasons
     where status in ('main','awards') and main_ends <= now()
     order by main_ends asc limit 1;
  else
    select * into v_season from public.saga_seasons where id = p_season_id;
  end if;

  if v_season.id is null then
    return;
  end if;

  -- Ranking: zuerst nach reached_finish_at (früher = besser), dann main_distance_m
  v_rank := 0;
  for v_city in
    select c.* from public.saga_cities c
     where c.season_id = v_season.id
     order by
       (c.reached_finish_at is null) asc,
       c.reached_finish_at asc nulls last,
       c.main_distance_m desc
  loop
    v_rank := v_rank + 1;

    update public.saga_cities
       set final_rank = v_rank
     where id = v_city.id;

    select * into v_reward
      from public.season_reward_for_rank('saga', v_rank,
        (v_city.member_count > 0));

    if v_reward.gems is not null and v_reward.gems > 0 then
      for v_member in
        select user_id from public.saga_members
         where season_id = v_season.id and city_id = v_city.id
      loop
        update public.users
           set gems = coalesce(gems,0) + v_reward.gems
         where id = v_member.user_id;
        v_users_rewarded := v_users_rewarded + 1;
      end loop;
    end if;
  end loop;

  -- Sieger-City setzen
  select id into v_season.winner_city_id
    from public.saga_cities
   where season_id = v_season.id and final_rank = 1;

  update public.saga_seasons
     set status = 'finalized',
         winner_city_id = v_season.winner_city_id,
         updated_at = now()
   where id = v_season.id;

  insert into public.saga_progress_log (season_id, city_id, event_kind, payload)
  values (v_season.id, v_season.winner_city_id, 'main_won', jsonb_build_object('rank', 1));

  return query select v_season.id, v_season.winner_city_id, v_users_rewarded;
end $$;

grant execute on function public.saga_finalize_season(uuid) to service_role;

-- ════════════════════════════════════════════════════════════════
-- 13) RPC: saga_create_season — Admin-Helper
-- ════════════════════════════════════════════════════════════════
create or replace function public.saga_create_season(
  p_name text,
  p_buildup_starts timestamptz,
  p_cities jsonb  -- [{name, slug, color_hex}, ...]
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_city jsonb;
begin
  insert into public.saga_seasons
    (name, status, buildup_starts, main_starts, main_ends, awards_ends, city_count)
  values
    (p_name, 'buildup',
     p_buildup_starts,
     p_buildup_starts + interval '7 days',
     p_buildup_starts + interval '21 days',
     p_buildup_starts + interval '23 days',
     coalesce(jsonb_array_length(p_cities), 0))
  returning id into v_id;

  for v_city in select * from jsonb_array_elements(p_cities)
  loop
    insert into public.saga_cities (season_id, name, slug, color_hex)
    values (
      v_id,
      v_city->>'name',
      v_city->>'slug',
      coalesce(v_city->>'color_hex', '#22D1C3')
    );
  end loop;

  return v_id;
end $$;

grant execute on function public.saga_create_season(text, timestamptz, jsonb) to service_role;

-- ════════════════════════════════════════════════════════════════
-- 14) View: saga_standings — Public Leaderboard-Quelle
-- ════════════════════════════════════════════════════════════════
create or replace view public.saga_standings as
select
  c.season_id,
  c.id as city_id,
  c.name as city_name,
  c.slug as city_slug,
  c.color_hex,
  c.current_stage,
  c.main_distance_m,
  c.camp_points_total,
  c.member_count,
  c.reached_finish_at,
  c.final_rank,
  rank() over (
    partition by c.season_id
    order by
      (c.reached_finish_at is null) asc,
      c.reached_finish_at asc nulls last,
      c.main_distance_m desc
  ) as live_rank
from public.saga_cities c;

grant select on public.saga_standings to anon, authenticated, service_role;

comment on table public.saga_seasons is 'Metropol-Saga Saisons (23-Tage-Cycle: 7d Auftakt + 14d Etappen + 2d Awards).';
comment on table public.saga_cities is 'Pro Saison N Städte (4–8). Bewegung der Mitglieder akkumuliert in main_distance_m.';
comment on table public.saga_members is 'User-Stadt-Zuordnung pro Saison.';
comment on column public.saga_cities.current_stage is '4 = Stadtrand, 0 = Wahrzeichen erreicht (Sieg).';
