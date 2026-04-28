-- ════════════════════════════════════════════════════════════════════
-- TROOP-ARTWORK — eigener cosmetic_artwork-Kind für die 20 Set-D-Truppen
-- ════════════════════════════════════════════════════════════════════
-- Türsteher/Kuriere/Schleuderer/Brecher × T1-T5 = 20 Truppen brauchen
-- Greenscreen-Artwork. Slot-ID = troop_id (z.B. "inf_t1", "cav_t3").
-- ════════════════════════════════════════════════════════════════════

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

  alter table public.cosmetic_artwork
    add constraint cosmetic_artwork_kind_check
    check (kind in (
      'marker','light','pin_theme','siegel','potion','rank',
      'base_theme','building','resource','chest','stronghold','nameplate',
      'ui_icon','troop'
    ));
end $$;
