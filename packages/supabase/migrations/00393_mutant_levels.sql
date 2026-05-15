-- 00393_mutant_levels.sql
-- Server-Scaling: Mutanten starten beim Saison-Beginn auf Stufe 1 und wachsen
-- automatisch pro Stunde +1 bis Cap 30. HP/Truppen/Loot skalieren linear mit level.
--
-- Modell (Call of Dragons "Finsterling-Festung"):
--   - Saison-Start (mutant_season_started_at auf cities) — defaults: now()
--   - Level = floor(hours_since_season_start / GROW_INTERVAL_HOURS) + 1, capped at 30
--   - Spawn-tick liest current_mutant_level beim INSERT → snapshot pro Mutant
--   - Bestehende Mutanten behalten ihren Spawn-Level (kein dynamisches Re-Scaling)
--   - Despawn nach 4h (finishes_at) → neue Spawns kommen mit höherem Level rein
--
-- Wachstumsgeschwindigkeit: 1 Stunde pro Level → 30 Stunden bis Max (gut sichtbar
-- für Spieler, kein zu schneller Sprung).

-- ─── 1) Saison-Spalte auf cities ─────────────────────────────────────────
ALTER TABLE public.cities
  ADD COLUMN IF NOT EXISTS mutant_season_started_at timestamptz NOT NULL DEFAULT now();

-- ─── 2) Level-Spalte auf mutants (Snapshot beim Spawn) ───────────────────
ALTER TABLE public.mutants
  ADD COLUMN IF NOT EXISTS level int NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_mutants_level ON public.mutants(level);

-- ─── 3) Helper: current server level for city ────────────────────────────
CREATE OR REPLACE FUNCTION public.current_mutant_level(p_city_slug text)
RETURNS int LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $function$
  SELECT LEAST(30, GREATEST(1,
    1 + (EXTRACT(EPOCH FROM (now() - mutant_season_started_at)) / 3600)::int
  ))
  FROM public.cities WHERE slug = p_city_slug;
$function$;
GRANT EXECUTE ON FUNCTION public.current_mutant_level(text) TO anon, authenticated, service_role;

-- ─── 4) Tier-Def MIT Level-Scaling ───────────────────────────────────────
-- HP/Truppen wachsen × level, Loot × sqrt(level) (Loot wächst langsamer als
-- Schwierigkeit damit High-Level-Mutanten echte Herausforderung sind).
DROP FUNCTION IF EXISTS public.mutant_tier_def(text);
CREATE OR REPLACE FUNCTION public.mutant_tier_def(p_tier text, p_level int DEFAULT 1)
RETURNS TABLE (tier text, hp int, troop_count int, drop_rss int, drop_gems int)
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $function$
  WITH base AS (
    SELECT * FROM (VALUES
      ('bronze',   1000,  200, 1000,  0),
      ('silver',   4000,  600, 4000,  5),
      ('gold',    12000, 1800, 12000, 15),
      ('platinum',40000, 5000, 40000, 50)
    ) AS t(tier, hp, troop_count, drop_rss, drop_gems)
    WHERE t.tier = p_tier
  ),
  scaled AS (
    SELECT
      tier,
      (hp          * GREATEST(1, p_level))::int                AS hp,
      (troop_count * GREATEST(1, p_level))::int                AS troop_count,
      (drop_rss    * GREATEST(1, sqrt(p_level)::int))::int      AS drop_rss,
      (drop_gems   * GREATEST(1, sqrt(p_level)::int))::int      AS drop_gems
    FROM base
  )
  SELECT * FROM scaled;
$function$;
GRANT EXECUTE ON FUNCTION public.mutant_tier_def(text, int) TO anon, authenticated, service_role;

-- ─── 5) attack_mutant — neue Tier-Def-Signatur mit Level ─────────────────
CREATE OR REPLACE FUNCTION public.attack_mutant(
  p_mutant_id bigint,
  p_troops int,
  p_guardian_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_mutant public.mutants;
  v_player_atk int;
  v_streife_def int;
  v_victory boolean;
  v_losses int;
  v_tier record;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;
  IF p_troops IS NULL OR p_troops < 1 THEN
    RETURN jsonb_build_object('error', 'invalid_troops');
  END IF;

  SELECT * INTO v_mutant FROM public.mutants WHERE id = p_mutant_id AND status='walking' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'mutant_not_found_or_resolved');
  END IF;

  v_player_atk := p_troops * 10;
  v_streife_def := v_mutant.troop_count;
  v_victory := v_player_atk > (v_streife_def * 0.9);

  IF v_victory THEN
    v_losses := (p_troops * (5 + floor(random() * 6)) / 100)::int;
  ELSE
    v_losses := (p_troops * (30 + floor(random() * 31)) / 100)::int;
  END IF;

  UPDATE public.mutants SET status = CASE WHEN v_victory THEN 'captured' ELSE 'escaped' END
   WHERE id = p_mutant_id;

  IF v_victory THEN
    SELECT * INTO v_tier FROM public.mutant_tier_def(v_mutant.loot_tier, v_mutant.level);

    INSERT INTO public.user_resources (user_id, wood, stone, gold, mana)
    VALUES (v_user, v_tier.drop_rss, v_tier.drop_rss, v_tier.drop_rss, v_tier.drop_rss)
    ON CONFLICT (user_id) DO UPDATE SET
      wood  = user_resources.wood  + EXCLUDED.wood,
      stone = user_resources.stone + EXCLUDED.stone,
      gold  = user_resources.gold  + EXCLUDED.gold,
      mana  = user_resources.mana  + EXCLUDED.mana;

    IF v_tier.drop_gems > 0 THEN
      INSERT INTO public.user_gems (user_id, gems_balance)
      VALUES (v_user, v_tier.drop_gems)
      ON CONFLICT (user_id) DO UPDATE SET
        gems_balance = user_gems.gems_balance + EXCLUDED.gems_balance;
    END IF;

    INSERT INTO public.user_inbox (user_id, kind, category, from_label, title, body, payload)
    VALUES (
      v_user, 'mutant_captured', 'gameplay', 'Mutant-Patrouille',
      format('Mutant Stufe %s (%s) bei %s besiegt — +%s × 4 RSS%s',
        v_mutant.level, v_mutant.loot_tier, v_mutant.spawn_terrain, v_tier.drop_rss,
        CASE WHEN v_tier.drop_gems > 0 THEN format(' +%s Gems', v_tier.drop_gems) ELSE '' END),
      format('Verluste: %s Truppen.', v_losses),
      jsonb_build_object('tier', v_mutant.loot_tier, 'level', v_mutant.level, 'rss', v_tier.drop_rss, 'gems', v_tier.drop_gems)
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'victory', v_victory,
    'troops_sent', p_troops,
    'losses', v_losses,
    'tier', v_mutant.loot_tier,
    'level', v_mutant.level,
    'drop_rss', CASE WHEN v_victory THEN (SELECT drop_rss FROM public.mutant_tier_def(v_mutant.loot_tier, v_mutant.level)) ELSE 0 END,
    'drop_gems', CASE WHEN v_victory THEN (SELECT drop_gems FROM public.mutant_tier_def(v_mutant.loot_tier, v_mutant.level)) ELSE 0 END
  );
END $function$;

-- ─── 6) BBox-Query gibt jetzt level mit zurück ───────────────────────────
DROP FUNCTION IF EXISTS public.mutants_in_bbox(double precision, double precision, double precision, double precision);
CREATE OR REPLACE FUNCTION public.mutants_in_bbox(
  p_south double precision, p_west double precision,
  p_north double precision, p_east double precision
) RETURNS TABLE (
  id bigint, city_slug text, npc_kind text, spawn_terrain text,
  origin_lat double precision, origin_lng double precision,
  target_lat double precision, target_lng double precision,
  route_geom_json jsonb, route_distance_m double precision,
  started_at timestamptz, finishes_at timestamptz,
  status text, loot_tier text, hp int, troop_count int, level int
)
LANGUAGE plpgsql STABLE
SET search_path = public, extensions, pg_temp
AS $function$
DECLARE
  v_envelope extensions.geometry;
BEGIN
  v_envelope := extensions.ST_MakeEnvelope(p_west, p_south, p_east, p_north, 4326);
  RETURN QUERY
  SELECT m.id, m.city_slug, m.npc_kind, m.spawn_terrain,
         m.origin_lat, m.origin_lng, m.target_lat, m.target_lng,
         CASE WHEN m.route_geom IS NOT NULL
              THEN extensions.ST_AsGeoJSON(m.route_geom)::jsonb
              ELSE NULL END,
         m.route_distance_m, m.started_at, m.finishes_at,
         m.status, m.loot_tier, m.hp, m.troop_count, m.level
    FROM public.mutants m
   WHERE m.status = 'walking'
     AND (
       (m.route_geom IS NOT NULL AND m.route_geom && v_envelope)
       OR (m.origin_lat BETWEEN p_south AND p_north AND m.origin_lng BETWEEN p_west AND p_east)
     )
   ORDER BY m.started_at DESC
   LIMIT 2000;
END $function$;
GRANT EXECUTE ON FUNCTION public.mutants_in_bbox(double precision, double precision, double precision, double precision) TO anon, authenticated;
