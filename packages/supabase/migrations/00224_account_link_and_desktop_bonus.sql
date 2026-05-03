-- 00224_account_link_and_desktop_bonus.sql
-- One-Shot Belohnungen für Account-Verknüpfungen / Desktop-Web-Login.

create table if not exists public.user_link_bonuses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  kind        text not null,
  granted_at  timestamptz not null default now(),
  gems        int not null default 0,
  unique(user_id, kind)
);

alter table public.user_link_bonuses enable row level security;
drop policy if exists "link_bonus_self_read" on public.user_link_bonuses;
create policy "link_bonus_self_read" on public.user_link_bonuses
  for select using (user_id = auth.uid());

create or replace function public.grant_link_bonus(p_user_id uuid, p_kind text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_gems int;
  v_caller uuid := auth.uid();
  v_caller_role text;
begin
  if p_user_id is null or p_kind is null then raise exception 'bad_args'; end if;
  -- Self-grant erlaubt; admin darf für andere
  if v_caller is distinct from p_user_id then
    select role::text into v_caller_role from public.users where id = v_caller;
    if v_caller_role not in ('admin','super_admin') then
      raise exception 'forbidden';
    end if;
  end if;

  v_gems := case p_kind
    when 'google'      then 200
    when 'apple'       then 200
    when 'discord'     then 150
    when 'desktop_web' then 50
    when 'mobile_app'  then 100
    else 50
  end;

  begin
    insert into public.user_link_bonuses (user_id, kind, gems) values (p_user_id, p_kind, v_gems);
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'already_granted');
  end;

  -- Gems gutschreiben
  insert into public.user_gems (user_id, gems) values (p_user_id, v_gems)
  on conflict (user_id) do update set gems = user_gems.gems + v_gems, updated_at = now();

  insert into public.gem_transactions (user_id, delta, reason, metadata)
  values (p_user_id, v_gems, 'link_bonus', jsonb_build_object('kind', p_kind));

  insert into public.user_inbox (user_id, title, body, category, kind, payload, from_label)
  values (p_user_id, 'Bonus erhalten', 'Du hast '||v_gems||' Gems für '||p_kind||' erhalten.', 'system', 'link_bonus',
          jsonb_build_object('kind', p_kind, 'gems', v_gems), 'System');

  return jsonb_build_object('ok', true, 'gems', v_gems);
end;
$$;

revoke all on function public.grant_link_bonus(uuid, text) from public;
grant execute on function public.grant_link_bonus(uuid, text) to authenticated;
