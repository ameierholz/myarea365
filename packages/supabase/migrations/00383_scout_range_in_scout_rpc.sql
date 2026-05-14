-- 00383_scout_range_in_scout_rpc.sql
-- _weather_scout_range_mult ist jetzt wirklich verkabelt: Späh-Phase
-- (scout_done_at - arrives_at) skaliert invers zum Range-Mult. Bei niedrigem
-- Range (Sturm/Nebel/Nacht) braucht der Späher länger.
create or replace function public.start_player_base_scout(
  p_defender_user_id uuid,
  p_route_distance_m double precision default null,
  p_route_geom_geojson jsonb default null
) returns jsonb language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_attacker uuid := auth.uid();
  v_cost int := 500;
  v_gold int;
  v_my_base record;
  v_def_base record;
  v_dist_m double precision;
  v_travel_s int;
  v_scout_phase_s int;
  v_now timestamptz := now();
  v_arrives timestamptz;
  v_scout_done timestamptz;
  v_returns timestamptz;
  v_id uuid;
  v_route extensions.geometry := null;
  v_def_city text;
  v_incoming numeric := 1.0;
  v_scout_range numeric := 1.0;
begin
  if v_attacker is null then return jsonb_build_object('ok', false, 'error', 'auth_required'); end if;
  if p_defender_user_id is null or p_defender_user_id = v_attacker then
    return jsonb_build_object('ok', false, 'error', 'invalid_target');
  end if;

  if exists (
    select 1 from public.player_base_scouts
     where attacker_user_id = v_attacker and defender_user_id = p_defender_user_id
       and status in ('marching','scouting','returning')
  ) then
    return jsonb_build_object('ok', false, 'error', 'already_scouting');
  end if;

  select coalesce(gold, 0) into v_gold from public.user_resources where user_id = v_attacker;
  if v_gold < v_cost then
    return jsonb_build_object('ok', false, 'error', 'not_enough_gold', 'need', v_cost, 'have', v_gold);
  end if;
  update public.user_resources set gold = gold - v_cost where user_id = v_attacker;

  select b.lat, b.lng into v_my_base from public.bases b where b.owner_user_id = v_attacker order by b.created_at asc limit 1;
  select b.lat, b.lng into v_def_base from public.bases b where b.owner_user_id = p_defender_user_id order by b.created_at asc limit 1;
  if v_my_base.lat is null or v_def_base.lat is null then
    update public.user_resources set gold = gold + v_cost where user_id = v_attacker;
    return jsonb_build_object('ok', false, 'error', 'base_missing');
  end if;

  if p_route_geom_geojson is not null then
    begin
      v_route := extensions.st_force2d(extensions.st_geomfromgeojson(p_route_geom_geojson::text));
    exception when others then
      v_route := null;
    end;
  end if;

  v_dist_m := coalesce(p_route_distance_m,
                public._haversine_m(v_my_base.lat, v_my_base.lng, v_def_base.lat, v_def_base.lng));

  select home_city_slug into v_def_city from public.users where id = p_defender_user_id;
  v_incoming := public._weather_incoming_march_mult(v_def_city);
  v_scout_range := public._weather_scout_range_mult(v_def_city);

  v_travel_s := greatest(8, least(180, ceil((v_dist_m / 16.7) / coalesce(v_incoming, 1.0))::int));
  v_scout_phase_s := greatest(3, least(30, ceil(5.0 / coalesce(v_scout_range, 1.0))::int));

  v_arrives    := v_now + (v_travel_s || ' seconds')::interval;
  v_scout_done := v_arrives + (v_scout_phase_s || ' seconds')::interval;
  v_returns    := v_scout_done + (v_travel_s || ' seconds')::interval;

  insert into public.player_base_scouts (
    attacker_user_id, defender_user_id, status,
    started_at, arrives_at, scout_done_at, returns_at,
    from_lat, from_lng, target_lat, target_lng,
    distance_m, route_distance_m, route_geom
  ) values (
    v_attacker, p_defender_user_id, 'marching',
    v_now, v_arrives, v_scout_done, v_returns,
    v_my_base.lat, v_my_base.lng, v_def_base.lat, v_def_base.lng,
    v_dist_m, p_route_distance_m, v_route
  ) returning id into v_id;

  insert into public.user_inbox (user_id, title, body) values (
    p_defender_user_id,
    '👁 Späher entdeckt',
    'Ein feindlicher Späher nähert sich deiner Base. Stärke deine Verteidigung!'
  );

  return jsonb_build_object(
    'ok', true, 'scout_id', v_id, 'distance_m', v_dist_m,
    'travel_seconds', v_travel_s, 'returns_at', v_returns,
    'incoming_march_mult', v_incoming,
    'scout_range_mult', v_scout_range,
    'scout_phase_seconds', v_scout_phase_s
  );
end $$;
