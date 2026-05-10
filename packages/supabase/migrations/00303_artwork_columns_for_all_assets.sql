-- 00303_artwork_columns_for_all_assets.sql
--
-- Standardisierte image_url + video_url Spalten für alle Asset-Tabellen
-- die noch keinen Artwork-Tab im Admin-Tool haben. Damit kann der Generic-
-- EntityArtTab im Admin-Tool gegen alle Tables gleich arbeiten.

BEGIN;

-- ── Wächter & Pets ──
ALTER TABLE pet_archetypes      ADD COLUMN IF NOT EXISTS image_url text, ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE guardian_xp_items   ADD COLUMN IF NOT EXISTS image_url text, ADD COLUMN IF NOT EXISTS video_url text;

-- ── Welt & Bosse ──
ALTER TABLE boss_raids          ADD COLUMN IF NOT EXISTS image_url text, ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE area_bosses         ADD COLUMN IF NOT EXISTS image_url text, ADD COLUMN IF NOT EXISTS video_url text;

-- ── Progression ──
ALTER TABLE achievements        ADD COLUMN IF NOT EXISTS image_url text, ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE quest_definitions   ADD COLUMN IF NOT EXISTS image_url text, ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE research_definitions ADD COLUMN IF NOT EXISTS image_url text, ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE missions            ADD COLUMN IF NOT EXISTS image_url text, ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE crew_challenges     ADD COLUMN IF NOT EXISTS image_url text, ADD COLUMN IF NOT EXISTS video_url text;

-- ── Monetization ──
ALTER TABLE gem_shop_items                ADD COLUMN IF NOT EXISTS image_url text, ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE daily_deal_packs              ADD COLUMN IF NOT EXISTS image_url text, ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE popup_offer_templates         ADD COLUMN IF NOT EXISTS image_url text, ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE vip_shop_offers               ADD COLUMN IF NOT EXISTS image_url text, ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE monetization_daily_deals      ADD COLUMN IF NOT EXISTS image_url text, ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE monetization_gem_tiers        ADD COLUMN IF NOT EXISTS image_url text, ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE monetization_seasonal_packs   ADD COLUMN IF NOT EXISTS image_url text, ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE monetization_subscriptions    ADD COLUMN IF NOT EXISTS image_url text, ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE monetization_themed_packs     ADD COLUMN IF NOT EXISTS image_url text, ADD COLUMN IF NOT EXISTS video_url text;

-- Storage-Bucket-Konvention: artwork/<table>/<id>.<ext>
-- (gleicher Bucket wie für archetype/item/material)

COMMIT;
