-- ════════════════════════════════════════════════════════════════════
-- PASS B — Definitionen auf Crew/Stadt-Thematik umbenennen
-- + alle Abkürzungen aus DB-Beschreibungen entfernen
-- ════════════════════════════════════════════════════════════════════
-- Betroffene Tabellen:
--   • research_definitions   (Forschungs-Tree, 00097/00102/00105)
--   • talent_nodes           (Wächter-Talente, 00076)
--   • archetype_skills       (Wächter-Skills, 00076)
--
-- Mapping HP→Leben, ATK→Angriff, DEF→Verteidigung, SPD→Tempo,
-- "Crit"→"Kritisch", IDs bleiben stabil (keine Code-Brüche).
-- Truppen-Klassen heißen bei uns Türsteher/Kuriere/Schleuderer/Brecher
-- (Crew-Vibe statt Mittelalter-Generik).
-- ════════════════════════════════════════════════════════════════════

-- ─── 1) Economy-Forschungen ────────────────────────────────────────
update public.research_definitions set
  name = 'Schrott-Sammler', emoji = '🪵', description = '+5% Holz pro Stufe — mehr Paletten und Verschnitt-Holz aus dem Kiez.'
  where id = 'eco_holzfaeller';
update public.research_definitions set
  name = 'Pflasterstein-Aufbruch', emoji = '🪨', description = '+5% Stein pro Stufe — Bordstein und Pflaster werden zum Baumaterial.'
  where id = 'eco_steinbruch';
update public.research_definitions set
  name = 'Schwarzmarkt-Kontakte', emoji = '🪙', description = '+5% Gold pro Stufe — bessere Deals beim Hinterhof-Tausch.'
  where id = 'eco_handel';
update public.research_definitions set
  name = 'Hinterhof-Depot', emoji = '📦', description = '+10% Lager-Kapazität pro Stufe — größere Vorratskammern.'
  where id = 'eco_lager';
update public.research_definitions set
  name = 'Coffein-Tanks', emoji = '💧', description = '+5% Mana pro Stufe — die Crew bleibt länger wach.'
  where id = 'eco_manaernte';
update public.research_definitions set
  name = 'Bauholz-Beschaffung', emoji = '🌲', description = '+8% Holz pro Stufe (Stufe 2) — Profi-Lieferanten an der Hand.'
  where id = 'eco_forstwirtschaft';
update public.research_definitions set
  name = 'Goldkanten-Schleifer', emoji = '🥇', description = '+8% Gold pro Stufe (Stufe 2) — höhere Marge beim Verkauf.'
  where id = 'eco_goldverarbeitung';
update public.research_definitions set
  name = 'Asphalt-Aufbruch', emoji = '⛏️', description = '+8% Stein pro Stufe (Stufe 2) — auch Beton bricht.'
  where id = 'eco_eisenbearbeitung';
update public.research_definitions set
  name = 'Lager-Architektur', emoji = '🏛️', description = '+10% Lager-Kapazität pro Stufe (Stufe 2) — clever gestapelt.'
  where id = 'eco_architektur';
update public.research_definitions set
  name = 'Schwarz-Stipendium', emoji = '📜', description = '+3% Forschungs-Tempo pro Stufe — schaltet höhere Stufen frei.'
  where id = 'eco_stipendium';
update public.research_definitions set
  name = 'Lücken-Aufspüren', emoji = '🎯', description = '+5% Sammel-Tempo (außer Lauf-Drops).'
  where id = 'eco_schwachpunkte';
update public.research_definitions set
  name = 'Edelstein-Hehler', emoji = '💎', description = 'Schaltet seltene Edelstein-Drops aus Truhen frei.'
  where id = 'eco_edelstein';
update public.research_definitions set
  name = 'Lieferketten', emoji = '🚚', description = '+5% Bonus auf Crew-Resourcen-Spenden.'
  where id = 'eco_lieferketten';
update public.research_definitions set
  name = 'Vollgas-Wirtschaft', emoji = '🏆', description = '+3% ALLE Resourcen pro Stufe (Endgame-Forschung).'
  where id = 'eco_schlaraffenland';

-- ─── 2) Military-Forschungen (Klassen-Namen anpassen) ──────────────
update public.research_definitions set
  name = 'Türsteher-Training', emoji = '🛡️', description = '+3% Türsteher-Angriff pro Stufe.'
  where id = 'mil_infanterie';
update public.research_definitions set
  name = 'Kurier-Ausbildung', emoji = '🏍️', description = '+3% Kurier-Angriff pro Stufe.'
  where id = 'mil_reiterei';
update public.research_definitions set
  name = 'Schleuderer-Drill', emoji = '🎯', description = '+3% Schleuderer-Angriff pro Stufe.'
  where id = 'mil_schiesskunst';
update public.research_definitions set
  name = 'Straßen-Taktik', emoji = '🎯', description = '+5% Truppen-Leben pro Stufe — bessere Deckung im Kiez.'
  where id = 'mil_tactical';
update public.research_definitions set
  name = 'Brecher-Werkstatt', emoji = '🔨', description = '+3% Brecher-Angriff pro Stufe.'
  where id = 'mil_magie';

update public.research_definitions set
  name = 'Türsteher-Schutz', emoji = '🛡️', description = '+4% Türsteher-Verteidigung pro Stufe.'
  where id = 'mil_infanterieschutz';
update public.research_definitions set
  name = 'Kurier-Schutz', emoji = '🛡️', description = '+4% Kurier-Verteidigung pro Stufe.'
  where id = 'mil_kavallerieschutz';
update public.research_definitions set
  name = 'Schleuderer-Schutz', emoji = '🛡️', description = '+4% Schleuderer-Verteidigung pro Stufe.'
  where id = 'mil_schuetzenschutz';
update public.research_definitions set
  name = 'Brecher-Schutz', emoji = '🛡️', description = '+4% Brecher-Verteidigung pro Stufe.'
  where id = 'mil_magieschutz';

update public.research_definitions set
  name = 'Späher-Wege', emoji = '🗺️', description = '+2% Marsch-Tempo pro Stufe.'
  where id = 'mil_pfadfinden';
update public.research_definitions set
  name = 'Sanitäts-Trupp', emoji = '➕', description = '+5% Truppen werden nach Kampf statt verloren geheilt.'
  where id = 'mil_erste_hilfe';
update public.research_definitions set
  name = 'Stellungs-Drill', emoji = '🛡️', description = '+3% Truppen-Verteidigung beim Verteidigen der eigenen Base.'
  where id = 'mil_abwehrformation';
update public.research_definitions set
  name = 'Ausfall-Strategie', emoji = '⚔️', description = '+3% Truppen-Angriff auf Marsch (Solo- und Crew-Angriffe).'
  where id = 'mil_angriffsstrategie';
update public.research_definitions set
  name = 'Letzte Reserve', emoji = '✨', description = 'Schaltet 5% Kritisch-Chance auf Truppen-Skills frei.'
  where id = 'mil_himmlische';

-- Tier-Forschungen: konsequent Klassen-Namen + "Stufe N"
update public.research_definitions set name = 'Türsteher Stufe 2',  description = 'Schaltet Türsteher Stufe 2 frei.'  where id = 'infantry_tier_2';
update public.research_definitions set name = 'Türsteher Stufe 3',  description = 'Schaltet Türsteher Stufe 3 frei.'  where id = 'infantry_tier_3';
update public.research_definitions set name = 'Türsteher Stufe 4',  description = 'Schaltet Türsteher Stufe 4 frei.'  where id = 'infantry_tier_4';
update public.research_definitions set name = 'Türsteher Stufe 5',  description = 'Schaltet Türsteher Stufe 5 frei.'  where id = 'infantry_tier_5';
update public.research_definitions set name = 'Kuriere Stufe 2', emoji = '🏍️', description = 'Schaltet Kuriere Stufe 2 frei.' where id = 'cavalry_tier_2';
update public.research_definitions set name = 'Kuriere Stufe 3', emoji = '🏍️', description = 'Schaltet Kuriere Stufe 3 frei.' where id = 'cavalry_tier_3';
update public.research_definitions set name = 'Kuriere Stufe 4', emoji = '🏍️', description = 'Schaltet Kuriere Stufe 4 frei.' where id = 'cavalry_tier_4';
update public.research_definitions set name = 'Kuriere Stufe 5', emoji = '🏍️', description = 'Schaltet Kuriere Stufe 5 frei.' where id = 'cavalry_tier_5';
update public.research_definitions set name = 'Schleuderer Stufe 2', description = 'Schaltet Schleuderer Stufe 2 frei.' where id = 'marksman_tier_2';
update public.research_definitions set name = 'Schleuderer Stufe 3', description = 'Schaltet Schleuderer Stufe 3 frei.' where id = 'marksman_tier_3';
update public.research_definitions set name = 'Schleuderer Stufe 4', description = 'Schaltet Schleuderer Stufe 4 frei.' where id = 'marksman_tier_4';
update public.research_definitions set name = 'Schleuderer Stufe 5', description = 'Schaltet Schleuderer Stufe 5 frei.' where id = 'marksman_tier_5';
update public.research_definitions set name = 'Brecher Stufe 2', emoji = '🔨', description = 'Schaltet Brecher Stufe 2 frei.' where id = 'siege_tier_2';
update public.research_definitions set name = 'Brecher Stufe 3', emoji = '🔨', description = 'Schaltet Brecher Stufe 3 frei.' where id = 'siege_tier_3';
update public.research_definitions set name = 'Brecher Stufe 4', emoji = '🔨', description = 'Schaltet Brecher Stufe 4 frei.' where id = 'siege_tier_4';
update public.research_definitions set name = 'Brecher Stufe 5', emoji = '🔨', description = 'Schaltet Brecher Stufe 5 frei.' where id = 'siege_tier_5';

-- ─── 3) Infrastructure / Social-Forschungen ────────────────────────
update public.research_definitions set
  name = 'Baustellen-Akademie', emoji = '🏗️', description = '−3% Bau-Zeit pro Stufe.'
  where id = 'inf_baumeister';
update public.research_definitions set
  name = 'Kiez-Logistik', emoji = '🛻', description = '+5% Truppen-Trainings-Tempo.'
  where id = 'inf_logistik';
update public.research_definitions set
  name = 'Crew-Verbindungen', emoji = '🤝', description = '+3% Crew-Bonus pro Stufe.'
  where id = 'soc_diplomatie';
update public.research_definitions set
  name = 'Wächter-Disziplin', emoji = '✨', description = '+3% Wächter-Erfahrung pro Stufe.'
  where id = 'soc_inspiration';
update public.research_definitions set
  name = 'Bauleitung', emoji = '🏗️', description = '−4% Bau-Zeit pro Stufe (Stufe 2).'
  where id = 'inf_architektur';
update public.research_definitions set
  name = 'Stahl-Container', emoji = '📦', description = '+8% Lager-Kapazität pro Stufe (Stufe 2).'
  where id = 'inf_container';

-- ─── 4) Talent-Nodes — Beschreibungen ohne Abkürzungen ─────────────
-- Utility-Ast (für alle 20 Wächter identisch):
update public.talent_nodes set description = '+3% Leben pro Rang'        where id like '%.util.1';
update public.talent_nodes set description = '+3% Angriff pro Rang'      where id like '%.util.2';
update public.talent_nodes set description = '+3% Verteidigung pro Rang' where id like '%.util.3';
update public.talent_nodes set description = '+3% Tempo pro Rang'        where id like '%.util.4';
update public.talent_nodes set description = '+2% Kritisch-Chance'       where id like '%.util.5';

-- Tank-Sekundär:
update public.talent_nodes set description = '+4% Verteidigung pro Rang' where id like '%.sec.1' and archetype_id in (select id from public.guardian_archetypes where class_id='tank');
update public.talent_nodes set description = '+3% Leben pro Rang'        where id like '%.sec.2' and archetype_id in (select id from public.guardian_archetypes where class_id='tank');
update public.talent_nodes set description = '+5% Konter-Chance pro Rang' where id like '%.sec.3' and archetype_id in (select id from public.guardian_archetypes where class_id='tank');
update public.talent_nodes set description = '−4% erlittener Schaden'    where id like '%.sec.4' and archetype_id in (select id from public.guardian_archetypes where class_id='tank');
update public.talent_nodes set description = '10% Chance Betäubung zu ignorieren' where id like '%.sec.5' and archetype_id in (select id from public.guardian_archetypes where class_id='tank');

-- Melee-Sekundär:
update public.talent_nodes set description = '+4% Tempo pro Rang'                       where id like '%.sec.1' and archetype_id in (select id from public.guardian_archetypes where class_id='melee');
update public.talent_nodes set description = '+5% Angriff in Runde 1'                   where id like '%.sec.2' and archetype_id in (select id from public.guardian_archetypes where class_id='melee');
update public.talent_nodes set description = '+3% Kritisch-Schaden pro Rang'            where id like '%.sec.3' and archetype_id in (select id from public.guardian_archetypes where class_id='melee');
update public.talent_nodes set description = 'Ignoriert 2% Verteidigung pro Rang'       where id like '%.sec.4' and archetype_id in (select id from public.guardian_archetypes where class_id='melee');
update public.talent_nodes set description = '+10% Angriff gegen Support-Klasse'        where id like '%.sec.5' and archetype_id in (select id from public.guardian_archetypes where class_id='melee');

-- Ranged-Sekundär:
update public.talent_nodes set description = '+3% Kritisch-Chance pro Rang'  where id like '%.sec.1' and archetype_id in (select id from public.guardian_archetypes where class_id='ranged');
update public.talent_nodes set description = '+4% Kritisch-Schaden pro Rang' where id like '%.sec.2' and archetype_id in (select id from public.guardian_archetypes where class_id='ranged');
update public.talent_nodes set description = '+3% Angriff pro Rang'          where id like '%.sec.3' and archetype_id in (select id from public.guardian_archetypes where class_id='ranged');
update public.talent_nodes set description = '+5% Ausweichen pro Rang'       where id like '%.sec.4' and archetype_id in (select id from public.guardian_archetypes where class_id='ranged');
update public.talent_nodes set description = '+10% Angriff gegen Tank-Klasse' where id like '%.sec.5' and archetype_id in (select id from public.guardian_archetypes where class_id='ranged');

-- Support-Sekundär:
update public.talent_nodes set description = '+4% Skill-Schaden pro Rang' where id like '%.sec.1' and archetype_id in (select id from public.guardian_archetypes where class_id='support');
update public.talent_nodes set description = '−5% Wut-Kosten pro Rang'    where id like '%.sec.2' and archetype_id in (select id from public.guardian_archetypes where class_id='support');
update public.talent_nodes set description = '+3% Verteidigung pro Rang'  where id like '%.sec.3' and archetype_id in (select id from public.guardian_archetypes where class_id='support');
update public.talent_nodes set description = '+10 Start-Wut pro Rang'     where id like '%.sec.4' and archetype_id in (select id from public.guardian_archetypes where class_id='support');
update public.talent_nodes set description = '+5% Zeitschaden pro Rang'   where id like '%.sec.5' and archetype_id in (select id from public.guardian_archetypes where class_id='support');

-- Primary-Keystones — Beschreibungen entkürzen
update public.talent_nodes set description = '+6% Leben pro Rang'                        where id like '%.pri.1' and archetype_id in (select id from public.guardian_archetypes where class_id='tank');
update public.talent_nodes set description = '+3% reflektierter Schaden'                 where id like '%.pri.2' and archetype_id in (select id from public.guardian_archetypes where class_id='tank');
update public.talent_nodes set description = '+4% Verteidigung pro Rang'                 where id like '%.pri.3' and archetype_id in (select id from public.guardian_archetypes where class_id='tank');
update public.talent_nodes set description = '+3% Heilung pro erlittenem Treffer'        where id like '%.pri.4' and archetype_id in (select id from public.guardian_archetypes where class_id='tank');
update public.talent_nodes set description = '1× pro Kampf: absorbiert tödlichen Treffer' where id like '%.pri.5' and archetype_id in (select id from public.guardian_archetypes where class_id='tank');

update public.talent_nodes set description = '+5% Angriff pro Rang'              where id like '%.pri.1' and archetype_id in (select id from public.guardian_archetypes where class_id='melee');
update public.talent_nodes set description = '+4% Kritisch-Chance pro Rang'      where id like '%.pri.2' and archetype_id in (select id from public.guardian_archetypes where class_id='melee');
update public.talent_nodes set description = '+5% Kritisch-Schaden pro Rang'     where id like '%.pri.3' and archetype_id in (select id from public.guardian_archetypes where class_id='melee');
update public.talent_nodes set description = '+3% Angriff gegen schwache Gegner' where id like '%.pri.4' and archetype_id in (select id from public.guardian_archetypes where class_id='melee');
update public.talent_nodes set description = 'Bei Leben<30%: +50% Angriff'       where id like '%.pri.5' and archetype_id in (select id from public.guardian_archetypes where class_id='melee');

update public.talent_nodes set description = '+5% Angriff pro Rang'                  where id like '%.pri.1' and archetype_id in (select id from public.guardian_archetypes where class_id='ranged');
update public.talent_nodes set description = '+4% Kritisch-Chance pro Rang'          where id like '%.pri.2' and archetype_id in (select id from public.guardian_archetypes where class_id='ranged');
update public.talent_nodes set description = '+5% Kritisch-Schaden pro Rang'         where id like '%.pri.3' and archetype_id in (select id from public.guardian_archetypes where class_id='ranged');
update public.talent_nodes set description = '+3% Angriff gegen volle-Leben-Gegner'  where id like '%.pri.4' and archetype_id in (select id from public.guardian_archetypes where class_id='ranged');
update public.talent_nodes set description = 'Runde 1: +100% Angriff, immer kritisch' where id like '%.pri.5' and archetype_id in (select id from public.guardian_archetypes where class_id='ranged');

update public.talent_nodes set description = '+5% Tempo pro Rang'              where id like '%.pri.1' and archetype_id in (select id from public.guardian_archetypes where class_id='support');
update public.talent_nodes set description = '+3% Wut-Generation pro Rang'     where id like '%.pri.2' and archetype_id in (select id from public.guardian_archetypes where class_id='support');
update public.talent_nodes set description = '+5% Chance Debuff zu löschen'    where id like '%.pri.3' and archetype_id in (select id from public.guardian_archetypes where class_id='support');
update public.talent_nodes set description = '+4% Lebens-Regeneration pro Rang' where id like '%.pri.4' and archetype_id in (select id from public.guardian_archetypes where class_id='support');
update public.talent_nodes set description = '1× pro Kampf: volle Wut'         where id like '%.pri.5' and archetype_id in (select id from public.guardian_archetypes where class_id='support');

-- ─── 5) Archetype-Skills — Beschreibungen entkürzen ───────────────
-- Passive
update public.archetype_skills set description = '+3% Verteidigung pro Stufe' where id like '%.passive' and archetype_id in (select id from public.guardian_archetypes where class_id='tank');
update public.archetype_skills set description = '+3% Tempo pro Stufe'        where id like '%.passive' and archetype_id in (select id from public.guardian_archetypes where class_id='melee');
update public.archetype_skills set description = '+2% Kritisch-Chance pro Stufe' where id like '%.passive' and archetype_id in (select id from public.guardian_archetypes where class_id='ranged');
update public.archetype_skills set description = '+3% Skill-Schaden pro Stufe'   where id like '%.passive' and archetype_id in (select id from public.guardian_archetypes where class_id='support');

-- Combat (Wut-Generation)
update public.archetype_skills set description = 'Bei erlittenem Treffer: +30 Wut (+10 pro Stufe)' where id like '%.combat' and archetype_id in (select id from public.guardian_archetypes where class_id='tank');
update public.archetype_skills set description = 'Bei kritischem Treffer: +50 Wut (+10 pro Stufe)' where id like '%.combat' and archetype_id in (select id from public.guardian_archetypes where class_id='melee');
update public.archetype_skills set description = 'Bei kritischem Treffer: +40 Wut (+10 pro Stufe)' where id like '%.combat' and archetype_id in (select id from public.guardian_archetypes where class_id='ranged');
update public.archetype_skills set description = 'Pro Runde: +20 Wut (+5 pro Stufe)' where id like '%.combat' and archetype_id in (select id from public.guardian_archetypes where class_id='support');

-- Role
update public.archetype_skills set description = '+3% Schaden gegen Nahkämpfer pro Stufe' where id like '%.role' and archetype_id in (select id from public.guardian_archetypes where class_id='tank');
update public.archetype_skills set description = '+3% Schaden gegen Support pro Stufe'    where id like '%.role' and archetype_id in (select id from public.guardian_archetypes where class_id='melee');
update public.archetype_skills set description = '+3% Schaden gegen Tank pro Stufe'       where id like '%.role' and archetype_id in (select id from public.guardian_archetypes where class_id='ranged');
update public.archetype_skills set description = '+2% Schaden gegen alle Klassen pro Stufe' where id like '%.role' and archetype_id in (select id from public.guardian_archetypes where class_id='support');
