-- 00322_fix_athe_damage_type.sql
-- Aisha „Sky" Demir ist Schütze (marksman) und Drohnen-Pilotin, nicht magisch.
-- "Magie-Schaden" stammt aus ihrer alten Mage-Klassifizierung (vor Mig 00320)
-- und passt nicht zum urban-cyber Bandidaten-Konzept.

BEGIN;
UPDATE public.guardian_archetypes
SET ability_desc = 'Schickt einen Drohnen-Schwarm aus der Luft auf einen Punkt — 280% Flächen-Schaden in einem Radius. Verlangsamt Gegner um 20% für 4 Sekunden.'
WHERE id = 'gs1_athe';
COMMIT;
