-- 20 humanoide Waechter-Archetypen — CoD/RoK-Rework
-- Rarity: elite (Einsteiger) / epic / legendary
-- Typen:  infantry / cavalry / marksman / mage
-- IDs bleiben stabil (FK-Kompatibilität), nur rarity/type werden aktualisiert.

insert into public.guardian_archetypes
  (id, name, emoji, rarity, guardian_type, role, base_hp, base_atk, base_def, base_spd,
   ability_id, ability_name, ability_desc, lore)
values
  -- ═══ ELITE (Einsteiger) ═══
  ('stadtfuchs',    'Gossendieb',     '🥷', 'elite', 'marksman', 'dps',      100, 22, 15, 25, 'xp_steal',    'Listiger Zug',    '+10% XP bei Sieg',                                    'Schnelle Finger, schnelle Füße.'),
  ('dachs',         'Schildwache',    '🛡️', 'elite', 'infantry', 'tank',     120, 18, 25, 12, 'wall',        'Bollwerk',        '+20% DEF in der ersten Runde',                        'Wer an ihm vorbeikommt hat sich verlaufen.'),
  ('taube',         'Tänzer',         '💃', 'elite', 'marksman', 'dps',       90, 16, 12, 28, 'evade',       'Flatterhaft',     '20% Chance Angriffe auszuweichen',                    'Schwerelos zwischen Schlägen.'),
  ('spatz',         'Gassenjunge',    '🧒', 'elite', 'cavalry',  'dps',       85, 20, 10, 30, 'swarm',       'Schwarm',         'Erster Angriff trifft doppelt',                       'Schmal, schnell, kommt in Schwärmen.'),
  ('strassenhund',  'Söldner',        '🤺', 'elite', 'infantry', 'balanced', 110, 21, 18, 20, 'loyal',       'Treuer Biss',     '+15% ATK wenn HP unter 50%',                          'Bezahlt mit Treue — wenn sie knapp wird, wird er gefährlich.'),
  ('ratte',         'Apotheker',      '⚗️', 'elite', 'mage',     'support',   95, 19, 14, 26, 'poison',      'Gift-Mischung',   '5% HP des Gegners pro Runde (max 3)',                 'Heilung für Freunde, Gift für Feinde.'),

  -- ═══ EPIC ═══
  ('nachteule',     'Straßenmagier',  '🧙', 'epic', 'mage',      'dps',      130, 24, 18, 22, 'nightsight',  'Nachtsicht',      '+30% ATK wenn Kampf nach 20 Uhr',                     'Er sieht deine Angriffe bevor du sie denkst.'),
  ('waschbaer',     'Dieb',           '🦹', 'epic', 'mage',      'support',  125, 22, 20, 22, 'thief',       'Diebesgriff',     '30% Chance Gegner-Buff zu klauen',                    'Dir fehlt etwas. Er hat es.'),
  ('stadtkatze',    'Parkour-Mönch',  '🧘', 'epic', 'cavalry',   'balanced', 115, 26, 15, 27, 'nineleaves',  'Neun Leben',      'Überlebt ersten tödlichen Treffer mit 1 HP',          'Gefallen, aufgestanden, wieder gefallen — und wieder auf.'),
  ('eule',          'Gelehrte',       '📜', 'epic', 'mage',      'dps',      120, 20, 22, 24, 'focus',       'Fokus',           'Ignoriert 50% DEF bei kritischen Treffern',           'Studiert jeden Gegner bevor sie zuschlägt.'),
  ('fledermaus',    'Schatten',       '👤', 'epic', 'marksman',  'dps',      105, 23, 16, 29, 'echolot',     'Echolot',         'Trifft immer zuerst in Runde 1',                      'Du hörst sie nicht, du siehst sie nicht, du triffst sie nicht.'),
  ('moewe',         'Meuchler',       '🗡️', 'epic', 'marksman',  'dps',      110, 25, 14, 28, 'ambush',      'Hinterhalt',      '+50% ATK bei erstem Treffer',                         'Einmal zuschlagen, einmal verschwinden.'),
  ('rudelalpha',    'Hauptmann',      '🎖️', 'epic', 'infantry',  'support',  160, 30, 22, 24, 'pack',        'Rudel-Ruf',       '+10% ATK für jedes lebende Crew-Mitglied (max +50%)', 'Wo er steht, steht die ganze Crew.'),
  ('eber',          'Paladin',        '🛡️', 'epic', 'infantry',  'tank',     180, 28, 30, 18, 'fortress',    'Festung',         '+30% DEF wenn Arena in eigener Stadt',                'Der Boden bebt wenn er anrückt.'),

  -- ═══ LEGENDARY ═══
  ('wolf',          'Assassine',      '🥷', 'legendary', 'cavalry',  'dps',      150, 32, 20, 27, 'stealth',     'Schatten',        '25% Chance einen Angriff zu verdoppeln',              'Er schlägt zweimal bevor du ihn siehst.'),
  ('baer',          'Berserker',      '🪓', 'legendary', 'infantry', 'dps',      200, 28, 28, 14, 'rage',        'Wut-Aufbau',      '+5% ATK pro erlittenem Treffer (max +40%)',           'Je mehr du triffst, desto gefährlicher wird er.'),
  ('falke',         'Schnellklinge',  '⚔️', 'legendary', 'marksman', 'dps',      170, 38, 22, 32, 'firststrike', 'Erstschlag',      'Erste Runde: +100% ATK, immer kritisch',              'Legende erzählt: ein Hieb reicht.'),
  ('drache',        'Erzmagier',      '🔥', 'legendary', 'mage',     'dps',      220, 40, 32, 20, 'flame',       'Flamme',          'Gegner verliert 10% HP pro Runde (ignoriert DEF)',    'Aus einer Zeit vor Städten und Straßen.'),
  ('phoenix',       'Hohepriester',   '✨', 'legendary', 'mage',     'support',  160, 36, 24, 30, 'rebirth',     'Wiedergeburt',    'Einmal pro Kampf: voll geheilt bei 0 HP',             'Tod ist für ihn nur ein Übergang.'),
  ('wyvern',        'Sturmritter',    '⚡', 'legendary', 'cavalry',  'balanced', 190, 38, 28, 26, 'dive',        'Sturzflug',       '30% Chance Gegner zu betäuben (1 Runde ohne Angriff)','Dächer sind seine Jagdgründe, Straßen seine Speisekammer.')
on conflict (id) do update set
  name          = excluded.name,
  emoji         = excluded.emoji,
  rarity        = excluded.rarity,
  guardian_type = excluded.guardian_type,
  role          = excluded.role,
  base_hp       = excluded.base_hp,
  base_atk      = excluded.base_atk,
  base_def      = excluded.base_def,
  base_spd      = excluded.base_spd,
  ability_id    = excluded.ability_id,
  ability_name  = excluded.ability_name,
  ability_desc  = excluded.ability_desc,
  lore          = excluded.lore;

-- ═══════════════════════════════════════════════════════════════════
-- Talent-Nodes: 3 Äste × 5 Tiers × 1 Node = 15 Nodes pro Archetyp
-- Äste: primary = Rollen-Spezialisierung (Wächter-einzigartig)
--       secondary = Typ-Synergie (generisch pro Typ)
--       utility = Generisch (HP/ATK/DEF/SPD-Boni)
-- Pro Tier 1 Node (simpel, mobile-freundlich), prereq = vorheriger Tier.
-- ═══════════════════════════════════════════════════════════════════

-- Utility-Ast: für alle 20 Archetypen identisch (generiert via INSERT ... SELECT)
insert into public.talent_nodes (id, archetype_id, branch, tier, slot, name, description, max_rank, effect_key, effect_per_rank, requires_node_id)
select a.id || '.util.1', a.id, 'utility', 1, 0, 'Ausdauer',          '+3% HP pro Rang',   5, 'hp_pct',   0.03, null                       from public.guardian_archetypes a
union all select a.id || '.util.2', a.id, 'utility', 2, 0, 'Schärfe',           '+3% ATK pro Rang',  5, 'atk_pct',  0.03, a.id || '.util.1'         from public.guardian_archetypes a
union all select a.id || '.util.3', a.id, 'utility', 3, 0, 'Rüstung',           '+3% DEF pro Rang',  5, 'def_pct',  0.03, a.id || '.util.2'         from public.guardian_archetypes a
union all select a.id || '.util.4', a.id, 'utility', 4, 0, 'Flinkheit',         '+3% SPD pro Rang',  5, 'spd_pct',  0.03, a.id || '.util.3'         from public.guardian_archetypes a
union all select a.id || '.util.5', a.id, 'utility', 5, 0, 'Entschlossenheit',  '+2% Krit-Chance',   5, 'crit_pct', 0.02, a.id || '.util.4'         from public.guardian_archetypes a
on conflict do nothing;

-- Secondary-Ast: Typ-spezifisch
-- Infanterie: +Tankiness
insert into public.talent_nodes (id, archetype_id, branch, tier, slot, name, description, max_rank, effect_key, effect_per_rank, requires_node_id)
select a.id || '.sec.1', a.id, 'secondary', 1, 0, 'Stahlhaut',   '+4% DEF pro Rang',       5, 'def_pct',       0.04, null                     from public.guardian_archetypes a where a.guardian_type = 'infantry'
union all select a.id || '.sec.2', a.id, 'secondary', 2, 0, 'Schildfaust', '+3% HP pro Rang',        5, 'hp_pct',        0.03, a.id || '.sec.1' from public.guardian_archetypes a where a.guardian_type = 'infantry'
union all select a.id || '.sec.3', a.id, 'secondary', 3, 0, 'Konter',      '+5% Konter-Chance',      5, 'counter_pct',   0.05, a.id || '.sec.2' from public.guardian_archetypes a where a.guardian_type = 'infantry'
union all select a.id || '.sec.4', a.id, 'secondary', 4, 0, 'Festung',     '−4% erlittener Schaden', 5, 'dmg_reduction', 0.04, a.id || '.sec.3' from public.guardian_archetypes a where a.guardian_type = 'infantry'
union all select a.id || '.sec.5', a.id, 'secondary', 5, 0, 'Unbeugsam',   '10% Chance Stun zu ignorieren', 5, 'stun_resist', 0.10, a.id || '.sec.4' from public.guardian_archetypes a where a.guardian_type = 'infantry'

-- Kavallerie: +Speed/Burst
union all select a.id || '.sec.1', a.id, 'secondary', 1, 0, 'Preschen',      '+4% SPD pro Rang',            5, 'spd_pct',    0.04, null                     from public.guardian_archetypes a where a.guardian_type = 'cavalry'
union all select a.id || '.sec.2', a.id, 'secondary', 2, 0, 'Anreiten',      '+5% ATK in Runde 1',          5, 'r1_atk_pct', 0.05, a.id || '.sec.1' from public.guardian_archetypes a where a.guardian_type = 'cavalry'
union all select a.id || '.sec.3', a.id, 'secondary', 3, 0, 'Sturmlauf',     '+3% Krit-Schaden pro Rang',   5, 'crit_dmg',   0.03, a.id || '.sec.2' from public.guardian_archetypes a where a.guardian_type = 'cavalry'
union all select a.id || '.sec.4', a.id, 'secondary', 4, 0, 'Durchbruch',    'Ignoriert 2% DEF pro Rang',   5, 'pen_pct',    0.02, a.id || '.sec.3' from public.guardian_archetypes a where a.guardian_type = 'cavalry'
union all select a.id || '.sec.5', a.id, 'secondary', 5, 0, 'Reiterwut',     '+10% ATK gegen Scharfschützen', 5, 'vs_marksman',0.10, a.id || '.sec.4' from public.guardian_archetypes a where a.guardian_type = 'cavalry'

-- Scharfschütze: +Krit/Range
union all select a.id || '.sec.1', a.id, 'secondary', 1, 0, 'Scharfer Blick', '+3% Krit-Chance pro Rang',     5, 'crit_pct',   0.03, null                     from public.guardian_archetypes a where a.guardian_type = 'marksman'
union all select a.id || '.sec.2', a.id, 'secondary', 2, 0, 'Schlag ins Ziel','+4% Krit-Schaden pro Rang',    5, 'crit_dmg',   0.04, a.id || '.sec.1' from public.guardian_archetypes a where a.guardian_type = 'marksman'
union all select a.id || '.sec.3', a.id, 'secondary', 3, 0, 'Dehnkraft',      '+3% ATK pro Rang',             5, 'atk_pct',    0.03, a.id || '.sec.2' from public.guardian_archetypes a where a.guardian_type = 'marksman'
union all select a.id || '.sec.4', a.id, 'secondary', 4, 0, 'Deckung',        '+5% Ausweichen pro Rang',      5, 'evade_pct',  0.05, a.id || '.sec.3' from public.guardian_archetypes a where a.guardian_type = 'marksman'
union all select a.id || '.sec.5', a.id, 'secondary', 5, 0, 'Jäger',          '+10% ATK gegen Infanterie',    5, 'vs_infantry',0.10, a.id || '.sec.4' from public.guardian_archetypes a where a.guardian_type = 'marksman'

-- Magier: +Skill-Schaden
union all select a.id || '.sec.1', a.id, 'secondary', 1, 0, 'Intellekt',     '+4% Skill-Schaden pro Rang',   5, 'skill_dmg',   0.04, null                     from public.guardian_archetypes a where a.guardian_type = 'mage'
union all select a.id || '.sec.2', a.id, 'secondary', 2, 0, 'Mana-Fluss',    '−5% Rage-Kosten pro Rang',     5, 'rage_cost',  -0.05, a.id || '.sec.1' from public.guardian_archetypes a where a.guardian_type = 'mage'
union all select a.id || '.sec.3', a.id, 'secondary', 3, 0, 'Arkane Haut',   '+3% DEF pro Rang',             5, 'def_pct',     0.03, a.id || '.sec.2' from public.guardian_archetypes a where a.guardian_type = 'mage'
union all select a.id || '.sec.4', a.id, 'secondary', 4, 0, 'Konzentration', '+10 Start-Rage pro Rang',      5, 'start_rage',  10.0, a.id || '.sec.3' from public.guardian_archetypes a where a.guardian_type = 'mage'
union all select a.id || '.sec.5', a.id, 'secondary', 5, 0, 'Elementarmeister','+5% DoT-Schaden pro Rang',   5, 'dot_dmg',     0.05, a.id || '.sec.4' from public.guardian_archetypes a where a.guardian_type = 'mage'
on conflict do nothing;

-- Primary-Ast: Rollen-spezifisch (dps/tank/support/balanced)
insert into public.talent_nodes (id, archetype_id, branch, tier, slot, name, description, max_rank, effect_key, effect_per_rank, requires_node_id)
-- DPS
select a.id || '.pri.1', a.id, 'primary', 1, 0, 'Schlagkraft',   '+5% ATK pro Rang',             5, 'atk_pct',        0.05, null                     from public.guardian_archetypes a where a.role = 'dps'
union all select a.id || '.pri.2', a.id, 'primary', 2, 0, 'Mordlust',      '+4% Krit-Chance pro Rang',     5, 'crit_pct',       0.04, a.id || '.pri.1' from public.guardian_archetypes a where a.role = 'dps'
union all select a.id || '.pri.3', a.id, 'primary', 3, 0, 'Tödlicher Hieb','+5% Krit-Schaden pro Rang',    5, 'crit_dmg',       0.05, a.id || '.pri.2' from public.guardian_archetypes a where a.role = 'dps'
union all select a.id || '.pri.4', a.id, 'primary', 4, 0, 'Überwältigung', '+3% ATK gegen schwache Gegner',5, 'vs_weak',        0.03, a.id || '.pri.3' from public.guardian_archetypes a where a.role = 'dps'
union all select a.id || '.pri.5', a.id, 'primary', 5, 0, 'Keystone: Berserker','Bei HP<30%: +50% ATK',    1, 'berserker_key',  1.00, a.id || '.pri.4' from public.guardian_archetypes a where a.role = 'dps'
-- TANK
union all select a.id || '.pri.1', a.id, 'primary', 1, 0, 'Wall',            '+6% HP pro Rang',             5, 'hp_pct',         0.06, null                     from public.guardian_archetypes a where a.role = 'tank'
union all select a.id || '.pri.2', a.id, 'primary', 2, 0, 'Dornen',          '+3% reflektierter Schaden',   5, 'thorns_pct',     0.03, a.id || '.pri.1' from public.guardian_archetypes a where a.role = 'tank'
union all select a.id || '.pri.3', a.id, 'primary', 3, 0, 'Unnachgiebig',    '+4% DEF pro Rang',            5, 'def_pct',        0.04, a.id || '.pri.2' from public.guardian_archetypes a where a.role = 'tank'
union all select a.id || '.pri.4', a.id, 'primary', 4, 0, 'Niemals gefallen','+3% Heilung pro erlittenem Treffer', 5, 'heal_on_hit', 0.03, a.id || '.pri.3' from public.guardian_archetypes a where a.role = 'tank'
union all select a.id || '.pri.5', a.id, 'primary', 5, 0, 'Keystone: Bollwerk','1× pro Kampf: absorbiert tödlichen Treffer', 1, 'bollwerk_key', 1.00, a.id || '.pri.4' from public.guardian_archetypes a where a.role = 'tank'
-- SUPPORT
union all select a.id || '.pri.1', a.id, 'primary', 1, 0, 'Schnelldenker',  '+5% SPD pro Rang',             5, 'spd_pct',        0.05, null                     from public.guardian_archetypes a where a.role = 'support'
union all select a.id || '.pri.2', a.id, 'primary', 2, 0, 'Inspiration',    '+3% Rage-Generation',          5, 'rage_gen',       0.03, a.id || '.pri.1' from public.guardian_archetypes a where a.role = 'support'
union all select a.id || '.pri.3', a.id, 'primary', 3, 0, 'Bannung',        '+5% Chance Debuff zu löschen', 5, 'debuff_cleanse', 0.05, a.id || '.pri.2' from public.guardian_archetypes a where a.role = 'support'
union all select a.id || '.pri.4', a.id, 'primary', 4, 0, 'Gebete',         '+4% HP-Regen pro Rang',        5, 'regen_pct',      0.04, a.id || '.pri.3' from public.guardian_archetypes a where a.role = 'support'
union all select a.id || '.pri.5', a.id, 'primary', 5, 0, 'Keystone: Erwachen','1× pro Kampf: volle Rage',  1, 'awaken_key',     1.00, a.id || '.pri.4' from public.guardian_archetypes a where a.role = 'support'
-- BALANCED
union all select a.id || '.pri.1', a.id, 'primary', 1, 0, 'Gleichgewicht', '+3% zu allen Stats pro Rang',   5, 'all_stats_pct',  0.03, null                     from public.guardian_archetypes a where a.role = 'balanced'
union all select a.id || '.pri.2', a.id, 'primary', 2, 0, 'Flexibilität',  '+3% Ausweichen pro Rang',       5, 'evade_pct',      0.03, a.id || '.pri.1' from public.guardian_archetypes a where a.role = 'balanced'
union all select a.id || '.pri.3', a.id, 'primary', 3, 0, 'Pragmatik',     '+3% Schaden gegen volle-HP-Gegner', 5, 'vs_full_hp', 0.03, a.id || '.pri.2' from public.guardian_archetypes a where a.role = 'balanced'
union all select a.id || '.pri.4', a.id, 'primary', 4, 0, 'Ausdauerläufer','Runde 6+: +5% ATK pro Rang',    5, 'late_atk',       0.05, a.id || '.pri.3' from public.guardian_archetypes a where a.role = 'balanced'
union all select a.id || '.pri.5', a.id, 'primary', 5, 0, 'Keystone: Symbiose','+10% aller Stats wenn HP zwischen 40-60%', 1, 'symbiose_key', 1.00, a.id || '.pri.4' from public.guardian_archetypes a where a.role = 'balanced'
on conflict do nothing;

-- ═══════════════════════════════════════════════════════════════════
-- Skills: 5 pro Archetyp (active/passive/combat/role/expertise)
-- Generisches Skillset pro Typ, active-Skill pro Archetyp einzigartig.
-- ═══════════════════════════════════════════════════════════════════

insert into public.archetype_skills (id, archetype_id, skill_slot, name, description, effect_key, base_value, per_level_value, rage_cost)
-- ACTIVE: pro Archetyp einzigartig, mapped auf bestehende ability_id
select a.id || '.active', a.id, 'active',
       a.ability_name,
       a.ability_desc || ' — skalliert pro Stufe +20%',
       a.ability_id,
       1.0, 0.20, 1000
  from public.guardian_archetypes a
on conflict do nothing;

-- PASSIVE: typ-spezifisch
insert into public.archetype_skills (id, archetype_id, skill_slot, name, description, effect_key, base_value, per_level_value, rage_cost)
select a.id || '.passive', a.id, 'passive',
       case a.guardian_type
         when 'infantry' then 'Stählerner Wille'
         when 'cavalry'  then 'Windläufer'
         when 'marksman' then 'Scharfer Blick'
         when 'mage'     then 'Arkane Aura'
       end,
       case a.guardian_type
         when 'infantry' then '+3% DEF pro Stufe'
         when 'cavalry'  then '+3% SPD pro Stufe'
         when 'marksman' then '+2% Krit-Chance pro Stufe'
         when 'mage'     then '+3% Skill-Schaden pro Stufe'
       end,
       case a.guardian_type
         when 'infantry' then 'passive_def'
         when 'cavalry'  then 'passive_spd'
         when 'marksman' then 'passive_crit'
         when 'mage'     then 'passive_skill_dmg'
       end,
       0.0,
       case a.guardian_type when 'marksman' then 0.02 else 0.03 end,
       0
  from public.guardian_archetypes a
on conflict do nothing;

-- COMBAT: triggert bei Ereignis
insert into public.archetype_skills (id, archetype_id, skill_slot, name, description, effect_key, base_value, per_level_value, rage_cost)
select a.id || '.combat', a.id, 'combat',
       case a.role
         when 'dps'      then 'Adrenalin'
         when 'tank'     then 'Trotz'
         when 'support'  then 'Beistand'
         when 'balanced' then 'Instinkt'
       end,
       case a.role
         when 'dps'      then 'Bei Krit-Treffer: +50 Rage (+10 pro Stufe)'
         when 'tank'     then 'Bei erlittenem Treffer: +30 Rage (+10 pro Stufe)'
         when 'support'  then 'Pro Runde: +20 Rage (+5 pro Stufe)'
         when 'balanced' then 'Bei HP unter 50%: +40 Rage (+10 pro Stufe)'
       end,
       case a.role
         when 'dps' then 'combat_rage_on_crit'
         when 'tank' then 'combat_rage_on_hit'
         when 'support' then 'combat_rage_per_round'
         else 'combat_rage_low_hp'
       end,
       case a.role when 'dps' then 50 when 'tank' then 30 when 'support' then 20 else 40 end,
       case a.role when 'support' then 5 else 10 end,
       0
  from public.guardian_archetypes a
on conflict do nothing;

-- ROLE: typ-spezifisch, Counter-Buff
insert into public.archetype_skills (id, archetype_id, skill_slot, name, description, effect_key, base_value, per_level_value, rage_cost)
select a.id || '.role', a.id, 'role',
       case a.guardian_type
         when 'infantry' then 'Phalanx'
         when 'cavalry'  then 'Ansturm'
         when 'marksman' then 'Fernkampf-Meisterschaft'
         when 'mage'     then 'Arkane Durchschlagskraft'
       end,
       case a.guardian_type
         when 'infantry' then '+3% Schaden gegen Kavallerie pro Stufe'
         when 'cavalry'  then '+3% Schaden gegen Scharfschützen pro Stufe'
         when 'marksman' then '+3% Schaden gegen Infanterie pro Stufe'
         when 'mage'     then '+2% Schaden gegen alle Typen pro Stufe'
       end,
       case a.guardian_type
         when 'infantry' then 'role_vs_cavalry'
         when 'cavalry'  then 'role_vs_marksman'
         when 'marksman' then 'role_vs_infantry'
         when 'mage'     then 'role_vs_all'
       end,
       0.0,
       case a.guardian_type when 'mage' then 0.02 else 0.03 end,
       0
  from public.guardian_archetypes a
on conflict do nothing;

-- EXPERTISE: freigeschaltet wenn die anderen 4 alle auf Level 5
insert into public.archetype_skills (id, archetype_id, skill_slot, name, description, effect_key, base_value, per_level_value, rage_cost)
select a.id || '.expertise', a.id, 'expertise',
       a.ability_name || ' — Meisterschaft',
       'Expertise: Aktiv-Skill löst zusätzlich Zweitwirkung aus. +25% Gesamtschaden pro Stufe.',
       a.ability_id || '_expert',
       0.25, 0.25, 0
  from public.guardian_archetypes a
on conflict do nothing;

-- ═══════════════════════════════════════════════════════════════════
-- Shop-Katalog: nur Cosmetics/Convenience/Arena-Pass — kein P2W!
-- ═══════════════════════════════════════════════════════════════════

insert into public.gem_shop_items (id, category, name, description, icon, price_gems, duration_hours, payload, sort) values
  ('xp_boost_1h',       'booster',     'XP-Boost 1h',        '2× XP auf alle gelaufenen km für 1 Stunde', '⚡',  50,    1, '{"xp_multiplier":2}'::jsonb,           10),
  ('xp_boost_4h',       'booster',     'XP-Boost 4h',        '2× XP auf alle gelaufenen km für 4 Stunden','⚡', 150,    4, '{"xp_multiplier":2}'::jsonb,           11),
  ('xp_boost_24h',      'booster',     'XP-Boost 24h',       '2× XP für einen ganzen Lauftag',            '🌟', 500,   24, '{"xp_multiplier":2}'::jsonb,           12),
  ('respec_token',      'convenience', 'Respec-Token',       'Talentbaum einmalig kostenlos neu vergeben','🔄', 200, null, '{"respec_guardians":1}'::jsonb,         20),
  ('extra_loadout',     'convenience', 'Extra Build-Slot',   '+1 Loadout-Speicher pro Wächter',           '💾', 300, null, '{"extra_loadouts":1}'::jsonb,           21),
  ('arena_pass_month',  'arena_pass',  'Arena-Pass (30 Tage)','Täglich 20 Edelsteine · 1,5× XP · exklusive Skins','🎫', 999,  720, '{"xp_multiplier":1.5,"daily_gems":20}'::jsonb, 1),
  ('skin_paladin_gold', 'cosmetic',    'Gold-Paladin',       'Legendärer Skin für Paladin',               '👑', 800, null, '{"skin_id":"paladin_gold","archetype":"eber"}'::jsonb, 30),
  ('skin_drache_void',  'cosmetic',    'Void-Drache',        'Schatten-Skin für Erzmagier',               '🌑', 1200, null,'{"skin_id":"drache_void","archetype":"drache"}'::jsonb, 31),
  ('pin_theme_neon',    'cosmetic',    'Neon-Pin-Theme',     'Karten-Pins im Neon-Glow',                  '💠', 400, null, '{"pin_theme":"neon"}'::jsonb,           40),
  ('crew_emblem_pro',   'crew_emblem', 'Crew-Emblem Pro',    'Eigenes Logo + Farben + Banner',            '🏳️', 600, null, '{"emblem_pro":true}'::jsonb,            50)
on conflict (id) do update set
  name = excluded.name, description = excluded.description, icon = excluded.icon,
  price_gems = excluded.price_gems, duration_hours = excluded.duration_hours,
  payload = excluded.payload, sort = excluded.sort, active = true;
