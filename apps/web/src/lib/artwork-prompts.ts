/**
 * User-facing Artwork-Prompt-Builder (Subset von artwork-prompts).
 *
 * Diese Datei enthält NUR die Prompt-Builder, die im Runtime-User-Code
 * (Picker-Modals, Galerien, Loadout) verwendet werden. Der grosse Rest
 * (Slot/Equipment/Building/Resource/Chest/… Catalogs + Builder) lebt in
 * `artwork-prompts-admin.ts` und wird ausschliesslich vom Admin-Tool
 * unter /admin/artwork importiert. Der Split reduziert das User-Bundle.
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

// ─── BACKGROUND-SPEC: Greenscreen für Chroma-Key ─────────────────────────
// Die App keyed pure-green (#00FF00) zur Render-Zeit raus via SVG-Filter
// (#ma365-chroma-black). AI-Generatoren (MJ/DALL·E/Imagen/Veo) liefern unzuverlässig
// echtes Alpha — pure green ist verlässlicher und wird identisch aussehen wie transparent.
// EXPORT: wird vom Admin-File importiert, Single Source of Truth.
export const GREEN_BG_RULE = `Background: pure chroma-key green #00FF00 (RGB 0,255,0), filling the ENTIRE frame uniformly behind the subject — corner to corner, no vignette, no gradient, no shadows, no fade. The green will be removed automatically at render time via chroma-key filter. Do NOT use transparent PNG, white, or any other background color. Subject must NOT contain pure-green pixels (use teal/forest-green instead if needed).`;

/** Prompt für Wächter-Archetyp (Charakter-Illustration oder animiertes Video) */
export type ArchetypeSpecies =
  | "human" | "elf" | "orc" | "beast" | "construct" | "spirit"
  | "undead" | "demon" | "celestial" | "dragonkin" | "cosmic"
  | "bird" | "desert";

export type ArchetypePromptInput = {
  name: string;
  rarity: "common" | "rare" | "legend" | "elite" | "epic" | "legendary";
  classId?: "tank" | "support" | "ranged" | "melee" | null;
  guardianType?: "infantry" | "cavalry" | "marksman" | "mage" | "siege" | "collector" | null;
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
    case "infantry":  return "tank";
    case "cavalry":   return "melee";
    case "marksman":  return "ranged";
    case "mage":      return "support";
    case "siege":     return "support";  // Belagerung — Special-Caster
    case "collector": return "support";  // Sammler — Utility/Support
    default:          return null;
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
// Icon-IDs/Namen die ein Tier zeigen (für Walking-Pose Erzwingen).
const ANIMAL_FIGURE_HINTS = [
  "dog","cat","wolf","fox","bear","deer","horse","rabbit","hare","tiger","lion",
  "owl","hawk","eagle","falcon","raven","butterfly","bee","beetle",
  "hund","katze","wolf","fuchs","baer","hirsch","pferd","hase","tiger","loewe",
  "eule","falke","adler","rabe","schmetterling","biene","kaefer","tier","pet",
];

// Strategie-Symbole (Anführer-Icons) — keine Menschen mehr nach Re-Theme,
// stattdessen heraldische Objekte die für Country/Stadt/Dorf/Crews/Banden funktionieren.
const STRATEGY_OBJECT_HINTS: Record<string, string> = {
  foot:
    "a navigator's COMPASS — circular brass rim engraved with cardinal letters N/E/S/W, a steady magnetic needle, " +
    "subtle map-paper texture peeking from behind. Reads as 'Späher / Scout / Explorer'. " +
    "Aged warm brass with a soft inner glow. NO human figure, NO footprints inside the compass face.",
  walker:
    "a heraldic BATTLE BANNER on a tall wooden pole — rectangular cloth flag fluttering in mid-wind motion, " +
    "clean two-color blocks (deep teal #22D1C3 + warm gold #FFD700), a simple geometric emblem in the center (no text, no letters), " +
    "leather wrap on the pole base. Reads as 'Standarte / Banner / Étendard'. NO human figure, NO holding hands.",
  runner:
    "an iconic strategy / commander HELMET — clean side-profile silhouette of a polished steel helmet with " +
    "leather chin straps and a low crest, no face visible inside (empty), classic timeless design that works as both medieval " +
    "and modern military. Reads as 'Helm / Helmet / Casque'. NO human, NO body, just the helmet floating.",
  hero:
    "a premium royal CROWN / commander's circlet — five tall points each tipped with a faceted gemstone " +
    "(rubies + sapphires alternating), polished bright gold with subtle engraved patterns, soft inner halo. " +
    "Reads as 'Anführer / Commander / Comandante'. NO human head wearing it, just the crown floating.",
};

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
  const strategySubject = input.id ? STRATEGY_OBJECT_HINTS[input.id] : undefined;
  const isStrategyObject = !!strategySubject;
  const isAnimal = !isStrategyObject && ANIMAL_FIGURE_HINTS.some((h) => combined.includes(h));
  const needsWalkingPose = isAnimal;

  const strategyInstruction = !strategySubject ? "" :
    `SUBJECT (strategy marker): ${strategySubject} ` +
    "The object is the ENTIRE subject — render it large, centered, dimensional, with rich material detail. " +
    "It must read as a heraldic / leader symbol that fits Country, City, Village, Crews and Gangs alike — " +
    "timeless and universal, not tied to any one era.";

  const walkingPoseInstruction = !needsWalkingPose ? "" :
    "POSE: clear WALKING / TROTTING / RUNNING / FLYING motion appropriate to the animal — " +
    "full body visible including ALL LEGS and PAWS/HOOVES (or wings for birds/insects) from shoulder to foot. " +
    "Legs in mid-step (one set forward, one back), feet fully drawn and not cropped. " +
    "Dynamic forward motion readable at a glance.";
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

  // Direction-Regel gilt nur für Tiere (Bewegungsmotive). Strategie-Objekte (Banner, Helm, Krone, Kompass)
  // sind frontal/symmetrisch lesbar, mythische Wesen wie Geist/Phönix/Drache/Einhorn frei komponiert.
  const directionGuidance = !isAnimal ? "" :
    "DIRECTION: the animal MUST face LEFT and move toward the LEFT side of the frame. " +
    "Strict side-profile view, head and body oriented LEFT. Running animals run to the LEFT, " +
    "flying creatures angle their wings/body so they head LEFT. No front-facing, no three-quarter, no right-facing.";

  if (input.mode === "video") {
    return [
      `Shot: a 3-second seamlessly looping animated icon, square 1:1, 1024x1024, 30 fps.`,
      GREEN_BG_RULE,
      `Subject: "${input.name}" — centered, iconic silhouette, readable at very small sizes (32-64 px). Avoid pure-green tones in the subject.`,
      input.hint ? `Motif hint: ${input.hint}.` : "",
      strategyInstruction,
      walkingPoseInstruction,
      styleGuidance,
      directionGuidance,
      fillDisclaimer,
      noPinDisclaimer,
      needsWalkingPose
        ? `Motion: looping walking/running cycle — legs alternating in a clean stride loop, feet never disappearing from view, arms/tail/wings swinging in rhythm. Camera and body position stay fixed; only the walk cycle animates.`
        : isStrategyObject
          ? `Motion: subtle and dignified — for a banner: cloth ripples in slow wind; for a helmet/crown: slow gentle rotation 5-10° back-and-forth + soft halo pulse; for a compass: needle drifts and settles. No camera movement. First and last frame identical.`
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
    strategyInstruction,
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
      `Style: grounded game-UI that fits both urban and rural settings, thick clean outlines, soft inner glow, subtle particle motion (sparks, mist, scan-lines depending on theme).`,
      `Motion: gentle pulsing glow, slow particle drift. No camera movement. First and last frame identical.`,
      `No audio, no text, no watermark, no logos, no brand names.`,
    ].filter(Boolean).join(" ");
  }
  return [
    `A stylized map-pin base tile representing "${input.name}" — ${input.description}.`,
    `Square 1:1, 1024x1024 PNG.`,
    GREEN_BG_RULE,
    paletteLine,
    `Style: grounded game-UI that fits both urban and rural settings, thick clean outlines, soft inner glow, readable at small sizes.`,
    `No text, no labels, no watermark, no logos.`,
  ].filter(Boolean).join(" ");
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
    `Style: neon glow, sharp bright core, soft outer halo, premium VFX, premium energy aesthetic that fits both urban and rural runners.`,
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
