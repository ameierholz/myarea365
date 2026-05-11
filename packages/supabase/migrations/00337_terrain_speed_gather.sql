-- 00337_terrain_speed_gather.sql
-- Sprint 3 Phase 2: Terrain.speed_mult beeinflusst Gather-Marsch-Dauer.
-- Vorher: Walk-Zeit nur Distanz / 1.39 m/s (Fußgänger-Speed). Polygone
-- waren ohne Effekt auf Hin-/Rückweg. Jetzt: 5 Punkte zwischen origin und
-- Node-Standort werden gesamplet, geometrischer Durchschnitt der speed_mults
-- wird angewendet — Highway/Bahnschiene beschleunigt, Wasser bremst.
--
-- Sample-Punkte 0%, 25%, 50%, 75%, 100% der Strecke. Reicht für eine
-- "Charakter-Score" entlang einer Linie ohne teure Polygon-Intersection.

ALTER TABLE public.gather_marches
  ADD COLUMN IF NOT EXISTS terrain_speed_mult numeric NOT NULL DEFAULT 1.0;

CREATE OR REPLACE FUNCTION public.sample_route_speed_mult(
  p_city_slug text,
  p_lat1 double precision, p_lng1 double precision,
  p_lat2 double precision, p_lng2 double precision
) RETURNS numeric LANGUAGE plpgsql STABLE
SET search_path = public, extensions, pg_temp
AS $$
declare
  v_total numeric := 0;
  v_count int := 0;
  v_t numeric;
  v_lat double precision;
  v_lng double precision;
  v_mult numeric;
  v_samples int[] := ARRAY[0, 25, 50, 75, 100];
  v_pct int;
begin
  foreach v_pct in array v_samples loop
    v_t := v_pct / 100.0;
    v_lat := p_lat1 + (p_lat2 - p_lat1) * v_t;
    v_lng := p_lng1 + (p_lng2 - p_lng1) * v_t;
    select coalesce(speed_mult, 1.0) into v_mult
      from public.get_terrain_at(p_city_slug, v_lat, v_lng);
    v_total := v_total + coalesce(v_mult, 1.0);
    v_count := v_count + 1;
  end loop;
  if v_count = 0 then return 1.0; end if;
  return v_total / v_count;
end $$;

GRANT EXECUTE ON FUNCTION public.sample_route_speed_mult(text, double precision, double precision, double precision, double precision) TO authenticated;

CREATE OR REPLACE FUNCTION public.start_gather_march(
  p_node_id            bigint,
  p_guardian_id        uuid,
  p_troop_count        int,
  p_user_lat           double precision,
  p_user_lng           double precision,
  p_route_distance_m   double precision default null,
  p_route_geom_geojson text             default null
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $func$
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
begin
  if v_user_id is null then return jsonb_build_object('error','not_authenticated'); end if;

  select * into v_node from public.resource_nodes where id = p_node_id;
  if not found then return jsonb_build_object('error','node_not_found'); end if;
  if v_node.depleted_at is not null then return jsonb_build_object('error','node_depleted'); end if;

  select coalesce(speed_mult, 1.0) into v_speed_mult
    from public.thief_bonus_for(p_guardian_id, v_node.kind);

  -- Terrain am Node-Standort für Gather-Boost (wirkt während Sammelns)
  select * into v_terrain from public.get_terrain_at(v_node.city, v_node.lat, v_node.lng);

  -- Terrain entlang der Route für Marsch-Speed (Mittel über 5 Punkte)
  v_terrain_speed := public.sample_route_speed_mult(
    v_node.city, p_user_lat, p_user_lng, v_node.lat, v_node.lng
  );

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

  -- Walk-Speed: 1.39 m/s × terrain_mult. Bei Highway (1.5) ~67% schneller,
  -- bei Wasser (0.6) 67% länger. Min 60 s damit kein Instant-Marsch.
  v_walk_s := greatest(60, (v_dist_m / (1.39 * v_terrain_speed))::int);
  v_gather_s := greatest(60, ((v_node.current_yield / 1000 * 300 / greatest(1, p_troop_count / 100))::numeric / v_speed_mult)::int);

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
    'has_route', v_route_geom is not null
  );
end $func$;

GRANT EXECUTE ON FUNCTION public.start_gather_march(bigint, uuid, int, double precision, double precision, double precision, text) TO authenticated;
