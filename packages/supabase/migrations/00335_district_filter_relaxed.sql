-- 00335_district_filter_relaxed.sql
-- Filter: ≥30% Area-Overlap mit Stadt-Boundary statt strikte
-- Centroid-Containment. Border-Bezirke (Pankow/Spandau/Steglitz)
-- haben kleine Anteile außerhalb Berlins, aber ihr Hauptkörper ist drin.

CREATE OR REPLACE FUNCTION public.upsert_districts(p_city_slug text, p_features jsonb)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
declare
  f jsonb;
  v_count int := 0;
  v_city_geom extensions.geometry;
  v_district_geom extensions.geometry;
  v_intersect_area numeric;
  v_district_area numeric;
begin
  select extensions.ST_MakeValid(boundary_geom) into v_city_geom
    from public.cities where slug = p_city_slug;

  for f in select * from jsonb_array_elements(p_features) loop
    begin
      v_district_geom := extensions.ST_MakeValid(extensions.ST_GeomFromGeoJSON(f -> 'geometry'));

      if v_city_geom is not null then
        if not extensions.ST_Intersects(v_city_geom, v_district_geom) then
          continue;
        end if;
        v_district_area := extensions.ST_Area(v_district_geom);
        if v_district_area <= 0 then continue; end if;
        v_intersect_area := extensions.ST_Area(extensions.ST_Intersection(v_city_geom, v_district_geom));
        if v_intersect_area / v_district_area < 0.30 then
          continue;
        end if;
      end if;

      insert into public.city_districts (city_slug, name, osm_id, osm_type, geom)
      values (
        p_city_slug,
        coalesce(f ->> 'name', 'Unbenannt'),
        (f ->> 'osm_id')::bigint,
        f ->> 'osm_type',
        v_district_geom
      )
      on conflict (city_slug, osm_type, osm_id) where osm_id is not null
      do update set name = excluded.name, geom = excluded.geom;
      v_count := v_count + 1;
    exception when others then
      continue;
    end;
  end loop;
  return v_count;
end $$;

GRANT EXECUTE ON FUNCTION public.upsert_districts(text, jsonb) TO authenticated, service_role;
