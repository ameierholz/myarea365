-- ════════════════════════════════════════════════════════════════════
-- Bugfix: get_crew_turf_polygons + get_crew_blocks_in_bbox
-- "column reference crew_id is ambiguous"
-- ════════════════════════════════════════════════════════════════════
-- Problem: plpgsql kollidiert wenn returns table(crew_id ...) UND
-- im Body unqualifizierte Spalten 'crew_id' (z.B. in GROUP BY) auftauchen.
-- Lösung: alle Spalten-Refs in CTEs voll qualifizieren (rep.crew_id).
-- Spaltennamen im Return-Set bleiben gleich, Frontend bricht NICHT.
-- ════════════════════════════════════════════════════════════════════

drop function if exists public.get_crew_turf_polygons(double precision, double precision, double precision, double precision);
create or replace function public.get_crew_turf_polygons(
  p_min_lat double precision, p_min_lng double precision,
  p_max_lat double precision, p_max_lng double precision
) returns table(crew_id uuid, crew_name text, crew_tag text, is_own boolean,
                territory_color text, geojson jsonb)
language plpgsql security definer as $$
begin
  return query
    with rep as (
      select r.crew_id as r_crew_id, r.lat, r.lng,
             ST_Buffer(
               ST_Transform(ST_SetSRID(ST_MakePoint(r.lng, r.lat), 4326), 3857),
               public._repeater_turf_radius_for_kind(r.kind)
             ) as buf
        from public.crew_repeaters r
       where r.destroyed_at is null
         and r.lat between p_min_lat - 0.01 and p_max_lat + 0.01
         and r.lng between p_min_lng - 0.02 and p_max_lng + 0.02
    ),
    agg as (
      select rep.r_crew_id, ST_Transform(ST_Union(rep.buf), 4326) as poly
        from rep
       group by rep.r_crew_id
    )
    select a.r_crew_id,
           c.name,
           upper(left(regexp_replace(coalesce(c.name, '?'), '[^a-zA-Z0-9]', '', 'g'), 4)),
           a.r_crew_id in (select cm.crew_id from public.crew_members cm where cm.user_id = auth.uid()),
           coalesce(c.territory_color, case
             when a.r_crew_id in (select cm.crew_id from public.crew_members cm where cm.user_id = auth.uid())
                  then '#22D1C3'
             else '#FF2D78'
           end),
           ST_AsGeoJSON(a.poly)::jsonb
      from agg a
      join public.crews c on c.id = a.r_crew_id;
end $$;
grant execute on function public.get_crew_turf_polygons(double precision, double precision, double precision, double precision) to authenticated;

-- Gleiches Pattern für get_crew_blocks_in_bbox (sql language hat das Problem
-- nicht direkt aber wir machen sicherheitshalber auch hier sauber)
drop function if exists public.get_crew_blocks_in_bbox(double precision, double precision, double precision, double precision);
create or replace function public.get_crew_blocks_in_bbox(
  p_min_lat double precision, p_min_lng double precision,
  p_max_lat double precision, p_max_lng double precision
) returns table(
  block_id bigint,
  crew_id uuid,
  crew_name text,
  is_own boolean,
  is_contested boolean,
  territory_color text,
  geojson jsonb
) language sql security definer as $$
  select
    cb.id,
    cbc.crew_id,
    c.name,
    cbc.crew_id in (select cm.crew_id from public.crew_members cm where cm.user_id = auth.uid()),
    cbc.is_contested,
    coalesce(c.territory_color, case
      when cbc.crew_id in (select cm.crew_id from public.crew_members cm where cm.user_id = auth.uid())
           then '#22D1C3'
      else '#FF2D78'
    end),
    ST_AsGeoJSON(cb.geom)::jsonb
  from public.crew_block_control cbc
  join public.city_blocks cb on cb.id = cbc.block_id
  join public.crews c on c.id = cbc.crew_id
  where cb.geom && ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326);
$$;
grant execute on function public.get_crew_blocks_in_bbox(double precision, double precision, double precision, double precision) to authenticated;
