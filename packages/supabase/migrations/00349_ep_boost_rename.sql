-- 00349_ep_boost_rename.sql
-- Naming-Lücke aus dem EP-Sweep (Mig 00340 hat nur xp_pot_* umbenannt,
-- die boost_xp_* Items waren übersehen). Plus: season_token_demo ist ein
-- Test-Item das nicht in den Prod-Item-Picker gehört.
--
-- ID wird NICHT geändert (boost_xp_* bleibt) — würde Stripe-Webhook /
-- gem_shop_items / monetization.ts brechen. Nur user-facing Name + Desc.

UPDATE public.inventory_item_catalog SET
  name = 'EP-Boost (8 Std)',
  description = '+50% Wächter-EP für 8 Stunden.'
WHERE id = 'boost_xp_8h';

UPDATE public.inventory_item_catalog SET
  name = 'EP-Boost (24 Std)',
  description = '+50% Wächter-EP für 24 Stunden.'
WHERE id = 'boost_xp_24h';

UPDATE public.inventory_item_catalog SET
  active = false
WHERE id = 'season_token_demo';
