-- 00328_terrain_gather_boost.sql
-- Terrain-Polygone (Mig 00327) wirken jetzt auf Sammel-Erträge:
-- Industrial-Zonen +25% Tech-Schrott, Warehouse +40%, etc. Bonus wird
-- einmal beim March-Start gestempelt (basierend auf Node-Standort) und
-- gilt für die ganze Sammel-Dauer.

ALTER TABLE public.gather_marches
  ADD COLUMN IF NOT EXISTS terrain_tag text,
  ADD COLUMN IF NOT EXISTS terrain_gather_mult numeric NOT NULL DEFAULT 1.0;

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
  v_walk_s  int;
  v_gather_s int;
  v_arrives timestamptz;
  v_finishes timestamptz;
  v_returns timestamptz;
  v_march_id bigint;
  v_speed_mult numeric := 1.0;
  v_route_geom extensions.geometry(LineString, 4326);
  v_terrain record;
begin
  if v_user_id is null then return jsonb_build_object('error','not_authenticated'); end if;

  select * into v_node from public.resource_nodes where id = p_node_id;
  if not found then return jsonb_build_object('error','node_not_found'); end if;
  if v_node.depleted_at is not null then return jsonb_build_object('error','node_depleted'); end if;

  select coalesce(speed_mult, 1.0) into v_speed_mult
    from public.thief_bonus_for(p_guardian_id, v_node.kind);

  select * into v_terrain from public.get_terrain_at(v_node.city, v_node.lat, v_node.lng);

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

  v_walk_s := greatest(60, (v_dist_m / 1.39)::int);
  v_gather_s := greatest(60, ((v_node.current_yield / 1000 * 300 / greatest(1, p_troop_count / 100))::numeric / v_speed_mult)::int);

  v_arrives  := now() + (v_walk_s    || ' seconds')::interval;
  v_finishes := v_arrives + (v_gather_s || ' seconds')::interval;
  v_returns  := v_finishes + (v_walk_s || ' seconds')::interval;

  insert into public.gather_marches (
    user_id, node_id, guardian_id, troop_count,
    started_at, arrives_at, finishes_at, returns_at, status,
    origin_lat, origin_lng, route_geom, route_distance_m,
    terrain_tag, terrain_gather_mult
  )
  values (
    v_user_id, p_node_id, p_guardian_id, p_troop_count,
    now(), v_arrives, v_finishes, v_returns, 'marching',
    p_user_lat, p_user_lng, v_route_geom, v_dist_m,
    coalesce(v_terrain.primary_tag, 'default'),
    coalesce(v_terrain.gather_mult, 1.0)
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
    'has_route', v_route_geom is not null
  );
end $func$;

GRANT EXECUTE ON FUNCTION public.start_gather_march(bigint, uuid, int, double precision, double precision, double precision, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.tick_gather_marches()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
declare
  v_now timestamptz := now();
  v_count int := 0;
  v_m public.gather_marches%rowtype;
  v_node public.resource_nodes%rowtype;
  v_yield_per_tick bigint;
  v_collected bigint;
  v_yield_mult numeric;
  v_terrain_mult numeric;
  v_total_mult numeric;
begin
  update public.gather_marches set status = 'gathering'
   where status = 'marching' and v_now >= arrives_at;

  for v_m in select * from public.gather_marches where status = 'gathering' loop
    select * into v_node from public.resource_nodes where id = v_m.node_id;
    if not found then continue; end if;

    select coalesce(yield_mult, 1.0) into v_yield_mult
      from public.thief_bonus_for(v_m.guardian_id, v_node.kind);
    v_terrain_mult := coalesce(v_m.terrain_gather_mult, 1.0);
    v_total_mult := v_yield_mult * v_terrain_mult;

    v_yield_per_tick := greatest(1, (v_node.total_yield / extract(epoch from (v_m.finishes_at - v_m.arrives_at)) * 60)::bigint);

    v_collected := least(
      ((v_node.current_yield + v_m.collected) * v_total_mult)::bigint,
      ((v_node.total_yield * extract(epoch from (v_now - v_m.arrives_at)) / extract(epoch from (v_m.finishes_at - v_m.arrives_at))) * v_total_mult)::bigint
    );

    update public.gather_marches set collected = v_collected where id = v_m.id;

    update public.resource_nodes
       set current_yield = greatest(0, current_yield - v_yield_per_tick),
           depleted_at = case when current_yield - v_yield_per_tick <= 0 then v_now else null end,
           respawn_at  = case when current_yield - v_yield_per_tick <= 0 then v_now + interval '36 hours' else null end
     where id = v_m.node_id;

    v_count := v_count + 1;
  end loop;

  update public.gather_marches m set status = 'returning'
   where status = 'gathering'
     and (v_now >= finishes_at or exists (select 1 from public.resource_nodes n where n.id = m.node_id and n.depleted_at is not null));

  for v_m in select * from public.gather_marches where status = 'returning' and v_now >= returns_at loop
    update public.gather_marches set status = 'completed', completed_at = v_now where id = v_m.id;
    v_count := v_count + 1;
  end loop;

  update public.resource_nodes
     set current_yield = total_yield, depleted_at = null, respawn_at = null
   where depleted_at is not null and respawn_at is not null and v_now >= respawn_at;

  return v_count;
end $func$;
