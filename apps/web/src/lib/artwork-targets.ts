// Zentrale Registry für alle Artwork-Target-Typen.
// Single source of truth: API, Upload, Admin-UI lesen alle hier.
//
// 2 Storage-Modelle:
// - "table" → image_url + video_url Spalten direkt in der Entity-Tabelle
// - "cosmetic" → cosmetic_artwork(kind, slot_id, variant, image_url, video_url)

export type ArtworkTargetSpec = {
  table: string;                      // PG-Tabelle (für "table"-storage) oder "cosmetic_artwork"
  folder: string;                     // Storage-Bucket-Folder
  storage: "table" | "cosmetic";      // wo das image_url landet
  allowsVideo: boolean;               // ob video_url unterstützt wird
  labelCol?: string;                  // Anzeige-Label (default: "name")
  iconCol?: string;                   // Fallback-Emoji (default: "emoji")
  descCol?: string | null;            // Beschreibung (default: "description")
  variantSupport?: boolean;           // nur cosmetic: marker hat male/female/neutral
  orderBy?: string[];                 // Sortier-Spalten für Listen
};

// Tabellen-direkte Targets (bisher: archetype, item, material).
// Neu hinzu: alle 18 Asset-Tabellen aus Migration 00303.
export const TABLE_TARGETS: Record<string, ArtworkTargetSpec> = {
  archetype:        { table: "guardian_archetypes",     folder: "archetypes",     storage: "table", allowsVideo: true,  labelCol: "name", iconCol: "emoji", descCol: "lore",        orderBy: ["wave_number","rarity","name"] },
  item:             { table: "item_catalog",            folder: "items",          storage: "table", allowsVideo: false, labelCol: "name", iconCol: "emoji", descCol: null,          orderBy: ["class_id","slot","rarity","name"] },
  material:         { table: "material_catalog",        folder: "materials",      storage: "table", allowsVideo: true,  labelCol: "name", iconCol: "emoji", descCol: "description", orderBy: ["sort"] },

  // Wächter & Pets
  pet:              { table: "pet_archetypes",          folder: "pets",           storage: "table", allowsVideo: true,  labelCol: "name", iconCol: "emoji", descCol: "description", orderBy: ["rarity","name"] },
  guardian_xp:      { table: "guardian_xp_items",       folder: "guardian-xp",    storage: "table", allowsVideo: false, labelCol: "name", iconCol: "emoji", descCol: "description", orderBy: ["sort","rarity","name"] },

  // Bosse
  boss_raid:        { table: "boss_raids",              folder: "boss-raids",     storage: "table", allowsVideo: true,  labelCol: "name", iconCol: "emoji", descCol: null,          orderBy: ["name"] },
  area_boss:        { table: "area_bosses",             folder: "area-bosses",    storage: "table", allowsVideo: true,  labelCol: "name", iconCol: "emoji", descCol: null,          orderBy: ["name"] },

  // Progression
  achievement:      { table: "achievements",            folder: "achievements",   storage: "table", allowsVideo: false, labelCol: "name", iconCol: "icon",  descCol: "description", orderBy: ["tier","name"] },
  quest:            { table: "quest_definitions",       folder: "quests",         storage: "table", allowsVideo: false, labelCol: "name", iconCol: "emoji", descCol: "description", orderBy: ["name"] },
  research:         { table: "research_definitions",    folder: "research",       storage: "table", allowsVideo: false, labelCol: "name", iconCol: "emoji", descCol: "description", orderBy: ["tier","sort","name"] },
  mission:          { table: "missions",                folder: "missions",       storage: "table", allowsVideo: false, labelCol: "name", iconCol: "icon",  descCol: "description", orderBy: ["category","name"] },
  crew_challenge:   { table: "crew_challenges",         folder: "crew-challenges",storage: "table", allowsVideo: false, labelCol: "name", iconCol: "icon",  descCol: "description", orderBy: ["name"] },

  // Monetization-Icons (kleine Pack-Icons)
  gem_shop_item:    { table: "gem_shop_items",          folder: "gem-shop",       storage: "table", allowsVideo: false, labelCol: "name", iconCol: "icon",  descCol: "description", orderBy: ["category","sort","name"] },
  daily_deal_pack:  { table: "daily_deal_packs",        folder: "daily-deal-packs",storage: "table",allowsVideo: false, labelCol: "name", iconCol: "icon",  descCol: null,          orderBy: ["sort","tier","name"] },
  popup_offer:      { table: "popup_offer_templates",   folder: "popup-offers",   storage: "table", allowsVideo: false, labelCol: "title",iconCol: "emoji", descCol: null,          orderBy: ["title"] },
  vip_offer:        { table: "vip_shop_offers",         folder: "vip-offers",     storage: "table", allowsVideo: false, labelCol: "name", iconCol: "emoji", descCol: "description", orderBy: ["sort","name"] },

  // Monetization Hero-Banner (1024x512 Werbe-Bilder)
  monet_daily_deal: { table: "monetization_daily_deals",     folder: "monet-daily-deals",     storage: "table", allowsVideo: false, labelCol: "title", iconCol: undefined, descCol: "description", orderBy: ["id"] },
  monet_gem_tier:   { table: "monetization_gem_tiers",       folder: "monet-gem-tiers",       storage: "table", allowsVideo: false, labelCol: "id",    iconCol: undefined, descCol: null,          orderBy: ["sort","id"] },
  monet_seasonal:   { table: "monetization_seasonal_packs",  folder: "monet-seasonal-packs",  storage: "table", allowsVideo: false, labelCol: "title", iconCol: undefined, descCol: "description", orderBy: ["id"] },
  monet_subscription:{table: "monetization_subscriptions",   folder: "monet-subscriptions",   storage: "table", allowsVideo: false, labelCol: "title", iconCol: undefined, descCol: "description", orderBy: ["sort","id"] },
  monet_themed:     { table: "monetization_themed_packs",    folder: "monet-themed-packs",    storage: "table", allowsVideo: false, labelCol: "title", iconCol: undefined, descCol: "description", orderBy: ["sort","id"] },
};

// Cosmetic-Targets bleiben wie bisher (kommen aus cosmetic_artwork-Tabelle)
export const COSMETIC_TARGETS = [
  "marker", "light", "pin_theme", "siegel", "potion", "rank", "base_theme",
  "building", "resource", "chest", "stronghold", "ui_icon", "troop",
  "nameplate", "base_ring", "loot_drop", "resource_node",
  "inventory_item", "modal_background", "sanctuary",
] as const;

export type CosmeticTargetType = typeof COSMETIC_TARGETS[number];
export type TableTargetType = keyof typeof TABLE_TARGETS;
export type ArtworkTargetType = TableTargetType | CosmeticTargetType;

export const ALL_ARTWORK_TARGETS: ArtworkTargetType[] = [
  ...(Object.keys(TABLE_TARGETS) as TableTargetType[]),
  ...COSMETIC_TARGETS,
];
