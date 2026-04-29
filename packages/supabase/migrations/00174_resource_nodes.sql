-- ══════════════════════════════════════════════════════════════════════════
-- Resource-Nodes — RoK/CoD-Style Sammelpunkte auf der Karte
-- 4 Typen, gemappt auf reale OSM-POIs:
--   scrapyard  → Tech-Schrott (industrial=scrap, landuse=industrial)
--   factory    → Komponenten  (man_made=works, building=industrial)
--   atm        → Krypto       (amenity=atm, amenity=bank)
--   datacenter → Bandbreite   (building=data_center, telecommunication=*)
-- ══════════════════════════════════════════════════════════════════════════

create extension if not exists postgis;

create table if not exists public.resource_nodes (
  id            bigserial primary key,
  osm_id        bigint,
  city          text,
  kind          text not null,           -- 'scrapyard' | 'factory' | 'atm' | 'datacenter'
  resource_type text not null,           -- 'wood' | 'stone' | 'gold' | 'mana'
  name          text,
  lat           double precision not null,
  lng           double precision not null,
  geom          geometry(Point, 4326) generated always as (st_setsrid(st_makepoint(lng, lat), 4326)) stored,
  level         int default 1,           -- 1..10, höhere Levels = mehr Yield + längere Sammeldauer
  total_yield   bigint not null,         -- Gesamt-Resource-Menge (level-abhängig)
  current_yield bigint not null,         -- verbleibend
  spawned_at    timestamptz default now(),
  depleted_at   timestamptz,             -- gesetzt wenn current_yield = 0
  respawn_at    timestamptz,             -- nach 24-48h respawn
  created_at    timestamptz default now()
);

create index if not exists resource_nodes_geom_idx on public.resource_nodes using gist (geom);
create index if not exists resource_nodes_city_idx on public.resource_nodes (city);
create index if not exists resource_nodes_active_idx on public.resource_nodes (depleted_at) where depleted_at is null;

-- ── Sammel-Märsche (welche Crew-Wächter sammeln aktuell wo) ────────────
create table if not exists public.gather_marches (
  id            bigserial primary key,
  user_id       uuid references auth.users(id) on delete cascade,
  node_id       bigint references public.resource_nodes(id) on delete cascade,
  guardian_id   uuid,                    -- Sammel-Wächter (gather-class guardian)
  troop_count   int  not null default 100,
  troop_class   text default 'gatherer', -- 'gatherer' | 'infantry' (gemischte Squads später)
  started_at    timestamptz default now(),
  arrives_at    timestamptz not null,    -- start + walk-time
  finishes_at   timestamptz not null,    -- arrival + gather-time
  returns_at    timestamptz not null,    -- finish + walk-back-time
  status        text default 'marching', -- 'marching' | 'gathering' | 'returning' | 'completed' | 'cancelled'
  collected     bigint default 0,        -- gesammelt bis jetzt (für aktive Märsche)
  completed_at  timestamptz
);

create index if not exists gather_marches_user_active on public.gather_marches (user_id, status) where status in ('marching','gathering','returning');
create index if not exists gather_marches_node on public.gather_marches (node_id) where status in ('marching','gathering');

-- ── RLS ─────────────────────────────────────────────────────────────────
alter table public.resource_nodes enable row level security;
alter table public.gather_marches enable row level security;

drop policy if exists "resource_nodes_read_all" on public.resource_nodes;
create policy "resource_nodes_read_all" on public.resource_nodes for select using (true);

drop policy if exists "gather_marches_user_own" on public.gather_marches;
create policy "gather_marches_user_own" on public.gather_marches for select using (auth.uid() = user_id);

-- ── Helper: Yield pro Node-Level (level 1 = 1k, level 10 = 50k) ────────
create or replace function public.resource_node_yield_for_level(p_level int)
returns bigint language sql immutable as $$
  select greatest(1000, (1000 * p_level * (p_level + 1) / 2))::bigint;
$$;
