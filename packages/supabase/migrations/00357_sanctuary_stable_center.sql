-- 00357_sanctuary_stable_center.sql
-- Sanctuaries landeten zu nah an Bezirks-Grenzen — zwei benachbarte Bezirke
-- konnten Random-Punkte produzieren die fast zusammen liegen.
--
-- Fix: ST_PointOnSurface des größten urbanen Polygon-Clusters im Bezirk
-- (= Hauptkern, garantiert "innen", nicht am Rand). Mit kleinem Daily-Jitter
-- (±0.003° ≈ ±220m) für Variation pro Rotation.

CREATE OR REPLACE FUNCTION public.random_point_in_district_urban(
  p_district_id bigint,
  OUT lat double precision,
  OUT lng double precision
)
RETURNS record LANGUAGE plpgsql STABLE
SET search_path = public, extensions, pg_temp
AS $$
declare
  v_geom extensions.geometry;
  v_city text;
  v_district_name text;
  v_largest extensions.geometry;
  v_center extensions.geometry;
  v_jitter_lat double precision;
  v_jitter_lng double precision;
  v_seed text;
  v_seed_hash int;
begin
  select geom, city_slug, name into v_geom, v_city, v_district_name
  from public.city_districts where id = p_district_id;
  if v_geom is null then return; end if;

  -- Größtes urbanes Polygon im Bezirk finden (residential/commercial/tourism/etc).
  -- ST_Intersection sorgt dafür dass wir nur den Teil im Bezirk haben.
  select extensions.ST_Intersection(p.geom, v_geom) into v_largest
  from public.city_terrain_polygons p
  where p.city_slug = v_city
    and p.primary_tag in ('residential','commercial','tourism','university','government','park')
    and extensions.ST_Intersects(p.geom, v_geom)
  order by extensions.ST_Area(extensions.ST_Intersection(p.geom, v_geom)) desc
  limit 1;

  -- Fallback: keine urbanen Polygone → Centroid des Bezirks
  if v_largest is null or extensions.ST_IsEmpty(v_largest) then
    v_center := extensions.ST_PointOnSurface(v_geom);
  else
    v_center := extensions.ST_PointOnSurface(v_largest);
  end if;

  -- Daily-Jitter: ±0.003° ≈ ±220m, deterministisch pro Bezirk+Tag.
  v_seed := v_district_name || to_char(now() at time zone 'Europe/Berlin', 'YYYY-MM-DD');
  v_seed_hash := abs(hashtext(v_seed));
  v_jitter_lat := ((v_seed_hash % 1000) / 1000.0 - 0.5) * 0.006;     -- −0.003 .. +0.003
  v_jitter_lng := (((v_seed_hash >> 10) % 1000) / 1000.0 - 0.5) * 0.006;

  lng := extensions.ST_X(v_center) + v_jitter_lng;
  lat := extensions.ST_Y(v_center) + v_jitter_lat;

  -- Sicherheits-Check: wenn Jitter aus dem Bezirk rausführt, ohne Jitter zurück
  if not extensions.ST_Contains(v_geom, extensions.ST_SetSRID(extensions.ST_MakePoint(lng, lat), 4326)) then
    lng := extensions.ST_X(v_center);
    lat := extensions.ST_Y(v_center);
  end if;
end $$;

GRANT EXECUTE ON FUNCTION public.random_point_in_district_urban(bigint) TO authenticated, service_role;

-- Direkt einmal rotieren, damit alle Bezirke neu spawnen.
SELECT public.rotate_sanctuaries();
