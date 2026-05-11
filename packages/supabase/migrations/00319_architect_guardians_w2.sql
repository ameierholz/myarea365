-- 00319_architect_guardians_w2.sql
-- Phase 3: Architekt-Wächter-Klasse (W2-Welle)
--
-- Analog zur Sammler-Klasse (gather_yield_mult/gather_speed_mult) bekommen
-- Architekten einen build_speed_mult, der von start_building gelesen wird
-- und auf die Bauzeit wirkt. 1.0 = neutral, 0.70 = -30% Bauzeit (Legendär).
--
-- start_building wurde bereits in Migration 00317 angepasst (fail-soft Lookup).

BEGIN;

ALTER TABLE public.guardian_archetypes
  ADD COLUMN IF NOT EXISTS build_speed_mult numeric DEFAULT 1.0 NOT NULL;

CREATE INDEX IF NOT EXISTS idx_guardian_archetypes_build_speed
  ON public.guardian_archetypes(build_speed_mult)
  WHERE build_speed_mult < 1.0;

ALTER TABLE public.guardian_archetypes DROP CONSTRAINT IF EXISTS guardian_archetypes_guardian_type_check;
ALTER TABLE public.guardian_archetypes ADD CONSTRAINT guardian_archetypes_guardian_type_check
  CHECK (guardian_type = ANY (ARRAY['infantry'::text, 'cavalry'::text, 'marksman'::text, 'siege'::text, 'collector'::text, 'mage'::text, 'architect'::text]));

INSERT INTO public.guardian_archetypes (
  id, name, emoji, rarity, base_hp, base_atk, base_def, base_spd,
  ability_id, ability_name, ability_desc,
  lore, guardian_type, role, class_id, gender, faction,
  build_speed_mult, wave_number
) VALUES
  ('gs2_polier_kemal', 'Kemal "Polier" Aydın', '🔧', 'elite',
   4500, 380, 480, 90,
   'fast_build_passive', 'Hektik-Schicht',
   'Beschleunigt eigene Bauarbeiten passiv um 10%.',
   'Lernte sein Handwerk in den Hinterhof-Werkstätten. Wenn Kemal anpackt, läuft der Bau wie geschmiert.',
   'architect', 'support', 'support', 'male', 'gossenbund',
   0.90, 2),

  ('gs2_planer_brigitte', 'Brigitte "Planer" Hartmann', '📐', 'elite',
   4400, 360, 500, 88,
   'fast_build_passive', 'Strategischer Plan',
   'Beschleunigt eigene Bauarbeiten passiv um 10%.',
   'Stadtplanerin a.D. — kennt jeden Trick, um Genehmigungen abzukürzen.',
   'architect', 'support', 'support', 'female', 'kronenwacht',
   0.90, 2),

  ('gs2_drohne_nyx', 'Nyx-Drohne MK-3', '🛸', 'epic',
   5200, 420, 560, 110,
   'drone_swarm_build', 'Drohnen-Schwarm',
   'Bauarbeiten werden von Bau-Drohnen unterstützt. -20% Bauzeit.',
   'Autonomer Bau-Schwarm aus dem Netzhüter-Lab. Arbeitet 24/7, kennt keine Pausen.',
   'architect', 'support', 'support', 'male', 'netzhueter',
   0.80, 2),

  ('gs2_meister_arkadi', 'Arkadi "Meister" Volkov', '🏗️', 'legendary',
   6800, 520, 720, 95,
   'master_builder', 'Meister-Baumeister',
   'Legendärer Bauleiter — eigene Bauarbeiten werden um 30% schneller fertig.',
   'Soll in jeder Großstadt Europas ein Hochhaus stehen haben, das er gebaut hat. Niemand kennt sein wahres Alter.',
   'architect', 'support', 'support', 'male', NULL,
   0.70, 2)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  build_speed_mult = EXCLUDED.build_speed_mult,
  wave_number = EXCLUDED.wave_number,
  guardian_type = EXCLUDED.guardian_type;

COMMIT;
