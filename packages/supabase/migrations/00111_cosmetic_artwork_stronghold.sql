-- ══════════════════════════════════════════════════════════════════════════
-- cosmetic_artwork.kind: + 'stronghold' für Schattenhort-Pin-Artwork
-- ══════════════════════════════════════════════════════════════════════════
-- Slot-IDs: 'default' (alle Stufen), oder pro Stufe 'level_1' .. 'level_10'
-- → AppMap rendert artwork[level_X] ?? artwork.default ?? Emoji-Fallback
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
        'base_theme', 'building', 'resource', 'chest', 'stronghold'
      ));
  end if;
end $$;
