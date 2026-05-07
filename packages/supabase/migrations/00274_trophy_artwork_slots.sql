-- Trophy-Artwork-Slots — pro Tier ein Slot, damit du eigene Pokal-Artworks hochladen kannst.
-- Slot-IDs werden vom UI als ui_icon-Lookup genutzt (useUiIconArt).
-- Nebenher: karte_base_server-Slot (für die neue Server-Tile) ergänzt.

-- Category-Check erweitern
alter table public.ui_icon_slots drop constraint if exists ui_icon_slots_category_check;
alter table public.ui_icon_slots add constraint ui_icon_slots_category_check
  check (category = any (array[
    'stat','class','action','badge','misc','quick','crew_tab',
    'building','silhouette','karte_base','trophy'
  ]));

insert into public.ui_icon_slots (id, category, name, description, fallback_emoji, sort) values
  ('trophy_bronze', 'trophy', 'Bronze-Trophäe', 'Pokal-Artwork für Bronze-Trophäen (Profil-Banner + Trophäen-Modal).', '🏆', 500),
  ('trophy_silver', 'trophy', 'Silber-Trophäe', 'Pokal-Artwork für Silber-Trophäen (Profil-Banner + Trophäen-Modal).', '🏆', 501),
  ('trophy_gold',   'trophy', 'Gold-Trophäe',   'Pokal-Artwork für Gold-Trophäen (Profil-Banner + Trophäen-Modal).',   '🏆', 502),
  ('karte_base_server', 'karte_base', 'Base-Tile: Server', 'Server-Übersicht öffnen.', '🏙️', 408)
on conflict (id) do update set
  category = excluded.category,
  name = excluded.name,
  description = excluded.description,
  fallback_emoji = excluded.fallback_emoji,
  sort = excluded.sort;
