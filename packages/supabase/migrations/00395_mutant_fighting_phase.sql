-- 00395_mutant_fighting_phase.sql
-- Fuegt eine sichtbare Kampfphase zwischen marching und done ein:
--
--   preparing  →  marching  →  fighting  →  done
--
-- Wichtig — Design-Notes:
--
-- 1) Nur Mutant-Rallies bekommen eine Fighting-Phase. Stronghold-Rallies
--    bleiben unveraendert (marching → done direkt), damit die bestehende
--    Combat-Mechanik nicht angetastet wird.
--
-- 2) Dauer der Fight-Phase ist DYNAMISCH und haengt vom Staerke-Verhaeltnis
--    sowie der Anzahl der Teilnehmer ab. Knappere Kaempfe dauern laenger,
--    uebermaechtige Angriffe sind schnell vorbei. Cap bei 5..25 Sekunden.
--
-- 3) mutants.status bleibt waehrend des Kampfs auf 'walking' damit parallele
--    Rallies (mehrere Crews greifen denselben Mutanten gleichzeitig an) noch
--    funktionieren — sie resolven dann alle in ihrer jeweiligen Fight-Phase.
--    Stattdessen markieren wir den Mutanten mit `fight_until` damit der
--    Client weiss, wann er VFX einblenden soll.

-- ─── 1) Schema-Erweiterung ───────────────────────────────────────────────
ALTER TABLE public.mutants
  ADD COLUMN IF NOT EXISTS fight_until timestamptz;

CREATE INDEX IF NOT EXISTS idx_mutants_fight_until
  ON public.mutants (fight_until)
  WHERE fight_until IS NOT NULL;

-- ─── 2) Helper: berechnet Kampfdauer fuer einen Mutant-Rally ─────────────
CREATE OR REPLACE FUNCTION public.calc_mutant_fight_seconds(
  p_total_atk bigint,
  p_mutant_hp bigint,
  p_participants int
) RETURNS int
LANGUAGE plpgsql IMMUTABLE
AS $function$
DECLARE
  v_ratio numeric;
  v_base int := 5;
  v_per_participant int;
  v_ratio_bonus int;
  v_total int;
BEGIN
  IF p_mutant_hp <= 0 THEN
    RETURN 5;
  END IF;

  v_ratio := p_total_atk::numeric / p_mutant_hp::numeric;
  v_per_participant := GREATEST(0, p_participants - 1) * 2;  -- +2s pro Extra-Teilnehmer

  -- Faktor nach Schaden / HP-Verhaeltnis
  v_ratio_bonus := CASE
    WHEN v_ratio >= 2.0   THEN 0    -- uebermaechtig: schnell vorbei
    WHEN v_ratio >= 1.3   THEN 3    -- klarer Sieg
    WHEN v_ratio >= 1.0   THEN 8    -- knapper Sieg
    WHEN v_ratio >= 0.7   THEN 10   -- knappe Niederlage
    ELSE 6                          -- chancenlos
  END;

  v_total := v_base + v_per_participant + v_ratio_bonus;
  RETURN LEAST(GREATEST(v_total, 5), 25);
END $function$;

-- ─── 3) resolve_due_rallies — neue Fighting-Phase fuer Mutant-Rallies ───
CREATE OR REPLACE FUNCTION public.resolve_due_rallies()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_count int := 0;
  r record;
  p record;
  v_sh record;
  v_mut record;
  v_total_atk bigint;
  v_total_hp bigint;
  v_outcome text;
  v_loss_pct numeric;
  v_share numeric;
  v_loot_per_resource bigint;
  v_lost int;
  v_kept int;
  v_key text;
  v_count_committed int;
  v_loot_summary jsonb;
  v_total_lost int;
  v_terrain_label text;
  v_share_pct int;
  v_body text;
  v_participants int;
  v_fight_seconds int;
  v_fight_ends timestamptz;
BEGIN
  -- ──────────────────────────────────────────────────────────────────────
  -- Phase A: preparing → marching (60s pauschal)
  -- ──────────────────────────────────────────────────────────────────────
  FOR r IN SELECT * FROM public.rallies WHERE status = 'preparing' AND prep_ends_at <= now() LOOP
    UPDATE public.rallies
       SET status = 'marching', march_ends_at = now() + interval '60 seconds'
     WHERE id = r.id;
    v_count := v_count + 1;
  END LOOP;

  -- ──────────────────────────────────────────────────────────────────────
  -- Phase B: marching → fighting (NUR Mutant-Rallies) ODER → done (Stronghold)
  -- ──────────────────────────────────────────────────────────────────────
  FOR r IN SELECT * FROM public.rallies WHERE status = 'marching' AND march_ends_at <= now() LOOP

    IF r.target_mutant_id IS NOT NULL THEN
      -- ─────────── MUTANT: marching → fighting ───────────
      SELECT * INTO v_mut FROM public.mutants WHERE id = r.target_mutant_id FOR UPDATE;
      IF v_mut IS NULL THEN
        UPDATE public.rallies SET status = 'done', outcome = 'timeout', resolved_at = now() WHERE id = r.id;
        v_count := v_count + 1;
        CONTINUE;
      END IF;

      SELECT COUNT(*)::int INTO v_participants FROM public.rally_participants WHERE rally_id = r.id;
      v_fight_seconds := public.calc_mutant_fight_seconds(r.total_atk, v_mut.hp, v_participants);
      v_fight_ends := now() + (v_fight_seconds || ' seconds')::interval;

      UPDATE public.rallies
         SET status = 'fighting',
             fight_ends_at = v_fight_ends
       WHERE id = r.id;

      -- Mutant-fight_until aktualisieren (greatest, falls schon andere Rally im Fight)
      UPDATE public.mutants
         SET fight_until = GREATEST(coalesce(fight_until, now()), v_fight_ends)
       WHERE id = v_mut.id;

      v_count := v_count + 1;

    ELSE
      -- ─────────── STRONGHOLD: marching → done (unveraendert) ───────────
      SELECT * INTO v_sh FROM public.strongholds WHERE id = r.stronghold_id FOR UPDATE;
      v_total_atk := r.total_atk;
      v_total_hp := coalesce(v_sh.current_hp, 0);

      IF v_total_atk >= v_total_hp AND v_sh.defeated_at IS NULL THEN
        v_outcome := 'victory';
        v_loss_pct := 0.25;
        UPDATE public.strongholds
           SET current_hp = 0, defeated_at = now(),
               defeated_by_crew = r.crew_id,
               respawn_at = now() + interval '6 hours'
         WHERE id = v_sh.id;
      ELSE
        v_outcome := 'defeat';
        v_loss_pct := 0.50;
        IF v_sh.defeated_at IS NULL THEN
          UPDATE public.strongholds
             SET current_hp = greatest(0, v_total_hp - v_total_atk)
           WHERE id = v_sh.id;
        END IF;
      END IF;

      v_loot_per_resource := CASE v_outcome WHEN 'victory' THEN v_sh.level * 500 ELSE v_sh.level * 50 END;
      FOR p IN SELECT * FROM public.rally_participants WHERE rally_id = r.id LOOP
        v_share := CASE WHEN r.total_atk > 0 THEN p.atk_contribution::numeric / r.total_atk::numeric ELSE 0 END;
        FOR v_key, v_count_committed IN SELECT * FROM jsonb_each_text(p.troops) LOOP
          v_lost := round(v_count_committed::int * v_loss_pct * 0.5);
          v_kept := v_count_committed::int - v_lost;
          IF v_kept > 0 THEN
            INSERT INTO public.user_troops (user_id, troop_id, count) VALUES (p.user_id, v_key, v_kept)
            ON CONFLICT (user_id, troop_id) DO UPDATE SET count = public.user_troops.count + EXCLUDED.count;
          END IF;
        END LOOP;
        IF v_outcome = 'victory' OR v_outcome = 'defeat' THEN
          UPDATE public.user_resources SET
            wood  = wood  + round(v_loot_per_resource * v_share),
            stone = stone + round(v_loot_per_resource * v_share),
            gold  = gold  + round(v_loot_per_resource * v_share),
            mana  = mana  + round(v_loot_per_resource * v_share / 2),
            guardian_xp = coalesce(guardian_xp, 0) + round(v_sh.level * 10 * v_share),
            updated_at = now()
           WHERE user_id = p.user_id;
        END IF;
        IF v_outcome = 'victory' AND v_sh.level >= 8 AND random() < 0.5 THEN
          INSERT INTO public.treasure_chests (owner_user_id, kind, source, opens_at)
          VALUES (p.user_id, 'gold', 'chest_drop', now() + interval '24 hours');
        ELSIF v_outcome = 'victory' AND v_sh.level >= 5 AND random() < 0.6 THEN
          INSERT INTO public.treasure_chests (owner_user_id, kind, source, opens_at)
          VALUES (p.user_id, 'silver', 'chest_drop', now() + interval '24 hours');
        END IF;
      END LOOP;

      UPDATE public.rallies SET
        status = 'done', outcome = v_outcome, resolved_at = now(),
        total_hp_dealt = least(v_total_atk, v_total_hp),
        loot = jsonb_build_object(
          'per_resource', v_loot_per_resource,
          'level', v_sh.level,
          'stronghold_killed', v_outcome = 'victory'
        )
      WHERE id = r.id;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  -- ──────────────────────────────────────────────────────────────────────
  -- Phase C: fighting → done (NUR Mutant-Rallies, eigentliche Resolution)
  -- ──────────────────────────────────────────────────────────────────────
  FOR r IN SELECT * FROM public.rallies WHERE status = 'fighting' AND fight_ends_at <= now() LOOP

    SELECT * INTO v_mut FROM public.mutants WHERE id = r.target_mutant_id FOR UPDATE;
    IF v_mut IS NULL THEN
      UPDATE public.rallies SET status = 'done', outcome = 'timeout', resolved_at = now() WHERE id = r.id;
      v_count := v_count + 1;
      CONTINUE;
    END IF;

    v_total_atk := r.total_atk;
    v_total_hp := v_mut.hp;
    v_outcome := CASE WHEN v_total_atk >= v_total_hp THEN 'victory' ELSE 'defeat' END;
    v_loss_pct := CASE v_outcome WHEN 'victory' THEN 0.10 ELSE 0.40 END;

    IF v_outcome = 'victory' AND v_mut.status = 'walking' THEN
      UPDATE public.mutants SET status = 'captured' WHERE id = v_mut.id;
    END IF;

    -- fight_until aufraeumen, wenn keine weitere fighting-Rally mehr existiert
    IF NOT EXISTS (
      SELECT 1 FROM public.rallies
       WHERE target_mutant_id = v_mut.id
         AND status = 'fighting'
         AND id <> r.id
    ) THEN
      UPDATE public.mutants SET fight_until = NULL WHERE id = v_mut.id;
    END IF;

    v_terrain_label := CASE v_mut.spawn_terrain
      WHEN 'park' THEN 'Park'
      WHEN 'industrial' THEN 'Industriegebiet'
      WHEN 'forest' THEN 'Wald'
      WHEN 'water_edge' THEN 'Uferbereich'
      ELSE 'Stadt'
    END;

    -- Truppen-Verluste + Loot-Anteil + detaillierte Inbox pro Participant
    FOR p IN SELECT * FROM public.rally_participants WHERE rally_id = r.id LOOP
      v_share := CASE WHEN r.total_atk > 0 THEN p.atk_contribution::numeric / r.total_atk::numeric ELSE 0 END;
      v_share_pct := round((v_share * 100)::numeric);
      v_total_lost := 0;

      FOR v_key, v_count_committed IN SELECT * FROM jsonb_each_text(p.troops) LOOP
        v_lost := round(v_count_committed::int * v_loss_pct * 0.5);
        v_kept := v_count_committed::int - v_lost;
        v_total_lost := v_total_lost + v_lost;
        IF v_kept > 0 THEN
          INSERT INTO public.user_troops (user_id, troop_id, count) VALUES (p.user_id, v_key, v_kept)
          ON CONFLICT (user_id, troop_id) DO UPDATE SET count = public.user_troops.count + EXCLUDED.count;
        END IF;
      END LOOP;

      IF v_outcome = 'victory' THEN
        v_loot_summary := public.award_mutant_loot(p.user_id, v_mut.loot_tier, v_mut.level, v_share);
      ELSE
        v_loot_summary := jsonb_build_object(
          'rss_per_resource', 0, 'rss_total', 0, 'gems', 0,
          'speed_tokens', 0, 'chests_silver', 0, 'chests_gold', 0,
          'chests_event', 0, 'speedups', '[]'::jsonb
        );
      END IF;

      IF v_outcome = 'victory' THEN
        v_body := format(
          E'📍 WO: %s · Stufe %s · %s\n' ||
          E'⚔ WAS: Mutant (%s) mit %s Verteidigern\n' ||
          E'📊 DEIN BEITRAG: %s%% des Crew-Schadens\n' ||
          E'💀 VERLUSTE: %s Truppen\n\n' ||
          E'🎁 ERHALTEN:\n' ||
          E'  • %s × Holz / Stein / Gold / Bandbreite\n' ||
          E'%s%s%s%s%s%s',
          v_terrain_label, v_mut.level, v_mut.city_slug,
          initcap(v_mut.loot_tier), v_mut.troop_count,
          v_share_pct, v_total_lost,
          (v_loot_summary->>'rss_per_resource')::int,
          CASE WHEN (v_loot_summary->>'gems')::int > 0
               THEN format(E'  • %s × Diamanten\n', v_loot_summary->>'gems') ELSE '' END,
          CASE WHEN (v_loot_summary->>'speed_tokens')::int > 0
               THEN format(E'  • %s × Speed-Token\n', v_loot_summary->>'speed_tokens') ELSE '' END,
          CASE WHEN (v_loot_summary->>'chests_silver')::int > 0
               THEN format(E'  • %s × Silberne Truhe (4h)\n', v_loot_summary->>'chests_silver') ELSE '' END,
          CASE WHEN (v_loot_summary->>'chests_gold')::int > 0
               THEN format(E'  • %s × Goldene Truhe (24h)\n', v_loot_summary->>'chests_gold') ELSE '' END,
          CASE WHEN (v_loot_summary->>'chests_event')::int > 0
               THEN format(E'  • %s × Event-Truhe (12h)\n', v_loot_summary->>'chests_event') ELSE '' END,
          CASE WHEN jsonb_array_length(v_loot_summary->'speedups') > 0
               THEN format(E'  • %s × %s\n',
                    (v_loot_summary->'speedups'->0->>'count')::int,
                    v_loot_summary->'speedups'->0->>'name')
               ELSE '' END
        );
      ELSE
        v_body := format(
          E'📍 WO: %s · Stufe %s · %s\n' ||
          E'⚔ WAS: Mutant (%s) mit %s Verteidigern\n' ||
          E'📊 DEIN BEITRAG: %s%% des Crew-Schadens\n' ||
          E'💀 VERLUSTE: %s Truppen\n\n' ||
          E'❌ Crew-Angriff gescheitert — Mutant ist entkommen.\n' ||
          E'Beim nächsten Mal mehr Truppen mitnehmen oder Crew-Beitritte abwarten.',
          v_terrain_label, v_mut.level, v_mut.city_slug,
          initcap(v_mut.loot_tier), v_mut.troop_count,
          v_share_pct, v_total_lost
        );
      END IF;

      INSERT INTO public.user_inbox (user_id, kind, category, from_label, title, body, payload)
      VALUES (
        p.user_id, 'mutant_rally_result', 'report', 'Crew-Angriff',
        CASE WHEN v_outcome = 'victory'
             THEN format('🏆 Mutant Stufe %s (%s) besiegt — %s%% Beitrag',
                  v_mut.level, initcap(v_mut.loot_tier), v_share_pct)
             ELSE format('❌ Mutant Stufe %s (%s) entkommen — %s%% Beitrag',
                  v_mut.level, initcap(v_mut.loot_tier), v_share_pct) END,
        v_body,
        jsonb_build_object(
          'rally_id', r.id,
          'mutant_id', v_mut.id,
          'tier', v_mut.loot_tier,
          'level', v_mut.level,
          'terrain', v_mut.spawn_terrain,
          'city_slug', v_mut.city_slug,
          'lat', v_mut.origin_lat,
          'lng', v_mut.origin_lng,
          'resolved_at', now(),
          'outcome', v_outcome,
          'share_pct', v_share_pct,
          'atk_contribution', p.atk_contribution,
          'total_atk', r.total_atk,
          'troops_lost', v_total_lost,
          'loot', v_loot_summary
        )
      );
    END LOOP;

    UPDATE public.rallies SET
      status = 'done', outcome = v_outcome, resolved_at = now(),
      total_hp_dealt = least(v_total_atk, v_total_hp),
      loot = jsonb_build_object(
        'tier', v_mut.loot_tier,
        'level', v_mut.level,
        'mutant_captured', v_outcome = 'victory'
      )
    WHERE id = r.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END $function$;
REVOKE ALL ON FUNCTION public.resolve_due_rallies() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_due_rallies() TO authenticated, service_role;

-- ─── 4) mutants_in_bbox — gibt jetzt auch fight_until zurueck ───────────
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
  status text, loot_tier text, hp int, troop_count int, level int,
  fight_until timestamptz
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
         m.status, m.loot_tier, m.hp, m.troop_count, m.level,
         m.fight_until
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
