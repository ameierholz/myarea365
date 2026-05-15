-- 00392_mutant_rallies.sql
-- Crew-Rally gegen Mutanten — Wegelager-Stil, kein Solo-Angriff mehr.
-- User-Wunsch: "Mutanten können nur als Crew angegriffen werden nicht einzeln".
--
-- Architektur: piggyback auf bestehendem rallies-System (00110).
--   - rallies.target_mutant_id (bigint) nullable
--   - rallies.stronghold_id wird nullable; CHECK constraint stellt sicher dass
--     genau eines von beiden gesetzt ist
--   - start_mutant_rally RPC parallel zu start_rally
--   - resolve_due_rallies wird ersetzt mit branching-Version
--   - get_active_rally_for_user gibt jetzt auch mutant-Snapshot zurück

-- ─── 1) Schema-Erweiterung ───────────────────────────────────────────────
ALTER TABLE public.rallies
  ALTER COLUMN stronghold_id DROP NOT NULL;

ALTER TABLE public.rallies
  ADD COLUMN IF NOT EXISTS target_mutant_id bigint
    REFERENCES public.mutants(id) ON DELETE CASCADE;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rallies_target_exclusive'
  ) THEN
    ALTER TABLE public.rallies
      ADD CONSTRAINT rallies_target_exclusive
      CHECK (
        (stronghold_id IS NOT NULL)::int +
        (target_mutant_id IS NOT NULL)::int = 1
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rallies_mutant_active
  ON public.rallies(target_mutant_id, status)
  WHERE status IN ('preparing','marching','fighting');

-- ─── 2) start_mutant_rally — analog zu start_rally ───────────────────────
CREATE OR REPLACE FUNCTION public.start_mutant_rally(
  p_mutant_id    bigint,
  p_prep_seconds int,
  p_guardian_id  uuid,
  p_troops       jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_crew uuid;
  v_existing int;
  v_atk bigint;
  v_rally_id uuid;
  v_mutant public.mutants;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_prep_seconds NOT IN (180, 480, 1680, 28680) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_prep_seconds');
  END IF;
  IF jsonb_typeof(p_troops) <> 'object' OR p_troops = '{}'::jsonb THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_troops_selected');
  END IF;

  SELECT crew_id INTO v_crew FROM public.crew_members WHERE user_id = v_user;
  IF v_crew IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_in_crew');
  END IF;

  SELECT * INTO v_mutant FROM public.mutants
   WHERE id = p_mutant_id AND status = 'walking' FOR UPDATE;
  IF v_mutant IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'mutant_not_available');
  END IF;

  -- Eine offene Rally pro Crew (egal welcher Typ)
  SELECT count(*) INTO v_existing FROM public.rallies
   WHERE crew_id = v_crew AND status IN ('preparing','marching','fighting');
  IF v_existing > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'rally_already_active');
  END IF;

  IF p_guardian_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.user_guardians WHERE id = p_guardian_id AND user_id = v_user) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'guardian_not_owned');
    END IF;
  END IF;

  -- Truppen abziehen + ATK berechnen (gleicher Helper wie Stronghold-Rally)
  v_atk := public._reserve_user_troops(v_user, p_troops);

  INSERT INTO public.rallies (leader_user_id, crew_id, target_mutant_id, prep_seconds, prep_ends_at)
  VALUES (v_user, v_crew, p_mutant_id, p_prep_seconds, now() + (p_prep_seconds || ' seconds')::interval)
  RETURNING id INTO v_rally_id;

  INSERT INTO public.rally_participants (rally_id, user_id, guardian_id, troops, atk_contribution)
  VALUES (v_rally_id, v_user, p_guardian_id, p_troops, v_atk);

  UPDATE public.rallies SET total_atk = v_atk WHERE id = v_rally_id;

  RETURN jsonb_build_object('ok', true, 'rally_id', v_rally_id, 'prep_ends_at', now() + (p_prep_seconds || ' seconds')::interval);
END $function$;
REVOKE ALL ON FUNCTION public.start_mutant_rally(bigint, int, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_mutant_rally(bigint, int, uuid, jsonb) TO authenticated;

-- ─── 3) resolve_due_rallies — branching für stronghold UND mutant ────────
-- Drop old, recreate with both branches.
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
      SELECT * INTO v_tier FROM public.mutant_tier_def(v_mut.loot_tier);

      v_total_atk := r.total_atk;
      v_total_hp := v_mut.hp;
      v_outcome := CASE WHEN v_total_atk >= v_total_hp THEN 'victory' ELSE 'defeat' END;
      v_loss_pct := CASE v_outcome WHEN 'victory' THEN 0.10 ELSE 0.40 END;

      IF v_outcome = 'victory' AND v_mut.status = 'walking' THEN
        UPDATE public.mutants SET status = 'captured' WHERE id = v_mut.id;
        v_drop_rss := v_tier.drop_rss;
        v_drop_gems := v_tier.drop_gems;
      ELSE
        v_drop_rss := 0;
        v_drop_gems := 0;
      END IF;

      -- Truppen-Verluste + Loot-Anteil pro Participant
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

        IF v_outcome = 'victory' AND v_drop_rss > 0 THEN
          INSERT INTO public.user_resources (user_id, wood, stone, gold, mana)
          VALUES (p.user_id, round(v_drop_rss * v_share), round(v_drop_rss * v_share), round(v_drop_rss * v_share), round(v_drop_rss * v_share))
          ON CONFLICT (user_id) DO UPDATE SET
            wood  = user_resources.wood  + EXCLUDED.wood,
            stone = user_resources.stone + EXCLUDED.stone,
            gold  = user_resources.gold  + EXCLUDED.gold,
            mana  = user_resources.mana  + EXCLUDED.mana;
          IF v_drop_gems > 0 THEN
            INSERT INTO public.user_gems (user_id, gems_balance)
            VALUES (p.user_id, round(v_drop_gems * v_share))
            ON CONFLICT (user_id) DO UPDATE SET
              gems_balance = user_gems.gems_balance + EXCLUDED.gems_balance;
          END IF;
        END IF;

        -- Inbox-Nachricht pro Participant
        INSERT INTO public.user_inbox (user_id, kind, category, from_label, title, body, payload)
        VALUES (
          p.user_id, 'mutant_rally_result', 'gameplay', 'Crew-Rally',
          CASE WHEN v_outcome = 'victory'
               THEN format('Mutant (%s) niedergerungen', v_mut.loot_tier)
               ELSE format('Crew-Angriff auf Mutant (%s) gescheitert', v_mut.loot_tier) END,
          CASE WHEN v_outcome = 'victory'
               THEN format('Dein Anteil: %s × 4 RSS%s. Truppen: %s zurück, %s verloren.',
                    round(v_drop_rss * v_share),
                    CASE WHEN v_drop_gems > 0 THEN format(' + %s Diamanten', round(v_drop_gems * v_share)) ELSE '' END,
                    'siehe Aufstellung', round((p.atk_contribution * v_loss_pct)::numeric))
               ELSE 'Mutant ist entkommen. Verluste in Hospital geschickt.' END,
          jsonb_build_object('rally_id', r.id, 'tier', v_mut.loot_tier, 'share', v_share, 'outcome', v_outcome)
        );
      END LOOP;

      UPDATE public.rallies SET
        status = 'done', outcome = v_outcome, resolved_at = now(),
        total_hp_dealt = least(v_total_atk, v_total_hp),
        loot = jsonb_build_object(
          'tier', v_mut.loot_tier,
          'drop_rss', v_drop_rss,
          'drop_gems', v_drop_gems,
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
          VALUES (p.user_id, 'gold', 'stronghold', now() + interval '24 hours');
        ELSIF v_outcome = 'victory' AND v_sh.level >= 5 AND random() < 0.6 THEN
          INSERT INTO public.treasure_chests (owner_user_id, kind, source, opens_at)
          VALUES (p.user_id, 'silver', 'stronghold', now() + interval '24 hours');
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
GRANT EXECUTE ON FUNCTION public.resolve_due_rallies() TO authenticated;

-- ─── 4) get_active_rally_for_user — Mutant-Branch ergänzt ────────────────
CREATE OR REPLACE FUNCTION public.get_active_rally_for_user()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_crew uuid;
  v_rally record;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  PERFORM public.resolve_due_rallies();
  SELECT crew_id INTO v_crew FROM public.crew_members WHERE user_id = v_user;
  IF v_crew IS NULL THEN RETURN jsonb_build_object('ok', true, 'rally', null); END IF;
  SELECT * INTO v_rally FROM public.rallies
   WHERE crew_id = v_crew AND status IN ('preparing','marching','fighting')
   ORDER BY created_at DESC LIMIT 1;
  IF v_rally IS NULL THEN RETURN jsonb_build_object('ok', true, 'rally', null); END IF;
  RETURN jsonb_build_object('ok', true,
    'rally', jsonb_build_object(
      'id', v_rally.id,
      'leader_user_id', v_rally.leader_user_id,
      'crew_id', v_rally.crew_id,
      'stronghold_id', v_rally.stronghold_id,
      'target_mutant_id', v_rally.target_mutant_id,
      'target_kind', CASE WHEN v_rally.target_mutant_id IS NOT NULL THEN 'mutant' ELSE 'stronghold' END,
      'prep_ends_at', v_rally.prep_ends_at,
      'march_ends_at', v_rally.march_ends_at,
      'status', v_rally.status,
      'total_atk', v_rally.total_atk
    ),
    'i_joined', exists (SELECT 1 FROM public.rally_participants WHERE rally_id = v_rally.id AND user_id = v_user),
    'participants', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'user_id', user_id, 'guardian_id', guardian_id,
        'troops', troops, 'atk_contribution', atk_contribution
      )), '[]'::jsonb) FROM public.rally_participants WHERE rally_id = v_rally.id
    ),
    'stronghold', CASE WHEN v_rally.stronghold_id IS NOT NULL THEN (
      SELECT jsonb_build_object('id', id, 'lat', lat, 'lng', lng, 'level', level, 'total_hp', total_hp, 'current_hp', current_hp)
      FROM public.strongholds WHERE id = v_rally.stronghold_id
    ) ELSE NULL END,
    'mutant', CASE WHEN v_rally.target_mutant_id IS NOT NULL THEN (
      SELECT jsonb_build_object(
        'id', id, 'lat', origin_lat, 'lng', origin_lng,
        'loot_tier', loot_tier, 'spawn_terrain', spawn_terrain,
        'hp', hp, 'troop_count', troop_count
      )
      FROM public.mutants WHERE id = v_rally.target_mutant_id
    ) ELSE NULL END
  );
END $function$;
REVOKE ALL ON FUNCTION public.get_active_rally_for_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_rally_for_user() TO authenticated;
