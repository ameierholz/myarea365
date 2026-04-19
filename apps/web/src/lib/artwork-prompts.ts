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
  "Gravianer":        { material: "schwarzes Gravitationsglas",      style: "monolithisch, schwebende Teile", energyColor: "#6991d8", role: "tank" },
  "Obsidith":         { material: "poröser Obsidian und Lava",        style: "vulkanisch, massiv",              energyColor: "#ef7169", role: "tank" },
  "Krustaphon":       { material: "kalkhaltiger Korallenpanzer",      style: "maritim, dornig",                  energyColor: "#6991d8", role: "tank" },
  "Bollwerk-Myzelen": { material: "gehärtetes Pilzgeflecht",          style: "biolumineszent, wuchernd",         energyColor: "#1db682", role: "tank" },
  "Eisenborken":      { material: "metallische Baumrinde",            style: "antik, knorrig",                   energyColor: "#1db682", role: "tank" },
  "Runengranit":      { material: "eingravierter Granitmonolith",     style: "uralt, glühende Runen",            energyColor: "#6991d8", role: "tank" },
  "Stahl-Kolosse":    { material: "brünierter Stahl und Ketten",      style: "industriell, massiv",              energyColor: "#6991d8", role: "tank" },

  // ─── HEALER ─────────────────────────────────────────────
  "Lumeniden":        { material: "kristallisiertes Licht",            style: "ätherisch, strahlend",             energyColor: "#1db682", role: "healer" },
  "Symphoniker":      { material: "schwingendes Messing",              style: "elegant, musikalisch",             energyColor: "#5ddaf0", role: "healer" },
  "Äther-Algen":      { material: "transparente Bio-Membran",          style: "viskos, schwebend",                energyColor: "#1db682", role: "healer" },
  "Osmosianer":       { material: "pulsierendes Plasma",                style: "flüssig, organisch",               energyColor: "#1db682", role: "healer" },
  "Vitalis-Funken":   { material: "gebündelte Energiepartikel",         style: "nebulös, schwärmend",              energyColor: "#1db682", role: "healer" },
  "Chorweber":        { material: "verflochtene Tonfäden",              style: "elfenhaft, geometrisch",           energyColor: "#5ddaf0", role: "healer" },

  // ─── DPS ────────────────────────────────────────────────
  "Schatten-Skurrier": { material: "verdichteter Schattenstaub",        style: "scharf, rauchig",                  energyColor: "#6991d8", role: "dps" },
  "Vektoren":          { material: "poliertes Chitin",                    style: "insektisch, aerodynamisch",        energyColor: "#ef7169", role: "dps" },
  "Klingen-Kyniden":   { material: "organischer Stahl",                   style: "gezackt, biomechanisch",           energyColor: "#6991d8", role: "dps" },
  "Phasen-Jäger":      { material: "instabile Materie",                   style: "glitchy, halb-transparent",        energyColor: "#5ddaf0", role: "dps" },
  "Puls-Kollosse":     { material: "gehärtetes Kupfer",                   style: "industriell, dampfend",            energyColor: "#6991d8", role: "dps" },
  "Splittertänzer":    { material: "schwebende Glassplitter",             style: "tanzend, scharfkantig",            energyColor: "#5ddaf0", role: "dps" },
  "Feuer-Fuchs":       { material: "lodernde Bronze mit Gluthaaren",     style: "schnell, flammend",                energyColor: "#ef7169", role: "dps" },
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

/** Prompt für Wächter-Archetyp (Charakter-Illustration, nicht Item) */
export function buildArchetypePrompt(archetypeName: string, rarity: "common" | "rare" | "epic" | "legend"): string {
  const rarityMod = {
    common: "muted tones, simple silhouette, matte textures",
    rare:   "polished materials, emerald accents, subtle runes",
    epic:   "arcane purple glow, floating fragments, translucent crystal",
    legend: "godly golden aura, fire particles, halo, legendary key art",
  }[rarity];
  return (
    `Character key art portrait of '${archetypeName}', a MyArea365 guardian, ` +
    `3/4 view, heroic pose, detailed face and outfit, ` +
    `${rarityMod}, ` +
    `dark gradient background #0F1115 to #1A1D23, ` +
    `cinematic rim lighting, accent colors #1db682 and #6991d8, ` +
    `style: Magic The Gathering card art, League of Legends splash, Diablo 4 hero portrait, ` +
    `1024x1024, transparency-safe edges, no text, no logo.`
  );
}
