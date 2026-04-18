alter table public.local_businesses
  add column if not exists plan text default 'free' check (plan in ('free','basis','pro','ultra')),
  add column if not exists plan_expires_at timestamptz,
  add column if not exists spotlight_until timestamptz,
  add column if not exists radius_boost_until timestamptz,
  add column if not exists top_listing_until timestamptz,
  add column if not exists banner_until timestamptz,
  add column if not exists custom_pin_url text,
  add column if not exists social_pro_until timestamptz,
  add column if not exists analytics_pro_until timestamptz,
  add column if not exists flash_push_credits int default 0,
  add column if not exists email_campaign_credits int default 0,
  add column if not exists event_host_credits int default 0,
  add column if not exists challenge_sponsor_credits int default 0,
  add column if not exists qr_print_ordered_at timestamptz,
  add column if not exists kiez_report_last timestamptz,
  add column if not exists competitor_analysis_until timestamptz,
  add column if not exists total_checkins int default 0,
  add column if not exists total_redemptions int default 0;

create table if not exists public.shop_billing_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.local_businesses(id) on delete cascade,
  event_type text not null check (event_type in ('checkin','redemption')),
  amount_cents int not null default 0,
  user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  billed boolean default false
);
alter table public.shop_billing_events enable row level security;
drop policy if exists sbe_read on public.shop_billing_events;
create policy sbe_read on public.shop_billing_events for select using (true);
