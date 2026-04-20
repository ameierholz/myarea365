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
  // Neues System — beschreibt Material + FX-Intensität + Silhouette-Feel
  elite:     "clean polished materials with subtle wear, teal cyan highlights on edges, faint engraved runes, dignified confident posture",
  epic:      "gently glowing purple-magenta arcane energy on armor seams, small floating translucent crystal fragments nearby, battle-worn but noble look, stronger aura",
  legendary: "rich golden aura wrapping the silhouette, slow-floating ember and spark particles, faint halo of light behind the head, iconic centered heroic silhouette, visibly more power than the others",
  // Legacy-Mapping
  common:    "clean polished materials with subtle wear, teal cyan highlights on edges, faint engraved runes",
  rare:      "clean polished materials with subtle wear, teal cyan highlights on edges, faint engraved runes",
  legend:    "rich golden aura wrapping the silhouette, slow-floating ember and spark particles, faint halo of light behind the head, iconic centered heroic silhouette",
};

const TYPE_MOD: Record<string, string> = {
  infantry: "heavy armor plating, shield and blunt/edged weapon, grounded stance, defender posture",
  cavalry:  "lightweight armor with flowing cloth, momentum-lines, dynamic mid-stride pose, aggressive forward lean",
  marksman: "lean form with ranged weapon (bow, crossbow, throwing blades), focused aim, high ground posture",
  mage:     "robes with arcane sigils, floating orb or staff, glowing eyes, levitating accessories, ethereal aura",
};

// Pro Typ die Idle-Animation beschreiben (subtle motion loop, Veo-freundlich mit Rhythmus)
const TYPE_ANIM: Record<string, string> = {
  infantry: "slow rhythmic breathing (about 4 seconds per cycle), chest rising and falling, shield held steady, armor plates catching the light with each breath, heavy cape swaying gently in a slow wind, weight solidly planted",
  cavalry:  "shoulders rising and falling with steady breath, long cloth and hair flowing in a continuous steady breeze, weight shifting slowly from one leg to the other, ready-to-move tension in the stance",
  marksman: "deep calm breathing, eyes slowly scanning left to right, fingers subtly adjusting grip, hood edge and hair fluttering gently, the ranged weapon lowering and raising a fraction as if tracking an unseen target",
  mage:     "arcane particles orbiting slowly around the hands in a smooth loop, outer robe hem levitating and undulating softly, body glow pulsing gently in a 3-second rhythm, eyes faintly glimmering with each pulse",
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

  // Charakter-Archetyp in generischer Beschreibung (ohne Eigennamen-Referenzen)
  const archetypeHint = [typeMod, roleMod].filter(Boolean).join(" ");

  if (in_.mode === "video") {
    // Veo 2 / Gemini Pro / Runway Gen-3 / Kling-tauglich.
    // Struktur: Shot → Subject → Style-Hooks → Motion mit Rhythmus → Kamera → Licht → Umgebung → Negatives.
    return [
      // 1) Shot-Spec
      `Shot: a 5-second seamlessly looping cinematic idle clip, vertical 9:16 portrait composition, 1080x1920, 24 frames per second.`,
      // 2) Subject
      `Subject: a single original humanoid warrior character, full body visible, standing centered on a dark rooftop at night. The character is clearly a fully invented, fictional character design (not based on any existing franchise or person).`,
      `The character wears a stylized mix of modern street-wear and light armor, with subtle engraved detailing.`,
      archetypeHint && `Character traits: ${archetypeHint}.`,
      `Rarity and material feel: ${rarityMod}.`,
      ability ? `Signature aura effect softly wrapping the character, themed as: ${ability.replace("signature ability: '", "").replace(/'/g, "")}. The aura pulses with the breathing rhythm.` : "",
      loreLine,
      // 3) Motion mit Rhythmus (Veo 2 mag Tempo-Hinweise)
      `Motion: ${animMod || "slow rhythmic breathing (about 4 seconds per cycle), clothing and hair reacting to a gentle wind, weight planted"}.`,
      `Movement is smooth, continuous, and gentle — no sudden actions, no camera cuts.`,
      // 4) Kamera
      `Camera: locked static medium-wide shot, no pan, no tilt, no zoom, no dolly. The character stays perfectly centered for the entire clip.`,
      // 5) Licht (Veo reagiert gut auf Richtungs-Angaben)
      `Lighting: teal cyan rim light from the character's left side, magenta-pink rim light from the right side, faint cool moonlight from above. Legendary characters also get warm gold rim highlights. Ambient particles (dust, sparks, mist) rise slowly around the character's feet.`,
      // 6) Umgebung
      `Background: deeply out-of-focus night cityscape, only soft blurred hints of distant neon and street lights in the far distance, heavy shadow. The background has very subtle parallax but never steals attention from the character.`,
      // 7) Loop-Qualität — strikte Anweisung fuer saubere Loops
      `The final frame must exactly match the first frame. Static poses at both start and end, identical character position and pose. The first and last frame must match so the clip loops seamlessly.`,
      // 8) Negatives
      `No audio, no sound, no music, no voice. Silent video only.`,
      `No text, no captions, no subtitles, no logos, no watermark, no UI overlays, no brand names, no celebrity likeness. Fully original invented character.`,
    ].filter(Boolean).join(" ");
  }

  // Standbild-Prompt (Gemini / Midjourney / Canva Dream Lab / Imagen)
  return [
    // 1) Shot-Spec
    `Cinematic character key art portrait, square 1:1, 1024x1024, single subject, centered composition.`,
    // 2) Subject
    `Subject: a single original humanoid warrior character, full body visible, 3/4 view, heroic standing pose, confident gaze.`,
    `The character wears a stylized mix of modern street-wear and light armor, with subtle engraved detailing. Fully invented, fictional character design (not based on any existing franchise or person).`,
    archetypeHint && `Character traits: ${archetypeHint}.`,
    `Rarity and material feel: ${rarityMod}.`,
    ability ? `Signature aura effect softly wrapping the character, themed as: ${ability.replace("signature ability: '", "").replace(/'/g, "")}.` : "",
    loreLine,
    // 3) Umgebung
    `Setting: dark rooftop at night, deeply out-of-focus city lights far in the background, heavy atmospheric shadow.`,
    // 4) Licht
    `Lighting: teal cyan rim light from the left, magenta-pink rim light from the right, faint cool moonlight from above. Warm gold rim highlights only for legendary characters. Slow-rising ambient particles (dust, sparks, mist) around the character.`,
    // 5) Qualität
    `High detail on face and hands, sharp focus on character, shallow depth of field.`,
    // 6) Negatives
    `No text, no captions, no logos, no watermark, no UI, no brand names, no celebrity likeness. Fully original invented character.`,
  ].filter(Boolean).join(" ");
}

// ──────────────────────────────────────────────────────────────────────────
// Map-Icon (Runner-Pin) + Runner-Light Prompts
// ──────────────────────────────────────────────────────────────────────────

// Icon-IDs bzw. -Namen die eine menschliche Figur zeigen sollen.
// Fuer diese Marker erzwingt der Prompt eine geschlechtsneutrale Silhouette.
const HUMAN_FIGURE_HINTS = ["foot","walker","runner","hero","basic","wanderer","athlet"];

export function buildMarkerPrompt(input: {
  name: string;
  hint?: string;
  mode: "image" | "video";
  id?: string;
  gender?: "neutral" | "male" | "female";
}): string {
  const idOrName = (input.id || input.name || "").toLowerCase();
  const isHuman = HUMAN_FIGURE_HINTS.some((h) => idOrName.includes(h));
  const gender = input.gender || "neutral";

  const humanInstruction = !isHuman ? "" :
    gender === "male"
      ? "GENDER: the human figure should clearly read as MALE — masculine silhouette, broader shoulders, " +
        "masculine athletic build. Still no individual face details, no beard, no celebrity likeness — " +
        "keep it a stylized universal male runner, athletic and heroic."
    : gender === "female"
      ? "GENDER: the human figure should clearly read as FEMALE — feminine silhouette, athletic runner build " +
        "with feminine proportions, hair (ponytail or bob) if helpful for readability. Still no individual face details, " +
        "no makeup specifics, no celebrity likeness — keep it a stylized universal female runner, athletic and heroic."
    : "GENDER-NEUTRAL: the human figure must be androgynous and non-binary in appearance — " +
      "no facial features, no visible chest, no gendered body shape, no long hair vs short hair cues, " +
      "no makeup, no masculine jawline, no feminine hips. A clean athletic stylized silhouette whose motion " +
      "and pose communicate the subject — not the gender. Representative of ANY runner, age-agnostic.";
  const noPinDisclaimer =
    "IMPORTANT: Render ONLY the standalone subject itself. " +
    "Do NOT add a map pin shape, NO teardrop marker, NO location-pin envelope, " +
    "NO pointed bottom tip, NO circular badge background, NO frame, NO plate, NO pedestal.";

  const fillDisclaimer =
    "The subject must be FULLY RENDERED and SOLIDLY FILLED — a complete, dimensional illustration " +
    "with form, light, shadow and material. NOT outline-only, NOT a flat wireframe, NOT a line-drawing sticker. " +
    "Think premium mobile-game icon quality (like Hearthstone / Marvel Snap / Clash Royale card art).";

  const styleGuidance =
    "Style MATCHES the subject naturally — let the motif drive the aesthetic: " +
    "a phoenix should feel fiery and mythical; an animal lively and recognizable with fur/feather texture; " +
    "a butterfly vivid and delicate. Do NOT force every icon into the same visual treatment.";

  const directionGuidance =
    "DIRECTION: the subject must face LEFT and/or move toward the LEFT side of the frame. " +
    "Profile view (side view), head and body oriented left. If it's an animal running, it runs to the LEFT. " +
    "If it's a human walking/running, they stride to the LEFT. Flying creatures: wings/body angled so they are heading LEFT. " +
    "This must be consistent across all map icons for visual coherence.";

  if (input.mode === "video") {
    return [
      `Shot: a 3-second seamlessly looping animated icon, square 1:1, 1024x1024, 30 fps, fully transparent background (alpha channel, PNG-style).`,
      `Subject: "${input.name}" — centered, iconic silhouette, readable at very small sizes (32-64 px).`,
      input.hint ? `Motif hint: ${input.hint}.` : "",
      humanInstruction,
      styleGuidance,
      directionGuidance,
      fillDisclaimer,
      noPinDisclaimer,
      `Motion: motion appropriate to the subject (e.g. flames flicker, wings flap slowly, sparkles drift, fur breathes). Slow bob 4-5 px if helpful. No rotation of the whole subject.`,
      `Lighting: warm-and-cool rim-light to pop against any background. Soft ambient glow appropriate to the subject's color.`,
      `The final frame must exactly match the first frame for seamless looping.`,
      `No audio. No text, no labels, no watermark, no logo, no background, no pin, no marker shape — fully transparent outside the subject silhouette.`,
    ].filter(Boolean).join(" ");
  }
  return [
    `A premium game icon representing "${input.name}", square 1:1, 1024x1024, centered on a fully transparent background (PNG with alpha).`,
    input.hint ? `Motif hint: ${input.hint}.` : "",
    humanInstruction,
    styleGuidance,
    fillDisclaimer,
    noPinDisclaimer,
    `Lighting: warm-and-cool rim-light for readability, soft ambient glow appropriate to the subject's theme.`,
    `Iconic readable silhouette usable at 32-64 px. Crisp edges, rich material detail, vibrant colors, no anti-aliased halo.`,
    `No text, no labels, no watermark, no logo, no background, no pin, no map-marker shape, no teardrop, no frame, no pedestal.`,
  ].filter(Boolean).join(" ");
}

export function buildPinThemePrompt(input: {
  name: string; description: string; bg: string; accent: string; glow: string; mode: "image" | "video";
}): string {
  const paletteLine = `Background base: ${input.bg}. Primary accent: ${input.accent}. Ambient glow: ${input.glow}.`;
  if (input.mode === "video") {
    return [
      `Shot: a 3-second seamlessly looping map-pin base tile animation, square 1:1, 1024x1024, 30 fps, fully transparent background outside the tile shape.`,
      `Subject: a stylized map-pin base tile representing the theme "${input.name}" — ${input.description}.`,
      paletteLine,
      `Style: cyber-fantasy game-UI, thick clean outlines, soft inner glow, subtle particle motion (sparks, mist, scan-lines depending on theme).`,
      `Motion: gentle pulsing glow, slow particle drift. No camera movement. First and last frame identical.`,
      `No audio, no text, no watermark, no logos, no brand names.`,
    ].filter(Boolean).join(" ");
  }
  return [
    `A stylized map-pin base tile representing the theme "${input.name}" — ${input.description}.`,
    `Square 1:1, 1024x1024, centered, fully transparent outside the tile shape (PNG with alpha).`,
    paletteLine,
    `Style: cyber-fantasy game-UI, thick clean outlines, soft inner glow, readable at small sizes.`,
    `No text, no labels, no watermark, no logos.`,
  ].filter(Boolean).join(" ");
}

export function buildLightPrompt(input: { name: string; colors: string[]; mode: "image" | "video" }): string {
  const colorStr = input.colors.join(", ");
  if (input.mode === "video") {
    return [
      `Shot: a 3-second seamlessly looping animated runner trail/light effect, horizontal 16:9, 1920x1080, 30 fps, fully transparent background.`,
      `Subject: a glowing energy trail representing a runner's light named "${input.name}", stretching horizontally across the frame.`,
      `Color palette: ${colorStr}. Smooth gradient along the trail.`,
      `Motion: energy particles flowing from left to right, slight shimmer, subtle pulse. Trail stays in place, only particles animate.`,
      `Style: neon, glowing, soft bloom, high contrast. Cyber-fantasy aesthetic.`,
      `The final frame must exactly match the first frame for seamless looping.`,
      `No audio. No text, no characters, no background — fully transparent outside the light trail.`,
    ].filter(Boolean).join(" ");
  }
  return [
    `A glowing horizontal runner's light trail called "${input.name}", 16:9 landscape, 1920x1080, fully transparent background (PNG with alpha).`,
    `Color palette: ${colorStr}. Smooth gradient along the trail, soft bloom, neon glow.`,
    `Style: cyber-fantasy energy streak, sharp core, soft outer halo.`,
    `No text, no characters, no watermark, no background.`,
  ].filter(Boolean).join(" ");
}
