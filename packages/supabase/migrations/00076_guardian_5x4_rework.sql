-- ══════════════════════════════════════════════════════════════════════════
-- Wächter-Komplett-Rework: 60 → 20 Archetypen (5x4 Rarity, gemischte Klassen)
-- ══════════════════════════════════════════════════════════════════════════
-- Bewusste Daten-Vernichtung: alle Spieler-Wächter, Talent-Allokationen, Skill-
-- Levels, Trophäen, Loadouts, runner_fights, arena_battles werden geleert. Der
-- Schritt ist akzeptiert ("alles neu" Vorgabe). Saisons + Inventar bleiben.
--
-- Außerdem:
--  - neue Spalte `species` für unterscheidbare Bild-/Video-Prompts
--  - neue Spalte `gender` für deterministisches Subject-Profil im Prompt-Gen
--  - 4 Rarity-Tiers: common/elite/epic/legendary (5 Stück je Tier)
--  - pro Tier: gemischte Klassen (tank/support/ranged/melee)
--  - Talente + Skills neu generiert (basierend auf class_id, nicht legacy role)
-- ══════════════════════════════════════════════════════════════════════════

-- ─── 1) Spieler-State leeren ──────────────────────────────────────────────
-- Robust gegenüber unterschiedlichen Schema-Ständen: nur truncaten was existiert.
do $$
declare
  t text;
  candidates text[] := array[
    'guardian_skill_levels',
    'guardian_talents',
    'crew_guardians',
    'user_guardians',
    'user_guardians_archive',
    'guardian_trophies',
    'guardian_equipment',
    'runner_fights',
    'runner_fight_state',
    'arena_battles',
    'arena_streaks'
  ];
begin
  foreach t in array candidates loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t) then
      execute format('truncate table public.%I restart identity cascade', t);
      raise notice 'Truncated public.%', t;
    else
      raise notice 'Skipped public.% (does not exist)', t;
    end if;
  end loop;
end $$;

-- ─── 2) Archetypen + Talente + Skills wegwerfen ───────────────────────────
delete from public.archetype_skills;
delete from public.talent_nodes;
delete from public.guardian_archetypes;

-- ─── 3) Schema-Erweiterungen ──────────────────────────────────────────────
alter table public.guardian_archetypes
  add column if not exists species text,
  add column if not exists gender  text check (gender in ('male','female','neutral'));

create index if not exists idx_archetypes_species on public.guardian_archetypes(species);

-- Rarity-Constraint enthält schon common/elite/epic/legendary (00020) — nichts zu tun.

-- ─── 4) 20 neue Archetypen ────────────────────────────────────────────────
-- Verteilung pro Rarity: 1 tank, 1 support, 1-2 melee, 1-2 ranged
-- Spezies-Mix: human, elf, orc, beast, construct, spirit, undead, demon,
--              celestial, dragonkin, cosmic, bird, desert
-- guardian_type wird zur Backward-Compat gesetzt (tank→infantry, melee→cavalry,
-- ranged→marksman, support→mage). class_id ist die neue Wahrheit.

-- role-Werte sind die NEUEN Sub-Rollen aus Migration 00073:
--   tank:    krieger / ritter / paladin / berserker
--   support: priester / schamane / kleriker / orakel
--   ranged:  magier / bogenschuetze / hexer / runenmeister
--   melee:   schurke / moench / samurai / ninja

insert into public.guardian_archetypes
  (id, name, emoji, rarity, class_id, guardian_type, role, species, gender,
   base_hp, base_atk, base_def, base_spd,
   ability_id, ability_name, ability_desc, lore)
values
  -- ═══ COMMON (5) ═════════════════════════════════════════════════════════
  ('garm_steinhand',         'Garm Steinhand',          '🗿', 'common', 'tank',    'infantry', 'ritter',        'construct', 'male',
    110, 14, 18, 12, 'wall',      'Bollwerk',       '+20% DEF in der ersten Runde',                'Aus dem Fels der ältesten Bastion geschnitten — er kennt jeden Stein.'),
  ('vex_tunnelkralle',       'Vex Tunnelkralle',        '🐀', 'common', 'melee',   'cavalry',  'schurke',       'beast',     'female',
     85, 18, 10, 26, 'ambush',    'Tunnelbiss',     '+50% ATK bei erstem Treffer',                 'Kennt jeden Schacht und jede Beute, die durch ihn läuft.'),
  ('lyra_lebensquell',       'Lyra Lebensquell',        '🌿', 'common', 'support', 'mage',     'kleriker',      'human',     'female',
     95, 14, 14, 18, 'focus',     'Lebensquell',    'Ignoriert 50% DEF bei kritischen Treffern',   'Ihre Tinkturen halten ganze Karawanen am Leben.'),
  ('aelron_pfeilseele',      'Aelron Pfeilseele',       '🏹', 'common', 'ranged',  'marksman', 'bogenschuetze', 'human',     'male',
     90, 17, 12, 20, 'focus',     'Ruhiger Atem',   'Ignoriert 50% DEF bei kritischen Treffern',   'Hat mehr Pfeile gezählt als Sterne gesehen.'),
  ('aetherschwarm',          'Aetherschwarm',           '🍄', 'common', 'ranged',  'mage',     'hexer',         'spirit',    'neutral',
     80, 15, 12, 22, 'poison',    'Sporenwolke',    '5% HP des Gegners pro Runde (max 3)',         'Schwebende Sporen, halb lebendig, halb Geist — manchmal heilen sie, manchmal zersetzen sie.'),

  -- ═══ ELITE (5) ══════════════════════════════════════════════════════════
  ('mira_doppelklinge',      'Mira Doppelklinge',       '⚔️', 'elite',  'melee',   'cavalry',  'samurai',       'human',     'female',
    120, 24, 16, 26, 'ambush',    'Doppelhieb',     '+50% ATK bei erstem Treffer',                 'Zwei Klingen, ein Atemzug — und du blutest schon.'),
  ('aelina_frostherz',       'Aelina Frostherz',        '❄️', 'elite',  'support', 'mage',     'schamane',      'elf',       'female',
    110, 20, 18, 22, 'rebirth',   'Frostatem',      'Einmal pro Kampf: voll geheilt bei 0 HP',     'Sie atmet die Kälte des Polarsterns.'),
  ('brogar_stahlkiefer',     'Brogar Stahlkiefer',      '🛡️', 'elite',  'tank',    'infantry', 'krieger',       'orc',       'male',
    140, 22, 24, 14, 'fortress',  'Stahlkiefer',    '+30% DEF wenn Arena in eigener Stadt',        'Drei Tonnen Muskel und ein einziger Befehl: HALT.'),
  ('khael_sturmfluegel',     'Khael Sturmflügel',       '🪶', 'elite',  'ranged',  'marksman', 'bogenschuetze', 'bird',      'male',
    105, 25, 15, 28, 'echolot',   'Sturzschuss',    'Trifft immer zuerst in Runde 1',              'Federvolk vom Hochgebirge — er schießt mit dem Wind.'),
  ('nyx_schattenfaust',      'Nyx Schattenfaust',       '👻', 'elite',  'melee',   'cavalry',  'ninja',         'spirit',    'female',
    100, 24, 13, 30, 'stealth',   'Schattenfaust',  '25% Chance einen Angriff zu verdoppeln',      'Ein Echo aus den vergessenen Etagen — sie war nie ganz fort.'),

  -- ═══ EPIC (5) ═══════════════════════════════════════════════════════════
  ('pyron_schmelzkoenig',    'Pyron der Schmelzkönig',  '🌋', 'epic',   'tank',    'infantry', 'berserker',     'construct', 'male',
    200, 28, 32, 14, 'fortress',  'Glühender Kern', '+30% DEF wenn Arena in eigener Stadt',        'Die Adern fließen mit flüssigem Gestein.'),
  ('zarya_plasmaherz',       'Zarya Plasmaherz',        '⚡', 'epic',   'ranged',  'mage',     'magier',        'human',     'female',
    140, 32, 18, 24, 'flame',     'Plasma-Sturm',   'Gegner verliert 10% HP pro Runde (ignoriert DEF)','Ihre Zauber knistern in der Luft, lange nachdem sie geht.'),
  ('krax_sumpfprophet',      'Krax der Sumpfprophet',   '🐸', 'epic',   'support', 'mage',     'schamane',      'beast',     'male',
    150, 26, 22, 22, 'poison',    'Hexbrühe',       '5% HP des Gegners pro Runde (max 3)',         'Sein Lachen klingt wie Quaken — sein Fluch wirkt wie Stein.'),
  ('selwyn_mondklinge',      'Selwyn Mondklinge',       '🗡️', 'epic',   'melee',   'cavalry',  'ninja',         'elf',       'female',
    135, 32, 18, 30, 'stealth',   'Mondklinge',     '25% Chance einen Angriff zu verdoppeln',      'Drei Schritte vorwärts, ein Schritt zurück — und du bist tot.'),
  ('dahir_sandwueter',       'Dahir Sandwüter',         '🗡️', 'epic',   'melee',   'cavalry',  'schurke',       'desert',    'male',
    160, 30, 24, 22, 'rage',      'Wüstenwut',      '+5% ATK pro erlittenem Treffer (max +40%)',   'Je mehr du ihn schlägst, desto mehr Wüste atmet er ein.'),

  -- ═══ LEGENDARY (5) ══════════════════════════════════════════════════════
  ('vyrana_drachenherz',     'Vyrana Drachenherz',      '🐉', 'legendary','ranged','marksman','bogenschuetze',  'dragonkin', 'female',
    180, 38, 26, 30, 'firststrike','Drachenspeer',  'Erste Runde: +100% ATK, immer kritisch',      'Halb Drache, halb Mensch — ganz Krieg.'),
  ('seraphiel_lichtbringer', 'Seraphiel Lichtbringer',  '✨', 'legendary','support','mage',    'priester',       'celestial', 'male',
    170, 34, 26, 28, 'rebirth',   'Goldenes Licht', 'Einmal pro Kampf: voll geheilt bei 0 HP',     'Sechs Schwingen, zwei Welten — er steht zwischen den Reichen.'),
  ('mortugar_knochenkoenig', 'Mortugar Knochenkönig',   '💀', 'legendary','tank',   'infantry','paladin',        'undead',    'male',
    240, 32, 36, 16, 'fortress',  'Untote Krone',   '+30% DEF wenn Arena in eigener Stadt',        'Tot war er gestern. Heute ist er König.'),
  ('inferos_vulkanklinge',   'Inferos Vulkanklinge',    '🔥', 'legendary','melee',  'cavalry', 'samurai',        'demon',     'male',
    200, 42, 28, 24, 'flame',     'Lavahieb',       'Gegner verliert 10% HP pro Runde (ignoriert DEF)','Ein Hieb genügt — der Rest brennt von selbst.'),
  ('astraea_sternensang',    'Astraea Sternensang',     '🌌', 'legendary','ranged', 'marksman','runenmeister',   'cosmic',    'female',
    175, 36, 24, 32, 'focus',     'Sternenruf',     'Ignoriert 50% DEF bei kritischen Treffern',   'Sie singt die Konstellationen — und der Himmel hört zu.');

-- ─── 5) Talente — Utility-Ast (für ALLE 20 identisch) ─────────────────────
insert into public.talent_nodes (id, archetype_id, branch, tier, slot, name, description, max_rank, effect_key, effect_per_rank, requires_node_id)
select a.id || '.util.1', a.id, 'utility', 1, 0, 'Ausdauer',         '+3% HP pro Rang',  5, 'hp_pct',   0.03, null                       from public.guardian_archetypes a
union all select a.id || '.util.2', a.id, 'utility', 2, 0, 'Schärfe',          '+3% ATK pro Rang', 5, 'atk_pct',  0.03, a.id || '.util.1' from public.guardian_archetypes a
union all select a.id || '.util.3', a.id, 'utility', 3, 0, 'Rüstung',          '+3% DEF pro Rang', 5, 'def_pct',  0.03, a.id || '.util.2' from public.guardian_archetypes a
union all select a.id || '.util.4', a.id, 'utility', 4, 0, 'Flinkheit',        '+3% SPD pro Rang', 5, 'spd_pct',  0.03, a.id || '.util.3' from public.guardian_archetypes a
union all select a.id || '.util.5', a.id, 'utility', 5, 0, 'Entschlossenheit', '+2% Krit-Chance',  5, 'crit_pct', 0.02, a.id || '.util.4' from public.guardian_archetypes a;

-- ─── 6) Talente — Secondary-Ast (klassen-spezifisch) ──────────────────────
-- TANK: HP/DEF/Konter/DR/Stun-Resist
insert into public.talent_nodes (id, archetype_id, branch, tier, slot, name, description, max_rank, effect_key, effect_per_rank, requires_node_id)
select a.id || '.sec.1', a.id, 'secondary', 1, 0, 'Stahlhaut',  '+4% DEF pro Rang',          5, 'def_pct',       0.04, null                     from public.guardian_archetypes a where a.class_id = 'tank'
union all select a.id || '.sec.2', a.id, 'secondary', 2, 0, 'Schildfaust','+3% HP pro Rang',           5, 'hp_pct',        0.03, a.id || '.sec.1' from public.guardian_archetypes a where a.class_id = 'tank'
union all select a.id || '.sec.3', a.id, 'secondary', 3, 0, 'Konter',     '+5% Konter-Chance pro Rang',5, 'counter_pct',   0.05, a.id || '.sec.2' from public.guardian_archetypes a where a.class_id = 'tank'
union all select a.id || '.sec.4', a.id, 'secondary', 4, 0, 'Festung',    '−4% erlittener Schaden',    5, 'dmg_reduction', 0.04, a.id || '.sec.3' from public.guardian_archetypes a where a.class_id = 'tank'
union all select a.id || '.sec.5', a.id, 'secondary', 5, 0, 'Unbeugsam',  '10% Chance Stun zu ignorieren', 5, 'stun_resist', 0.10, a.id || '.sec.4' from public.guardian_archetypes a where a.class_id = 'tank'
-- MELEE: SPD/Burst/Krit/Penetration
union all select a.id || '.sec.1', a.id, 'secondary', 1, 0, 'Preschen',    '+4% SPD pro Rang',           5, 'spd_pct',    0.04, null                     from public.guardian_archetypes a where a.class_id = 'melee'
union all select a.id || '.sec.2', a.id, 'secondary', 2, 0, 'Anreiten',    '+5% ATK in Runde 1',         5, 'r1_atk_pct', 0.05, a.id || '.sec.1' from public.guardian_archetypes a where a.class_id = 'melee'
union all select a.id || '.sec.3', a.id, 'secondary', 3, 0, 'Sturmlauf',   '+3% Krit-Schaden pro Rang',  5, 'crit_dmg',   0.03, a.id || '.sec.2' from public.guardian_archetypes a where a.class_id = 'melee'
union all select a.id || '.sec.4', a.id, 'secondary', 4, 0, 'Durchbruch',  'Ignoriert 2% DEF pro Rang',  5, 'pen_pct',    0.02, a.id || '.sec.3' from public.guardian_archetypes a where a.class_id = 'melee'
union all select a.id || '.sec.5', a.id, 'secondary', 5, 0, 'Klingenwut',  '+10% ATK gegen Support',     5, 'vs_marksman',0.10, a.id || '.sec.4' from public.guardian_archetypes a where a.class_id = 'melee'
-- RANGED: Krit/Krit-Schaden/ATK/Evade
union all select a.id || '.sec.1', a.id, 'secondary', 1, 0, 'Scharfer Blick',  '+3% Krit-Chance pro Rang',  5, 'crit_pct',   0.03, null                     from public.guardian_archetypes a where a.class_id = 'ranged'
union all select a.id || '.sec.2', a.id, 'secondary', 2, 0, 'Schlag ins Ziel', '+4% Krit-Schaden pro Rang', 5, 'crit_dmg',   0.04, a.id || '.sec.1' from public.guardian_archetypes a where a.class_id = 'ranged'
union all select a.id || '.sec.3', a.id, 'secondary', 3, 0, 'Dehnkraft',       '+3% ATK pro Rang',          5, 'atk_pct',    0.03, a.id || '.sec.2' from public.guardian_archetypes a where a.class_id = 'ranged'
union all select a.id || '.sec.4', a.id, 'secondary', 4, 0, 'Deckung',         '+5% Ausweichen pro Rang',   5, 'evade_pct',  0.05, a.id || '.sec.3' from public.guardian_archetypes a where a.class_id = 'ranged'
union all select a.id || '.sec.5', a.id, 'secondary', 5, 0, 'Jäger',           '+10% ATK gegen Tank',       5, 'vs_infantry',0.10, a.id || '.sec.4' from public.guardian_archetypes a where a.class_id = 'ranged'
-- SUPPORT: Skill-DMG/Mana/Regen/Cleanse
union all select a.id || '.sec.1', a.id, 'secondary', 1, 0, 'Intellekt',       '+4% Skill-Schaden pro Rang',5, 'skill_dmg',  0.04, null                     from public.guardian_archetypes a where a.class_id = 'support'
union all select a.id || '.sec.2', a.id, 'secondary', 2, 0, 'Mana-Fluss',      '−5% Rage-Kosten pro Rang',  5, 'rage_cost', -0.05, a.id || '.sec.1' from public.guardian_archetypes a where a.class_id = 'support'
union all select a.id || '.sec.3', a.id, 'secondary', 3, 0, 'Arkane Haut',     '+3% DEF pro Rang',          5, 'def_pct',    0.03, a.id || '.sec.2' from public.guardian_archetypes a where a.class_id = 'support'
union all select a.id || '.sec.4', a.id, 'secondary', 4, 0, 'Konzentration',   '+10 Start-Rage pro Rang',   5, 'start_rage', 10.0, a.id || '.sec.3' from public.guardian_archetypes a where a.class_id = 'support'
union all select a.id || '.sec.5', a.id, 'secondary', 5, 0, 'Elementarmeister','+5% DoT-Schaden pro Rang',  5, 'dot_dmg',    0.05, a.id || '.sec.4' from public.guardian_archetypes a where a.class_id = 'support';

-- ─── 7) Talente — Primary-Ast (klassen-spezifischer Keystone) ─────────────
insert into public.talent_nodes (id, archetype_id, branch, tier, slot, name, description, max_rank, effect_key, effect_per_rank, requires_node_id)
-- TANK keystone
select a.id || '.pri.1', a.id, 'primary', 1, 0, 'Wall',              '+6% HP pro Rang',                    5, 'hp_pct',          0.06, null                    from public.guardian_archetypes a where a.class_id = 'tank'
union all select a.id || '.pri.2', a.id, 'primary', 2, 0, 'Dornen',            '+3% reflektierter Schaden',          5, 'thorns_pct',      0.03, a.id || '.pri.1' from public.guardian_archetypes a where a.class_id = 'tank'
union all select a.id || '.pri.3', a.id, 'primary', 3, 0, 'Unnachgiebig',      '+4% DEF pro Rang',                   5, 'def_pct',         0.04, a.id || '.pri.2' from public.guardian_archetypes a where a.class_id = 'tank'
union all select a.id || '.pri.4', a.id, 'primary', 4, 0, 'Niemals gefallen',  '+3% Heilung pro erlittenem Treffer', 5, 'heal_on_hit',     0.03, a.id || '.pri.3' from public.guardian_archetypes a where a.class_id = 'tank'
union all select a.id || '.pri.5', a.id, 'primary', 5, 0, 'Keystone: Bollwerk','1× pro Kampf: absorbiert tödlichen Treffer', 1, 'bollwerk_key', 1.00, a.id || '.pri.4' from public.guardian_archetypes a where a.class_id = 'tank'
-- MELEE keystone
union all select a.id || '.pri.1', a.id, 'primary', 1, 0, 'Schlagkraft',          '+5% ATK pro Rang',           5, 'atk_pct',       0.05, null                    from public.guardian_archetypes a where a.class_id = 'melee'
union all select a.id || '.pri.2', a.id, 'primary', 2, 0, 'Mordlust',             '+4% Krit-Chance pro Rang',   5, 'crit_pct',      0.04, a.id || '.pri.1' from public.guardian_archetypes a where a.class_id = 'melee'
union all select a.id || '.pri.3', a.id, 'primary', 3, 0, 'Tödlicher Hieb',       '+5% Krit-Schaden pro Rang',  5, 'crit_dmg',      0.05, a.id || '.pri.2' from public.guardian_archetypes a where a.class_id = 'melee'
union all select a.id || '.pri.4', a.id, 'primary', 4, 0, 'Überwältigung',        '+3% ATK gegen schwache Gegner', 5, 'vs_weak',    0.03, a.id || '.pri.3' from public.guardian_archetypes a where a.class_id = 'melee'
union all select a.id || '.pri.5', a.id, 'primary', 5, 0, 'Keystone: Berserker', 'Bei HP<30%: +50% ATK',         1, 'berserker_key', 1.00, a.id || '.pri.4' from public.guardian_archetypes a where a.class_id = 'melee'
-- RANGED keystone
union all select a.id || '.pri.1', a.id, 'primary', 1, 0, 'Präzision',         '+5% ATK pro Rang',                       5, 'atk_pct',      0.05, null                    from public.guardian_archetypes a where a.class_id = 'ranged'
union all select a.id || '.pri.2', a.id, 'primary', 2, 0, 'Ferne Bahn',        '+4% Krit-Chance pro Rang',               5, 'crit_pct',     0.04, a.id || '.pri.1' from public.guardian_archetypes a where a.class_id = 'ranged'
union all select a.id || '.pri.3', a.id, 'primary', 3, 0, 'Tiefe Pfeile',      '+5% Krit-Schaden pro Rang',              5, 'crit_dmg',     0.05, a.id || '.pri.2' from public.guardian_archetypes a where a.class_id = 'ranged'
union all select a.id || '.pri.4', a.id, 'primary', 4, 0, 'Überraschung',      '+3% ATK gegen volle-HP-Gegner',          5, 'vs_full_hp',   0.03, a.id || '.pri.3' from public.guardian_archetypes a where a.class_id = 'ranged'
union all select a.id || '.pri.5', a.id, 'primary', 5, 0, 'Keystone: Erstschlag','Runde 1: +100% ATK, immer kritisch',   1, 'firststrike_key', 1.00, a.id || '.pri.4' from public.guardian_archetypes a where a.class_id = 'ranged'
-- SUPPORT keystone
union all select a.id || '.pri.1', a.id, 'primary', 1, 0, 'Schnelldenker',     '+5% SPD pro Rang',             5, 'spd_pct',        0.05, null                    from public.guardian_archetypes a where a.class_id = 'support'
union all select a.id || '.pri.2', a.id, 'primary', 2, 0, 'Inspiration',       '+3% Rage-Generation pro Rang', 5, 'rage_gen',       0.03, a.id || '.pri.1' from public.guardian_archetypes a where a.class_id = 'support'
union all select a.id || '.pri.3', a.id, 'primary', 3, 0, 'Bannung',           '+5% Chance Debuff zu löschen', 5, 'debuff_cleanse', 0.05, a.id || '.pri.2' from public.guardian_archetypes a where a.class_id = 'support'
union all select a.id || '.pri.4', a.id, 'primary', 4, 0, 'Gebete',            '+4% HP-Regen pro Rang',        5, 'regen_pct',      0.04, a.id || '.pri.3' from public.guardian_archetypes a where a.class_id = 'support'
union all select a.id || '.pri.5', a.id, 'primary', 5, 0, 'Keystone: Erwachen','1× pro Kampf: volle Rage',     1, 'awaken_key',     1.00, a.id || '.pri.4' from public.guardian_archetypes a where a.class_id = 'support';

-- ─── 8) Skills — Active (pro Archetyp einzigartig, mapped auf ability_id) ─
insert into public.archetype_skills (id, archetype_id, skill_slot, name, description, effect_key, base_value, per_level_value, rage_cost)
select a.id || '.active', a.id, 'active',
       a.ability_name,
       a.ability_desc || ' — skaliert pro Stufe +20%',
       a.ability_id,
       1.0, 0.20, 1000
  from public.guardian_archetypes a;

-- ─── 9) Skills — Passive (klassen-spezifisch) ─────────────────────────────
insert into public.archetype_skills (id, archetype_id, skill_slot, name, description, effect_key, base_value, per_level_value, rage_cost)
select a.id || '.passive', a.id, 'passive',
       case a.class_id
         when 'tank'    then 'Stählerner Wille'
         when 'melee'   then 'Windläufer'
         when 'ranged'  then 'Adlerauge'
         when 'support' then 'Arkane Aura'
       end,
       case a.class_id
         when 'tank'    then '+3% DEF pro Stufe'
         when 'melee'   then '+3% SPD pro Stufe'
         when 'ranged'  then '+2% Krit-Chance pro Stufe'
         when 'support' then '+3% Skill-Schaden pro Stufe'
       end,
       case a.class_id
         when 'tank'    then 'passive_def'
         when 'melee'   then 'passive_spd'
         when 'ranged'  then 'passive_crit'
         when 'support' then 'passive_skill_dmg'
       end,
       0.0,
       case a.class_id when 'ranged' then 0.02 else 0.03 end,
       0
  from public.guardian_archetypes a;

-- ─── 10) Skills — Combat (rollen-spezifisch über class_id) ────────────────
insert into public.archetype_skills (id, archetype_id, skill_slot, name, description, effect_key, base_value, per_level_value, rage_cost)
select a.id || '.combat', a.id, 'combat',
       case a.class_id
         when 'tank'    then 'Trotz'
         when 'melee'   then 'Adrenalin'
         when 'ranged'  then 'Konzentration'
         when 'support' then 'Beistand'
       end,
       case a.class_id
         when 'tank'    then 'Bei erlittenem Treffer: +30 Rage (+10 pro Stufe)'
         when 'melee'   then 'Bei Krit-Treffer: +50 Rage (+10 pro Stufe)'
         when 'ranged'  then 'Bei Krit-Treffer: +40 Rage (+10 pro Stufe)'
         when 'support' then 'Pro Runde: +20 Rage (+5 pro Stufe)'
       end,
       case a.class_id
         when 'tank'    then 'combat_rage_on_hit'
         when 'melee'   then 'combat_rage_on_crit'
         when 'ranged'  then 'combat_rage_on_crit'
         when 'support' then 'combat_rage_per_round'
       end,
       case a.class_id when 'tank' then 30 when 'melee' then 50 when 'ranged' then 40 else 20 end,
       case a.class_id when 'support' then 5 else 10 end,
       0
  from public.guardian_archetypes a;

-- ─── 11) Skills — Role (Klassen-Counter-Buff) ─────────────────────────────
insert into public.archetype_skills (id, archetype_id, skill_slot, name, description, effect_key, base_value, per_level_value, rage_cost)
select a.id || '.role', a.id, 'role',
       case a.class_id
         when 'tank'    then 'Phalanx'
         when 'melee'   then 'Ansturm'
         when 'ranged'  then 'Fernkampf-Meisterschaft'
         when 'support' then 'Arkane Durchschlagskraft'
       end,
       case a.class_id
         when 'tank'    then '+3% Schaden gegen Nahkämpfer pro Stufe'
         when 'melee'   then '+3% Schaden gegen Support pro Stufe'
         when 'ranged'  then '+3% Schaden gegen Tank pro Stufe'
         when 'support' then '+2% Schaden gegen alle Klassen pro Stufe'
       end,
       case a.class_id
         when 'tank'    then 'role_vs_melee'
         when 'melee'   then 'role_vs_support'
         when 'ranged'  then 'role_vs_tank'
         when 'support' then 'role_vs_all'
       end,
       0.0,
       case a.class_id when 'support' then 0.02 else 0.03 end,
       0
  from public.guardian_archetypes a;

-- ─── 12) Skills — Expertise (alle anderen 4 auf Lvl 5 freischalten) ──────
insert into public.archetype_skills (id, archetype_id, skill_slot, name, description, effect_key, base_value, per_level_value, rage_cost)
select a.id || '.expertise', a.id, 'expertise',
       a.ability_name || ' — Meisterschaft',
       'Expertise: Aktiv-Skill löst zusätzlich Zweitwirkung aus. +25% Gesamtschaden pro Stufe.',
       a.ability_id || '_expert',
       0.25, 0.25, 0
  from public.guardian_archetypes a;

-- ─── 13) Sanity-Check ─────────────────────────────────────────────────────
do $$
declare
  v_count int;
  v_per_rarity record;
  v_per_class  record;
begin
  select count(*) into v_count from public.guardian_archetypes;
  if v_count <> 20 then
    raise exception 'Erwartet 20 Wächter nach Rework, gefunden %', v_count;
  end if;

  for v_per_rarity in
    select rarity, count(*) as n from public.guardian_archetypes group by rarity order by rarity
  loop
    raise notice 'Rarity %: % Wächter', v_per_rarity.rarity, v_per_rarity.n;
    if v_per_rarity.n <> 5 then
      raise exception 'Rarity % hat % Wächter (erwartet 5)', v_per_rarity.rarity, v_per_rarity.n;
    end if;
  end loop;

  for v_per_class in
    select class_id, count(*) as n from public.guardian_archetypes group by class_id order by class_id
  loop
    raise notice 'Klasse %: % Wächter', v_per_class.class_id, v_per_class.n;
  end loop;
end $$;
