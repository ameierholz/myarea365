-- ══════════════════════════════════════════════════════════════════════════
-- cosmetic_artwork.kind: 4 neue Kinds aufnehmen
-- ══════════════════════════════════════════════════════════════════════════
-- Code in /api/admin/artwork und /api/cosmetic-artwork upserted jetzt auch:
--   base_theme · building · resource · chest
-- Constraint aus 00069 hatte nur die ersten 6 → Insert/Upsert knallt mit
-- "violates check constraint cosmetic_artwork_kind_check".
-- ══════════════════════════════════════════════════════════════════════════

do $$
begin
  if exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    where t.relname = 'cosmetic_artwork'
      and c.conname = 'cosmetic_artwork_kind_check'
  ) then
    alter table public.cosmetic_artwork drop constraint cosmetic_artwork_kind_check;
  end if;

  if exists (select 1 from pg_class where relname = 'cosmetic_artwork') then
    alter table public.cosmetic_artwork
      add constraint cosmetic_artwork_kind_check
      check (kind in (
        'marker', 'light', 'pin_theme', 'siegel', 'potion', 'rank',
        'base_theme', 'building', 'resource', 'chest'
      ));
  end if;
end $$;
