-- 00331_city_boundary_filter.sql
-- Echte Stadt-Boundary aus OSM speichern. upsert_districts filtert dann
-- nur Bezirke die SPATIAL INNERHALB der Stadt liegen — keine Umlandgemeinden.
-- Mindestens 50% Überlappung mit Stadt-Boundary als Kriterium.

ALTER TABLE public.cities
  ADD COLUMN IF NOT EXISTS boundary_geom extensions.geometry(Geometry, 4326);

CREATE INDEX IF NOT EXISTS cities_boundary_idx ON public.cities USING GIST (boundary_geom) WHERE boundary_geom IS NOT NULL;

CREATE OR REPLACE FUNCTION public.upsert_city_boundary(p_city_slug text, p_geometry jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
declare
  v_geom extensions.geometry;
begin
  v_geom := extensions.ST_GeomFromGeoJSON(p_geometry);
  update public.cities set boundary_geom = v_geom where slug = p_city_slug;
  return found;
end $$;

GRANT EXECUTE ON FUNCTION public.upsert_city_boundary(text, jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.upsert_districts(p_city_slug text, p_features jsonb)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
declare
  f jsonb;
  v_count int := 0;
  v_city_geom extensions.geometry;
  v_district_geom extensions.geometry;
begin
  select boundary_geom into v_city_geom from public.cities where slug = p_city_slug;

  for f in select * from jsonb_array_elements(p_features) loop
    begin
      v_district_geom := extensions.ST_GeomFromGeoJSON(f -> 'geometry');

      if v_city_geom is not null then
        if not extensions.ST_Intersects(v_city_geom, v_district_geom) then
          continue;
        end if;
        if extensions.ST_Area(extensions.ST_Intersection(v_city_geom, v_district_geom))
           / extensions.ST_Area(v_district_geom) < 0.5 then
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
