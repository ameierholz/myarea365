-- ─── 00202: cancel_player_base_rally — Inbox an alle Teilnehmer + Defender ─
-- Vorher: Refund only. Jetzt zusätzlich Inbox-Nachricht für jeden Teilnehmer
-- und Info an den Verteidiger (er hatte die Bedrohung im Banner).

create or replace function public.cancel_player_base_rally(p_rally_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  r record;
  p record;
  k text; v_cnt int;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select * into r from public.player_base_rallies where id = p_rally_id for update;
  if r is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if r.leader_user_id <> v_user then return jsonb_build_object('ok', false, 'error', 'not_leader'); end if;
  if r.status <> 'preparing' then return jsonb_build_object('ok', false, 'error', 'not_in_prep'); end if;

  for p in select * from public.player_base_rally_participants where rally_id = p_rally_id loop
    for k, v_cnt in select * from jsonb_each_text(p.troops) loop
      if v_cnt::int <= 0 then continue; end if;
      insert into public.user_troops (user_id, troop_id, count)
      values (p.user_id, k, v_cnt::int)
      on conflict (user_id, troop_id) do update set count = public.user_troops.count + excluded.count;
    end loop;

    insert into public.user_inbox (user_id, title, body) values (
      p.user_id,
      '⚠️ Crew-Aufgebot abgebrochen',
      'Der Anführer hat das Crew-Aufgebot gegen die Spieler-Base vor dem Anmarsch abgebrochen. Deine Truppen sind unbeschadet zurückgekehrt.'
    );
  end loop;

  insert into public.user_inbox (user_id, title, body) values (
    r.defender_user_id,
    'ℹ️ Angriff abgesagt',
    'Ein Crew-Aufgebot gegen deine Base wurde vom Anführer abgebrochen, bevor es losgehen konnte.'
  );

  update public.player_base_rallies set status='aborted', outcome='aborted', resolved_at=now()
   where id = p_rally_id;
  return jsonb_build_object('ok', true);
end $$;
