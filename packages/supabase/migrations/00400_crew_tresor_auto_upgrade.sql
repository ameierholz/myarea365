-- ────────────────────────────────────────────────────────────────────────
-- 00400: Crew-Tresor — Auto-Upgrade auf Mikrochip-Threshold
-- ────────────────────────────────────────────────────────────────────────
-- User-Wunsch: Stufen erhöhen sich automatisch. Sobald crystal_points >=
-- upgrade_cost(level), wird der Tresor in einer Schleife upgegradet (so
-- viele Stufen wie das Budget hergibt). Der "Stufe erhöhen"-Button entfällt.
-- ────────────────────────────────────────────────────────────────────────

-- Helper: führt Auto-Upgrade in einer Loop aus. Greift nur am DB-Layer,
-- damit ALLE Wege (Mutant-Gift-Claim, Spende, manuelle Calls) konsistent
-- auto-upgraden.
CREATE OR REPLACE FUNCTION public._auto_upgrade_segenstruhe(p_user_id uuid)
RETURNS int
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_row record;
  v_cost int;
  v_upgrades int := 0;
BEGIN
  SELECT * INTO v_row FROM public.user_segenstruhe WHERE user_id = p_user_id FOR UPDATE;
  IF v_row IS NULL THEN RETURN 0; END IF;

  LOOP
    EXIT WHEN v_row.level >= 50;
    v_cost := public._segenstruhe_upgrade_cost(v_row.level);
    EXIT WHEN v_row.crystal_points < v_cost;

    UPDATE public.user_segenstruhe
       SET crystal_points = crystal_points - v_cost,
           level          = level + 1,
           upgraded_count = upgraded_count + 1,
           updated_at     = now()
     WHERE user_id = p_user_id
     RETURNING * INTO v_row;
    v_upgrades := v_upgrades + 1;
  END LOOP;

  RETURN v_upgrades;
END $function$;
REVOKE ALL ON FUNCTION public._auto_upgrade_segenstruhe(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._auto_upgrade_segenstruhe(uuid) TO authenticated, service_role;

-- claim_crew_gift: nach Mikrochip-Grant Auto-Upgrade triggern
CREATE OR REPLACE FUNCTION public.claim_crew_gift(p_gift_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid(); v_claim record; v_gift record; v_lvls int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_gift FROM public.crew_gifts WHERE id = p_gift_id;
  IF v_gift IS NULL THEN RAISE EXCEPTION 'gift_not_found'; END IF;
  IF v_gift.expires_at < now() THEN RAISE EXCEPTION 'gift_expired'; END IF;
  SELECT * INTO v_claim FROM public.crew_gift_claims WHERE gift_id = p_gift_id AND user_id = v_uid FOR UPDATE;
  IF v_claim IS NULL THEN RAISE EXCEPTION 'not_eligible'; END IF;
  IF v_claim.claimed_at IS NOT NULL THEN RAISE EXCEPTION 'already_claimed'; END IF;

  IF v_claim.drop_item_id IS NOT NULL AND v_claim.drop_item_qty > 0 THEN
    PERFORM public.grant_inventory_item(v_uid, v_claim.drop_item_id, v_claim.drop_item_qty);
  END IF;

  INSERT INTO public.user_segenstruhe (user_id, key_points, crystal_points)
  VALUES (v_uid, v_claim.drop_key_points, v_claim.drop_crystal_points)
  ON CONFLICT (user_id) DO UPDATE SET
    key_points     = public.user_segenstruhe.key_points     + EXCLUDED.key_points,
    crystal_points = public.user_segenstruhe.crystal_points + EXCLUDED.crystal_points,
    updated_at     = now();

  UPDATE public.crew_gift_claims SET claimed_at = now() WHERE gift_id = p_gift_id AND user_id = v_uid;

  -- Auto-Upgrade
  v_lvls := public._auto_upgrade_segenstruhe(v_uid);

  RETURN jsonb_build_object(
    'ok', true,
    'item_id', v_claim.drop_item_id,
    'item_qty', v_claim.drop_item_qty,
    'key_points', v_claim.drop_key_points,
    'crystal_points', v_claim.drop_crystal_points,
    'auto_upgrades', v_lvls
  );
END $function$;
REVOKE ALL ON FUNCTION public.claim_crew_gift(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_crew_gift(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_all_crew_gifts()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid(); v_total_key int := 0; v_total_crys int := 0;
  v_items_count int := 0; v_r record; v_lvls int := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  FOR v_r IN
    SELECT c.gift_id, c.drop_item_id, c.drop_item_qty, c.drop_key_points, c.drop_crystal_points
      FROM public.crew_gift_claims c JOIN public.crew_gifts g ON g.id = c.gift_id
     WHERE c.user_id = v_uid AND c.claimed_at IS NULL AND g.expires_at > now()
  LOOP
    IF v_r.drop_item_id IS NOT NULL AND v_r.drop_item_qty > 0 THEN
      PERFORM public.grant_inventory_item(v_uid, v_r.drop_item_id, v_r.drop_item_qty);
      v_items_count := v_items_count + v_r.drop_item_qty;
    END IF;
    v_total_key  := v_total_key  + v_r.drop_key_points;
    v_total_crys := v_total_crys + v_r.drop_crystal_points;
    UPDATE public.crew_gift_claims SET claimed_at = now() WHERE gift_id = v_r.gift_id AND user_id = v_uid;
  END LOOP;
  IF v_total_key > 0 OR v_total_crys > 0 THEN
    INSERT INTO public.user_segenstruhe (user_id, key_points, crystal_points)
    VALUES (v_uid, v_total_key, v_total_crys)
    ON CONFLICT (user_id) DO UPDATE SET
      key_points     = public.user_segenstruhe.key_points     + EXCLUDED.key_points,
      crystal_points = public.user_segenstruhe.crystal_points + EXCLUDED.crystal_points,
      updated_at     = now();
    v_lvls := public._auto_upgrade_segenstruhe(v_uid);
  END IF;
  RETURN jsonb_build_object('ok', true, 'items', v_items_count, 'key_points', v_total_key, 'crystal_points', v_total_crys, 'auto_upgrades', v_lvls);
END $function$;
REVOKE ALL ON FUNCTION public.claim_all_crew_gifts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_all_crew_gifts() TO authenticated;

-- list_crew_gifts: erweitert um next_level_preview-Text (Drop-Pool-Highlight)
CREATE OR REPLACE FUNCTION public.list_crew_gifts(p_crew_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid(); v_crew_id uuid; v_pending jsonb; v_claimed jsonb;
  v_seg record; v_open_cost int; v_up_cost int; v_preview text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  v_crew_id := COALESCE(p_crew_id, (SELECT current_crew_id FROM public.users WHERE id = v_uid));
  INSERT INTO public.user_segenstruhe (user_id) VALUES (v_uid) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO v_seg FROM public.user_segenstruhe WHERE user_id = v_uid;
  v_open_cost := public._segenstruhe_open_cost(v_seg.level);
  v_up_cost   := public._segenstruhe_upgrade_cost(v_seg.level);

  -- Preview-Text für die nächste Stufen-Schwelle
  IF v_seg.level >= 30 THEN
    v_preview := 'Max-Tier-Pool: 60m–8h Speedups, ×2-Drops';
  ELSIF v_seg.level >= 15 THEN
    v_preview := format('Ab Stufe 30: +8h-Speedups + ×2 Drops (in %s Stufen)', 30 - v_seg.level);
  ELSE
    v_preview := format('Ab Stufe 15: bessere 60m-Pool (in %s Stufen)', 15 - v_seg.level);
  END IF;

  IF v_crew_id IS NULL THEN
    v_pending := '[]'::jsonb; v_claimed := '[]'::jsonb;
  ELSE
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_pending FROM (
      SELECT g.id AS gift_id, g.rarity, g.source, g.mutant_level, g.mutant_tier, g.title, g.created_at, g.expires_at,
             c.drop_item_id, c.drop_item_qty, c.drop_key_points, c.drop_crystal_points,
             (SELECT name FROM public.inventory_item_catalog WHERE id = c.drop_item_id) AS drop_item_name,
             (SELECT emoji FROM public.inventory_item_catalog WHERE id = c.drop_item_id) AS drop_item_emoji
        FROM public.crew_gifts g
        JOIN public.crew_gift_claims c ON c.gift_id = g.id AND c.user_id = v_uid
       WHERE g.crew_id = v_crew_id AND c.claimed_at IS NULL AND g.expires_at > now()
       ORDER BY g.created_at DESC LIMIT 200
    ) t;
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_claimed FROM (
      SELECT g.id AS gift_id, g.title, g.rarity, g.mutant_level, c.claimed_at
        FROM public.crew_gifts g
        JOIN public.crew_gift_claims c ON c.gift_id = g.id AND c.user_id = v_uid
       WHERE g.crew_id = v_crew_id AND c.claimed_at IS NOT NULL
       ORDER BY c.claimed_at DESC LIMIT 30
    ) t;
  END IF;
  RETURN jsonb_build_object(
    'pending', v_pending,
    'claimed_recent', v_claimed,
    'segenstruhe', jsonb_build_object(
      'level', v_seg.level, 'key_points', v_seg.key_points, 'crystal_points', v_seg.crystal_points,
      'opened_count', v_seg.opened_count, 'upgraded_count', v_seg.upgraded_count,
      'open_cost', v_open_cost, 'upgrade_cost', v_up_cost, 'is_max_level', v_seg.level >= 50,
      'next_level_preview', v_preview
    )
  );
END $function$;
REVOKE ALL ON FUNCTION public.list_crew_gifts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_crew_gifts(uuid) TO authenticated;

-- Zähl-RPC für Quick-Bar + Tile-Badge (lightweight, keine join-Pyramide)
CREATE OR REPLACE FUNCTION public.count_crew_gifts_pending()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $function$
DECLARE v_uid uuid := auth.uid(); v_common int := 0; v_rare int := 0;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('common',0,'rare',0,'total',0); END IF;
  SELECT
    COUNT(*) FILTER (WHERE g.rarity = 'common'),
    COUNT(*) FILTER (WHERE g.rarity = 'rare')
    INTO v_common, v_rare
    FROM public.crew_gift_claims c
    JOIN public.crew_gifts g ON g.id = c.gift_id
   WHERE c.user_id = v_uid AND c.claimed_at IS NULL AND g.expires_at > now();
  RETURN jsonb_build_object('common', COALESCE(v_common,0), 'rare', COALESCE(v_rare,0), 'total', COALESCE(v_common,0)+COALESCE(v_rare,0));
END $function$;
REVOKE ALL ON FUNCTION public.count_crew_gifts_pending() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_crew_gifts_pending() TO authenticated;
