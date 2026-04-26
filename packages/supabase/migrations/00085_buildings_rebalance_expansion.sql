-- ══════════════════════════════════════════════════════════════════════════
-- BUILDINGS: Rebalance Boni + Massive Erweiterung des Katalogs
-- ══════════════════════════════════════════════════════════════════════════
-- 1) Bestehende effect_per_level halbiert (waren mit +20%/Lv zu stark
--    bei max_level 10 = +200% End-Bonus — neu: +10%/Lv = +100% Endgame).
-- 2) Neue Solo-Buildings (Produktion / Lager / Kampf / Utility / Wirtschaft).
-- 3) Neue Crew-Buildings (Allianz-Zentrum, Späher, Hospital usw. — Inspiration RoK/CoD).
-- ══════════════════════════════════════════════════════════════════════════

-- ─── 1) Rebalance bestehender Buildings ──────────────────────────────────
update public.buildings_catalog set effect_per_level = 0.10 where id = 'wegekasse';       -- war 0.20
update public.buildings_catalog set effect_per_level = 0.05 where id = 'wald_pfad';       -- war 0.10
update public.buildings_catalog set effect_per_level = 0.03 where id = 'waechter_halle';  -- war 0.05
update public.buildings_catalog set effect_per_level = 0.30 where id = 'laufturm';        -- 0.50 → 0.30 km/Lv
update public.buildings_catalog set effect_per_level = 0.08 where id = 'lagerhalle';      -- war 0.15
update public.buildings_catalog set effect_per_level = 0.05 where id = 'schmiede';        -- war 0.10
update public.buildings_catalog set effect_per_level = 0.05 where id = 'gasthaus';        -- war 0.10
update public.buildings_catalog set effect_per_level = 0.05 where id = 'wachturm';        -- war 0.10
-- Crew-Stubs ebenfalls etwas runter:
update public.buildings_catalog set effect_per_level = 0.03 where id = 'crew_treffpunkt'; -- war 0.05
update public.buildings_catalog set effect_per_level = 0.05 where id = 'truhenkammer';    -- war 0.10
update public.buildings_catalog set effect_per_level = 0.03 where id = 'arena_halle';     -- war 0.05
update public.buildings_catalog set effect_per_level = 0.05 where id = 'mana_quell';      -- war 0.10

-- ─── 2) Neue Solo-Buildings ──────────────────────────────────────────────
insert into public.buildings_catalog
  (id, name, emoji, description, category, scope, max_level,
   base_cost_wood, base_cost_stone, base_cost_gold, base_cost_mana,
   base_buildtime_minutes, effect_key, effect_per_level, required_base_level, sort)
values
  -- ═══ Produktion (basis-Resourcen-Buildings, RoK-Style) ═══
  ('saegewerk',     'Sägewerk',      '🪓', 'Passive Holz-Produktion pro Stunde — auch ohne Laufen.',                                'production', 'solo', 10,
    100,  50,  10,   0,  10, 'wood_per_hour',           5.0,  1, 20),
  ('steinbruch',    'Steinbruch',    '⛏️', 'Passive Stein-Produktion pro Stunde — auch ohne Laufen.',                              'production', 'solo', 10,
     50, 100,  10,   0,  10, 'stone_per_hour',          5.0,  1, 21),
  ('goldmine',      'Goldmine',      '💰', 'Passive Gold-Produktion pro Stunde.',                                                  'production', 'solo', 10,
    100, 100,  20,   0,  15, 'gold_per_hour',           4.0,  2, 22),
  ('mana_quelle',   'Mana-Quelle',   '🌊', 'Passive Mana-Produktion pro Stunde.',                                                  'production', 'solo', 10,
    100, 100,  30,  20,  15, 'mana_per_hour',           3.0,  2, 23),

  -- ═══ Lager (Resource-Caps + Verluste-Schutz) ═══
  ('tresorraum',    'Tresorraum',    '🏛️', 'Resourcen-Cap geschützt vor Crew-Angriffen (verlieren-Schutz).',                       'storage',    'solo', 10,
    300, 300,  50,   0,  20, 'safe_storage_pct',        0.10, 3, 30),
  ('kornkammer',    'Kornkammer',    '🌾', 'Erhöht das Holz-Lager-Cap zusätzlich pro Stufe.',                                       'storage',    'solo', 10,
    150,  80,   0,   0,  10, 'wood_storage_pct',        0.20, 1, 31),
  ('mauerwerk',     'Mauerwerk',     '🧱', 'Erhöht das Stein-Lager-Cap zusätzlich pro Stufe.',                                      'storage',    'solo', 10,
     80, 150,   0,   0,  10, 'stone_storage_pct',       0.20, 1, 32),

  -- ═══ Kampf (defensive + offensive Buildings) ═══
  ('hospital',      'Hospital',      '🏥', 'Verwundete Wächter regenerieren schneller nach Niederlagen.',                          'combat',     'solo', 10,
    200, 150,  50,  20,  20, 'heal_speed_pct',          0.10, 3, 40),
  ('trainingsplatz','Trainings-Platz','🥋', 'Aktive Wächter erhalten Bonus-XP pro abgeschlossenem Kampf.',                          'combat',     'solo', 10,
    150, 150,  30,  10,  15, 'arena_xp_pct',            0.05, 2, 41),
  ('ballistenwerk', 'Ballisten-Werkstatt','🎯', 'Schaltet Belagerungs-Truppen für Crew-Wars frei + erhöht ihre Stärke.',            'combat',     'solo', 10,
    300, 400, 100,  30,  30, 'siege_strength_pct',      0.05, 5, 42),
  ('schwertkampflager','Schwertkämpfer-Lager','⚔️', 'Trainiert Schwertkämpfer schneller + günstiger.',                              'combat',     'solo', 10,
    200, 250,  50,  10,  20, 'melee_train_speed_pct',   0.08, 3, 43),
  ('bogenschuetzenstand','Bogenschützen-Stand','🏹', 'Trainiert Bogenschützen schneller + günstiger.',                              'combat',     'solo', 10,
    250, 150,  50,  10,  20, 'ranged_train_speed_pct',  0.08, 3, 44),

  -- ═══ Utility (Forschung + Info) ═══
  ('akademie',      'Akademie',      '📚', 'Schaltet Forschung frei: dauerhafte Boni über alle Bereiche.',                          'utility',    'solo', 10,
    250, 200,  80,  40,  30, 'research_speed_pct',      0.08, 4, 50),
  ('kloster',       'Kloster',       '⛪', 'Mana-Boost auf alle Magier-Klassen + tägliche Mana-Truhe.',                              'utility',    'solo', 10,
    150, 200,  60, 100,  25, 'mana_per_km_pct',         0.05, 3, 51),
  ('augurstein',    'Augurstein',    '🔮', 'Zeigt Saison-Events + kommende Bosse als Vorhersage.',                                  'utility',    'solo', 10,
    100, 100,  50, 200,  20, 'event_preview_days',      1.0,  4, 52),
  ('schwarzes_brett','Schwarzes Brett','📋', 'Tägliche Quests mit zusätzlichen Belohnungen.',                                        'utility',    'solo', 10,
    100,  50,  20,   0,  10, 'daily_quest_count',       0.5,  2, 53),
  ('halbling_haus', 'Halbling-Haus', '🏚️', 'Fügt zusätzliche Bauwarteschlangen-Slots hinzu (parallel bauen).',                      'utility',    'solo', 10,
    200, 200,  80,  20,  25, 'build_queue_slots',       0.5,  3, 54),

  -- ═══ Wirtschaft / Kosmetisch ═══
  ('basar',         'Basar',         '🛒', 'Tausch-Markt: Resourcen 1:1 zwischen Holz/Stein/Gold/Mana.',                            'utility',    'solo', 10,
    200, 200,  50,  20,  20, 'market_fee_pct',         -0.02, 3, 60),
  ('shop',          'Shop',          '🏪', 'Tägliche Kosmetik-Drops (Marker-Skins, Pin-Themes).',                                   'cosmetic',   'solo', 10,
    150, 100, 100,  50,  20, 'cosmetic_drop_chance',    0.05, 4, 61),
  ('brunnen',       'Brunnen',       '⛲', 'Reine Kosmetik. Erhöht Base-Schönheit (Visitor-Boost).',                                 'cosmetic',   'solo',  5,
    200,  50,  30,  10,  15, 'visitor_attract_pct',     0.10, 2, 62),
  ('statue',        'Heldenstatue',  '🗿', 'Reine Kosmetik. Zeigt deinen aktiven Wächter.',                                          'cosmetic',   'solo',  5,
     50, 200,  50,  10,  20, 'visitor_attract_pct',     0.05, 3, 63)
on conflict (id) do update set
  name = excluded.name, emoji = excluded.emoji, description = excluded.description,
  category = excluded.category, scope = excluded.scope, max_level = excluded.max_level,
  base_cost_wood = excluded.base_cost_wood, base_cost_stone = excluded.base_cost_stone,
  base_cost_gold = excluded.base_cost_gold, base_cost_mana = excluded.base_cost_mana,
  base_buildtime_minutes = excluded.base_buildtime_minutes,
  effect_key = excluded.effect_key, effect_per_level = excluded.effect_per_level,
  required_base_level = excluded.required_base_level, sort = excluded.sort;

-- ─── 3) Neue Crew-Buildings (Allianz-Style) ──────────────────────────────
insert into public.buildings_catalog
  (id, name, emoji, description, category, scope, max_level,
   base_cost_wood, base_cost_stone, base_cost_gold, base_cost_mana,
   base_buildtime_minutes, effect_key, effect_per_level, required_base_level, sort)
values
  ('allianz_zentrum', 'Allianz-Zentrum', '🏛️', 'Schaltet Crew-Hilfe frei: Mitglieder können sich gegenseitig Bauzeit skippen.',    'utility',    'crew', 15,
    600, 600, 150,  50,  40, 'crew_help_speedup_pct',   0.05, 1, 70),
  ('spaeher_wachposten','Späher-Wachposten','👁️', 'Verwaltet Späher-Einheiten: scout fremde Bases + Truppen-Stärke.',              'combat',     'crew', 15,
    400, 500, 100,  30,  35, 'scout_strength_pct',      0.05, 2, 71),
  ('sammel_leuchtfeuer','Sammel-Leuchtfeuer','🔥', 'Sammelt Allianz-Truppen für gemeinsamen Boss-Raid oder Crew-War.',              'combat',     'crew', 15,
    500, 500, 150,  80,  40, 'rally_capacity_pct',      0.10, 3, 72),
  ('crew_taverne',   'Crew-Taverne',   '🍻', 'Rekrutiert legendäre Wächter mit Allianz-Punkten.',                                   'production', 'crew', 15,
    400, 300, 200, 100,  35, 'legendary_recruit_pct',   0.03, 4, 73),
  ('crew_hospital',  'Crew-Hospital',  '🏥', 'Heilt verwundete Truppen aller Mitglieder schneller.',                                'combat',     'crew', 15,
    500, 600, 150,  50,  40, 'crew_heal_speed_pct',     0.08, 3, 74),
  ('crew_akademie',  'Crew-Akademie',  '🎓', 'Allianz-Tech: Forschung wirkt auf alle Mitglieder.',                                  'utility',    'crew', 15,
    700, 600, 300, 200,  60, 'crew_research_pct',       0.05, 5, 75),
  ('tempel_himmlisch','Tempel der Himmlischen','✨', 'Trainiert Himmlische Einheiten (T5 Endgame-Truppen).',                        'combat',     'crew', 15,
   1000,1000, 500, 300,  90, 'celestial_strength_pct',  0.05, 8, 76),
  ('goblin_markt',   'Goblin-Markt',   '👺', 'Verkauft + verschrottet seltene Gegenstände gegen Resourcen.',                         'utility',    'crew', 15,
    300, 300, 100,  50,  30, 'salvage_yield_pct',       0.10, 2, 77)
on conflict (id) do update set
  name = excluded.name, emoji = excluded.emoji, description = excluded.description,
  category = excluded.category, scope = excluded.scope, max_level = excluded.max_level,
  base_cost_wood = excluded.base_cost_wood, base_cost_stone = excluded.base_cost_stone,
  base_cost_gold = excluded.base_cost_gold, base_cost_mana = excluded.base_cost_mana,
  base_buildtime_minutes = excluded.base_buildtime_minutes,
  effect_key = excluded.effect_key, effect_per_level = excluded.effect_per_level,
  required_base_level = excluded.required_base_level, sort = excluded.sort;
