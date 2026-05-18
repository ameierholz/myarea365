-- ────────────────────────────────────────────────────────────────────────
-- 00406: Crew-Tresor Drop-Pool ausgebaut + Preview-RPC
-- ────────────────────────────────────────────────────────────────────────
-- Pro Tresor-Stufe gewichteter Pool aus Speedups + Boost-Buffs + RSS-
-- Truhen + Premium-Truhen. Größere Vielfalt + steigende Item-Qualität.
-- Neue RPC segenstruhe_drop_pool(level) liefert UI eine Liste {id, name,
-- emoji, qty, weight, pct} damit der Spieler vor dem Knacken sieht, was
-- möglich ist und mit welcher Wahrscheinlichkeit.
-- ────────────────────────────────────────────────────────────────────────

-- Helper-Tabelle für den Pool (durable, nicht volatil im Code)
CREATE TABLE IF NOT EXISTS public.segenstruhe_drop_pool (
  level_min   int  NOT NULL,
  level_max   int  NOT NULL,
  item_id     text NOT NULL,
  item_qty    int  NOT NULL DEFAULT 1,
  weight      int  NOT NULL DEFAULT 10,
  PRIMARY KEY (level_min, level_max, item_id)
);

-- Seed-Pool — 5 Tiers (1-9 / 10-19 / 20-29 / 30-39 / 40-50)
TRUNCATE TABLE public.segenstruhe_drop_pool;

-- ── Tier A: Stufe 1-9 (Anfänger) ──────────────────────────────────────
INSERT INTO public.segenstruhe_drop_pool VALUES
  (1, 9, 'speedup_build_5m',       1, 25),
  (1, 9, 'speedup_research_5m',    1, 25),
  (1, 9, 'speedup_build_15m',      1, 18),
  (1, 9, 'speedup_research_15m',   1, 18),
  (1, 9, 'speedup_uni_5m',         1, 10),
  (1, 9, 'res_chest_choice_t1',    1, 4);

-- ── Tier B: Stufe 10-19 (Fortgeschritten) ─────────────────────────────
INSERT INTO public.segenstruhe_drop_pool VALUES
  (10, 19, 'speedup_build_15m',     1, 20),
  (10, 19, 'speedup_research_15m',  1, 20),
  (10, 19, 'speedup_build_60m',     1, 14),
  (10, 19, 'speedup_research_60m',  1, 14),
  (10, 19, 'speedup_uni_15m',       1, 10),
  (10, 19, 'speedup_uni_60m',       1, 5),
  (10, 19, 'boost_gather_8h',       1, 5),
  (10, 19, 'res_chest_choice_t1',   1, 8),
  (10, 19, 'res_chest_choice_t2',   1, 4);

-- ── Tier C: Stufe 20-29 (Erfahren) ────────────────────────────────────
INSERT INTO public.segenstruhe_drop_pool VALUES
  (20, 29, 'speedup_build_60m',     1, 18),
  (20, 29, 'speedup_research_60m',  1, 18),
  (20, 29, 'speedup_uni_60m',       1, 12),
  (20, 29, 'speedup_build_8h',      1, 8),
  (20, 29, 'speedup_research_8h',   1, 8),
  (20, 29, 'speedup_uni_15m',       1, 8),
  (20, 29, 'boost_gather_24h',      1, 6),
  (20, 29, 'boost_xp_8h',           1, 4),
  (20, 29, 'res_chest_choice_t2',   1, 10),
  (20, 29, 'chest_gold',            1, 6),
  (20, 29, 'speedup_march_250',     1, 2);

-- ── Tier D: Stufe 30-39 (Veteran) ─────────────────────────────────────
INSERT INTO public.segenstruhe_drop_pool VALUES
  (30, 39, 'speedup_build_8h',      1, 14),
  (30, 39, 'speedup_research_8h',   1, 14),
  (30, 39, 'speedup_uni_60m',       1, 12),
  (30, 39, 'speedup_build_12h',     1, 8),
  (30, 39, 'speedup_research_12h',  1, 8),
  (30, 39, 'speedup_uni_15m',       1, 6),
  (30, 39, 'boost_gather_24h',      1, 8),
  (30, 39, 'boost_xp_24h',          1, 6),
  (30, 39, 'boost_shield_24h',      1, 4),
  (30, 39, 'res_chest_choice_t2',   1, 8),
  (30, 39, 'res_chest_choice_t3',   1, 4),
  (30, 39, 'chest_gold',            1, 5),
  (30, 39, 'chest_event',           1, 3);

-- ── Tier E: Stufe 40-50 (Elite) ───────────────────────────────────────
INSERT INTO public.segenstruhe_drop_pool VALUES
  (40, 50, 'speedup_build_12h',     1, 12),
  (40, 50, 'speedup_research_12h',  1, 12),
  (40, 50, 'speedup_uni_60m',       2, 10),
  (40, 50, 'speedup_build_24h',     1, 9),
  (40, 50, 'speedup_research_24h',  1, 9),
  (40, 50, 'speedup_uni_24h',       1, 6),
  (40, 50, 'speedup_march_500',     1, 5),
  (40, 50, 'boost_gather_24h',      1, 7),
  (40, 50, 'boost_xp_24h',          1, 6),
  (40, 50, 'boost_shield_24h',      1, 4),
  (40, 50, 'res_chest_choice_t3',   1, 8),
  (40, 50, 'chest_gold',            1, 5),
  (40, 50, 'chest_event',           1, 4),
  (40, 50, 'chest_legendary',       1, 3);

-- _roll_segenstruhe_drop: jetzt mit DB-basierter weighted Selection
CREATE OR REPLACE FUNCTION public._roll_segenstruhe_drop(p_level int)
RETURNS TABLE(item_id text, item_qty int)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_lv    int := GREATEST(COALESCE(p_level, 1), 1);
  v_total int;
  v_rnd   int;
  v_acc   int := 0;
  v_row   record;
BEGIN
  SELECT SUM(weight) INTO v_total FROM public.segenstruhe_drop_pool
   WHERE v_lv BETWEEN level_min AND level_max;
  IF v_total IS NULL OR v_total <= 0 THEN
    -- Fallback wenn Pool leer
    item_id := 'speedup_build_5m'; item_qty := 1;
    RETURN NEXT; RETURN;
  END IF;
  v_rnd := 1 + floor(random() * v_total)::int;
  FOR v_row IN
    SELECT * FROM public.segenstruhe_drop_pool
     WHERE v_lv BETWEEN level_min AND level_max
     ORDER BY item_id
  LOOP
    v_acc := v_acc + v_row.weight;
    IF v_rnd <= v_acc THEN
      item_id := v_row.item_id; item_qty := v_row.item_qty;
      RETURN NEXT; RETURN;
    END IF;
  END LOOP;
END $function$;
REVOKE ALL ON FUNCTION public._roll_segenstruhe_drop(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._roll_segenstruhe_drop(int) TO service_role;

-- Preview-RPC für UI: gibt alle möglichen Drops für eine Stufe mit
-- Wahrscheinlichkeit + Item-Metadaten zurück.
CREATE OR REPLACE FUNCTION public.segenstruhe_drop_pool_preview(p_level int DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_lv  int;
  v_total int;
  v_pool jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_level IS NOT NULL THEN
    v_lv := p_level;
  ELSE
    SELECT level INTO v_lv FROM public.user_segenstruhe WHERE user_id = v_uid;
    v_lv := COALESCE(v_lv, 1);
  END IF;

  SELECT SUM(weight) INTO v_total FROM public.segenstruhe_drop_pool
   WHERE v_lv BETWEEN level_min AND level_max;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (t.weight) DESC), '[]'::jsonb)
    INTO v_pool
    FROM (
      SELECT
        p.item_id,
        p.item_qty,
        p.weight,
        ROUND(p.weight::numeric / NULLIF(v_total, 0) * 100, 1) AS pct,
        c.name AS item_name,
        c.emoji AS item_emoji,
        c.rarity AS item_rarity
        FROM public.segenstruhe_drop_pool p
        LEFT JOIN public.inventory_item_catalog c ON c.id = p.item_id
       WHERE v_lv BETWEEN p.level_min AND p.level_max
    ) t;

  RETURN jsonb_build_object('level', v_lv, 'total_weight', COALESCE(v_total, 0), 'pool', v_pool);
END $function$;
REVOKE ALL ON FUNCTION public.segenstruhe_drop_pool_preview(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.segenstruhe_drop_pool_preview(int) TO authenticated;
