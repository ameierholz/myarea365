-- 00302_artwork_slots_playstyle.sql
--
-- 4 Spielstil-Slots ergänzen (architect/warlord/strategist/diplomat).
-- Spielstile werden im Onboarding (/registrieren) gewählt und geben dem
-- Spieler globale Soft-Buffs. Sie haben aktuell nur Emoji-Icons (🏗️/⚔️/🧠/🤝)
-- — der Artwork-Slot erlaubt KI-Prompt-Generierung + Upload.

BEGIN;

-- Constraint erweitern: category 'playstyle' zulassen
ALTER TABLE ui_icon_slots DROP CONSTRAINT ui_icon_slots_category_check;
ALTER TABLE ui_icon_slots ADD CONSTRAINT ui_icon_slots_category_check
  CHECK (category = ANY (ARRAY['stat','class','action','badge','misc','quick','crew_tab','building','silhouette','karte_base','trophy','faction','playstyle']));

INSERT INTO ui_icon_slots (id, category, name, description, fallback_emoji, sort) VALUES
  ('playstyle_architect',  'playstyle', 'Architekt',  'Spielstil-Icon Architekt (Wirtschaft/Aufbau, −5% Bauzeit, +5% Yield)',           '🏗️', 40),
  ('playstyle_warlord',    'playstyle', 'Warlord',    'Spielstil-Icon Warlord (Krieg/Eroberung, +5% Truppen-Damage, +5% Plünder-Beute)', '⚔️', 41),
  ('playstyle_strategist', 'playstyle', 'Stratege',   'Spielstil-Icon Stratege (Forschung/Spionage, −5% Forschungszeit, gratis Spion)',  '🧠', 42),
  ('playstyle_diplomat',   'playstyle', 'Diplomat',   'Spielstil-Icon Diplomat (Crew/Allianzen, +10% Spenden-Wert, stärkere Don-Aura)',  '🤝', 43)
ON CONFLICT (id) DO NOTHING;

COMMIT;
