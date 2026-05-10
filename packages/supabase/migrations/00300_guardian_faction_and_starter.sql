-- 00300_guardian_faction_and_starter.sql
--
-- Wächter-Fraktion-Wahl beim Onboarding (separat vom Spielstil)
-- + Mapping-Tabelle für Start-Wächter pro Fraktion
-- + RPC grant_starter_guardian — gibt Spieler den passenden Start-Wächter
--
-- Konzept (User 2026-05-12):
--   "wir haben einen Spielstil den der Spieler wählt um Spielerbuff zu erhalten
--    dann haben wir Fraktionen die dem Wächter buffs geben für Kämpfe
--    Jeder Spieler wählt am Anfang einen Stile und eine Fraktion
--    je nach Fraktionswahl bekommt er einen festen Wächter"
--
-- users.faction          → Spielstil (architect/warlord/strategist/diplomat) — bleibt
-- users.guardian_faction → Wächter-Fraktion (gossenbund/kronenwacht/netzhueter) — neu

BEGIN;

-- 1) Neue Spalte
ALTER TABLE users ADD COLUMN IF NOT EXISTS guardian_faction text
  CHECK (guardian_faction IS NULL OR guardian_faction IN ('gossenbund','kronenwacht','netzhueter'));

CREATE INDEX IF NOT EXISTS idx_users_guardian_faction ON users(guardian_faction);

-- 2) Starter-Mapping-Tabelle
CREATE TABLE IF NOT EXISTS faction_starter_guardian (
  faction text PRIMARY KEY
    CHECK (faction IN ('gossenbund','kronenwacht','netzhueter')),
  archetype_id text NOT NULL REFERENCES guardian_archetypes(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3) Seed-Mapping (W1-Wächter, je 1 pro Fraktion, verschiedene Typen)
INSERT INTO faction_starter_guardian (faction, archetype_id) VALUES
  ('gossenbund',  'gs1_bakhar'),    -- Bakhar-Gossenherr (epic infantry)
  ('kronenwacht', 'gs1_lootbot7'),  -- Sammel-Bot Mk7 (advanced collector)
  ('netzhueter',  'gs1_tarq')       -- Tarq-Datenschütze (elite marksman)
ON CONFLICT (faction) DO UPDATE SET archetype_id = EXCLUDED.archetype_id;

-- 4) RPC: grant_starter_guardian()
--    Liest aktuellen User → schaut guardian_faction → mappt auf archetype_id
--    → INSERT user_guardians falls noch nicht vorhanden
--    → setzt is_active = true falls Spieler noch keinen aktiven Wächter hat
CREATE OR REPLACE FUNCTION grant_starter_guardian()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_faction text;
  v_archetype_id text;
  v_existing_guardian_id uuid;
  v_new_guardian_id uuid;
  v_has_active boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT guardian_faction INTO v_faction FROM users WHERE id = v_user_id;
  IF v_faction IS NULL THEN
    RETURN jsonb_build_object('error', 'no_faction_chosen');
  END IF;

  SELECT archetype_id INTO v_archetype_id
    FROM faction_starter_guardian WHERE faction = v_faction;
  IF v_archetype_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_starter_for_faction', 'faction', v_faction);
  END IF;

  -- Prüfen ob Spieler diesen Wächter schon hat
  SELECT id INTO v_existing_guardian_id
    FROM user_guardians
    WHERE user_id = v_user_id AND archetype_id = v_archetype_id
    LIMIT 1;

  IF v_existing_guardian_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'guardian_id', v_existing_guardian_id,
      'archetype_id', v_archetype_id,
      'created', false
    );
  END IF;

  -- Hat der Spieler überhaupt einen aktiven Wächter?
  SELECT EXISTS (
    SELECT 1 FROM user_guardians WHERE user_id = v_user_id AND is_active = true
  ) INTO v_has_active;

  -- Wächter anlegen (aktiv setzen falls noch keiner aktiv)
  INSERT INTO user_guardians (user_id, archetype_id, is_active, level)
  VALUES (v_user_id, v_archetype_id, NOT v_has_active, 1)
  RETURNING id INTO v_new_guardian_id;

  RETURN jsonb_build_object(
    'ok', true,
    'guardian_id', v_new_guardian_id,
    'archetype_id', v_archetype_id,
    'created', true,
    'is_active', NOT v_has_active
  );
END;
$$;

REVOKE ALL ON FUNCTION grant_starter_guardian() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION grant_starter_guardian() TO authenticated;

COMMIT;
