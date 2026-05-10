-- ════════════════════════════════════════════════════════════════════════
-- Bauzeit-Kalibrierung an CoD/RoK-Pacing.
-- Quellen: codb.io, rok-data, RoK-Spreadsheets — Median-Werte.
-- ════════════════════════════════════════════════════════════════════════
-- Ziel:
--   Burg Lv25 ≈ 157 Tage    (CoD-Castle Median)
--   Produktion Lv25 ≈ 60 Tage
--   Kampf Lv25 ≈ 85 Tage
--   Lager Lv25 ≈ 50 Tage
-- Formel: total_min = base × growth^(lvl-1)
-- Cap: hochgezogen auf 365 Tage (525.600 min) als reine Sicherung.
-- ════════════════════════════════════════════════════════════════════════

-- ─── 1) Burg-Kurve neu kalibrieren ──────────────────────────────────────
-- Vorher: base=1, growth=1.85 → Lv25 = 762 Tage (zu viel)
-- Nachher: base=5, growth=1.58 → Lv25 = 5 × 1.58^24 ≈ 156.9 Tage
update public.buildings_catalog set
  base_buildtime_minutes = 5,
  buildtime_growth = 1.58
where id = 'burg';

-- ─── 2) Side-Buildings kategorienweise ──────────────────────────────────
-- Production: Lv25 ≈ 60 Tage (base=2, growth=1.55)
update public.buildings_catalog set
  base_buildtime_minutes = greatest(2, base_buildtime_minutes / 4),
  buildtime_growth = 1.55
where category = 'production' and id <> 'burg';

-- Combat: Lv25 ≈ 85 Tage (base=3, growth=1.56)
update public.buildings_catalog set
  base_buildtime_minutes = greatest(3, base_buildtime_minutes / 4),
  buildtime_growth = 1.56
where category = 'combat' and id <> 'burg';

-- Storage: Lv25 ≈ 48 Tage (base=2, growth=1.53)
update public.buildings_catalog set
  base_buildtime_minutes = greatest(2, base_buildtime_minutes / 4),
  buildtime_growth = 1.53
where category = 'storage' and id <> 'burg';

-- Utility: zwischen Produktion und Burg (base=3, growth=1.55)
update public.buildings_catalog set
  base_buildtime_minutes = greatest(3, base_buildtime_minutes / 4),
  buildtime_growth = 1.55
where category = 'utility' and id <> 'burg';

-- Cosmetic / Deko: kurz halten (base=1, growth=1.30)
update public.buildings_catalog set
  base_buildtime_minutes = greatest(1, base_buildtime_minutes / 5),
  buildtime_growth = 1.30
where category = 'cosmetic' and id <> 'burg';

-- ─── 3) Cap zurück hochziehen: 3 Tage → 365 Tage ────────────────────────
-- start_building neu aufsetzen mit Cap = 525.600 min (365 Tage).
drop function if exists public.start_building(text, int, int);

create or replace function public.start_building(p_building_id text, p_position_x int default 0, p_position_y int default 0)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_base_id uuid;
  v_cat record;
  v_existing record;
  v_action text;
  v_target_level int;
  v_cost_mult numeric;
  v_cost_w int; v_cost_s int; v_cost_g int; v_cost_m int;
  v_resources record;
  v_buildtime_min int;
  v_vip_speed numeric := 0;
  v_extra_slots_vip int := 0;
  v_burg_level int := 0;
  v_extra_slots_burg int := 0;
  v_total_slots int;
  v_active_count int;
  v_unmet jsonb;
  v_playstyle_speed numeric := 1.0;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select id into v_base_id from public.bases where owner_user_id = v_user;
  if v_base_id is null then v_base_id := public.get_or_create_base(); end if;

  select * into v_cat from public.buildings_catalog where id = p_building_id;
  if v_cat is null then return jsonb_build_object('ok', false, 'error', 'building_not_found'); end if;

  select coalesce(level, 0) into v_burg_level
    from public.base_buildings where base_id = v_base_id and building_id = 'burg';

  select * into v_existing from public.base_buildings
    where base_id = v_base_id and building_id = p_building_id;

  if v_existing is null then
    v_action := 'build';
    v_target_level := 1;
    v_cost_mult := 1.0;
  else
    if v_existing.level >= v_cat.max_level then
      return jsonb_build_object('ok', false, 'error', 'max_level_reached');
    end if;
    if v_existing.status <> 'idle' then
      return jsonb_build_object('ok', false, 'error', 'already_in_progress');
    end if;
    v_action := 'upgrade';
    v_target_level := v_existing.level + 1;
    v_cost_mult := power(1.6, v_existing.level);
  end if;

  if p_building_id <> 'burg' and v_target_level > greatest(v_burg_level, 1) then
    return jsonb_build_object('ok', false, 'error', 'burg_level_too_low',
      'burg_level', v_burg_level, 'needed', v_target_level);
  end if;

  if p_building_id = 'burg' and v_target_level >= 2 then
    select coalesce(jsonb_agg(jsonb_build_object(
      'building_id', r.building_id,
      'name',        c.name,
      'required_level', r.required_level,
      'have_level',  coalesce(bb.level, 0)
    )), '[]'::jsonb)
      into v_unmet
      from public.burg_level_requirements r
      join public.buildings_catalog c on c.id = r.building_id
      left join public.base_buildings bb on bb.base_id = v_base_id and bb.building_id = r.building_id
     where r.burg_level = v_target_level
       and coalesce(bb.level, 0) < r.required_level;
    if jsonb_array_length(v_unmet) > 0 then
      return jsonb_build_object('ok', false, 'error', 'burg_requirements_unmet',
        'target_level', v_target_level, 'unmet', v_unmet);
    end if;
  end if;

  v_cost_w := round(v_cat.base_cost_wood  * v_cost_mult);
  v_cost_s := round(v_cat.base_cost_stone * v_cost_mult);
  v_cost_g := round(v_cat.base_cost_gold  * v_cost_mult);
  v_cost_m := round(v_cat.base_cost_mana  * v_cost_mult);

  select coalesce(t.extra_build_slots, 0) into v_extra_slots_vip
    from public.vip_progress p left join public.vip_tier_thresholds t on t.vip_level = p.vip_level
   where p.user_id = v_user;
  v_extra_slots_burg := case
    when v_burg_level >= 22 then 4
    when v_burg_level >= 17 then 3
    when v_burg_level >= 11 then 2
    when v_burg_level >=  4 then 1
    else 0 end;
  v_total_slots := 1 + greatest(v_extra_slots_vip, v_extra_slots_burg);

  select count(*) into v_active_count
    from public.building_queue
   where base_id = v_base_id and not finished;
  if v_active_count >= v_total_slots then
    return jsonb_build_object('ok', false, 'error', 'queue_full',
      'slots', v_total_slots, 'active', v_active_count);
  end if;

  select * into v_resources from public.user_resources where user_id = v_user for update;
  if v_resources.wood < v_cost_w or v_resources.stone < v_cost_s
     or v_resources.gold < v_cost_g or v_resources.mana < v_cost_m then
    return jsonb_build_object('ok', false, 'error', 'not_enough_resources',
      'need', jsonb_build_object('wood', v_cost_w, 'stone', v_cost_s, 'gold', v_cost_g, 'mana', v_cost_m));
  end if;

  update public.user_resources set
    wood = wood - v_cost_w, stone = stone - v_cost_s,
    gold = gold - v_cost_g, mana = mana - v_cost_m, updated_at = now()
  where user_id = v_user;

  select coalesce(t.buildtime_bonus_pct, 0) into v_vip_speed
    from public.vip_progress p left join public.vip_tier_thresholds t on t.vip_level = p.vip_level
   where p.user_id = v_user;
  v_playstyle_speed := public.playstyle_buff(v_user, 'build_speed');
  -- Cap = 365 Tage als finale Sicherung (CoD-Pacing erreicht ~157 Tage Lv25 Burg)
  v_buildtime_min := least(525600,
    greatest(1, round(v_cat.base_buildtime_minutes
                       * power(coalesce(v_cat.buildtime_growth, 1.40), v_target_level - 1)
                       * (1 - coalesce(v_vip_speed, 0))
                       * coalesce(v_playstyle_speed, 1.0))));

  if v_existing is null then
    insert into public.base_buildings (base_id, building_id, position_x, position_y, level, status)
    values (v_base_id, p_building_id, p_position_x, p_position_y, 0, 'building');
  else
    update public.base_buildings set status = 'upgrading' where id = v_existing.id;
  end if;

  insert into public.building_queue
    (base_id, building_id, action, target_level, ends_at, cost_wood, cost_stone, cost_gold, cost_mana)
  values
    (v_base_id, p_building_id, v_action, v_target_level,
     now() + (v_buildtime_min || ' minutes')::interval,
     v_cost_w, v_cost_s, v_cost_g, v_cost_m);

  return jsonb_build_object('ok', true,
    'action', v_action, 'target_level', v_target_level,
    'buildtime_minutes', v_buildtime_min,
    'cost', jsonb_build_object('wood', v_cost_w, 'stone', v_cost_s, 'gold', v_cost_g, 'mana', v_cost_m));
end $$;

revoke all on function public.start_building(text, int, int) from public;
grant execute on function public.start_building(text, int, int) to authenticated;
