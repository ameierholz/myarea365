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

  // ══════ IMAGE-PROMPT ══════
  return [
    `Cinematic character key art, square 1:1, 1024x1024, single subject.`,
    `Background: SOLID PURE NEON GREEN (#00FF00, chroma-key green). Completely flat uniform color filling the entire frame including a clean margin around the character — no gradient, no pattern, no texture, no atmospheric effects. (Chroma-keyed to transparent in the app.)`,
    `Subject: ${subjectBase}. Pose: ${pose}, confident expression appropriate to the species.${speciesPose ? " " + speciesPose + "." : ""}`,
    `FRAMING (critical): character is FULLY CONTAINED inside the 1024x1024 frame with a uniform green margin of approximately 60-100 pixels (5-10% of frame size) on TOP, BOTTOM, LEFT and RIGHT. Silhouette must NOT touch any frame edge. Full head, both shoulders, both arms and the full base of the character are visible — nothing cropped, nothing extending past the frame border.`,
    `Hair and head: ${hair}.`,
    `Armor / outfit / body materials: ${armor} — adapted to the species silhouette, unique and distinct so this character does not look like any other character in the set.`,
    `Species signature details: ${profile.signature}.`,
    classMod && `Class traits (${classId}): ${classMod}.`,
    `Rarity and material feel: ${rarityMod}.`,
    `Signature aura tight to the character silhouette (close rim glow, max ~30 px beyond outline), themed as "${aura.name}" — dominant ${aura.primary} with ${aura.secondary} depth. Aura does NOT fill the frame and does NOT reach the frame edges.`,
    abilityTheme && `Aura subtly references the character's signature ability "${abilityTheme}".`,
    `Additional close-body effect: ${effect} — no wide smoke, fog, clouds, mist, sparkle dust, or atmospheric haze that covers the frame.`,
    `Lighting: ${aura.primary} rim light from the left, ${aura.secondary} rim light from the right, subtle top-light from above.`,
    `High detail on face and hands, sharp focus on character, tight silhouette.`,
    `CRITICAL: NO green tones on the character, armor, hair, skin, aura or effects. ONLY the background is #00FF00 — green on the character would be keyed transparent.`,
    `NO rooftop, NO city, NO sky, NO moon, NO ground shadows on a floor, NO clouds, NO fog, NO mist, NO smoke, NO magic circles or glyphs behind the character, NO sparkle dust clouds, NO colored backdrop. Only: pure #00FF00 + contained character (safe margin all sides) + tight silhouette aura.`,
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


