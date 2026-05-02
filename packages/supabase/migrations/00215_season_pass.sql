-- ══════════════════════════════════════════════════════════════════════════
-- Phase 6 — Saison-Pass
--
-- Saison: 90 Tage. Free-Track + Premium-Track (Diamanten-Unlock 750).
-- 30 Levels. 1 Level = 1000 Saison-XP. Saison-XP = halbierte normale XP aus Walks.
-- Pro Level: Free-Reward (immer claimbar) + Premium-Reward (nur mit Pass).
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists public.seasons (
  id          serial primary key,
  name        text not null,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  created_at  timestamptz not null default now()
);

insert into public.seasons (name, starts_at, ends_at)
  select 'Saison 1 — Berlin Erwacht', now(), now() + interval '90 days'
   where not exists (select 1 from public.seasons);

create table if not exists public.user_season_progress (
  user_id          uuid not null references public.users(id) on delete cascade,
  season_id        int  not null references public.seasons(id) on delete cascade,
  season_xp        int  not null default 0,
  level            int  not null default 0,
  premium          boolean not null default false,
  premium_unlocked_at timestamptz,
  free_claims      int[] not null default '{}',
  premium_claims   int[] not null default '{}',
  updated_at       timestamptz not null default now(),
  primary key (user_id, season_id)
);

create index if not exists idx_season_progress_season on public.user_season_progress(season_id);

alter table public.user_season_progress enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='user_season_progress' and policyname='read_own') then
    create policy read_own on public.user_season_progress for select using (auth.uid() = user_id);
  end if;
end $$;

create table if not exists public.season_rewards (
  level             int primary key,
  free_kind         text not null,
  free_amount       int  not null,
  free_label        text not null,
  premium_kind      text not null,
  premium_amount    int  not null,
  premium_label     text not null
);

insert into public.season_rewards (level, free_kind, free_amount, free_label, premium_kind, premium_amount, premium_label) values
  (1,  'coins',   100,  '100 🪙',     'gems',   25,   '25 💎'),
  (2,  'coins',   150,  '150 🪙',     'coins',  500,  '500 🪙'),
  (3,  'coins',   200,  '200 🪙',     'gems',   30,   '30 💎'),
  (4,  'wood',    300,  '300 Wood',   'gems',   40,   '40 💎'),
  (5,  'coins',   500,  '500 🪙',     'cosmetic_chest', 1, '🎁 Kosmetik-Truhe'),
  (6,  'stone',   300,  '300 Stein',  'gems',   50,   '50 💎'),
  (7,  'coins',   300,  '300 🪙',     'coins',  1500, '1500 🪙'),
  (8,  'gold',    200,  '200 Gold',   'gems',   60,   '60 💎'),
  (9,  'coins',   400,  '400 🪙',     'cosmetic_chest', 1, '🎁 Kosmetik-Truhe'),
  (10, 'mana',    300,  '300 Mana',   'gems',   100,  '100 💎'),
  (11, 'coins',   500,  '500 🪙',     'gems',   60,   '60 💎'),
  (12, 'wood',    500,  '500 Wood',   'coins',  2000, '2000 🪙'),
  (13, 'coins',   500,  '500 🪙',     'gems',   75,   '75 💎'),
  (14, 'stone',   500,  '500 Stein',  'gems',   75,   '75 💎'),
  (15, 'coins',   1000, '1000 🪙',    'cosmetic_chest', 1, '🎁 Kosmetik-Truhe'),
  (16, 'gold',    400,  '400 Gold',   'gems',   100,  '100 💎'),
  (17, 'coins',   600,  '600 🪙',     'coins',  3000, '3000 🪙'),
  (18, 'mana',    500,  '500 Mana',   'gems',   100,  '100 💎'),
  (19, 'coins',   700,  '700 🪙',     'gems',   125,  '125 💎'),
  (20, 'wood',    1000, '1000 Wood',  'cosmetic_chest', 1, '🎁 Kosmetik-Truhe'),
  (21, 'coins',   800,  '800 🪙',     'gems',   125,  '125 💎'),
  (22, 'stone',   1000, '1000 Stein', 'coins',  4000, '4000 🪙'),
  (23, 'coins',   900,  '900 🪙',     'gems',   150,  '150 💎'),
  (24, 'gold',    700,  '700 Gold',   'gems',   150,  '150 💎'),
  (25, 'coins',   1000, '1000 🪙',    'cosmetic_chest', 1, '🎁 Legendäre Kosmetik-Truhe'),
  (26, 'mana',    1000, '1000 Mana',  'gems',   175,  '175 💎'),
  (27, 'coins',   1200, '1200 🪙',    'coins',  5000, '5000 🪙'),
  (28, 'wood',    2000, '2000 Wood',  'gems',   200,  '200 💎'),
  (29, 'gold',    1000, '1000 Gold',  'gems',   200,  '200 💎'),
  (30, 'coins',   2500, '2500 🪙 + Saison-Trophäe', 'cosmetic_chest', 1, '🏆 Saison-Trophäe + Banner')
on conflict (level) do update set
  free_label = excluded.free_label, premium_label = excluded.premium_label;

create or replace function public.get_season_status()
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_season record;
  v_progress record;
  v_rewards jsonb;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'auth_required'); end if;

  select * into v_season from public.seasons
   where now() between starts_at and ends_at
   order by starts_at desc limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_active_season');
  end if;

  insert into public.user_season_progress (user_id, season_id) values (v_user, v_season.id) on conflict do nothing;
  select * into v_progress from public.user_season_progress where user_id = v_user and season_id = v_season.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'level', level,
    'free_label', free_label, 'free_kind', free_kind, 'free_amount', free_amount,
    'premium_label', premium_label, 'premium_kind', premium_kind, 'premium_amount', premium_amount
  ) order by level), '[]'::jsonb) into v_rewards from public.season_rewards;

  return jsonb_build_object(
    'ok', true,
    'season', jsonb_build_object(
      'id', v_season.id, 'name', v_season.name,
      'starts_at', v_season.starts_at, 'ends_at', v_season.ends_at,
      'days_left', greatest(0, ceil(extract(epoch from (v_season.ends_at - now())) / 86400))
    ),
    'progress', jsonb_build_object(
      'season_xp', v_progress.season_xp,
      'level', v_progress.level,
      'next_level_xp', (v_progress.level + 1) * 1000,
      'premium', v_progress.premium,
      'free_claims', v_progress.free_claims,
      'premium_claims', v_progress.premium_claims
    ),
    'rewards', v_rewards
  );
end $$;

revoke all on function public.get_season_status() from public;
grant execute on function public.get_season_status() to authenticated;

create or replace function public.add_season_xp(p_user_id uuid, p_amount int)
returns void language plpgsql security definer as $$
declare
  v_season_id int;
begin
  select id into v_season_id from public.seasons where now() between starts_at and ends_at order by starts_at desc limit 1;
  if v_season_id is null then return; end if;

  insert into public.user_season_progress (user_id, season_id) values (p_user_id, v_season_id) on conflict do nothing;

  update public.user_season_progress
     set season_xp = season_xp + p_amount,
         level = least(30, (season_xp + p_amount) / 1000),
         updated_at = now()
   where user_id = p_user_id and season_id = v_season_id;
end $$;

revoke all on function public.add_season_xp(uuid, int) from public;
grant execute on function public.add_season_xp(uuid, int) to authenticated;

create or replace function public.claim_season_reward(p_level int, p_track text)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_season_id int;
  v_progress record;
  v_reward record;
  v_kind text; v_amount int; v_label text;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'auth_required'); end if;
  if p_track not in ('free','premium') then return jsonb_build_object('ok', false, 'error', 'bad_track'); end if;

  select id into v_season_id from public.seasons where now() between starts_at and ends_at order by starts_at desc limit 1;
  if v_season_id is null then return jsonb_build_object('ok', false, 'error', 'no_season'); end if;

  select * into v_progress from public.user_season_progress where user_id = v_user and season_id = v_season_id;
  if v_progress.level < p_level then return jsonb_build_object('ok', false, 'error', 'level_too_low'); end if;
  if p_track = 'premium' and not v_progress.premium then return jsonb_build_object('ok', false, 'error', 'no_premium'); end if;

  if p_track = 'free' and p_level = any(v_progress.free_claims) then
    return jsonb_build_object('ok', false, 'error', 'already_claimed');
  end if;
  if p_track = 'premium' and p_level = any(v_progress.premium_claims) then
    return jsonb_build_object('ok', false, 'error', 'already_claimed');
  end if;

  select * into v_reward from public.season_rewards where level = p_level;
  if not found then return jsonb_build_object('ok', false, 'error', 'no_reward'); end if;

  if p_track = 'free' then
    v_kind := v_reward.free_kind; v_amount := v_reward.free_amount; v_label := v_reward.free_label;
    update public.user_season_progress set free_claims = array_append(free_claims, p_level), updated_at = now()
      where user_id = v_user and season_id = v_season_id;
  else
    v_kind := v_reward.premium_kind; v_amount := v_reward.premium_amount; v_label := v_reward.premium_label;
    update public.user_season_progress set premium_claims = array_append(premium_claims, p_level), updated_at = now()
      where user_id = v_user and season_id = v_season_id;
  end if;

  if v_kind = 'coins' then
    update public.users set wegemuenzen = coalesce(wegemuenzen, 0) + v_amount, xp = coalesce(xp, 0) + v_amount where id = v_user;
  elsif v_kind = 'gems' then
    insert into public.user_gems (user_id, gems) values (v_user, v_amount)
      on conflict (user_id) do update set gems = user_gems.gems + excluded.gems, total_purchased = coalesce(user_gems.total_purchased, 0) + excluded.gems;
  elsif v_kind in ('wood','stone','gold','mana') then
    update public.users set wegemuenzen = coalesce(wegemuenzen, 0) + v_amount where id = v_user;
  end if;

  return jsonb_build_object('ok', true, 'kind', v_kind, 'amount', v_amount, 'label', v_label);
end $$;

revoke all on function public.claim_season_reward(int, text) from public;
grant execute on function public.claim_season_reward(int, text) to authenticated;

create or replace function public.unlock_season_premium()
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_season_id int;
  v_gems int;
  v_cost int := 750;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'auth_required'); end if;

  select id into v_season_id from public.seasons where now() between starts_at and ends_at order by starts_at desc limit 1;
  if v_season_id is null then return jsonb_build_object('ok', false, 'error', 'no_season'); end if;

  select coalesce(gems, 0) into v_gems from public.user_gems where user_id = v_user;
  if v_gems < v_cost then
    return jsonb_build_object('ok', false, 'error', 'not_enough_gems', 'have', v_gems, 'need', v_cost);
  end if;

  update public.user_gems set gems = gems - v_cost, total_spent = coalesce(total_spent, 0) + v_cost, updated_at = now()
    where user_id = v_user;

  insert into public.user_season_progress (user_id, season_id, premium, premium_unlocked_at)
    values (v_user, v_season_id, true, now())
    on conflict (user_id, season_id) do update set premium = true, premium_unlocked_at = now();

  return jsonb_build_object('ok', true, 'cost', v_cost);
end $$;

revoke all on function public.unlock_season_premium() from public;
grant execute on function public.unlock_season_premium() to authenticated;
