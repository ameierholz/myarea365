-- ════════════════════════════════════════════════════════════════════
-- Block-Turf Polish — Touch-Nachbarn, Union, Park-Blocks meiden
-- ════════════════════════════════════════════════════════════════════
-- User-Feedback:
--   1. Park-Blocks (street_class NULL) werden bevorzugt → drumherum-Wohngebäude
--      werden nicht erkannt. Fix: Blocks mit street_class bevorzugen.
--   2. Innere Trennlinien zwischen angrenzenden Crew-Blocks. Fix: pro Crew
--      ST_Union → ein einziges Polygon ohne inner borders.
--   3. HQ liegt außerhalb des Turfs (Park-Block-Nachbar weit weg). Fix:
--      Nachbarn primär via ST_Touches (echte Anrainer), Distance nur Fallback.
-- ════════════════════════════════════════════════════════════════════

-- ─── 1) _block_id_at: Blocks MIT street_class bevorzugen ─────────────
create or replace function public._block_id_at(p_lat double precision, p_lng double precision)
returns bigint language plpgsql stable as $$
declare
  v_id bigint;
begin
  -- Step 1: exakter Hit — Block mit street_class first
  select id into v_id
    from public.city_blocks
   where ST_Contains(geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326))
   order by case when street_class is not null and street_class <> '' then 0 else 1 end,
            area_m2 asc  -- kleinerer Block (kein riesiger Park) bevorzugen
   limit 1;
  if v_id is not null then return v_id; end if;

  -- Step 2: Fallback — nächster Block-Centroid innerhalb 300m, street_class bevorzugt
  select id into v_id
    from public.city_blocks
   where ST_DWithin(centroid::geography,
                    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
                    300)
   order by case when street_class is not null and street_class <> '' then 0 else 1 end,
            ST_Distance(centroid::geography,
                        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography)
   limit 1;
  return v_id;
end $$;

-- ─── 2) _neighbor_block_ids: ST_Touches first, distance als Fallback ─
create or replace function public._neighbor_block_ids(p_block_id bigint, p_count int)
returns bigint[] language plpgsql stable as $$
declare
  v_geom geometry;
  v_neighbors bigint[] := array[]::bigint[];
  v_remaining int;
begin
  if p_count <= 0 then return array[]::bigint[]; end if;
  select geom into v_geom from public.city_blocks where id = p_block_id;
  if v_geom is null then return array[]::bigint[]; end if;

  -- Step 1: ECHTE Anrainer (ST_Touches), bevorzugt mit street_class
  select array_agg(id) into v_neighbors
    from (
      select id from public.city_blocks
       where id <> p_block_id
         and ST_Touches(geom, v_geom)
       order by case when street_class is not null and street_class <> '' then 0 else 1 end,
                area_m2 asc
       limit p_count
    ) n;
  v_neighbors := coalesce(v_neighbors, array[]::bigint[]);

  -- Step 2: falls < p_count, fülle mit distance-based auf (max 200m)
  v_remaining := p_count - coalesce(array_length(v_neighbors, 1), 0);
  if v_remaining > 0 then
    declare v_extra bigint[];
    begin
      select array_agg(id) into v_extra
        from (
          select id from public.city_blocks
           where id <> p_block_id
             and not (id = any(v_neighbors))
             and ST_DWithin(geom::geography, v_geom::geography, 200)
             and street_class is not null and street_class <> ''
           order by ST_Distance(centroid, ST_Centroid(v_geom))
           limit v_remaining
        ) n;
      v_neighbors := v_neighbors || coalesce(v_extra, array[]::bigint[]);
    end;
  end if;

  return v_neighbors;
end $$;

-- ─── 3) get_crew_blocks_in_bbox: Union pro Crew (kein Inner-Border) ──
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
           ST_Union(c.geom) as poly,
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

-- ─── 4) Recompute alle bestehenden Repeater-Claims mit neuen Helpers ─
do $$ declare r record;
begin
  for r in select id from public.crew_repeaters where destroyed_at is null loop
    perform public.recompute_repeater_block_claims(r.id);
  end loop;
end $$;
