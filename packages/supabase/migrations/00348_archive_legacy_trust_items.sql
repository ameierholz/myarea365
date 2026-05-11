-- 00348_archive_legacy_trust_items.sql
-- Vertrauensmarken (trust_token_*) + Vertrauensmünzen (elixir_5k/20k)
-- sind Legacy aus dem alten "Vertrauen"-System (vor EP-Refactor). Sie
-- machen funktional dasselbe wie xp_pot_l (Großes Erfahrung-Elixier).
-- Niemand besitzt sie aktuell (user_inventory_items.count = 0).
-- Plus: kein Artwork eingepflegt.
--
-- Archivieren statt löschen — falls noch versteckte Code-Pfade darauf
-- referenzieren, gibt's eine sanfte Landung statt Crash.

UPDATE public.inventory_item_catalog
  SET active = false
  WHERE id IN (
    'trust_token_100', 'trust_token_250', 'trust_token_500',
    'trust_token_1000', 'trust_token_10000',
    'elixir_5k', 'elixir_20k'
  );
