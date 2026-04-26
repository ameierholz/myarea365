-- ══════════════════════════════════════════════════════════════════════════
-- BUILDINGS RENAME: eigenständige Namen statt RoK/CoD-Klones
-- ══════════════════════════════════════════════════════════════════════════
-- Behält die IDs (technische Schlüssel), ändert nur den Anzeige-Namen.
-- Themen: walking/running/Pfad-orientierte Begriffe wo passend, sonst
-- distinkte deutsche Begriffe die NICHT 1:1 mit Rise of Kingdoms / Call of
-- Dragons matchen.
-- ══════════════════════════════════════════════════════════════════════════

update public.buildings_catalog set name = 'Lauf-Lager'         where id = 'lagerhalle';
update public.buildings_catalog set name = 'Wegerast'           where id = 'gasthaus';
update public.buildings_catalog set name = 'Posten-Turm'        where id = 'wachturm';

-- Produktion
update public.buildings_catalog set name = 'Reisig-Bündler'     where id = 'saegewerk';
update public.buildings_catalog set name = 'Pflaster-Brecher'   where id = 'steinbruch';
update public.buildings_catalog set name = 'Zoll-Schacht'       where id = 'goldmine';
update public.buildings_catalog set name = 'Quellbrunnen'       where id = 'mana_quelle';

-- Lager
update public.buildings_catalog set name = 'Geheim-Tresor'      where id = 'tresorraum';
update public.buildings_catalog set name = 'Vorrats-Schober'    where id = 'kornkammer';
update public.buildings_catalog set name = 'Stein-Speicher'     where id = 'mauerwerk';

-- Kampf
update public.buildings_catalog set name = 'Heil-Stube'         where id = 'hospital';
update public.buildings_catalog set name = 'Übungs-Hof'         where id = 'trainingsplatz';
update public.buildings_catalog set name = 'Wurfgeschütz-Werk'  where id = 'ballistenwerk';
update public.buildings_catalog set name = 'Klingen-Kaserne'    where id = 'schwertkampflager';
update public.buildings_catalog set name = 'Pfeil-Kaserne'      where id = 'bogenschuetzenstand';

-- Utility
update public.buildings_catalog set name = 'Gelehrten-Halle'    where id = 'akademie';
update public.buildings_catalog set name = 'Mond-Kapelle'       where id = 'kloster';
update public.buildings_catalog set name = 'Sternendeuter-Stein' where id = 'augurstein';
update public.buildings_catalog set name = 'Quest-Tafel'        where id = 'schwarzes_brett';
update public.buildings_catalog set name = 'Bau-Kontor'         where id = 'halbling_haus';
update public.buildings_catalog set name = 'Tausch-Stand'       where id = 'basar';

-- Cosmetic
update public.buildings_catalog set name = 'Kosmetik-Stand'     where id = 'shop';
-- Brunnen + Heldenstatue bleiben (generisch)

-- Crew
update public.buildings_catalog set name = 'Mana-Spring'        where id = 'mana_quell';
update public.buildings_catalog set name = 'Bund-Halle'         where id = 'allianz_zentrum';
update public.buildings_catalog set name = 'Kundschafter-Lager' where id = 'spaeher_wachposten';
update public.buildings_catalog set name = 'Versammlungs-Feuer' where id = 'sammel_leuchtfeuer';
update public.buildings_catalog set name = 'Crew-Schenke'       where id = 'crew_taverne';
update public.buildings_catalog set name = 'Crew-Heilstation'   where id = 'crew_hospital';
update public.buildings_catalog set name = 'Crew-Studienhalle'  where id = 'crew_akademie';
update public.buildings_catalog set name = 'Sphären-Heiligtum'  where id = 'tempel_himmlisch';
update public.buildings_catalog set name = 'Trödel-Tausch'      where id = 'goblin_markt';
