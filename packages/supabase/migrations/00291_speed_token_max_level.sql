-- 00291: Speed-Token = Pflicht-RSS für letzten Upgrade-Schritt zur Max-Stufe.
--
-- Mechanik:
--   - Wenn ein Gebäude auf Max-Level (cat.max_level) upgegradet wird,
--     ist 1 Speed-Token Pflicht zusätzlich zu den normalen RSS.
--   - Speed-Token kann via buy_speed_token() für 2000 Krypto (Diamonds/Gems) gekauft werden.
--
-- Touchpoints:
--   - public.start_building(): zusätzliche Cost-Prüfung + Deduct wenn target_level = max_level
--   - public.buy_speed_token(): NEU — User kauft 1 Token für 2000 Gems
--
-- WICHTIG: Wir patchen start_building komplett (CREATE OR REPLACE), behalten aber
-- die ganze bestehende Logik bei. Der einzige neue Teil ist der Speed-Token-Block.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) buy_speed_token RPC — kauft 1 Speed-Token für 2000 Gems
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.buy_speed_token()
returns jsonb language plpgsql security definer
set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_cost int := 2000;
  v_have int;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  -- Gem-Balance prüfen
  select gems into v_have from public.user_gems where user_id = v_user for update;
  if v_have is null then
    return jsonb_build_object('ok', false, 'error', 'no_gem_account');
  end if;
  if v_have < v_cost then
    return jsonb_build_object('ok', false, 'error', 'not_enough_gems',
      'need', v_cost, 'have', v_have);
  end if;

  -- Gems abziehen + total_spent hochsetzen (wie überall im Code)
  update public.user_gems
     set gems = gems - v_cost,
         total_spent = coalesce(total_spent, 0) + v_cost,
         updated_at = now()
   where user_id = v_user;

  -- Speed-Token-Konto aufstocken (mit Insert-or-Update)
  insert into public.user_resources (user_id, wood, stone, gold, mana, speed_tokens)
  values (v_user, 0, 0, 0, 0, 1)
  on conflict (user_id) do update set
    speed_tokens = public.user_resources.speed_tokens + 1,
    updated_at = now();

  return jsonb_build_object('ok', true,
    'cost_gems', v_cost,
    'gems_remaining', v_have - v_cost);
end;
$$;

revoke all on function public.buy_speed_token() from anon;
grant execute on function public.buy_speed_token() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) start_building Patch — Speed-Token-Pflicht beim Max-Level-Upgrade
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.start_building(
  p_building_id text,
  p_position_x  int default 0,
  p_position_y  int default 0
) returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_base_id uuid;
  v_base record;
  v_cat record;
  v_existing record;
  v_target_level int;
  v_cost_mult numeric;
  v_cost_w int; v_cost_s int; v_cost_g int; v_cost_m int;
  v_resources record;
  v_buildtime_min int;
  v_vip_speed numeric := 0;
  v_action text;
  v_speed_token_cost int := 0;  -- NEU
  v_playstyle_mult numeric := 1.0; -- für Build-Speed-Buff (Architekt)
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  v_base_id := public.get_or_create_base();
  select * into v_base from public.bases where id = v_base_id;

  select * into v_cat from public.buildings_catalog where id = p_building_id;
  if v_cat is null then return jsonb_build_object('ok', false, 'error', 'building_not_found'); end if;
  if v_cat.scope <> 'solo' then return jsonb_build_object('ok', false, 'error', 'wrong_scope'); end if;
  if v_base.level < v_cat.required_base_level then
    return jsonb_build_object('ok', false, 'error', 'base_level_too_low', 'need', v_cat.required_base_level);
  end if;

  -- Existiert bereits? → Upgrade. Sonst → Build.
  select * into v_existing from public.base_buildings where base_id = v_base_id and building_id = p_building_id;

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

  v_cost_w := round(v_cat.base_cost_wood  * v_cost_mult);
  v_cost_s := round(v_cat.base_cost_stone * v_cost_mult);
  v_cost_g := round(v_cat.base_cost_gold  * v_cost_mult);
  v_cost_m := round(v_cat.base_cost_mana  * v_cost_mult);

  -- ── NEU: Speed-Token-Pflicht beim finalen Sprung zur Max-Stufe ──
  if v_target_level = v_cat.max_level then
    v_speed_token_cost := 1;
  end if;

  select * into v_resources from public.user_resources where user_id = v_user for update;
  if v_resources.wood < v_cost_w or v_resources.stone < v_cost_s
     or v_resources.gold < v_cost_g or v_resources.mana < v_cost_m then
    return jsonb_build_object('ok', false, 'error', 'not_enough_resources',
      'need', jsonb_build_object('wood', v_cost_w, 'stone', v_cost_s, 'gold', v_cost_g, 'mana', v_cost_m));
  end if;
  -- NEU: Speed-Token-Check
  if v_speed_token_cost > 0 and coalesce(v_resources.speed_tokens, 0) < v_speed_token_cost then
    return jsonb_build_object('ok', false, 'error', 'not_enough_speed_tokens',
      'need', v_speed_token_cost,
      'have', coalesce(v_resources.speed_tokens, 0),
      'gem_price_per_token', 2000);
  end if;

  update public.user_resources set
    wood = wood - v_cost_w, stone = stone - v_cost_s,
    gold = gold - v_cost_g, mana = mana - v_cost_m,
    speed_tokens = speed_tokens - v_speed_token_cost,  -- NEU
    updated_at = now()
  where user_id = v_user;

  -- Bauzeit (mit VIP-Bonus + Playstyle-Buff)
  select coalesce(t.buildtime_bonus_pct, 0) into v_vip_speed
    from public.vip_progress p left join public.vip_tier_thresholds t on t.vip_level = p.vip_level
   where p.user_id = v_user;

  -- Playstyle-Buff (Architekt: -5% Bauzeit)
  begin
    v_playstyle_mult := public.playstyle_buff(v_user, 'build_speed');
  exception when undefined_function then
    v_playstyle_mult := 1.0;
  end;

  v_buildtime_min := greatest(1,
    round(v_cat.base_buildtime_minutes * v_target_level * (1 - v_vip_speed) * v_playstyle_mult)
  );

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
    'cost', jsonb_build_object(
      'wood', v_cost_w, 'stone', v_cost_s, 'gold', v_cost_g, 'mana', v_cost_m,
      'speed_tokens', v_speed_token_cost
    ));
end;
$$;
