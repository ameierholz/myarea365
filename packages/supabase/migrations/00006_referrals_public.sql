-- Referral-System + Public-Profile-Sichtbarkeit

-- 1. Referral-Code pro User (6 chars, lesbar)
alter table public.users
  add column if not exists referral_code text unique,
  add column if not exists referred_by uuid references public.users(id) on delete set null,
  add column if not exists referral_reward_xp int default 0;

-- Generiere Code für bestehende User
update public.users
   set referral_code = upper(substr(md5(id::text || random()::text), 1, 6))
 where referral_code is null;

-- Auto-Code für neue User via Default
alter table public.users
  alter column referral_code set default upper(substr(md5(gen_random_uuid()::text), 1, 6));

-- 2. Referrals-Tracking
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.users(id) on delete cascade,
  referred_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','confirmed','rewarded')),
  reward_xp int default 500,
  confirmed_at timestamptz,
  rewarded_at timestamptz,
  created_at timestamptz default now(),
  unique (referred_id)
);
create index if not exists referrals_referrer_idx on public.referrals(referrer_id);

alter table public.referrals enable row level security;

drop policy if exists referrals_own_select on public.referrals;
create policy referrals_own_select on public.referrals
  for select using (referrer_id = auth.uid() or referred_id = auth.uid() or public.is_staff());

drop policy if exists referrals_staff_all on public.referrals;
create policy referrals_staff_all on public.referrals
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists referrals_insert_own on public.referrals;
create policy referrals_insert_own on public.referrals
  for insert with check (referred_id = auth.uid());

-- 3. Public-Profile-Lesbarkeit für Leaderboard & /@username
-- Eigene Privacy-Spalte respektieren; anonymous nur gewählte Felder
drop policy if exists users_public_leaderboard on public.users;
create policy users_public_leaderboard on public.users
  for select using (
    coalesce(privacy_leaderboard, true) = true
    and coalesce(privacy_searchable, true) = true
  );

-- 4. Sitemap-Feed: nur opt-in User
create or replace view public.v_public_profiles as
  select id, username, display_name, faction,
         total_distance_m, total_walks,
         xp as total_xp, level,
         created_at
    from public.users
   where coalesce(privacy_leaderboard, true) = true
     and coalesce(privacy_searchable, true) = true;

-- 5. Crew invite deep links — invite_code soll eindeutig sein
create unique index if not exists crews_invite_code_unique on public.crews(invite_code) where invite_code is not null;
