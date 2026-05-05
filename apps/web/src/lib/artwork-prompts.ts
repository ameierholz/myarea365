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

// ─── BACKGROUND-SPEC: Greenscreen für Chroma-Key ─────────────────────────
// Die App keyed pure-green (#00FF00) zur Render-Zeit raus via SVG-Filter
// (#ma365-chroma-black). AI-Generatoren (MJ/DALL·E/Imagen/Veo) liefern unzuverlässig
// echtes Alpha — pure green ist verlässlicher und wird identisch aussehen wie transparent.
export const GREEN_BG_RULE = `Background: pure chroma-key green #00FF00 (RGB 0,255,0), filling the ENTIRE frame uniformly behind the subject — corner to corner, no vignette, no gradient, no shadows, no fade. The green will be removed automatically at render time via chroma-key filter. Do NOT use transparent PNG, white, or any other background color. Subject must NOT contain pure-green pixels (use teal/forest-green instead if needed).`;

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
    material: "thick forged steel plates with riveted seams, leather straps, scarred dark iron",
    style:    "imposing, heavy, fortress-like, sharp ridged edges, defensive posture",
    energyColor: "#60a5fa",
    theme:    "fortress / bulwark / oath-bound defender",
  },
  support: {
    material: "polished pale gold metal with woven white silk, glowing inset gems, etched arcane sigils",
    style:    "ornate, elegant, slightly ethereal, soft inner glow",
    energyColor: "#a855f7",
    theme:    "blessing / sanctified / arcane priestly",
  },
  ranged: {
    material: "lightweight lacquered wood with dark green leather wraps, brass fittings, feather inlays",
    style:    "aerodynamic, lean, hunter-coded, precise tooling marks",
    energyColor: "#4ade80",
    theme:    "hunter / sniper / sky-watcher",
  },
  melee: {
    material: "blackened sharpened steel with crimson leather wraps, exposed cutting edges, predator details",
    style:    "fast, sleek, aggressive, lots of edges, killing-tool aesthetic",
    energyColor: "#FF6B4A",
    theme:    "duelist / assassin / blade-dancer",
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
    `Premium fantasy game item icon, square 1:1, 1024x1024, fully transparent background (PNG with alpha).`,
    `Subject: ${slotHint}.`,
    `Class theme: ${profile.theme}. Material: ${profile.material}. Style: ${profile.style}.`,
    `Rarity: ${rarityLevel} — ${rarity.effect}. Accent glow color ${profile.energyColor}.`,
    `Composition: item slightly tilted toward the viewer, centered, subtle drop shadow beneath. Item fills ~70% of frame width with a clean 10% margin on all sides — silhouette must NOT touch frame edges.`,
    `Style: high-detail painterly game icon (Diablo / Path-of-Exile / Final-Fantasy quality), tight rim-light, readable at 64px in an inventory slot.`,
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

/** Prompt für Wächter-Archetyp (Charakter-Illustration oder animiertes Video) */
export type ArchetypeSpecies =
  | "human" | "elf" | "orc" | "beast" | "construct" | "spirit"
  | "undead" | "demon" | "celestial" | "dragonkin" | "cosmic"
  | "bird" | "desert";

export type ArchetypePromptInput = {
  name: string;
  rarity: "common" | "rare" | "legend" | "elite" | "epic" | "legendary";
  classId?: "tank" | "support" | "ranged" | "melee" | null;
  guardianType?: "infantry" | "cavalry" | "marksman" | "mage" | null;
  role?: "dps" | "tank" | "support" | "balanced" | null;
  species?: ArchetypeSpecies | string | null;
  gender?: "male" | "female" | "neutral" | null;
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

// Klassen-Mod (neue 4-Klassen-Logik) — ersetzt das alte TYPE_MOD/ROLE_MOD-Paar.
const CLASS_MOD: Record<string, string> = {
  tank:    "heavy protective armor plating, large shield or barrier, imposing bulky silhouette, grounded defensive stance, guardian posture",
  melee:   "lean dynamic build, dual close-combat blades or weapon held mid-swing, mid-stride combat pose, sleek silhouette with momentum-lines, confident forward lean",
  ranged:  "lean focused form holding a stylized ranged implement (bow / staff / arcane orb / firearm-analog), elevated grounded stance, eyes locked on a distant point",
  support: "caring protective pose, one hand extended in a casting / blessing gesture, robe with arcane sigils, warm secondary light around the casting hand, ethereal aura around the head",
};

// Spezies-Profile — DAS ist der Hauptgrund warum Wächter unterschiedlich aussehen.
// Jede Spezies hat eine eigene Silhouette / Hautton / Körperbau / Augen / Detail-Marker.
// Wird deterministisch über die Spalte `species` aus der DB gewählt — KEIN Hash-Pick.
const SPECIES_PROFILE: Record<string, { subject: string; signature: string; auraColor: { name: string; primary: string; secondary: string } }> = {
  human: {
    subject: "a stylized heroic human character with realistic anatomy, varied skin tones (warm tan to deep brown), expressive eyes, naturally proportioned body",
    signature: "small visible scars or tattoos, weathered leather details, woven cloth elements with stitched edging",
    auraColor: { name: "amber lightning", primary: "amber gold", secondary: "burnt orange" },
  },
  elf: {
    subject: "a tall slender elven character with elongated pointed ears, almond-shaped luminous eyes, fair pale skin or sage-green skin, graceful otherworldly bone structure, slightly larger pupils",
    signature: "delicate silver filigree etched into armor, woven leaf or vine motifs, faint leyline tattoos along the jaw or forearms",
    auraColor: { name: "frost aurora", primary: "pale blue-white", secondary: "cold steel gray" },
  },
  orc: {
    subject: "a massive muscular orc character with green-grey or dark olive skin, prominent lower tusks protruding from jaw, thick brow ridge, broad shoulders far wider than the hips, scarred knuckles, heavy bone structure",
    signature: "tribal warpaint streaks across the face, bone or tooth jewelry, crude iron rings woven into hair, scars from old battles",
    auraColor: { name: "crimson embers", primary: "blood red", secondary: "ember orange" },
  },
  beast: {
    subject: "a humanoid beast-folk character — anthropomorphic with animal features (rat-like snout / amphibian skin / feline ears) — fur or scaled skin texture clearly visible, animal-shaped eyes, partially digitigrade legs, subtle non-human paw or claw hands",
    signature: "tufted fur or moist amphibian skin, animal-pattern markings, totems and bone fetishes hanging from belt",
    auraColor: { name: "magenta neon", primary: "hot magenta", secondary: "deep violet" },
  },
  construct: {
    subject: "a stone or metal CONSTRUCT character — NOT human flesh, but a sculpted humanoid figure made of carved rock / weathered bronze / fused crystals. Visible mortar lines, glowing runes etched directly into the body, no eyes (just glowing sockets), no facial expression, golem-like presence",
    signature: "cracked stone seams glowing from within, runic inscriptions all over the chest plate, no actual face — only an engraved mask with luminous slits",
    auraColor: { name: "amber lightning", primary: "amber gold", secondary: "burnt orange" },
  },
  spirit: {
    subject: "a SEMI-TRANSLUCENT spirit / ghost character — vaguely humanoid silhouette but with intangible flowing edges that dissipate into wisps, no solid feet (the lower body fades into mist), glowing hollow eye-sockets, no skin, no fabric — just light and vapor in a humanoid shape",
    signature: "wisps of light trailing off the shoulders and lower body, hollow burning eye-sockets, the body itself emits the aura",
    auraColor: { name: "void indigo", primary: "deep indigo", secondary: "pitch black" },
  },
  undead: {
    subject: "a regal undead lich-king character — gaunt skeletal face with leathery grey skin pulled tight over the bones, sunken eye-sockets glowing from within, visible skull cheekbones, withered hands with prominent finger bones, long ragged ceremonial robes",
    signature: "exposed jawbone visible at the corners of the mouth, a tattered cloak in deep purples and rotten gold, an iron crown set with cracked gemstones",
    auraColor: { name: "void indigo", primary: "deep indigo", secondary: "pitch black" },
  },
  demon: {
    subject: "a demonic infernal character — crimson or charcoal skin with cracked glowing magma-like fissures running across the body, two backwards-curving horns growing from the temples, slit pupils with glowing irises, prominent canine fangs, clawed fingers, optional bat-like wings folded behind",
    signature: "glowing lava cracks across the chest and arms, soot-blackened skin around the horns, smoldering breath",
    auraColor: { name: "crimson embers", primary: "blood red", secondary: "ember orange" },
  },
  celestial: {
    subject: "a celestial angel-like character with luminous porcelain-white skin, faintly gold-glowing eyes without visible pupils, several pairs of feathered wings folded behind the back, a thin floating golden halo behind the head, serene expression",
    signature: "feathered wings (two to six pairs) in soft white-gold, floating halo, golden sigils faintly lit on the breastplate",
    auraColor: { name: "solar gold", primary: "warm sun-gold", secondary: "bronze" },
  },
  dragonkin: {
    subject: "a half-dragon character — humanoid build but covered in iridescent scales (deep emerald / volcanic red / sapphire blue), draconic features: small ridged horns, vertical-slit reptilian pupils, clawed fingers, optional thick reptilian tail, often a single small folded wing or scaled cape",
    signature: "iridescent scales catching the light, ridged spinal plates along the back, draconic claws, smoke wisps at the corners of the mouth",
    auraColor: { name: "ruby plasma", primary: "ruby pink", secondary: "dark carmine" },
  },
  cosmic: {
    subject: "a cosmic / star-touched character — deep midnight-blue or violet skin with constellations of softly glowing star-points scattered across it, hair appearing as a flowing nebula of stardust, eyes that look like tiny galaxies, the silhouette gently bending light around it",
    signature: "constellations etched into skin glowing like points of light, hair made of slow-flowing nebula clouds, faint orbiting micro-stars near the head",
    auraColor: { name: "arcane purple storm", primary: "royal violet", secondary: "midnight purple" },
  },
  bird: {
    subject: "a humanoid avian character — feathered humanoid (kenku / aarakocra style) with a curved hard beak instead of a mouth, large round eyes on the sides of the head, feathers covering arms and shoulders, clawed bird-feet, often crested feathers on the head",
    signature: "long primary feathers on forearms, crested head plume, sharp keratin beak, talon-shaped feet",
    auraColor: { name: "frost aurora", primary: "pale blue-white", secondary: "cold steel gray" },
  },
  desert: {
    subject: "a sun-weathered desert nomad — tan-bronze human skin tone deepened to leather by wind and sun, dark sun-squinted eyes, long flowing wraps and headscarves of sand-bleached fabric, partially exposed muscular forearms, a chest-mounted talisman of bone or turquoise",
    signature: "long sand-colored linen wraps, leather amulets, kohl-marked eyes against weather-darkened skin, scars from desert raids",
    auraColor: { name: "amber lightning", primary: "amber gold", secondary: "burnt orange" },
  },
};

// Pro KLASSE eigene Idle-Animation (subtle motion loop, Veo-freundlich mit Rhythmus)
const CLASS_ANIM: Record<string, string> = {
  tank:    "slow rhythmic breathing (about 4 seconds per cycle), chest rising and falling, shield held steady at the side, armor plates catching the light with each breath, heavy cape swaying gently in a slow wind, weight solidly planted",
  melee:   "shoulders rising and falling with steady breath, long cloth and hair flowing in a continuous steady breeze, weight shifting slowly from one leg to the other, weapon hand subtly twitching as if eager, ready-to-move tension in the stance",
  ranged:  "deep calm breathing, eyes slowly scanning left to right, fingers subtly adjusting grip on the ranged implement, hood edge and hair fluttering gently, the implement lowering and raising a fraction as if tracking an unseen target",
  support: "arcane particles orbiting slowly around the casting hand in a smooth loop, outer robe hem levitating and undulating softly, body glow pulsing gently in a 3-second rhythm, eyes faintly glimmering with each pulse",
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
  "dark indigo cloak over mail, wolfskin mantle across shoulders",
  "lacquered red samurai-inspired plates with black trim",
  "tech-woven fabric with rigid armor panels at shoulders and chest",
  "frost-cracked steel plate riming with pale ice crystals",
  "volcanic-stone plate still faintly glowing with heat at the seams",
  "light ranger-leather with hand-painted clan markings in red and orange",
];

// Pool 3: Signatur-Farbe der Aura (KEINE grünen Töne — wird gegen Green-Screen keyed)
const AURA_COLOR_POOL = [
  { name: "cyan plasma",         primary: "electric cyan",   secondary: "deep teal" },
  { name: "magenta neon",        primary: "hot magenta",     secondary: "deep violet" },
  { name: "crimson embers",      primary: "blood red",       secondary: "ember orange" },
  { name: "amber lightning",     primary: "amber gold",      secondary: "burnt orange" },
  { name: "frost aurora",        primary: "pale blue-white", secondary: "cold steel gray" },
  { name: "arcane purple storm", primary: "royal violet",    secondary: "midnight purple" },
  { name: "solar gold",          primary: "warm sun-gold",   secondary: "bronze" },
  { name: "void indigo",         primary: "deep indigo",     secondary: "pitch black" },
  { name: "ruby plasma",         primary: "ruby pink",       secondary: "dark carmine" },
  { name: "pearl radiance",      primary: "pearl white",     secondary: "silver chrome" },
];

// Pool 4: Begleit-FX (reine Charakter-Effekte, keine Umweltelemente wie Regen/Schnee)
const EFFECT_MOTIFS = [
  "curling wisps of energy rising slowly from the shoulders",
  "floating embers drifting upward around the silhouette",
  "thin streams of liquid light spiraling around the arms",
  "faint shards of crystalline energy orbiting the torso",
  "glowing runes slowly circling mid-air around the character",
  "tiny flickering motes of light tracing the character's outline",
  "shimmering heat-haze distortion radiating from the core",
  "slow orbiting fragments of cracked stone reassembling and drifting",
  "wisps of aurora-like light flowing from the shoulders",
  "softly pulsing arcane sigils hovering near the hands",
];

// Pool 5: Pose-Haltung (für Standbild mehr Abwechslung) — erweitert
const POSES = [
  "grounded heroic stance, feet shoulder-width, one hand on hip, chin raised",
  "half-turned 3/4 view, ceremonial implement resting across the shoulders",
  "one knee bent, leaning forward over a grounded staff or weapon",
  "arms crossed in front of the chest, calm confident stare",
  "mid-stride forward as if walking toward the camera, cloak catching the air behind",
  "single hand raised as if channeling magic, other hand loose at the side, eyes glowing",
  "back-turned three-quarter view with head looking over shoulder toward viewer",
  "elegant ready-stance, implement held low along the side, slight lean forward",
  "kneeling on one knee, head bowed, weapon planted point-down in front like an oath",
  "arms wide open as if calling something forth, body lit from below by own aura",
  "hovering / floating slightly off the ground, robes fluttering downward",
  "shoulders dropped low, weapon held loose, predatory stalking stance",
  "one foot on a small invisible ledge, leaning forward with elbow on raised knee",
];

// Pool 6: Pro-Spezies eigene Pose-Hints (additiv, überschreibt nicht POSES)
const SPECIES_POSE_HINT: Record<string, string> = {
  construct: "the body never fully relaxes — it remains rigid and statue-like even between breaths",
  spirit:    "the lower half does not have feet on the ground — it dissolves into trailing wisps",
  celestial: "the wings are partially unfurled, feathers catching subtle airflow in the loop",
  dragonkin: "the tail (if present) sways slowly behind for balance, scales subtly catching light",
  bird:      "the head occasionally tilts in quick birdlike flicks between long still pauses",
  cosmic:    "the body bends light gently around itself, stars on the skin pulse out of phase",
  undead:    "the breath is shallow and uneven — sometimes the chest does not rise at all",
  demon:     "the magma-cracks pulse out of phase with the breathing, smoke wisps from the nostrils",
};

// Legacy-Mapping: alter guardian_type → neue Klasse (für Aufrufer die noch nicht migriert sind).
function legacyTypeToClass(t: string | null | undefined): "tank" | "support" | "ranged" | "melee" | null {
  switch (t) {
    case "infantry": return "tank";
    case "cavalry":  return "melee";
    case "marksman": return "ranged";
    case "mage":     return "support";
    default:         return null;
  }
}

export function buildArchetypePrompt(input: ArchetypePromptInput | string, legacyRarity?: "common" | "rare" | "epic" | "legend"): string {
  const in_: ArchetypePromptInput = typeof input === "string"
    ? { name: input, rarity: legacyRarity ?? "epic" }
    : input;

  const rarityMod = RARITY_MOD[in_.rarity] ?? RARITY_MOD.epic;
  const classId   = (in_.classId ?? legacyTypeToClass(in_.guardianType ?? null));
  const classMod  = classId ? CLASS_MOD[classId]  : "";
  const animMod   = classId ? CLASS_ANIM[classId] : "";
  const abilityTheme = in_.abilityName ? in_.abilityName.replace(/['"]/g, "") : "";

  // Spezies-Profil bestimmt Hauptaussehen (deterministisch aus DB-Spalte).
  const speciesKey = (in_.species && SPECIES_PROFILE[in_.species]) ? in_.species : "human";
  const profile    = SPECIES_PROFILE[speciesKey];

  // Gender: explizit aus DB, sonst aus dem Namen heuristisch ableiten.
  const gender = in_.gender && in_.gender !== "neutral"
    ? in_.gender
    : in_.gender === "neutral" ? "neutral" : detectGenderFromName(in_.name);

  // Variation je Wächter-Name (additive Details, nicht das Hauptmerkmal):
  const hair   = gender === "neutral"
    ? "no hair (or featureless headpiece appropriate to the species)"
    : nameHashPick(in_.name + ":hair",   gender === "female" ? HAIR_VARIANTS_FEMALE : HAIR_VARIANTS_MALE);
  const armor  = nameHashPick(in_.name + ":armor",  ARMOR_MATERIALS);
  // Aura: erst die Spezies-Defaultfarbe, dann je Name eine Variation aus dem Pool.
  const aura   = nameHashPick(in_.name + ":aura",   [profile.auraColor, ...AURA_COLOR_POOL]);
  const effect = nameHashPick(in_.name + ":effect", EFFECT_MOTIFS);
  const pose   = nameHashPick(in_.name + ":pose",   POSES);
  const speciesPose = SPECIES_POSE_HINT[speciesKey] ?? "";

  // Subject: führt mit der Spezies, danach erst Geschlecht (so dass z.B. ein Konstrukt
  // nicht erzwungen menschliche Gesichtszüge bekommt).
  const genderClause =
    gender === "neutral" ? "androgynous / genderless silhouette appropriate to the species"
    : gender === "female" ? "clearly feminine read where appropriate to the species"
    : "clearly masculine read where appropriate to the species";

  const subjectBase = `${profile.subject}, ${genderClause}, fully invented fictional character (not based on any existing franchise or celebrity)`;

  // ══════ VIDEO-PROMPT ══════
  // Strategie: Green-Screen-Background (#00FF00). Wird clientseitig per SVG-Chroma-Key
  // zu 100% transparent geschlüsselt — gleiche Technik wie Film/VFX. Viel zuverlässiger
  // als schwarzer Hintergrund, weil Grün im Charakter-Design nie vorkommt.
  // WICHTIG (NEU): Charakter ist VOLLSTÄNDIG IM FRAME mit Sicherheitsabstand zu allen
  // 4 Kanten. KEIN Edge-Bleed mehr — die alte "fills the entire frame edge-to-edge"
  // Strategie produziert harte Schnittkanten am Charakter, die im Final-Renderlauf
  // sichtbar bleiben. Stattdessen: Charakter zentriert, ~5-10% Greenscreen-Margin
  // an allen 4 Seiten, Silhouette berührt KEINE Frame-Kante.
  if (in_.mode === "video") {
    return [
      // 1) Shot-Spec
      `Shot: a 4-second perfectly seamless looping idle clip, square 1:1 composition, 1024x1024, 24 fps.`,
      // 2) Background — GREEN SCREEN (chroma-key)
      `Background: SOLID PURE NEON GREEN (#00FF00, chroma-key green / green screen). Completely flat uniform single color filling the ENTIRE 1024x1024 frame including a clean margin around the character. No gradients, no patterns, no texture, no shadows on the background, no environment, no scene, no atmospheric effects. Clean hard silhouette edge between character and green for chroma-key compositing.`,
      // 3) Subject — SPECIES-LED
      `Subject: ${subjectBase}. Pose: ${pose}.${speciesPose ? " " + speciesPose + "." : ""}`,
      // 4) Framing — CONTAINED (no bleed)
      `FRAMING (critical): the character is FULLY CONTAINED inside the 1024x1024 frame. The character's silhouette must NOT touch ANY of the four frame edges. Leave a clean uniform green margin of approximately 60-100 pixels (5-10% of frame size) on the TOP, BOTTOM, LEFT and RIGHT — visible green screen on all four sides around the character. The full head, both shoulders, both arms, and the full base of the character (feet or robe hem or floating wisps) are visible inside the frame — nothing is cropped, nothing extends past the frame border.`,
      `Hair and head: ${hair}.`,
      `Armor / outfit / body materials: ${armor} — adapted naturally to the species silhouette (e.g. construct stone is "carved into" the body, spirit "flows through" it), unique to this specific character.`,
      `Species signature details: ${profile.signature}.`,
      classMod && `Class traits (${classId}): ${classMod}.`,
      `Rarity and material feel: ${rarityMod}.`,
      // 5) Aura / Signature-FX — kept TIGHT
      `Signature aura hugging the character's silhouette only (close rim glow), themed as "${aura.name}" — dominant ${aura.primary} with ${aura.secondary} depth. Aura wraps tightly to the body outline (max ~30 pixels beyond silhouette) — it does NOT fill the frame and does NOT reach the frame edges.`,
      abilityTheme && `The aura subtly references the character's signature ability "${abilityTheme}".`,
      `Additional close-body effect: ${effect} — kept close to the character; no wide atmospheric smoke, fog, clouds, mist, sparkle dust, or particles spreading across the frame or touching frame edges.`,
      // 6) Motion
      `Motion: ${animMod || "slow rhythmic breathing (about 4 seconds per cycle), cloth, hair, and aura reacting to a steady gentle wind, weight planted"}. Smooth, continuous, no sudden actions, no body translation past the contained framing area.`,
      // 7) Camera
      `Camera: locked static shot, no pan, no tilt, no zoom, no dolly. The character stays in the same contained position the entire clip — head never crosses the top edge, feet never cross the bottom edge.`,
      // 8) Seamless-Loop — UNVERÄNDERT
      `CRITICAL LOOP REQUIREMENT: the exact last frame (frame 96 at 24fps) must be pixel-identical to the first frame (frame 1). Pose, aura intensity, particle positions, hair position — everything resets exactly. No frozen hold, no fade to black, no fade in — just a pure mathematical loop where frame_last = frame_first, so the playback is buttery smooth without any hitch.`,
      // 9) Anti-Green-Bleed (wichtig für Chroma-Key)
      `CRITICAL: NO green tones ANYWHERE on the character, armor, hair, skin, aura or effects. NO green eyes, NO green accents, NO green glow. The ONLY green in the entire video is the pure #00FF00 background. Green in the character would be keyed out as transparent.`,
      // 10) Hard negatives — atmosphere + background bleed
      `NO rooftop, NO city skyline, NO sky, NO moon, NO street, NO floor, NO environment objects. NO rain, NO snow, NO weather, NO clouds, NO fog, NO mist, NO smoke clouds filling the frame, NO volumetric haze, NO god-rays, NO wide particle storms, NO magic circles behind the character, NO sparkle dust clouds. NO colored backdrop behind the character — behind the character is ONLY pure #00FF00. Only: green screen + contained character (with safe margin) + tight silhouette aura.`,
      `No audio, no sound, no music, no voice. Silent video only.`,
      `No text, no captions, no subtitles, no logos, no watermark, no UI overlays, no brand names, no celebrity likeness.`,
    ].filter(Boolean).join(" ");
  }

  // ══════ IMAGE-PROMPT ══════ (transparent PNG, kein Greenscreen nötig)
  return [
    `Cinematic character key art, square 1:1, 1024x1024, single subject.`,
    `Background: FULLY TRANSPARENT PNG with alpha channel — completely empty outside the silhouette of the character and its tight aura. No background color, no gradient, no scene, no environment, no fill, no checkerboard, no white, no black, no green. The pixels outside the character+aura must have alpha = 0 (true transparency).`,
    `Subject: ${subjectBase}. Pose: ${pose}, confident expression appropriate to the species.${speciesPose ? " " + speciesPose + "." : ""}`,
    `FRAMING (critical): character is FULLY CONTAINED inside the 1024x1024 frame with a uniform transparent margin of approximately 60-100 pixels (5-10% of frame size) on TOP, BOTTOM, LEFT and RIGHT. Silhouette must NOT touch any frame edge. Full head, both shoulders, both arms and the full base of the character are visible — nothing cropped, nothing extending past the frame border.`,
    `Hair and head: ${hair}.`,
    `Armor / outfit / body materials: ${armor} — adapted to the species silhouette, unique and distinct so this character does not look like any other character in the set.`,
    `Species signature details: ${profile.signature}.`,
    classMod && `Class traits (${classId}): ${classMod}.`,
    `Rarity and material feel: ${rarityMod}.`,
    `Signature aura tight to the character silhouette (close rim glow, max ~30 px beyond outline), themed as "${aura.name}" — dominant ${aura.primary} with ${aura.secondary} depth. Aura does NOT fill the frame and does NOT reach the frame edges.`,
    abilityTheme && `Aura subtly references the character's signature ability "${abilityTheme}".`,
    `Additional close-body effect: ${effect} — no wide smoke, fog, clouds, mist, sparkle dust, or atmospheric haze that covers the frame.`,
    `Lighting: ${aura.primary} rim light from the left, ${aura.secondary} rim light from the right, subtle top-light from above.`,
    `High detail on face and hands, sharp focus on character, tight silhouette. Hard clean silhouette edge — no halo, no fringing, no semi-transparent background bleed.`,
    `NO rooftop, NO city, NO sky, NO moon, NO ground shadows on a floor, NO clouds, NO fog, NO mist, NO smoke, NO magic circles or glyphs behind the character, NO sparkle dust clouds, NO colored backdrop. Only: contained character + tight silhouette aura on a fully transparent canvas.`,
    `Output format: PNG with alpha channel.`,
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
      `Shot: a 3-second seamlessly looping animated icon, square 1:1, 1024x1024, 30 fps.`,
      GREEN_BG_RULE,
      `Subject: "${input.name}" — centered, iconic silhouette, readable at very small sizes (32-64 px). Avoid pure-green tones in the subject.`,
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
      `No audio. No text, no labels, no watermark, no logo, no pin, no marker shape outside the subject silhouette.`,
    ].filter(Boolean).join(" ");
  }
  return [
    `A premium game icon representing "${input.name}", square 1:1, 1024x1024 PNG.`,
    GREEN_BG_RULE,
    input.hint ? `Motif hint: ${input.hint}.` : "",
    humanInstruction,
    walkingPoseInstruction,
    directionGuidance,
    styleGuidance,
    fillDisclaimer,
    noPinDisclaimer,
    `Lighting: warm-and-cool rim-light for readability, soft ambient glow appropriate to the subject's theme. Avoid pure-green tones in the subject.`,
    `Iconic readable silhouette usable at 32-64 px. Crisp edges, rich material detail, vibrant colors.`,
    `No text, no labels, no watermark, no logo, no pin, no map-marker shape, no teardrop, no frame, no pedestal.`,
  ].filter(Boolean).join(" ");
}

export function buildPinThemePrompt(input: {
  name: string; description: string; bg: string; accent: string; glow: string; mode: "image" | "video";
}): string {
  const paletteLine = `Background base: ${input.bg}. Primary accent: ${input.accent}. Ambient glow: ${input.glow}.`;
  if (input.mode === "video") {
    return [
      `Shot: a 3-second seamlessly looping map-pin base tile animation, square 1:1, 1024x1024, 30 fps.`,
      GREEN_BG_RULE,
      `Subject: a stylized map-pin base tile representing the theme "${input.name}" — ${input.description}. Avoid pure-green tones in the subject.`,
      paletteLine,
      `Style: cyber-fantasy game-UI, thick clean outlines, soft inner glow, subtle particle motion (sparks, mist, scan-lines depending on theme).`,
      `Motion: gentle pulsing glow, slow particle drift. No camera movement. First and last frame identical.`,
      `No audio, no text, no watermark, no logos, no brand names.`,
    ].filter(Boolean).join(" ");
  }
  return [
    `A stylized map-pin base tile representing "${input.name}" — ${input.description}.`,
    `Square 1:1, 1024x1024 PNG.`,
    GREEN_BG_RULE,
    paletteLine,
    `Style: cyber-fantasy game-UI, thick clean outlines, soft inner glow, readable at small sizes.`,
    `No text, no labels, no watermark, no logos.`,
  ].filter(Boolean).join(" ");
}

// ═══════════════════════════════════════════════════════════════════════
// BASE-THEMES (Runner-Base + Crew-Base) — für Map-Pin + Modal-Header
// ═══════════════════════════════════════════════════════════════════════
//
// Pro Theme erzeugen wir 4 Assets:
//   {theme}_runner_pin     — 1024×1024 transparent, kleine Burg/Outpost (1 Hero-Struktur)
//   {theme}_runner_banner  — 1600×600   Header-Image für Modal (Solo-Atmosphäre)
//   {theme}_crew_pin       — 1024×1024 transparent, Festung mit Mauern + Bannern (Compound)
//   {theme}_crew_banner    — 1600×600   Header-Image (große Crew-Halle, Faction-Vibes)

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

/**
 * Prompt für Base-Theme Asset (Map-Pin oder Modal-Banner, jeweils Runner oder Crew).
 * Gibt einen Detail-reichen Prompt zurück der mit Midjourney v6, Flux, Gemini Imagen
 * oder Veo 2 (für Video-Variante) gut funktioniert.
 */
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
  // Im Pin-Modus brauchen wir ein isoliertes Asset ohne Umgebungs-Kontext
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

  // ════════════════════════════════════════════════════════════════════
  // PIN-MODE: Greenscreen-Pipeline wie bei Wächter-Prompts
  // (Background-Anweisung muss als ZWEITE Zeile direkt hinter Shot-Spec
  //  stehen, sonst ignoriert Veo sie und produziert dunkle Szenen.)
  // ════════════════════════════════════════════════════════════════════
  if (asset === "pin") {
    if (mode === "video") {
      return [
        // 1) Shot-Spec
        `Shot: a 3-second perfectly seamless looping clip of a single isolated 3D game-building sprite, square 1:1 composition, 1024×1024, 30 fps.`,
        // 2) Background — GREEN SCREEN (chroma-key) — MUSS hier stehen
        `Background: SOLID PURE NEON GREEN (#00FF00, chroma-key green / green screen). Completely flat uniform single color filling the ENTIRE 1024×1024 frame including a clean ~8% margin around the building. No gradients, no patterns, no texture, no shadows on the green, no environment, no scene, no atmospheric effects. Clean hard silhouette edge between structure and green for chroma-key compositing.`,
        // 3) Subject + Theme
        `Subject: ${subject}. This is the "${theme.name}" base theme — ${theme.description}`,
        scopeLine,
        // 4) Framing — CONTAINED (no bleed)
        `FRAMING (critical): the building is FULLY CONTAINED inside the 1024×1024 frame. The structure's silhouette must NOT touch ANY of the four frame edges. Leave a clean uniform green margin of ~80 pixels (~8% of frame) on TOP, BOTTOM, LEFT and RIGHT — visible green screen on all four sides. The full roof, both side towers, the full base of the structure are visible inside the frame — nothing cropped, nothing extending past the frame border.`,
        // 5) Style
        `Style: a single isolated 3D game-building sprite in the exact aesthetic of Rise of Kingdoms / Call of Dragons / Clash of Clans town-hall icons. Slight isometric ~30° three-quarter view. Thick clean readable silhouette, vibrant saturated colors, soft inner accent glow, gentle rim-light. Looks like a polished mobile-game building-icon ripped straight from the game UI — NOT a concept-art scene. Compact footprint — the building sits on its own minimal stone-tile base (max 5% larger than structure footprint).`,
        // 6) Palette
        paletteLine,
        // 7) Motion
        `Motion: subtle micro-ambient ON THE STRUCTURE ITSELF only — flag/banner gently waving, small accent-glow pulse, small flame/spark flicker on torches. NO environmental motion. NO particles drifting through empty space. Camera fully static — locked, no pan/tilt/zoom/dolly. The building stays in the same contained position the entire clip.`,
        // 8) Seamless-Loop
        `CRITICAL LOOP REQUIREMENT: the exact last frame must be pixel-identical to the first frame — pose, glow intensity, flag position, particle positions all reset exactly. No frozen hold, no fade to black, no fade in — pure mathematical loop.`,
        // 9) Anti-Green-Bleed
        `CRITICAL: NO green tones ANYWHERE on the building, walls, roof, banners, flags, gems, lights, glows or accents. NO green flags, NO green banners, NO green gemstones, NO green torch flames, NO green moss. The ONLY green in the entire video is the pure #00FF00 background. Use teal/cyan/blue/yellow/red/orange/purple/white instead.`,
        // 10) Hard negatives
        `NO ground plane, NO extending terrain, NO grass, NO sky, NO clouds, NO trees, NO plants, NO water, NO mountains, NO scattered rocks, NO scenery, NO environment, NO atmospheric perspective, NO fog, NO mist, NO smoke clouds, NO weather, NO god-rays, NO wide particle storms, NO magic circles behind the building. Behind and around the building is ONLY pure #00FF00.`,
        `No audio, no sound, no music. Silent video only.`,
        baseNegative,
      ].filter(Boolean).join(" ");
    }
    // PIN IMAGE → fully transparent PNG
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

  // ════════════════════════════════════════════════════════════════════
  // BANNER-MODE: cineastische Szene mit Hintergrund (kein Greenscreen)
  // ════════════════════════════════════════════════════════════════════
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
//
// Ziel: jedes Gebäude bekommt ein eigenes Sprite, das auf einer Floating-
// Tile-Plattform sitzt (wie in Rise of Kingdoms). Kompatibel mit beliebigen
// Base-Themes — die Theme-Skin-Variation kommt später separat.
//
// Konvention: Slot-ID = `building_{building_id}`. Variant = "neutral".

export type BuildingArt = {
  id: string;             // matched die buildings_catalog.id (z.B. "wegekasse")
  name: string;           // Anzeigename
  category: string;       // production / storage / combat / utility / cosmetic
  emoji: string;          // Fallback-Icon
  silhouette: string;     // 1-2 Sätze: physische Form / Material / charakteristische Elemente
  details: string;        // 2-3 Sätze: thematische Details, Animationshinweise
  signature: string;      // 1 Satz: Was macht dieses Gebäude visuell unverwechselbar?
  composition: string;    // FREIFORM: Plinthen-Form, Proportionen, Asymmetrie, Sonderfälle (levitating / no platform / building-IS-platform). Ersetzt die generische square-iso-tile-Anweisung — sorgt für individuelle Silhouette pro Gebäude.
  heroFeature: string;    // EIN spektakuläres "Wow"-Element das nur dieses Gebäude hat. Über-Größe, mythisch, leicht physikbrechend, kinoreif. Macht den User sagen "geil".
  facing: "NE" | "NW" | "SE" | "SW"; // In welche Richtung des iso-Frames zeigt der Haupteingang/die Vorderseite. Verteilt über alle Gebäude für Orientation-Varianz statt camera-frontal-Einheitsbrei.
};

export const BUILDINGS_ART: BuildingArt[] = [
  // ─── Phase 1 + Starter (00079 + 00082) ───
  { id: "wegekasse",      name: "Wegekasse",        category: "storage",    emoji: "🏦",
    silhouette: "small fortified treasury vault on a stone base, iron-banded oak door, gold coin pile spilling from a half-open chest in front",
    details: "soft golden glow from inside the vault, brass keyhole, two crossed gold-trimmed guard pikes, a single torch flickering",
    signature: "open chest of glittering gold coins is the unmistakable hero element",
    composition: "compact near-cubic mass on a small square flagstone platform with iron-banded corner brackets — modest footprint, slightly taller than wide, treasury feels solid and grounded",
    heroFeature: "a CASCADING WATERFALL OF GOLD COINS pouring continuously from the top window of the treasury down into the open chest below — a literal river of gold that defies gravity, glittering, sparkling, NEVER stopping — this is the unmistakable money-shot of the building",
    facing: "NE" },
  { id: "wald_pfad",      name: "Wald-Pfad",        category: "production", emoji: "🌲",
    silhouette: "small wooden lumberjack camp with a thatched-roof shed, axe stuck in a tree-stump chopping block, stack of fresh-cut logs",
    details: "lush moss-covered ground, two pine saplings, sawdust scattered around, a small hand-cart with logs",
    signature: "vibrant pine-tree backdrop and the chopping-axe-in-stump composition",
    composition: "wide-low horizontal sprawl on a rough irregular forest-floor pad of moss, dirt and pine-needles (no clean stone tile) — shed wider than tall, chopping-stump and log-stack extend the footprint sideways",
    heroFeature: "an ANCIENT LIVING TREE MIGHTIER THAN THE CABIN ITSELF grows directly THROUGH the shed — its massive gnarled trunk pierces the roof, branches spread above, and roots heave the earth around the platform; the cabin is built into the tree, not next to it",
    facing: "NW" },
  { id: "waechter_halle", name: "Wächter-Halle",    category: "combat",     emoji: "⚔️",
    silhouette: "fortified guardian hall with steep peaked tile roof, two crossed swords mounted above the gate, banner-pillars on either side",
    details: "purple-magenta heraldic banners with a sword sigil, two stone gargoyle statues, glowing rune-stones at the entrance",
    signature: "crossed-swords emblem above the gate, glowing magenta rune accents",
    composition: "vertical hall with steep peaked roof reaching upward (height ≈ width × 1.4), set on a hexagonal slate platform with carved rune-edges — banner-pillars project beyond the platform on both sides",
    heroFeature: "TWO COLOSSAL CROSSED ENERGY-BLADE SWORDS made of solid magenta-violet plasma (each blade twice the height of the hall itself) hover above the gate, sparking violently, casting prismatic light across the entire building",
    facing: "SE" },
  { id: "laufturm",       name: "Lauftürme",        category: "utility",    emoji: "🗼",
    silhouette: "tall slender stone watchtower with a spiral wooden staircase visible, conical teal-tile roof, lookout balcony at the top",
    details: "spyglass leaning against the railing, a small flag fluttering, glowing teal-cyan beacon at the top floor",
    signature: "spinning beacon-light at the very top, casting cyan rays",
    composition: "extremely tall slender vertical tower (4:1 height-to-width ratio), perched on a small ROUND stone disc only slightly wider than the tower base — silhouette dominated by verticality, balcony halo near the top breaks the column",
    heroFeature: "a SWIRLING CYCLONE OF LIVING CYAN AURORA-LIGHT spirals upward from the beacon and continues UP past the upper frame edge — it's a tornado of pure energy ribbon, pulling embers and motes of light into the spiral, visible from miles away in the lore",
    facing: "SW" },
  { id: "lagerhalle",     name: "Lauf-Lager",       category: "storage",    emoji: "📦",
    silhouette: "wide low warehouse with double sliding wooden doors, stacks of crates and barrels visible inside through one open door",
    details: "weathered timber framing, an inventory chalkboard on the side wall, hanging lantern, a hand-cart parked outside",
    signature: "open warehouse door revealing a treasure-trove of stacked crates and glinting items",
    composition: "wide-low horizontal warehouse (width > height × 1.5) on a rectangular wooden-deck platform with stone-block edging — front sliding doors face the camera, asymmetric load-cart parked off to one side",
    heroFeature: "through the open warehouse door, an IMPOSSIBLY DEEP M.C.-ESCHER-LIKE INFINITY of stacked golden crates and treasures recedes into the back — the inside is bigger than the outside, a bottomless treasure-vault perspective, a swirling vortex of riches drawing the eye in",
    facing: "NE" },
  { id: "schmiede",       name: "Schmiede",         category: "utility",    emoji: "⚒️",
    silhouette: "stone-walled blacksmith forge with a chimney belching warm smoke, glowing red-orange furnace visible through the front opening",
    details: "anvil with hammer and tongs in front, finished sword leaning against the wall, sparks flying from the forge, leather apron hung outside",
    signature: "intense glowing forge interior — the heat-light should pulse softly in motion mode",
    composition: "asymmetric mass on an irregular soot-blackened flagstone platform — tall narrow brick chimney shooting up on the LEFT, lower forge-shed on the right, anvil and tools on a small annexed tile-extension at the front",
    heroFeature: "a GIANT PHOENIX-SPIRIT WOVEN OF PURE FORGE-FIRE perches with wings spread on top of the chimney — its tail-feathers wrap halfway down the roof in molten ribbons, its eyes blazing white-hot, embers raining from its plumage across the entire building",
    facing: "NW" },
  { id: "gasthaus",       name: "Wegerast",         category: "production", emoji: "🍻",
    silhouette: "two-story half-timbered tavern with a swinging signboard depicting a foaming mug, warm windows glowing yellow",
    details: "wooden barrels stacked beside the door, a fiddle resting on a bench, lantern hanging from the eaves, hops vines growing up the wall",
    signature: "the swinging mug signboard and the warm golden window-light spill",
    composition: "two-story timber building on a small cobblestone square — second floor JETTIES OUT over the ground floor on one side (overhanging upper floor), creating a visibly asymmetric profile, swinging signboard projects sideways beyond the platform",
    heroFeature: "a COLOSSAL FLOATING TANKARD OF FOAMING ALE (3× human-size) hovers above the swinging signboard, eternally overflowing — golden ale cascades down in a sparkling waterfall into a small pool at the entrance steps where the foam never settles",
    facing: "SE" },
  { id: "wachturm",       name: "Posten-Turm",         category: "combat",     emoji: "🏯",
    silhouette: "robust square stone watchtower with crenelated battlements, narrow arrow-slits, single heavy iron-bound door at base",
    details: "hot-orange torch on each corner of the battlement, defensive ballista visible on top, banners with a shield sigil",
    signature: "crenelated top + defensive ballista silhouette and the four corner torches",
    composition: "tall square fortress-tower (3:1 vertical) on a small octagonal fortified stone base — battlemented top wider than the shaft (mushroom silhouette), four corner torches projecting outward at the crown",
    heroFeature: "TWO COLOSSAL BRONZE WARRIOR-STATUES (each as tall as the tower itself, chained at the wrist to the tower) flank it as eternal guardians — their eyes glow molten red, their massive ornate halberds project outward, they look like they could come alive at any moment",
    facing: "SW" },

  // ─── Expansion 00085 — Produktion ───
  { id: "saegewerk",      name: "Reisig-Bündler",         category: "production", emoji: "🪓",
    silhouette: "open-walled timber sawmill with a large vertical sawblade powered by a wooden water-wheel, conveyor of fresh planks",
    details: "splashing water from the wheel, sawdust drifting through sunbeams, neat stacks of cut planks beside the building, lumberjack tools",
    signature: "spinning wooden water-wheel splashing — animate slowly in motion mode",
    composition: "wide horizontal mill-deck on a long rectangular wooden platform extending sideways — large vertical water-wheel projects beyond the platform on the RIGHT side, splashing into a small pool that breaks the tile edge",
    heroFeature: "the water-wheel is powered by a SECOND smaller wheel mounted on its hub which spins a GLOWING CYAN MANA-CRYSTAL POWER-CORE — arcs of lightning leap from the crystal to the saw-blade, planks fly off the conveyor with magical speed leaving energy-trails",
    facing: "NE" },
  { id: "steinbruch",     name: "Pflaster-Brecher",       category: "production", emoji: "⛏️",
    silhouette: "small open-pit stone quarry with carved-out terraces, pickaxe stuck in a half-cut block, mine-cart on rails",
    details: "stone dust in the air, scaffolding for higher cuts, a small forge for tool-sharpening, raw boulders and chiseled blocks",
    signature: "the cut-out tiered quarry pit + the loaded mine-cart on rails",
    composition: "SUNKEN composition — the platform itself is a broken irregular rocky terrace cut downward (the camera looks slightly down INTO the carved pit), no traditional building shell, just terraced rock walls and the mine-cart on rails along the upper edge",
    heroFeature: "an UNFINISHED PARTIALLY-CHISELED COLOSSAL STONE-TITAN STATUE half-buried in the quarry pit — only the head, one shoulder, and a massive outstretched arm are revealed from the rock; it looks like an ancient sleeping god the masons accidentally uncovered",
    facing: "NW" },
  { id: "goldmine",       name: "Zoll-Schacht",         category: "production", emoji: "💰",
    silhouette: "stone-arched mine entrance with wooden support beams, glittering gold veins visible inside, mine-cart loaded with gold ore",
    details: "warm yellow light spilling from inside the shaft, a heap of gold nuggets in front, wooden pickaxe and lantern leaning at the entrance",
    signature: "the glowing-yellow mine-shaft interior and the gold-nugget heap",
    composition: "HALF-BURIED into a hillside — the platform appears as a cross-section of rocky earth with the arched mine entrance recessed inward, hill-mass curves up and away on both sides forming a partial dome rather than a free-standing structure",
    heroFeature: "a RIVER OF LIQUID MOLTEN GOLD flows OUT of the mine entrance, pours down the front steps, and pools at the foot of the platform — solid GOLDEN FISH leap and arc through the molten river like salmon, one frozen mid-leap, light dazzling and yellow",
    facing: "SE" },
  { id: "mana_quelle",    name: "Quellbrunnen",      category: "production", emoji: "🌊",
    silhouette: "stone basin filled with luminous turquoise liquid, runic stone arch above, mana-mist drifting upward",
    details: "carved arcane runes glowing on the basin rim, floating crystal shards above the water, lush blue-green ferns surrounding it",
    signature: "the glowing turquoise mana-water with floating crystal shards above",
    composition: "NO solid platform — the basin LEVITATES above a circle of broken floating stone fragments, ring of small monoliths drifts in slow orbit around it, void of swirling mana-mist replaces the conventional tile",
    heroFeature: "a JACOB'S LADDER OF GLOWING MANA-ORBS ascends infinitely upward from the basin into the sky beyond the frame — each orb pulses with a different color (cyan, violet, gold, white), connected by thin ribbons of arcane light, visibly breaking the upper boundary of the image",
    facing: "SW" },

  // ─── Expansion 00085 — Lager ───
  { id: "tresorraum",     name: "Geheim-Tresor",       category: "storage",    emoji: "🏛️",
    silhouette: "fortified vault with a massive round iron door (combination dial visible), thick stone walls, two stone columns flanking the entrance",
    details: "a single guardian statue holding a key, security runes glowing faintly on the door frame, polished marble floor visible",
    signature: "the round iron vault-door with prominent dial — heavy and impenetrable looking",
    composition: "almost perfect cube on a polished square dark-marble platform with bronze inlay border — the round vault-door faces the camera at 30°, strict symmetry, monumental and blocky",
    heroFeature: "THREE CONCENTRIC ROTATING VAULT-DOORS (frozen mid-rotation at different angles, like a high-security bank-vault from a heist movie) protect the entrance — each massive iron disk turns at a different speed, glowing arcane runes traced along their rims, gears the size of cartwheels visible in the gaps",
    facing: "NE" },
  { id: "kornkammer",     name: "Vorrats-Schober",       category: "storage",    emoji: "🌾",
    silhouette: "tall conical wooden granary with a thatched roof, ladder against the side, sacks of grain piled at the base",
    details: "wheat-bundles tied to the wall, a wooden scoop in front, mice scampering away, golden-wheat fields hint visible in background",
    signature: "the iconic conical granary silhouette with grain sacks piled around",
    composition: "very tall conical silo (height ≈ 2.5× base width), set on a round earthen pad fringed with wheat-stalks — pointed thatched cap reaches well above the typical iso-bounds, asymmetric ladder leaning on one side",
    heroFeature: "the thatched cap is crowned in a CONTROLLED MAGICAL GOLDEN FLAME that burns like a beacon — wheat-shaped sparks of golden light scatter into the wind, glowing wheat-stalks hover in slow upward drift around the silo (anti-gravity ambient particles)",
    facing: "NW" },
  { id: "mauerwerk",      name: "Komponenten-Speicher",  category: "storage",    emoji: "🧱",
    silhouette: "stonemason workshop with a low half-built wall, mortar-trough, neat stacks of cut stone bricks",
    details: "a wooden scaffolding, mason's tools (hammer, chisel, plumb-line) on a workbench, fresh-cut limestone blocks",
    signature: "the half-built stone wall in-progress shows craftsmanship in action",
    composition: "WORK-IN-PROGRESS asymmetric composition — the platform is a rough flagstone slab with one corner extending into a half-built wall that fades into bare scaffolding, the building does not fully enclose the platform",
    heroFeature: "the half-built wall IS BUILDING ITSELF — bricks levitate from the pile in mid-air and slot themselves into place along an enchanted glowing plumb-line, mortar applies itself, a hovering ghost-mason's hammer floats nearby tapping bricks into alignment — pure visible magic",
    facing: "SE" },

  // ─── Expansion 00085 — Kampf ───
  { id: "hospital",       name: "Heil-Stube",         category: "combat",     emoji: "🏥",
    silhouette: "white-walled chapel-style infirmary with a red cross banner above the door, herbal garden plot in front, smoking incense bowl",
    details: "stained-glass window with a healing-symbol, white draped curtains visible inside, a wooden cot, jars of potions on a shelf",
    signature: "the red cross banner and stained-glass healing window",
    composition: "mid-height chapel on a circular white-marble disc edged with a low garden ring — slender bell-tower spire on one corner pierces upward, herb-garden plot extends as an annexed crescent at the front",
    heroFeature: "a MASSIVE HOLY-PHOENIX STATUE spans the rooftop with wings spread far beyond the building's footprint — golden healing-light radiates outward from its outstretched feathers in soft beams, the entire chapel bathed in a healing aura you can see, like the bird is reviving the building itself",
    facing: "SW" },
  { id: "trainingsplatz", name: "Übungs-Hof",  category: "combat",     emoji: "🥋",
    silhouette: "open martial training ground: wooden practice dummies in a row, weapon rack, sparring circle outlined by stones",
    details: "rolling thunder-clouds painted on a wall behind, three different weapons (sword, staff, bow) in the rack, a coach's whistle on a hook",
    signature: "the row of wooden practice dummies and the central sparring circle",
    composition: "OPEN COMPOUND with NO building shell — the platform IS a packed-earth circular sand-ring bordered by a low stone curb, sparring posts and weapon racks scattered across the ring, central sparring circle inscribed in the sand",
    heroFeature: "THREE TRANSLUCENT GHOST-WARRIORS OF PAST CHAMPIONS sparring in mid-air above the ring, frozen in dynamic combat poses — sword-flash, parry, lunge — leaving glowing weapon-trails behind their motion, their armor and weapons painted in fading after-image strokes",
    facing: "NE" },
  { id: "ballistenwerk",  name: "Wurfgeschütz-Werk",category: "combat",   emoji: "🎯",
    silhouette: "open-air engineering workshop with a large mounted ballista, blueprint scrolls on a workbench, stacks of giant arrows",
    details: "a half-assembled siege engine in the corner, gear-mechanisms visible, an engineer's apron and blueprint compass on the bench",
    signature: "the prominently mounted ballista pointing skyward dominates the composition",
    composition: "horizontal workshop sprawl on a rectangular timber-deck platform — the mounted ballista projects upward AND forward, breaking the typical iso-bounding-box on the upper-front diagonal, blueprint table off to the side",
    heroFeature: "the mounted ballista is THE SIZE OF A SMALL DRAGON — over-engineered, intricately gilded, a glowing rune-arrow as long as a man already nocked and pulled — the entire workshop hums with visible electric potential energy ready to release, sparks lining the bowstring",
    facing: "NW" },
  { id: "schwertkampflager",name: "Klingen-Kaserne",category: "combat",emoji: "⚔️",
    silhouette: "armed-camp tent compound with two wooden practice posts, a weapon rack of various swords, banners with a sword crest",
    details: "leather armor stands, a small forge for sword-edge sharpening, a heap of polished helmets, campfire in the center",
    signature: "the heroic weapon rack of crossed swords and the central campfire",
    composition: "ENCAMPMENT cluster on irregular packed-earth ground — NO solid building, just a ring of three differently-sized canvas tents around a central campfire, weapon racks and helm-piles scattered between, tents flap asymmetrically",
    heroFeature: "a FLOATING WALL OF 100+ SPINNING SWORDS forms a perfect rotating circular shield-formation hovering above the campfire — every blade catches firelight, all rotating in unison around the central axis, an iconic weapon-vortex visible from afar",
    facing: "SE" },
  { id: "bogenschuetzenstand",name: "Pfeil-Kaserne",category: "combat",emoji: "🏹",
    silhouette: "elevated archery range with three target dummies at varied distances, wooden bow racks, quivers of arrows",
    details: "a watchtower-style elevated platform on the left, hay-bale targets with painted bullseyes, scattered arrows in the ground",
    signature: "the three targets in perspective at varied distances and the hero bow-rack",
    composition: "ELONGATED depth-composition — long rectangular range-platform extending into the iso-depth, three target dummies recede in perspective from foreground to background, elevated wooden platform on the near-left flanks the range",
    heroFeature: "a FROZEN-IN-TIME ARROW VOLLEY — a hundred glowing arrows hang suspended in mid-flight in a perfect arc from the hero bow on the left toward the targets, like time has stopped at the apex of a legendary shot, each arrow trailing a tiny streak of white-hot light",
    facing: "SW" },

  // ─── Expansion 00085 — Utility ───
  { id: "akademie",       name: "Gelehrten-Halle",         category: "utility",    emoji: "📚",
    silhouette: "two-story scholar academy with arched windows, large telescope on the roof, stack of huge tomes by the entrance",
    details: "alchemy bottles and rolled scrolls on an outdoor desk, a single owl on the roof, ivy climbing the walls, magnifying glass",
    signature: "the rooftop telescope pointing skyward + glowing arched library windows",
    composition: "tall rectangular two-story academy on a square cut-stone platform — rooftop telescope SPIRE projects well above the typical iso-bounds, ivy creeping down the facade asymmetrically on one side",
    heroFeature: "a MINIATURE SOLAR-SYSTEM HOLOGRAM (planets, moons, asteroid belt) orbits live above the rooftop telescope — golden orbits trace the planet paths, the sun in the center glows brilliant white, real shadows from the planets pass over the telescope dome — celestial science made visible",
    facing: "NE" },
  { id: "kloster",        name: "Mond-Kapelle",          category: "utility",    emoji: "⛪",
    silhouette: "small stone monastery with bell-tower, arched gothic windows, a meditation garden with a koi pond",
    details: "stained-glass mana-symbol window glowing turquoise, a single monk-statue, hanging incense braziers, lavender and herb garden",
    signature: "the bell-tower silhouette and the glowing turquoise stained-glass window",
    composition: "mid-height monastery cluster on a hexagonal stone platform with a koi-pond carved into one corner — tall slender bell-tower attached asymmetrically to the LEFT corner (not centered), main hall lower and wider on the right",
    heroFeature: "a MASSIVE TRANSLUCENT MOON-ORB hovers behind the bell-tower as if magically tethered to it — silver moon-rays cascade from it down into the koi-pond, where koi swim in slow circles trailing silver bioluminescent ribbons; the moon is twice the size of the building",
    facing: "NW" },
  { id: "augurstein",     name: "Sternendeuter-Stein",       category: "utility",    emoji: "🔮",
    silhouette: "free-standing megalithic stone monolith covered in carved astrological runes, levitating crystal orb hovering above",
    details: "swirling cosmic mist around the orb, faint star-projection on the stone, a small ritual altar at the base with candles",
    signature: "the levitating crystal orb projecting starlight onto the ancient runestone",
    composition: "NO building — bare megalithic stone monolith standing alone on a cracked rocky platform with cosmic mist swirling at its base, the levitating crystal orb FLOATS DETACHED above the stone tip, ritual altar with candles at the foot",
    heroFeature: "the crystal orb is a LIVING SWIRLING GALAXY-IN-MINIATURE — actual nebulae, spiral arms, and stars are visible inside it; light from the orb projects a 3D constellation-pattern of stars all around the entire scene, with shooting stars zipping across, the air itself feels charged with cosmic destiny",
    facing: "SE" },
  { id: "schwarzes_brett",name: "Quest-Tafel",  category: "utility",    emoji: "📋",
    silhouette: "wooden bulletin board on a sturdy post, multiple paper notices pinned with daggers, a small awning above for rain",
    details: "wax-sealed scrolls hanging, a lantern, an inkwell and quill on a small shelf, a bench in front",
    signature: "the multiple pinned notices fluttering on the bulletin board (animate gently in motion mode)",
    composition: "TINY footprint — the smallest-massed building of the set, just a wooden bulletin-post and small awning on a single square wooden plank — composition feels modest and intimate compared to the others",
    heroFeature: "one of the pinned scrolls floats UP and unfurls itself in mid-air — an enchanted glowing quill writes shimmering golden runic-text along its surface unaided, ink dripping in stars, a tiny owl observes from the awning — quiet but unmistakable magic in a small package",
    facing: "SW" },
  { id: "halbling_haus",  name: "Bau-Kontor",    category: "utility",    emoji: "🏚️",
    silhouette: "round hobbit-style hill-house with a circular green door, smoke from the chimney, garden of vegetables in front",
    details: "round porthole windows with warm golden light inside, a flower-box of red blooms, mushroom decorations, a tiny clothesline",
    signature: "the iconic round green door + circular windows of the cozy hill-house",
    composition: "BUILDING IS THE PLATFORM — a round earthen mound IS the hill-house, no separate tile beneath, the green door + circular windows are carved into the curved hill-mass itself, vegetable garden plot annexed to the front-left",
    heroFeature: "a COLOSSAL ANCIENT OAK (3× the height of the house) grows directly out of the round chimney — its enormous canopy shades the entire mound, a swarm of glowing fireflies dances through its leaves, and tiny lanterns hang from the lower branches like a fairy-tale cascade",
    facing: "NE" },
  { id: "basar",          name: "Tausch-Stand",            category: "utility",    emoji: "🛒",
    silhouette: "open-air bazaar tent with colorful striped fabric awnings, market stalls with fruits/spices/silks displayed",
    details: "hanging brass scales, woven rugs as floor mat, exotic pots and lamps, a small monkey on a perch, baskets overflowing with goods",
    signature: "the colorful striped awnings + the lavish display of trade goods",
    composition: "wide-low open-bazaar sprawl on a flat irregular packed-earth pad with a woven rug edge (no clean stone tile) — multiple striped fabric awnings of varied heights cluster asymmetrically, NO walls, the silhouette is the cluster of canopies",
    heroFeature: "a COLOSSAL TURBAN-WEARING GENIE-MERCHANT bursts in a swirling cloud of incense from a gilded brass lamp on the central stall — his upper body and outstretched hands hold glittering wares (a glowing sword, a chest of gems, a flying carpet), his form fades into smoke at the lamp; fully cinematic",
    facing: "NW" },

  // ─── Expansion 00085 — Kosmetisch ───
  { id: "shop",           name: "Kosmetik-Stand",             category: "cosmetic",   emoji: "🏪",
    silhouette: "small wooden shop-front with a hanging painted sign, glass display window showing items, awning over the entrance",
    details: "a chalkboard 'Open' sign, a barrel with rolled-up scrolls outside, a small bell above the door, potted plants flanking the entrance",
    signature: "the glass display window with glowing items and the painted hanging sign",
    composition: "narrow tall shop-front (width < height) on a small square cobblestone tile — facade faces the camera at 30°, hanging signboard projects sideways beyond the platform, awning casts a soft shadow on the door",
    heroFeature: "a FLOATING DISPLAY CASE rotates slowly above the door showcasing the day's hottest item — a glowing legendary-tier sword spinning slowly inside, lit from within, with smaller satellite items orbiting it (potion, ring, scroll) on individual halos of light",
    facing: "SE" },
  { id: "brunnen",        name: "Brunnen",          category: "cosmetic",   emoji: "⛲",
    silhouette: "ornate stone fountain with a central spire, water cascading from three tiers, koi swimming in the lower basin",
    details: "ivy and roses growing around the base, scattered coins gleaming on the basin floor, two stone benches nearby",
    signature: "the cascading three-tier water flow and the koi-fish in the basin",
    composition: "RADIALLY SYMMETRIC composition — round stepped stone-disc platform with the multi-tier fountain centered exactly, three concentric basin-rings, no asymmetry — pure circular silhouette",
    heroFeature: "a MAJESTIC WATER-ELEMENTAL DRAGON coils up from the center spire of the fountain, mid-roar with mouth open and water cascading down its translucent crystalline scales — its body twists in a perfect helix above the basin, koi-fish leap through its loops",
    facing: "SW" },
  { id: "statue",         name: "Heldenstatue",     category: "cosmetic",   emoji: "🗿",
    silhouette: "heroic stone statue of a warrior holding a sword aloft, on a tall plinth, surrounded by a flagstone plaza",
    details: "polished marble plinth with engraved name plaque, two tribute braziers burning at the base, a wreath of laurel at the warrior's feet",
    signature: "the dramatically lit hero-statue silhouette with sword raised toward the sky",
    composition: "TALL PLINTH dominates — building IS mostly the towering rectangular marble plinth on a small flagstone base, the heroic warrior statue on top is small relative to the plinth, two tribute braziers flanking the base extend the footprint forward",
    heroFeature: "the hero-statue IS COMING ALIVE — caught mid-animation: stone sword slowly raised, eyes glowing piercing white, a single tear of stone rolling down its cheek, hairline cracks spreading across its body where the magic awakens it; tribute braziers burn with awakening-fire",
    facing: "NE" },

  // ─── Crew (00079 + 00080 + 00085) ───
  { id: "crew_treffpunkt",name: "Crew-Treffpunkt",  category: "production", emoji: "🏛️",
    silhouette: "large neoclassical alliance hall with marble columns, wide stone steps, banners hanging between the columns",
    details: "a great central brazier burning teal flame, two heroic stone statues flanking the entrance, intricate teal-and-gold mosaic floor",
    signature: "the teal-flame brazier on the steps and the marble-columned facade",
    composition: "MONUMENTAL horizontal mass — wide grand columned hall (width > height × 1.4) on a large hexagonal marble platform with stepped front edge — wide stone steps lead up from the front, six-column facade dominates the silhouette",
    heroFeature: "a MASSIVE TEAL-FLAME PHOENIX-EAGLE (the crew-totem) soars above the brazier with wings spread wide, its plumage made entirely of teal-cyan magical fire, holding the crew-banner unfurled in its talons; its piercing call seems to echo across the platform, blue embers raining down the marble columns",
    facing: "NW" },
  { id: "truhenkammer",   name: "Truhenkammer",     category: "storage",    emoji: "🗝️",
    silhouette: "vault chamber with rows of wooden treasure-chests bound in iron, hanging skeleton-key collection on the wall",
    details: "an ornate centerpiece chest with overflow of jewels and gold, brass lanterns illuminating each row, dust motes in beams of light",
    signature: "the centerpiece overflowing treasure-chest with cascading gems",
    composition: "blocky chamber on a square polished-stone platform — front wall is OPEN, revealing rows of treasure chests in cross-section style (the camera sees inside as if the front wall is missing), centerpiece chest projects slightly forward",
    heroFeature: "the centerpiece chest is ENORMOUS (5× the size of the others) and contains a SWIRLING VORTEX OF GEMS, GOLD COINS AND ARCANE LIGHT inside it that defies physics — the loot orbits inside the chest like a treasure-galaxy, items occasionally float UP and out of the open lid in a glittering geyser",
    facing: "SE" },
  { id: "arena_halle",    name: "Arena-Halle",      category: "combat",     emoji: "🏟️",
    silhouette: "miniature colosseum-style arena with stepped stone seating, sand-floor combat pit visible at center, weapon racks on the walls",
    details: "two crossed-spear banners, a victory-podium with a laurel wreath, torches lining the entrance, painted gladiator murals",
    signature: "the visible sand combat pit + the colosseum-stepped seating silhouette",
    composition: "BUILDING IS THE PLATFORM and SUNKEN — round colosseum tile where the central sand-pit is RECESSED below the ring of stepped seating, viewer looks slightly down into the arena bowl, no traditional walls",
    heroFeature: "a MONUMENTAL FLOATING EMPEROR'S THRONE (carved gilded marble, ornate beyond reason) hovers above the arena pit, while a HOLOGRAPHIC TRANSLUCENT CROWD of cheering spectators fills every seat in the stepped seating — you can hear the roar even though no audio is rendered, the air shimmers with imagined energy",
    facing: "SW" },
  { id: "mana_quell",     name: "Bandbreite-Quelle", category: "production", emoji: "💧",
    silhouette: "large pillared crew-scale mana spring with a multi-tier carved basin, glowing-blue water cascading downward",
    details: "four runic monoliths surrounding the basin, glowing wisps of mana-energy rising into the air, lush bioluminescent plants",
    signature: "the four-monolith circle around a glowing-blue cascading mana basin",
    composition: "FLOATING CLUSTER composition — multi-tier basin levitates above a wide circle of broken stone fragments, four monoliths orbit at the cardinal points, glowing wisps fill the void where a platform would be",
    heroFeature: "a GEYSER OF LIQUID MANA erupts from the basin in a perfect rising spiral arc and FREEZES MID-AIR INTO A ROTATING HELIX of luminescent fluid sculpture — wisps of mana spiral up the helix like climbing the strands of DNA, occasionally crystallizing into glowing runes that orbit the structure",
    facing: "NE" },
  { id: "allianz_zentrum",name: "Bund-Halle",  category: "utility",    emoji: "🏛️",
    silhouette: "imposing diplomatic alliance hall with a domed roof and a banner-pole crowned with a crew-flag, wide marble entrance",
    details: "five smaller flag-poles with allied banners flanking the entrance, a circular meeting-table visible through the open doors",
    signature: "the central crew-flag flying highest among five allied flags",
    composition: "domed rotunda on a circular mosaic platform — central crew-flag pole crowns the dome and reaches very high, five smaller flag-poles ring the platform edge — rotational symmetry around the central pole",
    heroFeature: "the CREW-BANNER on the central pole is woven from LIVING TEAL FIRE — the cloth IS flame, snapping in an unfelt wind, embers cascading off it but never consuming it; thin streamers of flame connect the central banner to each of the five smaller flags in a star-pattern spider-web of fire",
    facing: "NW" },
  { id: "spaeher_wachposten",name: "Kundschafter-Lager",category: "combat",  emoji: "👁️",
    silhouette: "elevated wooden scout outpost on stilts with a spotting platform on top, rope-ladder access, signal-fire bowl",
    details: "spyglass on a tripod, a tactical map pinned to the wall, falconer's perch with a bird, signal-flag rolled on a stand",
    signature: "the elevated stilted lookout platform + the spyglass-on-tripod",
    composition: "STILTED VERTICAL — tall wooden outpost on stilts (3:1 vertical), small square platform but the stilts elevate the spotting deck to twice the typical height, rope-ladder hangs asymmetrically off one side",
    heroFeature: "a MASSIVE MYTHIC GRIFFIN (the size of a small dragon) perches on top of the spotting platform with feathers ruffling — eyes glowing gold, scanning the horizon with predator focus, half its bulk and one outstretched wing project beyond the upper-right frame edge; one of its feet grips the railing, talons biting into the wood",
    facing: "SE" },
  { id: "sammel_leuchtfeuer",name: "Versammlungs-Feuer",category: "combat", emoji: "🔥",
    silhouette: "tall iron beacon-tower with a massive flaming brazier on top, spiral stairs winding up the exterior",
    details: "the brazier flames roaring tall and bright, smoke drifting upward, war-banners along the spiral stair, ember sparks in the air",
    signature: "the towering flame-brazier silhouette visible from anywhere in the base",
    composition: "TALLEST OF ALL — extremely thin iron beacon-tower (4:1 height-to-base), octagonal stone base, spiral exterior staircase wraps the shaft, massive flaming brazier crowns the top — pure verticality, the brazier breaks the upper iso-bounds",
    heroFeature: "the flame on top is a 3-TIERED TORNADO OF FIRE (a vertical cyclone of layered flame) that pulls embers UP into a tight column visible far above the frame — the column twists in slow spiral, embers ride upward like fireflies in a thermal, the entire upper third of the image dominated by the firestorm column",
    facing: "SW" },
  { id: "crew_taverne",   name: "Crew-Schenke",     category: "production", emoji: "🍻",
    silhouette: "large two-story timber alliance tavern with a grand swinging signboard, balcony on the second floor, multiple windows aglow",
    details: "kegs being delivered by a wagon, hero-portraits hung outside, lively warm light spilling from every window, smoke from the chimney",
    signature: "the multi-window glow + the upper balcony with hero-portraits of legendary recruits",
    composition: "ASYMMETRIC two-story building on a square cobble platform — second-floor balcony JETTIES OUT prominently over the right side, wagon parked outside extends footprint left, multi-window glow varies from window to window",
    heroFeature: "a LITERAL MYTHIC GIANT (a friendly old jolly giant 4× human-size) sits on the balcony drinking from a man-sized tankard, his head and broad shoulders project well above the roofline; his beard is braided with little lanterns, he raises the tankard in cheers — laughter you can almost hear",
    facing: "NE" },
  { id: "crew_hospital",  name: "Crew-Heilstation",    category: "combat",     emoji: "🏥",
    silhouette: "large white-stone alliance infirmary with a domed roof, multiple healing-cots visible through arched windows",
    details: "a healing-fountain in front courtyard, herb gardens flanking the path, healers' robes drying on a line, a giant red cross banner",
    signature: "the domed roof + the central healing-fountain in the courtyard",
    composition: "domed building wrapping a CENTRAL OPEN COURTYARD — round white-marble platform with a healing-fountain in the visible center, the building is a hollow ring around the courtyard so the camera sees through the front opening into the fountain",
    heroFeature: "a HOLY UNICORN-PEGASUS drinks from the central healing-fountain — its rainbow mane (each hair a different luminous color) extends across the entire courtyard like a glowing banner, its single horn glows with soft white restorative light, golden hooves leave faint glowing prints on the marble",
    facing: "NW" },
  { id: "crew_akademie",  name: "Crew-Studienhalle",    category: "utility",    emoji: "🎓",
    silhouette: "imposing alliance academy with multiple turret-spires, a giant clock-face above the entrance, telescope dome on the roof",
    details: "students depicted on banners, a giant compass-rose mosaic on the courtyard, scrolls and books piled on outdoor reading benches",
    signature: "the giant clock-face above the entrance and the turreted academy silhouette",
    composition: "MULTI-SPIRE silhouette — central tall academy turret flanked by two shorter spires, set on a square stepped marble platform with a giant compass-rose mosaic on the front step — three-peak skyline silhouette",
    heroFeature: "a MASSIVE GOLDEN ASTROLABE-ORRERY (the size of the central tower itself, intricate brass rings, gemstone planets, latin engravings) rotates slowly in mid-air between the three spires — its rings tilt and spin at different rates, gold-leaf catching the light, projecting a halo of horoscope-glyphs onto the courtyard below",
    facing: "SE" },
  { id: "tempel_himmlisch",name: "Sphären-Heiligtum",category: "combat",emoji: "✨",
    silhouette: "ethereal floating-stone temple with golden filigree, levitating slightly above its tile, beams of holy light shining down",
    details: "celestial constellations visible behind it, a glowing celestial sigil on the roof, two seraphim statues, particles of golden light",
    signature: "the temple LEVITATES slightly above its base — beams of light hold it up",
    composition: "FULLY LEVITATING — temple floats alone above a cluster of broken floating stone shards, NO platform underneath, beams of holy light shine downward from above the temple, the entire mass hovers ~15% of frame-height above where a tile would normally be",
    heroFeature: "an ANGEL-SERAPHIM OF PURE LIGHT bigger than the temple itself stands BEHIND the floating temple — six majestic feathered wings unfolded as a divine backdrop, its body translucent gold-white luminous, its face hidden in radiance; the entire temple is held aloft in the cup of this angel's outstretched hand",
    facing: "SW" },
  { id: "goblin_markt",   name: "Trödel-Tausch",     category: "utility",    emoji: "👺",
    silhouette: "ramshackle bazaar tent run by goblin merchants, mismatched wooden stalls, a junk-heap of items being sorted",
    details: "a goblin scale weighing scrap, hanging mystery-bags, a 'one-eyed-deal' sign, dim greenish lanterns, mischievous shadows",
    signature: "the patched-together stall + the junk-heap of mismatched items being appraised",
    composition: "INTENTIONALLY CROOKED ramshackle pile on an irregular junk-heap platform — patched canvas + mismatched wooden stalls leaning at unequal angles, no straight lines, asymmetric on every axis, the platform itself is a pile of crates",
    heroFeature: "a GRINNING GOBLIN-KING (oversized and richly cartoony) presides from a junk-heap throne at the back — his crown is a comical mix of stolen items (a sword, a teacup, a lockbox, a single shiny boot), a too-thick ledger of crimes balanced on his lap, gold teeth flashing, gem-encrusted scepter held in his tiny fist",
    facing: "NE" },
];

/**
 * Prompt-Builder für Building-Sprite (Image oder Video).
 * Stil-Vorgabe: isometrisches RoK/CoD-Asset auf einer schwebenden Stein-/Gras-Plinte.
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
    `Quality / style — AAA mobile-game promotional hero-shot, cinematic, awe-inspiring, ultra-detailed, intricate hand-painted texture work, dramatic atmospheric lighting, painterly highlights, slight cel-shading, vibrant saturated colors, ornate filigree where appropriate, the kind of asset you'd see on a key-art splash screen or trailer-thumbnail — NOT a generic mid-tier mobile icon. Each building must be visually distinct in silhouette — varied proportions (tall-narrow vs wide-low vs asymmetric vs levitating), varied platform shapes (square / round / hex / irregular / none), varied massing — NEVER a "default boxy stone block on square tile". Reference standard: Rise of Kingdoms / Call of Dragons / Watcher of Realms / Lords Mobile premium hero-art.`,
    `Camera: locked isometric 30° angle, square 1:1 frame, the unique silhouette of this specific building centered with breathing room (~10% padding around the bounding box of building+platform).`,
    `Facing direction (CRITICAL — the building is rotated within the iso world so its main entrance/facade points toward the ${building.facing} corner of the frame, NOT directly at the camera): ${({ NE: "the upper-right (NE) corner — door visible at an angle to the front-right, side wall facing camera-left", NW: "the upper-left (NW) corner — door visible at an angle to the front-left, side wall facing camera-right", SE: "the lower-right (SE) corner — door faces the camera-front-right, the back of the building is hidden upper-left", SW: "the lower-left (SE) corner — door faces the camera-front-left, the back of the building is hidden upper-right" }[building.facing])}. Do NOT default to a flat-on camera-front entrance — the variety of facings between buildings is essential.`,
    `Lighting: bright key light from upper-left at 45°, dramatic warm rim-light, atmospheric haze where appropriate, glow on signature/hero feature, soft ambient fill from upper-right — cinematic mood.`,
  ];

  const sharedNegative = `No text, no labels, no UI overlays, no watermark, no logo, no people, no characters, no border frames, no pedestals beyond the small iso-tile. NO ground extending past the tile, NO sky, NO clouds, NO trees beyond the small grass topping on the tile, NO water, NO mountains, NO scenery, NO atmospheric effects, NO god-rays, NO fog, NO mist, NO scattered rocks around the tile.`;
  const greenscreenNegative = `CRITICAL: NO green tones ANYWHERE on the building, walls, roof, banners, flags, gems, lights or accents. NO green moss-tinted glow, NO green flames, NO green liquids, NO bright lime accents. Use teal/cyan/blue/yellow/red/orange/purple/white instead. The ONLY green in the entire frame is the pure #00FF00 background.`;

  if (mode === "video") {
    return [
      // 1) Shot-Spec
      `Shot: a 3-second seamlessly looping animated isometric game-asset of "${building.name}" — a ${building.category} building, square 1:1 composition, 1024×1024, 30 fps.`,
      // 2) Background — GREEN SCREEN (Video kann keinen Alpha-Channel)
      `Background: SOLID PURE NEON GREEN (#00FF00, chroma-key green / green screen). Completely flat uniform single color filling the ENTIRE 1024×1024 frame including a clean ~8% margin around the floating tile. No gradients, no patterns, no texture, no shadows on the green, no environment, no scene. (The app chroma-keys the green to transparent in the browser.)`,
      ...subjectBlock,
      `FRAMING (critical): the building + tile is FULLY CONTAINED inside the 1024×1024 frame. Silhouette must NOT touch ANY of the four frame edges. Visible green margin on all four sides.`,
      `Motion: gentle ambient — slow vertical bob of the floating tile (±2 px), subtle on-structure animation only (flag waves, water flows, fire pulses, glow pulses on the signature element). NO environmental particle drift through empty green space. Camera fully static. First and last frame pixel-identical for seamless loop.`,
      `No audio. Silent video only.`,
      sharedNegative,
      greenscreenNegative,
    ].join(" ");
  }

  // IMAGE → fully transparent PNG
  return [
    `Single isolated isometric stylized 3D-render game-asset of "${building.name}" — a ${building.category} building. Square 1:1, 1024×1024.`,
    `Background: FULLY TRANSPARENT PNG with alpha channel — completely empty outside the silhouette of the building+tile. No background color, no gradient, no scene, no environment, no fill, no checkerboard, no white, no black, no green. The pixels outside the building+tile must have alpha = 0 (true transparency).`,
    ...subjectBlock,
    `FRAMING (critical): building + tile FULLY CONTAINED inside the frame with a clean ~10% transparent margin on all four sides. Silhouette must NOT touch any frame edge.`,
    sharedNegative,
    `Output format: PNG with alpha channel. Hard clean silhouette edge — no halo, no fringing, no semi-transparent background bleed, no soft scene fade.`,
  ].join(" ");
}

// ═══════════════════════════════════════════════════════════════════════
// RESOURCES — die 4 Resource-Icons + Speed-Token im Base-Modal & HUD
// ═══════════════════════════════════════════════════════════════════════

export type ResourceArt = {
  id: string;            // wood / stone / gold / mana / speed_token
  name: string;
  fallbackEmoji: string;
  accent: string;        // dominant color
  subject: string;       // hauptmotiv
  style: string;         // 1-2 Sätze visueller Stil
};

// 4 Crew-Resourcen (Berlin-Urban-Theme statt CoD-Fantasy):
//   wood  → Tech-Schrott  (Hardware: für Bau von Repeatern, Bunkern, Servern)
//   stone → Komponenten   (Bauteile: für Verteidigungsanlagen, Panzerung, hochstufige Gebäude)
//   gold  → Krypto        (Bezahlung von Söldnern/Crew-Members im Training)
//   mana  → Bandbreite    (Daten: für Forschung, Hacks, Algorithmen, Reboots/Heilung)
// Die internen IDs (wood/stone/gold/mana) bleiben erhalten — nur Display-Labels + Artwork ändern sich.
export const RESOURCES_ART: ResourceArt[] = [
  { id: "wood",         name: "Tech-Schrott", fallbackEmoji: "⚙️", accent: "#FF6B4A",
    subject: "a small pile of stacked urban scrap-tech: an old motherboard with chips, a broken keyboard fragment, tangled black/red cables, a cracked smartphone screen, rust-orange accents, a few loose screws — dystopian Berlin-junkyard hardware-pile",
    style: "stylized 3D-render, hand-painted texture, warm rust-orange + dark grey palette, soft cel-shading, slight drop-shadow underneath, gritty industrial vibe" },
  { id: "stone",        name: "Komponenten",  fallbackEmoji: "🔩", accent: "#8B8FA3",
    subject: "a small assembly of industrial components: a polished steel I-beam fragment crossed with chunky bolts, a thick coiled spring, two metal brackets with rivets, a protective steel-plate, all stacked tightly — heavy-duty construction hardware",
    style: "stylized 3D-render, cool grey + brushed-steel palette, crisp specular highlights on metal, soft cel-shading, subtle blue-grey ambient light, structured & weighty feel" },
  { id: "gold",         name: "Krypto",       fallbackEmoji: "💸", accent: "#FFD700",
    subject: "a single hexagonal Bitcoin-style crypto-token standing on edge with a stamped lightning-rune in the center, a small pile of 2-3 more coins half-buried beside it, faint holographic shimmer, subtle digital sparkles in the air",
    style: "stylized 3D-render, polished gold rim with bright cyan-blue digital glow on the rune-face, holographic glints, sparkle particles, premium cyberpunk-currency feel" },
  { id: "mana",         name: "Bandbreite",   fallbackEmoji: "📡", accent: "#22D1C3",
    subject: "a luminous teal-cyan data-stream flowing in a tight spiral, made of glowing 1s and 0s and waveform pulses, with a small satellite-dish or wifi-symbol icon in the center radiating concentric signal-rings outward",
    style: "stylized 3D-render, glowing translucent data-stream, internal cyan light source, hex-pattern matrix accents, electric-blue particles, ethereal sci-fi feel — pure data visualized" },
  { id: "speed_token",  name: "Speed-Token",  fallbackEmoji: "⚡", accent: "#FFD700",
    subject: "a hexagonal energy token coin with an embossed lightning-bolt rune in the center, golden metal rim, electric-yellow glowing core",
    style: "stylized 3D-render, premium currency-token feel, electric-yellow inner glow, polished gold rim, lightning sparks emanating, slight float-bob" },
];

export function buildResourcePrompt(input: { resource: ResourceArt; mode: "image" | "video" }): string {
  const { resource, mode } = input;
  // Greenscreen-Pipeline (chroma-key zu transparent im Frontend).
  // Mana ist cyan/teal — kein Konflikt mit #00FF00. Speed-Token ist gelb. Alle anderen sicher.
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
  id: string;            // silver / gold / event
  name: string;
  fallbackEmoji: string;
  accent: string;
  subject: string;
  style: string;
  rarity: string;        // narrative tier
};

export const CHESTS_ART: ChestArt[] = [
  { id: "silver", name: "Silber-Truhe", fallbackEmoji: "🥈", accent: "#C0C0D8", rarity: "common",
    subject: "a sturdy oak wooden treasure chest with polished silver iron banding, small silver lock with a glowing keyhole, slightly tilted lid showing a hint of contents inside",
    style: "stylized 3D-render, warm wood grain, cool silver metallic accents, soft cel-shading, gentle inner glow from keyhole, hand-painted feel" },
  { id: "gold",   name: "Gold-Truhe",   fallbackEmoji: "🥇", accent: "#FFD700", rarity: "epic",
    subject: "an ornate medieval treasure chest with rich oak wood and lavish gold-filigree banding, intricate engraved dragon emblem on the front, golden lock with brilliant glow, lid slightly ajar revealing cascading gold coins and a single gem",
    style: "stylized 3D-render, premium fantasy-loot vibe, polished gold with strong rim-light, magical golden particles drifting upward, painterly highlights, hint of light rays from inside" },
  { id: "event",  name: "Event-Truhe",  fallbackEmoji: "🎁", accent: "#FF2D78", rarity: "legendary",
    subject: "a magical limited-event chest with crimson-magenta lacquered wood, iridescent rainbow-prismatic banding that shifts colors, ornate star-shaped clasp glowing with magenta light, swirling event-particles (sparkles, runes) around it",
    style: "stylized 3D-render, ultra-premium event aesthetic, prismatic shifting reflections, swirling magenta-pink particles, dramatic key-light, magical glow halo" },
  { id: "legendary", name: "Legendäre Truhe", fallbackEmoji: "👑", accent: "#FFD700", rarity: "legendary",
    subject: "an ancient legendary chest carved from obsidian with brilliant gold-leaf engravings, massive ornate gold lock with a crown emblem, lid radiating intense divine light, golden runes glowing along the banding, single legendary gem floating above the keyhole",
    style: "stylized 3D-render, godly mythic vibe, brilliant golden volumetric god-rays, swirling divine particles, deep obsidian black with hot gold rim-light, premium endgame loot aesthetic" },
];

// ─── INVENTORY-ITEMS catalog (Speedups, Boosts, Keys, Elixirs, Tokens) ──
// Matched zur DB-Tabelle inventory_item_catalog (Migration 00217).
// Diese Items landen im Runner-Inventar und brauchen Artwork (sonst nur Emoji).
export type InventoryItemArt = {
  id: string;            // matches inventory_item_catalog.item_id
  category: "speedup" | "boost" | "key" | "elixir" | "token" | "chest";
  name: string;
  fallbackEmoji: string;
  accent: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  subject: string;       // visual subject for the prompt
};

export const INVENTORY_ITEMS_ART: InventoryItemArt[] = [
  // ── SPEEDUPS (build / research / universal × 1m / 5m / 15m / 60m / 8h / 12h / 24h) ─────
  // Visual: hourglass + category-emblem, color = duration tier (grey→cyan→violet→gold).
  // CRITICAL: each artwork MUST show the duration as a large bold readable label
  // (e.g. "1 MIN", "5 MIN", "15 MIN", "1 STD", "8 STD", "12 STD", "24 STD") so the
  // user instantly recognizes the duration at inventory thumbnail size.
  // ─ Bauen (Hammer-Crest) ──────────────────────────────
  { id: "speedup_build_1m",   category: "speedup", name: "Bau-Speedup 1 Min",   fallbackEmoji: "⏱", accent: "#9ba8c7", rarity: "common",
    subject: "a small glowing hourglass with a hammer crest in the foreground, blue-grey common-tier glow, with a LARGE BOLD READABLE white text label \"1m\" prominently displayed across the lower part of the hourglass" },
  { id: "speedup_build_5m",   category: "speedup", name: "Bau-Speedup 5 Min",   fallbackEmoji: "⏱", accent: "#9ba8c7", rarity: "common",
    subject: "a small glowing hourglass with a hammer crest, blue-grey common-tier glow, with a LARGE BOLD READABLE white text label \"5m\" prominently displayed across the lower part of the hourglass" },
  { id: "speedup_build_15m",  category: "speedup", name: "Bau-Speedup 15 Min",  fallbackEmoji: "⏱", accent: "#5ddaf0", rarity: "common",
    subject: "a polished hourglass with a hammer crest, cyan rare-tier glow, with a LARGE BOLD READABLE white text label \"15m\" prominently displayed across the lower part of the hourglass" },
  { id: "speedup_build_60m",  category: "speedup", name: "Bau-Speedup 1 Std",   fallbackEmoji: "⏱", accent: "#5ddaf0", rarity: "rare",
    subject: "ornate hourglass with hammer crest, vivid cyan rare-tier glow, with a LARGE BOLD READABLE white text label \"1h\" prominently displayed across the lower part of the hourglass" },
  { id: "speedup_build_8h",   category: "speedup", name: "Bau-Speedup 8 Std",   fallbackEmoji: "⏱", accent: "#a855f7", rarity: "epic",
    subject: "epic ornate hourglass with hammer crest, intense violet epic-tier aura, with a LARGE BOLD READABLE white text label \"8h\" prominently displayed across the lower part of the hourglass" },
  { id: "speedup_build_12h",  category: "speedup", name: "Bau-Speedup 12 Std",  fallbackEmoji: "⏱", accent: "#a855f7", rarity: "epic",
    subject: "epic engraved hourglass with hammer crest, swirling violet epic-tier particles, with a LARGE BOLD READABLE white text label \"12h\" prominently displayed across the lower part of the hourglass" },
  { id: "speedup_build_24h",  category: "speedup", name: "Bau-Speedup 24 Std",  fallbackEmoji: "⏱", accent: "#FFD700", rarity: "legendary",
    subject: "legendary golden hourglass with hammer crest, brilliant gold legendary-tier beams, with a LARGE BOLD READABLE white text label \"24h\" prominently displayed across the lower part of the hourglass" },

  // ─ Forschung (Atom/Beaker-Crest) ─────────────────────
  { id: "speedup_research_1m",   category: "speedup", name: "Forschungs-Speedup 1 Min",   fallbackEmoji: "🔬", accent: "#9ba8c7", rarity: "common",
    subject: "a small glowing hourglass with a beaker/atom science crest in the foreground, blue-grey common-tier glow, with a LARGE BOLD READABLE white text label \"1m\" prominently displayed across the lower part of the hourglass" },
  { id: "speedup_research_5m",   category: "speedup", name: "Forschungs-Speedup 5 Min",   fallbackEmoji: "🔬", accent: "#9ba8c7", rarity: "common",
    subject: "a small glowing hourglass with a beaker/atom science crest, blue-grey common-tier glow, with a LARGE BOLD READABLE white text label \"5m\" prominently displayed across the lower part of the hourglass" },
  { id: "speedup_research_15m",  category: "speedup", name: "Forschungs-Speedup 15 Min",  fallbackEmoji: "🔬", accent: "#5ddaf0", rarity: "common",
    subject: "a polished hourglass with a beaker/atom science crest, cyan rare-tier glow, with a LARGE BOLD READABLE white text label \"15m\" prominently displayed across the lower part of the hourglass" },
  { id: "speedup_research_60m",  category: "speedup", name: "Forschungs-Speedup 1 Std",   fallbackEmoji: "🔬", accent: "#5ddaf0", rarity: "rare",
    subject: "ornate hourglass with beaker/atom science crest, vivid cyan rare-tier glow, with a LARGE BOLD READABLE white text label \"1h\" prominently displayed across the lower part of the hourglass" },
  { id: "speedup_research_8h",   category: "speedup", name: "Forschungs-Speedup 8 Std",   fallbackEmoji: "🔬", accent: "#a855f7", rarity: "epic",
    subject: "epic ornate hourglass with beaker/atom crest, intense violet epic-tier aura, with a LARGE BOLD READABLE white text label \"8h\" prominently displayed across the lower part of the hourglass" },
  { id: "speedup_research_12h",  category: "speedup", name: "Forschungs-Speedup 12 Std",  fallbackEmoji: "🔬", accent: "#a855f7", rarity: "epic",
    subject: "epic engraved hourglass with beaker/atom crest, swirling violet epic-tier particles, with a LARGE BOLD READABLE white text label \"12h\" prominently displayed across the lower part of the hourglass" },
  { id: "speedup_research_24h",  category: "speedup", name: "Forschungs-Speedup 24 Std",  fallbackEmoji: "🔬", accent: "#FFD700", rarity: "legendary",
    subject: "legendary golden hourglass with beaker/atom crest, brilliant gold legendary-tier beams, with a LARGE BOLD READABLE white text label \"24h\" prominently displayed across the lower part of the hourglass" },

  // ─ Universal (Infinity-Loop-Crest) ───────────────────
  { id: "speedup_uni_1m",   category: "speedup", name: "Universal-Speedup 1 Min",  fallbackEmoji: "⚡", accent: "#5ddaf0", rarity: "rare",
    subject: "a small glowing hourglass with a universal infinity-loop crest in the foreground, cyan rare-tier glow, with a LARGE BOLD READABLE white text label \"1m\" prominently displayed across the lower part of the hourglass" },
  { id: "speedup_uni_5m",   category: "speedup", name: "Universal-Speedup 5 Min",  fallbackEmoji: "⚡", accent: "#5ddaf0", rarity: "rare",
    subject: "a small glowing hourglass with infinity-loop crest, cyan rare-tier glow, with a LARGE BOLD READABLE white text label \"5m\" prominently displayed across the lower part of the hourglass" },
  { id: "speedup_uni_15m",  category: "speedup", name: "Universal-Speedup 15 Min", fallbackEmoji: "⚡", accent: "#a855f7", rarity: "epic",
    subject: "polished hourglass with infinity-loop crest, violet epic-tier glow, with a LARGE BOLD READABLE white text label \"15m\" prominently displayed across the lower part of the hourglass" },
  { id: "speedup_uni_60m",  category: "speedup", name: "Universal-Speedup 1 Std",  fallbackEmoji: "⚡", accent: "#a855f7", rarity: "epic",
    subject: "ornate hourglass with infinity-loop crest, intense violet epic-tier glow, with a LARGE BOLD READABLE white text label \"1h\" prominently displayed across the lower part of the hourglass" },
  { id: "speedup_uni_8h",   category: "speedup", name: "Universal-Speedup 8 Std",  fallbackEmoji: "⚡", accent: "#a855f7", rarity: "epic",
    subject: "epic ornate hourglass with infinity-loop crest, intense violet epic-tier aura, with a LARGE BOLD READABLE white text label \"8h\" prominently displayed across the lower part of the hourglass" },
  { id: "speedup_uni_12h",  category: "speedup", name: "Universal-Speedup 12 Std", fallbackEmoji: "⚡", accent: "#FFD700", rarity: "legendary",
    subject: "legendary engraved hourglass with infinity-loop crest, brilliant gold legendary-tier particles, with a LARGE BOLD READABLE white text label \"12h\" prominently displayed across the lower part of the hourglass" },
  { id: "speedup_uni_24h",  category: "speedup", name: "Universal-Speedup 24 Std", fallbackEmoji: "⚡", accent: "#FFD700", rarity: "legendary",
    subject: "legendary golden hourglass with infinity-loop crest, brilliant gold legendary-tier beams, with a LARGE BOLD READABLE white text label \"24h\" prominently displayed across the lower part of the hourglass" },

  // ─ Heilung (Heart-Cross-Crest) ───────────────────────
  { id: "speedup_heal_1m",   category: "speedup", name: "Heilungs-Speedup 1 Min",   fallbackEmoji: "❤", accent: "#4ade80", rarity: "common",
    subject: "a small glowing hourglass with a red heart-cross medical crest in the foreground, soft green-white healing common-tier glow, with a LARGE BOLD READABLE white text label \"1m\" prominently displayed across the lower part of the hourglass" },
  { id: "speedup_heal_5m",   category: "speedup", name: "Heilungs-Speedup 5 Min",   fallbackEmoji: "❤", accent: "#4ade80", rarity: "common",
    subject: "a small glowing hourglass with a red heart-cross medical crest, soft green-white healing common-tier glow, with a LARGE BOLD READABLE white text label \"5m\" prominently displayed across the lower part of the hourglass" },
  { id: "speedup_heal_15m",  category: "speedup", name: "Heilungs-Speedup 15 Min",  fallbackEmoji: "❤", accent: "#4ade80", rarity: "common",
    subject: "a polished hourglass with a red heart-cross medical crest, vibrant green healing common-tier glow, with a LARGE BOLD READABLE white text label \"15m\" prominently displayed across the lower part of the hourglass" },
  { id: "speedup_heal_60m",  category: "speedup", name: "Heilungs-Speedup 1 Std",   fallbackEmoji: "❤", accent: "#4ade80", rarity: "rare",
    subject: "ornate hourglass with red heart-cross medical crest, vivid green rare-tier healing glow, with a LARGE BOLD READABLE white text label \"1h\" prominently displayed across the lower part of the hourglass" },
  { id: "speedup_heal_8h",   category: "speedup", name: "Heilungs-Speedup 8 Std",   fallbackEmoji: "❤", accent: "#4ade80", rarity: "epic",
    subject: "epic ornate hourglass with red heart-cross medical crest, intense violet-and-green epic-tier aura, with a LARGE BOLD READABLE white text label \"8h\" prominently displayed across the lower part of the hourglass" },
  { id: "speedup_heal_12h",  category: "speedup", name: "Heilungs-Speedup 12 Std",  fallbackEmoji: "❤", accent: "#4ade80", rarity: "epic",
    subject: "epic engraved hourglass with red heart-cross medical crest, swirling violet-and-green epic-tier particles, with a LARGE BOLD READABLE white text label \"12h\" prominently displayed across the lower part of the hourglass" },
  { id: "speedup_heal_24h",  category: "speedup", name: "Heilungs-Speedup 24 Std",  fallbackEmoji: "❤", accent: "#FFD700", rarity: "legendary",
    subject: "legendary golden hourglass with red heart-cross medical crest, brilliant gold legendary-tier beams with green healing aura, with a LARGE BOLD READABLE white text label \"24h\" prominently displayed across the lower part of the hourglass" },

  // ── BOOSTS / BUFFS (shield, gather, gold, wood, stone, mana, xp × 8h/24h) ──
  // Visual: a flask / charm / sigil with the boost-type emblem. Color = type.
  { id: "boost_shield_2k",   category: "boost", name: "Schild 2.000",  fallbackEmoji: "🛡", accent: "#5ddaf0", rarity: "rare",
    subject: "a glowing cyan crystal shield with a small 2K rune, energy barrier swirling around it" },
  { id: "boost_shield_10k",  category: "boost", name: "Schild 10.000", fallbackEmoji: "🛡", accent: "#5ddaf0", rarity: "epic",
    subject: "a large ornate cyan crystal shield with bright 10K rune, intense energy barrier, magical force-field aura" },
  { id: "boost_shield_8h",   category: "boost", name: "Schild-Buff 8 Std",  fallbackEmoji: "🛡", accent: "#5ddaf0", rarity: "rare",
    subject: "a glowing cyan tower-shield charm with 8h time glyph, protective aura" },
  { id: "boost_shield_24h",  category: "boost", name: "Schild-Buff 24 Std", fallbackEmoji: "🛡", accent: "#5ddaf0", rarity: "epic",
    subject: "an ornate cyan tower-shield charm with 24h time glyph, intense protective aura" },

  { id: "boost_gather_8h",   category: "boost", name: "Sammel-Buff 8 Std",  fallbackEmoji: "📦", accent: "#FFD700", rarity: "rare",
    subject: "a stylized loot basket charm with golden glow and 8h time glyph, gather-bonus aura" },
  { id: "boost_gather_24h",  category: "boost", name: "Sammel-Buff 24 Std", fallbackEmoji: "📦", accent: "#FFD700", rarity: "epic",
    subject: "an ornate gold loot-basket charm with 24h time glyph, brilliant gather aura" },

  { id: "boost_gold_8h",     category: "boost", name: "Krypto-Buff 8 Std",   fallbackEmoji: "💰", accent: "#FFD700", rarity: "rare",
    subject: "a glowing gold-coin stack charm with 8h time glyph, golden sparkle aura" },
  { id: "boost_gold_24h",    category: "boost", name: "Krypto-Buff 24 Std",  fallbackEmoji: "💰", accent: "#FFD700", rarity: "epic",
    subject: "an ornate gold-coin pile charm with 24h time glyph, brilliant gold aura" },

  { id: "boost_wood_8h",     category: "boost", name: "Tech-Schrott-Buff 8 Std",   fallbackEmoji: "🪵", accent: "#a07a3c", rarity: "rare",
    subject: "a stack of glowing wood logs charm with 8h time glyph, warm forest aura" },
  { id: "boost_wood_24h",    category: "boost", name: "Tech-Schrott-Buff 24 Std",  fallbackEmoji: "🪵", accent: "#a07a3c", rarity: "epic",
    subject: "an ornate wood-stack charm with 24h time glyph, intense warm forest aura" },

  { id: "boost_stone_8h",    category: "boost", name: "Komponenten-Buff 8 Std",  fallbackEmoji: "🪨", accent: "#9ba8c7", rarity: "rare",
    subject: "a glowing stone-pile charm with 8h time glyph, cool grey aura" },
  { id: "boost_stone_24h",   category: "boost", name: "Komponenten-Buff 24 Std", fallbackEmoji: "🪨", accent: "#9ba8c7", rarity: "epic",
    subject: "an ornate stone-pile charm with 24h time glyph, deep grey aura" },

  { id: "boost_mana_8h",     category: "boost", name: "Bandbreite-Buff 8 Std",   fallbackEmoji: "💎", accent: "#a855f7", rarity: "rare",
    subject: "a glowing violet mana-crystal charm with 8h time glyph, swirling magic aura" },
  { id: "boost_mana_24h",    category: "boost", name: "Bandbreite-Buff 24 Std",  fallbackEmoji: "💎", accent: "#a855f7", rarity: "epic",
    subject: "an ornate violet mana-crystal charm with 24h time glyph, brilliant magic aura" },

  { id: "boost_xp_8h",       category: "boost", name: "XP-Buff 8 Std",    fallbackEmoji: "📚", accent: "#FF2D78", rarity: "rare",
    subject: "a glowing pink star-medal charm with 8h time glyph, XP-burst aura" },
  { id: "boost_xp_24h",      category: "boost", name: "XP-Buff 24 Std",   fallbackEmoji: "📚", accent: "#FF2D78", rarity: "epic",
    subject: "an ornate pink star-medal charm with 24h time glyph, brilliant XP aura" },

  // ── KEYS (silver / gold) ─────────────────────────────────────────
  { id: "key_silver", category: "key", name: "Silberner Schlüssel", fallbackEmoji: "🗝", accent: "#C0C0D8", rarity: "rare",
    subject: "an ornate medieval silver skeleton-key with intricate filigree bow, polished silver, soft cool glow, slight ring-loop" },
  { id: "key_gold",   category: "key", name: "Goldener Schlüssel",  fallbackEmoji: "🗝", accent: "#FFD700", rarity: "epic",
    subject: "an ornate medieval gold skeleton-key with intricate dragon-shaped bow, polished brilliant gold, warm radiant glow, gem-inset ring-loop" },

  // ── ELIXIRS (Wächter-XP 5k / 20k) ────────────────────────────────
  { id: "elixir_5k",  category: "elixir", name: "Wächter-Elixier (5.000 XP)",  fallbackEmoji: "🧪", accent: "#a855f7", rarity: "rare",
    subject: "a tall ornate glass elixir bottle with swirling violet liquid and golden bubble caps, a small XP-rune label, magical violet glow" },
  { id: "elixir_20k", category: "elixir", name: "Wächter-Elixier (20.000 XP)", fallbackEmoji: "🧪", accent: "#FFD700", rarity: "epic",
    subject: "a regal large ornate glass elixir bottle with swirling gold liquid and prismatic cap, brilliant XP-burst rune label, intense golden god-light" },

  // ── TOKENS (Umsiedlung / Namensänderung / Premium-Ticket) ────────
  { id: "token_relocate", category: "token", name: "Umsiedlungs-Token", fallbackEmoji: "🎫", accent: "#5ddaf0", rarity: "rare",
    subject: "an ornate hexagonal coin-medallion with a stylized map-pin + arrow emblem, polished cyan-silver finish, soft teleport glow" },
  { id: "token_rename",   category: "token", name: "Namens-Token",      fallbackEmoji: "🎫", accent: "#FF2D78", rarity: "rare",
    subject: "an ornate hexagonal coin-medallion with a stylized name-tag + quill emblem, polished pink-silver finish, soft magenta glow" },
  { id: "token_fastvip",  category: "token", name: "Premium-Ticket",     fallbackEmoji: "🎫", accent: "#FFD700", rarity: "epic",
    subject: "an ornate hexagonal coin-medallion with a stylized crown + VIP star emblem, polished brilliant gold finish, dramatic golden god-rays" },

  // ── RESSOURCEN-PAKETE / AUSWAHL-TRUHEN (Migration 00234) ─────────
  { id: "res_pack_normal", category: "chest", name: "Normales Ressourcen-Paket", fallbackEmoji: "📦", accent: "#9ba8c7", rarity: "rare",
    subject: "a sturdy iron-banded wooden crate with a glowing blue question-mark sigil on the lid, hint of mixed loot peeking out (a coin, a gear, a circuit-chip, a wifi-bar shape), neutral grey-blue glow indicating random contents" },
  { id: "res_chest_choice_t1", category: "chest", name: "Auswahl-Ressourcen-Truhe (Stufe 1)", fallbackEmoji: "🎁", accent: "#5ddaf0", rarity: "rare",
    subject: "a polished iron-banded oak chest with four equal-size resource emblems on its facade (gold coin / gear / chip / wifi-bar) in a 2x2 grid, soft cyan glow from the inside, lid slightly ajar showing a player's choice prompt" },
  { id: "res_chest_choice_t2", category: "chest", name: "Auswahl-Ressourcen-Truhe (Stufe 2)", fallbackEmoji: "🎁", accent: "#a855f7", rarity: "epic",
    subject: "an ornate violet-banded chest with four glowing resource emblems (gold coin / gear / chip / wifi-bar) inset as gem-cabochons on the facade, lid slightly ajar with brilliant violet inner light, magical floating particles" },
  { id: "res_chest_choice_t3", category: "chest", name: "Auswahl-Ressourcen-Truhe (Stufe 3)", fallbackEmoji: "🎁", accent: "#FFD700", rarity: "legendary",
    subject: "a regal gold-filigree chest with four large faceted gemstone emblems on the facade representing each resource (golden coin, polished gear, glowing chip, wifi-bar antenna), lid radiating intense god-light, crown motif above the lock" },
];

export function buildInventoryItemPrompt(input: { item: InventoryItemArt; mode: "image" | "video" }): string {
  const { item, mode } = input;
  // Speedups dürfen Text (Zeitangabe) tragen — bei anderen Items kein Text.
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

// ─── Runner-Lights Prompt-Builder ──────────────────────────────────
// Liest LIGHT_VISUAL_SPECS aus game-config.ts → jeder Light bekommt einen
// individuellen Prompt der GENAU die On-Map-Animation beschreibt.
// vibe = Look, motion = Animation, texture = Material/Oberfläche.
// Damit matched die generierte Preview-Grafik im UI-Selector den tatsächlichen
// Trail den der Runner auf der Karte hinter sich herzieht.
export function buildLightPrompt(input: {
  id?: string;
  name: string;
  colors: string[];
  mode: "image" | "video";
  vibe?: string;
  motion?: string;
  texture?: string;
}): string {
  const colorStr = input.colors.join(", ");
  const vibe = input.vibe || `glowing energy trail named "${input.name}"`;
  const texture = input.texture || "smooth glowing core, soft outer halo";
  const motion = input.motion || "subtle shimmer along the trail";

  if (input.mode === "video") {
    return [
      `Shot: a 3-second seamlessly looping animated runner trail/light effect for "MyArea365", horizontal 16:9, 1920x1080, 30 fps.`,
      GREEN_BG_RULE,
      `Subject: ${vibe}, stretching horizontally across the full frame from left edge to right edge as a single continuous light ribbon. Avoid pure-green tones in the trail itself.`,
      `Color palette (strict): ${colorStr}. Use ONLY these colors for the trail. Smooth gradient blending along the length.`,
      `Surface character: ${texture}.`,
      `Motion: ${motion}. The ribbon body itself stays in place — only inner energy/particles/highlights animate. Do NOT move the trail itself across the frame.`,
      `Style: high-quality game-ready VFX, neon bloom, sharp bright core, soft glowing halo against the green background. Cyber-fantasy aesthetic. Premium look matching the trail's tier.`,
      `Composition: trail centered vertically, occupies central ~30% of vertical space. NO characters, NO runners, NO map, NO scenery.`,
      `Looping: final frame matches first frame, frame-perfect seamless loop.`,
      `Negative: no audio, no text, no labels, no watermarks, no UI.`,
    ].join(" ");
  }
  return [
    `A premium game-ready runner's light trail "${input.name}" for "MyArea365", 16:9 landscape, 1920x1080 PNG.`,
    GREEN_BG_RULE,
    `Subject: ${vibe}, stretching horizontally across the entire frame. Avoid pure-green tones in the trail.`,
    `Color palette (strict): ${colorStr}. Smooth gradient along the length, no off-palette colors in the trail.`,
    `Surface character: ${texture}.`,
    `Style: neon glow, sharp bright core, soft outer halo, premium VFX, cyber-fantasy aesthetic.`,
    `Negative: no characters, no runners, no map, no scenery, no text, no watermark.`,
  ].join(" ");
}

// ─── BASE-RING catalog (mirrors DB seed in migration 00207) ─────────────
export const BASE_RINGS_ART = [
  { id: "default",    name: "Standard",      description: "Schlichter Glow-Ring um die Base.",                     rarity: "common"    as const, color: "#22D1C3" },
  { id: "iron",       name: "Eisenring",     description: "Schwerer Eisen-Reif mit Nieten — solide Basis.",          rarity: "common"    as const, color: "#9aa3b8" },
  { id: "emerald",    name: "Smaragd-Halo",  description: "Leuchtend grüner Edelstein-Ring mit Pflanzenranken.",    rarity: "advanced"  as const, color: "#22D1C3" },
  { id: "frost",      name: "Frost-Halo",    description: "Eiskristalle wachsen aus dem Ring, kalter blauer Schimmer.", rarity: "advanced"  as const, color: "#5ddaf0" },
  { id: "golden",     name: "Gold-Reif",     description: "Massiver Goldring mit Punzierungen — Premium-Statussymbol.", rarity: "advanced"  as const, color: "#FFD700" },
  { id: "thorn",      name: "Dornenring",    description: "Verdrehte schwarze Dornenranken mit roten Tropfen.",     rarity: "epic"      as const, color: "#8B0000" },
  { id: "flame",      name: "Flammenring",   description: "Lodernde Flammen tanzen entlang des Rings, orange-gelb.", rarity: "epic"      as const, color: "#FF6B00" },
  { id: "plasma",     name: "Plasma-Ring",   description: "Pulsierende Energie-Adern in Magenta mit Cyan-Sparks.",  rarity: "epic"      as const, color: "#FF2D78" },
  { id: "crystal",    name: "Kristall-Ring", description: "Geschliffene Edelstein-Splitter im Hexagon-Muster.",     rarity: "epic"      as const, color: "#a855f7" },
  { id: "shadow",     name: "Schattenring",  description: "Tiefschwarzer Ring der Licht zu schlucken scheint.",     rarity: "epic"      as const, color: "#1a1a2e" },
  { id: "lightning",  name: "Blitzring",     description: "Zuckende Stromschläge umkreisen die Base unaufhörlich.", rarity: "epic"      as const, color: "#FFEE00" },
  { id: "nebula",        name: "Nebula-Ring",      description: "Kosmische Wirbel in Violett und Blau mit Sterndust.",         rarity: "legendary" as const, color: "#7c3aed" },
  { id: "solar",         name: "Sonnenring",       description: "Goldene Sonnenstrahlen explodieren nach außen — heroisch.",    rarity: "legendary" as const, color: "#FFD700" },
  { id: "lunar",         name: "Mondring",         description: "Silberner Halbmond mit Nachthimmel und funkelnden Sternen.",   rarity: "legendary" as const, color: "#C0C0FF" },
  { id: "void",          name: "Leere-Ring",       description: "Schwarzes Loch verzerrt das Licht — unheimliche Eleganz.",     rarity: "legendary" as const, color: "#5a3aa8" },
  { id: "prismatic",     name: "Prisma-Ring",      description: "Rotierender Regenbogen-Refraktor — alle Farben gleichzeitig.", rarity: "legendary" as const, color: "#FF00FF" },
  { id: "founders",      name: "Gründer-Ring",     description: "Limited Edition für die ersten 1000 Runner — niemals erneut.", rarity: "legendary" as const, color: "#FFD700" },
  { id: "transit_ring",  name: "Transit-Ring",     description: "Metro/Subway-Gelb mit rotierendem Linien-Symbol — urban.",     rarity: "epic"      as const, color: "#FFD700" },
  { id: "streetfood_halo",name: "Streetfood-Halo", description: "Warme Imbiss-Vibes mit Pommes-Gold-Sprinkles und Ketchup-Rot.", rarity: "epic" as const, color: "#FF6B4A" },
  { id: "spray_tag_ring",name: "Spray-Tag-Ring",   description: "Streetart-Spray mit Drips und Magenta-Akzenten — Crew-Tag.",  rarity: "legendary" as const, color: "#FF2D78" },
] as const;

// ─── NAMEPLATE catalog (mirrors DB seed in migrations 00117 + 00207) ────
export const NAMEPLATES_ART = [
  { id: "default",      name: "Standard",         description: "Schlichter Rahmen ohne Effekt.",                    rarity: "common"    as const },
  { id: "snow",         name: "Schneetreiben",    description: "Schneeflocken-Wirbel mit Wolken-Banner.",            rarity: "advanced"  as const },
  { id: "silver_wing",  name: "Silberflügel",     description: "Silberne Flügel rahmen den Namen — elegant und schnell.", rarity: "advanced"  as const },
  { id: "ocean_wave",   name: "Meereswelle",      description: "Türkise Wellen mit Schaumkronen und Möwen-Silhouette.",   rarity: "advanced"  as const },
  { id: "emerald_vines",name: "Smaragdranken",    description: "Lebende grüne Ranken mit goldenen Blüten.",          rarity: "advanced"  as const },
  { id: "floral",            name: "Blumenband",       description: "Pinkes Schleifen-Band mit Herzen.",                                rarity: "epic"      as const },
  { id: "thorn_rose",        name: "Dornen-Rose",      description: "Schwarze Rose mit Dornen-Schlinge — Gothic-Vibe.",                  rarity: "epic"      as const },
  { id: "streak_30",         name: "Streak-Champion",  description: "Kettenring — freigespielt durch 30-Tage-Streak.",                   rarity: "epic"      as const },
  { id: "cyber_glitch",      name: "Cyber-Glitch",     description: "Pixel-Distortion mit Neon-Magenta und Cyan-Scan-Lines.",            rarity: "epic"      as const },
  { id: "sunburst",          name: "Sonnen-Aureole",   description: "Goldene Sonnenstrahlen hinter dem Namen.",                          rarity: "legendary" as const },
  { id: "founder",           name: "Gründer-Banner",   description: "Limited Founders-Edition für die ersten 1000 Runner.",              rarity: "legendary" as const },
  { id: "galaxy",            name: "Galaxie-Band",     description: "Sternennebel mit Planeten-Orbits — kosmische Tiefe.",               rarity: "legendary" as const },
  { id: "graffiti_tag",      name: "Graffiti-Tag",     description: "Magenta-Spray-Tag mit Drips, Streetart-Stil — Crew-Sprache.",       rarity: "epic"      as const },
  { id: "subway_line",       name: "Metro-Linie",      description: "Verkehrsschild-Streifen mit Linien-Symbol — urban transit.",         rarity: "epic"      as const },
  { id: "skyline_silhouette",name: "City-Skyline",     description: "Schwarze Hochhaus-Silhouette mit leuchtenden Fensterreihen.",       rarity: "legendary" as const },
  { id: "club_strobe",       name: "Club-Strobe",      description: "Pulsierende Lasershow-Strobes in Pink + Cyan, Nightlife-Vibe.",     rarity: "epic"      as const },
  { id: "concrete_strip",    name: "Beton-Streifen",   description: "Brutalist-Beton mit gelben Bauarbeiter-Akzenten.",                  rarity: "advanced"  as const },
  { id: "streetfood_label",  name: "Streetfood-Marke", description: "Imbissbude-Schild-Optik mit warmen Lichtern — der Späti um die Ecke.", rarity: "advanced"  as const },
  { id: "punk_stickers",     name: "Punk-Sticker",     description: "Aufkleber-Collage mit DIY-Patches und Antifa-Pink.",                rarity: "epic"      as const },
  { id: "city_lights",       name: "City-Lights",      description: "Neon-Schriftzug-Style mit warmem Glühröhren-Glow.",                 rarity: "epic"      as const },
  { id: "crew_tag",          name: "Crew-Tag",         description: "Heraldisches Crew-Wappen mit Schriftrolle und Initialen.",          rarity: "legendary" as const },
] as const;

// ─── LOOT-DROP catalog (4 rarities matching app-map crateByRarity) ──────
export const LOOT_DROPS_ART = [
  { id: "common",    name: "Gewöhnlich", rarity: "common"    as const, hint: "small leather pouch / worn satchel" },
  { id: "rare",      name: "Selten",     rarity: "rare"      as const, hint: "polished iron-banded chest" },
  { id: "epic",      name: "Episch",     rarity: "epic"      as const, hint: "ornate enchanted container with violet runes" },
  { id: "legendary", name: "Legendär",   rarity: "legendary" as const, hint: "godly artifact with golden particle storm" },
] as const;

// ─── BASE-RING (Halo/Aura around the base pin) ──────────────────────────
export function buildBaseRingPrompt(input: {
  id: string;
  name: string;
  description: string;
  color: string;
  rarity: "common" | "advanced" | "epic" | "legendary";
  mode: "image" | "video";
}): string {
  const rarityVibe = {
    common: "simple subtle glow, minimal effect",
    advanced: "soft luminescence, refined detail",
    epic: "vivid energy, animated flourishes",
    legendary: "spectacular VFX, premium particle work, godly aura",
  }[input.rarity];

  if (input.mode === "video") {
    return [
      `Shot: a 3-second seamlessly looping animated halo/aura ring for the game "MyArea365", square 1024x1024, 30 fps.`,
      GREEN_BG_RULE,
      `Subject: a circular ring/halo named "${input.name}" — ${input.description}. ${rarityVibe}.`,
      `CRITICAL: the CENTER of the ring is FILLED WITH THE PURE-GREEN BACKGROUND — donut shape, the green inside the inner hole MUST be visible (it will become transparent at render). A base-icon is rendered inside this hole at runtime. Do NOT fill the center with anything else.`,
      `Geometry: perfectly centered ring, outer diameter ~95% of canvas, inner hole diameter ~55% of canvas (filled with pure green), ring band thickness ~20% of canvas radius.`,
      `Color palette (strict): primary ${input.color}, plus complementary glow tones. Avoid pure green tones in the ring itself.`,
      `Motion: only the ring's surface animates (rotation, shimmer, particles, energy flow). The ring itself does NOT move position.`,
      `Style: top-down view, premium VFX, sharp inner+outer edges, soft glow falloff against the green background.`,
      `Looping: final frame matches first frame for seamless loop.`,
      `Negative: no characters, no buildings, no text, no UI, no labels, no watermarks.`,
    ].join(" ");
  }
  return [
    `A premium game-ready base-pin halo/aura ring named "${input.name}" for "MyArea365", square 1024x1024 PNG.`,
    GREEN_BG_RULE,
    `Subject: ${input.description}. ${rarityVibe}.`,
    `CRITICAL: donut shape — the CENTER (inner hole) is FILLED with the pure-green background (becomes transparent at render). Do NOT draw the ring or anything else inside the hole.`,
    `Geometry: perfectly centered ring, outer diameter ~95% of canvas, inner hole diameter ~55% of canvas, band thickness ~20% of canvas radius.`,
    `Color palette (strict): primary ${input.color} plus harmonized glow tones. Avoid pure-green in the ring.`,
    `Style: top-down view, premium VFX, sharp clean ring silhouette.`,
    `Negative: no characters, no scenery, no text, no UI, no watermark.`,
  ].join(" ");
}

// ─── NAMEPLATE (Banner-Rahmen mit transparenter Mitte für den Runner-Namen) ─
export function buildNameplatePrompt(input: {
  id: string;
  name: string;
  description: string;
  rarity: "common" | "advanced" | "epic" | "legendary";
  mode: "image" | "video";
}): string {
  // Reichtum / Wildheit der Top+Bottom-Auswüchse skaliert mit Rarity
  const rarityVibe = {
    common:    "minimal restrained ornament — a few small subtle bumps or notches above and below, otherwise plain",
    advanced:  "moderate decorative growths — small spikes, tiny vines, or modest flourishes growing upward and downward at 3-5 places along the top+bottom",
    epic:      "rich ornate growths — multiple spikes, horns, curling vines, jagged thorns, asymmetric protrusions extending ABOVE and BELOW the bar silhouette, glowing accents, theme-appropriate flourishes",
    legendary: "spectacular elaborate outgrowths — large dramatic spikes, sweeping horns, twisting branches, jagged claws, glowing crystal shards, sharp sigils breaking out from the top and bottom edges in bold asymmetric arrangements with VFX glow, particle wisps, premium signature flourishes — make the silhouette WILD and unmistakable",
  }[input.rarity];

  // Vermeiden: "banner", "scroll", "plaque", "nameplate" — triggern AI-Side-Cap-Bias.
  // Mentales Modell: "horizontaler Rahmen mit Auswüchsen oben+unten,
  // Mitte komplett LEER (chroma-green), Text wird im Runtime in die leere Mitte gerendert."
  const themeWord = `"${input.name}"`;
  if (input.mode === "video") {
    return [
      `Shot: a 3-second seamlessly looping wide horizontal frame/border for the game "MyArea365", aspect ratio 5:1 (e.g. 1280x256), 30 fps.`,
      GREEN_BG_RULE,
      `Subject: a wide horizontal decorative frame themed ${themeWord} — ${input.description}. ${rarityVibe}.`,
      `CRITICAL TRANSPARENT-CENTER RULE: the ENTIRE CENTER of the frame must be FILLED WITH PURE-GREEN BACKGROUND #00FF00. The frame is just a TOP horizontal strip + a BOTTOM horizontal strip + thin LEFT and RIGHT cut-edges. The big rectangular area in the middle of the frame is COMPLETELY EMPTY GREEN — no plate, no parchment, no glass, no dark fill, no shading. The runner's name will be rendered into this empty middle space at runtime, so it must end up as fully transparent alpha after chroma-key removal.`,
      `LEFT vertical edge: FLAT CLEAN CUT — no end-cap, no ornament, no flourish, no gem, no metal trim. Just the raw cut where the strip ends.`,
      `RIGHT vertical edge: FLAT CLEAN CUT — same rules. Imagine a strip of architectural cornice sliced cleanly with shears.`,
      `TOP horizontal strip (top ~42% of canvas height — DOMINANT, takes nearly half the canvas): a continuous decorative band running the FULL WIDTH edge-to-edge. From this top band, decorative growths extend UPWARD into the area above the band — spikes, horns, vines, thorns, jagged crystals, twisting branches, claws, sigils, glowing shards. These growths can be ASYMMETRIC and VARIED along the width (different heights, different shapes, not a repeated tile pattern). Theme-appropriate to ${themeWord}.`,
      `BOTTOM horizontal strip (bottom ~42% of canvas height — DOMINANT, takes nearly half the canvas): mirrors the design language of the top band, with growths extending DOWNWARD. Decorative drips, roots, hanging chains, downward spikes, dripping vines, claws — varied, asymmetric, theme-matched.`,
      `MIDDLE empty zone (~16% of canvas height ONLY — a thin horizontal slot just tall enough for a single line of text. The runner name sits here at runtime — there must be NO excess vertical gap. The top strip sits IMMEDIATELY above this thin text-slot, the bottom strip sits IMMEDIATELY below it. Imagine a bookmark: thick decorative top, thin readable line in the middle, thick decorative bottom): completely empty pure GREEN #00FF00 — NO graphics, NO decoration, NO text, NO shading, NO frame border crossing through it. Just empty green that becomes transparent at render. This is where the runner-name goes.`,
      `Color palette: theme-matched, vibrant. The TOP+BOTTOM strips and their growths are the only colored elements. Avoid pure-green in the strips themselves.`,
      `Motion: only the top and bottom strips with their growths animate (shimmer, particles flow along outline, glowing pulse on tips of spikes, wisps drifting from claws/horns). The middle empty zone stays uniformly green and motionless.`,
      `Style reference: think "fantasy game UI rune-frame with decorative top+bottom edges and a TRANSPARENT WINDOW in the middle for text" — like an open window with carved upper and lower lintels but NO glass and NO frame on the sides between them. NOT a fantasy banner, NOT a scroll, NOT a placard, NOT a solid nameplate.`,
      `Looping: final frame matches first frame for seamless loop.`,
      `Negative prompt — strictly forbidden: filled middle band, parchment center, dark plate in middle, glass/frosted center, ANY decoration in the middle zone, end-caps, side ornaments on left/right vertical edges, side gems, side carvings, scroll ends, banner tails, ribbon ends, text, letters, numbers, faces, scenery, full rectangle silhouette without asymmetric growths.`,
    ].join(" ");
  }
  return [
    `A premium wide horizontal decorative frame themed ${themeWord} for "MyArea365", aspect ratio 5:1 (e.g. 1280x256), PNG.`,
    GREEN_BG_RULE,
    `Subject: ${input.description}. ${rarityVibe}.`,
    `CRITICAL TRANSPARENT-CENTER RULE: the ENTIRE CENTER of the frame must be FILLED WITH PURE-GREEN BACKGROUND #00FF00 so it becomes fully TRANSPARENT after chroma-key removal at render-time. The frame consists of ONLY a TOP decorative strip + a BOTTOM decorative strip. The huge middle rectangular zone between them is COMPLETELY EMPTY GREEN — no plate, no parchment, no dark fill, no shading, no border crossing through. Text will be drawn into this empty middle by the app at runtime.`,
    `LEFT vertical edge: FLAT CLEAN CUT — absolutely no end-cap, no ornament, no flourish, no gem, no metal trim, no carving. Just where the strip was sliced.`,
    `RIGHT vertical edge: FLAT CLEAN CUT — same rules.`,
    `TOP horizontal strip (top ~42% of canvas height — DOMINANT, takes nearly half the canvas): continuous decorative band edge-to-edge. From this band, decorative growths extend UPWARD into the area above — varied spikes, horns, twisting vines, jagged thorns, glowing crystal shards, claws, sigils, dripping flames — ASYMMETRIC and varied along the width (NOT a uniform repeated tile, but a designed silhouette with different heights and shapes at different positions). Theme-appropriate to ${themeWord}.`,
    `BOTTOM horizontal strip (bottom ~42% of canvas height — DOMINANT, takes nearly half the canvas): complementary design language to the top, with growths extending DOWNWARD — drips, roots, hanging chains, downward spikes, dripping vines, claws. Varied and asymmetric.`,
    `MIDDLE empty zone (~16% of canvas height ONLY — thin horizontal text-slot, just tall enough for a single line of 11-14px text. NO excess vertical gap. Top strip is IMMEDIATELY above this thin slot, bottom strip IMMEDIATELY below): completely empty pure GREEN #00FF00. NO content of any kind. This area becomes transparent.`,
    `Color palette: theme-matched, rich and vibrant. Strips and growths are the only colored elements. Avoid pure-green tones inside the strips themselves.`,
    `Style reference: "fantasy game rune-frame with decorative top+bottom and an open transparent window in the middle for runtime text" — the silhouette must look WILD and ORGANIC due to the asymmetric upward+downward growths, NOT like a flat sealed banner. NOT a banner, NOT a scroll, NOT a placard, NOT a nameplate.`,
    `Negative prompt — strictly forbidden: filled middle, parchment center, dark plate in middle, glass center, ANY decoration in the middle zone, frame border crossing the middle, end-caps, side ornaments on left/right edges, side gems, scroll ends, banner tails, ribbon ends, text, letters, numbers, faces, scenery, perfectly straight rectangular silhouette without growths.`,
  ].join(" ");
}

// ─── LOOT-DROP (Map drops, distinct from Chests catalog) ────────────────
export function buildLootDropPrompt(input: {
  id: string;             // common | uncommon | rare | epic | legendary
  name: string;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  hint: string;           // e.g. "leather pouch", "wooden crate"...
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
      `Shot: a 3-second seamlessly looping animated map loot-drop for "MyArea365", square 1024x1024, 30 fps.`,
      GREEN_BG_RULE,
      `Subject: a ${input.hint} loot drop, named "${input.name}" — ${rarityVibe}. Tier color accent: ${rarityColor}. Avoid pure-green tones in the subject.`,
      `Composition: subject centered, occupying ~70% of the frame on the green background, slight 3/4 top-down camera angle so it reads as a 3D pickup.`,
      `Motion: gentle bob up/down + subtle rotation + tier sparkles/glow pulse. Loops seamlessly.`,
      `Style: stylized cartoon-realism game asset, vivid saturation, sharp readable silhouette at small map-marker sizes (~50px). Tier-glow halo against the green background.`,
      `Negative: no scenery, no map tiles, no characters, no text, no UI, no watermarks.`,
    ].join(" ");
  }
  return [
    `A premium game-ready map loot-drop asset "${input.name}" for "MyArea365", square 1024x1024 PNG.`,
    GREEN_BG_RULE,
    `Subject: a ${input.hint} loot drop — ${rarityVibe}. Tier color accent: ${rarityColor}. Avoid pure-green in the subject.`,
    `Composition: centered, ~70% of frame, slight 3/4 top-down camera angle.`,
    `Style: stylized cartoon-realism, vivid saturation, sharp silhouette at small marker sizes (~50px). Tier-glow halo.`,
    `Negative: no scenery, no map, no characters, no text, no UI, no watermark.`,
  ].join(" ");
}

// ─── RESOURCE-NODE (on-map plünder spots) ────────────────────────────────
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
      `Shot: a 3-second seamlessly looping animated map node icon for "MyArea365" (Berlin cyberpunk setting), square 512x512, 30 fps.`,
      GREEN_BG_RULE,
      `Subject: a "${n.name}" plunder spot — ${n.hint}. Stylized cartoon-realism, vivid saturation. Avoid pure-green tones in the subject.`,
      `Composition: subject centered, ~75% of frame on green background, slight 3/4 top-down camera angle.`,
      `Color palette: primary ${n.color}, glow accent ${n.glow}. Cyberpunk neon hints.`,
      `Motion: subtle ambient animation (smoke/sparks/blinking lights/gear rotation). Object stays in place.`,
      `Style: sharp readable silhouette at small map-marker sizes (~32px), neon halo against the green background.`,
      `Looping: final frame matches first frame for seamless loop.`,
      `Negative: no characters, no text, no UI, no scenery.`,
    ].join(" ");
  }
  return [
    `A premium game-ready map resource-node icon "${n.name}" for "MyArea365", square 512x512 PNG.`,
    GREEN_BG_RULE,
    `Subject: ${n.hint}. Stylized cartoon-realism, vivid saturation. Avoid pure-green in the subject.`,
    `Composition: centered, ~75% of frame, slight 3/4 top-down camera angle.`,
    `Color palette: primary ${n.color} with ${n.glow} glow accents. Cyberpunk neon hints.`,
    `Style: sharp silhouette at ~32px, neon halo.`,
    `Negative: no characters, no scenery, no text, no UI.`,
  ].join(" ");
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
  { id: "potion_mana_m",        name: "Bandbreite-Trank",          rarity: "rare",   emoji: "⚡", hint: "electric blue flask, arcing bolts inside" },
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

// ─── Materials (Crafting/Upgrade) ──────────────────────────────────
// Vier Tier-Stufen: scrap (Tier 0) → crystal (Tier 1) → essence (Tier 2) → relikt (Tier 3).
// Pro Tier zunehmende Wertigkeit des dargestellten Items.

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
    `A crafting material item icon for "${input.name}" (tier ${input.tier} of 3), centered composition, 1024x1024, fully transparent background (PNG with alpha).`,
    `Material specifics: ${input.hint}.`,
    `Treatment: ${treatment}.`,
    `Style: high-detail painterly game item icon, Diablo/Path-of-Exile/Final-Fantasy quality, tight rim-light, readable at 64px in an inventory slot.`,
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



// ─── UI-Icons (Stats / Klassen / Action-Buttons / Badges) ──────────
export type UiIconSlotInput = {
  id: string;
  category: string;
  name: string;
  description: string;
  fallback_emoji: string;
};

export function buildUiIconPrompt(input: { slot: UiIconSlotInput; mode: "image" | "video" }): string {
  const s = input.slot;

  // Per-Slot subject hint
  const SUBJECT: Record<string, string> = {
    // Stats
    stat_troops:    "crossed sword and shield silhouette emblem, troop count icon, militant",
    stat_attack:    "single longsword diagonal with red glow, sharp blade, attack icon",
    stat_defense:   "tower shield emblem with steel rim, glowing crest center, defense icon",
    stat_hp:        "stylized heart icon, crimson red, soft inner glow, life points",
    stat_power:     "clenched fist emblem with radiating rays, power/strength icon, golden",
    // Klassen (Set D Kiez-Crew)
    class_infantry: "burly bouncer silhouette with crossed arms, suit jacket, broad shoulders, club bouncer icon",
    class_cavalry:  "motorbike courier helmet with visor, side view, urban delivery rider icon, sleek",
    class_marksman: "slingshot and stone, trajectory arc, urban thrower icon, precision",
    class_siege:    "sledgehammer crossed with crowbar, demolition icon, heavy and rough",
    // Aktionen
    action_spy:     "magnifying glass with eye in center, surveillance icon, spy emblem, cyan glow",
    action_rally:   "megaphone with sound waves, rally call icon, orange-red glow",
    action_attack:  "two crossed swords clashing, attack action icon, sharp metallic, pink-magenta glow",
    action_shield:  "circular shield emblem with star center, protection badge, cyan-blue energy",
    // Inbox-Kategorien
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
    // Repeater (Crew-Turf — Stadt/Ghetto-Style, gespraytes Funkmast-Setting)
    repeater_hq:     "fortified urban crew HQ bunker built from stacked rusty shipping containers and concrete slabs, massive signal antenna on top emitting pulsing teal #22D1C3 and magenta #FF2D78 energy rings, walls covered in spray-paint graffiti tags and stencils, boarded windows glowing neon teal from inside, satellite dishes, makeshift wooden scaffolding, hanging spray cans and chains, padlocks, dripping pink graffiti accents, dominant intimidating boss-base of a street crew, gritty street-art vibe",
    repeater_mega:   "beefed-up urban broadcast tower on a rooftop — mid-size steel lattice cell tower with multiple stacked satellite dishes pointing in different directions and two crossed antenna rods on top, alternating teal #22D1C3 and magenta #FF2D78 signal-rings pulsing outward, hot orange #FF6B4A warning lights blinking, coiled cables, ladder rungs, sideways DANGER stencil spray, layered crew tags on every flat surface, hanging boombox, mid-tier crew asset between humble street-pole and full HQ, heavy hitter actively broadcasting",
    repeater_normal: "jury-rigged urban signal repeater bolted to a battered street lamp post — twisted antenna rods, makeshift dish made from a hubcap, exposed wiring wrapped in duct tape, warning stickers, crew tags spray-painted on the pole base, single teal #22D1C3 signal-pulse ring radiating from antenna tip, pink #FF2D78 graffiti drip on pole, small blinking red LED, hanging spray can, weathered concrete base, improvised gritty claimed-territory marker, scrappy network node",
    // Silhouette-Slots (Mid-LOD — pictogram-simple, instantly readable at 16-36px on a map pin)
    // ULTRA-WICHTIG: Diese sind NICHT detaillierte Burgen-Renderings, sondern PIKTOGRAMME
    // wie Apple-Emoji oder Material-Icons — geometrisch, klar, abstrahiert. Bei 16px erkennbar.
    repeater_silhouette_hq:     "pictogram silhouette of a single fat castle keep — ONE wide rectangular tower with 3-4 chunky crenellations on top and a single triangular pennant flag on a short pole at the upper-right corner. NO side towers, NO antennas, NO dishes, NO inner windows or doors. Just the bold blocky keep + flag, like a chess-rook-with-flag pictogram. Solid uniform shape with hard clean edges.",
    repeater_silhouette_mega:   "pictogram silhouette of a stylized broadcast tower — ONE narrow vertical tower-mast with a triangular widening base, topped by a single wide horizontal crossbar (the antenna), with two thin spikes pointing up from the crossbar. NO lattice, NO multiple dishes, NO cables. Just a clean vertical T-shape with triangular base, like a stylized radio-tower icon. Solid uniform shape.",
    repeater_silhouette_normal: "pictogram silhouette of a tiny signal-mast — a SHORT thick pole with a single small triangular flag-shape OR a simple dot+arc (signal wave) on top. Total height roughly equal to width. Minimal — like the simplest possible map-pin glyph. NO antennas with multiple spikes, NO dishes, NO scaffolding. Solid uniform shape, instantly readable as a small marker even at 12px.",
    base_silhouette_runner:     "pictogram silhouette of a simple house — a SQUARE base with a triangular peaked roof on top, NO chimney, NO door, NO windows, NO flag, NO tower. Just the absolute simplest house-glyph (like a Material-Design or Apple-emoji home icon). Solid uniform shape with hard clean edges.",
    base_silhouette_crew:       "pictogram silhouette of a single fortified keep — ONE wide rectangular building with 4-5 chunky crenellations on top (battlement teeth), and a SINGLE triangular pennant flag on a short pole emerging from the center of the top. NO side towers, NO gatehouse, NO multiple flags, NO inner detail. Just the bold blocky castle-keep + ONE flag. Solid uniform shape, like a chess-rook-with-flag pictogram.",
  };

  const subject = SUBJECT[s.id] ?? `iconic single-subject illustration representing "${s.name}" — ${s.description}`;

  // Silhouette-Slots brauchen einen speziellen Prompt — FLACHES mono-color
  // Shape mit transparentem Hintergrund (keine Shading-/Glow-/3D-Effekte).
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

  const base = [
    `A premium UI icon for a mobile city-walking strategy game called "${s.name}".`,
    `Background: solid pure GREENSCREEN #00FF00, no other green hue, completely flat — for chroma-key removal.`,
    `Subject (centered, fills ~75% of frame): ${subject}.`,
    `Style: stylized 3D game-icon, slight isometric tilt, vibrant saturated colors, soft inner glow, thick clean silhouette readable at 24×24 px, painterly soft shading with strong rim-light.`,
    `Composition: 1024×1024 square, single icon centered, subtle radial vignette behind subject only (NOT touching frame edges — keep #00FF00 fully clean at edges).`,
    `Strict negatives: no text, no letters, no logo, no watermark, no human faces, no extra background scenery, no green spill on subject, no shadows on the green background, no anti-aliased green halo around subject (use clean alpha-friendly silhouette).`,
  ].join(" ");

  if (input.mode === "video") {
    return [
      base,
      "Animation: seamless 3-second loop. Subject pulses gently (scale 100% → 105% → 100%), inner glow brightens then dims once, optional tiny particle drifts upward off the icon. First and last frame must match exactly. No audio.",
    ].join(" ");
  }
  return base;
}

// ─────────────────────────────────────────────────────────────────
// TROOP-PROMPT — Set D Kiez-Crew (5 Klassen × 5 Tiers = 25)
// ─────────────────────────────────────────────────────────────────
type TroopSlotInput = { id: string; name: string; emoji: string; troop_class: string; tier: number };

export function buildTroopPrompt(input: { slot: TroopSlotInput; mode: "image" | "video" }): string {
  const s = input.slot;

  // Klassen-Beschreibung (alle urban, Set D Kiez-Crew)
  const CLASS_VIBE: Record<string, { role: string; outfit: string; weapon: string; signature: string }> = {
    infantry: {
      role: "burly nightclub bouncer / doorman (TÜRSTEHER)",
      outfit: "tight black bomber jacket or dark suit, earpiece, chunky boots",
      weapon: "no weapon needed — fists / brass knuckles / heavy belt",
      signature: "broad shoulders, crossed-arms idle pose, cyan accent #5ddaf0",
    },
    cavalry: {
      role: "fast urban courier / motorbike messenger (KURIER)",
      outfit: "leather riding jacket, helmet with reflective visor, fingerless gloves",
      weapon: "messenger bag, possibly small baton holstered, motorbike key on chain",
      signature: "dynamic forward-leaning stance, scarf or strap blowing back, orange accent #FF6B4A",
    },
    marksman: {
      role: "skilled urban marksman / sharpshooter (SCHÜTZE)",
      outfit: "hooded streetwear, cargo pants with side pockets, sneakers, single eye-scope monocle",
      weapon: "modern compact crossbow / paintball-style marker / slingshot with ball bearings",
      signature: "one-knee crouched aiming pose, focused squint, golden accent #FFD700",
    },
    siege: {
      role: "demolition worker / heavy hitter (BRECHER)",
      outfit: "heavy work boots, hi-vis vest over thick clothing, knee pads, dust mask around neck",
      weapon: "sledgehammer, crowbar, or oversized iron pipe",
      signature: "two-handed weapon grip, wide power-stance, violet accent #a855f7",
    },
    collector: {
      role: "urban scavenger / resource gatherer (SAMMLER)",
      outfit: "utility vest with many pockets, bandana around neck, work gloves, sturdy trousers, headlamp on cap",
      weapon: "no weapon — instead carries a heavy CARGO BACKPACK overflowing with scrap, copper wire, jerry-cans, a shovel or magnet-stick clipped to the back",
      signature: "loaded backpack visible behind shoulders, one hand holding tool the other a sack, friendly working stance, green accent #4ade80",
    },
  };

  // Tier-Progression: einheitliches Schema, eindeutig unterscheidbar
  // T1 Rookie · T2 Stamm · T3 Profi · T4 Elite · T5 Boss
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
    `A premium 3D character portrait for a mobile urban turf-war strategy game called "Stadt-Krieger".`,
    `Background: solid pure GREENSCREEN #00FF00, no other green hue, completely flat — for chroma-key removal.`,
    `Subject (centered, fills ~80% of frame, full-body or 3/4 body visible): ${subject}`,
    `Style: stylized 3D character art, slight isometric tilt, vibrant saturated colors, dramatic rim lighting from upper-left, urban neon-noir vibe, painterly soft shading, high detail on face and weapon, readable silhouette at 64×64 px.`,
    `Composition: 1024×1024 square, single character centered, subtle ground shadow under feet, NO scenery or buildings — keep #00FF00 fully clean at edges.`,
    `Strict negatives: no text, no letters, no logo, no watermark, no medieval armor, no fantasy elements, no swords or bows, no military uniforms, no green spill on subject, no anti-aliased green halo around subject (use clean alpha-friendly silhouette).`,
    `Tone: gritty modern street-gang aesthetic — like GTA-meets-Watch-Dogs character concept art.`,
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
// STRONGHOLDS — PvE-Wegelager (rote Bandit-Festungen auf der Map)
// ═══════════════════════════════════════════════════════════════════
// Ein einziges Artwork (Slot "wegelager") für alle Wegelager-Level —
// Level wird per Lv-Badge im UI angezeigt, das Sprite bleibt gleich.

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
    fallbackEmoji: "🏚️",
    accent: "#FF2D78",
    subject: "a hostile BANDIT-RUN URBAN SCRAPYARD ('Schrottplatz') — a sprawling 3D mountain of stolen and salvaged junk where road-pirates dismantle plundered goods. Lore: the Wegelager-Bande hijacks travelers, drags loot back here, and cuts everything down to scrap and parts which they sell on the black market. The whole thing is a living menace, smoke and sparks rising. Composition (CRITICAL — varied 3D, NOT a clean square tile): irregular asymmetric junk-mountain that rises tallest in the center-back and slopes down to scattered rubble in the front-right, the platform itself a cracked oil-stained concrete pad bordered by twisted chain-link fence with ragged barbed wire. Key elements: stacks of 3-4 wrecked colorful CARS / MOTORCYCLES / VANS partially crushed and welded into makeshift defensive walls (rusted reds, faded blues, oxidized greens), tipped-over OIL DRUMS some leaking some BURNING with orange flames spewing dark smoke, a tilted MAGNETIC CRANE-ARM with a giant black scrap-magnet hanging from chains low over the yard, sparks raining from the magnet, a crooked CORRUGATED-IRON WATCHTOWER built on top of stacked scrap with a narrow ladder going up its side, hanging skull-trophies and dangling chains, a heavy industrial WORKBENCH at the front-left with stolen merchant goods being torn apart (a half-dismantled wagon-wheel, gold coins spilled from a broken strongbox, splintered crates marked with X's, a ruined ale-keg, scattered weapons), graffiti spray-tags everywhere (skull-and-crossed-wrenches crew-mark, X marks, crimson drips), red lanterns and a single welder's torch glowing arc-blue from inside the watchtower, makeshift signage stenciled DANGER / KEEP OUT in dripping red paint. Mood: this is a place where travelers' caravans go to die — gritty, hostile, smoking, alive with the noise of grinders and hammers. Has a clear STORY of being attackable (loot stockpile visible at the front to motivate the player to raid it).",
    style: "AAA mobile-game promotional hero-shot — fully 3D, cinematic, ultra-detailed, intricate hand-painted textures (rust, oil-stains, scratched paint on cars), dramatic rim-light, atmospheric haze of smoke + dust, awe-inspiring sinister presence, the kind of asset you'd see on a key-art splash screen or trailer-thumbnail. Reference standard: Rise of Kingdoms / Call of Dragons (specifically the 'Outlaw Camp / Bandit Stronghold' assets) / Last Shelter Survival / Mad-Max-aesthetic urban scrapyards. Vibrant saturated colors with dominant rust-orange + crimson-magenta accents (#FF2D78), warm fire-orange torch glow, cool blue welder-arc rim, slight cel-shading, painterly highlights, the BUILDING ITSELF is a 3D iso scrap-mountain (NOT a flat illustration). The composition must FEEL three-dimensional with depth — wrecked cars layered front-to-back at different elevations.\n\nHERO FEATURE (the WOW moment — render BIG and prominent): a TILTED INDUSTRIAL CRANE-ARM with a HUGE BLACK ELECTROMAGNET on chains hangs over the yard like a vulture's head, sparks raining down from where it's lifting a half-crushed car carcass mid-air; the magnet is the size of a small house, painted with a crew skull-stencil, and a tattered crimson pirate-flag (skull-and-crossed-wrenches — NOT swords; wrenches show this is the SCRAP crew) flutters from the crane's tip"
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
/*  Slots: karte_base_bg / karte_waechter_bg / karte_crew_bg  */
/*         karte_inventar_bg / karte_shop_bg                  */
/*  Image (PNG/JPG) + Video (MP4) für animierte Szenen        */
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
    description: "Hintergrund für /karte/waechter — Arena/Trainingsplatz der Wächter",
    scene: "cinematic painted training arena interior: weathered stone-and-iron amphitheater rim with banners hanging from rafters, sand-and-grit floor in the foreground with crossed sword-and-spear racks along the walls, training dummies and pell-posts, a forge glowing in the back-left, a window in the back-right opening to a sunset sky, hanging chains, ornate guardian-class crests carved into pillars, ambient torchlight casting warm pools",
    mood: "rosé-sunset arena mood — palette warm rose (#FF6B4A) and apricot (#FFB088) sunset bleeding through windows, deep dusk-purple (#3A1F35) shadows, golden torch-glow accents, dramatic but inviting — feels like a heroic preparation space, not a menacing dungeon. Reference: RoK Heroes Hall / CoD Hero Sanctum.",
    motion: "ONLY in-place oscillations: torch flames flicker with 1-second flicker-cycles (per torch), forge embers pulse from dim to bright and back over 2 seconds (NO drifting upward), banners sway gently in place with a 3-second left-right cycle returning to neutral, dust glitters shimmer-in-place in the window light. NO sparks traversing the frame, NO objects translating, NO character motion. Every element must end the 6-second clip in its exact starting state.",
  },
  {
    id: "karte_crew_bg",
    name: "Crew — Banner-Halle",
    description: "Hintergrund für /karte/crew — Versammlungshalle der Crew",
    scene: "cinematic painted grand crew assembly hall: long timber-and-brass banquet table in the foreground with empty chairs around it, polished marble floor reflecting golden torches, tall stone walls hung with massive crew banners (heraldic emblems with crests, silken folds catching candle-light), a soaring vaulted ceiling with chandeliers, columns wrapped in ivy and gold leaf, throne-like high-backed chair at the head of the table on a low dais, war-map spread on the table surface with miniature carved tokens",
    mood: "regal gold-and-banner mood — palette deep royal-gold (#FFD700) and warm amber, deep red banner accents, candle-light pools of warm yellow, dark mahogany shadows in the corners but never oppressive, feels like a place of camaraderie and decision. Reference: RoK Alliance Hall / CoD Guild Hall.",
    motion: "ONLY in-place oscillations: candle flames flicker with 1-second cycles (each candle independent random phase), chandelier crystals shimmer with light-glints that pulse in place, banners ripple in place with a 3-second left-right cycle returning to neutral, gold leaf on columns subtly glints. NO objects translating, NO floating particles drifting, NO character motion. Every element must end the 6-second clip in its exact starting state.",
  },
  {
    id: "karte_inventar_bg",
    name: "Inventar — Lagerraum",
    description: "Hintergrund für /karte/inventar — Lagerhalle/Tresor mit Beuteschätzen",
    scene: "cinematic painted treasure-and-supply storage hall: warm wood-and-iron storage room with shelving from floor to ceiling stacked with chests, sacks of grain, stacks of weapons, rolled scrolls, bottled potions glowing softly, barrels of provisions, hanging cured meats and dried herbs, a heavy iron-bound door in the back, oil-lanterns hanging on chains casting warm pools, golden coins spilling from one tipped-over chest in the foreground catching light",
    mood: "warm-brown vault mood — palette saturated warm-brown (#5C4E32) and amber-gold (#D4A574), oil-lantern orange highlights, deep umber shadows, occasional cool blue glow from magic potions, feels rich and abundant — the player's hard-earned hoard. Reference: RoK Storehouse / CoD Vault.",
    motion: "ONLY in-place oscillations: lantern flames flicker softly with 1.5-second cycles, potion bottles glow brighter then dimmer with 2-second breathing pulse (return to start), gold coin highlights sparkle in place with 1-second twinkle. NO drift, NO floating particles, NO objects translating, NO character motion. Every element must end the 6-second clip in its exact starting state.",
  },
  {
    id: "karte_shop_bg",
    name: "Shop — Mystischer Marktstand",
    description: "Hintergrund für /karte/shop — magischer Händler-Stand",
    scene: "cinematic painted mystical merchant stall interior: rich purple velvet curtains draped from above as a backdrop, polished wooden counter in the foreground covered with arranged wares (crystal vials, jeweled rings on silk cushions, stacks of gem-encrusted scrolls, ornate lockboxes), shelves behind with countless glittering trinkets, hanging string-lights and tiny lanterns, a brass weighing scale center-counter, a half-open spellbook with glowing pages",
    mood: "soft-purple mystical mood — palette dominated by amethyst-purple (#583A6F) and pink-magenta (#FFB3D9) accents, candy-pink (#FFD6EC) curtain highlights, golden lantern warmth, NO menace — feels like a wonder-stall full of treasures begging to be bought. Reference: RoK Mysterious Merchant / CoD Boutique.",
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
      `🚫 ABSOLUTE CAMERA RULE — NO ZOOM-IN, NO ZOOM-OUT, NO PAN, NO TILT, NO TRACKING, NO PARALLAX, NO DOLLY, NO PUSH-IN. The framing at frame 1 and frame 180 (last frame) must be IDENTICAL pixel-positions. Treat this like a still photograph with only tiny localized animations on top — NOT a cinematic shot. If you add ANY camera motion the video is unusable.`,
      `🚫 ABSOLUTE TRAVERSAL RULE — NO objects may move ACROSS the frame: no flying birds, no drones, no airplanes, no vehicles, no walking people, no swimming fish, no drifting clouds, no falling leaves, no rising smoke that exits the frame, no traversing sparks. ALL motion must be LOCAL (under 5% of frame width/height) and OSCILLATING (return to start within the loop).`,
      `Allowed motion types ONLY: in-place flicker (flames, lanterns, neon, windows), in-place pulse/breathe (glowing objects), in-place ripple/sway (banners, curtains — must end at neutral starting position), in-place sparkle/twinkle (gems, reflections), in-place shimmer (heat haze, sunlight glints).`,
      `Per-scene motion guidance: ${bg.motion ?? "in-place oscillations only — minor flicker / pulse, no traversal."}`,
      `Loop integrity: every animated element must complete a full cycle and return to its EXACT starting state at the 6-second mark. Frame 1 and frame 180 must be visually indistinguishable. Test mentally: if I freeze on frame 180 then jump to frame 1, would I notice? If yes, the loop is broken.`,
      `Lighting: cinematic, painterly, soft directional key-light with rim accents in palette colors above. Mid-tones favored, no crushed blacks, no blown-out whites — UI text in white must remain legible over any region.`,
      `Style: AAA mobile-game key-art / 2.5D painted background — Rise of Kingdoms / Call of Dragons / Township / Royal Match background quality. Hand-painted textures, soft cel-shading, vibrant but not garish, family-friendly inviting tone.`,
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


