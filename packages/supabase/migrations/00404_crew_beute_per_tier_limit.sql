-- ────────────────────────────────────────────────────────────────────────
-- 00404: 4×/Woche-Limit jetzt pro Tier (Elite + Mega getrennt)
-- ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.donate_crew_gift(p_cost int DEFAULT 200)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $function$
DECLARE v_uid uuid := auth.uid(); v_crew uuid; v_gems int; v_gift_id uuid; v_title text;
  v_member record; v_drop record; v_tier text; v_key_pts int; v_crys_pts int; v_donor text; v_tlv int;
  v_tier_count int; v_tier_pattern text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_cost < 50 OR p_cost > 5000 THEN RAISE EXCEPTION 'invalid_cost'; END IF;
  IF p_cost >= 1000 THEN v_tier := 'mega'; v_key_pts := 1500; v_crys_pts := 750; v_tier_pattern := '%MEGA-DROP%';
  ELSE v_tier := 'elite'; v_key_pts := 500; v_crys_pts := 250; v_tier_pattern := '%ELITE-DROP%'; END IF;
  SELECT COUNT(*) INTO v_tier_count FROM public.crew_gifts
    WHERE source_user_id = v_uid AND source = 'shop' AND title LIKE v_tier_pattern AND created_at > now() - interval '7 days';
  IF v_tier_count >= 4 THEN RAISE EXCEPTION 'tier_limit_reached'; END IF;
  SELECT current_crew_id INTO v_crew FROM public.users WHERE id = v_uid;
  IF v_crew IS NULL THEN RAISE EXCEPTION 'not_in_crew'; END IF;
  SELECT gems INTO v_gems FROM public.user_gems WHERE user_id = v_uid FOR UPDATE;
  IF COALESCE(v_gems, 0) < p_cost THEN RAISE EXCEPTION 'not_enough_gems'; END IF;
  UPDATE public.user_gems SET gems = gems - p_cost, total_spent = COALESCE(total_spent, 0) + p_cost, updated_at = now() WHERE user_id = v_uid;
  SELECT COALESCE(display_name, username, 'Anonymer Spender') INTO v_donor FROM public.users WHERE id = v_uid;
  v_title := CASE v_tier WHEN 'mega' THEN format('💎 MEGA-DROP von %s', v_donor) ELSE format('💎 ELITE-DROP von %s', v_donor) END;
  INSERT INTO public.crew_gifts (crew_id, source, rarity, mutant_level, mutant_tier, source_user_id, title)
  VALUES (v_crew, 'shop', 'rare', NULL, NULL, v_uid, v_title) RETURNING id INTO v_gift_id;
  FOR v_member IN SELECT cm.user_id FROM public.crew_members cm WHERE cm.crew_id = v_crew LOOP
    v_tlv := COALESCE((SELECT level FROM public.user_segenstruhe WHERE user_id = v_member.user_id), 1);
    SELECT * INTO v_drop FROM public._roll_rare_gift_drop(v_tlv, v_tier);
    INSERT INTO public.crew_gift_claims (gift_id, user_id, drop_item_id, drop_item_qty, drop_key_points, drop_crystal_points)
    VALUES (v_gift_id, v_member.user_id, v_drop.item_id, v_drop.item_qty, v_key_pts, v_crys_pts)
    ON CONFLICT (gift_id, user_id) DO NOTHING;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'gift_id', v_gift_id, 'gems_spent', p_cost, 'donor', v_donor, 'tier', v_tier, 'tier_used', v_tier_count + 1, 'tier_remaining', 3 - v_tier_count);
END $function$;
REVOKE ALL ON FUNCTION public.donate_crew_gift(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.donate_crew_gift(int) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_crew_gifts(p_crew_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $function$
DECLARE v_uid uuid := auth.uid(); v_crew_id uuid; v_pending jsonb; v_claimed jsonb;
  v_seg record; v_open_cost int; v_up_cost int; v_preview text;
  v_elite_count int; v_mega_count int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  v_crew_id := COALESCE(p_crew_id, (SELECT current_crew_id FROM public.users WHERE id = v_uid));
  INSERT INTO public.user_segenstruhe (user_id) VALUES (v_uid) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO v_seg FROM public.user_segenstruhe WHERE user_id = v_uid;
  v_open_cost := public._segenstruhe_open_cost(v_seg.level);
  v_up_cost   := public._segenstruhe_upgrade_cost(v_seg.level);
  IF v_seg.level >= 30 THEN v_preview := 'Max-Tier-Pool: 60m–8h Speedups, ×2-Drops';
  ELSIF v_seg.level >= 15 THEN v_preview := format('Ab Stufe 30: +8h-Speedups + ×2 Drops (in %s Stufen)', 30 - v_seg.level);
  ELSE v_preview := format('Ab Stufe 15: bessere 60m-Pool (in %s Stufen)', 15 - v_seg.level); END IF;
  SELECT COUNT(*) FILTER (WHERE title LIKE '%ELITE-DROP%'), COUNT(*) FILTER (WHERE title LIKE '%MEGA-DROP%')
    INTO v_elite_count, v_mega_count
    FROM public.crew_gifts WHERE source_user_id = v_uid AND source = 'shop' AND created_at > now() - interval '7 days';
  IF v_crew_id IS NULL THEN v_pending := '[]'::jsonb; v_claimed := '[]'::jsonb;
  ELSE
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_pending FROM (
      SELECT g.id AS gift_id, g.rarity, g.source, g.mutant_level, g.mutant_tier, g.title, g.created_at, g.expires_at,
             c.drop_item_id, c.drop_item_qty, c.drop_key_points, c.drop_crystal_points,
             (SELECT name FROM public.inventory_item_catalog WHERE id = c.drop_item_id) AS drop_item_name,
             (SELECT emoji FROM public.inventory_item_catalog WHERE id = c.drop_item_id) AS drop_item_emoji,
             (SELECT COALESCE(display_name, username) FROM public.users WHERE id = g.source_user_id) AS donor_name
        FROM public.crew_gifts g JOIN public.crew_gift_claims c ON c.gift_id = g.id AND c.user_id = v_uid
       WHERE g.crew_id = v_crew_id AND c.claimed_at IS NULL AND g.expires_at > now()
       ORDER BY g.created_at DESC LIMIT 200) t;
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_claimed FROM (
      SELECT g.id AS gift_id, g.title, g.rarity, g.mutant_level, c.claimed_at
        FROM public.crew_gifts g JOIN public.crew_gift_claims c ON c.gift_id = g.id AND c.user_id = v_uid
       WHERE g.crew_id = v_crew_id AND c.claimed_at IS NOT NULL ORDER BY c.claimed_at DESC LIMIT 30) t;
  END IF;
  RETURN jsonb_build_object('pending', v_pending, 'claimed_recent', v_claimed,
    'segenstruhe', jsonb_build_object('level', v_seg.level, 'key_points', v_seg.key_points, 'crystal_points', v_seg.crystal_points,
      'opened_count', v_seg.opened_count, 'upgraded_count', v_seg.upgraded_count,
      'open_cost', v_open_cost, 'upgrade_cost', v_up_cost, 'is_max_level', v_seg.level >= 50, 'next_level_preview', v_preview),
    'donation_limits', jsonb_build_object(
      'weekly_limit', 4,
      'elite_used', v_elite_count, 'elite_remaining', GREATEST(0, 4 - v_elite_count),
      'mega_used',  v_mega_count,  'mega_remaining',  GREATEST(0, 4 - v_mega_count)
    ));
END $function$;
REVOKE ALL ON FUNCTION public.list_crew_gifts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_crew_gifts(uuid) TO authenticated;
