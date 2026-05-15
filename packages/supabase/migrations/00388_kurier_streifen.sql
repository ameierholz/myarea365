-- 00388_kurier_streifen.sql
-- Kurier-Streifen: wandernde NPC-Truppen die auf realen Straßen patrouillieren
-- und Loot zwischen zwei Punkten transportieren. Spieler tippt eine Streife an,
-- bestätigt den Angriff mit X Truppen, Kampf wird sofort aufgelöst (Banditen-Style).
-- Sieg → Loot in die Inbox; Niederlage → Truppen verwundet ins Lazarett.
--
-- Tier-Tabelle steuert Schwierigkeit + Loot:
--   bronze   ~10% Spawn — leichte Beute, niedrige HP
--   silver   ~5%       — mittlere Beute
--   gold     ~1.5%     — großer Loot-Drop, hohe HP
--   platinum ~0.3%     — Jackpot, brauchst Rally

-- ────────────────────────────────────────────────────────────────────
-- Stamm-Tabelle: aktive Patrouillen
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kurier_streifen (
  id              bigserial PRIMARY KEY,
  city_slug       text NOT NULL REFERENCES public.cities(slug) ON DELETE CASCADE,
  origin_lat      double precision NOT NULL,
  origin_lng      double precision NOT NULL,
  target_lat      double precision NOT NULL,
  target_lng      double precision NOT NULL,
  route_geom      extensions.geometry(LineString, 4326),
  route_distance_m double precision NOT NULL,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finishes_at     timestamptz NOT NULL,
  status          text NOT NULL DEFAULT 'walking'
    CHECK (status IN ('walking','captured','escaped','expired')),
  loot_tier       text NOT NULL DEFAULT 'bronze'
    CHECK (loot_tier IN ('bronze','silver','gold','platinum')),
  hp              int NOT NULL DEFAULT 1000,
  troop_count     int NOT NULL DEFAULT 200,
  captured_by     uuid REFERENCES public.users(id) ON DELETE SET NULL,
  captured_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kurier_streifen_active
  ON public.kurier_streifen(city_slug, status, finishes_at)
  WHERE status = 'walking';

CREATE INDEX IF NOT EXISTS idx_kurier_streifen_route_geom
  ON public.kurier_streifen USING gist (route_geom)
  WHERE route_geom IS NOT NULL;

ALTER TABLE public.kurier_streifen ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='kurier_streifen' AND policyname='kurier_streifen_public_read') THEN
    CREATE POLICY kurier_streifen_public_read ON public.kurier_streifen
      FOR SELECT USING (true);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────
-- Loot-Tier-Definitionen: hier festgeschrieben, kein Lookup-Table nötig.
-- HP/Troops/Drops skalieren mit Rarity.
-- ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.kurier_tier_def(p_tier text)
RETURNS TABLE(hp int, troop_count int, spawn_weight numeric, drop_resource_min int, drop_resource_max int, drop_gems_min int, drop_gems_max int)
LANGUAGE plpgsql IMMUTABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT CASE p_tier
    WHEN 'bronze'   THEN 1000  WHEN 'silver'   THEN 4000
    WHEN 'gold'     THEN 12000 WHEN 'platinum' THEN 40000 ELSE 1000 END,
    CASE p_tier
    WHEN 'bronze'   THEN 200   WHEN 'silver'   THEN 600
    WHEN 'gold'     THEN 1800  WHEN 'platinum' THEN 5000 ELSE 200 END,
    CASE p_tier
    WHEN 'bronze'   THEN 100.0 WHEN 'silver'   THEN 30.0
    WHEN 'gold'     THEN 8.0   WHEN 'platinum' THEN 1.5 ELSE 0.0 END,
    -- Resource-Drop (alle 4 RSS, Range pro Tier)
    CASE p_tier
    WHEN 'bronze'   THEN 5000   WHEN 'silver'   THEN 20000
    WHEN 'gold'     THEN 80000  WHEN 'platinum' THEN 300000 ELSE 0 END,
    CASE p_tier
    WHEN 'bronze'   THEN 15000  WHEN 'silver'   THEN 60000
    WHEN 'gold'     THEN 200000 WHEN 'platinum' THEN 700000 ELSE 0 END,
    -- Diamanten-Drop
    CASE p_tier
    WHEN 'bronze'   THEN 0     WHEN 'silver'   THEN 5
    WHEN 'gold'     THEN 25    WHEN 'platinum' THEN 100 ELSE 0 END,
    CASE p_tier
    WHEN 'bronze'   THEN 5     WHEN 'silver'   THEN 20
    WHEN 'gold'     THEN 80    WHEN 'platinum' THEN 250 ELSE 0 END;
END $$;

-- ────────────────────────────────────────────────────────────────────
-- Cleanup: abgelaufene Streifen als 'expired' markieren (Wagen kam ans Ziel,
-- ohne abgefangen worden zu sein — der Spieler hat sie verpasst).
-- ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.kurier_streifen_cleanup_expired()
RETURNS int LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE public.kurier_streifen
     SET status = 'expired'
   WHERE status = 'walking' AND finishes_at < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

-- ────────────────────────────────────────────────────────────────────
-- Attack-Resolve: Banditen-Style instant battle.
-- Spieler schickt p_troops Truppen + (optional) Wächter; Server vergleicht
-- mit Streifen-HP. Sieg → Loot in Inbox. Niederlage → Truppen verwundet
-- ins Lazarett.
-- ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.attack_kurier_streife(
  p_streife_id   bigint,
  p_troops       int,
  p_guardian_id  uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id   uuid := auth.uid();
  v_streife   public.kurier_streifen%ROWTYPE;
  v_def       record;
  v_player_atk numeric;
  v_streife_def numeric;
  v_victory   boolean;
  v_losses_pct numeric;
  v_losses    int;
  v_drop_rss  int;
  v_drop_gems int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;
  IF p_troops < 1 THEN
    RETURN jsonb_build_object('error', 'troops_min_1');
  END IF;

  -- Lock the row so two players can't capture simultaneously
  SELECT * INTO v_streife
    FROM public.kurier_streifen
   WHERE id = p_streife_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'streife_not_found');
  END IF;
  IF v_streife.status <> 'walking' THEN
    RETURN jsonb_build_object('error', 'streife_unavailable', 'current_status', v_streife.status);
  END IF;

  SELECT * INTO v_def FROM public.kurier_tier_def(v_streife.loot_tier);

  -- Sehr einfache Battle-Math (MVP):
  --   player_atk = troop_count * 10
  --   streife_def = hp
  --   victory = player_atk > streife_def * 0.9
  v_player_atk  := p_troops * 10;
  v_streife_def := v_streife.hp;
  v_victory     := v_player_atk > v_streife_def * 0.9;

  -- Truppen-Verluste: Sieg ~5-10%, Niederlage ~30-60%
  IF v_victory THEN
    v_losses_pct := 0.05 + random() * 0.05;
  ELSE
    v_losses_pct := 0.30 + random() * 0.30;
  END IF;
  v_losses := round(p_troops * v_losses_pct);

  IF v_victory THEN
    -- Loot rollen + Streife schließen
    v_drop_rss  := v_def.drop_resource_min + floor(random() * (v_def.drop_resource_max - v_def.drop_resource_min + 1))::int;
    v_drop_gems := v_def.drop_gems_min     + floor(random() * (v_def.drop_gems_max     - v_def.drop_gems_min     + 1))::int;

    UPDATE public.kurier_streifen
       SET status      = 'captured',
           captured_by  = v_user_id,
           captured_at  = now()
     WHERE id = p_streife_id;

    -- Resources aufs Konto (vier RSS gleichmäßig). DB-Spalten heißen noch
    -- wood/stone/gold/mana — Renaming nur auf der Display-Seite.
    INSERT INTO public.user_resources (user_id, wood, stone, gold, mana)
      VALUES (v_user_id, v_drop_rss, v_drop_rss, v_drop_rss, v_drop_rss)
      ON CONFLICT (user_id) DO UPDATE SET
        wood  = public.user_resources.wood  + EXCLUDED.wood,
        stone = public.user_resources.stone + EXCLUDED.stone,
        gold  = public.user_resources.gold  + EXCLUDED.gold,
        mana  = public.user_resources.mana  + EXCLUDED.mana,
        updated_at = now();

    -- Diamanten via user_gems (gleicher Lock-then-Upsert wie add_gems_to_user)
    IF v_drop_gems > 0 THEN
      INSERT INTO public.user_gems (user_id, gems) VALUES (v_user_id, v_drop_gems)
        ON CONFLICT (user_id) DO UPDATE
          SET gems = public.user_gems.gems + EXCLUDED.gems;
    END IF;

    -- Inbox-Nachricht
    INSERT INTO public.user_inbox (user_id, kind, category, from_label, title, body, payload)
    VALUES (
      v_user_id,
      'kurier_captured',
      'gameplay',
      'Kurier-Streife',
      format('🚚 +%s × 4 RSS · %s Diamanten · Kurier-Streife · Tier %s',
        v_drop_rss, v_drop_gems, v_streife.loot_tier),
      format('Du hast die Kurier-Streife abgefangen. Beute: %s × Tech-Schrott + Komponenten + Krypto + Bandbreite + %s Diamanten. Verluste: %s Truppen.',
        v_drop_rss, v_drop_gems, v_losses),
      jsonb_build_object(
        'streife_id', p_streife_id,
        'tier', v_streife.loot_tier,
        'rss_each', v_drop_rss,
        'gems', v_drop_gems,
        'losses', v_losses
      )
    );
  ELSE
    -- Streife flieht (entkommt), Spieler verliert Truppen
    UPDATE public.kurier_streifen
       SET status = 'escaped'
     WHERE id = p_streife_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'victory', v_victory,
    'troops_sent', p_troops,
    'losses', v_losses,
    'tier', v_streife.loot_tier,
    'drop_rss', CASE WHEN v_victory THEN v_drop_rss ELSE 0 END,
    'drop_gems', CASE WHEN v_victory THEN v_drop_gems ELSE 0 END
  );
END $$;

GRANT EXECUTE ON FUNCTION public.attack_kurier_streife(bigint, int, uuid) TO authenticated;

-- ────────────────────────────────────────────────────────────────────
-- BBox-Query: GIST-Index-friendly. Liefert Streifen deren route_geom
-- die BBox schneidet oder deren Endpunkte drin liegen.
-- ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.kurier_streifen_in_bbox(
  p_south double precision, p_west double precision,
  p_north double precision, p_east double precision
) RETURNS TABLE (
  id bigint, city_slug text,
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
  SELECT k.id, k.city_slug,
         k.origin_lat, k.origin_lng, k.target_lat, k.target_lng,
         CASE WHEN k.route_geom IS NOT NULL
              THEN extensions.ST_AsGeoJSON(k.route_geom)::jsonb
              ELSE NULL END,
         k.route_distance_m, k.started_at, k.finishes_at,
         k.status, k.loot_tier, k.hp, k.troop_count
    FROM public.kurier_streifen k
   WHERE k.status = 'walking'
     AND (
       k.route_geom IS NOT NULL AND k.route_geom && v_envelope
       OR (k.origin_lat BETWEEN p_south AND p_north AND k.origin_lng BETWEEN p_west AND p_east)
     )
   ORDER BY k.started_at DESC
   LIMIT 50;
END $function$;

GRANT EXECUTE ON FUNCTION public.kurier_streifen_in_bbox(double precision, double precision, double precision, double precision) TO anon, authenticated;

-- ────────────────────────────────────────────────────────────────────
-- Route-Geom-Setter — PostGREST kann geometry-Typen nicht direkt via REST
-- setzen, daher RPC. Spawn-Tick-Endpoint nutzt das nach dem Initial-Insert.
-- ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.exec_sql_kurier_set_route_geom(p_id bigint, p_wkt text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $function$
BEGIN
  UPDATE public.kurier_streifen
     SET route_geom = extensions.ST_SetSRID(extensions.ST_GeomFromText(p_wkt), 4326)
   WHERE id = p_id;
END $function$;

GRANT EXECUTE ON FUNCTION public.exec_sql_kurier_set_route_geom(bigint, text) TO service_role;
