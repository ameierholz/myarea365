-- ─── 00240: Speedup-Kategorie Heilung ergänzen ───────────────────────
-- 4. Kategorie analog zu Bauen/Forschung/Universal:
-- 1m / 5m / 15m / 1h / 8h / 12h / 24h.

insert into public.inventory_item_catalog (id, category, name, description, emoji, rarity, payload, sort_order, active) values
  ('speedup_heal_1m',  'speedup', 'Heilungs-Speedup (1 Min)',  'Beschleunigt 1× laufende Wächter-Heilung um 1 Minute.',    '❤', 'common',    '{"type":"heal","minutes":1}'::jsonb,    131, true),
  ('speedup_heal_5m',  'speedup', 'Heilungs-Speedup (5 Min)',  'Beschleunigt 1× laufende Wächter-Heilung um 5 Minuten.',   '❤', 'common',    '{"type":"heal","minutes":5}'::jsonb,    132, true),
  ('speedup_heal_15m', 'speedup', 'Heilungs-Speedup (15 Min)', 'Beschleunigt 1× laufende Wächter-Heilung um 15 Minuten.',  '❤', 'common',    '{"type":"heal","minutes":15}'::jsonb,   133, true),
  ('speedup_heal_60m', 'speedup', 'Heilungs-Speedup (1 Std)',  'Beschleunigt 1× laufende Wächter-Heilung um 1 Stunde.',    '❤', 'rare',      '{"type":"heal","minutes":60}'::jsonb,   134, true),
  ('speedup_heal_8h',  'speedup', 'Heilungs-Speedup (8 Std)',  'Beschleunigt 1× laufende Wächter-Heilung um 8 Stunden.',   '❤', 'epic',      '{"type":"heal","minutes":480}'::jsonb,  135, true),
  ('speedup_heal_12h', 'speedup', 'Heilungs-Speedup (12 Std)', 'Beschleunigt 1× laufende Wächter-Heilung um 12 Stunden.',  '❤', 'epic',      '{"type":"heal","minutes":720}'::jsonb,  136, true),
  ('speedup_heal_24h', 'speedup', 'Heilungs-Speedup (24 Std)', 'Beschleunigt 1× laufende Wächter-Heilung um 24 Stunden.',  '❤', 'legendary', '{"type":"heal","minutes":1440}'::jsonb, 137, true);
