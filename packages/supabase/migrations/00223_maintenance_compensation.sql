-- 00223_maintenance_compensation.sql
-- Admin-triggered Wartungs-Entschädigung an alle aktiven User via Inbox.

create table if not exists public.maintenance_events (
  id          uuid primary key default gen_random_uuid(),
  started_at  timestamptz not null default now(),
  reason      text not null,
  payload     jsonb not null default '{}'::jsonb,
  created_by  uuid references public.users(id),
  granted_at  timestamptz,
  granted_count int default 0
);

alter table public.maintenance_events enable row level security;

drop policy if exists "maintenance_events_admin_read" on public.maintenance_events;
create policy "maintenance_events_admin_read" on public.maintenance_events
  for select using (exists (select 1 from public.users u where u.id=auth.uid() and u.role in ('admin','super_admin')));

create or replace function public.grant_maintenance_compensation(p_event_id uuid)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.maintenance_events%rowtype;
  v_caller_role text;
  v_count int := 0;
  v_uid uuid;
begin
  select role::text into v_caller_role from public.users where id = auth.uid();
  if v_caller_role not in ('admin','super_admin') then
    raise exception 'forbidden_admin_only';
  end if;

  select * into v_event from public.maintenance_events where id = p_event_id;
  if not found then raise exception 'event_not_found'; end if;
  if v_event.granted_at is not null then raise exception 'already_granted'; end if;

  for v_uid in
    select id from public.users where coalesce(is_banned,false)=false
  loop
    insert into public.user_inbox (user_id, title, body, category, kind, payload, reward_payload, from_label)
    values (
      v_uid,
      coalesce(v_event.payload->>'title', 'Wartungs-Entschädigung'),
      coalesce(v_event.payload->>'body', v_event.reason),
      'system', 'maintenance',
      v_event.payload,
      v_event.payload,
      'System'
    );
    v_count := v_count + 1;
  end loop;

  update public.maintenance_events set granted_at = now(), granted_count = v_count where id = p_event_id;
  return v_count;
end;
$$;

revoke all on function public.grant_maintenance_compensation(uuid) from public;
grant execute on function public.grant_maintenance_compensation(uuid) to authenticated;
