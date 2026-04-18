-- Seed-Daten fuer Guardian-Archetypen (20 Waechter — 6 common, 6 rare, 4 epic, 4 legend)

insert into public.guardian_archetypes (id, name, emoji, rarity, base_hp, base_atk, base_def, base_spd, ability_id, ability_name, ability_desc, lore) values
  ('stadtfuchs',    'Stadtfuchs',    '🦊', 'common', 100, 22, 15, 25, 'xp_steal',    'Listiger Zug',   '+10% XP bei Sieg',                                    'Kennt jede Abkürzung der Stadt.'),
  ('dachs',         'Steinbeißer',   '🦡', 'common', 120, 18, 25, 12, 'wall',        'Bollwerk',       '+20% DEF in der ersten Runde',                        'Wer hinter ihm steht, steht sicher.'),
  ('taube',         'Asphalt-Taube', '🕊️', 'common', 90,  16, 12, 28, 'evade',       'Flatterhaft',    '20% Chance Angriffe auszuweichen',                    'Unterschätzt, überall, unaufhaltbar.'),
  ('spatz',         'Gassenspatz',   '🐦', 'common', 85,  20, 10, 30, 'swarm',       'Schwarm',        'Erster Angriff trifft doppelt',                       'Viele kleine Stimmen, ein lauter Chor.'),
  ('strassenhund',  'Straßenhund',   '🐕', 'common', 110, 21, 18, 20, 'loyal',       'Treuer Biss',    '+15% ATK wenn HP unter 50%',                         'Beschützt was ihm gehört.'),
  ('ratte',         'Kanalratte',    '🐀', 'common', 95,  19, 14, 26, 'poison',      'Gift-Biss',      '5% HP des Gegners pro Runde (max 3)',                 'Aus dem Untergrund steigt das Imperium.'),
  ('nachteule',     'Nachteule',     '🦉', 'rare',   130, 24, 18, 22, 'nightsight',  'Nachtsicht',     '+30% ATK wenn Kampf nach 20 Uhr',                     'Sie sieht was andere verbergen.'),
  ('waschbaer',     'Waschbär',      '🦝', 'rare',   125, 22, 20, 22, 'thief',       'Dieb',           '30% Chance Gegner-Buff zu klauen',                    'Nimmt sich was nicht festgenagelt ist.'),
  ('stadtkatze',    'Stadtkatze',    '🐈', 'rare',   115, 26, 15, 27, 'nineleaves',  'Neun Leben',     'Überlebt ersten tödlichen Treffer mit 1 HP',          'Gefallen, aufgestanden, wieder gefallen.'),
  ('eule',          'Bücherei-Eule', '🦉', 'rare',   120, 20, 22, 24, 'focus',       'Fokus',          'Ignoriert 50% DEF bei kritischen Treffern',           'Studiert jeden Gegner bevor sie zuschlägt.'),
  ('fledermaus',    'Altbau-Fledermaus','🦇','rare', 105, 23, 16, 29, 'echolot',     'Echolot',        'Trifft immer zuerst in Runde 1',                      'Sie hört deinen Angriff bevor du ihn planst.'),
  ('moewe',         'Hafen-Möwe',    '🪶', 'rare',   110, 25, 14, 28, 'ambush',      'Hinterhalt',     '+50% ATK bei erstem Treffer',                         'Stürzt aus dem Nichts und verschwindet wieder.'),
  ('rudelalpha',    'Rudel-Alpha',   '🐺', 'epic',   160, 30, 22, 24, 'pack',        'Rudel-Ruf',      '+10% ATK für jedes lebende Crew-Mitglied (max +50%)', 'Wo er jagt, jagt die ganze Crew mit.'),
  ('eber',          'Wild-Eber',     '🐗', 'epic',   180, 28, 30, 18, 'fortress',    'Festung',        '+30% DEF wenn Arena in eigener Stadt',                'Der Boden bebt wenn er anrückt.'),
  ('wolf',          'Schatten-Wolf', '🐺', 'epic',   150, 32, 20, 27, 'stealth',     'Schatten',       '25% Chance einen Angriff zu verdoppeln',              'Er schlägt zweimal bevor du ihn siehst.'),
  ('baer',          'Asphalt-Bär',   '🐻', 'epic',   200, 28, 28, 14, 'rage',        'Wut-Aufbau',     '+5% ATK pro erlittenem Treffer (max +40%)',           'Je mehr du triffst, desto gefährlicher wird er.'),
  ('falke',         'Königs-Falke',  '🦅', 'legend', 170, 38, 22, 32, 'firststrike', 'Erstschlag',     'Erste Runde: +100% ATK, immer kritisch',              'Legende erzählt: ein Hieb reicht.'),
  ('drache',        'Ur-Drache',     '🐉', 'legend', 220, 40, 32, 20, 'flame',       'Flamme',         'Gegner verliert 10% HP pro Runde (ignoriert DEF)',    'Aus einer Zeit vor Städten und Straßen.'),
  ('phoenix',       'Aschen-Phönix', '🔥', 'legend', 160, 36, 24, 30, 'rebirth',     'Wiedergeburt',   'Einmal pro Kampf: voll geheilt bei 0 HP',             'Asche ist nur ein Übergang.'),
  ('wyvern',        'Dach-Wyvern',   '🐲', 'legend', 190, 38, 28, 26, 'dive',        'Sturzflug',      '30% Chance Gegner zu betäuben (1 Runde ohne Angriff)','Dächer sind ihre Jagdgründe, Straßen ihre Speisekammer.')
on conflict (id) do update set
  name = excluded.name, emoji = excluded.emoji, rarity = excluded.rarity,
  base_hp = excluded.base_hp, base_atk = excluded.base_atk, base_def = excluded.base_def, base_spd = excluded.base_spd,
  ability_id = excluded.ability_id, ability_name = excluded.ability_name, ability_desc = excluded.ability_desc, lore = excluded.lore;
