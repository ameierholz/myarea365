-- ════════════════════════════════════════════════════════════════════
-- neighborhood_blocks ETL: residential mit aufnehmen
-- ════════════════════════════════════════════════════════════════════
-- Senftenberger Ring & viele andere Berliner Hauptverkehrsadern sind in
-- OSM als 'residential' getagged (nicht primary/secondary/tertiary).
-- Wir nehmen jetzt residential mit + bumpen min_area auf 80000 m² damit
-- nur echte 'Kiez'-Polygone entstehen, keine winzigen Wohnblocks.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.etl_polygonize_neighborhood_blocks(
  p_city text,
  p_min_area_m2 double precision default 80000,
  p_max_area_m2 double precision default 5000000
) returns jsonb language plpgsql security definer as $$
declare
  v_inserted int := 0;
  v_deleted int := 0;
  v_min_lng double precision;
  v_min_lat double precision;
  v_max_lng double precision;
  v_max_lat double precision;
begin
  select ST_XMin(ST_Extent(geom)), ST_YMin(ST_Extent(geom)),
         ST_XMax(ST_Extent(geom)), ST_YMax(ST_Extent(geom))
    into v_min_lng, v_min_lat, v_max_lng, v_max_lat
    from public._etl_osm_ways
   where city = p_city
     and highway in ('motorway','trunk','primary','secondary','tertiary',
                     'residential','unclassified');

  if v_min_lng is null then
    return jsonb_build_object('ok', false, 'error', 'no_ways_staged', 'city', p_city);
  end if;

  delete from public.neighborhood_blocks
   where city = p_city
     and ST_Intersects(geom, ST_MakeEnvelope(v_min_lng, v_min_lat, v_max_lng, v_max_lat, 4326));
  get diagnostics v_deleted = row_count;

  insert into public.neighborhood_blocks (geom, centroid, area_m2, city)
    select
      poly.geom,
      ST_Centroid(poly.geom),
      ST_Area(poly.geom::geography),
      p_city
    from (
      select (ST_Dump(ST_Polygonize(geom_union))).geom
        from (
          select ST_Union(geom) as geom_union
            from public._etl_osm_ways
           where city = p_city
             and highway in ('motorway','trunk','primary','secondary','tertiary',
                             'residential','unclassified')
        ) u
    ) poly
    where ST_Area(poly.geom::geography) between p_min_area_m2 and p_max_area_m2;
  get diagnostics v_inserted = row_count;

  return jsonb_build_object(
    'ok', true,
    'city', p_city,
    'deleted', v_deleted,
    'inserted', v_inserted
  );
end $$;
grant execute on function public.etl_polygonize_neighborhood_blocks(text, double precision, double precision) to service_role;
