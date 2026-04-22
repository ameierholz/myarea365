-- 00043: Crew-Engagement — Duelle, Challenges, Events, Chat, Feed.
-- Deckt Wave 2–5 aus dem Roadmap-Plan ab. Solide Indices + RLS.

-- ═══════════════════════════════════════════════════════
-- CREW-DUELLE (wöchentliche Auto-Matchups)
-- ═══════════════════════════════════════════════════════
create table if not exists public.crew_duels (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  crew_a_id uuid not null references public.crews(id) on delete cascade,
  crew_b_id uuid not null references public.crews(id) on delete cascade,
  crew_a_km numeric not null default 0,
  crew_b_km numeric not null default 0,
  winner_crew_id uuid references public.crews(id) on delete set null,
  status text not null default 'active' check (status in ('active','finished')),
  prize_xp int not null default 2000,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique(week_start, crew_a_id, crew_b_id),
  check (crew_a_id <> crew_b_id)
);

create index if not exists idx_crew_duels_week on public.crew_duels(week_start, status);
create index if not exists idx_crew_duels_crew_a on public.crew_duels(crew_a_id, week_start desc);
create index if not exists idx_crew_duels_crew_b on public.crew_duels(crew_b_id, week_start desc);

alter table public.crew_duels enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='crew_duels' and policyname='select_public') then
    create policy select_public on public.crew_duels for select using (true);
  end if;
end $$;

-- RPC: nutzt Liga (via crews.weekly_km), matcht zufällig innerhalb Tier
create or replace function public.schedule_weekly_crew_duels()
returns int language plpgsql security definer as $$
declare
  v_week_start date := (date_trunc('week', (now() at time zone 'Europe/Berlin')::date))::date;
  v_created int := 0;
  v_crew record;
  v_opponent record;
begin
  -- Pro Crew die noch kein Duel diese Woche hat einen Gegner suchen
  for v_crew in
    select c.id, coalesce(c.weekly_km, 0) as wkm
    from public.crews c
    where not exists (
      select 1 from public.crew_duels d
      where d.week_start = v_week_start
        and (d.crew_a_id = c.id or d.crew_b_id = c.id)
    )
    order by random()
  loop
    -- Gegner: andere Crew in ähnlichem Liga-Bucket die auch noch kein Duel hat
    select c2.id into v_opponent
    from public.crews c2
    where c2.id <> v_crew.id
      and not exists (
        select 1 from public.crew_duels d2
        where d2.week_start = v_week_start
          and (d2.crew_a_id = c2.id or d2.crew_b_id = c2.id)
      )
    order by abs(coalesce(c2.weekly_km, 0) - v_crew.wkm) asc, random()
    limit 1;

    if v_opponent.id is not null then
      insert into public.crew_duels (week_start, crew_a_id, crew_b_id, crew_a_km, crew_b_km)
      values (v_week_start, v_crew.id, v_opponent.id, v_crew.wkm, 0)
      on conflict do nothing;
      v_created := v_created + 1;
    end if;
  end loop;

  return v_created;
end $$;

grant execute on function public.schedule_weekly_crew_duels() to service_role;

-- RPC: km für aktives Duel hochzählen
create or replace function public.bump_crew_duel_km(p_crew_id uuid, p_km numeric)
returns void language plpgsql security definer as $$
declare
  v_week_start date := (date_trunc('week', (now() at time zone 'Europe/Berlin')::date))::date;
begin
  update public.crew_duels
  set crew_a_km = crew_a_km + p_km
  where week_start = v_week_start and crew_a_id = p_crew_id and status = 'active';
  update public.crew_duels
  set crew_b_km = crew_b_km + p_km
  where week_start = v_week_start and crew_b_id = p_crew_id and status = 'active';
end $$;

grant execute on function public.bump_crew_duel_km(uuid, numeric) to authenticated, service_role;

-- ═══════════════════════════════════════════════════════
-- CREW-CHALLENGES (kollektive Wochenziele)
-- ═══════════════════════════════════════════════════════
create table if not exists public.crew_challenges (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  name text not null,
  description text,
  icon text not null default '🎯',
  target_metric text not null check (target_metric in ('weekly_km','new_streets','territories','arena_wins','members_active')),
  target_value numeric not null,
  progress numeric not null default 0,
  reward_xp int not null default 2500,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  completed_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_crew_challenges_crew on public.crew_challenges(crew_id, ends_at desc);

alter table public.crew_challenges enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='crew_challenges' and policyname='select_public') then
    create policy select_public on public.crew_challenges for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='crew_challenges' and policyname='insert_crew_admin') then
    create policy insert_crew_admin on public.crew_challenges for insert to authenticated
      with check (exists (
        select 1 from public.crew_members m
        where m.crew_id = crew_challenges.crew_id
          and m.user_id = auth.uid()
          and m.role in ('admin','owner')
      ));
  end if;
end $$;

create or replace function public.bump_crew_challenge_progress(p_crew_id uuid, p_metric text, p_amount numeric)
returns int language plpgsql security definer as $$
declare v_updated int := 0;
begin
  with upd as (
    update public.crew_challenges
    set progress = least(progress + p_amount, target_value),
        completed_at = case
          when progress + p_amount >= target_value and completed_at is null then now()
          else completed_at
        end
    where crew_id = p_crew_id
      and target_metric = p_metric
      and ends_at > now()
      and completed_at is null
    returning id
  )
  select count(*)::int into v_updated from upd;
  return v_updated;
end $$;

grant execute on function public.bump_crew_challenge_progress(uuid, text, numeric) to authenticated, service_role;

-- ═══════════════════════════════════════════════════════
-- CREW-EVENTS (Gruppenläufe)
-- ═══════════════════════════════════════════════════════
create table if not exists public.crew_events (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  created_by uuid not null references public.users(id) on delete cascade,
  title text not null,
  description text,
  starts_at timestamptz not null,
  meeting_point text,
  meeting_lat numeric,
  meeting_lng numeric,
  target_distance_km numeric,
  target_pace_min_per_km numeric,
  max_attendees int,
  status text not null default 'planned' check (status in ('planned','live','done','cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists idx_crew_events_crew on public.crew_events(crew_id, starts_at desc);

create table if not exists public.crew_event_rsvps (
  event_id uuid not null references public.crew_events(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'going' check (status in ('going','maybe','declined')),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.crew_events enable row level security;
alter table public.crew_event_rsvps enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='crew_events' and policyname='select_public') then
    create policy select_public on public.crew_events for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='crew_events' and policyname='insert_member') then
    create policy insert_member on public.crew_events for insert to authenticated
      with check (exists (
        select 1 from public.crew_members m
        where m.crew_id = crew_events.crew_id and m.user_id = auth.uid()
      ) and created_by = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='crew_events' and policyname='update_own') then
    create policy update_own on public.crew_events for update to authenticated
      using (created_by = auth.uid()) with check (created_by = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='crew_event_rsvps' and policyname='select_public') then
    create policy select_public on public.crew_event_rsvps for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='crew_event_rsvps' and policyname='upsert_own') then
    create policy upsert_own on public.crew_event_rsvps for all to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

-- ═══════════════════════════════════════════════════════
-- CREW-CHAT (Messages)
-- ═══════════════════════════════════════════════════════
create table if not exists public.crew_messages (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 600),
  reply_to uuid references public.crew_messages(id) on delete set null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create index if not exists idx_crew_messages_crew on public.crew_messages(crew_id, created_at desc);

alter table public.crew_messages enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='crew_messages' and policyname='select_crew_member') then
    create policy select_crew_member on public.crew_messages for select to authenticated
      using (exists (
        select 1 from public.crew_members m
        where m.crew_id = crew_messages.crew_id and m.user_id = auth.uid()
      ));
  end if;
  if not exists (select 1 from pg_policies where tablename='crew_messages' and policyname='insert_crew_member') then
    create policy insert_crew_member on public.crew_messages for insert to authenticated
      with check (
        user_id = auth.uid() and
        exists (select 1 from public.crew_members m
                where m.crew_id = crew_messages.crew_id and m.user_id = auth.uid())
      );
  end if;
  if not exists (select 1 from pg_policies where tablename='crew_messages' and policyname='update_own') then
    create policy update_own on public.crew_messages for update to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

-- Realtime aktivieren (falls publication existiert)
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.crew_messages';
  end if;
exception when others then null;
end $$;

-- ═══════════════════════════════════════════════════════
-- CREW-FEED (Auto-Events)
-- ═══════════════════════════════════════════════════════
create table if not exists public.crew_feed (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  kind text not null check (kind in ('member_joined','member_left','territory_claimed','challenge_completed','duel_won','duel_lost','event_created','km_milestone','arena_victory')),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_crew_feed_crew on public.crew_feed(crew_id, created_at desc);

alter table public.crew_feed enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='crew_feed' and policyname='select_public') then
    create policy select_public on public.crew_feed for select using (true);
  end if;
end $$;

-- Helper RPC für saubere Feed-Inserts aus APIs/Triggern
create or replace function public.add_crew_feed(
  p_crew_id uuid, p_user_id uuid, p_kind text, p_data jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer as $$
declare v_id uuid;
begin
  insert into public.crew_feed (crew_id, user_id, kind, data)
  values (p_crew_id, p_user_id, p_kind, coalesce(p_data, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end $$;

grant execute on function public.add_crew_feed(uuid, uuid, text, jsonb) to authenticated, service_role;
