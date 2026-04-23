-- 00054: B2B-Shop-Features — Self-Service-Registration, Moderation,
-- Deal-CRUD mit Frequency, Acryl-Aufsteller-Bestellungen.
--
-- Kontext: Bis jetzt konnten sich Shop-Owner nicht selbst registrieren
-- (nur Admin-Insert), das Dashboard zeigte Demo-Daten und Deals waren
-- nicht wirklich über das Owner-UI anlegbar. Diese Migration legt die
-- DB-Grundlage für Phase 1 des B2B-Ausbaus.

-- ═══════════════════════════════════════════════════════
-- 1) Approval-Flow auf local_businesses
-- ═══════════════════════════════════════════════════════
alter table public.local_businesses
  add column if not exists status text not null default 'approved'
    check (status in ('pending','approved','rejected')),
  add column if not exists submitted_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists city text;

comment on column public.local_businesses.status is
  'Moderation: pending (neu eingereicht, wartet auf Review), approved (sichtbar), rejected.';

create index if not exists idx_lb_status_submitted
  on public.local_businesses(status, submitted_at desc)
  where status = 'pending';

-- Bestehende Shops als approved markieren
update public.local_businesses set status = 'approved', approved_at = coalesce(approved_at, created_at)
  where status = 'approved' and approved_at is null;

-- ═══════════════════════════════════════════════════════
-- 2) Deal-Frequency für Lifecycle
-- ═══════════════════════════════════════════════════════
alter table public.shop_deals
  add column if not exists frequency text not null default 'weekly'
    check (frequency in ('daily','weekly','monthly','quarterly','unlimited')),
  add column if not exists description text;

-- ═══════════════════════════════════════════════════════
-- 3) Acryl-Aufsteller-Bestellungen
-- ═══════════════════════════════════════════════════════
create table if not exists public.shop_stand_orders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.local_businesses(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  variant text not null default 'a5_table'
    check (variant in ('a5_table','a4_table','a4_wall')),
  quantity int not null default 1 check (quantity between 1 and 20),
  recipient_name text not null,
  recipient_company text,
  street text not null,
  zip text not null,
  city text not null,
  country text not null default 'DE',
  notes text,
  status text not null default 'pending'
    check (status in ('pending','paid','shipped','cancelled')),
  price_cents int not null,
  stripe_session_id text,
  tracking_url text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  shipped_at timestamptz
);

create index if not exists idx_shop_stand_orders_shop
  on public.shop_stand_orders(shop_id, created_at desc);
create index if not exists idx_shop_stand_orders_status
  on public.shop_stand_orders(status) where status in ('pending','paid');

alter table public.shop_stand_orders enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='shop_stand_orders' and policyname='stand_orders_owner_read') then
    create policy stand_orders_owner_read on public.shop_stand_orders
      for select using (
        user_id = auth.uid() or
        shop_id in (select id from public.local_businesses where owner_id = auth.uid())
      );
  end if;
  if not exists (select 1 from pg_policies where tablename='shop_stand_orders' and policyname='stand_orders_owner_insert') then
    create policy stand_orders_owner_insert on public.shop_stand_orders
      for insert with check (
        user_id = auth.uid() or
        shop_id in (select id from public.local_businesses where owner_id = auth.uid())
      );
  end if;
end $$;

-- ═══════════════════════════════════════════════════════
-- 4) RLS für shop_deals — Owner kann eigene Deals pflegen
-- ═══════════════════════════════════════════════════════
alter table public.shop_deals enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='shop_deals' and policyname='shop_deals_public_read') then
    create policy shop_deals_public_read on public.shop_deals for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='shop_deals' and policyname='shop_deals_owner_write') then
    create policy shop_deals_owner_write on public.shop_deals
      for all using (
        shop_id in (select id from public.local_businesses where owner_id = auth.uid())
      ) with check (
        shop_id in (select id from public.local_businesses where owner_id = auth.uid())
      );
  end if;
end $$;

-- ═══════════════════════════════════════════════════════
-- 5) RLS für local_businesses — Owner darf eigene Shops updaten
-- ═══════════════════════════════════════════════════════
alter table public.local_businesses enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='local_businesses' and policyname='lb_public_read_approved') then
    create policy lb_public_read_approved on public.local_businesses
      for select using (status = 'approved' or owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='local_businesses' and policyname='lb_owner_insert') then
    create policy lb_owner_insert on public.local_businesses
      for insert with check (owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='local_businesses' and policyname='lb_owner_update') then
    create policy lb_owner_update on public.local_businesses
      for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
  end if;
end $$;

-- ═══════════════════════════════════════════════════════
-- 6) Approve/Reject-RPCs für Admin
-- ═══════════════════════════════════════════════════════
create or replace function public.approve_shop(p_shop_id uuid)
returns jsonb language plpgsql security definer as $$
begin
  if not exists (select 1 from public.users where id = auth.uid() and is_admin = true) then
    return jsonb_build_object('ok', false, 'error', 'not_admin');
  end if;
  update public.local_businesses
    set status = 'approved', approved_at = now(), rejection_reason = null
    where id = p_shop_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.reject_shop(p_shop_id uuid, p_reason text)
returns jsonb language plpgsql security definer as $$
begin
  if not exists (select 1 from public.users where id = auth.uid() and is_admin = true) then
    return jsonb_build_object('ok', false, 'error', 'not_admin');
  end if;
  update public.local_businesses
    set status = 'rejected', rejected_at = now(), rejection_reason = p_reason
    where id = p_shop_id;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.approve_shop(uuid) to authenticated;
grant execute on function public.reject_shop(uuid, text) to authenticated;
