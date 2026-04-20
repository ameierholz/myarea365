"use client";

import { useEffect } from "react";

/**
 * Globales CSS für Pin-Themes. Greift über [data-pin-theme="X"]-Attribut
 * am Map-Container. Jedes Theme überschreibt boss/sanctuary/drop/shop-Marker.
 */
const PIN_THEME_CSS = `
/* ══════════════════════════════════════════════════════════
   NEON — pulsierende Teal+Pink-Glows
   ══════════════════════════════════════════════════════════ */
[data-pin-theme="neon"] .ma365-boss-marker {
  background: linear-gradient(135deg, rgba(10,0,40,0.95) 0%, rgba(60,0,40,0.95) 100%) !important;
  border-color: #FF2D78 !important;
  box-shadow: 0 0 20px rgba(255,45,120,0.8), 0 0 40px rgba(34,209,195,0.4), inset 0 0 20px rgba(255,45,120,0.2) !important;
  animation: ma365ThemeNeonPulse 1.6s ease-in-out infinite !important;
}
[data-pin-theme="neon"] .ma365-sanctuary-marker {
  filter: drop-shadow(0 0 8px #22D1C3) drop-shadow(0 0 16px #FF2D78);
}
[data-pin-theme="neon"] .ma365-drop-marker,
[data-pin-theme="neon"] .mapboxgl-marker[data-shop] {
  filter: drop-shadow(0 0 10px #22D1C3) drop-shadow(0 0 20px rgba(255,45,120,0.6));
}
@keyframes ma365ThemeNeonPulse {
  0%,100% { box-shadow: 0 0 20px rgba(255,45,120,0.8), 0 0 40px rgba(34,209,195,0.4), inset 0 0 20px rgba(255,45,120,0.2); }
  50%     { box-shadow: 0 0 35px rgba(255,45,120,1),   0 0 60px rgba(34,209,195,0.8), inset 0 0 25px rgba(34,209,195,0.3); }
}

/* ══════════════════════════════════════════════════════════
   CYBERPUNK — Glitch, Scan-Lines, Neon-Grün + Magenta
   ══════════════════════════════════════════════════════════ */
[data-pin-theme="cyberpunk"] .ma365-boss-marker,
[data-pin-theme="cyberpunk"] .mapboxgl-marker[data-shop] {
  position: relative;
  background: #05100a !important;
  border: 2px solid #00FF88 !important;
  box-shadow: 0 0 15px #00FF88, 0 0 30px rgba(255,0,102,0.5), inset 0 0 15px rgba(0,255,136,0.15) !important;
  animation: ma365ThemeCyberGlitch 3s steps(12,end) infinite !important;
  color: #00FF88 !important;
}
[data-pin-theme="cyberpunk"] .ma365-boss-marker::before {
  content: "";
  position: absolute; inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    transparent 0 2px,
    rgba(0,255,136,0.12) 2px 3px
  );
  mix-blend-mode: overlay;
  border-radius: inherit;
}
[data-pin-theme="cyberpunk"] .ma365-sanctuary-marker,
[data-pin-theme="cyberpunk"] .ma365-drop-marker {
  filter: drop-shadow(0 0 6px #00FF88) drop-shadow(0 0 14px #FF0066) hue-rotate(-10deg);
}
@keyframes ma365ThemeCyberGlitch {
  0%,91%,100% { transform: translate(0,0); }
  92% { transform: translate(-1px, 0.5px); filter: hue-rotate(15deg); }
  94% { transform: translate(1.5px, -0.5px); filter: hue-rotate(-10deg); }
  96% { transform: translate(-0.5px, 0); filter: hue-rotate(8deg); }
  98% { transform: translate(0,0); }
}

/* ══════════════════════════════════════════════════════════
   ARCADE — Retro 8-bit, Pixel-Kanten, Rainbow-Shimmer
   ══════════════════════════════════════════════════════════ */
[data-pin-theme="arcade"] .ma365-boss-marker {
  background: #1a0033 !important;
  border: 3px solid #FFD700 !important;
  border-radius: 4px !important;
  box-shadow:
    0 0 0 2px #FF2D78,
    0 0 0 4px #FFD700,
    0 4px 0 #00FF88,
    0 6px 0 #FF2D78 !important;
  animation: ma365ThemeArcadeRainbow 3s linear infinite !important;
  image-rendering: pixelated;
  font-family: "Press Start 2P", monospace, sans-serif !important;
}
[data-pin-theme="arcade"] .ma365-boss-marker * {
  text-shadow: 2px 2px 0 #000, -1px -1px 0 #FF2D78 !important;
}
[data-pin-theme="arcade"] .mapboxgl-marker[data-shop] {
  filter: drop-shadow(2px 2px 0 #FFD700) drop-shadow(-1px -1px 0 #FF2D78);
  image-rendering: pixelated;
}
[data-pin-theme="arcade"] .ma365-sanctuary-marker,
[data-pin-theme="arcade"] .ma365-drop-marker {
  filter: drop-shadow(2px 2px 0 #00FF88) drop-shadow(-1px -1px 0 #FFD700) contrast(1.4) saturate(1.5);
  image-rendering: pixelated;
}
@keyframes ma365ThemeArcadeRainbow {
  0%   { filter: hue-rotate(0deg)   brightness(1); }
  50%  { filter: hue-rotate(180deg) brightness(1.2); }
  100% { filter: hue-rotate(360deg) brightness(1); }
}

/* ══════════════════════════════════════════════════════════
   GOLDEN — Premium-Gold + Sparkle
   ══════════════════════════════════════════════════════════ */
[data-pin-theme="golden"] .ma365-boss-marker {
  background: linear-gradient(135deg, #2a1f08 0%, #4a3a10 100%) !important;
  border: 2px solid #FFD700 !important;
  box-shadow: 0 0 22px rgba(255,215,0,0.85), 0 4px 12px rgba(0,0,0,0.5), inset 0 2px 8px rgba(255,172,51,0.3) !important;
  animation: ma365ThemeGoldShimmer 2.4s ease-in-out infinite !important;
}
[data-pin-theme="golden"] .ma365-boss-marker::after {
  content: "✨";
  position: absolute; top: -8px; right: -6px; font-size: 16px;
  animation: ma365ThemeGoldSparkle 1.8s ease-in-out infinite;
  text-shadow: 0 0 6px #FFD700;
}
[data-pin-theme="golden"] .ma365-sanctuary-marker,
[data-pin-theme="golden"] .ma365-drop-marker,
[data-pin-theme="golden"] .mapboxgl-marker[data-shop] {
  filter: drop-shadow(0 0 10px #FFD700) drop-shadow(0 0 20px #FFAC33) saturate(1.3) brightness(1.1);
}
@keyframes ma365ThemeGoldShimmer {
  0%,100% { box-shadow: 0 0 22px rgba(255,215,0,0.85), 0 4px 12px rgba(0,0,0,0.5), inset 0 2px 8px rgba(255,172,51,0.3); }
  50%     { box-shadow: 0 0 38px rgba(255,215,0,1),    0 6px 18px rgba(0,0,0,0.6), inset 0 2px 14px rgba(255,215,0,0.5); }
}
@keyframes ma365ThemeGoldSparkle {
  0%,100% { opacity: 1; transform: scale(1) rotate(0deg); }
  50%     { opacity: 0.5; transform: scale(1.4) rotate(180deg); }
}

/* ══════════════════════════════════════════════════════════
   FROST — Eiskristalle + Cyan-Blue
   ══════════════════════════════════════════════════════════ */
[data-pin-theme="frost"] .ma365-boss-marker {
  background: linear-gradient(135deg, rgba(6,18,30,0.95) 0%, rgba(20,45,80,0.95) 100%) !important;
  border: 2px solid #5ddaf0 !important;
  box-shadow: 0 0 18px rgba(93,218,240,0.8), 0 0 36px rgba(176,230,255,0.4), inset 0 0 18px rgba(176,230,255,0.15) !important;
  animation: ma365ThemeFrostBreath 3.2s ease-in-out infinite !important;
}
[data-pin-theme="frost"] .ma365-boss-marker::before {
  content: "❄";
  position: absolute; top: -14px; left: 50%; transform: translateX(-50%);
  color: #B0E6FF; font-size: 14px;
  text-shadow: 0 0 8px #5ddaf0;
  animation: ma365ThemeFrostFloat 3.2s ease-in-out infinite;
}
[data-pin-theme="frost"] .ma365-sanctuary-marker,
[data-pin-theme="frost"] .ma365-drop-marker,
[data-pin-theme="frost"] .mapboxgl-marker[data-shop] {
  filter: drop-shadow(0 0 8px #5ddaf0) drop-shadow(0 0 16px #B0E6FF) saturate(0.85) brightness(1.05) hue-rotate(-8deg);
}
@keyframes ma365ThemeFrostBreath {
  0%,100% { box-shadow: 0 0 18px rgba(93,218,240,0.8), 0 0 36px rgba(176,230,255,0.4), inset 0 0 18px rgba(176,230,255,0.15); }
  50%     { box-shadow: 0 0 32px rgba(93,218,240,1),   0 0 58px rgba(176,230,255,0.7), inset 0 0 28px rgba(176,230,255,0.3); }
}
@keyframes ma365ThemeFrostFloat {
  0%,100% { transform: translateX(-50%) translateY(0) rotate(-8deg); opacity: 0.7; }
  50%     { transform: translateX(-50%) translateY(-4px) rotate(8deg); opacity: 1; }
}
`;

export function PinThemeStyles() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById("ma365-pin-theme-styles")) return;
    const style = document.createElement("style");
    style.id = "ma365-pin-theme-styles";
    style.textContent = PIN_THEME_CSS;
    document.head.appendChild(style);
  }, []);
  return null;
}
