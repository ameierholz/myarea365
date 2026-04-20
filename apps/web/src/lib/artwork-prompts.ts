/**
 * Automatisierter Loot- & Prompt-Generator (MyArea365 Branding: #1db682 & #6991d8)
 * 20 Rassen × 15 Slots × 6 Rarities = 1800 einzigartige Prompts.
 *
 * Wird vom Admin-Tool unter /admin/artwork verwendet.
 * Unabhängig von der DB — generiert Prompts ad-hoc für Canova/Scenario.
 */

export type RaceLore = {
  material: string;
  style: string;
  energyColor: string;
  role: "tank" | "healer" | "dps";
};

export const ARTWORK_RACES: Record<string, RaceLore> = {
  // ─── TANKS ──────────────────────────────────────────────
  "Gravianer":          { material: "schwarzes Gravitationsglas",              style: "monolithisch, schwebende Teile",    energyColor: "#6991d8", role: "tank" },
  "Obsidith":           { material: "poröser Obsidian und Lava",                style: "vulkanisch, massiv",                 energyColor: "#ef7169", role: "tank" },
  "Krustaphon":         { material: "kalkhaltiger Korallenpanzer",              style: "maritim, dornig",                    energyColor: "#6991d8", role: "tank" },
  "Bollwerk-Myzelen":   { material: "gehärtetes Pilzgeflecht",                  style: "biolumineszent, wuchernd",           energyColor: "#1db682", role: "tank" },
  "Eisenborken":        { material: "metallische Baumrinde",                    style: "antik, knorrig",                     energyColor: "#1db682", role: "tank" },

  // ─── HEALER ─────────────────────────────────────────────
  "Lumeniden":          { material: "kristallisiertes Licht",                    style: "ätherisch, strahlend",               energyColor: "#1db682", role: "healer" },
  "Symphoniker":        { material: "schwingendes Messing",                      style: "elegant, musikalisch",               energyColor: "#5ddaf0", role: "healer" },
  "Äther-Algen":        { material: "transparente Bio-Membran",                  style: "viskos, schwebend",                  energyColor: "#1db682", role: "healer" },
  "Osmosianer":         { material: "pulsierendes Plasma",                        style: "flüssig, organisch",                 energyColor: "#1db682", role: "healer" },
  "Vitalis-Funken":     { material: "gebündelte Energiepartikel",                 style: "nebulös, schwärmend",                energyColor: "#1db682", role: "healer" },

  // ─── MELEE DPS ──────────────────────────────────────────
  "Schatten-Skurrier":  { material: "verdichteter Schattenstaub",                style: "scharf, rauchig",                    energyColor: "#6991d8", role: "dps" },
  "Vektoren":           { material: "poliertes Chitin",                           style: "insektisch, aerodynamisch",          energyColor: "#ef7169", role: "dps" },
  "Klingen-Kyniden":    { material: "organischer Stahl",                          style: "gezackt, biomechanisch",             energyColor: "#6991d8", role: "dps" },
  "Phasen-Jäger":       { material: "instabile Materie",                          style: "glitchy, halb-transparent",          energyColor: "#5ddaf0", role: "dps" },
  "Reiß-Wühler":        { material: "zähe Muskulatur mit Krallen-Auswüchsen",    style: "kompakt, rasiermesserartig",         energyColor: "#ef7169", role: "dps" },

  // ─── RANGED DPS ─────────────────────────────────────────
  "Puls-Kollosse":      { material: "gehärtetes Kupfer mit Energie-Leitungen",   style: "industriell, dampfend",              energyColor: "#6991d8", role: "dps" },
  "Stachel-Spucker":    { material: "chitin-gepanzertes Projektil-Arsenal",      style: "ballistisch, primitiv",              energyColor: "#ef7169", role: "dps" },
  "Aura-Webber":        { material: "schwebende Bio-Fäden",                       style: "ätherisch, webend",                  energyColor: "#5ddaf0", role: "dps" },
  "Volt-Schwingen":     { material: "elektrisches Chitin mit Blitz-Membranen",   style: "geflügelt, gewittrig",               energyColor: "#5ddaf0", role: "dps" },
  "Singularitäts-Seher":{ material: "schwebende Singularitäten und kosmischer Staub", style: "kosmisch, abstrakt",           energyColor: "#a855f7", role: "dps" },
};

export const ARTWORK_SLOTS = [
  "Helm", "Halskette", "Schultern", "Brustplatte", "Gürtel",
  "Hose", "Stiefel", "Armschienen", "Handschuhe", "Ring",
  "Umhang", "Schmuckstück", "Haupthand-Waffe", "Nebenhand", "Rücken",
] as const;

export type ArtworkSlot = typeof ARTWORK_SLOTS[number];

export const ARTWORK_RARITIES = [
  { level: "Ungewöhnlich", effect: "leichte Lichtreflexe",                                  power: 1.2, color: "#9ba8c7" },
  { level: "Selten",        effect: "magisches Glimmen",                                     power: 1.5, color: "#1db682" },
  { level: "Episch",        effect: "pulsierende Energie-Adern",                             power: 2.0, color: "#a855f7" },
  { level: "Legendär",      effect: "schwebende Fragmente und Partikelsturm",                power: 3.0, color: "#FFD700" },
  { level: "Artefakt",      effect: "reißt den Raum auf, göttliche Aura",                    power: 5.0, color: "#FF2D78" },
  { level: "Transzendent",  effect: "kosmische Realitätsverzerrung, ultimatives Leuchten",   power: 8.0, color: "#FFFFFF" },
] as const;

export type ArtworkRarity = typeof ARTWORK_RARITIES[number]["level"];

export type GeneratedPrompt = {
  key: string;           // `race__slot__rarity` ASCII-Slug
  itemName: string;
  race: string;
  role: RaceLore["role"];
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

export function buildPrompt(race: string, slot: ArtworkSlot, rarityLevel: ArtworkRarity): GeneratedPrompt {
  const lore = ARTWORK_RACES[race];
  const rarity = ARTWORK_RARITIES.find((r) => r.level === rarityLevel)!;
  const prompt =
    `Game Icon, ${rarityLevel} ${slot} of the ${race}, ` +
    `made of ${lore.material}, style: ${lore.style}, ` +
    `visual effect: ${rarity.effect}, ` +
    `lighting: cinematic, glow color ${lore.energyColor}, ` +
    `high-end UI asset, black background, 3D render, Unreal Engine 5 style, ` +
    `accent colors #1db682 and #6991d8, 8k resolution.`;
  return {
    key: `${slug(race)}__${slug(slot)}__${slug(rarityLevel)}`,
    itemName: `${rarityLevel}er ${slot} der ${race}`,
    race,
    role: lore.role,
    slot,
    rarity: rarityLevel,
    statValue: Math.floor(10 * rarity.power),
    prompt,
    accentColor: rarity.color,
  };
}

export function generateAllPrompts(): GeneratedPrompt[] {
  const out: GeneratedPrompt[] = [];
  for (const race of Object.keys(ARTWORK_RACES)) {
    for (const slot of ARTWORK_SLOTS) {
      for (const r of ARTWORK_RARITIES) {
        out.push(buildPrompt(race, slot, r.level));
      }
    }
  }
  return out;
}

/** Prompt für Wächter-Archetyp (Charakter-Illustration oder animiertes Video) */
export type ArchetypePromptInput = {
  name: string;
  rarity: "common" | "rare" | "legend" | "elite" | "epic" | "legendary";
  guardianType?: "infantry" | "cavalry" | "marksman" | "mage" | null;
  role?: "dps" | "tank" | "support" | "balanced" | null;
  abilityName?: string | null;
  lore?: string | null;
  mode?: "image" | "video";  // "video" = Canva Magic Animate / Video-Generator Prompt
};

const RARITY_MOD: Record<string, string> = {
  // Neues System
  elite:     "clean polished materials, teal highlights, subtle runes, dignified gear",
  epic:      "arcane purple glow, floating fragments, translucent crystal accents, battle-worn noble look",
  legendary: "godly golden aura, fire particles, halo, legendary key art, iconic silhouette",
  // Legacy-Mapping
  common:    "clean polished materials, teal highlights, subtle runes",
  rare:      "clean polished materials, teal highlights, subtle runes",
  legend:    "godly golden aura, fire particles, halo, legendary key art, iconic silhouette",
};

const TYPE_MOD: Record<string, string> = {
  infantry: "heavy armor plating, shield and blunt/edged weapon, grounded stance, defender posture",
  cavalry:  "lightweight armor with flowing cloth, momentum-lines, dynamic mid-stride pose, aggressive forward lean",
  marksman: "lean form with ranged weapon (bow, crossbow, throwing blades), focused aim, high ground posture",
  mage:     "robes with arcane sigils, floating orb or staff, glowing eyes, levitating accessories, ethereal aura",
};

// Pro Typ die Idle-Animation beschreiben (subtle motion loop, nicht hektisch)
const TYPE_ANIM: Record<string, string> = {
  infantry: "slow steady breathing, shield subtly rising, armor plates micro-shifting, cape swaying gently in wind",
  cavalry:  "cloth and hair flowing in steady breeze, weight shifting weight side-to-side, ready-to-move tension",
  marksman: "bow/scope slightly adjusting aim, fingers flexing, eyes scanning, hood tassels fluttering",
  mage:     "arcane particles orbiting slowly around hands, robe hem levitating, glow pulsing softly, eyes glimmering",
};

const ROLE_MOD: Record<string, string> = {
  dps:      "aggressive offensive pose, weapon prominent, predatory silhouette",
  tank:     "solid defensive stance, shield or barrier, imposing bulky outline",
  support:  "caring protective pose, one hand extended in support gesture, warm secondary light",
  balanced: "versatile mid-action pose, tools of both offense and defense visible",
};

export function buildArchetypePrompt(input: ArchetypePromptInput | string, legacyRarity?: "common" | "rare" | "epic" | "legend"): string {
  // Legacy-Signatur: buildArchetypePrompt(name, rarity)
  const in_: ArchetypePromptInput = typeof input === "string"
    ? { name: input, rarity: legacyRarity ?? "epic" }
    : input;

  const rarityMod = RARITY_MOD[in_.rarity] ?? RARITY_MOD.epic;
  const typeMod   = in_.guardianType ? TYPE_MOD[in_.guardianType] : "";
  const roleMod   = in_.role         ? ROLE_MOD[in_.role]         : "";
  const animMod   = in_.guardianType ? TYPE_ANIM[in_.guardianType] : "";
  const ability   = in_.abilityName ? `signature ability: '${in_.abilityName}'` : "";
  const loreLine  = in_.lore ? `lore hint: ${in_.lore}` : "";

  if (in_.mode === "video") {
    // Canva Magic Animate / Midjourney Video / Runway / Pika-tauglich
    return [
      `Short looping idle animation (3-5 seconds, seamless loop) of '${in_.name}', a humanoid urban-fantasy MyArea365 guardian.`,
      `Portrait 9:16 aspect ratio, vertical, full body visible, character centered.`,
      typeMod && `Character: ${typeMod}.`,
      roleMod && `Role: ${roleMod}.`,
      `Rarity feel: ${rarityMod}.`,
      ability,
      loreLine,
      `Motion: ${animMod || "subtle breathing, slight weight shift, clothing and hair reacting to wind"}.`,
      `Camera: locked static shot, no pan, no zoom. Character stays centered.`,
      `Keep background very dark and stable (dark gradient #0F1115 to #1A1D23), only the character and its FX animate.`,
      `Ambient FX: faint rising dust/particles, soft rim-light flicker, slow aura pulse.`,
      `Setting: gritty modern city (street neon glow, rooftop silhouette) — NOT medieval fantasy.`,
      `Accent colors #22D1C3 (teal) and #FF2D78 (pink-magenta), with #FFD700 gold highlights for legendary.`,
      `Style: Magic The Gathering animated card, League of Legends champion splash in motion, Diablo 4 login-screen loop.`,
      `Smooth 24-30fps, seamless first-to-last-frame loop, MP4/WebM, 1080x1920, no text, no logo, no watermark.`,
    ].filter(Boolean).join(" ");
  }

  return [
    `Character key art portrait of '${in_.name}', a humanoid urban-fantasy MyArea365 guardian.`,
    `3/4 view, heroic pose, detailed face and outfit, full body visible, single character, dynamic composition.`,
    typeMod && `Class: ${typeMod}.`,
    roleMod && `Role: ${roleMod}.`,
    `Rarity feel: ${rarityMod}.`,
    ability,
    loreLine,
    `Setting: gritty modern city (streets, alleys, neon, rooftops) — NOT medieval fantasy.`,
    `Dark gradient background #0F1115 to #1A1D23, cinematic rim lighting.`,
    `Accent colors #22D1C3 (teal) and #FF2D78 (pink-magenta), with #FFD700 gold highlights for legendary.`,
    `Style: Magic The Gathering card art, League of Legends splash, Diablo 4 hero portrait.`,
    `1024x1024, centered, transparency-safe edges, no text, no logo, no watermark.`,
  ].filter(Boolean).join(" ");
}
