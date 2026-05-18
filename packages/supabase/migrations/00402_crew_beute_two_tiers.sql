-- ────────────────────────────────────────────────────────────────────────
-- 00402: Zwei Elite-Drop-Tiers + Marsch-Boost im Pool
-- ────────────────────────────────────────────────────────────────────────
-- Elite-Drop (200 💎): 12h-Pool [build/research/uni 12h + march-boost]
-- Mega-Drop (1000 💎): 24h-Pool [build/research/uni 24h + march-boost]
-- Beide ziehen den Member-Tresor-Level für qty-Scaling.
-- ────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public._roll_rare_gift_drop(int);

CREATE OR REPLACE FUNCTION public._roll_rare_gift_drop(p_tresor_level int DEFAULT 1, p_tier text DEFAULT 'elite')
RETURNS TABLE(item_id text, item_qty int)
LANGUAGE plpgsql IMMUTABLE
AS $function$
DECLARE
  v_tlv int := COALESCE(p_tresor_level, 1);
  v_pool text[];
  v_idx int;
  v_qty int;
BEGIN
  -- Tier-Auswahl: 'mega' = 24h-Pool, sonst 'elite' = 12h-Pool
  IF p_tier = 'mega' THEN
    v_pool := ARRAY[
      'speedup_build_24h','speedup_research_24h','speedup_uni_24h',
      'speedup_march_500'
    ];
    -- qty = 5 base + bonus für hohe Tresor-Stufe
    v_qty := CASE WHEN v_tlv >= 20 THEN 7 WHEN v_tlv >= 10 THEN 6 ELSE 5 END;
  ELSE
    v_pool := ARRAY[
      'speedup_build_12h','speedup_research_12h','speedup_uni_12h',
      'speedup_march_250'
    ];
    v_qty := CASE WHEN v_tlv >= 20 THEN 5 WHEN v_tlv >= 10 THEN 4 ELSE 3 END;
  END IF;

  v_idx := 1 + floor(random() * array_length(v_pool, 1))::int;
  item_id := v_pool[v_idx];
  item_qty := v_qty;
  RETURN NEXT;
END $function$;
REVOKE ALL ON FUNCTION public._roll_rare_gift_drop(int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._roll_rare_gift_drop(int, text) TO service_role;

-- donate_crew_gift: cost bestimmt Tier
CREATE OR REPLACE FUNCTION public.donate_crew_gift(p_cost int DEFAULT 200)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid(); v_crew uuid; v_gems int; v_gift_id uuid; v_title text;
  v_member record; v_drop record;
  v_tier text; v_key_pts int; v_crys_pts int; v_donor text; v_tlv int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_cost < 50 OR p_cost > 5000 THEN RAISE EXCEPTION 'invalid_cost'; END IF;

  -- Tier-Auswahl nach Spendenhöhe
  IF p_cost >= 1000 THEN
    v_tier := 'mega';
    v_key_pts := 1500;
    v_crys_pts := 750;
  ELSE
    v_tier := 'elite';
    v_key_pts := 500;
    v_crys_pts := 250;
  END IF;

  SELECT current_crew_id INTO v_crew FROM public.users WHERE id = v_uid;
  IF v_crew IS NULL THEN RAISE EXCEPTION 'not_in_crew'; END IF;
  SELECT gems INTO v_gems FROM public.user_gems WHERE user_id = v_uid FOR UPDATE;
  IF COALESCE(v_gems, 0) < p_cost THEN RAISE EXCEPTION 'not_enough_gems'; END IF;
  UPDATE public.user_gems SET gems = gems - p_cost, total_spent = COALESCE(total_spent, 0) + p_cost, updated_at = now() WHERE user_id = v_uid;
  SELECT COALESCE(display_name, username, 'Anonymer Spender') INTO v_donor FROM public.users WHERE id = v_uid;

  v_title := CASE v_tier
    WHEN 'mega' THEN format('💎 MEGA-DROP von %s', v_donor)
    ELSE format('💎 ELITE-DROP von %s', v_donor)
  END;

  INSERT INTO public.crew_gifts (crew_id, source, rarity, mutant_level, mutant_tier, source_user_id, title)
  VALUES (v_crew, 'shop', 'rare', NULL, NULL, v_uid, v_title) RETURNING id INTO v_gift_id;

  FOR v_member IN SELECT cm.user_id FROM public.crew_members cm WHERE cm.crew_id = v_crew LOOP
    v_tlv := COALESCE((SELECT level FROM public.user_segenstruhe WHERE user_id = v_member.user_id), 1);
    SELECT * INTO v_drop FROM public._roll_rare_gift_drop(v_tlv, v_tier);
    INSERT INTO public.crew_gift_claims (gift_id, user_id, drop_item_id, drop_item_qty, drop_key_points, drop_crystal_points)
    VALUES (v_gift_id, v_member.user_id, v_drop.item_id, v_drop.item_qty, v_key_pts, v_crys_pts)
    ON CONFLICT (gift_id, user_id) DO NOTHING;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'gift_id', v_gift_id, 'gems_spent', p_cost, 'donor', v_donor, 'tier', v_tier);
END $function$;
REVOKE ALL ON FUNCTION public.donate_crew_gift(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.donate_crew_gift(int) TO authenticated;
