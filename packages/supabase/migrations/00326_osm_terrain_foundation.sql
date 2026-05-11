-- 00326_osm_terrain_foundation.sql
-- Foundation für OSM-Tag-basierte Spielmechanik. Tiles aggregieren reale
-- Stadt-Topografie (Industrie, Park, Wasser, Autobahn, etc.) zu Spiel-Daten,
-- die Marsch-Speed, Sammel-Rate und Truppen-Buffs beeinflussen.
--
-- Import-Pipeline kommt im nächsten Sprint:
-- 1. OSM-Overpass-Query pro City-Bbox holen (Vector-Tiles)
-- 2. Features auf 10m-Grid aggregieren (h3 wäre besser, aber Postgres ohne Plugin)
-- 3. Bulk-Insert via upsert
--
-- Heute: Schema + Helper-Funktionen + Lookup. Tiles werden bei Stadt-
-- Bootstrap (auch Lazy-Initialisierung mit 'default'-Tag) erstellt.

CREATE TABLE IF NOT EXISTS public.city_terrain_tiles (
  city_slug      text NOT NULL REFERENCES public.cities(slug) ON DELETE CASCADE,
  lat_idx        int NOT NULL,
  lng_idx        int NOT NULL,
  primary_tag    text NOT NULL CHECK (primary_tag IN (
    'industrial','residential','commercial','park','water','forest',
    'motorway','railway','university','hospital','government','tourism','warehouse','default'
  )),
  speed_mult     numeric NOT NULL DEFAULT 1.0,
  gather_mult    numeric NOT NULL DEFAULT 1.0,
  regen_mult     numeric NOT NULL DEFAULT 1.0,
  class_buffs    jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (city_slug, lat_idx, lng_idx)
);

CREATE INDEX IF NOT EXISTS idx_terrain_tag ON public.city_terrain_tiles(city_slug, primary_tag);

COMMENT ON TABLE public.city_terrain_tiles IS
  'OSM-Tag-basierte Terrain-Tiles für jede City. Jedes Tile (~10m) hat aggregierte Spiel-Modifier basierend auf realer Topografie.';

ALTER TABLE public.city_terrain_tiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS terrain_tiles_read ON public.city_terrain_tiles;
CREATE POLICY terrain_tiles_read ON public.city_terrain_tiles FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.lat_lng_to_tile(p_lat double precision, p_lng double precision)
RETURNS TABLE(lat_idx int, lng_idx int) LANGUAGE sql IMMUTABLE
AS $$ SELECT (p_lat * 10000)::int, (p_lng * 10000)::int $$;

CREATE OR REPLACE FUNCTION public.terrain_modifiers_for_tag(p_tag text)
RETURNS TABLE(speed_mult numeric, gather_mult numeric, regen_mult numeric, class_buffs jsonb)
LANGUAGE plpgsql IMMUTABLE
AS $$
begin
  case p_tag
    when 'industrial' then
      return query select 1.00::numeric, 1.25::numeric, 1.00::numeric,
        '{"siege": {"atk": 1.05}}'::jsonb;
    when 'residential' then
      return query select 1.00::numeric, 1.10::numeric, 1.00::numeric, '{}'::jsonb;
    when 'park' then
      return query select 1.00::numeric, 1.00::numeric, 1.30::numeric,
        '{"marksman": {"crit": 1.10}}'::jsonb;
    when 'forest' then
      return query select 0.95::numeric, 1.00::numeric, 1.25::numeric,
        '{"marksman": {"crit": 1.10}}'::jsonb;
    when 'water' then
      return query select 0.60::numeric, 1.00::numeric, 1.00::numeric,
        '{"cavalry": {"passable": false}}'::jsonb;
    when 'motorway' then
      return query select 1.50::numeric, 1.00::numeric, 1.00::numeric, '{}'::jsonb;
    when 'railway' then
      return query select 1.30::numeric, 1.00::numeric, 1.00::numeric, '{}'::jsonb;
    when 'university' then
      return query select 1.00::numeric, 1.00::numeric, 1.00::numeric,
        '{"aura": {"research_speed": 1.15}}'::jsonb;
    when 'hospital' then
      return query select 1.00::numeric, 1.00::numeric, 1.50::numeric, '{}'::jsonb;
    when 'warehouse' then
      return query select 1.00::numeric, 1.40::numeric, 1.00::numeric, '{}'::jsonb;
    when 'tourism' then
      return query select 1.00::numeric, 1.10::numeric, 1.00::numeric, '{}'::jsonb;
    when 'government' then
      return query select 1.00::numeric, 1.00::numeric, 1.00::numeric,
        '{"boss_spawn": true}'::jsonb;
    when 'commercial' then
      return query select 1.00::numeric, 1.15::numeric, 1.00::numeric, '{}'::jsonb;
    else
      return query select 1.00::numeric, 1.00::numeric, 1.00::numeric, '{}'::jsonb;
  end case;
end $$;

CREATE OR REPLACE FUNCTION public.get_terrain_at(p_city_slug text, p_lat double precision, p_lng double precision)
RETURNS public.city_terrain_tiles LANGUAGE plpgsql STABLE
SET search_path = public, pg_temp
AS $$
declare
  v_lat_idx int;
  v_lng_idx int;
  v_tile public.city_terrain_tiles;
begin
  select lat_idx, lng_idx into v_lat_idx, v_lng_idx from public.lat_lng_to_tile(p_lat, p_lng);
  select * into v_tile from public.city_terrain_tiles
    where city_slug = p_city_slug and lat_idx = v_lat_idx and lng_idx = v_lng_idx;
  if v_tile.city_slug is null then
    v_tile.city_slug := p_city_slug;
    v_tile.lat_idx := v_lat_idx;
    v_tile.lng_idx := v_lng_idx;
    v_tile.primary_tag := 'default';
    v_tile.speed_mult := 1.0;
    v_tile.gather_mult := 1.0;
    v_tile.regen_mult := 1.0;
    v_tile.class_buffs := '{}'::jsonb;
    v_tile.updated_at := now();
  end if;
  return v_tile;
end $$;

GRANT EXECUTE ON FUNCTION public.lat_lng_to_tile(double precision, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.terrain_modifiers_for_tag(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_terrain_at(text, double precision, double precision) TO authenticated;
