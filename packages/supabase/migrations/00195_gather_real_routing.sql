-- ══════════════════════════════════════════════════════════════════════════
-- Sammel-Marsch: Echtes Walking-Routing statt Luftlinie
-- ══════════════════════════════════════════════════════════════════════════
-- Speichert die Mapbox-Walking-Polyline + tatsächliche Distanz (Straßen-
-- Routing). Walk-Zeit wird auf der echten Distanz berechnet, nicht Luftlinie.
-- Falls kein Route übergeben wird, fällt RPC auf Luftlinie × 1.4 zurück
-- (typischer Detour-Faktor in Städten) — Fallback z.B. wenn Mapbox-API
-- timed-out hat.
-- ══════════════════════════════════════════════════════════════════════════

alter table public.gather_marches
  add column if not exists route_geom        geometry(LineString, 4326),
  add column if not exists route_distance_m  double precision;

create or replace function public.start_gather_march(
  p_node_id            bigint,
  p_guardian_id        uuid,
  p_troop_count        int,
  p_user_lat           double precision,
  p_user_lng           double precision,
  p_route_distance_m   double precision default null,
  p_route_geom_geojson text             default null
) returns jsonb language plpgsql security definer as $$
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
  v_route_geom geometry(LineString, 4326);
begin
  if v_user_id is null then return jsonb_build_object('error','not_authenticated'); end if;

  select * into v_node from public.resource_nodes where id = p_node_id;
  if not found then return jsonb_build_object('error','node_not_found'); end if;
  if v_node.depleted_at is not null then return jsonb_build_object('error','node_depleted'); end if;

  -- Thief-Speed-Bonus (1.0 wenn nicht passend)
  select coalesce(speed_mult, 1.0) into v_speed_mult
    from public.thief_bonus_for(p_guardian_id, v_node.kind);

  -- Distanz: echte Straßen-Distanz wenn übergeben, sonst Luftlinie × 1.4
  if p_route_distance_m is not null and p_route_distance_m > 0 then
    v_dist_m := p_route_distance_m;
  else
    v_dist_m := st_distance(
      st_setsrid(st_makepoint(p_user_lng, p_user_lat), 4326)::geography,
      v_node.geom::geography
    ) * 1.4;  -- Detour-Faktor
  end if;

  -- Route-Geometrie parsen falls übergeben
  if p_route_geom_geojson is not null then
    begin
      v_route_geom := st_setsrid(st_geomfromgeojson(p_route_geom_geojson), 4326);
      -- Sicherstellen dass es ein LineString ist (kein Point/Polygon)
      if st_geometrytype(v_route_geom) <> 'ST_LineString' then
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
    origin_lat, origin_lng, route_geom, route_distance_m
  )
  values (
    v_user_id, p_node_id, p_guardian_id, p_troop_count,
    now(), v_arrives, v_finishes, v_returns, 'marching',
    p_user_lat, p_user_lng, v_route_geom, v_dist_m
  )
  returning id into v_march_id;

  return jsonb_build_object(
    'ok', true, 'march_id', v_march_id,
    'arrives_at', v_arrives, 'finishes_at', v_finishes, 'returns_at', v_returns,
    'walk_seconds', v_walk_s, 'gather_seconds', v_gather_s,
    'distance_m', round(v_dist_m),
    'thief_speed_mult', v_speed_mult,
    'has_route', v_route_geom is not null
  );
end $$;

grant execute on function public.start_gather_march(bigint, uuid, int, double precision, double precision, double precision, text) to authenticated;

-- Index auf route_geom für schnelle BBox-Queries (Map-Render)
create index if not exists gather_marches_route_geom_idx
  on public.gather_marches using gist (route_geom)
  where route_geom is not null;
