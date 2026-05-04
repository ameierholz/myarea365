-- 00244: Shop-Liga Saison-System (wöchentlich)
--
-- Bisher hatten shop_arenas + arena_battles nur Lifetime-Counter (total_battles)
-- — kein wöchentliches Ranking, keine Sieger-Belohnung. Damit Shops mehr
-- Premium-Slots buchen ("eigenes Ranking pro Woche, der Sieger bekommt eine
-- Trophäe und 5000 🏴 für die Crew") braucht es ein wirkliches Saison-System.
--
-- Saison-Definition: ISO-Woche (Montag 00:00 UTC → Sonntag 23:59 UTC).
-- Die Cron-Funktion finalize_shop_league_seasons() läuft Montag 00:05 UTC
-- und schließt die letzte Woche ab + verteilt Rewards.

-- ═══════════════════════════════════════════════════════
-- 1) Tabellen
-- ═══════════════════════════════════════════════════════

create table if not exists public.shop_league_seasons (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.local_businesses(id) on delete cascade,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  status          text not null default 'active' check (status in ('active','finalized')),
  finalized_at    timestamptz,
  total_battles   int not null default 0,
  created_at      timestamptz not null default now(),
  unique (business_id, starts_at)
);

create index if not exists idx_shop_league_seasons_active
  on public.shop_league_seasons(status, ends_at);

create table if not exists public.shop_league_standings (
  id           uuid primary key default gen_random_uuid(),
  season_id    uuid not null references public.shop_league_seasons(id) on delete cascade,
  crew_id      uuid not null references public.crews(id) on delete cascade,
  wins         int not null default 0,
  losses       int not null default 0,
  score        int not null default 0,           -- = wins (Tie-Break optional über Battle-Zahl)
  rank         int,                              -- gesetzt beim Finalize
  reward_paid  bigint not null default 0,        -- Gebietsruf an Mitglieder verteilt
  unique (season_id, crew_id)
);

create index if not exists idx_shop_league_standings_season
  on public.shop_league_standings(season_id, score desc);

-- ═══════════════════════════════════════════════════════
-- 2) Helper: ISO-Wochen-Bounds berechnen
-- ═══════════════════════════════════════════════════════
create or replace function public.iso_week_start(p_ts timestamptz)
returns timestamptz language sql immutable as $$
  select date_trunc('week', p_ts at time zone 'UTC') at time zone 'UTC';
$$;

-- ═══════════════════════════════════════════════════════
-- 3) Auto-Season-Get-or-Create für aktuelle Woche
-- ═══════════════════════════════════════════════════════
create or replace function public.shop_league_current_season(p_business_id uuid)
returns uuid language plpgsql security definer as $$
declare
  v_start timestamptz := public.iso_week_start(now());
  v_end   timestamptz := v_start + interval '7 days';
  v_id    uuid;
begin
  insert into public.shop_league_seasons (business_id, starts_at, ends_at)
    values (p_business_id, v_start, v_end)
  on conflict (business_id, starts_at) do nothing;

  select id into v_id from public.shop_league_seasons
    where business_id = p_business_id and starts_at = v_start;

  return v_id;
end $$;

grant execute on function public.shop_league_current_season(uuid) to authenticated, service_role;

-- ═══════════════════════════════════════════════════════
-- 4) Battle-Hook: bei jedem arena_battle die Standings updaten
--    Trigger schreibt automatisch in shop_league_standings,
--    damit das Application-Code-Path nichts wissen muss.
-- ═══════════════════════════════════════════════════════
create or replace function public.shop_league_record_battle()
returns trigger language plpgsql security definer as $$
declare v_season uuid;
begin
  v_season := public.shop_league_current_season(new.business_id);
  if v_season is null then return new; end if;

  -- Sieger-Eintrag (+1 Win, +1 Score)
  if new.winner_crew_id is not null then
    insert into public.shop_league_standings (season_id, crew_id, wins, score)
      values (v_season, new.winner_crew_id, 1, 1)
    on conflict (season_id, crew_id) do update
      set wins = public.shop_league_standings.wins + 1,
          score = public.shop_league_standings.score + 1;
  end if;

  -- Verlierer-Eintrag (+1 Loss). Wenn Tie (winner_crew_id null), beide bekommen 0/0.
  if new.winner_crew_id is not null then
    declare v_loser uuid := case when new.winner_crew_id = new.challenger_crew_id
                                 then new.defender_crew_id
                                 else new.challenger_crew_id end;
    begin
      insert into public.shop_league_standings (season_id, crew_id, losses)
        values (v_season, v_loser, 1)
      on conflict (season_id, crew_id) do update
        set losses = public.shop_league_standings.losses + 1;
    end;
  end if;

  -- Saison-Counter
  update public.shop_league_seasons
    set total_battles = total_battles + 1
    where id = v_season;

  return new;
end $$;

drop trigger if exists trg_shop_league_record on public.arena_battles;
create trigger trg_shop_league_record
  after insert on public.arena_battles
  for each row execute function public.shop_league_record_battle();

-- ═══════════════════════════════════════════════════════
-- 5) Cron-Finalizer: schließt alle Seasons mit ends_at <= now()
--    Verteilt Top-3-Reward auf Crew-Mitglieder als Gebietsruf:
--      Rang 1 = 5000 🏴, Rang 2 = 2500 🏴, Rang 3 = 1000 🏴
--    Zusätzlich: jeder mit ≥1 Sieg bekommt 250 🏴 als Teilnahme-Reward.
-- ═══════════════════════════════════════════════════════
create or replace function public.finalize_shop_league_seasons()
returns table (season_id uuid, business_id uuid, crews_ranked int, rep_paid bigint)
language plpgsql security definer as $$
declare
  s record;
  v_crews_ranked int;
  v_rep_paid bigint;
  v_rank int;
  st record;
  v_reward int;
begin
  for s in
    select id, business_id from public.shop_league_seasons
      where status = 'active' and ends_at <= now()
  loop
    v_crews_ranked := 0;
    v_rep_paid := 0;

    -- Ränge schreiben (höchster score zuerst, Tie-Break: weniger Niederlagen)
    v_rank := 0;
    for st in
      select id, crew_id, wins
      from public.shop_league_standings
      where season_id = s.id
      order by score desc, losses asc, wins desc
    loop
      v_rank := v_rank + 1;
      v_reward := case v_rank
        when 1 then 5000
        when 2 then 2500
        when 3 then 1000
        else (case when st.wins >= 1 then 250 else 0 end)
      end;

      update public.shop_league_standings
        set rank = v_rank, reward_paid = v_reward
        where id = st.id;

      if v_reward > 0 then
        update public.users u
          set gebietsruf = coalesce(gebietsruf, 0) + v_reward
          where u.id in (
            select user_id from public.crew_members where crew_id = st.crew_id
          );
        v_rep_paid := v_rep_paid + v_reward;

        -- Crew-Feed-Eintrag (Bragging-Rights)
        begin
          perform public.add_crew_feed(
            st.crew_id, null, 'shop_league_finished',
            jsonb_build_object(
              'rank', v_rank, 'business_id', s.business_id,
              'gebietsruf', v_reward, 'season_id', s.id
            )
          );
        exception when others then
          -- add_crew_feed ist optional; bei fehlender RPC nicht abbrechen
          null;
        end;
      end if;

      v_crews_ranked := v_crews_ranked + 1;
    end loop;

    update public.shop_league_seasons
      set status = 'finalized', finalized_at = now()
      where id = s.id;

    season_id := s.id;
    business_id := s.business_id;
    crews_ranked := v_crews_ranked;
    rep_paid := v_rep_paid;
    return next;
  end loop;

  return;
end $$;

grant execute on function public.finalize_shop_league_seasons() to service_role;

-- ═══════════════════════════════════════════════════════
-- 6) RLS — Standings sind öffentlich lesbar (für Shop-Liga-UI),
--    Schreiben nur via RPC/Trigger.
-- ═══════════════════════════════════════════════════════
alter table public.shop_league_seasons enable row level security;
alter table public.shop_league_standings enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='shop_league_seasons' and policyname='sls_public_read') then
    create policy sls_public_read on public.shop_league_seasons for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='shop_league_standings' and policyname='sld_public_read') then
    create policy sld_public_read on public.shop_league_standings for select using (true);
  end if;
end $$;

comment on table public.shop_league_seasons is
  'Wöchentliche Shop-Liga-Saisons. Auto-create on first battle, finalize via Cron Montag 00:05 UTC.';
comment on table public.shop_league_standings is
  'Crew-Ranking pro Shop-Liga-Saison. Rank wird beim Finalize gesetzt + Reward verteilt.';
