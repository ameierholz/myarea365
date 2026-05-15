-- 00394_mutant_diverse_drops_and_inbox.sql
-- Diversifiziert Mutant-Drops (vorher nur RSS+Gems): jetzt RSS + Diamanten +
-- Speed-Tokens + Truhen (Silber/Gold/Event) + Speedup-Items aus dem Katalog.
-- Loot skaliert mit sqrt(level), Item-Chancen mit tier (Plat > Gold > Silver > Bronze).
--
-- Inbox-Nachricht pro Teilnehmer bekommt vollständigen Bericht:
--   - WO (Stadt-Slug + Terrain + Lat/Lng)
--   - WAS (Tier · Stufe · Mutant-Truppen)
--   - WANN (resolved_at, ISO-String)
--   - BEITRAG (atk_contribution / total_atk in %)
--   - ERHALTEN (alle Items + RSS + Gems + Verluste)
--
-- Inbox-Payload enthält strukturiertes JSON damit das Frontend später eine
-- detaillierte Result-Ansicht rendern kann (analog zu Quest-Result-Modal).

-- ─── 1) treasure_chests.source: 'mutant' erlauben ────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'treasure_chests_source_check'
      AND conrelid = 'public.treasure_chests'::regclass
  ) THEN
    ALTER TABLE public.treasure_chests DROP CONSTRAINT treasure_chests_source_check;
  END IF;
  ALTER TABLE public.treasure_chests
    ADD CONSTRAINT treasure_chests_source_check
    CHECK (source IN ('walk','vip','event','chest_drop','arena','quest','purchased','mutant'));
END $$;

-- ─── 2) Helper: award_mutant_loot ────────────────────────────────────────
-- Verteilt anteiligen Drop an einen Participant und gibt strukturiertes
-- JSON zurück mit allen verteilten Items (für Inbox-Payload).
CREATE OR REPLACE FUNCTION public.award_mutant_loot(
  p_user_id uuid,
  p_tier    text,
  p_level   int,
  p_share   numeric    -- 0..1
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_mult       numeric := GREATEST(1, floor(sqrt(GREATEST(1, p_level))));
  v_rss_base   int;
  v_gems_base  int;
  v_rss        int;
  v_gems       int;
  v_speed_tok  int := 0;
  v_silver     int := 0;
  v_gold       int := 0;
  v_event      int := 0;
  v_speedups   jsonb := '[]'::jsonb;
  v_speedup_id text;
  v_speedup_qty int;
  v_speedup_name text;
  v_speedup_pool text[];
BEGIN
  -- Base-Werte pro Tier (matched mutant_tier_def Mig 00391/00393)
  CASE p_tier
    WHEN 'bronze'   THEN v_rss_base := 1000;  v_gems_base := 0;
    WHEN 'silver'   THEN v_rss_base := 4000;  v_gems_base := 5;
    WHEN 'gold'     THEN v_rss_base := 12000; v_gems_base := 15;
    WHEN 'platinum' THEN v_rss_base := 40000; v_gems_base := 50;
    ELSE v_rss_base := 1000; v_gems_base := 0;
  END CASE;

  v_rss  := round((v_rss_base  * v_mult * p_share)::numeric);
  v_gems := round((v_gems_base * v_mult * p_share)::numeric);

  -- Speed-Tokens: 1 Bronze, 2 Silber, 3 Gold, 5 Plat × share (mind 1 bei share>0.05)
  v_speed_tok := CASE p_tier
    WHEN 'platinum' THEN GREATEST(CASE WHEN p_share > 0.05 THEN 1 ELSE 0 END, round(5 * p_share)::int)
    WHEN 'gold'     THEN GREATEST(CASE WHEN p_share > 0.05 THEN 1 ELSE 0 END, round(3 * p_share)::int)
    WHEN 'silver'   THEN GREATEST(CASE WHEN p_share > 0.05 THEN 1 ELSE 0 END, round(2 * p_share)::int)
    ELSE round(1 * p_share)::int
  END;

  -- Truhen: pro Tier eine Roll. Plat: 100% gold + 60% event, Gold: 100% silver + 40% gold,
  -- Silber: 60% silver, Bronze: 25% silver
  IF p_tier = 'platinum' THEN
    v_gold := 1;
    IF random() < 0.6 THEN v_event := 1; END IF;
  ELSIF p_tier = 'gold' THEN
    v_silver := 1;
    IF random() < 0.4 THEN v_gold := 1; END IF;
  ELSIF p_tier = 'silver' THEN
    IF random() < 0.6 THEN v_silver := 1; END IF;
  ELSE
    IF random() < 0.25 THEN v_silver := 1; END IF;
  END IF;

  -- Truhen aber NUR wenn share signifikant (>5%) — sonst kriegen Mini-Beitritte zu viel
  IF p_share < 0.05 THEN
    v_silver := 0; v_gold := 0; v_event := 0;
  END IF;

  -- Speedup-Item: 1 Roll aus Tier-Pool (mind 1 für Plat, sonst Wahrscheinlichkeit)
  v_speedup_pool := CASE p_tier
    WHEN 'platinum' THEN ARRAY['speedup_uni_60m','speedup_uni_15m','speedup_build_60m','speedup_research_60m']
    WHEN 'gold'     THEN ARRAY['speedup_uni_15m','speedup_build_15m','speedup_research_15m','speedup_build_60m']
    WHEN 'silver'   THEN ARRAY['speedup_build_15m','speedup_research_15m','speedup_build_5m','speedup_research_5m']
    ELSE                 ARRAY['speedup_build_5m','speedup_research_5m','speedup_build_1m','speedup_research_1m']
  END;

  IF p_share >= 0.05 AND (p_tier = 'platinum' OR random() < CASE p_tier WHEN 'gold' THEN 0.85 WHEN 'silver' THEN 0.55 ELSE 0.25 END) THEN
    v_speedup_id := v_speedup_pool[1 + floor(random() * array_length(v_speedup_pool, 1))::int];
    v_speedup_qty := CASE p_tier WHEN 'platinum' THEN 3 WHEN 'gold' THEN 2 ELSE 1 END;
    SELECT name INTO v_speedup_name FROM public.inventory_item_catalog WHERE id = v_speedup_id;
    IF v_speedup_name IS NOT NULL THEN
      PERFORM public.grant_inventory_item(p_user_id, v_speedup_id, v_speedup_qty);
      v_speedups := jsonb_build_array(jsonb_build_object(
        'id', v_speedup_id,
        'name', v_speedup_name,
        'count', v_speedup_qty
      ));
    END IF;
  END IF;

  -- RSS gutschreiben
  IF v_rss > 0 THEN
    INSERT INTO public.user_resources (user_id, wood, stone, gold, mana)
    VALUES (p_user_id, v_rss, v_rss, v_rss, v_rss)
    ON CONFLICT (user_id) DO UPDATE SET
      wood  = public.user_resources.wood  + EXCLUDED.wood,
      stone = public.user_resources.stone + EXCLUDED.stone,
      gold  = public.user_resources.gold  + EXCLUDED.gold,
      mana  = public.user_resources.mana  + EXCLUDED.mana,
      updated_at = now();
  END IF;

  -- Diamanten gutschreiben
  IF v_gems > 0 THEN
    INSERT INTO public.user_gems (user_id, gems)
    VALUES (p_user_id, v_gems)
    ON CONFLICT (user_id) DO UPDATE SET
      gems = public.user_gems.gems + EXCLUDED.gems,
      updated_at = now();
  END IF;

  -- Speed-Tokens gutschreiben (eigener Counter auf user_resources)
  IF v_speed_tok > 0 THEN
    INSERT INTO public.user_resources (user_id, speed_tokens)
    VALUES (p_user_id, v_speed_tok)
    ON CONFLICT (user_id) DO UPDATE SET
      speed_tokens = public.user_resources.speed_tokens + EXCLUDED.speed_tokens,
      updated_at = now();
  END IF;

  -- Truhen einbuchen — opens_at: Silber 4h, Gold 24h, Event 12h
  FOR i IN 1..v_silver LOOP
    INSERT INTO public.treasure_chests (owner_user_id, kind, source, opens_at)
    VALUES (p_user_id, 'silver', 'mutant', now() + interval '4 hours');
  END LOOP;
  FOR i IN 1..v_gold LOOP
    INSERT INTO public.treasure_chests (owner_user_id, kind, source, opens_at)
    VALUES (p_user_id, 'gold', 'mutant', now() + interval '24 hours');
  END LOOP;
  FOR i IN 1..v_event LOOP
    INSERT INTO public.treasure_chests (owner_user_id, kind, source, opens_at)
    VALUES (p_user_id, 'event', 'mutant', now() + interval '12 hours');
  END LOOP;

  RETURN jsonb_build_object(
    'rss_per_resource', v_rss,
    'rss_total', v_rss * 4,
    'gems', v_gems,
    'speed_tokens', v_speed_tok,
    'chests_silver', v_silver,
    'chests_gold',   v_gold,
    'chests_event',  v_event,
    'speedups', v_speedups
  );
END $function$;
REVOKE ALL ON FUNCTION public.award_mutant_loot(uuid, text, int, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.award_mutant_loot(uuid, text, int, numeric) TO service_role;

-- ─── 3) resolve_due_rallies — Mutant-Branch nutzt jetzt award_mutant_loot ─
-- und schreibt eine DETAILLIERTE Inbox pro Participant.
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
  v_tier record;
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
  v_drop_rss int;
  v_drop_gems int;
  v_loot_summary jsonb;
  v_total_lost int;
  v_terrain_label text;
  v_share_pct int;
  v_body text;
BEGIN
  -- Phase A: preparing → marching (60s pauschal)
  FOR r IN SELECT * FROM public.rallies WHERE status = 'preparing' AND prep_ends_at <= now() LOOP
    UPDATE public.rallies
       SET status = 'marching', march_ends_at = now() + interval '60 seconds'
     WHERE id = r.id;
    v_count := v_count + 1;
  END LOOP;

  -- Phase B: marching → done. Branching nach Target-Typ.
  FOR r IN SELECT * FROM public.rallies WHERE status = 'marching' AND march_ends_at <= now() LOOP

    IF r.target_mutant_id IS NOT NULL THEN
      -- ─────────────────── MUTANT-RALLY ───────────────────
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

        -- Loot verteilen via Helper (nur bei Sieg)
        IF v_outcome = 'victory' THEN
          v_loot_summary := public.award_mutant_loot(p.user_id, v_mut.loot_tier, v_mut.level, v_share);
        ELSE
          v_loot_summary := jsonb_build_object(
            'rss_per_resource', 0, 'rss_total', 0, 'gems', 0,
            'speed_tokens', 0, 'chests_silver', 0, 'chests_gold', 0,
            'chests_event', 0, 'speedups', '[]'::jsonb
          );
        END IF;

        -- Inbox-Body strukturiert zusammenbauen
        IF v_outcome = 'victory' THEN
          v_body := format(
            E'📍 WO: %s · Stufe %s · %s\n' ||
            E'⚔ WAS: Mutant (%s) mit %s Verteidigern\n' ||
            E'📊 DEIN BEITRAG: %s%% des Crew-Schadens\n' ||
            E'💀 VERLUSTE: %s Truppen\n\n' ||
            E'🎁 ERHALTEN:\n' ||
            E'  • %s × Holz / Stein / Gold / Bandbreite\n' ||
            E'%s' ||  -- gems-Zeile
            E'%s' ||  -- speed-token-Zeile
            E'%s' ||  -- silver-chest-Zeile
            E'%s' ||  -- gold-chest-Zeile
            E'%s' ||  -- event-chest-Zeile
            E'%s',     -- speedup-Zeile
            v_terrain_label,
            v_mut.level,
            v_mut.city_slug,
            initcap(v_mut.loot_tier),
            v_mut.troop_count,
            v_share_pct,
            v_total_lost,
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

    ELSE
      -- ─────────────────── STRONGHOLD-RALLY (alte Logik) ───────────────────
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

  RETURN v_count;
END $function$;
REVOKE ALL ON FUNCTION public.resolve_due_rallies() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_due_rallies() TO authenticated, service_role;
