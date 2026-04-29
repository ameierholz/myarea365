-- ════════════════════════════════════════════════════════════════════
-- Silhouette-Artwork-Slots für Mid-LOD-Stage der Map-Pins
-- ════════════════════════════════════════════════════════════════════
-- Bei mittlerem Zoom zeigen Repeater + Bases eine flache mono-farbige
-- Tower-Silhouette (CoD-Stil). Aktuell SVG-generiert; mit diesen Slots
-- kann die Silhouette via Admin-Tab durch Custom-Artwork ersetzt werden.
-- ════════════════════════════════════════════════════════════════════

-- Constraint um neue Kategorie erweitern (silhouette zusätzlich zu building/quick/crew_tab)
alter table public.ui_icon_slots drop constraint if exists ui_icon_slots_category_check;
alter table public.ui_icon_slots add constraint ui_icon_slots_category_check
  check (category in ('stat','class','action','badge','misc','quick','crew_tab','building','silhouette'));

insert into public.ui_icon_slots (id, category, name, description, fallback_emoji, sort) values
  ('repeater_silhouette_hq',     'silhouette', 'Silhouette: HQ',              'Flache Burg-Silhouette für mittleren Zoom (z 14-16)',     '🏛', 400),
  ('repeater_silhouette_mega',   'silhouette', 'Silhouette: Mega-Funk',       'Flache Antennenmast-Silhouette für mittleren Zoom',       '📡', 401),
  ('repeater_silhouette_normal', 'silhouette', 'Silhouette: Standard-Funk',   'Flache Funk-Turm-Silhouette für mittleren Zoom',          '📶', 402),
  ('base_silhouette_runner',     'silhouette', 'Silhouette: Runner-Base',    'Flacher Single-Tower für Runner-Base bei mittlerem Zoom',  '🏠', 403),
  ('base_silhouette_crew',       'silhouette', 'Silhouette: Crew-Base',      'Flache Burg-Silhouette für Crew-Base bei mittlerem Zoom',  '🏰', 404)
on conflict (id) do update set
  category = excluded.category,
  name = excluded.name,
  description = excluded.description,
  fallback_emoji = excluded.fallback_emoji,
  sort = excluded.sort;
