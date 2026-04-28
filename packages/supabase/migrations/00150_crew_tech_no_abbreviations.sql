-- ════════════════════════════════════════════════════════════════════
-- Crew-Tech Beschreibungen entkürzen — keine ATK/DEF/HP/RSS/March mehr
-- ════════════════════════════════════════════════════════════════════
-- User-Wunsch: keine Abkürzungen in der UI. Patcht die Description-Spalte
-- der crew_tech_definitions damit Forschungs-Tab klar lesbar ist.
-- ════════════════════════════════════════════════════════════════════

update public.crew_tech_definitions set description = '+% Angriff aller Crew-Truppen im Kampf'  where id = 'crew_atk';
update public.crew_tech_definitions set description = '+% Verteidigung aller Crew-Truppen'      where id = 'crew_def';
update public.crew_tech_definitions set description = '+% Leben aller Crew-Truppen'             where id = 'crew_hp';
update public.crew_tech_definitions set description = '+% Marschkapazität pro Mitglied'         where id = 'crew_march';
update public.crew_tech_definitions set description = '-% Truppen-Trainingszeit'                where id = 'crew_train';
update public.crew_tech_definitions set description = '-% Bauzeit'                              where id = 'crew_build';
update public.crew_tech_definitions set description = '-% Forschungszeit'                       where id = 'crew_research';
update public.crew_tech_definitions set description = '+% Ressourcen-Ertrag bei Walks'          where id = 'crew_yield';
update public.crew_tech_definitions set description = '+% Bauschutz-Dauer für neue Repeater'   where id = 'crew_shield';
update public.crew_tech_definitions set description = '+% Beute bei Spieler-Base-Angriffen'    where id = 'crew_loot';
