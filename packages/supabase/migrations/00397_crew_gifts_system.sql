-- ────────────────────────────────────────────────────────────────────────
-- 00397: Crew-Geschenke-System (CoD Allianzgeschenke-Klon)
-- ────────────────────────────────────────────────────────────────────────
-- Spec (siehe project_crew_gifts_planned memory):
--  • Mutant-Defeat → COMMON-Gift für JEDES aktive Crew-Mitglied (CoD-Stil)
--  • Drops werden bei Gift-Erstellung pre-rolled (deterministisches Display)
--  • Punkte skalieren mit Mutant-Level:
--      Schlüsselpunkte = 50 + level × 5
--      Kristallpunkte  = 25 + level × 2
--  • Segenstruhe pro USER (Level 1-50)
--  • 24h Auto-Expiry, kein FIFO-Limit
--  • Shop-RARE-Gifts: Schema vorbereitet, Hook kommt in späterem Sprint
-- ────────────────────────────────────────────────────────────────────────

-- ─── 1) Tabellen ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.crew_gifts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id           uuid NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  source            text NOT NULL CHECK (source IN ('mutant','shop')),
  rarity            text NOT NULL CHECK (rarity IN ('common','rare')),
  mutant_level      int,
  mutant_tier       text,
  source_user_id    uuid REFERENCES public.users(id) ON DELETE SET NULL,
  title             text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);
CREATE INDEX IF NOT EXISTS idx_crew_gifts_crew_created ON public.crew_gifts (crew_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crew_gifts_expires      ON public.crew_gifts (expires_at);

CREATE TABLE IF NOT EXISTS public.crew_gift_claims (
  gift_id            uuid NOT NULL REFERENCES public.crew_gifts(id) ON DELETE CASCADE,
  user_id            uuid NOT NULL REFERENCES public.users(id)      ON DELETE CASCADE,
  drop_item_id       text,
  drop_item_qty      int  NOT NULL DEFAULT 0,
  drop_key_points    int  NOT NULL DEFAULT 0,
  drop_crystal_points int NOT NULL DEFAULT 0,
  claimed_at         timestamptz,
  PRIMARY KEY (gift_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_crew_gift_claims_user_pending
  ON public.crew_gift_claims (user_id) WHERE claimed_at IS NULL;

CREATE TABLE IF NOT EXISTS public.user_segenstruhe (
  user_id          uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  level            int NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 50),
  key_points       int NOT NULL DEFAULT 0,
  crystal_points   int NOT NULL DEFAULT 0,
  opened_count     int NOT NULL DEFAULT 0,
  upgraded_count   int NOT NULL DEFAULT 0,
  last_opened_at   timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crew_gifts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_gift_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_segenstruhe ENABLE ROW LEVEL SECURITY;

-- Crew-Members dürfen ihre Crew-Geschenke lesen.
DROP POLICY IF EXISTS crew_gifts_read ON public.crew_gifts;
CREATE POLICY crew_gifts_read ON public.crew_gifts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.crew_members cm
                  WHERE cm.crew_id = crew_gifts.crew_id AND cm.user_id = auth.uid()));

DROP POLICY IF EXISTS crew_gift_claims_read ON public.crew_gift_claims;
CREATE POLICY crew_gift_claims_read ON public.crew_gift_claims FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_segenstruhe_read ON public.user_segenstruhe;
CREATE POLICY user_segenstruhe_read ON public.user_segenstruhe FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ─── 2) Drop-Pool: zufälliger Item-Roll abhängig von Mutant-Level ───────

CREATE OR REPLACE FUNCTION public._roll_common_gift_drop(p_mutant_level int)
RETURNS TABLE(item_id text, item_qty int)
LANGUAGE plpgsql IMMUTABLE
AS $function$
DECLARE
  v_roll numeric;
  v_lv int := COALESCE(p_mutant_level, 1);
  v_pool text[];
  v_idx  int;
BEGIN
  -- Pool wächst mit Mutant-Level: niedrige Level = nur kleine Speedups,
  -- ab Lv 5 kommt 15m rein, ab Lv 10 kommen 60m + Uni-5m, ab Lv 15 Uni-15m.
  IF v_lv >= 15 THEN
    v_pool := ARRAY[
      'speedup_build_5m','speedup_build_5m','speedup_research_5m','speedup_research_5m',
      'speedup_build_15m','speedup_research_15m',
      'speedup_build_60m','speedup_research_60m',
      'speedup_uni_5m','speedup_uni_15m'
    ];
  ELSIF v_lv >= 10 THEN
    v_pool := ARRAY[
      'speedup_build_5m','speedup_build_5m','speedup_research_5m','speedup_research_5m',
      'speedup_build_15m','speedup_research_15m',
      'speedup_build_60m','speedup_research_60m',
      'speedup_uni_5m'
    ];
  ELSIF v_lv >= 5 THEN
    v_pool := ARRAY[
      'speedup_build_5m','speedup_build_5m','speedup_research_5m','speedup_research_5m',
      'speedup_build_15m','speedup_research_15m'
    ];
  ELSE
    v_pool := ARRAY['speedup_build_5m','speedup_research_5m','speedup_build_1m','speedup_research_1m'];
  END IF;

  v_idx := 1 + floor(random() * array_length(v_pool, 1))::int;
  item_id  := v_pool[v_idx];
  item_qty := 1;
  RETURN NEXT;
END $function$;
REVOKE ALL ON FUNCTION public._roll_common_gift_drop(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._roll_common_gift_drop(int) TO service_role;

-- ─── 3) Gift bei Mutant-Defeat erzeugen — pre-rolled per Mitglied ───────

CREATE OR REPLACE FUNCTION public.create_crew_mutant_gift(
  p_crew_id        uuid,
  p_mutant_level   int,
  p_mutant_tier    text,
  p_source_user_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_gift_id   uuid;
  v_title     text;
  v_key_pts   int;
  v_crys_pts  int;
  v_member    record;
  v_drop      record;
BEGIN
  IF p_crew_id IS NULL THEN RETURN NULL; END IF;

  v_title := format('🎁 Mutant Stufe %s (%s) besiegt', COALESCE(p_mutant_level, 1), COALESCE(p_mutant_tier, 'bronze'));

  INSERT INTO public.crew_gifts (crew_id, source, rarity, mutant_level, mutant_tier, source_user_id, title)
  VALUES (p_crew_id, 'mutant', 'common', p_mutant_level, p_mutant_tier, p_source_user_id, v_title)
  RETURNING id INTO v_gift_id;

  v_key_pts  := 50 + COALESCE(p_mutant_level, 1) * 5;
  v_crys_pts := 25 + COALESCE(p_mutant_level, 1) * 2;

  -- Pre-Roll eines Drops für JEDES aktive Crew-Mitglied (CoD-Style).
  FOR v_member IN
    SELECT cm.user_id FROM public.crew_members cm WHERE cm.crew_id = p_crew_id
  LOOP
    SELECT * INTO v_drop FROM public._roll_common_gift_drop(p_mutant_level);
    INSERT INTO public.crew_gift_claims (gift_id, user_id, drop_item_id, drop_item_qty, drop_key_points, drop_crystal_points)
    VALUES (v_gift_id, v_member.user_id, v_drop.item_id, v_drop.item_qty, v_key_pts, v_crys_pts)
    ON CONFLICT (gift_id, user_id) DO NOTHING;
  END LOOP;

  RETURN v_gift_id;
END $function$;
REVOKE ALL ON FUNCTION public.create_crew_mutant_gift(uuid,int,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_crew_mutant_gift(uuid,int,text,uuid) TO service_role;

-- ─── 4) Gift claimen (single + bulk) ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.claim_crew_gift(p_gift_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid      uuid := auth.uid();
  v_claim    record;
  v_gift     record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_gift FROM public.crew_gifts WHERE id = p_gift_id;
  IF v_gift IS NULL THEN RAISE EXCEPTION 'gift_not_found'; END IF;
  IF v_gift.expires_at < now() THEN RAISE EXCEPTION 'gift_expired'; END IF;

  SELECT * INTO v_claim FROM public.crew_gift_claims
   WHERE gift_id = p_gift_id AND user_id = v_uid FOR UPDATE;
  IF v_claim IS NULL THEN RAISE EXCEPTION 'not_eligible'; END IF;
  IF v_claim.claimed_at IS NOT NULL THEN RAISE EXCEPTION 'already_claimed'; END IF;

  -- Item granten (wenn vorhanden im Catalog)
  IF v_claim.drop_item_id IS NOT NULL AND v_claim.drop_item_qty > 0 THEN
    PERFORM public.grant_inventory_item(v_uid, v_claim.drop_item_id, v_claim.drop_item_qty);
  END IF;

  -- Punkte auf Segenstruhe gutschreiben (auto-init falls erste Interaktion)
  INSERT INTO public.user_segenstruhe (user_id, key_points, crystal_points)
  VALUES (v_uid, v_claim.drop_key_points, v_claim.drop_crystal_points)
  ON CONFLICT (user_id) DO UPDATE SET
    key_points     = public.user_segenstruhe.key_points     + EXCLUDED.key_points,
    crystal_points = public.user_segenstruhe.crystal_points + EXCLUDED.crystal_points,
    updated_at     = now();

  UPDATE public.crew_gift_claims SET claimed_at = now()
   WHERE gift_id = p_gift_id AND user_id = v_uid;

  RETURN jsonb_build_object(
    'ok', true,
    'item_id', v_claim.drop_item_id,
    'item_qty', v_claim.drop_item_qty,
    'key_points', v_claim.drop_key_points,
    'crystal_points', v_claim.drop_crystal_points
  );
END $function$;
REVOKE ALL ON FUNCTION public.claim_crew_gift(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_crew_gift(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_all_crew_gifts()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid       uuid := auth.uid();
  v_total_key int := 0;
  v_total_crys int := 0;
  v_items_count int := 0;
  v_r         record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  FOR v_r IN
    SELECT c.gift_id, c.drop_item_id, c.drop_item_qty, c.drop_key_points, c.drop_crystal_points
      FROM public.crew_gift_claims c
      JOIN public.crew_gifts g ON g.id = c.gift_id
     WHERE c.user_id = v_uid
       AND c.claimed_at IS NULL
       AND g.expires_at > now()
  LOOP
    IF v_r.drop_item_id IS NOT NULL AND v_r.drop_item_qty > 0 THEN
      PERFORM public.grant_inventory_item(v_uid, v_r.drop_item_id, v_r.drop_item_qty);
      v_items_count := v_items_count + v_r.drop_item_qty;
    END IF;
    v_total_key  := v_total_key  + v_r.drop_key_points;
    v_total_crys := v_total_crys + v_r.drop_crystal_points;

    UPDATE public.crew_gift_claims SET claimed_at = now()
     WHERE gift_id = v_r.gift_id AND user_id = v_uid;
  END LOOP;

  IF v_total_key > 0 OR v_total_crys > 0 THEN
    INSERT INTO public.user_segenstruhe (user_id, key_points, crystal_points)
    VALUES (v_uid, v_total_key, v_total_crys)
    ON CONFLICT (user_id) DO UPDATE SET
      key_points     = public.user_segenstruhe.key_points     + EXCLUDED.key_points,
      crystal_points = public.user_segenstruhe.crystal_points + EXCLUDED.crystal_points,
      updated_at     = now();
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'items', v_items_count,
    'key_points', v_total_key,
    'crystal_points', v_total_crys
  );
END $function$;
REVOKE ALL ON FUNCTION public.claim_all_crew_gifts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_all_crew_gifts() TO authenticated;

-- ─── 5) Segenstruhe öffnen + upgraden ──────────────────────────────────

CREATE OR REPLACE FUNCTION public._segenstruhe_open_cost(p_level int)
RETURNS int LANGUAGE sql IMMUTABLE AS $function$
  SELECT 1000 + (GREATEST(p_level,1) - 1) * 100;
$function$;

CREATE OR REPLACE FUNCTION public._segenstruhe_upgrade_cost(p_level int)
RETURNS int LANGUAGE sql IMMUTABLE AS $function$
  SELECT GREATEST(p_level,1) * 500;
$function$;

CREATE OR REPLACE FUNCTION public._roll_segenstruhe_drop(p_level int)
RETURNS TABLE(item_id text, item_qty int)
LANGUAGE plpgsql IMMUTABLE
AS $function$
DECLARE
  v_pool text[];
  v_idx  int;
BEGIN
  -- Größere Pools mit besseren Items je Segenstruhe-Stufe
  IF p_level >= 30 THEN
    v_pool := ARRAY[
      'speedup_uni_15m','speedup_uni_60m','speedup_uni_60m',
      'speedup_build_60m','speedup_research_60m',
      'speedup_build_8h','speedup_research_8h'
    ];
  ELSIF p_level >= 15 THEN
    v_pool := ARRAY[
      'speedup_uni_15m','speedup_uni_60m',
      'speedup_build_60m','speedup_research_60m',
      'speedup_build_15m','speedup_research_15m'
    ];
  ELSE
    v_pool := ARRAY[
      'speedup_uni_5m','speedup_uni_15m',
      'speedup_build_15m','speedup_research_15m',
      'speedup_build_60m','speedup_research_60m'
    ];
  END IF;

  v_idx := 1 + floor(random() * array_length(v_pool, 1))::int;
  item_id := v_pool[v_idx];
  item_qty := CASE WHEN p_level >= 30 THEN 2 ELSE 1 END;
  RETURN NEXT;
END $function$;
REVOKE ALL ON FUNCTION public._roll_segenstruhe_drop(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._roll_segenstruhe_drop(int) TO service_role;

CREATE OR REPLACE FUNCTION public.open_segenstruhe()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid   uuid := auth.uid();
  v_row   record;
  v_cost  int;
  v_drop  record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  INSERT INTO public.user_segenstruhe (user_id) VALUES (v_uid)
  ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO v_row FROM public.user_segenstruhe WHERE user_id = v_uid FOR UPDATE;

  v_cost := public._segenstruhe_open_cost(v_row.level);
  IF v_row.key_points < v_cost THEN RAISE EXCEPTION 'not_enough_key_points'; END IF;

  SELECT * INTO v_drop FROM public._roll_segenstruhe_drop(v_row.level);
  PERFORM public.grant_inventory_item(v_uid, v_drop.item_id, v_drop.item_qty);

  UPDATE public.user_segenstruhe
     SET key_points   = key_points - v_cost,
         opened_count = opened_count + 1,
         last_opened_at = now(),
         updated_at   = now()
   WHERE user_id = v_uid;

  RETURN jsonb_build_object(
    'ok', true,
    'item_id', v_drop.item_id,
    'item_qty', v_drop.item_qty,
    'key_points_spent', v_cost
  );
END $function$;
REVOKE ALL ON FUNCTION public.open_segenstruhe() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.open_segenstruhe() TO authenticated;

CREATE OR REPLACE FUNCTION public.upgrade_segenstruhe()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid  uuid := auth.uid();
  v_row  record;
  v_cost int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  INSERT INTO public.user_segenstruhe (user_id) VALUES (v_uid)
  ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO v_row FROM public.user_segenstruhe WHERE user_id = v_uid FOR UPDATE;

  IF v_row.level >= 50 THEN RAISE EXCEPTION 'segenstruhe_max_level'; END IF;
  v_cost := public._segenstruhe_upgrade_cost(v_row.level);
  IF v_row.crystal_points < v_cost THEN RAISE EXCEPTION 'not_enough_crystal_points'; END IF;

  UPDATE public.user_segenstruhe
     SET crystal_points = crystal_points - v_cost,
         level          = level + 1,
         upgraded_count = upgraded_count + 1,
         updated_at     = now()
   WHERE user_id = v_uid;

  RETURN jsonb_build_object(
    'ok', true,
    'level_new', v_row.level + 1,
    'crystal_points_spent', v_cost
  );
END $function$;
REVOKE ALL ON FUNCTION public.upgrade_segenstruhe() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upgrade_segenstruhe() TO authenticated;

-- ─── 6) UI-List-RPC: pending + claimed + Segenstruhe-State in einem Call ─

CREATE OR REPLACE FUNCTION public.list_crew_gifts(p_crew_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid       uuid := auth.uid();
  v_crew_id   uuid;
  v_pending   jsonb;
  v_claimed   jsonb;
  v_seg       record;
  v_open_cost int;
  v_up_cost   int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  v_crew_id := COALESCE(p_crew_id, (SELECT current_crew_id FROM public.users WHERE id = v_uid));

  -- Segenstruhe-State garantieren
  INSERT INTO public.user_segenstruhe (user_id) VALUES (v_uid)
  ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO v_seg FROM public.user_segenstruhe WHERE user_id = v_uid;
  v_open_cost := public._segenstruhe_open_cost(v_seg.level);
  v_up_cost   := public._segenstruhe_upgrade_cost(v_seg.level);

  IF v_crew_id IS NULL THEN
    v_pending := '[]'::jsonb;
    v_claimed := '[]'::jsonb;
  ELSE
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      INTO v_pending
      FROM (
        SELECT
          g.id              AS gift_id,
          g.rarity,
          g.source,
          g.mutant_level,
          g.mutant_tier,
          g.title,
          g.created_at,
          g.expires_at,
          c.drop_item_id,
          c.drop_item_qty,
          c.drop_key_points,
          c.drop_crystal_points,
          (SELECT name FROM public.inventory_item_catalog WHERE id = c.drop_item_id) AS drop_item_name,
          (SELECT emoji FROM public.inventory_item_catalog WHERE id = c.drop_item_id) AS drop_item_emoji
          FROM public.crew_gifts g
          JOIN public.crew_gift_claims c ON c.gift_id = g.id AND c.user_id = v_uid
         WHERE g.crew_id = v_crew_id
           AND c.claimed_at IS NULL
           AND g.expires_at > now()
         ORDER BY g.created_at DESC
         LIMIT 200
      ) t;

    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      INTO v_claimed
      FROM (
        SELECT g.id AS gift_id, g.title, g.rarity, g.mutant_level, c.claimed_at
          FROM public.crew_gifts g
          JOIN public.crew_gift_claims c ON c.gift_id = g.id AND c.user_id = v_uid
         WHERE g.crew_id = v_crew_id
           AND c.claimed_at IS NOT NULL
         ORDER BY c.claimed_at DESC
         LIMIT 30
      ) t;
  END IF;

  RETURN jsonb_build_object(
    'pending', v_pending,
    'claimed_recent', v_claimed,
    'segenstruhe', jsonb_build_object(
      'level',          v_seg.level,
      'key_points',     v_seg.key_points,
      'crystal_points', v_seg.crystal_points,
      'opened_count',   v_seg.opened_count,
      'upgraded_count', v_seg.upgraded_count,
      'open_cost',      v_open_cost,
      'upgrade_cost',   v_up_cost,
      'is_max_level',   v_seg.level >= 50
    )
  );
END $function$;
REVOKE ALL ON FUNCTION public.list_crew_gifts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_crew_gifts(uuid) TO authenticated;

-- ─── 7) Expiry-Purge (per Cron alle 5 Min) ──────────────────────────────

CREATE OR REPLACE FUNCTION public.purge_expired_crew_gifts()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_n int;
BEGIN
  WITH d AS (
    DELETE FROM public.crew_gifts
     WHERE expires_at < now()
       AND NOT EXISTS (
         SELECT 1 FROM public.crew_gift_claims c
          WHERE c.gift_id = crew_gifts.id AND c.claimed_at IS NOT NULL
       )
     RETURNING 1
  )
  SELECT count(*)::int INTO v_n FROM d;
  RETURN COALESCE(v_n, 0);
END $function$;
REVOKE ALL ON FUNCTION public.purge_expired_crew_gifts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_expired_crew_gifts() TO service_role;
