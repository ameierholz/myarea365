-- 00340_xp_items_rename_erfahrung.sql
-- Item-Naming: "Vertrauen-Elixier" → "Erfahrung-Elixier". XP heißt im
-- Spiel EP (Erfahrungspunkte), Items entsprechend umbenannt.

UPDATE public.guardian_xp_items SET name = 'Kleines Erfahrung-Elixier' WHERE id = 'xp_pot_s';
UPDATE public.guardian_xp_items SET name = 'Erfahrung-Elixier' WHERE id = 'xp_pot_m';
UPDATE public.guardian_xp_items SET name = 'Großes Erfahrung-Elixier' WHERE id = 'xp_pot_l';
