-- 24 Ausruestungs-Items: 8 pro Slot (Helm, Ruestung, Amulett) ueber 4 Raritaeten verteilt.

insert into public.item_catalog (id, name, emoji, slot, rarity, bonus_hp, bonus_atk, bonus_def, bonus_spd, lore) values
  ('helm_leder',       'Lederkappe',           '🧢', 'helm',   'common',  0,  0,  5,  3, 'Mehr als nichts. Knapp.'),
  ('helm_stoff',       'Stoffmütze',           '🎩', 'helm',   'common',  3,  0,  3,  5, 'Leicht, warm, nützlich.'),
  ('helm_eisen',       'Eisenhelm',            '⛑️', 'helm',   'rare',    5,  0, 12,  0, 'Schwer, aber trägt sich.'),
  ('helm_spaeher',     'Späherband',           '🎯', 'helm',   'rare',    0,  5,  3, 10, 'Scharfe Sinne, scharfer Blick.'),
  ('helm_stahl',       'Stahlvisier',          '🛡️', 'helm',   'epic',   10,  0, 18,  0, 'Nichts kommt durch.'),
  ('helm_fokus',       'Fokuscirclet',         '💠', 'helm',   'epic',    0, 15,  5,  8, 'Gedanken wie Klingen.'),
  ('helm_krone',       'Königskrone',          '👑', 'helm',   'legend', 20, 10, 20,  0, 'Wer sie trägt, führt.'),
  ('helm_drache',      'Drachenhelm',          '🐉', 'helm',   'legend',  5, 25, 15,  5, 'Geformt aus Drachenknochen.'),
  ('armor_weste',      'Lederweste',           '🦺', 'armor',  'common', 10,  0,  3,  0, 'Simpel, robust.'),
  ('armor_tunika',     'Ranger-Tunika',        '👕', 'armor',  'common',  5,  0,  5,  5, 'Leicht und beweglich.'),
  ('armor_kette',      'Kettenhemd',           '⛓️', 'armor',  'rare',   20,  0, 10,  0, 'Tausend Ringe, tausend Leben.'),
  ('armor_schatten',   'Schattenrobe',         '🥷', 'armor',  'rare',    5, 10,  3, 10, 'Im Dunkel unsichtbar.'),
  ('armor_platte',     'Plattenrüstung',       '🏋️', 'armor',  'epic',   40,  0, 18,  0, 'Stählerne Festung.'),
  ('armor_robe',       'Magierrobe',           '🧙', 'armor',  'epic',   15, 22,  5,  3, 'Verwoben mit Arkanem.'),
  ('armor_drache',     'Drachenschuppenpanzer','🐲', 'armor',  'legend', 60, 10, 25,  0, 'Der Drache gibt seine Schuppen nicht gern her.'),
  ('armor_goetter',    'Götterrobe',           '✨', 'armor',  'legend', 20, 30,  5, 20, 'Für Helden. Nicht für dich. Bis jetzt.'),
  ('amulet_glueck',    'Glückskette',          '🍀', 'amulet', 'common',  3,  3,  3,  3, 'Ein Hauch Fortuna.'),
  ('amulet_schutz',    'Schutzamulet',         '🛡️', 'amulet', 'common',  0,  0,  8,  0, 'Kleine Hilfe, große Wirkung.'),
  ('amulet_tiger',     'Tigerzahnkette',       '🐯', 'amulet', 'rare',    0, 10,  0,  8, 'Beißt zurück.'),
  ('amulet_heil',      'Heilstein',            '💚', 'amulet', 'rare',   18,  0,  3,  0, 'Atme tief durch.'),
  ('amulet_kralle',    'Drachenkralle',        '🦅', 'amulet', 'epic',    0, 20,  0,  5, 'Aus einer sehr schlechten Jagd für den Drachen.'),
  ('amulet_wind',      'Windodem',             '🌬️', 'amulet', 'epic',    0, 12,  0, 18, 'Schneller als der Gedanke.'),
  ('amulet_herz',      'Herz der Legende',     '❤️', 'amulet', 'legend', 20, 20, 20, 10, 'Das Herz eines Ur-Helden. Pocht noch.'),
  ('amulet_phoenix',   'Phönixträne',          '🔥', 'amulet', 'legend', 35,  8, 15,  5, 'Einmal verschütten, ewig weinen.')
on conflict (id) do update set
  name = excluded.name, emoji = excluded.emoji, rarity = excluded.rarity,
  bonus_hp = excluded.bonus_hp, bonus_atk = excluded.bonus_atk,
  bonus_def = excluded.bonus_def, bonus_spd = excluded.bonus_spd,
  lore = excluded.lore;
