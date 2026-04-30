-- ─── 00201: Cancel-Funktion für Wegelager-Rallies + erweiterte Liste ──
-- 1) cancel_rally(rally_id) — Leader-only, nur preparing, refund + Inbox
-- 2) get_joinable_rallies liefert jetzt zusätzlich `stronghold` (Wegelager)

create or replace function public.cancel_rally(p_rally_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  r record;
  p record;
  k text; v int;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'auth_required'); end if;
  select * into r from public.rallies where id = p_rally_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if r.leader_user_id <> v_user then return jsonb_build_object('ok', false, 'error', 'not_leader'); end if;
  if r.status <> 'preparing' then return jsonb_build_object('ok', false, 'error', 'too_late'); end if;

  for p in select * from public.rally_participants where rally_id = r.id loop
    for k, v in select * from jsonb_each_text(p.troops) loop
      insert into public.user_troops (user_id, troop_id, count)
      values (p.user_id, k, v::int)
      on conflict (user_id, troop_id) do update set count = public.user_troops.count + excluded.count;
    end loop;
    insert into public.user_inbox (user_id, title, body) values (
      p.user_id,
      '⚠️ Wegelager-Aufgebot abgebrochen',
      'Der Anführer hat das Wegelager-Aufgebot vor dem Anmarsch abgebrochen. Deine Truppen sind unbeschadet zurückgekehrt.'
    );
  end loop;

  update public.rallies set status='aborted', resolved_at=now() where id = r.id;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.cancel_rally(uuid) to authenticated;

-- get_joinable_rallies erweitert um Wegelager
create or replace function public.get_joinable_rallies()
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_crew uuid;
  v_repeater jsonb;
  v_base jsonb;
  v_stronghold jsonb;
begin
  if v_user is null then return jsonb_build_object('repeater','[]'::jsonb,'base','[]'::jsonb,'stronghold','[]'::jsonb); end if;
  select crew_id into v_crew from public.crew_members where user_id = v_user limit 1;
  if v_crew is null then return jsonb_build_object('repeater','[]'::jsonb,'base','[]'::jsonb,'stronghold','[]'::jsonb); end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'rally_id', r.id, 'kind', 'repeater', 'status', r.status,
    'repeater_id', cr.id,
    'leader_name', coalesce(u.display_name, u.username),
    'target_label', cr.label, 'target_kind', cr.kind,
    'target_lat', cr.lat, 'target_lng', cr.lng,
    'prep_ends_at', r.prep_ends_at, 'march_ends_at', r.march_ends_at,
    'total_atk', r.total_atk,
    'participants', (select count(*) from public.crew_repeater_rally_participants p where p.rally_id = r.id),
    'i_joined', exists (select 1 from public.crew_repeater_rally_participants p where p.rally_id = r.id and p.user_id = v_user),
    'is_leader', (r.leader_user_id = v_user)
  ) order by r.created_at desc), '[]'::jsonb) into v_repeater
    from public.crew_repeater_rallies r
    join public.crew_repeaters cr on cr.id = r.repeater_id
    join public.users u on u.id = r.leader_user_id
   where r.attacker_crew_id = v_crew and r.status in ('preparing','marching','fighting');

  select coalesce(jsonb_agg(jsonb_build_object(
    'rally_id', r.id, 'kind', 'base', 'status', r.status,
    'leader_name', coalesce(u.display_name, u.username),
    'target_label', coalesce(du.display_name, du.username),
    'target_lat', r.defender_lat, 'target_lng', r.defender_lng,
    'prep_ends_at', r.prep_ends_at, 'march_ends_at', r.march_ends_at,
    'total_atk', r.total_atk,
    'participants', (select count(*) from public.player_base_rally_participants p where p.rally_id = r.id),
    'i_joined', exists (select 1 from public.player_base_rally_participants p where p.rally_id = r.id and p.user_id = v_user),
    'is_leader', (r.leader_user_id = v_user)
  ) order by r.created_at desc), '[]'::jsonb) into v_base
    from public.player_base_rallies r
    join public.users u on u.id = r.leader_user_id
    join public.users du on du.id = r.defender_user_id
   where r.crew_id = v_crew and r.status in ('preparing','marching','fighting');

  select coalesce(jsonb_agg(jsonb_build_object(
    'rally_id', r.id, 'kind', 'stronghold', 'status', r.status,
    'leader_name', coalesce(u.display_name, u.username),
    'target_label', coalesce(s.name, 'Wegelager'),
    'target_lat', s.lat, 'target_lng', s.lng,
    'target_level', s.level,
    'prep_ends_at', r.prep_ends_at, 'march_ends_at', r.march_ends_at,
    'total_atk', r.total_atk,
    'participants', (select count(*) from public.rally_participants p where p.rally_id = r.id),
    'i_joined', exists (select 1 from public.rally_participants p where p.rally_id = r.id and p.user_id = v_user),
    'is_leader', (r.leader_user_id = v_user)
  ) order by r.created_at desc), '[]'::jsonb) into v_stronghold
    from public.rallies r
    join public.strongholds s on s.id = r.stronghold_id
    join public.users u on u.id = r.leader_user_id
   where r.crew_id = v_crew and r.status in ('preparing','marching','fighting');

  return jsonb_build_object('repeater', v_repeater, 'base', v_base, 'stronghold', v_stronghold);
end $$;
