-- 00327_osm_terrain_polygons.sql
-- PostGIS-basierte Terrain-Daten: statt Tile-Grid speichern wir die echten
-- OSM-Polygone und machen ST_Contains-Lookups. Präziser + skalierbar.
-- Ersetzt city_terrain_tiles (war leer, kein Datenverlust).

DROP FUNCTION IF EXISTS public.get_terrain_at(text, double precision, double precision);
DROP FUNCTION IF EXISTS public.lat_lng_to_tile(double precision, double precision);
DROP TABLE IF EXISTS public.city_terrain_tiles;

CREATE TABLE IF NOT EXISTS public.city_terrain_polygons (
  id           bigserial PRIMARY KEY,
  city_slug    text NOT NULL REFERENCES public.cities(slug) ON DELETE CASCADE,
  primary_tag  text NOT NULL CHECK (primary_tag IN (
    'industrial','residential','commercial','park','water','forest',
    'motorway','railway','university','hospital','government','tourism','warehouse'
  )),
  osm_id       bigint,
  osm_type     text CHECK (osm_type IN ('way','relation','node')),
  name         text,
  geom         extensions.geometry(Geometry, 4326) NOT NULL,
  priority     int NOT NULL DEFAULT 5,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS terrain_polys_geom_idx ON public.city_terrain_polygons USING GIST (geom);
CREATE INDEX IF NOT EXISTS terrain_polys_city_idx ON public.city_terrain_polygons (city_slug, primary_tag);
CREATE UNIQUE INDEX IF NOT EXISTS terrain_polys_osm_idx ON public.city_terrain_polygons (city_slug, osm_type, osm_id) WHERE osm_id IS NOT NULL;

ALTER TABLE public.city_terrain_polygons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS terrain_polys_read ON public.city_terrain_polygons;
CREATE POLICY terrain_polys_read ON public.city_terrain_polygons FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.get_terrain_at(p_city_slug text, p_lat double precision, p_lng double precision)
RETURNS TABLE(primary_tag text, speed_mult numeric, gather_mult numeric, regen_mult numeric, class_buffs jsonb, name text)
LANGUAGE plpgsql STABLE
SET search_path = public, extensions, pg_temp
AS $$
declare
  v_pt extensions.geometry := extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326);
  v_match record;
  v_mods record;
begin
  select tp.primary_tag, tp.name into v_match
    from public.city_terrain_polygons tp
   where tp.city_slug = p_city_slug
     and extensions.ST_Contains(tp.geom, v_pt)
   order by tp.priority desc
   limit 1;

  if v_match.primary_tag is null then
    return query select 'default'::text, 1.0::numeric, 1.0::numeric, 1.0::numeric, '{}'::jsonb, null::text;
    return;
  end if;

  select * into v_mods from public.terrain_modifiers_for_tag(v_match.primary_tag);
  return query select v_match.primary_tag, v_mods.speed_mult, v_mods.gather_mult, v_mods.regen_mult, v_mods.class_buffs, v_match.name;
end $$;

GRANT EXECUTE ON FUNCTION public.get_terrain_at(text, double precision, double precision) TO authenticated;

CREATE OR REPLACE FUNCTION public.upsert_terrain_polygons(p_city_slug text, p_features jsonb)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
declare
  f jsonb;
  v_count int := 0;
  v_priority int;
begin
  for f in select * from jsonb_array_elements(p_features) loop
    v_priority := case (f ->> 'primary_tag')
      when 'water' then 9
      when 'motorway' then 8
      when 'railway' then 7
      when 'hospital' then 7
      when 'government' then 7
      when 'university' then 6
      when 'park' then 6
      when 'forest' then 6
      when 'tourism' then 5
      when 'warehouse' then 5
      when 'industrial' then 4
      when 'commercial' then 3
      when 'residential' then 2
      else 1
    end;
    begin
      insert into public.city_terrain_polygons (city_slug, primary_tag, osm_id, osm_type, name, geom, priority)
      values (
        p_city_slug,
        f ->> 'primary_tag',
        (f ->> 'osm_id')::bigint,
        f ->> 'osm_type',
        f ->> 'name',
        extensions.ST_GeomFromGeoJSON(f -> 'geometry'),
        v_priority
      )
      on conflict (city_slug, osm_type, osm_id) where osm_id is not null
      do update set
        primary_tag = excluded.primary_tag,
        name = excluded.name,
        geom = excluded.geom,
        priority = excluded.priority;
      v_count := v_count + 1;
    exception when others then
      continue;
    end;
  end loop;
  return v_count;
end $$;

REVOKE ALL ON FUNCTION public.upsert_terrain_polygons(text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.upsert_terrain_polygons(text, jsonb) TO authenticated, service_role;
