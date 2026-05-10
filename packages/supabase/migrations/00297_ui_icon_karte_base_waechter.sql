-- ════════════════════════════════════════════════════════════════════
-- UI-Icon-Slot für neue Wächter-Tile in /karte/base
-- ════════════════════════════════════════════════════════════════════

insert into public.ui_icon_slots (id, category, name, description, fallback_emoji, sort) values
  ('karte_base_waechter', 'karte_base', 'Base-Tile: Wächter', 'Action-Tile im Base-Modal — Wächter-Hub (Detail/Galerie/Talente/Skills/Equipment/Sterne)', '🛡️', 409)
on conflict (id) do update set
  category = excluded.category,
  name = excluded.name,
  description = excluded.description,
  fallback_emoji = excluded.fallback_emoji,
  sort = excluded.sort;
