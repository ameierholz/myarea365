-- ─── 00239: Speedups vereinheitlicht — 3 Kategorien × 7 Zeitspannen ───
-- User-Vorgabe: Bauen / Forschung / Universal jeweils
-- 1m / 5m / 15m / 60m / 8h / 12h / 24h. Heil-/Truppen-Speedups raus
-- (waren Mockup-Reste). 30m, 3h, 15h fliegen ebenfalls — saubere Stufen.
--
-- Keine FK-Verluste: 0 user_inventory_items, 0 event_items, 0 JSONB-Refs
-- auf alte IDs (vorher geprüft).

delete from public.inventory_item_catalog where category='speedup' or id like 'speedup_%';

insert into public.inventory_item_catalog (id, category, name, description, emoji, rarity, payload, sort_order, active) values
  -- ─ Bauen ─────────────────────────────────────────────
  ('speedup_build_1m',   'speedup', 'Bau-Speedup (1 Min)',    'Beschleunigt 1× laufenden Bau-Auftrag um 1 Minute.',     '⏱', 'common',    '{"type":"build","minutes":1}'::jsonb,    101, true),
  ('speedup_build_5m',   'speedup', 'Bau-Speedup (5 Min)',    'Beschleunigt 1× laufenden Bau-Auftrag um 5 Minuten.',    '⏱', 'common',    '{"type":"build","minutes":5}'::jsonb,    102, true),
  ('speedup_build_15m',  'speedup', 'Bau-Speedup (15 Min)',   'Beschleunigt 1× laufenden Bau-Auftrag um 15 Minuten.',   '⏱', 'common',    '{"type":"build","minutes":15}'::jsonb,   103, true),
  ('speedup_build_60m',  'speedup', 'Bau-Speedup (1 Std)',    'Beschleunigt 1× laufenden Bau-Auftrag um 1 Stunde.',     '⏱', 'rare',      '{"type":"build","minutes":60}'::jsonb,   104, true),
  ('speedup_build_8h',   'speedup', 'Bau-Speedup (8 Std)',    'Beschleunigt 1× laufenden Bau-Auftrag um 8 Stunden.',    '⏱', 'epic',      '{"type":"build","minutes":480}'::jsonb,  105, true),
  ('speedup_build_12h',  'speedup', 'Bau-Speedup (12 Std)',   'Beschleunigt 1× laufenden Bau-Auftrag um 12 Stunden.',   '⏱', 'epic',      '{"type":"build","minutes":720}'::jsonb,  106, true),
  ('speedup_build_24h',  'speedup', 'Bau-Speedup (24 Std)',   'Beschleunigt 1× laufenden Bau-Auftrag um 24 Stunden.',   '⏱', 'legendary', '{"type":"build","minutes":1440}'::jsonb, 107, true),

  -- ─ Forschung ─────────────────────────────────────────
  ('speedup_research_1m',  'speedup', 'Forschungs-Speedup (1 Min)',  'Beschleunigt 1× laufende Forschung um 1 Minute.',     '🔬', 'common',    '{"type":"research","minutes":1}'::jsonb,    111, true),
  ('speedup_research_5m',  'speedup', 'Forschungs-Speedup (5 Min)',  'Beschleunigt 1× laufende Forschung um 5 Minuten.',    '🔬', 'common',    '{"type":"research","minutes":5}'::jsonb,    112, true),
  ('speedup_research_15m', 'speedup', 'Forschungs-Speedup (15 Min)', 'Beschleunigt 1× laufende Forschung um 15 Minuten.',   '🔬', 'common',    '{"type":"research","minutes":15}'::jsonb,   113, true),
  ('speedup_research_60m', 'speedup', 'Forschungs-Speedup (1 Std)',  'Beschleunigt 1× laufende Forschung um 1 Stunde.',     '🔬', 'rare',      '{"type":"research","minutes":60}'::jsonb,   114, true),
  ('speedup_research_8h',  'speedup', 'Forschungs-Speedup (8 Std)',  'Beschleunigt 1× laufende Forschung um 8 Stunden.',    '🔬', 'epic',      '{"type":"research","minutes":480}'::jsonb,  115, true),
  ('speedup_research_12h', 'speedup', 'Forschungs-Speedup (12 Std)', 'Beschleunigt 1× laufende Forschung um 12 Stunden.',   '🔬', 'epic',      '{"type":"research","minutes":720}'::jsonb,  116, true),
  ('speedup_research_24h', 'speedup', 'Forschungs-Speedup (24 Std)', 'Beschleunigt 1× laufende Forschung um 24 Stunden.',   '🔬', 'legendary', '{"type":"research","minutes":1440}'::jsonb, 117, true),

  -- ─ Universal (Bau + Forschung + Truppen + Heilung) ───
  ('speedup_uni_1m',  'speedup', 'Universal-Speedup (1 Min)',  'Beschleunigt 1× beliebigen Auftrag um 1 Minute.',    '⚡', 'rare',      '{"type":"universal","minutes":1}'::jsonb,    121, true),
  ('speedup_uni_5m',  'speedup', 'Universal-Speedup (5 Min)',  'Beschleunigt 1× beliebigen Auftrag um 5 Minuten.',   '⚡', 'rare',      '{"type":"universal","minutes":5}'::jsonb,    122, true),
  ('speedup_uni_15m', 'speedup', 'Universal-Speedup (15 Min)', 'Beschleunigt 1× beliebigen Auftrag um 15 Minuten.',  '⚡', 'epic',      '{"type":"universal","minutes":15}'::jsonb,   123, true),
  ('speedup_uni_60m', 'speedup', 'Universal-Speedup (1 Std)',  'Beschleunigt 1× beliebigen Auftrag um 1 Stunde.',    '⚡', 'epic',      '{"type":"universal","minutes":60}'::jsonb,   124, true),
  ('speedup_uni_8h',  'speedup', 'Universal-Speedup (8 Std)',  'Beschleunigt 1× beliebigen Auftrag um 8 Stunden.',   '⚡', 'epic',      '{"type":"universal","minutes":480}'::jsonb,  125, true),
  ('speedup_uni_12h', 'speedup', 'Universal-Speedup (12 Std)', 'Beschleunigt 1× beliebigen Auftrag um 12 Stunden.',  '⚡', 'legendary', '{"type":"universal","minutes":720}'::jsonb,  126, true),
  ('speedup_uni_24h', 'speedup', 'Universal-Speedup (24 Std)', 'Beschleunigt 1× beliebigen Auftrag um 24 Stunden.',  '⚡', 'legendary', '{"type":"universal","minutes":1440}'::jsonb, 127, true);
