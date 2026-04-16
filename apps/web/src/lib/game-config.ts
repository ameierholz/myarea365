// ═══════════════════════════════════════════════════════════
//  MyArea365 Game Config
// ═══════════════════════════════════════════════════════════

export const RUNNER_RANKS = [
  { id: 1, name: "Straßen-Scout",        minXp: 0,     color: "#888888" },
  { id: 2, name: "Stadt-Pionier",        minXp: 500,   color: "#5ddaf0" },
  { id: 3, name: "Viertel-Boss",         minXp: 2500,  color: "#ef7169" },
  { id: 4, name: "Metropolen-Legende",   minXp: 10000, color: "#FFD700" },
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

// Achievements — einmalige Belohnungen
export const ACHIEVEMENTS = [
  { id: "first_5k",      name: "Erste 5 km",           xp: 500,   icon: "🏃" },
  { id: "first_10k",     name: "Erster 10 km-Run",     xp: 1000,  icon: "💪" },
  { id: "ten_territories", name: "10 Territorien",     xp: 1000,  icon: "📍" },
  { id: "streak_30",     name: "30 Tage Streak",       xp: 5000,  icon: "🔥" },
  { id: "lifetime_100k", name: "100 km Lifetime",      xp: 5000,  icon: "🎯" },
  { id: "hundred_territories", name: "100 Territorien", xp: 10000, icon: "👑" },
] as const;

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
