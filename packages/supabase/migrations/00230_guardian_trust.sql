-- 00230_guardian_trust.sql
-- Wächter-Vertrauen: Chat-Cooldown, XP, Level-Up Belohnungen.

create table if not exists public.guardian_trust (
  user_id          uuid not null references public.users(id) on delete cascade,
  guardian_id      uuid not null references public.user_guardians(id) on delete cascade,
  trust_level      int not null default 1,
  trust_xp         int not null default 0,
  last_chat_at     timestamptz,
  dialog_unlocks   int[] not null default '{}',
  updated_at       timestamptz not null default now(),
  primary key (user_id, guardian_id)
);

alter table public.guardian_trust enable row level security;
drop policy if exists "guardian_trust_self" on public.guardian_trust;
create policy "guardian_trust_self" on public.guardian_trust for select using (user_id = auth.uid());

-- XP-Bedarf für Level n→n+1: 10 * fib-artig (10/30/100/300/1000/3000/...)
create or replace function public.guardian_trust_xp_for_level(p_level int)
returns int language sql immutable as $$
  select case p_level
    when 1 then 10 when 2 then 30 when 3 then 100 when 4 then 300
    when 5 then 1000 when 6 then 3000 when 7 then 8000
    when 8 then 20000 when 9 then 50000 else 100000 end;
$$;

create or replace function public.chat_with_guardian(p_guardian_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_row public.guardian_trust%rowtype;
  v_xp_gain int;
  v_need int;
  v_levels_gained int := 0;
  v_gems int := 0;
begin
  if v_uid is null then raise exception 'unauthorized'; end if;
  if not exists (select 1 from public.user_guardians where id = p_guardian_id and user_id = v_uid) then
    raise exception 'guardian_not_owned';
  end if;

  insert into public.guardian_trust (user_id, guardian_id) values (v_uid, p_guardian_id)
  on conflict do nothing;
  select * into v_row from public.guardian_trust where user_id=v_uid and guardian_id=p_guardian_id for update;

  if v_row.last_chat_at is not null and v_row.last_chat_at > now() - interval '24 hours' then
    return jsonb_build_object('ok', false, 'error', 'cooldown',
                              'next_at', v_row.last_chat_at + interval '24 hours');
  end if;

  v_xp_gain := 5 + floor(random() * 10)::int;
  v_row.trust_xp := v_row.trust_xp + v_xp_gain;

  loop
    if v_row.trust_level >= 10 then exit; end if;
    v_need := public.guardian_trust_xp_for_level(v_row.trust_level);
    if v_row.trust_xp < v_need then exit; end if;
    v_row.trust_xp := v_row.trust_xp - v_need;
    v_row.trust_level := v_row.trust_level + 1;
    v_row.dialog_unlocks := array_append(v_row.dialog_unlocks, v_row.trust_level);
    v_levels_gained := v_levels_gained + 1;
    v_gems := v_gems + 20 * v_row.trust_level;
  end loop;

  update public.guardian_trust set
    trust_level = v_row.trust_level, trust_xp = v_row.trust_xp,
    last_chat_at = now(), dialog_unlocks = v_row.dialog_unlocks, updated_at = now()
  where user_id=v_uid and guardian_id=p_guardian_id;

  if v_gems > 0 then
    insert into public.user_gems (user_id, gems) values (v_uid, v_gems)
    on conflict (user_id) do update set gems = user_gems.gems + v_gems, updated_at = now();
    insert into public.gem_transactions (user_id, delta, reason, metadata)
    values (v_uid, v_gems, 'guardian_trust_levelup', jsonb_build_object('guardian_id', p_guardian_id, 'levels', v_levels_gained));
  end if;

  return jsonb_build_object('ok', true, 'xp_gained', v_xp_gain, 'levels_gained', v_levels_gained,
                            'trust_level', v_row.trust_level, 'trust_xp', v_row.trust_xp, 'gems_reward', v_gems);
end; $$;

revoke all on function public.chat_with_guardian(uuid) from public;
grant execute on function public.chat_with_guardian(uuid) to authenticated;
