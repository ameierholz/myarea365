-- 00044: Crew vs Crew — Wars, Season-Liga, Capture-the-Flag Flash-Events.

-- ═══════════════════════════════════════════════════════
-- CREW-WARS (7-Tage-Fehde zwischen zwei Crews)
-- ═══════════════════════════════════════════════════════
create table if not exists public.crew_wars (
  id uuid primary key default gen_random_uuid(),
  crew_a_id uuid not null references public.crews(id) on delete cascade,
  crew_b_id uuid not null references public.crews(id) on delete cascade,
  declared_by uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','active','finished','cancelled','declined')),
  starts_at timestamptz,
  ends_at timestamptz,
  crew_a_score numeric not null default 0,
  crew_b_score numeric not null default 0,
  crew_a_km numeric not null default 0,
  crew_b_km numeric not null default 0,
  crew_a_territories int not null default 0,
  crew_b_territories int not null default 0,
  winner_crew_id uuid references public.crews(id) on delete set null,
  prize_xp int not null default 5000,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  check (crew_a_id <> crew_b_id)
);

create index if not exists idx_crew_wars_crew_a on public.crew_wars(crew_a_id, status);
create index if not exists idx_crew_wars_crew_b on public.crew_wars(crew_b_id, status);

alter table public.crew_wars enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='crew_wars' and policyname='select_public') then
    create policy select_public on public.crew_wars for select using (true);
  end if;
end $$;

-- RPC: Score-Bump bei jedem Walk (1 km = 1 Pt, 1 Territorium = 10 Pt)
create or replace function public.bump_crew_war_score(p_crew_id uuid, p_km numeric default 0, p_territories int default 0)
returns void language plpgsql security definer as $$
begin
  update public.crew_wars
  set crew_a_km = crew_a_km + p_km,
      crew_a_territories = crew_a_territories + p_territories,
      crew_a_score = crew_a_score + p_km + (p_territories * 10)
  where crew_a_id = p_crew_id and status = 'active';
  update public.crew_wars
  set crew_b_km = crew_b_km + p_km,
      crew_b_territories = crew_b_territories + p_territories,
      crew_b_score = crew_b_score + p_km + (p_territories * 10)
  where crew_b_id = p_crew_id and status = 'active';
end $$;

grant execute on function public.bump_crew_war_score(uuid, numeric, int) to authenticated, service_role;

-- RPC: abgelaufene Wars finalisieren + Winner-XP ausschütten
create or replace function public.finalize_expired_crew_wars()
returns int language plpgsql security definer as $$
declare v_count int := 0; r record;
begin
  for r in
    select id, crew_a_id, crew_b_id, crew_a_score, crew_b_score, prize_xp
    from public.crew_wars
    where status = 'active' and ends_at < now()
  loop
    declare v_winner uuid := case
      when r.crew_a_score > r.crew_b_score then r.crew_a_id
      when r.crew_b_score > r.crew_a_score then r.crew_b_id
      else null
    end;
    begin
      update public.crew_wars
      set status = 'finished', winner_crew_id = v_winner, finished_at = now()
      where id = r.id;

      -- XP an alle Mitglieder der Winner-Crew
      if v_winner is not null then
        update public.users u
        set xp = coalesce(xp, 0) + r.prize_xp
        where u.id in (select user_id from public.crew_members where crew_id = v_winner);
        -- Feed
        perform public.add_crew_feed(v_winner, null, 'duel_won',
          jsonb_build_object('opponent', case when v_winner = r.crew_a_id then r.crew_b_id else r.crew_a_id end, 'kind','war','xp', r.prize_xp));
        perform public.add_crew_feed(
          case when v_winner = r.crew_a_id then r.crew_b_id else r.crew_a_id end,
          null, 'duel_lost',
          jsonb_build_object('opponent', v_winner, 'kind','war'));
      end if;
      v_count := v_count + 1;
    end;
  end loop;
  return v_count;
end $$;

grant execute on function public.finalize_expired_crew_wars() to service_role;

-- ═══════════════════════════════════════════════════════
-- CREW-SEASONS (monatliche Liga-Standings)
-- ═══════════════════════════════════════════════════════
create table if not exists public.crew_seasons (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  month int not null check (month between 1 and 12),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'active' check (status in ('active','finalized')),
  created_at timestamptz not null default now(),
  unique(year, month)
);

create table if not exists public.crew_season_standings (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.crew_seasons(id) on delete cascade,
  crew_id uuid not null references public.crews(id) on delete cascade,
  tier text not null default 'bronze' check (tier in ('bronze','silver','gold','diamond','legend')),
  points numeric not null default 0,
  duel_wins int not null default 0,
  war_wins int not null default 0,
  territories_claimed int not null default 0,
  final_rank int,
  promoted_to text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(season_id, crew_id)
);

create index if not exists idx_crew_season_standings_season on public.crew_season_standings(season_id, points desc);

alter table public.crew_seasons enable row level security;
alter table public.crew_season_standings enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='crew_seasons' and policyname='select_public') then
    create policy select_public on public.crew_seasons for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='crew_season_standings' and policyname='select_public') then
    create policy select_public on public.crew_season_standings for select using (true);
  end if;
end $$;

-- RPC: aktuelle Season holen (oder anlegen)
create or replace function public.current_crew_season()
returns uuid language plpgsql security definer as $$
declare
  v_year int := extract(year from (now() at time zone 'Europe/Berlin'));
  v_month int := extract(month from (now() at time zone 'Europe/Berlin'));
  v_id uuid;
  v_start timestamptz;
  v_end timestamptz;
begin
  select id into v_id from public.crew_seasons where year = v_year and month = v_month;
  if v_id is not null then return v_id; end if;

  v_start := date_trunc('month', (now() at time zone 'Europe/Berlin'))::timestamptz;
  v_end := (v_start + interval '1 month') - interval '1 second';
  insert into public.crew_seasons (year, month, starts_at, ends_at)
  values (v_year, v_month, v_start, v_end)
  returning id into v_id;
  return v_id;
end $$;

grant execute on function public.current_crew_season() to authenticated, service_role;

-- RPC: Punkte auf aktueller Season für eine Crew hochzählen
create or replace function public.bump_crew_season_points(
  p_crew_id uuid, p_points numeric, p_reason text default 'generic'
) returns void language plpgsql security definer as $$
declare v_season uuid := public.current_crew_season();
begin
  insert into public.crew_season_standings (season_id, crew_id, points)
  values (v_season, p_crew_id, p_points)
  on conflict (season_id, crew_id) do update
    set points = crew_season_standings.points + p_points,
        duel_wins = crew_season_standings.duel_wins + (case when p_reason = 'duel_win' then 1 else 0 end),
        war_wins = crew_season_standings.war_wins + (case when p_reason = 'war_win' then 1 else 0 end),
        territories_claimed = crew_season_standings.territories_claimed + (case when p_reason = 'territory' then 1 else 0 end),
        updated_at = now();
end $$;

grant execute on function public.bump_crew_season_points(uuid, numeric, text) to authenticated, service_role;

-- ═══════════════════════════════════════════════════════
-- CAPTURE-THE-FLAG (zeitlich begrenzte Micro-PvP-Events)
-- ═══════════════════════════════════════════════════════
create table if not exists public.crew_flag_events (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Flaggen-Kampf',
  lat numeric not null,
  lng numeric not null,
  radius_m int not null default 80,
  plz text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  target_visits int not null default 10,
  prize_xp int not null default 3000,
  winner_crew_id uuid references public.crews(id) on delete set null,
  status text not null default 'active' check (status in ('active','finished','expired')),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists idx_crew_flag_events_status on public.crew_flag_events(status, ends_at);

create table if not exists public.crew_flag_visits (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.crew_flag_events(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  crew_id uuid references public.crews(id) on delete set null,
  visited_at timestamptz not null default now(),
  unique(event_id, user_id)
);

create index if not exists idx_crew_flag_visits_event on public.crew_flag_visits(event_id, crew_id);

alter table public.crew_flag_events enable row level security;
alter table public.crew_flag_visits enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='crew_flag_events' and policyname='select_public') then
    create policy select_public on public.crew_flag_events for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='crew_flag_visits' and policyname='select_public') then
    create policy select_public on public.crew_flag_visits for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='crew_flag_visits' and policyname='insert_own') then
    create policy insert_own on public.crew_flag_visits for insert to authenticated
      with check (user_id = auth.uid());
  end if;
end $$;

-- RPC: Visit registrieren + Winner prüfen
create or replace function public.register_flag_visit(p_event_id uuid, p_user_id uuid, p_crew_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_event record;
  v_crew_visits int;
  v_winner uuid;
begin
  select * into v_event from public.crew_flag_events where id = p_event_id;
  if v_event is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if v_event.status <> 'active' then return jsonb_build_object('ok', false, 'error', 'not_active'); end if;
  if v_event.ends_at < now() then
    update public.crew_flag_events set status = 'expired' where id = p_event_id;
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  -- Visit persistieren (unique: nur 1x pro User/Event)
  insert into public.crew_flag_visits (event_id, user_id, crew_id)
  values (p_event_id, p_user_id, p_crew_id)
  on conflict (event_id, user_id) do nothing;

  -- Zählen: wie viele Visits aus dieser Crew?
  if p_crew_id is not null then
    select count(*) into v_crew_visits
    from public.crew_flag_visits
    where event_id = p_event_id and crew_id = p_crew_id;

    if v_crew_visits >= v_event.target_visits then
      v_winner := p_crew_id;
      update public.crew_flag_events
      set status = 'finished', winner_crew_id = v_winner, finished_at = now()
      where id = p_event_id and status = 'active';
      -- XP an Winner-Crew-Mitglieder verteilen
      update public.users u
      set xp = coalesce(xp, 0) + v_event.prize_xp
      where u.id in (select user_id from public.crew_members where crew_id = v_winner);
      -- Feed
      perform public.add_crew_feed(v_winner, null, 'challenge_completed',
        jsonb_build_object('name', v_event.name, 'xp', v_event.prize_xp, 'kind', 'flag'));
      return jsonb_build_object('ok', true, 'won', true, 'xp', v_event.prize_xp);
    end if;
  end if;

  return jsonb_build_object('ok', true, 'won', false, 'crew_visits', v_crew_visits);
end $$;

grant execute on function public.register_flag_visit(uuid, uuid, uuid) to authenticated, service_role;
