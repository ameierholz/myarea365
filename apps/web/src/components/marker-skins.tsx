interface MarkerProps {
  size?: number;
  color?: string;
}

export const MARKER_SKINS: Record<string, (props: MarkerProps) => string> = {
  default: ({ size = 20, color = "#22D1C3" }) => `
    <div style="position:relative;display:flex;align-items:center;justify-content:center">
      <div style="position:absolute;width:${size * 2.5}px;height:${size * 2.5}px;border-radius:50%;background:${color}15;box-shadow:0 0 ${size}px ${color}40"></div>
      <div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid rgba(255,255,255,0.8);box-shadow:0 0 ${size}px ${color}80"></div>
    </div>
  `,

  flame: ({ size = 24, color = "#FF6B4A" }) => `
    <div style="position:relative;display:flex;align-items:center;justify-content:center">
      <div style="position:absolute;width:${size * 2.5}px;height:${size * 2.5}px;border-radius:50%;background:${color}15;box-shadow:0 0 ${size * 1.5}px ${color}50;animation:pulse 1.5s ease-in-out infinite"></div>
      <svg width="${size}" height="${size * 1.4}" viewBox="0 0 24 34" fill="none">
        <path d="M12 0C12 0 2 12 2 20C2 26 6.5 30 12 30C17.5 30 22 26 22 20C22 12 12 0 12 0Z" fill="${color}" />
        <path d="M12 8C12 8 6 16 6 21C6 24.5 8.5 27 12 27C15.5 27 18 24.5 18 21C18 16 12 8 12 8Z" fill="#FFD700" opacity="0.7" />
        <circle cx="12" cy="22" r="3" fill="white" opacity="0.9" />
      </svg>
    </div>
  `,

  star: ({ size = 26, color = "#FFD700" }) => `
    <div style="position:relative;display:flex;align-items:center;justify-content:center">
      <div style="position:absolute;width:${size * 2.5}px;height:${size * 2.5}px;border-radius:50%;background:${color}10;box-shadow:0 0 ${size * 2}px ${color}30"></div>
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" stroke="#B8860B" stroke-width="1">
        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
      </svg>
    </div>
  `,

  bolt: ({ size = 26, color = "#22D1C3" }) => `
    <div style="position:relative;display:flex;align-items:center;justify-content:center">
      <div style="position:absolute;width:${size * 2.5}px;height:${size * 2.5}px;border-radius:50%;background:${color}15;box-shadow:0 0 ${size * 1.5}px ${color}40"></div>
      <svg width="${size}" height="${size * 1.2}" viewBox="0 0 24 30" fill="${color}" stroke="#1a1d23" stroke-width="1.5" stroke-linejoin="round">
        <path d="M13 2L3 14H12L11 28L21 14H12L13 2Z" />
      </svg>
    </div>
  `,

  crown: ({ size = 28, color = "#FFD700" }) => `
    <div style="position:relative;display:flex;align-items:center;justify-content:center">
      <div style="position:absolute;width:${size * 2.5}px;height:${size * 2.5}px;border-radius:50%;background:${color}10;box-shadow:0 0 ${size * 2}px ${color}30"></div>
      <svg width="${size}" height="${size * 0.85}" viewBox="0 0 32 27" fill="${color}" stroke="#B8860B" stroke-width="1.5">
        <path d="M2 22L6 8L12 16L16 4L20 16L26 8L30 22Z" />
        <rect x="2" y="22" width="28" height="5" rx="2" />
        <circle cx="16" cy="11" r="2" fill="#FF2D78" stroke="none" />
        <circle cx="8" cy="14" r="1.5" fill="#22D1C3" stroke="none" />
        <circle cx="24" cy="14" r="1.5" fill="#A855F7" stroke="none" />
      </svg>
    </div>
  `,

  diamond: ({ size = 26, color = "#7CC8F0" }) => `
    <div style="position:relative;display:flex;align-items:center;justify-content:center">
      <div style="position:absolute;width:${size * 3}px;height:${size * 3}px;border-radius:50%;background:${color}10;box-shadow:0 0 ${size * 2}px ${color}30;animation:pulse 2s ease-in-out infinite"></div>
      <svg width="${size}" height="${size * 1.1}" viewBox="0 0 24 27" fill="none">
        <path d="M12 2L2 10L12 25L22 10Z" fill="${color}" stroke="white" stroke-width="1" />
        <path d="M12 2L7 10H17Z" fill="white" opacity="0.3" />
        <path d="M2 10L12 25L7 10Z" fill="${color}" opacity="0.7" />
      </svg>
    </div>
  `,

  dragon: ({ size = 32, color = "#FF2D78" }) => `
    <div style="position:relative;display:flex;align-items:center;justify-content:center">
      <div style="position:absolute;width:${size * 2.5}px;height:${size * 2.5}px;border-radius:50%;background:${color}15;box-shadow:0 0 ${size * 2}px ${color}40;animation:pulse 1.5s ease-in-out infinite"></div>
      <svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="${color}">
        <path d="M16 4C16 4 8 8 6 16C4 24 10 28 16 28C22 28 28 24 26 16C24 8 16 4 16 4Z" stroke="#1a1d23" stroke-width="1.5" />
        <circle cx="12" cy="15" r="2" fill="#FFD700" stroke="#1a1d23" stroke-width="1" />
        <circle cx="20" cy="15" r="2" fill="#FFD700" stroke="#1a1d23" stroke-width="1" />
        <circle cx="12" cy="15" r="0.8" fill="#1a1d23" />
        <circle cx="20" cy="15" r="0.8" fill="#1a1d23" />
        <path d="M6 10L2 4L8 8Z" fill="${color}" stroke="#1a1d23" stroke-width="1" />
        <path d="M26 10L30 4L24 8Z" fill="${color}" stroke="#1a1d23" stroke-width="1" />
        <path d="M13 22C14 23 18 23 19 22" stroke="#1a1d23" stroke-width="1.5" stroke-linecap="round" />
      </svg>
    </div>
  `,

  phoenix: ({ size = 32, color = "#FF6B4A" }) => `
    <div style="position:relative;display:flex;align-items:center;justify-content:center">
      <div style="position:absolute;width:${size * 3}px;height:${size * 3}px;border-radius:50%;background:${color}12;box-shadow:0 0 ${size * 2.5}px ${color}30,0 0 ${size * 4}px ${color}15;animation:pulse 2s ease-in-out infinite"></div>
      <svg width="${size}" height="${size * 1.2}" viewBox="0 0 32 38" fill="none">
        <path d="M16 6C16 6 6 14 6 22C6 30 10 34 16 34C22 34 26 30 26 22C26 14 16 6 16 6Z" fill="${color}" stroke="#FFD700" stroke-width="1" />
        <path d="M16 2L14 8H18Z" fill="#FFD700" />
        <path d="M8 12L4 6L10 10Z" fill="${color}" />
        <path d="M24 12L28 6L22 10Z" fill="${color}" />
        <path d="M10 28C8 32 6 36 4 38" stroke="${color}" stroke-width="2" stroke-linecap="round" opacity="0.5" />
        <path d="M22 28C24 32 26 36 28 38" stroke="${color}" stroke-width="2" stroke-linecap="round" opacity="0.5" />
        <circle cx="13" cy="20" r="2" fill="#FFD700" />
        <circle cx="19" cy="20" r="2" fill="#FFD700" />
        <circle cx="13" cy="20" r="0.8" fill="#1a1d23" />
        <circle cx="19" cy="20" r="0.8" fill="#1a1d23" />
      </svg>
    </div>
  `,
};

export const RARITY_COLORS: Record<string, string> = {
  common: "#9BA3B5",
  uncommon: "#22D1C3",
  rare: "#A855F7",
  epic: "#FF2D78",
  legendary: "#FFD700",
};

export const RARITY_LABELS: Record<string, string> = {
  common: "Gewöhnlich",
  uncommon: "Ungewöhnlich",
  rare: "Selten",
  epic: "Episch",
  legendary: "Legendär",
};
