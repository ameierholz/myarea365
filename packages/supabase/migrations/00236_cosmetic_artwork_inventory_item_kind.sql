-- ─── 00236: cosmetic_artwork.kind erlaubt jetzt 'inventory_item' ──────
-- Bug: Admin → Artwork → 📦 Inventar-Items Upload schlug am
-- cosmetic_artwork_kind_check fehl, weil die Constraint inventory_item
-- nicht in der ANY-Liste hatte.

alter table public.cosmetic_artwork
  drop constraint if exists cosmetic_artwork_kind_check;

alter table public.cosmetic_artwork
  add constraint cosmetic_artwork_kind_check
  check (kind = any (array[
    'marker','light','pin_theme','siegel','potion','rank',
    'base_theme','building','resource','chest','stronghold',
    'nameplate','ui_icon','troop','base_ring','loot_drop',
    'resource_node','inventory_item'
  ]));
