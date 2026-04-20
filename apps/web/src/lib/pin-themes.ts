export type PinTheme = "default" | "neon" | "cyberpunk" | "arcade" | "golden" | "frost";

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
};

export const ALL_PIN_THEMES: PinTheme[] = ["default","neon","cyberpunk","arcade","golden","frost"];
