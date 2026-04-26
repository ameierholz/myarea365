-- ══════════════════════════════════════════════════════════════════════════
-- TRUPPEN T1-T5 (4 Klassen × 5 Tiers = 20 Truppen)
-- Plus zugehörige Trainings-Gebäude (Kaserne/Stall/Schießstand/Belagerung)
-- ══════════════════════════════════════════════════════════════════════════

alter table public.troops_catalog
  drop constraint if exists troops_catalog_tier_check;
alter table public.troops_catalog
  add constraint troops_catalog_tier_check check (tier between 1 and 5);

-- ─── Trainings-Gebäude (falls nicht schon im Katalog) ──────────────────────
insert into public.buildings_catalog
  (id, name, emoji, description, category, scope, max_level,
   base_cost_wood, base_cost_stone, base_cost_gold, base_cost_mana,
   base_buildtime_minutes, buildtime_growth, effect_key, effect_per_level,
   required_base_level, sort)
values
  ('kaserne',             'Kaserne',             '🛡️', 'Trainiert Infanterie. Höhere Stufen = höhere Tiers + mehr Truppen pro Auftrag.',         'combat', 'solo', 25,
    300, 400, 80,   0, 25, 1.50, 'troops_per_train', 10, 2, 11),
  ('stall',               'Stall',               '🐎', 'Trainiert Kavallerie. Höhere Stufen = höhere Tiers + mehr Truppen pro Auftrag.',          'combat', 'solo', 25,
    400, 300, 100,  0, 30, 1.50, 'troops_per_train', 10, 3, 12),
  ('schiessstand',        'Schießstand',         '🏹', 'Trainiert Schützen. Höhere Stufen = höhere Tiers + mehr Truppen pro Auftrag.',           'combat', 'solo', 25,
    350, 350, 90,   0, 30, 1.50, 'troops_per_train', 10, 4, 13),
  ('belagerungsschuppen', 'Belagerungs-Schuppen','⚙️', 'Baut Belagerungswaffen. Höhere Stufen = höhere Tiers + mehr Geschosse pro Auftrag.',     'combat', 'solo', 25,
    500, 600, 200, 50, 45, 1.55, 'troops_per_train', 5,  6, 14)
on conflict (id) do update set
  name = excluded.name, emoji = excluded.emoji, description = excluded.description,
  category = excluded.category, scope = excluded.scope, max_level = excluded.max_level,
  base_cost_wood = excluded.base_cost_wood, base_cost_stone = excluded.base_cost_stone,
  base_cost_gold = excluded.base_cost_gold, base_cost_mana = excluded.base_cost_mana,
  base_buildtime_minutes = excluded.base_buildtime_minutes,
  buildtime_growth = excluded.buildtime_growth,
  effect_key = excluded.effect_key, effect_per_level = excluded.effect_per_level,
  required_base_level = excluded.required_base_level, sort = excluded.sort;

-- ─── 20 Truppen (4 Klassen × T1..T5). T1=Lv1 · T2=Lv5 · T3=Lv10 · T4=Lv15 · T5=Lv20 ─
delete from public.troops_catalog
 where id in (
   'inf_t1','inf_t2','inf_t3','inf_t4','inf_t5',
   'cav_t1','cav_t2','cav_t3','cav_t4','cav_t5',
   'mks_t1','mks_t2','mks_t3','mks_t4','mks_t5',
   'sg_t1', 'sg_t2', 'sg_t3', 'sg_t4', 'sg_t5'
 );

insert into public.troops_catalog
  (id, name, emoji, troop_class, tier, base_atk, base_def, base_hp,
   cost_wood, cost_stone, cost_gold, cost_mana, train_time_seconds,
   required_building_level, description)
values
  -- ═══ Infanterie ═══════════════════════════════════════════
  ('inf_t1','Stadt-Wache',      '🛡️','infantry',1, 10,  16,  30,   30,  20,   5,   0,   30,  1, 'Solide Frontlinie. Verfügbar ab Kaserne Lv 1.'),
  ('inf_t2','Speerträger',      '🛡️','infantry',2, 18,  28,  55,   60,  40,  10,   0,   75,  5, 'Robuster gegen Kavallerie.'),
  ('inf_t3','Stadt-Garde',      '🛡️','infantry',3, 30,  46,  95,  120,  80,  20,   0,  150, 10, 'Veteranen mit besserer Rüstung.'),
  ('inf_t4','Wache-Champion',   '🛡️','infantry',4, 50,  78, 165,  240, 160,  40,  10,  300, 15, 'Schwere Plattenrüstung, Schildwall.'),
  ('inf_t5','Wächter-Held',     '🛡️','infantry',5, 85, 130, 280,  480, 320,  80,  20,  600, 20, 'Legendärer Verteidiger der Base.'),

  -- ═══ Kavallerie ═══════════════════════════════════════════
  ('cav_t1','Späher-Reiter',    '🐎','cavalry',1, 14,  10,  25,   35,  25,  10,   0,   40,  1, 'Schnell. Verfügbar ab Stall Lv 1.'),
  ('cav_t2','Leichte Kavallerie','🐎','cavalry',2, 26,  18,  45,   70,  50,  20,   0,   95,  5, 'Hit-and-Run-Spezialist.'),
  ('cav_t3','Lanzenreiter',     '🐎','cavalry',3, 42,  32,  75,  140, 100,  40,   0,  180, 10, 'Bricht Infanterie-Linien.'),
  ('cav_t4','Schwere Reiterei', '🐎','cavalry',4, 70,  54, 125,  280, 200,  80,  20,  360, 15, 'Plattenrüstung + Streitross.'),
  ('cav_t5','Ritterordens-Held','🐎','cavalry',5,120,  90, 215,  560, 400, 160,  40,  720, 20, 'Charge der Königsritter.'),

  -- ═══ Schützen ═════════════════════════════════════════════
  ('mks_t1','Stadtschütze',     '🏹','marksman',1, 16,   6,  20,   25,  30,   8,   0,   35,  1, 'Reichweite. Verfügbar ab Schießstand Lv 1.'),
  ('mks_t2','Bogenschütze',     '🏹','marksman',2, 30,  12,  35,   50,  60,  16,   0,   80,  5, 'Präzise auf mittlere Distanz.'),
  ('mks_t3','Armbrustschütze',  '🏹','marksman',3, 50,  22,  60,  100, 120,  32,   0,  160, 10, 'Durchschlagskraft gegen Rüstung.'),
  ('mks_t4','Scharfschütze',    '🏹','marksman',4, 84,  36, 100,  200, 240,  64,  16,  320, 15, 'Eliminiert Anführer aus der Distanz.'),
  ('mks_t5','Meister-Schütze',  '🏹','marksman',5,144,  60, 175,  400, 480, 128,  32,  640, 20, 'Legendäre Treffsicherheit.'),

  -- ═══ Belagerung ═══════════════════════════════════════════
  ('sg_t1','Wurfgeschoss',      '⚙️','siege',1,  40,   8,  40,   60,  80,  20,   0,  120,  1, 'Bricht Truppen-Stacks. Verfügbar ab Belagerungs-Schuppen Lv 1.'),
  ('sg_t2','Steinschleuder',    '⚙️','siege',2,  72,  16,  70,  120, 160,  40,   0,  240,  5, 'Reicher Flächenschaden.'),
  ('sg_t3','Katapult',          '⚙️','siege',3, 124,  28, 120,  240, 320,  80,  20,  480, 10, 'Klassischer Mauerbrecher.'),
  ('sg_t4','Trebuchet',         '⚙️','siege',4, 210,  48, 200,  480, 640, 160,  40,  900, 15, 'Verheerend gegen Bauwerke.'),
  ('sg_t5','Belagerungs-Titan', '⚙️','siege',5, 360,  82, 340,  960,1280, 320,  80, 1440, 20, 'Legendäres Belagerungsgerät.')
on conflict (id) do update set
  name = excluded.name, emoji = excluded.emoji, troop_class = excluded.troop_class, tier = excluded.tier,
  base_atk = excluded.base_atk, base_def = excluded.base_def, base_hp = excluded.base_hp,
  cost_wood = excluded.cost_wood, cost_stone = excluded.cost_stone,
  cost_gold = excluded.cost_gold, cost_mana = excluded.cost_mana,
  train_time_seconds = excluded.train_time_seconds,
  required_building_level = excluded.required_building_level, description = excluded.description;
