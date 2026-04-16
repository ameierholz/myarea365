// ═══════════════════════════════════════════════════════════
//  MyArea365 Game Config
// ═══════════════════════════════════════════════════════════

// 10 Runner-Ränge — exponentielle Progression bis 1 Mio XP (Endgame)
export const RUNNER_RANKS = [
  { id: 1,  name: "Straßen-Scout",       minXp: 0,       color: "#888888" },
  { id: 2,  name: "Kiez-Wanderer",       minXp: 250,     color: "#b0b8c8" },
  { id: 3,  name: "Block-Kundschafter",  minXp: 1000,    color: "#5ddaf0" },
  { id: 4,  name: "Stadt-Pionier",       minXp: 3500,    color: "#22D1C3" },
  { id: 5,  name: "Bezirks-Entdecker",   minXp: 10000,   color: "#3b82f6" },
  { id: 6,  name: "Viertel-Boss",        minXp: 25000,   color: "#FF6B4A" },
  { id: 7,  name: "Kiez-König",          minXp: 60000,   color: "#FF2D78" },
  { id: 8,  name: "Metropolen-Legende",  minXp: 150000,  color: "#FFD700" },
  { id: 9,  name: "Urbaner Mythos",      minXp: 400000,  color: "#e0e7ff" },
  { id: 10, name: "Straßen-Gott",        minXp: 1000000, color: "#FFFFFF" },
] as const;

export const FACTIONS = [
  { id: "syndicate", name: "Syndicate", color: "#5ddaf0", power: 12500 },
  { id: "vanguard",  name: "Vanguard",  color: "#ef7169", power: 14200 },
] as const;

// 20 Map-Icons — exponentielle Kostenkurve (~×1.6 pro Stufe), Endgame nur für Hardcore
export const UNLOCKABLE_MARKERS = [
  { id: "foot",        icon: "👣",  cost: 0,         name: "Basic"         },
  { id: "walker",      icon: "🚶",  cost: 100,       name: "Wanderer"      },
  { id: "runner",      icon: "🏃",  cost: 250,       name: "Athlet"        },
  { id: "paw",         icon: "🐾",  cost: 500,       name: "Pfoten"        },
  { id: "hedgehog",    icon: "🦔",  cost: 1000,      name: "Igel"          },
  { id: "rabbit",      icon: "🐇",  cost: 2000,      name: "Hase"          },
  { id: "turtle",      icon: "🐢",  cost: 3500,      name: "Schildkröte"   },
  { id: "dog",         icon: "🐕",  cost: 6000,      name: "Hund"          },
  { id: "rocket",      icon: "🚀",  cost: 10000,     name: "Rakete"        },
  { id: "deer",        icon: "🦌",  cost: 16000,     name: "Hirsch"        },
  { id: "lightning",   icon: "⚡",  cost: 25000,     name: "Blitz"         },
  { id: "wolf",        icon: "🐺",  cost: 40000,     name: "Wolf"          },
  { id: "ufo",         icon: "🛸",  cost: 65000,     name: "Alien"         },
  { id: "butterfly",   icon: "🦋",  cost: 100000,    name: "Schmetterling" },
  { id: "phoenix",     icon: "🔥",  cost: 160000,    name: "Phoenix"       },
  { id: "eagle",       icon: "🦅",  cost: 250000,    name: "Adler"         },
  { id: "dragon",      icon: "🐉",  cost: 400000,    name: "Drache"        },
  { id: "meteor",      icon: "☄️",  cost: 650000,    name: "Komet"         },
  { id: "unicorn",     icon: "🦄",  cost: 1000000,   name: "Einhorn"       },
  { id: "hero",        icon: "🦸",  cost: 1500000,   name: "Legende"       },
] as const;

// 20 Runner Lights — exponentielle Kostenkurve (~×1.6 pro Stufe)
export const RUNNER_LIGHTS = [
  { id: "classic",  name: "Classic",    cost: 0,         color: "#5ddaf0", gradient: ["#5ddaf0"],                                      width: 6  },
  { id: "coral",    name: "Coral",      cost: 100,       color: "#ef7169", gradient: ["#ef7169"],                                      width: 6  },
  { id: "emerald",  name: "Emerald",    cost: 250,       color: "#10b981", gradient: ["#10b981"],                                      width: 6  },
  { id: "gold",     name: "Gold",       cost: 500,       color: "#FFD700", gradient: ["#FFD700"],                                      width: 7  },
  { id: "sapphire", name: "Saphir",     cost: 1000,      color: "#3b82f6", gradient: ["#3b82f6"],                                      width: 7  },
  { id: "neon",     name: "Neon",       cost: 2000,      color: "#a855f7", gradient: ["#a855f7", "#FF2D78"],                           width: 7  },
  { id: "sunset",   name: "Sunset",     cost: 3500,      color: "#FF6B4A", gradient: ["#FF6B4A", "#FFD700"],                           width: 7  },
  { id: "fire",     name: "Feuer",      cost: 6000,      color: "#FF6B4A", gradient: ["#FF6B4A", "#FFD700"],                           width: 8  },
  { id: "ocean",    name: "Ozean",      cost: 10000,     color: "#0ea5e9", gradient: ["#0ea5e9", "#06b6d4"],                           width: 8  },
  { id: "ice",      name: "Eis",        cost: 16000,     color: "#7CC8F0", gradient: ["#7CC8F0", "#FFFFFF"],                           width: 8  },
  { id: "forest",   name: "Wald",       cost: 25000,     color: "#22c55e", gradient: ["#14532d", "#22c55e"],                           width: 8  },
  { id: "rainbow",  name: "Regenbogen", cost: 40000,     color: "#FF0000", gradient: ["#FF0000","#FFDD00","#00FF00","#00A5FF","#8B00FF"], width: 9  },
  { id: "candy",    name: "Candy",      cost: 65000,     color: "#ec4899", gradient: ["#ec4899", "#fbbf24"],                           width: 9  },
  { id: "shadow",   name: "Schatten",   cost: 100000,    color: "#2a3040", gradient: ["#2a3040", "#0B0E13"],                           width: 9  },
  { id: "lava",     name: "Lava",       cost: 160000,    color: "#ef4444", gradient: ["#7f1d1d", "#ef4444", "#fbbf24"],                width: 10 },
  { id: "plasma",   name: "Plasma",     cost: 250000,    color: "#00FFFF", gradient: ["#00FFFF", "#FF00FF", "#00FFFF"],                width: 10 },
  { id: "galaxy",   name: "Galaxie",    cost: 400000,    color: "#7c3aed", gradient: ["#1e1b4b", "#7c3aed", "#ec4899"],                width: 10 },
  { id: "arctic",   name: "Arktis",     cost: 650000,    color: "#7dd3fc", gradient: ["#0c4a6e", "#7dd3fc", "#FFFFFF"],                width: 11 },
  { id: "aurora",   name: "Aurora",     cost: 1000000,   color: "#5ddaf0", gradient: ["#5ddaf0","#a855f7","#FF2D78","#FFD700"],        width: 12 },
  { id: "cosmic",   name: "Kosmos",     cost: 1500000,   color: "#22d3ee", gradient: ["#312e81", "#7c3aed", "#22d3ee", "#ec4899"],      width: 13 },
] as const;

export const CREW_COLORS = ["#5ddaf0", "#ef7169", "#FFD700", "#a855f7"] as const;

// XP rewards — zentrale Quelle für alle XP-Vergaben
export const XP_PER_TERRITORY = 500;
export const XP_PER_KM = 50;
export const XP_PER_WALK = 100;
export const XP_REWARDED_AD = 250;
export const XP_KIEZ_CHECKIN = 500;
export const XP_CREW_WIN = 2000;
export const MIN_ROUTE_POINTS = 3;

// Tages-Streak — Bonus XP abhängig von Streak-Dauer (max 200/Tag ab Tag 10)
export function streakBonusXp(streakDays: number): number {
  if (streakDays < 2) return 0;
  if (streakDays <= 3) return 25;
  if (streakDays <= 6) return 50;
  if (streakDays <= 9) return 100;
  return 200;
}

// Stats-Keys die Achievements referenzieren können
export type AchievementStatKey =
  | "longest_km"
  | "lifetime_km"
  | "territories"
  | "streak_best"
  | "total_walks";

// Achievements — einmalige Belohnungen
export const ACHIEVEMENTS: Array<{
  id: string;
  name: string;
  xp: number;
  icon: string;
  stat: AchievementStatKey;
  target: number;
  unit: string;
}> = [
  { id: "first_walk",          name: "Erster Lauf",          xp: 100,    icon: "👟", stat: "total_walks",   target: 1,    unit: "" },
  { id: "streak_3",            name: "3 Tage Serie",         xp: 200,    icon: "🔥", stat: "streak_best",   target: 3,    unit: "Tage" },
  { id: "first_5k",            name: "Erste 5 km",           xp: 500,    icon: "🏃", stat: "longest_km",    target: 5,    unit: "km" },
  { id: "ten_walks",           name: "10 Läufe",             xp: 500,    icon: "✅", stat: "total_walks",   target: 10,   unit: "" },
  { id: "streak_7",            name: "7 Tage Serie",         xp: 750,    icon: "🌟", stat: "streak_best",   target: 7,    unit: "Tage" },
  { id: "first_10k",           name: "Erster 10-km-Lauf",    xp: 1000,   icon: "💪", stat: "longest_km",    target: 10,   unit: "km" },
  { id: "ten_territories",     name: "10 Territorien",       xp: 1000,   icon: "📍", stat: "territories",   target: 10,   unit: "" },
  { id: "streak_14",           name: "14 Tage Serie",        xp: 2000,   icon: "⚡", stat: "streak_best",   target: 14,   unit: "Tage" },
  { id: "fifty_walks",         name: "50 Läufe",             xp: 2500,   icon: "🎖️", stat: "total_walks",   target: 50,   unit: "" },
  { id: "streak_30",           name: "30 Tage Serie",        xp: 5000,   icon: "🔥", stat: "streak_best",   target: 30,   unit: "Tage" },
  { id: "lifetime_100k",       name: "100 km gelaufen",      xp: 5000,   icon: "🎯", stat: "lifetime_km",   target: 100,  unit: "km" },
  { id: "first_halfmarathon",  name: "Erster Halbmarathon",  xp: 10000,  icon: "🏅", stat: "longest_km",    target: 21.1, unit: "km" },
  { id: "hundred_walks",       name: "100 Läufe",            xp: 10000,  icon: "🏆", stat: "total_walks",   target: 100,  unit: "" },
  { id: "hundred_territories", name: "100 Territorien",      xp: 10000,  icon: "👑", stat: "territories",   target: 100,  unit: "" },
  { id: "first_marathon",      name: "Erster Marathon",      xp: 25000,  icon: "🥇", stat: "longest_km",    target: 42.2, unit: "km" },
  { id: "lifetime_500k",       name: "500 km gelaufen",      xp: 25000,  icon: "🌍", stat: "lifetime_km",   target: 500,  unit: "km" },
  { id: "five_hundred_territories", name: "500 Territorien", xp: 50000,  icon: "⭐", stat: "territories",   target: 500,  unit: "" },
  { id: "lifetime_1000k",      name: "1000 km gelaufen",     xp: 100000, icon: "🏔️", stat: "lifetime_km",   target: 1000, unit: "km" },
];

// Settings options
export const UNITS = [
  { id: "metric", label: "Metrisch (km)" },
  { id: "imperial", label: "Imperial (mi)" },
] as const;

export const LANGUAGES = [
  { id: "de", label: "Deutsch 🇩🇪" },
  { id: "en", label: "English 🇬🇧" },
] as const;

export function getCurrentRank(xp: number) {
  return [...RUNNER_RANKS].reverse().find((r) => xp >= r.minXp) || RUNNER_RANKS[0];
}

export function getNextRank(xp: number) {
  return RUNNER_RANKS.find((r) => xp < r.minXp) || null;
}

// Haversine distance in meters
export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Reverse geocoding via OpenStreetMap Nominatim
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { "Accept-Language": "de" } }
    );
    const data = await res.json();
    const addr = data.address;
    const street = addr?.road || addr?.pedestrian || addr?.footway || addr?.path || "Unbekanntes Gebiet";
    const num = addr?.house_number ? " " + addr.house_number : "";
    return street + num;
  } catch {
    return "Unbekanntes Gebiet";
  }
}

// Dummy data – other runners on the map
export const LIVE_OTHER_RUNNERS = [
  { id: "r1", username: "KiezKönig",  team_color: "#ef7169", territories: 42, km: 124.5, lat: 52.6050, lng: 13.3520 },
  { id: "r2", username: "Pacer99",    team_color: "#5ddaf0", territories: 18, km: 56.2,  lat: 52.5980, lng: 13.3590 },
];

// Detaillierte Demo-Profile für andere Runner (Klick auf Angreifer öffnet Modal)
export type DemoRunnerProfile = {
  username:      string;
  display_name:  string;
  team_color:    string;
  rank_name:     string;
  rank_color:    string;
  xp:            number;
  territories:   number;
  total_km:      number;
  streak_days:   number;
  streak_best:   number;
  faction:       "syndicate" | "vanguard";
  crew_name:     string | null;
  crew_color:    string | null;
  marker_icon:   string;
  light_color:   string;
  member_since:  string; // ISO-Datum
  last_seen:     string; // relative, z.B. "gerade aktiv"
};

export const DEMO_RUNNERS: Record<string, DemoRunnerProfile> = {
  NeonFuchs: {
    username:      "NeonFuchs",
    display_name:  "Neon Fuchs",
    team_color:    "#a855f7",
    rank_name:     "Kiez-König",
    rank_color:    "#FF2D78",
    xp:            72500,
    territories:   31,
    total_km:      187.3,
    streak_days:   14,
    streak_best:   28,
    faction:       "vanguard",
    crew_name:     "Kreuzberg Kollektiv",
    crew_color:    "#a855f7",
    marker_icon:   "🔥",
    light_color:   "#FF2D78",
    member_since:  "2025-11-03",
    last_seen:     "gerade aktiv",
  },
  KiezKönig: {
    username:      "KiezKönig",
    display_name:  "Kiez König",
    team_color:    "#ef7169",
    rank_name:     "Bezirks-Entdecker",
    rank_color:    "#3b82f6",
    xp:            18400,
    territories:   42,
    total_km:      124.5,
    streak_days:   9,
    streak_best:   21,
    faction:       "vanguard",
    crew_name:     "Friedrichshain Force",
    crew_color:    "#ef7169",
    marker_icon:   "🦅",
    light_color:   "#FF6B4A",
    member_since:  "2025-09-17",
    last_seen:     "vor 2 min",
  },
  Pacer99: {
    username:      "Pacer99",
    display_name:  "Pacer99",
    team_color:    "#5ddaf0",
    rank_name:     "Stadt-Pionier",
    rank_color:    "#22D1C3",
    xp:            4200,
    territories:   18,
    total_km:      56.2,
    streak_days:   3,
    streak_best:   7,
    faction:       "syndicate",
    crew_name:     null,
    crew_color:    null,
    marker_icon:   "🏃",
    light_color:   "#5ddaf0",
    member_since:  "2026-01-22",
    last_seen:     "gerade aktiv",
  },
};

// Live-Metriken auf der Karte (Demo — später aus Supabase Realtime)
export const DEMO_MAP_LIVE = {
  runners_in_zip:   7,              // PLZ-Gebiet
  zip:              "10437",
  runners_in_city:  143,             // Stadt gesamt
  city:             "Berlin",
  // Aktueller Angriff auf einen Straßenzug (während Walk)
  active_attack: {
    active:       true,
    street_name:  "Danziger Straße",
    attacker_username: "NeonFuchs",
    attacker_color: "#a855f7",
    by_own_crew:  false,
  },
  // Angriff auf bereits eroberten Straßenzug (Territorium)
  territory_attack: {
    active:       true,
    street_name:  "Schönhauser Allee 42",
    attacker_username: "KiezKönig",
    attacker_color: "#ef7169",
    defender_type: "me" as "me" | "crew",
  },
};

// ═══ DEMO-DATEN — zum Testen vor Live-Daten (in Production auf false) ═══
export const DEMO_MODE = true;

export const DEMO_STATS = {
  xp: 3500,
  total_distance_m: 47500,
  total_walks: 23,
  total_calories: 2850,
  streak_days: 7,
  streak_best: 14,
  longest_run_m: 6200,
  longest_run_s: 2340,
  territory_count: 18,
};

// Demo-Straßen für Runs
const DEMO_STREETS = [
  "Schönhauser Allee", "Kastanienallee", "Danziger Straße", "Greifswalder Straße",
  "Prenzlauer Allee", "Eberswalder Straße", "Rykestraße", "Husemannstraße",
  "Kollwitzstraße", "Wörther Straße", "Belforter Straße", "Knaackstraße",
  "Stargarder Straße", "Dunckerstraße", "Lychener Straße", "Raumerstraße",
];

export function generateDemoRecentRuns() {
  const runs = [];
  const now = Date.now();
  // 28 Runs verteilt über die letzten 60 Tage (mehrere pro Tag möglich für Heatmap-Varianz)
  const daysOffset = [0, 0, 1, 2, 2, 3, 4, 5, 6, 7, 9, 10, 12, 14, 16, 18, 20, 22, 25, 28, 31, 34, 38, 42, 46, 50, 54, 58];
  for (let i = 0; i < daysOffset.length; i++) {
    const daysAgo = daysOffset[i];
    const date = new Date(now - daysAgo * 24 * 60 * 60 * 1000);
    date.setHours(7 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60));
    const distance = 800 + Math.floor(Math.random() * 5500);
    const duration = Math.floor(distance / (2.8 + Math.random() * 1.2));
    const xp = 500 + Math.floor(distance / 1000) * 50;
    runs.push({
      id: `demo-${i}`,
      street_name: DEMO_STREETS[i % DEMO_STREETS.length],
      distance_m: distance,
      duration_s: duration,
      xp_earned: xp,
      created_at: date.toISOString(),
    });
  }
  return runs;
}
