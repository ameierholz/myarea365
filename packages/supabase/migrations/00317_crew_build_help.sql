-- 00317_crew_build_help.sql
--
-- Phase 1: Crew-Help-Mechanik beim Bauen (à la RoK)
--
-- Crew-Mitglieder können laufende Bauten ihrer Kameraden beschleunigen:
--   - Jeder Click reduziert die Restzeit um 1% der ursprünglichen Bauzeit
--   - Pro Bau maximal 30 Helps (-30% gesamt möglich)
--   - 5-Minuten-Cooldown pro Helper pro Bau (verhindert Spam)
--   - Help-Building (allianz_zentrum.crew_help_speedup_pct) erhöht Help-Wirkung

BEGIN;

-- ── 1) Help-Actions-Log ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.building_help_actions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id     uuid NOT NULL REFERENCES public.building_queue(id) ON DELETE CASCADE,
  helper_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  base_owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  helped_at    timestamptz NOT NULL DEFAULT now(),
  speedup_ms   bigint NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bha_queue        ON public.building_help_actions(queue_id);
CREATE INDEX IF NOT EXISTS idx_bha_helper_queue ON public.building_help_actions(helper_id, queue_id);
CREATE INDEX IF NOT EXISTS idx_bha_owner_recent ON public.building_help_actions(base_owner_id, helped_at DESC);

ALTER TABLE public.building_help_actions ENABLE ROW LEVEL SECURITY;
-- Read: helper sieht eigene Aktionen + Owner sieht alle Helps auf eigenen Bauten
CREATE POLICY "help_actions_read_own" ON public.building_help_actions FOR SELECT
  TO authenticated USING (helper_id = auth.uid() OR base_owner_id = auth.uid());
-- Insert nur via RPC (kein direkter Insert von Client)

-- ── 2) Originale Bauzeit pro Queue-Eintrag tracken ───────────────
-- Wir brauchen die Original-Dauer um "1% der ursprünglichen Bauzeit" konsistent
-- zu berechnen — auch wenn Speed-Ups schon abgezogen wurden.
ALTER TABLE public.building_queue
  ADD COLUMN IF NOT EXISTS original_duration_sec integer;

-- Backfill für bereits laufende Aufträge: aus started_at..ends_at ableiten
UPDATE public.building_queue
   SET original_duration_sec = greatest(60, extract(epoch from (ends_at - started_at))::int)
 WHERE original_duration_sec IS NULL AND NOT finished;

-- ── 3) RPC: help_crew_build ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.help_crew_build(p_queue_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_helper uuid := auth.uid();
  v_queue  record;
  v_owner  uuid;
  v_owner_crew uuid;
  v_helper_crew uuid;
  v_help_count int;
  v_last_help timestamptz;
  v_speedup_pct numeric;
  v_speedup_ms bigint;
  v_remaining_ms bigint;
  v_new_ends timestamptz;
  v_help_buff numeric;
BEGIN
  IF v_helper IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- Queue + Owner laden
  SELECT q.*, b.owner_user_id AS owner_user_id
    INTO v_queue
    FROM public.building_queue q
    JOIN public.bases b ON b.id = q.base_id
   WHERE q.id = p_queue_id AND NOT q.finished
   FOR UPDATE OF q;

  IF v_queue IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'queue_not_found_or_finished');
  END IF;

  v_owner := v_queue.owner_user_id;

  -- Self-Help verboten
  IF v_owner = v_helper THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cannot_help_self');
  END IF;

  -- Beide müssen in derselben Crew sein
  SELECT current_crew_id INTO v_owner_crew  FROM public.users WHERE id = v_owner;
  SELECT current_crew_id INTO v_helper_crew FROM public.users WHERE id = v_helper;
  IF v_owner_crew IS NULL OR v_helper_crew IS NULL OR v_owner_crew <> v_helper_crew THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_in_same_crew');
  END IF;

  -- Max 30 Helps pro Auftrag
  SELECT count(*) INTO v_help_count
    FROM public.building_help_actions
   WHERE queue_id = p_queue_id;
  IF v_help_count >= 30 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'max_helps_reached', 'helps', v_help_count);
  END IF;

  -- 5-min Cooldown pro Helper pro Bau
  SELECT max(helped_at) INTO v_last_help
    FROM public.building_help_actions
   WHERE queue_id = p_queue_id AND helper_id = v_helper;
  IF v_last_help IS NOT NULL AND v_last_help > now() - interval '5 minutes' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'helper_cooldown',
      'next_at', v_last_help + interval '5 minutes');
  END IF;

  -- Base-Speedup: 1% der Original-Bauzeit
  v_speedup_pct := 0.01;
  -- Owner-Bonus: allianz_zentrum.crew_help_speedup_pct des OWNERS erhöht die Hilfe
  SELECT coalesce(level, 0) * 0.05 INTO v_help_buff
    FROM public.base_buildings bb
    JOIN public.bases b ON b.id = bb.base_id
   WHERE b.owner_user_id = v_owner AND bb.building_id = 'allianz_zentrum';
  v_help_buff := coalesce(v_help_buff, 0);
  v_speedup_pct := v_speedup_pct * (1 + v_help_buff);

  v_speedup_ms := (coalesce(v_queue.original_duration_sec, 60) * 1000 * v_speedup_pct)::bigint;
  -- Min 5 Sekunden, max 60 Minuten pro Help (Sanity-Cap)
  v_speedup_ms := greatest(5000, least(3600000, v_speedup_ms));

  -- Restzeit ausrechnen + neuer Endzeitpunkt
  v_remaining_ms := extract(epoch from (v_queue.ends_at - now())) * 1000;
  v_remaining_ms := greatest(1000, v_remaining_ms - v_speedup_ms);
  v_new_ends := now() + (v_remaining_ms / 1000.0 || ' seconds')::interval;

  -- Updaten + loggen
  UPDATE public.building_queue
     SET ends_at = v_new_ends
   WHERE id = p_queue_id;

  INSERT INTO public.building_help_actions
    (queue_id, helper_id, base_owner_id, speedup_ms)
  VALUES (p_queue_id, v_helper, v_owner, v_speedup_ms);

  RETURN jsonb_build_object(
    'ok', true,
    'speedup_ms', v_speedup_ms,
    'new_ends_at', v_new_ends,
    'helps_total', v_help_count + 1,
    'helps_remaining', 30 - (v_help_count + 1)
  );
END $$;

GRANT EXECUTE ON FUNCTION public.help_crew_build(uuid) TO authenticated;

-- ── 4) RPC: get_crew_buildings_for_help — lädt offene Bauten der Crew ──
CREATE OR REPLACE FUNCTION public.get_crew_buildings_for_help()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_helper uuid := auth.uid();
  v_crew uuid;
  v_result jsonb;
BEGIN
  IF v_helper IS NULL THEN RETURN '[]'::jsonb; END IF;
  SELECT current_crew_id INTO v_crew FROM public.users WHERE id = v_helper;
  IF v_crew IS NULL THEN RETURN '[]'::jsonb; END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'queue_id', q.id,
    'building_id', q.building_id,
    'building_name', c.name,
    'target_level', q.target_level,
    'ends_at', q.ends_at,
    'original_duration_sec', q.original_duration_sec,
    'owner_id', b.owner_user_id,
    'owner_name', coalesce(u.display_name, u.username),
    'helps_total', (select count(*) from public.building_help_actions where queue_id = q.id),
    'i_helped_recently', exists (
      select 1 from public.building_help_actions
       where queue_id = q.id and helper_id = v_helper
         and helped_at > now() - interval '5 minutes'
    )
  ) ORDER BY q.ends_at), '[]'::jsonb) INTO v_result
  FROM public.building_queue q
  JOIN public.bases b ON b.id = q.base_id
  JOIN public.users u ON u.id = b.owner_user_id
  JOIN public.buildings_catalog c ON c.id = q.building_id
  WHERE NOT q.finished
    AND u.current_crew_id = v_crew
    AND b.owner_user_id <> v_helper
    AND q.ends_at > now();

  RETURN v_result;
END $$;

GRANT EXECUTE ON FUNCTION public.get_crew_buildings_for_help() TO authenticated;

-- ── 5) start_building anpassen: original_duration_sec direkt setzen ──
-- Wir patchen nur die INSERT-Zeile, der Rest der RPC bleibt unverändert.
CREATE OR REPLACE FUNCTION public.start_building(p_building_id text, p_position_x integer DEFAULT 0, p_position_y integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
declare
  v_user uuid := auth.uid();
  v_base_id uuid;
  v_cat record;
  v_existing record;
  v_action text;
  v_target_level int;
  v_cost_mult numeric;
  v_cost_w int; v_cost_s int; v_cost_g int; v_cost_m int;
  v_resources record;
  v_buildtime_min int;
  v_vip_speed numeric := 0;
  v_extra_slots_vip int := 0;
  v_burg_level int := 0;
  v_extra_slots_burg int := 0;
  v_total_slots int;
  v_active_count int;
  v_unmet jsonb;
  v_playstyle_speed numeric := 1.0;
  v_research_speed numeric := 0;
  v_architect_speed numeric := 1.0;  -- NEU: Architekt-Wächter Bonus (Phase 3)
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select id into v_base_id from public.bases where owner_user_id = v_user;
  if v_base_id is null then v_base_id := public.get_or_create_base(); end if;

  select * into v_cat from public.buildings_catalog where id = p_building_id;
  if v_cat is null then return jsonb_build_object('ok', false, 'error', 'building_not_found'); end if;

  select coalesce(level, 0) into v_burg_level
    from public.base_buildings where base_id = v_base_id and building_id = 'burg';

  select * into v_existing from public.base_buildings
    where base_id = v_base_id and building_id = p_building_id;

  if v_existing is null then
    v_action := 'build'; v_target_level := 1; v_cost_mult := 1.0;
  else
    if v_existing.level >= v_cat.max_level then
      return jsonb_build_object('ok', false, 'error', 'max_level_reached');
    end if;
    if v_existing.status <> 'idle' then
      return jsonb_build_object('ok', false, 'error', 'already_in_progress');
    end if;
    v_action := 'upgrade';
    v_target_level := v_existing.level + 1;
    v_cost_mult := power(1.6, v_existing.level);
  end if;

  if p_building_id <> 'burg' and v_target_level > greatest(v_burg_level, 1) then
    return jsonb_build_object('ok', false, 'error', 'burg_level_too_low',
      'burg_level', v_burg_level, 'needed', v_target_level);
  end if;

  if p_building_id = 'burg' and v_target_level >= 2 then
    select coalesce(jsonb_agg(jsonb_build_object(
      'building_id', r.building_id, 'name', c.name,
      'required_level', r.required_level, 'have_level', coalesce(bb.level, 0)
    )), '[]'::jsonb)
      into v_unmet
      from public.burg_level_requirements r
      join public.buildings_catalog c on c.id = r.building_id
      left join public.base_buildings bb on bb.base_id = v_base_id and bb.building_id = r.building_id
     where r.burg_level = v_target_level
       and coalesce(bb.level, 0) < r.required_level;
    if jsonb_array_length(v_unmet) > 0 then
      return jsonb_build_object('ok', false, 'error', 'burg_requirements_unmet',
        'target_level', v_target_level, 'unmet', v_unmet);
    end if;
  end if;

  v_cost_w := round(v_cat.base_cost_wood  * v_cost_mult);
  v_cost_s := round(v_cat.base_cost_stone * v_cost_mult);
  v_cost_g := round(v_cat.base_cost_gold  * v_cost_mult);
  v_cost_m := round(v_cat.base_cost_mana  * v_cost_mult);

  select coalesce(t.extra_build_slots, 0) into v_extra_slots_vip
    from public.vip_progress p left join public.vip_tier_thresholds t on t.vip_level = p.vip_level
   where p.user_id = v_user;
  v_extra_slots_burg := case
    when v_burg_level >= 22 then 4
    when v_burg_level >= 17 then 3
    when v_burg_level >= 11 then 2
    when v_burg_level >=  4 then 1
    else 0 end;
  v_total_slots := 1 + greatest(v_extra_slots_vip, v_extra_slots_burg);

  select count(*) into v_active_count
    from public.building_queue
   where base_id = v_base_id and not finished;
  if v_active_count >= v_total_slots then
    return jsonb_build_object('ok', false, 'error', 'queue_full',
      'slots', v_total_slots, 'active', v_active_count);
  end if;

  select * into v_resources from public.user_resources where user_id = v_user for update;
  if v_resources.wood < v_cost_w or v_resources.stone < v_cost_s
     or v_resources.gold < v_cost_g or v_resources.mana < v_cost_m then
    return jsonb_build_object('ok', false, 'error', 'not_enough_resources',
      'need', jsonb_build_object('wood', v_cost_w, 'stone', v_cost_s, 'gold', v_cost_g, 'mana', v_cost_m));
  end if;

  update public.user_resources set
    wood = wood - v_cost_w, stone = stone - v_cost_s,
    gold = gold - v_cost_g, mana = mana - v_cost_m, updated_at = now()
  where user_id = v_user;

  select coalesce(t.buildtime_bonus_pct, 0) into v_vip_speed
    from public.vip_progress p left join public.vip_tier_thresholds t on t.vip_level = p.vip_level
   where p.user_id = v_user;
  v_playstyle_speed := public.playstyle_buff(v_user, 'build_speed');
  v_research_speed := public.research_buff(v_user, 'build_time_pct');

  -- Architekt-Bonus: aktiver Wächter mit build_speed_mult
  -- (Spalte wird in Migration 00319 hinzugefügt — fail-soft via coalesce/exception)
  BEGIN
    SELECT coalesce(ga.build_speed_mult, 1.0)
      INTO v_architect_speed
      FROM public.user_guardians ug
      JOIN public.guardian_archetypes ga ON ga.id = ug.archetype_id
     WHERE ug.user_id = v_user AND ug.is_active = true
     LIMIT 1;
  EXCEPTION WHEN undefined_column THEN
    v_architect_speed := 1.0;
  END;
  v_architect_speed := coalesce(v_architect_speed, 1.0);

  v_buildtime_min := least(525600,
    greatest(1, round(v_cat.base_buildtime_minutes
                       * power(coalesce(v_cat.buildtime_growth, 1.40), v_target_level - 1)
                       * (1 - coalesce(v_vip_speed, 0))
                       * (1 - least(0.50, coalesce(v_research_speed, 0)))
                       * coalesce(v_playstyle_speed, 1.0)
                       * coalesce(v_architect_speed, 1.0))));

  if v_existing is null then
    insert into public.base_buildings (base_id, building_id, position_x, position_y, level, status)
    values (v_base_id, p_building_id, p_position_x, p_position_y, 0, 'building');
  else
    update public.base_buildings set status = 'upgrading' where id = v_existing.id;
  end if;

  insert into public.building_queue
    (base_id, building_id, action, target_level, ends_at, cost_wood, cost_stone, cost_gold, cost_mana, original_duration_sec)
  values
    (v_base_id, p_building_id, v_action, v_target_level,
     now() + (v_buildtime_min || ' minutes')::interval,
     v_cost_w, v_cost_s, v_cost_g, v_cost_m, v_buildtime_min * 60);

  return jsonb_build_object('ok', true,
    'action', v_action, 'target_level', v_target_level,
    'buildtime_minutes', v_buildtime_min,
    'cost', jsonb_build_object('wood', v_cost_w, 'stone', v_cost_s, 'gold', v_cost_g, 'mana', v_cost_m));
end $function$;

COMMIT;
