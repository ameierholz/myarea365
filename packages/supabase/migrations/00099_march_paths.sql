-- ══════════════════════════════════════════════════════════════════════════
-- MARCH-PATHS: Lat/Lng auf base_attacks für Client-Animation auf der Karte
-- ══════════════════════════════════════════════════════════════════════════

alter table public.base_attacks
  add column if not exists outcome text,
  add column if not exists attacker_lat double precision,
  add column if not exists attacker_lng double precision,
  add column if not exists defender_lat double precision,
  add column if not exists defender_lng double precision;

-- outcome-Check sicher erweitern (alte Migration kannte keinen 'attacker_pillaged')
alter table public.base_attacks drop constraint if exists base_attacks_outcome_check;
alter table public.base_attacks
  add constraint base_attacks_outcome_check check
    (outcome is null or outcome in ('attacker_won','defender_won','draw','attacker_pillaged'));

-- Bei attack_crew_base() automatisch die Crew-Base-Koordinaten persistieren,
-- damit der Client später ohne Extra-Joins eine Lauflinie zeichnen kann.
create or replace function public.attack_crew_base(p_target_crew_id uuid, p_troops jsonb)
returns jsonb language plpgsql security definer as $$
declare
  v_user           uuid := auth.uid();
  v_attacker_crew  uuid;
  v_have           int;
  v_have_count     int;
  v_march_seconds  int := 600;
  v_attacker_base  record;
  v_defender_base  record;
  k text; v_cnt int;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select crew_id into v_attacker_crew from public.crew_members where user_id = v_user;
  if v_attacker_crew is null then return jsonb_build_object('ok', false, 'error', 'not_in_crew'); end if;
  if v_attacker_crew = p_target_crew_id then return jsonb_build_object('ok', false, 'error', 'self_attack'); end if;

  select * into v_attacker_base from public.crew_bases where crew_id = v_attacker_crew;
  select * into v_defender_base from public.crew_bases where crew_id = p_target_crew_id;
  if v_attacker_base is null or v_defender_base is null then
    return jsonb_build_object('ok', false, 'error', 'no_base');
  end if;

  -- Truppen-Bestand prüfen + abziehen
  for k, v_cnt in select * from jsonb_each_text(p_troops) loop
    select count into v_have from public.crew_troops
     where crew_id = v_attacker_crew and troop_id = k;
    if coalesce(v_have, 0) < v_cnt::int then
      return jsonb_build_object('ok', false, 'error', 'not_enough_troops', 'troop_id', k);
    end if;
    update public.crew_troops set count = count - v_cnt::int
     where crew_id = v_attacker_crew and troop_id = k;
  end loop;

  insert into public.base_attacks
    (attacker_crew_id, defender_crew_id, initiated_by, troops_committed, ends_at,
     attacker_lat, attacker_lng, defender_lat, defender_lng)
  values
    (v_attacker_crew, p_target_crew_id, v_user, p_troops,
     now() + (v_march_seconds || ' seconds')::interval,
     v_attacker_base.lat, v_attacker_base.lng,
     v_defender_base.lat, v_defender_base.lng);

  return jsonb_build_object('ok', true, 'march_seconds', v_march_seconds,
    'from', jsonb_build_object('lat', v_attacker_base.lat, 'lng', v_attacker_base.lng),
    'to',   jsonb_build_object('lat', v_defender_base.lat, 'lng', v_defender_base.lng));
end $$;
revoke all on function public.attack_crew_base(uuid, jsonb) from public;
grant execute on function public.attack_crew_base(uuid, jsonb) to authenticated;

-- get_active_marches() — laufende Märsche zur Anzeige auf der Karte
create or replace function public.get_active_marches()
returns jsonb language plpgsql security definer as $$
declare v_user uuid := auth.uid(); v_crew uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select crew_id into v_crew from public.crew_members where user_id = v_user;
  if v_crew is null then return jsonb_build_object('ok', true, 'marches', '[]'::jsonb); end if;

  return jsonb_build_object('ok', true,
    'marches', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id,
        'attacker_crew_id', a.attacker_crew_id,
        'defender_crew_id', a.defender_crew_id,
        'is_attacker', (a.attacker_crew_id = v_crew),
        'started_at', a.started_at,
        'ends_at', a.ends_at,
        'attacker_lat', a.attacker_lat, 'attacker_lng', a.attacker_lng,
        'defender_lat', a.defender_lat, 'defender_lng', a.defender_lng,
        'troops_committed', a.troops_committed
      )), '[]'::jsonb)
      from public.base_attacks a
      where a.resolved_at is null
        and a.ends_at > now() - interval '5 minutes'
        and (a.attacker_crew_id = v_crew or a.defender_crew_id = v_crew)
    ));
end $$;
revoke all on function public.get_active_marches() from public;
grant execute on function public.get_active_marches() to authenticated;
