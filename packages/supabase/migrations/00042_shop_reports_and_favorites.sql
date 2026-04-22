-- 00042: Shop-Reports & Favorites für User-Feedback + Shop-Management.

-- ─── SHOP-REPORTS (User meldet problematischen Shop) ──────
create table if not exists public.shop_reports (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.local_businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('wrong_info','closed','spam','inappropriate','unfriendly','not_honored','other')),
  comment text,
  status text not null default 'open' check (status in ('open','reviewed','resolved','dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_shop_reports_business on public.shop_reports(business_id, status);
create index if not exists idx_shop_reports_status on public.shop_reports(status, created_at desc);

alter table public.shop_reports enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='shop_reports' and policyname='insert_own') then
    create policy insert_own on public.shop_reports for insert
      to authenticated with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='shop_reports' and policyname='select_own') then
    create policy select_own on public.shop_reports for select
      to authenticated using (user_id = auth.uid());
  end if;
end $$;

-- ─── SHOP-FAVORITES (User merkt sich Shops für später) ────
create table if not exists public.shop_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.local_businesses(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, business_id)
);

alter table public.shop_favorites enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='shop_favorites' and policyname='all_own') then
    create policy all_own on public.shop_favorites for all
      to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;
