-- ══════════════════════════════════════════════════════════════════════════
-- TRUPPEN-TIER-FORSCHUNG: T1 frei, T2–T5 erfordern Forschung pro Klasse
-- ══════════════════════════════════════════════════════════════════════════
-- 16 neue Researches: <class>_tier_<N> für N=2..5, 4 Klassen
-- T5 = mehrere Tage Forschungszeit. Train_troop prüft jetzt user_research.
-- ══════════════════════════════════════════════════════════════════════════

-- ─── 1) Tier-Unlock-Forschungen seeden ────────────────────────────────────
-- Branch 'military', single-level (max_level=1, level=0 → nicht freigeschaltet,
-- level=1 → freigeschaltet). Lange Forschungszeiten.
insert into public.research_definitions
  (id, name, emoji, description, branch, tier, prereq_id, max_level,
   base_cost_wood, base_cost_stone, base_cost_gold, base_cost_mana,
   base_time_minutes, buildtime_growth, effect_key, effect_per_level,
   required_burg_level, sort)
values
  -- Infantry T2-T5
  ('infantry_tier_2', 'Infanterie T2', '🛡️', 'Schaltet T2-Infanterie (Speerträger) frei.',     'military', 2, 'mil_infanterie', 1,
    300, 300, 80, 0,    180, 1.0, 'unlock_infantry_t2', 1, 3, 100),
  ('infantry_tier_3', 'Infanterie T3', '🛡️', 'Schaltet T3-Infanterie (Stadt-Garde) frei.',     'military', 3, 'infantry_tier_2', 1,
    800, 800, 200, 0,   720, 1.0, 'unlock_infantry_t3', 1, 6, 101),
  ('infantry_tier_4', 'Infanterie T4', '🛡️', 'Schaltet T4-Infanterie (Wache-Champion) frei.',  'military', 4, 'infantry_tier_3', 1,
    2000, 2000, 500, 50, 1800, 1.0, 'unlock_infantry_t4', 1, 12, 102),
  ('infantry_tier_5', 'Infanterie T5', '🛡️', 'Schaltet T5-Infanterie (Wächter-Held) frei.',    'military', 5, 'infantry_tier_4', 1,
    5000, 5000, 1500, 200, 4320, 1.0, 'unlock_infantry_t5', 1, 18, 103),

  -- Cavalry T2-T5
  ('cavalry_tier_2', 'Kavallerie T2', '🐎', 'Schaltet T2-Kavallerie (Leichte Reiterei) frei.',  'military', 2, 'mil_reiterei', 1,
    300, 300, 100, 0,   180, 1.0, 'unlock_cavalry_t2', 1, 3, 110),
  ('cavalry_tier_3', 'Kavallerie T3', '🐎', 'Schaltet T3-Kavallerie (Lanzenreiter) frei.',      'military', 3, 'cavalry_tier_2', 1,
    800, 800, 250, 0,   720, 1.0, 'unlock_cavalry_t3', 1, 6, 111),
  ('cavalry_tier_4', 'Kavallerie T4', '🐎', 'Schaltet T4-Kavallerie (Schwere Reiterei) frei.',  'military', 4, 'cavalry_tier_3', 1,
    2000, 2000, 600, 50, 1800, 1.0, 'unlock_cavalry_t4', 1, 12, 112),
  ('cavalry_tier_5', 'Kavallerie T5', '🐎', 'Schaltet T5-Kavallerie (Ritterordens-Held) frei.', 'military', 5, 'cavalry_tier_4', 1,
    5000, 5000, 1800, 200, 4320, 1.0, 'unlock_cavalry_t5', 1, 18, 113),

  -- Marksman T2-T5
  ('marksman_tier_2', 'Schützen T2', '🏹', 'Schaltet T2-Schützen (Bogenschütze) frei.',         'military', 2, 'mil_schiesskunst', 1,
    300, 300, 80, 0,    180, 1.0, 'unlock_marksman_t2', 1, 3, 120),
  ('marksman_tier_3', 'Schützen T3', '🏹', 'Schaltet T3-Schützen (Armbrustschütze) frei.',      'military', 3, 'marksman_tier_2', 1,
    800, 800, 200, 0,   720, 1.0, 'unlock_marksman_t3', 1, 6, 121),
  ('marksman_tier_4', 'Schützen T4', '🏹', 'Schaltet T4-Schützen (Scharfschütze) frei.',        'military', 4, 'marksman_tier_3', 1,
    2000, 2000, 500, 50, 1800, 1.0, 'unlock_marksman_t4', 1, 12, 122),
  ('marksman_tier_5', 'Schützen T5', '🏹', 'Schaltet T5-Schützen (Meister-Schütze) frei.',      'military', 5, 'marksman_tier_4', 1,
    5000, 5000, 1500, 200, 4320, 1.0, 'unlock_marksman_t5', 1, 18, 123),

  -- Siege T2-T5
  ('siege_tier_2', 'Belagerung T2', '⚙️', 'Schaltet T2-Belagerung (Steinschleuder) frei.',     'military', 2, 'mil_tactical', 1,
    400, 500, 120, 0,   240, 1.0, 'unlock_siege_t2', 1, 5, 130),
  ('siege_tier_3', 'Belagerung T3', '⚙️', 'Schaltet T3-Belagerung (Katapult) frei.',           'military', 3, 'siege_tier_2', 1,
    1000, 1200, 300, 50, 1080, 1.0, 'unlock_siege_t3', 1, 8, 131),
  ('siege_tier_4', 'Belagerung T4', '⚙️', 'Schaltet T4-Belagerung (Trebuchet) frei.',          'military', 4, 'siege_tier_3', 1,
    2500, 3000, 800, 100, 2880, 1.0, 'unlock_siege_t4', 1, 14, 132),
  ('siege_tier_5', 'Belagerung T5', '⚙️', 'Schaltet T5-Belagerung (Belagerungs-Titan) frei.',  'military', 5, 'siege_tier_4', 1,
    6000, 7000, 2000, 300, 5760, 1.0, 'unlock_siege_t5', 1, 20, 133)
on conflict (id) do update set
  name = excluded.name, emoji = excluded.emoji, description = excluded.description,
  branch = excluded.branch, tier = excluded.tier, prereq_id = excluded.prereq_id,
  max_level = excluded.max_level,
  base_cost_wood = excluded.base_cost_wood, base_cost_stone = excluded.base_cost_stone,
  base_cost_gold = excluded.base_cost_gold, base_cost_mana = excluded.base_cost_mana,
  base_time_minutes = excluded.base_time_minutes, buildtime_growth = excluded.buildtime_growth,
  effect_key = excluded.effect_key, effect_per_level = excluded.effect_per_level,
  required_burg_level = excluded.required_burg_level, sort = excluded.sort;

-- ─── 2) train_troop: Tier-Check via Forschung statt Gebäude-Level ─────────
-- T1 ist immer frei. T2..T5 brauchen entsprechende Forschung auf Lv 1.
drop function if exists public.train_troop(text, int, uuid);
create or replace function public.train_troop(p_troop_id text, p_count int, p_for_crew uuid default null)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_t record;
  v_seconds int;
  v_cost_w int; v_cost_s int; v_cost_g int; v_cost_m int;
  v_required_building text;
  v_have_level int := 0;
  v_max_at_once int;
  v_base_id uuid;
  v_vip_speed numeric := 0;
  v_research_id text;
  v_research_level int := 0;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_count is null or p_count <= 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_count');
  end if;

  select * into v_t from public.troops_catalog where id = p_troop_id;
  if v_t is null then return jsonb_build_object('ok', false, 'error', 'troop_not_found'); end if;

  -- T1: frei. T2..T5: Forschung erforderlich.
  if v_t.tier > 1 then
    v_research_id := v_t.troop_class || '_tier_' || v_t.tier;
    select coalesce(level, 0) into v_research_level
      from public.user_research where user_id = v_user and research_id = v_research_id;
    if v_research_level < 1 then
      return jsonb_build_object('ok', false, 'error', 'tier_locked',
        'research_id', v_research_id, 'tier', v_t.tier);
    end if;
  end if;

  -- Trainings-Gebäude (für Cap nach Level)
  v_required_building := case v_t.troop_class
    when 'infantry' then 'kaserne'
    when 'cavalry'  then 'stall'
    when 'marksman' then 'schiessstand'
    when 'siege'    then 'belagerungsschuppen'
    else null end;
  if v_required_building is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_class');
  end if;

  if p_for_crew is null then
    select id into v_base_id from public.bases where owner_user_id = v_user;
    if v_base_id is null then return jsonb_build_object('ok', false, 'error', 'no_base'); end if;
    select coalesce(level, 0) into v_have_level
      from public.base_buildings where base_id = v_base_id and building_id = v_required_building;
  else
    if not exists (select 1 from public.crew_members where crew_id = p_for_crew and user_id = v_user) then
      return jsonb_build_object('ok', false, 'error', 'not_in_crew');
    end if;
    select coalesce(bb.level, 0) into v_have_level
      from public.crew_bases cb
      join public.crew_base_buildings bb on bb.crew_base_id = cb.id
     where cb.crew_id = p_for_crew and bb.building_id = v_required_building;
  end if;

  if v_have_level < 1 then
    return jsonb_build_object('ok', false, 'error', 'building_required',
      'required_building', v_required_building);
  end if;

  -- Cap: Gebäude-Level × 10 (Solo) bzw. × 25 (Crew)
  v_max_at_once := v_have_level * (case when p_for_crew is null then 10 else 25 end);
  if p_count > v_max_at_once then
    return jsonb_build_object('ok', false, 'error', 'too_many_at_once',
      'max_at_once', v_max_at_once);
  end if;

  v_seconds := v_t.train_time_seconds * p_count;
  select coalesce(t.training_speed_pct, 0) into v_vip_speed
    from public.vip_progress p left join public.vip_tier_thresholds t on t.vip_level = p.vip_level
   where p.user_id = v_user;
  v_seconds := greatest(1, round(v_seconds * (1 - coalesce(v_vip_speed, 0))));

  v_cost_w := v_t.cost_wood  * p_count;
  v_cost_s := v_t.cost_stone * p_count;
  v_cost_g := v_t.cost_gold  * p_count;
  v_cost_m := v_t.cost_mana  * p_count;

  if p_for_crew is not null then
    update public.crew_resources set
      wood = wood - v_cost_w, stone = stone - v_cost_s,
      gold = gold - v_cost_g, mana = mana - v_cost_m, updated_at = now()
     where crew_id = p_for_crew
       and wood >= v_cost_w and stone >= v_cost_s
       and gold >= v_cost_g and mana >= v_cost_m;
    if not found then return jsonb_build_object('ok', false, 'error', 'not_enough_resources'); end if;
    insert into public.troop_training_queue (crew_id, troop_id, count, ends_at)
    values (p_for_crew, p_troop_id, p_count, now() + (v_seconds || ' seconds')::interval);
  else
    update public.user_resources set
      wood = wood - v_cost_w, stone = stone - v_cost_s,
      gold = gold - v_cost_g, mana = mana - v_cost_m, updated_at = now()
     where user_id = v_user
       and wood >= v_cost_w and stone >= v_cost_s
       and gold >= v_cost_g and mana >= v_cost_m;
    if not found then return jsonb_build_object('ok', false, 'error', 'not_enough_resources'); end if;
    insert into public.troop_training_queue (user_id, troop_id, count, ends_at)
    values (v_user, p_troop_id, p_count, now() + (v_seconds || ' seconds')::interval);
  end if;

  return jsonb_build_object('ok', true, 'seconds', v_seconds, 'count', p_count);
end $$;
revoke all on function public.train_troop(text, int, uuid) from public;
grant execute on function public.train_troop(text, int, uuid) to authenticated;
