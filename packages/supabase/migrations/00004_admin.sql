-- Admin-Infrastruktur: Rollen, Audit-Log, Marketing-Kampagnen, Leads, Feature-Flags, Shop-Abos

-- 1. Rollen
do $$ begin
  create type public.user_role as enum ('user', 'support', 'marketing', 'sales', 'admin', 'super_admin');
exception when duplicate_object then null; end $$;

alter table public.users
  add column if not exists role public.user_role not null default 'user',
  add column if not exists is_banned boolean default false,
  add column if not exists banned_reason text,
  add column if not exists shadow_banned boolean default false,
  add column if not exists admin_notes text;

create index if not exists users_role_idx on public.users(role) where role <> 'user';

-- 2. Audit-Log
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.users(id) on delete set null,
  actor_role public.user_role,
  action text not null,
  target_type text,
  target_id text,
  details jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz default now()
);
create index if not exists admin_audit_actor_idx on public.admin_audit_log(actor_id, created_at desc);
create index if not exists admin_audit_target_idx on public.admin_audit_log(target_type, target_id);

-- 3. Marketing-Kampagnen
create table if not exists public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  template text not null default 'newsletter-monthly',
  body_html text,
  segment_query text,
  segment_name text,
  status text not null default 'draft' check (status in ('draft','scheduled','sending','sent','failed','cancelled')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  recipient_count int default 0,
  opened_count int default 0,
  clicked_count int default 0,
  bounced_count int default 0,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz default now()
);

-- 4. Segmente (vordefiniert)
create table if not exists public.user_segments (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  description text,
  sql_filter text not null,
  user_count int default 0,
  updated_at timestamptz default now()
);

insert into public.user_segments (name, description, sql_filter) values
  ('all_users', 'Alle registrierten Runner', 'true'),
  ('active_7d', 'Aktiv letzte 7 Tage', 'last_seen_at > now() - interval ''7 days'''),
  ('inactive_14d', 'Inaktiv 14+ Tage', 'coalesce(last_seen_at, created_at) < now() - interval ''14 days'''),
  ('top_100_km', 'Top 100 km-Runner', 'total_distance_m > 0'),
  ('newsletter_opted_in', 'Newsletter-Abonnenten', 'email_notif_newsletter = true'),
  ('faction_nachtpuls', 'Nachtpuls-Fraktion', 'faction = ''syndicate'''),
  ('faction_sonnenwacht', 'Sonnenwacht-Fraktion', 'faction = ''vanguard''')
on conflict (name) do nothing;

-- 5. Sales-Leads (Shop-Akquise)
create table if not exists public.sales_leads (
  id uuid primary key default gen_random_uuid(),
  shop_name text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  address text,
  city text,
  zip text,
  category text,
  source text default 'website' check (source in ('website','referral','cold_outreach','trade_show','inbound_mail')),
  status text default 'new' check (status in ('new','contacted','demo_booked','proposal_sent','won','lost','ghosted')),
  assigned_to uuid references public.users(id) on delete set null,
  value_eur numeric(10,2),
  notes text,
  next_action_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists sales_leads_status_idx on public.sales_leads(status, next_action_at);
create index if not exists sales_leads_assigned_idx on public.sales_leads(assigned_to);

-- 6. Shop-Abos (Billing)
create table if not exists public.shop_subscriptions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid,
  plan text not null check (plan in ('free','basic','premium','spotlight')),
  status text not null default 'active' check (status in ('trialing','active','past_due','cancelled','expired')),
  monthly_price_eur numeric(10,2),
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz default now(),
  cancelled_at timestamptz
);
create index if not exists shop_subs_status_idx on public.shop_subscriptions(status);

-- 7. Feature-Flags
create table if not exists public.feature_flags (
  key text primary key,
  description text,
  enabled boolean default false,
  rollout_percent int default 0 check (rollout_percent between 0 and 100),
  target_roles public.user_role[],
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz default now()
);

insert into public.feature_flags (key, description, enabled) values
  ('crew_duels', 'Rival-Duelle zwischen Crews', true),
  ('flash_deals', 'Shop Flash-Deals (30 min)', true),
  ('push_notifications', 'Web-Push (produktiv)', false),
  ('offline_maps', 'Offline-Map-Cache', false),
  ('strava_import', 'Strava-OAuth Import', false),
  ('native_app_deep_link', 'Deep-Links zur Native-App', false),
  ('maintenance_mode', 'Wartungsmodus (blockiert Public)', false)
on conflict (key) do nothing;

-- 8. Moderation
create table if not exists public.moderation_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.users(id) on delete set null,
  target_type text not null check (target_type in ('user','crew','chat_message','shop','territory')),
  target_id text not null,
  reason text not null check (reason in ('spam','harassment','inappropriate','cheating','other')),
  description text,
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  resolved_by uuid references public.users(id) on delete set null,
  resolved_at timestamptz,
  action_taken text,
  created_at timestamptz default now()
);
create index if not exists mod_reports_status_idx on public.moderation_reports(status, created_at desc);

-- 9. Gamification-Config (editierbar zur Laufzeit)
create table if not exists public.gamification_config (
  key text primary key,
  value jsonb not null,
  description text,
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz default now()
);

insert into public.gamification_config (key, value, description) values
  ('xp_per_km', '50'::jsonb, 'XP pro gelaufenem Kilometer'),
  ('xp_per_walk', '100'::jsonb, 'XP pro abgeschlossenem Walk'),
  ('xp_per_territory', '500'::jsonb, 'XP pro neu erschlossenem Territorium'),
  ('xp_streak_daily_max', '1000'::jsonb, 'XP max. pro Streak-Tag'),
  ('season_duration_days', '30'::jsonb, 'Saisonlänge in Tagen'),
  ('crew_max_members', '50'::jsonb, 'Max. Mitglieder pro Crew')
on conflict (key) do nothing;

-- 10. RLS-Policies für Admin-Tabellen
alter table public.admin_audit_log enable row level security;
alter table public.email_campaigns enable row level security;
alter table public.user_segments enable row level security;
alter table public.sales_leads enable row level security;
alter table public.shop_subscriptions enable row level security;
alter table public.feature_flags enable row level security;
alter table public.moderation_reports enable row level security;
alter table public.gamification_config enable row level security;

-- Hilfsfunktion: ist caller Admin / Staff?
create or replace function public.is_staff()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.users
     where id = auth.uid()
       and role in ('support','marketing','sales','admin','super_admin')
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.users
     where id = auth.uid() and role in ('admin','super_admin')
  );
$$;

-- Staff darf lesen, nur Admin schreiben (Feature-Flags, Gamification)
drop policy if exists audit_select on public.admin_audit_log;
create policy audit_select on public.admin_audit_log for select using (public.is_staff());
drop policy if exists audit_insert on public.admin_audit_log;
create policy audit_insert on public.admin_audit_log for insert with check (public.is_staff());

drop policy if exists campaigns_all on public.email_campaigns;
create policy campaigns_all on public.email_campaigns for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists segments_all on public.user_segments;
create policy segments_all on public.user_segments for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists leads_all on public.sales_leads;
create policy leads_all on public.sales_leads for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists subs_all on public.shop_subscriptions;
create policy subs_all on public.shop_subscriptions for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists flags_select on public.feature_flags;
create policy flags_select on public.feature_flags for select using (true);

drop policy if exists flags_write on public.feature_flags;
create policy flags_write on public.feature_flags for insert with check (public.is_admin());
drop policy if exists flags_update on public.feature_flags;
create policy flags_update on public.feature_flags for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists mod_all on public.moderation_reports;
create policy mod_all on public.moderation_reports for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists gam_select on public.gamification_config;
create policy gam_select on public.gamification_config for select using (true);
drop policy if exists gam_write on public.gamification_config;
create policy gam_write on public.gamification_config for update using (public.is_admin()) with check (public.is_admin());
