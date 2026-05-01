-- ─── 00206: Admin Phase 1+2 — neue Tabellen ───────────────────────
-- Refund-Anfragen, In-App-Banner, manuelle Event-Trigger, XP-Awards-Audit,
-- User-Warnings (für Ban-Eskalations-Ladder).
-- Alle Tabellen mit RLS (nur service_role + admin-Rolle), greifbar via
-- /api/admin/*-Endpoints die requireAdmin() prüfen.

-- 1) refund_requests — User stellt Refund-Antrag, Admin entscheidet
create table if not exists public.refund_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  currency     text not null default 'EUR',
  reason       text not null,
  -- bezogen auf welche Transaktion (Stripe/PayPal-ID, optional)
  external_ref text,
  status       text not null default 'pending' check (status in ('pending','approved','rejected','processed')),
  decision_by  uuid references public.users(id),
  decision_at  timestamptz,
  decision_note text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_refund_requests_status_created on public.refund_requests(status, created_at);
create index if not exists idx_refund_requests_user           on public.refund_requests(user_id);
alter table public.refund_requests enable row level security;
-- Owner sieht eigene Anträge, Admin sieht alles (Policies via service_role im Code).

-- 2) in_app_banners — Promo-Banner im Frontend, segmentierbar
create table if not exists public.in_app_banners (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  body         text not null,
  cta_label    text,
  cta_href     text,
  -- target: 'all' | 'segment:<segment_id>' | 'crew:<crew_id>'
  target       text not null default 'all',
  starts_at    timestamptz not null default now(),
  ends_at      timestamptz,
  dismissible  boolean not null default true,
  active       boolean not null default true,
  background_color text default '#22D1C3',
  text_color   text default '#0F1115',
  priority     int not null default 0,
  created_by   uuid references public.users(id),
  created_at   timestamptz not null default now()
);
create index if not exists idx_in_app_banners_active_window on public.in_app_banners(active, starts_at, ends_at);
alter table public.in_app_banners enable row level security;

-- 3) bulk_event_triggers — Manuelle Event-Schedules (Double-XP, Hunt-Reset, etc.)
create table if not exists public.bulk_event_triggers (
  id           uuid primary key default gen_random_uuid(),
  event_kind   text not null check (event_kind in ('double_xp','hunt_reset','wegelager_storm','crown_drop','crew_war','custom')),
  payload      jsonb not null default '{}',
  starts_at    timestamptz not null default now(),
  ends_at      timestamptz,
  notify_users boolean not null default true,
  notify_text  text,
  status       text not null default 'scheduled' check (status in ('scheduled','active','ended','cancelled')),
  triggered_by uuid references public.users(id),
  created_at   timestamptz not null default now()
);
create index if not exists idx_bulk_events_status_starts on public.bulk_event_triggers(status, starts_at);
alter table public.bulk_event_triggers enable row level security;

-- 4) xp_awards — Audit-Trail für manuell vergebene XP/Crowns durch Admins
create table if not exists public.xp_awards (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  awarded_by   uuid not null references public.users(id),
  xp_delta     integer not null,
  crown_delta  integer not null default 0,
  reason       text not null,
  category     text not null default 'compensation' check (category in ('compensation','contest_prize','bug_makeup','manual_grant','other')),
  created_at   timestamptz not null default now()
);
create index if not exists idx_xp_awards_user_created on public.xp_awards(user_id, created_at desc);
alter table public.xp_awards enable row level security;

-- 5) user_warnings — Progressive Enforcement (Ban-Eskalations-Ladder)
create table if not exists public.user_warnings (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  level        text not null check (level in ('warning','timeout_24h','timeout_7d','permanent_ban')),
  reason       text not null,
  issued_by    uuid not null references public.users(id),
  expires_at   timestamptz,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists idx_user_warnings_user_active on public.user_warnings(user_id, active, created_at desc);
alter table public.user_warnings enable row level security;

-- 6) admin_login_attempts — Audit für Admin-Logins (Phase 3)
create table if not exists public.admin_login_attempts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.users(id) on delete set null,
  email         text not null,
  ip_address    text,
  user_agent    text,
  success       boolean not null,
  failure_reason text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_admin_login_attempts_user_created on public.admin_login_attempts(user_id, created_at desc);
create index if not exists idx_admin_login_attempts_email_created on public.admin_login_attempts(email, created_at desc);
alter table public.admin_login_attempts enable row level security;

-- 7) Hilfsfunktion: get_active_warning_level — höchstes aktives Warning-Level
create or replace function public.get_active_warning_level(p_user_id uuid)
returns text language sql stable as $$
  select level from public.user_warnings
   where user_id = p_user_id and active = true
     and (expires_at is null or expires_at > now())
   order by case level
     when 'permanent_ban' then 4
     when 'timeout_7d'    then 3
     when 'timeout_24h'   then 2
     when 'warning'       then 1
   end desc
   limit 1;
$$;
grant execute on function public.get_active_warning_level(uuid) to authenticated;
