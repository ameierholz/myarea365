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

// ═══════════════════════════════════════════════════════════════════════
// BASE-THEMES (Runner-Base + Crew-Base) — für Map-Pin + Modal-Header
// ═══════════════════════════════════════════════════════════════════════
//
// Pro Theme erzeugen wir 4 Assets:
//   {theme}_runner_pin     — 1024×1024 transparent, kleine Burg/Outpost (1 Hero-Struktur)
//   {theme}_runner_banner  — 1600×600   Header-Image für Modal (Solo-Atmosphäre)
//   {theme}_crew_pin       — 1024×1024 transparent, Festung mit Mauern + Bannern (Compound)
//   {theme}_crew_banner    — 1600×600   Header-Image (große Crew-Halle, Faction-Vibes)

export type BaseThemeId = "medieval" | "scifi" | "pirate" | "viking" | "ninja" | "halloween";
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
    id: "medieval",
    name: "Mittelalter",
    description: "Klassische Burg-Ästhetik mit Steintürmen, Wimpel-Bannern und warmen Fackel-Akzenten.",
    palette: "warm stone gray, slate-blue tile rooftops, teal banners, soft golden torchlight",
    accent: "#22D1C3", glow: "rgba(34,209,195,0.55)",
    ambient: "fairy-tale fortress, golden hour sun, distant mountains, mist in valleys",
    runnerSubject: "a single small stone watchtower-keep with a teal pennant flag, wooden gate, surrounded by pine trees on a low grass mound",
    crewSubject: "a large fortified medieval castle compound: high stone walls, four corner towers, central great hall with steep tiled roofs, teal heraldic banners along the walls, drawbridge and gatehouse",
    bannerScene: "epic cinematic establishing shot of a medieval kingdom keep at sunset, wide vista, banners snapping in wind, soft volumetric light",
  },
  {
    id: "scifi",
    name: "Sci-Fi-Outpost",
    description: "Futuristischer Plasma-Outpost mit Holo-Glyphen, weißem Beton und violett-cyanem Neon.",
    palette: "matte white concrete, dark obsidian panels, vivid magenta-violet neon, cyan holo-grid",
    accent: "#7C3AED", glow: "rgba(124,58,237,0.6)",
    ambient: "near-future, hard-sci-fi, clean panel seams, holographic UI floating around the structure, scan-lines",
    runnerSubject: "a single sleek hexagonal sci-fi outpost module with a glowing magenta plasma core dome on top, antenna mast, tiny holo-display projecting energy stats, set on a dark glass platform",
    crewSubject: "a massive sci-fi fortress: multi-tiered hex-modules linked by glowing walkways, central plasma reactor spire, defensive turret pylons at corners, holo-shield projectors emitting violet hexagonal grid, anti-grav landing pad",
    bannerScene: "cinematic wide shot of a futuristic mountain-top outpost at twilight, atmospheric haze, distant city lights, glowing energy beams shooting into the sky",
  },
  {
    id: "pirate",
    name: "Pirat-Versteck",
    description: "Versteckte Bucht mit Holzbastionen, Schiffsplanken-Plattformen und gold-warmem Laternenlicht.",
    palette: "weathered oak planks, rusted iron, deep teal sea, sun-bleached canvas sails, gold lantern glow",
    accent: "#FFD700", glow: "rgba(255,215,0,0.55)",
    ambient: "tropical hidden cove, palms, salt spray, foggy morning, hand-painted treasure-map vibe",
    runnerSubject: "a single small wooden pirate watch-shack on stilts above shallow water, oak planks, a single Jolly-Roger flag on top, treasure chest beside the entrance, a rowboat tied to a post",
    crewSubject: "a large pirate stronghold built into a rocky cove: multi-level wooden bastion with cannon ports, anchored galleon visible behind, palm-trees, treasure pile glittering in front, multiple Jolly-Roger flags, hanging lanterns",
    bannerScene: "cinematic wide shot of a hidden tropical pirate cove at golden hour, anchored ships, mist over water, parrots flying, painterly fantasy-adventure style",
  },
  {
    id: "viking",
    name: "Wikinger-Halle",
    description: "Massiver Holz-Mead-Hall mit geschnitzten Drachenköpfen, Pelz-Drapierungen und Feuer-Akzenten.",
    palette: "rich cedar wood, dark iron, ember-orange fires, fur-white drapes, dark snow-grey stone",
    accent: "#FF6B4A", glow: "rgba(255,107,74,0.55)",
    ambient: "Nordic winter, crisp snowy fjord backdrop, smoke from chimneys, runic carvings, harsh beautiful low sun",
    runnerSubject: "a single small Norse longhouse with steep wooden shingle roof, carved dragon-head gable, two crossed wooden axes above the door, a smoking chimney, fur draped over the entrance, a single rune-stone outside",
    crewSubject: "a great Viking mead-hall compound: long timber hall with massive carved dragon prows on either gable, surrounded by a wooden palisade, fire-pits burning in front, longships in a frozen fjord behind, totem poles with runes, snow drifts",
    bannerScene: "cinematic wide shot of a Norse village at dusk, snow-covered mountains, aurora borealis above, longships at the shore, smoke rising from longhouses, painterly fantasy",
  },
  {
    id: "ninja",
    name: "Ninja-Dojo",
    description: "Verstecktes Dojo im Bambushain — dunkles Holz, Tatami, rote Tor-Akzente und Mond-Atmosphäre.",
    palette: "deep black-stained timber, white shoji paper screens, blood-red torii lacquer, jade-bamboo green, cyan moonlight",
    accent: "#22D1C3", glow: "rgba(34,209,195,0.5)",
    ambient: "moonlit Edo-period Japan, dense bamboo forest, mist drifting, ink-painting aesthetic, tranquility with hidden danger",
    runnerSubject: "a single small dark-wood ninja dojo with curved pagoda roof, a small red torii gate at the entrance, paper lanterns glowing, a koi pond in front, surrounded by dense bamboo",
    crewSubject: "a hidden ninja stronghold: multi-tier pagoda with sweeping curved roofs, surrounding wooden training platforms, a large red torii arch entrance, watch-platforms in the trees, two stone foo-dog statues, mist rolling through the bamboo grove",
    bannerScene: "cinematic wide shot of a moonlit hidden mountain temple in Japan, mist, cherry blossoms, distant pagoda silhouettes, ink-wash painterly style",
  },
  {
    id: "halloween",
    name: "Halloween (saisonal)",
    description: "Saisonal: spukige Burgruine mit Kürbissen, lila Nebel und gespenstischer Grün-Aura.",
    palette: "bone-white stone, pumpkin orange, deep purple sky, sickly bio-luminescent green, crow black",
    accent: "#FF8C00", glow: "rgba(255,140,0,0.6)",
    ambient: "spooky autumn night, full blood-moon, swirling purple fog, jack-o-lanterns flickering, ravens circling",
    runnerSubject: "a single small haunted gothic crypt-shrine with crooked stone walls, a glowing jack-o-lantern at the door, twisted dead tree behind, purple fog, a single raven on the roof",
    crewSubject: "a sprawling haunted castle ruin under a blood-moon: collapsed turrets, glowing jack-o-lanterns lining the path, ghostly purple mist, hanging skeletal banners, swirling green spirit-energy at the gate",
    bannerScene: "cinematic wide shot of a haunted castle on a hill at midnight, blood-moon, ravens flying, purple fog, autumn-orange leaves blowing, gothic horror atmosphere",
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
};

export const BUILDINGS_ART: BuildingArt[] = [
  // ─── Phase 1 + Starter (00079 + 00082) ───
  { id: "wegekasse",      name: "Wegekasse",        category: "storage",    emoji: "🏦",
    silhouette: "small fortified treasury vault on a stone base, iron-banded oak door, gold coin pile spilling from a half-open chest in front",
    details: "soft golden glow from inside the vault, brass keyhole, two crossed gold-trimmed guard pikes, a single torch flickering",
    signature: "open chest of glittering gold coins is the unmistakable hero element" },
  { id: "wald_pfad",      name: "Wald-Pfad",        category: "production", emoji: "🌲",
    silhouette: "small wooden lumberjack camp with a thatched-roof shed, axe stuck in a tree-stump chopping block, stack of fresh-cut logs",
    details: "lush moss-covered ground, two pine saplings, sawdust scattered around, a small hand-cart with logs",
    signature: "vibrant pine-tree backdrop and the chopping-axe-in-stump composition" },
  { id: "waechter_halle", name: "Wächter-Halle",    category: "combat",     emoji: "⚔️",
    silhouette: "fortified guardian hall with steep peaked tile roof, two crossed swords mounted above the gate, banner-pillars on either side",
    details: "purple-magenta heraldic banners with a sword sigil, two stone gargoyle statues, glowing rune-stones at the entrance",
    signature: "crossed-swords emblem above the gate, glowing magenta rune accents" },
  { id: "laufturm",       name: "Lauftürme",        category: "utility",    emoji: "🗼",
    silhouette: "tall slender stone watchtower with a spiral wooden staircase visible, conical teal-tile roof, lookout balcony at the top",
    details: "spyglass leaning against the railing, a small flag fluttering, glowing teal-cyan beacon at the top floor",
    signature: "spinning beacon-light at the very top, casting cyan rays" },
  { id: "lagerhalle",     name: "Lauf-Lager",       category: "storage",    emoji: "📦",
    silhouette: "wide low warehouse with double sliding wooden doors, stacks of crates and barrels visible inside through one open door",
    details: "weathered timber framing, an inventory chalkboard on the side wall, hanging lantern, a hand-cart parked outside",
    signature: "open warehouse door revealing a treasure-trove of stacked crates and glinting items" },
  { id: "schmiede",       name: "Schmiede",         category: "utility",    emoji: "⚒️",
    silhouette: "stone-walled blacksmith forge with a chimney belching warm smoke, glowing red-orange furnace visible through the front opening",
    details: "anvil with hammer and tongs in front, finished sword leaning against the wall, sparks flying from the forge, leather apron hung outside",
    signature: "intense glowing forge interior — the heat-light should pulse softly in motion mode" },
  { id: "gasthaus",       name: "Wegerast",         category: "production", emoji: "🍻",
    silhouette: "two-story half-timbered tavern with a swinging signboard depicting a foaming mug, warm windows glowing yellow",
    details: "wooden barrels stacked beside the door, a fiddle resting on a bench, lantern hanging from the eaves, hops vines growing up the wall",
    signature: "the swinging mug signboard and the warm golden window-light spill" },
  { id: "wachturm",       name: "Posten-Turm",         category: "combat",     emoji: "🏯",
    silhouette: "robust square stone watchtower with crenelated battlements, narrow arrow-slits, single heavy iron-bound door at base",
    details: "hot-orange torch on each corner of the battlement, defensive ballista visible on top, banners with a shield sigil",
    signature: "crenelated top + defensive ballista silhouette and the four corner torches" },

  // ─── Expansion 00085 — Produktion ───
  { id: "saegewerk",      name: "Reisig-Bündler",         category: "production", emoji: "🪓",
    silhouette: "open-walled timber sawmill with a large vertical sawblade powered by a wooden water-wheel, conveyor of fresh planks",
    details: "splashing water from the wheel, sawdust drifting through sunbeams, neat stacks of cut planks beside the building, lumberjack tools",
    signature: "spinning wooden water-wheel splashing — animate slowly in motion mode" },
  { id: "steinbruch",     name: "Pflaster-Brecher",       category: "production", emoji: "⛏️",
    silhouette: "small open-pit stone quarry with carved-out terraces, pickaxe stuck in a half-cut block, mine-cart on rails",
    details: "stone dust in the air, scaffolding for higher cuts, a small forge for tool-sharpening, raw boulders and chiseled blocks",
    signature: "the cut-out tiered quarry pit + the loaded mine-cart on rails" },
  { id: "goldmine",       name: "Zoll-Schacht",         category: "production", emoji: "💰",
    silhouette: "stone-arched mine entrance with wooden support beams, glittering gold veins visible inside, mine-cart loaded with gold ore",
    details: "warm yellow light spilling from inside the shaft, a heap of gold nuggets in front, wooden pickaxe and lantern leaning at the entrance",
    signature: "the glowing-yellow mine-shaft interior and the gold-nugget heap" },
  { id: "mana_quelle",    name: "Quellbrunnen",      category: "production", emoji: "🌊",
    silhouette: "stone basin filled with luminous turquoise liquid, runic stone arch above, mana-mist drifting upward",
    details: "carved arcane runes glowing on the basin rim, floating crystal shards above the water, lush blue-green ferns surrounding it",
    signature: "the glowing turquoise mana-water with floating crystal shards above" },

  // ─── Expansion 00085 — Lager ───
  { id: "tresorraum",     name: "Geheim-Tresor",       category: "storage",    emoji: "🏛️",
    silhouette: "fortified vault with a massive round iron door (combination dial visible), thick stone walls, two stone columns flanking the entrance",
    details: "a single guardian statue holding a key, security runes glowing faintly on the door frame, polished marble floor visible",
    signature: "the round iron vault-door with prominent dial — heavy and impenetrable looking" },
  { id: "kornkammer",     name: "Vorrats-Schober",       category: "storage",    emoji: "🌾",
    silhouette: "tall conical wooden granary with a thatched roof, ladder against the side, sacks of grain piled at the base",
    details: "wheat-bundles tied to the wall, a wooden scoop in front, mice scampering away, golden-wheat fields hint visible in background",
    signature: "the iconic conical granary silhouette with grain sacks piled around" },
  { id: "mauerwerk",      name: "Stein-Speicher",        category: "storage",    emoji: "🧱",
    silhouette: "stonemason workshop with a low half-built wall, mortar-trough, neat stacks of cut stone bricks",
    details: "a wooden scaffolding, mason's tools (hammer, chisel, plumb-line) on a workbench, fresh-cut limestone blocks",
    signature: "the half-built stone wall in-progress shows craftsmanship in action" },

  // ─── Expansion 00085 — Kampf ───
  { id: "hospital",       name: "Heil-Stube",         category: "combat",     emoji: "🏥",
    silhouette: "white-walled chapel-style infirmary with a red cross banner above the door, herbal garden plot in front, smoking incense bowl",
    details: "stained-glass window with a healing-symbol, white draped curtains visible inside, a wooden cot, jars of potions on a shelf",
    signature: "the red cross banner and stained-glass healing window" },
  { id: "trainingsplatz", name: "Übungs-Hof",  category: "combat",     emoji: "🥋",
    silhouette: "open martial training ground: wooden practice dummies in a row, weapon rack, sparring circle outlined by stones",
    details: "rolling thunder-clouds painted on a wall behind, three different weapons (sword, staff, bow) in the rack, a coach's whistle on a hook",
    signature: "the row of wooden practice dummies and the central sparring circle" },
  { id: "ballistenwerk",  name: "Wurfgeschütz-Werk",category: "combat",   emoji: "🎯",
    silhouette: "open-air engineering workshop with a large mounted ballista, blueprint scrolls on a workbench, stacks of giant arrows",
    details: "a half-assembled siege engine in the corner, gear-mechanisms visible, an engineer's apron and blueprint compass on the bench",
    signature: "the prominently mounted ballista pointing skyward dominates the composition" },
  { id: "schwertkampflager",name: "Klingen-Kaserne",category: "combat",emoji: "⚔️",
    silhouette: "armed-camp tent compound with two wooden practice posts, a weapon rack of various swords, banners with a sword crest",
    details: "leather armor stands, a small forge for sword-edge sharpening, a heap of polished helmets, campfire in the center",
    signature: "the heroic weapon rack of crossed swords and the central campfire" },
  { id: "bogenschuetzenstand",name: "Pfeil-Kaserne",category: "combat",emoji: "🏹",
    silhouette: "elevated archery range with three target dummies at varied distances, wooden bow racks, quivers of arrows",
    details: "a watchtower-style elevated platform on the left, hay-bale targets with painted bullseyes, scattered arrows in the ground",
    signature: "the three targets in perspective at varied distances and the hero bow-rack" },

  // ─── Expansion 00085 — Utility ───
  { id: "akademie",       name: "Gelehrten-Halle",         category: "utility",    emoji: "📚",
    silhouette: "two-story scholar academy with arched windows, large telescope on the roof, stack of huge tomes by the entrance",
    details: "alchemy bottles and rolled scrolls on an outdoor desk, a single owl on the roof, ivy climbing the walls, magnifying glass",
    signature: "the rooftop telescope pointing skyward + glowing arched library windows" },
  { id: "kloster",        name: "Mond-Kapelle",          category: "utility",    emoji: "⛪",
    silhouette: "small stone monastery with bell-tower, arched gothic windows, a meditation garden with a koi pond",
    details: "stained-glass mana-symbol window glowing turquoise, a single monk-statue, hanging incense braziers, lavender and herb garden",
    signature: "the bell-tower silhouette and the glowing turquoise stained-glass window" },
  { id: "augurstein",     name: "Sternendeuter-Stein",       category: "utility",    emoji: "🔮",
    silhouette: "free-standing megalithic stone monolith covered in carved astrological runes, levitating crystal orb hovering above",
    details: "swirling cosmic mist around the orb, faint star-projection on the stone, a small ritual altar at the base with candles",
    signature: "the levitating crystal orb projecting starlight onto the ancient runestone" },
  { id: "schwarzes_brett",name: "Quest-Tafel",  category: "utility",    emoji: "📋",
    silhouette: "wooden bulletin board on a sturdy post, multiple paper notices pinned with daggers, a small awning above for rain",
    details: "wax-sealed scrolls hanging, a lantern, an inkwell and quill on a small shelf, a bench in front",
    signature: "the multiple pinned notices fluttering on the bulletin board (animate gently in motion mode)" },
  { id: "halbling_haus",  name: "Bau-Kontor",    category: "utility",    emoji: "🏚️",
    silhouette: "round hobbit-style hill-house with a circular green door, smoke from the chimney, garden of vegetables in front",
    details: "round porthole windows with warm golden light inside, a flower-box of red blooms, mushroom decorations, a tiny clothesline",
    signature: "the iconic round green door + circular windows of the cozy hill-house" },
  { id: "basar",          name: "Tausch-Stand",            category: "utility",    emoji: "🛒",
    silhouette: "open-air bazaar tent with colorful striped fabric awnings, market stalls with fruits/spices/silks displayed",
    details: "hanging brass scales, woven rugs as floor mat, exotic pots and lamps, a small monkey on a perch, baskets overflowing with goods",
    signature: "the colorful striped awnings + the lavish display of trade goods" },

  // ─── Expansion 00085 — Kosmetisch ───
  { id: "shop",           name: "Kosmetik-Stand",             category: "cosmetic",   emoji: "🏪",
    silhouette: "small wooden shop-front with a hanging painted sign, glass display window showing items, awning over the entrance",
    details: "a chalkboard 'Open' sign, a barrel with rolled-up scrolls outside, a small bell above the door, potted plants flanking the entrance",
    signature: "the glass display window with glowing items and the painted hanging sign" },
  { id: "brunnen",        name: "Brunnen",          category: "cosmetic",   emoji: "⛲",
    silhouette: "ornate stone fountain with a central spire, water cascading from three tiers, koi swimming in the lower basin",
    details: "ivy and roses growing around the base, scattered coins gleaming on the basin floor, two stone benches nearby",
    signature: "the cascading three-tier water flow and the koi-fish in the basin" },
  { id: "statue",         name: "Heldenstatue",     category: "cosmetic",   emoji: "🗿",
    silhouette: "heroic stone statue of a warrior holding a sword aloft, on a tall plinth, surrounded by a flagstone plaza",
    details: "polished marble plinth with engraved name plaque, two tribute braziers burning at the base, a wreath of laurel at the warrior's feet",
    signature: "the dramatically lit hero-statue silhouette with sword raised toward the sky" },

  // ─── Crew (00079 + 00080 + 00085) ───
  { id: "crew_treffpunkt",name: "Crew-Treffpunkt",  category: "production", emoji: "🏛️",
    silhouette: "large neoclassical alliance hall with marble columns, wide stone steps, banners hanging between the columns",
    details: "a great central brazier burning teal flame, two heroic stone statues flanking the entrance, intricate teal-and-gold mosaic floor",
    signature: "the teal-flame brazier on the steps and the marble-columned facade" },
  { id: "truhenkammer",   name: "Truhenkammer",     category: "storage",    emoji: "🗝️",
    silhouette: "vault chamber with rows of wooden treasure-chests bound in iron, hanging skeleton-key collection on the wall",
    details: "an ornate centerpiece chest with overflow of jewels and gold, brass lanterns illuminating each row, dust motes in beams of light",
    signature: "the centerpiece overflowing treasure-chest with cascading gems" },
  { id: "arena_halle",    name: "Arena-Halle",      category: "combat",     emoji: "🏟️",
    silhouette: "miniature colosseum-style arena with stepped stone seating, sand-floor combat pit visible at center, weapon racks on the walls",
    details: "two crossed-spear banners, a victory-podium with a laurel wreath, torches lining the entrance, painted gladiator murals",
    signature: "the visible sand combat pit + the colosseum-stepped seating silhouette" },
  { id: "mana_quell",     name: "Mana-Spring",       category: "production", emoji: "💧",
    silhouette: "large pillared crew-scale mana spring with a multi-tier carved basin, glowing-blue water cascading downward",
    details: "four runic monoliths surrounding the basin, glowing wisps of mana-energy rising into the air, lush bioluminescent plants",
    signature: "the four-monolith circle around a glowing-blue cascading mana basin" },
  { id: "allianz_zentrum",name: "Bund-Halle",  category: "utility",    emoji: "🏛️",
    silhouette: "imposing diplomatic alliance hall with a domed roof and a banner-pole crowned with a crew-flag, wide marble entrance",
    details: "five smaller flag-poles with allied banners flanking the entrance, a circular meeting-table visible through the open doors",
    signature: "the central crew-flag flying highest among five allied flags" },
  { id: "spaeher_wachposten",name: "Kundschafter-Lager",category: "combat",  emoji: "👁️",
    silhouette: "elevated wooden scout outpost on stilts with a spotting platform on top, rope-ladder access, signal-fire bowl",
    details: "spyglass on a tripod, a tactical map pinned to the wall, falconer's perch with a bird, signal-flag rolled on a stand",
    signature: "the elevated stilted lookout platform + the spyglass-on-tripod" },
  { id: "sammel_leuchtfeuer",name: "Versammlungs-Feuer",category: "combat", emoji: "🔥",
    silhouette: "tall iron beacon-tower with a massive flaming brazier on top, spiral stairs winding up the exterior",
    details: "the brazier flames roaring tall and bright, smoke drifting upward, war-banners along the spiral stair, ember sparks in the air",
    signature: "the towering flame-brazier silhouette visible from anywhere in the base" },
  { id: "crew_taverne",   name: "Crew-Schenke",     category: "production", emoji: "🍻",
    silhouette: "large two-story timber alliance tavern with a grand swinging signboard, balcony on the second floor, multiple windows aglow",
    details: "kegs being delivered by a wagon, hero-portraits hung outside, lively warm light spilling from every window, smoke from the chimney",
    signature: "the multi-window glow + the upper balcony with hero-portraits of legendary recruits" },
  { id: "crew_hospital",  name: "Crew-Heilstation",    category: "combat",     emoji: "🏥",
    silhouette: "large white-stone alliance infirmary with a domed roof, multiple healing-cots visible through arched windows",
    details: "a healing-fountain in front courtyard, herb gardens flanking the path, healers' robes drying on a line, a giant red cross banner",
    signature: "the domed roof + the central healing-fountain in the courtyard" },
  { id: "crew_akademie",  name: "Crew-Studienhalle",    category: "utility",    emoji: "🎓",
    silhouette: "imposing alliance academy with multiple turret-spires, a giant clock-face above the entrance, telescope dome on the roof",
    details: "students depicted on banners, a giant compass-rose mosaic on the courtyard, scrolls and books piled on outdoor reading benches",
    signature: "the giant clock-face above the entrance and the turreted academy silhouette" },
  { id: "tempel_himmlisch",name: "Sphären-Heiligtum",category: "combat",emoji: "✨",
    silhouette: "ethereal floating-stone temple with golden filigree, levitating slightly above its tile, beams of holy light shining down",
    details: "celestial constellations visible behind it, a glowing celestial sigil on the roof, two seraphim statues, particles of golden light",
    signature: "the temple LEVITATES slightly above its base — beams of light hold it up" },
  { id: "goblin_markt",   name: "Trödel-Tausch",     category: "utility",    emoji: "👺",
    silhouette: "ramshackle bazaar tent run by goblin merchants, mismatched wooden stalls, a junk-heap of items being sorted",
    details: "a goblin scale weighing scrap, hanging mystery-bags, a 'one-eyed-deal' sign, dim greenish lanterns, mischievous shadows",
    signature: "the patched-together stall + the junk-heap of mismatched items being appraised" },
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
    `The building sits on a small square iso-tile platform — grass-topped stone block with mossy edges and a few flowers, with a soft shadow underneath. Tile fits within the building's footprint (max +5% padding).`,
    `Style: matches "Rise of Kingdoms" / "Call of Dragons" art-direction — clean stylized hand-painted textures, slight cel-shading, vibrant saturated colors, soft warm-cool color contrast, readable silhouette at thumbnail size, like a polished mobile-game building-icon ripped straight from the game UI.`,
    `Camera: locked isometric 30° angle, square 1:1, building centered with ~10% padding around the silhouette.`,
    `Lighting: bright key light from upper-left at 45°, soft ambient fill from upper-right, gentle warm rim-light.`,
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

export const RESOURCES_ART: ResourceArt[] = [
  { id: "wood",         name: "Holz",         fallbackEmoji: "🪵", accent: "#a16f32",
    subject: "a small bundle of three freshly chopped oak logs stacked, fresh bark visible, with a single green leaf sprig and a few wood chips around the base",
    style: "stylized 3D-render, hand-painted texture, warm earthy browns, soft saturation, slight cel-shading, gentle drop-shadow underneath" },
  { id: "stone",        name: "Stein",        fallbackEmoji: "🪨", accent: "#8B8FA3",
    subject: "a chunk of light-grey rough granite stone, multifaceted geometric form with flat chiseled planes, small mica sparkles on the surface, tiny moss patch on one corner",
    style: "stylized 3D-render, cool grey palette, crisp specular highlights, soft cel-shading, mossy green accents for life, subtle inner glow" },
  { id: "gold",         name: "Gold",         fallbackEmoji: "🪙", accent: "#FFD700",
    subject: "a single ancient gold coin standing on edge with a stamped sun-rune, a small pile of 2-3 additional coins beside it half-buried in soft dust, subtle glittering sparkles",
    style: "stylized 3D-render, polished gold with bright orange-yellow rim-light, slight sparkle particles, painterly highlights, premium-feel glow" },
  { id: "mana",         name: "Mana",         fallbackEmoji: "💧", accent: "#22D1C3",
    subject: "a luminous teal-cyan magical liquid droplet floating in a frozen splash, with smaller satellite droplets orbiting around it, internal swirl visible",
    style: "stylized 3D-render, glowing translucent fluid, internal light source, cyan-to-pale-mint gradient, soft bioluminescent particles, ethereal feel" },
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
    // Silhouette-Slots (Mid-LOD — flat mono-colored Tower-Shape, NO shading, NO detail)
    repeater_silhouette_hq:     "flat solid silhouette of a fortified crew HQ bunker — a tall blocky castle-like tower with crenellated rooftop, two side towers, large central body, and a single dish/antenna spike on top. Pure flat single-color shape, NO inner detail, NO shading, NO gradient, NO texture. Just the iconic outline. Centered.",
    repeater_silhouette_mega:   "flat solid silhouette of a tall urban broadcast tower — narrow base widening to a stacked midsection, lattice steel mast with two crossed antenna rods at the top and a single large dish bracketed to one side. Pure flat single-color shape, NO inner detail, NO shading, NO gradient, NO texture. Just the iconic outline. Centered.",
    repeater_silhouette_normal: "flat solid silhouette of a small urban repeater on a lamp post — short stocky pole with two short antenna spikes splaying from the top and one mini dish bracketed to the side. Pure flat single-color shape, NO inner detail, NO shading, NO gradient, NO texture. Just the iconic outline. Centered.",
    base_silhouette_runner:     "flat solid silhouette of a single small house-tower — a compact one-tower silhouette with peaked roof and a small banner pennant on top. Pure flat single-color shape, NO inner detail, NO shading, NO gradient, NO texture. Just the iconic outline. Centered.",
    base_silhouette_crew:       "flat solid silhouette of a fortified crew castle — multi-tower castle outline with three crenellated towers (one tall central, two shorter flanking), wide gatehouse base, banner pennants on each tower top. Pure flat single-color shape, NO inner detail, NO shading, NO gradient, NO texture. Just the iconic outline. Centered.",
  };

  const subject = SUBJECT[s.id] ?? `iconic single-subject illustration representing "${s.name}" — ${s.description}`;

  // Silhouette-Slots brauchen einen speziellen Prompt — FLACHES mono-color
  // Shape mit transparentem Hintergrund (keine Shading-/Glow-/3D-Effekte).
  if (s.category === "silhouette") {
    const silhouetteBase = [
      `Flat mono-color silhouette icon for a city-walking strategy game — simple solid-color shape suitable for a map marker.`,
      `Background: FULLY TRANSPARENT PNG with alpha channel. Pixels outside the silhouette must have alpha = 0. No background color, no gradient, no scene, no fill, no halo, no glow.`,
      `Subject (centered, fills ~85% of frame, anchored to the BOTTOM of the canvas like a building tile): ${subject}`,
      `Style: PURE FLAT SOLID-COLOR shape — like a black-paper papercut silhouette. One single uniform fill color (use pure white #FFFFFF so it can be tinted via CSS later). NO shading, NO gradients, NO highlights, NO outlines, NO depth, NO perspective lines, NO inner detail strokes. Bold and instantly readable at 24×24 pixels.`,
      `Composition: 1024×1024 square, single icon. Footprint anchored at the bottom edge with ~5% margin. Hard clean silhouette edge — no anti-aliased halo, no fringing, no semi-transparent background bleed.`,
      `Output format: PNG with alpha channel. Subject = pure white silhouette on fully transparent background.`,
      `Strict negatives: no text, no letters, no logo, no watermark, no human figures, no shading, no gradients, no inner details, no outlines, no glow effects, no shadows, no perspective, no 3D rendering, no scenery, no background of any kind.`,
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
// TROOP-PROMPT — Set D Kiez-Crew (4 Klassen × 5 Tiers = 20)
// ─────────────────────────────────────────────────────────────────
type TroopSlotInput = { id: string; name: string; emoji: string; troop_class: string; tier: number };

export function buildTroopPrompt(input: { slot: TroopSlotInput; mode: "image" | "video" }): string {
  const s = input.slot;

  // Klassen-Beschreibung (alle urban, Set D Kiez-Crew)
  const CLASS_VIBE: Record<string, { role: string; outfit: string; weapon: string }> = {
    infantry: {
      role: "burly nightclub bouncer / doorman",
      outfit: "tight black bomber jacket or dark suit, earpiece, chunky boots",
      weapon: "no weapon needed — fists / brass knuckles / heavy belt",
    },
    cavalry: {
      role: "fast urban courier / motorbike messenger",
      outfit: "leather riding jacket, helmet with reflective visor, fingerless gloves",
      weapon: "messenger bag, possibly small baton holstered",
    },
    marksman: {
      role: "skilled urban thrower / slinger",
      outfit: "hooded streetwear, cargo pants with side pockets, sneakers",
      weapon: "modern slingshot, ball bearings or stones, thrown bottles",
    },
    siege: {
      role: "demolition worker / heavy hitter",
      outfit: "heavy work boots, hi-vis vest over thick clothing, knee pads",
      weapon: "sledgehammer, crowbar, or oversized iron pipe",
    },
  };

  // Tier-Progression: T1 = Anfänger, T5 = Boss/Meister
  const TIER_LOOK: Record<number, string> = {
    1: "young recruit, plain unbranded clothes, slightly nervous but determined posture",
    2: "experienced soldier, gear with subtle wear, confident stance, faint scars",
    3: "veteran, custom-modified equipment, battle-hardened expression, visible muscle",
    4: "elite enforcer, premium tactical gear, intimidating poise, gold/silver accents",
    5: "legendary boss, luxurious dark coat or armor, commanding aura, faint golden glow",
  };

  const cls = CLASS_VIBE[s.troop_class] ?? CLASS_VIBE.infantry;
  const tier = TIER_LOOK[s.tier] ?? TIER_LOOK[1];

  const subject = `${cls.role}, "${s.name}". ${tier}. Wears ${cls.outfit}. Carries ${cls.weapon}.`;

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
    name: "Wegelager",
    fallbackEmoji: "🏰",
    accent: "#FF2D78",
    subject: "a fortified urban bandit lair perched on stacked shipping containers and improvised concrete barriers — crooked watchtower with rusted iron sheets, makeshift battlements made of old tires and barbed wire, glowing red lanterns and hostile graffiti tags (skull crew-mark, X-marks), boarded windows with ominous red glow inside, splintered wooden gate, scattered loot crates and rusty weapons at the base, hostile aggressive vibe — clearly a place travelers should avoid",
    style: "stylized 3D-render in the same Rise of Kingdoms / Call of Dragons style as the rest of the game, slight isometric 30° three-quarter view, vibrant saturated colors with dominant crimson/red accents and warm orange torch glow, hand-painted textures, soft cel-shading, readable silhouette at 64×64, sits on a small minimal stone-tile base (max +5% larger than footprint), no extending terrain"
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
