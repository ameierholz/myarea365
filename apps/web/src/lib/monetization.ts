export type PremiumTier = "free" | "plus" | "lifetime";

export type User = {
  id: string;
  premium_tier?: PremiumTier | null;
  premium_expires_at?: string | null;
  streak_freezes_remaining?: number | null;
  xp_boost_until?: string | null;
  xp_boost_multiplier?: number | null;
  profile_theme?: string | null;
  custom_marker_color?: string | null;
};

export type CrewPlan = "free" | "pro";

export function isPremium(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.premium_tier === "lifetime") return true;
  if (user.premium_tier === "plus") {
    if (!user.premium_expires_at) return false;
    return new Date(user.premium_expires_at).getTime() > Date.now();
  }
  return false;
}

export function hasActiveBoost(user: User | null | undefined): boolean {
  if (!user?.xp_boost_until) return false;
  return new Date(user.xp_boost_until).getTime() > Date.now();
}

export function currentMultiplier(user: User | null | undefined): number {
  return hasActiveBoost(user) ? (user?.xp_boost_multiplier ?? 2) : 1;
}

// Hard-Cap für Stacking: max 14 Tage Restzeit gleichzeitig
export const BOOST_STACK_CAP_MS = 14 * 24 * 3600 * 1000;

/**
 * Berechnet das neue xp_boost_until beim Kauf eines Boost-Packs.
 * Regel: Wenn aktiver Boost mit gleichem Multiplikator läuft, werden Stunden aufaddiert.
 * Bei unterschiedlichem Multiplikator wird überschrieben.
 * Restzeit ist immer auf 14 Tage ab jetzt gecappt.
 */
export function stackBoostUntil(
  currentUntilIso: string | null | undefined,
  currentMult: number | null | undefined,
  addHours: number,
  newMult: number,
): { until: string; mult: number; capped: boolean } {
  const now = Date.now();
  const currentUntil = currentUntilIso ? new Date(currentUntilIso).getTime() : 0;
  const isActiveSameMult = currentUntil > now && (currentMult ?? 0) === newMult;
  const baseTime = isActiveSameMult ? currentUntil : now;
  const targetTime = baseTime + addHours * 3600 * 1000;
  const maxTime = now + BOOST_STACK_CAP_MS;
  const capped = targetTime > maxTime;
  const finalTime = Math.min(targetTime, maxTime);
  return { until: new Date(finalTime).toISOString(), mult: newMult, capped };
}

/**
 * Effektiver XP-Multiplikator: Max aus Personal- und Crew-Boost (nicht Produkt).
 * Verhindert, dass jemand Solo 2× + Crew 2× = 4× laufen kann.
 */
export function effectiveMultiplier(personal: number, crew: number): number {
  return Math.max(1, personal || 1, crew || 1);
}

// ── Preise (in Cents) ────────────────────────────────────────

export const PLANS = {
  plus_monthly:     { sku: "plus_monthly",     name: "MyArea+ Monat",       price: 999,   duration_days: 30,  target: "user" as const },
  plus_yearly:      { sku: "plus_yearly",      name: "MyArea+ Jahr",        price: 9900,  duration_days: 365, target: "user" as const, savings_pct: 17 },
  crew_pro_monthly: { sku: "crew_pro_monthly", name: "Crew-Pro Monat",      price: 999,   duration_days: 30,  target: "crew" as const },
  crew_pro_yearly:  { sku: "crew_pro_yearly",  name: "Crew-Pro Jahr",       price: 7900,  duration_days: 365, target: "crew" as const, savings_pct: 34 },
};

export const BOOST_PACKS = {
  boost_24h:      { sku: "boost_24h",      name: "24 Stunden Doppel-XP", price: 199, multiplier: 2, hours: 24,  icon: "⚡" },
  boost_48h:      { sku: "boost_48h",      name: "48 Stunden Doppel-XP", price: 299, multiplier: 2, hours: 48,  icon: "⚡" },
  boost_weekend:  { sku: "boost_weekend",  name: "Weekend Doppel-XP",    price: 249, multiplier: 2, hours: 48,  icon: "🎉", desc: "2× XP für 2 Tage" },
  boost_week_2x:  { sku: "boost_week_2x",  name: "1 Woche Doppel-XP",    price: 499, multiplier: 2, hours: 168, icon: "⚡" },
  crew_boost_24h: { sku: "crew_boost_24h", name: "Crew-Boost 24h",       price: 499, multiplier: 2, hours: 24,  icon: "👥", desc: "2× XP für alle deine Crew-Mitglieder" },
};

export const XP_PACKS = {
  xp_1k:   { sku: "xp_1k",   name: "1.000 XP Instant",  price: 199, xp: 1000,  icon: "✨" },
  xp_5k:   { sku: "xp_5k",   name: "5.000 XP Instant",  price: 799, xp: 5000,  icon: "💫" },
  xp_15k:  { sku: "xp_15k",  name: "15.000 XP Instant", price: 1999, xp: 15000, icon: "⭐" },
};

export const GAMEPLAY_ITEMS = {
  reclaim_ticket:   { sku: "reclaim_ticket",   name: "Reclaim-Ticket",        price: 149, icon: "🔁", desc: "Ein verlorenes Territorium zurückholen" },
  mystery_box:      { sku: "mystery_box",      name: "Mystery Box (Cosmetic)", price: 299, icon: "🎁", desc: "Zufälliger Skin/Marker/Trail — rein optisch, keine Kampf-Stats (kein P2W)" },
  ghost_mode:       { sku: "ghost_mode",       name: "Ghost-Mode (1 Lauf)",   price: 249, icon: "👻", desc: "Unsichtbar für Gegner-Fraktion" },
  double_claim:     { sku: "double_claim",     name: "Doppel-Claim (1 Lauf)", price: 349, icon: "🎯", desc: "Doppelte Territorien im nächsten Lauf" },
  faction_switch:   { sku: "faction_switch",   name: "Fraktions-Wechsel",     price: 599, icon: "⚔️", desc: "Zur anderen Fraktion wechseln (max 1×/Monat)" },
  explorer_compass: { sku: "explorer_compass", name: "Explorer-Kompass 7 T",  price: 399, icon: "🧭", desc: "Zeigt uneroberte Straßen auf der Karte" },
};

export const COSMETICS = {
  golden_trail:    { sku: "golden_trail",    name: "Golden Trail (30 T)",    price: 299, icon: "✨", desc: "Lauf hinterlässt goldene Leuchtspur" },
  neon_trail:      { sku: "neon_trail",      name: "Neon Trail (30 T)",      price: 299, icon: "💜", desc: "Pink/Lila Neon-Leuchtspur" },
  aura_effect:     { sku: "aura_effect",     name: "Aura-Effekt (30 T)",     price: 399, icon: "🌟", desc: "Marker pulsiert mit Glühen" },
  map_cyberpunk:   { sku: "map_cyberpunk",   name: "Map-Theme Cyberpunk",    price: 499, icon: "🌆", desc: "Dauerhaft freigeschaltet" },
  map_retro:       { sku: "map_retro",       name: "Map-Theme Retro-80s",    price: 499, icon: "🕹️", desc: "Dauerhaft freigeschaltet" },
  rainbow_name:    { sku: "rainbow_name",    name: "Rainbow-Name (30 T)",    price: 199, icon: "🌈", desc: "Animierter Regenbogen-Name im Ranking" },
  victory_dance:   { sku: "victory_dance",   name: "Victory-Dance",          price: 249, icon: "💃", desc: "Animation beim Eroberung, dauerhaft" },
};

export const EXTRAS = {
  streak_pack_5: { sku: "streak_pack_5", name: "5× Streak-Freeze",         price: 299, icon: "❄️" },
  streak_pack_15: { sku: "streak_pack_15", name: "15× Streak-Freeze",      price: 799, icon: "🧊" },
  shout_pack_10: { sku: "shout_pack_10", name: "10× Kiez-Shout",           price: 299, icon: "📢", desc: "Nachricht an alle Runner im 500m-Umkreis" },
  badge_bronze:  { sku: "badge_bronze",  name: "Bronze-Supporter-Badge",   price: 199, icon: "🥉" },
  badge_silver:  { sku: "badge_silver",  name: "Silber-Supporter-Badge",   price: 499, icon: "🥈" },
  badge_gold:    { sku: "badge_gold",    name: "Gold-Supporter-Badge",     price: 999, icon: "🥇" },
};

// ═══════════════════════════════════════════════════════
// CREW PAY-TO-PROGRESS (Diamanten fließen in Crew-Pool)
// ═══════════════════════════════════════════════════════
export const CREW_GEM_PACKS = {
  crew_gems_500:   { sku: "crew_gems_500",   name: "Crew-Paket S",  gems: 500,  bonus: 0,    price: 499,  icon: "💎" },
  crew_gems_1500:  { sku: "crew_gems_1500",  name: "Crew-Paket M",  gems: 1500, bonus: 200,  price: 1299, icon: "💎" },
  crew_gems_5000:  { sku: "crew_gems_5000",  name: "Crew-Paket L",  gems: 5000, bonus: 1000, price: 3999, icon: "💎" },
  crew_gems_12000: { sku: "crew_gems_12000", name: "Crew-Paket XL", gems: 12000, bonus: 3000, price: 7999, icon: "💎" },
};

export const CREW_SLOT_PACKS = {
  crew_slots_plus5:  { sku: "crew_slots_plus5",  name: "+5 Mitglieder-Slots",  slots: 5,  price: 299, icon: "👥" },
  crew_slots_plus10: { sku: "crew_slots_plus10", name: "+10 Mitglieder-Slots", slots: 10, price: 499, icon: "👥" },
};

// ═══════════════════════════════════════════════════════
// Server-seitige Preisauflösung — Single Source of Truth.
// Wird von /api/stripe/checkout genutzt, damit der Client NICHT
// seinen eigenen Preis diktieren kann (Audit #2).
// ═══════════════════════════════════════════════════════
// gem-bundles werden lazy geladen, damit keine Circular-Imports entstehen.
type PriceEntry = { price: number; name: string };

export function resolveSkuPrice(sku: string): PriceEntry | null {
  const pools: Array<Record<string, { price?: number; price_cents?: number; name?: string }>> = [
    PLANS, BOOST_PACKS, XP_PACKS, GAMEPLAY_ITEMS, COSMETICS, EXTRAS,
    CREW_GEM_PACKS, CREW_SLOT_PACKS,
  ];
  for (const pool of pools) {
    const hit = pool[sku];
    if (hit) {
      const price = typeof hit.price === "number" ? hit.price : hit.price_cents;
      if (typeof price === "number" && price > 0) {
        return { price, name: hit.name ?? sku };
      }
    }
  }
  // Gem-Bundles liegen in separatem Modul — dynamischer Import würde hier Promises
  // einführen; da GEM_BUNDLES konstant sind und keine Circular-Imports entstehen,
  // importieren wir es inline per require.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GEM_BUNDLES } = require("./gem-bundles") as { GEM_BUNDLES: Array<{ sku: string; price_cents: number }> };
    const bundle = GEM_BUNDLES.find((b) => b.sku === sku);
    if (bundle && bundle.price_cents > 0) {
      return { price: bundle.price_cents, name: `Edelsteine ${sku}` };
    }
  } catch { /* ignore */ }
  return null;
}

export function formatPrice(cents: number): string {
  return `€ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

// ═══════════════════════════════════════════════════════
// SHOP-OWNER MONETARISIERUNG (Café, Laden, Restaurant …)
// ═══════════════════════════════════════════════════════

export const SHOP_PLANS = {
  shop_basis:   { sku: "shop_basis",   name: "Shop Basis",   price: 2900,  duration_days: 30,  desc: "1 Kategorie · Pin auf Karte · 1 Deal-Slot" },
  shop_pro:     { sku: "shop_pro",     name: "Shop Pro",     price: 7900,  duration_days: 30,  desc: "3 Deal-Slots · Analytics · Flash-Deals · Verifiziert" },
  shop_ultra:   { sku: "shop_ultra",   name: "Shop Ultra",   price: 19900, duration_days: 30,  desc: "Alles aus Pro + Dauer-Spotlight + Push-Broadcast + Stadt-Feature" },
};

export const SHOP_BOOSTS = {
  spotlight_3d:    { sku: "spotlight_3d",    name: "Spotlight 3 Tage",       price: 1900,  icon: "⭐", desc: "Gold-Pin + Pulse-Animation auf Karte" },
  flash_push:      { sku: "flash_push",      name: "Flash-Deal-Push",        price: 900,   icon: "⚡", desc: "30-Min Benachrichtigung an Runner im 1 km-Umkreis" },
  radius_boost_7d: { sku: "radius_boost_7d", name: "Radius-Boost 7 Tage",    price: 4900,  icon: "📡", desc: "Shop sichtbar im 5 km statt 500 m Radius" },
  homepage_banner: { sku: "homepage_banner", name: "Homepage-Banner 1 Woche",price: 9900,  icon: "🎯", desc: "Banner auf Stadt-Landing-Page" },
  top_listing_7d:  { sku: "top_listing_7d",  name: "Top-Listing 7 Tage",     price: 2900,  icon: "🥇", desc: "Position 1 in Kiez-Kategorie" },
  custom_pin:      { sku: "custom_pin",      name: "Custom-Pin-Design",      price: 14900, icon: "🎨", desc: "Eigenes Logo als Marker-Icon (einmalig)" },
  event_host:      { sku: "event_host",      name: "Event-Host-Slot",        price: 5900,  icon: "🎪", desc: "Lauf-Event veranstalten mit Pin + Teilnehmer" },
  challenge_sponsor: { sku: "challenge_sponsor", name: "Kiez-Challenge-Sponsor", price: 2900, icon: "🏆", desc: "Sponser eine Challenge im Kiez" },
  arena_daily:       { sku: "arena_daily",       name: "Arena-Platz 1 Tag",      price: 900,  icon: "⚔️", desc: "24h Kampf-Arena — Crews die bei dir einlösen dürfen kämpfen" },
  arena_monthly:     { sku: "arena_monthly",     name: "Arena-Abo (Monat)",      price: 4900, icon: "🏟️", desc: "30 Tage Dauer-Arena — Extra-Traffic durch Kampf-Events", duration_days: 30 },
};

export const SHOP_MARKETING = {
  social_pro_monthly: { sku: "social_pro_monthly", name: "Social-Post-Generator Pro", price: 990,  duration_days: 30,  icon: "📱", desc: "Unbegrenzte Instagram/TikTok-Grafiken + Templates" },
  qr_print_service:   { sku: "qr_print_service",   name: "QR-Code-Druckservice",      price: 1900, icon: "🖨️", desc: "Tür-Aufkleber mit Check-in-QR per Post" },
  email_campaign:     { sku: "email_campaign",     name: "E-Mail-Kampagne",           price: 4900, icon: "✉️", desc: "Push an eure Stammkunden senden" },
};

export const SHOP_ANALYTICS = {
  analytics_pro_monthly: { sku: "analytics_pro_monthly", name: "Analytics Pro",        price: 3900, duration_days: 30, icon: "📊", desc: "Altersgruppen, Heatmap, Demografie" },
  kiez_report:           { sku: "kiez_report",           name: "Kiez-Report PDF",      price: 2900, icon: "📄", desc: "\"Wer läuft in meinem Kiez?\" — anonymisiert" },
  competitor_monthly:    { sku: "competitor_monthly",    name: "Konkurrenz-Analyse",   price: 1900, duration_days: 30, icon: "🔍", desc: "Benchmark gegen andere Shops im Kiez" },
};

export const SHOP_FEATURES_BY_PLAN: Record<"free"|"basis"|"pro"|"ultra", string[]> = {
  free:  ["Pin auf Karte", "Profil-Seite"],
  basis: ["Pin auf Karte", "Profil-Seite", "1 Deal-Slot", "Kategorie-Listing"],
  pro:   ["3 Deal-Slots", "Flash-Deals", "Basic Analytics", "Verifiziert-Badge"],
  ultra: ["Unbegrenzte Deal-Slots", "Dauer-Spotlight", "Pro-Analytics", "Push-Broadcast", "Stadt-Seite Feature", "Priority-Support"],
};

export function currentShopPlan(business: { plan?: string | null; plan_expires_at?: string | null } | null | undefined): "free"|"basis"|"pro"|"ultra" {
  if (!business?.plan || business.plan === "free") return "free";
  if (business.plan_expires_at && new Date(business.plan_expires_at).getTime() < Date.now()) return "free";
  return business.plan as "basis"|"pro"|"ultra";
}

export function hasSpotlightActive(business: { spotlight_until?: string | null } | null | undefined): boolean {
  const until = business?.spotlight_until;
  return !!(until && new Date(until).getTime() > Date.now());
}

// ═══════════════════════════════════════════════════════
// WÄCHTER-SHOP (Runner-seitig, Kosmetik + Bequemlichkeit)
// ═══════════════════════════════════════════════════════

export const GUARDIAN_ITEMS = {
  revival_token: { sku: "revival_token", name: "Revival-Token",     price: 199,  icon: "💊", desc: "Verwundung deines Wächters sofort heilen" },
  guardian_xp:   { sku: "guardian_xp",   name: "Wächter-XP-Boost",  price: 299,  icon: "⚡", desc: "+2.500 XP für euren Wächter" },
  guardian_skin: { sku: "guardian_skin", name: "Wächter-Glow-Skin", price: 499,  icon: "✨", desc: "Leuchtender Rahmen für euren Wächter (dauerhaft)" },
};

// ── Ad-Rewards ────────────────────────────────────────

export const AD_REWARDS = {
  post_walk:    { xp: 100, cooldown_min: 720, label: "Lauf-Bonus",            description: "+100 XP für 30 Sek Video" },
  boost_24h:    { xp: 0,   cooldown_min: 1440, label: "24h Doppel-XP",         description: "Kurzes Video für 24h 2× XP" },
  double_xp:    { xp: 0,   cooldown_min: 360, label: "15 Min Doppel-XP",       description: "Direkt-Boost für nächsten Lauf" },
  streak_save:  { xp: 0,   cooldown_min: 720, label: "Streak retten",          description: "Verpasster Tag einmalig verzeihen" },
};

// MyArea+ Features (als Display-Liste)
export const PLUS_FEATURES: { icon: string; title: string; desc: string; status: "live" | "soon" }[] = [
  { icon: "🚫", title: "Werbefrei",             desc: "Keine Banner, keine Pflicht-Videos",                    status: "live" },
  { icon: "❄️", title: "Streak-Freeze",          desc: "3× / Monat Streak pausieren",                           status: "live" },
  { icon: "📤", title: "GPX/TCX-Export",         desc: "Zu Strava/Garmin exportieren",                          status: "live" },
  { icon: "🎨", title: "Custom-Marker",          desc: "Eigene Farbe & Emoji-Mix für deinen Pin",               status: "soon" },
  { icon: "🌈", title: "Profil-Themes",          desc: "Animierte Banner & exklusive Badges",                   status: "soon" },
  { icon: "📴", title: "Offline-Karten",         desc: "Läufe ohne Datenvolumen aufzeichnen",                   status: "soon" },
  { icon: "📊", title: "Erweiterte Statistik",   desc: "Jahresvergleich, Kiez-Heatmap, HR-Import",              status: "soon" },
  { icon: "⚡", title: "Flash-Deal-Priorität",   desc: "5 Min vor allen anderen sehen",                         status: "soon" },
  { icon: "🔒", title: "Private Runs",           desc: "Läufe aus öffentlichem Leaderboard halten",             status: "soon" },
  { icon: "🎙️", title: "Pace-Coach Voice",       desc: "KI-Motivation während Lauf",                            status: "soon" },
];

export const CREW_PRO_FEATURES = [
  { icon: "👥", title: "Bis 200 Mitglieder", desc: "Free: max 50 pro Crew" },
  { icon: "💰", title: "Crew-Schatz", desc: "Gemeinsamer XP-Topf für Gruppen-Rabatte" },
  { icon: "⚔️", title: "Auto-Matchmaking", desc: "Wöchentliche Duelle gegen Rivalen" },
  { icon: "🎨", title: "Custom-Branding", desc: "Logo, Farbe, Territorium-Style" },
  { icon: "📈", title: "Analytics-Dashboard", desc: "Aktivität pro Mitglied, Inaktivitäts-Alarm" },
  { icon: "💬", title: "Private Chat + Pinnwand", desc: "Sprachnachrichten, wichtige Posts anheften" },
  { icon: "👕", title: "Crew-Merch-Shop", desc: "T-Shirts & Caps mit eurem Logo" },
];
