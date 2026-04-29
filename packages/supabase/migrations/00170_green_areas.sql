-- ══════════════════════════════════════════════════════════════════════════
-- Green-Areas — Parks, Wälder, Wiesen, Spielplätze etc. aus OSM
-- Wegelager (PvE Strongholds) spawnen nur auf solchen Flächen.
-- ══════════════════════════════════════════════════════════════════════════

create extension if not exists postgis;

create table if not exists public.green_areas (
  id          bigserial primary key,
  osm_id      bigint,
  name        text,
  kind        text not null,    -- 'park' | 'forest' | 'meadow' | 'recreation' | 'cemetery' | 'wood' | 'grassland'
  city        text,
  geom        geometry(Polygon, 4326) not null,
  area_sqm    double precision generated always as (st_area(geom::geography)) stored,
  created_at  timestamptz default now()
);

create index if not exists green_areas_geom_idx on public.green_areas using gist (geom);
create index if not exists green_areas_city_idx on public.green_areas (city);
create index if not exists green_areas_kind_idx on public.green_areas (kind);

alter table public.green_areas enable row level security;

drop policy if exists "green_areas_read_all" on public.green_areas;
create policy "green_areas_read_all" on public.green_areas
  for select using (true);
