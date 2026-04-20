"use client";

import { useEffect } from "react";

/**
 * Globales CSS für Runner-Pin-Themes.
 * Greift nur auf den eigenen Runner-Pin (.ma365-runner-pin) —
 * Shop-Pins, AreBoss, Loot, Sanctuaries sind nicht betroffen.
 */
const PIN_THEME_CSS = `
/* ══════════════════════════════════════════════════════════
   NEON — pulsierende Teal+Pink-Glows am Runner-Ring + Emoji
   ══════════════════════════════════════════════════════════ */
[data-pin-theme="neon"] .ma365-runner-pin .runner-ring {
  background: radial-gradient(circle, rgba(255,45,120,0.35), rgba(34,209,195,0.25)) !important;
  box-shadow: 0 0 22px rgba(34,209,195,0.95), 0 0 42px rgba(255,45,120,0.75), inset 0 0 12px rgba(255,255,255,0.25) !important;
  animation: ma365ThemeNeonPulse 1.6s ease-in-out infinite !important;
}
[data-pin-theme="neon"] .ma365-runner-pin .runner-emoji {
  filter: drop-shadow(0 0 10px #22D1C3) drop-shadow(0 0 18px #FF2D78) saturate(1.25) !important;
}
@keyframes ma365ThemeNeonPulse {
  0%,100% { box-shadow: 0 0 22px rgba(34,209,195,0.9),  0 0 40px rgba(255,45,120,0.7); }
  50%     { box-shadow: 0 0 36px rgba(34,209,195,1),    0 0 64px rgba(255,45,120,1); }
}

/* ══════════════════════════════════════════════════════════
   CYBERPUNK — Glitch + Scan-Lines am Runner-Pin
   ══════════════════════════════════════════════════════════ */
[data-pin-theme="cyberpunk"] .ma365-runner-pin .runner-ring {
  background: #02180f !important;
  border: 2px solid #00FF88 !important;
  box-shadow: 0 0 18px #00FF88, 0 0 34px rgba(255,0,102,0.7), inset 0 0 14px rgba(0,255,136,0.25) !important;
  animation: ma365ThemeCyberGlitch 3s steps(14,end) infinite !important;
}
[data-pin-theme="cyberpunk"] .ma365-runner-pin::after {
  content: "";
  position: absolute; inset: 10px;
  pointer-events: none;
  background: repeating-linear-gradient(
    transparent 0 2px,
    rgba(0,255,136,0.16) 2px 3px
  );
  mix-blend-mode: overlay;
  border-radius: 50%;
  z-index: 1;
}
[data-pin-theme="cyberpunk"] .ma365-runner-pin .runner-emoji {
  filter: drop-shadow(0 0 8px #00FF88) drop-shadow(0 0 16px #FF0066) hue-rotate(-15deg) contrast(1.2) !important;
}
@keyframes ma365ThemeCyberGlitch {
  0%,90%,100% { transform: translate(0,0); }
  92% { transform: translate(-1px, 0.5px); filter: hue-rotate(18deg); }
  94% { transform: translate(1.5px, -0.5px); filter: hue-rotate(-12deg); }
  96% { transform: translate(-0.5px, 0); filter: hue-rotate(10deg); }
  98% { transform: translate(0,0); }
}

/* ══════════════════════════════════════════════════════════
   ARCADE — Retro 8-bit am Runner-Pin
   ══════════════════════════════════════════════════════════ */
[data-pin-theme="arcade"] .ma365-runner-pin .runner-ring {
  background: #1a0033 !important;
  border: 3px solid #FFD700 !important;
  border-radius: 6px !important;
  box-shadow:
    0 0 0 2px #FF2D78,
    0 0 0 4px #FFD700,
    0 4px 0 #00FF88,
    0 6px 0 #FF2D78 !important;
  animation: ma365ThemeArcadeRainbow 3s linear infinite !important;
  image-rendering: pixelated;
}
[data-pin-theme="arcade"] .ma365-runner-pin .runner-emoji {
  filter: drop-shadow(2px 2px 0 #FFD700) drop-shadow(-1px -1px 0 #FF2D78) contrast(1.4) saturate(1.5) !important;
  image-rendering: pixelated;
}
@keyframes ma365ThemeArcadeRainbow {
  0%   { filter: hue-rotate(0deg)   brightness(1); }
  50%  { filter: hue-rotate(180deg) brightness(1.2); }
  100% { filter: hue-rotate(360deg) brightness(1); }
}

/* ══════════════════════════════════════════════════════════
   GOLDEN — Gold-Glow + Sparkle am Runner-Pin
   ══════════════════════════════════════════════════════════ */
[data-pin-theme="golden"] .ma365-runner-pin .runner-ring {
  background: radial-gradient(circle, rgba(255,215,0,0.4), rgba(255,172,51,0.2)) !important;
  border: 2px solid #FFD700 !important;
  box-shadow: 0 0 24px rgba(255,215,0,0.95), 0 0 50px rgba(255,172,51,0.6), inset 0 2px 10px rgba(255,215,0,0.35) !important;
  animation: ma365ThemeGoldShimmer 2.4s ease-in-out infinite !important;
}
[data-pin-theme="golden"] .ma365-runner-pin .runner-emoji {
  filter: drop-shadow(0 0 10px #FFD700) drop-shadow(0 0 20px #FFAC33) saturate(1.4) brightness(1.15) !important;
}
[data-pin-theme="golden"] .ma365-runner-pin::before {
  content: "✨";
  position: absolute; top: -4px; right: 2px; font-size: 16px;
  animation: ma365ThemeGoldSparkle 1.8s ease-in-out infinite;
  text-shadow: 0 0 8px #FFD700;
  z-index: 4;
}
@keyframes ma365ThemeGoldShimmer {
  0%,100% { box-shadow: 0 0 24px rgba(255,215,0,0.95), 0 0 50px rgba(255,172,51,0.6), inset 0 2px 10px rgba(255,215,0,0.35); }
  50%     { box-shadow: 0 0 40px rgba(255,215,0,1),    0 0 75px rgba(255,172,51,0.85), inset 0 2px 16px rgba(255,215,0,0.55); }
}
@keyframes ma365ThemeGoldSparkle {
  0%,100% { opacity: 1;   transform: scale(1) rotate(0deg); }
  50%     { opacity: 0.5; transform: scale(1.4) rotate(180deg); }
}

/* ══════════════════════════════════════════════════════════
   FROST — Eiskristall am Runner-Pin
   ══════════════════════════════════════════════════════════ */
[data-pin-theme="frost"] .ma365-runner-pin .runner-ring {
  background: radial-gradient(circle, rgba(93,218,240,0.4), rgba(176,230,255,0.2)) !important;
  border: 2px solid #5ddaf0 !important;
  box-shadow: 0 0 22px rgba(93,218,240,0.9), 0 0 44px rgba(176,230,255,0.55), inset 0 0 20px rgba(176,230,255,0.25) !important;
  animation: ma365ThemeFrostBreath 3.2s ease-in-out infinite !important;
}
[data-pin-theme="frost"] .ma365-runner-pin .runner-emoji {
  filter: drop-shadow(0 0 8px #5ddaf0) drop-shadow(0 0 16px #B0E6FF) saturate(0.9) brightness(1.1) hue-rotate(-12deg) !important;
}
[data-pin-theme="frost"] .ma365-runner-pin::before {
  content: "❄";
  position: absolute; top: -8px; left: 50%; transform: translateX(-50%);
  color: #B0E6FF; font-size: 16px;
  text-shadow: 0 0 10px #5ddaf0;
  animation: ma365ThemeFrostFloat 3.2s ease-in-out infinite;
  z-index: 4;
}
@keyframes ma365ThemeFrostBreath {
  0%,100% { box-shadow: 0 0 22px rgba(93,218,240,0.9), 0 0 44px rgba(176,230,255,0.55), inset 0 0 20px rgba(176,230,255,0.25); }
  50%     { box-shadow: 0 0 38px rgba(93,218,240,1),   0 0 70px rgba(176,230,255,0.85), inset 0 0 30px rgba(176,230,255,0.45); }
}
@keyframes ma365ThemeFrostFloat {
  0%,100% { transform: translateX(-50%) translateY(0) rotate(-8deg); opacity: 0.7; }
  50%     { transform: translateX(-50%) translateY(-4px) rotate(8deg); opacity: 1; }
}
`;

export function PinThemeStyles() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    // Falls alte Version im DOM: raus damit, neue reinlegen
    const existing = document.getElementById("ma365-pin-theme-styles");
    if (existing) existing.remove();
    const style = document.createElement("style");
    style.id = "ma365-pin-theme-styles";
    style.textContent = PIN_THEME_CSS;
    document.head.appendChild(style);
  }, []);
  return null;
}
