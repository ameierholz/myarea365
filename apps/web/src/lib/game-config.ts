// ═══════════════════════════════════════════════════════════
//  MyArea365 Game Config
// ═══════════════════════════════════════════════════════════

export const RUNNER_RANKS = [
  { id: 1, name: "Straßen-Scout",        minXp: 0,     color: "#9BA3B5" },
  { id: 2, name: "Stadt-Pionier",        minXp: 500,   color: "#22D1C3" },
  { id: 3, name: "Viertel-Boss",         minXp: 2500,  color: "#FF2D78" },
  { id: 4, name: "Metropolen-Legende",   minXp: 10000, color: "#FFD700" },
] as const;

export const FACTIONS = [
  { id: "syndicate", name: "Syndicate", color: "#22D1C3", power: 12500 },
  { id: "vanguard",  name: "Vanguard",  color: "#FF2D78", power: 14200 },
] as const;

export const UNLOCKABLE_MARKERS = [
  { id: "foot",     icon: "👣",  cost: 0,      name: "Basic"  },
  { id: "runner",   icon: "🏃",  cost: 500,    name: "Athlet" },
  { id: "skate",    icon: "🛹",  cost: 2000,   name: "Skater" },
  { id: "bike",     icon: "🚴",  cost: 5000,   name: "Biker"  },
  { id: "rocket",   icon: "🚀",  cost: 10000,  name: "Rakete" },
  { id: "ufo",      icon: "🛸",  cost: 25000,  name: "Alien"  },
  { id: "phoenix",  icon: "🔥",  cost: 50000,  name: "Phoenix" },
  { id: "crown",    icon: "👑",  cost: 100000, name: "König"  },
] as const;

export const CREW_COLORS = ["#22D1C3", "#FF2D78", "#FFD700", "#A855F7", "#FF6B4A"] as const;

// XP rewards
export const XP_PER_TERRITORY = 500;
export const XP_PER_KM = 100;
export const MIN_ROUTE_POINTS = 3;

export function getCurrentRank(xp: number) {
  return [...RUNNER_RANKS].reverse().find((r) => xp >= r.minXp) || RUNNER_RANKS[0];
}

export function getNextRank(xp: number) {
  return RUNNER_RANKS.find((r) => xp < r.minXp) || null;
}

// Haversine distance between two coordinates in meters
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

// Reverse geocoding via OpenStreetMap Nominatim (free, no API key)
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { "Accept-Language": "de" } }
    );
    const data = await res.json();
    const addr = data.address;
    const street = addr?.road || addr?.pedestrian || addr?.footway || addr?.path || "Unbekannter Weg";
    const num = addr?.house_number ? " " + addr.house_number : "";
    return street + num;
  } catch {
    return "Unbekannter Weg";
  }
}

// Dummy data - other runners on the map
export const LIVE_OTHER_RUNNERS = [
  { id: "r1", username: "KiezKönig",  team_color: "#FF2D78", territories: 42, km: 124.5, lat: 52.6050, lng: 13.3520 },
  { id: "r2", username: "Pacer99",    team_color: "#22D1C3", territories: 18, km: 56.2,  lat: 52.5980, lng: 13.3590 },
  { id: "r3", username: "NightWolf",  team_color: "#FFD700", territories: 31, km: 89.1,  lat: 52.6020, lng: 13.3550 },
];
