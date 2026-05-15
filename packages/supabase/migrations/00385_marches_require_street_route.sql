-- 00385_marches_require_street_route.sql
-- Kern-Konzept: Märsche dürfen NUR Straßen/Wege benutzen, niemals Luftlinie.
-- Diese Migration erzwingt das auf DB-Ebene:
--   1) start_gather_march weigert sich, einen Marsch ohne Route zu starten.
--      Der Luftlinie-×-1.4-Fallback aus 00195 wird entfernt; die volle
--      Wetter/Terrain/Wind-Berechnung aus 00368 bleibt erhalten.
--   2) gather_marches.route_geom bekommt eine CHECK-Constraint (NOT VALID),
--      damit Alt-Rows mit NULL nicht blockieren, neue Inserts aber gesichert sind.
-- Andere Marsch-Typen (rally, scout, spy, attack_legion) folgen in 00386.

create or replace function public.start_gather_march(
  p_node_id            bigint,
  p_guardian_id        uuid,
  p_troop_count        int,
  p_user_lat           double precision,
  p_user_lng           double precision,
  p_route_distance_m   double precision default null,
  p_route_geom_geojson text             default null
) returns jsonb language plpgsql security definer
set search_path = 'public','extensions','pg_temp'
as $function$
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

  -- ── KERN-REGEL: Marsch nur mit echter Straßen-Route ───────────────────────
  -- Kein Fallback auf Luftlinie. Wenn keine Route übergeben → Marsch verweigern.
  if p_route_geom_geojson is null then
    return jsonb_build_object(
      'error','route_required',
      'message','Marsch ohne Straßen-Route ist nicht erlaubt.'
    );
  end if;

  begin
    v_route_geom := extensions.st_setsrid(extensions.st_geomfromgeojson(p_route_geom_geojson), 4326);
  exception when others then
    return jsonb_build_object('error','route_invalid_geojson','message','GeoJSON konnte nicht geparst werden.');
  end;

  if v_route_geom is null
     or extensions.st_geometrytype(v_route_geom) <> 'ST_LineString'
     or extensions.st_npoints(v_route_geom) < 2 then
    return jsonb_build_object('error','route_invalid','message','Route muss ein LineString mit mindestens 2 Punkten sein.');
  end if;

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

  -- Distanz: bevorzugt vom Client (Mapbox-gemessen), sonst aus der Linie berechnen
  if p_route_distance_m is not null and p_route_distance_m > 0 then
    v_dist_m := p_route_distance_m;
  else
    v_dist_m := extensions.st_length(v_route_geom::extensions.geography);
  end if;

  v_walk_s := greatest(60, (v_dist_m / (1.39 * v_terrain_speed * v_weather_move * v_wind_mult))::int);
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
    'has_route', true
  );
end $function$;

grant execute on function public.start_gather_march(bigint, uuid, int, double precision, double precision, double precision, text) to authenticated;

-- Defense-in-depth: CHECK-Constraint sichert, dass keine neuen Rows ohne Route landen.
-- NOT VALID, damit Alt-Rows mit NULL nicht migriert werden müssen.
alter table public.gather_marches
  drop constraint if exists gather_marches_route_required;
alter table public.gather_marches
  add constraint gather_marches_route_required
  check (route_geom is not null) not valid;
