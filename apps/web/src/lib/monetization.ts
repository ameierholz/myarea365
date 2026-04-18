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

// ── Preise (in Cents) ────────────────────────────────────────

export const PLANS = {
  plus_monthly:     { sku: "plus_monthly",     name: "MyArea+ Monat",       price: 399,   duration_days: 30,  target: "user" as const },
  plus_yearly:      { sku: "plus_yearly",      name: "MyArea+ Jahr",        price: 2900,  duration_days: 365, target: "user" as const, savings_pct: 40 },
  plus_lifetime:    { sku: "plus_lifetime",    name: "MyArea+ Lifetime",    price: 9900,  duration_days: null, target: "user" as const },
  crew_pro_monthly: { sku: "crew_pro_monthly", name: "Crew-Pro Monat",      price: 999,   duration_days: 30,  target: "crew" as const },
  crew_pro_yearly:  { sku: "crew_pro_yearly",  name: "Crew-Pro Jahr",       price: 7900,  duration_days: 365, target: "crew" as const, savings_pct: 34 },
};

export const BOOST_PACKS = {
  boost_24h:     { sku: "boost_24h",     name: "24 Stunden Doppel-XP",   price: 99,  multiplier: 2, hours: 24 },
  boost_48h:     { sku: "boost_48h",     name: "48 Stunden Doppel-XP",   price: 199, multiplier: 2, hours: 48 },
  boost_week_2x: { sku: "boost_week_2x", name: "1 Woche Doppel-XP",      price: 499, multiplier: 2, hours: 168 },
  boost_week_3x: { sku: "boost_week_3x", name: "1 Woche Triple-XP",      price: 899, multiplier: 3, hours: 168 },
};

export const EXTRAS = {
  crew_slot:     { sku: "crew_slot",     name: "Eigene Crew gründen",      price: 499 },
  streak_pack_5: { sku: "streak_pack_5", name: "5× Streak-Freeze",         price: 299 },
  badge_bronze:  { sku: "badge_bronze",  name: "Bronze-Supporter-Badge",   price: 199 },
  badge_silver:  { sku: "badge_silver",  name: "Silber-Supporter-Badge",   price: 499 },
  badge_gold:    { sku: "badge_gold",    name: "Gold-Supporter-Badge",     price: 999 },
};

export function formatPrice(cents: number): string {
  return `€ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

// ── Ad-Rewards ────────────────────────────────────────

export const AD_REWARDS = {
  post_walk:    { xp: 100, cooldown_min: 60,  label: "Lauf-Bonus",            description: "+100 XP für 30 Sek Video" },
  boost_24h:    { xp: 0,   cooldown_min: 1440, label: "24h Doppel-XP",         description: "Kurzes Video für 24h 2× XP" },
  double_xp:    { xp: 0,   cooldown_min: 360, label: "15 Min Doppel-XP",       description: "Direkt-Boost für nächsten Lauf" },
  streak_save:  { xp: 0,   cooldown_min: 720, label: "Streak retten",          description: "Verpasster Tag einmalig verzeihen" },
};

// MyArea+ Features (als Display-Liste)
export const PLUS_FEATURES = [
  { icon: "🚫", title: "Werbefrei", desc: "Keine Banner, keine Pflicht-Videos" },
  { icon: "📴", title: "Offline-Karten", desc: "Läufe ohne Datenvolumen aufzeichnen" },
  { icon: "📊", title: "Erweiterte Statistik", desc: "Jahresvergleich, Kiez-Heatmap, HR-Import" },
  { icon: "🎨", title: "Custom-Marker", desc: "Eigene Farbe & Emoji-Mix für deinen Pin" },
  { icon: "🌈", title: "Profil-Themes", desc: "Animierte Banner & exklusive Badges" },
  { icon: "❄️", title: "Streak-Freeze", desc: "3× / Monat Streak pausieren" },
  { icon: "⚡", title: "Flash-Deal-Priorität", desc: "5 Min vor allen anderen sehen" },
  { icon: "🔒", title: "Private Runs", desc: "Läufe aus öffentlichem Leaderboard halten" },
  { icon: "📤", title: "GPX/TCX-Export", desc: "Zu Strava/Garmin exportieren" },
  { icon: "🎙️", title: "Pace-Coach Voice", desc: "KI-Motivation während Lauf" },
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
