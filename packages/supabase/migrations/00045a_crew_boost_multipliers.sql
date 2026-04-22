-- 00045a: Crew-Score-RPCs so anpassen, dass sie aktive Boosts automatisch einbeziehen.
-- Der Walk-API-Code bleibt unverändert — nur die RPCs rechnen intern mit Multiplier.

-- Duel-km: score_boost wirkt (1.5×)
create or replace function public.bump_crew_duel_km(p_crew_id uuid, p_km numeric)
returns void language plpgsql security definer as $$
declare
  v_week_start date := (date_trunc('week', (now() at time zone 'Europe/Berlin')::date))::date;
  v_mult numeric := public.crew_score_multiplier(p_crew_id);
  v_km numeric := p_km * v_mult;
begin
  update public.crew_duels
  set crew_a_km = crew_a_km + v_km
  where week_start = v_week_start and crew_a_id = p_crew_id and status = 'active';
  update public.crew_duels
  set crew_b_km = crew_b_km + v_km
  where week_start = v_week_start and crew_b_id = p_crew_id and status = 'active';
end $$;

-- War-Score: score_boost × war_momentum kombinieren
create or replace function public.bump_crew_war_score(p_crew_id uuid, p_km numeric default 0, p_territories int default 0)
returns void language plpgsql security definer as $$
declare
  v_mult numeric := public.crew_score_multiplier(p_crew_id) * public.crew_war_multiplier(p_crew_id);
  v_km numeric := p_km * v_mult;
  v_terr numeric := p_territories * v_mult;
  v_score numeric := (v_km + v_terr * 10);
begin
  update public.crew_wars
  set crew_a_km = crew_a_km + v_km,
      crew_a_territories = crew_a_territories + v_terr,
      crew_a_score = crew_a_score + v_score
  where crew_a_id = p_crew_id and status = 'active';
  update public.crew_wars
  set crew_b_km = crew_b_km + v_km,
      crew_b_territories = crew_b_territories + v_terr,
      crew_b_score = crew_b_score + v_score
  where crew_b_id = p_crew_id and status = 'active';
end $$;

-- Season-Points: score_boost wirkt
create or replace function public.bump_crew_season_points(
  p_crew_id uuid, p_points numeric, p_reason text default 'generic'
) returns void language plpgsql security definer as $$
declare
  v_season uuid := public.current_crew_season();
  v_mult numeric := public.crew_score_multiplier(p_crew_id);
  v_pts numeric := p_points * v_mult;
begin
  insert into public.crew_season_standings (season_id, crew_id, points)
  values (v_season, p_crew_id, v_pts)
  on conflict (season_id, crew_id) do update
    set points = crew_season_standings.points + v_pts,
        duel_wins = crew_season_standings.duel_wins + (case when p_reason = 'duel_win' then 1 else 0 end),
        war_wins = crew_season_standings.war_wins + (case when p_reason = 'war_win' then 1 else 0 end),
        territories_claimed = crew_season_standings.territories_claimed + (case when p_reason = 'territory' then 1 else 0 end),
        updated_at = now();
end $$;

-- Challenges: score_boost wirkt auf progress
create or replace function public.bump_crew_challenge_progress(p_crew_id uuid, p_metric text, p_amount numeric)
returns int language plpgsql security definer as $$
declare
  v_updated int := 0;
  v_mult numeric := public.crew_score_multiplier(p_crew_id);
  v_amount numeric := p_amount * v_mult;
begin
  with upd as (
    update public.crew_challenges
    set progress = least(progress + v_amount, target_value),
        completed_at = case
          when progress + v_amount >= target_value and completed_at is null then now()
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

-- Territory-Shield: promote-pending greift auf Schutz zu — verhindert Steal im Walk-API
-- Wird im Walk-API-Code beim Overlap-Check abgefragt (is_crew_boost_active).
-- RPC-Helper für den Check aus TS:
create or replace function public.crew_has_territory_shield(p_crew_id uuid)
returns boolean language sql stable as $$
  select public.is_crew_boost_active(p_crew_id, 'territory_shield');
$$;
grant execute on function public.crew_has_territory_shield(uuid) to authenticated, service_role;
