-- 00391_mutants_rename.sql
-- Rename "Kurier-Streife" → "Mutant" — die NPCs hießen vorher Kurier-Streife,
-- werden aber visuell durch ein Mutant-3D-Modell repräsentiert. Konsistenter
-- Name im ganzen Stack.
--
-- Operationen:
--   1. Drop alter Wegelager-Replacement-Funktionen (kurier_*)
--   2. ALTER TABLE kurier_streifen RENAME TO mutants
--   3. Spalte mutant_target auf public.cities (stadtgrößenabhängig)
--   4. Recreate aller RPCs mit mutant_*-Namen, identische Signaturen sonst
--   5. Cron-Job-Rename falls vorhanden
--
-- Re-spawn-Logik: Die 120 aktiven NPCs werden NICHT migriert (sie sind Test-Daten);
-- der nächste spawn-tick re-fülltbis target erreicht.

-- ─── 1) Cleanup alter Funktionen ─────────────────────────────────────────
DROP FUNCTION IF EXISTS public.kurier_streifen_in_bbox(double precision, double precision, double precision, double precision);
DROP FUNCTION IF EXISTS public.kurier_streifen_cleanup_expired();
DROP FUNCTION IF EXISTS public.attack_kurier_streife(bigint, integer, uuid);
DROP FUNCTION IF EXISTS public.kurier_tier_def(text);
DROP FUNCTION IF EXISTS public.exec_sql_kurier_set_route_geom(bigint, text);

-- ─── 2) Tabelle umbenennen ───────────────────────────────────────────────
ALTER TABLE IF EXISTS public.kurier_streifen RENAME TO mutants;

-- Sequence/Index/Constraint-Namen mitführen — Postgres benennt automatisch um,
-- aber wir touchen die UPDATE-Trigger-Indizes nochmal explizit für saubere Namen:
ALTER INDEX IF EXISTS kurier_streifen_pkey RENAME TO mutants_pkey;
ALTER INDEX IF EXISTS idx_kurier_streifen_active RENAME TO idx_mutants_active;
ALTER INDEX IF EXISTS idx_kurier_streifen_route_geom RENAME TO idx_mutants_route_geom;

-- Sequence (BIGSERIAL legt id-seq an mit Tabellenname-prefix)
ALTER SEQUENCE IF EXISTS kurier_streifen_id_seq RENAME TO mutants_id_seq;

-- CHECK-Constraints umbenennen (gather_marches_route_required-Pattern)
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.mutants'::regclass
      AND conname LIKE 'kurier_streifen_%'
  LOOP
    EXECUTE format('ALTER TABLE public.mutants RENAME CONSTRAINT %I TO %I',
      c, replace(c, 'kurier_streifen_', 'mutants_'));
  END LOOP;
END $$;

-- ─── 3) Cities.mutant_target (stadtgrößenabhängig) ───────────────────────
ALTER TABLE public.cities
  ADD COLUMN IF NOT EXISTS mutant_target int NOT NULL DEFAULT 80;

UPDATE public.cities SET mutant_target = 200 WHERE slug = 'berlin';
UPDATE public.cities SET mutant_target = 180 WHERE slug = 'hamburg';
UPDATE public.cities SET mutant_target = 80  WHERE slug = 'muenchen';

-- ─── 4) RPCs neu erstellen mit mutant_*-Namen ────────────────────────────

-- BBox-Query (gleiche Logik wie kurier_streifen_in_bbox)
CREATE OR REPLACE FUNCTION public.mutants_in_bbox(
  p_south double precision, p_west double precision,
  p_north double precision, p_east double precision
) RETURNS TABLE (
  id bigint, city_slug text, npc_kind text, spawn_terrain text,
  origin_lat double precision, origin_lng double precision,
  target_lat double precision, target_lng double precision,
  route_geom_json jsonb, route_distance_m double precision,
  started_at timestamptz, finishes_at timestamptz,
  status text, loot_tier text, hp int, troop_count int
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
         m.status, m.loot_tier, m.hp, m.troop_count
    FROM public.mutants m
   WHERE m.status = 'walking'
     AND (
       (m.route_geom IS NOT NULL AND m.route_geom && v_envelope)
       OR (m.origin_lat BETWEEN p_south AND p_north AND m.origin_lng BETWEEN p_west AND p_east)
     )
   ORDER BY m.started_at DESC
   LIMIT 500;
END $function$;
GRANT EXECUTE ON FUNCTION public.mutants_in_bbox(double precision, double precision, double precision, double precision)
  TO anon, authenticated;

-- Cleanup expired
CREATE OR REPLACE FUNCTION public.mutants_cleanup_expired()
RETURNS int
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
DECLARE v_deleted int;
BEGIN
  WITH expired AS (
    UPDATE public.mutants
       SET status = 'expired'
     WHERE status = 'walking' AND finishes_at < now()
    RETURNING 1
  )
  SELECT count(*) INTO v_deleted FROM expired;
  RETURN v_deleted;
END $function$;
REVOKE ALL ON FUNCTION public.mutants_cleanup_expired() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mutants_cleanup_expired() TO service_role;

-- Tier-Def
CREATE OR REPLACE FUNCTION public.mutant_tier_def(p_tier text)
RETURNS TABLE (tier text, hp int, troop_count int, drop_rss int, drop_gems int)
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $function$
  SELECT * FROM (VALUES
    ('bronze',   1000,  200, 1000,  0),
    ('silver',   4000,  600, 4000,  5),
    ('gold',    12000, 1800, 12000, 15),
    ('platinum',40000, 5000, 40000, 50)
  ) AS t(tier, hp, troop_count, drop_rss, drop_gems)
  WHERE t.tier = p_tier;
$function$;
GRANT EXECUTE ON FUNCTION public.mutant_tier_def(text) TO anon, authenticated;

-- Attack Mutant (ehemals attack_kurier_streife)
CREATE OR REPLACE FUNCTION public.attack_mutant(
  p_mutant_id bigint,
  p_troops int,
  p_guardian_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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
    v_losses := (p_troops * (5 + floor(random() * 6)) / 100)::int;  -- 5-10%
  ELSE
    v_losses := (p_troops * (30 + floor(random() * 31)) / 100)::int; -- 30-60%
  END IF;

  -- Mutant als resolved markieren
  UPDATE public.mutants SET status = CASE WHEN v_victory THEN 'captured' ELSE 'escaped' END
   WHERE id = p_mutant_id;

  IF v_victory THEN
    SELECT * INTO v_tier FROM public.mutant_tier_def(v_mutant.loot_tier);

    -- 4 RSS-Drops gleichmäßig verteilt (Tech-Schrott/Komponenten/Krypto/Bandbreite)
    INSERT INTO public.user_resources (user_id, wood, stone, gold, mana)
    VALUES (v_user, v_tier.drop_rss, v_tier.drop_rss, v_tier.drop_rss, v_tier.drop_rss)
    ON CONFLICT (user_id) DO UPDATE SET
      wood  = user_resources.wood  + EXCLUDED.wood,
      stone = user_resources.stone + EXCLUDED.stone,
      gold  = user_resources.gold  + EXCLUDED.gold,
      mana  = user_resources.mana  + EXCLUDED.mana;

    -- Gems falls > 0
    IF v_tier.drop_gems > 0 THEN
      INSERT INTO public.user_gems (user_id, gems_balance)
      VALUES (v_user, v_tier.drop_gems)
      ON CONFLICT (user_id) DO UPDATE SET
        gems_balance = user_gems.gems_balance + EXCLUDED.gems_balance;
    END IF;

    -- Inbox: was/woher/warum
    INSERT INTO public.user_inbox (user_id, kind, category, from_label, title, body, payload)
    VALUES (
      v_user, 'mutant_captured', 'gameplay', 'Mutant-Patrouille',
      format('⚔ Mutant (%s) bei %s besiegt — +%s × 4 RSS%s',
        v_mutant.loot_tier, v_mutant.spawn_terrain, v_tier.drop_rss,
        CASE WHEN v_tier.drop_gems > 0 THEN format(' +%s💎', v_tier.drop_gems) ELSE '' END),
      format('Verluste: %s Truppen.', v_losses),
      jsonb_build_object('tier', v_mutant.loot_tier, 'rss', v_tier.drop_rss, 'gems', v_tier.drop_gems)
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'victory', v_victory,
    'troops_sent', p_troops,
    'losses', v_losses,
    'tier', v_mutant.loot_tier,
    'drop_rss', CASE WHEN v_victory THEN (SELECT drop_rss FROM public.mutant_tier_def(v_mutant.loot_tier)) ELSE 0 END,
    'drop_gems', CASE WHEN v_victory THEN (SELECT drop_gems FROM public.mutant_tier_def(v_mutant.loot_tier)) ELSE 0 END
  );
END $function$;
REVOKE ALL ON FUNCTION public.attack_mutant(bigint, int, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attack_mutant(bigint, int, uuid) TO authenticated;

-- exec_sql_mutant_set_route_geom (für walker-route-injection vom backend)
CREATE OR REPLACE FUNCTION public.exec_sql_mutant_set_route_geom(p_id bigint, p_geojson text)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, extensions, pg_temp
AS $function$
BEGIN
  UPDATE public.mutants
     SET route_geom = extensions.ST_SetSRID(extensions.ST_GeomFromGeoJSON(p_geojson), 4326)
   WHERE id = p_id;
END $function$;
REVOKE ALL ON FUNCTION public.exec_sql_mutant_set_route_geom(bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.exec_sql_mutant_set_route_geom(bigint, text) TO service_role;

-- ─── 5) Cron-Job rename (falls vorhanden) ────────────────────────────────
-- 00389 war als File angelegt aber nie applied; falls Vercel/external trigger eingerichtet
-- ist, ist das ein POST auf /api/mutant/spawn-tick (neuer Pfad).
DO $$ BEGIN
  PERFORM cron.unschedule('ma365-kurier-spawn-tick');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
