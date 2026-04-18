-- Monetarisierung: Premium-Tiers, Crew-Plans, Käufe, Ad-Rewards, Streak-Freeze

-- 1. Runner-Premium
alter table public.users
  add column if not exists premium_tier text not null default 'free' check (premium_tier in ('free','plus','lifetime')),
  add column if not exists premium_expires_at timestamptz,
  add column if not exists streak_freezes_remaining int default 0,
  add column if not exists xp_boost_until timestamptz,
  add column if not exists xp_boost_multiplier numeric(3,1) default 1.0,
  add column if not exists profile_theme text default 'classic',
  add column if not exists custom_marker_color text;

-- 2. Crew-Plans
alter table public.crews
  add column if not exists plan text not null default 'free' check (plan in ('free','pro')),
  add column if not exists plan_expires_at timestamptz,
  add column if not exists custom_banner_url text,
  add column if not exists custom_logo_url text;

-- 3. Einmalige Käufe (XP-Boosts, Merch, Crew-Slots)
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  crew_id uuid references public.crews(id) on delete cascade,
  product_sku text not null,
  product_name text not null,
  amount_cents int not null,
  currency text not null default 'EUR',
  status text not null default 'pending' check (status in ('pending','completed','refunded','failed')),
  stripe_session_id text,
  stripe_payment_id text,
  applied_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists purchases_user_idx on public.purchases(user_id, created_at desc);
alter table public.purchases enable row level security;

drop policy if exists purchases_own_select on public.purchases;
create policy purchases_own_select on public.purchases for select using (user_id = auth.uid() or public.is_staff());
drop policy if exists purchases_own_insert on public.purchases;
create policy purchases_own_insert on public.purchases for insert with check (user_id = auth.uid());

-- 4. Rewarded-Ad-Views (Anti-Abuse via Cooldown)
create table if not exists public.ad_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  placement text not null check (placement in ('post_walk','boost_24h','double_xp','streak_save')),
  xp_awarded int default 0,
  completed boolean default false,
  created_at timestamptz default now()
);
create index if not exists ad_views_user_idx on public.ad_views(user_id, created_at desc);
alter table public.ad_views enable row level security;

drop policy if exists ad_views_own on public.ad_views;
create policy ad_views_own on public.ad_views for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 5. Crew-Schatz (gemeinsamer XP-Topf)
alter table public.crews
  add column if not exists treasure_xp bigint default 0;

-- 6. Feature-Flag-Helper: Premium aktiv?
create or replace function public.is_premium(uid uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.users
     where id = uid
       and (premium_tier = 'lifetime'
            or (premium_tier = 'plus' and coalesce(premium_expires_at, now()) > now()))
  );
$$;
