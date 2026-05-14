-- ══════════════════════════════════════════════════════════════════════════
-- 00363_quest_seeds.sql — Initial-Befüllung der quests-Tabelle.
--
-- WICHTIG: KEINE Runner-Quests (Walking/Segments). Das Runner-Konzept ist
-- in eine eigene App ausgelagert und das Schema im `runner_legacy`-Bereich
-- archiviert (siehe Memory `project_myarea365_pivot`). MyArea365 ist der
-- RoK/CoD-Klon — Quests drehen sich um Marsch, Truppen-Training, Crew-Help,
-- Forschung, Arena, Rekrutierung etc.
--
-- 10 Hauptquests (Chapter 1: Onboarding) als Kette via prereq_quest_code
-- 15 Nebenquests (Side-Pool, immer sichtbar)
-- 8  Daily-Quests
-- 4  Weekly-Quests
-- 3  Seasonal-Quests
--
-- target_metric-Konventionen (verkabelt in bump_quest_progress-Aufrufen):
--   troops_trained       → Truppe trainiert
--   marches_started      → Marsch gestartet (gather/start, base/marches)
--   crew_help_given      → Crew-Bau geholfen
--   research_started     → Forschung gestartet
--   recruit_pulls        → Rekrutierungs-Pull (chest_bronze/silver/gold)
--   arena_wins           → Arena-Kampf gewonnen
--   resource_nodes_looted→ Resource-Node geplündert
--   chests_opened        → Truhe geöffnet
--   silver_chests_opened → Silber-Truhe geöffnet
--   rallies_joined       → Rallye beigetreten
--   base_level           → Profilbild-Stufe (Set-Pattern, kein Bump)
--   login_days           → Login-Tag
--   buildings_upgraded   → Build/Upgrade gestartet
-- ══════════════════════════════════════════════════════════════════════════

insert into public.quests (code, kind, chapter, sort_order, name, description, icon, target_metric, target_value, prereq_quest_code, goto_route, rewards) values
  ('main_ch1_first_train',        'main', 1, 10, 'Erste Truppen',           'Trainiere deine ersten 10 Truppen in der Kaserne',                  '🛡️', 'troops_trained',      10, null,                          '/karte', '[{"kind":"gems","amount":50},{"kind":"xp","amount":200}]'),
  ('main_ch1_base_level_2',       'main', 1, 20, 'Stütze ausbauen',         'Bringe dein Profilbild auf Stufe 2',                                 '🏗️', 'base_level',           2, 'main_ch1_first_train',        '/karte', '[{"kind":"gems","amount":75},{"kind":"wood","amount":2000},{"kind":"stone","amount":2000}]'),
  ('main_ch1_first_march',        'main', 1, 30, 'Erster Marsch',           'Schicke deinen ersten Trupp auf einen Marsch',                       '⚔️', 'marches_started',      1, 'main_ch1_base_level_2',       '/karte', '[{"kind":"gems","amount":75},{"kind":"speed_token","amount":1},{"kind":"xp","amount":300}]'),
  ('main_ch1_first_recruit',      'main', 1, 40, 'Erste Rekrutierung',      'Rekrutiere deinen ersten Wächter aus einer Bronze-Truhe',            '👤', 'recruit_pulls',        1, 'main_ch1_first_march',        '/karte', '[{"kind":"gems","amount":100},{"kind":"item","code":"chest_silver","amount":1}]'),
  ('main_ch1_first_research',     'main', 1, 50, 'Wissen ist Macht',        'Starte deine erste Forschung in der Akademie',                       '🔬', 'research_started',     1, 'main_ch1_first_recruit',      '/karte', '[{"kind":"gems","amount":100},{"kind":"mana","amount":3000},{"kind":"xp","amount":500}]'),
  ('main_ch1_first_crew_help',    'main', 1, 60, 'Schulter an Schulter',    'Hilf einer Crew-Bauanfrage zum ersten Mal',                          '🤝', 'crew_help_given',      1, 'main_ch1_first_research',     '/karte', '[{"kind":"gems","amount":100},{"kind":"gold","amount":1500},{"kind":"xp","amount":400}]'),
  ('main_ch1_first_resource',     'main', 1, 70, 'Plünder-Tour',            'Plündere deinen ersten Resource-Node auf der Karte',                  '💎', 'resource_nodes_looted',1, 'main_ch1_first_crew_help',    '/karte', '[{"kind":"gems","amount":125},{"kind":"wood","amount":3000},{"kind":"stone","amount":3000}]'),
  ('main_ch1_first_arena',        'main', 1, 80, 'Arena-Debüt',             'Gewinne deinen ersten Wächter-Kampf in der Arena',                   '🏛️', 'arena_wins',           1, 'main_ch1_first_resource',     '/karte', '[{"kind":"gems","amount":150},{"kind":"item","code":"xp_pot_m","amount":3},{"kind":"xp","amount":600}]'),
  ('main_ch1_first_rally',        'main', 1, 90, 'Im Rudel stark',          'Schließe dich einer Crew-Rallye an',                                  '🚩', 'rallies_joined',       1, 'main_ch1_first_arena',        '/karte', '[{"kind":"gems","amount":200},{"kind":"speed_token","amount":2},{"kind":"gold","amount":3000}]'),
  ('main_ch1_first_chest',        'main', 1,100, 'Erste Truhe geknackt',    'Öffne deine erste Truhe und sichere die Beute',                       '🎁', 'chests_opened',        1, 'main_ch1_first_rally',        '/karte', '[{"kind":"gems","amount":300},{"kind":"item","code":"chest_gold","amount":1},{"kind":"xp","amount":1000}]')
on conflict (code) do update set
  name = excluded.name, description = excluded.description, icon = excluded.icon,
  target_metric = excluded.target_metric, target_value = excluded.target_value,
  rewards = excluded.rewards, goto_route = excluded.goto_route,
  prereq_quest_code = excluded.prereq_quest_code, updated_at = now();

insert into public.quests (code, kind, chapter, sort_order, name, description, icon, target_metric, target_value, goto_route, rewards) values
  ('side_marches_100',         'side', 1,  10, 'Marsch-Veteran',       'Starte 100 Märsche von deiner Basis',                                '🗺️', 'marches_started',     100, '/karte', '[{"kind":"gems","amount":100},{"kind":"speed_token","amount":5}]'),
  ('side_resource_nodes_100',  'side', 1,  20, 'Plünder-Profi',        'Plündere 100 Resource-Nodes',                                         '💎', 'resource_nodes_looted',100, '/karte', '[{"kind":"gems","amount":250},{"kind":"item","code":"chest_silver","amount":2}]'),
  ('side_base_level_5',        'side', 1,  30, 'Solides Fundament',    'Bringe dein Profilbild auf Stufe 5',                                  '🏠', 'base_level',            5, '/karte', '[{"kind":"gems","amount":150},{"kind":"wood","amount":10000},{"kind":"stone","amount":10000}]'),
  ('side_base_level_10',       'side', 1,  31, 'Festung der Stadt',    'Bringe dein Profilbild auf Stufe 10',                                 '🏯', 'base_level',           10, '/karte', '[{"kind":"gems","amount":300},{"kind":"item","code":"chest_gold","amount":1}]'),
  ('side_crew_help_50',        'side', 1,  40, 'Helfender Geist',      'Hilf 50 Crew-Bauanfragen',                                            '🤝', 'crew_help_given',      50, '/karte', '[{"kind":"gems","amount":150},{"kind":"gold","amount":15000}]'),
  ('side_marches_25',          'side', 1,  50, 'Feldzug-Logistiker',   'Starte 25 Märsche',                                                   '⚔️', 'marches_started',      25, '/karte', '[{"kind":"gems","amount":125},{"kind":"speed_token","amount":3}]'),
  ('side_recruit_30_pulls',    'side', 1,  60, 'Talent-Scout',         'Mache 30 Rekrutierungs-Pulls',                                        '👥', 'recruit_pulls',        30, '/karte', '[{"kind":"gems","amount":200},{"kind":"item","code":"chest_gold","amount":2}]'),
  ('side_arena_50_wins',       'side', 1,  70, 'Arena-Veteran',        'Gewinne 50 Arena-Kämpfe',                                             '🏆', 'arena_wins',           50, '/karte', '[{"kind":"gems","amount":250},{"kind":"item","code":"xp_pot_l","amount":3}]'),
  ('side_chests_open_100',     'side', 1,  80, 'Schatzjäger',          'Öffne 100 Truhen',                                                    '🎁', 'chests_opened',       100, '/karte', '[{"kind":"gems","amount":200},{"kind":"item","code":"chest_silver","amount":5}]'),
  ('side_resource_nodes_50',   'side', 1,  90, 'Karten-Plünderer',     'Plündere 50 Resource-Nodes',                                          '💎', 'resource_nodes_looted',50, '/karte', '[{"kind":"gems","amount":175},{"kind":"wood","amount":20000},{"kind":"stone","amount":20000}]'),
  ('side_research_finish_10',  'side', 1, 100, 'Gelehrter',            'Schließe 10 Forschungen ab',                                          '🔬', 'research_started',     10, '/karte', '[{"kind":"gems","amount":150},{"kind":"mana","amount":10000}]'),
  ('side_troops_train_1000',   'side', 1, 110, 'Ausbilder',            'Trainiere 1000 Truppen',                                              '🛡️', 'troops_trained',     1000, '/karte', '[{"kind":"gems","amount":200},{"kind":"speed_token","amount":5}]'),
  ('side_login_30_days',       'side', 1, 120, 'Treue zahlt sich aus', 'Logge dich 30 Tage in Folge ein',                                     '📅', 'login_days',           30, '/karte', '[{"kind":"gems","amount":400},{"kind":"item","code":"chest_gold","amount":2}]'),
  ('side_buildings_upgraded',  'side', 1, 130, 'Master-Baumeister',    'Schließe 50 Gebäude-Upgrades ab',                                     '🔨', 'buildings_upgraded',   50, '/karte', '[{"kind":"gems","amount":200},{"kind":"wood","amount":25000},{"kind":"stone","amount":25000}]'),
  ('side_chests_silver_25',    'side', 1, 140, 'Silber-Magnet',        'Öffne 25 Silber-Truhen',                                              '🥈', 'silver_chests_opened', 25, '/karte', '[{"kind":"gems","amount":180},{"kind":"item","code":"chest_gold","amount":1}]')
on conflict (code) do update set
  name = excluded.name, description = excluded.description, icon = excluded.icon,
  target_metric = excluded.target_metric, target_value = excluded.target_value,
  rewards = excluded.rewards, goto_route = excluded.goto_route, updated_at = now();

insert into public.quests (code, kind, chapter, sort_order, name, description, icon, target_metric, target_value, goto_route, rewards) values
  ('daily_login',              'daily', 1, 10, 'Anmelden',             'Logge dich heute ein',                                                '☀️', 'login_days',           1, '/karte', '[{"kind":"gems","amount":15},{"kind":"wood","amount":1000},{"kind":"stone","amount":1000}]'),
  ('daily_train_50_troops',    'daily', 1, 20, 'Tages-Ausbildung',     'Trainiere heute 50 Truppen',                                          '🛡️', 'troops_trained',      50, '/karte', '[{"kind":"gems","amount":20},{"kind":"wood","amount":1500},{"kind":"xp","amount":150}]'),
  ('daily_march_1',            'daily', 1, 30, 'Auf Tour',             'Starte heute mindestens 1 Marsch',                                    '⚔️', 'marches_started',      1, '/karte', '[{"kind":"gems","amount":15},{"kind":"speed_token","amount":1}]'),
  ('daily_crew_help_3',        'daily', 1, 40, 'Crew-Schulter',        'Hilf 3 Crew-Bauanfragen heute',                                       '🤝', 'crew_help_given',      3, '/karte', '[{"kind":"gems","amount":20},{"kind":"gold","amount":1500}]'),
  ('daily_arena_1_win',        'daily', 1, 50, 'Tages-Arena',          'Gewinne heute mindestens 1 Arena-Kampf',                              '🏛️', 'arena_wins',           1, '/karte', '[{"kind":"gems","amount":25},{"kind":"item","code":"xp_pot_s","amount":2}]'),
  ('daily_recruit_pull_1',     'daily', 1, 60, 'Talent-Suche',         'Mache 1 Rekrutierungs-Pull heute',                                    '👥', 'recruit_pulls',        1, '/karte', '[{"kind":"gems","amount":15},{"kind":"mana","amount":1000}]'),
  ('daily_open_chest_1',       'daily', 1, 70, 'Tages-Truhe',          'Öffne heute mindestens 1 Truhe',                                      '🎁', 'chests_opened',        1, '/karte', '[{"kind":"gems","amount":15},{"kind":"gold","amount":1500}]'),
  ('daily_resource_node_1',    'daily', 1, 80, 'Tages-Plünderung',     'Plündere heute 1 Resource-Node',                                      '💎', 'resource_nodes_looted',1, '/karte', '[{"kind":"gems","amount":20},{"kind":"wood","amount":2000},{"kind":"stone","amount":2000}]')
on conflict (code) do update set
  name = excluded.name, description = excluded.description, icon = excluded.icon,
  target_metric = excluded.target_metric, target_value = excluded.target_value,
  rewards = excluded.rewards, goto_route = excluded.goto_route, updated_at = now();

insert into public.quests (code, kind, chapter, sort_order, name, description, icon, target_metric, target_value, goto_route, rewards) values
  ('weekly_train_500_troops',  'weekly', 1, 10, 'Wochen-Ausbilder',    'Trainiere 500 Truppen diese Woche',                                   '🛡️', 'troops_trained',     500, '/karte', '[{"kind":"gems","amount":100},{"kind":"wood","amount":8000},{"kind":"stone","amount":8000}]'),
  ('weekly_arena_10_wins',     'weekly', 1, 20, 'Arena-Woche',         'Gewinne 10 Arena-Kämpfe diese Woche',                                 '🏆', 'arena_wins',          10, '/karte', '[{"kind":"gems","amount":125},{"kind":"item","code":"chest_silver","amount":3}]'),
  ('weekly_crew_help_15',      'weekly', 1, 30, 'Crew-Helfer-Woche',   'Hilf 15 Crew-Bauanfragen diese Woche',                                '🤝', 'crew_help_given',     15, '/karte', '[{"kind":"gems","amount":100},{"kind":"gold","amount":8000}]'),
  ('weekly_marches_10',        'weekly', 1, 40, 'Feldzug-Woche',       'Starte 10 Märsche diese Woche',                                       '⚔️', 'marches_started',     10, '/karte', '[{"kind":"gems","amount":90},{"kind":"speed_token","amount":2}]')
on conflict (code) do update set
  name = excluded.name, description = excluded.description, icon = excluded.icon,
  target_metric = excluded.target_metric, target_value = excluded.target_value,
  rewards = excluded.rewards, goto_route = excluded.goto_route, updated_at = now();

insert into public.quests (code, kind, chapter, sort_order, name, description, icon, target_metric, target_value, goto_route, rewards) values
  ('seasonal_marches_500',     'seasonal', 1, 10, 'Vermächtnis der Feldzüge', 'Starte 500 Märsche diese Saison',                          '🌆', 'marches_started',    500, '/karte', '[{"kind":"gems","amount":1500},{"kind":"item","code":"chest_gold","amount":5},{"kind":"xp","amount":10000}]'),
  ('seasonal_arena_500_wins',  'seasonal', 1, 20, 'Vermächtnis der Arena',    'Gewinne 500 Arena-Kämpfe diese Saison',                     '🏟️', 'arena_wins',         500, '/karte', '[{"kind":"gems","amount":1200},{"kind":"item","code":"chest_gold","amount":4}]'),
  ('seasonal_base_level_25',   'seasonal', 1, 30, 'Vermächtnis der Festung',  'Bringe dein Profilbild auf Stufe 25',                       '🏰', 'base_level',          25, '/karte', '[{"kind":"gems","amount":2000},{"kind":"speed_token","amount":10},{"kind":"item","code":"chest_gold","amount":3}]')
on conflict (code) do update set
  name = excluded.name, description = excluded.description, icon = excluded.icon,
  target_metric = excluded.target_metric, target_value = excluded.target_value,
  rewards = excluded.rewards, goto_route = excluded.goto_route, updated_at = now();
