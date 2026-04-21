-- 00032: Admin-Broadcasts (Segment-basierte Push/In-App-Nachrichten)
-- Aktuell mit Log-Integration; echte Push-Anbindung (FCM/Web-Push) in separater Migration.

create table if not exists public.admin_broadcasts (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  body             text not null,
  channel          text not null default 'inapp' check (channel in ('inapp','push','email')),
  segment          jsonb not null default '{}'::jsonb,  -- { faction, country, city, inactive_days, min_level, crew_id }
  recipient_count  int,
  recipient_sample uuid[],                                -- erste ~50 IDs (zum Prüfen)
  sent_by          uuid references public.users(id) on delete set null,
  sent_by_email    text,
  status           text not null default 'pending' check (status in ('pending','sent','failed')),
  error            text,
  sent_at          timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists idx_admin_broadcasts_created on public.admin_broadcasts(created_at desc);
create index if not exists idx_admin_broadcasts_status  on public.admin_broadcasts(status);

-- Tabelle für In-App-Nachrichten (wird vom User gelesen)
create table if not exists public.user_inbox (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  broadcast_id  uuid references public.admin_broadcasts(id) on delete set null,
  title         text not null,
  body          text not null,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists idx_user_inbox_user on public.user_inbox(user_id, read_at, created_at desc);

alter table public.admin_broadcasts enable row level security;
drop policy if exists admin_broadcasts_staff on public.admin_broadcasts;
create policy admin_broadcasts_staff on public.admin_broadcasts for all
  using ((select role from public.users where id = auth.uid()) in ('support','marketing','sales','admin','super_admin'))
  with check ((select role from public.users where id = auth.uid()) in ('support','marketing','sales','admin','super_admin'));

alter table public.user_inbox enable row level security;
drop policy if exists user_inbox_own_read on public.user_inbox;
create policy user_inbox_own_read on public.user_inbox for select using (auth.uid() = user_id);
drop policy if exists user_inbox_own_update on public.user_inbox;
create policy user_inbox_own_update on public.user_inbox for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
