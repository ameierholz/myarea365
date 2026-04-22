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
  infantry: "heavy protective armor plating, sturdy shield and ceremonial implement, grounded stance, guardian posture",
  cavalry:  "lightweight armor with flowing cloth, momentum-lines, dynamic mid-stride pose, confident forward lean",
  marksman: "lean form with a stylized ranged implement, focused gaze, high-ground posture",
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
  dps:      "dynamic action pose, sleek silhouette, implement held with confidence",
  tank:     "solid defensive stance, shield or barrier, imposing bulky outline",
  support:  "caring protective pose, one hand extended in support gesture, warm secondary light",
  balanced: "versatile mid-action pose, tools of both offense and defense visible",
};

/** Heuristik: Geschlecht aus dem deutschen Titel ableiten. */
export function detectGenderFromName(name: string): "male" | "female" {
  const n = name.toLowerCase();
  // Deutsch: -in, -erin, -frau, -hexe, -priesterin, -königin, -gräfin, -herrin, -dame ... → weiblich
  if (/(frau|hexe|herrin|dame|königin|gräfin|prinzessin|amazone|walküre|nonne|priesterin)\b/.test(n)) return "female";
  if (/(in|erin|ärztin|meisterin|jägerin|schützin|tänzerin|mischerin|klingerin|läuferin|kriegerin|zauberin|magierin|heilerin)$/.test(n)) return "female";
  return "male";
}

/** Deterministischer Hash (0..n-1) für stabile Variations-Wahl aus dem Namen. */
function nameHashPick<T>(name: string, list: readonly T[]): T {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return list[h % list.length];
}

// Pool 1: Haar-Varianten (damit nicht alle gleich aussehen)
const HAIR_VARIANTS_MALE = [
  "short cropped hair with an undercut fade, tattoos on temple",
  "long black braided dreads tied back, silver rings in hair",
  "shaved head with glowing ritual scars on the skull",
  "shoulder-length wavy dark hair, one side pinned with an engraved clasp",
  "buzz-cut with a single braided warrior tail falling over the shoulder",
  "silver-gray tousled hair swept back, sharp widow's peak",
  "tightly coiled natural afro with a faint arcane glow threading through it",
  "long asymmetric undercut, one side shaved with glowing etched patterns",
];
const HAIR_VARIANTS_FEMALE = [
  "tight warrior braid with metal beads woven in, side of head partially shaved",
  "short pixie cut with glowing circuit tattoos at the nape",
  "long wavy dark hair held back with a bone clasp",
  "twin braids wrapped around the head like a crown",
  "high tight ponytail with silver-threaded wrap",
  "long silver-blue ombre hair fluttering in a low wind",
  "cropped asymmetric bob with rune sidecuts glowing faintly",
  "locs partially gathered up, some strands loose across one shoulder",
];

// Pool 2: Rüstungs-Material (sichtbare Variation)
const ARMOR_MATERIALS = [
  "matte obsidian ceramic plating with inlaid cyan circuit veins",
  "blackened forged steel scale mail with leather straps",
  "boiled leather armor stitched with silvered runes, worn beneath a heavy cloak",
  "polished brass plate with etched filigree, cloth wraps on forearms",
  "tattered monk-robes over hidden chain, exposed tattooed forearms",
  "rugged tactical gear fused with bone-carved pauldrons",
  "dark moss-green cloak over mail, wolfskin mantle across shoulders",
  "lacquered red samurai-inspired plates with black trim",
  "tech-woven fabric with rigid armor panels at shoulders and chest",
  "frost-cracked steel plate riming with ice crystals",
  "volcanic-stone plate still faintly glowing with heat at the seams",
  "light ranger-leather with hand-painted clan markings",
];

// Pool 3: Signatur-Farbe der Aura (jeder Wächter anders)
const AURA_COLOR_POOL = [
  { name: "cyan plasma",         primary: "electric cyan", secondary: "deep teal" },
  { name: "magenta neon",        primary: "hot magenta",   secondary: "deep violet" },
  { name: "emerald wildfire",    primary: "emerald green", secondary: "pine-black" },
  { name: "crimson embers",      primary: "blood red",     secondary: "ember orange" },
  { name: "amber lightning",     primary: "amber gold",    secondary: "burnt orange" },
  { name: "frost aurora",        primary: "pale blue-white", secondary: "cold steel gray" },
  { name: "sulfur toxic green",  primary: "acid yellow-green", secondary: "bile black" },
  { name: "arcane purple storm", primary: "royal violet",  secondary: "midnight black" },
  { name: "solar gold",          primary: "warm sun-gold", secondary: "bronze" },
  { name: "void indigo",         primary: "indigo",        secondary: "pitch black" },
];

// Pool 4: Begleit-FX (Dämpfe, Partikel etc.)
const EFFECT_MOTIFS = [
  "curling smoke that rises slowly around the feet",
  "floating embers drifting upward around the silhouette",
  "thin streams of liquid light spiraling around the arms",
  "faint shards of crystalline energy orbiting the torso",
  "glowing runes slowly circling mid-air around the character",
  "fine rain evaporating on a hidden heat shield around the body",
  "tiny flickering motes of light tracing the character's outline",
  "shimmering heat-haze distortion radiating from the core",
  "slow orbiting fragments of cracked stone reassembling and drifting",
  "wisps of aurora-like light flowing from the shoulders",
];

// Pool 5: Pose-Haltung (für Standbild mehr Abwechslung)
const POSES = [
  "grounded heroic stance, feet shoulder-width, one hand on hip",
  "half-turned 3/4 view, ceremonial implement resting across the shoulders",
  "one knee bent, leaning forward over a grounded staff",
  "arms crossed, chin slightly raised, calm confident stare",
  "mid-stride forward, cloak catching the air behind",
  "single hand raised as if channeling, other hand loose at the side",
  "back-turned three-quarter view with head looking over shoulder",
  "elegant ready-stance, implement held low along the side",
];

export function buildArchetypePrompt(input: ArchetypePromptInput | string, legacyRarity?: "common" | "rare" | "epic" | "legend"): string {
  const in_: ArchetypePromptInput = typeof input === "string"
    ? { name: input, rarity: legacyRarity ?? "epic" }
    : input;

  const rarityMod = RARITY_MOD[in_.rarity] ?? RARITY_MOD.epic;
  const typeMod   = in_.guardianType ? TYPE_MOD[in_.guardianType] : "";
  const roleMod   = in_.role         ? ROLE_MOD[in_.role]         : "";
  const animMod   = in_.guardianType ? TYPE_ANIM[in_.guardianType] : "";
  const abilityTheme = in_.abilityName ? in_.abilityName.replace(/['"]/g, "") : "";

  // Deterministische Variation je Wächter-Name
  const gender = detectGenderFromName(in_.name);
  const hair   = nameHashPick(in_.name + ":hair",   gender === "female" ? HAIR_VARIANTS_FEMALE : HAIR_VARIANTS_MALE);
  const armor  = nameHashPick(in_.name + ":armor",  ARMOR_MATERIALS);
  const aura   = nameHashPick(in_.name + ":aura",   AURA_COLOR_POOL);
  const effect = nameHashPick(in_.name + ":effect", EFFECT_MOTIFS);
  const pose   = nameHashPick(in_.name + ":pose",   POSES);

  const subjectBase = gender === "female"
    ? "a stylized heroic female guardian character with a clearly feminine silhouette, fictional game character"
    : "a stylized heroic male guardian character with a clearly masculine silhouette, fictional game character";

  const archetypeHint = [typeMod, roleMod].filter(Boolean).join(" ");

  // ══════ VIDEO-PROMPT ══════
  if (in_.mode === "video") {
    return [
      // 1) Shot-Spec — quadratisch und transparent, perfekt loopbar
      `Shot: a 4-second perfectly seamless looping idle clip, square 1:1 composition, 1024x1024, 24 fps, fully TRANSPARENT BACKGROUND with alpha channel (NO BACKGROUND, the character floats on pure transparency).`,
      // 2) Subject
      `Subject: ${subjectBase}, full body visible, ${pose}, fully invented fictional character (not based on any existing franchise or celebrity).`,
      `Hair and head: ${hair}.`,
      `Armor and outfit: ${armor} — unique to this specific character, distinct from other characters in the set.`,
      archetypeHint && `Character archetype traits: ${archetypeHint}.`,
      `Rarity and material feel: ${rarityMod}.`,
      // 3) Aura / Signature-FX — pro Wächter eigene Farbe
      `Signature aura wrapping the character, themed as "${aura.name}" — dominant ${aura.primary} with ${aura.secondary} depth. The aura pulses gently in sync with breathing.`,
      abilityTheme && `The aura also visually references the character's signature ability "${abilityTheme}".`,
      `Additional effect: ${effect}.`,
      // 4) Motion
      `Motion: ${animMod || "slow rhythmic breathing (about 4 seconds per cycle), cloth, hair, and aura reacting to a steady gentle wind, weight planted"}. Smooth, continuous, no sudden actions.`,
      // 5) Camera
      `Camera: locked static medium-wide shot, no pan, no tilt, no zoom, no dolly, character perfectly centered the entire clip.`,
      // 6) Seamless-Loop — ganz vorne + ganz hinten identisch
      `CRITICAL LOOP REQUIREMENT: the exact last frame (frame 96 at 24fps) must be pixel-identical to the first frame (frame 1). Pose, aura intensity, particle positions, hair position — everything resets to frame 1 at the end. No frozen hold, no fade, no black — just a pure mathematical loop where frame_last = frame_first so the clip plays forever without a visible seam or stutter.`,
      // 7) Negatives
      `NO BACKGROUND. NO rooftop, NO city, NO sky, NO moon, NO ground. Character is rendered against pure transparent alpha channel only.`,
      `No audio, no sound, no music, no voice. Silent video only.`,
      `No text, no captions, no subtitles, no logos, no watermark, no UI overlays, no brand names, no celebrity likeness.`,
    ].filter(Boolean).join(" ");
  }

  // ══════ IMAGE-PROMPT ══════
  return [
    `Cinematic character key art, square 1:1, 1024x1024, single subject, TRANSPARENT BACKGROUND (PNG with alpha channel, NO BACKGROUND — character floats on pure transparency).`,
    `Subject: ${subjectBase}, full body visible, ${pose}, confident heroic expression. Fully invented fictional character (not based on any existing franchise or celebrity).`,
    `Hair and head: ${hair}.`,
    `Armor and outfit: ${armor} — unique and distinct, so this character does not look like any other character in the set.`,
    archetypeHint && `Character archetype traits: ${archetypeHint}.`,
    `Rarity and material feel: ${rarityMod}.`,
    `Signature aura wrapping the character, themed as "${aura.name}" — dominant ${aura.primary} with ${aura.secondary} depth.`,
    abilityTheme && `Aura also visually references the character's signature ability "${abilityTheme}".`,
    `Additional effect around the character: ${effect}.`,
    `Lighting: ${aura.primary} rim light from the left, ${aura.secondary} rim light from the right, subtle top-light from above.`,
    `High detail on face and hands, sharp focus on character, tight silhouette.`,
    `NO BACKGROUND. NO rooftop, NO city, NO sky, NO moon, NO ground shadows on a floor. Pure alpha transparency outside the character silhouette.`,
    `No text, no captions, no logos, no watermark, no UI overlays, no brand names, no celebrity likeness.`,
  ].filter(Boolean).join(" ");
}

// ──────────────────────────────────────────────────────────────────────────
// Map-Icon (Runner-Pin) + Runner-Light Prompts
// ──────────────────────────────────────────────────────────────────────────

// Icon-IDs bzw. -Namen die eine menschliche Figur zeigen sollen.
// Fuer diese Marker erzwingt der Prompt eine geschlechtsneutrale Silhouette.
const HUMAN_FIGURE_HINTS = ["foot","walker","runner","hero","basic","wanderer","athlet"];

// Icon-IDs/Namen die ein Tier zeigen (für Walking-Pose Erzwingen).
const ANIMAL_FIGURE_HINTS = [
  "dog","cat","wolf","fox","bear","deer","horse","rabbit","hare","tiger","lion",
  "owl","hawk","eagle","falcon","raven","butterfly","bee","beetle",
  "hund","katze","wolf","fuchs","baer","hirsch","pferd","hase","tiger","loewe",
  "eule","falke","adler","rabe","schmetterling","biene","kaefer","tier","pet",
];

export function buildMarkerPrompt(input: {
  name: string;
  hint?: string;
  mode: "image" | "video";
  id?: string;
  gender?: "neutral" | "male" | "female";
}): string {
  const idOrName = (input.id || input.name || "").toLowerCase();
  const hintLower = (input.hint || "").toLowerCase();
  const combined = `${idOrName} ${hintLower}`;
  const isHuman = HUMAN_FIGURE_HINTS.some((h) => combined.includes(h));
  const isAnimal = ANIMAL_FIGURE_HINTS.some((h) => combined.includes(h));
  const needsWalkingPose = isHuman || isAnimal;
  const gender = input.gender || "neutral";

  const walkingPoseInstruction = !needsWalkingPose ? "" :
    isHuman
      ? "POSE: clear WALKING or JOGGING stride — full body visible including BOTH LEGS and BOTH FEET from hip to toe. " +
        "One leg forward, one leg back in mid-step, knees slightly bent, feet fully drawn (not cropped, not hidden). " +
        "Arms swinging naturally. Dynamic forward motion readable at a glance."
      : "POSE: clear WALKING / TROTTING / RUNNING / FLYING motion appropriate to the animal — " +
        "full body visible including ALL LEGS and PAWS/HOOVES (or wings for birds/insects) from shoulder to foot. " +
        "Legs in mid-step (one set forward, one back), feet fully drawn and not cropped. " +
        "Dynamic forward motion readable at a glance.";

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
    "DIRECTION: the subject MUST face LEFT and move toward the LEFT side of the frame. " +
    "Strict side-profile view (side view), head and body oriented LEFT. If it's an animal running, it runs to the LEFT. " +
    "If it's a human walking/running, they stride to the LEFT. Flying creatures: wings/body angled so they are heading LEFT. " +
    "This is a mandatory rule for all map icons — no front-facing, no three-quarter, no right-facing subjects.";

  if (input.mode === "video") {
    return [
      `Shot: a 3-second seamlessly looping animated icon, square 1:1, 1024x1024, 30 fps, fully transparent background (alpha channel, PNG-style).`,
      `Subject: "${input.name}" — centered, iconic silhouette, readable at very small sizes (32-64 px).`,
      input.hint ? `Motif hint: ${input.hint}.` : "",
      humanInstruction,
      walkingPoseInstruction,
      styleGuidance,
      directionGuidance,
      fillDisclaimer,
      noPinDisclaimer,
      needsWalkingPose
        ? `Motion: looping walking/running cycle — legs alternating in a clean stride loop, feet never disappearing from view, arms/tail/wings swinging in rhythm. Camera and body position stay fixed; only the walk cycle animates.`
        : `Motion: motion appropriate to the subject (e.g. flames flicker, wings flap slowly, sparkles drift, fur breathes). Slow bob 4-5 px if helpful. No rotation of the whole subject.`,
      `Lighting: warm-and-cool rim-light to pop against any background. Soft ambient glow appropriate to the subject's color.`,
      `The final frame must exactly match the first frame for seamless looping.`,
      `No audio. No text, no labels, no watermark, no logo, no background, no pin, no marker shape — fully transparent outside the subject silhouette.`,
    ].filter(Boolean).join(" ");
  }
  return [
    `A premium game icon representing "${input.name}", square 1:1, 1024x1024, centered on a fully transparent background (PNG with alpha).`,
    input.hint ? `Motif hint: ${input.hint}.` : "",
    humanInstruction,
    walkingPoseInstruction,
    directionGuidance,
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

export const SIEGEL_TYPES = [
  { id: 'infantry', name: 'Infanterie-Siegel', hint: 'crossed swords, shield', color: '#60a5fa', accent: 'steel blue', theme: 'heavy armor, plate mail, stalwart defender' },
  { id: 'cavalry',  name: 'Kavallerie-Siegel', hint: 'rearing horse, lance', color: '#FF6B4A', accent: 'amber orange', theme: 'charging cavalry, mounted warrior, speed' },
  { id: 'marksman', name: 'Schützen-Siegel',   hint: 'crossed arrows, bow', color: '#4ade80', accent: 'forest green', theme: 'archer precision, longbow, falcon feathers' },
  { id: 'mage',     name: 'Magier-Siegel',     hint: 'arcane rune, wand',   color: '#a855f7', accent: 'arcane purple', theme: 'spellcraft, glowing runes, sorcery' },
  { id: 'universal',name: 'Universal-Siegel',  hint: 'diamond, all-seal',   color: '#FFD700', accent: 'royal gold',    theme: 'legendary wildcard seal, ouroboros, cosmic emblem' },
] as const;
export type SiegelId = (typeof SIEGEL_TYPES)[number]['id'];

export function buildSiegelPrompt(input: { id: SiegelId; name: string; mode: 'image' | 'video' }): string {
  const s = SIEGEL_TYPES.find((x) => x.id === input.id);
  if (!s) return '';
  const base = [
    `A heraldic ${s.name.toLowerCase()} emblem / wax seal, centered composition on a circular medallion, 1024x1024, fully transparent background (PNG with alpha).`,
    `Iconography: ${s.hint}. Theme: ${s.theme}.`,
    `Color palette: dominant ${s.accent} (${s.color}) with dark bronze/black metallic rim, subtle gold filigree, faint rune etching on border.`,
    `Style: high-detail fantasy coat-of-arms, embossed metal, wax-seal texture, weathered edges, dramatic rim-light, game-icon quality.`,
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
  { id: "potion_hp_s",          name: "Kleiner HP-Trank",          rarity: "common", emoji: "🧪", hint: "small crimson healing vial, ruby-red liquid, bubbles" },
  { id: "potion_atk_s",         name: "Kleiner Angriffstrank",     rarity: "common", emoji: "⚔️", hint: "small orange attack elixir, amber liquid, sword etched on bottle" },
  { id: "potion_def_s",         name: "Kleiner Verteidigungstrank",rarity: "common", emoji: "🛡️", hint: "small blue defense potion, steel-blue liquid, shield rune" },
  { id: "potion_speed_s",       name: "Kleiner Geschwindigkeitstrank", rarity: "common", emoji: "💨", hint: "small sky-blue speed elixir, swirling vapors, feather motif" },
  { id: "potion_regen_s",       name: "Kleiner Heiltrank",         rarity: "common", emoji: "💚", hint: "small emerald regeneration flask, soft glow, leaf motif" },
  { id: "potion_hp_m",          name: "HP-Trank",                  rarity: "rare",   emoji: "🧪", hint: "medium deep-crimson vial with gold cap, thick glowing liquid" },
  { id: "potion_atk_m",         name: "Angriffstrank",             rarity: "rare",   emoji: "⚔️", hint: "medium orange bottle, crossed swords emblem" },
  { id: "potion_def_m",         name: "Verteidigungstrank",        rarity: "rare",   emoji: "🛡️", hint: "medium sapphire bottle, tower shield emblem" },
  { id: "potion_crit_m",        name: "Krit-Trank",                rarity: "rare",   emoji: "💥", hint: "sharp magenta vial, lightning rune, sparks" },
  { id: "potion_lifesteal_m",   name: "Bluttrank",                 rarity: "rare",   emoji: "🩸", hint: "dark crimson bottle with gothic filigree engravings, deep ruby liquid, ornate stopper" },
  { id: "potion_mana_m",        name: "Manatrank",                 rarity: "rare",   emoji: "⚡", hint: "electric blue flask, arcing bolts inside" },
  { id: "potion_hp_l",          name: "Großer HP-Trank",           rarity: "epic",   emoji: "🧪", hint: "large ornate ruby-red flask, gold trim, glowing runes on bottle" },
  { id: "potion_atk_l",         name: "Großer Angriffstrank",      rarity: "epic",   emoji: "⚔️", hint: "large fiery-orange flask, jagged spikes on bottle" },
  { id: "potion_thorns_l",      name: "Dornentrank",               rarity: "epic",   emoji: "🌵", hint: "dark green vial wrapped in thorny vines, spikes" },
  { id: "potion_penetration_l", name: "Durchdringungstrank",       rarity: "epic",   emoji: "🎯", hint: "black arrow-shaped flask, target reticle" },
  { id: "potion_regen_l",       name: "Großer Heiltrank",          rarity: "epic",   emoji: "💚", hint: "large glowing emerald flask, swirling life-energy" },
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
    `A fantasy-game potion bottle icon for "${input.name}", centered composition, 1024x1024, fully transparent background (PNG with alpha).`,
    `Bottle specifics: ${input.hint}. Material: ${rarityColors[input.rarity] ?? rarityColors.common}. Lighting: ${rarityGlow[input.rarity] ?? rarityGlow.common}.`,
    `Style: high-detail painterly game icon, Diablo/Divinity/Final-Fantasy quality, dramatic rim-light, readable at 64px.`,
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
    `A rank insignia badge for runner rank "${input.name}", centered circular medallion composition, 1024x1024, fully transparent background (PNG with alpha).`,
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

