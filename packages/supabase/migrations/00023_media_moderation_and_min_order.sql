-- 1) Crew-Medien: Status + Rejection-Reason für Banner und Logo (KI-Vorfilter + Admin-Review)
alter table public.crews
  add column if not exists custom_banner_status text not null default 'approved' check (custom_banner_status in ('pending','approved','rejected')),
  add column if not exists custom_banner_rejection_reason text,
  add column if not exists custom_logo_status text not null default 'approved' check (custom_logo_status in ('pending','approved','rejected')),
  add column if not exists custom_logo_rejection_reason text;

-- 2) Mindestausgabebetrag pro Deal (optional)
alter table public.deals
  add column if not exists min_order_amount_cents int;

-- 3) Index für Admin-Moderations-Queue
create index if not exists idx_crews_banner_pending on public.crews(custom_banner_status) where custom_banner_status <> 'approved';
create index if not exists idx_crews_logo_pending on public.crews(custom_logo_status) where custom_logo_status <> 'approved';
