-- ════════════════════════════════════════════════════════════════════
-- Bugfix: get_repeater_turf_info Grenz-Straßen mit DWithin-Toleranz
-- ════════════════════════════════════════════════════════════════════
-- ST_Intersects(way, ST_Boundary(polygon)) verfehlt Wege die ein paar
-- Meter neben dem Polygon-Rand verlaufen. Lösung: 5m DWithin-Toleranz.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.get_repeater_turf_info(p_repeater_id uuid)
returns jsonb language plpgsql stable as $$
declare
  v_rep record;
  v_nb_id bigint;
  v_area_m2 double precision;
  v_streets text[];
  v_geom geometry;
begin
  select id, lat, lng, kind from public.crew_repeaters
   where id = p_repeater_id and destroyed_at is null
   into v_rep;
  if v_rep is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;

  v_nb_id := public._neighborhood_id_at(v_rep.lat, v_rep.lng);

  if v_nb_id is null then
    declare v_radius int := public._repeater_turf_radius_for_kind(v_rep.kind);
    begin v_area_m2 := pi() * v_radius * v_radius; end;
    return jsonb_build_object(
      'ok', true,
      'fallback_circle', true,
      'area_m2', round(v_area_m2)::int,
      'boundary_streets', '[]'::jsonb
    );
  end if;

  select geom, area_m2 into v_geom, v_area_m2
    from public.neighborhood_blocks where id = v_nb_id;

  -- Distinct Straßennamen die das Polygon-Boundary streifen (5m Toleranz)
  select array_agg(distinct ow.name order by ow.name) into v_streets
    from public._etl_osm_ways ow
   where ow.name is not null
     and ow.name <> ''
     and ow.highway in ('motorway','trunk','primary','secondary','tertiary',
                        'residential','unclassified')
     and ST_DWithin(ow.geom::geography, ST_Boundary(v_geom)::geography, 5);

  return jsonb_build_object(
    'ok', true,
    'fallback_circle', false,
    'area_m2', round(v_area_m2)::int,
    'boundary_streets', coalesce(to_jsonb(v_streets), '[]'::jsonb)
  );
end $$;
grant execute on function public.get_repeater_turf_info(uuid) to authenticated;
