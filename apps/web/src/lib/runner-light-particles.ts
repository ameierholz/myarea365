// Runner-Light Particle-Specs.
// Pro Light eine Beschreibung was am RUNNER-KOPF spawnt.
// Jedes Light hat eine eigene SHAPE damit nicht alles wie farbige Kreise
// aussieht: Sterne, Schneeflocken, Flammen, Tropfen, Blitze, Blätter, ...

export type RGBHex = string;

// Shape-Katalog. Jede Shape hat eine eigene Draw-Funktion in
// runner-particle-overlay.tsx → drawParticle().
export type ParticleShape =
  | "circle"   // klassischer Glow-Punkt (Default)
  | "spark"    // 4-strahliger Glitter-Stern (Gold, Candy)
  | "snow"     // 6-strahlige Schneeflocke (Ice, Arctic)
  | "star"     // großer 5-strahliger Stern mit Glow (Galaxy, Cosmic)
  | "flame"    // vertikaler Flammen-Tropfen (Fire)
  | "drop"     // runder Tropfen (Lava, Ocean)
  | "wisp"     // weicher elongierter Schweif (Shadow, Aurora)
  | "leaf"     // angeschrägtes Blatt (Forest)
  | "bolt"     // Mini-Lightning-Bolt (Plasma)
  | "ring";    // dünner expandierender Ring (Sapphire, Neon)

export type ParticleSpec = {
  spawnPerFrame: number;
  shape: ParticleShape;
  /** Optional: zweite Shape für visuelle Vielfalt (z.B. Sterne + Dust). */
  shape2?: ParticleShape;
  /** Wahrscheinlichkeit shape2 statt shape (default 0). */
  shape2Ratio?: number;

  coreColor: RGBHex;
  coreColor2?: RGBHex;
  dustColor: RGBHex;
  dustRatio: number;

  coreSize: [number, number];
  dustSize: [number, number];
  coreMaxAge: [number, number];
  dustMaxAge: [number, number];
  coreSpread: number;
  dustSpread: number;

  driftVx: number;
  driftVy: number;
  driftRandomX: number;
  driftRandomY: number;

  fadePower: number;
  blendMode?: GlobalCompositeOperation;
  /** Pulse-Größe oszilliert über Lebensdauer. */
  pulse?: boolean;
  /** Particles rotieren während Lebensdauer (für leaf, snow, spark). */
  rotate?: boolean;
  /** Wind-Curl: addiert Sinus-Kurve zur x-Drift basierend auf age (Forest, Aurora). */
  windCurl?: number;
  /** Stretch: Particle wird in Bewegungsrichtung gestreckt (Plasma-Bolts, Embers). */
  stretch?: number;
};

export function hexA(hex: string, a: number): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export const LIGHT_PARTICLE_SPECS: Record<string, ParticleSpec | null> = {
  // ─ FREE-TIER: kein Particle-Hokus-Pokus ───────────────────────────
  classic: null,
  coral: null,
  emerald: null,

  // ─ SAPPHIRE: dezente expanding rings ──────────────────────────────
  sapphire: {
    spawnPerFrame: 1,
    shape: "ring",
    coreColor: "#3b82f6", coreColor2: "#FFFFFF", dustColor: "#1e40af",
    dustRatio: 0,
    coreSize: [4, 7], dustSize: [2, 4],
    coreMaxAge: [40, 70], dustMaxAge: [60, 90],
    coreSpread: 4, dustSpread: 8,
    driftVx: 0, driftVy: 0,
    driftRandomX: 0.1, driftRandomY: 0.1,
    fadePower: 1.5,
  },

  // ─ GOLD: 4-strahlige Glitzer-Sparks ───────────────────────────────
  gold: {
    spawnPerFrame: 2,
    shape: "spark", shape2: "circle", shape2Ratio: 0.5,
    coreColor: "#FFD700", coreColor2: "#FFFFFF", dustColor: "#FFC500",
    dustRatio: 0.4,
    coreSize: [3, 6], dustSize: [1, 2],
    coreMaxAge: [35, 65], dustMaxAge: [50, 90],
    coreSpread: 5, dustSpread: 18,
    driftVx: 0, driftVy: -0.2,
    driftRandomX: 0.4, driftRandomY: 0.3,
    fadePower: 1.4, pulse: true, rotate: true,
  },

  // ─ FOREST: Blätter mit Wind-Curl ──────────────────────────────────
  forest: {
    spawnPerFrame: 2,
    shape: "leaf", shape2: "circle", shape2Ratio: 0.6,
    coreColor: "#22c55e", coreColor2: "#86efac", dustColor: "#14532d",
    dustRatio: 0.5,
    coreSize: [3, 5], dustSize: [1, 2],
    coreMaxAge: [70, 120], dustMaxAge: [90, 140],
    coreSpread: 6, dustSpread: 22,
    driftVx: 0.15, driftVy: -0.05,
    driftRandomX: 0.3, driftRandomY: 0.2,
    fadePower: 1.3, rotate: true, windCurl: 1.2,
  },

  // ─ SUNSET: warm fallende Strahlen ─────────────────────────────────
  sunset: {
    spawnPerFrame: 3,
    shape: "circle", shape2: "spark", shape2Ratio: 0.3,
    coreColor: "#FF6B4A", coreColor2: "#FFD700", dustColor: "#FF8855",
    dustRatio: 0.6,
    coreSize: [3, 6], dustSize: [1, 3],
    coreMaxAge: [45, 75], dustMaxAge: [70, 110],
    coreSpread: 6, dustSpread: 22,
    driftVx: 0, driftVy: -0.2,
    driftRandomX: 0.5, driftRandomY: 0.3,
    fadePower: 1.4,
  },

  // ─ OCEAN: Wassertropfen ───────────────────────────────────────────
  ocean: {
    spawnPerFrame: 3,
    shape: "drop", shape2: "circle", shape2Ratio: 0.5,
    coreColor: "#0ea5e9", coreColor2: "#67e8f9", dustColor: "#06b6d4",
    dustRatio: 0.55,
    coreSize: [3, 6], dustSize: [1, 3],
    coreMaxAge: [50, 80], dustMaxAge: [80, 120],
    coreSpread: 8, dustSpread: 24,
    driftVx: 0, driftVy: 0.4,  // FALLEN nach unten (Wasser)
    driftRandomX: 0.6, driftRandomY: 0.2,
    fadePower: 1.3,
  },

  // ─ NEON: pink-violet Sparks ───────────────────────────────────────
  neon: {
    spawnPerFrame: 4,
    shape: "spark", shape2: "ring", shape2Ratio: 0.3,
    coreColor: "#a855f7", coreColor2: "#FF2D78", dustColor: "#d946ef",
    dustRatio: 0.4,
    coreSize: [3, 5], dustSize: [1, 2],
    coreMaxAge: [25, 50], dustMaxAge: [40, 70],
    coreSpread: 8, dustSpread: 25,
    driftVx: 0, driftVy: 0,
    driftRandomX: 1.0, driftRandomY: 1.0,
    fadePower: 1.6, pulse: true, rotate: true,
  },

  // ─ RAINBOW: bunte Sparks ──────────────────────────────────────────
  rainbow: {
    spawnPerFrame: 4,
    shape: "spark",
    coreColor: "#FF0000", coreColor2: "#00A5FF", dustColor: "#FFDD00",
    dustRatio: 0.5,
    coreSize: [3, 6], dustSize: [1, 3],
    coreMaxAge: [40, 70], dustMaxAge: [60, 100],
    coreSpread: 8, dustSpread: 26,
    driftVx: 0, driftVy: -0.1,
    driftRandomX: 0.8, driftRandomY: 0.5,
    fadePower: 1.4, rotate: true,
  },

  // ─ CANDY: Sparks rosa-gold ────────────────────────────────────────
  candy: {
    spawnPerFrame: 3,
    shape: "spark", shape2: "circle", shape2Ratio: 0.5,
    coreColor: "#ec4899", coreColor2: "#fbbf24", dustColor: "#f9a8d4",
    dustRatio: 0.5,
    coreSize: [3, 5], dustSize: [1, 3],
    coreMaxAge: [40, 70], dustMaxAge: [70, 110],
    coreSpread: 8, dustSpread: 24,
    driftVx: 0, driftVy: -0.3,
    driftRandomX: 0.7, driftRandomY: 0.5,
    fadePower: 1.5, pulse: true, rotate: true,
  },

  // ─ ICE: Schneeflocken + Schneestaub ────────────────────────────────
  ice: {
    spawnPerFrame: 4,
    shape: "snow", shape2: "circle", shape2Ratio: 0.65,
    coreColor: "#7CC8F0", coreColor2: "#FFFFFF", dustColor: "#a5d8ff",
    dustRatio: 0.6,
    coreSize: [4, 7], dustSize: [1, 2],
    coreMaxAge: [60, 100], dustMaxAge: [100, 160],
    coreSpread: 8, dustSpread: 30,
    driftVx: 0, driftVy: -0.05,
    driftRandomX: 0.4, driftRandomY: 0.3,
    fadePower: 1.5, rotate: true,
  },

  // ─ FIRE: Flammen + Embers ──────────────────────────────────────────
  fire: {
    spawnPerFrame: 5,
    shape: "flame", shape2: "circle", shape2Ratio: 0.55,
    coreColor: "#FF6B4A", coreColor2: "#FFD700", dustColor: "#FF4500",
    dustRatio: 0.5,
    coreSize: [4, 9], dustSize: [1, 3],
    coreMaxAge: [30, 55], dustMaxAge: [60, 110],
    coreSpread: 5, dustSpread: 18,
    driftVx: 0, driftVy: -0.6,
    driftRandomX: 0.3, driftRandomY: 0.2,
    fadePower: 1.5, stretch: 1.4,
  },

  // ─ LAVA: Tropfen + Glut-Sparks ─────────────────────────────────────
  lava: {
    spawnPerFrame: 3,
    shape: "drop", shape2: "spark", shape2Ratio: 0.35,
    coreColor: "#ef4444", coreColor2: "#fbbf24", dustColor: "#7f1d1d",
    dustRatio: 0.5,
    coreSize: [5, 9], dustSize: [2, 4],
    coreMaxAge: [70, 120], dustMaxAge: [100, 160],
    coreSpread: 8, dustSpread: 26,
    driftVx: 0, driftVy: -0.2,
    driftRandomX: 0.3, driftRandomY: 0.2,
    fadePower: 1.3, pulse: true,
  },

  // ─ PLASMA: echte Lightning-Bolts! ─────────────────────────────────
  plasma: {
    spawnPerFrame: 2,
    shape: "bolt", shape2: "spark", shape2Ratio: 0.55,
    coreColor: "#00FFFF", coreColor2: "#FF00FF", dustColor: "#FFFFFF",
    dustRatio: 0.5,
    coreSize: [12, 22], dustSize: [1, 2],
    coreMaxAge: [8, 14], dustMaxAge: [20, 40],
    coreSpread: 4, dustSpread: 30,
    driftVx: 0, driftVy: 0,
    driftRandomX: 1.2, driftRandomY: 1.2,
    fadePower: 2.5, pulse: false,
  },

  // ─ SHADOW: Wisps ───────────────────────────────────────────────────
  shadow: {
    spawnPerFrame: 2,
    shape: "wisp",
    coreColor: "#7c3aed", coreColor2: "#312e81", dustColor: "#1f1b4b",
    dustRatio: 0.5,
    coreSize: [6, 12], dustSize: [3, 6],
    coreMaxAge: [80, 130], dustMaxAge: [120, 180],
    coreSpread: 10, dustSpread: 30,
    driftVx: 0, driftVy: -0.15,
    driftRandomX: 0.3, driftRandomY: 0.2,
    fadePower: 1.6, windCurl: 0.8,
  },

  // ─ GALAXY: Sterne ──────────────────────────────────────────────────
  galaxy: {
    spawnPerFrame: 2,
    shape: "star", shape2: "circle", shape2Ratio: 0.55,
    coreColor: "#FFFFFF", coreColor2: "#a5b4fc", dustColor: "#7c3aed",
    dustRatio: 0.5,
    coreSize: [3, 7], dustSize: [1, 3],
    coreMaxAge: [70, 130], dustMaxAge: [100, 170],
    coreSpread: 12, dustSpread: 32,
    driftVx: 0, driftVy: -0.05,
    driftRandomX: 0.5, driftRandomY: 0.4,
    fadePower: 1.7, pulse: true, rotate: true,
  },

  // ─ ARCTIC: Schneeflocken + Aurora-Wisps ────────────────────────────
  arctic: {
    spawnPerFrame: 3,
    shape: "snow", shape2: "wisp", shape2Ratio: 0.4,
    coreColor: "#7dd3fc", coreColor2: "#FFFFFF", dustColor: "#0c4a6e",
    dustRatio: 0.55,
    coreSize: [4, 7], dustSize: [2, 4],
    coreMaxAge: [70, 120], dustMaxAge: [100, 170],
    coreSpread: 10, dustSpread: 28,
    driftVx: 0, driftVy: -0.12,
    driftRandomX: 0.5, driftRandomY: 0.4,
    fadePower: 1.5, rotate: true, windCurl: 0.6,
  },

  // ─ AURORA: Wisps mit Wind-Curl ────────────────────────────────────
  aurora: {
    spawnPerFrame: 3,
    shape: "wisp", shape2: "spark", shape2Ratio: 0.3,
    coreColor: "#22d3ee", coreColor2: "#a855f7", dustColor: "#FF2D78",
    dustRatio: 0.5,
    coreSize: [5, 10], dustSize: [2, 4],
    coreMaxAge: [80, 140], dustMaxAge: [120, 180],
    coreSpread: 12, dustSpread: 32,
    driftVx: 0, driftVy: -0.15,
    driftRandomX: 0.6, driftRandomY: 0.4,
    fadePower: 1.5, windCurl: 1.5,
  },

  // ─ COSMIC: Sterne + Funken + alles ────────────────────────────────
  cosmic: {
    spawnPerFrame: 5,
    shape: "star", shape2: "spark", shape2Ratio: 0.5,
    coreColor: "#FFFFFF", coreColor2: "#7c3aed", dustColor: "#22d3ee",
    dustRatio: 0.4,
    coreSize: [4, 8], dustSize: [1, 3],
    coreMaxAge: [60, 110], dustMaxAge: [90, 150],
    coreSpread: 14, dustSpread: 38,
    driftVx: 0, driftVy: -0.2,
    driftRandomX: 1.0, driftRandomY: 0.7,
    fadePower: 1.6, pulse: true, rotate: true,
  },
};
