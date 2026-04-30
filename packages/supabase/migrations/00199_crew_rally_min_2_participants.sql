-- ─── 00199: Mindestens 2 Crew-Mitglieder pro Aufgebot ──────────────
-- Wenn nach Ablauf der Sammelphase nur der Leader dabei ist, wird das
-- Aufgebot automatisch aufgelöst → Truppen zurück + Inbox-Nachricht.
-- Greift in resolve_due_crew_repeater_rallies vor dem marching-Übergang.

create or replace function public.resolve_due_crew_repeater_rallies()
returns int language plpgsql security definer as $$
declare
  v_count int := 0;
  r record;
  rep record;
  p record;
  v_dmg int;
  v_new_hp int;
  v_outcome text;
  v_loss_pct numeric;
  v_losses jsonb;
  k text; v int;
begin
  -- Solo-Aufgebote (< 2 Teilnehmer, prep abgelaufen) → abort + Refund + Inbox
  for r in
    select rr.*, (select count(*)::int from public.crew_repeater_rally_participants p where p.rally_id = rr.id) as part_count
      from public.crew_repeater_rallies rr
     where rr.status='preparing' and rr.prep_ends_at <= now()
     for update skip locked
  loop
    if r.part_count < 2 then
      for p in select * from public.crew_repeater_rally_participants where rally_id = r.id loop
        for k, v in select * from jsonb_each_text(p.troops_sent) loop
          insert into public.user_troops (user_id, troop_id, count)
          values (p.user_id, k, v::int)
          on conflict (user_id, troop_id) do update set count = public.user_troops.count + excluded.count;
        end loop;
      end loop;

      update public.crew_repeater_rallies
         set status='aborted', outcome='aborted', resolved_at=now()
       where id = r.id;

      insert into public.user_inbox (user_id, title, body) values (
        r.leader_user_id,
        '⚠️ Aufgebot aufgelöst',
        'Dein Crew-Aufgebot wurde aufgelöst, weil sich kein weiterer Crew-Mate angeschlossen hat. Es werden mindestens 2 Crew-Mitglieder benötigt. Deine Truppen sind unbeschadet zurückgekehrt.'
      );
      v_count := v_count + 1;
    else
      update public.crew_repeater_rallies
         set status='marching', march_ends_at = now() + interval '60 seconds'
       where id = r.id;
    end if;
  end loop;

  -- Marching → Resolve (Originalpfad)
  for r in
    select * from public.crew_repeater_rallies
     where status='marching' and march_ends_at <= now()
     for update skip locked
  loop
    select id, crew_id, hp, max_hp, kind, label, lat, lng into rep
      from public.crew_repeaters where id = r.repeater_id and destroyed_at is null
      for update;

    if rep is null then
      update public.crew_repeater_rallies set status='aborted', outcome='aborted', resolved_at=now() where id = r.id;
      continue;
    end if;

    v_dmg := greatest(400, (r.total_atk * 0.7)::int);
    v_new_hp := greatest(0, rep.hp - v_dmg);
    v_outcome := case when v_new_hp = 0 then 'attacker_won' else 'defender_won' end;
    v_loss_pct := case when v_outcome='attacker_won' then 0.18 else 0.40 end;

    if v_outcome = 'attacker_won' then
      update public.crew_repeaters set hp = 0, destroyed_at = now() where id = rep.id;
    else
      update public.crew_repeaters set hp = v_new_hp where id = rep.id;
    end if;

    update public.crew_repeater_rallies
       set status='done', outcome=v_outcome, hp_before=rep.hp, hp_after=v_new_hp, hp_damage=v_dmg, resolved_at=now()
     where id = r.id;

    for p in
      select * from public.crew_repeater_rally_participants where rally_id = r.id
    loop
      v_losses := '{}'::jsonb;
      for k, v in select * from jsonb_each_text(p.troops_sent) loop
        declare v_lost int := ((v::int) * v_loss_pct)::int;
                v_back int := (v::int) - v_lost;
        begin
          v_losses := v_losses || jsonb_build_object(k, v_lost);
          if v_back > 0 then
            insert into public.user_troops (user_id, troop_id, count)
            values (p.user_id, k, v_back)
            on conflict (user_id, troop_id) do update set count = public.user_troops.count + excluded.count;
          end if;
        end;
      end loop;

      insert into public.user_inbox (user_id, title, body) values (
        p.user_id,
        case when v_outcome='attacker_won' then '⚔️ Crew-Angriff erfolgreich' else '⚔️ Crew-Angriff abgewehrt' end,
        format('Aufgebot vs Repeater "%s" — Crew-Schaden %s HP (jetzt %s/%s). Deine Verluste: %s',
               coalesce(rep.label, rep.kind), v_dmg, v_new_hp, rep.max_hp, v_losses::text)
      );
    end loop;

    insert into public.user_inbox (user_id, title, body)
    select cm.user_id,
      case when v_outcome='attacker_won' then '🚨 Repeater fällt' else '🛡️ Repeater hält' end,
      format('Crew-Aufgebot griff "%s" an. Schaden %s HP. %s',
             coalesce(rep.label, rep.kind), v_dmg,
             case when v_outcome='attacker_won' then '✗ Repeater offline.' else 'Verteidigung erfolgreich.' end)
      from public.crew_members cm where cm.crew_id = rep.crew_id;

    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
