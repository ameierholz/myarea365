-- Erweitert cosmetic_artwork.kind um 'modal_background' für Vollbild-Backgrounds
-- der Tab-Routen (/karte/base, /karte/waechter, /karte/crew, /karte/inventar, /karte/shop).
-- Slot-IDs: karte_base_bg, karte_waechter_bg, karte_crew_bg, karte_inventar_bg, karte_shop_bg.
-- Image (PNG/JPG) + Video (MP4) werden beide unterstützt — Video wird für animierte Backgrounds genutzt.

alter table public.cosmetic_artwork
  drop constraint if exists cosmetic_artwork_kind_check;

alter table public.cosmetic_artwork
  add constraint cosmetic_artwork_kind_check
  check (kind = any (array[
    'marker','light','pin_theme','siegel','potion','rank',
    'base_theme','building','resource','chest','stronghold',
    'nameplate','ui_icon','troop','base_ring','loot_drop',
    'resource_node','inventory_item','modal_background'
  ]));

-- Optional: prompt-Spalte für AI-Generierungs-Prompt-Audit
alter table public.cosmetic_artwork
  add column if not exists prompt text;

comment on column public.cosmetic_artwork.prompt is
  'Optional: AI-Prompt der beim letzten Upload verwendet wurde (für Reproduzierbarkeit).';
