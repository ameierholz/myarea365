/**
 * Admin-only Artwork-Prompt-Builder (grosser Subset von artwork-prompts).
 *
 * Wird ausschliesslich vom Admin-Tool unter /admin/artwork importiert.
 * User-Code (Picker-Modals, Galerien, Loadout) lebt in `artwork-prompts.ts`.
 * Der Split reduziert das User-Bundle.
 */

import { GREEN_BG_RULE } from "@/lib/artwork-prompts";

// 8-Slot-System (Equipment-Rework, Migration 00078).
export const ARTWORK_SLOTS = [
  "Helm", "Brustplatte", "Hose", "Stiefel",
  "Handschuhe", "Waffe", "Halskette", "Ring",
] as const;

export type ArtworkSlot = typeof ARTWORK_SLOTS[number];

// 4 Raritäten (passt zu DB-Constraint common/rare/epic/legend).
export const ARTWORK_RARITIES = [
  { level: "Gewöhnlich", effect: "matte Oberfläche, dezente Lichtreflexe",      power: 1.0, color: "#9aa3b8" },
  { level: "Selten",     effect: "magisches Glimmen entlang der Kanten",        power: 1.7, color: "#22D1C3" },
  { level: "Episch",     effect: "pulsierende Energie-Adern, sichtbarer Glanz", power: 2.8, color: "#a855f7" },
  { level: "Legendär",   effect: "schwebende Fragmente, goldener Partikelsturm",power: 4.5, color: "#FFD700" },
] as const;

export type ArtworkRarity = typeof ARTWORK_RARITIES[number]["level"];

export type EquipmentClassId = "tank" | "support" | "ranged" | "melee";

export type GeneratedPrompt = {
  key: string;           // `slot__class__rarity` ASCII-Slug
  itemName: string;
  classId: EquipmentClassId;
  slot: ArtworkSlot;
  rarity: ArtworkRarity;
  statValue: number;
  prompt: string;
  accentColor: string;
};

function slug(s: string): string {
  return s.toLowerCase()
    .replace(/ä/g,"ae").replace(/ö/g,"oe").replace(/ü/g,"ue").replace(/ß/g,"ss")
    .replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
}

// Klassen-Material/Stil-Profil (4 Klassen statt 20 Rassen).
type ClassProfile = { material: string; style: string; energyColor: string; theme: string };
export const EQUIPMENT_CLASS_PROFILE: Record<EquipmentClassId, ClassProfile> = {
  tank: {
    material: "thick layered protective plating (forged steel or modern composite), riveted or buckled seams, leather/synthetic straps, weathered surface with battle-scars",
    style:    "imposing, heavy, fortress-like, sharp ridged edges, defensive posture",
    energyColor: "#60a5fa",
    theme:    "guardian / bulwark / oath-bound defender — works as both medieval knight AND modern riot-trooper",
  },
  support: {
    material: "polished pale-gold metal with woven white fabric (silk or modern technical-textile), glowing inset gems or LEDs, etched sigils or modern circuit-traces",
    style:    "ornate, elegant, slightly ethereal, soft inner glow",
    energyColor: "#a855f7",
    theme:    "blessing / sanctified / healer — works as both arcane priest AND modern field-medic",
  },
  ranged: {
    material: "lightweight wood or polymer with dark green leather/canvas wraps, brass or steel fittings, feather or fletching inlays",
    style:    "aerodynamic, lean, hunter-coded, precise tooling marks",
    energyColor: "#4ade80",
    theme:    "hunter / sniper / sky-watcher — works as both traditional archer AND modern marksman",
  },
  melee: {
    material: "blackened sharpened steel with crimson leather wraps, exposed cutting edges, predator details",
    style:    "fast, sleek, aggressive, lots of edges, killing-tool aesthetic",
    energyColor: "#FF6B4A",
    theme:    "duelist / brawler / blade-dancer — works as both traditional swordsman AND modern street-fighter",
  },
};

// Slot-Hint für den Bild-Prompt (was eigentlich gerendert wird).
const SLOT_HINT: Record<ArtworkSlot, string> = {
  "Helm":        "a single helmet / face-piece, centered, no body underneath",
  "Brustplatte": "a single chest armor piece (cuirass / robe upper / breastplate), centered, mounted on an invisible torso",
  "Hose":        "a single pair of armored greaves / robe legs, centered, mounted on invisible legs",
  "Stiefel":     "a single pair of boots / sabatons, centered, side-by-side",
  "Handschuhe":  "a single pair of gauntlets / gloves, centered, palms forward",
  "Waffe":       "a single weapon (sword / staff / bow / dagger appropriate to the class), centered, vertical or diagonal",
  "Halskette":   "a single ornate necklace / amulet on a chain, centered, hanging vertically",
  "Ring":        "a single ornate ring with a gem or rune, centered, slightly tilted to show detail",
};

export function buildPrompt(slot: ArtworkSlot, classId: EquipmentClassId, rarityLevel: ArtworkRarity): GeneratedPrompt {
  const profile = EQUIPMENT_CLASS_PROFILE[classId];
  const rarity  = ARTWORK_RARITIES.find((r) => r.level === rarityLevel)!;
  const slotHint = SLOT_HINT[slot];
  const prompt = [
    `Premium adaptive game item icon (works for both modern-real-world and traditional/heroic settings), square 1:1, 1024×1024, fully transparent background (PNG with alpha).`,
    `Subject: ${slotHint}.`,
    `Class theme: ${profile.theme}. Material: ${profile.material}. Style: ${profile.style}.`,
    `Rarity: ${rarityLevel} — ${rarity.effect}. Accent glow color ${profile.energyColor}.`,
    `Composition: item slightly tilted toward the viewer, centered, subtle drop shadow beneath. Item fills ~70% of frame width with a clean 10% margin on all sides — silhouette must NOT touch frame edges.`,
    `Style: high-detail painterly game icon (Diablo IV / Lost Ark / The Division 2 / Anno 1800 inventory-quality), tight rim-light, readable at 64px in an inventory slot. Avoid pure-cyberpunk OR pure-medieval-fantasy mono-style — favor a flexible aesthetic that fits crews, gangs, hunters, defenders alike.`,
    `No text, no labels, no characters, no body parts beyond what the item itself implies, no watermark, no environment, no scene — just the item on transparent background.`,
  ].join(" ");
  return {
    key:        `${slug(slot)}__${classId}__${slug(rarityLevel)}`,
    itemName:   `${rarityLevel}-${slot} (${classId})`,
    classId,
    slot,
    rarity:     rarityLevel,
    statValue:  Math.floor(10 * rarity.power),
    prompt,
    accentColor: rarity.color,
  };
}

export function generateAllPrompts(): GeneratedPrompt[] {
  const out: GeneratedPrompt[] = [];
  const classes: EquipmentClassId[] = ["tank", "support", "ranged", "melee"];
  for (const slot of ARTWORK_SLOTS) {
    for (const cls of classes) {
      for (const r of ARTWORK_RARITIES) {
        out.push(buildPrompt(slot, cls, r.level));
      }
    }
  }
  return out;  // 8 × 4 × 4 = 128
}

// ═══════════════════════════════════════════════════════════════════════
// BASE-THEMES (Runner-Base + Crew-Base) — für Map-Pin + Modal-Header
// ═══════════════════════════════════════════════════════════════════════

export type BaseThemeId =
  | "plattenbau" | "altbau_hof" | "spaeti" | "hinterhof" | "werkstatt" | "container_camp"
  | "ubahn" | "graffiti_tower" | "techno_club" | "penthouse" | "dachterrasse" | "wagenburg"
  | "halloween" | "frost_keep" | "night_rose";
export type BaseThemeScope = "runner" | "crew";
export type BaseThemeAsset = "pin" | "banner";

export type BaseThemeArt = {
  id: BaseThemeId;
  name: string;
  description: string;
  // Visual hooks
  palette: string;                    // dominant colors as natural-language hint
  accent: string;                     // hex
  glow: string;                       // hex with alpha or rgba()
  ambient: string;                    // mood / atmosphere keywords
  runnerSubject: string;              // small Solo-Base description
  crewSubject: string;                // large Crew-Compound description
  bannerScene: string;                // wide cinematic scene reference
  negative?: string;                  // optional anti-prompt notes
};

export const BASE_THEMES_ART: BaseThemeArt[] = [
  {
    id: "plattenbau",
    name: "Plattenbau-Block",
    description: "Berliner DDR-Plattenbau — grauer Beton, Balkone, ehrlich und urban.",
    palette: "concrete grey, slate-grey panels, warm yellow apartment lights, faded paint, mint-green stairwell doors",
    accent: "#8B8FA3", glow: "rgba(139,143,163,0.5)",
    ambient: "East-Berlin neighborhood, dusk, scattered warm windows lit, communal courtyard feel, no fantasy",
    runnerSubject: "a single small 4-storey East-German Plattenbau apartment block with prefab concrete panels, simple metal balconies, warm-yellow window lights, a single satellite dish on the roof, a green stairwell door at ground level",
    crewSubject: "a large East-German Plattenbau housing complex: an L-shaped 8-storey building with rows of identical balconies, multiple lit windows, a children's playground in the courtyard, parked cars and a Späti corner store at the base",
    bannerScene: "wide cinematic establishing shot of a Berlin Plattenbau neighborhood at blue hour, warm-lit windows in a grid pattern, autumn trees in foreground, urban realistic style",
  },
  {
    id: "altbau_hof",
    name: "Altbau-Hof",
    description: "Berliner Gründerzeit-Altbau — Stuckfassade, Hinterhof mit Linde, charmant und gemütlich.",
    palette: "warm sand-yellow stucco, ornate cream cornices, dark green ground-floor doors, terracotta roof, golden window light",
    accent: "#D4A574", glow: "rgba(212,165,116,0.5)",
    ambient: "Prenzlauer-Berg-style neighborhood, evening warmth, lit windows, tree in front, café tables on the sidewalk",
    runnerSubject: "a single small classical Berlin Gründerzeit Altbau facade segment, 5 stories tall, ornate stucco around the windows, a dark-green entrance door with brass numbers, warm-yellow lit windows, a small linden tree in front",
    crewSubject: "a large U-shaped Berlin Altbau courtyard complex: ornate Gründerzeit facades surrounding an inner Hinterhof, cobblestones, a large old linden tree in the middle, café chairs, bicycles leaning against the walls, warm-lit windows everywhere",
    bannerScene: "wide cinematic shot of a Berlin Prenzlauer-Berg street with classical Altbau buildings glowing at dusk, café tables, autumn leaves, painterly urban realism",
  },
  {
    id: "spaeti",
    name: "Späti-Festung",
    description: "Berliner Eckspäti — Leuchtreklame, Bierkästen, 24/7-Treffpunkt der Crew.",
    palette: "bright neon green and red signage, warm yellow interior light, beer-crate orange, weathered tile facade, faded posters",
    accent: "#FFD700", glow: "rgba(255,215,0,0.55)",
    ambient: "late-night Berlin corner, neon glow on wet pavement, a few people standing outside drinking beer, urban-realistic",
    runnerSubject: "a single small Berlin corner Späti shop with bright neon signs reading 'Späti', warm-lit interior visible through the window, beer crates stacked outside, a sandwich-board chalk menu, a vintage red Coca-Cola sign",
    crewSubject: "a sprawling Berlin Späti compound: corner shop with extensive neon signage on two facades, an outdoor seating area with picnic tables and string lights, multiple beer crate stacks, a graffiti-covered side wall, motorcycles and bikes parked nearby",
    bannerScene: "wide cinematic shot of a Berlin corner Späti at night, glowing neon, wet street reflections, group of friends with beer bottles, urban realism",
  },
  {
    id: "hinterhof",
    name: "Hinterhof-Garten",
    description: "Urban-Garden-Hinterhof — Hochbeete, Lichterketten, Lagerfeuer im Container.",
    palette: "lush green plants, warm string-light yellow, terracotta pots, weathered red brick walls, gentle ember orange",
    accent: "#22C55E", glow: "rgba(34,197,94,0.55)",
    ambient: "warm summer evening in a Berlin courtyard, fairy lights, smell of grilled food, vinyl music, communal vibe",
    runnerSubject: "a small urban garden corner: a wooden raised bed full of vegetables and herbs, a chair, fairy lights strung overhead, a tiny chiminea with glowing embers, ivy on the brick wall behind",
    crewSubject: "a large Berlin Hinterhof urban garden compound: multiple raised beds, a wooden pergola covered in grape vines, picnic tables with people eating, fairy lights crossing the entire courtyard, a fire-pit, vegetable patches, brick walls with murals",
    bannerScene: "wide cinematic shot of a lush Berlin Hinterhof urban garden at golden hour, fairy lights warming up, people gathered around a fire-pit, painterly urban realism",
  },
  {
    id: "werkstatt",
    name: "Werkstatt-Hof",
    description: "Auto-/Bike-Werkstatt — Container, Werkbank, Funkenflug, Crew-Treffpunkt.",
    palette: "dark industrial steel grey, hot-orange welding sparks, oil-stained concrete, hazard yellow accents, blue welding light",
    accent: "#FF6B4A", glow: "rgba(255,107,74,0.55)",
    ambient: "Berlin Kreuzberg backyard workshop, noise of grinders, smell of oil, mid-day light, gritty",
    runnerSubject: "a single small backyard mechanic workshop: corrugated steel shed with open roller-door, a workbench inside with tools, a motorcycle on a lift, a few sparks from welding, oil drums outside",
    crewSubject: "a large industrial Berlin Werkstatt-Hof compound: multiple shipping containers and workshop bays, several motorcycles and a vintage car being repaired, welding stations with bright sparks, hazard-yellow caution stripes on the floor, oil drums, hanging tool racks",
    bannerScene: "wide cinematic shot of a Berlin industrial backyard workshop at twilight, sparks flying, glowing welding light blue against orange interior light, gritty urban realism",
  },
  {
    id: "container_camp",
    name: "Container-Camp",
    description: "Stapel-Container mit Graffiti — urbane Festung aus Schiffscontainern.",
    palette: "rusted steel, vibrant graffiti pinks and purples, hazard orange, weathered teal containers, harsh white work lights",
    accent: "#A78BFA", glow: "rgba(167,139,250,0.55)",
    ambient: "post-industrial Berlin, multi-stack container art collective, work-lights, urban grit",
    runnerSubject: "a single shipping container converted into a small living/work space, painted teal with graffiti tags, a metal staircase up to the roof which has a deck-chair, a single string of lights",
    crewSubject: "a large Berlin Container-Camp compound: 8-12 shipping containers stacked 3 high in an interlocking pattern, covered in vibrant graffiti murals, metal walkways and ladders connecting them, work-lights illuminating the structure, plants on the rooftops, hazard-orange beams",
    bannerScene: "wide cinematic shot of a Berlin container art collective at dusk, stacked containers in a courtyard, graffiti glowing under work-lights, painterly urban realism",
  },
  {
    id: "ubahn",
    name: "U-Bahn-Eingang",
    description: "BVG-U-Bahn-Eingang — Treppenabgang mit Neonröhren und gelben Akzenten.",
    palette: "BVG yellow signage, white tile, cool fluorescent neon, dark stairwell, glossy black handrails",
    accent: "#22D1C3", glow: "rgba(34,209,195,0.55)",
    ambient: "late-night Berlin U-Bahn entrance, glowing yellow U-sign, cool tile interior visible, urban realism",
    runnerSubject: "a single small BVG-style U-Bahn entrance: classic Berlin stairs going down into a glowing tile-lit station, illuminated yellow 'U' sign on a pole, white-tile walls visible inside, glossy black handrails, dark cobblestones around it",
    crewSubject: "a large BVG U-Bahn station compound: a grand entrance plaza with multiple stairways descending, glowing yellow 'U' signs, neon strip lighting along the entrance arch, station bench in front, vintage poster columns, cobblestone plaza, a tram passing by",
    bannerScene: "wide cinematic shot of a Berlin U-Bahn entrance at night, yellow signage glowing, wet cobblestones reflecting light, late-night travelers descending, painterly urban realism",
  },
  {
    id: "graffiti_tower",
    name: "Graffiti-Tower",
    description: "Hochhaus mit überlebensgroßem Mural — Streetart-Wahrzeichen.",
    palette: "vivid pink-magenta mural paint, deep blue night sky, concrete grey base, neon-lit tagging, golden window lights",
    accent: "#FF2D78", glow: "rgba(255,45,120,0.6)",
    ambient: "iconic Berlin highrise covered in famous mural artwork, urban legend status",
    runnerSubject: "a single small concrete apartment tower segment with one entire wall covered in a vivid pink-and-purple street-art mural of a stylized face, a few warm window lights, a graffiti tag at street level",
    crewSubject: "a large 12-storey Berlin highrise tower with the entire facade covered in a massive vivid pink-magenta street-art mural depicting a stylized urban scene, neon spotlight illuminating it from below, surrounding buildings smaller in the foreground, dramatic Berlin sky behind",
    bannerScene: "wide cinematic shot of a Berlin highrise covered in a famous street-art mural at night, illuminated by spotlights, painterly urban-grit style",
  },
  {
    id: "techno_club",
    name: "Techno-Club",
    description: "Berghain-Vibes — Industrial-Architektur, Lasershow, Bass-Pulse.",
    palette: "raw concrete grey, deep red door light, violet laser beams, smoke haze, harsh blue strobe accents",
    accent: "#A855F7", glow: "rgba(168,85,247,0.65)",
    ambient: "iconic Berlin Berghain-style techno venue, midnight, queue of people, smoke and lasers visible through doors",
    runnerSubject: "a single small windowless industrial concrete techno club entrance: heavy steel door with a single red bulb above, brutalist concrete facade, a velvet rope, a hint of violet laser light leaking out, a Berghain-style minimalism",
    crewSubject: "a sprawling industrial Berlin techno-club compound: massive raw-concrete former power plant with industrial chimneys, glowing violet laser beams shooting from the roof, smoke billowing out, queue of people at the entrance, neon UV-pink accent strips, brutalist architecture",
    bannerScene: "wide cinematic shot of a Berlin Berghain-style techno club at 3am, violet lasers cutting through smoke, queue of people in black silhouettes, raw industrial concrete facade, painterly nightlife style",
  },
  {
    id: "penthouse",
    name: "Hochhaus-Penthouse",
    description: "Skyline-Suite mit Pool und Panoramablick auf Berlin.",
    palette: "polished glass, warm interior gold light, deep navy night sky, infinity-pool turquoise, chrome accents",
    accent: "#5DDAF0", glow: "rgba(93,218,240,0.55)",
    ambient: "luxury Berlin penthouse, skyline view, modern minimalist, infinity pool reflecting city lights",
    runnerSubject: "a single small modern penthouse rooftop scene: glass-walled apartment with warm gold interior light, a small infinity pool reflecting city lights, a lone deck-chair, glass railing, a city-skyline silhouette in the background",
    crewSubject: "a sprawling Berlin penthouse rooftop compound: large glass-fronted modern villa on top of a highrise, infinity pool spanning the deck, multiple lounge areas, fire-pits, palm trees, the Fernsehturm visible in the distant skyline, helicopter pad",
    bannerScene: "wide cinematic shot of a luxury Berlin rooftop penthouse at twilight, infinity pool, glowing skyline with the Fernsehturm, modern luxury, painterly architectural realism",
  },
  {
    id: "dachterrasse",
    name: "Dachterrassen-Festung",
    description: "Multi-Level-Dachterrasse mit Pool, Bar und Lounge — die ultimative Crew-Base.",
    palette: "warm bistro yellow string-lights, deep wood decking, lush green planters, golden bar brass, sunset orange",
    accent: "#FFD700", glow: "rgba(255,215,0,0.6)",
    ambient: "Berlin rooftop paradise at golden hour, multi-tier deck, party vibe, urban skyline panorama",
    runnerSubject: "a single small Berlin rooftop terrace: wooden deck with a small plunge pool, two deck chairs, a tiny bar cart, fairy lights overhead, planters with herbs, a glimpse of the Berlin skyline behind",
    crewSubject: "a sprawling multi-level Berlin rooftop compound: three tiered wooden decks connected by stairs, a large infinity pool, full outdoor bar with brass fittings and stools, lounge sofas with cushions, fire-pit, lush plant walls, fairy lights crossing the entire terrace, dramatic Berlin skyline behind including the Fernsehturm",
    bannerScene: "wide cinematic shot of a multi-tier Berlin rooftop party at golden hour, pool reflecting the sky, full bar, glowing string-lights, skyline backdrop, painterly luxury-urban realism",
  },
  {
    id: "wagenburg",
    name: "Squat / Wagenburg",
    description: "Bauwagen-Camp mit Lagerfeuer, Lampions und Punk-Spirit.",
    palette: "weathered painted wood in pinks and teals, warm campfire orange, paper-lantern yellow, deep night blue, mossy green",
    accent: "#FF8C00", glow: "rgba(255,140,0,0.55)",
    ambient: "Berlin alternative Wagenburg compound, communal living, warm chaotic charm, fire and music",
    runnerSubject: "a single small painted Berlin Bauwagen circus-wagon, weathered teal and pink wood, a string of paper lanterns over the door, a wood-stove chimney with smoke, a small campfire with two folding chairs in front",
    crewSubject: "a sprawling Berlin Wagenburg compound: a circle of 8-10 colorfully painted Bauwagen circus-wagons surrounding a central bonfire, paper lanterns strung between them, a hand-built wooden stage on one side, a communal kitchen tent, mossy ground, hanging tarps, alt-punk-anarchist vibe",
    bannerScene: "wide cinematic shot of a Berlin Wagenburg alternative camp at night, central bonfire glowing, ring of painted wagons, lanterns, people sitting around the fire with instruments, painterly alternative-urban realism",
  },
  // ── Saisonal & Spezial ────────────────────────────────────────────────
  {
    id: "halloween",
    name: "Halloween (saisonal)",
    description: "Saisonal: spukige Berliner Altbau-Ruine mit Kürbissen, Nebel und Geister-Aura.",
    palette: "bone-white stone, pumpkin orange, deep purple sky, sickly bio-luminescent green, crow black",
    accent: "#FF8C00", glow: "rgba(255,140,0,0.6)",
    ambient: "spooky autumn night in a haunted Berlin courtyard, full blood-moon, purple fog, jack-o-lanterns flickering, ravens circling",
    runnerSubject: "a single small haunted Berlin Altbau facade with broken windows, a glowing jack-o-lantern on the doorstep, dead vines climbing the wall, purple fog at the base, a single raven on the cornice",
    crewSubject: "a sprawling haunted Berlin Hinterhof compound under a blood-moon: crumbling Altbau facades surrounding the courtyard, glowing jack-o-lanterns lining the cobblestones, purple mist swirling, ghostly green spirit-energy at a central well, dead trees in pots, hanging skeletal banners",
    bannerScene: "wide cinematic shot of a haunted Berlin courtyard at midnight, blood-moon over the rooftops, ravens flying, purple fog, autumn-orange leaves blowing, gothic-urban horror atmosphere",
  },
  {
    id: "frost_keep",
    name: "Frost-Festung (saisonal)",
    description: "Saisonal Winter: schneebedeckter Berliner Block mit Eis-Akzenten und Lichterketten.",
    palette: "snow white, icy crystal blue, warm window glow yellow, frost-grey concrete, fairy-light gold",
    accent: "#FFFFFF", glow: "rgba(255,255,255,0.6)",
    ambient: "snowy Berlin winter night, gentle snowfall, warm-lit windows, frost on everything, cozy Christmas-market vibe",
    runnerSubject: "a single small Berlin apartment block in deep snow, a thick layer of snow on the roof, ice crystals on the windows, warm-yellow window lights, a string of fairy lights over the entrance, snowflakes gently falling",
    crewSubject: "a sprawling Berlin Hinterhof compound deep in winter: snow-covered Altbau facades all around, a frozen fountain in the center, fairy lights strung overhead in a canopy of light, a small Christmas market stall with a glowing pretzel sign, ice crystals on every surface, soft gentle snowfall",
    bannerScene: "wide cinematic shot of a Berlin neighborhood deep in winter snow at twilight, fairy lights warming the courtyards, gentle snowfall, painterly cozy-urban-winter realism",
  },
  {
    id: "night_rose",
    name: "Nachtrose",
    description: "Gothic-Berlin Nightlife — schwarze Rosen, Blutmond, neon-pinke Akzente.",
    palette: "deep matte black, blood red, neon pink-magenta accents, deep violet sky, silver chrome highlights",
    accent: "#FF2D78", glow: "rgba(255,45,120,0.6)",
    ambient: "Berlin gothic nightclub aesthetic, blood-moon, dark-rose decorations, neon-pink atmosphere",
    runnerSubject: "a single small black-painted Berlin gothic apartment facade, neon-pink accent lights tracing the windows, climbing dark-rose vines with red blossoms, a single ornate balcony with black wrought-iron railings, blood-moon visible above",
    crewSubject: "a sprawling Berlin gothic compound: a blackened multi-storey building with neon-pink LED strips along every architectural line, dark roses climbing the entire facade, a courtyard with a dramatic black fountain, neon-pink mist at floor level, blood-moon dominating the sky, gothic-nightlife luxury",
    bannerScene: "wide cinematic shot of a Berlin gothic-nightlife block at midnight, blood-moon, neon-pink architectural lighting, dark roses climbing facades, swirling mist, painterly gothic-urban-luxury",
  },
];

export function buildBaseThemeId(theme: BaseThemeId, scope: BaseThemeScope, asset: BaseThemeAsset): string {
  return `${theme}_${scope}_${asset}`;
}

/** Strippt Umgebungs-Kontext aus dem Subject-Text (für Pin-Mode) — entfernt
 * "surrounded by …", "in front of …", "behind …" etc. damit nur die Struktur bleibt. */
function stripEnvironment(subject: string): string {
  return subject
    .replace(/,\s*surrounded by[^,.;]*/gi, "")
    .replace(/,\s*set on [^,.;]*/gi, "")
    .replace(/,\s*on a [^,.;]*\bmound\b[^,.;]*/gi, "")
    .replace(/,\s*standing on [^,.;]*/gi, "")
    .replace(/,\s*in (front|behind|the middle) of [^,.;]*/gi, "")
    .replace(/,\s*with [^,.;]*\b(trees|forest|cove|valley|fjord|water|sea|sky|background|mist|fog)\b[^,.;]*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildBaseThemePrompt(input: {
  theme: BaseThemeArt;
  scope: BaseThemeScope;
  asset: BaseThemeAsset;
  mode: "image" | "video";
}): string {
  const { theme, scope, asset, mode } = input;
  const rawSubject = scope === "runner" ? theme.runnerSubject : theme.crewSubject;
  const subject = asset === "pin" ? stripEnvironment(rawSubject) : rawSubject;

  const sizeLine = asset === "pin"
    ? `Square 1:1, 1024×1024. Background: SOLID PURE NEON GREEN (#00FF00, chroma-key green / green screen). Completely flat uniform single color filling the ENTIRE 1024×1024 frame including a clean ~8% margin around the building. No gradients, no patterns, no texture, no shadows on the green, no environment, no scene, no atmospheric effects. Clean hard silhouette edge between structure and green for chroma-key compositing. Building centered with safe margin — must not touch frame edges.`
    : `Wide cinematic 8:3 banner, 1600×600, structure occupies center-left, atmospheric depth visible to the right (sky, mountains, etc). No transparency — full painterly background.`;

  const styleLine = asset === "pin"
    ? `Style: a single isolated 3D game-building sprite in the exact aesthetic of Rise of Kingdoms / Call of Dragons / Clash of Clans town-hall icons. Slight isometric ~30° three-quarter view. Thick clean readable silhouette, vibrant saturated colors, soft inner accent glow, gentle rim-light. Looks like a polished mobile-game building-icon ripped straight from the game UI — NOT a concept-art scene. Readable as a 56×56 pixel thumbnail. Compact footprint — the building sits on its own minimal stone-tile base (max 5% larger than the structure footprint), no extending grass or terrain.`
    : `Style: cinematic concept-art splash banner, painterly, dramatic key-light, atmospheric perspective, foreground subject in clear focus, background dissolves into mood-light.`;

  const scopeLine = scope === "crew"
    ? `Scale cue: this is a CREW base — clearly larger and more fortified than a single-runner base. Multiple connected structures forming one compound silhouette. Reads as "guild-hall / stronghold".`
    : `Scale cue: this is a single-runner base — compact hero structure. Reads as "personal hideout".`;

  const paletteLine = `Color palette: ${theme.palette}. Primary accent ${theme.accent} with gentle glow ${theme.glow}.`;
  const ambientLine = asset === "pin"
    ? `Lighting: clean studio-style 3D-render lighting, soft top-key, gentle accent glow. NO ambient scene effects (no fog/snow/leaves drifting around the asset).`
    : `Atmosphere: ${theme.ambient}.`;

  const baseNegative = `No text, no labels, no watermark, no logos, no UI overlays, no people, no characters, no animals${theme.negative ? `, ${theme.negative}` : ""}.`;
  const pinNegative = ` STRICT NEGATIVE for chroma-key: no ground plane, no extending terrain, no grass, no sky, no clouds, no trees, no plants, no flowers, no bushes, no water, no mountains, no hills, no scattered rocks, no scenery, no environment, no atmospheric perspective, no fog, no mist, no smoke clouds, no rain, no snow, no green-tinted aura/glow on the building (would be keyed out), no green flags/banners/lights/gemstones (would be keyed out — use teal/blue/cyan/yellow/red/purple/orange/white instead). Behind and around the building is ONLY pure #00FF00 — nothing else.`;
  const negative = baseNegative + (asset === "pin" ? pinNegative : "");

  if (asset === "pin") {
    if (mode === "video") {
      return [
        `Shot: a 3-second perfectly seamless looping clip of a single isolated 3D game-building sprite, square 1:1 composition, 1024×1024, 30 fps.`,
        `Background: SOLID PURE NEON GREEN (#00FF00, chroma-key green / green screen). Completely flat uniform single color filling the ENTIRE 1024×1024 frame including a clean ~8% margin around the building. No gradients, no patterns, no texture, no shadows on the green, no environment, no scene, no atmospheric effects. Clean hard silhouette edge between structure and green for chroma-key compositing.`,
        `Subject: ${subject}. This is the "${theme.name}" base theme — ${theme.description}`,
        scopeLine,
        `FRAMING (critical): the building is FULLY CONTAINED inside the 1024×1024 frame. The structure's silhouette must NOT touch ANY of the four frame edges. Leave a clean uniform green margin of ~80 pixels (~8% of frame) on TOP, BOTTOM, LEFT and RIGHT — visible green screen on all four sides. The full roof, both side towers, the full base of the structure are visible inside the frame — nothing cropped, nothing extending past the frame border.`,
        `Style: a single isolated 3D game-building sprite in the exact aesthetic of Rise of Kingdoms / Call of Dragons / Clash of Clans town-hall icons. Slight isometric ~30° three-quarter view. Thick clean readable silhouette, vibrant saturated colors, soft inner accent glow, gentle rim-light. Looks like a polished mobile-game building-icon ripped straight from the game UI — NOT a concept-art scene. Compact footprint — the building sits on its own minimal stone-tile base (max 5% larger than structure footprint).`,
        paletteLine,
        `Motion: subtle micro-ambient ON THE STRUCTURE ITSELF only — flag/banner gently waving, small accent-glow pulse, small flame/spark flicker on torches. NO environmental motion. NO particles drifting through empty space. Camera fully static — locked, no pan/tilt/zoom/dolly. The building stays in the same contained position the entire clip.`,
        `CRITICAL LOOP REQUIREMENT: the exact last frame must be pixel-identical to the first frame — pose, glow intensity, flag position, particle positions all reset exactly. No frozen hold, no fade to black, no fade in — pure mathematical loop.`,
        `CRITICAL: NO green tones ANYWHERE on the building, walls, roof, banners, flags, gems, lights, glows or accents. NO green flags, NO green banners, NO green gemstones, NO green torch flames, NO green moss. The ONLY green in the entire video is the pure #00FF00 background. Use teal/cyan/blue/yellow/red/orange/purple/white instead.`,
        `NO ground plane, NO extending terrain, NO grass, NO sky, NO clouds, NO trees, NO plants, NO water, NO mountains, NO scattered rocks, NO scenery, NO environment, NO atmospheric perspective, NO fog, NO mist, NO smoke clouds, NO weather, NO god-rays, NO wide particle storms, NO magic circles behind the building. Behind and around the building is ONLY pure #00FF00.`,
        `No audio, no sound, no music. Silent video only.`,
        baseNegative,
      ].filter(Boolean).join(" ");
    }
    return [
      `Single isolated 3D game-building sprite, square 1:1, 1024×1024.`,
      `Background: FULLY TRANSPARENT PNG with alpha channel — completely empty outside the silhouette of the building (and its minimal stone-tile base). No background color, no gradient, no scene, no environment, no fill, no checkerboard, no white, no black, no green. The pixels outside the building must have alpha = 0 (true transparency).`,
      `Subject: ${subject}. This is the "${theme.name}" base theme — ${theme.description}`,
      scopeLine,
      `FRAMING (critical): building FULLY CONTAINED inside the 1024×1024 frame with a uniform transparent margin of ~80 pixels on TOP, BOTTOM, LEFT and RIGHT. Silhouette must NOT touch any frame edge.`,
      `Style: a single isolated 3D game-building sprite in the exact aesthetic of Rise of Kingdoms / Call of Dragons / Clash of Clans town-hall icons. Slight isometric ~30° three-quarter view. Thick clean readable silhouette, vibrant saturated colors. Looks like a polished mobile-game building-icon ripped straight from the game UI. Compact footprint — sits on its own minimal stone-tile base (max 5% larger than structure footprint). Hard clean silhouette edge — no halo, no fringing, no semi-transparent background bleed.`,
      paletteLine,
      `NO ground plane, NO terrain, NO grass, NO sky, NO trees, NO water, NO mountains, NO scenery, NO environment, NO atmospheric effects. Outside the building silhouette: only true transparency (alpha = 0).`,
      `Output format: PNG with alpha channel.`,
      baseNegative,
    ].filter(Boolean).join(" ");
  }

  if (mode === "video") {
    const motionLine = `Motion: 3-second seamlessly looping cinematic ambient — slow parallax of background mist/clouds, banners waving, lights flickering, distant particles drifting across the scene. Camera fully static. First and last frame identical.`;
    return [
      `Shot: a 3-second cinematic banner loop representing the "${theme.name}" base theme — ${theme.description}`,
      `Subject: ${subject}.`,
      scopeLine,
      paletteLine, ambientLine,
      motionLine, styleLine,
      sizeLine,
      `30 fps. No audio. ${negative}`,
    ].join(" ");
  }
  return [
    `A cinematic concept-art banner representing the "${theme.name}" base theme — ${theme.description}`,
    `Subject: ${subject}.`,
    scopeLine,
    paletteLine, ambientLine,
    styleLine,
    sizeLine,
    negative,
  ].join(" ");
}


// ═══════════════════════════════════════════════════════════════════════
// BUILDINGS — pro Gebäude ein isometrisches Tile-Asset im RoK/CoD-Style
// ═══════════════════════════════════════════════════════════════════════

export type BuildingArt = {
  id: string;
  name: string;
  category: string;
  emoji: string;
  silhouette: string;
  details: string;
  signature: string;
  composition: string;
  heroFeature: string;
  facing: "NE" | "NW" | "SE" | "SW";
  /** Dominante Farbwelt + Lighting-Mood pro Building — sorgt für visuelle Variety
   *  zwischen den Gebäuden (sonst sehen alle gleich gold-warm aus). Wird im Prompt
   *  explizit als "DOMINANT PALETTE" weitergegeben.
   *  Beispiele: "warm sodium-orange + rust + brown", "cool steel-grey + arc-weld white",
   *  "magenta neon + matt black + electric pink", "clinical white + signal green + chrome". */
  palette?: string;
};

export const BUILDINGS_ART: BuildingArt[] = [
  // ─── Hauptgebäude (00095) — Player HQ ───
  { id: "burg",           name: "Base",                   category: "utility",    emoji: "\u{1F3F0}",
    silhouette: "central command-base of an urban survivor crew: a multi-story rooftop bunker assembled from steel shipping-containers and salvaged brickwork, a tall radio-mast with cables and antennas crowning the top, satellite dish on a swivel-mount, a heavy reinforced steel security door at the front, sandbags and chain-link fence around the entrance",
    details: "graffiti tag of the player's faction sigil sprayed on the front, a steel ladder up the side, weathered solar-panel array on the upper deck, hanging string-lights along the rail, two folding chairs and an empty coffee can on the lower deck, faded warning stickers, a small tactical drone parked on a charging pad, warm yellow window-light glowing through portholes",
    signature: "the prominent radio-mast crowned with antennas + the satellite dish — universal symbol of 'this is HQ'",
    composition: "compact vertical multi-level fortress on a square reinforced-concrete platform with steel-bollard corners; lower level shipping-container, mid-level brick command-room with port-windows, top deck with mast and dish — tall and proud, slightly wider at the base than the top (T-silhouette), banner-pole projecting sideways from the upper rail",
    heroFeature: "a HUGE PLAYER-FACTION BANNER UNFURLS from the radio-mast and ripples in the wind — silk-textured, oversized (twice the building height), embroidered with the faction sigil and glowing seam-stitching that pulses softly; a steady warm spotlight from below illuminates the banner against the dusk sky, embers and city-dust drift up through the beam — feels like the proud capital of any urban survivor crew",
    facing: "NE",
    palette: "matt steel-grey container + warm tungsten window-glow + faction-color banner accent + concrete brutalist + amber dusk sky" },

  // ─── Phase 1 + Starter (00079 + 00082) — Storage / Combat / Utility ───
  { id: "wegekasse",      name: "Mautstation",            category: "storage",    emoji: "\u{1F3E6}",
    silhouette: "armored urban toll-station: a squat reinforced-concrete kiosk straddling a single-lane road, automated boom-barrier with red-and-white stripes, an armored cash-drop slot in the wall, traffic-LED gantry above the lane",
    details: "amber-yellow flashing strobe on the barrier post, payment-card reader and coin-slot embedded in the wall, scuffed traffic-cones to one side, an asphalt patch with painted lane arrows, security camera on a pole, faded 'STOP' decal, a steel cash-cassette in a wall recess",
    signature: "the striped boom-barrier mid-position over the lane + the embedded cash-drop slot — instantly readable as 'pay here'",
    composition: "wide-low horizontal kiosk straddling a paved asphalt lane on a small concrete platform — barrier-arm extends horizontally across the road, traffic-LED gantry adds an upper horizontal element, footprint dominated by the road passing through it",
    heroFeature: "a STEADY STREAM OF CRYPTO-TOKEN COINS (matt-gold etched with crew sigil, real physical disks) clinks continuously down through a chrome chute from the cash-cassette into a sealed armored deposit-cube below — the coins gleam under amber strobe-light, a small physical counter-display on the kiosk wall ticks upward in red LED digits, no holograms, just a real cashflow",
    facing: "NE",
    palette: "traffic-yellow + black-and-white striped barrier + LED warning orange + grey asphalt" },
  { id: "waechter_halle", name: "Wächter-Halle",          category: "combat",     emoji: "\u{1F6E1}️",
    silhouette: "fortified guardian-hall built into a converted brick warehouse: heavy steel roller-door front, reinforced concrete buttresses, two crew-banner masts angled outward like a gate, riot-shield sigil bolted above the door, a security-cage entrance",
    details: "matt-black ballistic shutters, a digital biometric scanner by the door, two faction-color uniformed mannequins in tactical armor flanking the entrance, weathered brick with tagger murals, sodium-vapor floodlight on a pole, hanging crew-flag with chrome edge-trim",
    signature: "the riot-shield sigil bolted above the steel roller-door + the two angled banner-masts — the universal 'this is the guardian-house'",
    composition: "broad rectangular warehouse-mass on a square reinforced-concrete platform with steel-bollard corners — slightly wider than tall, the two banner-masts splay outward forming a V-silhouette, roller-door faces the camera at 30°",
    heroFeature: "TWO COLOSSAL CHROMED RIOT-SHIELDS (each twice the height of the hall, brushed-steel and matt-black, etched with the faction sigil and embedded with LED inlays) are mounted crossed above the roller-door as a monumental display — they catch a faction-color spotlight from below, faint LED-edges pulse, banners ripple beneath them; absolutely unmistakable as a guardian's stronghold",
    facing: "SE",
    palette: "deep faction-red/teal accent + matt black + chrome + concrete grey" },
  { id: "laufturm",       name: "Signal-Turm",            category: "utility",    emoji: "\u{1F5FC}",
    silhouette: "tall slender concrete-and-steel signal-tower with an exposed lattice-frame upper section, a flashing aviation-light beacon at the top, microwave dishes mid-shaft, a service-ladder running up the side",
    details: "white-and-red horizontal striping on the concrete shaft, ice-warning paint at the base, two parabolic dishes pointing different directions, antenna-cluster at the apex, a maintenance access-hatch at ground level, a small chain-link fence ring around the base",
    signature: "the red aviation-strobe pulsing at the apex + the dishes mid-shaft — recognizable as a working comms-tower",
    composition: "extremely tall slender vertical tower (5:1 height-to-width ratio) on a small ROUND concrete pad only slightly wider than the tower base — silhouette dominated by verticality, dishes mid-shaft give one horizontal break, lattice-frame upper section narrows to the antenna-tip",
    heroFeature: "a SLOW SWEEPING CONE OF WHITE SEARCHLIGHT rotates from just below the apex, painting bright arcs across the dusk sky — combined with the staccato red aviation-strobe at the very top and a faint amber warning-pulse at the base, the tower visibly broadcasts 'we are watching' for miles, real working signal-equipment, no fantasy magic",
    facing: "SW",
    palette: "antenna white-and-red + chrome lattice + sky-blue + amber warning beacon" },
  { id: "lagerhalle",     name: "Industrie-Hangar",       category: "storage",    emoji: "\u{1F4E6}",
    silhouette: "wide-low industrial container-hangar with corrugated-steel walls and a chrome roller-door (one of two doors fully raised, revealing rows of shrink-wrapped pallets and stacked shipping-crates inside), a forklift parked outside, loading-dock with worn rubber bumpers",
    details: "high-vis yellow safety-stripes painted on the floor, an inventory-tablet on a wall mount, an LED docking-light over the door, scattered cardboard cores and pallet-strapping, a fume-extractor on the roof, an external rolling shelving-rack with parts-bins, a faded warehouse-zone number stencilled on the wall",
    signature: "the open chrome roller-door revealing deep rows of pallets stretching back into the building",
    composition: "wide-low horizontal hangar (width > height × 1.5) on a rectangular concrete-slab platform with painted truck-bay markings — front roller-doors face the camera, asymmetric forklift parked off to one side, dock-edge bumpers extend the footprint forward",
    heroFeature: "through the open roller-door, an IMPOSSIBLY DEEP ESCHER-LIKE INFINITY of stacked pallets, sealed crates and barrels recedes into the back under cool diffused floodlight — the inside is bigger than the outside, a bottomless industrial storehouse perspective, with a slow-moving conveyor visible carrying boxes deeper into the unseen depths, totally believable real-world warehouse, no magic",
    facing: "NE",
    palette: "matte hangar-grey concrete + safety-yellow stripes + cool diffused floodlight + chrome roller-door" },
  { id: "schmiede",       name: "Modding-Shop",           category: "utility",    emoji: "⚒️",
    silhouette: "bike-and-gear modding workshop in a converted brick garage with a wide roll-up door open to a workbench, a hot-pink neon 'MODS' sign above the door, sparks flying from a welding rig inside, a half-built chrome motorcycle on a lift",
    details: "a pegboard wall covered in tools, an oxy-acetylene torch hissing white-hot on a workbench, finished chrome bike-parts hung on hooks, a paint-spray booth in the back with magenta-and-pink half-painted panels, an old steel anvil repurposed as a stool, leather work-aprons hung outside",
    signature: "the hot-pink neon 'MODS' sign humming above the open garage + the showroom motorcycle on a lift inside",
    composition: "asymmetric mass on an oil-stained concrete pad — tall brick chimney with a fume-extraction stack on the LEFT, lower garage-shed on the right, a workbench with chrome parts extends out the front edge of the platform onto the driveway",
    heroFeature: "a SHOWER OF WELDING-SPARKS arcs in a continuous cascade from the welder inside, raining onto the concrete and bouncing in slow-motion — combined with the hot-pink neon glow leaking from the doorway and a pulsing magenta paint-booth UV-light, the whole shop bathes in a real working shower of plasma-cutter brilliance, gritty and modern",
    facing: "NW",
    palette: "magenta + hot-pink neon + sparking welder-white + matt-black + chrome bike-parts" },
  { id: "wachturm",       name: "Posten-Turm",            category: "combat",     emoji: "\u{1F3EF}",
    silhouette: "robust square reinforced-concrete watchtower with a glassed-in observation booth at the top, a rotating searchlight on the roof, narrow ballistic slit-windows, a single armored door at base accessed by a steel-grate stair",
    details: "olive-and-grey camo paint splotches on the lower shaft, a CCTV-cluster at each corner of the booth, sandbags ringed around the base, a tactical antenna whip on the roof, a red blinking sensor-LED on each face, faded military stencils, a coiled fire-hose by the entrance",
    signature: "the glassed-in observation booth crowned with rotating searchlight + the four corner CCTV-clusters — unambiguously a working watchtower",
    composition: "tall square fortress-tower (3:1 vertical) on a small octagonal sandbagged base — observation booth at the top wider than the shaft (mushroom silhouette), four corner CCTV-housings projecting outward at the crown",
    heroFeature: "the rotating SEARCHLIGHT casts a hard white CONE across the dusk sky in a slow sweep, a swarm of small surveillance-drones (the size of pigeons) circles the booth in a tight orbit pattern — combined with the staccato camera-red blinking LEDs, the tower visibly scans its surroundings 24/7, real working surveillance, no fantasy",
    facing: "SW",
    palette: "military olive-green + grey concrete + camera-red blinking LED + searchlight-white" },

  // ─── Expansion 00085 — Produktion ───
  { id: "saegewerk",      name: "Recycling-Hof I",        category: "production", emoji: "♻️",
    silhouette: "neighborhood scrap-yard with a hydraulic compactor, conveyor belt loaded with crates of mixed scrap (old appliances, scrap-metal, cables, pallets), corrugated-metal workshop shed, an old forklift parked off to one side",
    details: "stacks of compressed bales tied with wire, oxy-cutter spitting bright sparks at a workbench, oil drums, faded hi-vis hazard paint, a recycling tag spray-painted on the shed door, warm sodium-vapor floodlight on a pole, a pair of work-gloves on a crate",
    signature: "the hydraulic compactor mid-crunch + the conveyor of mixed scrap awaiting sorting",
    composition: "wide horizontal yard on a rough gravel-and-concrete pad with chain-link fence corner posts and faded yellow hazard stripes — tall compactor stands on the LEFT, conveyor extends sideways to the RIGHT into a sorting bin, scrap-piles asymmetrically distributed, lived-in working-yard feel",
    heroFeature: "a TOWERING CRANE-ARM holds a CAR-SIZED CRUSHED-METAL CUBE (3× the building height) suspended high above the yard, oil dripping in slow drops, sparks flying where the magnet-claw grips it; the entire site bathed in warm sodium-vapor light against a dusk sky, real working chaos — believable in any city or village setting, no holograms",
    facing: "NE",
    palette: "warm sodium-vapor orange + rust-red + brown + asphalt dust" },
  { id: "steinbruch",     name: "Komponenten-Werk I",     category: "production", emoji: "\u{1F529}",
    silhouette: "small fabrication workshop on a brick-and-steel base, large barn-style sliding door open to reveal a CNC milling machine and workbench, shelves of finished metal brackets and pipe-fittings, stack of timber on the side",
    details: "blueprints rolled on a steel workbench, copper pipe-coils, a heap of bolts and rivets, hand-tools on a pegboard, fume-extraction stack on the roof, simple LED work-lamp inside, finished components stacked neatly outside",
    signature: "the open barn-door revealing the CNC machine + the wall of completed components on the side rack",
    composition: "mid-height workshop on a packed-earth-and-concrete platform with worn paint markings — open sliding-door faces the camera at 30°, exhaust-stack projects upward like a small chimney on the left, a workbench with components extends out the front edge of the platform",
    heroFeature: "a HUGE WORKING ROBOTIC ARM (the size of a tractor, articulated chrome and matte-black) reaches out of the open door and assembles a comically oversized GLEAMING METAL COMPONENT in mid-air — the part is real, physical, almost finished, the arm catching it perfectly; sparks fly from a welder, this feels like genuine craftsmanship — at home in either a city industrial estate or a village workshop",
    facing: "NW",
    palette: "cool steel-grey + arc-weld electric-blue + brushed-aluminium + safety-yellow stripes" },
  { id: "goldmine",       name: "Krypto-Mine I",          category: "production", emoji: "\u{1F4B8}",
    silhouette: "garage-converted-to-mining-rig: a single-bay garage with a roll-up door open showing stacked GPU racks inside, a small bench full of cables and tools, a pile of golden coin-tokens in an open crate by the door",
    details: "bundles of patch cables looping out, sticky notes on the wall with sketchy formulas, an old oscilloscope on a side desk, cooling fans whirring quietly, RGB lights in a calm rainbow pattern across the GPU stacks, a battered office-chair, real warm lamp at the workbench",
    signature: "the open garage-door revealing the colorful RGB GPU wall + the heap of golden tokens",
    composition: "rectangular brick-and-steel garage on a small concrete driveway with painted parking-lines, a single tree by the corner, cable conduit running along the wall — homey small-business feel, neither dystopian nor sterile",
    heroFeature: "a GIANT WOODEN OPEN CRATE in front of the garage overflows with HEAPS OF GLEAMING GOLDEN HARDWARE-TOKENS (each etched with a lightning-bolt rune) spilling onto the driveway in a cascade that defies physics — coins occasionally bounce off and settle, the entire pile slowly grows; warm ambient light from the garage interior bathes the gold in a friendly orange glow, no holograms, no neon-overload — pure reward feeling",
    facing: "SE",
    palette: "RGB-rainbow + cool cyan LED + warm gold accent only on tokens + matt grey hardware" },
  { id: "mana_quelle",    name: "Datacenter I",           category: "production", emoji: "\u{1F4E1}",
    silhouette: "high-tech datacenter pod with rows of server racks visible through a glass-walled front, cool cyan ambient lighting, fiber-optic patch panel, raised metal-grate floor",
    details: "synchronized blinking cyan LEDs, fiber-optic patch cables in tidy bundles, industrial cooling vents pumping cold mist, latency-graphs on side monitors, condensation droplets on the chilled glass — premium tech facility",
    signature: "the wall of glowing cyan server LEDs through the glass + the cooling-mist plume",
    composition: "compact rectangular tech-pod on a polished metal-grate platform with cyan light-trace borders — glass front faces camera at 30°, cooling-tower annex projects up on the left side, fiber-optic cable conduit loops around the back",
    heroFeature: "a SINGLE BRILLIANT BEAM OF DATA-LIGHT shoots straight upward from the rooftop antenna into the sky, dispersing into a soft glowing CLOUD OF DATA-MOTES at the upper frame edge — visible from miles in the lore as 'the Datacenter is online'; the building stays grounded and physical, only the upward beam is the iconic VFX",
    facing: "SW",
    palette: "pure cyan-teal + cool blue LED + chrome + deep server-rack black" },

  // ─── Expansion 00085 — Lager ───
  { id: "tresorraum",     name: "Geheim-Tresor",          category: "storage",    emoji: "\u{1F3DB}️",
    silhouette: "small bank-grade vault building of brushed steel and concrete, massive round vault-door with a brass combination-dial, two slim chrome columns flanking the entrance, a guard-cabin to one side",
    details: "cool directional spot-light on the door, a single guard's stool with cap, polished marble floor visible through the open antechamber, a key-card panel on the wall, brushed-chrome nameplate, an alarm-LED above the dial",
    signature: "the round vault-door with prominent brass combination-dial — classic bank-vault aesthetic, modern executive-secure",
    composition: "almost perfect cube on a polished square stone platform with chrome-inlay border — the round vault-door faces the camera at 30°, strict symmetry, monumental and blocky",
    heroFeature: "THREE CONCENTRIC ROTATING CHROME VAULT-DOORS (frozen mid-rotation at different angles like a heist-movie bank-vault) protect the entrance — each massive steel disk turns at a different speed, brushed-chrome and royal-blue accent pistons visible in the gaps, polished gears the size of cartwheels mid-motion, gleaming under cold-white spot — the most secure storage in town",
    facing: "NE",
    palette: "chrome silver + matt black + accent royal-blue + cold cold-white spot" },
  { id: "kornkammer",     name: "Vorrats-Depot",          category: "storage",    emoji: "\u{1F4E6}",
    silhouette: "supply-depot warehouse with a wide rolling steel door, a green tarpaulin-covered loading-dock, neat rows of shrink-wrapped pallets visible inside, an awning at the front housing a desk and intake-clipboard",
    details: "an inventory chalkboard listing supplies, a hanging amber storage-lamp, brown corrugated cardboard boxes stacked in pyramids, a hand-pallet-jack parked outside, faded green paint on the door, a small forklift around the side, a single roll-cage with crates",
    signature: "the rolling steel door with the inventory chalkboard + the brown-cardboard pyramid stack — every neighborhood depot",
    composition: "wide-low rectangular depot on a rectangular concrete-slab platform with painted loading-zone stripes — the rolling door faces the camera at 30°, awning juts out over an intake desk, palette-jack adds a small foreground prop",
    heroFeature: "a STACKED PYRAMID OF SUPPLY-CRATES (5× human-height, perfectly squared brown cardboard with green crew-stencil tags) RISES through an opening in the depot roof in slow motion, lifted by an unseen overhead-crane — supplies pour from the top crate into the depot's pallet-bays in a controlled cascade, soft amber lamp-light catches the cardboard, real working logistics, no magic",
    facing: "NW",
    palette: "forest green + warm amber storage-lamp + brown cardboard + chrome rack" },
  { id: "mauerwerk",      name: "Komponenten-Speicher",   category: "storage",    emoji: "\u{1F9F1}",
    silhouette: "industrial parts-warehouse with a corrugated rust-orange wall, a steel mezzanine inside visible through clerestory windows, multi-tier metal shelving stacked with pipe-fittings, brackets, machined parts, an outdoor rack of finished steel beams",
    details: "a forklift parked at the loading bay, faded brown paint flaking on the corrugated walls, a row of warm tungsten storage-lamps hanging from the rafters, a worker's clipboard on a chained pen, a dusty pallet of machined components in the foreground, a metal-cutting station to the side",
    signature: "the rust-orange corrugated wall + the multi-tier metal shelves visible through the clerestory windows",
    composition: "long rectangular warehouse-mass with an asymmetric outdoor steel-beam rack annexed to the front-right side — wider than tall, the corrugated rust-orange dominating the silhouette, multi-tier shelving glimpsed through windows on the upper third",
    heroFeature: "an OVERHEAD GANTRY CRANE inside the warehouse traverses a massive steel I-BEAM (5× human-length, dusty industrial brown with rivet-detail) slowly across the mezzanine, sparks of dust drifting in the warm tungsten lamp-light beams; the giant beam is suspended impossibly mid-frame, a real working component-cathedral, all solid industrial heft",
    facing: "SE",
    palette: "industrial brown + corrugated rust-orange + matt warm tungsten + dusty grey" },

  // ─── Expansion 00085 — Kampf ───
  { id: "hospital",       name: "Klinik",                 category: "combat",     emoji: "\u{1F3E5}",
    silhouette: "modern urban clinic with white-painted concrete walls, a flat roof, large frosted-glass windows, a glowing green cross above the automatic sliding door, a small ambulance bay with parked drone-stretcher",
    details: "frosted-glass with a healing-symbol etched and softly LED-backlit cyan, white draped curtains visible inside, a chrome treatment-bench, jars of sealed med-kits on a steel shelf, hand-sanitiser station outside, a clinical-clean concrete forecourt, an emergency-call kiosk by the entrance",
    signature: "the glowing green cross above the door + the frosted-glass facade — instantly readable as 'medical'",
    composition: "mid-height clinic on a circular polished-concrete disc edged with a low chrome-railing — slender vent-stack on one corner pierces upward, ambulance-bay extends as an annexed crescent at the front",
    heroFeature: "a HUGE GLOWING GREEN MEDICAL-CROSS HOLOGRAM (4× human-height, projected from a chrome emitter on the roof) hovers above the clinic, slowly pulsing in soft signal-green and emitting a faint cyan diagnostic-grid that scans the immediate area — real medical-tech beacon, sterile and reassuring, no fantasy",
    facing: "SW",
    palette: "clinical white + signal-green cross + LED-cyan accent + sterile chrome" },
  { id: "trainingsplatz", name: "Übungs-Hof",             category: "combat",     emoji: "\u{1F94B}",
    silhouette: "open athletic training compound with a tartan running-track loop, a row of orange traffic-cones for agility drills, a pull-up frame, a tire-flip station, a chalk-marked sparring square in the corner",
    details: "neon-yellow track-markings on asphalt, three different drill-stations laid out, a coach's whistle on a clipboard, a stack of medicine-balls in a crate, a worn rubber mat in one corner, painted park-orange benches around the perimeter",
    signature: "the tartan-track loop + the bright-orange agility-cone row — feels like an urban park training-ground anywhere",
    composition: "OPEN COMPOUND with NO building shell — the platform IS a flat asphalt pad with painted lane-markings, drill-stations and racks scattered across the area, low chain-link fence around the perimeter",
    heroFeature: "ONE LIFE-SIZE TIRE (massive tractor-tire, weathered rubber) is FROZEN MID-FLIP — captured at the apex, dust kicked up beneath it, an athletic chalk-handprint smudge visible on its side, a single drop of sweat in mid-air; behind it the agility-cones stand untouched, the moment of the perfect lift caught forever",
    facing: "NE",
    palette: "athletic park-orange + grass green + asphalt grey + neon-yellow track-markings" },
  { id: "ballistenwerk",  name: "Drohnen-Werkstatt",      category: "combat",     emoji: "\u{1F6F8}",
    silhouette: "clinical white drone-assembly workshop with a wide glass front showing a workbench full of half-built quadcopters, a charging-rack of finished drones along one wall, a cluster of test-drones in flight inside",
    details: "schematic blueprints on a tablet, chrome rotor-blades and matte-black frames, a 3D-printer humming on a side desk, soldering-iron stations with magnifier lamps, a calibration-cube on a turntable, an LED green status-bar across the wall",
    signature: "the wall of charging quadcopters with green status-LEDs + the swarm of test-drones visible through the glass",
    composition: "horizontal workshop on a polished-concrete platform — glass front faces camera at 30°, an outdoor test-pad annex on one side with painted launch-circles, an antenna mast on the roof breaks the iso-bounds upward",
    heroFeature: "a SWARM OF TWELVE COMBAT QUADCOPTERS (matt-black with green LED running-lights) hovers in a perfect tight formation above the workshop roof, propellers buzzing, beams of cool diagnostic-green sweeping the ground beneath them as they orbit slowly — real working drone-fleet, militarized but not menacing",
    facing: "NW",
    palette: "clinical white + drone-LED green + chrome propellers + matt-black workbenches" },
  { id: "schwertkampflager",name: "Faust-Studio",         category: "combat",     emoji: "\u{1F94A}",
    silhouette: "boxing-gym dojo in a converted brick warehouse with a faded red 'BOXING' sign painted on the wall, two heavy punching bags hanging from ceiling chains, a regulation boxing-ring in the center, a weights-rack in the corner",
    details: "leather sparring gloves on a wooden stand, a small workbench with hand-tape rolls and gauze, a heap of polished sparring-helmets, a tattered crew-mural on a side wall, a vintage spit-bucket by the ring, sweat-towels on a hook",
    signature: "the regulation boxing-ring with red-and-white ropes + the painted 'BOXING' sign on the brick — a true urban fight gym",
    composition: "asymmetric warehouse-mass on a worn concrete pad — boxing-ring centered with the punching-bag area annexed asymmetrically to one side, the brick wall with painted sign forming the back-drop, weights-rack as a foreground prop on the opposite side",
    heroFeature: "a SINGLE COLOSSAL GLEAMING CHAMPIONSHIP-BELT (4× life-size, real leather strap with a massive engraved gold buckle, set with the crew sigil) hangs above the boxing-ring on chains, sweat-warm amber spot illuminating it from below — chains creak under its weight, the buckle gleams, the trophy that everyone here is fighting for",
    facing: "SE",
    palette: "boxing-red + worn concrete + sweat-warm amber + black gym-flooring" },
  { id: "bogenschuetzenstand",name: "Sniper-Nest",        category: "combat",     emoji: "\u{1F3AF}",
    silhouette: "rooftop sniper-nest concealed under camo-netting on a converted parking-garage roof, sandbag emplacement, a long-range rifle on a bipod, a spotter-scope on a tripod, a covered ammo-crate, ranging-flags at varied distances downrange",
    details: "olive-and-tan camo netting strung overhead, scattered shell-casings on the rooftop concrete, a tactical wind-flag, a thermos and protein-bar wrapper on a crate, IR-red dot from a laser sight, a kevlar helmet on a hook",
    signature: "the long-range rifle on bipod sighting downrange + the camo-net silhouette of the nest",
    composition: "ELONGATED depth-composition — long rectangular rooftop pad extending into iso-depth, three ranging-flags recede in perspective from foreground to background, the camouflaged nest in the near-foreground breaking the upper bounds with antenna-poles",
    heroFeature: "a FROZEN-IN-TIME LEGENDARY SHOT — a SINGLE bullet trail hangs suspended in a perfect arc from the rifle on the left, leaving a faint streak of muzzle-flash white-hot light across the scene, time stopped at the apex of the perfect shot — focused and clean, one round in flight, the rifle still steaming",
    facing: "SW",
    palette: "camo khaki + olive-green + dark grey + muzzle-flash white + IR-red dot" },

  // ─── Expansion 00085 — Utility ───
  { id: "akademie",       name: "Hacker-Lab",             category: "utility",    emoji: "\u{1F4BB}",
    silhouette: "two-story scholar's-meets-tech academy with arched windows, a large telescope and antenna-cluster on the roof, stack of books and a server-case by the entrance",
    details: "old volumes mixed with open laptops, rolled scrolls and tech-zines on an outdoor desk, a single owl on the roof rail, ivy climbing the brick walls, a magnifying glass and a chip-tester on the bench",
    signature: "the rooftop telescope pointing skyward + glowing arched library windows mixing old-world scholarship with modern tech",
    composition: "tall rectangular two-story academy on a square cut-stone platform — rooftop telescope SPIRE projects well above the typical iso-bounds, ivy creeping down the facade asymmetrically on one side",
    heroFeature: "a MAJESTIC LIVE OWL with golden eyes perches on the rooftop telescope, wings half-folded; a faint constellation-projection from the telescope draws in the air around the bird, gold-leaf shooting-stars trace lazy arcs — feels like wisdom passed from old-world libraries to modern lab-coats",
    facing: "NE",
    palette: "CRT-green + neon cyan glow + matte-black walls + retro green-on-black" },
  { id: "augurstein",     name: "Daten-Orakel",           category: "utility",    emoji: "\u{1F52E}",
    silhouette: "free-standing holographic data-pylon: a tall obsidian-black monolith covered in flush-mounted screens displaying scrolling code, a holographic projector at its tip casting a slow rotating data-sphere of light, a cluster of cooling-fins around the base",
    details: "swirling violet-and-teal hologram particles around the projector, a soft scrolling-sigil pattern crawling on the monolith faces, a chrome maintenance-altar at the base with a closed laptop and a coffee mug, fiber-optic cable conduit snaking away across the platform",
    signature: "the levitating holographic data-sphere projecting from the monolith's tip + the monolith's mirror-black faces of crawling code",
    composition: "NO building — bare matt-black monolith standing alone on a chrome-edged platform with hologram-mist swirling at its base, the projected data-sphere FLOATS DETACHED above the tip, maintenance-altar at the foot",
    heroFeature: "the data-sphere is a LIVING SWIRLING NETWORK-IN-MINIATURE — actual scrolling charts, market-tickers, neural-network nodes, satellite-orbit-traces visible inside it; light from the sphere projects a 3D constellation-grid of data-points all around the entire scene, with packet-trails zipping across — feels mystical-tech and timeless, equally at home next to a corporate HQ or a backyard hacker shrine",
    facing: "SE",
    palette: "purple-violet hologram + electric teal + chrome + deep-space black" },
  { id: "schwarzes_brett",name: "Quest-Tafel",            category: "utility",    emoji: "\u{1F4CB}",
    silhouette: "modern mission-board kiosk: a sturdy steel post with a large LED-backlit bulletin display, paper notices and contract-flyers pinned around its perimeter, a small awning above shielding it from rain, an attached touchscreen-tablet on a chained mount",
    details: "yellow paper notices fluttering on the edges, glowing turquoise LED-edges around the screen, a small barcode-scanner on the side, a coffee-can full of pens chained to the post, a few colorful sticker-tags on the frame, an oil-lantern repurposed as kitsch decoration above",
    signature: "the LED-backlit bulletin display with scrolling quest-titles + the perimeter of pinned paper-notices",
    composition: "TINY footprint — the smallest-massed building of the set, just a steel-post bulletin-kiosk and small awning on a single square paving-stone — composition feels modest and intimate compared to the others",
    heroFeature: "one of the pinned notices floats UP and unfurls itself in mid-air — its paper face dissolves into a LED-blue scrolling text-stream that hangs as a shimmering hologram, the ink-glyphs reorganising into mission-icons, a small drone observes from the awning — quiet but unmistakable digital magic in a small package",
    facing: "SW",
    palette: "LED-blue + matt-black bulletin frame + paper-yellow notices + glowing turquoise highlights" },
  { id: "halbling_haus",  name: "Bau-Büro",              category: "utility",    emoji: "\u{1F3D7}️",
    silhouette: "construction-site site-office: a stack of two safety-orange shipping-containers converted into an office, a flight of metal stairs to the upper container, a hard-hat dispenser by the door, a parked excavator outside, blueprints rolled on a folding table",
    details: "a chalkboard schedule on the side wall, a flower-box of bright marigolds (the only soft touch), a tiny clothesline with hi-vis vests, a metal sign reading 'BAU-BÜRO', stacked piles of cinder-blocks and rebar nearby, a yellow safety cone at the corner",
    signature: "the safety-orange container-office stacked two-high + the parked excavator outside",
    composition: "BUILDING IS THE PLATFORM — two stacked safety-orange shipping-containers on a packed-earth pad with painted yellow safety-stripes, no separate tile beneath, metal access-stairs annexed to the front-left, blueprints-table extends out the front",
    heroFeature: "a COLOSSAL CONSTRUCTION-CRANE (3× the height of the office, hi-vis orange truss with a slowly swinging hook-block) towers directly above the containers — its hook holds a crate of cinder-blocks suspended high, a swarm of small drone-surveyors orbits the crane's tip with green LEDs, the crane's tip slowly rotates against the dusk sky — straight out of a working urban site",
    facing: "NE",
    palette: "construction safety-orange + matt white + safety-yellow stripes + grey concrete" },
  { id: "basar",          name: "Trading-Post",           category: "utility",    emoji: "\u{1F6D2}",
    silhouette: "open-air bazaar with colorful striped fabric awnings, modular market stalls displaying mixed wares (fruits, fabrics, tools, gadgets, spice-bags), real wooden tables",
    details: "hanging brass scales, woven rugs as floor mat, lanterns of varied shapes, a small mechanical monkey on a perch, baskets overflowing with goods of all kinds — like a bazaar that travels from village to city",
    signature: "the colorful striped awnings + the lavish display of mixed trade goods",
    composition: "wide-low open-bazaar sprawl on a flat irregular packed-earth pad with a woven rug edge (no clean stone tile) — multiple striped fabric awnings of varied heights cluster asymmetrically, NO walls, the silhouette is the cluster of canopies",
    heroFeature: "a COLOSSAL FRIENDLY MERCHANT-FIGURE (a beaming bazaar-king of warm flesh and richly painted robes, 3× human-size, no smoke, no genie — a real person of large presence) sits enthroned at the central stall, his outstretched hands brimming with glittering wares (a polished tool, a case of gems, a stack of crypto-tokens, a folded carpet); his booming laugh seems to echo across the platform — cinematic and welcoming",
    facing: "NW",
    palette: "rainbow striped market-tarps + warm amber + spice-orange + saffron + jade + crimson" },
  { id: "goblin_markt",   name: "Schwarzmarkt",           category: "utility",    emoji: "\u{1F576}️",
    silhouette: "ramshackle underground black-market entrance behind a graffiti-tagged metal roller-shutter, mismatched wooden stalls in a narrow alley, a junk-heap of mixed items being sorted, dim crimson and amber bare-bulb lanterns",
    details: "a digital balance-scale weighing odd items, hanging mystery-bags with question-mark tags, a 'no-questions-asked' sign in spray-paint, lurking shadows, faded canvas tarps with patched holes, a contraband-crate behind a cardboard partition, a discreet camera blacked-out with tape",
    signature: "the half-rolled-up shutter revealing the dim purple-and-crimson interior + the junk-heap of mismatched items being appraised",
    composition: "INTENTIONALLY CROOKED ramshackle pile in a narrow brick alley — patched canvas + mismatched wooden stalls leaning at unequal angles, no straight lines, asymmetric on every axis, the platform itself is a pile of crates and pallets",
    heroFeature: "a GRINNING ROGUE DEALER-FIGURE (oversized and cinematically theatrical, a hooded streetwise broker) presides from a junk-heap throne at the back — his crown is a comical mix of misfit items (a chrome pistol, a coffee-cup, a lockbox, a single shiny boot, a smartphone), a too-thick ledger balanced on his lap, gold teeth flashing under the dim purple lantern-light, jeweled scepter held in his fist — a rogue but charming character",
    facing: "NE",
    palette: "deep purple neon + black underground + dim crimson + sodium-amber lurking light" },

  // ─── Expansion 00085 — Kosmetisch ───
  { id: "shop",           name: "Kosmetik-Stand",         category: "cosmetic",   emoji: "\u{1F3EA}",
    silhouette: "small wooden shop-front with a hanging painted sign, glass display window showing items, awning over the entrance, small porch with planters",
    details: "a chalkboard 'Open' sign, a barrel with rolled-up scrolls outside, a small bell above the door, potted plants flanking the entrance, a striped awning",
    signature: "the glass display window with glowing items and the painted hanging sign",
    composition: "narrow tall shop-front (width < height) on a small square cobblestone tile — facade faces the camera at 30°, hanging signboard projects sideways beyond the platform, awning casts a soft shadow on the door",
    heroFeature: "a FLOATING WOODEN DISPLAY-CASE rotates slowly above the door showcasing the day's hottest item — a polished legendary-tier weapon spinning slowly inside, lit from within by warm lamp-light, with smaller satellite items orbiting it (a potion, a ring, a scroll) on individual halos of soft golden light — feels both classic and magical",
    facing: "SE",
    palette: "pastel rainbow + neon-pink + holo-white + shop window glow" },
  { id: "brunnen",        name: "Springbrunnen",          category: "cosmetic",   emoji: "⛲",
    silhouette: "ornate urban plaza fountain with a central spire, water cascading from three tiers, koi swimming in the lower basin, a few coins gleaming below the surface, chrome lighting around the rim",
    details: "trimmed planters and roses around the base, scattered coins gleaming on the basin floor, two concrete benches nearby with worn cushions, lily-pads on the surface, soft submerged cyan LEDs lighting the water",
    signature: "the cascading three-tier water flow and the koi-fish in the basin",
    composition: "RADIALLY SYMMETRIC composition — round stepped concrete-disc platform with the multi-tier fountain centered exactly, three concentric basin-rings, no asymmetry — pure circular silhouette",
    heroFeature: "a TOWERING WATER-SPIRAL HELIX rises from the center spire — the cascading water freezes mid-flight into a slow-rotating crystalline-glass column lit from within by submerged cyan LEDs, koi-fish leap through its loops trailing rainbow ribbons of mist, moonlight-white reflections dance across the basin — a dramatic urban centerpiece, no fantasy creature, just sculpted water",
    facing: "SW",
    palette: "electric water-blue + chrome basin + soft moonlight white + cyan splash highlights" },
  { id: "statue",         name: "Graffiti-Wall",          category: "cosmetic",   emoji: "\u{1F3A8}",
    silhouette: "monumental graffiti-mural wall depicting a heroic figure with raised fist, on a tall plinth, surrounded by a tagged plaza with a few flowering planters",
    details: "concrete plinth with engraved name plaque, two iron tribute-braziers burning at the base, a wreath of fresh flowers at the figure's feet, scattered tags and stencils on the surrounding pavement",
    signature: "the dramatically lit mural silhouette with fist raised toward the sky, vivid spray-paint colors",
    composition: "TALL PLINTH dominates — building IS mostly the towering rectangular plinth on a small flagstone base, the heroic mural panel on top is small relative to the plinth, two braziers flanking the base extend the footprint forward",
    heroFeature: "the mural IS COMING ALIVE — caught mid-animation: the painted figure's fist slowly raises, the eyes glow soft magenta, drips of fresh spray-paint roll down its surface, hairline cracks of warm light spreading across the mural where it awakens; tribute-braziers burn with normal warm orange flames — equally at home in a city or a village square",
    facing: "NE",
    palette: "magenta + hot-pink + multicolor street-art + dark concrete + tag-spray contrast" },

  // ─── Combat-NEW (Wächter-System / Recruit-Bar / Gym / Garage / Workshop / Command / Wall) ───
  { id: "kaserne",        name: "Bar",                    category: "combat",     emoji: "\u{1F378}",
    silhouette: "narrow neon-lit dive bar in a converted shopfront, a flickering pink-magenta sign reading 'BAR' above the door, dark brick exterior, tall barred windows with backlit silhouettes of patrons, a small curbside cigarette-bin",
    details: "a frosted-glass door with the bar's hand-painted logo, a chalkboard menu of drinks at the entrance, a single barstool dragged outside, a pint-glass left on the windowsill, a bouncer's velvet rope by the doorway, a boot-scraper and worn doormat",
    signature: "the flickering pink-magenta 'BAR' neon sign + the lineup of recruit-silhouettes seen through the windows",
    composition: "narrow tall facade (width < height) on a small square paving-stone tile, asymmetric ventilation-stack rising on the LEFT side, neon-sign projecting out perpendicular to the facade, doormat extending the footprint forward",
    heroFeature: "a HUGE PULSING NEON SIGN (entire pink-magenta script reading the bar's name, glass-tube neon with visible argon-glow, half the building's height) flickers and hums above the doorway — moths circle in the warm bar-amber spill, faint cigarette-smoke drifts up past the sign, the silhouettes of three shadowy figures inside lean against the bar — recruit-haunt ambience, no fantasy",
    facing: "NE",
    palette: "neon-pink + neon-magenta sign + dark brick + black bar-counter" },
  { id: "schiessstand",   name: "Gym",                    category: "combat",     emoji: "\u{1F3CB}️",
    silhouette: "industrial fight-gym in a converted brick warehouse with a chrome-accent sign reading 'GYM', a wide front window showing rows of weight-machines and squat-racks, rubber-mat flooring, a heavy-bag area in the back",
    details: "neon-cyan accent strip running along the rooftop edge, an outdoor pull-up rig on the sidewalk, a chalk-bucket and a row of kettlebells outside, sweat-towels on hooks, a small reception-desk with a turnstile, a bike-rack out front",
    signature: "the chrome 'GYM' sign with cyan accent + the wide front window showing the lineup of squat-racks",
    composition: "wide-low brick warehouse-mass on a polished concrete pad — front window faces the camera at 30°, an outdoor pull-up rig annexed to the front-right side, sign perpendicular to the facade, asymmetric bike-rack extending footprint forward",
    heroFeature: "a COLOSSAL CHROMED BARBELL (5× human-length, gleaming polished steel with massive forty-five-plate weights, racked on a lifting platform inside the gym) is suspended mid-rep, frozen at chest-height — a single bead of sweat hangs in the air beside it, cyan accent-light catches the chrome perfectly, the whole gym vibrates with the inheld breath of a max-effort lift",
    facing: "NW",
    palette: "cool steel + neon-cyan accent + chrome + black rubber-mats" },
  { id: "stall",          name: "Garage",                 category: "combat",     emoji: "\u{1F697}",
    silhouette: "neighborhood mechanic-garage with two roll-up bay doors, both open to reveal a custom motorcycle on a lift in one bay and a muscle-car with hood up in the other, a hydraulic jack on the floor, a tool-chest on wheels nearby",
    details: "an oil-stain rainbow-slick on the concrete, a stack of car-tires by one wall, a pegboard of wrenches above the workbench, a vintage gas-pump as decoration, a calendar tagged with bikini-girl, an industrial fan in the corner, a parts-rack with chrome rims",
    signature: "the two open garage-bays revealing the custom bike on the lift + the muscle-car with hood up — every gearhead's dream shop",
    composition: "wide-low garage-mass on a stained-concrete platform with painted parking-lines — two roll-up doors face the camera, asymmetric tool-chest rolls out the front of one bay, vintage gas-pump as a sentinel on the LEFT corner",
    heroFeature: "a CUSTOM CHROMED MOTORCYCLE (every surface mirror-polished, deep-candy-red tank with crew-sigil pinstripe, glowing red taillight) rolls slowly out of the right-hand bay onto the driveway under its own power — a slow rev of the engine sends visible heat-shimmer up from its exhaust, oil-slick rainbow reflections on the wet concrete beneath it, mechanic's wrench dropped in surprise — pure motorhead glory",
    facing: "SE",
    palette: "mechanic-orange + grey concrete + chrome wheels + accent red + oil-slick rainbow" },
  { id: "belagerungsschuppen",name: "Werkhof",            category: "combat",     emoji: "\u{1F6E0}️",
    silhouette: "heavy-machinery workshop yard with an enormous welding-frame in the open, a hi-vis-orange gantry crane overhead, half-built siege-vehicle (a battering ram on tank-treads) parked on blocks, stacked steel I-beams, a forklift and a parked welding-truck",
    details: "showers of arc-welder sparks frozen in mid-air, oxy-acetylene torches on a workbench, a heap of bolts and rivets in a yellow bin, hi-vis safety-stripes painted on the concrete, a fume-extraction stack on the roof of an attached shed, finished armor-plates leaning against a rack",
    signature: "the half-built tracked siege-ram on blocks + the overhead orange gantry-crane mid-lift — clearly a heavy assembly yard",
    composition: "horizontal workshop sprawl on a rectangular concrete pad with hi-vis safety-stripes — the gantry-crane spans the whole yard at the top, projects upward AND forward, breaking the iso-bounding-box on the upper-front diagonal, half-built siege-ram dominates the foreground asymmetrically",
    heroFeature: "the half-built siege-ram is BEING WELDED IN REAL-TIME — a massive robotic welding-arm rains down a continuous spray of arc-blue sparks onto its armor-plates, hi-vis orange crane-cables tense overhead, a worker in a welding-mask watches from the side in safety-glow; the assembly almost feels alive, ready to roll the moment the last weld is laid",
    facing: "NW",
    palette: "hi-vis orange + welding-arc blue + black steel + safety-yellow stripes" },
  { id: "bergfried",      name: "Kommandozentrale",       category: "combat",     emoji: "\u{1F3D4}️",
    silhouette: "fortified command-bunker on the rooftop of an HQ-tower: a low cubic concrete bunker with reinforced steel hatch, a forest of antenna-whips and satellite dishes around it, sandbags piled at the corners, a tactical-display window glowing red from inside",
    details: "matt-grey reinforced-concrete walls with rusted rebar showing at the corners, a central holographic war-table glimpsed through the hatch, a row of red-LED indicator panels along the front, a chromed periscope poking through the roof, an emergency-floodlight on a swivel-mount",
    signature: "the steel command-hatch + the forest of antennas + the red-glowing tactical-display window — unmistakably the war-room",
    composition: "compact cubic bunker (height ≈ 0.7× width) on a square reinforced-concrete platform with sandbag-corner piles — antenna-cluster crowns the roof reaching well above the iso-bounds, the hatch faces the camera at 30°",
    heroFeature: "the rooftop HOLOGRAPHIC TACTICAL-MAP (a 3D city-grid projection of the entire kingdom at scale, glowing soft signal-red over the bunker) hovers above the structure, pulsing with troop-icons and march-arrows — a single signal-flare arcs from the bunker's antenna into the dusk sky, leaving a red trail; the war-room visibly commanding a campaign in real-time",
    facing: "SE",
    palette: "military grey-blue + signal-red lights + chrome + dark steel" },
  { id: "stadtmauer",     name: "Bollwerk",               category: "combat",     emoji: "\u{1F9F1}",
    silhouette: "modern reinforced perimeter wall section: a thick weathered-concrete bulwark with safety-yellow hazard-stripes at the base, razor-wire spool topping the wall, an embedded steel security gate, two sodium-vapor floodlights on poles flanking it",
    details: "graffiti tags faded along the lower wall, hi-vis safety-yellow stripes painted at the base for visibility, a CCTV camera clutch at one corner, sandbag emplacements stacked at the gate, embedded steel rebar showing through cracks, an emergency exit-sign in red over the gate",
    signature: "the safety-yellow hazard-stripes + the razor-wire spool atop the wall + the embedded security gate — a real perimeter defense",
    composition: "wide-low horizontal wall-section (width > height × 2) on a rectangular reinforced-concrete pad — pure horizontal mass, the security gate breaks the symmetry at one end, floodlight-poles on either side projecting upward",
    heroFeature: "a HUGE WHITE-WHITE FLOODLIGHT BEAM sweeps from one of the pole-mounted lights across the dusk sky and down the wall in a slow patrol-arc, illuminating the razor-wire and casting hard shadows; the gate's red emergency-light pulses in sync, a small surveillance-drone hovers above the wall mid-patrol — the perimeter visibly secure, no fantasy",
    facing: "SW",
    palette: "weathered concrete + safety-yellow stripes + accent steel-grey + razor-wire" },

  // ─── Crew (00079 + 00080 + 00085) ───
  { id: "crew_treffpunkt",name: "Crew-Treffpunkt",        category: "production", emoji: "\u{1F3DB}️",
    silhouette: "large brutalist crew meeting-hall built into a converted civic-building: a wide concrete forecourt with stepped seating, a huge entrance with crew-banners hanging between concrete pillars, a chrome-railed balcony above the door, weathered concrete walls with crew-sigil graffiti",
    details: "a great central fire-pit (steel barrel with real warm amber flames) at the foot of the steps, two abstract steel sculptures flanking the entrance, a textured concrete floor with painted faction-color circles, banners with the crew sigil hanging from poles, a few tactical-LED floodlights",
    signature: "the central fire-pit on the forecourt + the columned brutalist facade with hanging crew banners",
    composition: "MONUMENTAL horizontal mass — wide concrete hall (width > height × 1.4) on a large rectangular concrete platform with a stepped front edge — wide concrete steps lead up from the front, six-pillar facade dominates the silhouette, fire-pit centered on the forecourt",
    heroFeature: "a HUGE CREW-BANNER (4× building height, faction-color silk with the crew sigil embroidered in chrome thread, edged with LED-strip lighting) UNFURLS from the upper balcony down across the entire facade — the banner ripples in an unfelt wind, embers from the fire-pit drift up across it, faction-color floodlights sweep its surface, tactical-amber crew-lights pulse along the walls — feels like the heart of any proud urban crew",
    facing: "NW",
    palette: "matte concrete grey + faction-color accent (red/teal/purple banners) + warm amber crew-lights" },
  { id: "truhenkammer",   name: "Truhen-Depot",           category: "storage",    emoji: "\u{1F5DD}️",
    silhouette: "vault chamber with rows of wooden treasure-chests bound in iron, hanging keys collection on the wall, an ornate centerpiece chest open and overflowing on a small dais",
    details: "an ornate centerpiece wooden chest with iron banding, brass lanterns illuminating each row of chests, dust motes in beams of warm light, a heavy oak door behind the dais, a bookkeeper's ledger on a stand",
    signature: "the centerpiece overflowing chest with cascading gems, gold coins and trinkets",
    composition: "blocky chamber on a square polished-stone platform — front wall is OPEN, revealing rows of wooden chests in cross-section style (the camera sees inside as if the front wall is missing), centerpiece chest projects slightly forward on a small dais",
    heroFeature: "the centerpiece chest is ENORMOUS (5× the size of the others) and contains a swirling treasure-cloud of gems, gold coins and glittering trinkets — items pour out of the lid in a slow gravity-defying geyser, occasionally a coin flips and falls back, warm gilt light from inside spills outward — pure folk-tale treasure-trove feel, no neon",
    facing: "SE",
    palette: "warm amber + dark mahogany + soft yellow lamp + brass-gold accent" },
  { id: "arena_halle",    name: "Arena",                  category: "combat",     emoji: "\u{1F3DF}️",
    silhouette: "miniature urban combat-arena with stepped concrete bleachers, a sand-floor combat pit at center, weapon racks and chain-link fencing along the walls, sodium-vapor floodlights on poles",
    details: "two crossed-spear banner murals painted on the concrete, a victory-podium with a chrome-and-gold trophy and a wreath, floodlights lining the entrance, painted murals of past champions on the walls, a row of stadium-cyan light strips around the rim",
    signature: "the visible sand combat pit + the stepped concrete bleachers and crowd-cyan stadium-light silhouette",
    composition: "BUILDING IS THE PLATFORM and SUNKEN — round colosseum-tile where the central sand-pit is RECESSED below the ring of stepped concrete bleachers, viewer looks slightly down into the arena bowl, no traditional walls, floodlight-poles around the rim",
    heroFeature: "a MONUMENTAL CHROMED CHAMPION-THRONE (ornate beyond reason, brushed-chrome with weathered concrete-base, etched with crew-sigils) sits empty at the head of the arena, awaiting the next champion; the stepped concrete seating glows under sweeping crowd-cyan stadium-lights, dust kicks up in the sand pit at the center as if a fight just ended, a hard floodlight-white spot tracks where the next fighter will enter",
    facing: "SW",
    palette: "floodlight-white + sand-yellow ring + crowd-cyan stadium accents + concrete grey" },
  { id: "mana_quell",     name: "Bandbreite-Quelle",      category: "production", emoji: "\u{1F4A7}",
    silhouette: "large pillared crew-scale data-spring: a multi-tier carved concrete basin with cyan-glowing data-coolant cascading downward, four chrome cooling-monoliths surrounding the basin, glassy water-blue mist rising into the air",
    details: "four chrome monoliths with embedded fiber-optic strips at the cardinal points, glowing wisps of data-coolant rising into the air, soft white LED accents around the base, a glassy pool collecting at the foot, condensation droplets on the chrome",
    signature: "the four-chrome-monolith circle around a glowing-cyan cascading basin",
    composition: "FLOATING CLUSTER composition — multi-tier basin levitates above a wide circle of broken concrete fragments, four monoliths orbit at the cardinal points, glowing wisps fill the void where a platform would be",
    heroFeature: "a GEYSER OF LIQUID CYAN-DATA-LIGHT erupts from the basin in a perfect rising spiral arc and FREEZES MID-AIR INTO A ROTATING HELIX of luminescent fluid sculpture — wisps spiral up the helix like climbing the strands of fiber-optic cable, occasionally crystallizing into glowing data-glyphs that orbit the structure — a crew-scale spring of pure bandwidth",
    facing: "NE",
    palette: "ocean-cyan + electric-teal + glassy water-blue + soft white" },
  { id: "allianz_zentrum",name: "Crew-Zentrum",          category: "utility",    emoji: "\u{1F3DB}️",
    silhouette: "imposing crew assembly hall with a domed concrete roof and a tall chrome flag-pole crowned with the crew-flag, wide concrete entrance with steps leading up, five smaller flag-poles ringing the dome",
    details: "five smaller chrome flag-poles with allied-faction banners flanking the entrance, a circular meeting-table visible through the open glass doors, two cast-concrete crew-emblem statues at the top of the steps, banners draped between concrete pillars, warm crew-amber accent lights",
    signature: "the central crew-flag flying highest among five allied flags",
    composition: "domed rotunda on a circular polished-concrete platform — central crew-flag pole crowns the dome and reaches very high, five smaller flag-poles ring the platform edge — rotational symmetry around the central pole",
    heroFeature: "the CREW-BANNER on the central pole is woven from LIVING FACTION-COLOR FIRE — the cloth IS soft flame, snapping in an unfelt wind, gentle embers cascading off it but never consuming it; thin streamers of warm flame connect the central banner to each of the five smaller flags in a star-pattern web — feels like sacred urban camaraderie, no fantasy",
    facing: "NW",
    palette: "faction-color (varies) + matt concrete + chrome flag-poles + warm crew-amber" },
  { id: "spaeher_wachposten",name: "Späher-Posten",       category: "combat",     emoji: "\u{1F441}️",
    silhouette: "elevated rooftop scout outpost on a converted water-tower frame: a small steel-cage observation booth on stilts, a rope-and-steel ladder access, a tarp roof with camo netting, a long-range optical scope on a tripod",
    details: "a tactical map pinned to the inside wall, a falconer-style perch holding a chrome-and-matt-black surveillance drone, a rolled signal-flag on a stand, an IR-scope and binoculars on the ledge, a thermos and an empty MRE-pack on a small ledge",
    signature: "the elevated stilted observation booth + the chrome surveillance drone perched on the stand",
    composition: "STILTED VERTICAL — tall rooftop outpost on stilts (3:1 vertical), small square deck but the stilts elevate the booth to twice the typical height, ladder hangs asymmetrically off one side",
    heroFeature: "a MAJESTIC LARGE TACTICAL SURVEILLANCE-DRONE (the size of a small car, photorealistic matt-black-and-chrome quadcopter with multiple amber sensor-eyes and a long-range optical-array, hovers at a slight angle above the booth — its rotors glow with a soft IR-amber pulse, one of its sensor-arms unfolded and scanning, the other holding a signal-relay transponder; half its bulk projects beyond the upper-right frame edge — the watch-drone every scout dreams of, no animals",
    facing: "SE",
    palette: "camouflage greens + brown + black tactical optics + amber binocular-glow" },
  { id: "sammel_leuchtfeuer",name: "Signal-Bake",          category: "combat",     emoji: "\u{1F6A8}",
    silhouette: "tall steel emergency-beacon tower with a massive multi-strobe lamp on top, switch-back service stairs winding up the exterior, crew-banners along the climb, a chained electrical conduit running up the shaft",
    details: "the multi-strobe lamp pulsing in red-white-amber alternately, smoke-streaks of dispersed fog drifting upward, crew banners along the spiral stair, a fire-extinguisher cabinet at the base, a cable-conduit fed from the ground, a 'CAUTION HIGH-VOLTAGE' sticker",
    signature: "the towering strobing emergency-beacon silhouette visible from anywhere in the base",
    composition: "TALLEST OF ALL — extremely thin steel beacon-tower (4:1 height-to-base), octagonal concrete base, switch-back exterior staircase wraps the shaft, massive multi-strobe lamp crowns the top — pure verticality, the lamp breaks the upper iso-bounds",
    heroFeature: "the strobe on top is an INTENSE 3-COLOR EMERGENCY-PATTERN (red, amber, white in a fast rotating sweep) that throws hard shadow-cones upward into the dusk sky and down across the platform — combined with a wailing siren-light beneath it, the entire upper third of the image dominated by the strobing-cone column — the call-to-arms emergency-beacon every urban crew understands",
    facing: "SW",
    palette: "emergency-red strobing + matt black + amber warning + white siren-light" },
  { id: "crew_taverne",   name: "Crew-Bar",               category: "production", emoji: "\u{1F378}",
    silhouette: "large two-story underground crew bar in a converted brick warehouse with a glowing electric-purple neon sign reading the crew name, a balcony on the second floor crowded with patrons silhouettes, multiple windows glowing magenta, a heavy steel door at street level",
    details: "two motorcycles parked outside, painted hero-portraits of legendary crew members hung on the brick wall, lively neon-magenta light spilling from every window, a flickering 'OPEN' sign, a chalkboard cocktail menu, ivy on the brick base, a graffiti-mural along the side wall",
    signature: "the multi-window magenta glow + the upper balcony with hero-portraits of legendary crew members + the electric-purple crew-name neon",
    composition: "ASYMMETRIC two-story building on a brick-paved platform — second-floor balcony JETTIES OUT prominently over the right side, two parked motorcycles outside extend footprint left, multi-window glow varies from window to window",
    heroFeature: "a HUGE WALL-SIZED ELECTRIC-PURPLE NEON SIGN (3× human height, glass-tube neon spelling out the crew's name in bold script, with embedded LED-pulse running in the glass) buzzes and flickers over the entrance, casting hard magenta shadows down the brick — moths circle in the warm bar-amber spill, faint cigarette-smoke drifts past, silhouettes of crew members on the balcony raising bottles in cheers — feels like the heart of any urban crew's nightlife",
    facing: "NE",
    palette: "neon-magenta + electric purple + black brick + warm bar amber" },
  { id: "crew_hospital",  name: "Crew-Klinik",            category: "combat",     emoji: "\u{1F3E5}",
    silhouette: "large crew infirmary in a converted clinic-building with white-painted concrete walls, a flat roof crowned with a glowing green cross, multiple healing-cots visible through wide frosted-glass windows, a small chrome bell-tower for emergency-calls",
    details: "a chrome-and-water healing-fountain in the front courtyard with submerged cyan LEDs, sealed med-kit racks flanking the path, scrubs and bandages neatly stacked on a sterile chrome trolley, a giant green LED cross banner above the entrance with crew-color accent trim",
    signature: "the green-LED cross above the door + the central chrome healing-fountain in the courtyard — modern crew clinic",
    composition: "concrete building wrapping a CENTRAL OPEN COURTYARD — round polished-concrete platform with a healing-fountain in the visible center, the building is a hollow ring around the courtyard so the camera sees through the front opening into the fountain",
    heroFeature: "a HUGE GLOWING GREEN MEDICAL-CROSS HOLOGRAM (5× human-height, projected from a chrome emitter on the rooftop) hovers above the clinic, slowly pulsing in soft signal-green and emitting a faint cyan diagnostic-grid that scans the courtyard; a swarm of tiny healing-drones (matt-black-and-green) orbits the fountain, real medical-tech beacon, sterile and reassuring, no fantasy",
    facing: "NW",
    palette: "clinical white + signal-green cross + crew-color accent + sterile chrome" },
  { id: "crew_akademie",  name: "Crew-Lab",               category: "utility",    emoji: "\u{1F393}",
    silhouette: "imposing crew research-hall in a converted university-building: multiple turret-spires with antenna-clusters, a giant LED clock-face above the entrance, a telescope dome on the roof, a chrome-and-glass entrance with steps leading up",
    details: "students and researchers depicted on banners with hooded coats and laptops, a giant compass-rose mosaic on the courtyard, scrolls and books piled on outdoor reading benches mixed with open laptops, retro green-on-black CRT terminals visible through windows, faction-color accent strips along the rooflines",
    signature: "the giant LED clock-face above the entrance + the turreted academy silhouette with antenna-clusters",
    composition: "MULTI-SPIRE silhouette — central tall academy turret flanked by two shorter spires, set on a square stepped concrete platform with a giant compass-rose mosaic on the front step — three-peak skyline silhouette",
    heroFeature: "a MASSIVE TECH-CYAN HOLOGRAPHIC ASTROLABE-ORRERY (the size of the central tower itself, intricate floating chrome rings, holographic gemstone planets, fine glowing engravings) rotates slowly in mid-air between the three spires — its rings tilt and spin at different rates, faction-color accent lights catching its surfaces, projecting a halo of constellation-glyphs onto the courtyard below — pure scholarly tech wonder",
    facing: "SE",
    palette: "tech-cyan + dark navy + faction-color accent + green CRT terminals" },
  { id: "tempel_himmlisch",name: "Funkturm",              category: "combat",     emoji: "\u{1F4E1}",
    silhouette: "massive iconic urban radio-tower of white-and-red painted steel lattice with a tall observation deck, a flashing aviation-light beacon at the apex, three tiers of microwave dishes mid-shaft, a chrome-edged base with service-doors",
    details: "a constellation of small white inset windows on the observation deck glowing warm tungsten, a soft glowing crew-sigil bolted near the apex, two stylized chrome owl-statues at the entrance (a kitsch homage), particles of city-dust drifting through the lattice in spotlight beams",
    signature: "the unmistakable white-and-red lattice silhouette of an iconic urban broadcast tower, observation deck near the top",
    composition: "extremely tall vertical lattice (5:1 height-to-base) — the tower stands proud on a small octagonal concrete pad, the lattice narrows to the antenna-tip, observation deck near the top breaks the column with a horizontal halo, base entrance projects forward at ground level",
    heroFeature: "the observation deck is wreathed in a SLOW SWEEPING CONE OF SEARCHLIGHT (warm amber from one side, sky-blue from the other) that paints the dusk sky in rotating arcs, while the apex aviation-strobe pulses red against the deepening night; faint signal-rings of soft light pulse outward from the dishes at fixed intervals — the iconic comms-landmark of the entire city",
    facing: "SW",
    palette: "white-and-red antenna + chrome lattice + sky-blue + LED-red aviation lights" },
  { id: "crew_bergfried", name: "Crew-HQ",                category: "combat",     emoji: "\u{1F3E2}",
    silhouette: "fortified crew headquarters tower: a multi-story brutalist concrete tower with reinforced steel windows, a rooftop helipad with parked tactical-helicopter, chrome banner-poles around the rooftop edge, a fortified ground-level entrance with sandbag emplacements",
    details: "weathered concrete walls with crew-sigil graffiti at the lower level, faction-color accent strips around the rooftop, warm tungsten interior windows showing meeting-rooms, a tactical antenna-cluster on the roof, two chromed flag-poles flanking the helipad, a security-checkpoint at the entrance",
    signature: "the fortified concrete tower silhouette + the chrome rooftop banner-poles + the helipad with tactical-helicopter",
    composition: "tall vertical brutalist tower (height ≈ 2.5× base width) on a square reinforced-concrete platform with sandbag-corner piles — antenna-cluster + chromed banner-poles crown the roof reaching well above the iso-bounds, ground-floor entrance breaks the symmetry on one side",
    heroFeature: "a HUGE CREW-BANNER (5× building height, faction-color silk with the crew sigil embroidered in chrome thread, edged with LED-strip lighting) UNFURLS from the rooftop poles down across the entire facade — the banner ripples in an unfelt wind, faction-color floodlights sweep its surface, warm interior amber lights pulse from every window, the rooftop helicopter's running-lights blink in sequence — undeniable HQ presence",
    facing: "NW",
    palette: "faction-color accent (varies) + matt concrete + chrome banner-poles + warm interior amber" },
  { id: "crew_stadtmauer",name: "Crew-Bollwerk",          category: "combat",     emoji: "\u{1F9F1}",
    silhouette: "long fortified crew perimeter wall: thick concrete bulwark with painted faction-color stripe running its length, razor-wire spool topping the wall, an embedded reinforced security gate with crew-sigil emblem, sodium-vapor and chrome floodlights on poles flanking it",
    details: "crew-tagged murals along the lower wall, hi-vis safety-yellow stripes painted at the base for visibility, multiple CCTV camera-clusters at corners, sandbag emplacements stacked at the gate, chromed banner-poles every twenty meters, an emergency exit-sign in red over the gate",
    signature: "the painted faction-color stripe + the razor-wire spool + the embedded crew-sigil security gate — defensive fortification with crew identity",
    composition: "wide-low horizontal wall-section (width > height × 2.5) on a rectangular reinforced-concrete pad — pure horizontal mass, the security gate breaks the symmetry at one end, multiple floodlight-poles projecting upward at intervals along the length",
    heroFeature: "TWO HUGE WHITE-WHITE FLOODLIGHT BEAMS sweep from pole-mounted lights across the dusk sky and down the wall in coordinated patrol-arcs, illuminating the razor-wire and casting hard shadows; the gate's crew-color emergency-light pulses in sync, a small surveillance-drone hovers above the wall mid-patrol, banners ripple along the chromed flag-poles — the crew's perimeter visibly impenetrable",
    facing: "SE",
    palette: "concrete + faction-color stripe + razor-wire + flood-light white" },
];

/**
 * Prompt-Builder für Building-Sprite (Image oder Video).
 * Stil-Vorgabe: isometrisches Game-Asset auf einer schwebenden Stein-/Gras-Plinte.
 *  - mode === "image": fordert TRANSPARENTEN PNG-Background (Alpha-Channel).
 *  - mode === "video": fordert GREENSCREEN #00FF00 (Video-Codecs haben keinen Alpha;
 *    Frontend keyt das Grün im Browser zu transparent).
 */
export function buildBuildingPrompt(input: { building: BuildingArt; mode: "image" | "video" }): string {
  const { building, mode } = input;

  // ════════════════════════════════════════════════════════════════════
  // Image  → Alpha-PNG  (kein Greenscreen nötig, weil PNG Alpha kann)
  // Video  → Greenscreen #00FF00 (Browser-Chroma-Key)
  // Background-Anweisung MUSS Zeile 2 sein, sonst ignoriert Veo sie.
  // ════════════════════════════════════════════════════════════════════
  const subjectBlock = [
    `Subject: ${building.silhouette}.`,
    `Details: ${building.details}.`,
    `Signature element: ${building.signature}.`,
    `HERO FEATURE (THE WOW MOMENT — this is what makes the user say "wow, that's epic", do NOT skip or downplay this, render it BIG and prominent): ${building.heroFeature}.`,
    `Composition (CRITICAL — defines the unique footprint, platform shape and proportions of THIS specific building, do not default to a generic square tile): ${building.composition}. A soft contact-shadow sits directly under whatever the building rests on. The platform/base must visually fit this specific building — do NOT force a uniform square stone tile.`,
    building.palette
      ? `DOMINANT PALETTE (CRITICAL — this specific building MUST use this color/lighting world; do NOT default to warm gold/orange like other buildings, every building has its own distinct palette so the set looks varied): ${building.palette}.`
      : `DOMINANT PALETTE (default mid-warm urban): mix per building below — but ensure THIS building is visually distinct from every other building in the set.`,
    `Quality / style — AAA mobile-game promotional hero-shot, cinematic, awe-inspiring, ultra-detailed, intricate hand-painted texture work, dramatic atmospheric lighting, painterly highlights, slight cel-shading, vibrant saturated colors, the kind of asset you'd see on a key-art splash screen or trailer-thumbnail — NOT a generic mid-tier mobile icon. THEME — INCLUSIVE & GROUNDED REAL-WORLD that speaks to EVERYONE: country-folk, city-dwellers, village-residents, crews and gangs alike. The game's pillars are Country / City / Village / Crews. Buildings must read as plausible structures from a real neighborhood — workshops, barns, scrap-yards, garages, kiosks, watchtowers, market-stalls, smithies, clinics, training-grounds — instantly recognizable to ANY player. **VARIETY IS CRITICAL**: do NOT make every building look the same. Mix material palettes (weathered wood / brick / corrugated steel / concrete / stone / canvas / chrome / fabric — different per building), mix lighting moods (warm sodium-vapor, cool LED, golden-hour daylight, dusk torch-light, neon accent — different per building), mix tech-levels (most buildings are technology-NEUTRAL or have small subtle accents; ONLY a few specific buildings like Datacenter / Hacker-Lab / Daten-Orakel are meaningfully tech-heavy), mix landscape (some on concrete pads, some on grass, some on cobblestones, some on gravel, some half-buried, some levitating). DO NOT default to cyberpunk-dystopia (no neon-cyan everywhere, no constant holograms, no plasma-fire on every roof). DO NOT default to medieval-fantasy (no thatched-fantasy roofs, no carved magic-runes, no swords-and-sorcery on every facade). Real-world materials and lighting; small dashes of magic OR small dashes of tech where each building's specific story calls for it. Each building must be VISUALLY DISTINCT in silhouette — varied proportions (tall-narrow vs wide-low vs asymmetric vs levitating), varied platform shapes (square / round / hex / irregular / none), varied massing — NEVER a "default boxy block on square tile". Reference standard: Anno 1800 / Township / Forge of Empires / SimCity 4 / Stardew Valley (rural) / Anno 2070 (modern accents) — grounded illustration quality, family-friendly, optimistic, welcoming to all walks of life.`,
    `Camera: locked isometric 30° angle, square 1:1 frame. The building+platform MUST FILL THE ENTIRE FRAME — extend the silhouette all the way to the top, bottom, left and right edges with only ~2% safety-margin so contact-shadow has room. No large empty space on any side. Building rendered AT THE SAME VISUAL SIZE as every other building in the set — uniform scale (the building occupies ~90-95% of the frame area in each direction), so when displayed in a grid they look proportional. SILHOUETTE OUTLINE MUST DIFFER from every other building in the set — vary the FORM (tall-thin tower / wide-low slab / asymmetric L-shape / cubic block / stepped pyramid / dome / cluster / open compound / levitating / half-buried), do NOT default to the same boxy silhouette.`,
    `Facing direction (CRITICAL — the building is rotated within the iso world so its main entrance/facade points toward the ${building.facing} corner of the frame, NOT directly at the camera): ${({ NE: "the upper-right (NE) corner — door visible at an angle to the front-right, side wall facing camera-left", NW: "the upper-left (NW) corner — door visible at an angle to the front-left, side wall facing camera-right", SE: "the lower-right (SE) corner — door faces the camera-front-right, the back of the building is hidden upper-left", SW: "the lower-left (SE) corner — door faces the camera-front-left, the back of the building is hidden upper-right" }[building.facing])}. Do NOT default to a flat-on camera-front entrance — the variety of facings between buildings is essential.`,
    `Lighting: bright key light from upper-left at 45°, dramatic warm rim-light, atmospheric haze where appropriate, glow on signature/hero feature, soft ambient fill from upper-right — cinematic mood.`,
  ];

  const sharedNegative = `No text, no labels, no UI overlays, no watermark, no logo, no people, no characters, no border frames, no pedestals beyond the small iso-tile. NO ground extending past the tile, NO sky, NO clouds, NO trees beyond the small grass topping on the tile, NO water, NO mountains, NO scenery, NO atmospheric effects, NO god-rays, NO fog, NO mist, NO scattered rocks around the tile.`;
  const greenscreenNegative = `CRITICAL: NO green tones ANYWHERE on the building, walls, roof, banners, flags, gems, lights or accents. NO green moss-tinted glow, NO green flames, NO green liquids, NO bright lime accents. Use teal/cyan/blue/yellow/red/orange/purple/white instead. The ONLY green in the entire frame is the pure #00FF00 background.`;

  if (mode === "video") {
    return [
      `Shot: a 3-second seamlessly looping animated isometric game-asset of "${building.name}" — a ${building.category} building, square 1:1 composition, 1024×1024, 30 fps.`,
      `Background: SOLID PURE NEON GREEN (#00FF00, chroma-key green / green screen). Completely flat uniform single color filling the ENTIRE 1024×1024 frame around the building. No gradients, no patterns, no texture, no shadows on the green, no environment, no scene. (The app chroma-keys the green to transparent in the browser.)`,
      ...subjectBlock,
      `FRAMING (critical): the building + tile FILLS THE FRAME — silhouette extends close to all four edges (only a thin ~2% green safety-margin for the contact-shadow), occupies ~90-95% of frame area. UNIFORM SCALE across all buildings (the rendered building is the SAME visual size as every other in the catalog — no tiny outliers, no oversized monoliths).`,
      `Motion: gentle ambient — slow vertical bob of the floating tile (±2 px), subtle on-structure animation only (flag waves, water flows, fire pulses, glow pulses on the signature element). NO environmental particle drift through empty green space. Camera fully static. First and last frame pixel-identical for seamless loop.`,
      `No audio. Silent video only.`,
      sharedNegative,
      greenscreenNegative,
    ].join(" ");
  }

  return [
    `Single isolated isometric stylized 3D-render game-asset of "${building.name}" — a ${building.category} building. Square 1:1, 1024×1024.`,
    `Background: FULLY TRANSPARENT PNG with alpha channel — completely empty outside the silhouette of the building+tile. No background color, no gradient, no scene, no environment, no fill, no checkerboard, no white, no black, no green. The pixels outside the building+tile must have alpha = 0 (true transparency).`,
    ...subjectBlock,
    `FRAMING (critical): building + tile FILLS THE FRAME — silhouette extends close to all four edges (only a thin ~2% transparent safety-margin for the contact-shadow), occupies ~90-95% of frame area. UNIFORM SCALE across all buildings (the rendered building is the SAME visual size as every other in the catalog — no tiny outliers, no oversized monoliths).`,
    sharedNegative,
    `Output format: PNG with alpha channel. Hard clean silhouette edge — no halo, no fringing, no semi-transparent background bleed, no soft scene fade.`,
  ].join(" ");
}

// ═══════════════════════════════════════════════════════════════════════
// RESOURCES — die 4 Resource-Icons + Speed-Token im Base-Modal & HUD
// ═══════════════════════════════════════════════════════════════════════

export type ResourceArt = {
  id: string;
  name: string;
  fallbackEmoji: string;
  accent: string;
  subject: string;
  style: string;
};

export const RESOURCES_ART: ResourceArt[] = [
  { id: "wood",         name: "Tech-Schrott", fallbackEmoji: "⚙️", accent: "#FF6B4A",
    subject: "a small pile of stacked urban scrap-tech: an old motherboard with chips, a broken keyboard fragment, tangled black/red cables, a cracked smartphone screen, rust-orange accents, a few loose screws — dystopian Berlin-junkyard hardware-pile",
    style: "stylized 3D-render, hand-painted texture, warm rust-orange + dark grey palette, soft cel-shading, slight drop-shadow underneath, gritty industrial vibe" },
  { id: "stone",        name: "Komponenten",  fallbackEmoji: "\u{1F529}", accent: "#8B8FA3",
    subject: "a small assembly of industrial components: a polished steel I-beam fragment crossed with chunky bolts, a thick coiled spring, two metal brackets with rivets, a protective steel-plate, all stacked tightly — heavy-duty construction hardware",
    style: "stylized 3D-render, cool grey + brushed-steel palette, crisp specular highlights on metal, soft cel-shading, subtle blue-grey ambient light, structured & weighty feel" },
  { id: "gold",         name: "Krypto",       fallbackEmoji: "\u{1F4B8}", accent: "#FFD700",
    subject: "a single hexagonal Bitcoin-style crypto-token standing on edge with a stamped lightning-rune in the center, a small pile of 2-3 more coins half-buried beside it, faint holographic shimmer, subtle digital sparkles in the air",
    style: "stylized 3D-render, polished gold rim with bright cyan-blue digital glow on the rune-face, holographic glints, sparkle particles, premium cyberpunk-currency feel" },
  { id: "mana",         name: "Bandbreite",   fallbackEmoji: "\u{1F4E1}", accent: "#22D1C3",
    subject: "a luminous teal-cyan data-stream flowing in a tight spiral, made of glowing 1s and 0s and waveform pulses, with a small satellite-dish or wifi-symbol icon in the center radiating concentric signal-rings outward",
    style: "stylized 3D-render, glowing translucent data-stream, internal cyan light source, hex-pattern matrix accents, electric-blue particles, ethereal sci-fi feel — pure data visualized" },
  { id: "speed_token",  name: "Speed-Token",  fallbackEmoji: "⚡", accent: "#FFD700",
    subject: "a hexagonal energy token coin with an embossed lightning-bolt rune in the center, golden metal rim, electric-yellow glowing core",
    style: "stylized 3D-render, premium currency-token feel, electric-yellow inner glow, polished gold rim, lightning sparks emanating, slight float-bob" },
];

export function buildResourcePrompt(input: { resource: ResourceArt; mode: "image" | "video" }): string {
  const { resource, mode } = input;
  const greenscreenNegative = `CRITICAL: NO green tones on the subject — no green leaves, no green moss, no green glow, no green sparkles, no lime accents. Use only the resource's natural colors. The ONLY green is the pure #00FF00 background. No text, no labels, no UI overlays, no watermark, no border frames, no environment, no scene.`;
  if (mode === "video") {
    return [
      `Shot: a 3-second seamlessly looping animated game-icon of "${resource.name}", square 1:1, 1024×1024, 30 fps.`,
      `Background: SOLID PURE NEON GREEN (#00FF00, chroma-key green / green screen). Completely flat uniform single color filling the ENTIRE 1024×1024 frame including a clean ~15% margin around the subject. No gradients, no patterns, no shadows on the green.`,
      `Subject: ${resource.subject}.`,
      `Style: ${resource.style}.`,
      `Composition: subject perfectly centered with ~15% padding, easily readable as a 32×32 thumbnail. Subject silhouette must NOT touch any frame edge.`,
      `Accent color glow: ${resource.accent}.`,
      `Motion: gentle bob (±3 px vertical), subtle accent-glow pulse on the subject only. NO particle drift through empty green space. Camera fully static. First and last frame identical.`,
      `No audio.`,
      greenscreenNegative,
    ].join(" ");
  }
  return [
    `A stylized 3D game-icon of "${resource.name}", square 1:1, 1024×1024.`,
    `Background: SOLID PURE NEON GREEN (#00FF00, chroma-key green). Completely flat uniform color filling the entire frame with a clean ~15% margin around the subject — no gradient, no pattern, no texture. (Chroma-keyed to transparent in the app.)`,
    `Subject: ${resource.subject}.`,
    `Style: ${resource.style}.`,
    `Composition: subject perfectly centered, readable as a 32×32 thumbnail.`,
    `Accent color glow: ${resource.accent}.`,
    greenscreenNegative,
  ].join(" ");
}

// ═══════════════════════════════════════════════════════════════════════
// CHESTS — Truhen für tägliche Drops
// ═══════════════════════════════════════════════════════════════════════

export type ChestArt = {
  id: string;
  name: string;
  fallbackEmoji: string;
  accent: string;
  subject: string;
  style: string;
  rarity: string;
};

export const CHESTS_ART: ChestArt[] = [
  { id: "silver", name: "Silber-Truhe", fallbackEmoji: "\u{1F948}", accent: "#C0C0D8", rarity: "common",
    subject: "a sturdy oak wooden treasure chest with polished silver iron banding, small silver lock with a glowing keyhole, slightly tilted lid showing a hint of contents inside",
    style: "stylized 3D-render, warm wood grain, cool silver metallic accents, soft cel-shading, gentle inner glow from keyhole, hand-painted feel, classic treasure-chest aesthetic" },
  { id: "gold",   name: "Gold-Truhe",   fallbackEmoji: "\u{1F947}", accent: "#FFD700", rarity: "epic",
    subject: "an ornate treasure chest with rich oak wood and lavish gold-filigree banding, intricate engraved emblem on the front, golden lock with brilliant glow, lid slightly ajar revealing cascading gold coins and a single gem",
    style: "stylized 3D-render, premium loot vibe, polished gold with strong rim-light, magical golden particles drifting upward, painterly highlights, hint of light rays from inside" },
  { id: "event",  name: "Event-Truhe",  fallbackEmoji: "\u{1F381}", accent: "#FF2D78", rarity: "legendary",
    subject: "a limited-event chest with crimson-magenta lacquered wood, iridescent rainbow-prismatic banding that shifts colors, ornate star-shaped clasp glowing with magenta light, swirling event-particles (sparkles, runes) around it",
    style: "stylized 3D-render, ultra-premium event aesthetic, prismatic shifting reflections, swirling magenta-pink particles, dramatic key-light, magical glow halo" },
  { id: "legendary", name: "Legendäre Truhe", fallbackEmoji: "\u{1F451}", accent: "#FFD700", rarity: "legendary",
    subject: "an ancient legendary chest carved from dark obsidian-stained wood with brilliant gold-leaf engravings, massive ornate gold lock with a crown emblem, lid radiating intense divine light, golden runes glowing along the banding, single legendary gem floating above the keyhole",
    style: "stylized 3D-render, godly mythic vibe, brilliant golden volumetric god-rays, swirling divine particles, deep obsidian wood with hot gold rim-light, premium endgame loot aesthetic" },
];

export function buildChestPrompt(input: { chest: ChestArt; mode: "image" | "video" }): string {
  const { chest, mode } = input;
  const greenscreenNegative = `CRITICAL: NO green tones on the chest, wood, banding, gems, lock or glow. Use only the chest's natural colors. The ONLY green is the pure #00FF00 background. No text, no labels, no UI overlays, no watermark, no border frames, no environment.`;
  if (mode === "video") {
    return [
      `Shot: a 3-second seamlessly looping animated game-icon of a "${chest.name}" (${chest.rarity} rarity treasure chest), square 1:1, 1024×1024, 30 fps.`,
      `Background: SOLID PURE NEON GREEN (#00FF00, chroma-key green / green screen). Completely flat uniform color filling the ENTIRE 1024×1024 frame including a clean ~10% margin around the chest. No gradients, no patterns, no shadows on the green.`,
      `Subject: ${chest.subject}.`,
      `Style: ${chest.style}.`,
      `Composition: chest perfectly centered, slight 3/4 front-angle showing lid + front-face. Silhouette must NOT touch any frame edge.`,
      `Lighting: bright key light from upper-left, warm rim-light from upper-right, subtle ${chest.accent} glow from inside the lid crack.`,
      `Motion: gentle bob (±2 px), soft glow pulse from the keyhole, occasional ${chest.accent} particle sparks drifting upward CLOSE to the chest only — NO particles drifting through empty green space. Lid stays closed (ready-to-open state). Camera fully static. First and last frame identical.`,
      `No audio.`,
      greenscreenNegative,
    ].join(" ");
  }
  return [
    `A stylized 3D game-icon of a "${chest.name}" (${chest.rarity} rarity treasure chest), square 1:1, 1024×1024.`,
    `Background: SOLID PURE NEON GREEN (#00FF00, chroma-key green). Completely flat uniform color filling the entire frame with ~10% margin around the chest — no gradient, no pattern. (Chroma-keyed to transparent in the app.)`,
    `Subject: ${chest.subject}.`,
    `Style: ${chest.style}.`,
    `Composition: chest perfectly centered, slight 3/4 front-angle. Silhouette must NOT touch any frame edge.`,
    `Lighting: bright key light from upper-left, warm rim-light from upper-right, subtle ${chest.accent} glow from inside the lid crack.`,
    greenscreenNegative,
  ].join(" ");
}

// ─── INVENTORY-ITEMS catalog ───────────────────────────────────────────
export type InventoryItemArt = {
  id: string;
  category: "speedup" | "boost" | "key" | "elixir" | "token" | "chest";
  name: string;
  fallbackEmoji: string;
  accent: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  subject: string;
};

export const INVENTORY_ITEMS_ART: InventoryItemArt[] = [
  // SPEEDUPS - Bauen
  { id: "speedup_build_1m",   category: "speedup", name: "Bau-Speedup 1 Min",   fallbackEmoji: "⏱", accent: "#9ba8c7", rarity: "common",
    subject: 'a small glowing hourglass with a hammer crest in the foreground, blue-grey common-tier glow, with a LARGE BOLD READABLE white text label "1m" prominently displayed across the lower part of the hourglass' },
  { id: "speedup_build_5m",   category: "speedup", name: "Bau-Speedup 5 Min",   fallbackEmoji: "⏱", accent: "#9ba8c7", rarity: "common",
    subject: 'a small glowing hourglass with a hammer crest, blue-grey common-tier glow, with a LARGE BOLD READABLE white text label "5m" prominently displayed across the lower part of the hourglass' },
  { id: "speedup_build_15m",  category: "speedup", name: "Bau-Speedup 15 Min",  fallbackEmoji: "⏱", accent: "#5ddaf0", rarity: "common",
    subject: 'a polished hourglass with a hammer crest, cyan rare-tier glow, with a LARGE BOLD READABLE white text label "15m" prominently displayed across the lower part of the hourglass' },
  { id: "speedup_build_60m",  category: "speedup", name: "Bau-Speedup 1 Std",   fallbackEmoji: "⏱", accent: "#5ddaf0", rarity: "rare",
    subject: 'ornate hourglass with hammer crest, vivid cyan rare-tier glow, with a LARGE BOLD READABLE white text label "1h" prominently displayed across the lower part of the hourglass' },
  { id: "speedup_build_8h",   category: "speedup", name: "Bau-Speedup 8 Std",   fallbackEmoji: "⏱", accent: "#a855f7", rarity: "epic",
    subject: 'epic ornate hourglass with hammer crest, intense violet epic-tier aura, with a LARGE BOLD READABLE white text label "8h" prominently displayed across the lower part of the hourglass' },
  { id: "speedup_build_12h",  category: "speedup", name: "Bau-Speedup 12 Std",  fallbackEmoji: "⏱", accent: "#a855f7", rarity: "epic",
    subject: 'epic engraved hourglass with hammer crest, swirling violet epic-tier particles, with a LARGE BOLD READABLE white text label "12h" prominently displayed across the lower part of the hourglass' },
  { id: "speedup_build_24h",  category: "speedup", name: "Bau-Speedup 24 Std",  fallbackEmoji: "⏱", accent: "#FFD700", rarity: "legendary",
    subject: 'legendary golden hourglass with hammer crest, brilliant gold legendary-tier beams, with a LARGE BOLD READABLE white text label "24h" prominently displayed across the lower part of the hourglass' },
  // SPEEDUPS - Forschung
  { id: "speedup_research_1m",   category: "speedup", name: "Forschungs-Speedup 1 Min",   fallbackEmoji: "\u{1F52C}", accent: "#9ba8c7", rarity: "common",
    subject: 'a small glowing hourglass with a beaker/atom science crest in the foreground, blue-grey common-tier glow, with a LARGE BOLD READABLE white text label "1m" prominently displayed across the lower part of the hourglass' },
  { id: "speedup_research_5m",   category: "speedup", name: "Forschungs-Speedup 5 Min",   fallbackEmoji: "\u{1F52C}", accent: "#9ba8c7", rarity: "common",
    subject: 'a small glowing hourglass with a beaker/atom science crest, blue-grey common-tier glow, with a LARGE BOLD READABLE white text label "5m" prominently displayed across the lower part of the hourglass' },
  { id: "speedup_research_15m",  category: "speedup", name: "Forschungs-Speedup 15 Min",  fallbackEmoji: "\u{1F52C}", accent: "#5ddaf0", rarity: "common",
    subject: 'a polished hourglass with a beaker/atom science crest, cyan rare-tier glow, with a LARGE BOLD READABLE white text label "15m" prominently displayed across the lower part of the hourglass' },
  { id: "speedup_research_60m",  category: "speedup", name: "Forschungs-Speedup 1 Std",   fallbackEmoji: "\u{1F52C}", accent: "#5ddaf0", rarity: "rare",
    subject: 'ornate hourglass with beaker/atom science crest, vivid cyan rare-tier glow, with a LARGE BOLD READABLE white text label "1h" prominently displayed across the lower part of the hourglass' },
  { id: "speedup_research_8h",   category: "speedup", name: "Forschungs-Speedup 8 Std",   fallbackEmoji: "\u{1F52C}", accent: "#a855f7", rarity: "epic",
    subject: 'epic ornate hourglass with beaker/atom crest, intense violet epic-tier aura, with a LARGE BOLD READABLE white text label "8h" prominently displayed across the lower part of the hourglass' },
  { id: "speedup_research_12h",  category: "speedup", name: "Forschungs-Speedup 12 Std",  fallbackEmoji: "\u{1F52C}", accent: "#a855f7", rarity: "epic",
    subject: 'epic engraved hourglass with beaker/atom crest, swirling violet epic-tier particles, with a LARGE BOLD READABLE white text label "12h" prominently displayed across the lower part of the hourglass' },
  { id: "speedup_research_24h",  category: "speedup", name: "Forschungs-Speedup 24 Std",  fallbackEmoji: "\u{1F52C}", accent: "#FFD700", rarity: "legendary",
    subject: 'legendary golden hourglass with beaker/atom crest, brilliant gold legendary-tier beams, with a LARGE BOLD READABLE white text label "24h" prominently displayed across the lower part of the hourglass' },
  // SPEEDUPS - Universal
  { id: "speedup_uni_1m",   category: "speedup", name: "Universal-Speedup 1 Min",  fallbackEmoji: "⚡", accent: "#5ddaf0", rarity: "rare",
    subject: 'a small glowing hourglass with a universal infinity-loop crest in the foreground, cyan rare-tier glow, with a LARGE BOLD READABLE white text label "1m" prominently displayed across the lower part of the hourglass' },
  { id: "speedup_uni_5m",   category: "speedup", name: "Universal-Speedup 5 Min",  fallbackEmoji: "⚡", accent: "#5ddaf0", rarity: "rare",
    subject: 'a small glowing hourglass with infinity-loop crest, cyan rare-tier glow, with a LARGE BOLD READABLE white text label "5m" prominently displayed across the lower part of the hourglass' },
  { id: "speedup_uni_15m",  category: "speedup", name: "Universal-Speedup 15 Min", fallbackEmoji: "⚡", accent: "#a855f7", rarity: "epic",
    subject: 'polished hourglass with infinity-loop crest, violet epic-tier glow, with a LARGE BOLD READABLE white text label "15m" prominently displayed across the lower part of the hourglass' },
  { id: "speedup_uni_60m",  category: "speedup", name: "Universal-Speedup 1 Std",  fallbackEmoji: "⚡", accent: "#a855f7", rarity: "epic",
    subject: 'ornate hourglass with infinity-loop crest, intense violet epic-tier glow, with a LARGE BOLD READABLE white text label "1h" prominently displayed across the lower part of the hourglass' },
  { id: "speedup_uni_8h",   category: "speedup", name: "Universal-Speedup 8 Std",  fallbackEmoji: "⚡", accent: "#a855f7", rarity: "epic",
    subject: 'epic ornate hourglass with infinity-loop crest, intense violet epic-tier aura, with a LARGE BOLD READABLE white text label "8h" prominently displayed across the lower part of the hourglass' },
  { id: "speedup_uni_12h",  category: "speedup", name: "Universal-Speedup 12 Std", fallbackEmoji: "⚡", accent: "#FFD700", rarity: "legendary",
    subject: 'legendary engraved hourglass with infinity-loop crest, brilliant gold legendary-tier particles, with a LARGE BOLD READABLE white text label "12h" prominently displayed across the lower part of the hourglass' },
  { id: "speedup_uni_24h",  category: "speedup", name: "Universal-Speedup 24 Std", fallbackEmoji: "⚡", accent: "#FFD700", rarity: "legendary",
    subject: 'legendary golden hourglass with infinity-loop crest, brilliant gold legendary-tier beams, with a LARGE BOLD READABLE white text label "24h" prominently displayed across the lower part of the hourglass' },
  // SPEEDUPS - Heilung
  { id: "speedup_heal_1m",   category: "speedup", name: "Heilungs-Speedup 1 Min",   fallbackEmoji: "❤", accent: "#4ade80", rarity: "common",
    subject: 'a small glowing hourglass with a red heart-cross medical crest in the foreground, soft green-white healing common-tier glow, with a LARGE BOLD READABLE white text label "1m" prominently displayed across the lower part of the hourglass' },
  { id: "speedup_heal_5m",   category: "speedup", name: "Heilungs-Speedup 5 Min",   fallbackEmoji: "❤", accent: "#4ade80", rarity: "common",
    subject: 'a small glowing hourglass with a red heart-cross medical crest, soft green-white healing common-tier glow, with a LARGE BOLD READABLE white text label "5m" prominently displayed across the lower part of the hourglass' },
  { id: "speedup_heal_15m",  category: "speedup", name: "Heilungs-Speedup 15 Min",  fallbackEmoji: "❤", accent: "#4ade80", rarity: "common",
    subject: 'a polished hourglass with a red heart-cross medical crest, vibrant green healing common-tier glow, with a LARGE BOLD READABLE white text label "15m" prominently displayed across the lower part of the hourglass' },
  { id: "speedup_heal_60m",  category: "speedup", name: "Heilungs-Speedup 1 Std",   fallbackEmoji: "❤", accent: "#4ade80", rarity: "rare",
    subject: 'ornate hourglass with red heart-cross medical crest, vivid green rare-tier healing glow, with a LARGE BOLD READABLE white text label "1h" prominently displayed across the lower part of the hourglass' },
  { id: "speedup_heal_8h",   category: "speedup", name: "Heilungs-Speedup 8 Std",   fallbackEmoji: "❤", accent: "#4ade80", rarity: "epic",
    subject: 'epic ornate hourglass with red heart-cross medical crest, intense violet-and-green epic-tier aura, with a LARGE BOLD READABLE white text label "8h" prominently displayed across the lower part of the hourglass' },
  { id: "speedup_heal_12h",  category: "speedup", name: "Heilungs-Speedup 12 Std",  fallbackEmoji: "❤", accent: "#4ade80", rarity: "epic",
    subject: 'epic engraved hourglass with red heart-cross medical crest, swirling violet-and-green epic-tier particles, with a LARGE BOLD READABLE white text label "12h" prominently displayed across the lower part of the hourglass' },
  { id: "speedup_heal_24h",  category: "speedup", name: "Heilungs-Speedup 24 Std",  fallbackEmoji: "❤", accent: "#FFD700", rarity: "legendary",
    subject: 'legendary golden hourglass with red heart-cross medical crest, brilliant gold legendary-tier beams with green healing aura, with a LARGE BOLD READABLE white text label "24h" prominently displayed across the lower part of the hourglass' },
  // BOOSTS
  { id: "boost_shield_2k",   category: "boost", name: "Schild 2.000",  fallbackEmoji: "\u{1F6E1}", accent: "#5ddaf0", rarity: "rare",
    subject: "a glowing cyan crystal shield with a small 2K rune, energy barrier swirling around it" },
  { id: "boost_shield_10k",  category: "boost", name: "Schild 10.000", fallbackEmoji: "\u{1F6E1}", accent: "#5ddaf0", rarity: "epic",
    subject: "a large ornate cyan crystal shield with bright 10K rune, intense energy barrier, magical force-field aura" },
  { id: "boost_shield_8h",   category: "boost", name: "Schild-Buff 8 Std",  fallbackEmoji: "\u{1F6E1}", accent: "#5ddaf0", rarity: "rare",
    subject: "a glowing cyan tower-shield charm with 8h time glyph, protective aura" },
  { id: "boost_shield_24h",  category: "boost", name: "Schild-Buff 24 Std", fallbackEmoji: "\u{1F6E1}", accent: "#5ddaf0", rarity: "epic",
    subject: "an ornate cyan tower-shield charm with 24h time glyph, intense protective aura" },
  { id: "boost_gather_8h",   category: "boost", name: "Sammel-Buff 8 Std",  fallbackEmoji: "\u{1F4E6}", accent: "#FFD700", rarity: "rare",
    subject: "a stylized loot basket charm with golden glow and 8h time glyph, gather-bonus aura" },
  { id: "boost_gather_24h",  category: "boost", name: "Sammel-Buff 24 Std", fallbackEmoji: "\u{1F4E6}", accent: "#FFD700", rarity: "epic",
    subject: "an ornate gold loot-basket charm with 24h time glyph, brilliant gather aura" },
  { id: "boost_gold_8h",     category: "boost", name: "Krypto-Buff 8 Std",   fallbackEmoji: "\u{1F4B0}", accent: "#FFD700", rarity: "rare",
    subject: "a glowing gold-coin stack charm with 8h time glyph, golden sparkle aura" },
  { id: "boost_gold_24h",    category: "boost", name: "Krypto-Buff 24 Std",  fallbackEmoji: "\u{1F4B0}", accent: "#FFD700", rarity: "epic",
    subject: "an ornate gold-coin pile charm with 24h time glyph, brilliant gold aura" },
  { id: "boost_wood_8h",     category: "boost", name: "Tech-Schrott-Buff 8 Std",   fallbackEmoji: "\u{1FAB5}", accent: "#a07a3c", rarity: "rare",
    subject: "a stack of glowing wood logs charm with 8h time glyph, warm forest aura" },
  { id: "boost_wood_24h",    category: "boost", name: "Tech-Schrott-Buff 24 Std",  fallbackEmoji: "\u{1FAB5}", accent: "#a07a3c", rarity: "epic",
    subject: "an ornate wood-stack charm with 24h time glyph, intense warm forest aura" },
  { id: "boost_stone_8h",    category: "boost", name: "Komponenten-Buff 8 Std",  fallbackEmoji: "\u{1FAA8}", accent: "#9ba8c7", rarity: "rare",
    subject: "a glowing stone-pile charm with 8h time glyph, cool grey aura" },
  { id: "boost_stone_24h",   category: "boost", name: "Komponenten-Buff 24 Std", fallbackEmoji: "\u{1FAA8}", accent: "#9ba8c7", rarity: "epic",
    subject: "an ornate stone-pile charm with 24h time glyph, deep grey aura" },
  { id: "boost_mana_8h",     category: "boost", name: "Bandbreite-Buff 8 Std",   fallbackEmoji: "\u{1F48E}", accent: "#a855f7", rarity: "rare",
    subject: "a glowing violet mana-crystal charm with 8h time glyph, swirling magic aura" },
  { id: "boost_mana_24h",    category: "boost", name: "Bandbreite-Buff 24 Std",  fallbackEmoji: "\u{1F48E}", accent: "#a855f7", rarity: "epic",
    subject: "an ornate violet mana-crystal charm with 24h time glyph, brilliant magic aura" },
  { id: "boost_xp_8h",       category: "boost", name: "EP-Buff 8 Std",    fallbackEmoji: "\u{1F4DA}", accent: "#FF2D78", rarity: "rare",
    subject: "a glowing pink star-medal charm with 8h time glyph, XP-burst aura" },
  { id: "boost_xp_24h",      category: "boost", name: "EP-Buff 24 Std",   fallbackEmoji: "\u{1F4DA}", accent: "#FF2D78", rarity: "epic",
    subject: "an ornate pink star-medal charm with 24h time glyph, brilliant XP aura" },
  // KEYS
  { id: "key_silver", category: "key", name: "Silberner Schlüssel", fallbackEmoji: "\u{1F5DD}", accent: "#C0C0D8", rarity: "rare",
    subject: "an ornate medieval silver skeleton-key with intricate filigree bow, polished silver, soft cool glow, slight ring-loop" },
  { id: "key_gold",   category: "key", name: "Goldener Schlüssel",  fallbackEmoji: "\u{1F5DD}", accent: "#FFD700", rarity: "epic",
    subject: "an ornate medieval gold skeleton-key with intricate dragon-shaped bow, polished brilliant gold, warm radiant glow, gem-inset ring-loop" },
  // ELIXIRS
  { id: "elixir_5k",  category: "elixir", name: "Wächter-Elixier (5.000 XP)",  fallbackEmoji: "\u{1F9EA}", accent: "#a855f7", rarity: "rare",
    subject: "a tall ornate glass elixir bottle with swirling violet liquid and golden bubble caps, a small XP-rune label, magical violet glow" },
  { id: "elixir_20k", category: "elixir", name: "Wächter-Elixier (20.000 XP)", fallbackEmoji: "\u{1F9EA}", accent: "#FFD700", rarity: "epic",
    subject: "a regal large ornate glass elixir bottle with swirling gold liquid and prismatic cap, brilliant XP-burst rune label, intense golden god-light" },
  // TOKENS
  { id: "token_relocate", category: "token", name: "Umsiedlungs-Token", fallbackEmoji: "\u{1F3AB}", accent: "#5ddaf0", rarity: "rare",
    subject: "an ornate hexagonal coin-medallion with a stylized map-pin + arrow emblem, polished cyan-silver finish, soft teleport glow" },
  { id: "token_rename",   category: "token", name: "Namens-Token",      fallbackEmoji: "\u{1F3AB}", accent: "#FF2D78", rarity: "rare",
    subject: "an ornate hexagonal coin-medallion with a stylized name-tag + quill emblem, polished pink-silver finish, soft magenta glow" },
  { id: "token_fastvip",  category: "token", name: "Premium-Ticket",     fallbackEmoji: "\u{1F3AB}", accent: "#FFD700", rarity: "epic",
    subject: "an ornate hexagonal coin-medallion with a stylized crown + VIP star emblem, polished brilliant gold finish, dramatic golden god-rays" },
  // RES PACKS
  { id: "res_pack_normal", category: "chest", name: "Normales Ressourcen-Paket", fallbackEmoji: "\u{1F4E6}", accent: "#9ba8c7", rarity: "rare",
    subject: "a sturdy iron-banded wooden crate with a glowing blue question-mark sigil on the lid, hint of mixed loot peeking out (a coin, a gear, a circuit-chip, a wifi-bar shape), neutral grey-blue glow indicating random contents" },
  { id: "res_chest_choice_t1", category: "chest", name: "Auswahl-Ressourcen-Truhe (Stufe 1)", fallbackEmoji: "\u{1F381}", accent: "#5ddaf0", rarity: "rare",
    subject: "a polished iron-banded oak chest with four equal-size resource emblems on its facade (gold coin / gear / chip / wifi-bar) in a 2x2 grid, soft cyan glow from the inside, lid slightly ajar showing a player's choice prompt" },
  { id: "res_chest_choice_t2", category: "chest", name: "Auswahl-Ressourcen-Truhe (Stufe 2)", fallbackEmoji: "\u{1F381}", accent: "#a855f7", rarity: "epic",
    subject: "an ornate violet-banded chest with four glowing resource emblems (gold coin / gear / chip / wifi-bar) inset as gem-cabochons on the facade, lid slightly ajar with brilliant violet inner light, magical floating particles" },
  { id: "res_chest_choice_t3", category: "chest", name: "Auswahl-Ressourcen-Truhe (Stufe 3)", fallbackEmoji: "\u{1F381}", accent: "#FFD700", rarity: "legendary",
    subject: "a regal gold-filigree chest with four large faceted gemstone emblems on the facade representing each resource (golden coin, polished gear, glowing chip, wifi-bar antenna), lid radiating intense god-light, crown motif above the lock" },
];

export function buildInventoryItemPrompt(input: { item: InventoryItemArt; mode: "image" | "video" }): string {
  const { item, mode } = input;
  const allowsText = item.category === "speedup";
  const textRule = allowsText
    ? `Text rule: ONE bold readable white duration label is REQUIRED on the hourglass (exactly the language-neutral duration named in the subject, e.g. "5m" or "8h"). Use a clean condensed sans-serif. No other text, no watermarks, no UI overlays.`
    : `No text, no labels (except symbolic glyphs/runes), no UI overlays, no watermark, no border frames, no environment.`;
  const greenscreenNegative = `CRITICAL: NO green tones on the subject. Use only the listed colors. The ONLY green is the pure #00FF00 background. ${textRule}`;
  if (mode === "video") {
    return [
      `Shot: a 3-second seamlessly looping animated game-icon "${item.name}" (${item.rarity} ${item.category} item), square 1:1, 1024×1024, 30 fps.`,
      `Background: SOLID PURE NEON GREEN (#00FF00, chroma-key green / green screen). Completely flat uniform color filling the ENTIRE 1024×1024 frame including a clean ~12% margin around the subject. No gradients, no patterns, no shadows on the green.`,
      `Subject: ${item.subject}.`,
      `Style: stylized 3D game-icon, premium fantasy / urban-cyber loot vibe, painterly highlights, sharp readable silhouette at small inventory sizes (~64px).`,
      `Composition: subject perfectly centered, slight 3/4 angle, occupies ~70% of frame. Silhouette must NOT touch any frame edge.`,
      `Lighting: bright key light upper-left, ${item.accent} rim-light upper-right, subtle ${item.accent} inner glow.`,
      `Motion: gentle bob (±2 px), soft glow pulse (${item.accent}), ${item.accent} sparkle particles drifting upward CLOSE to the subject only — NO particles drifting through empty green space. Camera fully static. First and last frame identical.`,
      `No audio.`,
      greenscreenNegative,
    ].join(" ");
  }
  return [
    `A stylized 3D game-icon of "${item.name}" (${item.rarity} ${item.category} item), square 1:1, 1024×1024.`,
    `Background: SOLID PURE NEON GREEN (#00FF00, chroma-key green). Completely flat uniform color filling the entire frame with ~12% margin around the subject — no gradient, no pattern.`,
    `Subject: ${item.subject}.`,
    `Style: stylized 3D game-icon, premium fantasy / urban-cyber loot vibe, painterly highlights, sharp readable silhouette at small inventory sizes (~64px).`,
    `Composition: subject perfectly centered, slight 3/4 angle. Silhouette must NOT touch any frame edge.`,
    `Lighting: bright key light upper-left, ${item.accent} rim-light upper-right, subtle ${item.accent} inner glow from the central feature.`,
    greenscreenNegative,
  ].join(" ");
}

// ─── LOOT-DROP catalog ──────────
export const LOOT_DROPS_ART = [
  { id: "common",    name: "Gewöhnlich", rarity: "common"    as const, hint: "small leather pouch / worn satchel" },
  { id: "rare",      name: "Selten",     rarity: "rare"      as const, hint: "polished iron-banded chest" },
  { id: "epic",      name: "Episch",     rarity: "epic"      as const, hint: "ornate enchanted container with violet runes" },
  { id: "legendary", name: "Legendär",   rarity: "legendary" as const, hint: "godly artifact with golden particle storm" },
] as const;

export function buildLootDropPrompt(input: {
  id: string;
  name: string;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  hint: string;
  mode: "image" | "video";
}): string {
  const rarityColor = {
    common:    "#9aa3b8",
    uncommon:  "#4ade80",
    rare:      "#22D1C3",
    epic:      "#a855f7",
    legendary: "#FFD700",
  }[input.rarity];
  const rarityVibe = {
    common:    "simple worn leather, minimal effect",
    uncommon:  "modest wood with green glow seams",
    rare:      "polished iron-banded chest with cyan energy",
    epic:      "ornate enchanted container with violet runes and floating sigils",
    legendary: "godly artifact with golden particle storm and divine aura",
  }[input.rarity];

  if (input.mode === "video") {
    return [
      `Shot: a 3-second seamlessly looping animated map loot-drop for "MyArea365", square 1024×1024, 30 fps.`,
      GREEN_BG_RULE,
      `Subject: a ${input.hint} loot drop, named "${input.name}" — ${rarityVibe}. Tier color accent: ${rarityColor}. Avoid pure-green tones in the subject.`,
      `Composition: subject centered, occupying ~70% of the frame on the green background, slight 3/4 top-down camera angle so it reads as a 3D pickup.`,
      `Motion: gentle bob up/down + subtle rotation + tier sparkles/glow pulse. Loops seamlessly.`,
      `Style: stylized cartoon-realism game asset, vivid saturation, sharp readable silhouette at small map-marker sizes (~50px). Tier-glow halo against the green background.`,
      `Negative: no scenery, no map tiles, no characters, no text, no UI, no watermarks.`,
    ].join(" ");
  }
  return [
    `A premium game-ready map loot-drop asset "${input.name}" for "MyArea365", square 1024×1024 PNG.`,
    GREEN_BG_RULE,
    `Subject: a ${input.hint} loot drop — ${rarityVibe}. Tier color accent: ${rarityColor}. Avoid pure-green in the subject.`,
    `Composition: centered, ~70% of frame, slight 3/4 top-down camera angle.`,
    `Style: stylized cartoon-realism, vivid saturation, sharp silhouette at small marker sizes (~50px). Tier-glow halo.`,
    `Negative: no scenery, no map, no characters, no text, no UI, no watermark.`,
  ].join(" ");
}

// ─── RESOURCE-NODE ────────────────────────────────
export const RESOURCE_NODES_ART = [
  { id: "scrapyard",  name: "Schrottplatz",     hint: "scrap-metal yard with broken machines, twisted rebar, rusted hulks", color: "#6b7280", glow: "#9ca3af" },
  { id: "factory",    name: "Fabrik",           hint: "abandoned industrial factory with smokestacks, gears, cogs",          color: "#f59e0b", glow: "#fbbf24" },
  { id: "atm",        name: "Krypto-ATM",       hint: "neon crypto ATM with holographic coin spilling out",                  color: "#FFD700", glow: "#FFAC33" },
  { id: "datacenter", name: "Datacenter",       hint: "datacenter rack with cyan fiber-optic cables, blinking server LEDs",  color: "#22D1C3", glow: "#5ddaf0" },
] as const;
export type ResourceNodeId = (typeof RESOURCE_NODES_ART)[number]["id"];

export function buildResourceNodePrompt(input: { id: ResourceNodeId; mode: "image" | "video" }): string {
  const n = RESOURCE_NODES_ART.find((x) => x.id === input.id);
  if (!n) return "";
  if (input.mode === "video") {
    return [
      `Shot: a 3-second seamlessly looping animated map node icon for "MyArea365" (works for urban + rural settings), square 512x512, 30 fps.`,
      GREEN_BG_RULE,
      `Subject: a "${n.name}" plunder spot — ${n.hint}. Stylized cartoon-realism, vivid saturation. Avoid pure-green tones in the subject.`,
      `Composition: subject centered, ~75% of frame on green background, slight 3/4 top-down camera angle.`,
      `Color palette: primary ${n.color}, glow accent ${n.glow}. Subtle accent glow.`,
      `Motion: subtle ambient animation (smoke/sparks/blinking lights/gear rotation). Object stays in place.`,
      `Style: sharp readable silhouette at small map-marker sizes (~32px), accent halo against the green background.`,
      `Looping: final frame matches first frame for seamless loop.`,
      `Negative: no characters, no text, no UI, no scenery.`,
    ].join(" ");
  }
  return [
    `A premium game-ready map resource-node icon "${n.name}" for "MyArea365", square 512x512 PNG.`,
    GREEN_BG_RULE,
    `Subject: ${n.hint}. Stylized cartoon-realism, vivid saturation. Avoid pure-green in the subject.`,
    `Composition: centered, ~75% of frame, slight 3/4 top-down camera angle.`,
    `Color palette: primary ${n.color} with ${n.glow} glow accents.`,
    `Style: sharp silhouette at ~32px, accent halo.`,
    `Negative: no characters, no scenery, no text, no UI.`,
  ].join(" ");
}

export const SIEGEL_TYPES = [
  { id: 'infantry', name: 'Infanterie-Siegel', hint: 'crossed swords / batons + shield', color: '#60a5fa', accent: 'steel blue', theme: 'heavy protective gear, frontline defender — works as classic armored soldier OR modern riot-trooper' },
  { id: 'cavalry',  name: 'Kavallerie-Siegel', hint: 'rearing horse / motorbike, lance / spear', color: '#FF6B4A', accent: 'amber orange', theme: 'charging mounted unit, fast assault — works as classic horseman OR modern biker-crew' },
  { id: 'marksman', name: 'Schützen-Siegel',   hint: 'crossed arrows / bullets, bow / rifle', color: '#4ade80', accent: 'forest green', theme: 'precise long-range fighter — works as classic archer OR modern sniper' },
  { id: 'mage',     name: 'Magier-Siegel',     hint: 'arcane rune / glyph, wand / staff',   color: '#a855f7', accent: 'arcane purple', theme: 'spellcraft and ritual — fits both old-folklore witches AND modern hacker-mystics' },
  { id: 'universal',name: 'Universal-Siegel',  hint: 'diamond, all-seal',   color: '#FFD700', accent: 'royal gold',    theme: 'legendary wildcard seal, ouroboros, cosmic emblem — universal crew-mark' },
] as const;
export type SiegelId = (typeof SIEGEL_TYPES)[number]['id'];

export function buildSiegelPrompt(input: { id: SiegelId; name: string; mode: 'image' | 'video' }): string {
  const s = SIEGEL_TYPES.find((x) => x.id === input.id);
  if (!s) return '';
  const base = [
    `A heraldic ${s.name.toLowerCase()} emblem / crew-medallion, centered composition on a circular medallion, 1024×1024, fully transparent background (PNG with alpha).`,
    `Iconography: ${s.hint}. Theme: ${s.theme}.`,
    `Color palette: dominant ${s.accent} (${s.color}) with dark bronze/black metallic rim, subtle gold filigree, faint engraved markings on the border.`,
    `Style: high-detail painterly coat-of-arms / crew-emblem, embossed metal, wax-seal texture, weathered edges, dramatic rim-light, game-icon quality. Works equally as a classic-heraldic seal OR a modern crew-medallion.`,
    `Square/circular composition — icon must read clearly at 40px size.`,
    `No text, no characters, no watermark, no background outside the medallion.`,
  ].join(' ');
  if (input.mode === 'video') {
    return [
      base,
      'Animation: gentle 4-second loop. The emblem pulses with soft inner glow, faint arcane runes cycle around the rim, metallic sheen sweeps across the surface once per cycle.',
      'First and last frame must match exactly for a seamless loop. No audio.',
    ].join(' ');
  }
  return base;
}

// ─── Tränke (Potions) ──────────────────────────────────────────────
export const POTION_CATALOG_ART = [
  { id: "potion_hp_s",          name: "Kleiner HP-Trank",          rarity: "common", emoji: "\u{1F9EA}", hint: "small crimson healing vial, ruby-red liquid, bubbles" },
  { id: "potion_atk_s",         name: "Kleiner Angriffstrank",     rarity: "common", emoji: "⚔️", hint: "small orange attack elixir, amber liquid, sword etched on bottle" },
  { id: "potion_def_s",         name: "Kleiner Verteidigungstrank",rarity: "common", emoji: "\u{1F6E1}️", hint: "small blue defense potion, steel-blue liquid, shield rune" },
  { id: "potion_speed_s",       name: "Kleiner Geschwindigkeitstrank", rarity: "common", emoji: "\u{1F4A8}", hint: "small sky-blue speed elixir, swirling vapors, feather motif" },
  { id: "potion_regen_s",       name: "Kleiner Heiltrank",         rarity: "common", emoji: "\u{1F49A}", hint: "small emerald regeneration flask, soft glow, leaf motif" },
  { id: "potion_hp_m",          name: "HP-Trank",                  rarity: "rare",   emoji: "\u{1F9EA}", hint: "medium deep-crimson vial with gold cap, thick glowing liquid" },
  { id: "potion_atk_m",         name: "Angriffstrank",             rarity: "rare",   emoji: "⚔️", hint: "medium orange bottle, crossed swords emblem" },
  { id: "potion_def_m",         name: "Verteidigungstrank",        rarity: "rare",   emoji: "\u{1F6E1}️", hint: "medium sapphire bottle, tower shield emblem" },
  { id: "potion_crit_m",        name: "Krit-Trank",                rarity: "rare",   emoji: "\u{1F4A5}", hint: "sharp magenta vial, lightning rune, sparks" },
  { id: "potion_lifesteal_m",   name: "Bluttrank",                 rarity: "rare",   emoji: "\u{1FA78}", hint: "dark crimson bottle with gothic filigree engravings, deep ruby liquid, ornate stopper" },
  { id: "potion_mana_m",        name: "Bandbreite-Trank",          rarity: "rare",   emoji: "⚡", hint: "electric blue flask, arcing bolts inside" },
  { id: "potion_hp_l",          name: "Großer HP-Trank",           rarity: "epic",   emoji: "\u{1F9EA}", hint: "large ornate ruby-red flask, gold trim, glowing runes on bottle" },
  { id: "potion_atk_l",         name: "Großer Angriffstrank",      rarity: "epic",   emoji: "⚔️", hint: "large fiery-orange flask, jagged spikes on bottle" },
  { id: "potion_thorns_l",      name: "Dornentrank",               rarity: "epic",   emoji: "\u{1F335}", hint: "dark green vial wrapped in thorny vines, spikes" },
  { id: "potion_penetration_l", name: "Durchdringungstrank",       rarity: "epic",   emoji: "\u{1F3AF}", hint: "black arrow-shaped flask, target reticle" },
  { id: "potion_regen_l",       name: "Großer Heiltrank",          rarity: "epic",   emoji: "\u{1F49A}", hint: "large glowing emerald flask, swirling life-energy" },
] as const;

export function buildPotionPrompt(input: { id: string; name: string; rarity: string; hint: string; mode: "image" | "video" }): string {
  const rarityColors: Record<string, string> = {
    common: "matte glass, steel cap",
    rare:   "polished glass with copper accents",
    epic:   "ornate crystal glass with runed gold filigree",
  };
  const rarityGlow: Record<string, string> = {
    common: "soft inner glow",
    rare:   "bright inner glow with faint aura",
    epic:   "intense inner glow with visible arcane runes radiating outward",
  };
  const base = [
    `A potion / elixir / vial icon for "${input.name}", centered composition, 1024×1024, fully transparent background (PNG with alpha).`,
    `Bottle specifics: ${input.hint}. Material: ${rarityColors[input.rarity] ?? rarityColors.common}. Lighting: ${rarityGlow[input.rarity] ?? rarityGlow.common}.`,
    `Style: high-detail painterly game icon (Diablo IV / The Witcher / Lost Ark inventory quality — works equally as a traditional alchemy vial or a modern lab vial), dramatic rim-light, readable at 64px.`,
    `Composition: bottle slightly tilted, centered, subtle shadow beneath.`,
    `No text, no labels, no characters, no watermark, no background — pure PNG with alpha.`,
  ].join(" ");
  if (input.mode === "video") {
    return [
      base,
      "Animation: gentle 4-second loop. Liquid inside sloshes slowly, bubbles rise, inner glow pulses once per cycle, aura flickers subtly.",
      "First and last frame match exactly for seamless loop. No audio.",
    ].join(" ");
  }
  return base;
}

// ─── Ränge (Runner-Ranks) ──────────────────────────────────────────
export const RANK_TIERS_ART = [
  { id: "rank_1",  name: "Straßen-Scout",       tier: "bronze",   color: "#888888", hint: "simple cobblestone compass, street-corner vibe" },
  { id: "rank_2",  name: "Kiez-Wanderer",       tier: "bronze",   color: "#b0b8c8", hint: "walking stick + lantern, neighborhood explorer" },
  { id: "rank_3",  name: "Block-Kundschafter",  tier: "silver",   color: "#5ddaf0", hint: "binoculars + city-block map fragment" },
  { id: "rank_4",  name: "Stadt-Pionier",       tier: "silver",   color: "#22D1C3", hint: "explorer flag planted on skyline silhouette" },
  { id: "rank_5",  name: "Bezirks-Entdecker",   tier: "gold",     color: "#3b82f6", hint: "laurel wreath framing a district compass" },
  { id: "rank_6",  name: "Viertel-Boss",        tier: "gold",     color: "#FF6B4A", hint: "crown resting on concrete plinth, urban throne" },
  { id: "rank_7",  name: "Kiez-König",          tier: "platinum", color: "#FF2D78", hint: "royal crown with city skyline silhouette, neon pink" },
  { id: "rank_8",  name: "Metropolen-Legende",  tier: "platinum", color: "#FFD700", hint: "golden laurel wreath around glowing metropolis emblem" },
  { id: "rank_9",  name: "Urbaner Mythos",      tier: "mythic",   color: "#e0e7ff", hint: "ethereal halo, mystical runes, city constellation" },
  { id: "rank_10", name: "Straßen-Gott",        tier: "mythic",   color: "#FFFFFF", hint: "divine radiant emblem, cosmic streets spiraling outward" },
] as const;

export function buildRankPrompt(input: { id: string; name: string; tier: string; color: string; hint: string; mode: "image" | "video" }): string {
  const tierTreatment: Record<string, string> = {
    bronze:   "weathered bronze medal, aged patina, simple rim",
    silver:   "polished silver medal, clean rim, subtle etching",
    gold:     "gleaming gold medal, ornate rim, laurel trim",
    platinum: "brilliant platinum medal, jeweled inlay, intricate filigree",
    mythic:   "otherworldly prismatic medal, floating arcane runes, divine radiance",
  };
  const base = [
    `A rank insignia badge for runner rank "${input.name}", centered circular medallion composition, 1024×1024, fully transparent background (PNG with alpha).`,
    `Treatment: ${tierTreatment[input.tier] ?? tierTreatment.bronze}. Dominant accent color: ${input.color}.`,
    `Iconography inside medallion: ${input.hint}.`,
    `Style: hero-worthy game UI badge, heraldic + urban-fantasy fusion, readable at 80px, sharp focal motif, subtle rim-light.`,
    `No text, no letters, no characters, no watermark, no background outside the medallion.`,
  ].join(" ");
  if (input.mode === "video") {
    return [
      base,
      `Animation: 4-second loop. The medallion slowly rotates a few degrees back and forth, inner motif pulses with ${input.color} glow, subtle sparkle sweeps across the surface once per cycle.`,
      "First and last frame match exactly for seamless loop. No audio.",
    ].join(" ");
  }
  return base;
}

// ─── Materials (Crafting/Upgrade) ──────────────────────────────────
const MATERIAL_TIER_TREATMENT: Record<number, string> = {
  0: "rusted scrap metal pieces, dirty bolts, weathered industrial debris, gritty dark tones, low-value salvage feel",
  1: "polished urban crystal shard, faceted geometric form, soft cyan glow inside, semi-translucent, modern utilitarian beauty",
  2: "swirling shadow essence in a small glass vial or floating orb, deep purple and pink mist coiling inside, ethereal mystical aura",
  3: "ornate golden relic shard with engraved arcane runes, fractured ancient artifact piece, intense radiant gold + pink magenta light, legendary feel",
};

export function buildMaterialPrompt(input: {
  id: string;
  name: string;
  tier: number;
  hint: string;
  mode: "image" | "video";
}): string {
  const treatment = MATERIAL_TIER_TREATMENT[input.tier] ?? MATERIAL_TIER_TREATMENT[0];
  const base = [
    `A crafting material item icon for "${input.name}" (tier ${input.tier} of 3), centered composition, 1024×1024, fully transparent background (PNG with alpha).`,
    `Material specifics: ${input.hint}.`,
    `Treatment: ${treatment}.`,
    `Style: high-detail painterly game item icon (Diablo IV / The Witcher / Lost Ark inventory quality — works for crafting materials in either modern or traditional settings), tight rim-light, readable at 64px in an inventory slot.`,
    `Composition: item slightly tilted toward the viewer, centered, subtle drop shadow beneath. Item fills roughly 70 % of frame width, leaves clean margin around it.`,
    `No text, no labels, no characters, no watermark, no environment, no scene — just the item on pure transparent background.`,
  ].join(" ");
  if (input.mode === "video") {
    return [
      base,
      "Animation: 4-second seamless loop. The material drifts up and down by a few pixels (gentle floating), rotates a few degrees back and forth, inner glow pulses once per cycle, occasional sparkle particle drifts off the surface.",
      "First and last frame match exactly. No audio.",
    ].join(" ");
  }
  return base;
}

// ─── UI-Icons ──────────
export type UiIconSlotInput = {
  id: string;
  category: string;
  name: string;
  description: string;
  fallback_emoji: string;
};

export function buildUiIconPrompt(input: { slot: UiIconSlotInput; mode: "image" | "video" }): string {
  const s = input.slot;

  const SUBJECT: Record<string, string> = {
    stat_troops:    "crossed sword and shield silhouette emblem, troop count icon, militant",
    stat_attack:    "single longsword diagonal with red glow, sharp blade, attack icon",
    stat_defense:   "tower shield emblem with steel rim, glowing crest center, defense icon",
    stat_hp:        "stylized heart icon, crimson red, soft inner glow, life points",
    stat_power:     "clenched fist emblem with radiating rays, power/strength icon, golden",
    class_infantry:  "burly bouncer silhouette with crossed arms, suit jacket, broad shoulders, club bouncer icon",
    class_cavalry:   "motorbike courier helmet with visor, side view, urban delivery rider icon, sleek",
    class_marksman:  "modern sniper rifle with mounted scope, side view silhouette, precision marksman icon, sharp metallic",
    class_siege:     "sledgehammer crossed with crowbar, demolition icon, heavy and rough",
    class_mage:      "small quadcopter drone with glowing teal #22D1C3 underbelly light and 4 spinning rotors, casting a magical AoE blast pulse, top-down 3/4 angle, drone-caster mage icon",
    class_collector: "tipped urban gathering cart loaded with scrap and crates, single bold silhouette, magenta #FF2D78 accent, salvager collector icon",
    faction_gossenbund:  "stylized broken chain-link emblem with orange #FF6B4A graffiti drips, rough underground gang crest, slum tunnel-faction icon, gritty street-style",
    faction_kronenwacht: "polished police-style 5-point shield badge with gold #FFD700 rim and central star, modern city-watch crest, no crown, modern law-enforcement faction icon",
    faction_netzhueter:  "stylized circuit-board pattern forming a hooded hacker silhouette, teal #22D1C3 glowing data-lines, modern hacker-crew faction emblem, no fantasy, no sci-fi",
    playstyle_architect:  "modern construction crane silhouette with golden #FFD700 hard-hat at top, blueprint-grid faint background, builder/economy icon, no medieval tools, modern urban construction vibe",
    playstyle_warlord:    "two crossed brass-knuckles or street-fight bats forming an X with hot orange #FF6B4A glow, aggressive street-warrior icon, no swords, no medieval weapons, modern urban combat vibe",
    playstyle_strategist: "stylized brain silhouette overlaid with subtle teal #22D1C3 circuit-grid lines and a small magnifying-glass on top, intel/research icon, no fantasy spell-book, modern thinker vibe",
    playstyle_diplomat:   "two clasping hands silhouette in handshake gesture, soft purple #a855f7 glow ring around them, alliance/diplomacy icon, modern street-deal vibe, no medieval banner, no royalty",
    action_spy:     "magnifying glass with eye in center, surveillance icon, spy emblem, cyan glow",
    action_rally:   "megaphone with sound waves, rally call icon, orange-red glow",
    action_attack:  "two crossed swords clashing, attack action icon, sharp metallic, pink-magenta glow",
    action_shield:  "circular shield emblem with star center, protection badge, cyan-blue energy",
    inbox_personal:      "stylized envelope with wax seal, soft blue glow, personal mail icon",
    inbox_report:        "rolled parchment scroll with red ribbon, battle report icon, aged paper",
    inbox_crew:          "kite shield with crew banner crest, gold trim, crew emblem",
    inbox_event:         "festive party popper with confetti burst, vibrant multicolor, event icon",
    inbox_system:        "geared cog with subtle circuit lines, steel & cyan glow, system notification icon",
    inbox_sent:          "paper plane with motion trail, soft cyan, outgoing message icon",
    inbox_fab:           "vintage red mailbox with raised flag, small letters peeking out, mailbox icon",
    inbox_reward:        "wrapped gift box with golden ribbon and bow, sparkles, reward icon",
    inbox_starred:       "five-pointed star with golden glow and inner sparkle, bookmark/favorite icon",
    inbox_unread:        "small glowing dot/pulse orb, cyan-teal, notification dot",
    inbox_report_pvp:    "two crossed swords clashing with spark, PvP battle report icon",
    inbox_report_pve:    "longbow with arrow nocked, forest green tone, PvE bandit raid icon",
    inbox_report_spy:    "magnifying glass over folded document, spy report icon",
    inbox_crew_decree:   "wax-sealed proclamation scroll, gold seal, crew decree icon",
    inbox_crew_announce: "megaphone with concentric sound waves, announcement icon",
    inbox_crew_bounty:   "wanted poster pin with target crosshair, bounty icon",
    inbox_crew_build:    "construction crane silhouette with steel girders, build report icon",
    repeater_hq:     "fortified urban crew HQ bunker built from stacked rusty shipping containers and concrete slabs, massive signal antenna on top emitting pulsing teal #22D1C3 and magenta #FF2D78 energy rings, walls covered in spray-paint graffiti tags and stencils, boarded windows glowing neon teal from inside, satellite dishes, makeshift wooden scaffolding, hanging spray cans and chains, padlocks, dripping pink graffiti accents, dominant intimidating boss-base of a street crew, gritty street-art vibe",
    repeater_mega:   "beefed-up urban broadcast tower on a rooftop — mid-size steel lattice cell tower with multiple stacked satellite dishes pointing in different directions and two crossed antenna rods on top, alternating teal #22D1C3 and magenta #FF2D78 signal-rings pulsing outward, hot orange #FF6B4A warning lights blinking, coiled cables, ladder rungs, sideways DANGER stencil spray, layered crew tags on every flat surface, hanging boombox, mid-tier crew asset between humble street-pole and full HQ, heavy hitter actively broadcasting",
    repeater_normal: "jury-rigged urban signal repeater bolted to a battered street lamp post — twisted antenna rods, makeshift dish made from a hubcap, exposed wiring wrapped in duct tape, warning stickers, crew tags spray-painted on the pole base, single teal #22D1C3 signal-pulse ring radiating from antenna tip, pink #FF2D78 graffiti drip on pole, small blinking red LED, hanging spray can, weathered concrete base, improvised gritty claimed-territory marker, scrappy network node",
    repeater_silhouette_hq:     "pictogram silhouette of a single fat castle keep — ONE wide rectangular tower with 3-4 chunky crenellations on top and a single triangular pennant flag on a short pole at the upper-right corner. NO side towers, NO antennas, NO dishes, NO inner windows or doors. Just the bold blocky keep + flag, like a chess-rook-with-flag pictogram. Solid uniform shape with hard clean edges.",
    repeater_silhouette_mega:   "pictogram silhouette of a stylized broadcast tower — ONE narrow vertical tower-mast with a triangular widening base, topped by a single wide horizontal crossbar (the antenna), with two thin spikes pointing up from the crossbar. NO lattice, NO multiple dishes, NO cables. Just a clean vertical T-shape with triangular base, like a stylized radio-tower icon. Solid uniform shape.",
    repeater_silhouette_normal: "pictogram silhouette of a tiny signal-mast — a SHORT thick pole with a single small triangular flag-shape OR a simple dot+arc (signal wave) on top. Total height roughly equal to width. Minimal — like the simplest possible map-pin glyph. NO antennas with multiple spikes, NO dishes, NO scaffolding. Solid uniform shape, instantly readable as a small marker even at 12px.",
    base_silhouette_runner:     "pictogram silhouette of a simple house — a SQUARE base with a triangular peaked roof on top, NO chimney, NO door, NO windows, NO flag, NO tower. Just the absolute simplest house-glyph (like a Material-Design or Apple-emoji home icon). Solid uniform shape with hard clean edges.",
    base_silhouette_crew:       "pictogram silhouette of a single fortified keep — ONE wide rectangular building with 4-5 chunky crenellations on top (battlement teeth), and a SINGLE triangular pennant flag on a short pole emerging from the center of the top. NO side towers, NO gatehouse, NO multiple flags, NO inner detail. Just the bold blocky castle-keep + ONE flag. Solid uniform shape, like a chess-rook-with-flag pictogram.",
    quick_base:      "stylized fortified urban home-base icon: a chunky shipping-container fortress with antenna and pulsing teal #22D1C3 signal, single bold silhouette, gritty street-base vibe",
    quick_crew:      "two crossed urban-crew arm silhouettes with rolled-up sleeves and tattoo lines making an X, gold #FFD700 forearm bands, brotherhood emblem, bold pictogram",
    quick_rally:     "two crossed neon swords with magenta #FF2D78 and teal #22D1C3 energy blades crossing in an X, sharp clean blades, bold attack-rally emblem",
    quick_ranking:   "tall ornate trophy cup with handles, gold #FFD700 metal with red gem in front, sitting on a small podium base, crown-tipped top, ranking icon",
    quick_shop:      "wrapped gift box with magenta #FF2D78 ribbon and bold gold #FFD700 bow, slight 3D tilt, vibrant shopping/deals icon",
    quick_inbox:     "stylized envelope with wax seal in teal #22D1C3, slight perspective, soft inner glow, modern messaging icon",
    quick_achieve:   "five-pointed star medal with red ribbon, golden #FFD700 polished metal, shining center, achievement badge",
    quick_wegelager: "weathered urban barricade-pile silhouette with crossed crowbars on top, single skull stencil graffitied across, ambush/highway-robbery icon",
  };

  const subject = SUBJECT[s.id] ?? `iconic single-subject illustration representing "${s.name}" — ${s.description}`;

  if (s.category === "silhouette") {
    const silhouetteBase = [
      `MAP PICTOGRAM (NOT a detailed illustration) — simple geometric icon for a city-walking strategy game's map marker, in the style of Material-Design / Apple-Emoji / Font-Awesome / Lucide-Icons. Comparable simplicity-level: like a chess-piece silhouette or a Monopoly-board-token glyph.`,
      `Critical rule: this icon will be displayed at 16-36 pixels on the map. Every visual element must survive that downscale. If a detail wouldn't be visible at 16px, OMIT IT. Aggressive abstraction over realism.`,
      `Background: FULLY TRANSPARENT PNG with alpha channel. Pixels outside the silhouette must have alpha = 0. No background color, no gradient, no scene, no fill, no halo, no glow.`,
      `Subject (centered, fills ~70% of frame, anchored to the BOTTOM of the canvas with ~15% bottom margin): ${subject}`,
      `Style: PURE FLAT SOLID SHAPE — like a black-paper papercut or a single-color stencil. One single uniform fill color (use pure white #FFFFFF so it can be tinted via CSS later). NO shading, NO gradients, NO highlights, NO outlines, NO inner detail lines, NO depth, NO perspective, NO 3D rendering, NO bevel, NO drop shadow, NO texture, NO patterning. The silhouette must be a SINGLE CONNECTED simple shape (or 1-2 obvious sub-shapes max). Big chunky forms with bold edges. NO thin spikes, NO fine scaffolding, NO complex multi-tower compositions.`,
      `Composition: 1024×1024 square, single icon. Footprint anchored at the bottom edge with ~15% margin. Hard clean silhouette edge — no anti-aliased halo, no fringing, no semi-transparent background bleed. Maximum 3 distinct shape-features (e.g. base + roof + flag = 3 features max).`,
      `Output format: PNG with alpha channel. Subject = pure white silhouette on fully transparent background.`,
      `Strict negatives: NO text, NO letters, NO logo, NO watermark, NO human figures, NO shading, NO gradients, NO inner details, NO outlines, NO glow effects, NO shadows, NO perspective, NO 3D rendering, NO scenery, NO background of any kind, NO dishes, NO satellites, NO antennas with multiple spikes, NO crowded multi-tower castle, NO scaffolding, NO cables, NO ladders, NO windows, NO doors, NO crenellations more than 5 teeth.`,
    ];
    if (input.mode === "video") {
      return [
        ...silhouetteBase,
        `Animation: a 3-second seamlessly looping subtle pulse — the silhouette scales 100% → 102% → 100% from the bottom anchor. First and last frame pixel-identical. No audio.`,
        `Note: video format does not support alpha. For video silhouettes, use SOLID PURE NEON GREEN #00FF00 background instead of transparent (chroma-keyed in the app).`,
      ].join(" ");
    }
    return silhouetteBase.join(" ");
  }

  const isQuick = s.category === "quick";
  const fillPct = isQuick ? "~85%" : "~75%";
  const tightCropClause = isQuick
    ? `Subject is tightly cropped: bounding-box of the icon-content reaches the inner ${fillPct} of the canvas equally on all sides. NO extra empty padding inside the icon, NO floor/ground beneath, NO scenery. Pure isolated pictogram.`
    : "";

  const backgroundLine = isQuick
    ? `BACKGROUND IS FULLY TRANSPARENT (alpha=0). Output a 32-bit PNG with proper alpha channel. The area outside the subject's silhouette must be 100% transparent — no painted background, no atmospheric haze, no radial glow extending beyond the subject, no gradient backdrop, no aura, no decorative frame, no card-base, no platform under the subject, no environmental elements. Imagine the subject floating against a checkerboard-pattern editor view — that area must be empty/transparent in the final file. Hard clean alpha-edge between subject and transparency.`
    : `Background: solid pure GREENSCREEN #00FF00, no other green hue, completely flat — for chroma-key removal.`;

  const negativesLine = isQuick
    ? `CRITICAL NEGATIVES (transparent PNG): NO background of ANY kind, NO atmospheric background, NO gradient backdrop, NO radial glow filling the canvas, NO sky, NO clouds, NO environment, NO dark teal backdrop, NO blue backdrop, NO scene, NO platform, NO base under subject, NO decorative aura around subject, NO golden frame, NO ornate border, NO card-style background panel. Also: no text, no letters, no logo, no watermark, no human faces. Subject MUST sit on completely transparent pixels — alpha=0 everywhere outside the subject silhouette.`
    : `Strict negatives: no text, no letters, no logo, no watermark, no human faces, no extra background scenery, no green spill on subject, no shadows on the green background, no anti-aliased green halo around subject (use clean alpha-friendly silhouette).`;

  const styleLine = isQuick
    ? `Style: stylized 3D game-icon (Rise of Kingdoms / Clash of Clans aesthetic), slight isometric tilt, vibrant saturated colors, soft INTERNAL shading only ON the subject itself. Thick clean silhouette readable at 24×24 px. Strong rim-light on subject edges. NO glow effects radiating outward into transparent area. NO aura. NO halo. The colored pixels are confined STRICTLY to the subject's solid form.`
    : `Style: stylized 3D game-icon, slight isometric tilt, vibrant saturated colors, soft inner glow, thick clean silhouette readable at 24×24 px, painterly soft shading with strong rim-light.`;

  const base = [
    `A premium UI icon for a mobile city-walking strategy game called "${s.name}".`,
    backgroundLine,
    `Subject (centered, fills ${fillPct} of frame): ${subject}.`,
    tightCropClause,
    styleLine,
    `Composition: 1024×1024 square, single icon centered.`,
    negativesLine,
  ].filter(Boolean).join(" ");

  if (input.mode === "video") {
    return [
      base,
      "Animation: seamless 3-second loop. Subject pulses gently (scale 100% → 105% → 100%), inner glow brightens then dims once, optional tiny particle drifts upward off the icon. First and last frame must match exactly. No audio.",
    ].join(" ");
  }
  return base;
}

// ─────────────────────────────────────────────────────────────────
// TROOP-PROMPT
// ─────────────────────────────────────────────────────────────────
type TroopSlotInput = { id: string; name: string; emoji: string; troop_class: string; tier: number };

export function buildTroopPrompt(input: { slot: TroopSlotInput; mode: "image" | "video" }): string {
  const s = input.slot;

  const CLASS_VIBE: Record<string, { role: string; outfit: string; weapon: string; signature: string }> = {
    infantry: {
      role: "burly doorman / sentry (TÜRSTEHER) — works as nightclub-bouncer in city or village-bouncer at the local pub",
      outfit: "dark bomber jacket or work-vest, earpiece optional, chunky boots, no-nonsense look",
      weapon: "no weapon needed — fists / brass knuckles / heavy belt",
      signature: "broad shoulders, crossed-arms idle pose, cyan accent #5ddaf0",
    },
    cavalry: {
      role: "fast courier / messenger (KURIER) — works as urban motorbike courier or rural delivery rider",
      outfit: "leather or canvas riding jacket, helmet with visor (could also be old goggles), fingerless gloves",
      weapon: "messenger bag, possibly small baton holstered, vehicle-key on chain (motorbike or moped)",
      signature: "dynamic forward-leaning stance, scarf or strap blowing back, orange accent #FF6B4A",
    },
    marksman: {
      role: "skilled marksman / sharpshooter (SCHÜTZE) — works as urban hooded sniper or village hunter",
      outfit: "hooded jacket or weatherproof hunting-coat, cargo pants, sturdy boots, single eye-scope monocle",
      weapon: "modern compact crossbow / paintball-style marker / slingshot / hunting bow",
      signature: "one-knee crouched aiming pose, focused squint, golden accent #FFD700",
    },
    siege: {
      role: "demolition worker / heavy hitter (BRECHER) — works equally on city construction-sites or rural farm-yards",
      outfit: "heavy work boots, hi-vis vest over thick clothing, knee pads, dust mask around neck",
      weapon: "sledgehammer, crowbar, or oversized iron pipe",
      signature: "two-handed weapon grip, wide power-stance, violet accent #a855f7",
    },
    collector: {
      role: "scavenger / resource gatherer (SAMMLER) — works as urban scrap-picker or rural forager / harvester",
      outfit: "utility vest with many pockets, bandana around neck, work gloves, sturdy trousers, headlamp on cap",
      weapon: "no weapon — instead carries a heavy CARGO BACKPACK overflowing with scrap, copper wire, jerry-cans, tools and harvest-sacks, a shovel or pitchfork clipped to the back",
      signature: "loaded backpack visible behind shoulders, one hand holding tool the other a sack, friendly working stance, green accent #4ade80",
    },
  };

  const TIER_LOOK: Record<number, string> = {
    1: "TIER 1 / ROOKIE: young recruit, plain unbranded grey/black clothes, NO patches, NO chains, NO glow. Slightly nervous but determined. Minimal accessories. Fresh / clean look.",
    2: "TIER 2 / STAMM: experienced regular, ONE silver chain or single crew-patch on jacket, basic cap or beanie, faint wear on gear. Confident neutral stance.",
    3: "TIER 3 / PROFI: full professional kit, MULTIPLE accessories (chains, patches, tactical pouches), branded crew jacket, slight smoke or dust at feet. Battle-hardened expression, visible muscle/scars.",
    4: "TIER 4 / ELITE: premium tactical gear with NEON-TRIM piping (cyan or magenta glow on jacket seams), thick gold chain, designer sneakers, subtle halo backlight glow around silhouette. Intimidating poised stance. Gold/silver accents on weapons.",
    5: "TIER 5 / BOSS: legendary commanding presence — distinctive SIGNATURE HEADWEAR (e.g. crown of bullets, horned helmet, neon-lit visor or tactical ski-mask with glowing eyes), luxurious long dark coat or armored vest with intricate crew-emblem stitching, MULTIPLE thick gold chains, cigar or toothpick, intense BACKLIT NEON-AURA outlining the body, faint smoke curling from feet, commanding alpha pose. Unmistakable boss vibe.",
  };

  const cls = CLASS_VIBE[s.troop_class] ?? CLASS_VIBE.infantry;
  const tier = TIER_LOOK[s.tier] ?? TIER_LOOK[1];

  const subject = `${cls.role}, internal name "${s.name}". ${tier} ${cls.signature}. Wears ${cls.outfit}. Carries ${cls.weapon}. CRITICAL: the tier visual markers above must be unmistakable so a player can instantly tell T1 from T5 at a glance — Rookie looks plain, Boss looks legendary.`;

  const base = [
    `A premium 3D character portrait for a mobile crew-turf strategy game (Country / City / Village / Crews / Gangs concept).`,
    `Background: solid pure GREENSCREEN #00FF00, no other green hue, completely flat — for chroma-key removal.`,
    `Subject (centered, fills ~80% of frame, full-body or 3/4 body visible): ${subject}`,
    `Style: stylized 3D character art, slight isometric tilt, vibrant saturated colors, dramatic rim lighting from upper-left, grounded modern crew aesthetic that fits both city neighborhoods and village settings, painterly soft shading, high detail on face and weapon, readable silhouette at 64×64 px.`,
    `Composition: 1024×1024 square, single character centered, subtle ground shadow under feet, NO scenery or buildings — keep #00FF00 fully clean at edges.`,
    `Strict negatives: no text, no letters, no logo, no watermark, no medieval-fantasy plate-armor, no wizard-robes, no full military uniforms, no green spill on subject, no anti-aliased green halo around subject (use clean alpha-friendly silhouette).`,
    `Tone: grounded modern crew/gang aesthetic — flexible character concept art that reads equally as a city neighborhood crew or a village/country gang.`,
  ].join(" ");

  if (input.mode === "video") {
    return [
      base,
      "Animation: seamless 3-second loop. Subject does a confident idle: subtle weight-shift, breathing, weapon hand twitches once, eyes blink. First and last frame must match exactly. No camera movement, no audio.",
    ].join(" ");
  }
  return base;
}

// ═══════════════════════════════════════════════════════════════════
// STRONGHOLDS
// ═══════════════════════════════════════════════════════════════════

export type StrongholdArt = {
  id: string;
  name: string;
  fallbackEmoji: string;
  accent: string;
  subject: string;
  style: string;
};

export const STRONGHOLDS_ART: StrongholdArt[] = [
  {
    id: "wegelager",
    name: "Wegelager (Schrottplatz)",
    fallbackEmoji: "\u{1F3DA}️",
    accent: "#FF2D78",
    subject: "a hostile BANDIT-RUN URBAN SCRAPYARD ('Schrottplatz') — a sprawling 3D mountain of stolen and salvaged junk where road-pirates dismantle plundered goods. Lore: the Wegelager-Bande hijacks travelers, drags loot back here, and cuts everything down to scrap and parts which they sell on the black market. The whole thing is a living menace, smoke and sparks rising. Composition (CRITICAL — varied 3D, NOT a clean square tile): irregular asymmetric junk-mountain that rises tallest in the center-back and slopes down to scattered rubble in the front-right, the platform itself a cracked oil-stained concrete pad bordered by twisted chain-link fence with ragged barbed wire. Key elements: stacks of 3-4 wrecked colorful CARS / MOTORCYCLES / VANS partially crushed and welded into makeshift defensive walls (rusted reds, faded blues, oxidized greens), tipped-over OIL DRUMS some leaking some BURNING with orange flames spewing dark smoke, a tilted MAGNETIC CRANE-ARM with a giant black scrap-magnet hanging from chains low over the yard, sparks raining from the magnet, a crooked CORRUGATED-IRON WATCHTOWER built on top of stacked scrap with a narrow ladder going up its side, hanging skull-trophies and dangling chains, a heavy industrial WORKBENCH at the front-left with stolen merchant goods being torn apart (a half-dismantled wagon-wheel, gold coins spilled from a broken strongbox, splintered crates marked with X's, a ruined ale-keg, scattered weapons), graffiti spray-tags everywhere (skull-and-crossed-wrenches crew-mark, X marks, crimson drips), red lanterns and a single welder's torch glowing arc-blue from inside the watchtower, makeshift signage stenciled DANGER / KEEP OUT in dripping red paint. Mood: this is a place where travelers' caravans go to die — gritty, hostile, smoking, alive with the noise of grinders and hammers. Has a clear STORY of being attackable (loot stockpile visible at the front to motivate the player to raid it).",
    style: "AAA mobile-game promotional hero-shot — fully 3D, cinematic, ultra-detailed, intricate hand-painted textures (rust, oil-stains, scratched paint on cars), dramatic rim-light, atmospheric haze of smoke + dust, awe-inspiring sinister presence, the kind of asset you'd see on a key-art splash screen or trailer-thumbnail. Reference standard: Last Shelter Survival / State of Survival / Mad-Max-aesthetic urban scrapyards / The Division 2 hostile-camps — gritty post-industrial bandit hideout. Vibrant saturated colors with dominant rust-orange + crimson-magenta accents (#FF2D78), warm fire-orange torch glow, cool blue welder-arc rim, slight cel-shading, painterly highlights, the BUILDING ITSELF is a 3D iso scrap-mountain (NOT a flat illustration). The composition must FEEL three-dimensional with depth — wrecked cars layered front-to-back at different elevations.\n\nHERO FEATURE (the WOW moment — render BIG and prominent): a TILTED INDUSTRIAL CRANE-ARM with a HUGE BLACK ELECTROMAGNET on chains hangs over the yard like a vulture's head, sparks raining down from where it's lifting a half-crushed car carcass mid-air; the magnet is the size of a small house, painted with a crew skull-stencil, and a tattered crimson pirate-flag (skull-and-crossed-wrenches — NOT swords; wrenches show this is the SCRAP crew) flutters from the crane's tip"
  },
];

export function buildStrongholdPrompt(input: { stronghold: StrongholdArt; mode: "image" | "video" }): string {
  const { stronghold: s, mode } = input;
  if (mode === "video") {
    return [
      `Shot: a 3-second seamlessly looping animated isometric game-asset of "${s.name}" (a hostile PvE bandit stronghold), square 1:1 composition, 1024×1024, 30 fps.`,
      `Background: SOLID PURE NEON GREEN (#00FF00, chroma-key green / green screen). Completely flat uniform single color filling the ENTIRE 1024×1024 frame including a clean ~8% margin around the floating tile. No gradients, no patterns, no shadows on the green, no environment.`,
      `Subject: ${s.subject}.`,
      `Style: ${s.style}.`,
      `Camera: locked isometric 30° angle, structure centered with ~10% padding around the silhouette.`,
      `Lighting: warm orange torch-light from inside, cool blue moonlight rim from upper-left, dramatic key shadows.`,
      `Motion: gentle ambient — slow vertical bob of the floating tile (±2 px), red lanterns flicker, torch flame wavers, occasional small spark drifts close to torches only. NO environmental particle drift through empty green space. Camera fully static. First and last frame pixel-identical for seamless loop.`,
      `No audio. Silent video only.`,
      `CRITICAL: NO green tones on the stronghold, walls, banners, lanterns or glows. Use crimson red, warm orange, dark grey/brown, rust. The ONLY green is the #00FF00 background.`,
      `NO ground beyond the tile, NO sky, NO trees, NO scenery, NO atmospheric haze. No text, no labels, no watermark.`,
    ].join(" ");
  }
  return [
    `Single isolated isometric stylized 3D-render game-asset of "${s.name}" — a hostile PvE bandit stronghold. Square 1:1, 1024×1024.`,
    `Background: FULLY TRANSPARENT PNG with alpha channel — completely empty outside the silhouette of the structure+tile. No background color, no gradient, no scene, no checkerboard, no white, no black, no green. Pixels outside the structure must have alpha = 0.`,
    `Subject: ${s.subject}.`,
    `Style: ${s.style}.`,
    `Camera: locked isometric 30° angle, structure centered with ~10% transparent padding on all four sides.`,
    `Lighting: warm orange torch-light from inside, cool blue moonlight rim from upper-left, dramatic key shadows. Hard clean silhouette edge — no halo, no fringing, no semi-transparent background bleed.`,
    `Output format: PNG with alpha channel.`,
    `NO ground beyond the tile, NO sky, NO trees, NO scenery, NO atmospheric haze. No text, no labels, no UI overlays, no watermark, no people.`,
  ].join(" ");
}

/* ═════════════════════════════════════════════════════════ */
/*  Modal-Background — Vollbild-Hintergründe für Tab-Routen   */
/* ═════════════════════════════════════════════════════════ */

export type ModalBackgroundArt = {
  id: string;
  name: string;
  description: string;
  scene: string;
  mood: string;
  motion?: string;
};

export const MODAL_BACKGROUNDS_ART: ModalBackgroundArt[] = [
  {
    id: "karte_base_bg",
    name: "Base — Heimat-Skyline",
    description: "Hintergrund für /karte/base — die Heimat-Stadt im warmen Tageslicht",
    scene: "wide cinematic painted skyline of a friendly cyber-urban hometown at golden hour: a row of stylized 5–10-story rowhouses, art-deco shop facades, neon-lit awnings, rooftop gardens with antennas and string-lights, a single tall central building with glowing windows that reads as the player's HOME BASE (subtle distinction — slightly larger, golden-warm glow, small flag on roof), distant low hills in soft haze on the horizon, lens-flare from a low warm sun in the upper-right corner, a few stationary cumulus clouds tinted peach and apricot fixed in place. NO drones, NO birds, NO airplanes, NO vehicles, NO moving traffic — only static silhouettes",
    mood: "warm welcoming day-mood — palette dominated by sky-blue (#5A8FB5 → #8FBFE0) gradient sky, peach (#FFD27A) and cream (#FFF4D6) sun glow, soft teal (#22D1C3) accent lights in shop signs, NO night, NO darkness, NO menacing silhouettes — this is the player's safe home district. RoK / Clash of Clans / Township vibe — inviting, hopeful, alive.",
    motion: "ONLY in-place oscillations: neon shop signs and individual lit windows flicker softly with a 1.5-second period (each window independent random phase), sun-flare shimmers in place with a 2-second pulse, faint heat-haze ripples on rooftops with a 3-second cycle. NO clouds drifting, NO objects translating across the frame, NO birds, NO drones, NO vehicles — every single moving element must complete a full cycle and return to its EXACT starting state within 6 seconds.",
  },
  {
    id: "karte_waechter_bg",
    name: "Wächter — Trainingsarena",
    description: "Hintergrund für /karte/waechter — Übungs-Hof der Wächter",
    scene: "cinematic painted training-compound interior: weathered stone-and-iron rim with banners hanging from rafters, sand-and-grit floor in the foreground with crossed weapon-racks along the walls, training dummies and pell-posts, a forge glowing in the back-left, a window in the back-right opening to a sunset sky, hanging chains, ornate crew-class crests carved into pillars, ambient torchlight casting warm pools",
    mood: "rosé-sunset arena mood — palette warm rose (#FF6B4A) and apricot (#FFB088) sunset bleeding through windows, deep dusk-purple (#3A1F35) shadows, golden torch-glow accents, dramatic but inviting — feels like a heroic preparation space, equally at home in a city or village setting.",
    motion: "ONLY in-place oscillations: torch flames flicker with 1-second flicker-cycles (per torch), forge embers pulse from dim to bright and back over 2 seconds (NO drifting upward), banners sway gently in place with a 3-second left-right cycle returning to neutral, dust glitters shimmer-in-place in the window light. NO sparks traversing the frame, NO objects translating, NO character motion. Every element must end the 6-second clip in its exact starting state.",
  },
  {
    id: "karte_crew_bg",
    name: "Crew — Crew-Zentrum",
    description: "Hintergrund für /karte/crew — Versammlungshalle der Crew",
    scene: "cinematic painted grand crew assembly hall: long timber-and-brass banquet table in the foreground with empty chairs around it, polished stone floor reflecting golden lamp-light, tall stone walls hung with massive crew banners (heraldic emblems with crests, silken folds catching warm light), a soaring vaulted ceiling with chandeliers, columns wrapped in ivy and gold leaf, throne-like high-backed chair at the head of the table on a low dais, war-map spread on the table surface with miniature carved tokens",
    mood: "regal gold-and-banner mood — palette deep royal-gold (#FFD700) and warm amber, deep red banner accents, lamp-light pools of warm yellow, dark mahogany shadows in the corners but never oppressive, feels like a place of camaraderie and decision welcoming any crew.",
    motion: "ONLY in-place oscillations: candle flames flicker with 1-second cycles (each independent random phase), chandelier crystals shimmer with light-glints that pulse in place, banners ripple in place with a 3-second left-right cycle returning to neutral, gold leaf on columns subtly glints. NO objects translating, NO floating particles drifting, NO character motion. Every element must end the 6-second clip in its exact starting state.",
  },
  {
    id: "karte_inventar_bg",
    name: "Inventar — Lager-Depot",
    description: "Hintergrund für /karte/inventar — Lagerhalle/Tresor mit Beuteschätzen",
    scene: "cinematic painted treasure-and-supply storage hall: warm wood-and-iron storage room with shelving from floor to ceiling stacked with chests, sacks of supplies, stacks of weapons, rolled scrolls, bottled potions glowing softly, barrels of provisions, hanging cured meats and dried herbs, a heavy iron-bound door in the back, oil-lanterns hanging on chains casting warm pools, gold coins spilling from one tipped-over chest in the foreground catching light",
    mood: "warm-brown vault mood — palette saturated warm-brown (#5C4E32) and amber-gold (#D4A574), oil-lantern orange highlights, deep umber shadows, occasional cool blue glow from rare potions, feels rich and abundant — the player's hard-earned hoard.",
    motion: "ONLY in-place oscillations: lantern flames flicker softly with 1.5-second cycles, potion bottles glow brighter then dimmer with 2-second breathing pulse (return to start), gold coin highlights sparkle in place with 1-second twinkle. NO drift, NO floating particles, NO objects translating, NO character motion. Every element must end the 6-second clip in its exact starting state.",
  },
  {
    id: "karte_shop_bg",
    name: "Shop — Boutique",
    description: "Hintergrund für /karte/shop — Boutique mit exklusivem Stuff",
    scene: "cinematic painted boutique stall interior: rich purple velvet curtains draped from above as a backdrop, polished wooden counter in the foreground covered with arranged wares (crystal vials, jeweled rings on silk cushions, stacks of gem-encrusted scrolls, ornate lockboxes), shelves behind with countless glittering trinkets, hanging string-lights and tiny lanterns, a brass weighing scale center-counter, a half-open spellbook with glowing pages",
    mood: "soft-purple wonder-stall mood — palette dominated by amethyst-purple (#583A6F) and pink-magenta (#FFB3D9) accents, candy-pink (#FFD6EC) curtain highlights, golden lantern warmth, NO menace — feels like a wonder-stall full of treasures begging to be bought.",
    motion: "ONLY in-place oscillations: lantern flames flicker with 1-second cycles, spellbook pages glow with 2-second breathing pulse (return to start), gem reflections twinkle in place randomly, string-lights pulse on/off softly. NO orbiting runes, NO objects rotating around items, NO drift, NO traversing motion, NO bird, NO character motion. Every element must end the 6-second clip in its exact starting state.",
  },
];

export function buildModalBackgroundPrompt(input: { bg: ModalBackgroundArt; mode: "image" | "video" }): string {
  const { bg, mode } = input;
  if (mode === "video") {
    return [
      `Shot: a 6-second SEAMLESSLY LOOPING cinematic background animation for a mobile game UI panel — "${bg.name}". Aspect ratio 16:9 (1920x1080), 30 fps. This video will be set to loop=true in HTML — the loop point MUST be invisible.`,
      `Scene: ${bg.scene}.`,
      `Mood / palette: ${bg.mood}`,
      `Composition: full-bleed background painting — fills the entire 1920x1080 frame. NO transparency, NO chroma-key. Background will sit BEHIND UI elements (cards, tiles, text) so keep the LEFT and CENTER regions visually calm with most detail toward the EDGES; avoid hard high-contrast subjects in the dead-center. Overall reads as a stage/backdrop, not a mid-shot.`,
      `\u{1F6AB} ABSOLUTE CAMERA RULE — NO ZOOM-IN, NO ZOOM-OUT, NO PAN, NO TILT, NO TRACKING, NO PARALLAX, NO DOLLY, NO PUSH-IN. The framing at frame 1 and frame 180 (last frame) must be IDENTICAL pixel-positions. Treat this like a still photograph with only tiny localized animations on top — NOT a cinematic shot. If you add ANY camera motion the video is unusable.`,
      `\u{1F6AB} ABSOLUTE TRAVERSAL RULE — NO objects may move ACROSS the frame: no flying birds, no drones, no airplanes, no vehicles, no walking people, no swimming fish, no drifting clouds, no falling leaves, no rising smoke that exits the frame, no traversing sparks. ALL motion must be LOCAL (under 5% of frame width/height) and OSCILLATING (return to start within the loop).`,
      `Allowed motion types ONLY: in-place flicker (flames, lanterns, neon, windows), in-place pulse/breathe (glowing objects), in-place ripple/sway (banners, curtains — must end at neutral starting position), in-place sparkle/twinkle (gems, reflections), in-place shimmer (heat haze, sunlight glints).`,
      `Per-scene motion guidance: ${bg.motion ?? "in-place oscillations only — minor flicker / pulse, no traversal."}`,
      `Loop integrity: every animated element must complete a full cycle and return to its EXACT starting state at the 6-second mark. Frame 1 and frame 180 must be visually indistinguishable. Test mentally: if I freeze on frame 180 then jump to frame 1, would I notice? If yes, the loop is broken.`,
      `Lighting: cinematic, painterly, soft directional key-light with rim accents in palette colors above. Mid-tones favored, no crushed blacks, no blown-out whites — UI text in white must remain legible over any region.`,
      `Style: AAA mobile-game key-art / 2.5D painted background — grounded illustrated quality that flexibly speaks to both city-dwellers and village-residents, Anno 1800 / Township / Forge of Empires / Stardew Valley background quality. Hand-painted textures, soft cel-shading, vibrant but not garish, family-friendly inviting tone — works for Country / City / Village / Crews alike.`,
      `No audio. Silent video only. No text, no UI mockups, no watermark, no logo, no people in frame.`,
    ].join(" ");
  }
  return [
    `Cinematic painted background image for a mobile game UI panel — "${bg.name}". Aspect ratio 16:9, 1920x1080.`,
    `Scene: ${bg.scene}.`,
    `Mood / palette: ${bg.mood}`,
    `Composition: full-bleed background painting — fills the entire 1920x1080 frame. NO transparency, NO chroma-key. The image will sit BEHIND UI elements (cards, tiles, text) so keep the LEFT and CENTER regions visually calm with most detail toward the EDGES; avoid hard high-contrast subjects right in the dead-center where UI tiles overlay. Overall composition reads as a stage/backdrop, not a busy mid-shot.`,
    `Lighting: cinematic, painterly, soft directional key-light with rim accents in palette colors above. Mid-tones favored, no crushed blacks, no blown-out whites — UI text in white must remain legible over any region.`,
    `Style: AAA mobile-game key-art / 2.5D painted background — Rise of Kingdoms / Call of Dragons / Township / Royal Match background quality. Hand-painted textures, soft cel-shading, vibrant but not garish, family-friendly inviting tone.`,
    `Output format: high-quality JPG or PNG (no alpha needed). No text, no UI mockups, no watermark, no logo, no people in frame.`,
  ].join(" ");
}
