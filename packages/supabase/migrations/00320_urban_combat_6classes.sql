-- 00320_urban_combat_6classes.sql
--
-- Option-C: Komplettes Urban-Combat-Klassen-System.
-- 6 Wächtertypen (=Truppentypen): Türsteher / Kurier / Schütze / Brecher / Sammler / Konstrukteur
-- Rollen abgeschafft (User-Entscheidung 2026-05-11).
-- mage-Typ entfernt — Sky Demir (Helikopter) → marksman (Heli-Sniper).
-- Neue Klasse architect für Konstrukteure (Bauarbeiter mit build_speed_mult).
-- 4-Klassen-RPS-Counter: Türsteher > Schütze > Kurier > Brecher > Türsteher (+25% / -15%)

BEGIN;

-- 1) Rollen-Check droppen, Rolle als nicht-relevantes Feld
ALTER TABLE public.guardian_archetypes DROP CONSTRAINT IF EXISTS guardian_archetypes_role_check;
UPDATE public.guardian_archetypes SET role = NULL;

-- 2) troops_catalog: 'architect' erlauben
ALTER TABLE public.troops_catalog DROP CONSTRAINT IF EXISTS troops_catalog_troop_class_check;
ALTER TABLE public.troops_catalog ADD CONSTRAINT troops_catalog_troop_class_check
  CHECK (troop_class = ANY (ARRAY['infantry'::text, 'cavalry'::text, 'marksman'::text, 'siege'::text, 'collector'::text, 'architect'::text]));

-- 3) Konstrukteur-Truppen T1..T5
INSERT INTO public.troops_catalog (id, name, emoji, troop_class, tier, base_atk, base_def, base_hp, cost_wood, cost_stone, cost_gold, cost_mana, train_time_seconds, required_building_level, description)
VALUES
  ('arc_t1', 'Konstrukteur Rookie', '🔨', 'architect', 1, 30, 50, 220, 80,  80,  20,  0, 30,  1, 'Lehrling auf der Baustelle.'),
  ('arc_t2', 'Konstrukteur Stamm',  '🔨', 'architect', 2, 55, 90, 380, 140, 140, 35,  0, 90,  4, 'Eingearbeiteter Bauarbeiter.'),
  ('arc_t3', 'Konstrukteur Profi',  '🔨', 'architect', 3, 95, 160, 620, 240, 240, 60,  0, 240, 9, 'Geübter Polier.'),
  ('arc_t4', 'Konstrukteur Elite',  '🔨', 'architect', 4, 160, 260, 980, 400, 400, 100, 0, 600, 14, 'Erfahrener Bauleiter.'),
  ('arc_t5', 'Konstrukteur Boss',   '🔨', 'architect', 5, 270, 420, 1500, 700, 700, 180, 0, 1800, 19, 'Architekt mit Stahl-Helm.')
ON CONFLICT (id) DO NOTHING;

-- 4) Sky Demir (mage) → marksman
UPDATE public.guardian_archetypes SET guardian_type = 'marksman' WHERE guardian_type = 'mage';

-- 5) guardian_type-Check: 6 Wächtertypen, mage raus
ALTER TABLE public.guardian_archetypes DROP CONSTRAINT IF EXISTS guardian_archetypes_guardian_type_check;
ALTER TABLE public.guardian_archetypes ADD CONSTRAINT guardian_archetypes_guardian_type_check
  CHECK (guardian_type = ANY (ARRAY['infantry'::text, 'cavalry'::text, 'marksman'::text, 'siege'::text, 'collector'::text, 'architect'::text]));

-- 6) Talent-Nodes: vs_mage konsolidiert nach vs_marksman
UPDATE public.talent_nodes SET effect_key = 'vs_marksman' WHERE effect_key = 'vs_mage';

-- 7) Counter-Matrix-Helper (4-class RPS)
CREATE OR REPLACE FUNCTION public._class_counter_mult(p_attacker text, p_defender text)
RETURNS numeric LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_attacker IS NULL OR p_defender IS NULL THEN 1.0
    WHEN p_attacker = 'infantry' AND p_defender = 'marksman' THEN 1.25
    WHEN p_attacker = 'marksman' AND p_defender = 'cavalry'  THEN 1.25
    WHEN p_attacker = 'cavalry'  AND p_defender = 'siege'    THEN 1.25
    WHEN p_attacker = 'siege'    AND p_defender = 'infantry' THEN 1.25
    WHEN p_attacker = 'marksman' AND p_defender = 'infantry' THEN 0.85
    WHEN p_attacker = 'cavalry'  AND p_defender = 'marksman' THEN 0.85
    WHEN p_attacker = 'siege'    AND p_defender = 'cavalry'  THEN 0.85
    WHEN p_attacker = 'infantry' AND p_defender = 'siege'    THEN 0.85
    ELSE 1.0
  END;
$$;

GRANT EXECUTE ON FUNCTION public._class_counter_mult(text, text) TO authenticated, anon;

-- 8) _guardian_talent_atk_mult: vs_mage entfernt, vs_collector hinzu
CREATE OR REPLACE FUNCTION public._guardian_talent_atk_mult(p_user uuid, p_target_role text DEFAULT NULL::text)
 RETURNS numeric LANGUAGE sql STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  with active_g as (
    select id, archetype_id from public.user_guardians where user_id = p_user and is_active = true limit 1
  ),
  bonuses as (
    select tn.effect_key as k, sum(coalesce(tn.effect_per_rank, 0) * coalesce(gt.rank, 0)) as v
      from active_g g
      join public.guardian_talents gt on gt.guardian_id = g.id
      join public.talent_nodes tn on tn.id = gt.node_id
     where gt.rank > 0
     group by tn.effect_key
  )
  select 1.0
       + coalesce((select v from bonuses where k = 'atk_pct'), 0)
       + coalesce((select v from bonuses where k = 'all_stats_pct'), 0)
       + coalesce((select v from bonuses where k = 'r1_atk_pct') * 0.5, 0)
       + case when p_target_role = 'infantry' then coalesce((select v from bonuses where k = 'vs_infantry'), 0)
              when p_target_role = 'cavalry'  then coalesce((select v from bonuses where k = 'vs_cavalry'), 0)
              when p_target_role = 'marksman' then coalesce((select v from bonuses where k = 'vs_marksman'), 0)
              when p_target_role = 'siege'    then coalesce((select v from bonuses where k = 'vs_siege'), 0)
              when p_target_role = 'collector' then coalesce((select v from bonuses where k = 'vs_collector'), 0)
              else 0 end;
$function$;

-- 9) resolve_player_base_attack: counter_mult einbauen
-- (Full definition in Supabase Auth-Console — siehe applied migration 'urban_combat_6classes_drop_roles')

COMMIT;
