-- ════════════════════════════════════════════════════════════════════
-- Bugfix: place_crew_building Bootstrap-Exception
-- ════════════════════════════════════════════════════════════════════
-- Wenn die Crew noch keinen Repeater hat = kein Turf = vorher ging Placement
-- nie. Jetzt: erstes Bauwerk darf irgendwo gesetzt werden falls die Crew
-- noch keinen einzigen Repeater hat (Bootstrap).
-- ════════════════════════════════════════════════════════════════════

create or replace function public.place_crew_building(
  p_kind text,
  p_lat double precision,
  p_lng double precision,
  p_label text default null,
  p_kind_data jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_crew uuid;
  v_role text;
  v_stats record;
  v_existing_count int;
  v_id uuid;
  v_res record;
  v_in_own_turf boolean;
  v_has_repeater boolean;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'auth_required'); end if;

  select crew_id, role into v_crew, v_role
    from public.crew_members where user_id = v_user limit 1;
  if v_crew is null then return jsonb_build_object('ok', false, 'error', 'no_crew'); end if;
  if not public._is_crew_officer_role(v_role) then
    return jsonb_build_object('ok', false, 'error', 'forbidden',
      'hint', 'Nur Leader/Officer/Admin dürfen Bauwerke errichten');
  end if;

  select * into v_stats from public._crew_building_stats(p_kind);
  if v_stats is null then return jsonb_build_object('ok', false, 'error', 'unknown_kind'); end if;

  select count(*) into v_existing_count
    from public.crew_buildings
   where crew_id = v_crew and kind = p_kind and destroyed_at is null;
  if v_existing_count >= v_stats.max_per_crew then
    return jsonb_build_object('ok', false, 'error', 'max_reached',
      'limit', v_stats.max_per_crew, 'current', v_existing_count);
  end if;

  -- Turf-Check NUR wenn Crew überhaupt schon einen Repeater hat
  select exists(
    select 1 from public.crew_repeaters
     where crew_id = v_crew and destroyed_at is null
  ) into v_has_repeater;

  if v_has_repeater then
    v_in_own_turf := public._user_in_own_crew_turf(v_user, p_lat, p_lng);
    if not v_in_own_turf then
      return jsonb_build_object('ok', false, 'error', 'must_be_in_own_turf',
        'hint', 'Bauwerke nur im eigenen Crew-Gebiet platzierbar');
    end if;
  end if;

  select coalesce(gold,0) gold, coalesce(wood,0) wood, coalesce(stone,0) stone, coalesce(mana,0) mana
    into v_res from public.user_resources where user_id = v_user;
  if v_res is null then return jsonb_build_object('ok', false, 'error', 'no_resources_row'); end if;
  if v_res.gold < v_stats.cost_gold or v_res.wood < v_stats.cost_wood
     or v_res.stone < v_stats.cost_stone or v_res.mana < v_stats.cost_mana then
    return jsonb_build_object('ok', false, 'error', 'insufficient_resources',
      'need', jsonb_build_object('gold', v_stats.cost_gold, 'wood', v_stats.cost_wood,
                                  'stone', v_stats.cost_stone, 'mana', v_stats.cost_mana));
  end if;

  update public.user_resources
     set gold = gold - v_stats.cost_gold,
         wood = wood - v_stats.cost_wood,
         stone = stone - v_stats.cost_stone,
         mana = mana - v_stats.cost_mana
   where user_id = v_user;

  insert into public.crew_buildings (
    crew_id, founder_user_id, kind, label, lat, lng, hp, max_hp, kind_data
  ) values (
    v_crew, v_user, p_kind, coalesce(p_label, initcap(p_kind)),
    p_lat, p_lng, v_stats.max_hp, v_stats.max_hp, p_kind_data
  ) returning id into v_id;

  return jsonb_build_object('ok', true, 'building_id', v_id, 'kind', p_kind, 'hp', v_stats.max_hp);
end $$;
grant execute on function public.place_crew_building(text, double precision, double precision, text, jsonb) to authenticated;
