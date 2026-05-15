-- 00390_kurier_npc_kind.sql
-- Zwei Kurier-Typen:
--   • static  — steht auf Parks/Industriegebieten/Waldrändern, animiert "Idle"
--   • walker  — wandert auf Straßen (Mapbox-Walking-Route), animiert "Walk"
--
-- Static-NPCs ersetzen die alten Wegelager. Walker kommt später wenn das
-- 2. 3D-Modell mit Walking-Animation eingespielt ist.
--
-- Diese Migration: npc_kind-Spalte, route nullable für static, Cleanup-Helper.

ALTER TABLE public.kurier_streifen
  ADD COLUMN IF NOT EXISTS npc_kind text NOT NULL DEFAULT 'static'
    CHECK (npc_kind IN ('static','walker'));

-- Optional-Feld: welcher OSM-Feature-Typ hat den Spawn ausgelöst (park/industrial/forest/water_edge)
ALTER TABLE public.kurier_streifen
  ADD COLUMN IF NOT EXISTS spawn_terrain text;

-- Static NPCs brauchen keine Strassen-Route → Constraint relaxen
ALTER TABLE public.kurier_streifen
  ALTER COLUMN route_distance_m DROP NOT NULL;

-- BBox-Query erweitern um npc_kind + spawn_terrain
CREATE OR REPLACE FUNCTION public.kurier_streifen_in_bbox(
  p_south double precision, p_west double precision,
  p_north double precision, p_east double precision
) RETURNS TABLE (
  id bigint, city_slug text, npc_kind text, spawn_terrain text,
  origin_lat double precision, origin_lng double precision,
  target_lat double precision, target_lng double precision,
  route_geom_json jsonb, route_distance_m double precision,
  started_at timestamptz, finishes_at timestamptz,
  status text, loot_tier text, hp int, troop_count int
)
LANGUAGE plpgsql STABLE
SET search_path = public, extensions, pg_temp
AS $function$
DECLARE
  v_envelope extensions.geometry;
BEGIN
  v_envelope := extensions.ST_MakeEnvelope(p_west, p_south, p_east, p_north, 4326);
  RETURN QUERY
  SELECT k.id, k.city_slug, k.npc_kind, k.spawn_terrain,
         k.origin_lat, k.origin_lng, k.target_lat, k.target_lng,
         CASE WHEN k.route_geom IS NOT NULL
              THEN extensions.ST_AsGeoJSON(k.route_geom)::jsonb
              ELSE NULL END,
         k.route_distance_m, k.started_at, k.finishes_at,
         k.status, k.loot_tier, k.hp, k.troop_count
    FROM public.kurier_streifen k
   WHERE k.status = 'walking'
     AND (
       (k.route_geom IS NOT NULL AND k.route_geom && v_envelope)
       OR (k.origin_lat BETWEEN p_south AND p_north AND k.origin_lng BETWEEN p_west AND p_east)
     )
   ORDER BY k.started_at DESC
   LIMIT 100;
END $function$;

GRANT EXECUTE ON FUNCTION public.kurier_streifen_in_bbox(double precision, double precision, double precision, double precision) TO anon, authenticated;
