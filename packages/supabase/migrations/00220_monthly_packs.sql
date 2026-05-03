-- ══════════════════════════════════════════════════════════════════════════
-- Monatspakete: 30-Tage-Abo mit täglichem Login-Reward
-- ══════════════════════════════════════════════════════════════════════════
-- 2 SKUs (Klein/Groß), parallel kaufbar. Jeder Tag freischaltbar = 1 Claim.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists public.monthly_pack_skus (
  sku text primary key,
  name text not null,
  price_eur numeric(8,2) not null,
  duration_days int not null default 30,
  daily_gems int not null default 0,
  daily_coins int not null default 0,
  -- Optionale tägliche Items: [{ catalog_id, count }, ...]
  daily_items jsonb not null default '[]'::jsonb,
  -- Sofort-Boni beim Kauf
  instant_gems int not null default 0,
  instant_coins int not null default 0,
  active boolean not null default true,
  sort_order int not null default 0
);

create table if not exists public.user_monthly_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  sku text not null references public.monthly_pack_skus(sku) on update cascade,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_claimed_date date,                            -- letzter Claim-Tag
  total_claims int not null default 0,
  active boolean not null default true,
  unique (user_id, sku, started_at)
);

create index if not exists idx_user_mpacks_active on public.user_monthly_packs(user_id) where active;

alter table public.monthly_pack_skus enable row level security;
alter table public.user_monthly_packs enable row level security;

drop policy if exists "mp_skus_read" on public.monthly_pack_skus;
drop policy if exists "mp_user_read" on public.user_monthly_packs;

create policy "mp_skus_read" on public.monthly_pack_skus  for select to authenticated using (active);
create policy "mp_user_read" on public.user_monthly_packs for select to authenticated using (auth.uid() = user_id);

-- ─── Purchase ────────────────────────────────────────────────────────────
create or replace function public.purchase_monthly_pack(
  p_user_id uuid, p_sku text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dur int;
  v_instant_gems int;
  v_instant_coins int;
begin
  select duration_days, instant_gems, instant_coins
    into v_dur, v_instant_gems, v_instant_coins
    from public.monthly_pack_skus where sku = p_sku and active;
  if v_dur is null then return false; end if;

  insert into public.user_monthly_packs (user_id, sku, started_at, expires_at)
  values (p_user_id, p_sku, now(), now() + (v_dur || ' days')::interval);

  if v_instant_gems > 0 then
    update public.users set gem_balance = coalesce(gem_balance, 0) + v_instant_gems where id = p_user_id;
  end if;
  if v_instant_coins > 0 then
    update public.users set xp = coalesce(xp, 0) + v_instant_coins where id = p_user_id;
  end if;
  return true;
end $$;

-- ─── Daily Claim (alle aktiven Packs) ────────────────────────────────────
create or replace function public.claim_monthly_packs(p_user_id uuid)
returns table(sku text, claimed boolean, gems int, coins int)
language plpgsql
security definer
set search_path = public
as $$
declare r record; v_today date := current_date;
begin
  for r in
    select mp.id, mp.sku, mp.last_claimed_date,
           sk.daily_gems, sk.daily_coins, sk.daily_items
    from public.user_monthly_packs mp
    join public.monthly_pack_skus sk on sk.sku = mp.sku
    where mp.user_id = p_user_id and mp.active and mp.expires_at > now()
  loop
    if r.last_claimed_date is not null and r.last_claimed_date >= v_today then
      sku := r.sku; claimed := false; gems := 0; coins := 0;
      return next; continue;
    end if;
    -- gutschreiben
    if r.daily_gems > 0 then
      update public.users set gem_balance = coalesce(gem_balance, 0) + r.daily_gems where id = p_user_id;
    end if;
    if r.daily_coins > 0 then
      update public.users set xp = coalesce(xp, 0) + r.daily_coins where id = p_user_id;
    end if;
    -- items
    if jsonb_array_length(r.daily_items) > 0 then
      perform public.grant_inventory_item(p_user_id, (it->>'catalog_id'), (it->>'count')::int)
        from jsonb_array_elements(r.daily_items) it;
    end if;
    update public.user_monthly_packs
      set last_claimed_date = v_today, total_claims = total_claims + 1
      where id = r.id;
    sku := r.sku; claimed := true; gems := r.daily_gems; coins := r.daily_coins;
    return next;
  end loop;

  -- abgelaufene deaktivieren
  update public.user_monthly_packs set active = false where user_id = p_user_id and expires_at <= now();
end $$;

grant execute on function public.purchase_monthly_pack(uuid, text) to authenticated, service_role;
grant execute on function public.claim_monthly_packs(uuid) to authenticated, service_role;

-- ─── Seed: 2 SKUs ────────────────────────────────────────────────────────
insert into public.monthly_pack_skus (sku, name, price_eur, duration_days, daily_gems, daily_coins, daily_items, instant_gems, instant_coins, sort_order) values
  ('mpack_small', 'Monats-Pack Klein',  4.99,  30, 100,  500, '[{"catalog_id":"speedup_uni_15m","count":1}]'::jsonb,  500, 0, 10),
  ('mpack_large', 'Monats-Pack Groß',   9.99,  30, 250, 1500, '[{"catalog_id":"speedup_uni_60m","count":1},{"catalog_id":"chest_silver","count":1}]'::jsonb, 2000, 0, 20)
on conflict (sku) do nothing;
