-- ════════════════════════════════════════════════════════════════════
-- get_joinable_rallies() — alle laufenden Crew-Rallies (Repeater + Player-Base)
-- die der aufrufende User noch JOINen kann (in Crew, prep läuft, noch nicht drin)
-- ════════════════════════════════════════════════════════════════════
create or replace function public.get_joinable_rallies()
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_crew uuid;
  v_repeater jsonb;
  v_base jsonb;
begin
  if v_user is null then return jsonb_build_object('repeater', '[]'::jsonb, 'base', '[]'::jsonb); end if;
  select crew_id into v_crew from public.crew_members where user_id = v_user limit 1;
  if v_crew is null then return jsonb_build_object('repeater', '[]'::jsonb, 'base', '[]'::jsonb); end if;

  -- Repeater-Rallies: Crew-Mate hat angefangen, prep läuft, ich bin nicht drin
  select coalesce(jsonb_agg(jsonb_build_object(
    'rally_id',     r.id,
    'kind',         'repeater',
    'repeater_id',  cr.id,
    'leader_name',  coalesce(u.display_name, u.username),
    'target_label', cr.label,
    'target_kind',  cr.kind,
    'target_lat',   cr.lat,
    'target_lng',   cr.lng,
    'prep_ends_at', r.prep_ends_at,
    'total_atk',    r.total_atk,
    'participants', (select count(*) from public.crew_repeater_rally_participants p where p.rally_id = r.id)
  )), '[]'::jsonb) into v_repeater
    from public.crew_repeater_rallies r
    join public.crew_repeaters cr on cr.id = r.repeater_id
    join public.users u on u.id = r.leader_user_id
   where r.attacker_crew_id = v_crew
     and r.status = 'preparing'
     and r.prep_ends_at > now()
     and not exists (
       select 1 from public.crew_repeater_rally_participants p
        where p.rally_id = r.id and p.user_id = v_user
     );

  -- Player-Base-Rallies: gleiche Logik
  select coalesce(jsonb_agg(jsonb_build_object(
    'rally_id',     r.id,
    'kind',         'base',
    'leader_name',  coalesce(u.display_name, u.username),
    'target_label', coalesce(du.display_name, du.username),
    'target_lat',   r.defender_lat,
    'target_lng',   r.defender_lng,
    'prep_ends_at', r.prep_ends_at,
    'total_atk',    r.total_atk,
    'participants', (select count(*) from public.player_base_rally_participants p where p.rally_id = r.id)
  )), '[]'::jsonb) into v_base
    from public.player_base_rallies r
    join public.users u  on u.id  = r.leader_user_id
    join public.users du on du.id = r.defender_user_id
   where r.crew_id = v_crew
     and r.status = 'preparing'
     and r.prep_ends_at > now()
     and not exists (
       select 1 from public.player_base_rally_participants p
        where p.rally_id = r.id and p.user_id = v_user
     );

  return jsonb_build_object('repeater', v_repeater, 'base', v_base);
end $$;

revoke all on function public.get_joinable_rallies() from public;
grant execute on function public.get_joinable_rallies() to authenticated;
