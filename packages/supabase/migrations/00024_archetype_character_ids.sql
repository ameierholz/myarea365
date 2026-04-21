-- ═══════════════════════════════════════════════════════════════════
-- Wächter: 20 Tier-IDs → Charakter-IDs (konsistent mit Charakter-Namen)
-- + Coole Titel für alle 60 Wächter.
-- FKs bekommen ON UPDATE CASCADE, damit IDs rename-safe sind.
-- ═══════════════════════════════════════════════════════════════════

-- ─── FKs mit ON UPDATE CASCADE neu anlegen (dynamisch: findet alle FKs auf guardian_archetypes/talent_nodes/archetype_skills) ──

do $$
declare
  r record;
  v_on_delete char(1);
  v_delete_clause text;
  v_cols text;
  v_refcols text;
begin
  -- Alle FKs auf guardian_archetypes, talent_nodes, archetype_skills finden und rekreieren
  for r in
    select c.conname, c.oid as conoid, c.confdeltype as ondel,
           n.nspname as schemaname, t.relname as tablename,
           nr.nspname as ref_schema, tr.relname as ref_table
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      join pg_class tr on tr.oid = c.confrelid
      join pg_namespace nr on nr.oid = tr.relnamespace
     where c.contype = 'f'
       and nr.nspname = 'public'
       and tr.relname in ('guardian_archetypes','talent_nodes','archetype_skills')
  loop
    -- Spaltenliste (FK-Spalten und Ref-Spalten) aus pg_constraint aufbauen
    select string_agg(quote_ident(a.attname), ',' order by k.ord)
      into v_cols
      from unnest((select conkey from pg_constraint where oid = r.conoid)) with ordinality k(attnum, ord)
      join pg_attribute a on a.attnum = k.attnum and a.attrelid = (select conrelid from pg_constraint where oid = r.conoid);
    select string_agg(quote_ident(a.attname), ',' order by k.ord)
      into v_refcols
      from unnest((select confkey from pg_constraint where oid = r.conoid)) with ordinality k(attnum, ord)
      join pg_attribute a on a.attnum = k.attnum and a.attrelid = (select confrelid from pg_constraint where oid = r.conoid);

    v_delete_clause := case r.ondel
                         when 'c' then ' on delete cascade'
                         when 'n' then ' on delete set null'
                         when 'd' then ' on delete set default'
                         when 'r' then ' on delete restrict'
                         else '' end;

    execute format('alter table %I.%I drop constraint if exists %I', r.schemaname, r.tablename, r.conname);
    execute format('alter table %I.%I add constraint %I foreign key (%s) references %I.%I(%s) on update cascade%s',
                   r.schemaname, r.tablename, r.conname, v_cols,
                   r.ref_schema, r.ref_table, v_refcols, v_delete_clause);
  end loop;
end $$;

-- ─── Archetype-IDs umbenennen (Tier → Charakter) ──────────────────
-- FK-Cascade propagiert archetype_id an Kind-Tabellen automatisch.

update public.guardian_archetypes set id = 'schattenfinger'   where id = 'stadtfuchs';
update public.guardian_archetypes set id = 'grenzwaechter'    where id = 'dachs';
update public.guardian_archetypes set id = 'klingentaenzer'   where id = 'taube';
update public.guardian_archetypes set id = 'gossenfluesterer' where id = 'spatz';
update public.guardian_archetypes set id = 'freischaerler'    where id = 'strassenhund';
update public.guardian_archetypes set id = 'giftmischer'      where id = 'ratte';

update public.guardian_archetypes set id = 'neonmagier'       where id = 'nachteule';
update public.guardian_archetypes set id = 'meisterdieb'      where id = 'waschbaer';
update public.guardian_archetypes set id = 'daechermoench'    where id = 'stadtkatze';
update public.guardian_archetypes set id = 'runenleserin'     where id = 'eule';
update public.guardian_archetypes set id = 'nebelgaenger'     where id = 'fledermaus';
update public.guardian_archetypes set id = 'dolchfluesterer'  where id = 'moewe';
update public.guardian_archetypes set id = 'feldkommandant'   where id = 'rudelalpha';
update public.guardian_archetypes set id = 'eisenhand'        where id = 'eber';

update public.guardian_archetypes set id = 'schattenklinge'   where id = 'wolf';
update public.guardian_archetypes set id = 'blutstuermer'     where id = 'baer';
update public.guardian_archetypes set id = 'stahlfeder'       where id = 'falke';
update public.guardian_archetypes set id = 'flammenherr'      where id = 'drache';
update public.guardian_archetypes set id = 'lichtbringer'     where id = 'phoenix';
update public.guardian_archetypes set id = 'donnerreiter'     where id = 'wyvern';

-- ─── Kind-Tabellen: eigene ID-Spalten (z.B. 'ratte.util.1' → 'giftmischer.util.1')
-- Cascade auf FK-Spalten hat diese bereits synchronisiert, aber eigene PK-IDs müssen
-- manuell umbenannt werden. Self-Ref requires_node_id cascadet beim Update automatisch.

do $$
begin
if to_regclass('public.talent_nodes') is null then return; end if;
update public.talent_nodes     set id = 'schattenfinger'   || substr(id, length('stadtfuchs')+1)   where id like 'stadtfuchs.%';
update public.talent_nodes     set id = 'grenzwaechter'    || substr(id, length('dachs')+1)        where id like 'dachs.%';
update public.talent_nodes     set id = 'klingentaenzer'   || substr(id, length('taube')+1)        where id like 'taube.%';
update public.talent_nodes     set id = 'gossenfluesterer' || substr(id, length('spatz')+1)        where id like 'spatz.%';
update public.talent_nodes     set id = 'freischaerler'    || substr(id, length('strassenhund')+1) where id like 'strassenhund.%';
update public.talent_nodes     set id = 'giftmischer'      || substr(id, length('ratte')+1)        where id like 'ratte.%';
update public.talent_nodes     set id = 'neonmagier'       || substr(id, length('nachteule')+1)    where id like 'nachteule.%';
update public.talent_nodes     set id = 'meisterdieb'      || substr(id, length('waschbaer')+1)    where id like 'waschbaer.%';
update public.talent_nodes     set id = 'daechermoench'    || substr(id, length('stadtkatze')+1)   where id like 'stadtkatze.%';
update public.talent_nodes     set id = 'runenleserin'     || substr(id, length('eule')+1)         where id like 'eule.%';
update public.talent_nodes     set id = 'nebelgaenger'     || substr(id, length('fledermaus')+1)   where id like 'fledermaus.%';
update public.talent_nodes     set id = 'dolchfluesterer'  || substr(id, length('moewe')+1)        where id like 'moewe.%';
update public.talent_nodes     set id = 'feldkommandant'   || substr(id, length('rudelalpha')+1)   where id like 'rudelalpha.%';
update public.talent_nodes     set id = 'eisenhand'        || substr(id, length('eber')+1)         where id like 'eber.%';
update public.talent_nodes     set id = 'schattenklinge'   || substr(id, length('wolf')+1)         where id like 'wolf.%';
update public.talent_nodes     set id = 'blutstuermer'     || substr(id, length('baer')+1)         where id like 'baer.%';
update public.talent_nodes     set id = 'stahlfeder'       || substr(id, length('falke')+1)        where id like 'falke.%';
update public.talent_nodes     set id = 'flammenherr'      || substr(id, length('drache')+1)       where id like 'drache.%';
update public.talent_nodes     set id = 'lichtbringer'     || substr(id, length('phoenix')+1)      where id like 'phoenix.%';
update public.talent_nodes     set id = 'donnerreiter'     || substr(id, length('wyvern')+1)       where id like 'wyvern.%';
end $$;

do $$
begin
if to_regclass('public.archetype_skills') is null then return; end if;
update public.archetype_skills set id = 'schattenfinger'   || substr(id, length('stadtfuchs')+1)   where id like 'stadtfuchs.%';
update public.archetype_skills set id = 'grenzwaechter'    || substr(id, length('dachs')+1)        where id like 'dachs.%';
update public.archetype_skills set id = 'klingentaenzer'   || substr(id, length('taube')+1)        where id like 'taube.%';
update public.archetype_skills set id = 'gossenfluesterer' || substr(id, length('spatz')+1)        where id like 'spatz.%';
update public.archetype_skills set id = 'freischaerler'    || substr(id, length('strassenhund')+1) where id like 'strassenhund.%';
update public.archetype_skills set id = 'giftmischer'      || substr(id, length('ratte')+1)        where id like 'ratte.%';
update public.archetype_skills set id = 'neonmagier'       || substr(id, length('nachteule')+1)    where id like 'nachteule.%';
update public.archetype_skills set id = 'meisterdieb'      || substr(id, length('waschbaer')+1)    where id like 'waschbaer.%';
update public.archetype_skills set id = 'daechermoench'    || substr(id, length('stadtkatze')+1)   where id like 'stadtkatze.%';
update public.archetype_skills set id = 'runenleserin'     || substr(id, length('eule')+1)         where id like 'eule.%';
update public.archetype_skills set id = 'nebelgaenger'     || substr(id, length('fledermaus')+1)   where id like 'fledermaus.%';
update public.archetype_skills set id = 'dolchfluesterer'  || substr(id, length('moewe')+1)        where id like 'moewe.%';
update public.archetype_skills set id = 'feldkommandant'   || substr(id, length('rudelalpha')+1)   where id like 'rudelalpha.%';
update public.archetype_skills set id = 'eisenhand'        || substr(id, length('eber')+1)         where id like 'eber.%';
update public.archetype_skills set id = 'schattenklinge'   || substr(id, length('wolf')+1)         where id like 'wolf.%';
update public.archetype_skills set id = 'blutstuermer'     || substr(id, length('baer')+1)         where id like 'baer.%';
update public.archetype_skills set id = 'stahlfeder'       || substr(id, length('falke')+1)        where id like 'falke.%';
update public.archetype_skills set id = 'flammenherr'      || substr(id, length('drache')+1)       where id like 'drache.%';
update public.archetype_skills set id = 'lichtbringer'     || substr(id, length('phoenix')+1)      where id like 'phoenix.%';
update public.archetype_skills set id = 'donnerreiter'     || substr(id, length('wyvern')+1)       where id like 'wyvern.%';
end $$;

-- ─── Coole Titel für alle 60 Wächter ──────────────────────────────

-- Elite
update public.guardian_archetypes set name = 'Schattenfinger'      where id = 'schattenfinger';
update public.guardian_archetypes set name = 'Grenzwächter'        where id = 'grenzwaechter';
update public.guardian_archetypes set name = 'Klingen-Tänzer'      where id = 'klingentaenzer';
update public.guardian_archetypes set name = 'Gossenflüsterer'     where id = 'gossenfluesterer';
update public.guardian_archetypes set name = 'Freischärler'        where id = 'freischaerler';
update public.guardian_archetypes set name = 'Giftmischer'         where id = 'giftmischer';
update public.guardian_archetypes set name = 'Koffein-Alchemistin' where id = 'barista';
update public.guardian_archetypes set name = 'Asphalt-Kurier'      where id = 'kurier';
update public.guardian_archetypes set name = 'Schuldeneintreiber'  where id = 'gerichtsvollzieher';
update public.guardian_archetypes set name = 'Sprühzauberer'       where id = 'graffiti';
update public.guardian_archetypes set name = 'Dauerläufer'         where id = 'laeufer';
update public.guardian_archetypes set name = 'Feldfelcher'         where id = 'sanitaeter';
update public.guardian_archetypes set name = 'Altmetall-Krieger'   where id = 'schrotthaendler';
update public.guardian_archetypes set name = 'Deck-Reiter'         where id = 'skater';
update public.guardian_archetypes set name = 'Wortschmied'         where id = 'poet';
update public.guardian_archetypes set name = 'Beatmacher'          where id = 'dj';
update public.guardian_archetypes set name = 'Linsenfänger'        where id = 'fotograf';
update public.guardian_archetypes set name = 'Fingerflinker'       where id = 'taschendieb';
update public.guardian_archetypes set name = 'Mauerläufer'         where id = 'traceur';
update public.guardian_archetypes set name = 'Clubwächter'         where id = 'tuersteher';

-- Epic
update public.guardian_archetypes set name = 'Trank-Meister'       where id = 'alchemist';
update public.guardian_archetypes set name = 'Gärungs-Alchemist'   where id = 'brauer';
update public.guardian_archetypes set name = 'Giebel-Schütze'      where id = 'dachdecker';
update public.guardian_archetypes set name = 'Meisterdieb'         where id = 'meisterdieb';
update public.guardian_archetypes set name = 'Blitz-Bote'          where id = 'bote';
update public.guardian_archetypes set name = 'Runenleserin'        where id = 'runenleserin';
update public.guardian_archetypes set name = 'Feldkommandant'      where id = 'feldkommandant';
update public.guardian_archetypes set name = 'Schicksalsleserin'   where id = 'kartenleserin';
update public.guardian_archetypes set name = 'Dolchflüsterer'      where id = 'dolchfluesterer';
update public.guardian_archetypes set name = 'Nachtpilot'          where id = 'busfahrer';
update public.guardian_archetypes set name = 'Eisenhand'           where id = 'eisenhand';
update public.guardian_archetypes set name = 'Dächer-Mönch'        where id = 'daechermoench';
update public.guardian_archetypes set name = 'Streifenreiter'      where id = 'reiter';
update public.guardian_archetypes set name = 'Startblitz'          where id = 'jockey';
update public.guardian_archetypes set name = 'Nebelgänger'         where id = 'nebelgaenger';
update public.guardian_archetypes set name = 'Stadtschamane'       where id = 'stadtschamane';
update public.guardian_archetypes set name = 'Neon-Magier'         where id = 'neonmagier';
update public.guardian_archetypes set name = 'Perspektiv-Meister'  where id = 'strassenmaler';
update public.guardian_archetypes set name = 'Schmiedehammer'      where id = 'schmied';
update public.guardian_archetypes set name = 'Revier-Hüter'        where id = 'wachmann';

-- Legendary
update public.guardian_archetypes set name = 'Phönix-Magier'       where id = 'aschenmagier';
update public.guardian_archetypes set name = 'Schattenklinge'      where id = 'schattenklinge';
update public.guardian_archetypes set name = 'Blutstürmer'         where id = 'blutstuermer';
update public.guardian_archetypes set name = 'Bogenkönigin'        where id = 'bogenmeisterin';
update public.guardian_archetypes set name = 'Zeitweber'           where id = 'chronist';
update public.guardian_archetypes set name = 'Flammenherr'         where id = 'flammenherr';
update public.guardian_archetypes set name = 'Speichenherrin'      where id = 'kuriergoettin';
update public.guardian_archetypes set name = 'Adlerauge'           where id = 'heckenschuetze';
update public.guardian_archetypes set name = 'Lichtbringer'        where id = 'lichtbringer';
update public.guardian_archetypes set name = 'Steingigant'         where id = 'koloss';
update public.guardian_archetypes set name = 'Überschall-Bote'     where id = 'kuriernomade';
update public.guardian_archetypes set name = 'Bann-Weber'          where id = 'netzweber';
update public.guardian_archetypes set name = 'Dämmerjäger'         where id = 'schattenjaeger';
update public.guardian_archetypes set name = 'Stahlfeder'          where id = 'stahlfeder';
update public.guardian_archetypes set name = 'Asphalt-König'       where id = 'streetracer';
update public.guardian_archetypes set name = 'Wolken-Reiter'       where id = 'stormrider';
update public.guardian_archetypes set name = 'Donnerreiter'        where id = 'donnerreiter';
update public.guardian_archetypes set name = 'Faustkönig'          where id = 'boxer';
update public.guardian_archetypes set name = 'Schlachten-Veteran'  where id = 'veteran';
update public.guardian_archetypes set name = 'Eisenwall'           where id = 'wachritter';

-- ─── Skin-Payloads im Shop mit neuen IDs aktualisieren ────────────

do $$
begin
if to_regclass('public.gem_shop_items') is null then return; end if;
update public.gem_shop_items
  set payload = payload - 'archetype' || jsonb_build_object('archetype', 'eisenhand')
  where id = 'skin_paladin_gold';
update public.gem_shop_items
  set payload = payload - 'archetype' || jsonb_build_object('archetype', 'flammenherr')
  where id = 'skin_drache_void';
end $$;
