-- ════════════════════════════════════════════════════════════════════════
-- 00368_weather_tod_economy_wiring.sql
-- Verkable Wetter+Tageszeit-Modifier in bestehende Wirtschafts-RPCs:
--   start_building   → multipliziert Bauzeit mit combined_build_mult
--   start_research   → multipliziert Forschungszeit mit combined_research_mult
--   start_gather_march → multipliziert Walk-Zeit (movement) und Gather-Zeit
--                        sowie Yield-Reward via gather-Mult (Reward-Pfad
--                        läuft über tick_gather_marches Patch unten)
-- Kein Tabellen-Schema-Change. Reines RPC-Update.
-- ════════════════════════════════════════════════════════════════════════

-- ─── start_building: build_mult einrechnen ──────────────────────────────
drop function if exists public.start_building(text, int, int);

create or replace function public.start_building(p_building_id text, p_position_x int default 0, p_position_y int default 0)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_base_id uuid;
  v_cat record;
  v_existing record;
  v_action text;
  v_target_level int;
  v_cost_mult numeric;
  v_cost_w int; v_cost_s int; v_cost_g int; v_cost_m int;
  v_resources record;
  v_buildtime_min int;
  v_vip_speed numeric := 0;
  v_extra_slots_vip int := 0;
  v_burg_level int := 0;
  v_extra_slots_burg int := 0;
  v_total_slots int;
  v_active_count int;
  v_unmet jsonb;
  v_playstyle_speed numeric := 1.0;
  v_city text;
  v_weather_build numeric := 1.0;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select id into v_base_id from public.bases where owner_user_id = v_user;
  if v_base_id is null then v_base_id := public.get_or_create_base(); end if;

  select * into v_cat from public.buildings_catalog where id = p_building_id;
  if v_cat is null then return jsonb_build_object('ok', false, 'error', 'building_not_found'); end if;

  select coalesce(level, 0) into v_burg_level
    from public.base_buildings where base_id = v_base_id and building_id = 'burg';

  select * into v_existing from public.base_buildings
    where base_id = v_base_id and building_id = p_building_id;

  if v_existing is null then
    v_action := 'build';
    v_target_level := 1;
    v_cost_mult := 1.0;
  else
    if v_existing.level >= v_cat.max_level then
      return jsonb_build_object('ok', false, 'error', 'max_level_reached');
    end if;
    if v_existing.status <> 'idle' then
      return jsonb_build_object('ok', false, 'error', 'already_in_progress');
    end if;
    v_action := 'upgrade';
    v_target_level := v_existing.level + 1;
    v_cost_mult := power(1.6, v_existing.level);
  end if;

  if p_building_id <> 'burg' and v_target_level > greatest(v_burg_level, 1) then
    return jsonb_build_object('ok', false, 'error', 'burg_level_too_low',
      'burg_level', v_burg_level, 'needed', v_target_level);
  end if;

  if p_building_id = 'burg' and v_target_level >= 2 then
    select coalesce(jsonb_agg(jsonb_build_object(
      'building_id', r.building_id,
      'name',        c.name,
      'required_level', r.required_level,
      'have_level',  coalesce(bb.level, 0)
    )), '[]'::jsonb)
      into v_unmet
      from public.burg_level_requirements r
      join public.buildings_catalog c on c.id = r.building_id
      left join public.base_buildings bb on bb.base_id = v_base_id and bb.building_id = r.building_id
     where r.burg_level = v_target_level
       and coalesce(bb.level, 0) < r.required_level;
    if jsonb_array_length(v_unmet) > 0 then
      return jsonb_build_object('ok', false, 'error', 'burg_requirements_unmet',
        'target_level', v_target_level, 'unmet', v_unmet);
    end if;
  end if;

  v_cost_w := round(v_cat.base_cost_wood  * v_cost_mult);
  v_cost_s := round(v_cat.base_cost_stone * v_cost_mult);
  v_cost_g := round(v_cat.base_cost_gold  * v_cost_mult);
  v_cost_m := round(v_cat.base_cost_mana  * v_cost_mult);

  select coalesce(t.extra_build_slots, 0) into v_extra_slots_vip
    from public.vip_progress p left join public.vip_tier_thresholds t on t.vip_level = p.vip_level
   where p.user_id = v_user;
  v_extra_slots_burg := case
    when v_burg_level >= 22 then 4
    when v_burg_level >= 17 then 3
    when v_burg_level >= 11 then 2
    when v_burg_level >=  4 then 1
    else 0 end;
  v_total_slots := 1 + greatest(v_extra_slots_vip, v_extra_slots_burg);

  select count(*) into v_active_count
    from public.building_queue
   where base_id = v_base_id and not finished;
  if v_active_count >= v_total_slots then
    return jsonb_build_object('ok', false, 'error', 'queue_full',
      'slots', v_total_slots, 'active', v_active_count);
  end if;

  select * into v_resources from public.user_resources where user_id = v_user for update;
  if v_resources.wood < v_cost_w or v_resources.stone < v_cost_s
     or v_resources.gold < v_cost_g or v_resources.mana < v_cost_m then
    return jsonb_build_object('ok', false, 'error', 'not_enough_resources',
      'need', jsonb_build_object('wood', v_cost_w, 'stone', v_cost_s, 'gold', v_cost_g, 'mana', v_cost_m));
  end if;

  update public.user_resources set
    wood = wood - v_cost_w, stone = stone - v_cost_s,
    gold = gold - v_cost_g, mana = mana - v_cost_m, updated_at = now()
  where user_id = v_user;

  select coalesce(t.buildtime_bonus_pct, 0) into v_vip_speed
    from public.vip_progress p left join public.vip_tier_thresholds t on t.vip_level = p.vip_level
   where p.user_id = v_user;
  v_playstyle_speed := public.playstyle_buff(v_user, 'build_speed');
  select home_city_slug into v_city from public.users where id = v_user;
  v_weather_build := public.combined_build_mult(v_city);

  v_buildtime_min := least(525600,
    greatest(1, round(v_cat.base_buildtime_minutes
                       * power(coalesce(v_cat.buildtime_growth, 1.40), v_target_level - 1)
                       * (1 - coalesce(v_vip_speed, 0))
                       * coalesce(v_playstyle_speed, 1.0)
                       * coalesce(v_weather_build, 1.0))));

  if v_existing is null then
    insert into public.base_buildings (base_id, building_id, position_x, position_y, level, status)
    values (v_base_id, p_building_id, p_position_x, p_position_y, 0, 'building');
  else
    update public.base_buildings set status = 'upgrading' where id = v_existing.id;
  end if;

  insert into public.building_queue
    (base_id, building_id, action, target_level, ends_at, cost_wood, cost_stone, cost_gold, cost_mana)
  values
    (v_base_id, p_building_id, v_action, v_target_level,
     now() + (v_buildtime_min || ' minutes')::interval,
     v_cost_w, v_cost_s, v_cost_g, v_cost_m);

  return jsonb_build_object('ok', true,
    'action', v_action, 'target_level', v_target_level,
    'buildtime_minutes', v_buildtime_min,
    'weather_build_mult', v_weather_build,
    'cost', jsonb_build_object('wood', v_cost_w, 'stone', v_cost_s, 'gold', v_cost_g, 'mana', v_cost_m));
end $$;

revoke all on function public.start_building(text, int, int) from public;
grant execute on function public.start_building(text, int, int) to authenticated;


-- ─── start_research: research_mult einrechnen ────────────────────────────
create or replace function public.start_research(p_research_id text)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_def record;
  v_existing record;
  v_target_level int;
  v_cost_mult numeric;
  v_cost_w int; v_cost_s int; v_cost_g int; v_cost_m int;
  v_time_min int;
  v_resources record;
  v_extra_slots int := 0;
  v_active int;
  v_burg_level int;
  v_prereq record;
  v_speed numeric := 0;
  v_base_id uuid;
  v_city text;
  v_weather_research numeric := 1.0;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select * into v_def from public.research_definitions where id = p_research_id;
  if v_def is null then return jsonb_build_object('ok', false, 'error', 'research_not_found'); end if;

  if v_def.prereq_id is not null then
    select * into v_prereq from public.user_research where user_id = v_user and research_id = v_def.prereq_id;
    if v_prereq is null or v_prereq.level < 1 then
      return jsonb_build_object('ok', false, 'error', 'prereq_missing', 'prereq_id', v_def.prereq_id);
    end if;
  end if;

  select id into v_base_id from public.bases where owner_user_id = v_user;
  select coalesce(level, 0) into v_burg_level
    from public.base_buildings where base_id = v_base_id and building_id = 'burg';
  if v_burg_level < v_def.required_burg_level then
    return jsonb_build_object('ok', false, 'error', 'burg_level_too_low',
      'burg_level', v_burg_level, 'required', v_def.required_burg_level);
  end if;

  insert into public.user_research (user_id, research_id, level)
  values (v_user, p_research_id, 0)
  on conflict (user_id, research_id) do nothing;
  select * into v_existing from public.user_research where user_id = v_user and research_id = p_research_id;

  if v_existing.level >= v_def.max_level then
    return jsonb_build_object('ok', false, 'error', 'max_level_reached');
  end if;
  v_target_level := v_existing.level + 1;
  v_cost_mult := power(1.55, v_existing.level);

  v_cost_w := round(v_def.base_cost_wood  * v_cost_mult);
  v_cost_s := round(v_def.base_cost_stone * v_cost_mult);
  v_cost_g := round(v_def.base_cost_gold  * v_cost_mult);
  v_cost_m := round(v_def.base_cost_mana  * v_cost_mult);

  select coalesce(t.extra_research_slots, 0) into v_extra_slots
    from public.vip_progress p left join public.vip_tier_thresholds t on t.vip_level = p.vip_level
   where p.user_id = v_user;
  select count(*) into v_active from public.research_queue
   where user_id = v_user and not finished;
  if v_active >= (1 + coalesce(v_extra_slots, 0)) then
    return jsonb_build_object('ok', false, 'error', 'queue_full',
      'slots', 1 + v_extra_slots, 'active', v_active);
  end if;

  select * into v_resources from public.user_resources where user_id = v_user for update;
  if v_resources.wood < v_cost_w or v_resources.stone < v_cost_s
     or v_resources.gold < v_cost_g or v_resources.mana < v_cost_m then
    return jsonb_build_object('ok', false, 'error', 'not_enough_resources',
      'need', jsonb_build_object('wood', v_cost_w, 'stone', v_cost_s, 'gold', v_cost_g, 'mana', v_cost_m));
  end if;
  update public.user_resources set
    wood = wood - v_cost_w, stone = stone - v_cost_s,
    gold = gold - v_cost_g, mana = mana - v_cost_m, updated_at = now()
  where user_id = v_user;

  select coalesce(t.research_speed_pct, 0) into v_speed
    from public.vip_progress p left join public.vip_tier_thresholds t on t.vip_level = p.vip_level
   where p.user_id = v_user;
  select home_city_slug into v_city from public.users where id = v_user;
  v_weather_research := public.combined_research_mult(v_city);

  v_time_min := least(2880,
    greatest(1, round(v_def.base_time_minutes
                       * power(coalesce(v_def.buildtime_growth, 1.45), v_target_level - 1)
                       * (1 - coalesce(v_speed, 0))
                       * coalesce(v_weather_research, 1.0))));

  insert into public.research_queue (user_id, research_id, target_level, ends_at)
  values (v_user, p_research_id, v_target_level, now() + (v_time_min || ' minutes')::interval);

  return jsonb_build_object('ok', true, 'target_level', v_target_level,
    'minutes', v_time_min,
    'weather_research_mult', v_weather_research,
    'cost', jsonb_build_object('wood', v_cost_w, 'stone', v_cost_s, 'gold', v_cost_g, 'mana', v_cost_m));
end $$;
revoke all on function public.start_research(text) from public;
grant execute on function public.start_research(text) to authenticated;


-- ─── start_gather_march: movement + wind + gather einrechnen ─────────────
create or replace function public.start_gather_march(
  p_node_id            bigint,
  p_guardian_id        uuid,
  p_troop_count        int,
  p_user_lat           double precision,
  p_user_lng           double precision,
  p_route_distance_m   double precision default null,
  p_route_geom_geojson text             default null
) returns jsonb language plpgsql security definer
set search_path = public, extensions, pg_temp
as $func$
declare
  v_user_id uuid := auth.uid();
  v_node    public.resource_nodes%rowtype;
  v_dist_m  double precision;
  v_walk_s int;
  v_gather_s int;
  v_arrives timestamptz;
  v_finishes timestamptz;
  v_returns timestamptz;
  v_march_id bigint;
  v_speed_mult numeric := 1.0;
  v_route_geom extensions.geometry(LineString, 4326);
  v_terrain record;
  v_terrain_speed numeric := 1.0;
  v_weather_move numeric := 1.0;
  v_wind_mult numeric := 1.0;
  v_weather_gather numeric := 1.0;
  v_tod_gather numeric := 1.0;
begin
  if v_user_id is null then return jsonb_build_object('error','not_authenticated'); end if;

  select * into v_node from public.resource_nodes where id = p_node_id;
  if not found then return jsonb_build_object('error','node_not_found'); end if;
  if v_node.depleted_at is not null then return jsonb_build_object('error','node_depleted'); end if;

  select coalesce(speed_mult, 1.0) into v_speed_mult
    from public.thief_bonus_for(p_guardian_id, v_node.kind);

  select * into v_terrain from public.get_terrain_at(v_node.city, v_node.lat, v_node.lng);
  v_terrain_speed := public.sample_route_speed_mult(
    v_node.city, p_user_lat, p_user_lng, v_node.lat, v_node.lng
  );

  v_weather_move   := public._weather_movement_mult(v_node.city);
  v_wind_mult      := public._wind_direction_mult(v_node.city, p_user_lat, p_user_lng, v_node.lat, v_node.lng);
  v_weather_gather := public._weather_gather_mult(v_node.city);
  v_tod_gather     := public._tod_gather_mult();

  if p_route_distance_m is not null and p_route_distance_m > 0 then
    v_dist_m := p_route_distance_m;
  else
    v_dist_m := extensions.st_distance(
      extensions.st_setsrid(extensions.st_makepoint(p_user_lng, p_user_lat), 4326)::extensions.geography,
      v_node.geom::extensions.geography
    ) * 1.4;
  end if;

  if p_route_geom_geojson is not null then
    begin
      v_route_geom := extensions.st_setsrid(extensions.st_geomfromgeojson(p_route_geom_geojson), 4326);
      if extensions.st_geometrytype(v_route_geom) <> 'ST_LineString' then
        v_route_geom := null;
      end if;
    exception when others then
      v_route_geom := null;
    end;
  end if;

  -- Walk-Speed: 1.39 m/s × terrain × wetter × wind.
  -- Werte >1 ⇒ schneller, <1 ⇒ langsamer ⇒ Sekunden = Distanz / (Basis × mult).
  v_walk_s := greatest(60, (v_dist_m / (1.39 * v_terrain_speed * v_weather_move * v_wind_mult))::int);
  -- Gather-Zeit kürzer wenn Yield-Bonus aktiv (Sammler arbeiten effizienter).
  v_gather_s := greatest(60, ((v_node.current_yield / 1000 * 300 / greatest(1, p_troop_count / 100))::numeric
                              / (v_speed_mult * v_weather_gather * v_tod_gather))::int);

  v_arrives  := now() + (v_walk_s    || ' seconds')::interval;
  v_finishes := v_arrives + (v_gather_s || ' seconds')::interval;
  v_returns  := v_finishes + (v_walk_s || ' seconds')::interval;

  insert into public.gather_marches (
    user_id, node_id, guardian_id, troop_count,
    started_at, arrives_at, finishes_at, returns_at, status,
    origin_lat, origin_lng, route_geom, route_distance_m,
    terrain_tag, terrain_gather_mult, terrain_speed_mult
  )
  values (
    v_user_id, p_node_id, p_guardian_id, p_troop_count,
    now(), v_arrives, v_finishes, v_returns, 'marching',
    p_user_lat, p_user_lng, v_route_geom, v_dist_m,
    coalesce(v_terrain.primary_tag, 'default'),
    coalesce(v_terrain.gather_mult, 1.0),
    v_terrain_speed
  )
  returning id into v_march_id;

  return jsonb_build_object(
    'ok', true, 'march_id', v_march_id,
    'arrives_at', v_arrives, 'finishes_at', v_finishes, 'returns_at', v_returns,
    'walk_seconds', v_walk_s, 'gather_seconds', v_gather_s,
    'distance_m', round(v_dist_m),
    'thief_speed_mult', v_speed_mult,
    'terrain_tag', coalesce(v_terrain.primary_tag, 'default'),
    'terrain_gather_mult', coalesce(v_terrain.gather_mult, 1.0),
    'terrain_speed_mult', v_terrain_speed,
    'weather_move_mult', v_weather_move,
    'wind_mult', v_wind_mult,
    'weather_gather_mult', v_weather_gather,
    'tod_gather_mult', v_tod_gather,
    'has_route', v_route_geom is not null
  );
end $func$;

grant execute on function public.start_gather_march(bigint, uuid, int, double precision, double precision, double precision, text) to authenticated;
