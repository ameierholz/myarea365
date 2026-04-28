-- ════════════════════════════════════════════════════════════════════
-- Turf-Polygon: Innere Löcher (Parks) auffüllen
-- ════════════════════════════════════════════════════════════════════
-- Problem: HQ im Park → drumherum Straßen-Blocks geclaimt → ST_Union macht
-- Polygon mit Loch in der Mitte (= Park nicht gefüllt). User will das Loch
-- automatisch geschlossen sehen.
-- Fix: ExteriorRing per Polygon-Part nehmen, Holes ignorieren.
-- ════════════════════════════════════════════════════════════════════

create or replace function public._fill_polygon_holes(p_geom geometry)
returns geometry language sql immutable as $$
  with parts as (
    select (ST_Dump(p_geom)).geom as g
  )
  select ST_Multi(ST_Collect(ST_MakePolygon(ST_ExteriorRing(parts.g))))
    from parts
   where ST_GeometryType(parts.g) = 'ST_Polygon';
$$;

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
  with controlled as (
    select cbc.crew_id, cb.geom, cbc.is_contested
      from public.crew_block_control cbc
      join public.city_blocks cb on cb.id = cbc.block_id
     where cb.geom && ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)
  ),
  unioned as (
    select c.crew_id,
           public._fill_polygon_holes(ST_Union(c.geom)) as poly,
           bool_or(c.is_contested) as has_contested
      from controlled c
     group by c.crew_id
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
