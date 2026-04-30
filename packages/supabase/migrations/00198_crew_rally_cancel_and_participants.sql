-- ─── 00198: cancel + get participants ──────────────────────────────
-- Leader kann ein Crew-Aufgebot vor dem Anmarsch abbrechen → Truppen-Refund.
-- Participants-RPC für die UI-Aufklappansicht.

create or replace function public.cancel_crew_repeater_rally(p_rally_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  r record;
  p record;
  k text; v int;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'auth_required'); end if;

  select * into r from public.crew_repeater_rallies where id = p_rally_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if r.leader_user_id <> v_user then return jsonb_build_object('ok', false, 'error', 'not_leader'); end if;
  if r.status <> 'preparing' then return jsonb_build_object('ok', false, 'error', 'too_late'); end if;

  for p in select * from public.crew_repeater_rally_participants where rally_id = r.id loop
    for k, v in select * from jsonb_each_text(p.troops_sent) loop
      insert into public.user_troops (user_id, troop_id, count)
      values (p.user_id, k, v::int)
      on conflict (user_id, troop_id) do update set count = public.user_troops.count + excluded.count;
    end loop;
    insert into public.user_inbox (user_id, title, body) values (
      p.user_id,
      '⚠️ Aufgebot abgebrochen',
      'Der Anführer hat das Crew-Aufgebot vor dem Anmarsch abgebrochen. Deine Truppen sind unbeschadet zurückgekehrt.'
    );
  end loop;

  update public.crew_repeater_rallies
     set status='aborted', outcome='aborted', resolved_at=now()
   where id = r.id;

  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.cancel_crew_repeater_rally(uuid) to authenticated;

create or replace function public.get_crew_rally_participants(p_rally_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_allowed boolean;
  v_result jsonb;
begin
  if v_user is null then return jsonb_build_object('participants', '[]'::jsonb); end if;
  select exists (
    select 1 from public.crew_repeater_rallies r
    join public.crew_repeaters cr on cr.id = r.repeater_id
    where r.id = p_rally_id
      and (
        r.attacker_crew_id in (select crew_id from public.crew_members where user_id = v_user)
        or cr.crew_id      in (select crew_id from public.crew_members where user_id = v_user)
      )
  ) into v_allowed;
  if not v_allowed then return jsonb_build_object('participants', '[]'::jsonb); end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', p.user_id,
    'name', coalesce(u.display_name, u.username, '—'),
    'troops_sent', p.troops_sent,
    'troop_atk', p.troop_atk,
    'joined_at', p.joined_at,
    'is_leader', (p.user_id = (select leader_user_id from public.crew_repeater_rallies where id = p.rally_id))
  ) order by p.joined_at), '[]'::jsonb) into v_result
    from public.crew_repeater_rally_participants p
    left join public.users u on u.id = p.user_id
   where p.rally_id = p_rally_id;
  return jsonb_build_object('participants', v_result);
end $$;
grant execute on function public.get_crew_rally_participants(uuid) to authenticated;
