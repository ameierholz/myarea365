// Runner-Light Particle-Specs.
// Pro Light eine Beschreibung, was am RUNNER-KOPF (am Ende der Lauflinie)
// pro Frame als Partikel emittiert wird. Die Lauflinie selbst bleibt simpel
// (nur Bloom + Core), die ganze "Magie" passiert hier.
//
// Implementierung in components/runner-particle-overlay.tsx — Canvas-Overlay
// über der Mapbox-Karte, projiziert die Runner-Position via map.project()
// in Screen-Space, spawnt + animiert + zeichnet die Partikel.
//
// Inspiration: User-Demo mit Eis (Core-Crystal #6991d8 + Snow-Dust streuung
// + #1db682 als kalter Rand, globalCompositeOperation 'lighter').

export type RGBHex = string; // "#RRGGBB"

export type ParticleSpec = {
  /** Wie viele Partikel pro Frame (60 fps) gespawnt werden. 2-6 ist Production-realistisch. */
  spawnPerFrame: number;
  /** Zwei-Tier-System: "core"-Partikel (groß, zentral) und "dust" (klein, gestreut). */
  coreColor: RGBHex;
  /** Optional zweite Farbe für den radialen Gradient des Cores (gibt 2-Tone-Glow). */
  coreColor2?: RGBHex;
  dustColor: RGBHex;
  /** 0..1 — Wahrscheinlichkeit dass ein neues Partikel "dust" statt "core" wird. */
  dustRatio: number;
  /** Pixel min/max — Größe des Partikels beim Spawn. */
  coreSize: [number, number];
  dustSize: [number, number];
  /** Lebensdauer in Frames (60fps → 60 = 1s). */
  coreMaxAge: [number, number];
  dustMaxAge: [number, number];
  /** Spawn-Spread in px um den Runner-Kopf. */
  coreSpread: number;
  dustSpread: number;
  /** Drift-Velocity pro Frame (px). vy negativ = nach oben. */
  driftVx: number;
  driftVy: number;
  /** Random-Komponente die zur Drift addiert wird. */
  driftRandomX: number;
  driftRandomY: number;
  /** Fade-Curve-Power: 1=linear, >1=später schnell weg, <1=früh fast weg. */
  fadePower: number;
  /** Optional: blend-mode. Default 'lighter' für additive Glow. */
  blendMode?: GlobalCompositeOperation;
  /** Optional: Trail-„Puls"-Effekt — Größe oszilliert über Lebensdauer. */
  pulse?: boolean;
};

// Helper für hex → rgba mit Alpha
export function hexA(hex: string, a: number): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// null = kein Particle-Effect (Free-Tier-Lights, behalten nur Bloom+Core)
export const LIGHT_PARTICLE_SPECS: Record<string, ParticleSpec | null> = {
  // ─ FREE-TIER: nur saubere Linie, kein Particle-Hokus-Pokus ─
  classic:  null,
  coral:    null,
  emerald:  null,
  sapphire: null,

  // ─ TIER 2: dezente sparkle/dust ─
  gold: {
    spawnPerFrame: 3,
    coreColor: "#FFD700", coreColor2: "#FFFFFF", dustColor: "#FFC500",
    dustRatio: 0.55,
    coreSize: [2, 5], dustSize: [1, 3],
    coreMaxAge: [40, 70], dustMaxAge: [60, 100],
    coreSpread: 5, dustSpread: 18,
    driftVx: 0, driftVy: -0.15,
    driftRandomX: 0.4, driftRandomY: 0.3,
    fadePower: 1.4, pulse: true,
  },
  forest: {
    spawnPerFrame: 2,
    coreColor: "#22c55e", coreColor2: "#86efac", dustColor: "#14532d",
    dustRatio: 0.65,
    coreSize: [2, 4], dustSize: [1, 3],
    coreMaxAge: [50, 80], dustMaxAge: [80, 120],
    coreSpread: 6, dustSpread: 22,
    driftVx: 0, driftVy: -0.08,
    driftRandomX: 0.5, driftRandomY: 0.3,
    fadePower: 1.3,
  },
  sunset: {
    spawnPerFrame: 3,
    coreColor: "#FF6B4A", coreColor2: "#FFD700", dustColor: "#FF8855",
    dustRatio: 0.6,
    coreSize: [3, 6], dustSize: [1, 3],
    coreMaxAge: [45, 75], dustMaxAge: [70, 110],
    coreSpread: 6, dustSpread: 22,
    driftVx: 0, driftVy: -0.2,
    driftRandomX: 0.5, driftRandomY: 0.3,
    fadePower: 1.4,
  },
  ocean: {
    spawnPerFrame: 3,
    coreColor: "#0ea5e9", coreColor2: "#67e8f9", dustColor: "#06b6d4",
    dustRatio: 0.65,
    coreSize: [3, 6], dustSize: [1, 3],
    coreMaxAge: [50, 80], dustMaxAge: [80, 120],
    coreSpread: 8, dustSpread: 24,
    driftVx: 0, driftVy: -0.1,
    driftRandomX: 0.7, driftRandomY: 0.4,
    fadePower: 1.3,
  },

  // ─ TIER 3: thematisch reicher ─
  neon: {
    spawnPerFrame: 4,
    coreColor: "#a855f7", coreColor2: "#FF2D78", dustColor: "#d946ef",
    dustRatio: 0.5,
    coreSize: [2, 5], dustSize: [1, 2],
    coreMaxAge: [25, 50], dustMaxAge: [40, 70],
    coreSpread: 8, dustSpread: 25,
    driftVx: 0, driftVy: 0,
    driftRandomX: 1.2, driftRandomY: 1.2,
    fadePower: 1.6, pulse: true,
  },
  rainbow: {
    spawnPerFrame: 4,
    coreColor: "#FF0000", coreColor2: "#00A5FF", dustColor: "#FFDD00",
    dustRatio: 0.5,
    coreSize: [3, 6], dustSize: [1, 3],
    coreMaxAge: [40, 70], dustMaxAge: [60, 100],
    coreSpread: 8, dustSpread: 26,
    driftVx: 0, driftVy: -0.1,
    driftRandomX: 0.8, driftRandomY: 0.5,
    fadePower: 1.4,
  },
  candy: {
    spawnPerFrame: 4,
    coreColor: "#ec4899", coreColor2: "#fbbf24", dustColor: "#f9a8d4",
    dustRatio: 0.55,
    coreSize: [2, 5], dustSize: [1, 3],
    coreMaxAge: [40, 70], dustMaxAge: [70, 110],
    coreSpread: 8, dustSpread: 24,
    driftVx: 0, driftVy: -0.2,
    driftRandomX: 0.7, driftRandomY: 0.5,
    fadePower: 1.5, pulse: true,
  },

  // ─ TIER 4: Element-spezifische Effekte ─

  // ICE — wie User-Demo: Frost-Crystal-Core + Snow-Dust
  ice: {
    spawnPerFrame: 5,
    coreColor: "#7CC8F0", coreColor2: "#FFFFFF", dustColor: "#a5d8ff",
    dustRatio: 0.7,
    coreSize: [3, 7], dustSize: [1, 3],
    coreMaxAge: [55, 95], dustMaxAge: [90, 140],
    coreSpread: 8, dustSpread: 30,
    driftVx: 0, driftVy: -0.1,
    driftRandomX: 0.6, driftRandomY: 0.5,
    fadePower: 1.5,
  },

  // FIRE — orange Embers steigen auf, knistern
  fire: {
    spawnPerFrame: 5,
    coreColor: "#FF6B4A", coreColor2: "#FFD700", dustColor: "#FF4500",
    dustRatio: 0.55,
    coreSize: [3, 7], dustSize: [1, 3],
    coreMaxAge: [40, 70], dustMaxAge: [70, 130],
    coreSpread: 6, dustSpread: 22,
    driftVx: 0, driftVy: -0.55,
    driftRandomX: 0.5, driftRandomY: 0.3,
    fadePower: 1.4,
  },

  // LAVA — heiße Glut-Tropfen, langsamer als Fire, sattere Farben
  lava: {
    spawnPerFrame: 4,
    coreColor: "#ef4444", coreColor2: "#fbbf24", dustColor: "#7f1d1d",
    dustRatio: 0.5,
    coreSize: [4, 8], dustSize: [2, 4],
    coreMaxAge: [60, 100], dustMaxAge: [100, 160],
    coreSpread: 8, dustSpread: 28,
    driftVx: 0, driftVy: -0.25,
    driftRandomX: 0.4, driftRandomY: 0.3,
    fadePower: 1.3, pulse: true,
  },

  // PLASMA — elektrische Funken, chaotisch in alle Richtungen
  plasma: {
    spawnPerFrame: 6,
    coreColor: "#00FFFF", coreColor2: "#FF00FF", dustColor: "#FFFFFF",
    dustRatio: 0.55,
    coreSize: [2, 4], dustSize: [1, 2],
    coreMaxAge: [15, 35], dustMaxAge: [25, 55],
    coreSpread: 12, dustSpread: 35,
    driftVx: 0, driftVy: 0,
    driftRandomX: 1.8, driftRandomY: 1.8,
    fadePower: 2.0, pulse: true,
  },

  // SHADOW — düstere violette Wisps, langsam driftend
  shadow: {
    spawnPerFrame: 2,
    coreColor: "#7c3aed", coreColor2: "#312e81", dustColor: "#1f1b4b",
    dustRatio: 0.7,
    coreSize: [4, 9], dustSize: [3, 6],
    coreMaxAge: [80, 130], dustMaxAge: [120, 200],
    coreSpread: 10, dustSpread: 30,
    driftVx: 0, driftVy: -0.1,
    driftRandomX: 0.3, driftRandomY: 0.2,
    fadePower: 1.6,
  },

  // GALAXY — funkelnde Sterne, langsame Twinkles
  galaxy: {
    spawnPerFrame: 3,
    coreColor: "#FFFFFF", coreColor2: "#a5b4fc", dustColor: "#7c3aed",
    dustRatio: 0.4,
    coreSize: [2, 5], dustSize: [1, 3],
    coreMaxAge: [70, 120], dustMaxAge: [100, 170],
    coreSpread: 12, dustSpread: 32,
    driftVx: 0, driftVy: -0.05,
    driftRandomX: 0.5, driftRandomY: 0.4,
    fadePower: 1.7, pulse: true,
  },

  // ARCTIC — sanfte Nordlicht-artige Partikel
  arctic: {
    spawnPerFrame: 3,
    coreColor: "#7dd3fc", coreColor2: "#FFFFFF", dustColor: "#0c4a6e",
    dustRatio: 0.6,
    coreSize: [3, 6], dustSize: [2, 4],
    coreMaxAge: [70, 120], dustMaxAge: [100, 170],
    coreSpread: 10, dustSpread: 28,
    driftVx: 0, driftVy: -0.12,
    driftRandomX: 0.5, driftRandomY: 0.4,
    fadePower: 1.5,
  },

  // AURORA — fließende Aurora-Bänder, mehrere Farben
  aurora: {
    spawnPerFrame: 4,
    coreColor: "#22d3ee", coreColor2: "#a855f7", dustColor: "#FF2D78",
    dustRatio: 0.5,
    coreSize: [3, 7], dustSize: [2, 4],
    coreMaxAge: [80, 130], dustMaxAge: [120, 180],
    coreSpread: 12, dustSpread: 32,
    driftVx: 0, driftVy: -0.15,
    driftRandomX: 0.7, driftRandomY: 0.5,
    fadePower: 1.5, pulse: true,
  },

  // COSMIC — alles maximiert: Sterne + Aurora-Color + Funken
  cosmic: {
    spawnPerFrame: 6,
    coreColor: "#FFFFFF", coreColor2: "#7c3aed", dustColor: "#22d3ee",
    dustRatio: 0.4,
    coreSize: [3, 7], dustSize: [1, 3],
    coreMaxAge: [60, 110], dustMaxAge: [90, 150],
    coreSpread: 14, dustSpread: 38,
    driftVx: 0, driftVy: -0.2,
    driftRandomX: 1.0, driftRandomY: 0.7,
    fadePower: 1.6, pulse: true,
  },
};
