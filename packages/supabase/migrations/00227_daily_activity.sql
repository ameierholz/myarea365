-- 00227_daily_activity.sql
-- Tägliche Aktivitäts-Punkte mit Threshold-Belohnungen.

create table if not exists public.daily_activity_thresholds (
  level             int primary key,
  points_required   int not null,
  reward_payload    jsonb not null default '{}'::jsonb
);

create table if not exists public.user_daily_activity (
  user_id          uuid not null references public.users(id) on delete cascade,
  date             date not null default current_date,
  points           int not null default 0,
  claimed_levels   int[] not null default '{}',
  updated_at       timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.daily_activity_thresholds enable row level security;
alter table public.user_daily_activity enable row level security;
drop policy if exists "thresholds_read_all" on public.daily_activity_thresholds;
create policy "thresholds_read_all" on public.daily_activity_thresholds for select using (true);
drop policy if exists "user_daily_activity_self" on public.user_daily_activity;
create policy "user_daily_activity_self" on public.user_daily_activity for select using (user_id = auth.uid());

create or replace function public.add_activity_points(p_user_id uuid, p_points int)
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare v_total int;
begin
  if p_points <= 0 then return 0; end if;
  insert into public.user_daily_activity (user_id, date, points, updated_at)
  values (p_user_id, current_date, p_points, now())
  on conflict (user_id, date) do update
    set points = user_daily_activity.points + excluded.points, updated_at = now()
  returning points into v_total;
  return v_total;
end; $$;

create or replace function public.claim_activity_reward(p_level int)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_thr public.daily_activity_thresholds%rowtype;
  v_act public.user_daily_activity%rowtype;
  v_gems int; v_items jsonb; v_item jsonb;
begin
  if v_uid is null then raise exception 'unauthorized'; end if;
  select * into v_thr from public.daily_activity_thresholds where level = p_level;
  if not found then raise exception 'level_not_found'; end if;
  select * into v_act from public.user_daily_activity where user_id=v_uid and date=current_date for update;
  if not found or v_act.points < v_thr.points_required then
    return jsonb_build_object('ok', false, 'error', 'points_too_low',
                              'have', coalesce(v_act.points, 0), 'need', v_thr.points_required);
  end if;
  if p_level = any(v_act.claimed_levels) then
    return jsonb_build_object('ok', false, 'error', 'already_claimed');
  end if;
  update public.user_daily_activity set claimed_levels = array_append(claimed_levels, p_level)
    where user_id=v_uid and date=current_date;

  v_gems := coalesce((v_thr.reward_payload->>'gems')::int, 0);
  if v_gems > 0 then
    insert into public.user_gems (user_id, gems) values (v_uid, v_gems)
    on conflict (user_id) do update set gems = user_gems.gems + v_gems, updated_at = now();
    insert into public.gem_transactions (user_id, delta, reason, metadata)
    values (v_uid, v_gems, 'daily_activity', jsonb_build_object('level', p_level));
  end if;
  v_items := coalesce(v_thr.reward_payload->'items', '[]'::jsonb);
  for v_item in select * from jsonb_array_elements(v_items) loop
    perform public.grant_inventory_item(v_uid, v_item->>'catalog_id', coalesce((v_item->>'count')::int, 1));
  end loop;
  return jsonb_build_object('ok', true, 'reward', v_thr.reward_payload);
end; $$;

revoke all on function public.add_activity_points(uuid, int) from public;
revoke all on function public.claim_activity_reward(int) from public;
grant execute on function public.add_activity_points(uuid, int) to authenticated;
grant execute on function public.claim_activity_reward(int) to authenticated;

insert into public.daily_activity_thresholds (level, points_required, reward_payload) values
  (1,  50,  jsonb_build_object('items', jsonb_build_array(jsonb_build_object('catalog_id', 'chest_silver', 'count', 1)))),
  (2, 100,  jsonb_build_object('items', jsonb_build_array(jsonb_build_object('catalog_id', 'chest_gold', 'count', 1)))),
  (3, 200,  jsonb_build_object('gems', 50)),
  (4, 400,  jsonb_build_object('gems', 100, 'items', jsonb_build_array(jsonb_build_object('catalog_id', 'chest_legendary', 'count', 1))))
on conflict (level) do nothing;
