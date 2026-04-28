-- ════════════════════════════════════════════════════════════════════
-- Turf = Repeater-Kreis ∪ alle Blocks die hineinragen
-- ════════════════════════════════════════════════════════════════════
-- Endlösung für "keine Lücken im Revier":
-- - Jeder Repeater hat einen GARANTIERTEN Coverage-Kreis (radius_m)
-- - Plus ALLE city_blocks die in diesen Kreis hineinragen werden voll mit
--   reingenommen (Block extends beyond circle naturally)
-- - Union pro Crew + Holes auffüllen
-- - Resultat: ein zusammenhängender Turf der MIN. der Kreis ist und an
--   Block-Rändern natürlich überschießt → "Straßen-aware Kreis"
-- ════════════════════════════════════════════════════════════════════

drop function if exists public.get_crew_blocks_in_bbox(double precision, double precision, double precision, double precision);
create or replace function public.get_crew_blocks_in_bbox(
  p_min_lat double precision, p_min_lng double precision,
  p_max_lat double precision, p_max_lng double precision
) returns table(
  crew_id uuid,
  crew_name text,
  is_own boolean,
  is_contested boolean,
  territory_color text,
  geojson jsonb
) language sql security definer as $$
  with all_geoms as (
    -- (a) Block-Polygone aus crew_block_control (Straßen-Grenzen wo vorhanden)
    select cbc.crew_id, cb.geom, cbc.is_contested
      from public.crew_block_control cbc
      join public.city_blocks cb on cb.id = cbc.block_id
     where cb.geom && ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)
    union all
    -- (b) Repeater-Coverage-Kreise (garantiert keine Lücken)
    select r.crew_id,
           ST_Transform(
             ST_Buffer(
               ST_Transform(ST_SetSRID(ST_MakePoint(r.lng, r.lat), 4326), 3857),
               public._repeater_turf_radius_for_kind(r.kind)
             ),
             4326
           ) as geom,
           false as is_contested
      from public.crew_repeaters r
     where r.destroyed_at is null
       and r.lat between p_min_lat - 0.01 and p_max_lat + 0.01
       and r.lng between p_min_lng - 0.02 and p_max_lng + 0.02
  ),
  unioned as (
    select ag.crew_id,
           public._fill_polygon_holes(ST_Union(ag.geom)) as poly,
           bool_or(ag.is_contested) as has_contested
      from all_geoms ag
     group by ag.crew_id
  )
  select
    u.crew_id,
    cw.name as crew_name,
    u.crew_id in (select cm.crew_id from public.crew_members cm where cm.user_id = auth.uid()) as is_own,
    u.has_contested as is_contested,
    coalesce(cw.territory_color, case
      when u.crew_id in (select cm.crew_id from public.crew_members cm where cm.user_id = auth.uid())
           then '#22D1C3'
      else '#FF2D78'
    end) as territory_color,
    ST_AsGeoJSON(u.poly)::jsonb as geojson
  from unioned u
  join public.crews cw on cw.id = u.crew_id;
$$;
grant execute on function public.get_crew_blocks_in_bbox(double precision, double precision, double precision, double precision) to authenticated;

-- Phase-1-Layer (get_crew_turf_polygons / Kreis-only Fallback) ist jetzt
-- redundant aber bleibt drin als Fallback wenn city_blocks leer wäre.
-- App-Map Layer-Hide-Logic (crewBlocks.length > 0 → circles aus) regelt das.
