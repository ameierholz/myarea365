-- ────────────────────────────────────────────────────────────────────────
-- 00405: Elite/Mega qty drastisch reduziert (1× base, max 3× ab Lv 20)
-- ────────────────────────────────────────────────────────────────────────
-- Vorher Elite 3-5×, Mega 5-7×. Pro Crew-Mitglied = zu schnelle Inflation.
-- Jetzt: 1× base, +1 ab Lv 10, +1 ab Lv 20 → max 3 für Hoch-Tresor.
CREATE OR REPLACE FUNCTION public._roll_rare_gift_drop(p_tresor_level int DEFAULT 1, p_tier text DEFAULT 'elite')
RETURNS TABLE(item_id text, item_qty int)
LANGUAGE plpgsql IMMUTABLE
AS $function$
DECLARE v_tlv int := COALESCE(p_tresor_level, 1); v_pool text[]; v_idx int; v_qty int;
BEGIN
  IF p_tier = 'mega' THEN
    v_pool := ARRAY['speedup_build_24h','speedup_research_24h','speedup_uni_24h','speedup_march_500'];
    v_qty := CASE WHEN v_tlv >= 20 THEN 3 WHEN v_tlv >= 10 THEN 2 ELSE 1 END;
  ELSE
    v_pool := ARRAY['speedup_build_12h','speedup_research_12h','speedup_uni_12h','speedup_march_250'];
    v_qty := CASE WHEN v_tlv >= 20 THEN 3 WHEN v_tlv >= 10 THEN 2 ELSE 1 END;
  END IF;
  v_idx := 1 + floor(random() * array_length(v_pool, 1))::int;
  item_id := v_pool[v_idx];
  item_qty := v_qty;
  RETURN NEXT;
END $function$;
REVOKE ALL ON FUNCTION public._roll_rare_gift_drop(int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._roll_rare_gift_drop(int, text) TO service_role;
