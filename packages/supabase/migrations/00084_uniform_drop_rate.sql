-- ══════════════════════════════════════════════════════════════════════════
-- DROP-RATEN VEREINHEITLICHEN: alle 4 Resourcen 100/km
-- ══════════════════════════════════════════════════════════════════════════
-- Vorher: Holz/Stein 100, Gold 80, Mana 60.
-- Neu:    alle 100/km für simpleres mentales Modell.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function public.record_walk_resources(p_walk_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_walk record;
  v_user uuid := auth.uid();
  v_wood int; v_stone int; v_gold int; v_mana int; v_tokens int;
  v_vip_bonus numeric := 0;
  v_total_km numeric;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select * into v_walk from public.walks where id = p_walk_id and user_id = v_user;
  if v_walk is null then return jsonb_build_object('ok', false, 'error', 'walk_not_found'); end if;
  if v_walk.drop_processed then return jsonb_build_object('ok', false, 'error', 'already_processed'); end if;

  select coalesce(t.resource_bonus_pct, 0) into v_vip_bonus
    from public.vip_progress p
    left join public.vip_tier_thresholds t on t.vip_level = p.vip_level
   where p.user_id = v_user;

  -- Einheitlich 100/km für alle 4 Resource-Typen
  v_wood  := round(v_walk.km_in_park        * 100 * (1 + v_vip_bonus));
  v_stone := round(v_walk.km_in_residential * 100 * (1 + v_vip_bonus));
  v_gold  := round(v_walk.km_in_commercial  * 100 * (1 + v_vip_bonus));
  v_mana  := round(v_walk.km_near_water     * 100 * (1 + v_vip_bonus));

  v_total_km := coalesce(v_walk.distance_m, 0) / 1000.0;
  v_tokens := floor(v_total_km)::int;

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
    wood_dropped = v_wood, stone_dropped = v_stone,
    gold_dropped = v_gold, mana_dropped = v_mana,
    drop_processed = true
  where id = p_walk_id;

  return jsonb_build_object('ok', true,
    'wood', v_wood, 'stone', v_stone, 'gold', v_gold, 'mana', v_mana, 'tokens', v_tokens);
end $$;
