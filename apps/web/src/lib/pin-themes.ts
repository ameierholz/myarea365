export type PinTheme =
  | "default" | "neon" | "cyberpunk" | "arcade" | "golden" | "frost"
  | "hologram" | "vaporwave" | "matrix" | "inferno" | "nebula" | "bloodmoon"
  | "thunderstorm" | "void" | "lava" | "celestial" | "toxic" | "prismatic";

export const PIN_THEME_META: Record<PinTheme, {
  id: PinTheme;
  name: string;
  icon: string;
  description: string;
  preview: { bg: string; accent: string; glow: string };
  shopItemId: string | null;  // null = default, immer frei
}> = {
  default: {
    id: "default",
    name: "Standard",
    icon: "📍",
    description: "Klassische Markierungen im MyArea365-Stil",
    preview: { bg: "#1A1D23", accent: "#22D1C3", glow: "#22D1C344" },
    shopItemId: null,
  },
  neon: {
    id: "neon",
    name: "Neon",
    icon: "💠",
    description: "Pulsierende Cyber-Glows in Teal + Pink",
    preview: { bg: "#0a0a1a", accent: "#22D1C3", glow: "#FF2D78" },
    shopItemId: "pin_theme_neon",
  },
  cyberpunk: {
    id: "cyberpunk",
    name: "Cyberpunk",
    icon: "🟢",
    description: "Glitch, Scan-Lines, Neon-Grün/Magenta",
    preview: { bg: "#0c0016", accent: "#00FF88", glow: "#FF0066" },
    shopItemId: "pin_theme_cyberpunk",
  },
  arcade: {
    id: "arcade",
    name: "Arcade",
    icon: "🕹️",
    description: "Retro 8-bit mit Pixel-Kanten + Rainbow",
    preview: { bg: "#1a0033", accent: "#FFD700", glow: "#FF2D78" },
    shopItemId: "pin_theme_arcade",
  },
  golden: {
    id: "golden",
    name: "Golden",
    icon: "👑",
    description: "Premium-Gold mit funkelnden Partikeln",
    preview: { bg: "#2a1f08", accent: "#FFD700", glow: "#FFAC33" },
    shopItemId: "pin_theme_golden",
  },
  frost: {
    id: "frost",
    name: "Frost",
    icon: "❄️",
    description: "Eiskristalle + frostige cyan-blaue Auren",
    preview: { bg: "#06121e", accent: "#5ddaf0", glow: "#B0E6FF" },
    shopItemId: "pin_theme_frost",
  },
  hologram: {
    id: "hologram",
    name: "Hologramm",
    icon: "🪩",
    description: "Irisierender Regenbogen-Schimmer, rotierende Farben",
    preview: { bg: "#0a0a18", accent: "#a855f7", glow: "#22D1C3" },
    shopItemId: "pin_theme_hologram",
  },
  vaporwave: {
    id: "vaporwave",
    name: "Vaporwave",
    icon: "🌴",
    description: "80er-Retro-Grid in Hot-Pink + Cyan",
    preview: { bg: "#1a0530", accent: "#FF2D78", glow: "#22D1C3" },
    shopItemId: "pin_theme_vaporwave",
  },
  matrix: {
    id: "matrix",
    name: "Matrix",
    icon: "💻",
    description: "Terminal-Grün mit digitalem Regen + Scan-Lines",
    preview: { bg: "#001a0a", accent: "#00FF66", glow: "#00FF66" },
    shopItemId: "pin_theme_matrix",
  },
  inferno: {
    id: "inferno",
    name: "Inferno",
    icon: "🔥",
    description: "Flackernde Glut-Aura — Orange, Rot, gelbe Sparks",
    preview: { bg: "#1a0500", accent: "#FF4500", glow: "#FF8C00" },
    shopItemId: "pin_theme_inferno",
  },
  nebula: {
    id: "nebula",
    name: "Nebula",
    icon: "🌌",
    description: "Kosmische Wirbel in Violett und Blau",
    preview: { bg: "#0b0420", accent: "#7c3aed", glow: "#22d3ee" },
    shopItemId: "pin_theme_nebula",
  },
  bloodmoon: {
    id: "bloodmoon",
    name: "Blood Moon",
    icon: "🌑",
    description: "Tiefrote pulsierende Aura — düster und kraftvoll",
    preview: { bg: "#1a0000", accent: "#DC143C", glow: "#8B0000" },
    shopItemId: "pin_theme_bloodmoon",
  },
  thunderstorm: {
    id: "thunderstorm",
    name: "Thunderstorm",
    icon: "⛈️",
    description: "Elektrische Bögen + zuckende Blitze um den Pin",
    preview: { bg: "#0a1020", accent: "#FFEE00", glow: "#60a5fa" },
    shopItemId: "pin_theme_thunderstorm",
  },
  void: {
    id: "void",
    name: "Void",
    icon: "🌀",
    description: "Schwarzes Loch mit verzerrtem Licht-Ring",
    preview: { bg: "#05000a", accent: "#8B5CF6", glow: "#ec4899" },
    shopItemId: "pin_theme_void",
  },
  lava: {
    id: "lava",
    name: "Lava",
    icon: "🌋",
    description: "Geschmolzener Stein mit glühenden Rissen",
    preview: { bg: "#1a0a00", accent: "#FF6B00", glow: "#FFC700" },
    shopItemId: "pin_theme_lava",
  },
  celestial: {
    id: "celestial",
    name: "Celestial",
    icon: "👼",
    description: "Göttliche Goldstrahlen, rotierender Halo",
    preview: { bg: "#1a1505", accent: "#FFE066", glow: "#FFFFFF" },
    shopItemId: "pin_theme_celestial",
  },
  toxic: {
    id: "toxic",
    name: "Toxic",
    icon: "☢️",
    description: "Radioaktive grüne Blasen, tropfender Slime",
    preview: { bg: "#0a1a05", accent: "#66FF00", glow: "#CCFF33" },
    shopItemId: "pin_theme_toxic",
  },
  prismatic: {
    id: "prismatic",
    name: "Prismatic",
    icon: "💎",
    description: "Kristall-Refraktion mit rotierendem Regenbogen",
    preview: { bg: "#0a0a1a", accent: "#FF00FF", glow: "#00FFFF" },
    shopItemId: "pin_theme_prismatic",
  },
};

export const ALL_PIN_THEMES: PinTheme[] = [
  "default","neon","cyberpunk","arcade","golden","frost",
  "hologram","vaporwave","matrix","inferno","nebula","bloodmoon",
  "thunderstorm","void","lava","celestial","toxic","prismatic",
];
