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
  {
    id: "syndicate",
    name: "Nachtpuls",
    short: "NP",
    color: "#22D1C3",
    icon: "🌙",
    motto: "Strategie. Rhythmus. Stille Siege.",
    power: 12500,
  },
  {
    id: "vanguard",
    name: "Sonnenwacht",
    short: "SW",
    color: "#FF6B4A",
    icon: "☀️",
    motto: "Mut. Tempo. Offene Wege.",
    power: 14200,
  },
] as const;

export type FactionId = "syndicate" | "vanguard";

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

export const CREW_COLORS = [
  "#5ddaf0", // Cyan
  "#ef7169", // Koralle
  "#FFD700", // Gold
  "#a855f7", // Violett
  "#22D1C3", // Teal
  "#FF2D78", // Pink
  "#4ade80", // Neon-Grün
  "#F97316", // Orange
] as const;

/* ═══════════════════════════════════════════════════════
 * CREW-TYPEN — Wer läuft zusammen?
 * ═══════════════════════════════════════════════════════ */
export type CrewTypeId =
  | "friends"
  | "family"
  | "school"
  | "work"
  | "sports"
  | "neighborhood"
  | "open";

export type CrewType = {
  id: CrewTypeId;
  icon: string;
  name: string;
  tagline: string;
  description: string;
};

export const CREW_TYPES: CrewType[] = [
  {
    id: "friends",
    icon: "🎉",
    name: "Freundeskreis",
    tagline: "Kumpels vereint",
    description: "Deine engsten Freunde — gemeinsam Kilometer sammeln, gegenseitig pushen, Spaß haben.",
  },
  {
    id: "family",
    icon: "👨‍👩‍👧",
    name: "Familie",
    tagline: "Alle Generationen",
    description: "Eltern, Kids, Opa und Oma — Familien-Challenges bringen alle zusammen in Bewegung.",
  },
  {
    id: "school",
    icon: "🎓",
    name: "Schule / Uni",
    tagline: "Klasse oder Campus",
    description: "Deine Klasse, Stufe oder Kommilitonen. Wer schafft mehr Gebiete — eure Schule oder die Rivalen?",
  },
  {
    id: "work",
    icon: "💼",
    name: "Arbeitskollegen",
    tagline: "Team-Fitness statt Mittagspause",
    description: "Nach Feierabend oder in der Mittagspause zusammen laufen — schweißt mehr als Meetings.",
  },
  {
    id: "sports",
    icon: "🏃",
    name: "Sportverein",
    tagline: "Verein & Trainingsgruppe",
    description: "Lauftreff, Walking-Gruppe, Triathlon-Team — nutzt euren Zusammenhalt auch außerhalb des Trainings.",
  },
  {
    id: "neighborhood",
    icon: "🏘️",
    name: "Nachbarschaft",
    tagline: "Dein Kiez, deine Crew",
    description: "Nachbarn, die sich sonst nur kurz grüßen — werdet zum Kiez-Team das den Block dominiert.",
  },
  {
    id: "open",
    icon: "🌐",
    name: "Offene Community",
    tagline: "Jeder ist willkommen",
    description: "Offen für alle — trefft neue Leute, baut eine lokale Bewegungs-Community auf.",
  },
];

/* ═══════════════════════════════════════════════════════
 * CREW PRIVACY
 * ═══════════════════════════════════════════════════════ */
export type CrewPrivacy = "open" | "invite" | "closed";
export const CREW_PRIVACY_OPTIONS: { id: CrewPrivacy; label: string; hint: string; icon: string }[] = [
  { id: "open",   icon: "🌍", label: "Öffentlich",    hint: "Jeder kann beitreten" },
  { id: "invite", icon: "🔑", label: "Per Einladung", hint: "Nur mit Einladungs-Code" },
  { id: "closed", icon: "🔒", label: "Geschlossen",   hint: "Admin muss freigeben" },
];

/* ═══════════════════════════════════════════════════════
 * DEMO: CREW-MITGLIEDER, CHALLENGES, EVENTS, CHAT, NEARBY
 * ═══════════════════════════════════════════════════════ */
export type CrewMemberRole = "admin" | "captain" | "member";
export type CrewMember = {
  id: string;
  username: string;
  display_name: string;
  avatar_emoji: string;
  role: CrewMemberRole;
  weekly_km: number;
  weekly_xp: number;
  rank_name: string;
  online: boolean;
};

export const DEMO_CREW_MEMBERS: CrewMember[] = [
  { id: "m1", username: "NeonFuchs",   display_name: "Lena K.",     avatar_emoji: "🦊", role: "admin",   weekly_km: 24.3, weekly_xp: 1820, rank_name: "Kiez-König",         online: true  },
  { id: "m2", username: "Pacer99",     display_name: "Jonas B.",    avatar_emoji: "🚀", role: "captain", weekly_km: 18.7, weekly_xp: 1410, rank_name: "Bezirks-Entdecker",  online: true  },
  { id: "m3", username: "KiezKönig",   display_name: "Sam M.",      avatar_emoji: "👑", role: "captain", weekly_km: 16.2, weekly_xp: 1230, rank_name: "Viertel-Boss",       online: false },
  { id: "m4", username: "StadtPuma",   display_name: "Ines R.",     avatar_emoji: "🐆", role: "member",  weekly_km: 12.8, weekly_xp: 980,  rank_name: "Stadt-Pionier",      online: true  },
  { id: "m5", username: "Schrittzahl", display_name: "Tim H.",      avatar_emoji: "👟", role: "member",  weekly_km: 9.4,  weekly_xp: 720,  rank_name: "Block-Kundschafter", online: false },
  { id: "m6", username: "WegFinder",   display_name: "Aylin S.",    avatar_emoji: "🧭", role: "member",  weekly_km: 7.1,  weekly_xp: 540,  rank_name: "Kiez-Wanderer",      online: false },
];

export type CrewChallenge = {
  id: string;
  title: string;
  description: string;
  icon: string;
  target: number;
  current: number;
  unit: string;
  reward_xp: number;
  ends_at: string; // ISO
};

export const DEMO_CREW_CHALLENGES: CrewChallenge[] = [
  {
    id: "c1",
    title: "Wochen-Ziel: 150 km",
    description: "Gemeinsam 150 km in dieser Woche — jeder Schritt zählt.",
    icon: "🔥",
    target: 150, current: 88.5, unit: "km",
    reward_xp: 2500,
    ends_at: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: "c2",
    title: "Revier-Sperre",
    description: "20 Territorien im Crew-Revier sichern, bevor jemand angreift.",
    icon: "🛡️",
    target: 20, current: 13, unit: "Gebiete",
    reward_xp: 1800,
    ends_at: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: "c3",
    title: "Früh-Vögel",
    description: "5 Läufe vor 8 Uhr morgens — die Crew gewinnt den Tag.",
    icon: "🌅",
    target: 5, current: 2, unit: "Läufe",
    reward_xp: 900,
    ends_at: new Date(Date.now() + 4 * 24 * 3600 * 1000).toISOString(),
  },
];

export type CrewEvent = {
  id: string;
  title: string;
  when_iso: string;
  meeting_point: string;
  lat: number;
  lng: number;
  attendees: number;
  host_username: string;
  distance_km: number;
  pace: string;
  note?: string;
};

export const DEMO_CREW_EVENTS: CrewEvent[] = [
  {
    id: "e1",
    title: "Feierabend-Runde durch den Kiez",
    when_iso: new Date(Date.now() + 1 * 24 * 3600 * 1000).toISOString(),
    meeting_point: "Wasserturm Prenzlauer Berg",
    lat: 52.5361, lng: 13.4076,
    attendees: 7,
    host_username: "NeonFuchs",
    distance_km: 6,
    pace: "entspannt (6:30 min/km)",
    note: "Wer Lust hat, kommt danach noch ins Späti ums Eck.",
  },
  {
    id: "e2",
    title: "Samstag-Long-Run",
    when_iso: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
    meeting_point: "Mauerpark Haupteingang",
    lat: 52.5418, lng: 13.4023,
    attendees: 4,
    host_username: "Pacer99",
    distance_km: 12,
    pace: "moderat (5:45 min/km)",
  },
];

export type CrewChatMessage = {
  id: string;
  username: string;
  display_name: string;
  avatar_emoji: string;
  text: string;
  ts_iso: string;
};

export const DEMO_CREW_CHAT: CrewChatMessage[] = [
  { id: "x1", username: "NeonFuchs",   display_name: "Lena",  avatar_emoji: "🦊", text: "Jemand Bock auf Morgenrunde?",                       ts_iso: new Date(Date.now() - 60 * 55 * 1000).toISOString() },
  { id: "x2", username: "Pacer99",     display_name: "Jonas", avatar_emoji: "🚀", text: "Ich bin dabei, 7 Uhr am Wasserturm?",                ts_iso: new Date(Date.now() - 40 * 60 * 1000).toISOString() },
  { id: "x3", username: "StadtPuma",   display_name: "Ines",  avatar_emoji: "🐆", text: "Zu früh 😭 aber heute Abend gern!",                  ts_iso: new Date(Date.now() - 22 * 60 * 1000).toISOString() },
  { id: "x4", username: "NeonFuchs",   display_name: "Lena",  avatar_emoji: "🦊", text: "Ok dann 19 Uhr gleiche Stelle — wir brauchen noch 2 Territorien für die Wochen-Challenge!", ts_iso: new Date(Date.now() - 8 * 60 * 1000).toISOString() },
];

export type NearbyCrew = {
  id: string;
  name: string;
  type: CrewTypeId;
  color: string;
  continent: string;  // "Europa", "Nordamerika", "Asien", …
  country: string;    // "Deutschland", "France", "USA", …
  state: string;      // Bundesland / Region: "Berlin", "Bayern", "Île-de-France", …
  region: string;     // Stadt/Ort: "Berlin", "München", "Paris", …
  city: string;       // Bezirk / Stadtteil: "Pankow", "Altstadt", "Le Marais", …
  zip: string;        // PLZ-Gebiet: "10405"
  faction: FactionId; // Fraktions-Zugehörigkeit
  member_count: number;
  weekly_km: number;
  privacy: CrewPrivacy;
  motto: string;
  distance_km: number;
};

export const DEMO_NEARBY_CREWS: NearbyCrew[] = [
  // ═══ DEUTSCHLAND ═══
  // Berlin / Pankow
  { id: "n1",  name: "Kiez Läufer 13435",   type: "neighborhood", color: "#22D1C3", continent: "Europa", country: "Deutschland", state: "Berlin",              region: "Berlin",    city: "Pankow",            zip: "13435", faction: "syndicate", member_count: 18, weekly_km: 312,  privacy: "open",   motto: "Ein Kiez, eine Crew.",                 distance_km: 0.4 },
  { id: "n2",  name: "Prenzl'Pack",         type: "friends",      color: "#a855f7", continent: "Europa", country: "Deutschland", state: "Berlin",              region: "Berlin",    city: "Pankow",            zip: "10405", faction: "vanguard", member_count: 8,  weekly_km: 124,  privacy: "invite", motto: "Small but fast.",                      distance_km: 2.1 },
  { id: "n3",  name: "MIT Pankow",          type: "work",         color: "#FFD700", continent: "Europa", country: "Deutschland", state: "Berlin",              region: "Berlin",    city: "Pankow",            zip: "13187", faction: "syndicate", member_count: 14, weekly_km: 210,  privacy: "closed", motto: "Lunchtime legends.",                   distance_km: 3.5 },
  { id: "n4",  name: "Weißensee Walker",    type: "neighborhood", color: "#4ade80", continent: "Europa", country: "Deutschland", state: "Berlin",              region: "Berlin",    city: "Pankow",            zip: "13086", faction: "syndicate", member_count: 22, weekly_km: 380,  privacy: "open",   motto: "Vom Weißen See bis Buchholz.",         distance_km: 5.2 },
  // Berlin / Mitte
  { id: "n5",  name: "Alex-Runners",        type: "open",         color: "#FF2D78", continent: "Europa", country: "Deutschland", state: "Berlin",              region: "Berlin",    city: "Mitte",             zip: "10178", faction: "vanguard", member_count: 42, weekly_km: 890,  privacy: "open",   motto: "Vom Alex bis zum Ring.",               distance_km: 1.2 },
  { id: "n6",  name: "Laufteam Humboldt",   type: "school",       color: "#4ade80", continent: "Europa", country: "Deutschland", state: "Berlin",              region: "Berlin",    city: "Mitte",             zip: "10117", faction: "syndicate", member_count: 27, weekly_km: 480,  privacy: "open",   motto: "Uni-Running ohne Klausur.",            distance_km: 4.0 },
  // Berlin / Kreuzberg
  { id: "n7",  name: "Kreuzkölln Runners",  type: "open",         color: "#F97316", continent: "Europa", country: "Deutschland", state: "Berlin",              region: "Berlin",    city: "Kreuzberg",         zip: "10999", faction: "vanguard", member_count: 56, weekly_km: 1120, privacy: "open",   motto: "Never early, always there.",           distance_km: 7.1 },
  { id: "n8",  name: "SO36 Family Runs",    type: "family",       color: "#ef7169", continent: "Europa", country: "Deutschland", state: "Berlin",              region: "Berlin",    city: "Kreuzberg",         zip: "10997", faction: "vanguard", member_count: 11, weekly_km: 98,   privacy: "invite", motto: "Eltern, Kids, Kilometer.",             distance_km: 7.5 },
  // München
  { id: "n9",  name: "Isar-Squad",          type: "open",         color: "#22D1C3", continent: "Europa", country: "Deutschland", state: "Bayern",              region: "München",   city: "Altstadt",          zip: "80331", faction: "syndicate", member_count: 63, weekly_km: 1320, privacy: "open",   motto: "An der Isar entlang, immer.",          distance_km: 510 },
  { id: "n10", name: "Marienplatz Mittag",  type: "work",         color: "#5ddaf0", continent: "Europa", country: "Deutschland", state: "Bayern",              region: "München",   city: "Altstadt",          zip: "80333", faction: "vanguard", member_count: 19, weekly_km: 230,  privacy: "closed", motto: "Statt Schnitzel lieber Sprint.",       distance_km: 510 },
  { id: "n11", name: "TSV Pasing",          type: "sports",       color: "#FFD700", continent: "Europa", country: "Deutschland", state: "Bayern",              region: "München",   city: "Pasing",            zip: "81241", faction: "syndicate", member_count: 87, weekly_km: 1910, privacy: "open",   motto: "Verein läuft weiter — draußen.",       distance_km: 514 },
  // Hamburg
  { id: "n12", name: "Alster-Crew",         type: "open",         color: "#a855f7", continent: "Europa", country: "Deutschland", state: "Hamburg",             region: "Hamburg",   city: "Harvestehude",      zip: "20149", faction: "syndicate", member_count: 51, weekly_km: 980,  privacy: "open",   motto: "Die Alster ist unser Wohnzimmer.",     distance_km: 255 },
  { id: "n13", name: "HafenCity Runners",   type: "work",         color: "#FF2D78", continent: "Europa", country: "Deutschland", state: "Hamburg",             region: "Hamburg",   city: "HafenCity",         zip: "20457", faction: "vanguard", member_count: 28, weekly_km: 520,  privacy: "invite", motto: "Elphi in Sicht, los!",                 distance_km: 256 },
  // Köln
  { id: "n14", name: "Rheinauhafen Rebels", type: "friends",      color: "#4ade80", continent: "Europa", country: "Deutschland", state: "Nordrhein-Westfalen", region: "Köln",      city: "Altstadt-Süd",      zip: "50678", faction: "vanguard", member_count: 14, weekly_km: 220,  privacy: "invite", motto: "Am Rhein, aber flott.",                distance_km: 475 },
  { id: "n15", name: "Domstürmer",          type: "open",         color: "#F97316", continent: "Europa", country: "Deutschland", state: "Nordrhein-Westfalen", region: "Köln",      city: "Altstadt-Nord",     zip: "50667", faction: "syndicate", member_count: 73, weekly_km: 1440, privacy: "open",   motto: "Rund um den Dom in unter 10.",         distance_km: 473 },
  // Leipzig
  { id: "n16", name: "Connewitz Collective",type: "neighborhood", color: "#22D1C3", continent: "Europa", country: "Deutschland", state: "Sachsen",             region: "Leipzig",   city: "Connewitz",         zip: "04277", faction: "vanguard", member_count: 34, weekly_km: 620,  privacy: "open",   motto: "Südvorstadt bis Connewitz.",           distance_km: 149 },

  // ═══ ÖSTERREICH ═══
  { id: "n17", name: "Wiener Schleife",     type: "open",         color: "#5ddaf0", continent: "Europa", country: "Österreich",  state: "Wien",                region: "Wien",      city: "Innere Stadt",      zip: "1010",  faction: "vanguard", member_count: 45, weekly_km: 820,  privacy: "open",   motto: "Ringrunde in 40.",                     distance_km: 520 },
  { id: "n18", name: "Salzach Sprinter",    type: "sports",       color: "#FFD700", continent: "Europa", country: "Österreich",  state: "Salzburg",            region: "Salzburg",  city: "Altstadt",          zip: "5020",  faction: "syndicate", member_count: 22, weekly_km: 410,  privacy: "open",   motto: "Mozart rennt mit.",                    distance_km: 610 },

  // ═══ SCHWEIZ ═══
  { id: "n19", name: "Limmat Striders",     type: "open",         color: "#ef7169", continent: "Europa", country: "Schweiz",     state: "Zürich",              region: "Zürich",    city: "Altstadt",          zip: "8001", faction: "syndicate", member_count: 38, weekly_km: 760,  privacy: "open",   motto: "Vom See bis Üetliberg.",               distance_km: 730 },

  // ═══ FRANKREICH ═══
  { id: "n20", name: "Marais Runners",      type: "friends",      color: "#a855f7", continent: "Europa", country: "France",      state: "Île-de-France",       region: "Paris",     city: "Le Marais",         zip: "75004", faction: "vanguard", member_count: 29, weekly_km: 540,  privacy: "open",   motto: "Croissant after, promis.",             distance_km: 1050 },
  { id: "n21", name: "Seine Sunset Crew",   type: "open",         color: "#FF2D78", continent: "Europa", country: "France",      state: "Île-de-France",       region: "Paris",     city: "Quartier Latin",    zip: "75005", faction: "syndicate", member_count: 66, weekly_km: 1280, privacy: "open",   motto: "Cours au bord de la Seine.",           distance_km: 1050 },
  { id: "n22", name: "Vieux-Lyon Legs",     type: "neighborhood", color: "#22D1C3", continent: "Europa", country: "France",      state: "Auvergne-Rhône-Alpes", region: "Lyon",    city: "Vieux-Lyon",        zip: "69005", faction: "vanguard", member_count: 18, weekly_km: 290,  privacy: "invite", motto: "Montées et descentes.",                distance_km: 890 },

  // ═══ NIEDERLANDE ═══
  { id: "n23", name: "Vondelpark Pack",     type: "open",         color: "#F97316", continent: "Europa", country: "Nederland",   state: "Noord-Holland",       region: "Amsterdam", city: "Oud-Zuid",          zip: "1071", faction: "syndicate", member_count: 81, weekly_km: 1560, privacy: "open",   motto: "Loopjes door de stad.",                distance_km: 650 },

  // ═══ SPANIEN ═══
  { id: "n24", name: "Barrio Running BCN",  type: "open",         color: "#FFD700", continent: "Europa", country: "España",      state: "Catalunya",           region: "Barcelona", city: "El Born",           zip: "08003", faction: "vanguard", member_count: 54, weekly_km: 1040, privacy: "open",   motto: "De la playa a Montjuïc.",              distance_km: 1500 },
  { id: "n25", name: "Madrid Retiro Crew",  type: "open",         color: "#FF2D78", continent: "Europa", country: "España",      state: "Comunidad de Madrid", region: "Madrid",    city: "Retiro",            zip: "28009", faction: "vanguard", member_count: 47, weekly_km: 880,  privacy: "open",   motto: "Vueltas al parque, sin parar.",        distance_km: 1870 },

  // ═══ ITALIEN ═══
  { id: "n26", name: "Tevere Strider",      type: "open",         color: "#ef7169", continent: "Europa", country: "Italia",      state: "Lazio",               region: "Roma",      city: "Trastevere",        zip: "00153", faction: "syndicate", member_count: 39, weekly_km: 720,  privacy: "open",   motto: "Corri lungo il Tevere.",               distance_km: 1280 },
  { id: "n27", name: "Navigli Nightrun",    type: "friends",      color: "#a855f7", continent: "Europa", country: "Italia",      state: "Lombardia",           region: "Milano",    city: "Navigli",           zip: "20143", faction: "vanguard", member_count: 24, weekly_km: 390,  privacy: "invite", motto: "Aperitivo dopo, sempre.",              distance_km: 1050 },

  // ═══ UK ═══
  { id: "n28", name: "Regent's Park Pacers",type: "open",         color: "#4ade80", continent: "Europa", country: "United Kingdom", state: "England",          region: "London",    city: "Camden",            zip: "NW1",   faction: "vanguard", member_count: 94, weekly_km: 1820, privacy: "open",   motto: "Rain or shine.",                       distance_km: 1100 },
  { id: "n29", name: "Shoreditch Squad",    type: "work",         color: "#5ddaf0", continent: "Europa", country: "United Kingdom", state: "England",          region: "London",    city: "Shoreditch",        zip: "E1",    faction: "syndicate", member_count: 31, weekly_km: 580,  privacy: "closed", motto: "Startup founders need cardio.",        distance_km: 1105 },

  // ═══ USA ═══
  { id: "n30", name: "Central Park Crew",   type: "open",         color: "#FFD700", continent: "Nordamerika", country: "USA",         state: "New York",            region: "New York",  city: "Upper West Side",   zip: "10024", faction: "syndicate", member_count: 128, weekly_km: 2410, privacy: "open",  motto: "The loop is life.",                    distance_km: 6400 },
  { id: "n31", name: "Venice Beach Runners",type: "friends",      color: "#22D1C3", continent: "Nordamerika", country: "USA",         state: "California",          region: "Los Angeles", city: "Venice",          zip: "90291", faction: "vanguard", member_count: 52, weekly_km: 970,  privacy: "open",   motto: "Boardwalk or nothing.",                distance_km: 9400 },

  // ═══ JAPAN ═══
  { id: "n32", name: "Shibuya Sprinters",   type: "open",         color: "#FF2D78", continent: "Asien", country: "日本 Japan",  state: "Tokyo-to",            region: "Tokyo",     city: "Shibuya",           zip: "150-0002", faction: "syndicate", member_count: 76, weekly_km: 1380, privacy: "open", motto: "クロスして走る。",                     distance_km: 9000 },

  // ═══ THAILAND (Urlaub!) ═══
  { id: "n33", name: "Bangkok Lumphini",    type: "open",         color: "#F97316", continent: "Asien", country: "Thailand",    state: "Bangkok",             region: "Bangkok",   city: "Pathum Wan",        zip: "10330", faction: "vanguard", member_count: 42, weekly_km: 760,  privacy: "open",   motto: "5 Uhr morgens, bevor es zu heiß wird.", distance_km: 8500 },
  { id: "n34", name: "Phuket Morning Run",  type: "open",         color: "#22D1C3", continent: "Asien", country: "Thailand",    state: "Phuket",              region: "Phuket",    city: "Patong",            zip: "83150", faction: "syndicate", member_count: 15, weekly_km: 240,  privacy: "open",   motto: "Urlaubs-Modus aktiv.",                 distance_km: 8900 },
];

// Aggregationen: Hilfsfunktionen um die Hierarchie für die UI zu bauen
export type GeoBucket<T = NearbyCrew> = {
  key: string;
  label: string;
  crews: T[];
  child_count: number;
};

// ISO-2-Codes für Flag-Bilder (via flagcdn.com)
const COUNTRY_ISO: Record<string, string> = {
  "Deutschland": "de",
  "Österreich": "at",
  "Schweiz": "ch",
  "France": "fr",
  "Nederland": "nl",
  "España": "es",
  "Italia": "it",
  "United Kingdom": "gb",
  "USA": "us",
  "日本 Japan": "jp",
  "Thailand": "th",
};
export function isoForCountry(country: string): string | null {
  return COUNTRY_ISO[country] || null;
}
// Emoji für Kontinent (Welt-Globus)
const CONTINENT_EMOJI: Record<string, string> = {
  "Europa": "🌍",
  "Nordamerika": "🌎",
  "Südamerika": "🌎",
  "Asien": "🌏",
  "Afrika": "🌍",
  "Ozeanien": "🌏",
};
export function emojiForContinent(continent: string): string {
  return CONTINENT_EMOJI[continent] || "🌐";
}

// ═══ LIGA-SYSTEM ═══
export type LeagueTier = {
  id: string;
  name: string;
  icon: string;
  color: string;
  minWeeklyKm: number;
};
export const LEAGUE_TIERS: LeagueTier[] = [
  { id: "bronze",   name: "Bronze",   icon: "🥉", color: "#CD7F32", minWeeklyKm: 0     },
  { id: "silver",   name: "Silber",   icon: "🥈", color: "#C0C8D8", minWeeklyKm: 200   },
  { id: "gold",     name: "Gold",     icon: "🥇", color: "#FFD700", minWeeklyKm: 500   },
  { id: "diamond",  name: "Diamant",  icon: "💎", color: "#5ddaf0", minWeeklyKm: 1000  },
  { id: "legend",   name: "Legende",  icon: "👑", color: "#FF2D78", minWeeklyKm: 2000  },
];
export function leagueTierFor(weeklyKm: number): LeagueTier {
  let best = LEAGUE_TIERS[0];
  for (const t of LEAGUE_TIERS) {
    if (weeklyKm >= t.minWeeklyKm) best = t;
  }
  return best;
}
export function nextLeagueTier(current: LeagueTier): LeagueTier | null {
  const i = LEAGUE_TIERS.findIndex((t) => t.id === current.id);
  return i >= 0 && i < LEAGUE_TIERS.length - 1 ? LEAGUE_TIERS[i + 1] : null;
}

// ═══ SAISON — Kalendermonat (synchron mit Health-Monats-Challenge) ═══
const MONTHS_DE = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];

export function currentSeason(): {
  key: string;          // "2026-04"
  label: string;        // "April 2026"
  month: number;        // 0..11
  year: number;
  startISO: string;
  endISO: string;
  daysLeft: number;
  daysTotal: number;
} {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 1); // exklusiv = 1. des Folgemonats
  const daysTotal = Math.round((end.getTime() - start.getTime()) / (24 * 3600 * 1000));
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (24 * 3600 * 1000)));
  return {
    key: `${year}-${String(month + 1).padStart(2, "0")}`,
    label: `${MONTHS_DE[month]} ${year}`,
    month, year,
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    daysLeft, daysTotal,
  };
}

export function previousSeasonLabel(): string {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${MONTHS_DE[prev.getMonth()]} ${prev.getFullYear()}`;
}

// Demo: Liga-Ergebnis der Vormonats-Saison (in echt aus DB)
export const DEMO_LAST_SEASON_TIER_ID = "silver";

// ═══ DEMO RUNNER-BESTENLISTE (mit Geo-Hierarchie) ═══
export type RankingRunner = {
  id: string;
  username: string;
  display_name: string;
  avatar_emoji: string;
  crew_name: string | null;
  crew_color: string | null;
  rank_name: string;
  weekly_km: number;
  weekly_xp: number;
  total_xp: number;
  continent: string;
  country: string;
  state: string;
  region: string;
  city: string;
  zip: string;
};

export const DEMO_RANKING_RUNNERS: RankingRunner[] = [
  { id: "r1",  username: "NeonFuchs",   display_name: "Lena K.",   avatar_emoji: "🦊", crew_name: "Kiez Läufer 13435", crew_color: "#22D1C3", rank_name: "Kiez-König",        weekly_km: 48.2, weekly_xp: 2820, total_xp: 184_200, continent: "Europa", country: "Deutschland", state: "Berlin",  region: "Berlin",    city: "Pankow",          zip: "13435" },
  { id: "r2",  username: "Pacer99",     display_name: "Jonas B.",  avatar_emoji: "🚀", crew_name: "Prenzl'Pack",       crew_color: "#a855f7", rank_name: "Bezirks-Entdecker", weekly_km: 42.1, weekly_xp: 2410, total_xp: 156_800, continent: "Europa", country: "Deutschland", state: "Berlin",  region: "Berlin",    city: "Pankow",          zip: "10405" },
  { id: "r3",  username: "KiezKönig",   display_name: "Sam M.",    avatar_emoji: "👑", crew_name: "Alex-Runners",      crew_color: "#FF2D78", rank_name: "Viertel-Boss",      weekly_km: 38.6, weekly_xp: 2230, total_xp: 142_100, continent: "Europa", country: "Deutschland", state: "Berlin",  region: "Berlin",    city: "Mitte",           zip: "10178" },
  { id: "r4",  username: "StadtPuma",   display_name: "Ines R.",   avatar_emoji: "🐆", crew_name: "Kiez Läufer 13435", crew_color: "#22D1C3", rank_name: "Stadt-Pionier",     weekly_km: 31.8, weekly_xp: 1980, total_xp: 98_400,  continent: "Europa", country: "Deutschland", state: "Berlin",  region: "Berlin",    city: "Pankow",          zip: "13435" },
  { id: "r5",  username: "Schrittzahl", display_name: "Tim H.",    avatar_emoji: "👟", crew_name: "Weißensee Walker",  crew_color: "#4ade80", rank_name: "Block-Kundschafter",weekly_km: 24.4, weekly_xp: 1520, total_xp: 67_300,  continent: "Europa", country: "Deutschland", state: "Berlin",  region: "Berlin",    city: "Pankow",          zip: "13086" },
  { id: "r6",  username: "WegFinder",   display_name: "Aylin S.",  avatar_emoji: "🧭", crew_name: null,                crew_color: null,       rank_name: "Kiez-Wanderer",     weekly_km: 19.1, weekly_xp: 1240, total_xp: 41_200,  continent: "Europa", country: "Deutschland", state: "Berlin",  region: "Berlin",    city: "Kreuzberg",       zip: "10999" },
  { id: "r7",  username: "BockBube",    display_name: "Max R.",    avatar_emoji: "🐐", crew_name: "Kreuzkölln Runners",crew_color: "#F97316", rank_name: "Metropolen-Legende",weekly_km: 58.7, weekly_xp: 3320, total_xp: 312_400, continent: "Europa", country: "Deutschland", state: "Berlin",  region: "Berlin",    city: "Kreuzberg",       zip: "10999" },
  { id: "r8",  username: "IsarFlow",    display_name: "Klara M.",  avatar_emoji: "🌊", crew_name: "Isar-Squad",        crew_color: "#22D1C3", rank_name: "Kiez-König",        weekly_km: 46.3, weekly_xp: 2680, total_xp: 178_000, continent: "Europa", country: "Deutschland", state: "Bayern",  region: "München",   city: "Altstadt",        zip: "80331" },
  { id: "r9",  username: "WiesnWolf",   display_name: "Sepp B.",   avatar_emoji: "🐺", crew_name: "TSV Pasing",        crew_color: "#FFD700", rank_name: "Viertel-Boss",      weekly_km: 35.2, weekly_xp: 2020, total_xp: 121_000, continent: "Europa", country: "Deutschland", state: "Bayern",  region: "München",   city: "Pasing",          zip: "81241" },
  { id: "r10", username: "AlsterOtter", display_name: "Finn K.",   avatar_emoji: "🦦", crew_name: "Alster-Crew",       crew_color: "#a855f7", rank_name: "Stadt-Pionier",     weekly_km: 28.9, weekly_xp: 1720, total_xp: 88_400,  continent: "Europa", country: "Deutschland", state: "Hamburg", region: "Hamburg",   city: "Harvestehude",    zip: "20149" },
  { id: "r11", username: "DomSprinter", display_name: "Lukas H.",  avatar_emoji: "⛪", crew_name: "Domstürmer",        crew_color: "#F97316", rank_name: "Kiez-König",        weekly_km: 40.1, weekly_xp: 2340, total_xp: 154_000, continent: "Europa", country: "Deutschland", state: "Nordrhein-Westfalen", region: "Köln", city: "Altstadt-Nord", zip: "50667" },
  { id: "r12", username: "WienerLinie", display_name: "Anna G.",   avatar_emoji: "🎻", crew_name: "Wiener Schleife",   crew_color: "#5ddaf0", rank_name: "Bezirks-Entdecker", weekly_km: 37.7, weekly_xp: 2180, total_xp: 134_200, continent: "Europa", country: "Österreich",  state: "Wien",    region: "Wien",      city: "Innere Stadt",    zip: "1010" },
  { id: "r13", username: "ZürichZen",   display_name: "Noah S.",   avatar_emoji: "🏔️", crew_name: "Limmat Striders",   crew_color: "#ef7169", rank_name: "Viertel-Boss",      weekly_km: 33.4, weekly_xp: 1960, total_xp: 112_000, continent: "Europa", country: "Schweiz",     state: "Zürich",  region: "Zürich",    city: "Altstadt",        zip: "8001" },
  { id: "r14", username: "MaraisMover", display_name: "Léa D.",    avatar_emoji: "🥐", crew_name: "Marais Runners",    crew_color: "#a855f7", rank_name: "Stadt-Pionier",     weekly_km: 26.8, weekly_xp: 1620, total_xp: 76_000,  continent: "Europa", country: "France",      state: "Île-de-France", region: "Paris", city: "Le Marais",      zip: "75004" },
  { id: "r15", username: "SeineSprint", display_name: "Hugo M.",   avatar_emoji: "🗼", crew_name: "Seine Sunset Crew", crew_color: "#FF2D78", rank_name: "Viertel-Boss",      weekly_km: 34.3, weekly_xp: 1990, total_xp: 118_300, continent: "Europa", country: "France",      state: "Île-de-France", region: "Paris", city: "Quartier Latin", zip: "75005" },
  { id: "r16", username: "VondelVibes", display_name: "Sanne J.",  avatar_emoji: "🚲", crew_name: "Vondelpark Pack",   crew_color: "#F97316", rank_name: "Metropolen-Legende",weekly_km: 52.1, weekly_xp: 3010, total_xp: 242_100, continent: "Europa", country: "Nederland",   state: "Noord-Holland", region: "Amsterdam", city: "Oud-Zuid", zip: "1071" },
  { id: "r17", username: "RamblasRun",  display_name: "Pau V.",    avatar_emoji: "⚽", crew_name: "Barrio Running BCN",crew_color: "#FFD700", rank_name: "Kiez-König",        weekly_km: 43.9, weekly_xp: 2520, total_xp: 164_400, continent: "Europa", country: "España",      state: "Catalunya", region: "Barcelona", city: "El Born",      zip: "08003" },
  { id: "r18", username: "ColiseumCat", display_name: "Giulia F.", avatar_emoji: "🏛️", crew_name: "Tevere Strider",    crew_color: "#ef7169", rank_name: "Bezirks-Entdecker", weekly_km: 36.2, weekly_xp: 2080, total_xp: 128_900, continent: "Europa", country: "Italia",      state: "Lazio",   region: "Roma",      city: "Trastevere",      zip: "00153" },
  { id: "r19", username: "ThamesTempo", display_name: "Oliver P.", avatar_emoji: "🎯", crew_name: "Regent's Park Pacers", crew_color: "#4ade80", rank_name: "Urbaner Mythos", weekly_km: 67.3, weekly_xp: 3840, total_xp: 412_000, continent: "Europa", country: "United Kingdom", state: "England", region: "London",  city: "Camden",       zip: "NW1" },
  { id: "r20", username: "CentralCorre",display_name: "Mia R.",    avatar_emoji: "🍎", crew_name: "Central Park Crew", crew_color: "#FFD700", rank_name: "Straßen-Gott",      weekly_km: 74.8, weekly_xp: 4280, total_xp: 520_000, continent: "Nordamerika", country: "USA",    state: "New York", region: "New York", city: "Upper West Side", zip: "10024" },
  { id: "r21", username: "VeniceWave",  display_name: "Cole B.",   avatar_emoji: "🌴", crew_name: "Venice Beach Runners", crew_color: "#22D1C3", rank_name: "Kiez-König",    weekly_km: 45.1, weekly_xp: 2590, total_xp: 168_400, continent: "Nordamerika", country: "USA",    state: "California", region: "Los Angeles", city: "Venice",      zip: "90291" },
  { id: "r22", username: "ShibuyaZen",  display_name: "Aiko T.",   avatar_emoji: "🏯", crew_name: "Shibuya Sprinters", crew_color: "#FF2D78", rank_name: "Viertel-Boss",      weekly_km: 39.4, weekly_xp: 2270, total_xp: 148_100, continent: "Asien", country: "日本 Japan",    state: "Tokyo-to", region: "Tokyo",    city: "Shibuya",         zip: "150-0002" },
  { id: "r23", username: "LumpiniLap",  display_name: "Somchai P.",avatar_emoji: "🥭", crew_name: "Bangkok Lumphini",  crew_color: "#F97316", rank_name: "Stadt-Pionier",     weekly_km: 29.4, weekly_xp: 1780, total_xp: 92_400,  continent: "Asien", country: "Thailand",       state: "Bangkok", region: "Bangkok",   city: "Pathum Wan",      zip: "10330" },
  { id: "r24", username: "PhuketPace",  display_name: "Niran K.",  avatar_emoji: "🌊", crew_name: "Phuket Morning Run",crew_color: "#22D1C3", rank_name: "Kiez-Wanderer",     weekly_km: 16.4, weekly_xp: 1010, total_xp: 34_200,  continent: "Asien", country: "Thailand",       state: "Phuket",  region: "Phuket",    city: "Patong",          zip: "83150" },
];

// ═══ FACTION-POWER-AGGREGATION ═══
export type FactionPower = { syndicate: number; vanguard: number };
export function factionPowerForCrews(crews: NearbyCrew[]): FactionPower {
  const out: FactionPower = { syndicate: 0, vanguard: 0 };
  for (const c of crews) out[c.faction] += c.weekly_km;
  return out;
}

// ═══ CREW-FEED (Activity-Stream) ═══
export type CrewFeedEventType =
  | "run_completed" | "challenge_done" | "member_joined"
  | "rank_up" | "territory_taken" | "milestone" | "birthday";

export type CrewFeedItem = {
  id: string;
  type: CrewFeedEventType;
  username?: string;
  avatar_emoji?: string;
  text: string;
  accent?: string;
  ts_iso: string;
  reactions?: { emoji: string; count: number }[];
};

export const DEMO_CREW_FEED: CrewFeedItem[] = [
  { id: "f1", type: "rank_up",         username: "NeonFuchs",   avatar_emoji: "🦊", text: "ist zu **Kiez-König** aufgestiegen", accent: "#FFD700", ts_iso: new Date(Date.now() - 14 * 60000).toISOString(), reactions: [{ emoji: "🔥", count: 5 }, { emoji: "👏", count: 3 }] },
  { id: "f2", type: "territory_taken", username: "Pacer99",     avatar_emoji: "🚀", text: "hat **Danziger Straße** erobert",    accent: "#22D1C3", ts_iso: new Date(Date.now() - 42 * 60000).toISOString(), reactions: [{ emoji: "🏆", count: 4 }] },
  { id: "f3", type: "challenge_done",                                                text: "Crew-Challenge **Früh-Vögel** abgeschlossen — +900 XP 🎉", accent: "#FF6B4A", ts_iso: new Date(Date.now() - 3 * 3600000).toISOString(), reactions: [{ emoji: "🎉", count: 8 }, { emoji: "💪", count: 2 }] },
  { id: "f4", type: "run_completed",   username: "StadtPuma",   avatar_emoji: "🐆", text: "hat **8.4 km in 42:30** gelaufen",   accent: "#22D1C3", ts_iso: new Date(Date.now() - 5 * 3600000).toISOString() },
  { id: "f5", type: "member_joined",   username: "WegFinder",   avatar_emoji: "🧭", text: "ist der Crew beigetreten",           accent: "#a855f7", ts_iso: new Date(Date.now() - 22 * 3600000).toISOString(), reactions: [{ emoji: "👋", count: 6 }] },
  { id: "f6", type: "milestone",                                                     text: "Crew hat **3000 km** insgesamt erreicht 🏅", accent: "#FFD700", ts_iso: new Date(Date.now() - 2 * 24 * 3600000).toISOString(), reactions: [{ emoji: "🔥", count: 12 }] },
  { id: "f7", type: "birthday",        username: "Schrittzahl", avatar_emoji: "👟", text: "feiert heute **1 Jahr** in der Crew 🎂", accent: "#FF2D78", ts_iso: new Date(Date.now() - 3 * 24 * 3600000).toISOString(), reactions: [{ emoji: "🎂", count: 7 }] },
];

// ═══ RIVALS — Crews als Erzfeinde ═══
export type RivalDuel = {
  rival_name: string;
  rival_color: string;
  rival_weekly_km: number;
  our_weekly_km: number;
  ends_at: string;
  prize: string;
};
export const DEMO_RIVAL_DUEL: RivalDuel = {
  rival_name: "Weißensee Walker",
  rival_color: "#4ade80",
  rival_weekly_km: 76.4,
  our_weekly_km: 88.5,
  ends_at: new Date(Date.now() + 3 * 24 * 3600000).toISOString(),
  prize: "+1200 XP + Territorium-Bonus",
};

export function groupCrewsByLevel(
  crews: NearbyCrew[],
  level: "continent" | "country" | "state" | "region" | "city" | "zip",
): GeoBucket[] {
  const map = new Map<string, NearbyCrew[]>();
  for (const c of crews) {
    const key = c[level];
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(c);
  }
  return Array.from(map.entries())
    .map(([key, list]) => ({ key, label: key, crews: list, child_count: list.length }))
    .sort((a, b) => b.child_count - a.child_count);
}

export const DEMO_CREW_STATS = {
  weekly_rank_city: 14,
  all_time_rank_city: 38,
  total_territories: 87,
  weekly_territories: 13,
  total_km: 3420,
  weekly_km: 88.5,
  faction_contrib: 2.4, // % Beitrag zur Fraktions-Macht
};

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
export type AchievementCategory =
  | "distance" | "endurance" | "explorer" | "streak" | "consistency" | "speed" | "elite";

export type AchievementTier = "easy" | "medium" | "hard" | "epic" | "legend";

export const ACHIEVEMENT_CATEGORIES: { id: AchievementCategory; name: string; icon: string; color: string; description: string }[] = [
  { id: "distance",    name: "Strecken-Champion", icon: "🏃",  color: "#22D1C3", description: "Längste Einzel-Läufe" },
  { id: "endurance",   name: "Welt-Bummler",      icon: "🌍",  color: "#4ade80", description: "Gesamt-Kilometer" },
  { id: "explorer",    name: "Territorium-Herr",  icon: "🗺️",  color: "#a855f7", description: "Eroberte Straßenzüge" },
  { id: "streak",      name: "Durchhalter",       icon: "🔥",  color: "#FF6B4A", description: "Tägliche Serien" },
  { id: "consistency", name: "Stammgast",         icon: "📅",  color: "#FFD700", description: "Anzahl Läufe insgesamt" },
  { id: "speed",       name: "Tempo-Jäger",       icon: "⚡",  color: "#5ddaf0", description: "Marathon-Distanzen" },
  { id: "elite",       name: "Legende",           icon: "👑",  color: "#FF2D78", description: "Hardcore-Meilensteine" },
];

export const TIER_META: Record<AchievementTier, { label: string; color: string; xpMultiplier: number }> = {
  easy:   { label: "Bronze",  color: "#CD7F32", xpMultiplier: 1 },
  medium: { label: "Silber",  color: "#C0C0C0", xpMultiplier: 3 },
  hard:   { label: "Gold",    color: "#FFD700", xpMultiplier: 10 },
  epic:   { label: "Platin",  color: "#E5E4E2", xpMultiplier: 30 },
  legend: { label: "Diamant", color: "#B9F2FF", xpMultiplier: 100 },
};

export const ACHIEVEMENTS: Array<{
  id: string;
  name: string;
  xp: number;
  icon: string;
  stat: AchievementStatKey;
  target: number;
  unit: string;
  category: AchievementCategory;
  tier: AchievementTier;
}> = [
  // 🏃 Strecken-Champion (longest_km)
  { id: "dist_1",  name: "Erster Kilometer",      xp: 100,    icon: "👣", stat: "longest_km",  target: 1,    unit: "km", category: "distance", tier: "easy" },
  { id: "dist_2",  name: "3 km am Stück",         xp: 200,    icon: "👟", stat: "longest_km",  target: 3,    unit: "km", category: "distance", tier: "easy" },
  { id: "dist_3",  name: "5 km — die klassische", xp: 400,    icon: "🏃", stat: "longest_km",  target: 5,    unit: "km", category: "distance", tier: "easy" },
  { id: "dist_4",  name: "7 km Läufer",           xp: 700,    icon: "🏃", stat: "longest_km",  target: 7,    unit: "km", category: "distance", tier: "medium" },
  { id: "dist_5",  name: "10 km durchgelaufen",   xp: 1200,   icon: "💪", stat: "longest_km",  target: 10,   unit: "km", category: "distance", tier: "medium" },
  { id: "dist_6",  name: "15 km Ausdauer",        xp: 2500,   icon: "🏃", stat: "longest_km",  target: 15,   unit: "km", category: "distance", tier: "medium" },
  { id: "dist_7",  name: "Halbmarathon (21 km)",  xp: 5000,   icon: "🏅", stat: "longest_km",  target: 21.1, unit: "km", category: "distance", tier: "hard" },
  { id: "dist_8",  name: "25 km — Elite-Distanz", xp: 8000,   icon: "🏆", stat: "longest_km",  target: 25,   unit: "km", category: "distance", tier: "hard" },

  // ⚡ Tempo-Jäger (Marathon & Ultra)
  { id: "speed_1", name: "30 km Megalauf",        xp: 12000,  icon: "💨", stat: "longest_km",  target: 30,   unit: "km", category: "speed", tier: "hard" },
  { id: "speed_2", name: "Marathon (42 km)",      xp: 25000,  icon: "🥇", stat: "longest_km",  target: 42.2, unit: "km", category: "speed", tier: "epic" },
  { id: "speed_3", name: "50 km Ultra",           xp: 50000,  icon: "🚀", stat: "longest_km",  target: 50,   unit: "km", category: "speed", tier: "epic" },
  { id: "speed_4", name: "75 km Iron-Runner",     xp: 100000, icon: "⚡", stat: "longest_km",  target: 75,   unit: "km", category: "speed", tier: "legend" },
  { id: "speed_5", name: "100 km Legende",        xp: 250000, icon: "🌟", stat: "longest_km",  target: 100,  unit: "km", category: "speed", tier: "legend" },

  // 🌍 Welt-Bummler (lifetime_km)
  { id: "end_1",   name: "10 km Gesamt",          xp: 100,    icon: "🌱", stat: "lifetime_km", target: 10,    unit: "km", category: "endurance", tier: "easy" },
  { id: "end_2",   name: "50 km Gesamt",          xp: 300,    icon: "🌿", stat: "lifetime_km", target: 50,    unit: "km", category: "endurance", tier: "easy" },
  { id: "end_3",   name: "100 km Meilenstein",    xp: 800,    icon: "🌳", stat: "lifetime_km", target: 100,   unit: "km", category: "endurance", tier: "easy" },
  { id: "end_4",   name: "250 km Dauerläufer",    xp: 2500,   icon: "🏞️", stat: "lifetime_km", target: 250,   unit: "km", category: "endurance", tier: "medium" },
  { id: "end_5",   name: "500 km Weltbummler",    xp: 6000,   icon: "🗺️", stat: "lifetime_km", target: 500,   unit: "km", category: "endurance", tier: "medium" },
  { id: "end_6",   name: "1.000 km Club",         xp: 15000,  icon: "🌍", stat: "lifetime_km", target: 1000,  unit: "km", category: "endurance", tier: "hard" },
  { id: "end_7",   name: "2.500 km Explorer",     xp: 40000,  icon: "🎖️", stat: "lifetime_km", target: 2500,  unit: "km", category: "endurance", tier: "epic" },
  { id: "end_8",   name: "5.000 km Wanderer",     xp: 100000, icon: "🏔️", stat: "lifetime_km", target: 5000,  unit: "km", category: "endurance", tier: "epic" },

  // 🗺️ Territorium-Herr
  { id: "exp_1",   name: "Erstes Territorium",    xp: 50,    icon: "📌", stat: "territories", target: 1,    unit: "", category: "explorer", tier: "easy" },
  { id: "exp_2",   name: "5 Territorien",         xp: 250,   icon: "📍", stat: "territories", target: 5,    unit: "", category: "explorer", tier: "easy" },
  { id: "exp_3",   name: "10 Territorien",        xp: 600,   icon: "🗂️", stat: "territories", target: 10,   unit: "", category: "explorer", tier: "easy" },
  { id: "exp_4",   name: "25 Territorien",        xp: 1500,  icon: "🏘️", stat: "territories", target: 25,   unit: "", category: "explorer", tier: "medium" },
  { id: "exp_5",   name: "50 Territorien",        xp: 3500,  icon: "🗺️", stat: "territories", target: 50,   unit: "", category: "explorer", tier: "medium" },
  { id: "exp_6",   name: "100 Territorien",       xp: 8000,  icon: "🏙️", stat: "territories", target: 100,  unit: "", category: "explorer", tier: "hard" },
  { id: "exp_7",   name: "250 Territorien",       xp: 25000, icon: "👑", stat: "territories", target: 250,  unit: "", category: "explorer", tier: "hard" },
  { id: "exp_8",   name: "500 Territorien",       xp: 70000, icon: "🏆", stat: "territories", target: 500,  unit: "", category: "explorer", tier: "epic" },
  { id: "exp_9",   name: "1.000 Territorien",     xp: 200000, icon: "💎", stat: "territories", target: 1000, unit: "", category: "explorer", tier: "legend" },

  // 🔥 Durchhalter (streak_best)
  { id: "str_1",   name: "2 Tage in Folge",       xp: 100,   icon: "🕯️", stat: "streak_best", target: 2,   unit: "Tage", category: "streak", tier: "easy" },
  { id: "str_2",   name: "3 Tage in Folge",       xp: 200,   icon: "🌟", stat: "streak_best", target: 3,   unit: "Tage", category: "streak", tier: "easy" },
  { id: "str_3",   name: "5 Tage in Folge",       xp: 400,   icon: "✨", stat: "streak_best", target: 5,   unit: "Tage", category: "streak", tier: "easy" },
  { id: "str_4",   name: "Eine Woche (7 Tage)",   xp: 800,   icon: "🔥", stat: "streak_best", target: 7,   unit: "Tage", category: "streak", tier: "medium" },
  { id: "str_5",   name: "2 Wochen (14 Tage)",    xp: 2500,  icon: "⚡", stat: "streak_best", target: 14,  unit: "Tage", category: "streak", tier: "medium" },
  { id: "str_6",   name: "1 Monat (30 Tage)",     xp: 7500,  icon: "💥", stat: "streak_best", target: 30,  unit: "Tage", category: "streak", tier: "hard" },
  { id: "str_7",   name: "2 Monate (60 Tage)",    xp: 20000, icon: "🌋", stat: "streak_best", target: 60,  unit: "Tage", category: "streak", tier: "hard" },
  { id: "str_8",   name: "100 Tage Serie",        xp: 40000, icon: "🔥", stat: "streak_best", target: 100, unit: "Tage", category: "streak", tier: "epic" },
  { id: "str_9",   name: "Halbes Jahr (180)",     xp: 120000, icon: "☄️", stat: "streak_best", target: 180, unit: "Tage", category: "streak", tier: "epic" },
  { id: "str_10",  name: "1 Jahr durchgängig",    xp: 500000, icon: "🌠", stat: "streak_best", target: 365, unit: "Tage", category: "streak", tier: "legend" },

  // 📅 Stammgast (total_walks)
  { id: "con_1",   name: "Erster Lauf",           xp: 100,   icon: "🎉", stat: "total_walks", target: 1,    unit: "", category: "consistency", tier: "easy" },
  { id: "con_2",   name: "5 Läufe absolviert",    xp: 200,   icon: "✅", stat: "total_walks", target: 5,    unit: "", category: "consistency", tier: "easy" },
  { id: "con_3",   name: "10 Läufe",              xp: 400,   icon: "🎯", stat: "total_walks", target: 10,   unit: "", category: "consistency", tier: "easy" },
  { id: "con_4",   name: "25 Läufe",              xp: 1200,  icon: "📈", stat: "total_walks", target: 25,   unit: "", category: "consistency", tier: "medium" },
  { id: "con_5",   name: "50 Läufe",              xp: 2800,  icon: "🎖️", stat: "total_walks", target: 50,   unit: "", category: "consistency", tier: "medium" },
  { id: "con_6",   name: "100 Läufe",             xp: 6500,  icon: "🏅", stat: "total_walks", target: 100,  unit: "", category: "consistency", tier: "hard" },
  { id: "con_7",   name: "250 Läufe",             xp: 18000, icon: "🏆", stat: "total_walks", target: 250,  unit: "", category: "consistency", tier: "hard" },
  { id: "con_8",   name: "500 Läufe",             xp: 45000, icon: "👑", stat: "total_walks", target: 500,  unit: "", category: "consistency", tier: "epic" },
  { id: "con_9",   name: "1.000 Läufe Lifetime",  xp: 120000, icon: "💎", stat: "total_walks", target: 1000, unit: "", category: "consistency", tier: "epic" },
  { id: "con_10",  name: "2.500 Läufe Legende",   xp: 400000, icon: "⭐", stat: "total_walks", target: 2500, unit: "", category: "consistency", tier: "legend" },

  // 👑 Legende (Hardcore Mixed-Stats)
  { id: "elite_1", name: "Marathon-Absolvent",    xp: 30000,  icon: "🏃‍♂️", stat: "longest_km",  target: 42.2,  unit: "km", category: "elite", tier: "hard" },
  { id: "elite_2", name: "1.000 km Club",         xp: 20000,  icon: "🏔️", stat: "lifetime_km", target: 1000,  unit: "km", category: "elite", tier: "hard" },
  { id: "elite_3", name: "5.000 km Club",         xp: 100000, icon: "💎", stat: "lifetime_km", target: 5000,  unit: "km", category: "elite", tier: "epic" },
  { id: "elite_4", name: "10.000 km Unsterblich", xp: 300000, icon: "⚔️", stat: "lifetime_km", target: 10000, unit: "km", category: "elite", tier: "legend" },
  { id: "elite_5", name: "25.000 km Mythos",      xp: 800000, icon: "🌌", stat: "lifetime_km", target: 25000, unit: "km", category: "elite", tier: "legend" },
  { id: "elite_6", name: "50.000 km — Erdumfang", xp: 2000000, icon: "🌐", stat: "lifetime_km", target: 50000, unit: "km", category: "elite", tier: "legend" },

  // 🏃 Strecken-Champion — weitere Zwischenziele
  { id: "dist_9",  name: "2 km geschafft",           xp: 150,   icon: "🚶", stat: "longest_km",  target: 2,    unit: "km", category: "distance", tier: "easy" },
  { id: "dist_10", name: "4 km am Stück",            xp: 300,   icon: "👟", stat: "longest_km",  target: 4,    unit: "km", category: "distance", tier: "easy" },
  { id: "dist_11", name: "6 km Dauerlauf",           xp: 550,   icon: "🏃", stat: "longest_km",  target: 6,    unit: "km", category: "distance", tier: "medium" },
  { id: "dist_12", name: "8 km durchgezogen",        xp: 900,   icon: "💪", stat: "longest_km",  target: 8,    unit: "km", category: "distance", tier: "medium" },
  { id: "dist_13", name: "12 km Langlauf",           xp: 1800,  icon: "🎽", stat: "longest_km",  target: 12,   unit: "km", category: "distance", tier: "medium" },
  { id: "dist_14", name: "18 km Vorbereitung",       xp: 3800,  icon: "🏅", stat: "longest_km",  target: 18,   unit: "km", category: "distance", tier: "hard" },

  // 🌍 Welt-Bummler — weitere Stufen
  { id: "end_9",   name: "25 km Gesamt",             xp: 180,   icon: "🌱", stat: "lifetime_km", target: 25,    unit: "km", category: "endurance", tier: "easy" },
  { id: "end_10",  name: "150 km unterwegs",         xp: 1000,  icon: "🌿", stat: "lifetime_km", target: 150,   unit: "km", category: "endurance", tier: "easy" },
  { id: "end_11",  name: "750 km gesammelt",         xp: 9000,  icon: "🏞️", stat: "lifetime_km", target: 750,   unit: "km", category: "endurance", tier: "medium" },
  { id: "end_12",  name: "1.500 km Kilometerfresser", xp: 25000, icon: "🌍", stat: "lifetime_km", target: 1500, unit: "km", category: "endurance", tier: "hard" },
  { id: "end_13",  name: "3.500 km Globetrotter",    xp: 60000, icon: "🗺️", stat: "lifetime_km", target: 3500, unit: "km", category: "endurance", tier: "epic" },

  // 🗺️ Territorium-Herr — Zwischenstufen
  { id: "exp_10",  name: "15 Territorien",           xp: 900,   icon: "📍", stat: "territories", target: 15,   unit: "", category: "explorer", tier: "easy" },
  { id: "exp_11",  name: "35 Territorien",           xp: 2200,  icon: "🏘️", stat: "territories", target: 35,   unit: "", category: "explorer", tier: "medium" },
  { id: "exp_12",  name: "75 Territorien",           xp: 5500,  icon: "🗺️", stat: "territories", target: 75,   unit: "", category: "explorer", tier: "medium" },
  { id: "exp_13",  name: "150 Territorien",          xp: 15000, icon: "🏙️", stat: "territories", target: 150,  unit: "", category: "explorer", tier: "hard" },
  { id: "exp_14",  name: "400 Territorien",          xp: 45000, icon: "👑", stat: "territories", target: 400,  unit: "", category: "explorer", tier: "hard" },
  { id: "exp_15",  name: "750 Territorien",          xp: 120000, icon: "🏆", stat: "territories", target: 750,  unit: "", category: "explorer", tier: "epic" },

  // 🔥 Streak — weitere Stufen
  { id: "str_11",  name: "10 Tage am Stück",         xp: 1500,  icon: "✨", stat: "streak_best", target: 10,  unit: "Tage", category: "streak", tier: "medium" },
  { id: "str_12",  name: "21 Tage Gewohnheit",       xp: 5000,  icon: "⚡", stat: "streak_best", target: 21,  unit: "Tage", category: "streak", tier: "medium" },
  { id: "str_13",  name: "45 Tage Feuer",            xp: 12000, icon: "🔥", stat: "streak_best", target: 45,  unit: "Tage", category: "streak", tier: "hard" },
  { id: "str_14",  name: "90 Tage Durchhalter",      xp: 30000, icon: "🌋", stat: "streak_best", target: 90,  unit: "Tage", category: "streak", tier: "epic" },
  { id: "str_15",  name: "150 Tage Unaufhaltsam",    xp: 75000, icon: "☄️", stat: "streak_best", target: 150, unit: "Tage", category: "streak", tier: "epic" },
  { id: "str_16",  name: "250 Tage Eisern",          xp: 200000, icon: "💫", stat: "streak_best", target: 250, unit: "Tage", category: "streak", tier: "legend" },

  // 📅 Stammgast — weitere Läufe
  { id: "con_11",  name: "15 Läufe absolviert",      xp: 650,   icon: "✅", stat: "total_walks", target: 15,   unit: "", category: "consistency", tier: "easy" },
  { id: "con_12",  name: "35 Läufe",                 xp: 1800,  icon: "🎯", stat: "total_walks", target: 35,   unit: "", category: "consistency", tier: "medium" },
  { id: "con_13",  name: "75 Läufe",                 xp: 4500,  icon: "🎖️", stat: "total_walks", target: 75,   unit: "", category: "consistency", tier: "medium" },
  { id: "con_14",  name: "150 Läufe",                xp: 10000, icon: "🏅", stat: "total_walks", target: 150,  unit: "", category: "consistency", tier: "hard" },
  { id: "con_15",  name: "365 Läufe — ein pro Tag",  xp: 50000, icon: "📆", stat: "total_walks", target: 365,  unit: "", category: "consistency", tier: "epic" },
  { id: "con_16",  name: "750 Läufe Vielläufer",     xp: 90000, icon: "🏆", stat: "total_walks", target: 750,  unit: "", category: "consistency", tier: "epic" },
  { id: "con_17",  name: "1.500 Läufe Rentner-Mode", xp: 250000, icon: "⭐", stat: "total_walks", target: 1500, unit: "", category: "consistency", tier: "legend" },

  // ⚡ Tempo — Zwischenstufen
  { id: "speed_6", name: "60 km Grenzgänger",        xp: 70000, icon: "🏃‍♂️", stat: "longest_km", target: 60, unit: "km", category: "speed", tier: "epic" },
  { id: "speed_7", name: "150 km Wahnsinn",          xp: 500000, icon: "🌠", stat: "longest_km", target: 150, unit: "km", category: "speed", tier: "legend" },

  // 👑 Legende — Zwischenziele
  { id: "elite_7", name: "1.500 km Club",            xp: 35000,  icon: "🏔️", stat: "lifetime_km", target: 1500,  unit: "km", category: "elite", tier: "hard" },
  { id: "elite_8", name: "7.500 km Elite",           xp: 180000, icon: "💎", stat: "lifetime_km", target: 7500,  unit: "km", category: "elite", tier: "epic" },
  { id: "elite_9", name: "15.000 km Titan",          xp: 500000, icon: "⚔️", stat: "lifetime_km", target: 15000, unit: "km", category: "elite", tier: "legend" },
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

// Legacy-Alias (alte Komponenten) — wurde durch CrewMember-Typ oben ersetzt.
export type MapCrewMemberLegacy = MapRunner;

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
export const DEMO_FACTION_STATS = {
  nachtpuls: { runners: 74, km_week: 412.5, territories: 318 },
  sonnenwacht: { runners: 69, km_week: 389.2, territories: 291 },
  city: "Berlin",
};

export const DEMO_NEARBY_CREWS_MAP: { name: string; faction: "syndicate" | "vanguard"; members: number; distance_m: number; color: string; invite_code: string }[] = [
  { name: "Kaelthors Kiez-Crew", faction: "syndicate", members: 6, distance_m: 0, color: "#22D1C3", invite_code: "KAEL-DEMO" },
  { name: "Neon Prowlers", faction: "syndicate", members: 14, distance_m: 420, color: "#a855f7", invite_code: "NEON-01" },
  { name: "Sonnen-Riders", faction: "vanguard", members: 9, distance_m: 680, color: "#FF6B4A", invite_code: "SONN-03" },
  { name: "Mauerpark Runners", faction: "syndicate", members: 22, distance_m: 1100, color: "#22D1C3", invite_code: "MPRK-02" },
  { name: "Pankow Athleten", faction: "vanguard", members: 31, distance_m: 1850, color: "#FFD700", invite_code: "PANK-01" },
];

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
    // 2–4 Straßen pro Lauf (realistisch bei 1–6 km), kommasepariert
    const streetCount = 2 + Math.floor(Math.random() * 3);
    const startIdx = i % DEMO_STREETS.length;
    const streetSlice: string[] = [];
    for (let j = 0; j < streetCount; j++) {
      streetSlice.push(DEMO_STREETS[(startIdx + j) % DEMO_STREETS.length]);
    }
    runs.push({
      id: `demo-${i}`,
      street_name: streetSlice.join(", "),
      distance_m: distance,
      duration_s: duration,
      xp_earned: xp,
      created_at: date.toISOString(),
    });
  }
  return runs;
}
