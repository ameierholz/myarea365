-- ════════════════════════════════════════════════════════════════════
-- UI-Icon-Slots für Base-Modal (/karte/base) — 8 Tile-Buttons
-- Damit Admin diese Icons via Artwork-Tool austauschen kann.
-- ════════════════════════════════════════════════════════════════════

alter table public.ui_icon_slots drop constraint if exists ui_icon_slots_category_check;
alter table public.ui_icon_slots add constraint ui_icon_slots_category_check
  check (category in ('stat','class','action','badge','misc','quick','crew_tab','building','silhouette','karte_base'));

insert into public.ui_icon_slots (id, category, name, description, fallback_emoji, sort) values
  ('karte_base_bauen',         'karte_base', 'Base-Tile: Bauen',         'Action-Tile im Base-Modal — Bau-Queue',                '🔨', 400),
  ('karte_base_forschung',     'karte_base', 'Base-Tile: Forschung',     'Action-Tile im Base-Modal — Forschungs-Queue',         '⚗',  401),
  ('karte_base_banditen',      'karte_base', 'Base-Tile: Banditen',      'Action-Tile im Base-Modal — Banditen ausbilden',       '🥷', 402),
  ('karte_base_trophaeen',     'karte_base', 'Base-Tile: Trophäen',      'Action-Tile im Base-Modal — Achievements/Trophäen',    '🏆', 403),
  ('karte_base_ranglisten',    'karte_base', 'Base-Tile: Ranglisten',    'Action-Tile im Base-Modal — Leaderboards',             '📊', 404),
  ('karte_base_statistiken',   'karte_base', 'Base-Tile: Statistiken',   'Action-Tile im Base-Modal — Spieler-Statistiken',      '📈', 405),
  ('karte_base_einstellungen', 'karte_base', 'Base-Tile: Einstellungen', 'Action-Tile im Base-Modal — Profil-Einstellungen',     '⚙',  406),
  ('karte_base_logout',        'karte_base', 'Base-Tile: Ausloggen',     'Action-Tile im Base-Modal — Logout',                   '🚪', 407)
on conflict (id) do update set
  category = excluded.category,
  name = excluded.name,
  description = excluded.description,
  fallback_emoji = excluded.fallback_emoji,
  sort = excluded.sort;
