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

// Crew-Boost: 24h × 2 für Resourcen-Yield aller Crew-Mitglieder.
// (Walking-App-Wegemünzen-Boosts sind komplett entfernt.)
export const BOOST_PACKS = {
  crew_boost_24h: { sku: "crew_boost_24h", name: "Crew-Boost 24h",           price: 499, multiplier: 2, hours: 24,  icon: "👥", desc: "2× Resourcen-Yield für alle deine Crew-Mitglieder" },
};

// Walking-App-Wegemünzen-Packs sind ausgemustert — Premium-Currency
// sind jetzt Diamanten (siehe GEM_BUNDLES in gem-bundles.ts).
export const XP_PACKS = {} as Record<string, { sku: string; name: string; price: number; xp?: number; icon: string }>;

export const GAMEPLAY_ITEMS = {
  mystery_box:    { sku: "mystery_box",    name: "Wahl-Box",          price: 299, icon: "🎁", desc: "Du wählst 1 aus 11 Premium-Belohnungen — kein Zufall, kein Glücksspiel (EU-konform)" },
  faction_switch: { sku: "faction_switch", name: "Spielstil-Wechsel", price: 599, icon: "🔄", desc: "Spielstil ändern (Architekt / Warlord / Stratege / Diplomat) — max 1×/Monat" },
};

// Walking-App-Cosmetics (Trails / Map-Themes / Rainbow-Name) sind raus.
// Cosmetics werden jetzt über Wahl-Box-Tokens + Bundle-Beigaben verteilt.
export const COSMETICS = {} as Record<string, { sku: string; name: string; price: number; icon: string; desc?: string }>;

// Walking-App-Extras (Streak-Freeze, Kiez-Shout, Supporter-Badges) sind raus.
export const EXTRAS = {} as Record<string, { sku: string; name: string; price: number; icon: string; desc?: string }>;

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
      return { price: bundle.price_cents, name: `Diamanten ${sku}` };
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * Async-Resolver für DB-basierte Deal-SKUs (seasonal:UUID, themed:UUID,
 * gem_tier:UUID, battle_pass:season_id:tier, subscription:UUID).
 * Wird in /api/stripe/checkout aufgerufen wenn der statische Resolver nichts findet.
 */
export type AsyncPriceEntry = PriceEntry & { mode?: "payment" | "subscription"; metadata?: Record<string, string> };

// Untyped Supabase-Wrapper — wir reichen den echten Client durch und casten intern.
type AnySb = { from: (table: string) => unknown };

export async function resolveSkuPriceFromDb(
  sku: string,
  sb: AnySb,
): Promise<AsyncPriceEntry | null> {
  const [prefix, ...rest] = sku.split(":");
  const restJoined = rest.join(":");
  if (!prefix || !restJoined) return null;

  // Generischer Helper — vermeidet repetitives Casten
  const fetchOne = async <T extends Record<string, unknown>>(
    table: string, cols: string, where: { col: string; val: string }
  ): Promise<T | null> => {
    const q = (sb.from(table) as { select: (c: string) => unknown }).select(cols);
    const f = (q as { eq: (c: string, v: string) => unknown }).eq(where.col, where.val);
    const r = await (f as { maybeSingle: () => Promise<{ data: T | null }> }).maybeSingle();
    return r.data ?? null;
  };

  if (prefix === "seasonal") {
    const r = await fetchOne<{ id: string; title: string; price_cents: number }>(
      "monetization_seasonal_packs", "id, title, price_cents", { col: "id", val: restJoined });
    if (r && r.price_cents > 0) return { price: r.price_cents, name: r.title, metadata: { deal_kind: "seasonal", deal_id: r.id } };
  }
  if (prefix === "themed") {
    const r = await fetchOne<{ id: string; title: string; price_cents: number }>(
      "monetization_themed_packs", "id, title, price_cents", { col: "id", val: restJoined });
    if (r && r.price_cents > 0) return { price: r.price_cents, name: r.title, metadata: { deal_kind: "themed", deal_id: r.id } };
  }
  if (prefix === "gem_tier") {
    const r = await fetchOne<{ id: string; label: string; price_cents: number }>(
      "monetization_gem_tiers", "id, label, price_cents", { col: "id", val: restJoined });
    if (r && r.price_cents > 0) return { price: r.price_cents, name: r.label, metadata: { deal_kind: "gem_tier", deal_id: r.id } };
  }
  if (prefix === "battle_pass") {
    const [seasonId, tier] = restJoined.split(":");
    if (!seasonId || !tier) return null;
    const r = await fetchOne<{ id: string; title: string; price_premium_cents: number; price_premium_plus_cents: number }>(
      "monetization_battle_pass_seasons", "id, title, price_premium_cents, price_premium_plus_cents", { col: "id", val: seasonId });
    if (!r) return null;
    const price = tier === "premium_plus" ? r.price_premium_plus_cents : r.price_premium_cents;
    if (price > 0) return { price, name: `${r.title} — ${tier}`, metadata: { deal_kind: "battle_pass", season_id: r.id, tier } };
  }
  if (prefix === "subscription") {
    const r = await fetchOne<{ id: string; label: string; price_cents: number }>(
      "monetization_subscriptions", "id, label, price_cents", { col: "id", val: restJoined });
    if (r && r.price_cents > 0) return { price: r.price_cents, name: r.label, mode: "subscription", metadata: { deal_kind: "subscription", deal_id: r.id } };
  }
  if (prefix === "monthly_pack") {
    const r = await fetchOne<{ sku: string; label: string; price_cents: number }>(
      "monthly_pack_skus", "sku, label, price_cents", { col: "sku", val: restJoined });
    if (r && r.price_cents > 0) return { price: r.price_cents, name: r.label, metadata: { deal_kind: "monthly_pack", sku: r.sku } };
  }
  if (prefix === "growth_fund") {
    return { price: 999, name: "Growth Fund", metadata: { deal_kind: "growth_fund" } };
  }
  return null;
}

export function formatPrice(cents: number): string {
  return `€ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

// ═══════════════════════════════════════════════════════
// SHOP-OWNER MONETARISIERUNG (Café, Laden, Restaurant …)
// ═══════════════════════════════════════════════════════

// ═══ ABOS — 4 klare Stufen mit sich aufbauenden Features ═══
export const SHOP_PLANS = {
  shop_basis: { sku: "shop_basis", name: "Basis",  price: 2900,  duration_days: 30, desc: "Pin auf der Karte · 1 Deal · Scans-Statistik" },
  shop_pro:   { sku: "shop_pro",   name: "Pro",    price: 7900,  duration_days: 30, desc: "Unbegrenzte Deals · Erweiterte Analytics · 3 Flash-Pushes/Mo inkl." },
  shop_ultra: { sku: "shop_ultra", name: "Ultra",  price: 19900, duration_days: 30, desc: "Dauer-Spotlight · Push-Broadcast · Kiez-Report · Stadt-Feature" },
};

// ═══ EINZEL-BOOSTS — nur noch 3 Kern-Produkte (80/20) ═══
export const SHOP_BOOSTS = {
  flash_push:   { sku: "flash_push",   name: "Flash-Push",        price: 900,  icon: "🔔", desc: "Benachrichtige ~200 Runner in 1 km Umkreis, 30 min gültig" },
  spotlight_3d: { sku: "spotlight_3d", name: "Spotlight 3 Tage",  price: 1900, icon: "⭐", desc: "Gold-Pin auf der Karte + erweiterter Sichtradius (5 km)" },
  event_host:   { sku: "event_host",   name: "Event hosten",      price: 5900, icon: "🎉", desc: "Lauf-Event bei dir — Runner können sich anmelden, Pin + Teilnehmer-Liste" },
};

// ═══ LEGACY — bleiben als SKUs für Bestandskäufe erhalten,
// werden NICHT mehr im Shop angezeigt. Funktionen sind jetzt
// in Pro/Ultra enthalten oder mit einem der 3 Kern-Boosts zusammengelegt. ═══
export const SHOP_LEGACY = {
  radius_boost_7d:       { sku: "radius_boost_7d",       name: "Radius-Boost 7 Tage",     price: 4900,  icon: "📡", desc: "[Legacy — jetzt Teil von Spotlight]" },
  homepage_banner:       { sku: "homepage_banner",       name: "Homepage-Banner",         price: 9900,  icon: "🎯", desc: "[Legacy — jetzt in Ultra enthalten]" },
  top_listing_7d:        { sku: "top_listing_7d",        name: "Top-Listing 7 Tage",      price: 2900,  icon: "🥇", desc: "[Legacy]" },
  custom_pin:            { sku: "custom_pin",            name: "Custom-Pin-Design",       price: 14900, icon: "🎨", desc: "[Legacy — jetzt in Ultra enthalten]" },
  challenge_sponsor:     { sku: "challenge_sponsor",     name: "Kiez-Challenge-Sponsor",  price: 2900,  icon: "🏆", desc: "[Legacy — jetzt Teil von Event hosten]" },
  arena_daily:           { sku: "arena_daily",           name: "Arena-Platz 1 Tag",       price: 900,   icon: "⚔️", desc: "[Legacy]" },
  arena_monthly:         { sku: "arena_monthly",         name: "Arena-Abo (Monat)",       price: 4900,  icon: "🏟️", desc: "[Legacy]", duration_days: 30 },
  social_pro_monthly:    { sku: "social_pro_monthly",    name: "Social-Post-Generator",   price: 990,   icon: "📱", desc: "[Legacy — jetzt in Pro enthalten]", duration_days: 30 },
  qr_print_service:      { sku: "qr_print_service",      name: "QR-Druckservice",         price: 1900,  icon: "🖨️", desc: "[Legacy — jetzt unter /shop/[id]/qr als Acryl-Aufsteller]" },
  email_campaign:        { sku: "email_campaign",        name: "E-Mail-Kampagne",         price: 4900,  icon: "✉️", desc: "[Legacy — jetzt in Pro enthalten]" },
  analytics_pro_monthly: { sku: "analytics_pro_monthly", name: "Analytics Pro",           price: 3900,  icon: "📊", desc: "[Legacy — jetzt in Pro enthalten]", duration_days: 30 },
  kiez_report:           { sku: "kiez_report",           name: "Kiez-Report PDF",         price: 2900,  icon: "📄", desc: "[Legacy — jetzt in Ultra enthalten]" },
  competitor_monthly:    { sku: "competitor_monthly",    name: "Konkurrenz-Analyse",      price: 1900,  icon: "🔍", desc: "[Legacy — jetzt in Pro enthalten]", duration_days: 30 },
};

// Alte Exports für Rückwärtskompatibilität — zeigen nur noch ein leeres Objekt,
// damit nichts crasht. Neue Shop-UIs nutzen SHOP_PLANS + SHOP_BOOSTS direkt.
export const SHOP_MARKETING = {} as Record<string, { sku: string; name: string; price: number; icon?: string; desc?: string; duration_days?: number }>;
export const SHOP_ANALYTICS = {} as Record<string, { sku: string; name: string; price: number; icon?: string; desc?: string; duration_days?: number }>;

// ═══ FEATURES PRO PLAN — saubere aufsteigende Liste ═══
export const SHOP_FEATURES_BY_PLAN: Record<"free"|"basis"|"pro"|"ultra", string[]> = {
  free: [
    "📍 Pin auf der Karte",
    "🏪 Shop-Profil mit Foto und Öffnungszeiten",
    "🎁 1 Deal einstellbar",
  ],
  basis: [
    "✓ Alles aus Free",
    "📊 Scans- & Besuchs-Statistik",
    "🗂️ Crew-Stempelkarte (Stammkunden-Bindung)",
    "🔔 1× Flash-Push gratis zum Testen",
    "✓ Verifiziert-Badge",
  ],
  pro: [
    "✓ Alles aus Basis",
    "♾️ Unbegrenzte Deals (statt 1)",
    "⚡ 3 Flash-Pushes/Monat inklusive",
    "⭐ Spotlight 3 Tage/Monat inklusive",
    "📈 Erweiterte Analytics: Top-Zeiten, Wiederkehr-Rate, Kiez-Benchmark",
    "🔍 Konkurrenz-Vergleich im Kiez",
    "📱 Social-Media-Templates",
    "✉️ 1 Email-Kampagne an Stammkunden/Monat",
  ],
  ultra: [
    "✓ Alles aus Pro",
    "💎 Dauer-Spotlight (permanent Gold-Pin)",
    "📣 Push-Broadcast an ganze Stadt",
    "🥇 Stadt-Feature (1× im Monat Shop-der-Woche)",
    "🎯 Demografie-Targeting für Deals",
    "📄 Kiez-Report PDF (monatlich)",
    "🎨 Custom-Pin-Design",
    "🏆 Priority-Support",
  ],
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
  guardian_xp:   { sku: "guardian_xp",   name: "Wächter-XP-Boost",   price: 299,  icon: "⚡", desc: "+2.500 XP für euren Wächter" },
  guardian_skin: { sku: "guardian_skin", name: "Wächter-Glow-Skin",  price: 499,  icon: "✨", desc: "Leuchtender Rahmen für euren Wächter (dauerhaft)" },
};

// ── Ad-Rewards ────────────────────────────────────────

export const AD_REWARDS = {
  post_walk:    { xp: 100, cooldown_min: 720, label: "Lauf-Bonus",            description: "+100 🪙 Wegemünzen für 30 Sek Video" },
  pre_walk:     { xp: 250, cooldown_min: 360, label: "Pre-Walk-Starter",     description: "+250 🪙 vor dem Lauf-Start" },
  boost_24h:    { xp: 0,   cooldown_min: 1440, label: "24h Doppel-🪙",         description: "Kurzes Video für 24h 2× Wegemünzen" },
  double_xp:    { xp: 0,   cooldown_min: 360, label: "15 Min Doppel-🪙",       description: "Direkt-Boost für nächsten Lauf" },
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
  { icon: "💰", title: "Crew-Schatz", desc: "Gemeinsamer 🪙-Topf für Gruppen-Rabatte" },
  { icon: "⚔️", title: "Auto-Matchmaking", desc: "Wöchentliche Duelle gegen Rivalen" },
  { icon: "🎨", title: "Custom-Branding", desc: "Logo, Farbe, Gebiet-Style" },
  { icon: "📈", title: "Analytics-Dashboard", desc: "Aktivität pro Mitglied, Inaktivitäts-Alarm" },
  { icon: "💬", title: "Private Chat + Pinnwand", desc: "Sprachnachrichten, wichtige Posts anheften" },
  { icon: "👕", title: "Crew-Merch-Shop", desc: "T-Shirts & Caps mit eurem Logo" },
];
