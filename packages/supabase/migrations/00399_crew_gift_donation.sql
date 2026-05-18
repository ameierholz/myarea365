-- ────────────────────────────────────────────────────────────────────────
-- 00399: Rare-Crew-Geschenke per Diamant-Spende
-- ────────────────────────────────────────────────────────────────────────
-- Da die Stripe/IAP-Integration für Crew-Shop-Käufe noch nicht verkabelt
-- ist, bekommen wir Rare-Gifts über eine direkte Diamant-Spende:
-- Member zahlt 200 Diamanten → erstellt ein Rare-Crew-Geschenk für ALLE
-- Mitglieder mit besseren Drops (60m+ Speedups, mehr Punkte).
-- ────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._roll_rare_gift_drop(p_seed text)
RETURNS TABLE(item_id text, item_qty int)
LANGUAGE plpgsql IMMUTABLE
AS $function$
DECLARE
  v_pool text[] := ARRAY[
    'speedup_build_60m','speedup_research_60m','speedup_uni_60m',
    'speedup_build_60m','speedup_research_60m',
    'speedup_uni_15m','speedup_uni_15m',
    'speedup_build_8h','speedup_research_8h'
  ];
  v_idx int;
BEGIN
  v_idx := 1 + floor(random() * array_length(v_pool, 1))::int;
  item_id := v_pool[v_idx];
  item_qty := 1;
  RETURN NEXT;
END $function$;
REVOKE ALL ON FUNCTION public._roll_rare_gift_drop(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._roll_rare_gift_drop(text) TO service_role;

-- Donate-RPC: callable durch jeden Crew-Member.
-- Kostet 200 Diamanten. Erzeugt 1 rare crew_gift + claims für ALLE Members.
CREATE OR REPLACE FUNCTION public.donate_crew_gift(p_cost int DEFAULT 200)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid    uuid := auth.uid();
  v_crew   uuid;
  v_gems   int;
  v_gift_id uuid;
  v_title  text;
  v_member record;
  v_drop   record;
  v_key_pts  int := 200;  -- Rare: flat 200 Schlüssel
  v_crys_pts int := 100;  -- Rare: flat 100 Mikrochips
  v_donor    text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_cost < 50 OR p_cost > 5000 THEN RAISE EXCEPTION 'invalid_cost'; END IF;

  -- Crew des Donors ermitteln
  SELECT current_crew_id INTO v_crew FROM public.users WHERE id = v_uid;
  IF v_crew IS NULL THEN RAISE EXCEPTION 'not_in_crew'; END IF;

  -- Diamanten-Abzug (atomic)
  SELECT gems INTO v_gems FROM public.user_gems WHERE user_id = v_uid FOR UPDATE;
  IF COALESCE(v_gems, 0) < p_cost THEN RAISE EXCEPTION 'not_enough_gems'; END IF;
  UPDATE public.user_gems
     SET gems = gems - p_cost,
         total_spent = COALESCE(total_spent, 0) + p_cost,
         updated_at = now()
   WHERE user_id = v_uid;

  -- Display-Name vom Donor
  SELECT COALESCE(display_name, username, 'Anonymer Spender') INTO v_donor
    FROM public.users WHERE id = v_uid;

  v_title := format('💎 Rare-Geschenk von %s', v_donor);

  -- Gift erstellen
  INSERT INTO public.crew_gifts (crew_id, source, rarity, mutant_level, mutant_tier, source_user_id, title)
  VALUES (v_crew, 'shop', 'rare', NULL, NULL, v_uid, v_title)
  RETURNING id INTO v_gift_id;

  -- Pre-Roll für jedes aktive Crew-Member
  FOR v_member IN
    SELECT cm.user_id FROM public.crew_members cm WHERE cm.crew_id = v_crew
  LOOP
    SELECT * INTO v_drop FROM public._roll_rare_gift_drop(v_gift_id::text);
    INSERT INTO public.crew_gift_claims (gift_id, user_id, drop_item_id, drop_item_qty, drop_key_points, drop_crystal_points)
    VALUES (v_gift_id, v_member.user_id, v_drop.item_id, v_drop.item_qty, v_key_pts, v_crys_pts)
    ON CONFLICT (gift_id, user_id) DO NOTHING;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'gift_id', v_gift_id, 'gems_spent', p_cost, 'donor', v_donor);
END $function$;
REVOKE ALL ON FUNCTION public.donate_crew_gift(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.donate_crew_gift(int) TO authenticated;
