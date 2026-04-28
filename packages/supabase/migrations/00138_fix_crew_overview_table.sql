-- Fix: get_crew_overview referenzierte non-existente Tabelle "claimed_streets"
-- (heißt tatsächlich "streets_claimed", siehe 00012_street_territory_model.sql)
create or replace function public.get_crew_overview(p_crew_id uuid default null)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_crew uuid;
  v_crew_row record;
  v_ansehen_total bigint;
  v_member_count int;
  v_repeater_count int;
  v_territory_count int;
  v_resources record;
  v_leader record;
begin
  if v_user is null then return jsonb_build_object('error', 'auth_required'); end if;

  if p_crew_id is null then
    select crew_id into v_crew from public.crew_members where user_id = v_user limit 1;
  else
    v_crew := p_crew_id;
  end if;
  if v_crew is null then return jsonb_build_object('error', 'no_crew'); end if;

  select * into v_crew_row from public.crews where id = v_crew;
  if v_crew_row is null then return jsonb_build_object('error', 'crew_not_found'); end if;

  select coalesce(sum(u.ansehen), 0) into v_ansehen_total
    from public.crew_members cm
    join public.users u on u.id = cm.user_id
   where cm.crew_id = v_crew;

  select count(*) into v_member_count from public.crew_members where crew_id = v_crew;

  select count(*) into v_repeater_count
    from public.crew_repeaters where crew_id = v_crew and destroyed_at is null;

  -- Territorium-Approximation: streets_claimed aller Crew-Mitglieder
  select count(distinct sc.street_name) into v_territory_count
    from public.crew_members cm
    left join public.streets_claimed sc on sc.user_id = cm.user_id
   where cm.crew_id = v_crew;

  select * into v_resources from public.crew_resources where crew_id = v_crew;

  select id, coalesce(display_name, username) as name, ansehen
    into v_leader
    from public.users
   where id = v_crew_row.owner_id;

  return jsonb_build_object(
    'crew', jsonb_build_object(
      'id', v_crew_row.id,
      'name', v_crew_row.name,
      'tag', upper(left(regexp_replace(coalesce(v_crew_row.name, '?'), '[^a-zA-Z0-9]', '', 'g'), 4)),
      'color', v_crew_row.color,
      'zip', v_crew_row.zip,
      'created_at', v_crew_row.created_at
    ),
    'leader', case when v_leader is null then null else jsonb_build_object(
      'id', v_leader.id, 'name', v_leader.name, 'ansehen', v_leader.ansehen
    ) end,
    'stats', jsonb_build_object(
      'ansehen_total',   v_ansehen_total,
      'member_count',    v_member_count,
      'repeater_count',  v_repeater_count,
      'territory_count', v_territory_count
    ),
    'resources', case when v_resources is null then null else jsonb_build_object(
      'wood',  coalesce(v_resources.wood,  0),
      'stone', coalesce(v_resources.stone, 0),
      'gold',  coalesce(v_resources.gold,  0),
      'mana',  coalesce(v_resources.mana,  0)
    ) end
  );
end $$;
revoke all on function public.get_crew_overview(uuid) from public;
grant execute on function public.get_crew_overview(uuid) to authenticated;
