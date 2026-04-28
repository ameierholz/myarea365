-- ════════════════════════════════════════════════════════════════════
-- Turf-Blocks am Repeater-Kreis abschneiden
-- ════════════════════════════════════════════════════════════════════
-- Aktuelles Problem: lange Blocks (deren Centroid im 350m Radius liegt)
-- ragen weit über den Kreis hinaus → Turf hat protruding Rechtecke außen.
-- Fix: jeden Block per ST_Intersection mit dem nächsten Repeater-Kreis
-- der Crew clipping. Innerhalb sauber, außen sauber abgeschnitten.
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
  with crew_circles as (
    -- Pro Crew: Union aller Repeater-Coverage-Kreise (in 3857 für ST_Buffer in Metern)
    select r.crew_id,
           ST_Union(
             ST_Buffer(
               ST_Transform(ST_SetSRID(ST_MakePoint(r.lng, r.lat), 4326), 3857),
               public._repeater_turf_radius_for_kind(r.kind)
             )
           ) as circles_3857
      from public.crew_repeaters r
     where r.destroyed_at is null
       and r.lat between p_min_lat - 0.01 and p_max_lat + 0.01
       and r.lng between p_min_lng - 0.02 and p_max_lng + 0.02
     group by r.crew_id
  ),
  crew_blocks_clipped as (
    -- Block-Polygone per Crew, am Crew-Kreis-Union geclippt
    select cbc.crew_id,
           ST_Intersection(
             ST_Transform(cb.geom, 3857),
             cc.circles_3857
           ) as clipped_3857,
           cbc.is_contested
      from public.crew_block_control cbc
      join public.city_blocks cb on cb.id = cbc.block_id
      join crew_circles cc on cc.crew_id = cbc.crew_id
     where cb.geom && ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)
  ),
  per_crew as (
    -- Union: alle geclippten Blocks PLUS der ganze Crew-Kreis (Garantie keine Lücken)
    select cc.crew_id,
           public._fill_polygon_holes(
             ST_Transform(
               ST_Union(coalesce(cbcl.clipped_3857, cc.circles_3857), cc.circles_3857),
               4326
             )
           ) as poly,
           coalesce(bool_or(cbcl.is_contested), false) as has_contested
      from crew_circles cc
      left join crew_blocks_clipped cbcl on cbcl.crew_id = cc.crew_id
     group by cc.crew_id, cc.circles_3857
  )
  select
    pc.crew_id,
    cw.name as crew_name,
    pc.crew_id in (select cm.crew_id from public.crew_members cm where cm.user_id = auth.uid()) as is_own,
    pc.has_contested as is_contested,
    coalesce(cw.territory_color, case
      when pc.crew_id in (select cm.crew_id from public.crew_members cm where cm.user_id = auth.uid())
           then '#22D1C3'
      else '#FF2D78'
    end) as territory_color,
    ST_AsGeoJSON(pc.poly)::jsonb as geojson
  from per_crew pc
  join public.crews cw on cw.id = pc.crew_id;
$$;
grant execute on function public.get_crew_blocks_in_bbox(double precision, double precision, double precision, double precision) to authenticated;
