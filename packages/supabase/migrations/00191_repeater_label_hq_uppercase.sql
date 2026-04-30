-- ══════════════════════════════════════════════════════════════════════════
-- Repeater-Default-Label: HQ groß statt initcap("hq") = "Hq"
-- Fix für Pin-Anzeige "KIEZ Hq" → "KIEZ HQ".
-- ══════════════════════════════════════════════════════════════════════════

-- 1) Bestehende Labels normalisieren
update public.crew_repeaters
   set label = 'HQ'
 where kind = 'hq' and label = 'Hq';

-- 2) Funktion fixen: für 'hq' immer Großbuchstaben, sonst initcap
create or replace function public.place_crew_repeater(
  p_lat double precision,
  p_lng double precision,
  p_kind text default 'repeater',
  p_label text default null
) returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_crew uuid;
  v_existing_count int;
  v_in_chain boolean;
  v_stats record;
  v_repeater_id uuid;
  v_res record;
  v_new_radius int;
  v_default_label text;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'auth_required'); end if;
  if p_kind not in ('hq','repeater','mega') then return jsonb_build_object('ok', false, 'error', 'bad_kind'); end if;

  select crew_id into v_crew from public.crew_members where user_id = v_user limit 1;
  if v_crew is null then return jsonb_build_object('ok', false, 'error', 'no_crew'); end if;

  select * into v_stats from public._repeater_kind_stats(p_kind);
  v_new_radius := public._repeater_turf_radius_for_kind(p_kind);

  select count(*) into v_existing_count
    from public.crew_repeaters
   where crew_id = v_crew and destroyed_at is null;

  if v_existing_count = 0 and p_kind <> 'hq' then
    return jsonb_build_object('ok', false, 'error', 'first_must_be_hq');
  end if;
  if p_kind = 'hq' and v_existing_count > 0 then
    return jsonb_build_object('ok', false, 'error', 'hq_already_exists');
  end if;

  if p_kind <> 'hq' then
    select exists (
      select 1 from public.crew_repeaters
       where crew_id = v_crew
         and destroyed_at is null
         and public._haversine_m(lat, lng, p_lat, p_lng)
             <= v_new_radius + public._repeater_turf_radius_for_kind(kind)
    ) into v_in_chain;
    if not v_in_chain then
      return jsonb_build_object('ok', false, 'error', 'out_of_chain',
        'hint', 'Coverage muss bestehenden Repeater berühren');
    end if;
  end if;

  if exists (
    select 1 from public.crew_repeaters
     where crew_id <> v_crew
       and destroyed_at is null
       and public._haversine_m(lat, lng, p_lat, p_lng) <= 50
  ) then
    return jsonb_build_object('ok', false, 'error', 'too_close_to_enemy');
  end if;

  select coalesce(gold,0) gold, coalesce(wood,0) wood, coalesce(stone,0) stone
    into v_res
    from public.user_resources
   where user_id = v_user;

  if v_res is null then return jsonb_build_object('ok', false, 'error', 'no_resources_row'); end if;
  if v_res.gold < v_stats.cost_gold or v_res.wood < v_stats.cost_wood or v_res.stone < v_stats.cost_stone then
    return jsonb_build_object('ok', false, 'error', 'insufficient_resources',
      'need', jsonb_build_object('gold', v_stats.cost_gold, 'wood', v_stats.cost_wood, 'stone', v_stats.cost_stone));
  end if;

  update public.user_resources
     set gold = gold - v_stats.cost_gold,
         wood = wood - v_stats.cost_wood,
         stone = stone - v_stats.cost_stone
   where user_id = v_user;

  -- HQ groß ("HQ"), Mega + Repeater bleiben Title-Case
  v_default_label := case p_kind when 'hq' then 'HQ' else initcap(p_kind) end;

  insert into public.crew_repeaters (
    crew_id, founder_user_id, kind, label, lat, lng, hp, max_hp, shield_until
  ) values (
    v_crew, v_user, p_kind, coalesce(p_label, v_default_label), p_lat, p_lng,
    v_stats.max_hp, v_stats.max_hp,
    now() + (v_stats.build_shield_s || ' seconds')::interval
  )
  returning id into v_repeater_id;

  return jsonb_build_object('ok', true, 'repeater_id', v_repeater_id, 'kind', p_kind, 'hp', v_stats.max_hp,
    'turf_radius_m', v_new_radius);
end $$;

grant execute on function public.place_crew_repeater(double precision, double precision, text, text) to authenticated;
