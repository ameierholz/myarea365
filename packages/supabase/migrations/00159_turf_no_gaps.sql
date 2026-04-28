-- ════════════════════════════════════════════════════════════════════
-- Turf ohne Lücken — Parks inkludieren + Gap-Closing
-- ════════════════════════════════════════════════════════════════════
-- User-Feedback: 'im normalen leben gibt es ja auch keine Lücken für ein Revier'.
-- Aktuell: Park-Blocks ausgefiltert + getrennte Block-Polygone bleiben getrennt.
-- Fix:
--   1. recompute claimt ALLE Blocks im Radius (auch Parks/Wiesen)
--   2. get_crew_blocks_in_bbox: ST_Buffer +50m / -50m schließt Lücken
--      bis ~100m breit zwischen getrennten Block-Stücken.
--   3. fill_polygon_holes danach noch.
-- ════════════════════════════════════════════════════════════════════

-- ─── 1) recompute: kein street_class-Filter mehr ────────────────────
create or replace function public.recompute_repeater_block_claims(p_repeater_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_repeater record;
  v_radius int;
  v_inserted int := 0;
begin
  delete from public.repeater_block_claims where repeater_id = p_repeater_id;

  select id, kind, hp, lat, lng, destroyed_at
    into v_repeater
    from public.crew_repeaters where id = p_repeater_id;
  if v_repeater is null or v_repeater.destroyed_at is not null then
    return jsonb_build_object('ok', true, 'inserted', 0, 'reason', 'destroyed_or_missing');
  end if;

  v_radius := public._repeater_turf_radius_for_kind(v_repeater.kind);

  insert into public.repeater_block_claims (repeater_id, block_id, influence)
    select p_repeater_id, cb.id, v_repeater.hp
      from public.city_blocks cb
     where ST_DWithin(
             cb.centroid::geography,
             ST_SetSRID(ST_MakePoint(v_repeater.lng, v_repeater.lat), 4326)::geography,
             v_radius
           )
    on conflict do nothing;
  get diagnostics v_inserted = row_count;

  return jsonb_build_object('ok', true, 'inserted', v_inserted, 'radius_m', v_radius);
end $$;

-- ─── 2) get_crew_blocks_in_bbox: morphologisches Closing + holes-fill ─
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
           -- Morphologisches Closing: +50m Buffer in Web Mercator → Union →
           -- -50m Shrink. Schließt Lücken bis ~100m zwischen Block-Teilen.
           -- Danach Holes auffüllen.
           public._fill_polygon_holes(
             ST_Transform(
               ST_Buffer(
                 ST_Buffer(
                   ST_Transform(ST_Union(c.geom), 3857),
                   50
                 ),
                 -50
               ),
               4326
             )
           ) as poly,
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

-- ─── 3) Recompute alle Repeater (Parks jetzt mit drin) ──────────────
do $$ declare r record;
begin
  for r in select id from public.crew_repeaters where destroyed_at is null loop
    perform public.recompute_repeater_block_claims(r.id);
  end loop;
end $$;
