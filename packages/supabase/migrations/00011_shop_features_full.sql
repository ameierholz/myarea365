create table if not exists public.shop_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.local_businesses(id) on delete cascade,
  title text not null,
  description text,
  starts_at timestamptz not null,
  duration_min int default 90,
  lat numeric, lng numeric,
  max_participants int default 50,
  status text not null default 'scheduled' check (status in ('scheduled','live','finished','cancelled')),
  created_at timestamptz not null default now()
);
create table if not exists public.shop_event_participants (
  event_id uuid references public.shop_events(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table if not exists public.shop_challenges (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.local_businesses(id) on delete cascade,
  title text not null, description text,
  target_type text not null check (target_type in ('first_5k','ten_territories','weekly_km','streak_7d')),
  reward_text text not null,
  zip text, ends_at timestamptz,
  status text not null default 'active' check (status in ('active','finished','cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.shop_push_messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.local_businesses(id) on delete cascade,
  title text not null, body text not null, deal_text text,
  lat numeric, lng numeric, radius_m int default 1000,
  expires_at timestamptz not null, created_at timestamptz not null default now()
);

create table if not exists public.shop_marketing_assets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.local_businesses(id) on delete cascade,
  kind text not null check (kind in ('ig_post','ig_story','tiktok_cover','qr_order','email_campaign','kiez_report')),
  title text, payload jsonb, status text default 'ready',
  created_at timestamptz not null default now()
);

alter table public.shop_events enable row level security;
alter table public.shop_event_participants enable row level security;
alter table public.shop_challenges enable row level security;
alter table public.shop_push_messages enable row level security;
alter table public.shop_marketing_assets enable row level security;
create policy se_read on public.shop_events for select using (true);
create policy sep_read on public.shop_event_participants for select using (true);
create policy sep_self on public.shop_event_participants for insert to authenticated with check (user_id = auth.uid());
create policy sc_read on public.shop_challenges for select using (true);
create policy spm_read on public.shop_push_messages for select using (expires_at > now());
create policy sma_read on public.shop_marketing_assets for select using (true);
