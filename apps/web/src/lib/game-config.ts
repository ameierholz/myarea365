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

// 11 Map-Icons (Marker-Skins) — nur Geh-/Lauf-themed, keine motorisierten oder zu schnellen Icons
export const UNLOCKABLE_MARKERS = [
  { id: "foot",      icon: "👣",  cost: 0,      name: "Basic"     },
  { id: "walker",    icon: "🚶",  cost: 250,    name: "Wanderer"  },
  { id: "runner",    icon: "🏃",  cost: 500,    name: "Athlet"    },
  { id: "hiker",     icon: "🥾",  cost: 2000,   name: "Hiker"     },
  { id: "sneaker",   icon: "👟",  cost: 5000,   name: "Sneaker"   },
  { id: "rocket",    icon: "🚀",  cost: 10000,  name: "Rakete"    },
  { id: "lightning", icon: "⚡",  cost: 15000,  name: "Blitz"     },
  { id: "ufo",       icon: "🛸",  cost: 25000,  name: "Alien"     },
  { id: "phoenix",   icon: "🔥",  cost: 50000,  name: "Phoenix"   },
  { id: "dragon",    icon: "🐉",  cost: 75000,  name: "Drache"    },
  { id: "crown",     icon: "👑",  cost: 100000, name: "Legende"   },
] as const;

// 10 Runner Lights (Schweif-Varianten)
export const RUNNER_LIGHTS = [
  { id: "classic",  name: "Classic",  cost: 0,      color: "#5ddaf0", gradient: ["#5ddaf0"],                    width: 6  },
  { id: "coral",    name: "Coral",    cost: 250,    color: "#ef7169", gradient: ["#ef7169"],                    width: 6  },
  { id: "gold",     name: "Gold",     cost: 750,    color: "#FFD700", gradient: ["#FFD700"],                    width: 7  },
  { id: "neon",     name: "Neon",     cost: 1500,   color: "#a855f7", gradient: ["#a855f7", "#FF2D78"],         width: 7  },
  { id: "fire",     name: "Feuer",    cost: 3000,   color: "#FF6B4A", gradient: ["#FF6B4A", "#FFD700"],         width: 8  },
  { id: "ice",      name: "Eis",      cost: 5000,   color: "#7CC8F0", gradient: ["#7CC8F0", "#FFFFFF"],         width: 8  },
  { id: "rainbow",  name: "Regenbogen", cost: 10000, color: "#FF0000", gradient: ["#FF0000","#FFDD00","#00FF00","#00A5FF","#8B00FF"], width: 9 },
  { id: "shadow",   name: "Schatten", cost: 20000,  color: "#2a3040", gradient: ["#2a3040", "#0B0E13"],         width: 9  },
  { id: "plasma",   name: "Plasma",   cost: 40000,  color: "#00FFFF", gradient: ["#00FFFF", "#FF00FF", "#00FFFF"], width: 10 },
  { id: "aurora",   name: "Aurora",   cost: 80000,  color: "#5ddaf0", gradient: ["#5ddaf0","#a855f7","#FF2D78","#FFD700"], width: 12 },
] as const;

export const CREW_COLORS = ["#5ddaf0", "#ef7169", "#FFD700", "#a855f7"] as const;

// XP rewards
export const XP_PER_TERRITORY = 500;
export const MIN_ROUTE_POINTS = 3;

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
