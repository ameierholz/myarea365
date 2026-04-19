-- ═══════════════════════════════════════════════════════════════════
-- Erweiterung auf 60 Wächter-Archetypen (14 Elite / 12 Epic / 14 Legendary)
-- Balancing-Prinzip: innerhalb einer Rarität ±10% Stat-Total, Typ-Verteilung
-- gleichmäßig (15 je Typ bei 60 total), Rollen divers.
-- Art-Assets fehlen → SVG-Fallback in GuardianAvatar greift automatisch.
-- ═══════════════════════════════════════════════════════════════════

insert into public.guardian_archetypes
  (id, name, emoji, rarity, guardian_type, role, base_hp, base_atk, base_def, base_spd,
   ability_id, ability_name, ability_desc, lore)
values
  -- ═══ ELITE (14 neue — insg. 20 Elite) ═══
  -- Infantry (4 neu)
  ('tuersteher',    'Türsteher',     '🧱', 'elite', 'infantry', 'tank',     125, 19, 24, 14, 'wall',        'Bollwerk',       '+20% DEF in der ersten Runde',                        'Kein Pass, kein Durchkommen.'),
  ('schrotthaendler','Schrotthändler','⚒️', 'elite', 'infantry', 'balanced', 115, 20, 20, 18, 'loyal',       'Zäher Handel',   '+15% ATK wenn HP unter 50%',                          'Was kaputt ist, wird Waffe.'),
  ('gerichtsvollzieher','Gerichtsvollzieher','📋','elite','infantry','dps',  108, 23, 18, 16, 'ambush',      'Eintreibung',    '+50% ATK bei erstem Treffer',                         'Er kommt immer in schwarz.'),
  ('sanitaeter',    'Sanitäter',     '🚑', 'elite', 'infantry', 'support',  118, 17, 22, 16, 'wall',        'Feldbett',       '+20% DEF in der ersten Runde',                        'Rettet, bevor er kämpft.'),
  -- Cavalry (4 neu)
  ('kurier',        'Fahrradkurier', '🚲', 'elite', 'cavalry',  'dps',       88, 22, 10, 32, 'swarm',       'Schwarm',        'Erster Angriff trifft doppelt',                       'Schneller als jede Ampel.'),
  ('skater',        'Skater',        '🛹', 'elite', 'cavalry',  'dps',       92, 21, 12, 30, 'evade',       'Grind',          '20% Chance Angriffe auszuweichen',                    'Der Asphalt liebt ihn.'),
  ('laeufer',       'Marathoni',     '🏃', 'elite', 'cavalry',  'balanced',  95, 20, 14, 28, 'xp_steal',    'Endlos-Lauf',    '+10% XP bei Sieg',                                    'Gehen ist Medizin, Laufen ist Religion.'),
  ('parkour_alt',   'Traceur',       '🏃', 'elite', 'cavalry',  'dps',       90, 22, 11, 29, 'evade',       'Sprung',         '20% Chance Angriffe auszuweichen',                    'Mauern sind nur Vorschläge.'),
  -- Marksman (3 neu)
  ('fotograf',      'Streetfotograf','📷', 'elite', 'marksman', 'support',   95, 19, 14, 26, 'focus',       'Scharfer Blick', 'Ignoriert 50% DEF bei kritischen Treffern',           'Wer eine Linse hält, hat ein Ziel.'),
  ('taschendieb',   'Taschendieb',   '👛', 'elite', 'marksman', 'dps',       85, 23, 10, 30, 'xp_steal',    'Langer Finger',  '+10% XP bei Sieg',                                    'Du bemerkst ihn erst, wenn du zahlen willst.'),
  ('barista',       'Barista',       '☕', 'elite', 'marksman', 'support',   92, 20, 14, 26, 'focus',       'Koffein-Rausch', 'Ignoriert 50% DEF bei kritischen Treffern',           'Gib ihm 5 Minuten und er wacht auf.'),
  -- Mage (3 neu)
  ('graffiti',      'Graffiti-Magier','🎨','elite', 'mage',     'dps',      100, 22, 14, 24, 'poison',      'Sprühnebel',     '5% HP des Gegners pro Runde (max 3)',                 'Seine Kunst brennt in der Netzhaut.'),
  ('dj',            'Straßen-DJ',    '🎧', 'elite', 'mage',     'support',   98, 18, 18, 24, 'poison',      'Beat-Drop',      '5% HP des Gegners pro Runde (max 3)',                 'Der Bass schlägt schneller als dein Herz.'),
  ('poet',          'Slam-Poet',     '📝', 'elite', 'mage',     'balanced',  95, 20, 16, 24, 'nightsight',  'Wortsalve',      '+30% ATK wenn Kampf nach 20 Uhr',                     'Worte können mehr verletzen als Klingen.'),

  -- ═══ EPIC (12 neue — insg. 20 Epic) ═══
  -- Infantry (3 neu)
  ('wachmann',      'Wachmann',      '👮', 'epic', 'infantry',  'tank',     170, 26, 28, 18, 'fortress',    'Revier-Schutz',  '+30% DEF wenn Arena in eigener Stadt',                'Er kennt jede Gasse seines Viertels.'),
  ('brauer',        'Bierbrauer',    '🍺', 'epic', 'infantry',  'dps',      155, 29, 24, 20, 'rage',        'Gärungswut',     '+5% ATK pro erlittenem Treffer (max +40%)',           'Nach dem 10. Krug wird er gefährlich.'),
  ('schmied',       'Straßenschmied','🔨', 'epic', 'infantry',  'balanced', 160, 28, 26, 20, 'pack',        'Handwerks-Schlag','+10% ATK pro Crew-Mitglied (max +50%)',             'Jedes Werkzeug wird Waffe in seinen Händen.'),
  -- Cavalry (3 neu)
  ('reiter',        'Polizei-Reiter','🐴', 'epic', 'cavalry',   'tank',     155, 28, 24, 26, 'fortress',    'Berittene Hoheit','+30% DEF wenn Arena in eigener Stadt',               'Wo er vorbeireitet, verstummt der Krawall.'),
  ('bote',          'Express-Bote',  '📦', 'epic', 'cavalry',   'dps',      130, 30, 18, 28, 'stealth',     'Blitzlieferung', '25% Chance einen Angriff zu verdoppeln',              'Heute bestellt, jetzt dein Problem.'),
  ('jockey',        'Rennjockey',    '🏇', 'epic', 'cavalry',   'dps',      125, 31, 17, 29, 'firststrike', 'Start-Schuss',   'Runde 1: +100% ATK, immer kritisch',                  'Der erste Meter entscheidet.'),
  -- Marksman (3 neu)
  ('dachdecker',    'Dachdecker',    '🏠', 'epic', 'marksman',  'dps',      115, 27, 17, 27, 'echolot',     'Hoher Winkel',   'Trifft immer zuerst in Runde 1',                      'Er sieht dich, bevor du aufstehst.'),
  ('busfahrer',     'Nachtbusfahrer','🚌', 'epic', 'marksman',  'support',  120, 24, 20, 25, 'nightsight',  'Letzte Tour',    '+30% ATK wenn Kampf nach 20 Uhr',                     'Er kennt jede Seitenstraße.'),
  ('strassenmaler', 'Straßenmaler',  '🖌️', 'epic', 'marksman',  'balanced', 118, 25, 19, 25, 'focus',       'Perspektive',    'Ignoriert 50% DEF bei kritischen Treffern',           'Jeder Strich ein Treffer.'),
  -- Mage (3 neu)
  ('kartenleserin', 'Kartenleserin', '🔮', 'epic', 'mage',      'support',  130, 23, 21, 23, 'thief',       'Vorsehung',      '30% Chance Gegner-Buff zu klauen',                    'Sie wusste, dass du das tun würdest.'),
  ('alchemist',     'Alchemist',     '⚗️', 'epic', 'mage',      'dps',      125, 25, 20, 22, 'poison',      'Elixier',        '5% HP des Gegners pro Runde (max 3)',                 'Was er braut, macht süchtig oder krank.'),
  ('stadtschamane', 'Stadtschamane', '🪶', 'epic', 'mage',      'balanced', 128, 22, 22, 23, 'nightsight',  'Großstadt-Geist','+30% ATK wenn Kampf nach 20 Uhr',                     'Er hört das Flüstern der U-Bahn.'),

  -- ═══ LEGENDARY (14 neue — insg. 20 Legendary) ═══
  -- Infantry (4 neu)
  ('boxer',         'Untergrund-Boxer','🥊', 'legendary','infantry','dps',  195, 36, 26, 18, 'rage',        'Kettenhiebe',    '+5% ATK pro erlittenem Treffer (max +40%)',           'Runden sind für Leute mit Angst.'),
  ('koloss',        'Koloss',        '🗿', 'legendary','infantry','tank',   230, 26, 36, 12, 'fortress',    'Monolith',       '+30% DEF wenn Arena in eigener Stadt',                'Er ist älter als diese Stadt.'),
  ('veteran',       'Veteran',       '🎖️', 'legendary','infantry','balanced',200,34, 30, 16, 'pack',       'Kommando',       '+10% ATK pro Crew-Mitglied (max +50%)',               'Er hat mehr überlebt als die meisten je sehen werden.'),
  ('wachritter',    'Wachritter',    '⚔️', 'legendary','infantry','tank',   215, 30, 34, 14, 'wall',        'Eiserner Wall',  '+20% DEF in der ersten Runde',                        'Er steht, wo andere fallen.'),
  -- Cavalry (4 neu)
  ('kuriernomade',  'Kurier-Nomade', '🏍️', 'legendary','cavalry', 'dps',    165, 36, 22, 30, 'firststrike', 'Überschall',     'Runde 1: +100% ATK, immer kritisch',                  'Sein Motor ist sein Atem.'),
  ('streetracer',   'Streetracer',   '🏎️', 'legendary','cavalry', 'dps',    160, 37, 20, 31, 'stealth',     'Überholmanöver', '25% Chance einen Angriff zu verdoppeln',              'Regeln sind für Leute, die gewinnen wollen.'),
  ('stormrider',    'Sturmreiter',   '🌪️', 'legendary','cavalry', 'balanced',175,35, 25, 28, 'dive',        'Sturzflug',      '30% Chance Gegner zu betäuben',                       'Er bringt seinen eigenen Wind mit.'),
  ('kuriergoettin', 'Fahrradgöttin', '🚴', 'legendary','cavalry', 'support',170, 33, 24, 30, 'rebirth',     'Kette springt', 'Einmal pro Kampf: voll geheilt bei 0 HP',             'Sie kennt jeden Schleichweg.'),
  -- Marksman (3 neu)
  ('heckenschuetze','Heckenschütze', '🎯', 'legendary','marksman','dps',    160, 39, 21, 31, 'firststrike', 'Ein-Schuss',    'Runde 1: +100% ATK, immer kritisch',                  'Zweite Chance brauchst du nicht.'),
  ('bogenmeisterin','Bogenmeisterin','🏹', 'legendary','marksman','dps',    165, 37, 22, 30, 'focus',       'Atemstille',     'Ignoriert 50% DEF bei kritischen Treffern',           'Sie atmet, wenn ihr Pfeil landet.'),
  ('schattenjaeger','Schattenjäger', '🌑', 'legendary','marksman','balanced',170,36, 24, 29, 'echolot',     'Blindschuss',    'Trifft immer zuerst in Runde 1',                      'Er jagt nur, wenn du glaubst, er sei weg.'),
  -- Mage (3 neu)
  ('netzweber',     'Netzweber',     '🕸️', 'legendary','mage',    'support',170, 34, 26, 28, 'thief',       'Bann-Netz',      '30% Chance Gegner-Buff zu klauen',                    'Alles ist verbunden — sogar du.'),
  ('chronist',      'Chronist',      '📜', 'legendary','mage',    'balanced',165,35, 28, 25, 'nightsight',  'Zeitwende',      '+30% ATK wenn Kampf nach 20 Uhr',                     'Er schreibt das Ende, bevor es beginnt.'),
  ('aschenmagier',  'Aschen-Magier', '🌋', 'legendary','mage',    'dps',    175, 40, 24, 22, 'flame',       'Phönix-Asche',   'Gegner verliert 10% HP pro Runde (ignoriert DEF)',    'Aus Ruinen entstand sein Wissen.')
on conflict (id) do update set
  name = excluded.name, emoji = excluded.emoji, rarity = excluded.rarity,
  guardian_type = excluded.guardian_type, role = excluded.role,
  base_hp = excluded.base_hp, base_atk = excluded.base_atk,
  base_def = excluded.base_def, base_spd = excluded.base_spd,
  ability_id = excluded.ability_id, ability_name = excluded.ability_name,
  ability_desc = excluded.ability_desc, lore = excluded.lore;

-- Re-Run der Talent-Node-Generatoren (INSERT...SELECT mit ON CONFLICT DO NOTHING)
-- für die neuen Archetypen. Kopiert die Struktur aus guardian_archetypes.sql.

insert into public.talent_nodes (id, archetype_id, branch, tier, slot, name, description, max_rank, effect_key, effect_per_rank, requires_node_id)
select a.id || '.util.1', a.id, 'utility', 1, 0, 'Ausdauer',         '+3% HP pro Rang',   5, 'hp_pct',   0.03, null                       from public.guardian_archetypes a
union all select a.id || '.util.2', a.id, 'utility', 2, 0, 'Schärfe',          '+3% ATK pro Rang',  5, 'atk_pct',  0.03, a.id || '.util.1'         from public.guardian_archetypes a
union all select a.id || '.util.3', a.id, 'utility', 3, 0, 'Rüstung',          '+3% DEF pro Rang',  5, 'def_pct',  0.03, a.id || '.util.2'         from public.guardian_archetypes a
union all select a.id || '.util.4', a.id, 'utility', 4, 0, 'Flinkheit',        '+3% SPD pro Rang',  5, 'spd_pct',  0.03, a.id || '.util.3'         from public.guardian_archetypes a
union all select a.id || '.util.5', a.id, 'utility', 5, 0, 'Entschlossenheit', '+2% Krit-Chance',   5, 'crit_pct', 0.02, a.id || '.util.4'         from public.guardian_archetypes a
on conflict do nothing;

-- Secondary + Primary Äste: exakt gleiche Generatoren wie im Haupt-Seed.
-- Hier kompakt inline, damit Script eigenständig rennen kann.
insert into public.talent_nodes (id, archetype_id, branch, tier, slot, name, description, max_rank, effect_key, effect_per_rank, requires_node_id)
-- Infantry secondary
select a.id || '.sec.1', a.id, 'secondary', 1, 0, 'Stahlhaut',   '+4% DEF pro Rang',       5, 'def_pct',       0.04, null                     from public.guardian_archetypes a where a.guardian_type = 'infantry'
union all select a.id || '.sec.2', a.id, 'secondary', 2, 0, 'Schildfaust','+3% HP pro Rang',         5, 'hp_pct',        0.03, a.id || '.sec.1' from public.guardian_archetypes a where a.guardian_type = 'infantry'
union all select a.id || '.sec.3', a.id, 'secondary', 3, 0, 'Konter',     '+5% Konter-Chance',       5, 'counter_pct',   0.05, a.id || '.sec.2' from public.guardian_archetypes a where a.guardian_type = 'infantry'
union all select a.id || '.sec.4', a.id, 'secondary', 4, 0, 'Festung',    '−4% erlittener Schaden',  5, 'dmg_reduction', 0.04, a.id || '.sec.3' from public.guardian_archetypes a where a.guardian_type = 'infantry'
union all select a.id || '.sec.5', a.id, 'secondary', 5, 0, 'Unbeugsam',  '10% Chance Stun zu ignorieren', 5, 'stun_resist', 0.10, a.id || '.sec.4' from public.guardian_archetypes a where a.guardian_type = 'infantry'
-- Cavalry secondary
union all select a.id || '.sec.1', a.id, 'secondary', 1, 0, 'Preschen',      '+4% SPD pro Rang',            5, 'spd_pct',     0.04, null                     from public.guardian_archetypes a where a.guardian_type = 'cavalry'
union all select a.id || '.sec.2', a.id, 'secondary', 2, 0, 'Anreiten',      '+5% ATK in Runde 1',          5, 'r1_atk_pct',  0.05, a.id || '.sec.1' from public.guardian_archetypes a where a.guardian_type = 'cavalry'
union all select a.id || '.sec.3', a.id, 'secondary', 3, 0, 'Sturmlauf',     '+3% Krit-Schaden pro Rang',   5, 'crit_dmg',    0.03, a.id || '.sec.2' from public.guardian_archetypes a where a.guardian_type = 'cavalry'
union all select a.id || '.sec.4', a.id, 'secondary', 4, 0, 'Durchbruch',    'Ignoriert 2% DEF pro Rang',   5, 'pen_pct',     0.02, a.id || '.sec.3' from public.guardian_archetypes a where a.guardian_type = 'cavalry'
union all select a.id || '.sec.5', a.id, 'secondary', 5, 0, 'Reiterwut',     '+10% ATK gegen Scharfschützen',5,'vs_marksman', 0.10, a.id || '.sec.4' from public.guardian_archetypes a where a.guardian_type = 'cavalry'
-- Marksman secondary
union all select a.id || '.sec.1', a.id, 'secondary', 1, 0, 'Scharfer Blick', '+3% Krit-Chance pro Rang',    5, 'crit_pct',   0.03, null                     from public.guardian_archetypes a where a.guardian_type = 'marksman'
union all select a.id || '.sec.2', a.id, 'secondary', 2, 0, 'Schlag ins Ziel','+4% Krit-Schaden pro Rang',    5, 'crit_dmg',   0.04, a.id || '.sec.1' from public.guardian_archetypes a where a.guardian_type = 'marksman'
union all select a.id || '.sec.3', a.id, 'secondary', 3, 0, 'Dehnkraft',      '+3% ATK pro Rang',             5, 'atk_pct',    0.03, a.id || '.sec.2' from public.guardian_archetypes a where a.guardian_type = 'marksman'
union all select a.id || '.sec.4', a.id, 'secondary', 4, 0, 'Deckung',        '+5% Ausweichen pro Rang',      5, 'evade_pct',  0.05, a.id || '.sec.3' from public.guardian_archetypes a where a.guardian_type = 'marksman'
union all select a.id || '.sec.5', a.id, 'secondary', 5, 0, 'Jäger',          '+10% ATK gegen Infanterie',    5, 'vs_infantry',0.10, a.id || '.sec.4' from public.guardian_archetypes a where a.guardian_type = 'marksman'
-- Mage secondary
union all select a.id || '.sec.1', a.id, 'secondary', 1, 0, 'Intellekt',       '+4% Skill-Schaden pro Rang', 5, 'skill_dmg',  0.04, null                     from public.guardian_archetypes a where a.guardian_type = 'mage'
union all select a.id || '.sec.2', a.id, 'secondary', 2, 0, 'Mana-Fluss',      '−5% Rage-Kosten pro Rang',    5, 'rage_cost',  -0.05, a.id || '.sec.1' from public.guardian_archetypes a where a.guardian_type = 'mage'
union all select a.id || '.sec.3', a.id, 'secondary', 3, 0, 'Arkane Haut',     '+3% DEF pro Rang',             5, 'def_pct',    0.03, a.id || '.sec.2' from public.guardian_archetypes a where a.guardian_type = 'mage'
union all select a.id || '.sec.4', a.id, 'secondary', 4, 0, 'Konzentration',   '+10 Start-Rage pro Rang',      5, 'start_rage', 10.0, a.id || '.sec.3' from public.guardian_archetypes a where a.guardian_type = 'mage'
union all select a.id || '.sec.5', a.id, 'secondary', 5, 0, 'Elementarmeister','+5% DoT-Schaden pro Rang',     5, 'dot_dmg',    0.05, a.id || '.sec.4' from public.guardian_archetypes a where a.guardian_type = 'mage'
on conflict do nothing;

-- Primary Ast: Rollen-spezifisch
insert into public.talent_nodes (id, archetype_id, branch, tier, slot, name, description, max_rank, effect_key, effect_per_rank, requires_node_id)
select a.id || '.pri.1', a.id, 'primary', 1, 0, 'Schlagkraft',    '+5% ATK pro Rang',            5, 'atk_pct',       0.05, null                     from public.guardian_archetypes a where a.role = 'dps'
union all select a.id || '.pri.2', a.id, 'primary', 2, 0, 'Mordlust',       '+4% Krit-Chance pro Rang',    5, 'crit_pct',      0.04, a.id || '.pri.1' from public.guardian_archetypes a where a.role = 'dps'
union all select a.id || '.pri.3', a.id, 'primary', 3, 0, 'Tödlicher Hieb', '+5% Krit-Schaden pro Rang',   5, 'crit_dmg',      0.05, a.id || '.pri.2' from public.guardian_archetypes a where a.role = 'dps'
union all select a.id || '.pri.4', a.id, 'primary', 4, 0, 'Überwältigung',  '+3% ATK gegen schwache Gegner',5,'vs_weak',       0.03, a.id || '.pri.3' from public.guardian_archetypes a where a.role = 'dps'
union all select a.id || '.pri.5', a.id, 'primary', 5, 0, 'Keystone: Berserker','Bei HP<30%: +50% ATK',    1, 'berserker_key', 1.00, a.id || '.pri.4' from public.guardian_archetypes a where a.role = 'dps'
union all select a.id || '.pri.1', a.id, 'primary', 1, 0, 'Wall',            '+6% HP pro Rang',             5, 'hp_pct',         0.06, null                     from public.guardian_archetypes a where a.role = 'tank'
union all select a.id || '.pri.2', a.id, 'primary', 2, 0, 'Dornen',          '+3% reflektierter Schaden',   5, 'thorns_pct',     0.03, a.id || '.pri.1' from public.guardian_archetypes a where a.role = 'tank'
union all select a.id || '.pri.3', a.id, 'primary', 3, 0, 'Unnachgiebig',    '+4% DEF pro Rang',            5, 'def_pct',        0.04, a.id || '.pri.2' from public.guardian_archetypes a where a.role = 'tank'
union all select a.id || '.pri.4', a.id, 'primary', 4, 0, 'Niemals gefallen','+3% Heilung pro erlittenem Treffer', 5, 'heal_on_hit', 0.03, a.id || '.pri.3' from public.guardian_archetypes a where a.role = 'tank'
union all select a.id || '.pri.5', a.id, 'primary', 5, 0, 'Keystone: Bollwerk','1× pro Kampf: absorbiert tödlichen Treffer', 1, 'bollwerk_key', 1.00, a.id || '.pri.4' from public.guardian_archetypes a where a.role = 'tank'
union all select a.id || '.pri.1', a.id, 'primary', 1, 0, 'Schnelldenker',   '+5% SPD pro Rang',            5, 'spd_pct',        0.05, null                     from public.guardian_archetypes a where a.role = 'support'
union all select a.id || '.pri.2', a.id, 'primary', 2, 0, 'Inspiration',     '+3% Rage-Generation',          5, 'rage_gen',       0.03, a.id || '.pri.1' from public.guardian_archetypes a where a.role = 'support'
union all select a.id || '.pri.3', a.id, 'primary', 3, 0, 'Bannung',         '+5% Chance Debuff zu löschen', 5, 'debuff_cleanse', 0.05, a.id || '.pri.2' from public.guardian_archetypes a where a.role = 'support'
union all select a.id || '.pri.4', a.id, 'primary', 4, 0, 'Gebete',          '+4% HP-Regen pro Rang',        5, 'regen_pct',      0.04, a.id || '.pri.3' from public.guardian_archetypes a where a.role = 'support'
union all select a.id || '.pri.5', a.id, 'primary', 5, 0, 'Keystone: Erwachen','1× pro Kampf: volle Rage',  1, 'awaken_key',     1.00, a.id || '.pri.4' from public.guardian_archetypes a where a.role = 'support'
union all select a.id || '.pri.1', a.id, 'primary', 1, 0, 'Gleichgewicht',  '+3% zu allen Stats pro Rang',   5, 'all_stats_pct',  0.03, null                     from public.guardian_archetypes a where a.role = 'balanced'
union all select a.id || '.pri.2', a.id, 'primary', 2, 0, 'Flexibilität',   '+3% Ausweichen pro Rang',       5, 'evade_pct',      0.03, a.id || '.pri.1' from public.guardian_archetypes a where a.role = 'balanced'
union all select a.id || '.pri.3', a.id, 'primary', 3, 0, 'Pragmatik',      '+3% Schaden gegen volle-HP-Gegner', 5, 'vs_full_hp', 0.03, a.id || '.pri.2' from public.guardian_archetypes a where a.role = 'balanced'
union all select a.id || '.pri.4', a.id, 'primary', 4, 0, 'Ausdauerläufer', 'Runde 6+: +5% ATK pro Rang',    5, 'late_atk',       0.05, a.id || '.pri.3' from public.guardian_archetypes a where a.role = 'balanced'
union all select a.id || '.pri.5', a.id, 'primary', 5, 0, 'Keystone: Symbiose','+10% aller Stats wenn HP zwischen 40-60%', 1, 'symbiose_key', 1.00, a.id || '.pri.4' from public.guardian_archetypes a where a.role = 'balanced'
on conflict do nothing;

-- Skills (active/passive/combat/role/expertise) für neue Archetypen
insert into public.archetype_skills (id, archetype_id, skill_slot, name, description, effect_key, base_value, per_level_value, rage_cost)
select a.id || '.active', a.id, 'active', a.ability_name, a.ability_desc || ' — skalliert pro Stufe +20%', a.ability_id, 1.0, 0.20, 1000 from public.guardian_archetypes a
on conflict do nothing;

insert into public.archetype_skills (id, archetype_id, skill_slot, name, description, effect_key, base_value, per_level_value, rage_cost)
select a.id || '.passive', a.id, 'passive',
       case a.guardian_type when 'infantry' then 'Stählerner Wille' when 'cavalry' then 'Windläufer' when 'marksman' then 'Scharfer Blick' when 'mage' then 'Arkane Aura' end,
       case a.guardian_type when 'infantry' then '+3% DEF pro Stufe' when 'cavalry' then '+3% SPD pro Stufe' when 'marksman' then '+2% Krit-Chance pro Stufe' when 'mage' then '+3% Skill-Schaden pro Stufe' end,
       case a.guardian_type when 'infantry' then 'passive_def' when 'cavalry' then 'passive_spd' when 'marksman' then 'passive_crit' when 'mage' then 'passive_skill_dmg' end,
       0.0, case a.guardian_type when 'marksman' then 0.02 else 0.03 end, 0
from public.guardian_archetypes a on conflict do nothing;

insert into public.archetype_skills (id, archetype_id, skill_slot, name, description, effect_key, base_value, per_level_value, rage_cost)
select a.id || '.combat', a.id, 'combat',
       case a.role when 'dps' then 'Adrenalin' when 'tank' then 'Trotz' when 'support' then 'Beistand' when 'balanced' then 'Instinkt' end,
       case a.role when 'dps' then 'Bei Krit-Treffer: +50 Rage (+10 pro Stufe)' when 'tank' then 'Bei erlittenem Treffer: +30 Rage (+10 pro Stufe)' when 'support' then 'Pro Runde: +20 Rage (+5 pro Stufe)' when 'balanced' then 'Bei HP unter 50%: +40 Rage (+10 pro Stufe)' end,
       case a.role when 'dps' then 'combat_rage_on_crit' when 'tank' then 'combat_rage_on_hit' when 'support' then 'combat_rage_per_round' else 'combat_rage_low_hp' end,
       case a.role when 'dps' then 50 when 'tank' then 30 when 'support' then 20 else 40 end,
       case a.role when 'support' then 5 else 10 end, 0
from public.guardian_archetypes a on conflict do nothing;

insert into public.archetype_skills (id, archetype_id, skill_slot, name, description, effect_key, base_value, per_level_value, rage_cost)
select a.id || '.role', a.id, 'role',
       case a.guardian_type when 'infantry' then 'Phalanx' when 'cavalry' then 'Ansturm' when 'marksman' then 'Fernkampf-Meisterschaft' when 'mage' then 'Arkane Durchschlagskraft' end,
       case a.guardian_type when 'infantry' then '+3% Schaden gegen Kavallerie pro Stufe' when 'cavalry' then '+3% Schaden gegen Scharfschützen pro Stufe' when 'marksman' then '+3% Schaden gegen Infanterie pro Stufe' when 'mage' then '+2% Schaden gegen alle Typen pro Stufe' end,
       case a.guardian_type when 'infantry' then 'role_vs_cavalry' when 'cavalry' then 'role_vs_marksman' when 'marksman' then 'role_vs_infantry' when 'mage' then 'role_vs_all' end,
       0.0, case a.guardian_type when 'mage' then 0.02 else 0.03 end, 0
from public.guardian_archetypes a on conflict do nothing;

insert into public.archetype_skills (id, archetype_id, skill_slot, name, description, effect_key, base_value, per_level_value, rage_cost)
select a.id || '.expertise', a.id, 'expertise', a.ability_name || ' — Meisterschaft',
       'Expertise: Aktiv-Skill löst zusätzlich Zweitwirkung aus. +25% Gesamtschaden pro Stufe.',
       a.ability_id || '_expert', 0.25, 0.25, 0
from public.guardian_archetypes a on conflict do nothing;
