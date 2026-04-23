-- 00046: Währungs-Split — drei getrennte Currencies ersetzen users.xp.
--
-- Wegemünzen  → Runner-Progression (Walking, Territory-Claims, Missionen)
-- Gebietsruf  → Crew-Progression  (Crew-Wars, Flag-Events, Crew-Kämpfe)
-- Sessionehre → Arena-Progression (Arena-Wins/Losses — pro Saison volatil)
--
-- Ziel: XP-Inflation entkoppeln. Arena-Niederlagen killen nicht mehr die Runner-
-- Progression, Crew-Rewards bleiben im Crew-Kontext sichtbar, Walking bleibt die
-- saubere „Ich-bin-gelaufen"-Währung.
--
-- Rückwärtskompatibilität: users.xp und users.level bleiben erhalten (deprecated)
-- damit ältere Views/Leaderboards nicht brechen. users.xp wird ab jetzt NICHT mehr
-- erhöht — alle RPCs schreiben in die neuen Columns.

-- ═══════════════════════════════════════════════════════
-- 1) Neue Columns
-- ═══════════════════════════════════════════════════════
alter table public.users
  add column if not exists wegemuenzen bigint not null default 0,
  add column if not exists gebietsruf  bigint not null default 0,
  add column if not exists sessionehre bigint not null default 0;

create index if not exists idx_users_wegemuenzen on public.users(wegemuenzen desc);
create index if not exists idx_users_gebietsruf  on public.users(gebietsruf desc);
create index if not exists idx_users_sessionehre on public.users(sessionehre desc);

comment on column public.users.wegemuenzen is 'Runner-Währung: Walking, Reclaim, Territory-Claim, Missionen. Ersetzt users.xp.';
comment on column public.users.gebietsruf  is 'Crew-Währung: Crew-War-Sieg, Flag-Capture, Crew-Kampf-Belohnungen.';
comment on column public.users.sessionehre is 'Arena-Währung: +N bei Arena-Sieg, −N bei Arena-Niederlage. Kann negativ wirken (min 0).';

-- ═══════════════════════════════════════════════════════
-- 2) Backfill: vorhandenes users.xp → wegemuenzen
--    Walking war historisch der dominante XP-Weg. 100 % auf Wegemünzen ist
--    fair — niemand verliert Progression. Gebietsruf/Sessionehre starten bei 0.
-- ═══════════════════════════════════════════════════════
update public.users
  set wegemuenzen = coalesce(xp, 0)
  where wegemuenzen = 0 and coalesce(xp, 0) > 0;

-- ═══════════════════════════════════════════════════════
-- 3) View v_public_profiles aktualisieren — beide Felder exponieren
-- ═══════════════════════════════════════════════════════
create or replace view public.v_public_profiles as
  select id, username, display_name, faction,
         total_distance_m, total_walks,
         xp as total_xp, -- deprecated, bleibt für Alt-Clients
         wegemuenzen, gebietsruf, sessionehre,
         level,
         created_at
    from public.users
   where coalesce(privacy_leaderboard, true) = true
     and coalesce(privacy_searchable, true) = true;

-- ═══════════════════════════════════════════════════════
-- 4) RPC-Rewrites: alle users.xp-Writes → neue Columns
-- ═══════════════════════════════════════════════════════

-- 4a) process_segment_reclaims (00039): Walking-Reclaim → Wegemünzen
create or replace function public.process_segment_reclaims(
  p_user_id uuid,
  p_osm_way_ids bigint[]
)
returns table(
  reclaim_count int,
  reclaim_xp int,
  segments_cooldown int
)
language plpgsql
security definer
as $$
declare
  v_count int := 0;
  v_xp int := 0;
  v_cooldown int := 0;
  r record;
begin
  if p_osm_way_ids is null or array_length(p_osm_way_ids, 1) is null then
    return query select 0, 0, 0;
    return;
  end if;

  for r in
    select id, last_walked_at,
           public.reclaim_xp_multiplier(last_walked_at) as mult
    from public.street_segments
    where user_id = p_user_id
      and osm_way_id = any(p_osm_way_ids)
      and segment_index = 0
  loop
    if r.mult = 0.0 then
      v_cooldown := v_cooldown + 1;
    else
      v_count := v_count + 1;
      v_xp := v_xp + floor(50 * r.mult)::int;
    end if;

    update public.street_segments
    set last_walked_at = now()
    where id = r.id;
  end loop;

  if v_xp > 0 then
    update public.users set wegemuenzen = coalesce(wegemuenzen, 0) + v_xp where id = p_user_id;
  end if;

  return query select v_count, v_xp, v_cooldown;
end $$;

-- 4b) promote_pending_territories (00038): Territory-Promote → Wegemünzen
create or replace function public.promote_pending_territories(p_user_id uuid)
returns table(promoted_count int, awarded_xp int)
language plpgsql
security definer
as $$
declare
  v_crew_id uuid;
  v_count int := 0;
  v_xp int := 0;
begin
  select current_crew_id into v_crew_id from public.users where id = p_user_id;
  if v_crew_id is null then
    return query select 0, 0;
    return;
  end if;

  with upd as (
    update public.territory_polygons
    set status = 'active',
        owner_crew_id = v_crew_id,
        xp_awarded = 500
    where claimed_by_user_id = p_user_id
      and status = 'pending_crew'
    returning id
  )
  select count(*)::int into v_count from upd;

  v_xp := v_count * 500;

  if v_count > 0 and v_xp > 0 then
    update public.users
    set wegemuenzen = coalesce(wegemuenzen, 0) + v_xp
    where id = p_user_id;
  end if;

  return query select v_count, v_xp;
end $$;

-- 4c) finalize_expired_crew_wars (00044): Crew-War-Sieg → Gebietsruf
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
        set gebietsruf = coalesce(gebietsruf, 0) + r.prize_xp
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

-- 4d) register_flag_visit (00044): Flag-Capture-Sieg → Gebietsruf
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
      set gebietsruf = coalesce(gebietsruf, 0) + v_event.prize_xp
      where u.id in (select user_id from public.crew_members where crew_id = v_winner);
      perform public.add_crew_feed(v_winner, null, 'challenge_completed',
        jsonb_build_object('name', v_event.name, 'gebietsruf', v_event.prize_xp, 'kind', 'flag'));
      return jsonb_build_object('ok', true, 'won', true, 'gebietsruf', v_event.prize_xp);
    end if;
  end if;

  return jsonb_build_object('ok', true, 'won', false, 'crew_visits', v_crew_visits);
end $$;

-- ═══════════════════════════════════════════════════════
-- 5) Sessionehre-Mutator (wird von Arena-API genutzt)
--    +N bei Sieg, −N bei Niederlage. Floor bei 0 (keine negative Ehre).
-- ═══════════════════════════════════════════════════════
create or replace function public.bump_sessionehre(p_user_id uuid, p_delta int)
returns bigint language plpgsql security definer as $$
declare v_new bigint;
begin
  update public.users
    set sessionehre = greatest(0, coalesce(sessionehre, 0) + p_delta)
    where id = p_user_id
    returning sessionehre into v_new;
  return coalesce(v_new, 0);
end $$;

grant execute on function public.bump_sessionehre(uuid, int) to authenticated, service_role;

comment on function public.bump_sessionehre is
  'Arena-Währung: erhöht (Sieg) oder reduziert (Niederlage) Sessionehre. Floor bei 0.';
