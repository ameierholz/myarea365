-- 00350_chest_inventory_mirror.sql
-- chest_silver/gold/legendary/event aus inventory_item_catalog hatten
-- ihre Artworks unter kind='chest' mit slot_id='silver/gold/legendary/
-- event' (ohne chest_-Prefix). Der useInventoryItemArt-Hook sucht aber
-- nach kind='inventory_item' mit der vollen ID, fand also nichts.
-- → 📦 Emoji-Fallback im Inbox-Geschenke-Picker.
--
-- Spiegel-Einträge mit kind='inventory_item' + voller ID lösen das ohne
-- Frontend-Änderung. Selbe URL, kein Storage-Upload nötig.

INSERT INTO public.cosmetic_artwork (kind, slot_id, variant, image_url)
SELECT 'inventory_item', 'chest_' || slot_id, 'neutral', image_url
FROM public.cosmetic_artwork
WHERE kind = 'chest'
  AND slot_id IN ('silver', 'gold', 'legendary', 'event')
  AND variant = 'neutral'
ON CONFLICT (kind, slot_id, variant) DO UPDATE SET image_url = excluded.image_url;
