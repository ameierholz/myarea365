-- Phase 1 des 3-Ebenen-Modells:
--   Strassenabschnitt (street_segments)  — einzelnes OSM-Way-Segment
--   Strassenzug       (streets_claimed)  — alle Segmente einer Strasse gelaufen
--   Territorium       (territory_polygons) — geschlossenes Polygon aus Segmenten
--
-- Die bestehende `territories`-Tabelle bleibt als "walks" bestehen (jede Row = 1 Lauf).
-- Neue Spalten zaehlen, was der Lauf im neuen Modell produziert hat.

create extension if not exists pgcrypto;

-- Walks / Laeufe bekommen Zaehler-Spalten
alter table public.territories
  add column if not exists segments_claimed int not null default 0,
  add column if not exists streets_claimed int not null default 0,
  add column if not exists polygons_claimed int not null default 0;

-- 1) Strassenabschnitte
create table if not exists public.street_segments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  crew_id uuid references public.crews(id) on delete set null,
  osm_way_id bigint not null,
  segment_index int not null default 0,
  street_name text,
  geom jsonb not null,
  length_m int not null,
  walk_id uuid references public.territories(id) on delete set null,
  xp_awarded int not null default 50,
  created_at timestamptz not null default now(),
  unique (user_id, osm_way_id, segment_index)
);

create index if not exists idx_street_segments_user on public.street_segments(user_id);
create index if not exists idx_street_segments_crew on public.street_segments(crew_id);
create index if not exists idx_street_segments_street on public.street_segments(user_id, street_name);

-- 2) Strassenzuege (wenn alle Segmente einer Strasse einmal gelaufen sind)
create table if not exists public.streets_claimed (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  crew_id uuid references public.crews(id) on delete set null,
  street_name text not null,
  segments_count int not null,
  total_length_m int not null,
  walk_id uuid references public.territories(id) on delete set null,
  xp_awarded int not null default 250,
  created_at timestamptz not null default now(),
  unique (user_id, street_name)
);

create index if not exists idx_streets_claimed_user on public.streets_claimed(user_id);
create index if not exists idx_streets_claimed_crew on public.streets_claimed(crew_id);

-- 3) Territorien (geschlossene Polygone). Crew-Besitz wenn crew_id gesetzt.
create table if not exists public.territory_polygons (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references public.users(id) on delete set null,
  owner_crew_id uuid references public.crews(id) on delete set null,
  polygon jsonb not null,
  area_m2 numeric,
  segment_ids uuid[] not null default '{}',
  walk_id uuid references public.territories(id) on delete set null,
  claimed_by_user_id uuid not null references public.users(id) on delete cascade,
  xp_awarded int not null default 500,
  created_at timestamptz not null default now()
);

create index if not exists idx_territory_polygons_user on public.territory_polygons(owner_user_id);
create index if not exists idx_territory_polygons_crew on public.territory_polygons(owner_crew_id);

-- RLS
alter table public.street_segments     enable row level security;
alter table public.streets_claimed     enable row level security;
alter table public.territory_polygons  enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'street_segments' and policyname = 'select_own') then
    create policy select_own on public.street_segments for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'street_segments' and policyname = 'insert_own') then
    create policy insert_own on public.street_segments for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'streets_claimed' and policyname = 'select_own') then
    create policy select_own on public.streets_claimed for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'streets_claimed' and policyname = 'insert_own') then
    create policy insert_own on public.streets_claimed for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'territory_polygons' and policyname = 'select_public') then
    create policy select_public on public.territory_polygons for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'territory_polygons' and policyname = 'insert_own') then
    create policy insert_own on public.territory_polygons for insert with check (auth.uid() = claimed_by_user_id);
  end if;
end $$;
