-- ─── 00196: get_active_crew_repeater_rallies ───────────────────────
-- Liefert aktive Crew-Repeater-Rallies für den aktuellen User
-- (sowohl als Angreifer-Crew-Mitglied als auch als Verteidiger-Crew-Mitglied).
-- Tickt vorab via resolve_due_crew_repeater_rallies(), damit fertige
-- Rallies den Status wechseln und nicht mehr zurückkommen.

create or replace function public.get_active_crew_repeater_rallies()
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_result jsonb;
begin
  if v_user is null then
    return jsonb_build_object('rallies', '[]'::jsonb);
  end if;

  -- Tick: preparing→marching→done (mit Inbox-Reports)
  begin
    perform public.resolve_due_crew_repeater_rallies();
  exception when others then
    -- darf den Read nicht blockieren
    null;
  end;

  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.created_at desc), '[]'::jsonb)
    into v_result
    from (
      select
        rr.id,
        rr.status,
        rr.prep_seconds,
        rr.prep_ends_at,
        rr.march_ends_at,
        rr.total_atk,
        rr.created_at,
        rr.leader_user_id,
        rr.attacker_crew_id,
        rr.repeater_id,
        ac.tag       as attacker_crew_tag,
        ac.name      as attacker_crew_name,
        rep.crew_id  as defender_crew_id,
        dc.tag       as defender_crew_tag,
        dc.name      as defender_crew_name,
        rep.kind     as repeater_kind,
        rep.label    as repeater_label,
        rep.lat      as repeater_lat,
        rep.lng      as repeater_lng,
        rep.hp       as repeater_hp,
        rep.max_hp   as repeater_max_hp,
        coalesce(u.display_name, u.username) as leader_name,
        (select count(*)::int from public.crew_repeater_rally_participants p where p.rally_id = rr.id) as participant_count,
        (rr.attacker_crew_id in (select crew_id from public.crew_members where user_id = v_user)) as is_attacker,
        (rep.crew_id in (select crew_id from public.crew_members where user_id = v_user)) as is_defender
      from public.crew_repeater_rallies rr
      join public.crew_repeaters rep on rep.id = rr.repeater_id
      left join public.crews ac on ac.id = rr.attacker_crew_id
      left join public.crews dc on dc.id = rep.crew_id
      left join public.users u on u.id = rr.leader_user_id
      where rr.status in ('preparing','marching','fighting')
        and (
          rr.attacker_crew_id in (select crew_id from public.crew_members where user_id = v_user)
          or rep.crew_id      in (select crew_id from public.crew_members where user_id = v_user)
        )
    ) t;

  return jsonb_build_object('rallies', v_result);
end $$;

grant execute on function public.get_active_crew_repeater_rallies() to authenticated;

-- Realtime: damit der Banner sofort aktualisiert wenn sich Status ändert
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname='supabase_realtime' and schemaname='public' and tablename='crew_repeater_rallies'
  ) then
    alter publication supabase_realtime add table public.crew_repeater_rallies;
  end if;
end $$;
