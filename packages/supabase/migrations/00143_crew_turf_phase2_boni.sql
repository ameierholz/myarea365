-- ════════════════════════════════════════════════════════════════════
-- CREW TURF — Phase 2: Boni im eigenen Turf
-- ════════════════════════════════════════════════════════════════════
-- Wer in einem Polygon der eigenen Crew aktiv ist, bekommt Vorteile:
--   - Walk-Ressourcen +25% (wood/stone/gold/mana am Ende des Walks)
--   - Speed-Tokens +15%
--   - Wegemünzen-Einlösung in Geschäft im eigenen Turf: +30% Loot-XP
--     + "lucky reroll" bei 'none'-Drops
--   - Repeater-Reparatur: -50% Kosten wenn der Runner sich im eigenen
--     Turf befindet (egal welcher Repeater repariert wird)
-- ════════════════════════════════════════════════════════════════════

-- ─── 1) Helper: Punkt im Turf einer bestimmten Crew? ─────────────────
-- Vereinigt alle lebenden Repeater-Coverages der Crew zu einem MultiPolygon
-- und prüft per ST_Contains. Performance: bbox-Pre-Filter via lat/lng-Index.
create or replace function public._point_in_crew_turf(
  p_crew_id uuid,
  p_lat double precision,
  p_lng double precision
) returns boolean language sql stable as $$
  with rep as (
    select ST_Buffer(
             ST_Transform(ST_SetSRID(ST_MakePoint(r.lng, r.lat), 4326), 3857),
             public._repeater_turf_radius_for_kind(r.kind)
           ) as buf
      from public.crew_repeaters r
     where r.crew_id = p_crew_id
       and r.destroyed_at is null
       -- bbox-Pre-Filter: Repeater max 600m vom Punkt entfernt (HQ-Radius 500 + Sicherheit)
       and r.lat between p_lat - 0.006 and p_lat + 0.006
       and r.lng between p_lng - 0.010 and p_lng + 0.010
  )
  select coalesce(
    bool_or(ST_Contains(
      ST_Transform(buf, 4326),
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)
    )),
    false
  ) from rep;
$$;

-- ─── 2) Helper: Punkt im Turf der eigenen Crew des Users? ────────────
create or replace function public._user_in_own_crew_turf(
  p_user_id uuid,
  p_lat double precision,
  p_lng double precision
) returns boolean language sql stable as $$
  select coalesce(
    public._point_in_crew_turf(
      (select crew_id from public.crew_members where user_id = p_user_id limit 1),
      p_lat, p_lng
    ),
    false
  );
$$;

grant execute on function public._point_in_crew_turf(uuid, double precision, double precision) to authenticated;
grant execute on function public._user_in_own_crew_turf(uuid, double precision, double precision) to authenticated;

-- ─── 3) record_walk_resources: +25% Resourcen / +15% Tokens im Turf ──
-- Endpunkt der Walk-Route entscheidet — Server-side über ST_EndPoint(route).
create or replace function public.record_walk_resources(p_walk_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_walk record;
  v_user uuid := auth.uid();
  v_wood int; v_stone int; v_gold int; v_mana int; v_tokens int;
  v_vip_bonus numeric := 0;
  v_total_km numeric;
  v_bonuses jsonb := '[]'::jsonb;
  v_vip_extra_xp int;
  v_end_point geometry;
  v_end_lat double precision;
  v_end_lng double precision;
  v_in_own_turf boolean := false;
  v_turf_bonus_pct numeric := 0;
  v_turf_token_bonus_pct numeric := 0;
  v_extra_rss int;
  v_extra_tokens int;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select * into v_walk from public.walks where id = p_walk_id and user_id = v_user;
  if v_walk is null then return jsonb_build_object('ok', false, 'error', 'walk_not_found'); end if;
  if v_walk.drop_processed then return jsonb_build_object('ok', false, 'error', 'already_processed'); end if;

  select coalesce(t.resource_bonus_pct, 0) into v_vip_bonus
    from public.vip_progress p
    left join public.vip_tier_thresholds t on t.vip_level = p.vip_level
   where p.user_id = v_user;

  -- Turf-Check: Endpunkt der Route extrahieren
  if v_walk.route is not null then
    begin
      v_end_point := ST_EndPoint(v_walk.route);
      if v_end_point is not null then
        v_end_lat := ST_Y(v_end_point);
        v_end_lng := ST_X(v_end_point);
        v_in_own_turf := public._user_in_own_crew_turf(v_user, v_end_lat, v_end_lng);
      end if;
    exception when others then v_in_own_turf := false;
    end;
  end if;

  if v_in_own_turf then
    v_turf_bonus_pct := 0.25;
    v_turf_token_bonus_pct := 0.15;
  end if;

  v_wood  := round(v_walk.km_in_park        * 100 * (1 + v_vip_bonus) * (1 + v_turf_bonus_pct));
  v_stone := round(v_walk.km_in_residential * 100 * (1 + v_vip_bonus) * (1 + v_turf_bonus_pct));
  v_gold  := round(v_walk.km_in_commercial  * 100 * (1 + v_vip_bonus) * (1 + v_turf_bonus_pct));
  v_mana  := round(v_walk.km_near_water     * 100 * (1 + v_vip_bonus) * (1 + v_turf_bonus_pct));

  v_total_km := coalesce(v_walk.distance_m, 0) / 1000.0;
  v_tokens := floor(v_total_km * (1 + v_turf_token_bonus_pct))::int;

  if v_vip_bonus > 0 then
    v_vip_extra_xp := round((v_wood + v_stone + v_gold + v_mana) * v_vip_bonus / (1 + v_vip_bonus))::int;
    v_bonuses := v_bonuses || jsonb_build_object(
      'kind', 'vip_resource_bonus',
      'label', 'Premium-Bonus auf Ressourcen',
      'pct', round(v_vip_bonus * 100, 1),
      'extra_amount', v_vip_extra_xp,
      'unit', 'rss'
    );
  end if;

  if v_in_own_turf then
    v_extra_rss := round((v_wood + v_stone + v_gold + v_mana) * v_turf_bonus_pct / (1 + v_turf_bonus_pct))::int;
    v_extra_tokens := v_tokens - floor(v_total_km)::int;
    v_bonuses := v_bonuses || jsonb_build_object(
      'kind', 'crew_turf_bonus',
      'label', 'Crew-Turf-Bonus (eigenes Gebiet)',
      'pct', 25,
      'extra_amount', v_extra_rss,
      'unit', 'rss'
    );
    if v_extra_tokens > 0 then
      v_bonuses := v_bonuses || jsonb_build_object(
        'kind', 'crew_turf_token_bonus',
        'label', 'Crew-Turf-Bonus auf Wegemünzen',
        'pct', 15,
        'extra_amount', v_extra_tokens,
        'unit', 'tokens'
      );
    end if;
  end if;

  insert into public.user_resources (user_id, wood, stone, gold, mana, speed_tokens)
  values (v_user, v_wood, v_stone, v_gold, v_mana, v_tokens)
  on conflict (user_id) do update set
    wood         = public.user_resources.wood + excluded.wood,
    stone        = public.user_resources.stone + excluded.stone,
    gold         = public.user_resources.gold + excluded.gold,
    mana         = public.user_resources.mana + excluded.mana,
    speed_tokens = public.user_resources.speed_tokens + excluded.speed_tokens,
    updated_at   = now();

  update public.walks set
    wood_dropped   = v_wood,
    stone_dropped  = v_stone,
    gold_dropped   = v_gold,
    mana_dropped   = v_mana,
    tokens_dropped = v_tokens,
    xp_bonuses     = coalesce(xp_bonuses, '[]'::jsonb) || v_bonuses,
    drop_processed = true
  where id = p_walk_id;

  return jsonb_build_object('ok', true,
    'wood', v_wood, 'stone', v_stone, 'gold', v_gold, 'mana', v_mana,
    'tokens', v_tokens, 'bonuses', v_bonuses,
    'in_own_turf', v_in_own_turf);
end $$;

revoke all on function public.record_walk_resources(uuid) from public;
grant execute on function public.record_walk_resources(uuid) to authenticated;

-- ─── 4) award_redemption_loot: +30% XP + lucky-reroll im Turf ────────
-- Geschäft (business) liegt im eigenen Crew-Turf? → Loot-Bonus.
create or replace function public.award_redemption_loot(p_redemption_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid; v_business uuid;
  v_roll float; v_rarity text; v_xp int; v_drop_id uuid;
  v_item_id text; v_user_item_id uuid;
  v_material jsonb;
  v_b_lat double precision; v_b_lng double precision;
  v_in_own_turf boolean := false;
  v_turf_bonus_pct numeric := 0;
  v_was_rerolled boolean := false;
begin
  select user_id, business_id into v_user, v_business
    from public.deal_redemptions where id = p_redemption_id;
  if v_user is null then return null; end if;
  if exists (select 1 from public.guardian_drops where redemption_id = p_redemption_id) then
    return (select to_jsonb(d) from public.guardian_drops d where redemption_id = p_redemption_id limit 1);
  end if;

  -- Turf-Check: Geschäfts-Position
  select ST_Y(location::geometry), ST_X(location::geometry)
    into v_b_lat, v_b_lng
    from public.local_businesses
   where id = v_business and location is not null;
  if v_b_lat is not null then
    v_in_own_turf := public._user_in_own_crew_turf(v_user, v_b_lat, v_b_lng);
  end if;
  if v_in_own_turf then v_turf_bonus_pct := 0.30; end if;

  v_roll := random();
  if v_roll < 0.60 then v_rarity := 'none'; v_xp := 0;
  elsif v_roll < 0.85 then v_rarity := 'common'; v_xp := 100;
  elsif v_roll < 0.95 then v_rarity := 'rare'; v_xp := 300;
  elsif v_roll < 0.99 then v_rarity := 'epic'; v_xp := 800;
  else v_rarity := 'legend'; v_xp := 2500; end if;

  -- Lucky-Reroll: bei 'none' im eigenen Turf einmal nachwürfeln
  if v_in_own_turf and v_rarity = 'none' then
    v_was_rerolled := true;
    v_roll := random();
    if v_roll < 0.40 then v_rarity := 'none'; v_xp := 0;
    elsif v_roll < 0.75 then v_rarity := 'common'; v_xp := 100;
    elsif v_roll < 0.92 then v_rarity := 'rare'; v_xp := 300;
    elsif v_roll < 0.99 then v_rarity := 'epic'; v_xp := 800;
    else v_rarity := 'legend'; v_xp := 2500; end if;
  end if;

  -- +30% XP-Bonus on top wenn im Turf
  if v_in_own_turf and v_xp > 0 then
    v_xp := round(v_xp * (1 + v_turf_bonus_pct))::int;
  end if;

  if v_rarity in ('rare','epic','legend') and random() < 0.40 then
    select id into v_item_id from public.item_catalog where rarity = v_rarity order by random() limit 1;
    if v_item_id is not null then
      insert into public.user_items (user_id, item_id, source, upgrade_tier)
        values (v_user, v_item_id, 'drop', 0) returning id into v_user_item_id;
      v_xp := 0;
    end if;
  end if;

  v_material := public.roll_material_drop(v_user, case when v_rarity = 'none' then 'common' else v_rarity end);

  insert into public.guardian_drops (user_id, redemption_id, business_id, rarity, xp_awarded)
  values (v_user, p_redemption_id, v_business, v_rarity, v_xp)
  returning id into v_drop_id;

  update public.deal_redemptions set loot_rarity = v_rarity, loot_xp = v_xp where id = p_redemption_id;
  if v_xp > 0 then
    update public.user_guardians set xp = xp + v_xp where user_id = v_user and is_active;
  end if;

  return jsonb_build_object(
    'id', v_drop_id, 'rarity', v_rarity, 'xp_awarded', v_xp,
    'item_id', v_item_id, 'user_item_id', v_user_item_id,
    'material', v_material,
    'crew_turf_bonus', v_in_own_turf,
    'lucky_reroll', v_was_rerolled
  );
end $$;

-- ─── 5) RPC: repair_crew_repeater ────────────────────────────────────
-- Repariert HP eines eigenen Repeaters. Basis-Kosten 5g + 3w + 3s pro HP.
-- Turf-Bonus: -50% wenn der Runner sich aktuell im eigenen Crew-Turf befindet.
create or replace function public.repair_crew_repeater(
  p_repeater_id uuid,
  p_hp_amount int,
  p_runner_lat double precision default null,
  p_runner_lng double precision default null
) returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_my_crew uuid;
  v_repeater record;
  v_hp_repairable int;
  v_cost_gold int; v_cost_wood int; v_cost_stone int;
  v_base_gold int := 5; v_base_wood int := 3; v_base_stone int := 3;
  v_in_own_turf boolean := false;
  v_discount numeric := 1.0;
  v_res record;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'auth_required'); end if;
  if p_hp_amount is null or p_hp_amount <= 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_hp_amount');
  end if;

  select crew_id into v_my_crew from public.crew_members where user_id = v_user limit 1;
  if v_my_crew is null then return jsonb_build_object('ok', false, 'error', 'no_crew'); end if;

  select id, crew_id, hp, max_hp, kind
    into v_repeater
    from public.crew_repeaters
   where id = p_repeater_id and destroyed_at is null
   for update;
  if v_repeater is null then return jsonb_build_object('ok', false, 'error', 'repeater_not_found'); end if;
  if v_repeater.crew_id <> v_my_crew then
    return jsonb_build_object('ok', false, 'error', 'not_own_crew');
  end if;

  v_hp_repairable := least(p_hp_amount, v_repeater.max_hp - v_repeater.hp);
  if v_hp_repairable <= 0 then
    return jsonb_build_object('ok', false, 'error', 'already_full_hp');
  end if;

  -- Turf-Discount-Check: Runner-Position im eigenen Turf?
  if p_runner_lat is not null and p_runner_lng is not null then
    v_in_own_turf := public._point_in_crew_turf(v_my_crew, p_runner_lat, p_runner_lng);
    if v_in_own_turf then v_discount := 0.5; end if;
  end if;

  v_cost_gold  := ceil(v_hp_repairable * v_base_gold  * v_discount)::int;
  v_cost_wood  := ceil(v_hp_repairable * v_base_wood  * v_discount)::int;
  v_cost_stone := ceil(v_hp_repairable * v_base_stone * v_discount)::int;

  select coalesce(gold,0) gold, coalesce(wood,0) wood, coalesce(stone,0) stone
    into v_res from public.user_resources where user_id = v_user;
  if v_res is null then return jsonb_build_object('ok', false, 'error', 'no_resources_row'); end if;
  if v_res.gold < v_cost_gold or v_res.wood < v_cost_wood or v_res.stone < v_cost_stone then
    return jsonb_build_object('ok', false, 'error', 'insufficient_resources',
      'need', jsonb_build_object('gold', v_cost_gold, 'wood', v_cost_wood, 'stone', v_cost_stone),
      'have', jsonb_build_object('gold', v_res.gold, 'wood', v_res.wood, 'stone', v_res.stone));
  end if;

  update public.user_resources
     set gold = gold - v_cost_gold,
         wood = wood - v_cost_wood,
         stone = stone - v_cost_stone
   where user_id = v_user;

  update public.crew_repeaters
     set hp = least(max_hp, hp + v_hp_repairable)
   where id = v_repeater.id;

  return jsonb_build_object(
    'ok', true,
    'repeater_id', v_repeater.id,
    'hp_repaired', v_hp_repairable,
    'new_hp', v_repeater.hp + v_hp_repairable,
    'max_hp', v_repeater.max_hp,
    'cost', jsonb_build_object('gold', v_cost_gold, 'wood', v_cost_wood, 'stone', v_cost_stone),
    'turf_discount', v_in_own_turf
  );
end $$;
grant execute on function public.repair_crew_repeater(uuid, int, double precision, double precision) to authenticated;
