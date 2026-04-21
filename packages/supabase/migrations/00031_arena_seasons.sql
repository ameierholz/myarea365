-- 00031: Arena-Saison-System (Variante B: Ewiger + Saison-Wächter)
-- Konzept:
--  - Jeder User hat 1 EWIGEN Wächter (permanent, kein Reset) + pro aktiver Saison optional 1 SAISON-Wächter (Level 1 Start).
--  - user_items sind user-scoped und bleiben immer beim User — Saison-Loot fließt automatisch ins Haupt-Inventar.
--  - Am Saison-Ende: Saison-Wächter wird archiviert, Prestige vergeben, Arena-State reset.
--  - Persistent: Runner-Account, Territorien, Partner-Shops, Crews, Ewiger Wächter, Inventar.
--  - Pro Saison getrennt: Saison-Wächter + dessen Progression, runner_fights, runner_fight_state, Session-Ranking.

-- ─── 1. Seasons-Tabelle ─────────────────────────────────────────────
create table if not exists public.arena_seasons (
  id          uuid primary key default gen_random_uuid(),
  number      int unique not null,
  name        text not null,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  status      text not null default 'upcoming' check (status in ('upcoming','active','archived')),
  created_at  timestamptz default now()
);

insert into public.arena_seasons (number, name, starts_at, ends_at, status)
  select 0, 'Pre-Saison (Beta)', now() - interval '30 days', now() + interval '60 days', 'active'
  where not exists (select 1 from public.arena_seasons where number = 0);

-- ─── 2. Helper: current_season_id ───────────────────────────────────
create or replace function public.current_season_id()
returns uuid language sql stable as $$
  select id from public.arena_seasons where status = 'active' order by starts_at desc limit 1
$$;

grant execute on function public.current_season_id() to authenticated, anon;

-- ─── 3. user_guardians: kind + season_id ────────────────────────────
-- kind='eternal' → permanent, Reset-frei
-- kind='seasonal' → pro Saison einer, wird am Saison-Ende archiviert
do $$
declare
  v_preseason uuid := (select id from public.arena_seasons where number = 0);
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_guardians' and column_name = 'kind') then
    alter table public.user_guardians add column kind text not null default 'eternal' check (kind in ('eternal','seasonal'));
  end if;

  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_guardians' and column_name = 'season_id') then
    -- NULL = ewiger Wächter; gesetzt = Saison-Wächter
    alter table public.user_guardians add column season_id uuid references public.arena_seasons(id);
  end if;

  -- user_items bekommen source_season_id (Info: aus welcher Saison stammt das Item)
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_items' and column_name = 'source_season_id') then
    alter table public.user_items add column source_season_id uuid references public.arena_seasons(id);
    update public.user_items set source_season_id = v_preseason where source_season_id is null;
    alter table public.user_items alter column source_season_id set default public.current_season_id();
  end if;

  -- runner_fights: season_id required
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'runner_fights' and column_name = 'season_id') then
    alter table public.runner_fights add column season_id uuid references public.arena_seasons(id);
    update public.runner_fights set season_id = v_preseason where season_id is null;
    alter table public.runner_fights alter column season_id set default public.current_season_id();
    alter table public.runner_fights alter column season_id set not null;
  end if;

  -- runner_fight_state: season-scoped (reset pro Saison)
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'runner_fight_state' and column_name = 'season_id') then
    alter table public.runner_fight_state add column season_id uuid references public.arena_seasons(id);
    update public.runner_fight_state set season_id = v_preseason where season_id is null;
    alter table public.runner_fight_state alter column season_id set default public.current_season_id();
    alter table public.runner_fight_state alter column season_id set not null;
  end if;
end $$;

-- Integrität: max. 1 Saison-Wächter pro (User, Saison).
-- Eternal bleibt ohne Uniqueness: ein User kann eine Wächter-Collection haben,
-- die über is_active steuert welcher aktuell primär kämpft.
create unique index if not exists uq_user_guardians_seasonal_one
  on public.user_guardians(user_id, season_id)
  where kind = 'seasonal';

-- ─── 4. Prestige (persistent über Saisons hinweg) ──────────────────
create table if not exists public.user_prestige (
  user_id          uuid not null references public.users(id) on delete cascade,
  season_id        uuid not null references public.arena_seasons(id) on delete cascade,
  final_rank       int,
  final_honor      int  default 0,
  final_wins       int  default 0,
  final_losses     int  default 0,
  prestige_points  int  not null default 0,
  title            text,                 -- "Champion" | "Gladiator" | "Kriegsmeister" | "Veteran"
  awarded_at       timestamptz default now(),
  primary key (user_id, season_id)
);

create or replace view public.user_prestige_total as
  select user_id,
         sum(prestige_points) as total_prestige,
         count(*)              as seasons_played,
         max(case when final_rank = 1 then 1 else 0 end) as has_champion_title,
         array_agg(title order by awarded_at desc) filter (where title is not null) as titles
    from public.user_prestige
   group by user_id;

-- ─── 5. Archive-Tabelle für Saison-Wächter ─────────────────────────
create table if not exists public.user_guardians_archive (
  like public.user_guardians including defaults,
  archived_at timestamptz default now()
);

-- ─── 6. Indexes ─────────────────────────────────────────────────────
create index if not exists idx_user_guardians_season      on public.user_guardians(season_id);
create index if not exists idx_user_guardians_kind        on public.user_guardians(kind);
create index if not exists idx_user_items_source_season   on public.user_items(source_season_id);
create index if not exists idx_runner_fights_season       on public.runner_fights(season_id);
create index if not exists idx_runner_fight_state_season  on public.runner_fight_state(season_id);
create index if not exists idx_user_prestige_user         on public.user_prestige(user_id);
create index if not exists idx_user_prestige_season       on public.user_prestige(season_id);

-- ─── 7. RLS ─────────────────────────────────────────────────────────
alter table public.arena_seasons enable row level security;
drop policy if exists arena_seasons_read on public.arena_seasons;
create policy arena_seasons_read on public.arena_seasons for select using (true);

alter table public.user_prestige enable row level security;
drop policy if exists user_prestige_read on public.user_prestige;
create policy user_prestige_read on public.user_prestige for select using (true);

-- ─── 8. Lifecycle RPCs ──────────────────────────────────────────────

-- 8a. Saison starten
create or replace function public.arena_season_start(
  p_name          text,
  p_duration_days int default 90,
  p_starts_at     timestamptz default null
) returns uuid language plpgsql security definer as $$
declare
  v_next_number int;
  v_starts      timestamptz := coalesce(p_starts_at, now());
  v_id          uuid;
begin
  if exists (select 1 from public.arena_seasons where status = 'active') then
    raise exception 'Aktive Saison existiert. Erst arena_season_end() aufrufen.';
  end if;
  select coalesce(max(number), 0) + 1 into v_next_number from public.arena_seasons;
  insert into public.arena_seasons (number, name, starts_at, ends_at, status)
    values (v_next_number, p_name, v_starts, v_starts + make_interval(days => p_duration_days), 'active')
    returning id into v_id;
  return v_id;
end $$;

-- 8b. User wählt seinen Saison-Wächter (ruft der User beim Saison-Start auf)
-- Items & Inventar bleiben am User — kommen automatisch dem Saison-Wächter zugute wenn er equippt
create or replace function public.arena_season_pick_guardian(
  p_user_id      uuid,
  p_archetype_id text
) returns uuid language plpgsql security definer as $$
declare
  v_season_id uuid := public.current_season_id();
  v_new_id    uuid;
begin
  if v_season_id is null then
    raise exception 'Keine aktive Saison';
  end if;

  -- Bereits gepickt?
  if exists (select 1 from public.user_guardians where user_id = p_user_id and kind = 'seasonal' and season_id = v_season_id) then
    raise exception 'Saison-Wächter bereits gewählt';
  end if;

  insert into public.user_guardians (
    user_id, archetype_id, kind, season_id, is_active,
    level, xp, wins, losses, current_hp_pct,
    talent_points_available, talent_points_spent
  ) values (
    p_user_id, p_archetype_id, 'seasonal', v_season_id, true,
    1, 0, 0, 0, 100,
    0, 0
  ) returning id into v_new_id;

  -- Alle anderen Wächter des Users deaktivieren (Saison-Wächter ist primärer Fighter)
  update public.user_guardians set is_active = false where user_id = p_user_id and id <> v_new_id;

  return v_new_id;
end $$;

-- 8c. Saison beenden: Snapshot + Prestige + Saison-Wächter auflösen
-- Items bleiben beim User (= kommen dem Ewigen Wächter zugute)
-- Equipment des Saison-Wächters wird entkoppelt (Items bleiben im Inventar, aber nicht mehr getragen)
create or replace function public.arena_season_end()
returns jsonb language plpgsql security definer as $$
declare
  v_season_id     uuid;
  v_archived      int := 0;
  v_prestige      int := 0;
begin
  select id into v_season_id from public.arena_seasons where status = 'active' limit 1;
  if v_season_id is null then
    return jsonb_build_object('ok', false, 'error', 'no_active_season');
  end if;

  -- Snapshot aller Saison-Wächter ins Archiv
  insert into public.user_guardians_archive
    select ug.*, now() from public.user_guardians ug
     where kind = 'seasonal' and season_id = v_season_id;
  get diagnostics v_archived = row_count;

  -- Prestige berechnen
  with wins_per_user as (
    select winner_user_id as user_id, count(*) as wins
      from public.runner_fights
     where season_id = v_season_id and winner_user_id is not null
     group by winner_user_id
  ),
  losses_per_user as (
    select user_id, sum(losses) as losses from (
      select attacker_id  as user_id, count(*) as losses from public.runner_fights where season_id = v_season_id and winner_user_id is not null and winner_user_id <> attacker_id group by attacker_id
      union all
      select defender_id  as user_id, count(*) as losses from public.runner_fights where season_id = v_season_id and winner_user_id is not null and winner_user_id <> defender_id group by defender_id
    ) x group by user_id
  ),
  honor as (
    select w.user_id,
           w.wins,
           coalesce(l.losses, 0) as losses,
           w.wins * coalesce(u.level, 1) * 10 as honor,
           row_number() over (order by w.wins * coalesce(u.level, 1) * 10 desc) as rnk
      from wins_per_user w
      left join losses_per_user l on l.user_id = w.user_id
      left join public.users u on u.id = w.user_id
  )
  insert into public.user_prestige (user_id, season_id, final_rank, final_honor, final_wins, final_losses, prestige_points, title)
  select
    user_id, v_season_id, rnk, honor, wins, losses,
    case
      when rnk = 1  then 500
      when rnk <= 3 then 300
      when rnk <= 10 then 150
      when rnk <= 50 then 75
      when wins > 0 then 25
      else 0
    end,
    case
      when rnk = 1  then 'Champion'
      when rnk <= 3 then 'Gladiator'
      when rnk <= 10 then 'Kriegsmeister'
      when rnk <= 50 then 'Veteran'
      else null
    end
  from honor
  on conflict (user_id, season_id) do update
    set final_rank      = excluded.final_rank,
        final_honor     = excluded.final_honor,
        final_wins      = excluded.final_wins,
        final_losses    = excluded.final_losses,
        prestige_points = excluded.prestige_points,
        title           = excluded.title;
  get diagnostics v_prestige = row_count;

  -- Saison-Wächter auflösen: Equipment entkoppeln, Talents/Skills löschen, Wächter-Row löschen
  -- WICHTIG: user_items bleiben unberührt — landen automatisch beim Ewigen Wächter
  delete from public.guardian_equipment
    where guardian_id in (select id from public.user_guardians where kind = 'seasonal' and season_id = v_season_id);
  delete from public.guardian_talents
    where guardian_id in (select id from public.user_guardians where kind = 'seasonal' and season_id = v_season_id);
  delete from public.guardian_skill_levels
    where guardian_id in (select id from public.user_guardians where kind = 'seasonal' and season_id = v_season_id);
  delete from public.user_guardians
    where kind = 'seasonal' and season_id = v_season_id;

  -- Arena-Fight-State resetten
  delete from public.runner_fight_state where season_id = v_season_id;

  -- Pro User genau EINEN ewigen Wächter wieder aktivieren (höchstes Level, neuester Eintrag).
  -- Nur für User, die einen Saison-Wächter hatten (und jetzt wieder einen aktiven brauchen).
  with candidates as (
    select distinct ga.user_id
      from public.user_guardians_archive ga
     where ga.season_id = v_season_id
  ),
  pick as (
    select distinct on (ug.user_id) ug.user_id, ug.id
      from public.user_guardians ug
      join candidates c on c.user_id = ug.user_id
     where ug.kind = 'eternal'
     order by ug.user_id, ug.level desc, ug.acquired_at desc
  )
  update public.user_guardians ug
     set is_active = (ug.id = p.id)
    from pick p
   where ug.user_id = p.user_id and ug.kind = 'eternal';

  -- Saison archivieren
  update public.arena_seasons set status = 'archived' where id = v_season_id;

  return jsonb_build_object(
    'ok', true,
    'season_id', v_season_id,
    'archived_seasonal_guardians', v_archived,
    'prestige_awarded', v_prestige
  );
end $$;

-- 8d. Rollover: end() + neue Saison starten
create or replace function public.arena_season_rollover(
  p_next_name     text,
  p_duration_days int default 90
) returns jsonb language plpgsql security definer as $$
declare
  v_end_result jsonb;
  v_new_season uuid;
begin
  v_end_result := public.arena_season_end();
  v_new_season := public.arena_season_start(p_next_name, p_duration_days);
  return jsonb_build_object(
    'ok', true,
    'ended', v_end_result,
    'new_season_id', v_new_season,
    'note', 'Spieler müssen ihren Saison-Wächter in der neuen Saison neu wählen (arena_season_pick_guardian).'
  );
end $$;

-- ─── 9. Berechtigungen ──────────────────────────────────────────────
grant execute on function public.arena_season_start(text, int, timestamptz)             to service_role;
grant execute on function public.arena_season_end()                                     to service_role;
grant execute on function public.arena_season_rollover(text, int)                       to service_role;
grant execute on function public.arena_season_pick_guardian(uuid, text)                 to authenticated;

-- ─── 10. Backfill: bestehende Wächter als EWIG markieren ───────────
-- Alles was vor der Migration existierte wird zum Ewigen Wächter des Users.
update public.user_guardians set kind = 'eternal', season_id = null where kind is null or kind = '';
