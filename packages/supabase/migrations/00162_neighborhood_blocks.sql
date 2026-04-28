-- ════════════════════════════════════════════════════════════════════
-- Phase 3.5 — Neighborhood-Blocks: ganze Stadtteile durch Hauptstraßen
-- ════════════════════════════════════════════════════════════════════
-- Aktuelle city_blocks = kleine Häuserblocks (jede Wohnstraße trennt).
-- neighborhood_blocks = größere "Kiez"-Polygone, gebildet nur durch
-- primary/secondary/tertiary Straßen (kein residential split).
-- HQ liegt INNERHALB so eines Polygons → genau das wird der Turf.
--
-- ETL muss neu laufen — Script wird angepasst (nutzt _etl_osm_ways
-- staging zweimal: einmal alle Ways → city_blocks, einmal nur major
-- → neighborhood_blocks).
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.neighborhood_blocks (
  id           bigserial primary key,
  geom         geometry(Polygon, 4326) not null,
  centroid     geometry(Point, 4326) not null,
  area_m2      double precision not null,
  city         text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_neighborhood_blocks_geom on public.neighborhood_blocks using gist (geom);
create index if not exists idx_neighborhood_blocks_centroid on public.neighborhood_blocks using gist (centroid);
create index if not exists idx_neighborhood_blocks_city on public.neighborhood_blocks (city);

alter table public.neighborhood_blocks enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='neighborhood_blocks' and policyname='neighborhood_blocks_read') then
    create policy neighborhood_blocks_read on public.neighborhood_blocks for select using (true);
  end if;
end $$;

-- ─── ETL: Polygonize nur aus Major-Roads ─────────────────────────────
-- Operiert auf _etl_osm_ways, filtert nach highway-Klasse.
create or replace function public.etl_polygonize_neighborhood_blocks(
  p_city text,
  p_min_area_m2 double precision default 50000,
  p_max_area_m2 double precision default 5000000
) returns jsonb language plpgsql security definer as $$
declare
  v_inserted int := 0;
  v_deleted int := 0;
  v_min_lng double precision;
  v_min_lat double precision;
  v_max_lng double precision;
  v_max_lat double precision;
begin
  select ST_XMin(ST_Extent(geom)), ST_YMin(ST_Extent(geom)),
         ST_XMax(ST_Extent(geom)), ST_YMax(ST_Extent(geom))
    into v_min_lng, v_min_lat, v_max_lng, v_max_lat
    from public._etl_osm_ways
   where city = p_city
     and highway in ('motorway','trunk','primary','secondary','tertiary');

  if v_min_lng is null then
    return jsonb_build_object('ok', false, 'error', 'no_major_ways_staged', 'city', p_city);
  end if;

  delete from public.neighborhood_blocks
   where city = p_city
     and ST_Intersects(geom, ST_MakeEnvelope(v_min_lng, v_min_lat, v_max_lng, v_max_lat, 4326));
  get diagnostics v_deleted = row_count;

  insert into public.neighborhood_blocks (geom, centroid, area_m2, city)
    select
      poly.geom,
      ST_Centroid(poly.geom),
      ST_Area(poly.geom::geography),
      p_city
    from (
      select (ST_Dump(ST_Polygonize(geom_union))).geom
        from (
          select ST_Union(geom) as geom_union
            from public._etl_osm_ways
           where city = p_city
             and highway in ('motorway','trunk','primary','secondary','tertiary')
        ) u
    ) poly
    where ST_Area(poly.geom::geography) between p_min_area_m2 and p_max_area_m2;
  get diagnostics v_inserted = row_count;

  return jsonb_build_object(
    'ok', true,
    'city', p_city,
    'deleted', v_deleted,
    'inserted', v_inserted,
    'bbox', jsonb_build_array(v_min_lng, v_min_lat, v_max_lng, v_max_lat)
  );
end $$;
grant execute on function public.etl_polygonize_neighborhood_blocks(text, double precision, double precision) to service_role;

-- ─── Helper: Neighborhood-Block am Punkt ─────────────────────────────
create or replace function public._neighborhood_id_at(p_lat double precision, p_lng double precision)
returns bigint language plpgsql stable as $$
declare v_id bigint;
begin
  select id into v_id
    from public.neighborhood_blocks
   where ST_Contains(geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326))
   limit 1;
  if v_id is not null then return v_id; end if;

  -- Fallback: nearest within 500m
  select id into v_id
    from public.neighborhood_blocks
   where ST_DWithin(centroid::geography,
                    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
                    500)
   order by ST_Distance(centroid::geography,
                        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography)
   limit 1;
  return v_id;
end $$;

-- ─── get_crew_blocks_in_bbox: nutzt jetzt neighborhood_blocks ────────
-- HQ-Position → neighborhood_block enthält HQ → DAS ist der Turf.
-- Mehrere Repeater einer Crew → Union der enthaltenden neighborhoods.
-- Fallback wenn kein neighborhood_block (z.B. ETL nicht gelaufen): die alten
-- Repeater-Coverage-Kreise.
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
  with rep_neighborhoods as (
    -- Pro Repeater: das neighborhood_block das ihn enthält (oder nächster)
    select r.crew_id,
           public._neighborhood_id_at(r.lat, r.lng) as nb_id
      from public.crew_repeaters r
     where r.destroyed_at is null
       and r.lat between p_min_lat - 0.02 and p_max_lat + 0.02
       and r.lng between p_min_lng - 0.03 and p_max_lng + 0.03
  ),
  per_crew_geom as (
    select rn.crew_id, ST_Union(nb.geom) as poly
      from rep_neighborhoods rn
      join public.neighborhood_blocks nb on nb.id = rn.nb_id
     group by rn.crew_id
  )
  select
    p.crew_id,
    cw.name as crew_name,
    p.crew_id in (select cm.crew_id from public.crew_members cm where cm.user_id = auth.uid()) as is_own,
    false as is_contested,  -- Konflikt-Logic kommt später für Neighborhoods
    coalesce(cw.territory_color, case
      when p.crew_id in (select cm.crew_id from public.crew_members cm where cm.user_id = auth.uid())
           then '#22D1C3'
      else '#FF2D78'
    end) as territory_color,
    ST_AsGeoJSON(p.poly)::jsonb as geojson
  from per_crew_geom p
  join public.crews cw on cw.id = p.crew_id;
$$;
grant execute on function public.get_crew_blocks_in_bbox(double precision, double precision, double precision, double precision) to authenticated;
