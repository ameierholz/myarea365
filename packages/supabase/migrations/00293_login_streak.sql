-- 00293_login_streak.sql
-- Daily-Login-Streak (RoK/CoD-style) — 7-Tage-Kalender, Reset wenn ein Tag
-- ausgelassen wird, Belohnungen skalieren (Gems am Tag 7, RSS-Pakete dazwischen).
-- Schöner "Pflicht-Login"-Loop für Retention.

create table if not exists public.user_login_streaks (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  current_streak smallint not null default 0,
  longest_streak smallint not null default 0,
  last_claim_at  timestamptz,
  total_claims   integer not null default 0,
  updated_at     timestamptz not null default now()
);

alter table public.user_login_streaks enable row level security;
drop policy if exists "own_streak_select" on public.user_login_streaks;
create policy "own_streak_select" on public.user_login_streaks
  for select using (auth.uid() = user_id);

-- Reward-Kalender (deterministisch, 7 Tage Zyklus)
-- day_idx 1..7
create table if not exists public.login_streak_rewards (
  day_idx     smallint primary key check (day_idx between 1 and 7),
  gems        integer not null default 0,
  wood        integer not null default 0,
  stone       integer not null default 0,
  gold        integer not null default 0,
  mana        integer not null default 0,
  speed_token integer not null default 0,
  label       text not null
);

insert into public.login_streak_rewards (day_idx, gems, wood, stone, gold, mana, speed_token, label) values
  (1,   30,  500,  500,  500,  500, 0, 'Tag 1 — Willkommen zurück'),
  (2,   50, 1000, 1000, 1000, 1000, 0, 'Tag 2 — Schon dran'),
  (3,   80, 1500, 1500, 1500, 1500, 0, 'Tag 3 — Treuer Wächter'),
  (4,  120, 2000, 2000, 2000, 2000, 0, 'Tag 4 — Halbe Woche'),
  (5,  180, 3000, 3000, 3000, 3000, 0, 'Tag 5 — Streak-Held'),
  (6,  250, 4000, 4000, 4000, 4000, 0, 'Tag 6 — Fast da'),
  (7,  500, 6000, 6000, 6000, 6000, 1, 'Tag 7 — Max-Reward + Speed-Token')
on conflict (day_idx) do update set
  gems = excluded.gems,
  wood = excluded.wood,
  stone = excluded.stone,
  gold = excluded.gold,
  mana = excluded.mana,
  speed_token = excluded.speed_token,
  label = excluded.label;

-- Status-RPC: was kann der User claimen, was ist sein Streak-Stand?
create or replace function public.get_login_streak_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row record;
  v_today date := (now() at time zone 'utc')::date;
  v_last_date date;
  v_can_claim boolean := true;
  v_next_idx smallint := 1;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;

  select * into v_row from public.user_login_streaks where user_id = v_uid;
  if not found then
    return jsonb_build_object(
      'ok', true, 'current_streak', 0, 'longest_streak', 0,
      'can_claim', true, 'next_day_idx', 1, 'total_claims', 0,
      'rewards', (select jsonb_agg(row_to_json(r) order by day_idx) from public.login_streak_rewards r)
    );
  end if;

  v_last_date := (v_row.last_claim_at at time zone 'utc')::date;

  if v_last_date is not null and v_last_date >= v_today then
    v_can_claim := false;
  end if;

  -- Next-Idx = aktueller Streak + 1, mod 7
  if v_row.current_streak > 0 and v_last_date is not null and v_last_date = v_today - 1 then
    v_next_idx := ((v_row.current_streak) % 7) + 1;
  else
    v_next_idx := 1; -- Reset (Tag verpasst oder neu)
  end if;

  return jsonb_build_object(
    'ok', true,
    'current_streak', v_row.current_streak,
    'longest_streak', v_row.longest_streak,
    'last_claim_at', v_row.last_claim_at,
    'total_claims', v_row.total_claims,
    'can_claim', v_can_claim,
    'next_day_idx', v_next_idx,
    'rewards', (select jsonb_agg(row_to_json(r) order by day_idx) from public.login_streak_rewards r)
  );
end;
$$;

grant execute on function public.get_login_streak_status() to authenticated;


-- Claim-RPC: Reward für heute einlösen
create or replace function public.claim_login_streak()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row record;
  v_today date := (now() at time zone 'utc')::date;
  v_last_date date;
  v_new_streak smallint;
  v_idx smallint;
  v_reward record;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;

  select * into v_row from public.user_login_streaks where user_id = v_uid for update;
  if not found then
    insert into public.user_login_streaks (user_id, current_streak, longest_streak, last_claim_at, total_claims)
      values (v_uid, 1, 1, now(), 1);
    v_idx := 1;
  else
    v_last_date := (v_row.last_claim_at at time zone 'utc')::date;
    if v_last_date >= v_today then
      return jsonb_build_object('ok', false, 'error', 'already_claimed_today');
    end if;
    if v_last_date = v_today - 1 then
      v_new_streak := v_row.current_streak + 1;
    else
      v_new_streak := 1;
    end if;
    v_idx := ((v_new_streak - 1) % 7) + 1;
    update public.user_login_streaks set
      current_streak = v_new_streak,
      longest_streak = greatest(v_row.longest_streak, v_new_streak),
      last_claim_at  = now(),
      total_claims   = v_row.total_claims + 1,
      updated_at     = now()
    where user_id = v_uid;
  end if;

  select * into v_reward from public.login_streak_rewards where day_idx = v_idx;

  -- Gems gutschreiben (user_gems.gems)
  if v_reward.gems > 0 then
    update public.user_gems set gems = gems + v_reward.gems where user_id = v_uid;
    if not found then
      insert into public.user_gems (user_id, gems) values (v_uid, v_reward.gems);
    end if;
  end if;

  -- RSS gutschreiben (user_resources — kanonischer Tabellenname)
  if v_reward.wood > 0 or v_reward.stone > 0 or v_reward.gold > 0 or v_reward.mana > 0 or v_reward.speed_token > 0 then
    update public.user_resources set
      wood          = wood          + v_reward.wood,
      stone         = stone         + v_reward.stone,
      gold          = gold          + v_reward.gold,
      mana          = mana          + v_reward.mana,
      speed_tokens  = coalesce(speed_tokens, 0) + v_reward.speed_token
    where user_id = v_uid;
    if not found then
      insert into public.user_resources (user_id, wood, stone, gold, mana, speed_tokens)
        values (v_uid, v_reward.wood, v_reward.stone, v_reward.gold, v_reward.mana, v_reward.speed_token);
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'day_idx', v_idx,
    'gems', v_reward.gems,
    'wood', v_reward.wood,
    'stone', v_reward.stone,
    'gold', v_reward.gold,
    'mana', v_reward.mana,
    'speed_token', v_reward.speed_token,
    'label', v_reward.label
  );
end;
$$;

grant execute on function public.claim_login_streak() to authenticated;
