-- Fix: cosmetic_artwork.kind CHECK-Constraint erweitern.
-- Der Code in /api/admin/artwork upserted kinds: marker, light, pin_theme,
-- siegel, potion, rank. Falls die Tabelle ursprünglich nur mit den ersten
-- drei angelegt wurde, knallt jeder Upload eines Siegel/Trank/Rang-Artworks
-- mit "violates check constraint cosmetic_artwork_kind_check".
--
-- Diese Migration nimmt den alten Constraint weg (idempotent) und legt
-- ihn mit allen 6 kinds neu an.

do $$
begin
  -- existierenden Constraint entfernen, wenn vorhanden
  if exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    where t.relname = 'cosmetic_artwork'
      and c.conname = 'cosmetic_artwork_kind_check'
  ) then
    alter table public.cosmetic_artwork drop constraint cosmetic_artwork_kind_check;
  end if;

  -- nur anlegen, wenn die Tabelle existiert (sie wurde laut Code-Recherche
  -- evtl. manuell im Dashboard erstellt — Migration soll auf frischen DBs
  -- nicht knallen, falls Tabelle fehlt)
  if exists (select 1 from pg_class where relname = 'cosmetic_artwork') then
    alter table public.cosmetic_artwork
      add constraint cosmetic_artwork_kind_check
      check (kind in ('marker', 'light', 'pin_theme', 'siegel', 'potion', 'rank'));
  end if;
end $$;
