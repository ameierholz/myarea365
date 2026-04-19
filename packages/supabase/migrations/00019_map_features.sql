-- ═══════════════════════════════════════════════════════
-- Migration 00019: Map-Features (Power-Zones, Boss-Raids,
-- Sanctuaries, Shop-Reviews, Explored-Cells für Fog-of-War)
-- ═══════════════════════════════════════════════════════

-- ─── POWER-ZONES ─────────────────────────────────────────
-- Zonen mit passiven Guardian-Buffs (Park/Water/City/...)
create table if not exists public.power_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('park','water','city','forest','landmark')),
  center_lat double precision not null,
  center_lng double precision not null,
  radius_m int not null default 250,
  buff_hp int not null default 0,
  buff_atk int not null default 0,
  buff_def int not null default 0,
  buff_spd int not null default 0,
  color text not null default '#22D1C3',
  created_at timestamptz not null default now()
);

create index if not exists idx_power_zones_kind on public.power_zones(kind);
alter table public.power_zones enable row level security;
drop policy if exists "power_zones read" on public.power_zones;
create policy "power_zones read" on public.power_zones for select to authenticated, anon using (true);

-- ─── BOSS-RAIDS ──────────────────────────────────────────
create table if not exists public.boss_raids (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emoji text not null default '👹',
  lat double precision not null,
  lng double precision not null,
  max_hp int not null default 100000,
  current_hp int not null default 100000,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null default (now() + interval '48 hours'),
  reward_loot_rarity text not null default 'legendary',
  status text not null default 'active' check (status in ('scheduled','active','defeated','expired')),
  created_at timestamptz not null default now()
);

create table if not exists public.boss_raid_damage (
  id uuid primary key default gen_random_uuid(),
  raid_id uuid not null references public.boss_raids(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  damage int not null default 0,
  contributed_at timestamptz not null default now()
);

create index if not exists idx_boss_raid_damage_raid on public.boss_raid_damage(raid_id);
create index if not exists idx_boss_raid_damage_user on public.boss_raid_damage(user_id);

alter table public.boss_raids enable row level security;
alter table public.boss_raid_damage enable row level security;
drop policy if exists "boss_raids read" on public.boss_raids;
create policy "boss_raids read" on public.boss_raids for select to authenticated, anon using (true);
drop policy if exists "boss_raid_damage read own or all" on public.boss_raid_damage;
create policy "boss_raid_damage read own or all" on public.boss_raid_damage for select to authenticated using (true);

-- Damage-Contribute RPC
create or replace function public.contribute_boss_damage(p_raid_id uuid, p_damage int)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_raid record;
  v_new_hp int;
begin
  select * into v_raid from public.boss_raids where id = p_raid_id and status = 'active' for update;
  if v_raid is null then return jsonb_build_object('error','raid_not_active'); end if;
  v_new_hp := greatest(0, v_raid.current_hp - p_damage);
  update public.boss_raids set current_hp = v_new_hp,
    status = case when v_new_hp = 0 then 'defeated' else status end
    where id = p_raid_id;
  insert into public.boss_raid_damage(raid_id, user_id, damage)
    values (p_raid_id, auth.uid(), p_damage);
  return jsonb_build_object('ok', true, 'new_hp', v_new_hp, 'defeated', v_new_hp = 0);
end;
$$;
grant execute on function public.contribute_boss_damage(uuid, int) to authenticated;

-- ─── SANCTUARIES ─────────────────────────────────────────
-- POIs wo Runner ihren Wächter täglich trainieren können
create table if not exists public.sanctuaries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  lat double precision not null,
  lng double precision not null,
  emoji text not null default '⛩️',
  xp_reward int not null default 50,
  created_at timestamptz not null default now()
);

create table if not exists public.sanctuary_visits (
  id uuid primary key default gen_random_uuid(),
  sanctuary_id uuid not null references public.sanctuaries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  visited_at timestamptz not null default now(),
  unique (sanctuary_id, user_id, (date_trunc('day', visited_at)))
);

alter table public.sanctuaries enable row level security;
alter table public.sanctuary_visits enable row level security;
drop policy if exists "sanctuaries read" on public.sanctuaries;
create policy "sanctuaries read" on public.sanctuaries for select to authenticated, anon using (true);
drop policy if exists "sanctuary_visits read own" on public.sanctuary_visits;
create policy "sanctuary_visits read own" on public.sanctuary_visits for select to authenticated
  using (user_id = auth.uid());

-- Training-RPC (einmal pro Tag pro Sanctuary)
create or replace function public.train_at_sanctuary(p_sanctuary_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare v_xp int; v_today date := current_date;
begin
  if exists (select 1 from public.sanctuary_visits
             where sanctuary_id = p_sanctuary_id and user_id = auth.uid()
             and date_trunc('day', visited_at) = v_today) then
    return jsonb_build_object('error','already_trained_today');
  end if;
  select xp_reward into v_xp from public.sanctuaries where id = p_sanctuary_id;
  if v_xp is null then return jsonb_build_object('error','sanctuary_not_found'); end if;
  insert into public.sanctuary_visits(sanctuary_id, user_id) values (p_sanctuary_id, auth.uid());
  -- XP auf User-Wächter
  update public.user_guardians set xp = xp + v_xp
    where user_id = auth.uid() and is_active = true;
  return jsonb_build_object('ok', true, 'xp_gained', v_xp);
end;
$$;
grant execute on function public.train_at_sanctuary(uuid) to authenticated;

-- ─── SHOP-REVIEWS ────────────────────────────────────────
create table if not exists public.shop_reviews (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.local_businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);

alter table public.shop_reviews enable row level security;
drop policy if exists "shop_reviews read" on public.shop_reviews;
create policy "shop_reviews read" on public.shop_reviews for select to authenticated, anon using (true);
drop policy if exists "shop_reviews write own" on public.shop_reviews;
create policy "shop_reviews write own" on public.shop_reviews for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Aggregated Rating View
create or replace view public.shop_reviews_agg as
  select business_id, round(avg(rating)::numeric, 1) as avg_rating, count(*) as review_count
  from public.shop_reviews group by business_id;
grant select on public.shop_reviews_agg to authenticated, anon;

-- ─── EXPLORED CELLS (Fog-of-War) ─────────────────────────
-- Grid-Cells (ca. 80m × 80m) die der User abgegangen hat
create table if not exists public.explored_cells (
  user_id uuid not null references auth.users(id) on delete cascade,
  cell_x int not null,   -- floor(lng * 1000)
  cell_y int not null,   -- floor(lat * 1000)
  first_seen timestamptz not null default now(),
  primary key (user_id, cell_x, cell_y)
);

create index if not exists idx_explored_cells_user on public.explored_cells(user_id);
alter table public.explored_cells enable row level security;
drop policy if exists "explored_cells read own" on public.explored_cells;
create policy "explored_cells read own" on public.explored_cells for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "explored_cells write own" on public.explored_cells;
create policy "explored_cells write own" on public.explored_cells for insert to authenticated
  with check (user_id = auth.uid());

-- Batch-Insert RPC (effizienter als einzelne Inserts)
create or replace function public.mark_cells_explored(p_cells jsonb)
returns int
language plpgsql
security definer
as $$
declare
  v_count int := 0;
  v_cell jsonb;
begin
  for v_cell in select value from jsonb_array_elements(p_cells) loop
    insert into public.explored_cells(user_id, cell_x, cell_y)
      values (auth.uid(), (v_cell->>'x')::int, (v_cell->>'y')::int)
      on conflict do nothing;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
grant execute on function public.mark_cells_explored(jsonb) to authenticated;

-- ─── DEMO SEEDS ──────────────────────────────────────────
-- Ein paar Power-Zones in Berlin-Senftenberg/Prenzlberg Area
insert into public.power_zones(name, kind, center_lat, center_lng, radius_m, buff_hp, buff_atk, buff_def, buff_spd, color)
values
  ('Volkspark Senftenberg',  'park',     52.5435, 13.5670, 280, 15, 0, 5, 0, '#4ade80'),
  ('Stadtkern Marzahn',      'city',     52.5420, 13.5590, 220,  0,12, 0, 3, '#FF6B4A'),
  ('Wuhle-Wasser',           'water',    52.5445, 13.5720, 200, 10, 0,10, 0, '#5ddaf0'),
  ('Märchenbrunnen-Landmark','landmark', 52.5300, 13.4450, 180,  5, 5, 5, 5, '#FFD700')
on conflict do nothing;

-- Boss-Raid an Fernsehturm
insert into public.boss_raids(name, emoji, lat, lng, max_hp, current_hp, reward_loot_rarity, status)
values ('Schattenwächter des Alex', '👹', 52.5208, 13.4094, 250000, 187500, 'legendary', 'active')
on conflict do nothing;

-- Sanctuaries
insert into public.sanctuaries(name, lat, lng, emoji, xp_reward)
values
  ('Tempel am Senftenberger Ring', 52.5430, 13.5640, '⛩️', 50),
  ('Ostsee-Altar',                 52.5395, 13.5705, '🏛️', 50)
on conflict do nothing;
