-- ════════════════════════════════════════════════════════════════════
-- UI-Icon-Slots für Bauen-Modal Kategorie-Tabs (5 Tabs)
-- Damit Admin Produktion/Lager/Kampf/Ausbau/Deko-Icons via Artwork
-- austauschen kann (statt hardcoded Emojis 🏭/📦/⚔️/🛠️/✨).
-- ════════════════════════════════════════════════════════════════════

alter table public.ui_icon_slots drop constraint if exists ui_icon_slots_category_check;
alter table public.ui_icon_slots add constraint ui_icon_slots_category_check
  check (category in ('stat','class','action','badge','misc','quick','crew_tab','building','silhouette','karte_base','build_cat','faction','playstyle'));

insert into public.ui_icon_slots (id, category, name, description, fallback_emoji, sort) values
  ('build_cat_production', 'build_cat', 'Bauen-Tab: Produktion', 'Tab-Icon im Bauen-Modal — Produktions-Gebäude',  '🏭', 500),
  ('build_cat_storage',    'build_cat', 'Bauen-Tab: Lager',      'Tab-Icon im Bauen-Modal — Lager-Gebäude',         '📦', 501),
  ('build_cat_combat',     'build_cat', 'Bauen-Tab: Kampf',      'Tab-Icon im Bauen-Modal — Kampf-Gebäude',         '⚔',  502),
  ('build_cat_utility',    'build_cat', 'Bauen-Tab: Ausbau',     'Tab-Icon im Bauen-Modal — Ausbau (Burg, Lab, …)', '🛠', 503),
  ('build_cat_cosmetic',   'build_cat', 'Bauen-Tab: Deko',       'Tab-Icon im Bauen-Modal — Kosmetik/Deko',         '✨', 504)
on conflict (id) do update set
  category = excluded.category,
  name = excluded.name,
  description = excluded.description,
  fallback_emoji = excluded.fallback_emoji,
  sort = excluded.sort;
