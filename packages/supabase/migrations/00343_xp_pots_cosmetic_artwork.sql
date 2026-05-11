-- 00343_xp_pots_cosmetic_artwork.sql
-- cosmetic_artwork-Einträge für xp_pot_s/m/l. Frontend-Hook
-- useInventoryItemArt zieht aus dieser Tabelle (kind='inventory_item').
-- Ohne diese Einträge zeigt die Inbox-Item-Pille nur "📦 ×N" als
-- Fallback statt das echte Elixier-Artwork.

INSERT INTO public.cosmetic_artwork (kind, slot_id, variant, image_url)
VALUES
  ('inventory_item', 'xp_pot_s', 'neutral', 'https://dqxfbsgusydmaaxdrgxx.supabase.co/storage/v1/object/public/artwork/guardian-xp/xp_pot_s.png'),
  ('inventory_item', 'xp_pot_m', 'neutral', 'https://dqxfbsgusydmaaxdrgxx.supabase.co/storage/v1/object/public/artwork/guardian-xp/xp_pot_m.png'),
  ('inventory_item', 'xp_pot_l', 'neutral', 'https://dqxfbsgusydmaaxdrgxx.supabase.co/storage/v1/object/public/artwork/guardian-xp/xp_pot_l.png')
ON CONFLICT (kind, slot_id, variant) DO UPDATE SET image_url = excluded.image_url;
