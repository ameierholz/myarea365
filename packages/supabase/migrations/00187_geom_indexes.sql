-- ══════════════════════════════════════════════════════════════════════════
-- PostGIS-Indizes für Map-BBox-Queries: bases, crew_bases, strongholds
-- bekommen eine generierte geometry-Spalte + GiST-Index. RPCs können dann
-- ST_MakeEnvelope(...) && geom nutzen statt lat BETWEEN x AND y.
-- ══════════════════════════════════════════════════════════════════════════

-- Sicherstellen, dass PostGIS aktiv ist (sollte sein)
create extension if not exists postgis;

-- ─── bases ──────────────────────────────────────────────────────────────
alter table public.bases
  add column if not exists geom geometry(point, 4326)
  generated always as (
    case when lat is not null and lng is not null
      then st_setsrid(st_makepoint(lng, lat), 4326)
      else null end
  ) stored;
create index if not exists idx_bases_geom on public.bases using gist(geom);

-- ─── crew_bases ─────────────────────────────────────────────────────────
alter table public.crew_bases
  add column if not exists geom geometry(point, 4326)
  generated always as (
    case when lat is not null and lng is not null
      then st_setsrid(st_makepoint(lng, lat), 4326)
      else null end
  ) stored;
create index if not exists idx_crew_bases_geom on public.crew_bases using gist(geom);

-- ─── strongholds ────────────────────────────────────────────────────────
alter table public.strongholds
  add column if not exists geom geometry(point, 4326)
  generated always as (
    case when lat is not null and lng is not null
      then st_setsrid(st_makepoint(lng, lat), 4326)
      else null end
  ) stored;
create index if not exists idx_strongholds_geom on public.strongholds using gist(geom);
