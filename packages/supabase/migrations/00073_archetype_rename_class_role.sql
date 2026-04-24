-- ══════════════════════════════════════════════════════════════════════════
-- 60 Waechter Rename: Klasse + Sub-Rolle + neue Namen
-- ══════════════════════════════════════════════════════════════════════════
-- Vorher: alten role-Check-Constraint droppen (war limitiert auf dps/tank/
-- support/balanced). Neue Rolle (krieger/ritter/paladin/... 16 Werte) passt
-- nicht in den alten Constraint.
alter table public.guardian_archetypes
  drop constraint if exists guardian_archetypes_role_check;

alter table public.guardian_archetypes
  add constraint guardian_archetypes_role_check check (role in (
    -- Tank
    'krieger','ritter','paladin','berserker',
    -- Support
    'priester','schamane','kleriker','orakel',
    -- Ranged
    'magier','bogenschuetze','hexer','runenmeister',
    -- Melee
    'schurke','moench','samurai','ninja',
    -- Legacy (falls irgendwo noch drin, werden spaeter ge-updated)
    'dps','tank','support','balanced'
  ));


-- Ordnet jeden der 60 Archetypen einer Klasse zu (tank/support/ranged/melee)
-- und setzt die neue `role` als Sub-Rolle (krieger/ritter/paladin/berserker,
-- priester/schamane/kleriker/orakel, magier/bogenschuetze/hexer/runenmeister,
-- schurke/moench/samurai/ninja).
-- Die Namen werden so angepasst dass die Sub-Rolle im Namen vorkommt.
--
-- Verteilung: 15 Tanks / 15 Support / 15 Fernkampf / 15 Nahkampf
--
-- Hinweis: guardian_type (legacy) bleibt im Alt-Zustand — auslaufend.
-- Sub-Rollen-Mapping auf die bestehende `role`-Spalte (frueher dps/tank/support/balanced).
-- ══════════════════════════════════════════════════════════════════════════

-- ─── TANK (15) ────────────────────────────────────────────────────────────
update public.guardian_archetypes set class_id='tank', role='ritter',    name='Grenz-Ritter'       where id='grenzwaechter';
update public.guardian_archetypes set class_id='tank', role='paladin',   name='Paladin Eisenhand'  where id='eisenhand';
update public.guardian_archetypes set class_id='tank', role='krieger',   name='Tür-Krieger'        where id='tuersteher';
update public.guardian_archetypes set class_id='tank', role='ritter',    name='Revier-Ritter'      where id='wachmann';
update public.guardian_archetypes set class_id='tank', role='ritter',    name='Wall-Ritter'        where id='wachritter';
update public.guardian_archetypes set class_id='tank', role='berserker', name='Stein-Berserker'    where id='koloss';
update public.guardian_archetypes set class_id='tank', role='krieger',   name='Faust-Krieger'      where id='boxer';
update public.guardian_archetypes set class_id='tank', role='krieger',   name='Schrott-Krieger'    where id='schrotthaendler';
update public.guardian_archetypes set class_id='tank', role='berserker', name='Hammer-Berserker'   where id='schmied';
update public.guardian_archetypes set class_id='tank', role='berserker', name='Blut-Berserker'     where id='blutstuermer';
update public.guardian_archetypes set class_id='tank', role='paladin',   name='Schlacht-Paladin'   where id='veteran';
update public.guardian_archetypes set class_id='tank', role='paladin',   name='Gerichts-Paladin'   where id='gerichtsvollzieher';
update public.guardian_archetypes set class_id='tank', role='berserker', name='Brau-Berserker'     where id='brauer';
update public.guardian_archetypes set class_id='tank', role='paladin',   name='Feld-Paladin'       where id='feldkommandant';
update public.guardian_archetypes set class_id='tank', role='krieger',   name='Frei-Krieger'       where id='freischaerler';

-- ─── SUPPORT (15) ─────────────────────────────────────────────────────────
update public.guardian_archetypes set class_id='support', role='kleriker', name='Feld-Kleriker'        where id='sanitaeter';
update public.guardian_archetypes set class_id='support', role='schamane', name='Gift-Schamane'        where id='giftmischer';
update public.guardian_archetypes set class_id='support', role='priester', name='Licht-Priester'       where id='lichtbringer';
update public.guardian_archetypes set class_id='support', role='orakel',   name='Schatten-Orakel'      where id='meisterdieb';
update public.guardian_archetypes set class_id='support', role='orakel',   name='Karten-Orakel'        where id='kartenleserin';
update public.guardian_archetypes set class_id='support', role='priester', name='Bann-Priester'        where id='netzweber';
update public.guardian_archetypes set class_id='support', role='orakel',   name='Wort-Orakel'          where id='poet';
update public.guardian_archetypes set class_id='support', role='schamane', name='Stadt-Schamane'       where id='stadtschamane';
update public.guardian_archetypes set class_id='support', role='orakel',   name='Zeit-Orakel'          where id='chronist';
update public.guardian_archetypes set class_id='support', role='schamane', name='Koffein-Schamanin'    where id='barista';
update public.guardian_archetypes set class_id='support', role='kleriker', name='Linsen-Kleriker'      where id='fotograf';
update public.guardian_archetypes set class_id='support', role='kleriker', name='Nacht-Kleriker'       where id='busfahrer';
update public.guardian_archetypes set class_id='support', role='schamane', name='Beat-Schamane'        where id='dj';
update public.guardian_archetypes set class_id='support', role='orakel',   name='Perspektiv-Orakel'    where id='strassenmaler';
update public.guardian_archetypes set class_id='support', role='priester', name='Speichen-Priesterin'  where id='kuriergoettin';

-- ─── RANGED (15) ──────────────────────────────────────────────────────────
update public.guardian_archetypes set class_id='ranged', role='magier',        name='Neon-Magier'          where id='neonmagier';
update public.guardian_archetypes set class_id='ranged', role='runenmeister',  name='Runen-Meisterin'      where id='runenleserin';
update public.guardian_archetypes set class_id='ranged', role='magier',        name='Flammen-Magier'       where id='flammenherr';
update public.guardian_archetypes set class_id='ranged', role='hexer',         name='Sprüh-Hexer'          where id='graffiti';
update public.guardian_archetypes set class_id='ranged', role='hexer',         name='Trank-Hexer'          where id='alchemist';
update public.guardian_archetypes set class_id='ranged', role='magier',        name='Phönix-Magier'        where id='aschenmagier';
update public.guardian_archetypes set class_id='ranged', role='bogenschuetze', name='Nebel-Bogenschütze'   where id='nebelgaenger';
update public.guardian_archetypes set class_id='ranged', role='bogenschuetze', name='Stahl-Schützin'       where id='stahlfeder';
update public.guardian_archetypes set class_id='ranged', role='bogenschuetze', name='Adler-Bogenschütze'   where id='heckenschuetze';
update public.guardian_archetypes set class_id='ranged', role='bogenschuetze', name='Bogen-Meisterin'      where id='bogenmeisterin';
update public.guardian_archetypes set class_id='ranged', role='hexer',         name='Dämmer-Hexer'         where id='schattenjaeger';
update public.guardian_archetypes set class_id='ranged', role='bogenschuetze', name='Giebel-Bogenschütze'  where id='dachdecker';
update public.guardian_archetypes set class_id='ranged', role='hexer',         name='Dolch-Hexer'          where id='dolchfluesterer';
update public.guardian_archetypes set class_id='ranged', role='hexer',         name='Schatten-Hexer'       where id='schattenfinger';
update public.guardian_archetypes set class_id='ranged', role='bogenschuetze', name='Flink-Bogenschütze'   where id='taschendieb';

-- ─── MELEE (15) ───────────────────────────────────────────────────────────
update public.guardian_archetypes set class_id='melee', role='ninja',   name='Gossen-Ninja'        where id='gossenfluesterer';
update public.guardian_archetypes set class_id='melee', role='moench',  name='Dächer-Mönch'        where id='daechermoench';
update public.guardian_archetypes set class_id='melee', role='samurai', name='Schatten-Samurai'    where id='schattenklinge';
update public.guardian_archetypes set class_id='melee', role='samurai', name='Donner-Samurai'      where id='donnerreiter';
update public.guardian_archetypes set class_id='melee', role='ninja',   name='Asphalt-Ninja'       where id='kurier';
update public.guardian_archetypes set class_id='melee', role='moench',  name='Deck-Mönch'          where id='skater';
update public.guardian_archetypes set class_id='melee', role='moench',  name='Dauer-Mönch'         where id='laeufer';
update public.guardian_archetypes set class_id='melee', role='moench',  name='Mauer-Mönch'         where id='parkour_alt';
update public.guardian_archetypes set class_id='melee', role='samurai', name='Streifen-Samurai'    where id='reiter';
update public.guardian_archetypes set class_id='melee', role='ninja',   name='Blitz-Ninja'         where id='bote';
update public.guardian_archetypes set class_id='melee', role='samurai', name='Start-Samurai'       where id='jockey';
update public.guardian_archetypes set class_id='melee', role='ninja',   name='Überschall-Ninja'    where id='kuriernomade';
update public.guardian_archetypes set class_id='melee', role='samurai', name='Asphalt-Samurai'     where id='streetracer';
update public.guardian_archetypes set class_id='melee', role='ninja',   name='Wolken-Ninja'        where id='stormrider';
update public.guardian_archetypes set class_id='melee', role='schurke', name='Klingen-Schurke'     where id='klingentaenzer';

-- ─── Sanity-Check ─────────────────────────────────────────────────────────
do $$
declare
  v_tank    int;
  v_support int;
  v_ranged  int;
  v_melee   int;
  v_unmapped int;
begin
  select count(*) into v_tank    from public.guardian_archetypes where class_id='tank';
  select count(*) into v_support from public.guardian_archetypes where class_id='support';
  select count(*) into v_ranged  from public.guardian_archetypes where class_id='ranged';
  select count(*) into v_melee   from public.guardian_archetypes where class_id='melee';
  select count(*) into v_unmapped from public.guardian_archetypes where class_id is null;
  raise notice 'Waechter-Verteilung: Tank=% Support=% Ranged=% Melee=% Unmapped=%',
    v_tank, v_support, v_ranged, v_melee, v_unmapped;
end $$;
