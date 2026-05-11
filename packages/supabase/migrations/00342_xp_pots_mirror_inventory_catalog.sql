-- 00342_xp_pots_mirror_inventory_catalog.sql
-- Spiegelt xp_pot_s/m/l aus guardian_xp_items in inventory_item_catalog,
-- damit Inbox-SystemRewardView (useInventoryItemArt) Name + Bild
-- direkt findet. Bisher hat die Item-Pille nur "📦 ×5" gezeigt.
-- Plus: Description "XP" → "EP" in beiden Tabellen.

INSERT INTO public.inventory_item_catalog (id, category, name, description, emoji, image_url, rarity, sort_order, active)
VALUES
  ('xp_pot_s', 'elixir', 'Kleines Erfahrung-Elixier', '+100 EP für einen Wächter', '⚗️',
   'https://dqxfbsgusydmaaxdrgxx.supabase.co/storage/v1/object/public/artwork/guardian-xp/xp_pot_s.png',
   'common', 110, true),
  ('xp_pot_m', 'elixir', 'Erfahrung-Elixier', '+500 EP für einen Wächter', '🧪',
   'https://dqxfbsgusydmaaxdrgxx.supabase.co/storage/v1/object/public/artwork/guardian-xp/xp_pot_m.png',
   'rare', 120, true),
  ('xp_pot_l', 'elixir', 'Großes Erfahrung-Elixier', '+1000 EP für einen Wächter', '🏺',
   'https://dqxfbsgusydmaaxdrgxx.supabase.co/storage/v1/object/public/artwork/guardian-xp/xp_pot_l.png',
   'epic', 130, true)
ON CONFLICT (id) DO UPDATE SET
  name = excluded.name,
  description = excluded.description,
  emoji = excluded.emoji,
  image_url = excluded.image_url,
  rarity = excluded.rarity;

UPDATE public.guardian_xp_items SET description = '+100 EP für einen Wächter' WHERE id = 'xp_pot_s';
UPDATE public.guardian_xp_items SET description = '+500 EP für einen Wächter' WHERE id = 'xp_pot_m';
UPDATE public.guardian_xp_items SET description = '+1000 EP für einen Wächter' WHERE id = 'xp_pot_l';
