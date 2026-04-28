-- ════════════════════════════════════════════════════════════════════
-- Repeater-Turf-Info: Fläche + Grenz-Straßen für RepeaterInfoPopup
-- ════════════════════════════════════════════════════════════════════
-- Brauchen wir:
--   - _etl_osm_ways permanent halten (nicht mehr löschen nach Polygonize)
--   - name-Spalte ergänzen (kommt aus OSM)
--   - RPC get_repeater_turf_info(repeater_id) → area_m2 + boundary_streets
-- ════════════════════════════════════════════════════════════════════

alter table public._etl_osm_ways add column if not exists name text;

-- etl_insert_ways um name erweitern
create or replace function public.etl_insert_ways(p_rows jsonb)
returns int language plpgsql security definer as $$
declare
  v_count int := 0;
  r jsonb;
begin
  for r in select * from jsonb_array_elements(p_rows) loop
    insert into public._etl_osm_ways (city, geom, highway, name)
    values (
      r->>'city',
      ST_GeomFromText(r->>'geom', 4326),
      r->>'highway',
      r->>'name'
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
grant execute on function public.etl_insert_ways(jsonb) to service_role;

-- Polygonize-Funktionen so anpassen dass sie _etl_osm_ways NICHT mehr löschen.
-- (User-ETL-Script ruft 'delete where city=X' am Anfang auf → das reicht.)
create or replace function public.etl_polygonize_city_blocks(
  p_city text,
  p_min_area_m2 double precision default 200,
  p_max_area_m2 double precision default 200000
) returns jsonb language plpgsql security definer as $$
declare
  v_inserted int := 0;
  v_deleted int := 0;
  v_min_lng double precision;
  v_min_lat double precision;
  v_max_lng double precision;
  v_max_lat double precision;
  v_classified int := 0;
begin
  select ST_XMin(ST_Extent(geom)), ST_YMin(ST_Extent(geom)),
         ST_XMax(ST_Extent(geom)), ST_YMax(ST_Extent(geom))
    into v_min_lng, v_min_lat, v_max_lng, v_max_lat
    from public._etl_osm_ways where city = p_city;

  if v_min_lng is null then
    return jsonb_build_object('ok', false, 'error', 'no_staged_ways', 'city', p_city);
  end if;

  delete from public.city_blocks
   where city = p_city
     and ST_Intersects(geom, ST_MakeEnvelope(v_min_lng, v_min_lat, v_max_lng, v_max_lat, 4326));
  get diagnostics v_deleted = row_count;

  insert into public.city_blocks (geom, centroid, area_m2, source, city)
    select poly.geom, ST_Centroid(poly.geom), ST_Area(poly.geom::geography), 'osm_overpass', p_city
    from (
      select (ST_Dump(ST_Polygonize(geom_union))).geom
        from (
          select ST_Union(geom) as geom_union
            from public._etl_osm_ways where city = p_city
        ) u
    ) poly
    where ST_Area(poly.geom::geography) between p_min_area_m2 and p_max_area_m2;
  get diagnostics v_inserted = row_count;

  with new_blocks as (
    select id, geom from public.city_blocks
     where city = p_city and street_class is null
       and ST_Intersects(geom, ST_MakeEnvelope(v_min_lng, v_min_lat, v_max_lng, v_max_lat, 4326))
  ),
  best as (
    select nb.id as block_id,
           (array_agg(ow.highway order by public._street_class_rank(ow.highway) desc nulls last))[1] as best_class
      from new_blocks nb
      join public._etl_osm_ways ow on ow.city = p_city and ST_Intersects(ow.geom, nb.geom)
     group by nb.id
  )
  update public.city_blocks cb set street_class = b.best_class
    from best b where cb.id = b.block_id;
  get diagnostics v_classified = row_count;

  -- _etl_osm_ways NICHT mehr löschen — bleibt permanent für Boundary-Lookup
  return jsonb_build_object(
    'ok', true, 'city', p_city, 'deleted', v_deleted,
    'inserted', v_inserted, 'classified', v_classified
  );
end $$;
grant execute on function public.etl_polygonize_city_blocks(text, double precision, double precision) to service_role;

-- ─── RPC: Repeater-Turf-Info (Fläche + Grenz-Straßen) ──────────────
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
    -- Kein Neighborhood-Polygon → Kreis-Fallback, Fläche = π·r²
    declare v_radius int := public._repeater_turf_radius_for_kind(v_rep.kind);
    begin
      v_area_m2 := pi() * v_radius * v_radius;
    end;
    return jsonb_build_object(
      'ok', true,
      'fallback_circle', true,
      'area_m2', round(v_area_m2)::int,
      'boundary_streets', '[]'::jsonb
    );
  end if;

  select geom, area_m2 into v_geom, v_area_m2
    from public.neighborhood_blocks where id = v_nb_id;

  -- Distinct Straßennamen die das Polygon als Grenze berühren
  select array_agg(distinct ow.name order by ow.name) into v_streets
    from public._etl_osm_ways ow
   where ow.name is not null
     and ow.name <> ''
     and ow.highway in ('motorway','trunk','primary','secondary','tertiary',
                        'residential','unclassified')
     and ST_Intersects(ow.geom, ST_Boundary(v_geom));

  return jsonb_build_object(
    'ok', true,
    'fallback_circle', false,
    'area_m2', round(v_area_m2)::int,
    'boundary_streets', coalesce(to_jsonb(v_streets), '[]'::jsonb)
  );
end $$;
grant execute on function public.get_repeater_turf_info(uuid) to authenticated;
