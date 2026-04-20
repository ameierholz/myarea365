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
  /* 6 goldene Sterne kreisen um den Pin */
  content: "";
  position: absolute; inset: -22px;
  background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><g fill='%23FFD700' font-family='Arial' font-size='20' font-weight='900'><text x='60' y='18' text-anchor='middle'>%E2%98%85</text><text x='108' y='42' text-anchor='middle'>%E2%98%85</text><text x='108' y='90' text-anchor='middle'>%E2%98%85</text><text x='60' y='114' text-anchor='middle'>%E2%98%85</text><text x='12' y='90' text-anchor='middle'>%E2%98%85</text><text x='12' y='42' text-anchor='middle'>%E2%98%85</text></g></svg>") center/contain no-repeat;
  filter: drop-shadow(0 0 6px #FFD700) drop-shadow(0 0 12px #FFAC33);
  animation: ma365ThemeGoldStarSpin 9s linear infinite;
  z-index: -1; pointer-events: none;
}
[data-pin-theme="golden"] .ma365-runner-pin::after {
  /* Zweite Sterne-Ebene gegen-rotiert = Funkel-Effekt */
  content: "";
  position: absolute; inset: -8px;
  background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><g fill='%23FFF4C8' font-family='Arial' font-size='10' font-weight='900'><text x='30' y='14' text-anchor='middle'>%E2%9C%A6</text><text x='72' y='16' text-anchor='middle'>%E2%9C%A6</text><text x='18' y='80' text-anchor='middle'>%E2%9C%A6</text><text x='84' y='88' text-anchor='middle'>%E2%9C%A6</text></g></svg>") center/contain no-repeat;
  animation: ma365ThemeGoldStarSpin 4s linear infinite reverse;
  opacity: 0.8;
  z-index: -1; pointer-events: none;
}
@keyframes ma365ThemeGoldStarSpin { to { transform: rotate(360deg); } }
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

/* ══════════════════════════════════════════════════════════
   HOLOGRAMM — irisierender Regenbogen-Conic, rotierender Hue
   ══════════════════════════════════════════════════════════ */
[data-pin-theme="hologram"] .ma365-runner-pin .runner-ring {
  background: conic-gradient(from 0deg,
    #ff0080, #ff8c00, #ffd700, #00ff66, #00ffff, #7c3aed, #ff2d78, #ff0080) !important;
  box-shadow: 0 0 22px rgba(168,85,247,0.7), 0 0 42px rgba(34,209,195,0.6), inset 0 0 10px rgba(255,255,255,0.3) !important;
  animation: ma365ThemeHoloSpin 4s linear infinite, ma365ThemeHoloHue 3s ease-in-out infinite !important;
}
[data-pin-theme="hologram"] .ma365-runner-pin .runner-emoji {
  filter: drop-shadow(0 0 6px #fff) drop-shadow(0 0 14px #a855f7) saturate(1.5) !important;
  animation: ma365ThemeHoloHue 3s ease-in-out infinite !important;
}
@keyframes ma365ThemeHoloSpin { to { transform: rotate(360deg); } }
@keyframes ma365ThemeHoloHue {
  0%,100% { filter: hue-rotate(0deg) saturate(1.3); }
  50%     { filter: hue-rotate(180deg) saturate(1.6); }
}

/* ══════════════════════════════════════════════════════════
   VAPORWAVE — 80er Retro, Hot-Pink + Cyan Neon
   ══════════════════════════════════════════════════════════ */
[data-pin-theme="vaporwave"] .ma365-runner-pin .runner-ring {
  background: linear-gradient(180deg, rgba(255,45,120,0.4), rgba(34,209,195,0.3)) !important;
  border: 2px solid #FF2D78 !important;
  box-shadow: 0 0 20px #FF2D78, 0 0 40px rgba(34,209,195,0.7), inset 0 0 18px rgba(255,45,120,0.35) !important;
  animation: ma365ThemeVaporPulse 2.4s ease-in-out infinite !important;
}
[data-pin-theme="vaporwave"] .ma365-runner-pin::after {
  content: "";
  position: absolute; inset: 8px;
  pointer-events: none; border-radius: 50%;
  background: repeating-linear-gradient(
    180deg, transparent 0 3px,
    rgba(34,209,195,0.18) 3px 4px
  );
  z-index: 1;
}
[data-pin-theme="vaporwave"] .ma365-runner-pin .runner-emoji {
  filter: drop-shadow(-2px 0 0 #FF2D78) drop-shadow(2px 0 0 #22D1C3) drop-shadow(0 0 8px #FF2D78) !important;
}
@keyframes ma365ThemeVaporPulse {
  0%,100% { box-shadow: 0 0 20px #FF2D78, 0 0 40px rgba(34,209,195,0.7); }
  50%     { box-shadow: 0 0 34px #FF2D78, 0 0 60px #22D1C3; }
}

/* ══════════════════════════════════════════════════════════
   MATRIX — Terminal-Grün, digitaler Regen, Scan-Lines
   ══════════════════════════════════════════════════════════ */
[data-pin-theme="matrix"] .ma365-runner-pin .runner-ring {
  background: #001a0a !important;
  border: 2px solid #00FF66 !important;
  box-shadow: 0 0 16px #00FF66, 0 0 32px rgba(0,255,102,0.5), inset 0 0 12px rgba(0,255,102,0.35) !important;
  animation: ma365ThemeMatrixFlicker 1.8s steps(8,end) infinite !important;
}
[data-pin-theme="matrix"] .ma365-runner-pin::after {
  content: "";
  position: absolute; inset: 10px;
  pointer-events: none; border-radius: 50%;
  background:
    repeating-linear-gradient(transparent 0 2px, rgba(0,255,102,0.22) 2px 3px),
    repeating-linear-gradient(90deg, transparent 0 5px, rgba(0,255,102,0.08) 5px 6px);
  z-index: 1;
  animation: ma365ThemeMatrixScroll 1.5s linear infinite;
}
[data-pin-theme="matrix"] .ma365-runner-pin .runner-emoji {
  filter: drop-shadow(0 0 8px #00FF66) drop-shadow(0 0 14px rgba(0,255,102,0.7)) hue-rotate(40deg) !important;
}
@keyframes ma365ThemeMatrixFlicker {
  0%,89%,100% { opacity: 1; }
  90%,95% { opacity: 0.7; }
}
@keyframes ma365ThemeMatrixScroll {
  0% { background-position: 0 0, 0 0; }
  100% { background-position: 0 20px, 0 0; }
}

/* ══════════════════════════════════════════════════════════
   INFERNO — Flackernde Glut, Orange/Rot + Sparks
   ══════════════════════════════════════════════════════════ */
[data-pin-theme="inferno"] .ma365-runner-pin .runner-ring {
  background: radial-gradient(circle at 50% 60%, #FFD700 0%, #FF4500 40%, #8B0000 100%) !important;
  box-shadow: 0 0 24px #FF4500, 0 0 48px rgba(255,140,0,0.8), inset 0 0 14px rgba(255,215,0,0.4) !important;
  animation: ma365ThemeInfernoFlicker 0.7s ease-in-out infinite !important;
}
[data-pin-theme="inferno"] .ma365-runner-pin::before {
  /* Flammenzungen schlagen nach oben hinter dem Pin */
  content: "";
  position: absolute; inset: -26px -12px -6px -12px;
  background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 120'><g><path d='M50 10 C40 25 45 35 50 45 C55 35 60 25 50 10' fill='%23FFD700'/><path d='M30 20 C22 35 27 48 35 55 C38 45 40 38 30 20' fill='%23FF8C00' opacity='0.85'/><path d='M70 20 C78 35 73 48 65 55 C62 45 60 38 70 20' fill='%23FF8C00' opacity='0.85'/><path d='M15 40 C10 55 16 68 25 70 C23 58 22 52 15 40' fill='%23FF4500' opacity='0.7'/><path d='M85 40 C90 55 84 68 75 70 C77 58 78 52 85 40' fill='%23FF4500' opacity='0.7'/></g></svg>") center bottom/contain no-repeat;
  filter: drop-shadow(0 0 6px #FF6B00) drop-shadow(0 0 12px #FFD700);
  animation: ma365ThemeInfernoFlame 0.5s ease-in-out infinite alternate;
  pointer-events: none; z-index: -1;
}
[data-pin-theme="inferno"] .ma365-runner-pin .runner-emoji {
  filter: drop-shadow(0 0 8px #FFD700) drop-shadow(0 0 16px #FF4500) saturate(1.4) !important;
}
@keyframes ma365ThemeInfernoFlame {
  0%   { transform: scaleY(1)    scaleX(1); }
  100% { transform: scaleY(1.12) scaleX(0.92); }
}
@keyframes ma365ThemeInfernoFlicker {
  0%,100% { box-shadow: 0 0 24px #FF4500, 0 0 48px rgba(255,140,0,0.8); transform: scale(1); }
  33%     { box-shadow: 0 0 34px #FF8C00, 0 0 62px #FFD700; transform: scale(1.03); }
  66%     { box-shadow: 0 0 20px #8B0000, 0 0 40px rgba(255,69,0,0.7); transform: scale(0.98); }
}

/* ══════════════════════════════════════════════════════════
   NEBULA — Kosmische Wirbel Violett/Blau
   ══════════════════════════════════════════════════════════ */
[data-pin-theme="nebula"] .ma365-runner-pin .runner-ring {
  background: conic-gradient(from 180deg,
    #0b0420, #7c3aed, #22d3ee, #ec4899, #7c3aed, #0b0420) !important;
  box-shadow: 0 0 22px #7c3aed, 0 0 44px rgba(34,211,238,0.6), inset 0 0 14px rgba(236,72,153,0.3) !important;
  animation: ma365ThemeNebulaSpin 8s linear infinite !important;
}
[data-pin-theme="nebula"] .ma365-runner-pin::after {
  content: "";
  position: absolute; inset: 6px;
  pointer-events: none; border-radius: 50%;
  background:
    radial-gradient(2px 2px at 20% 30%, #fff 50%, transparent 52%),
    radial-gradient(1.5px 1.5px at 70% 60%, #22d3ee 50%, transparent 52%),
    radial-gradient(2px 2px at 40% 80%, #fff 50%, transparent 52%),
    radial-gradient(1.5px 1.5px at 80% 20%, #ec4899 50%, transparent 52%);
  opacity: 0.85;
  animation: ma365ThemeNebulaTwinkle 3s ease-in-out infinite;
  z-index: 1;
}
[data-pin-theme="nebula"] .ma365-runner-pin .runner-emoji {
  filter: drop-shadow(0 0 8px #7c3aed) drop-shadow(0 0 16px #22d3ee) !important;
}
@keyframes ma365ThemeNebulaSpin { to { transform: rotate(-360deg); } }
@keyframes ma365ThemeNebulaTwinkle {
  0%,100% { opacity: 0.5; } 50% { opacity: 1; }
}

/* ══════════════════════════════════════════════════════════
   BLOOD MOON — Tiefrote Aura, düster pulsierend
   ══════════════════════════════════════════════════════════ */
[data-pin-theme="bloodmoon"] .ma365-runner-pin .runner-ring {
  background: radial-gradient(circle, rgba(220,20,60,0.45), rgba(139,0,0,0.85)) !important;
  border: 1.5px solid #DC143C !important;
  box-shadow: 0 0 26px #8B0000, 0 0 52px rgba(220,20,60,0.7), inset 0 0 16px rgba(139,0,0,0.5) !important;
  animation: ma365ThemeBloodPulse 2.8s ease-in-out infinite !important;
}
[data-pin-theme="bloodmoon"] .ma365-runner-pin .runner-emoji {
  filter: drop-shadow(0 0 6px #DC143C) drop-shadow(0 0 14px #8B0000) contrast(1.15) !important;
}
@keyframes ma365ThemeBloodPulse {
  0%,100% { box-shadow: 0 0 26px #8B0000, 0 0 52px rgba(220,20,60,0.7); transform: scale(1); }
  50%     { box-shadow: 0 0 38px #DC143C, 0 0 70px #8B0000; transform: scale(1.04); }
}

/* ══════════════════════════════════════════════════════════
   THUNDERSTORM — Elektrische Bögen + zuckende Blitze
   ══════════════════════════════════════════════════════════ */
[data-pin-theme="thunderstorm"] .ma365-runner-pin .runner-ring {
  background: radial-gradient(circle, rgba(96,165,250,0.3), rgba(10,16,32,0.95)) !important;
  border: 2px solid #FFEE00 !important;
  box-shadow:
    0 0 22px #FFEE00,
    0 0 44px rgba(96,165,250,0.75),
    inset 0 0 16px rgba(255,238,0,0.3) !important;
  animation: ma365ThemeThunderFlash 2.4s steps(30, end) infinite !important;
}
[data-pin-theme="thunderstorm"] .ma365-runner-pin::before {
  /* 3 Blitze schlagen hinter dem Pin ein — rotieren langsam */
  content: "";
  position: absolute; inset: -24px;
  background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><g fill='%23FFEE00' stroke='%2360a5fa' stroke-width='1'><polygon points='60,5 52,45 64,45 56,75 70,40 58,40 66,5'/><polygon points='10,40 38,55 28,60 48,85 18,68 30,63 8,40'/><polygon points='110,40 82,55 92,60 72,85 102,68 90,63 112,40'/></g></svg>") center/contain no-repeat;
  filter: drop-shadow(0 0 8px #FFEE00) drop-shadow(0 0 14px #60a5fa);
  animation: ma365ThemeThunderSpin 7s linear infinite, ma365ThemeThunderBoltFlash 2.4s steps(30,end) infinite;
  pointer-events: none;
  z-index: -1;
}
@keyframes ma365ThemeThunderBoltFlash {
  0%, 92%, 100% { opacity: 1; }
  93%, 95%      { opacity: 0.3; }
}
[data-pin-theme="thunderstorm"] .ma365-runner-pin .runner-emoji {
  filter: drop-shadow(0 0 10px #FFEE00) drop-shadow(0 0 18px #60a5fa) !important;
}
@keyframes ma365ThemeThunderFlash {
  0%, 92%, 100% { filter: brightness(1); }
  93%, 95%      { filter: brightness(1.9) hue-rotate(10deg); }
}
@keyframes ma365ThemeThunderSpin { to { transform: rotate(360deg); } }

/* ══════════════════════════════════════════════════════════
   VOID — Schwarzes Loch mit verzerrtem Licht-Ring
   ══════════════════════════════════════════════════════════ */
[data-pin-theme="void"] .ma365-runner-pin .runner-ring {
  background: radial-gradient(circle, #000 0%, #1a0030 40%, #8B5CF644 70%, transparent 100%) !important;
  box-shadow:
    0 0 28px #8B5CF6,
    0 0 56px rgba(236,72,153,0.7),
    inset 0 0 20px rgba(0,0,0,0.9) !important;
  animation: ma365ThemeVoidSuck 2.2s ease-in-out infinite !important;
}
[data-pin-theme="void"] .ma365-runner-pin::before {
  content: "";
  position: absolute; inset: -8px;
  border-radius: 50%;
  background: conic-gradient(from 0deg,
    rgba(139,92,246,0.8), rgba(236,72,153,0.6), rgba(96,165,250,0.4),
    transparent, rgba(139,92,246,0.8));
  filter: blur(6px);
  animation: ma365ThemeVoidSpin 3s linear infinite;
  pointer-events: none;
  z-index: -1;
}
[data-pin-theme="void"] .ma365-runner-pin .runner-emoji {
  filter: drop-shadow(0 0 8px #8B5CF6) drop-shadow(0 0 18px #ec4899) contrast(1.2) !important;
}
@keyframes ma365ThemeVoidSuck {
  0%,100% { transform: scale(1); box-shadow: 0 0 28px #8B5CF6, 0 0 56px rgba(236,72,153,0.7); }
  50%     { transform: scale(0.94); box-shadow: 0 0 36px #ec4899, 0 0 70px rgba(139,92,246,0.9); }
}
@keyframes ma365ThemeVoidSpin { to { transform: rotate(-360deg); } }

/* ══════════════════════════════════════════════════════════
   LAVA — Geschmolzener Stein + glühende Risse
   ══════════════════════════════════════════════════════════ */
[data-pin-theme="lava"] .ma365-runner-pin .runner-ring {
  background:
    radial-gradient(ellipse at 30% 20%, #FFC700 0%, #FF6B00 30%, #8B0000 70%, #1a0a00 100%) !important;
  border: 1.5px solid #FF6B00 !important;
  box-shadow:
    0 0 24px #FF6B00,
    0 0 48px rgba(255,199,0,0.7),
    inset 0 0 14px rgba(139,0,0,0.7) !important;
  animation: ma365ThemeLavaBoil 2s ease-in-out infinite !important;
}
[data-pin-theme="lava"] .ma365-runner-pin::after {
  content: "";
  position: absolute; inset: 8px;
  border-radius: 50%;
  background:
    radial-gradient(1px 1px at 30% 40%, #FFC700 50%, transparent 52%),
    radial-gradient(1.5px 1.5px at 70% 30%, #FF6B00 50%, transparent 52%),
    radial-gradient(1px 1px at 50% 70%, #FFC700 50%, transparent 52%),
    radial-gradient(2px 2px at 20% 60%, #FFEE00 50%, transparent 52%);
  animation: ma365ThemeLavaEmber 1.4s ease-in-out infinite;
  pointer-events: none;
  z-index: 1;
}
[data-pin-theme="lava"] .ma365-runner-pin .runner-emoji {
  filter: drop-shadow(0 0 6px #FFC700) drop-shadow(0 0 14px #FF6B00) saturate(1.3) !important;
}
@keyframes ma365ThemeLavaBoil {
  0%,100% { transform: scale(1); box-shadow: 0 0 24px #FF6B00, 0 0 48px rgba(255,199,0,0.7); }
  50%     { transform: scale(1.04); box-shadow: 0 0 36px #FFC700, 0 0 60px #FF6B00; }
}
@keyframes ma365ThemeLavaEmber {
  0%,100% { transform: translateY(0) scale(1); opacity: 0.9; }
  50%     { transform: translateY(-3px) scale(0.85); opacity: 1; }
}

/* ══════════════════════════════════════════════════════════
   CELESTIAL — Göttliche Gold-Strahlen, rotierender Halo
   ══════════════════════════════════════════════════════════ */
[data-pin-theme="celestial"] .ma365-runner-pin .runner-ring {
  background: radial-gradient(circle, #FFFFFF 0%, #FFE066 45%, #FFAC33 75%, transparent 100%) !important;
  border: 1.5px solid #FFE066 !important;
  box-shadow:
    0 0 30px #FFE066,
    0 0 60px rgba(255,255,255,0.8),
    inset 0 0 20px rgba(255,255,255,0.5) !important;
  animation: ma365ThemeCelestialHalo 3s ease-in-out infinite !important;
}
[data-pin-theme="celestial"] .ma365-runner-pin::before {
  /* 12 goldene Sonnenstrahlen rotieren */
  content: "";
  position: absolute; inset: -28px;
  background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><g fill='%23FFE066' opacity='0.85'><polygon points='100,0 105,45 95,45'/><polygon points='150,14 132,55 118,45'/><polygon points='186,50 148,75 140,63'/><polygon points='200,100 155,105 155,95'/><polygon points='186,150 140,137 148,125'/><polygon points='150,186 118,155 132,145'/><polygon points='100,200 95,155 105,155'/><polygon points='50,186 68,145 82,155'/><polygon points='14,150 52,125 60,137'/><polygon points='0,100 45,95 45,105'/><polygon points='14,50 60,63 52,75'/><polygon points='50,14 82,45 68,55'/></g></svg>") center/contain no-repeat;
  filter: drop-shadow(0 0 8px #FFE066) drop-shadow(0 0 16px #FFFFFF);
  animation: ma365ThemeCelestialSpin 14s linear infinite;
  pointer-events: none; z-index: -1;
}
[data-pin-theme="celestial"] .ma365-runner-pin::after {
  /* 8 weisse Mini-Sparkles gegen-rotierend */
  content: "";
  position: absolute; inset: -14px;
  background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><g fill='%23FFFFFF'><circle cx='50' cy='8' r='2'/><circle cx='80' cy='20' r='1.5'/><circle cx='92' cy='50' r='2'/><circle cx='80' cy='80' r='1.5'/><circle cx='50' cy='92' r='2'/><circle cx='20' cy='80' r='1.5'/><circle cx='8' cy='50' r='2'/><circle cx='20' cy='20' r='1.5'/></g></svg>") center/contain no-repeat;
  animation: ma365ThemeCelestialSpin 8s linear infinite reverse;
  pointer-events: none; z-index: -1;
}
[data-pin-theme="celestial"] .ma365-runner-pin .runner-emoji {
  filter: drop-shadow(0 0 10px #FFFFFF) drop-shadow(0 0 18px #FFE066) brightness(1.1) !important;
}
@keyframes ma365ThemeCelestialHalo {
  0%,100% { filter: brightness(1); }
  50%     { filter: brightness(1.15); }
}
@keyframes ma365ThemeCelestialSpin { to { transform: rotate(360deg); } }

/* ══════════════════════════════════════════════════════════
   TOXIC — Radioaktive grüne Blasen + tropfender Slime
   ══════════════════════════════════════════════════════════ */
[data-pin-theme="toxic"] .ma365-runner-pin .runner-ring {
  background: radial-gradient(circle, rgba(102,255,0,0.5), rgba(10,26,5,0.95)) !important;
  border: 2px solid #66FF00 !important;
  box-shadow:
    0 0 26px #66FF00,
    0 0 52px rgba(204,255,51,0.7),
    inset 0 0 18px rgba(102,255,0,0.5) !important;
  animation: ma365ThemeToxicPulse 1.6s ease-in-out infinite !important;
}
[data-pin-theme="toxic"] .ma365-runner-pin::before {
  /* Biohazard-Symbol rotierend hinter dem Pin */
  content: "";
  position: absolute; inset: -22px;
  background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><g fill='%2366FF00' opacity='0.55'><circle cx='50' cy='50' r='8'/><path d='M50 50 L25 18 A28 28 0 0 1 75 18 Z' opacity='0.7'/><path d='M50 50 L82 62 A28 28 0 0 1 52 92 Z' opacity='0.7'/><path d='M50 50 L18 62 A28 28 0 0 0 48 92 Z' opacity='0.7'/></g></svg>") center/contain no-repeat;
  filter: drop-shadow(0 0 10px #66FF00);
  animation: ma365ThemeToxicSpin 5s linear infinite;
  pointer-events: none; z-index: -1;
}
[data-pin-theme="toxic"] .ma365-runner-pin::after {
  /* Bubbles steigen auf */
  content: "";
  position: absolute; inset: 4px;
  border-radius: 50%;
  background:
    radial-gradient(3px 3px at 25% 35%, #CCFF33 50%, transparent 52%),
    radial-gradient(2px 2px at 70% 25%, #66FF00 50%, transparent 52%),
    radial-gradient(4px 4px at 50% 65%, #CCFF33 50%, transparent 52%),
    radial-gradient(2.5px 2.5px at 30% 75%, #66FF00 50%, transparent 52%),
    radial-gradient(2px 2px at 80% 60%, #CCFF33 50%, transparent 52%);
  animation: ma365ThemeToxicBubble 1.8s ease-in-out infinite;
  pointer-events: none;
  z-index: 1;
}
@keyframes ma365ThemeToxicSpin { to { transform: rotate(360deg); } }
[data-pin-theme="toxic"] .ma365-runner-pin .runner-emoji {
  filter: drop-shadow(0 0 8px #66FF00) drop-shadow(0 0 14px #CCFF33) !important;
}
@keyframes ma365ThemeToxicPulse {
  0%,100% { transform: scale(1); box-shadow: 0 0 26px #66FF00, 0 0 52px rgba(204,255,51,0.7); }
  50%     { transform: scale(1.03); box-shadow: 0 0 36px #CCFF33, 0 0 68px #66FF00; }
}
@keyframes ma365ThemeToxicBubble {
  0%,100% { transform: translateY(0); opacity: 0.9; }
  50%     { transform: translateY(-2px); opacity: 1; }
}

/* ══════════════════════════════════════════════════════════
   PRISMATIC — Kristall-Refraktion mit rotierendem Regenbogen
   ══════════════════════════════════════════════════════════ */
[data-pin-theme="prismatic"] .ma365-runner-pin .runner-ring {
  background: conic-gradient(from 0deg,
    #FF00FF, #FF0080, #FF4500, #FFC700, #66FF00, #00FFFF, #0080FF, #8B5CF6, #FF00FF) !important;
  box-shadow:
    0 0 28px rgba(255,0,255,0.8),
    0 0 56px rgba(0,255,255,0.7),
    inset 0 0 18px rgba(255,255,255,0.35) !important;
  animation: ma365ThemePrismSpin 6s linear infinite, ma365ThemePrismHue 4s ease-in-out infinite !important;
}
[data-pin-theme="prismatic"] .ma365-runner-pin::before {
  /* 8-Punkt-Kristall-Strahlen hinter dem Pin */
  content: "";
  position: absolute; inset: -24px;
  background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><g opacity='0.9'><polygon points='60,0 66,56 54,56' fill='%23FF00FF'/><polygon points='120,60 64,66 64,54' fill='%2300FFFF'/><polygon points='60,120 54,64 66,64' fill='%23FF00FF'/><polygon points='0,60 56,54 56,66' fill='%2300FFFF'/><polygon points='103,17 68,60 60,52' fill='%23FFC700' opacity='0.8'/><polygon points='103,103 60,68 68,60' fill='%2366FF00' opacity='0.8'/><polygon points='17,103 52,60 60,68' fill='%23FFC700' opacity='0.8'/><polygon points='17,17 60,52 52,60' fill='%2366FF00' opacity='0.8'/></g></svg>") center/contain no-repeat;
  filter: drop-shadow(0 0 10px rgba(255,0,255,0.7)) drop-shadow(0 0 18px rgba(0,255,255,0.5));
  animation: ma365ThemePrismSpin 8s linear infinite, ma365ThemePrismHue 4s ease-in-out infinite;
  pointer-events: none;
  z-index: -1;
}
[data-pin-theme="prismatic"] .ma365-runner-pin::after {
  /* Shine-Sweep auf Pin */
  content: "";
  position: absolute; inset: 6px;
  border-radius: 50%;
  background:
    linear-gradient(45deg,
      rgba(255,255,255,0) 30%,
      rgba(255,255,255,0.5) 50%,
      rgba(255,255,255,0) 70%);
  background-size: 200% 200%;
  animation: ma365ThemePrismShine 2.5s linear infinite;
  pointer-events: none;
  z-index: 1;
}
[data-pin-theme="prismatic"] .ma365-runner-pin .runner-emoji {
  filter: drop-shadow(0 0 6px #FF00FF) drop-shadow(0 0 14px #00FFFF) saturate(1.4) !important;
  animation: ma365ThemePrismHue 4s ease-in-out infinite !important;
}
@keyframes ma365ThemePrismSpin { to { transform: rotate(360deg); } }
@keyframes ma365ThemePrismHue {
  0%,100% { filter: hue-rotate(0deg) saturate(1.3); }
  50%     { filter: hue-rotate(180deg) saturate(1.6); }
}
@keyframes ma365ThemePrismShine {
  0% { background-position: -100% -100%; }
  100% { background-position: 200% 200%; }
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
