-- ══════════════════════════════════════════════════════════════════════════
-- Monetization-Deals: 7 Kategorien (Saisonal, Schwellen, Themen, Edelsteine,
-- Tagesangebote, Battle Pass, Abos)
-- ══════════════════════════════════════════════════════════════════════════

-- ── 1. Saisonales Pack (1 aktives, rotiert wöchentlich) ─────────────────
create table if not exists public.monetization_seasonal_packs (
  id           text primary key,
  title        text not null,
  subtitle     text,
  description  text,
  hero_image   text,         -- artwork URL
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  price_cents  int  not null,
  bonus_gems   int  default 0,
  rewards      jsonb not null default '[]'::jsonb,
  -- Beispiel: [{"kind":"gem","qty":1250},{"kind":"egg","tier":"epic","qty":1},{"kind":"speedup_60","qty":16}]
  active       boolean default true,
  created_at   timestamptz default now()
);

-- ── 2. Edelstein-Schwellen (Cashback-Ladder pro Woche) ──────────────────
create table if not exists public.monetization_gem_thresholds (
  id            text primary key,
  threshold     int not null,    -- 2400, 4800, 8000, 12000, 16000
  reward_label  text not null,
  rewards       jsonb not null default '[]'::jsonb,
  sort          int default 0
);

-- Per-User-Tracking welche Schwellen pro Woche schon eingelöst sind
create table if not exists public.monetization_gem_threshold_progress (
  user_id       uuid references auth.users(id) on delete cascade,
  week_iso      text not null,           -- '2026-W18'
  gems_purchased int default 0,
  thresholds_claimed int[] default '{}',
  primary key (user_id, week_iso)
);

-- ── 3. Themen-Pakete (immer verfügbar, 1×/Tag pro User) ─────────────────
create table if not exists public.monetization_themed_packs (
  id            text primary key,
  theme         text not null,        -- 'explorer' | 'warrior' | 'wisdom'
  title         text not null,
  description   text,
  hero_image    text,
  price_cents   int not null,
  bonus_gems    int default 0,
  daily_limit   int default 1,
  rewards       jsonb not null default '[]'::jsonb,
  sort          int default 0,
  active        boolean default true
);

create table if not exists public.monetization_themed_pack_purchases (
  id            bigserial primary key,
  user_id       uuid references auth.users(id) on delete cascade,
  pack_id       text references public.monetization_themed_packs(id),
  purchased_at  timestamptz default now()
);
create index if not exists themed_pack_purchases_user_day on public.monetization_themed_pack_purchases (user_id, purchased_at);

-- ── 4. Edelstein-Wert-Stufen (6 Tiers mit Bonus-Goodies) ────────────────
create table if not exists public.monetization_gem_tiers (
  id            text primary key,
  price_cents   int not null,
  base_gems     int not null,
  bonus_gems    int default 0,        -- "+5%", "+10%" etc als absolute Zahl
  badge_label   text,                  -- '+5% First-Time' | 'Most Popular'
  hero_image    text,
  bonus_rewards jsonb default '[]'::jsonb,  -- extra Goodies on top der Edelsteine
  sort          int default 0,
  active        boolean default true
);

-- ── 5. Tagesangebote (rotieren täglich um 00:00 UTC) ────────────────────
create table if not exists public.monetization_daily_deals (
  id            bigserial primary key,
  deal_date     date not null,
  slot          int not null,         -- 1..5 (max 5 Deals pro Tag)
  title         text not null,
  description   text,
  hero_image    text,
  price_cents   int not null,
  rewards       jsonb not null default '[]'::jsonb,
  unique (deal_date, slot)
);

create table if not exists public.monetization_daily_deal_purchases (
  user_id       uuid references auth.users(id) on delete cascade,
  deal_id       bigint references public.monetization_daily_deals(id) on delete cascade,
  purchased_at  timestamptz default now(),
  primary key (user_id, deal_id)
);

-- ── 6. Battle Pass (saisonal, alle 4 Wochen) ────────────────────────────
create table if not exists public.monetization_battle_pass_seasons (
  id            text primary key,     -- 'season_2026_05'
  title         text not null,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  price_premium_cents      int default 499,
  price_premium_plus_cents int default 1499,
  active        boolean default true
);

create table if not exists public.monetization_battle_pass_levels (
  season_id     text references public.monetization_battle_pass_seasons(id) on delete cascade,
  level         int not null,         -- 1..50
  xp_required   int not null,
  reward_free       jsonb,            -- Belohnung Free-Track
  reward_premium    jsonb,            -- Belohnung Premium-Track
  reward_plus       jsonb,            -- Belohnung Premium-Plus-Track
  primary key (season_id, level)
);

create table if not exists public.monetization_battle_pass_progress (
  user_id       uuid references auth.users(id) on delete cascade,
  season_id     text references public.monetization_battle_pass_seasons(id) on delete cascade,
  xp            int default 0,
  tier          text default 'free',  -- 'free' | 'premium' | 'plus'
  claimed_levels_free    int[] default '{}',
  claimed_levels_premium int[] default '{}',
  claimed_levels_plus    int[] default '{}',
  primary key (user_id, season_id)
);

-- ── 7. Monats-Abos ──────────────────────────────────────────────────────
create table if not exists public.monetization_subscriptions (
  id              text primary key,        -- 'wanderer' | 'pfadfinder' | 'stadtmeister'
  title           text not null,
  description     text,
  price_cents_monthly int not null,
  hero_image      text,
  daily_gems      int default 0,
  perks           jsonb not null default '[]'::jsonb,
  -- Beispiel: ["adfree","xp_boost_2x","extra_marker_slots"]
  sort            int default 0,
  active          boolean default true,
  stripe_price_id text
);

create table if not exists public.monetization_subscription_status (
  user_id           uuid references auth.users(id) on delete cascade,
  subscription_id   text references public.monetization_subscriptions(id),
  active            boolean default true,
  started_at        timestamptz default now(),
  expires_at        timestamptz,
  stripe_subscription_id text,
  cancel_at_period_end boolean default false,
  primary key (user_id)
);

-- ── RLS — alles read-only public, Schreibzugriff via Service-Role ──────
alter table public.monetization_seasonal_packs enable row level security;
alter table public.monetization_gem_thresholds enable row level security;
alter table public.monetization_themed_packs enable row level security;
alter table public.monetization_gem_tiers enable row level security;
alter table public.monetization_daily_deals enable row level security;
alter table public.monetization_battle_pass_seasons enable row level security;
alter table public.monetization_battle_pass_levels enable row level security;
alter table public.monetization_subscriptions enable row level security;
alter table public.monetization_gem_threshold_progress enable row level security;
alter table public.monetization_themed_pack_purchases enable row level security;
alter table public.monetization_daily_deal_purchases enable row level security;
alter table public.monetization_battle_pass_progress enable row level security;
alter table public.monetization_subscription_status enable row level security;

drop policy if exists "monet_read_all" on public.monetization_seasonal_packs;
create policy "monet_read_all" on public.monetization_seasonal_packs for select using (true);
drop policy if exists "monet_read_all" on public.monetization_gem_thresholds;
create policy "monet_read_all" on public.monetization_gem_thresholds for select using (true);
drop policy if exists "monet_read_all" on public.monetization_themed_packs;
create policy "monet_read_all" on public.monetization_themed_packs for select using (true);
drop policy if exists "monet_read_all" on public.monetization_gem_tiers;
create policy "monet_read_all" on public.monetization_gem_tiers for select using (true);
drop policy if exists "monet_read_all" on public.monetization_daily_deals;
create policy "monet_read_all" on public.monetization_daily_deals for select using (true);
drop policy if exists "monet_read_all" on public.monetization_battle_pass_seasons;
create policy "monet_read_all" on public.monetization_battle_pass_seasons for select using (true);
drop policy if exists "monet_read_all" on public.monetization_battle_pass_levels;
create policy "monet_read_all" on public.monetization_battle_pass_levels for select using (true);
drop policy if exists "monet_read_all" on public.monetization_subscriptions;
create policy "monet_read_all" on public.monetization_subscriptions for select using (true);

drop policy if exists "monet_user_read_own_progress" on public.monetization_gem_threshold_progress;
create policy "monet_user_read_own_progress" on public.monetization_gem_threshold_progress for select using (auth.uid() = user_id);
drop policy if exists "monet_user_read_own_themed" on public.monetization_themed_pack_purchases;
create policy "monet_user_read_own_themed" on public.monetization_themed_pack_purchases for select using (auth.uid() = user_id);
drop policy if exists "monet_user_read_own_daily" on public.monetization_daily_deal_purchases;
create policy "monet_user_read_own_daily" on public.monetization_daily_deal_purchases for select using (auth.uid() = user_id);
drop policy if exists "monet_user_read_own_bp" on public.monetization_battle_pass_progress;
create policy "monet_user_read_own_bp" on public.monetization_battle_pass_progress for select using (auth.uid() = user_id);
drop policy if exists "monet_user_read_own_sub" on public.monetization_subscription_status;
create policy "monet_user_read_own_sub" on public.monetization_subscription_status for select using (auth.uid() = user_id);
