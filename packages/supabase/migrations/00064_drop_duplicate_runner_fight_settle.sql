-- Zwei Overloads von runner_fight_settle haben sich überlappt:
--   runner_fight_settle(..., p_seed bigint, ...)
--   runner_fight_settle(..., p_seed text,   ...)
-- PostgREST/PostgreSQL konnte den richtigen Kandidaten nicht bestimmen
-- ("Could not choose the best candidate function between ..."), daher
-- beim POST /api/runner-fights/attack Fehler zurück an den Client.
--
-- Der App-Code erzeugt einen text-Seed (`rf:${user.id}:${defender.user_id}:${Date.now()}`),
-- wir behalten also die text-Variante und entfernen die bigint-Variante.

DROP FUNCTION IF EXISTS public.runner_fight_settle(uuid, uuid, uuid, uuid, uuid, bigint, jsonb, integer);
