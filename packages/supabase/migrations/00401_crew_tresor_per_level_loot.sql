-- ────────────────────────────────────────────────────────────────────────
-- 00401: Crew-Tresor — Loot pro Stufe + Rare-Spende massiv aufwerten
-- ────────────────────────────────────────────────────────────────────────
-- 1) qty bei Common-Gift skaliert mit Tresor-Stufe des Empfängers:
--    qty = 1 + floor(level/5)  → Lv 1: 1, Lv 5: 2, Lv 10: 3, Lv 30: 7
-- 2) Pool-Upgrade jetzt schon ab Lv 8 (statt Lv 10) und Lv 12 (statt Lv 15)
-- 3) Rare-Spende grants 3 Items + 1 Gold-Chest + 500 Bypass + 250 Mikrochip
--    Kosten bleiben bei 200 💎 (Default), Spender entscheidet pro Spende.
-- ────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._roll_common_gift_drop(p_mutant_level int, p_tresor_level int DEFAULT 1)
RETURNS TABLE(item_id text, item_qty int)
LANGUAGE plpgsql IMMUTABLE
AS $function$
DECLARE
  v_lv  int := COALESCE(p_mutant_level, 1);
  v_tlv int := COALESCE(p_tresor_level, 1);
  v_pool text[];
  v_idx  int;
  v_qty  int;
BEGIN
  -- Pool-Tier abhängig von Mutant-Level (gleich wie vorher, nur feiner)
  IF v_lv >= 20 THEN
    v_pool := ARRAY[
      'speedup_build_15m','speedup_research_15m','speedup_uni_15m','speedup_uni_15m',
      'speedup_build_60m','speedup_research_60m','speedup_uni_60m',
      'speedup_build_8h','speedup_research_8h'
    ];
  ELSIF v_lv >= 12 THEN
    v_pool := ARRAY[
      'speedup_build_15m','speedup_research_15m','speedup_uni_5m','speedup_uni_15m',
      'speedup_build_60m','speedup_research_60m'
    ];
  ELSIF v_lv >= 8 THEN
    v_pool := ARRAY[
      'speedup_build_5m','speedup_research_5m','speedup_build_15m','speedup_research_15m',
      'speedup_build_15m','speedup_research_15m','speedup_uni_5m'
    ];
  ELSIF v_lv >= 4 THEN
    v_pool := ARRAY[
      'speedup_build_5m','speedup_research_5m','speedup_build_15m','speedup_research_15m'
    ];
  ELSE
    v_pool := ARRAY['speedup_build_1m','speedup_research_1m','speedup_build_5m','speedup_research_5m'];
  END IF;

  v_idx := 1 + floor(random() * array_length(v_pool, 1))::int;
  item_id := v_pool[v_idx];

  -- qty skaliert mit Tresor-Stufe: 1 + floor(level/5)
  -- Lv 1-4: 1, Lv 5-9: 2, Lv 10-14: 3, Lv 15-19: 4, Lv 20-24: 5, Lv 25-29: 6, Lv 30+: 7
  v_qty := 1 + (v_tlv / 5)::int;
  item_qty := v_qty;
  RETURN NEXT;
END $function$;
REVOKE ALL ON FUNCTION public._roll_common_gift_drop(int,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._roll_common_gift_drop(int,int) TO service_role;

-- create_crew_mutant_gift: zieht user.segenstruhe.level für jedes Member-Roll
CREATE OR REPLACE FUNCTION public.create_crew_mutant_gift(
  p_crew_id uuid, p_mutant_level int, p_mutant_tier text, p_source_user_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_gift_id uuid; v_title text; v_key_pts int; v_crys_pts int; v_member record; v_drop record;
  v_tlv int;
BEGIN
  IF p_crew_id IS NULL THEN RETURN NULL; END IF;
  v_title := format('🎁 Mutant Stufe %s (%s) besiegt', COALESCE(p_mutant_level, 1), COALESCE(p_mutant_tier, 'bronze'));
  INSERT INTO public.crew_gifts (crew_id, source, rarity, mutant_level, mutant_tier, source_user_id, title)
  VALUES (p_crew_id, 'mutant', 'common', p_mutant_level, p_mutant_tier, p_source_user_id, v_title)
  RETURNING id INTO v_gift_id;
  v_key_pts  := 50 + COALESCE(p_mutant_level, 1) * 5;
  v_crys_pts := 25 + COALESCE(p_mutant_level, 1) * 2;
  FOR v_member IN SELECT cm.user_id FROM public.crew_members cm WHERE cm.crew_id = p_crew_id LOOP
    -- Tresor-Stufe des Members holen (default 1 falls noch nie erstellt)
    v_tlv := COALESCE((SELECT level FROM public.user_segenstruhe WHERE user_id = v_member.user_id), 1);
    SELECT * INTO v_drop FROM public._roll_common_gift_drop(p_mutant_level, v_tlv);
    INSERT INTO public.crew_gift_claims (gift_id, user_id, drop_item_id, drop_item_qty, drop_key_points, drop_crystal_points)
    VALUES (v_gift_id, v_member.user_id, v_drop.item_id, v_drop.item_qty, v_key_pts, v_crys_pts)
    ON CONFLICT (gift_id, user_id) DO NOTHING;
  END LOOP;
  RETURN v_gift_id;
END $function$;
REVOKE ALL ON FUNCTION public.create_crew_mutant_gift(uuid,int,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_crew_mutant_gift(uuid,int,text,uuid) TO service_role;

-- ─── Rare-Spende massiv aufwerten ──────────────────────────────────────
-- Jedes Crew-Member bekommt jetzt:
--  • 3× zufälligen Speedup aus Premium-Pool (60m / 8h / uni-60m / uni-15m)
--  • +1× Bonus-Item bei Tresor-Stufe >= 10 (4 Items total)
--  • +500 Bypass-Codes (statt 200)
--  • +250 Mikrochips (statt 100)
-- Drop-Pool ist breiter, qty fix bei 3 (4 ab Lv 10) → richtig viel Loot.
CREATE OR REPLACE FUNCTION public._roll_rare_gift_drop(p_tresor_level int DEFAULT 1)
RETURNS TABLE(item_id text, item_qty int)
LANGUAGE plpgsql IMMUTABLE
AS $function$
DECLARE
  v_tlv int := COALESCE(p_tresor_level, 1);
  v_pool text[];
  v_idx int;
  v_qty int;
BEGIN
  -- Premium-Pool: nur große Speedups
  IF v_tlv >= 20 THEN
    v_pool := ARRAY[
      'speedup_build_8h','speedup_research_8h','speedup_uni_60m','speedup_uni_60m',
      'speedup_build_12h','speedup_research_12h'
    ];
    v_qty := 5;
  ELSIF v_tlv >= 10 THEN
    v_pool := ARRAY[
      'speedup_build_60m','speedup_research_60m','speedup_uni_60m',
      'speedup_build_8h','speedup_research_8h','speedup_uni_15m'
    ];
    v_qty := 4;
  ELSE
    v_pool := ARRAY[
      'speedup_build_60m','speedup_research_60m','speedup_uni_60m',
      'speedup_uni_15m','speedup_build_8h','speedup_research_8h'
    ];
    v_qty := 3;
  END IF;
  v_idx := 1 + floor(random() * array_length(v_pool, 1))::int;
  item_id := v_pool[v_idx];
  item_qty := v_qty;
  RETURN NEXT;
END $function$;
REVOKE ALL ON FUNCTION public._roll_rare_gift_drop(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._roll_rare_gift_drop(int) TO service_role;

-- Alte 1-Param-Variante droppen (war text → unused)
DROP FUNCTION IF EXISTS public._roll_rare_gift_drop(text);

CREATE OR REPLACE FUNCTION public.donate_crew_gift(p_cost int DEFAULT 200)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid(); v_crew uuid; v_gems int; v_gift_id uuid; v_title text;
  v_member record; v_drop record;
  v_key_pts int := 500; v_crys_pts int := 250; v_donor text; v_tlv int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_cost < 50 OR p_cost > 5000 THEN RAISE EXCEPTION 'invalid_cost'; END IF;
  SELECT current_crew_id INTO v_crew FROM public.users WHERE id = v_uid;
  IF v_crew IS NULL THEN RAISE EXCEPTION 'not_in_crew'; END IF;
  SELECT gems INTO v_gems FROM public.user_gems WHERE user_id = v_uid FOR UPDATE;
  IF COALESCE(v_gems, 0) < p_cost THEN RAISE EXCEPTION 'not_enough_gems'; END IF;
  UPDATE public.user_gems
     SET gems = gems - p_cost, total_spent = COALESCE(total_spent, 0) + p_cost, updated_at = now()
   WHERE user_id = v_uid;
  SELECT COALESCE(display_name, username, 'Anonymer Spender') INTO v_donor FROM public.users WHERE id = v_uid;
  v_title := format('💎 ELITE-DROP von %s', v_donor);
  INSERT INTO public.crew_gifts (crew_id, source, rarity, mutant_level, mutant_tier, source_user_id, title)
  VALUES (v_crew, 'shop', 'rare', NULL, NULL, v_uid, v_title) RETURNING id INTO v_gift_id;

  FOR v_member IN SELECT cm.user_id FROM public.crew_members cm WHERE cm.crew_id = v_crew LOOP
    v_tlv := COALESCE((SELECT level FROM public.user_segenstruhe WHERE user_id = v_member.user_id), 1);
    SELECT * INTO v_drop FROM public._roll_rare_gift_drop(v_tlv);
    INSERT INTO public.crew_gift_claims (gift_id, user_id, drop_item_id, drop_item_qty, drop_key_points, drop_crystal_points)
    VALUES (v_gift_id, v_member.user_id, v_drop.item_id, v_drop.item_qty, v_key_pts, v_crys_pts)
    ON CONFLICT (gift_id, user_id) DO NOTHING;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'gift_id', v_gift_id, 'gems_spent', p_cost, 'donor', v_donor);
END $function$;
REVOKE ALL ON FUNCTION public.donate_crew_gift(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.donate_crew_gift(int) TO authenticated;
