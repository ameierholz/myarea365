-- 00045: Crew Pay-to-Progress — Gem-Pool, Power-Items, Member-Slots.
-- Wichtig: Boosts wirken NUR auf Crew-Score (Duell/War/Saison/Challenges), NICHT auf user.xp.

-- ═══════════════════════════════════════════════════════
-- MEMBER-CAP (Start 10, bis max 100 kaufbar)
-- ═══════════════════════════════════════════════════════
alter table public.crews
  add column if not exists member_cap int not null default 10;

comment on column public.crews.member_cap is
  'Maximale Mitgliederzahl. Startet bei 10, kann durch Slot-Packs bis 100 ausgebaut werden.';

-- ═══════════════════════════════════════════════════════
-- CREW-GEM-POOL (gemeinsame 💎-Kasse)
-- ═══════════════════════════════════════════════════════
create table if not exists public.crew_gem_pool (
  crew_id uuid primary key references public.crews(id) on delete cascade,
  gems int not null default 0 check (gems >= 0),
  total_deposited int not null default 0,
  total_spent int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.crew_gem_pool enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='crew_gem_pool' and policyname='select_member') then
    create policy select_member on public.crew_gem_pool for select to authenticated
      using (exists (select 1 from public.crew_members m
                     where m.crew_id = crew_gem_pool.crew_id and m.user_id = auth.uid()));
  end if;
end $$;

-- Log für Transparenz
create table if not exists public.crew_gem_transactions (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  kind text not null check (kind in ('deposit','spend','refund','stripe_topup')),
  amount int not null,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists idx_crew_gem_txn_crew on public.crew_gem_transactions(crew_id, created_at desc);

alter table public.crew_gem_transactions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='crew_gem_transactions' and policyname='select_member') then
    create policy select_member on public.crew_gem_transactions for select to authenticated
      using (exists (select 1 from public.crew_members m
                     where m.crew_id = crew_gem_transactions.crew_id and m.user_id = auth.uid()));
  end if;
end $$;

-- ═══════════════════════════════════════════════════════
-- CREW-BOOSTS (aktivierte Power-Items, zeitlich oder Einmal)
-- ═══════════════════════════════════════════════════════
create table if not exists public.crew_boosts (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  activated_by uuid references public.users(id) on delete set null,
  kind text not null check (kind in ('score_24h','score_7d','war_momentum','flag_spawn','challenge_reroll','territory_shield','duel_pick')),
  activated_at timestamptz not null default now(),
  expires_at timestamptz,
  consumed_at timestamptz,
  gems_paid int not null default 0,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists idx_crew_boosts_active on public.crew_boosts(crew_id, kind, expires_at);
create index if not exists idx_crew_boosts_time on public.crew_boosts(crew_id, activated_at desc);

alter table public.crew_boosts enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='crew_boosts' and policyname='select_public') then
    create policy select_public on public.crew_boosts for select using (true);
  end if;
end $$;

-- ═══════════════════════════════════════════════════════
-- RPCs
-- ═══════════════════════════════════════════════════════

-- Ist ein bestimmter Boost-Typ gerade aktiv?
create or replace function public.is_crew_boost_active(p_crew_id uuid, p_kind text)
returns boolean language sql stable as $$
  select exists(
    select 1 from public.crew_boosts
    where crew_id = p_crew_id and kind = p_kind
      and (expires_at is null or expires_at > now())
      and consumed_at is null
  );
$$;
grant execute on function public.is_crew_boost_active(uuid, text) to authenticated, service_role;

-- Crew-Multiplier (1.5× wenn score-boost aktiv, sonst 1.0×)
create or replace function public.crew_score_multiplier(p_crew_id uuid)
returns numeric language sql stable as $$
  select case
    when public.is_crew_boost_active(p_crew_id, 'score_24h') or public.is_crew_boost_active(p_crew_id, 'score_7d')
      then 1.5
    else 1.0
  end;
$$;
grant execute on function public.crew_score_multiplier(uuid) to authenticated, service_role;

-- War-Momentum-Multiplier (1.2×)
create or replace function public.crew_war_multiplier(p_crew_id uuid)
returns numeric language sql stable as $$
  select case when public.is_crew_boost_active(p_crew_id, 'war_momentum') then 1.2 else 1.0 end;
$$;
grant execute on function public.crew_war_multiplier(uuid) to authenticated, service_role;

-- Deposit: User überträgt Diamanten vom persönlichen Konto in den Crew-Pool
create or replace function public.crew_gem_deposit(p_user_id uuid, p_crew_id uuid, p_amount int)
returns int language plpgsql security definer as $$
declare v_user_gems int;
begin
  if p_amount <= 0 then raise exception 'amount must be positive'; end if;

  -- User muss Mitglied der Crew sein
  if not exists (select 1 from public.crew_members where crew_id = p_crew_id and user_id = p_user_id) then
    raise exception 'not_crew_member';
  end if;

  -- User-Gems prüfen
  select gems into v_user_gems from public.user_gems where user_id = p_user_id;
  v_user_gems := coalesce(v_user_gems, 0);
  if v_user_gems < p_amount then raise exception 'insufficient_gems'; end if;

  -- Abzug
  update public.user_gems set gems = gems - p_amount, updated_at = now() where user_id = p_user_id;

  -- Einzahlung (upsert)
  insert into public.crew_gem_pool (crew_id, gems, total_deposited, updated_at)
  values (p_crew_id, p_amount, p_amount, now())
  on conflict (crew_id) do update
    set gems = crew_gem_pool.gems + p_amount,
        total_deposited = crew_gem_pool.total_deposited + p_amount,
        updated_at = now();

  -- Log
  insert into public.crew_gem_transactions (crew_id, user_id, kind, amount, reason)
  values (p_crew_id, p_user_id, 'deposit', p_amount, 'user_transfer');

  return p_amount;
end $$;

grant execute on function public.crew_gem_deposit(uuid, uuid, int) to authenticated, service_role;

-- Kauf/Aktivierung eines Crew-Boosts
create or replace function public.crew_activate_boost(p_user_id uuid, p_crew_id uuid, p_kind text)
returns jsonb language plpgsql security definer as $$
declare
  v_role text;
  v_cost int;
  v_duration_hours int;
  v_pool int;
  v_expires timestamptz;
  v_week_start date := (date_trunc('week', (now() at time zone 'Europe/Berlin')::date))::date;
  v_active_hours_this_week numeric;
  v_war_active boolean;
begin
  -- Admin/Owner-Check
  select role into v_role from public.crew_members where crew_id = p_crew_id and user_id = p_user_id;
  if v_role is null or v_role not in ('admin','owner') then raise exception 'admin_only'; end if;

  -- Preis + Dauer per Kind
  case p_kind
    when 'score_24h'        then v_cost := 300;  v_duration_hours := 24;
    when 'score_7d'         then v_cost := 1500; v_duration_hours := 24 * 7;
    when 'war_momentum'     then v_cost := 500;  v_duration_hours := 24;
    when 'flag_spawn'       then v_cost := 800;  v_duration_hours := null;
    when 'challenge_reroll' then v_cost := 200;  v_duration_hours := null;
    when 'territory_shield' then v_cost := 1000; v_duration_hours := 48;
    when 'duel_pick'        then v_cost := 500;  v_duration_hours := null;
    else raise exception 'unknown_kind';
  end case;

  -- War-Momentum nur bei aktivem Krieg
  if p_kind = 'war_momentum' then
    select exists(
      select 1 from public.crew_wars
      where (crew_a_id = p_crew_id or crew_b_id = p_crew_id) and status = 'active'
    ) into v_war_active;
    if not v_war_active then raise exception 'no_active_war'; end if;
  end if;

  -- Kein Stacking: Boost gleicher Art schon aktiv?
  if public.is_crew_boost_active(p_crew_id, p_kind) then
    raise exception 'already_active';
  end if;

  -- Wochenlimit für Score-Boosts (max 3 Tage = 72 h aktive Boost-Zeit pro Woche)
  if p_kind in ('score_24h','score_7d') then
    select coalesce(sum(extract(epoch from (least(expires_at, now() + interval '7 days') - greatest(activated_at, v_week_start::timestamptz))) / 3600), 0)
    into v_active_hours_this_week
    from public.crew_boosts
    where crew_id = p_crew_id and kind in ('score_24h','score_7d')
      and activated_at >= v_week_start::timestamptz;
    if v_active_hours_this_week + v_duration_hours > 72 then
      raise exception 'weekly_limit_reached';
    end if;
  end if;

  -- Pool-Check
  select gems into v_pool from public.crew_gem_pool where crew_id = p_crew_id;
  if coalesce(v_pool, 0) < v_cost then raise exception 'insufficient_pool'; end if;

  -- Pool belasten
  update public.crew_gem_pool
  set gems = gems - v_cost, total_spent = total_spent + v_cost, updated_at = now()
  where crew_id = p_crew_id;

  v_expires := case when v_duration_hours is null then null else now() + (v_duration_hours || ' hours')::interval end;

  insert into public.crew_boosts (crew_id, activated_by, kind, expires_at, gems_paid)
  values (p_crew_id, p_user_id, p_kind, v_expires, v_cost);

  insert into public.crew_gem_transactions (crew_id, user_id, kind, amount, reason)
  values (p_crew_id, p_user_id, 'spend', v_cost, p_kind);

  -- Feed-Eintrag
  perform public.add_crew_feed(p_crew_id, p_user_id, 'challenge_completed',
    jsonb_build_object('name', 'Power-Item aktiviert: ' || p_kind, 'kind', 'boost', 'gems', v_cost));

  return jsonb_build_object('ok', true, 'kind', p_kind, 'cost', v_cost, 'expires_at', v_expires);
end $$;

grant execute on function public.crew_activate_boost(uuid, uuid, text) to authenticated, service_role;

-- Member-Cap-Upgrade (wird vom Stripe-Webhook aufgerufen)
create or replace function public.crew_increase_member_cap(p_crew_id uuid, p_delta int)
returns int language plpgsql security definer as $$
declare v_new int;
begin
  update public.crews
  set member_cap = least(member_cap + p_delta, 100)
  where id = p_crew_id
  returning member_cap into v_new;
  return v_new;
end $$;

grant execute on function public.crew_increase_member_cap(uuid, int) to service_role;

-- Stripe-Topup: Gems-Pack landet im Pool
create or replace function public.crew_gem_pool_topup(p_crew_id uuid, p_gems int, p_reason text default 'stripe_purchase')
returns int language plpgsql security definer as $$
declare v_new int;
begin
  insert into public.crew_gem_pool (crew_id, gems, total_deposited, updated_at)
  values (p_crew_id, p_gems, p_gems, now())
  on conflict (crew_id) do update
    set gems = crew_gem_pool.gems + p_gems,
        total_deposited = crew_gem_pool.total_deposited + p_gems,
        updated_at = now()
  returning crew_gem_pool.gems into v_new;

  insert into public.crew_gem_transactions (crew_id, user_id, kind, amount, reason)
  values (p_crew_id, null, 'stripe_topup', p_gems, p_reason);

  return v_new;
end $$;

grant execute on function public.crew_gem_pool_topup(uuid, int, text) to service_role;
