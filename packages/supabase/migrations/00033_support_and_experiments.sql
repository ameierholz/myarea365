-- 00033: Support-Tickets + A/B-Experimente

-- ─── Support-Tickets (Inbox für Kontaktanfragen) ───────────────────
create table if not exists public.support_tickets (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references public.users(id) on delete set null,  -- NULL = anonym via Kontaktform
  email          text not null,
  name           text,
  subject        text not null,
  body           text not null,
  category       text default 'general' check (category in ('general','bug','billing','partner','abuse','other')),
  status         text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  priority       text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  assigned_to    uuid references public.users(id) on delete set null,
  internal_notes text,
  source         text default 'contact_form' check (source in ('contact_form','email','in_app','api')),
  user_agent     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  resolved_at    timestamptz
);

create index if not exists idx_support_tickets_status   on public.support_tickets(status, created_at desc);
create index if not exists idx_support_tickets_assigned on public.support_tickets(assigned_to);
create index if not exists idx_support_tickets_user     on public.support_tickets(user_id);

create table if not exists public.support_ticket_messages (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.support_tickets(id) on delete cascade,
  author_id   uuid references public.users(id) on delete set null,
  author_role text not null default 'user' check (author_role in ('user','staff','system')),
  body        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_support_messages_ticket on public.support_ticket_messages(ticket_id, created_at);

alter table public.support_tickets enable row level security;
drop policy if exists support_tickets_staff on public.support_tickets;
create policy support_tickets_staff on public.support_tickets for all
  using ((select role from public.users where id = auth.uid()) in ('support','admin','super_admin'))
  with check ((select role from public.users where id = auth.uid()) in ('support','admin','super_admin'));

drop policy if exists support_tickets_own on public.support_tickets;
create policy support_tickets_own on public.support_tickets for select using (user_id = auth.uid());

alter table public.support_ticket_messages enable row level security;
drop policy if exists support_messages_staff on public.support_ticket_messages;
create policy support_messages_staff on public.support_ticket_messages for all
  using ((select role from public.users where id = auth.uid()) in ('support','admin','super_admin'))
  with check ((select role from public.users where id = auth.uid()) in ('support','admin','super_admin'));

-- ─── A/B-Experimente ────────────────────────────────────────────────
create table if not exists public.experiments (
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null,           -- z.B. "new_onboarding_v2"
  description text,
  variants    jsonb not null default '[]'::jsonb,  -- [{ key: "control", weight: 50 }, { key: "variant_a", weight: 50 }]
  status      text not null default 'draft' check (status in ('draft','running','paused','completed')),
  started_at  timestamptz,
  ended_at    timestamptz,
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.experiment_assignments (
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  user_id       uuid not null references public.users(id) on delete cascade,
  variant       text not null,
  assigned_at   timestamptz not null default now(),
  primary key (experiment_id, user_id)
);

create table if not exists public.experiment_events (
  id            uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  user_id       uuid references public.users(id) on delete set null,
  variant       text not null,
  event         text not null,      -- z.B. "conversion", "click_cta"
  value         numeric,
  metadata      jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists idx_exp_events_exp on public.experiment_events(experiment_id, event);

alter table public.experiments enable row level security;
drop policy if exists experiments_read_all on public.experiments;
create policy experiments_read_all on public.experiments for select using (true);
drop policy if exists experiments_write_staff on public.experiments;
create policy experiments_write_staff on public.experiments for all
  using ((select role from public.users where id = auth.uid()) in ('admin','super_admin','marketing'))
  with check ((select role from public.users where id = auth.uid()) in ('admin','super_admin','marketing'));

alter table public.experiment_assignments enable row level security;
drop policy if exists exp_assign_own on public.experiment_assignments;
create policy exp_assign_own on public.experiment_assignments for select using (user_id = auth.uid());
