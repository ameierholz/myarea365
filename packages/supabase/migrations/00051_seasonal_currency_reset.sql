-- 00051: Monatliche Saison-Archivierung für 🏴 Gebietsruf und ⚔️ Sessionehre.
--
-- Problem: Beide Währungen haben keine Sinks (nur Leaderboard-Display).
-- Ohne Reset akkumulieren Top-Spieler/Crews auf unendlich — Newcomer
-- sehen sechsstellige Abstände und geben auf.
--
-- Fix: Am Monatsende wird der aktuelle Stand in eine History-Tabelle
-- archiviert (inkl. Rank + Titel). Leben bleibt bei users.sessionehre_all_time
-- und users.gebietsruf_all_time sichtbar als Prestige-Indikator, die aktive
-- Saison (users.sessionehre, users.gebietsruf) wird zurück auf 0 gesetzt.
--
-- Damit: frischer Start jede Saison, historische Leistung bleibt sichtbar,
-- Newcomer haben realistische Chancen.

-- ═══════════════════════════════════════════════════════
-- 1) All-Time-Summen sichtbar halten
-- ═══════════════════════════════════════════════════════
alter table public.users
  add column if not exists gebietsruf_all_time bigint not null default 0,
  add column if not exists sessionehre_all_time bigint not null default 0;

create index if not exists idx_users_gebietsruf_all_time
  on public.users(gebietsruf_all_time desc);
create index if not exists idx_users_sessionehre_all_time
  on public.users(sessionehre_all_time desc);

comment on column public.users.gebietsruf_all_time is
  'Summe aller je verdienten Gebietsruf-Punkte (bleibt bei Saison-Reset erhalten).';
comment on column public.users.sessionehre_all_time is
  'Summe aller je verdienten Sessionehre-Punkte (bleibt bei Saison-Reset erhalten).';

-- ═══════════════════════════════════════════════════════
-- 2) History-Tabelle für Top-Platzierungen
-- ═══════════════════════════════════════════════════════
create table if not exists public.currency_season_archive (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  season_year int not null,
  season_month int not null check (season_month between 1 and 12),
  currency text not null check (currency in ('gebietsruf','sessionehre')),
  final_amount bigint not null,
  final_rank int,
  created_at timestamptz not null default now(),
  unique(user_id, season_year, season_month, currency)
);

create index if not exists idx_csa_season
  on public.currency_season_archive(season_year, season_month, currency, final_rank);

alter table public.currency_season_archive enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='currency_season_archive' and policyname='csa_read') then
    create policy csa_read on public.currency_season_archive for select using (true);
  end if;
end $$;

-- ═══════════════════════════════════════════════════════
-- 3) bump_sessionehre + bump_gebietsruf pflegen auch _all_time
-- ═══════════════════════════════════════════════════════
create or replace function public.bump_sessionehre(p_user_id uuid, p_delta int)
returns bigint language plpgsql security definer as $$
declare v_new bigint;
begin
  update public.users
    set sessionehre = greatest(0, coalesce(sessionehre, 0) + p_delta),
        sessionehre_all_time = greatest(0, coalesce(sessionehre_all_time, 0) + greatest(0, p_delta))
    where id = p_user_id
    returning sessionehre into v_new;
  return coalesce(v_new, 0);
end $$;

-- Neue Helper-RPC für Gebietsruf-Bumps. Wird aus dem Server-Code verwendet
-- statt direkter UPDATE-Statements, damit all_time synchron bleibt.
create or replace function public.bump_gebietsruf(p_user_id uuid, p_delta int)
returns bigint language plpgsql security definer as $$
declare v_new bigint;
begin
  update public.users
    set gebietsruf = coalesce(gebietsruf, 0) + p_delta,
        gebietsruf_all_time = greatest(0, coalesce(gebietsruf_all_time, 0) + greatest(0, p_delta))
    where id = p_user_id
    returning gebietsruf into v_new;
  return coalesce(v_new, 0);
end $$;

grant execute on function public.bump_gebietsruf(uuid, int) to authenticated, service_role;

-- ═══════════════════════════════════════════════════════
-- 4) Saison-Archivierung + Reset
-- ═══════════════════════════════════════════════════════
create or replace function public.archive_and_reset_currency_season()
returns int language plpgsql security definer as $$
declare
  v_year int := extract(year from (now() at time zone 'Europe/Berlin' - interval '1 day'));
  v_month int := extract(month from (now() at time zone 'Europe/Berlin' - interval '1 day'));
  v_count int := 0;
begin
  -- Gebietsruf-Ranking archivieren (alle User mit > 0)
  with ranked as (
    select id, gebietsruf,
      row_number() over (order by gebietsruf desc, id) as rn
    from public.users
    where coalesce(gebietsruf, 0) > 0
  )
  insert into public.currency_season_archive (user_id, season_year, season_month, currency, final_amount, final_rank)
  select id, v_year, v_month, 'gebietsruf', gebietsruf, rn
  from ranked
  on conflict (user_id, season_year, season_month, currency) do nothing;

  -- Sessionehre-Ranking archivieren
  with ranked as (
    select id, sessionehre,
      row_number() over (order by sessionehre desc, id) as rn
    from public.users
    where coalesce(sessionehre, 0) > 0
  )
  insert into public.currency_season_archive (user_id, season_year, season_month, currency, final_amount, final_rank)
  select id, v_year, v_month, 'sessionehre', sessionehre, rn
  from ranked
  on conflict (user_id, season_year, season_month, currency) do nothing;

  -- Reset auf 0 für neue Saison
  update public.users set gebietsruf = 0, sessionehre = 0
  where coalesce(gebietsruf, 0) > 0 or coalesce(sessionehre, 0) > 0;

  get diagnostics v_count = row_count;
  return v_count;
end $$;

grant execute on function public.archive_and_reset_currency_season() to service_role;

comment on function public.archive_and_reset_currency_season is
  'Monatlicher Reset: archiviert Gebietsruf- und Sessionehre-Stände in currency_season_archive, nullt danach die aktiven Felder. All-Time-Summen bleiben unberührt.';

-- ═══════════════════════════════════════════════════════
-- 4b) RPCs aus 00046 überschreiben, damit _all_time synchron bleibt
-- ═══════════════════════════════════════════════════════
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

      if v_winner is not null then
        update public.users u
        set gebietsruf = coalesce(gebietsruf, 0) + r.prize_xp,
            gebietsruf_all_time = coalesce(gebietsruf_all_time, 0) + r.prize_xp
        where u.id in (select user_id from public.crew_members where crew_id = v_winner);
        perform public.add_crew_feed(v_winner, null, 'duel_won',
          jsonb_build_object('opponent', case when v_winner = r.crew_a_id then r.crew_b_id else r.crew_a_id end, 'kind','war','gebietsruf', r.prize_xp));
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

  insert into public.crew_flag_visits (event_id, user_id, crew_id)
  values (p_event_id, p_user_id, p_crew_id)
  on conflict (event_id, user_id) do nothing;

  if p_crew_id is not null then
    select count(*) into v_crew_visits
    from public.crew_flag_visits
    where event_id = p_event_id and crew_id = p_crew_id;

    if v_crew_visits >= v_event.target_visits then
      v_winner := p_crew_id;
      update public.crew_flag_events
      set status = 'finished', winner_crew_id = v_winner, finished_at = now()
      where id = p_event_id and status = 'active';
      update public.users u
      set gebietsruf = coalesce(gebietsruf, 0) + v_event.prize_xp,
          gebietsruf_all_time = coalesce(gebietsruf_all_time, 0) + v_event.prize_xp
      where u.id in (select user_id from public.crew_members where crew_id = v_winner);
      perform public.add_crew_feed(v_winner, null, 'challenge_completed',
        jsonb_build_object('name', v_event.name, 'gebietsruf', v_event.prize_xp, 'kind', 'flag'));
      return jsonb_build_object('ok', true, 'won', true, 'gebietsruf', v_event.prize_xp);
    end if;
  end if;

  return jsonb_build_object('ok', true, 'won', false, 'crew_visits', v_crew_visits);
end $$;

-- ═══════════════════════════════════════════════════════
-- 5) pg_cron: 1. des Monats um 00:05 Europe/Berlin
-- ═══════════════════════════════════════════════════════
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'archive-reset-currency-season',
      '5 0 1 * *',  -- 1. des Monats, 00:05 UTC (~02:05 Berlin Sommerzeit, 01:05 Winterzeit)
      $cron$ select public.archive_and_reset_currency_season(); $cron$
    );
  end if;
end $$;
