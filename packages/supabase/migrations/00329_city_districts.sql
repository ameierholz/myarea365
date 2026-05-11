-- 00329_city_districts.sql
-- Stadt-Bezirke als Polygone (OSM admin_level=9 für Berlin/Hamburg,
-- admin_level=10 für München). Jeder Bezirk wird Spawn-Container für
-- tägliche Sanctuaries.

CREATE TABLE IF NOT EXISTS public.city_districts (
  id           bigserial PRIMARY KEY,
  city_slug    text NOT NULL REFERENCES public.cities(slug) ON DELETE CASCADE,
  name         text NOT NULL,
  osm_id       bigint,
  osm_type     text CHECK (osm_type IN ('way','relation')),
  geom         extensions.geometry(Geometry, 4326) NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS districts_geom_idx ON public.city_districts USING GIST (geom);
CREATE INDEX IF NOT EXISTS districts_city_idx ON public.city_districts (city_slug);
CREATE UNIQUE INDEX IF NOT EXISTS districts_osm_idx ON public.city_districts (city_slug, osm_type, osm_id) WHERE osm_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS districts_name_idx ON public.city_districts (city_slug, lower(name));

ALTER TABLE public.city_districts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS districts_read ON public.city_districts;
CREATE POLICY districts_read ON public.city_districts FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.upsert_districts(p_city_slug text, p_features jsonb)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
declare
  f jsonb;
  v_count int := 0;
begin
  for f in select * from jsonb_array_elements(p_features) loop
    begin
      insert into public.city_districts (city_slug, name, osm_id, osm_type, geom)
      values (
        p_city_slug,
        coalesce(f ->> 'name', 'Unbenannt'),
        (f ->> 'osm_id')::bigint,
        f ->> 'osm_type',
        extensions.ST_GeomFromGeoJSON(f -> 'geometry')
      )
      on conflict (city_slug, osm_type, osm_id) where osm_id is not null
      do update set
        name = excluded.name,
        geom = excluded.geom;
      v_count := v_count + 1;
    exception when others then
      continue;
    end;
  end loop;
  return v_count;
end $$;

REVOKE ALL ON FUNCTION public.upsert_districts(text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.upsert_districts(text, jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.random_point_in_district(p_district_id bigint, OUT lat double precision, OUT lng double precision)
RETURNS record LANGUAGE plpgsql STABLE
SET search_path = public, extensions, pg_temp
AS $$
declare
  v_geom extensions.geometry;
  v_env extensions.geometry;
  v_xmin double precision; v_xmax double precision;
  v_ymin double precision; v_ymax double precision;
  v_pt extensions.geometry;
  i int := 0;
begin
  select geom into v_geom from public.city_districts where id = p_district_id;
  if v_geom is null then return; end if;

  v_env := extensions.ST_Envelope(v_geom);
  v_xmin := extensions.ST_XMin(v_env);
  v_xmax := extensions.ST_XMax(v_env);
  v_ymin := extensions.ST_YMin(v_env);
  v_ymax := extensions.ST_YMax(v_env);

  while i < 100 loop
    v_pt := extensions.ST_SetSRID(extensions.ST_MakePoint(
      v_xmin + random() * (v_xmax - v_xmin),
      v_ymin + random() * (v_ymax - v_ymin)
    ), 4326);
    if extensions.ST_Contains(v_geom, v_pt) then
      lng := extensions.ST_X(v_pt);
      lat := extensions.ST_Y(v_pt);
      return;
    end if;
    i := i + 1;
  end loop;

  v_pt := extensions.ST_PointOnSurface(v_geom);
  lng := extensions.ST_X(v_pt);
  lat := extensions.ST_Y(v_pt);
end $$;

GRANT EXECUTE ON FUNCTION public.random_point_in_district(bigint) TO authenticated, service_role;
