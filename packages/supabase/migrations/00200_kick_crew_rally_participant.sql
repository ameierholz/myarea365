-- ─── 00200: Leader kann Teilnehmer aus Crew-Aufgebot werfen ────────
create or replace function public.kick_crew_rally_participant(p_rally_id uuid, p_user_id uuid)
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
  if p_user_id = r.leader_user_id then return jsonb_build_object('ok', false, 'error', 'cannot_kick_leader'); end if;

  select * into p from public.crew_repeater_rally_participants where rally_id = p_rally_id and user_id = p_user_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_participant'); end if;

  for k, v in select * from jsonb_each_text(p.troops_sent) loop
    insert into public.user_troops (user_id, troop_id, count)
    values (p.user_id, k, v::int)
    on conflict (user_id, troop_id) do update set count = public.user_troops.count + excluded.count;
  end loop;

  delete from public.crew_repeater_rally_participants where rally_id = p_rally_id and user_id = p_user_id;
  update public.crew_repeater_rallies
     set total_atk = greatest(0, total_atk - p.troop_atk)
   where id = p_rally_id;

  insert into public.user_inbox (user_id, title, body) values (
    p_user_id,
    '⚠️ Aus Crew-Aufgebot entfernt',
    'Der Anführer hat dich aus dem Crew-Aufgebot entfernt. Deine Truppen sind unbeschadet zurückgekehrt.'
  );

  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.kick_crew_rally_participant(uuid, uuid) to authenticated;
