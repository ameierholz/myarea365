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

// ═══════════════════════════════════════════════════════════
//  ERWEITERTE MAP-FEATURES (alles Demo, später Supabase-Realtime)
// ═══════════════════════════════════════════════════════════

// Zentrum für Demo — Berlin Prenzlauer Berg
const DEMO_CENTER = { lat: 52.5400, lng: 13.4100 };

// Geschlossene Territorien (Polygon-Gebiete wo Straßenzüge einen Ring bilden)
export type ClaimedArea = {
  id: string;
  name: string;
  polygon: Array<{ lat: number; lng: number }>; // geschlossener Ring
  owner_type: "me" | "crew" | "enemy_crew" | "enemy_solo";
  owner_name: string;
  owner_color: string;
  faction: "syndicate" | "vanguard" | null;
  level: 1 | 2 | 3;                              // Upgrade-Stufe
  captured_at: string;                            // ISO-Datum
  passive_power_per_day: number;                  // Macht/Tag
  buff_type: "xp_multiplier" | "shield" | "radar" | "speed" | "none";
  buff_value: number;                             // 1.5, 2, etc.
  contributors: string[];                         // Usernames die beigetragen haben
};

// Legacy-Konstante (nicht mehr direkt genutzt, siehe generateDemoMapData)
export const DEMO_CLAIMED_AREAS_LEGACY: ClaimedArea[] = [
  {
    id: "area-1",
    name: "Kollwitz-Bastion",
    polygon: [
      { lat: 52.5390, lng: 13.4085 },
      { lat: 52.5395, lng: 13.4085 },
      { lat: 52.5395, lng: 13.4100 },
      { lat: 52.5390, lng: 13.4100 },
    ],
    owner_type: "me",
    owner_name: "Du",
    owner_color: "#22D1C3",
    faction: "syndicate",
    level: 2,
    captured_at: "2026-03-15",
    passive_power_per_day: 25,
    buff_type: "xp_multiplier",
    buff_value: 1.5,
    contributors: ["Du"],
  },
  {
    id: "area-2",
    name: "Rykestr-Festung",
    polygon: [
      { lat: 52.5405, lng: 13.4110 },
      { lat: 52.5418, lng: 13.4105 },
      { lat: 52.5420, lng: 13.4125 },
      { lat: 52.5408, lng: 13.4130 },
    ],
    owner_type: "crew",
    owner_name: "Syndicate-Squad",
    owner_color: "#22D1C3",
    faction: "syndicate",
    level: 3,
    captured_at: "2026-02-28",
    passive_power_per_day: 50,
    buff_type: "shield",
    buff_value: 48,
    contributors: ["Du", "KiezKönig", "Pacer99"],
  },
  {
    id: "area-3",
    name: "Schönhauser-Territorium",
    polygon: [
      { lat: 52.5370, lng: 13.4070 },
      { lat: 52.5380, lng: 13.4065 },
      { lat: 52.5385, lng: 13.4080 },
      { lat: 52.5375, lng: 13.4085 },
    ],
    owner_type: "enemy_crew",
    owner_name: "Kreuzberg Kollektiv",
    owner_color: "#a855f7",
    faction: "vanguard",
    level: 2,
    captured_at: "2026-03-01",
    passive_power_per_day: 25,
    buff_type: "radar",
    buff_value: 10,
    contributors: ["NeonFuchs"],
  },
];

// Supply Drops (durch Rewarded Ads gespawnte Loot-Pakete)
export type SupplyDrop = {
  id: string;
  lat: number;
  lng: number;
  expires_at: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  content_xp: number;
  content_marker_id?: string;
};

export const DEMO_SUPPLY_DROPS_LEGACY: SupplyDrop[] = [
  {
    id: "drop-1",
    lat: 52.5410, lng: 13.4095,
    expires_at: new Date(Date.now() + 32 * 60 * 1000).toISOString(), // 32 min
    rarity: "rare",
    content_xp: 250,
    content_marker_id: "hedgehog",
  },
  {
    id: "drop-2",
    lat: 52.5385, lng: 13.4120,
    expires_at: new Date(Date.now() + 18 * 60 * 1000).toISOString(),
    rarity: "epic",
    content_xp: 750,
  },
];

// Glitch-Zonen (versteckte Bonus-XP-Gebiete, aufgedeckt durch Drohnen-Scan)
export type GlitchZone = {
  id: string;
  lat: number;
  lng: number;
  radius_m: number;
  xp_multiplier: number;
  expires_at: string;
};

export const DEMO_GLITCH_ZONES_LEGACY: GlitchZone[] = [
  {
    id: "glitch-1",
    lat: 52.5425, lng: 13.4075,
    radius_m: 80,
    xp_multiplier: 3,
    expires_at: new Date(Date.now() + 8 * 60 * 1000).toISOString(),
  },
];

// Runner auf der Karte — sowohl Crew-Mitglieder als auch andere Läufer
export type MapRunner = {
  id: string;
  username: string;
  lat: number;
  lng: number;
  is_walking: boolean;
  current_km: number;
  color: string;                          // eigene Team-Farbe
  is_crew_member: boolean;                // wenn true → besondere Kennzeichnung
  crew_color?: string;                    // Farbe der eigenen Crew wenn Mitglied
  faction: "syndicate" | "vanguard";
  marker_icon: string;                    // equipped Map-Icon (Emoji)
};

// Legacy-Alias (alte Komponenten)
export type CrewMember = MapRunner;

// Missionen — tägliche + wöchentliche Ziele
export type Mission = {
  id: string;
  type: "daily" | "weekly";
  name: string;
  description: string;
  icon: string;
  progress: number;
  target: number;
  reward_xp: number;
  lat?: number; // falls ortsgebunden
  lng?: number;
};

export const DEMO_MISSIONS: Mission[] = [
  { id: "m1", type: "daily", name: "3 neue Straßen",     description: "Erlaufe 3 Straßen die du noch nie betreten hast",   icon: "🆕", progress: 1, target: 3, reward_xp: 300 },
  { id: "m2", type: "daily", name: "5 km sammeln",       description: "Schaffe heute insgesamt 5 km",                       icon: "📏", progress: 2.3, target: 5, reward_xp: 200 },
  { id: "m3", type: "weekly", name: "Kiez-Sweep",        description: "10 verschiedene Straßen in 7 Tagen erobern",         icon: "🧹", progress: 4, target: 10, reward_xp: 1500 },
  { id: "m4", type: "weekly", name: "Gebiet einkreisen", description: "Schließe einen Straßen-Ring um einen Block",         icon: "🔒", progress: 0, target: 1, reward_xp: 2000 },
];

// Boost-Shop — gegen XP kaufbare Items
export type Boost = {
  id: string;
  name: string;
  description: string;
  icon: string;
  cost_xp: number;
  duration_label: string;
  accent: string;
};

export const DEMO_BOOSTS: Boost[] = [
  { id: "b1", name: "2× XP Boost",        description: "30 Minuten doppelte XP bei allen Territorien",     icon: "⚡", cost_xp: 500,   duration_label: "30 min",   accent: "#FFD700" },
  { id: "b2", name: "Territoriums-Schild", description: "48 Stunden Schutz vor Angriffen auf dein Gebiet", icon: "🛡️", cost_xp: 1200,  duration_label: "48 std",   accent: "#5ddaf0" },
  { id: "b3", name: "Nebelgranate",       description: "2 Stunden unsichtbar auf der Karte",               icon: "💨", cost_xp: 800,   duration_label: "2 std",    accent: "#a855f7" },
  { id: "b4", name: "Drohnen-Scan",       description: "Deckt 10 Minuten lang Glitch-Zonen auf",           icon: "📡", cost_xp: 600,   duration_label: "10 min",   accent: "#22D1C3" },
  { id: "b5", name: "Sprint-Modus",       description: "1 Stunde 1.3× XP für jeden gelaufenen km",         icon: "💨", cost_xp: 400,   duration_label: "1 std",    accent: "#FF6B4A" },
  { id: "b6", name: "Radar-Störsender",   description: "24h — halbiert feindliche XP in deinem Gebiet",    icon: "📶", cost_xp: 1500,  duration_label: "24 std",   accent: "#FF2D78" },
];

// Happy Hour — Zeitfenster mit XP-Multiplikator
export type HappyHour = {
  active: boolean;
  multiplier: number;
  ends_at: string;
  label: string;
};

export function getCurrentHappyHour(): HappyHour {
  // Demo: Happy Hour zwischen 18-19 Uhr Deutsche Zeit
  const now = new Date();
  const h = now.getHours();
  if (h === 18) {
    const end = new Date(now);
    end.setHours(19, 0, 0, 0);
    return { active: true, multiplier: 2, ends_at: end.toISOString(), label: "Abend-Rush" };
  }
  if (h === 7) {
    const end = new Date(now);
    end.setHours(8, 0, 0, 0);
    return { active: true, multiplier: 2, ends_at: end.toISOString(), label: "Morgen-Boost" };
  }
  // Demo-Fallback: immer aktiv für Test-Zwecke
  return {
    active: true,
    multiplier: 2,
    ends_at: new Date(now.getTime() + 47 * 60 * 1000).toISOString(),
    label: "Power Hour",
  };
}

// Demo-Daten um User-Position herum generieren (kleine lat/lng-Deltas)
// Erzeugt 3 Polygon-Territorien, 3 Supply Drops, 1 Glitch-Zone und 8 Runner
export function generateDemoMapData(center: { lat: number; lng: number }) {
  const d = 0.0020; // ~200m Offset
  const { lat: cLat, lng: cLng } = center;

  // Polygone folgen einem jagged "Straßen-Muster" — mehrere Eckpunkte mit
  // unregelmäßigen Winkeln (so wie Straßenzüge tatsächlich um Blöcke laufen).
  // Später via OSM/Mapbox Street-Snap berechnet aus der tatsächlich gelaufenen Polyline.
  const claimed_areas: ClaimedArea[] = [
    {
      id: "area-1",
      name: "Kiez-Bastion",
      polygon: [
        { lat: cLat + d * 0.30, lng: cLng - d * 0.80 },
        { lat: cLat + d * 0.55, lng: cLng - d * 0.82 }, // Straßen-Ecke
        { lat: cLat + d * 0.58, lng: cLng - d * 0.60 },
        { lat: cLat + d * 0.85, lng: cLng - d * 0.58 }, // Kreuzung
        { lat: cLat + d * 0.88, lng: cLng - d * 0.20 },
        { lat: cLat + d * 1.00, lng: cLng - d * 0.18 },
        { lat: cLat + d * 1.02, lng: cLng + d * 0.18 },
        { lat: cLat + d * 0.70, lng: cLng + d * 0.20 },
        { lat: cLat + d * 0.68, lng: cLng + d * 0.05 }, // Querstraße
        { lat: cLat + d * 0.32, lng: cLng + d * 0.03 },
      ],
      owner_type: "me",
      owner_name: "Du",
      owner_color: "#22D1C3",
      faction: "syndicate",
      level: 2,
      captured_at: "2026-03-15",
      passive_power_per_day: 25,
      buff_type: "xp_multiplier",
      buff_value: 1.5,
      contributors: ["Du"],
    },
    {
      id: "area-2",
      name: "Crew-Festung",
      polygon: [
        { lat: cLat - d * 0.30, lng: cLng + d * 0.50 },
        { lat: cLat - d * 0.15, lng: cLng + d * 0.48 },
        { lat: cLat - d * 0.12, lng: cLng + d * 0.72 },
        { lat: cLat + d * 0.08, lng: cLng + d * 0.74 }, // Ecke
        { lat: cLat + d * 0.22, lng: cLng + d * 0.40 },
        { lat: cLat + d * 0.40, lng: cLng + d * 0.42 },
        { lat: cLat + d * 0.42, lng: cLng + d * 1.10 }, // lange Straße
        { lat: cLat + d * 0.25, lng: cLng + d * 1.45 },
        { lat: cLat - d * 0.02, lng: cLng + d * 1.48 },
        { lat: cLat - d * 0.10, lng: cLng + d * 1.20 },
        { lat: cLat - d * 0.28, lng: cLng + d * 0.88 },
      ],
      owner_type: "crew",
      owner_name: "Syndicate-Squad",
      owner_color: "#22D1C3",
      faction: "syndicate",
      level: 3,
      captured_at: "2026-02-28",
      passive_power_per_day: 50,
      buff_type: "shield",
      buff_value: 48,
      contributors: ["Du", "KiezKönig", "Pacer99"],
    },
    {
      id: "area-3",
      name: "Feindliches Gebiet",
      polygon: [
        { lat: cLat - d * 1.20, lng: cLng - d * 0.80 },
        { lat: cLat - d * 1.00, lng: cLng - d * 0.90 },
        { lat: cLat - d * 0.70, lng: cLng - d * 0.85 },
        { lat: cLat - d * 0.52, lng: cLng - d * 0.70 }, // Diagonale (Pfad)
        { lat: cLat - d * 0.40, lng: cLng - d * 0.88 },
        { lat: cLat - d * 0.18, lng: cLng - d * 0.60 },
        { lat: cLat - d * 0.22, lng: cLng - d * 0.25 },
        { lat: cLat - d * 0.55, lng: cLng - d * 0.15 },
        { lat: cLat - d * 0.85, lng: cLng - d * 0.18 },
        { lat: cLat - d * 1.05, lng: cLng - d * 0.40 },
      ],
      owner_type: "enemy_crew",
      owner_name: "Kreuzberg Kollektiv",
      owner_color: "#a855f7",
      faction: "vanguard",
      level: 2,
      captured_at: "2026-03-01",
      passive_power_per_day: 25,
      buff_type: "radar",
      buff_value: 10,
      contributors: ["NeonFuchs"],
    },
  ];

  const supply_drops: SupplyDrop[] = [
    {
      id: "drop-1",
      lat: cLat + d * 0.5, lng: cLng + d * 0.2,
      expires_at: new Date(Date.now() + 32 * 60 * 1000).toISOString(),
      rarity: "rare",
      content_xp: 250,
      content_marker_id: "hedgehog",
    },
    {
      id: "drop-2",
      lat: cLat - d * 0.6, lng: cLng + d * 0.8,
      expires_at: new Date(Date.now() + 18 * 60 * 1000).toISOString(),
      rarity: "epic",
      content_xp: 750,
    },
    {
      id: "drop-3",
      lat: cLat + d * 0.9, lng: cLng - d * 0.4,
      expires_at: new Date(Date.now() + 44 * 60 * 1000).toISOString(),
      rarity: "legendary",
      content_xp: 1500,
    },
  ];

  const glitch_zones: GlitchZone[] = [
    {
      id: "glitch-1",
      lat: cLat + d * 1.2, lng: cLng + d * 0.3,
      radius_m: 80,
      xp_multiplier: 3,
      expires_at: new Date(Date.now() + 8 * 60 * 1000).toISOString(),
    },
  ];

  // Alle Runner (Crew + Solo) um User-Position — jeder mit equippedem Map-Icon
  const runners: MapRunner[] = [
    // Crew-Mitglieder (Syndicate)
    { id: "r1", username: "KiezKönig",  lat: cLat + d * 0.4, lng: cLng + d * 0.3,  is_walking: true,  current_km: 2.3, color: "#22D1C3", is_crew_member: true,  crew_color: "#22D1C3", faction: "syndicate", marker_icon: "🦅" },
    { id: "r2", username: "Pacer99",    lat: cLat + d * 0.7, lng: cLng - d * 0.1,  is_walking: false, current_km: 0,   color: "#22D1C3", is_crew_member: true,  crew_color: "#22D1C3", faction: "syndicate", marker_icon: "🏃" },
    // Fremde Vanguard-Fraktion
    { id: "r3", username: "NeonFuchs",  lat: cLat - d * 0.7, lng: cLng - d * 0.5,  is_walking: true,  current_km: 4.1, color: "#a855f7", is_crew_member: false,                       faction: "vanguard",  marker_icon: "🔥" },
    { id: "r4", username: "Strider",    lat: cLat - d * 0.3, lng: cLng + d * 1.2,  is_walking: true,  current_km: 1.8, color: "#FF2D78", is_crew_member: false,                       faction: "vanguard",  marker_icon: "⚡" },
    { id: "r5", username: "WalkerJane", lat: cLat + d * 1.1, lng: cLng + d * 0.6,  is_walking: false, current_km: 0,   color: "#FF6B4A", is_crew_member: false,                       faction: "vanguard",  marker_icon: "🚶" },
    // Solo-Läufer Syndicate aber keine eigene Crew
    { id: "r6", username: "DriftGhost", lat: cLat - d * 0.5, lng: cLng + d * 0.9,  is_walking: true,  current_km: 3.2, color: "#5ddaf0", is_crew_member: false,                       faction: "syndicate", marker_icon: "🐺" },
    { id: "r7", username: "NightRun42", lat: cLat + d * 0.2, lng: cLng - d * 1.3,  is_walking: false, current_km: 0,   color: "#5ddaf0", is_crew_member: false,                       faction: "syndicate", marker_icon: "🛸" },
  ];

  return { claimed_areas, supply_drops, glitch_zones, runners };
}

// Live-Metriken auf der Karte (Demo — später aus Supabase Realtime)
export const DEMO_MAP_LIVE = {
  runners_in_zip:   7,              // PLZ-Gebiet
  zip:              "10437",
  district:         "Prenzlauer Berg",
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
