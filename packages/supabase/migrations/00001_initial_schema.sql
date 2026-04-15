-- MyArea365 Initial Schema
-- Gamifizierte Geh- und Lauf-Community

-- ============================================================
-- Extensions
-- ============================================================
create extension if not exists "postgis";
create extension if not exists "uuid-ossp";

-- ============================================================
-- Users
-- ============================================================
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  bio text,
  xp bigint not null default 0,
  level int not null default 1,
  total_distance_m bigint not null default 0,
  total_walks int not null default 0,
  streak_days int not null default 0,
  streak_best int not null default 0,
  last_walk_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "Users can read all profiles"
  on public.users for select using (true);

create policy "Users can update own profile"
  on public.users for update using (auth.uid() = id);

-- ============================================================
-- Groups (Teams)
-- ============================================================
create table public.groups (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  description text,
  avatar_url text,
  owner_id uuid not null references public.users(id) on delete cascade,
  total_xp bigint not null default 0,
  member_count int not null default 1,
  created_at timestamptz not null default now()
);

alter table public.groups enable row level security;

create policy "Groups are publicly readable"
  on public.groups for select using (true);

create policy "Owner can update group"
  on public.groups for update using (auth.uid() = owner_id);

create policy "Authenticated users can create groups"
  on public.groups for insert with check (auth.uid() = owner_id);

-- ============================================================
-- Group Members
-- ============================================================
create type public.group_role as enum ('owner', 'admin', 'member');

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role public.group_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

alter table public.group_members enable row level security;

create policy "Members are publicly readable"
  on public.group_members for select using (true);

create policy "Users can join groups"
  on public.group_members for insert with check (auth.uid() = user_id);

create policy "Users can leave groups"
  on public.group_members for delete using (auth.uid() = user_id);

-- ============================================================
-- Areas (Straßenzüge / Gebiete)
-- ============================================================
create table public.areas (
  id uuid primary key default uuid_generate_v4(),
  osm_way_id bigint unique,
  name text,
  geometry geometry(LineString, 4326) not null,
  length_m double precision not null default 0,
  city text,
  district text,
  created_at timestamptz not null default now()
);

alter table public.areas enable row level security;

create policy "Areas are publicly readable"
  on public.areas for select using (true);

create index areas_geometry_idx on public.areas using gist(geometry);
create index areas_city_idx on public.areas(city);

-- ============================================================
-- Area Claims (Eroberungen)
-- ============================================================
create table public.area_claims (
  id uuid primary key default uuid_generate_v4(),
  area_id uuid not null references public.areas(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  group_id uuid references public.groups(id) on delete set null,
  claimed_at timestamptz not null default now(),
  xp_earned int not null default 0,
  unique (area_id, user_id)
);

alter table public.area_claims enable row level security;

create policy "Claims are publicly readable"
  on public.area_claims for select using (true);

create policy "Users can claim areas"
  on public.area_claims for insert with check (auth.uid() = user_id);

-- ============================================================
-- Walks (Spaziergänge / Läufe)
-- ============================================================
create table public.walks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  distance_m int not null default 0,
  duration_s int not null default 0,
  route geometry(LineString, 4326),
  areas_claimed int not null default 0,
  xp_earned int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.walks enable row level security;

create policy "Users can read own walks"
  on public.walks for select using (auth.uid() = user_id);

create policy "Users can insert own walks"
  on public.walks for insert with check (auth.uid() = user_id);

create index walks_user_id_idx on public.walks(user_id);

-- ============================================================
-- Achievements
-- ============================================================
create table public.achievements (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  name text not null,
  description text not null,
  icon text,
  xp_reward int not null default 0,
  condition jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.achievements enable row level security;

create policy "Achievements are publicly readable"
  on public.achievements for select using (true);

-- ============================================================
-- User Achievements
-- ============================================================
create table public.user_achievements (
  user_id uuid not null references public.users(id) on delete cascade,
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

alter table public.user_achievements enable row level security;

create policy "User achievements are publicly readable"
  on public.user_achievements for select using (true);

create policy "System can grant achievements"
  on public.user_achievements for insert with check (auth.uid() = user_id);

-- ============================================================
-- Local Businesses (Lokale Geschäfte)
-- ============================================================
create type public.business_tier as enum ('free', 'basic', 'premium');

create table public.local_businesses (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references public.users(id) on delete set null,
  name text not null,
  slug text unique not null,
  description text,
  category text,
  address text,
  location geometry(Point, 4326),
  logo_url text,
  website text,
  tier public.business_tier not null default 'free',
  discount_percent int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.local_businesses enable row level security;

create policy "Active businesses are publicly readable"
  on public.local_businesses for select using (active = true);

create policy "Owner can update business"
  on public.local_businesses for update using (auth.uid() = owner_id);

create index local_businesses_location_idx on public.local_businesses using gist(location);

-- ============================================================
-- QR Codes
-- ============================================================
create table public.qr_codes (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.local_businesses(id) on delete cascade,
  code text unique not null,
  discount_percent int not null default 0,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  max_uses int,
  used_count int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.qr_codes enable row level security;

create policy "Active QR codes are publicly readable"
  on public.qr_codes for select using (active = true);

-- ============================================================
-- XP Transactions
-- ============================================================
create type public.xp_source as enum ('walk', 'claim', 'achievement', 'qr_scan', 'group_bonus', 'streak');

create table public.xp_transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  amount int not null,
  source public.xp_source not null,
  reference_id uuid,
  description text,
  created_at timestamptz not null default now()
);

alter table public.xp_transactions enable row level security;

create policy "Users can read own XP transactions"
  on public.xp_transactions for select using (auth.uid() = user_id);

create index xp_transactions_user_id_idx on public.xp_transactions(user_id);

-- ============================================================
-- Map Icons (Kaufbare Icons via XP)
-- ============================================================
create table public.map_icons (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  name text not null,
  icon_url text not null,
  xp_cost int not null default 0,
  description text,
  created_at timestamptz not null default now()
);

alter table public.map_icons enable row level security;

create policy "Map icons are publicly readable"
  on public.map_icons for select using (true);

-- ============================================================
-- Updated-at trigger function
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger users_updated_at
  before update on public.users
  for each row execute function public.handle_updated_at();

create trigger local_businesses_updated_at
  before update on public.local_businesses
  for each row execute function public.handle_updated_at();
