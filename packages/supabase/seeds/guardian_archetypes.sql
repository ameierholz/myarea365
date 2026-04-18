-- 20 humanoide Waechter-Archetypen (6 common, 6 rare, 4 epic, 4 legend)
-- IDs sind historisch (alte Tiernamen), Namen humanoid — FKs bleiben stabil.

insert into public.guardian_archetypes (id, name, emoji, rarity, base_hp, base_atk, base_def, base_spd, ability_id, ability_name, ability_desc, lore) values
  ('stadtfuchs',    'Gossendieb',     '🥷', 'common', 100, 22, 15, 25, 'xp_steal',    'Listiger Zug',    '+10% XP bei Sieg',                                    'Schnelle Finger, schnelle Füße.'),
  ('dachs',         'Schildwache',    '🛡️', 'common', 120, 18, 25, 12, 'wall',        'Bollwerk',        '+20% DEF in der ersten Runde',                        'Wer an ihm vorbeikommt hat sich verlaufen.'),
  ('taube',         'Tänzer',         '💃', 'common', 90,  16, 12, 28, 'evade',       'Flatterhaft',     '20% Chance Angriffe auszuweichen',                    'Schwerelos zwischen Schlägen.'),
  ('spatz',         'Gassenjunge',    '🧒', 'common', 85,  20, 10, 30, 'swarm',       'Schwarm',         'Erster Angriff trifft doppelt',                       'Schmal, schnell, kommt in Schwärmen.'),
  ('strassenhund',  'Söldner',        '🤺', 'common', 110, 21, 18, 20, 'loyal',       'Treuer Biss',     '+15% ATK wenn HP unter 50%',                         'Bezahlt mit Treue — wenn sie knapp wird, wird er gefährlich.'),
  ('ratte',         'Apotheker',      '⚗️', 'common', 95,  19, 14, 26, 'poison',      'Gift-Mischung',   '5% HP des Gegners pro Runde (max 3)',                 'Heilung für Freunde, Gift für Feinde.'),
  ('nachteule',     'Straßenmagier',  '🧙', 'rare',   130, 24, 18, 22, 'nightsight',  'Nachtsicht',      '+30% ATK wenn Kampf nach 20 Uhr',                     'Er sieht deine Angriffe bevor du sie denkst.'),
  ('waschbaer',     'Dieb',           '🦹', 'rare',   125, 22, 20, 22, 'thief',       'Diebesgriff',     '30% Chance Gegner-Buff zu klauen',                    'Dir fehlt etwas. Er hat es.'),
  ('stadtkatze',    'Parkour-Mönch',  '🧘', 'rare',   115, 26, 15, 27, 'nineleaves',  'Neun Leben',      'Überlebt ersten tödlichen Treffer mit 1 HP',          'Gefallen, aufgestanden, wieder gefallen — und wieder auf.'),
  ('eule',          'Gelehrte',       '📜', 'rare',   120, 20, 22, 24, 'focus',       'Fokus',           'Ignoriert 50% DEF bei kritischen Treffern',           'Studiert jeden Gegner bevor sie zuschlägt.'),
  ('fledermaus',    'Schatten',       '👤', 'rare',   105, 23, 16, 29, 'echolot',     'Echolot',         'Trifft immer zuerst in Runde 1',                      'Du hörst sie nicht, du siehst sie nicht, du triffst sie nicht.'),
  ('moewe',         'Meuchler',       '🗡️', 'rare',   110, 25, 14, 28, 'ambush',      'Hinterhalt',      '+50% ATK bei erstem Treffer',                         'Einmal zuschlagen, einmal verschwinden.'),
  ('rudelalpha',    'Hauptmann',      '🎖️', 'epic',   160, 30, 22, 24, 'pack',        'Rudel-Ruf',       '+10% ATK für jedes lebende Crew-Mitglied (max +50%)', 'Wo er steht, steht die ganze Crew.'),
  ('eber',          'Paladin',        '🛡️', 'epic',   180, 28, 30, 18, 'fortress',    'Festung',         '+30% DEF wenn Arena in eigener Stadt',                'Der Boden bebt wenn er anrückt.'),
  ('wolf',          'Assassine',      '🥷', 'epic',   150, 32, 20, 27, 'stealth',     'Schatten',        '25% Chance einen Angriff zu verdoppeln',              'Er schlägt zweimal bevor du ihn siehst.'),
  ('baer',          'Berserker',      '🪓', 'epic',   200, 28, 28, 14, 'rage',        'Wut-Aufbau',      '+5% ATK pro erlittenem Treffer (max +40%)',           'Je mehr du triffst, desto gefährlicher wird er.'),
  ('falke',         'Schnellklinge',  '⚔️', 'legend', 170, 38, 22, 32, 'firststrike', 'Erstschlag',      'Erste Runde: +100% ATK, immer kritisch',              'Legende erzählt: ein Hieb reicht.'),
  ('drache',        'Erzmagier',      '🔥', 'legend', 220, 40, 32, 20, 'flame',       'Flamme',          'Gegner verliert 10% HP pro Runde (ignoriert DEF)',    'Aus einer Zeit vor Städten und Straßen.'),
  ('phoenix',       'Hohepriester',   '✨', 'legend', 160, 36, 24, 30, 'rebirth',     'Wiedergeburt',    'Einmal pro Kampf: voll geheilt bei 0 HP',             'Tod ist für ihn nur ein Übergang.'),
  ('wyvern',        'Sturmritter',    '⚡', 'legend', 190, 38, 28, 26, 'dive',        'Sturzflug',       '30% Chance Gegner zu betäuben (1 Runde ohne Angriff)','Dächer sind seine Jagdgründe, Straßen seine Speisekammer.')
on conflict (id) do update set
  name = excluded.name, emoji = excluded.emoji, rarity = excluded.rarity,
  base_hp = excluded.base_hp, base_atk = excluded.base_atk, base_def = excluded.base_def, base_spd = excluded.base_spd,
  ability_id = excluded.ability_id, ability_name = excluded.ability_name, ability_desc = excluded.ability_desc, lore = excluded.lore;
