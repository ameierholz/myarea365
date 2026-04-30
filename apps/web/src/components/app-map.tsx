"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { createClient } from "@/lib/supabase/client";
import { UNLOCKABLE_MARKERS, RUNNER_LIGHTS } from "@/lib/game-config";
import type { ClaimedArea, SupplyDrop, GlitchZone, MapRunner } from "@/lib/game-config";

export type ShopPin = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  icon: string;        // emoji (☕, 🛍️, 🥗 …)
  color?: string;      // pin color
  deal_text?: string;  // z.B. "Gratis Cappuccino ab 3 km"
  address?: string;    // volle Adresse
  hours?: string;      // Öffnungszeiten
  phone?: string;
  spotlight?: boolean; // leuchtet/pulsiert
  arena?: boolean;     // hat aktive Arena (lila Glow)
  custom_pin_url?: string | null; // Shop-Custom-Logo als Marker-Bild
};

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
mapboxgl.accessToken = MAPBOX_TOKEN;

const FALLBACK = { lat: 52.6000, lng: 13.3565 };

// rAF-Throttle: koalesziert viele Aufrufe (z.B. Mapbox "zoom" mit ~60Hz während Pinch/Wheel)
// auf einen einzigen Aufruf pro Frame. Drastische Perf-Verbesserung bei vielen DOM-Markern.
function rafThrottle<F extends (...args: unknown[]) => void>(fn: F): F & { cancel(): void } {
  let scheduled = false;
  let lastArgs: unknown[] | null = null;
  const wrapped = ((...args: unknown[]) => {
    lastArgs = args;
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      const a = lastArgs;
      lastArgs = null;
      if (a) fn(...(a as Parameters<F>));
    });
  }) as F & { cancel(): void };
  wrapped.cancel = () => { scheduled = false; lastArgs = null; };
  return wrapped;
}

// Marker-Animationen EINMAL global im <head> injecten (verhindert Flickering bei Zoom)
if (typeof window !== "undefined" && !document.getElementById("mapbox-marker-animations")) {
  const style = document.createElement("style");
  style.id = "mapbox-marker-animations";
  style.textContent = `
    /* Mapbox-Logo dimmen — ToS-konform (bleibt sichtbar), aber weniger aufdringlich im dunklen Theme */
    .mapboxgl-ctrl-logo { opacity: 0.45; transform: scale(0.8); transform-origin: bottom left; transition: opacity 0.2s; }
    .mapboxgl-ctrl-logo:hover { opacity: 1; }
    .mapboxgl-ctrl-attrib.mapboxgl-compact { opacity: 0.55; }
    .mapboxgl-ctrl-attrib.mapboxgl-compact:hover { opacity: 1; }
    @keyframes selfPulse { 0%,100% { transform: scale(1); opacity: 0.95; } 50% { transform: scale(1.15); opacity: 0.5; } }
    @keyframes basePinShimmer { 0%,100% { transform: translate(-50%,-45%) scale(1); opacity: 0.7; } 50% { transform: translate(-50%,-45%) scale(1.15); opacity: 1; } }
    @keyframes basePinAuraSpin { to { transform: translate(-50%,-45%) rotate(360deg); } }
    @keyframes runnerRipple { 0% { transform: scale(1); opacity: 0.8; } 100% { transform: scale(1.8); opacity: 0; } }
    @keyframes runnerBob { from { transform: translateY(0); } to { transform: translateY(-3px); } }
    @keyframes dropPulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.4); opacity: 0.5; } }
    @keyframes shopSpotlight {
      0%,100% { box-shadow: 0 0 18px #FFD70088, 0 0 36px #FFD70044; transform: scale(1); }
      50%     { box-shadow: 0 0 30px #FFD700dd, 0 0 60px #FFD70088; transform: scale(1.08); }
    }
    @keyframes shopSpotlightHalo {
      0%,100% { transform: scale(1); opacity: 0.55; }
      50%     { transform: scale(1.45); opacity: 0; }
    }
    @keyframes shopSpotlightRing {
      0%,100% { transform: scale(0.9); opacity: 0.9; box-shadow: 0 0 30px #FFD700dd; }
      50%     { transform: scale(1.15); opacity: 0.5; box-shadow: 0 0 55px #FFD700ff; }
    }
    @keyframes shopSpotlightRays { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes shopSpotlightLabel {
      0%,100% { opacity: 0.9; transform: translateY(0); }
      50%     { opacity: 1;   transform: translateY(-2px); }
    }
    @keyframes shopBounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
    @keyframes spotlightBadgeShimmer {
      0%,100% { box-shadow: 0 4px 10px rgba(0,0,0,0.45), 0 0 12px rgba(255,215,0,0.55), inset 0 1px 0 rgba(255,255,255,0.6); filter: brightness(1); }
      50%     { box-shadow: 0 6px 18px rgba(0,0,0,0.55), 0 0 26px rgba(255,215,0,0.95), inset 0 1px 0 rgba(255,255,255,0.8); filter: brightness(1.12); }
    }
    @keyframes spotlightBadgeStar {
      0%,100% { transform: rotate(0deg) scale(1); filter: drop-shadow(0 0 2px rgba(255,255,255,0.8)); }
      50%     { transform: rotate(14deg) scale(1.15); filter: drop-shadow(0 0 4px rgba(255,255,255,1)); }
    }
    .ma365-spotlight-badge {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 4px 10px 4px 8px;
      background: linear-gradient(135deg, #FFE55C 0%, #FFD700 40%, #FF8A3C 100%);
      border-radius: 999px;
      border: 2px solid rgba(255,255,255,0.95);
      color: #0F1115; font-weight: 900; font-size: 11px; letter-spacing: 0.6px;
      white-space: nowrap;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
      text-shadow: 0 1px 0 rgba(255,255,255,0.35);
      animation: spotlightBadgeShimmer 2.2s ease-in-out infinite;
      pointer-events: none;
      will-change: transform, box-shadow;
    }
    .ma365-spotlight-badge > .star { font-size: 12px; animation: spotlightBadgeStar 2.2s ease-in-out infinite; display: inline-block; }
    /* Arena-Badge: magenta Pill analog zu Spotlight, mit Shield-Icon */
    @keyframes arenaBadgeShimmer {
      0%,100% { box-shadow: 0 4px 10px rgba(0,0,0,0.45), 0 0 12px rgba(255,45,120,0.55), inset 0 1px 0 rgba(255,255,255,0.5); filter: brightness(1); }
      50%     { box-shadow: 0 6px 18px rgba(0,0,0,0.55), 0 0 26px rgba(255,45,120,0.95), inset 0 1px 0 rgba(255,255,255,0.7); filter: brightness(1.15); }
    }
    @keyframes arenaBadgeShieldPulse {
      0%,100% { transform: scale(1)    rotate(0deg);  filter: drop-shadow(0 0 2px rgba(255,255,255,0.8)); }
      50%     { transform: scale(1.18) rotate(-6deg); filter: drop-shadow(0 0 5px rgba(255,255,255,1)); }
    }
    .ma365-arena-badge {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 4px 10px 4px 8px;
      background: linear-gradient(135deg, #FF6BA1 0%, #FF2D78 50%, #a855f7 100%);
      border-radius: 999px;
      border: 2px solid rgba(255,255,255,0.95);
      color: #FFF; font-weight: 900; font-size: 11px; letter-spacing: 0.6px;
      white-space: nowrap;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
      text-shadow: 0 1px 0 rgba(0,0,0,0.35);
      animation: arenaBadgeShimmer 2.2s ease-in-out infinite;
      pointer-events: none;
      will-change: box-shadow, filter;
    }
    .ma365-arena-badge > .shield { font-size: 12px; animation: arenaBadgeShieldPulse 2.2s ease-in-out infinite; display: inline-block; }
    /* Spotlight-Beam: Bat-Signal-Lichtstrahl von oben auf den Shop */
    @keyframes ma365BeamGlow {
      0%,100% { filter: blur(4px) brightness(0.85) saturate(1); }
      50%     { filter: blur(2.5px) brightness(1.35) saturate(1.2); }
    }
    .ma365-spotlight-beam {
      position: relative;
      width: 54px; height: 130px;
      pointer-events: none;
      transform-origin: center bottom;
      will-change: transform, opacity, filter;
      clip-path: polygon(42% 0%, 58% 0%, 100% 100%, 0% 100%);
      background: linear-gradient(to bottom,
        rgba(255, 215, 0, 0) 0%,
        rgba(255, 215, 0, 0.12) 20%,
        rgba(255, 180, 60, 0.35) 55%,
        rgba(255, 215, 0, 0.85) 100%);
      animation: ma365BeamGlow 2.6s ease-in-out infinite;
    }
    .ma365-spotlight-beam::after {
      content: ""; position: absolute; inset: 0;
      clip-path: polygon(46% 0%, 54% 0%, 72% 100%, 28% 100%);
      background: linear-gradient(to bottom,
        rgba(255, 255, 255, 0) 0%,
        rgba(255, 255, 255, 0.2) 60%,
        rgba(255, 255, 220, 0.7) 100%);
      filter: blur(1px);
    }
    /* ═══════════════════════════════════════════════════════
       Wave-Features: Boss, Sanctuary, Loot, Arena-Countdown, Reviews
       ═══════════════════════════════════════════════════════ */
    @keyframes ma365BossPulse {
      0%,100% { box-shadow: 0 0 20px rgba(255,45,120,0.55), 0 4px 12px rgba(0,0,0,0.4); filter: brightness(1); }
      50%     { box-shadow: 0 0 36px rgba(255,45,120,1),    0 6px 18px rgba(0,0,0,0.5); filter: brightness(1.12); }
    }
    .ma365-boss-marker {
      position: relative;
      display: flex; flex-direction: column; align-items: center;
      cursor: pointer;
    }
    .ma365-boss-circle {
      width: 56px; height: 56px;
      border-radius: 50%;
      background: radial-gradient(circle at 50% 40%, rgba(120,0,40,0.95) 0%, rgba(20,0,10,0.95) 100%);
      border: 2px solid rgba(255,45,120,0.85);
      animation: ma365BossPulse 1.8s ease-in-out infinite;
      display: flex; align-items: center; justify-content: center;
      color: #FFF;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
    }
    .ma365-boss-emoji { font-size: 30px; line-height: 1; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6)); }
    .ma365-boss-name { display: none; }
    .ma365-boss-hpbar {
      width: 48px;
      margin-top: 3px;
      height: 4px; background: rgba(0,0,0,0.7); border-radius: 3px; overflow: hidden;
      border: 1px solid rgba(255,255,255,0.18);
    }
    .ma365-boss-hpfill {
      height: 100%;
      background: linear-gradient(90deg, #FF2D78, #FFD700);
      transition: width 0.3s;
    }

    @keyframes ma365SanctuaryFloat {
      0%,100% { filter: brightness(1); }
      50%     { filter: brightness(1.15) drop-shadow(0 0 4px rgba(34,209,195,0.5)); }
    }
    .ma365-sanctuary-marker {
      display: flex; flex-direction: column; align-items: center; gap: 2px;
      animation: ma365SanctuaryFloat 2.8s ease-in-out infinite;
      transform-origin: center bottom;
    }
    .ma365-sanctuary-emoji {
      font-size: 28px; line-height: 1;
      filter: drop-shadow(0 2px 6px rgba(34,209,195,0.6)) drop-shadow(0 2px 4px rgba(0,0,0,0.4));
    }
    .ma365-sanctuary-marker.done .ma365-sanctuary-emoji { filter: drop-shadow(0 2px 6px rgba(74,222,128,0.6)); opacity: 0.6; }
    .ma365-sanctuary-xp {
      font-size: 9px; font-weight: 900;
      padding: 2px 6px; border-radius: 999px;
      background: linear-gradient(90deg, #22D1C3, #5ddaf0); color: #0F1115;
      border: 1.5px solid rgba(255,255,255,0.9);
      letter-spacing: 0.3px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif;
    }
    .ma365-sanctuary-check {
      font-size: 11px; font-weight: 900; color: #4ade80;
      background: rgba(15,17,21,0.85); border: 1.5px solid #4ade80;
      border-radius: 999px; padding: 1px 6px;
    }

    /* Wegelager (Strongholds) — kein Flackern, statischer Schatten */
    .ma365-stronghold-marker {
      display: flex; flex-direction: column; align-items: center; gap: 2px;
      transform-origin: center bottom;
      filter: drop-shadow(0 3px 6px rgba(0,0,0,0.55));
    }
    .ma365-stronghold-emoji { font-size: 60px; line-height: 1; }
    .ma365-stronghold-level {
      font-size: 12px; font-weight: 900;
      padding: 3px 9px; border-radius: 999px;
      background: linear-gradient(135deg, #FF2D78, #FF6B4A); color: #FFF;
      border: 1.5px solid rgba(255,255,255,0.95);
      box-shadow: 0 2px 6px rgba(255,45,120,0.4);
      letter-spacing: 0.4px;
    }
    .ma365-stronghold-hp {
      width: 56px; height: 5px; background: rgba(15,17,21,0.7);
      border-radius: 999px; overflow: hidden; margin-top: 2px;
      border: 1px solid rgba(255,255,255,0.4);
    }
    .ma365-stronghold-hp-fill {
      height: 100%; background: linear-gradient(90deg, #4ade80, #FFD700, #FF6B4A);
    }

    /* Resource-Nodes (Sammelpunkte: Schrottplatz/Fabrik/ATM/Datacenter) */
    .ma365-rnode-marker {
      display: flex; flex-direction: column; align-items: center; gap: 2px;
      transform-origin: center bottom;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
      cursor: pointer;
    }
    .ma365-rnode-icon {
      width: 38px; height: 38px;
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      font-size: 22px; line-height: 1;
      border: 2px solid rgba(255,255,255,0.85);
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    }
    .ma365-rnode-icon.kind-scrapyard  { background: linear-gradient(135deg, #6b7280, #374151); }
    .ma365-rnode-icon.kind-factory    { background: linear-gradient(135deg, #f59e0b, #b45309); }
    .ma365-rnode-icon.kind-atm        { background: linear-gradient(135deg, #FFD700, #FF8C00); }
    .ma365-rnode-icon.kind-datacenter { background: linear-gradient(135deg, #22D1C3, #0e7490); }
    .ma365-rnode-level {
      font-size: 10px; font-weight: 900;
      padding: 1px 6px; border-radius: 999px;
      background: rgba(15,17,21,0.85); color: #FFD700;
      border: 1px solid rgba(255,215,0,0.6);
      letter-spacing: 0.3px;
      margin-top: 2px;
    }

    @keyframes ma365GatherPulse {
      0%, 100% { transform: translateX(-50%) scale(1);   opacity: 0.95; }
      50%      { transform: translateX(-50%) scale(1.1); opacity: 1; }
    }
    @keyframes ma365CrateBob {
      0%,100% { transform: translateY(0) rotate(-5deg); }
      50%     { transform: translateY(-5px) rotate(5deg); }
    }
    @keyframes ma365CrateGlow {
      0%,100% { filter: drop-shadow(0 0 6px var(--color)) drop-shadow(0 4px 6px rgba(0,0,0,0.5)); }
      50%     { filter: drop-shadow(0 0 14px var(--color)) drop-shadow(0 6px 10px rgba(0,0,0,0.6)); }
    }
    @keyframes ma365CrateReady {
      0%,100% { transform: translateY(-2px) scale(1); filter: drop-shadow(0 0 14px var(--color)) drop-shadow(0 0 28px var(--color)); }
      50%     { transform: translateY(-6px) scale(1.08); filter: drop-shadow(0 0 22px var(--color)) drop-shadow(0 0 44px var(--color)); }
    }
    @keyframes ma365CrateRing {
      0%   { transform: scale(0.4); opacity: 0.85; }
      100% { transform: scale(2); opacity: 0; }
    }
    @keyframes ma365CratePickup {
      0%   { transform: translateY(0) scale(1); opacity: 1; }
      40%  { transform: translateY(-40px) scale(1.4); opacity: 1; }
      100% { transform: translateY(-80px) scale(0.2); opacity: 0; }
    }
    .ma365-loot-wrap {
      position: relative;
      width: 64px; height: 64px;
      display: flex; align-items: center; justify-content: center;
      pointer-events: auto;
      cursor: pointer;
      transform: scale(var(--loot-scale, 1));
      transform-origin: center center;
      transition: transform 0.2s;
    }
    .ma365-loot-wrap.ready .ma365-loot-crate {
      animation: ma365CrateReady 0.9s ease-in-out infinite;
    }
    .ma365-loot-wrap.ready .ma365-loot-proximity {
      display: block;
    }
    .ma365-loot-wrap.picking-up .ma365-loot-crate {
      animation: ma365CratePickup 0.6s ease-out forwards;
    }
    /* Kiste: Emoji mit 3D-Schatten + Glow */
    .ma365-loot-crate {
      font-size: 38px;
      line-height: 1;
      animation: ma365CrateBob 1.6s ease-in-out infinite, ma365CrateGlow 2s ease-in-out infinite;
      filter: drop-shadow(0 0 6px var(--color)) drop-shadow(0 4px 6px rgba(0,0,0,0.5));
    }
    /* Proximity-Ring: wird sichtbar wenn User in Reichweite (20m) */
    .ma365-loot-proximity {
      position: absolute;
      inset: 8px;
      border-radius: 50%;
      border: 2px solid var(--color);
      animation: ma365CrateRing 1.2s ease-out infinite;
      display: none;
      pointer-events: none;
    }
    .ma365-loot-proximity.two {
      animation-delay: 0.6s;
    }

    /* Floating Countdown: minimalistisch, kein Rahmen, sanfter Gold-Glow */
    @keyframes ma365CountdownFloat {
      0%,100% { transform: translateY(0) scale(var(--s, 1)); }
      50%     { transform: translateY(-2px) scale(calc(var(--s, 1) * 1.03)); }
    }
    @keyframes ma365CountdownBlink {
      0%,55%,100% { opacity: 1; }
      60%,75%     { opacity: 0.35; }
    }
    .ma365-countdown-wrap {
      position: relative;
      display: inline-flex;
      align-items: baseline;
      gap: 5px;
      transform-origin: center bottom;
      will-change: transform;
      animation: ma365CountdownFloat 3s ease-in-out infinite;
      color: #FFF;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif;
      font-weight: 900;
      text-shadow:
        0 0 1px rgba(0,0,0,0.9),
        0 1px 2px rgba(0,0,0,0.85),
        0 0 8px rgba(255,215,0,0.35);
      white-space: nowrap;
    }
    .ma365-countdown-wrap .icon {
      font-size: 13px;
      filter: drop-shadow(0 1px 2px rgba(0,0,0,0.9));
    }
    .ma365-countdown-wrap .value {
      font-size: 13px;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.3px;
    }
    .ma365-countdown-wrap .sep {
      color: #FFD700;
      animation: ma365CountdownBlink 1s linear infinite;
      margin: 0 1px;
    }

    .ma365-review-chip {
      display: inline-flex; align-items: center; gap: 3px;
      padding: 1px 6px; border-radius: 999px;
      background: rgba(15,17,21,0.85);
      border: 1px solid rgba(255,215,0,0.5);
      color: #FFD700; font-size: 9px; font-weight: 900;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      white-space: nowrap;
    }
    .ma365-review-stars { color: #FFD700; font-size: 8px; letter-spacing: 0.5px; }
    .ma365-review-count { color: #8B8FA3; font-size: 8px; }

    /* ═══════════════════════════════════════════════════════
       Runner-Nameplate — Game-UI Style (clean, hell, glow)
       ═══════════════════════════════════════════════════════ */
    .ma365-runner-badge {
      all: unset;
      position: absolute;
      top: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%);
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      background: linear-gradient(180deg,
        rgba(30,35,50,0.96) 0%,
        rgba(15,17,21,0.98) 100%);
      border: 1px solid var(--badge-color, #22D1C3);
      border-radius: 5px;
      color: #FFF;
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 0.3px;
      white-space: nowrap;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
      text-shadow: 0 1px 2px rgba(0,0,0,0.95);
      box-shadow:
        0 4px 14px rgba(0,0,0,0.7),
        0 0 18px color-mix(in srgb, var(--badge-color, #22D1C3) 55%, transparent),
        inset 0 1px 0 rgba(255,255,255,0.14);
      pointer-events: auto;
      cursor: pointer;
      z-index: 9999;
      transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
      animation: ma365BadgeFloat 3.2s ease-in-out infinite;
    }
    /* Diagonaler Shine-Sweep */
    .ma365-runner-badge::before {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background: linear-gradient(115deg,
        transparent 0%,
        transparent 40%,
        rgba(255,255,255,0.14) 50%,
        transparent 60%,
        transparent 100%);
      background-size: 250% 100%;
      animation: ma365BadgeShine 3.5s linear infinite;
      pointer-events: none;
    }
    /* Chevron nach oben zum Pin (Crew-Color) */
    .ma365-runner-badge::after {
      content: "";
      position: absolute;
      top: -4px;
      left: 50%;
      transform: translateX(-50%) rotate(45deg);
      width: 6px;
      height: 6px;
      background: linear-gradient(135deg, rgba(30,35,50,0.98), rgba(15,17,21,0.98));
      border-left: 1.5px solid var(--badge-color, #22D1C3);
      border-top: 1.5px solid var(--badge-color, #22D1C3);
      pointer-events: none;
    }
    .ma365-runner-badge:hover {
      transform: translateX(-50%) scale(1.07);
      filter: brightness(1.15);
      box-shadow:
        0 6px 20px rgba(0,0,0,0.8),
        0 0 26px color-mix(in srgb, var(--badge-color, #22D1C3) 80%, transparent),
        inset 0 1px 0 rgba(255,255,255,0.22);
    }
    .ma365-runner-badge:active {
      transform: translateX(-50%) scale(0.96);
    }
    .ma365-runner-badge-dot {
      display: inline-block;
      width: 5px; height: 5px;
      border-radius: 50%;
      box-shadow: 0 0 5px currentColor;
      flex-shrink: 0;
    }
    .ma365-runner-badge-at {
      color: var(--badge-color, #22D1C3);
      font-weight: 900;
    }
    .ma365-runner-badge-name {
      color: #FFF;
    }
    @keyframes ma365BadgeFloat {
      0%, 100% { transform: translateX(-50%) translateY(0); }
      50%      { transform: translateX(-50%) translateY(-2px); }
    }
    @keyframes ma365BadgeShine {
      0%   { background-position: 200% 0; }
      100% { background-position: -100% 0; }
    }
  `;
  document.head.appendChild(style);
}

// Eigener MyArea365-Style (Fork von Mapbox Standard mit unseren Brand-Farben)
const MAPBOX_STYLE = "mapbox://styles/mapbox/standard";
const MAP_STYLES: Record<string, string> = {
  standard: "mapbox://styles/mapbox/standard",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
  neon: "mapbox://styles/mapbox/navigation-night-v1",
  minimal: "mapbox://styles/mapbox/light-v11",
  map_cyberpunk: "mapbox://styles/mapbox/navigation-night-v1",
  map_retro: "mapbox://styles/mapbox/outdoors-v12",
};

// LightPreset automatisch basierend auf Tageszeit
function getCurrentLightPreset(): "dawn" | "day" | "dusk" | "night" {
  const h = new Date().getHours();
  if (h >= 5 && h < 8)   return "dawn";
  if (h >= 8 && h < 18)  return "day";
  if (h >= 18 && h < 21) return "dusk";
  return "night";
}

interface AppMapProps {
  onLocationUpdate?: (lng: number, lat: number) => void;
  trackingActive?: boolean;
  teamColor?: string;
  username?: string;
  markerId?: string;
  markerVariant?: "neutral" | "male" | "female";
  lightId?: string;
  activeRoute?: Array<{ lat: number; lng: number }>;
  savedTerritories?: Array<Array<{ lat: number; lng: number }>>;
  claimedAreas?: ClaimedArea[];
  supplyDrops?: SupplyDrop[];
  glitchZones?: GlitchZone[];
  crewMembers?: MapRunner[];
  shops?: ShopPin[];
  onAreaClick?: (areaId: string) => void;
  onDropClick?: (dropId: string) => void;
  onShopClick?: (shopId: string) => void;
  overviewMode?: boolean;
  recenterAt?: number;
  lightPreset?: "dawn" | "day" | "dusk" | "night" | "auto";
  supporterTier?: "bronze" | "silver" | "gold" | null;
  equippedTrail?: string | null;
  auraActive?: boolean;
  mapTheme?: string | null;
  pinTheme?: import("@/lib/pin-themes").PinTheme | null;
  crewColor?: string | null;
  crewName?: string | null;
  displayName?: string | null;
  // 3-Ebenen-Modell (Abschnitt/Zug/Gebiet) aus DB
  walkedSegments?: Array<{ id: string; geom: Array<{ lat: number; lng: number }>; is_mine: boolean; is_crew: boolean }>;
  claimedStreets?: Array<{ id: string; geoms: Array<Array<{ lat: number; lng: number }>>; is_mine: boolean; is_crew: boolean; intensity?: number }>;
  ownedTerritories?: Array<{ id: string; polygon: Array<{ lat: number; lng: number }>; is_mine: boolean; is_crew: boolean; status: string; intensity?: number }>;
  /** In-App-Routing: GeoJSON-LineString der aktuellen Route (User → Shop). */
  routeGeometry?: { type: "LineString"; coordinates: [number, number][] } | null;
  onOwnershipClick?: (kind: "segment" | "street" | "territory", id: string) => void;
  // ── Map-Features Wave ────────────────────────────────────
  powerZones?: Array<{ id: string; name: string; kind: string; center_lat: number; center_lng: number; radius_m: number; color: string; buff_hp: number; buff_atk: number; buff_def: number; buff_spd: number }>;
  bossRaids?: Array<{ id: string; name: string; emoji: string; lat: number; lng: number; max_hp: number; current_hp: number }>;
  sanctuaries?: Array<{ id: string; name: string; lat: number; lng: number; emoji: string; xp_reward: number; trained_today?: boolean }>;
  flashPushes?: Array<{ id: string; business_id: string; business_lat: number; business_lng: number; radius_m: number; expires_at: string }>;
  shopTrail?: Array<{ business_id: string; name: string; lat: number; lng: number }>;
  shadowRoute?: { id: string; runner_color: string; geom: Array<{ lat: number; lng: number }> } | null;
  shopReviews?: Array<{ business_id: string; avg_rating: number; review_count: number }>;
  lootDrops?: Array<{ id: string; lat: number; lng: number; rarity: string; kind: string; expires_at?: number }>;
  arenaCountdowns?: Array<{ business_id: string; business_lat: number; business_lng: number; starts_at: string }>;
  onBossClick?: (raidId: string) => void;
  onSanctuaryClick?: (sanctuaryId: string) => void;
  onPowerZoneClick?: (zoneId: string) => void;
  strongholds?: Array<{ id: string; lat: number; lng: number; level: number; total_hp: number; current_hp: number; hp_pct: number }>;
  onStrongholdClick?: (strongholdId: string, screenX: number, screenY: number) => void;
  strongholdArt?: Record<string, { image_url: string | null; video_url: string | null }>;
  resourceNodes?: Array<{ id: number; kind: "scrapyard" | "factory" | "atm" | "datacenter"; resource_type: "wood" | "stone" | "gold" | "mana"; name: string | null; lat: number; lng: number; level: number; total_yield: number; current_yield: number; gather_count?: number; gather_active?: boolean; gather_someone_gathering?: boolean; gather_finish_at?: string | null; gather_mine?: boolean; gather_username?: string | null; gather_crew_tag?: string | null }>;
  onResourceNodeClick?: (nodeId: number, screenX: number, screenY: number) => void;
  onViewportChange?: (bbox: { minLng: number; minLat: number; maxLng: number; maxLat: number; zoom: number }) => void;
  gatherMarches?: Array<{
    id: number;
    status: "marching" | "gathering" | "returning";
    origin_lat: number | null; origin_lng: number | null;
    started_at: string; arrives_at: string; finishes_at: string; returns_at: string;
    owner_name?: string | null; owner_crew_tag?: string | null;
    node: { lat: number; lng: number; kind: "scrapyard" | "factory" | "atm" | "datacenter" } | null;
  }>;
  onLootClick?: (dropId: string) => void;
  // ── Base-Pins (Runner + Crew) ──
  basePins?: Array<{
    kind: "runner" | "crew";
    id: string;
    lat: number;
    lng: number;
    level: number;
    pin_emoji: string;
    pin_color: string;
    pin_label: string;
    owner_username?: string | null;
    crew_tag?: string | null;
    is_own: boolean;
    theme_id?: string;
    /** Rarity des aktiven Themes — steuert Aura/Schimmer-Layer (advanced/epic/legendary) */
    theme_rarity?: "advanced" | "epic" | "legendary";
    /** Optional: equippiertes Nameplate-Artwork (nur für eigene Bases relevant) */
    nameplate_art?: { image_url: string | null; video_url: string | null } | null;
  }>;
  onBasePinTap?: (pin: { kind: "runner" | "crew"; id: string; is_own: boolean }, screenX: number, screenY: number) => void;
  baseThemeArt?: Record<string, { image_url: string | null; video_url: string | null }>;
  /** UI-Icon-Artwork (cosmetic_artwork kind=ui_icon) für Repeater-Pins etc. */
  uiIconArt?: Record<string, { image_url: string | null; video_url: string | null }>;
  /** Wenn aktiv, fängt der nächste Map-Klick die Lat/Lng ab statt normaler Click-Logik. */
  placeBaseMode?: null | "runner" | "crew";
  onPlaceBaseClick?: (lng: number, lat: number, kind: "runner" | "crew") => void;
  // ── Crew-Turf (Funkmasten/Repeater + Crew-Gebiete) ──
  crewRepeaters?: Array<{
    id: string;
    crew_id: string;
    crew_name: string | null;
    crew_tag: string | null;
    kind: "hq" | "repeater" | "mega";
    label: string | null;
    lat: number;
    lng: number;
    hp: number;
    max_hp: number;
    is_own: boolean;
  }>;
  crewTurfPolygons?: Array<{
    crew_id: string;
    crew_name: string | null;
    crew_tag: string | null;
    is_own: boolean;
    territory_color?: string | null;
    geojson: GeoJSON.Geometry;
  }>;
  /** Phase-3 Block-Turf: pro kontrolliertem Stadt-Block ein Feature.
   *  Wenn vorhanden, ersetzt die Kreis-Polygone visuell (city_blocks-Daten existieren).
   *  Wenn leer, fällt die Karte auf crewTurfPolygons (Kreise) zurück. */
  crewBlocks?: Array<{
    block_id?: number;  // ab 00155 weg (Union pro Crew → kein einzelner Block mehr)
    crew_id: string;
    crew_name: string | null;
    is_own: boolean;
    is_contested: boolean;
    territory_color: string;
    geojson: GeoJSON.Geometry;
  }>;
  /** Phase 4 Crew-Bauwerke (Schwarzmarkt, Bunker, Kiez-Treffpunkt, Tunnel) als DOM-Marker */
  crewBuildings?: Array<{
    id: string;
    kind: "blackmarket" | "bunker" | "hangout" | "tunnel";
    label: string | null;
    lat: number;
    lng: number;
    hp: number;
    max_hp: number;
    is_own: boolean;
    territory_color: string;
  }>;
  onRepeaterClick?: (repeaterId: string, screenX: number, screenY: number) => void;
  onMapLongPress?: (lng: number, lat: number) => void;
  /** Wenn aktiv: zeichnet Coverage-Preview auf der Karte.
   *  - Wenn allBlocks gesetzt (Phase 3): zeichnet Block-Polygone als Layer,
   *    highlightet den Block am Cursor in Crew-Farbe (Straßen als Grenzen).
   *  - Sonst (Fallback): Cyan-Kreis am Cursor + dashed Ghosts der eigenen Repeater. */
  placementPreview?: {
    kind: "hq" | "repeater" | "mega";
    color: string;             // Crew-Farbe für Cursor-Highlight
    ownRepeaters: Array<{ lat: number; lng: number; radius_m: number }>;
    cursor: { lat: number; lng: number } | null;
    newRadius_m: number;
    allBlocks?: Array<{ block_id: number; geojson: GeoJSON.Geometry; street_class?: string | null }>;
    blockClaimCount?: number;  // wieviele Blocks der Repeater-Typ claimt (HQ 9, Mega 4, Std 1)
  } | null;
  onPlacementHover?: (lng: number, lat: number) => void;
  /** Click im Placement-Mode = Platzierung bestätigen (statt 600ms Long-Press warten) */
  onPlacementConfirm?: (lng: number, lat: number) => void;
}

// Helper: Point-in-Polygon (Ray-Casting). Akzeptiert GeoJSON Polygon oder MultiPolygon.
function pointInGeoJSONPolygon(lat: number, lng: number, geom: GeoJSON.Geometry): boolean {
  const x = lng, y = lat;
  const ringContains = (ring: number[][]): boolean => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1];
      const xj = ring[j][0], yj = ring[j][1];
      const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };
  if (geom.type === "Polygon") {
    if (!ringContains(geom.coordinates[0])) return false;
    for (let i = 1; i < geom.coordinates.length; i++) {
      if (ringContains(geom.coordinates[i])) return false;  // im Loch
    }
    return true;
  }
  if (geom.type === "MultiPolygon") {
    return geom.coordinates.some((poly) => {
      if (!ringContains(poly[0])) return false;
      for (let i = 1; i < poly.length; i++) if (ringContains(poly[i])) return false;
      return true;
    });
  }
  return false;
}

// Helper: escape user-provided text for innerHTML usage.
function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

// Helper: Zoom-responsive line-width.
// Linien haben FIXE Screen-Pixel-Breite -> beim Rauszoomen werden Strassen-
// Features kleiner, aber Linie bleibt gleich breit -> wirkt relativ dicker.
// Fix: multiplikativer Zoom-Faktor (klein bei weitem Rauszoomen).
function zoomWidth(base: number): mapboxgl.ExpressionSpecification {
  return [
    "interpolate", ["exponential", 1.6], ["zoom"],
    10, base * 0.18,
    13, base * 0.40,
    16, base * 0.75,
    19, base * 1.25,
  ];
}

// Helper: Polygon als GeoJSON-Feature (geschlossener Ring)
function polygonFeature(area: ClaimedArea) {
  const ring = [...area.polygon.map((p) => [p.lng, p.lat]), [area.polygon[0].lng, area.polygon[0].lat]];
  return {
    type: "Feature" as const,
    geometry: { type: "Polygon" as const, coordinates: [ring] },
    properties: {
      id: area.id,
      color: area.owner_color,
      fillOpacity: area.owner_type === "me" || area.owner_type === "crew" ? 0.12 : 0.07,
      strokeWeight: area.level === 3 ? 3.5 : area.level === 2 ? 3 : 2.5,
    },
  };
}

// Eigenes Marker-DOM (Emoji mit Glow)
function buildSelfMarkerEl(
  emoji: string, color: string, isRunning: boolean,
  supporterTier?: "bronze" | "silver" | "gold" | null,
  auraActive = false,
  crewColor?: string | null, crewName?: string | null,
  displayName?: string | null,
  markerArt?: { image_url: string | null; video_url: string | null } | null,
): HTMLDivElement {
  const size = isRunning ? 52 : 44;
  const glow = isRunning ? 30 : 18;
  const el = document.createElement("div");
  // Klasse NICHT auf el — sonst kleben Theme-Pseudoelemente (::before/::after) am
  // OUTER-el und skalieren nicht mit dem Zoom-Wrap. wrapForZoomScale verschiebt
  // die Klasse auf den inner-Wrap (siehe dort).
  el.dataset.runnerPinHost = "1";
  el.style.cssText = `position:relative;display:flex;align-items:center;justify-content:center;width:${size + 20}px;height:${size + 20}px;pointer-events:none`;
  const tierCfg = supporterTier === "gold"
    ? { bg: "linear-gradient(135deg,#FFD700,#B8860B)", border: "#FFD700", icon: "★", shadow: "0 0 10px #FFD700cc" }
    : supporterTier === "silver"
      ? { bg: "linear-gradient(135deg,#E0E0E0,#9A9A9A)", border: "#C0C0C0", icon: "★", shadow: "0 0 8px #C0C0C0cc" }
      : supporterTier === "bronze"
        ? { bg: "linear-gradient(135deg,#CD7F32,#A0522D)", border: "#CD7F32", icon: "★", shadow: "0 0 8px #CD7F32cc" }
        : null;
  // Chip sitzt oben-rechts klar AUSSERHALB des Kreises
  const supporterChip = tierCfg
    ? `<div style="position:absolute;top:-10px;right:-10px;width:20px;height:20px;border-radius:50%;background:${tierCfg.bg};border:2px solid ${tierCfg.border};display:flex;align-items:center;justify-content:center;font-size:11px;color:#0F1115;font-weight:900;box-shadow:${tierCfg.shadow};z-index:3">${tierCfg.icon}</div>`
    : "";
  // Name-Badge (frosted glass, crew-color border glow, Speech-Bubble-Pfeil, klickbar)
  const cleanName = (displayName ?? "").trim();
  const badgeColor = crewColor ?? "#22D1C3";
  const nameLabel = cleanName
    ? `<div class="ma365-runner-badge" data-action="open-runner-profile"
            title="${crewName ? "Crew: " + crewName + " · Klick öffnet dein Runner-Profil" : "Klick öffnet dein Runner-Profil"}"
            style="--badge-color:${badgeColor}"
            onclick="event.preventDefault();event.stopPropagation();window.dispatchEvent(new CustomEvent('ma365:open-runner-profile'));"
            onmousedown="event.stopPropagation();"
            ontouchstart="event.stopPropagation();"
       >
        ${crewColor ? `<span class="ma365-runner-badge-dot" style="background:${crewColor}"></span>` : ""}
        <span class="ma365-runner-badge-at">@</span><span class="ma365-runner-badge-name">${cleanName}</span>
       </div>`
    : "";
  const auraLayer = auraActive
    ? `<div style="position:absolute;width:${size + 28}px;height:${size + 28}px;border-radius:50%;background:conic-gradient(from 0deg,#FFD700 0deg,#22D1C3 120deg,#FF2D78 240deg,#FFD700 360deg);opacity:0.35;filter:blur(6px);animation:auraSpin 4s linear infinite"></div>
       <div style="position:absolute;width:${size + 14}px;height:${size + 14}px;border-radius:50%;border:2px solid #FFD700aa;box-shadow:0 0 20px #FFD700cc;animation:auraPulse 2s ease-in-out infinite"></div>`
    : "";
  el.innerHTML = `
    ${auraLayer}
    <div class="runner-ring" style="position:absolute;width:${size}px;height:${size}px;border-radius:50%;background:${color}25;box-shadow:0 0 ${glow}px ${color}cc;${isRunning ? "animation:selfPulse 1.5s ease-in-out infinite" : ""}"></div>
    ${markerArt?.video_url
      ? `<video class="runner-emoji" src="${markerArt.video_url}" autoplay loop muted playsinline style="position:relative;width:${isRunning ? 56 : 48}px;height:${isRunning ? 56 : 48}px;object-fit:contain;filter:drop-shadow(0 2px 8px rgba(0,0,0,0.6)) drop-shadow(0 0 12px ${color}aa)"></video>`
      : markerArt?.image_url
        ? `<img class="runner-emoji" src="${markerArt.image_url}" alt="" style="position:relative;width:${isRunning ? 56 : 48}px;height:${isRunning ? 56 : 48}px;object-fit:contain;filter:drop-shadow(0 2px 8px rgba(0,0,0,0.6)) drop-shadow(0 0 12px ${color}aa)" />`
        : `<span class="runner-emoji" style="position:relative;font-size:${isRunning ? 40 : 34}px;filter:drop-shadow(0 2px 8px rgba(0,0,0,0.6)) drop-shadow(0 0 12px ${color}aa)">${emoji}</span>`
    }
    ${supporterChip}
    ${nameLabel}
    <style>
      @keyframes selfPulse{0%,100%{transform:scale(1);opacity:0.95}50%{transform:scale(1.15);opacity:0.5}}
      @keyframes auraSpin{to{transform:rotate(360deg)}}
      @keyframes auraPulse{0%,100%{transform:scale(1);opacity:0.9}50%{transform:scale(1.1);opacity:0.5}}
    </style>
  `;
  // Click-Handler direkt an der Node. Mapbox ruft auf Marker-mousedown teils
  // preventDefault auf, was das folgende `click`-Event unterdruecken kann.
  // Deshalb feuern wir bereits auf pointerdown/mouseup — nicht nur auf click.
  const badgeEl = el.querySelector(".ma365-runner-badge") as HTMLElement | null;
  if (badgeEl) {
    let fired = false;
    const fire = (ev: Event) => {
      ev.preventDefault();
      ev.stopPropagation();
      (ev as Event).stopImmediatePropagation?.();
      if (fired) return;
      fired = true;
      setTimeout(() => { fired = false; }, 500);
      window.dispatchEvent(new CustomEvent("ma365:open-runner-profile"));
    };
    badgeEl.addEventListener("pointerdown", fire);
    badgeEl.addEventListener("mouseup", fire);
    badgeEl.addEventListener("click", fire);
    badgeEl.addEventListener("touchend", fire, { passive: false });
  }
  return el;
}

function buildRunnerMarkerEl(r: MapRunner): HTMLDivElement {
  const isCrew = r.is_crew_member;
  const size = isCrew ? 52 : 42;
  const iconSize = isCrew ? 30 : 24;
  const el = document.createElement("div");
  el.style.cssText = `position:relative;display:flex;align-items:center;justify-content:center;width:${size + 12}px;height:${size + 12}px`;

  const crewRing = isCrew
    ? `<div style="position:absolute;width:${size - 2}px;height:${size - 2}px;border-radius:50%;border:2.5px solid ${r.color};box-shadow:0 0 14px ${r.color}aa, inset 0 0 8px ${r.color}44"></div>`
    : "";
  const crewStar = isCrew
    ? `<div style="position:absolute;top:-5px;right:-5px;width:19px;height:19px;border-radius:50%;background:${r.color};border:1.5px solid #0F1115;display:flex;align-items:center;justify-content:center;font-size:10px;color:#0F1115;box-shadow:0 0 8px ${r.color};z-index:2">★</div>`
    : "";
  const walkRipple = r.is_walking
    ? `<div style="position:absolute;width:${size}px;height:${size}px;border-radius:50%;border:2px solid ${r.color}cc;animation:runnerRipple 1.6s ease-out infinite"></div>`
    : "";
  const walkBadge = r.is_walking
    ? `<div style="position:absolute;bottom:-6px;right:-6px;width:22px;height:22px;border-radius:50%;background:#0F1115;border:1.5px solid #4ade80;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 0 10px #4ade80aa;animation:runnerBob 0.6s ease-in-out infinite alternate;z-index:2">🏃</div>`
    : "";

  el.innerHTML = `
    ${walkRipple}
    ${crewRing}
    <div style="position:absolute;width:${size}px;height:${size}px;border-radius:50%;background:radial-gradient(circle at 30% 30%, ${r.color}55, ${r.color}22);border:1px solid ${r.color}88;box-shadow:0 0 12px ${r.color}88, inset 0 0 10px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center">
      <span style="font-size:${iconSize}px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5)) drop-shadow(0 0 6px ${r.color}88)">${r.marker_icon}</span>
    </div>
    ${crewStar}
    ${walkBadge}
    <style>
      @keyframes runnerRipple{0%{transform:scale(1);opacity:0.8}100%{transform:scale(1.8);opacity:0}}
      @keyframes runnerBob{from{transform:translateY(0)}to{transform:translateY(-3px)}}
    </style>
  `;
  return el;
}

function buildDropMarkerEl(drop: SupplyDrop): HTMLDivElement {
  const rarityColor: Record<string, string> = {
    common: "#9ba8c7", rare: "#5ddaf0", epic: "#a855f7", legendary: "#FFD700",
  };
  const color = rarityColor[drop.rarity] || "#5ddaf0";
  const el = document.createElement("div");
  el.style.cssText = "position:relative;display:flex;align-items:center;justify-content:center;width:56px;height:56px;cursor:pointer";
  el.innerHTML = `
    <div style="position:absolute;width:52px;height:52px;border-radius:50%;background:${color}25;box-shadow:0 0 22px ${color}cc;animation:dropPulse 1.6s ease-in-out infinite"></div>
    <div style="position:absolute;width:38px;height:38px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 12px rgba(255,255,255,0.4)">
      <span style="font-size:22px;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5))">🎁</span>
    </div>
    <style>@keyframes dropPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.4);opacity:0.5}}</style>
  `;
  return el;
}

/**
 * Wraps existing marker content in an inner element with [data-zoom-scale]
 * so transform:scale can be applied without overwriting Mapbox's translate.
 * Idempotent — no-op if already wrapped.
 */
function wrapForZoomScale(el: HTMLElement): void {
  if (el.querySelector(':scope > [data-zoom-scale="1"]')) return;
  if (!el.style.position) el.style.position = "relative";
  const inner = document.createElement("div");
  inner.dataset.zoomScale = "1";
  // position:absolute + inset:0 → wrap überdeckt el exakt. Alle absolute-Kinder
  // im wrap nehmen den wrap als Containing Block und skalieren mit.
  inner.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;transform-origin:center center;will-change:transform;backface-visibility:hidden;-webkit-font-smoothing:subpixel-antialiased";
  // Falls das host-el ein Runner-Pin ist: Klasse auf den Wrap verschieben, damit
  // theme-spezifische ::before/::after Pseudoelemente im Scale-Container hängen.
  if (el.dataset.runnerPinHost === "1") {
    inner.classList.add("ma365-runner-pin");
  }
  while (el.firstChild) inner.appendChild(el.firstChild);
  el.appendChild(inner);
}


export function AppMap({
  onLocationUpdate,
  trackingActive,
  teamColor = "#5ddaf0",
  markerId = "foot",
  markerVariant = "neutral",
  lightId = "classic",
  activeRoute = [],
  savedTerritories = [],
  claimedAreas = [],
  supplyDrops = [],
  glitchZones = [],
  crewMembers = [],
  shops = [],
  onAreaClick,
  onDropClick,
  onShopClick,
  overviewMode = false,
  recenterAt,
  lightPreset = "auto",
  supporterTier = null,
  equippedTrail = null,
  auraActive = false,
  mapTheme = null,
  pinTheme = "default",
  crewColor = null,
  crewName = null,
  displayName = null,
  walkedSegments = [],
  claimedStreets = [],
  ownedTerritories = [],
  onOwnershipClick,
  powerZones = [],
  bossRaids = [],
  sanctuaries = [],
  flashPushes = [],
  shopTrail = [],
  shadowRoute = null,
  shopReviews = [],
  lootDrops = [],
  arenaCountdowns = [],
  onBossClick,
  onSanctuaryClick,
  strongholds = [],
  onStrongholdClick,
  strongholdArt = {},
  resourceNodes = [],
  onResourceNodeClick,
  onViewportChange,
  gatherMarches = [],
  onPowerZoneClick,
  onLootClick,
  routeGeometry = null,
  basePins = [],
  onBasePinTap,
  baseThemeArt = {},
  uiIconArt = {},
  placeBaseMode = null,
  onPlaceBaseClick,
  crewRepeaters = [],
  crewTurfPolygons = [],
  crewBlocks = [],
  crewBuildings = [],
  placementPreview = null,
  onPlacementHover,
  onPlacementConfirm,
  onRepeaterClick,
  onMapLongPress,
}: AppMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Viewport-Bounds (mit Buffer) — gefilterte Marker-Listen verwenden das,
  // damit nur sichtbare Marker als DOM-Elemente erzeugt werden.
  // Update auf moveend (nach Pan/Zoom-Ende), nicht pro Frame.
  const [viewBounds, setViewBounds] = useState<{
    minLng: number; minLat: number; maxLng: number; maxLat: number;
  } | null>(null);
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const recalc = () => {
      const b = map.getBounds();
      if (!b) return;
      // 30% Buffer rundherum — Pan im aktuellen Viewport zeigt Marker sofort,
      // erst bei großem Pan wird neu gefiltert.
      const w = b.getEast() - b.getWest();
      const h = b.getNorth() - b.getSouth();
      const bx = w * 0.3;
      const by = h * 0.3;
      setViewBounds({
        minLng: b.getWest()  - bx,
        maxLng: b.getEast()  + bx,
        minLat: b.getSouth() - by,
        maxLat: b.getNorth() + by,
      });
    };
    recalc();
    map.on("moveend", recalc);
    return () => { map.off("moveend", recalc); };
  }, [mapReady]);

  // Generischer Viewport-Filter — Marker nur erzeugen wenn sie im Buffer-Rect liegen.
  // Bei viewBounds=null (vor erstem moveend) Identität zurückgeben (alles durchlassen).
  const cull = useCallback(<T extends { lng: number; lat: number }>(arr: T[]): T[] => {
    if (!viewBounds) return arr;
    const { minLng, maxLng, minLat, maxLat } = viewBounds;
    const out: T[] = [];
    for (const item of arr) {
      if (item.lng >= minLng && item.lng <= maxLng && item.lat >= minLat && item.lat <= maxLat) {
        out.push(item);
      }
    }
    return out;
  }, [viewBounds]);

  // Viewport-gefilterte Marker-Listen. Bei viewBounds=null (initial) → alle durchlassen.
  const lootDropsInView    = useMemo(() => cull(lootDrops),    [cull, lootDrops]);
  const strongholdsInView  = useMemo(() => cull(strongholds),  [cull, strongholds]);
  const resourceNodesInView = useMemo(() => cull(resourceNodes), [cull, resourceNodes]);

  const myEmoji = UNLOCKABLE_MARKERS.find((m) => m.id === markerId)?.icon || "👣";
  const light = RUNNER_LIGHTS.find((l) => l.id === lightId) || RUNNER_LIGHTS[0];

  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const locatedRef = useRef(false);
  const userInteractedRef = useRef(false);
  const watchRef = useRef<number | null>(null);
  const selfMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const [markerArt, setMarkerArt] = useState<{ image_url: string | null; video_url: string | null } | null>(null);
  const [markerArtFetched, setMarkerArtFetched] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/cosmetic-artwork", { cache: "no-store" });
        if (!res.ok) return;
        const j = await res.json() as { marker: Record<string, Record<string, { image_url: string | null; video_url: string | null }>> };
        const variants = j.marker?.[markerId];
        const art = variants?.[markerVariant] ?? variants?.neutral ?? null;
        if (alive) setMarkerArt(art);
      } catch {} finally {
        if (alive) setMarkerArtFetched(true);
      }
    })();
    return () => { alive = false; };
  }, [markerId, markerVariant]);
  const runnerMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const dropMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const spotlightBadgeMarkersRef = useRef<Array<{ marker: mapboxgl.Marker; shopId: string; el: HTMLElement }>>([]);
  const spotlightBeamMarkersRef  = useRef<Array<{ marker: mapboxgl.Marker; el: HTMLElement }>>([]);
  const spotlightAuraMarkersRef  = useRef<Array<{ marker: mapboxgl.Marker; el: HTMLElement; stacked: boolean }>>([]);
  // Stable refs fuer Click-Callbacks, damit sich aendernde Parent-Funktionen
  // nicht den Layer-Rebuild ausloesen
  const onShopClickRef = useRef(onShopClick);
  useEffect(() => { onShopClickRef.current = onShopClick; }, [onShopClick]);
  const onPowerZoneClickRef = useRef(onPowerZoneClick);
  useEffect(() => { onPowerZoneClickRef.current = onPowerZoneClick; }, [onPowerZoneClick]);

  // Map initialisieren
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!MAPBOX_TOKEN) {
      console.warn("NEXT_PUBLIC_MAPBOX_TOKEN fehlt!");
      return;
    }

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAPBOX_STYLE,
      center: [FALLBACK.lng, FALLBACK.lat],
      zoom: 16,          // höheres Default-Zoom → Fassaden-Details sichtbar
      pitch: 62,         // stärkere 3D-Perspektive für dramatischere Gebäude
      bearing: -20,
      attributionControl: false,
    });

    // NavigationControl (Zoom +/-, Kompass) entfernt - eigene Controls via MapIconButtons
    map.addControl(new mapboxgl.AttributionControl({ compact: true }));

    map.on("style.load", () => {
      const preset = lightPreset === "auto" ? getCurrentLightPreset() : lightPreset;
      try {
        map.setConfigProperty("basemap", "lightPreset", preset);
        map.setConfigProperty("basemap", "show3dObjects", true);
        map.setConfigProperty("basemap", "showPointOfInterestLabels", false);
        map.setConfigProperty("basemap", "showTransitLabels", false);
        map.setConfigProperty("basemap", "showRoadLabels", true);
        map.setConfigProperty("basemap", "showPlaceLabels", true);
      } catch (e) {
        console.warn("Mapbox Standard-Config konnte nicht gesetzt werden:", e);
      }

      mapRef.current = map;
      setMapReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Map wird nur einmal erzeugt — LightPreset-Änderungen über setConfigProperty

  // Auto-Update LightPreset alle 5 Minuten wenn auf "auto"
  useEffect(() => {
    if (!mapReady || lightPreset !== "auto") return;
    const map = mapRef.current;
    if (!map) return;

    const update = () => {
      try {
        map.setConfigProperty("basemap", "lightPreset", getCurrentLightPreset());
      } catch { /* style evtl. gerade im Transition */ }
    };
    const interval = setInterval(update, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [mapReady, lightPreset]);

  // Explizit gewählter lightPreset
  useEffect(() => {
    if (!mapReady || lightPreset === "auto") return;
    const map = mapRef.current;
    if (!map) return;
    try {
      map.setConfigProperty("basemap", "lightPreset", lightPreset);
    } catch { /* ignore */ }
  }, [mapReady, lightPreset]);

  // Map-Style aus App-Präferenz live wechseln
  const currentStyleKeyRef = useRef<string>("standard");
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      try {
        const styleKey = (localStorage.getItem("pref:display_mapstyle") || "\"standard\"").replace(/"/g, "");
        if (styleKey === currentStyleKeyRef.current) return;
        const styleUrl = MAP_STYLES[styleKey] || MAP_STYLES.standard;
        currentStyleKeyRef.current = styleKey;
        map.setStyle(styleUrl);
      } catch { /* ignore */ }
    };
    const onPref = (e: Event) => {
      const { key } = (e as CustomEvent).detail || {};
      if (key === "display_mapstyle") apply();
    };
    window.addEventListener("pref-change", onPref);
    return () => window.removeEventListener("pref-change", onPref);
  }, [mapReady]);

  // Map-Theme aus Shop-Kauf
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map || !mapTheme) return;
    const styleUrl = MAP_STYLES[mapTheme];
    if (!styleUrl || mapTheme === currentStyleKeyRef.current) return;
    currentStyleKeyRef.current = mapTheme;
    try { map.setStyle(styleUrl); } catch { /* ignore */ }
  }, [mapReady, mapTheme]);

  // 3D-Gebäude Toggle
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      try {
        const enabled = (localStorage.getItem("pref:display_3d") ?? "true") !== "false";
        map.setConfigProperty("basemap", "show3dObjects", enabled);
      } catch { /* style evtl. nicht Standard */ }
    };
    apply();
    const onPref = (e: Event) => {
      const { key } = (e as CustomEvent).detail || {};
      if (key === "display_3d") apply();
    };
    window.addEventListener("pref-change", onPref);
    map.on("style.load", apply);
    return () => {
      window.removeEventListener("pref-change", onPref);
      map.off("style.load", apply);
    };
  }, [mapReady]);



  // Geolocation
  const handlePosition = useCallback(
    (geoPos: GeolocationPosition) => {
      const newPos = { lat: geoPos.coords.latitude, lng: geoPos.coords.longitude };
      setPos(newPos);
      onLocationUpdate?.(newPos.lng, newPos.lat);

      const map = mapRef.current;
      if (map && !locatedRef.current) {
        map.flyTo({ center: [newPos.lng, newPos.lat], zoom: 17, pitch: 50, duration: 900 });
        locatedRef.current = true;
      } else if (map && trackingActive && !userInteractedRef.current) {
        // Nur re-centrieren wenn Position aus dem sichtbaren Viewport gelaufen ist
        // (statt bei jedem GPS-Update), damit die Karte nicht alle paar Sekunden "springt".
        const bounds = map.getBounds();
        if (bounds) {
          const sw = bounds.getSouthWest();
          const ne = bounds.getNorthEast();
          const outside = newPos.lat < sw.lat || newPos.lat > ne.lat || newPos.lng < sw.lng || newPos.lng > ne.lng;
          if (outside) map.panTo([newPos.lng, newPos.lat], { duration: 900 });
        }
      }
    },
    [onLocationUpdate, trackingActive]
  );

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    watchRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      () => {},
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );
    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, [handlePosition]);

  // Recenter (expliziter Klick) → Auto-Follow wieder aktivieren.
  // Dep: NUR recenterAt (nicht pos), sonst fliegt die Karte bei jedem GPS-Update.
  const posRef = useRef(pos);
  useEffect(() => { posRef.current = pos; }, [pos]);
  useEffect(() => {
    if (!mapReady || !recenterAt) return;
    const p = posRef.current;
    if (!p) return;
    userInteractedRef.current = false;
    mapRef.current?.flyTo({ center: [p.lng, p.lat], zoom: 17, pitch: 50, duration: 900 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterAt, mapReady]);

  // User-Gesten erkennen → Auto-Follow deaktivieren
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    const mark = () => { userInteractedRef.current = true; };
    map.on("dragstart", mark);
    map.on("zoomstart", mark);
    map.on("rotatestart", mark);
    map.on("pitchstart", mark);
    return () => {
      map.off("dragstart", mark);
      map.off("zoomstart", mark);
      map.off("rotatestart", mark);
      map.off("pitchstart", mark);
    };
  }, [mapReady]);

  // Overview-Mode: Zoom raus + Pitch zurück auf flach.
  // Dep: NUR overviewMode (nicht pos), sonst fliegt die Karte bei jedem
  // GPS-Update zurück auf den Runner-Pin — auf Mobile besonders nervig, weil
  // watchPosition hier alle paar Sekunden neue Koordinaten liefert.
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    if (overviewMode) {
      map.flyTo({ zoom: 13, pitch: 0, duration: 900 });
    } else {
      const p = posRef.current;
      if (p) map.flyTo({ center: [p.lng, p.lat], zoom: 17, pitch: 50, duration: 900 });
    }
  }, [overviewMode, mapReady]);

  // Eigenes Marker — nur sichtbar wenn der Runner unterwegs ist (walking/joggen).
  // Im Ruhezustand "wohnt" der Runner in seiner Base — daher kein Pin auf der Map.
  useEffect(() => {
    if (!mapReady || !pos) return;
    if (!markerArtFetched) return;
    const map = mapRef.current;
    if (!map) return;

    // Nicht-walking → existierenden Marker entfernen, nicht neu erstellen
    if (!trackingActive) {
      if (selfMarkerRef.current) {
        selfMarkerRef.current.remove();
        selfMarkerRef.current = null;
      }
      return;
    }

    if (!selfMarkerRef.current) {
      const el = buildSelfMarkerEl(myEmoji, teamColor, !!trackingActive, supporterTier, auraActive, crewColor, crewName, displayName, markerArt);
      wrapForZoomScale(el);
      selfMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([pos.lng, pos.lat])
        .addTo(map);
    } else {
      selfMarkerRef.current.setLngLat([pos.lng, pos.lat]);
    }
  }, [mapReady, pos, teamColor, myEmoji, trackingActive, supporterTier, auraActive, crewColor, crewName, displayName, markerArtFetched, markerArt]);

  // Tier-/Crew-Wechsel: Marker neu bauen
  useEffect(() => {
    if (!selfMarkerRef.current || !pos) return;
    const el = buildSelfMarkerEl(myEmoji, teamColor, !!trackingActive, supporterTier, auraActive, crewColor, crewName, displayName, markerArt);
    wrapForZoomScale(el);
    selfMarkerRef.current.getElement().replaceWith(el);
    const map = mapRef.current;
    if (map) {
      selfMarkerRef.current.remove();
      selfMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([pos.lng, pos.lat])
        .addTo(map);
    }
  }, [supporterTier, auraActive, crewColor, crewName, displayName, myEmoji, teamColor, trackingActive, markerArt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup beim Unmount
  useEffect(() => {
    return () => {
      selfMarkerRef.current?.remove();
      selfMarkerRef.current = null;
    };
  }, []);

  // Self-Marker: expliziter Zoom-Scale-Handler.
  // Das globale data-zoom-scale-System greift via MutationObserver, kann aber
  // bei Marker-Rebuilds (Tier-/Crew-/Theme-Wechsel) einen Frame zu spät sein.
  // Hier setzen wir scale3d direkt auf den inner-Wrap.
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    const computeSelfScale = (z: number): number => {
      if (z < 11) return 0.32;
      if (z < 13) return 0.35 + ((z - 11) / 2) * 0.2;
      if (z < 15) return 0.55 + ((z - 13) / 2) * 0.25;
      if (z < 17) return 0.8  + ((z - 15) / 2) * 0.2;
      return 1;
    };
    const apply = () => {
      const m = selfMarkerRef.current;
      if (!m) return;
      const e = m.getElement();
      const wrap = e.querySelector<HTMLElement>('[data-zoom-scale="1"]');
      if (!wrap) return;
      const s = computeSelfScale(map.getZoom());
      wrap.style.transform = `scale3d(${s.toFixed(3)}, ${s.toFixed(3)}, 1)`;
      wrap.style.transformOrigin = "center center";
    };
    apply();
    const applyThrottled = rafThrottle(apply);
    map.on("zoom", applyThrottled);
    // Marker-Rebuilds werden vom globalen MutationObserver in der applyZoomScale-Effect
    // abgefangen — kein zusätzliches Polling mehr nötig.
    return () => {
      map.off("zoom", applyThrottled);
      applyThrottled.cancel();
    };
  }, [mapReady]);

  // Runner
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    runnerMarkersRef.current.forEach((m) => m.remove());
    runnerMarkersRef.current = [];

    crewMembers.forEach((r) => {
      const el = buildRunnerMarkerEl(r);
      wrapForZoomScale(el);
      const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([r.lng, r.lat])
        .addTo(map);
      runnerMarkersRef.current.push(marker);
    });

    return () => {
      runnerMarkersRef.current.forEach((m) => m.remove());
      runnerMarkersRef.current = [];
    };
  }, [mapReady, crewMembers]);

  // Drops
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    dropMarkersRef.current.forEach((m) => m.remove());
    dropMarkersRef.current = [];

    supplyDrops.forEach((drop) => {
      const el = buildDropMarkerEl(drop);
      wrapForZoomScale(el);
      el.addEventListener("click", () => onDropClick?.(drop.id));
      const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([drop.lng, drop.lat])
        .addTo(map);
      dropMarkersRef.current.push(marker);
    });

    return () => {
      dropMarkersRef.current.forEach((m) => m.remove());
      dropMarkersRef.current = [];
    };
  }, [mapReady, supplyDrops, onDropClick]);

  // Shops — Native Mapbox-Symbol-Layer mit ULTRA-HIGH-RES Canvas (1024×1280)
  // Zoom-proportional, crisp durch GPU-Downsampling, voller Premium-Look
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    const SRC = "shops-src";
    const LYR_PIN        = "shops-pin";
    const LYR_LABEL      = "shops-label";

    function darken(hex: string, amt = 0.3): string {
      const c = hex.replace("#", "");
      const r = Math.max(0, Math.round(parseInt(c.slice(0,2),16) * (1-amt)));
      const g = Math.max(0, Math.round(parseInt(c.slice(2,4),16) * (1-amt)));
      const b = Math.max(0, Math.round(parseInt(c.slice(4,6),16) * (1-amt)));
      return `rgb(${r},${g},${b})`;
    }
    function buildPin(color: string, icon: string): ImageData | null {
      const W = 1024, H = 1280;
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      const cx = W / 2, cy = W * 0.5, r = W * 0.40, tipY = H - 48;
      // Dramatischer Schlagschatten
      ctx.shadowColor = "rgba(0,0,0,0.65)"; ctx.shadowBlur = 100; ctx.shadowOffsetY = 48;
      ctx.beginPath();
      ctx.moveTo(cx, tipY);
      ctx.bezierCurveTo(cx - r * 1.05, cy + r * 0.9, cx - r, cy + r * 0.1, cx - r, cy);
      ctx.arc(cx, cy, r, Math.PI, 0, false);
      ctx.bezierCurveTo(cx + r, cy + r * 0.1, cx + r * 1.05, cy + r * 0.9, cx, tipY);
      ctx.closePath();
      // Fett saturierter Farbverlauf
      const grad = ctx.createLinearGradient(W * 0.2, 0, W * 0.8, H);
      grad.addColorStop(0, color); grad.addColorStop(0.45, color); grad.addColorStop(1, darken(color, 0.5));
      ctx.fillStyle = grad; ctx.fill();
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      // Kein dicker weisser Border mehr - nur feine Kontur in Pin-Farbe
      ctx.lineWidth = 8; ctx.strokeStyle = darken(color, 0.55); ctx.stroke();
      // Starker Glanz oben
      const gloss = ctx.createRadialGradient(cx - r * 0.15, cy - r * 0.55, 0, cx - r * 0.15, cy - r * 0.55, r * 1.0);
      gloss.addColorStop(0, "rgba(255,255,255,0.65)"); gloss.addColorStop(0.35, "rgba(255,255,255,0.25)"); gloss.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gloss; ctx.fill();
      // Emoji-Bubble mit Glow-Ring
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.4)"; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.66, 0, Math.PI * 2);
      ctx.fillStyle = "#FFFFFF"; ctx.fill();
      ctx.restore();
      // Farbiger Innen-Ring um Emoji
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.66, 0, Math.PI * 2);
      ctx.lineWidth = 8; ctx.strokeStyle = color; ctx.stroke();
      // Emoji
      ctx.font = `${Math.round(r * 1.3)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#0F1115";
      ctx.fillText(icon, cx, cy + r * 0.05);
      return ctx.getImageData(0, 0, W, H);
    }
    // buildBadge entfernt - Badge ist jetzt CSS-DOM-Marker

    const pinKey = (s: ShopPin) => `pin-${(s.color ?? "").replace(/[^a-z0-9]/gi,"_")}-${s.icon ?? "x"}`.replace(/[^a-zA-Z0-9-_]/g,"_");
    for (const s of shops) {
      const key = pinKey(s);
      if (!map.hasImage(key)) {
        const img = buildPin(s.color || "#FFD700", s.icon || "📍");
        if (img) map.addImage(key, img, { pixelRatio: 4 });
      }
    }
    // Badge wird als CSS-DOM-Marker gerendert (kein Canvas -> kein Blur, echte Animation)

    const geojson = {
      type: "FeatureCollection" as const,
      features: shops.map((s) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [s.lng, s.lat] },
        properties: {
          id: s.id, name: s.name, pin_key: pinKey(s),
          spotlight: !!s.spotlight, arena: !!s.arena,
        },
      })),
    };

    const srcExisting = map.getSource(SRC) as mapboxgl.GeoJSONSource | undefined;
    if (srcExisting) {
      srcExisting.setData(geojson);
    } else {
      map.addSource(SRC, { type: "geojson", data: geojson });

      map.addLayer({
        id: LYR_PIN, type: "symbol", source: SRC,
        layout: {
          "icon-image": ["get", "pin_key"],
          "icon-size": ["interpolate", ["linear"], ["zoom"], 11, 0.03, 13, 0.06, 15, 0.10, 18, 0.16],
          "icon-anchor": "bottom",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      });
      // LYR_BADGE entfernt - wird durch DOM-Marker ersetzt (siehe unten)
      map.addLayer({
        id: LYR_LABEL, type: "symbol", source: SRC,
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 13, 10, 16, 13, 18, 15],
          "text-offset": [0, 1.0],
          "text-anchor": "top",
        },
        paint: {
          "text-color": "#FFF",
          "text-halo-color": "rgba(15,17,21,0.92)",
          "text-halo-width": 2.2,
          "text-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0, 14, 1],
        },
      });

      const onClick = (e: mapboxgl.MapLayerMouseEvent) => {
        const id = e.features?.[0]?.properties?.id as string | undefined;
        if (id) onShopClickRef.current?.(id);
      };
      [LYR_PIN, LYR_LABEL].forEach((l) => {
        map.on("click", l, onClick);
        map.on("mouseenter", l, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", l, () => { map.getCanvas().style.cursor = ""; });
      });

    }

    // ── CSS-DOM-Marker fuer Spotlight-Shops: rotierende Gold-Aura + Badge ──
    // WICHTIG: Mapbox setzt transform: translate(...) auf das Marker-Element.
    // Eigene transform/animations MUESSEN auf einem INNER-Div laufen, sonst wird
    // Mapbox' Positionierung ueberschrieben und Marker rutschen weg.
    spotlightBadgeMarkersRef.current.forEach(({ marker }) => marker.remove());
    spotlightBadgeMarkersRef.current = [];
    spotlightBeamMarkersRef.current.forEach(({ marker }) => marker.remove());
    spotlightBeamMarkersRef.current = [];
    spotlightAuraMarkersRef.current.forEach(({ marker }) => marker.remove());
    spotlightAuraMarkersRef.current = [];
    // Arena-Shops: magenta ARENA-Badge (analog zu Spotlight, staplet darueber wenn beides)
    shops.filter((s) => s.arena).forEach((s) => {
      const badgeOuter = document.createElement("div");
      badgeOuter.style.pointerEvents = "none";
      const badgeInner = document.createElement("div");
      badgeInner.className = "ma365-arena-badge";
      badgeInner.innerHTML = `<span class="shield">🏆</span><span>LIGA</span>`;
      badgeOuter.appendChild(badgeInner);
      const badgeMarker = new mapboxgl.Marker({ element: badgeOuter, anchor: "bottom", offset: [0, -40] })
        .setLngLat([s.lng, s.lat]).addTo(map);
      // Stacking: wenn Shop auch Spotlight hat, sitzt das ARENA-Badge obendrauf
      spotlightAuraMarkersRef.current.push({ marker: badgeMarker, el: badgeInner, stacked: !!s.spotlight });
    });
    // Spotlight-Shops: Light-Beam + Badge
    shops.filter((s) => s.spotlight).forEach((s) => {
      // Bat-Signal-Beam: kommt von oben, Bottom endet an Badge-Bottom
      const beamOuter = document.createElement("div");
      beamOuter.style.pointerEvents = "none";
      const beamInner = document.createElement("div");
      beamInner.className = "ma365-spotlight-beam";
      beamOuter.appendChild(beamInner);
      const beamMarker = new mapboxgl.Marker({ element: beamOuter, anchor: "bottom", offset: [0, 0] })
        .setLngLat([s.lng, s.lat]).addTo(map);
      spotlightBeamMarkersRef.current.push({ marker: beamMarker, el: beamInner });

      const badgeOuter = document.createElement("div");
      badgeOuter.style.pointerEvents = "none";
      const badgeInner = document.createElement("div");
      badgeInner.className = "ma365-spotlight-badge";
      badgeInner.innerHTML = `<span class="star">⭐</span><span>SPOTLIGHT</span>`;
      badgeOuter.appendChild(badgeInner);
      const badgeMarker = new mapboxgl.Marker({ element: badgeOuter, anchor: "bottom", offset: [0, -40] })
        .setLngLat([s.lng, s.lat]).addTo(map);
      spotlightBadgeMarkersRef.current.push({ marker: badgeMarker, shopId: s.id, el: badgeInner });
    });
    // Zoom-Handler: Badge-Offset + Aura-Offset + Aura-Scale an Pin-Groesse koppeln
    const updateMarkerGeometry = () => {
      const zoom = map.getZoom();
      const iconSize =
        zoom < 11 ? 0.03 :
        zoom < 13 ? 0.03 + ((zoom - 11) / 2) * 0.03 :
        zoom < 15 ? 0.06 + ((zoom - 13) / 2) * 0.04 :
        zoom < 18 ? 0.10 + ((zoom - 15) / 3) * 0.06 : 0.16;
      const pinHeight = 1280 * iconSize / 4;
      // Zoom-Schwellen: Beam erst wenn nah genug (Einzelshop-Ansicht), Badge/Aura
      // ab Stadtteil-Zoom, sonst waere bei vielen Spotlights die Karte chaotisch
      const hideBeam  = zoom < 13;
      const hideBadge = zoom < 13;
      const hideAura  = zoom < 13;
      // Badge-Bottom sitzt unmittelbar am Pin-Top (kein Extra-Gap)
      const badgeOffY = -pinHeight;
      const badgeScale = Math.max(0.22, Math.min(1.0, pinHeight / 50));
      spotlightBadgeMarkersRef.current.forEach(({ marker, el }) => {
        marker.setOffset([0, badgeOffY]);
        el.style.transform = `scale(${badgeScale.toFixed(2)})`;
        el.style.transformOrigin = "center bottom";
        el.style.opacity = hideBadge ? "0" : "1";
        el.style.transition = "opacity 0.25s";
      });
      // Arena-Badge: gleiche Position wie Spotlight. Wenn Shop BEIDES hat,
      // sitzt ARENA oben, SPOTLIGHT darunter (badgeStackOffset = ~badgeHeight, 0 Gap).
      const arenaBaseOffY = -pinHeight;
      const badgeStackOffset = 36 * badgeScale;
      const arenaScale = badgeScale;
      spotlightAuraMarkersRef.current.forEach(({ marker, el, stacked }) => {
        const offY = stacked ? arenaBaseOffY - badgeStackOffset : arenaBaseOffY;
        marker.setOffset([0, offY]);
        el.style.transform = `scale(${arenaScale.toFixed(2)})`;
        el.style.transformOrigin = "center bottom";
        el.style.opacity = hideAura ? "0" : "1";
        el.style.transition = "opacity 0.25s";
      });
      // Arena-Countdown: scalierte schwebende Karte UEBER allen Badges
      const arenaBadgeHeight = 22 * badgeScale;
      const countdownGap = 10;
      const countdownScale = Math.max(0.50, Math.min(1.0, pinHeight / 55));
      // Beim Rauszoomen Countdown ausblenden — sonst schwebt der Chip
      // bei fester Pixelhoehe ueber winzigen Pins und wirkt loseglassen.
      const hideCountdown = zoom < 13;
      arenaCountdownMarkersRef.current.forEach(({ marker, hasSpotlight, hasArena }) => {
        let offY: number;
        if (hasArena && hasSpotlight) {
          offY = -(pinHeight + badgeStackOffset + arenaBadgeHeight + countdownGap);
        } else if (hasArena) {
          offY = -(pinHeight + arenaBadgeHeight + countdownGap);
        } else {
          offY = -(pinHeight + countdownGap);
        }
        marker.setOffset([0, offY]);
        const el = marker.getElement();
        const wrap = el.querySelector(".ma365-countdown-wrap") as HTMLElement | null;
        if (wrap) {
          wrap.style.setProperty("--s", countdownScale.toFixed(2));
          // Auf inner UND outer setzen — die Float-Animation auf dem wrap kann
          // die outer-opacity sonst stoeren wenn Browser die Composite-Transparenz
          // anders behandelt. Belt-and-suspenders.
          wrap.style.opacity = hideCountdown ? "0" : "1";
          wrap.style.transition = "opacity 0.25s";
          wrap.style.visibility = hideCountdown ? "hidden" : "visible";
        }
        el.style.opacity = hideCountdown ? "0" : "1";
        el.style.transition = "opacity 0.25s";
        el.style.visibility = hideCountdown ? "hidden" : "visible";
      });
      // Loot-Kisten skalieren mit Zoom (aggressiver schrumpfen beim Rauszoomen)
      // Basis 64px, Faktor 0.22 (far) bis 0.85 (close)
      const lootScale = Math.max(0.22, Math.min(0.85, (zoom - 12) / 6 * 0.65 + 0.25));
      const hideLoot = zoom < 13;
      lootMarkersRef.current.forEach(({ el }) => {
        if (el) {
          el.style.setProperty("--loot-scale", lootScale.toFixed(2));
          el.style.opacity = hideLoot ? "0" : "1";
          el.style.transition = "opacity 0.25s";
          el.style.pointerEvents = hideLoot ? "none" : "auto";
        }
      });
      // Beam: anchor "bottom" sitzt an Badge-Bottom, extends NACH OBEN in den Himmel.
      const beamOffY = -pinHeight;
      const beamScale = Math.max(0.25, Math.min(1.0, pinHeight / 50));
      spotlightBeamMarkersRef.current.forEach(({ marker, el }) => {
        marker.setOffset([0, beamOffY]);
        el.style.height = "140px";
        el.style.transform = `scale(${beamScale.toFixed(2)})`;
        el.style.opacity = hideBeam ? "0" : "1";
        el.style.transition = "opacity 0.25s";
      });
    };
    updateMarkerGeometry();
    const updateMarkerGeometryThrottled = rafThrottle(updateMarkerGeometry);
    map.on("zoom", updateMarkerGeometryThrottled);

    return () => {
      map.off("zoom", updateMarkerGeometryThrottled);
      updateMarkerGeometryThrottled.cancel();
      spotlightBadgeMarkersRef.current.forEach(({ marker }) => marker.remove());
      spotlightBadgeMarkersRef.current = [];
      spotlightBeamMarkersRef.current.forEach(({ marker }) => marker.remove());
      spotlightBeamMarkersRef.current = [];
      spotlightAuraMarkersRef.current.forEach(({ marker }) => marker.remove());
      spotlightAuraMarkersRef.current = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!(map as any).style) return;
      try {
        [LYR_LABEL, LYR_PIN].forEach((l) => {
          if (map.getLayer(l)) map.removeLayer(l);
        });
        if (map.getSource(SRC)) map.removeSource(SRC);
      } catch { /* cleanup race */ }
    };
  }, [mapReady, shops]);

  // Globaler Zoom-Scaling-Effect: skaliert ALLE Marker (Self, Runner, Drops, Shops)
  // anhand des aktuellen Map-Zooms. Label-Fade fuer Shop-Namen.
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    const container = map.getContainer();

    let lastScale = -1;
    let lastShowLabel: boolean | null = null;
    let rafQueued = false;
    const applyZoomScale = (force = false) => {
      const zoom = map.getZoom();
      let scale = 1;
      if (zoom < 11)      scale = 0.32;
      else if (zoom < 13) scale = 0.35 + ((zoom - 11) / 2) * 0.2;
      else if (zoom < 15) scale = 0.55 + ((zoom - 13) / 2) * 0.25;
      else if (zoom < 17) scale = 0.8  + ((zoom - 15) / 2) * 0.2;
      const showLabel = zoom >= 14;
      // Short-circuit: keine Style-Writes wenn Werte unverändert (Pan ohne Zoom).
      if (!force && Math.abs(scale - lastScale) < 0.0005 && showLabel === lastShowLabel) return;
      lastScale = scale;
      lastShowLabel = showLabel;
      container.querySelectorAll<HTMLElement>('[data-zoom-scale="1"]').forEach((el) => {
        el.style.transform = `scale3d(${scale.toFixed(3)}, ${scale.toFixed(3)}, 1)`;
      });
      const scale2x = scale * 0.5;
      container.querySelectorAll<HTMLElement>('[data-zoom-scale="2"]').forEach((el) => {
        el.style.transform = `scale3d(${scale2x.toFixed(3)}, ${scale2x.toFixed(3)}, 1)`;
      });
      container.querySelectorAll<HTMLElement>('[data-shop-label="1"]').forEach((el) => {
        el.style.opacity = showLabel ? "1" : "0";
      });
    };
    // MO-Callback via rAF coalesce — bei DOM-Bursts (neue Marker) max 1 Run pro Frame.
    const onMutation = () => {
      if (rafQueued) return;
      rafQueued = true;
      requestAnimationFrame(() => {
        rafQueued = false;
        applyZoomScale(true); // force: neue Marker brauchen initial scale-attr
      });
    };

    applyZoomScale(true);
    const onZoom = rafThrottle(() => applyZoomScale(false));
    map.on("zoom", onZoom);
    // moveend NICHT mehr: Pan ändert Zoom nicht, alle Style-Writes wären umsonst.
    const mo = new MutationObserver(onMutation);
    mo.observe(container, { childList: true, subtree: true });
    return () => {
      map.off("zoom", onZoom);
      onZoom.cancel();
      mo.disconnect();
    };
  }, [mapReady]);

  // Claimed Areas (Polygon Fill + Stroke)
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    const sourceId = "claimed-areas";
    const fillId = "claimed-areas-fill";
    const strokeId = "claimed-areas-stroke";

    const data = {
      type: "FeatureCollection" as const,
      features: claimedAreas.map(polygonFeature),
    };

    const existing = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(data);
    } else {
      map.addSource(sourceId, { type: "geojson", data });
      map.addLayer({
        id: fillId,
        type: "fill",
        source: sourceId,
        paint: {
          "fill-color": ["get", "color"],
          "fill-opacity": ["get", "fillOpacity"],
          "fill-emissive-strength": 0.3,
        } as mapboxgl.FillLayerSpecification["paint"],
      });
      // Weicher Glow unter der Haupt-Linie — stark emissive damit es bei Night leuchtet
      map.addLayer({
        id: strokeId + "-glow",
        type: "line",
        source: sourceId,
        paint: {
          "line-color": ["get", "color"],
          "line-width": ["interpolate", ["exponential", 1.6], ["zoom"],
            10, ["*", ["get", "strokeWeight"], 0.72],
            13, ["*", ["get", "strokeWeight"], 1.6],
            16, ["*", ["get", "strokeWeight"], 3.0],
            19, ["*", ["get", "strokeWeight"], 5.0]],
          "line-opacity": 0.55,
          "line-blur": 5,
          "line-emissive-strength": 1.0,
        } as mapboxgl.LineLayerSpecification["paint"],
      });
      // Scharfe Haupt-Linie ebenfalls emissive
      map.addLayer({
        id: strokeId,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": ["get", "color"],
          "line-width": ["interpolate", ["exponential", 1.6], ["zoom"],
            10, ["*", ["get", "strokeWeight"], 0.18],
            13, ["*", ["get", "strokeWeight"], 0.40],
            16, ["*", ["get", "strokeWeight"], 0.75],
            19, ["*", ["get", "strokeWeight"], 1.25]],
          "line-opacity": 1,
          "line-emissive-strength": 1.0,
        } as mapboxgl.LineLayerSpecification["paint"],
      });
      map.on("click", fillId, (e) => {
        const t = e.originalEvent.target as HTMLElement | null;
        if (t && t.closest(".mapboxgl-marker")) return;
        const f = e.features?.[0];
        if (f && onAreaClick) onAreaClick(f.properties?.id as string);
      });
      map.on("mouseenter", fillId, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", fillId, () => { map.getCanvas().style.cursor = ""; });
    }
  }, [mapReady, claimedAreas, onAreaClick]);

  // Glitch-Zonen
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    const sourceId = "glitch-zones";
    const layerId = "glitch-zones-fill";

    const data = {
      type: "FeatureCollection" as const,
      features: glitchZones.map((z) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [z.lng, z.lat] },
        properties: { radius: z.radius_m },
      })),
    };

    const existing = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(data);
    } else {
      map.addSource(sourceId, { type: "geojson", data });
      map.addLayer({
        id: layerId,
        type: "circle",
        source: sourceId,
        paint: {
          "circle-radius": [
            "interpolate", ["exponential", 2], ["zoom"],
            10, ["/", ["get", "radius"], 30],
            20, ["/", ["get", "radius"], 0.1],
          ],
          "circle-color": "#a855f7",
          "circle-opacity": 0.18,
          "circle-stroke-color": "#a855f7",
          "circle-stroke-width": 2,
          "circle-stroke-opacity": 0.8,
        },
      });
    }
  }, [mapReady, glitchZones]);

  // Active Route
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    const sourceId = "active-route";
    const glowId = "active-route-glow";
    const mainId = "active-route-main";
    const showLine = activeRoute.length > 0;

    const data = {
      type: "Feature" as const,
      geometry: {
        type: "LineString" as const,
        coordinates: showLine ? activeRoute.map((p) => [p.lng, p.lat]) : [],
      },
      properties: {},
    };

    const color = equippedTrail === "golden_trail" ? "#FFD700"
      : equippedTrail === "neon_trail" ? "#FF2D78"
      : light.gradient[0];
    const existing = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(data);
    } else {
      map.addSource(sourceId, { type: "geojson", data });
      map.addLayer({
        id: glowId, type: "line", source: sourceId,
        paint: { "line-color": color, "line-opacity": 0.3, "line-width": zoomWidth(light.width + 10), "line-blur": 4 },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      map.addLayer({
        id: mainId, type: "line", source: sourceId,
        paint: { "line-color": color, "line-opacity": 1, "line-width": zoomWidth(light.width) },
        layout: { "line-cap": "round", "line-join": "round" },
      });
    }
    if (map.getLayer(mainId)) {
      map.setPaintProperty(glowId, "line-color", color);
      map.setPaintProperty(mainId, "line-color", color);
      map.setPaintProperty(mainId, "line-width", zoomWidth(light.width));
      map.setPaintProperty(glowId, "line-width", zoomWidth(light.width + 10));
    }
  }, [mapReady, activeRoute, trackingActive, light, equippedTrail]);

  // Saved Territories
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    const sourceId = "saved-territories";
    const glowId = "saved-territories-glow";
    const mainId = "saved-territories-main";

    const color = light.gradient[0];
    const data = {
      type: "FeatureCollection" as const,
      features: savedTerritories.map((t) => ({
        type: "Feature" as const,
        geometry: {
          type: "LineString" as const,
          coordinates: t.map((p) => [p.lng, p.lat]),
        },
        properties: {},
      })),
    };

    const existing = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(data);
    } else {
      map.addSource(sourceId, { type: "geojson", data });
      map.addLayer({
        id: glowId, type: "line", source: sourceId,
        paint: { "line-color": color, "line-opacity": 0.35, "line-width": zoomWidth(light.width + 8), "line-blur": 3 },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      map.addLayer({
        id: mainId, type: "line", source: sourceId,
        paint: { "line-color": color, "line-opacity": 1, "line-width": zoomWidth(light.width + 2) },
        layout: { "line-cap": "round", "line-join": "round" },
      });
    }
    if (map.getLayer(mainId)) {
      map.setPaintProperty(glowId, "line-color", color);
      map.setPaintProperty(mainId, "line-color", color);
    }
  }, [mapReady, savedTerritories, light]);

  // ═══ 3-Ebenen-Modell: Straßenabschnitte (dünn, türkis) ═══
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const sourceId = "walked-segments";
    const layerId = "walked-segments-line";
    const data = {
      type: "FeatureCollection" as const,
      features: walkedSegments.map((s) => ({
        type: "Feature" as const,
        id: s.id,
        geometry: { type: "LineString" as const, coordinates: s.geom.map((p) => [p.lng, p.lat]) },
        properties: { id: s.id, is_mine: s.is_mine, is_crew: s.is_crew },
      })),
    };
    const existing = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined;
    if (existing) existing.setData(data);
    else {
      map.addSource(sourceId, { type: "geojson", data });
      map.addLayer({
        id: layerId, type: "line", source: sourceId,
        paint: {
          "line-color": ["case", ["get", "is_crew"], "#22D1C3", ["get", "is_mine"], "#FFD700", "#8B8FA3"],
          "line-opacity": 0.75,
          "line-width": zoomWidth(3),
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      if (onOwnershipClick) {
        map.on("click", layerId, (e) => {
          // Skip wenn Click eigentlich einem DOM-Marker (Base/Wegelager/Resource) galt —
          // Marker haben eigene Handler, sonst öffnen sich 2 Modals gleichzeitig.
          const t = e.originalEvent.target as HTMLElement | null;
          if (t && t.closest(".mapboxgl-marker")) return;
          const id = e.features?.[0]?.properties?.id as string | undefined;
          if (id) onOwnershipClick("segment", id);
        });
        map.on("mouseenter", layerId, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", layerId, () => { map.getCanvas().style.cursor = ""; });
      }
    }
  }, [mapReady, walkedSegments, onOwnershipClick]);

  // ═══ In-App-Routing: aktive Route als animierter Cyan-Pfad ═══
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const sourceId = "active-route";
    const lineId = "active-route-line";
    const glowId = "active-route-glow";
    const dashId = "active-route-dash";

    if (!routeGeometry || routeGeometry.coordinates.length < 2) {
      try {
        const style = map.getStyle();
        const layersToRemove = (style?.layers ?? [])
          .filter((l) => "source" in l && (l as { source?: string }).source === sourceId)
          .map((l) => l.id);
        layersToRemove.forEach((id) => { if (map.getLayer(id)) map.removeLayer(id); });
        // Sicherheitsnetz: bekannte + Altbestand-IDs explizit
        [dashId, lineId, glowId, "active-route-main", "active-route-casing"].forEach((id) => {
          if (map.getLayer(id)) map.removeLayer(id);
        });
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch (err) {
        console.warn("[active-route cleanup]", err);
      }
      return;
    }

    const data = {
      type: "Feature" as const,
      geometry: routeGeometry,
      properties: {},
    };
    const existing = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(data);
    } else {
      map.addSource(sourceId, { type: "geojson", data });
      // Glow-Layer (breit, transparent) → Linie unten → animierter Dash oben
      map.addLayer({
        id: glowId, type: "line", source: sourceId,
        paint: { "line-color": "#22D1C3", "line-width": 14, "line-opacity": 0.18, "line-blur": 6 },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      map.addLayer({
        id: lineId, type: "line", source: sourceId,
        paint: { "line-color": "#22D1C3", "line-width": 6, "line-opacity": 0.85 },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      map.addLayer({
        id: dashId, type: "line", source: sourceId,
        paint: {
          "line-color": "#FFFFFF",
          "line-width": 2.5,
          "line-opacity": 0.9,
          "line-dasharray": [2, 4],
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });
    }
  }, [mapReady, routeGeometry]);

  // ═══ 3-Ebenen-Modell: Vollständige Straßenzüge (mittel, orange) ═══
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const sourceId = "claimed-streets";
    const layerId = "claimed-streets-line";
    const data = {
      type: "FeatureCollection" as const,
      features: claimedStreets.map((s) => ({
        type: "Feature" as const,
        id: s.id,
        geometry: {
          type: "MultiLineString" as const,
          coordinates: s.geoms.map((g) => g.map((p) => [p.lng, p.lat])),
        },
        properties: { id: s.id, is_mine: s.is_mine, is_crew: s.is_crew, intensity: s.intensity ?? 100 },
      })),
    };
    const existing = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined;
    if (existing) existing.setData(data);
    else {
      map.addSource(sourceId, { type: "geojson", data });
      map.addLayer({
        id: layerId, type: "line", source: sourceId,
        paint: {
          "line-color": ["case", ["get", "is_crew"], "#22D1C3", ["get", "is_mine"], "#FF6B4A", "#8B8FA3"],
          // Farb-Zerfall: 100 % → volle 0.95 Opazität, 0 % → unsichtbar
          "line-opacity": ["*", 0.95, ["/", ["to-number", ["get", "intensity"]], 100]],
          "line-width": zoomWidth(6),
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      if (onOwnershipClick) {
        map.on("click", layerId, (e) => {
          const t = e.originalEvent.target as HTMLElement | null;
          if (t && t.closest(".mapboxgl-marker")) return;
          const id = e.features?.[0]?.properties?.id as string | undefined;
          if (id) onOwnershipClick("street", id);
        });
        map.on("mouseenter", layerId, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", layerId, () => { map.getCanvas().style.cursor = ""; });
      }
    }
  }, [mapReady, claimedStreets, onOwnershipClick]);

  // ═══ 3-Ebenen-Modell: Gebiete (gefüllte Polygone) ═══
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const sourceId = "owned-territories";
    const fillId = "owned-territories-fill";
    const strokeId = "owned-territories-stroke";
    const data = {
      type: "FeatureCollection" as const,
      features: ownedTerritories.map((t) => {
        const ring = t.polygon.map((p) => [p.lng, p.lat]);
        if (ring.length > 0 && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])) {
          ring.push(ring[0]);
        }
        return {
          type: "Feature" as const,
          id: t.id,
          geometry: { type: "Polygon" as const, coordinates: [ring] },
          properties: { id: t.id, is_mine: t.is_mine, is_crew: t.is_crew, status: t.status, intensity: t.intensity ?? 100 },
        };
      }),
    };
    const existing = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined;
    if (existing) existing.setData(data);
    else {
      map.addSource(sourceId, { type: "geojson", data });
      map.addLayer({
        id: fillId, type: "fill", source: sourceId,
        paint: {
          "fill-color": ["case", ["get", "is_crew"], "#22D1C3", ["get", "is_mine"], "#FFD700", "#FF2D78"],
          // pending_crew: stark reduzierte Deckkraft als Ghost-Layer.
          // Farb-Zerfall: Intensität skaliert die Basis-Opazität.
          "fill-opacity": [
            "*",
            ["case", ["==", ["get", "status"], "pending_crew"], 0.08, 0.22],
            ["/", ["to-number", ["get", "intensity"]], 100],
          ],
        },
      });
      // Aktive Gebiete: solide Linie
      map.addLayer({
        id: strokeId, type: "line", source: sourceId,
        filter: ["!=", ["get", "status"], "pending_crew"],
        paint: {
          "line-color": ["case", ["get", "is_crew"], "#22D1C3", ["get", "is_mine"], "#FFD700", "#FF2D78"],
          "line-opacity": ["*", 0.9, ["/", ["to-number", ["get", "intensity"]], 100]],
          "line-width": zoomWidth(2.5),
        },
      });
      // Pending-Crew Gebiete: gestrichelte Linie als "Anwartschaft"
      map.addLayer({
        id: strokeId + "-pending", type: "line", source: sourceId,
        filter: ["==", ["get", "status"], "pending_crew"],
        paint: {
          "line-color": ["case", ["get", "is_mine"], "#FFD700", "#FF2D78"],
          "line-opacity": 0.6,
          "line-width": zoomWidth(2.0),
          "line-dasharray": [3, 3],
        },
      });
      if (onOwnershipClick) {
        map.on("click", fillId, (e) => {
          const t = e.originalEvent.target as HTMLElement | null;
          if (t && t.closest(".mapboxgl-marker")) return;
          const id = e.features?.[0]?.properties?.id as string | undefined;
          if (id) onOwnershipClick("territory", id);
        });
        map.on("mouseenter", fillId, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", fillId, () => { map.getCanvas().style.cursor = ""; });
      }
    }
  }, [mapReady, ownedTerritories, onOwnershipClick]);

  // ═══════════════════════════════════════════════════════
  // WAVE: 11 neue Map-Features
  // ═══════════════════════════════════════════════════════

  // ── Power-Zones (Park/Water/City/Landmark mit Buff-Radius) ──
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const srcId = "power-zones";
    const fillId = "power-zones-fill";
    const strokeId = "power-zones-stroke";
    const labelId = "power-zones-label";

    const features = powerZones.map((z) => ({
      type: "Feature" as const,
      id: z.id,
      geometry: { type: "Point" as const, coordinates: [z.center_lng, z.center_lat] },
      properties: {
        id: z.id, name: z.name, kind: z.kind, color: z.color, radius_m: z.radius_m,
        label: `${z.name}`,
      },
    }));
    const data = { type: "FeatureCollection" as const, features };

    const existing = map.getSource(srcId) as mapboxgl.GeoJSONSource | undefined;
    if (existing) existing.setData(data);
    else {
      map.addSource(srcId, { type: "geojson", data });
      // Radius-Kreis mit Zoom-Anpassung (Meter -> Pixel abhängig von Breitengrad)
      map.addLayer({
        id: fillId, type: "circle", source: srcId,
        paint: {
          "circle-color": ["get", "color"],
          "circle-opacity": 0.10,
          "circle-radius": [
            "interpolate", ["exponential", 2], ["zoom"],
            10, ["/", ["get", "radius_m"], 40],
            18, ["/", ["get", "radius_m"], 0.5],
          ],
          "circle-stroke-color": ["get", "color"],
          "circle-stroke-width": 2,
          "circle-stroke-opacity": 0.65,
        },
      });
      map.addLayer({
        id: labelId, type: "symbol", source: srcId,
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 13, 0, 14, 10, 17, 13],
          "text-anchor": "center",
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": ["get", "color"],
          "text-halo-color": "rgba(15,17,21,0.92)",
          "text-halo-width": 2,
          "text-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0, 14, 1],
        },
      });
      // stroke als zweiter Layer für Animation
      map.addLayer({
        id: strokeId, type: "circle", source: srcId,
        paint: {
          "circle-color": "rgba(0,0,0,0)",
          "circle-stroke-color": ["get", "color"],
          "circle-stroke-width": 1,
          "circle-stroke-opacity": 0.3,
          "circle-radius": [
            "interpolate", ["exponential", 2], ["zoom"],
            10, ["/", ["get", "radius_m"], 40],
            18, ["/", ["get", "radius_m"], 0.5],
          ],
        },
      });
      // Click-Handler: Power-Zone Info anzeigen
      const onZoneClick = (e: mapboxgl.MapLayerMouseEvent) => {
        const t = e.originalEvent.target as HTMLElement | null;
        if (t && t.closest(".mapboxgl-marker")) return;
        const id = e.features?.[0]?.properties?.id as string | undefined;
        if (id && onPowerZoneClickRef.current) onPowerZoneClickRef.current(id);
      };
      [fillId, labelId].forEach((l) => {
        map.on("click", l, onZoneClick);
        map.on("mouseenter", l, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", l, () => { map.getCanvas().style.cursor = ""; });
      });
    }
  }, [mapReady, powerZones]);

  // ── Flash-Push Radius Pulse (Mapbox circle layer) ──
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const srcId = "flash-pushes";
    const layerId = "flash-pushes-fill";

    const features = flashPushes.map((f) => ({
      type: "Feature" as const,
      id: f.id,
      geometry: { type: "Point" as const, coordinates: [f.business_lng, f.business_lat] },
      properties: { id: f.id, radius_m: f.radius_m },
    }));
    const data = { type: "FeatureCollection" as const, features };

    const existing = map.getSource(srcId) as mapboxgl.GeoJSONSource | undefined;
    if (existing) existing.setData(data);
    else {
      map.addSource(srcId, { type: "geojson", data });
      map.addLayer({
        id: layerId, type: "circle", source: srcId,
        paint: {
          "circle-color": "#FF2D78",
          "circle-opacity": 0.10,
          "circle-radius": [
            "interpolate", ["exponential", 2], ["zoom"],
            10, ["/", ["get", "radius_m"], 40],
            18, ["/", ["get", "radius_m"], 0.5],
          ],
          "circle-stroke-color": "#FF2D78",
          "circle-stroke-width": 2.5,
          "circle-stroke-opacity": 0.8,
        },
      });
      // Pulse via RAF
      let cancelled = false;
      let t = 0;
      const pulse = () => {
        if (cancelled) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!(map as any).style) { cancelled = true; return; }
        t += 1;
        const p = (Math.sin(t * 0.05) + 1) / 2; // 0..1
        try {
          if (map.getLayer(layerId)) {
            map.setPaintProperty(layerId, "circle-opacity", 0.06 + p * 0.14);
            map.setPaintProperty(layerId, "circle-stroke-opacity", 0.6 + p * 0.35);
          }
        } catch { cancelled = true; return; }
        requestAnimationFrame(pulse);
      };
      requestAnimationFrame(pulse);
      (map as unknown as { __flashPulseCancel?: () => void }).__flashPulseCancel = () => { cancelled = true; };
    }

    return () => {
      const cancel = (map as unknown as { __flashPulseCancel?: () => void }).__flashPulseCancel;
      if (cancel) cancel();
    };
  }, [mapReady, flashPushes]);

  // ── Shadow-Route (Ghost-Line) ──
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const srcId = "shadow-route";
    const mainId = "shadow-route-main";
    const glowId = "shadow-route-glow";

    if (!shadowRoute || shadowRoute.geom.length < 2) {
      try {
        if (map.getLayer(mainId)) map.removeLayer(mainId);
        if (map.getLayer(glowId)) map.removeLayer(glowId);
        if (map.getSource(srcId)) map.removeSource(srcId);
      } catch { /* noop */ }
      return;
    }

    const data = {
      type: "Feature" as const,
      geometry: {
        type: "LineString" as const,
        coordinates: shadowRoute.geom.map((p) => [p.lng, p.lat]),
      },
      properties: {},
    };

    const existing = map.getSource(srcId) as mapboxgl.GeoJSONSource | undefined;
    if (existing) existing.setData(data);
    else {
      map.addSource(srcId, { type: "geojson", data });
      map.addLayer({
        id: glowId, type: "line", source: srcId,
        paint: {
          "line-color": shadowRoute.runner_color,
          "line-opacity": 0.25,
          "line-width": zoomWidth(8),
          "line-blur": 4,
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      map.addLayer({
        id: mainId, type: "line", source: srcId,
        paint: {
          "line-color": shadowRoute.runner_color,
          "line-opacity": 0.85,
          "line-width": zoomWidth(2.5),
          "line-dasharray": [2, 2],
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });
    }
  }, [mapReady, shadowRoute]);

  // ── Shop-Trail (Top-3 Stamm-Shops als Metro-Pfad) ──
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const srcId = "shop-trail";
    const lineId = "shop-trail-line";
    const stopsSrcId = "shop-trail-stops";
    const stopsId = "shop-trail-stops-circle";

    if (shopTrail.length < 2) {
      try {
        if (map.getLayer(stopsId)) map.removeLayer(stopsId);
        if (map.getLayer(lineId)) map.removeLayer(lineId);
        if (map.getSource(stopsSrcId)) map.removeSource(stopsSrcId);
        if (map.getSource(srcId)) map.removeSource(srcId);
      } catch { /* noop */ }
      return;
    }

    const line = {
      type: "Feature" as const,
      geometry: {
        type: "LineString" as const,
        coordinates: shopTrail.map((s) => [s.lng, s.lat]),
      },
      properties: {},
    };
    const stops = {
      type: "FeatureCollection" as const,
      features: shopTrail.map((s) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [s.lng, s.lat] },
        properties: { name: s.name },
      })),
    };

    const existingLine = map.getSource(srcId) as mapboxgl.GeoJSONSource | undefined;
    const existingStops = map.getSource(stopsSrcId) as mapboxgl.GeoJSONSource | undefined;
    if (existingLine && existingStops) {
      existingLine.setData(line);
      existingStops.setData(stops);
    } else {
      if (!existingLine) map.addSource(srcId, { type: "geojson", data: line });
      if (!existingStops) map.addSource(stopsSrcId, { type: "geojson", data: stops });
      if (!map.getLayer(lineId)) map.addLayer({
        id: lineId, type: "line", source: srcId,
        paint: {
          "line-color": "#22D1C3",
          "line-opacity": 0.75,
          "line-width": zoomWidth(3.5),
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      if (!map.getLayer(stopsId)) map.addLayer({
        id: stopsId, type: "circle", source: stopsSrcId,
        paint: {
          "circle-color": "#22D1C3",
          "circle-radius": 5,
          "circle-stroke-color": "#FFF",
          "circle-stroke-width": 2,
        },
      });
    }
  }, [mapReady, shopTrail]);

  // ── Boss-Raids DOM Marker (Pulse + HP-Bar, zoom-skaliert) ──
  const bossMarkersRef = useRef<Array<{ marker: mapboxgl.Marker; el: HTMLElement }>>([]);
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    bossMarkersRef.current.forEach(({ marker }) => marker.remove());
    bossMarkersRef.current = [];

    bossRaids.forEach((b) => {
      const outer = document.createElement("div");
      outer.style.pointerEvents = "auto";
      outer.style.cursor = "pointer";
      const pct = Math.round((b.current_hp / b.max_hp) * 100);
      const inner = document.createElement("div");
      inner.className = "ma365-boss-marker";
      inner.style.transformOrigin = "center bottom";
      inner.innerHTML = `
          <div class="ma365-boss-circle"><span class="ma365-boss-emoji">${b.emoji}</span></div>
          <div class="ma365-boss-hpbar"><div class="ma365-boss-hpfill" style="width:${pct}%"></div></div>`;
      inner.title = b.name;
      outer.appendChild(inner);
      outer.addEventListener("click", () => onBossClick?.(b.id));
      const marker = new mapboxgl.Marker({ element: outer, anchor: "bottom" })
        .setLngLat([b.lng, b.lat]).addTo(map);
      bossMarkersRef.current.push({ marker, el: inner });
    });

    const applyScale = () => {
      const zoom = map.getZoom();
      const hide = zoom < 13;
      const scale = Math.max(0.35, Math.min(1.0, (zoom - 11) / 6 + 0.4));
      bossMarkersRef.current.forEach(({ el }) => {
        el.style.transform = `scale(${scale.toFixed(2)})`;
        el.style.opacity = hide ? "0" : "1";
        el.style.transition = "opacity 0.25s";
      });
    };
    applyScale();
    const applyScaleThrottled = rafThrottle(applyScale);
    map.on("zoom", applyScaleThrottled);

    return () => {
      map.off("zoom", applyScaleThrottled);
      applyScaleThrottled.cancel();
      bossMarkersRef.current.forEach(({ marker }) => marker.remove());
      bossMarkersRef.current = [];
    };
  }, [mapReady, bossRaids, onBossClick]);

  // ── Sanctuaries DOM Marker (zoom-skaliert) ──
  const sanctuaryMarkersRef = useRef<Array<{ marker: mapboxgl.Marker; el: HTMLElement }>>([]);
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    sanctuaryMarkersRef.current.forEach(({ marker }) => marker.remove());
    sanctuaryMarkersRef.current = [];

    sanctuaries.forEach((s) => {
      const outer = document.createElement("div");
      outer.style.pointerEvents = "auto";
      outer.style.cursor = "pointer";
      const done = s.trained_today;
      const inner = document.createElement("div");
      inner.className = `ma365-sanctuary-marker ${done ? "done" : ""}`;
      inner.innerHTML = `
          <div class="ma365-sanctuary-emoji">${s.emoji}</div>
          ${done ? '<div class="ma365-sanctuary-check">✓</div>' : `<div class="ma365-sanctuary-xp">+${s.xp_reward} XP</div>`}`;
      outer.appendChild(inner);
      outer.addEventListener("click", () => onSanctuaryClick?.(s.id));
      const marker = new mapboxgl.Marker({ element: outer, anchor: "bottom" })
        .setLngLat([s.lng, s.lat]).addTo(map);
      sanctuaryMarkersRef.current.push({ marker, el: inner });
    });

    const applyScale = () => {
      const zoom = map.getZoom();
      const hide = zoom < 11;
      const scale = Math.max(0.35, Math.min(1.0, (zoom - 11) / 6 + 0.4));
      sanctuaryMarkersRef.current.forEach(({ el }) => {
        el.style.transform = `scale(${scale.toFixed(2)})`;
        el.style.opacity = hide ? "0" : "1";
        el.style.transition = "opacity 0.25s";
      });
    };
    applyScale();
    const applyScaleThrottled = rafThrottle(applyScale);
    map.on("zoom", applyScaleThrottled);

    return () => {
      map.off("zoom", applyScaleThrottled);
      applyScaleThrottled.cancel();
      sanctuaryMarkersRef.current.forEach(({ marker }) => marker.remove());
      sanctuaryMarkersRef.current = [];
    };
  }, [mapReady, sanctuaries, onSanctuaryClick]);

  // ── Wegelager (Strongholds) DOM-Marker ──
  const strongholdMarkersRef = useRef<Array<{
    marker: mapboxgl.Marker;
    el: HTMLElement;
    full: HTMLElement | null;
    sil: HTMLElement | null;
    lvl: HTMLElement | null;
    hp: HTMLElement | null;
  }>>([]);
  const onStrongholdClickRef = useRef(onStrongholdClick);
  useEffect(() => { onStrongholdClickRef.current = onStrongholdClick; }, [onStrongholdClick]);
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    strongholdMarkersRef.current.forEach(({ marker }) => marker.remove());
    strongholdMarkersRef.current = [];

    strongholdsInView.forEach((s) => {
      const outer = document.createElement("div");
      outer.style.pointerEvents = "auto";
      outer.style.cursor = "pointer";
      const inner = document.createElement("div");
      inner.className = "ma365-stronghold-marker";

      // Ein einziges Artwork für alle Wegelager — Slot "wegelager", Fallback auf
      // alte Slots (default/level_<N>) für Rückwärtskompatibilität, dann Emoji.
      const art = strongholdArt.wegelager ?? strongholdArt.default ?? strongholdArt[`level_${s.level}`] ?? null;
      // Wegelager = Feind → ROT. Falls Artwork in anderer Farbe gespeichert ist,
      // mit hue-rotate auf Rot drücken (kombiniert mit chroma-key für transparenten BG).
      const wegelagerStyle = "width:48px;height:48px;object-fit:contain;filter:url(#ma365-chroma-black) hue-rotate(-25deg) saturate(1.6) drop-shadow(0 2px 4px rgba(220,38,38,0.55));";
      let visualHtml: string;
      if (art?.video_url) {
        visualHtml = `<video src="${art.video_url}" autoplay loop muted playsinline class="ma365-stronghold-emoji" data-vis="full" style="${wegelagerStyle}"></video>`;
      } else if (art?.image_url) {
        visualHtml = `<img src="${art.image_url}" alt="stronghold" class="ma365-stronghold-emoji" data-vis="full" style="${wegelagerStyle}" />`;
      } else {
        visualHtml = `<div class="ma365-stronghold-emoji" data-vis="full" style="font-size:28px;color:#DC2626;text-shadow:0 1px 2px rgba(0,0,0,0.6);">🏰</div>`;
      }

      // Silhouette-SVG (mid-LOD): kleine rote Bandit-Festung mit Flagge
      const silhouetteSvg = `<svg class="ma365-stronghold-sil" data-vis="sil" viewBox="0 0 40 44" width="28" height="28" preserveAspectRatio="xMidYMax meet" style="display:none;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.55));">
        <defs>
          <linearGradient id="ma365-sh-grad-${s.id}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#DC2626"/>
            <stop offset="100%" stop-color="#991B1B"/>
          </linearGradient>
        </defs>
        <path d="M20 4 L20 12 L28 10 L20 18 Z" fill="#FFD700" stroke="#7F1D1D" stroke-width="0.7"/>
        <path d="M4 18 L4 14 L8 14 L8 18 L12 18 L12 12 L16 12 L16 18 L20 18 L20 14 L24 14 L24 18 L28 18 L28 13 L32 13 L32 18 L36 18 L36 22 L34 22 L34 40 L26 40 L26 32 L22 32 L22 40 L18 40 L18 34 L14 34 L14 40 L6 40 L6 22 L4 22 Z"
              fill="url(#ma365-sh-grad-${s.id})" stroke="#7F1D1D" stroke-width="1.1" stroke-linejoin="round"/>
        <rect x="9" y="24" width="3" height="3" fill="#0F1115"/>
        <rect x="20" y="24" width="3" height="3" fill="#0F1115"/>
        <rect x="29" y="24" width="3" height="3" fill="#0F1115"/>
      </svg>`;

      inner.innerHTML = `
        ${silhouetteSvg}
        ${visualHtml}
        <div class="ma365-stronghold-level">Lv${s.level}</div>
        <div class="ma365-stronghold-hp"><div class="ma365-stronghold-hp-fill" style="width:${Math.max(0, Math.min(100, s.hp_pct))}%"></div></div>`;
      outer.appendChild(inner);
      outer.addEventListener("click", (ev) => {
        const me = ev as MouseEvent;
        onStrongholdClickRef.current?.(s.id, me.clientX, me.clientY);
      });
      const marker = new mapboxgl.Marker({ element: outer, anchor: "bottom" })
        .setLngLat([s.lng, s.lat]).addTo(map);
      // Child-Refs einmalig cachen — kein querySelector mehr pro Zoom-Frame
      strongholdMarkersRef.current.push({
        marker,
        el: inner,
        full: inner.querySelector('[data-vis="full"]') as HTMLElement | null,
        sil:  inner.querySelector('[data-vis="sil"]')  as HTMLElement | null,
        lvl:  inner.querySelector(".ma365-stronghold-level") as HTMLElement | null,
        hp:   inner.querySelector(".ma365-stronghold-hp")    as HTMLElement | null,
      });
    });

    // Letzter applyScale-State — vermeidet identische Style-Writes (Pan ohne Zoom)
    let lastScale = -1;
    let lastHide: boolean | null = null;
    let lastSil: boolean | null = null;
    const applyScale = () => {
      const zoom = map.getZoom();
      // 3-stufige LOD wie Gebäude:
      //   zoom < 12        → komplett versteckt
      //   12 ≤ zoom < 16   → Silhouette (klein, mono-schwarz, ohne Lv/HP)
      //   zoom ≥ 16        → volles Artwork mit Lv-Badge + HP-Bar
      const hide = zoom < 12;
      const silhouette = !hide && zoom < 16;
      // Wegelager kleiner als Bases — sind nur "POIs", keine Hauptbauwerke
      let scale = 1.0;
      if      (zoom < 13)   scale = 0.30;
      else if (zoom < 16)   scale = 0.30 + ((zoom - 13) / 3) * 0.25; // 0.30 → 0.55
      else if (zoom < 17)   scale = 0.75;
      else if (zoom < 18)   scale = 0.85 + (zoom - 17) * 0.10;       // 0.85 → 0.95
      const scaleChanged = Math.abs(scale - lastScale) > 0.005;
      const visChanged = hide !== lastHide || silhouette !== lastSil;
      if (!scaleChanged && !visChanged) return;
      lastScale = scale;
      lastHide = hide;
      lastSil = silhouette;
      const transformStr = `scale(${scale.toFixed(2)})`;
      const opacity = hide ? "0" : "1";
      const fullDisp = silhouette ? "none" : "";
      const silDisp = silhouette ? "block" : "none";
      const lvlDisp = silhouette ? "none" : "";
      strongholdMarkersRef.current.forEach((m) => {
        if (scaleChanged) {
          m.el.style.transform = transformStr;
          m.el.style.transformOrigin = "bottom center";
        }
        if (visChanged) {
          m.el.style.opacity = opacity;
          m.el.style.transition = "opacity 0.25s";
          if (m.full) m.full.style.display = fullDisp;
          if (m.sil)  m.sil.style.display  = silDisp;
          if (m.lvl)  m.lvl.style.display  = lvlDisp;
          if (m.hp)   m.hp.style.display   = lvlDisp;
        }
      });
    };
    applyScale();
    const applyScaleThrottled = rafThrottle(applyScale);
    map.on("zoom", applyScaleThrottled);
    return () => {
      map.off("zoom", applyScaleThrottled);
      applyScaleThrottled.cancel();
      strongholdMarkersRef.current.forEach(({ marker }) => marker.remove());
      strongholdMarkersRef.current = [];
    };
  }, [mapReady, strongholdsInView, strongholdArt]);

  // ── Resource-Nodes (Schrottplatz/Fabrik/ATM/Datacenter) — diff-based ──
  const rnodeEmoji: Record<string, string> = {
    scrapyard: "⚙️", factory: "🔩", atm: "💸", datacenter: "📡",
  };
  // SVG-Silhouetten pro Typ (mid-LOD) — passend zum Kind-Farbschema
  const rnodeSilhouette = (kind: string): string => {
    const grad = (id: string, c1: string, c2: string) =>
      `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs>`;
    const wrap = (inner: string) =>
      `<svg data-vis="sil" viewBox="0 0 36 36" width="32" height="32" preserveAspectRatio="xMidYMax meet" style="display:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.55));">${inner}</svg>`;
    if (kind === "scrapyard") {
      // Schrottberg + Kran-Haken
      return wrap(`${grad("g-sy", "#9ca3af", "#374151")}
        <path d="M6 30 L4 32 L32 32 L30 30 L26 22 L20 18 L14 20 L10 26 Z" fill="url(#g-sy)" stroke="#1f2937" stroke-width="1" stroke-linejoin="round"/>
        <rect x="10" y="14" width="2" height="10" fill="#1f2937"/>
        <rect x="10" y="14" width="14" height="2" fill="#1f2937"/>
        <line x1="22" y1="14" x2="22" y2="20" stroke="#1f2937" stroke-width="1.2"/>
        <rect x="20" y="20" width="4" height="3" fill="#FFD700" stroke="#1f2937" stroke-width="0.8"/>`);
    }
    if (kind === "factory") {
      // Fabrikgebäude mit Schornstein + Rauchwolke
      return wrap(`${grad("g-fa", "#fbbf24", "#b45309")}
        <ellipse cx="11" cy="6" rx="4" ry="2.5" fill="#9ca3af" opacity="0.7"/>
        <ellipse cx="14" cy="3.5" rx="3" ry="2" fill="#cbd5e1" opacity="0.6"/>
        <rect x="9" y="8" width="4" height="14" fill="#7c2d12" stroke="#1f2937" stroke-width="0.7"/>
        <path d="M4 32 L4 18 L14 18 L14 22 L20 18 L20 22 L26 18 L26 22 L32 22 L32 32 Z" fill="url(#g-fa)" stroke="#7c2d12" stroke-width="1" stroke-linejoin="round"/>
        <rect x="7" y="25" width="3" height="3" fill="#0F1115"/>
        <rect x="15" y="25" width="3" height="3" fill="#0F1115"/>
        <rect x="23" y="25" width="3" height="3" fill="#0F1115"/>`);
    }
    if (kind === "atm") {
      // Bank-Tresor mit Münze
      return wrap(`${grad("g-at", "#FFD700", "#FF8C00")}
        <rect x="6" y="6" width="24" height="26" rx="2" fill="url(#g-at)" stroke="#7c2d12" stroke-width="1.1" stroke-linejoin="round"/>
        <circle cx="18" cy="18" r="6" fill="#0F1115" stroke="#7c2d12" stroke-width="0.8"/>
        <circle cx="18" cy="18" r="3" fill="#FFD700"/>
        <text x="18" y="21" font-size="6" font-weight="900" fill="#7c2d12" text-anchor="middle" font-family="system-ui">€</text>
        <rect x="9" y="8.5" width="3" height="2" fill="#0F1115"/>
        <rect x="24" y="8.5" width="3" height="2" fill="#0F1115"/>`);
    }
    // datacenter
    // Server-Rack + Antenne
    return wrap(`${grad("g-dc", "#22D1C3", "#0e7490")}
      <line x1="18" y1="2" x2="18" y2="8" stroke="#0F1115" stroke-width="1"/>
      <circle cx="18" cy="2" r="1.5" fill="#FFD700"/>
      <path d="M14 5 Q18 1 22 5" fill="none" stroke="#0F1115" stroke-width="0.8"/>
      <path d="M12 8 Q18 2 24 8" fill="none" stroke="#0F1115" stroke-width="0.8"/>
      <rect x="6" y="10" width="24" height="22" rx="1.5" fill="url(#g-dc)" stroke="#0c4a6e" stroke-width="1.1" stroke-linejoin="round"/>
      <rect x="9" y="13" width="18" height="3" fill="#0F1115"/>
      <rect x="9" y="18" width="18" height="3" fill="#0F1115"/>
      <rect x="9" y="23" width="18" height="3" fill="#0F1115"/>
      <circle cx="11" cy="14.5" r="0.7" fill="#22D1C3"/>
      <circle cx="11" cy="19.5" r="0.7" fill="#FFD700"/>
      <circle cx="11" cy="24.5" r="0.7" fill="#FF6B4A"/>`);
  };
  const rnodeMarkersRef = useRef<Map<number, {
    marker: mapboxgl.Marker;
    el: HTMLElement;
    level: number;
    full: HTMLElement | null;
    sil: HTMLElement | null;
    lvl: HTMLElement | null;
    ring: HTMLElement | null;
    cd: HTMLElement | null;
  }>>(new Map());
  const onResourceNodeClickRef = useRef(onResourceNodeClick);
  useEffect(() => { onResourceNodeClickRef.current = onResourceNodeClick; }, [onResourceNodeClick]);
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const cur = rnodeMarkersRef.current;
    const incomingIds = new Set(resourceNodesInView.map((n) => n.id));

    // entferne alte (auch jene, die jetzt außerhalb des Viewports liegen)
    for (const [id, entry] of cur) {
      if (!incomingIds.has(id)) { entry.marker.remove(); cur.delete(id); }
    }
    const updateGatherIndicator = (
      ring: HTMLElement | null,
      cd: HTMLElement | null,
      n: typeof resourceNodes[0],
    ) => {
      if (!ring) return;
      if (n.gather_active && n.gather_finish_at) {
        ring.style.display = "flex";
        ring.dataset.finishAt = n.gather_finish_at;
        ring.dataset.mine = n.gather_mine ? "1" : "0";
        const color = n.gather_mine ? "#4ade80" : "#FF2D78";
        ring.style.borderColor = color;
        ring.style.boxShadow = `0 0 14px ${color}cc, inset 0 0 8px ${color}55`;
        if (cd) cd.style.color = color;
      } else {
        ring.style.display = "none";
      }
    };

    // füge neue ein
    for (const n of resourceNodesInView) {
      const existing = cur.get(n.id);
      if (existing) {
        if (existing.level !== n.level) {
          if (existing.lvl) existing.lvl.textContent = `Lv${n.level}`;
          existing.level = n.level;
        }
        updateGatherIndicator(existing.ring, existing.cd, n);
        continue;
      }
      const outer = document.createElement("div");
      outer.style.pointerEvents = "auto";
      const inner = document.createElement("div");
      inner.className = "ma365-rnode-marker";
      inner.innerHTML = `
        ${rnodeSilhouette(n.kind)}
        <div class="ma365-rnode-icon kind-${n.kind}" data-vis="full">${rnodeEmoji[n.kind] ?? "📦"}</div>
        <div class="ma365-rnode-gather-ring" style="display:none;position:absolute;top:-6px;left:50%;transform:translateX(-50%);width:54px;height:54px;border-radius:50%;border:3px solid #4ade80;background:rgba(15,17,21,0.7);align-items:center;justify-content:center;pointer-events:none;z-index:3;animation:ma365GatherPulse 1.6s ease-in-out infinite;">
          <span class="ma365-rnode-cd" style="font-size:10px;font-weight:900;color:#4ade80;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,sans-serif;text-shadow:0 1px 2px rgba(0,0,0,0.9);"></span>
        </div>
        <div class="ma365-rnode-level">Lv${n.level}</div>`;
      outer.appendChild(inner);
      outer.addEventListener("click", (ev) => { ev.stopPropagation(); const me = ev as MouseEvent; onResourceNodeClickRef.current?.(n.id, me.clientX, me.clientY); });
      const marker = new mapboxgl.Marker({ element: outer, anchor: "bottom" })
        .setLngLat([n.lng, n.lat]).addTo(map);
      // Child-Refs einmalig cachen
      const ring = inner.querySelector(".ma365-rnode-gather-ring") as HTMLElement | null;
      const entry = {
        marker, el: inner, level: n.level,
        full: inner.querySelector('[data-vis="full"]') as HTMLElement | null,
        sil:  inner.querySelector('[data-vis="sil"]')  as HTMLElement | null,
        lvl:  inner.querySelector(".ma365-rnode-level") as HTMLElement | null,
        ring,
        cd:   ring ? (ring.querySelector(".ma365-rnode-cd") as HTMLElement | null) : null,
      };
      cur.set(n.id, entry);
      updateGatherIndicator(entry.ring, entry.cd, n);
    }

    // Countdown-Tick: Sekündlich Restzeit auf gather-rings aktualisieren
    const cdInterval = window.setInterval(() => {
      const now = Date.now();
      for (const m of cur.values()) {
        const ring = m.ring;
        if (!ring || ring.style.display === "none") continue;
        const finishAt = ring.dataset.finishAt;
        if (!finishAt) continue;
        const remaining = Math.max(0, new Date(finishAt).getTime() - now);
        if (m.cd) {
          const s = Math.floor(remaining / 1000);
          const mins = Math.floor(s / 60);
          m.cd.textContent = mins > 0 ? `${mins}m${String(s % 60).padStart(2, "0")}` : `${s}s`;
        }
      }
    }, 1000);

    let lastScale = -1;
    let lastHide: boolean | null = null;
    let lastSil: boolean | null = null;
    const applyScale = () => {
      const zoom = map.getZoom();
      // 3-stufige LOD wie Wegelager:
      //   < 13 hidden, 13-16 SVG-Silhouette, ≥ 16 voller Icon-Stage
      const hide = zoom < 13;
      const silhouette = !hide && zoom < 16;
      let scale = 1.0;
      if      (zoom < 14) scale = 0.65;
      else if (zoom < 16) scale = 0.65 + (zoom - 14) * 0.18; // 0.65 → 1.0
      else if (zoom < 17) scale = 1.05;
      else                scale = 1.15;
      const scaleChanged = Math.abs(scale - lastScale) > 0.005;
      const visChanged = hide !== lastHide || silhouette !== lastSil;
      if (!scaleChanged && !visChanged) return;
      lastScale = scale;
      lastHide = hide;
      lastSil = silhouette;
      const transformStr = `scale(${scale.toFixed(2)})`;
      const opacity = hide ? "0" : "1";
      const pe = hide ? "none" : "auto";
      const fullDisp = silhouette ? "none" : "";
      const silDisp = silhouette ? "block" : "none";
      const lvlDisp = silhouette ? "none" : "";
      for (const m of cur.values()) {
        if (scaleChanged) {
          m.el.style.transform = transformStr;
          m.el.style.transformOrigin = "bottom center";
        }
        if (visChanged) {
          m.el.style.opacity = opacity;
          m.el.style.transition = "opacity 0.2s";
          m.el.style.pointerEvents = pe;
          if (m.full) m.full.style.display = fullDisp;
          if (m.sil)  m.sil.style.display  = silDisp;
          if (m.lvl)  m.lvl.style.display  = lvlDisp;
        }
      }
    };
    applyScale();
    const applyScaleThrottled = rafThrottle(applyScale);
    map.on("zoom", applyScaleThrottled);
    return () => {
      map.off("zoom", applyScaleThrottled);
      applyScaleThrottled.cancel();
      window.clearInterval(cdInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, resourceNodesInView]);

  // ── Viewport-Change-Emitter (debounced) für Resource-Nodes-Fetching ──
  useEffect(() => {
    if (!mapReady || !mapRef.current || !onViewportChange) return;
    const map = mapRef.current;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const emit = () => {
      const b = map.getBounds();
      if (!b) return;
      onViewportChange({
        minLng: b.getWest(), minLat: b.getSouth(),
        maxLng: b.getEast(), maxLat: b.getNorth(),
        zoom: map.getZoom(),
      });
    };
    const debounced = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(emit, 300);
    };
    emit();
    map.on("moveend", debounced);
    map.on("zoomend", debounced);
    return () => {
      if (timer) clearTimeout(timer);
      map.off("moveend", debounced);
      map.off("zoomend", debounced);
    };
  }, [mapReady, onViewportChange]);

  // ── Loot-Drops: animierte Kisten mit Proximity-Pickup ──
  // Diff-basiert: bestehende Marker bleiben stehen, nur neue/entfernte werden geändert
  // (verhindert Flackern/Reload beim Spawn neuer Drops).
  const lootMarkersRef = useRef<Array<{ marker: mapboxgl.Marker; el: HTMLElement; drop: typeof lootDrops[0] }>>([]);
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;

    const rarityColor: Record<string, string> = {
      common: "#9ba8c7", rare: "#5ddaf0", epic: "#a855f7", legendary: "#FFD700",
    };
    const crateByRarity: Record<string, string> = {
      common: "📦", rare: "🎁", epic: "💎", legendary: "👑",
    };
    const zoom = map.getZoom();
    const initialLootScale = Math.max(0.22, Math.min(0.85, (zoom - 12) / 6 * 0.65 + 0.25));

    const wantIds = new Set(lootDropsInView.map((d) => d.id));
    // Entfernen: Marker, die nicht mehr existieren ODER aus dem Viewport gefallen sind
    lootMarkersRef.current = lootMarkersRef.current.filter((m) => {
      if (wantIds.has(m.drop.id)) return true;
      m.marker.remove();
      return false;
    });
    const haveIds = new Set(lootMarkersRef.current.map((m) => m.drop.id));
    // Hinzufügen: neue Drops im Viewport
    lootDropsInView.forEach((d) => {
      if (haveIds.has(d.id)) return;
      const outer = document.createElement("div");
      outer.style.pointerEvents = "auto";
      const color = rarityColor[d.rarity] || "#5ddaf0";
      const crate = crateByRarity[d.rarity] || "📦";
      outer.innerHTML = `
        <div class="ma365-loot-wrap" style="--color:${color}; --loot-scale:${initialLootScale.toFixed(2)}">
          <div class="ma365-loot-proximity"></div>
          <div class="ma365-loot-proximity two"></div>
          <div class="ma365-loot-crate">${crate}</div>
          <div class="ma365-loot-timer" data-loot-timer="${d.expires_at ?? 0}" style="position:absolute;left:50%;top:-16px;transform:translateX(-50%);background:rgba(15,17,21,0.85);color:#FFF;font-size:11px;font-weight:800;letter-spacing:0.2px;padding:2px 6px;border-radius:6px;border:1px solid ${color}88;white-space:nowrap;pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,sans-serif;text-shadow:0 1px 2px rgba(0,0,0,0.8);"></div>
        </div>`;
      outer.addEventListener("click", () => onLootClick?.(d.id));
      const marker = new mapboxgl.Marker({ element: outer, anchor: "center" })
        .setLngLat([d.lng, d.lat]).addTo(map);
      lootMarkersRef.current.push({ marker, el: outer.querySelector(".ma365-loot-wrap") as HTMLElement, drop: d });
    });
    return () => { /* Cleanup nur beim Unmount via mapReady=false-Reset */ };
  }, [mapReady, lootDropsInView, onLootClick]);

  // Loot-Drop-Countdown: aktualisiert alle Timer-Badges einmal pro Sekunde.
  useEffect(() => {
    if (!mapReady) return;
    const fmt = (msLeft: number) => {
      const s = Math.max(0, Math.floor(msLeft / 1000));
      if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
      if (s >= 60) return `${Math.floor(s / 60)}m ${s % 60}s`;
      return `${s}s`;
    };
    const tick = () => {
      const now = Date.now();
      document.querySelectorAll<HTMLElement>("[data-loot-timer]").forEach((el) => {
        const exp = Number(el.dataset.lootTimer || "0");
        if (!exp) { el.textContent = ""; return; }
        const left = exp - now;
        if (left <= 0) { el.textContent = "weg"; return; }
        el.textContent = fmt(left);
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [mapReady, lootDrops]);

  // Proximity-Check: User-Position vs Loot-Drops. 30m = auto-pickup, 100m = "ready"-Glow
  useEffect(() => {
    if (!pos || lootMarkersRef.current.length === 0) return;
    const haversineM = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
      const R = 6371000;
      const dLat = ((b.lat - a.lat) * Math.PI) / 180;
      const dLng = ((b.lng - a.lng) * Math.PI) / 180;
      const la1 = (a.lat * Math.PI) / 180, la2 = (b.lat * Math.PI) / 180;
      const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(x));
    };
    lootMarkersRef.current.forEach(({ el, drop }) => {
      if (!el) return;
      const d = haversineM(pos, { lat: drop.lat, lng: drop.lng });
      if (d <= 20 && !el.classList.contains("picking-up")) {
        // Auto-Pickup bei 20m Naehe
        el.classList.add("picking-up");
        setTimeout(() => onLootClick?.(drop.id), 550);
      } else if (d <= 80) {
        el.classList.add("ready");
      } else {
        el.classList.remove("ready");
      }
    });
  }, [pos, onLootClick]);

  // ── Arena-Countdown DOM Marker (Chip OBEN ueber den Badges, center-stacked) ──
  const arenaCountdownMarkersRef = useRef<Array<{ marker: mapboxgl.Marker; hasSpotlight: boolean; hasArena: boolean }>>([]);
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    arenaCountdownMarkersRef.current.forEach(({ marker }) => marker.remove());
    arenaCountdownMarkersRef.current = [];

    const fmtCountdownParts = (startsAt: string): { label: string; value: string; live: boolean } => {
      const diff = new Date(startsAt).getTime() - Date.now();
      if (diff < 0) return { label: "", value: "LIVE", live: true };
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      if (h > 24) return { label: "STARTET IN", value: `${Math.floor(h/24)}d`, live: false };
      if (h > 0)  return { label: "STARTET IN", value: `${h}<span class="sep">:</span>${m.toString().padStart(2,"0")}`, live: false };
      return { label: "STARTET IN", value: `${m}m`, live: false };
    };

    arenaCountdowns.forEach((c) => {
      const shop = shops.find((s) => s.id === c.business_id);
      const hasSpotlight = !!shop?.spotlight;
      const hasArena = !!shop?.arena;
      const outer = document.createElement("div");
      outer.style.pointerEvents = "none";
      const wrap = document.createElement("div");
      wrap.className = "ma365-countdown-wrap";
      const parts = fmtCountdownParts(c.starts_at);
      wrap.innerHTML = `<span class="icon">⚔️</span><span class="value">${parts.value}</span>`;
      outer.appendChild(wrap);
      const marker = new mapboxgl.Marker({ element: outer, anchor: "bottom", offset: [0, 0] })
        .setLngLat([c.business_lng, c.business_lat]).addTo(map);
      arenaCountdownMarkersRef.current.push({ marker, hasSpotlight, hasArena });
    });
    // Geometrie-Update zwingen: der Spotlight-Effect-Hook lauscht auf "zoom"
    // und positioniert Countdown-Marker (Offset/Skalierung). Ohne Trigger
    // sitzen frisch gemountete Marker bei Offset [0,0] = unter dem Pin.
    map.fire("zoom");

    // Live-Tick: alle 30s Wert neu rendern (kein kompletter Re-Setup)
    const tick = setInterval(() => {
      arenaCountdownMarkersRef.current.forEach(({ marker }, i) => {
        const c = arenaCountdowns[i];
        if (!c) return;
        const valEl = marker.getElement().querySelector(".ma365-countdown-wrap .value");
        if (valEl) {
          const parts = fmtCountdownParts(c.starts_at);
          valEl.innerHTML = parts.value;
        }
      });
    }, 30_000);
    return () => {
      clearInterval(tick);
      arenaCountdownMarkersRef.current.forEach(({ marker }) => marker.remove());
      arenaCountdownMarkersRef.current = [];
    };
  }, [mapReady, arenaCountdowns, shops]);

  // ── Review-Sterne unter Shop-Pin (DOM-Marker mit Star-Bar) ──
  const reviewMarkersRef = useRef<mapboxgl.Marker[]>([]);
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    reviewMarkersRef.current.forEach((m) => m.remove());
    reviewMarkersRef.current = [];

    const shopMap = new Map(shops.map((s) => [s.id, s]));
    shopReviews.forEach((r) => {
      const shop = shopMap.get(r.business_id);
      if (!shop || r.review_count === 0) return;
      const rating = Math.round(r.avg_rating);
      const stars = "★★★★★".slice(0, rating) + "☆☆☆☆☆".slice(rating);
      const outer = document.createElement("div");
      outer.style.pointerEvents = "none";
      outer.innerHTML = `
        <div class="ma365-review-chip">
          <span class="ma365-review-stars">${stars}</span>
          <span class="ma365-review-count">(${r.review_count})</span>
        </div>`;
      const marker = new mapboxgl.Marker({ element: outer, anchor: "top", offset: [0, 28] })
        .setLngLat([shop.lng, shop.lat]).addTo(map);
      reviewMarkersRef.current.push(marker);
    });
    return () => { reviewMarkersRef.current.forEach((m) => m.remove()); reviewMarkersRef.current = []; };
  }, [mapReady, shopReviews, shops]);

  // ── Base-Pins (Runner + Crew) als DOM-Marker ──
  const basePinMarkersRef = useRef<Array<{
    marker: mapboxgl.Marker;
    el: HTMLElement;
    stampEl: HTMLElement | null;
    silEl: HTMLElement | null;
    fullEl: HTMLElement | null;
    nameplate: HTMLElement | null;
    levelChip: HTMLElement | null;
  }>>([]);
  const onBasePinTapRef = useRef(onBasePinTap);
  useEffect(() => { onBasePinTapRef.current = onBasePinTap; }, [onBasePinTap]);
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    basePinMarkersRef.current.forEach((m) => m.marker.remove());
    basePinMarkersRef.current = [];

    basePins.forEach((pin) => {
      const el = document.createElement("div");
      el.className = "ma365-base-pin";
      el.setAttribute("data-kind", pin.kind);
      el.setAttribute("data-own", pin.is_own ? "1" : "0");
      el.style.cssText = "pointer-events:auto;will-change:transform;";

      const zoomWrap = document.createElement("div");
      zoomWrap.style.cssText = "position:relative;display:flex;align-items:center;justify-content:center;width:0;height:0";

      const scope = pin.kind === "runner" ? "runner" : "crew";
      const artPin = pin.theme_id ? baseThemeArt[`${pin.theme_id}_${scope}_pin`] : null;
      const artFallback = pin.theme_id ? baseThemeArt[`${pin.theme_id}_${scope}_banner`] : null;
      const art = artPin?.image_url || artPin?.video_url ? artPin : (artFallback?.image_url || artFallback?.video_url ? artFallback : null);

      // Crew-Farbe für SVG + Banner
      const ownColor = pin.pin_color || (pin.is_own ? "#22D1C3" : "#FF2D78");
      const ownDark = pin.kind === "crew" ? "#a01755" : "#0c8478";

      // Tower-Silhouette für mid-LOD — Burg-Form (Crew) bzw. Single-Tower (Runner)
      const SVG_CASTLE = `<svg viewBox="0 0 32 38" width="100%" height="100%" preserveAspectRatio="xMidYMax meet"><path d="M14 7 L18 7 L18 11 L22 11 L22 8 L25 8 L25 11 L28 11 L28 16 L26 16 L26 36 L18 36 L18 28 L14 28 L14 36 L6 36 L6 16 L4 16 L4 11 L7 11 L7 8 L10 8 L10 11 L14 11 Z" fill="${ownColor}" stroke="${ownDark}" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
      const SVG_RUNNER = `<svg viewBox="0 0 32 38" width="100%" height="100%" preserveAspectRatio="xMidYMax meet"><path d="M16 4 L13 7 L13 11 L11 13 L11 36 L21 36 L21 13 L19 11 L19 7 Z" fill="${ownColor}" stroke="${ownDark}" stroke-width="1.2" stroke-linejoin="round"/><rect x="14" y="18" width="4" height="5" fill="${ownDark}"/></svg>`;
      // Optionales Silhouette-Artwork (kann via Admin-Tab überschrieben werden)
      const silSlot = `base_silhouette_${scope}`;
      const silArt = uiIconArt[silSlot];
      const hasSilArt = !!(silArt?.image_url || silArt?.video_url);
      const silhouetteSvg = pin.kind === "crew" ? SVG_CASTLE : SVG_RUNNER;

      const dropShadow = `drop-shadow(0 0 8px ${pin.pin_color}cc) drop-shadow(0 3px 6px rgba(0,0,0,0.55))${pin.is_own ? " drop-shadow(0 0 4px #FFD700)" : ""}`;

      // ── Stage 1: STAMP — Mini-SVG-Silhouette (oder Mini-Artwork falls vorhanden)
      const stampEl = document.createElement("div");
      const stampSize = pin.kind === "crew" ? 22 : 18;
      stampEl.style.cssText = `position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:${stampSize}px;height:${Math.round(stampSize * 1.18)}px;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.6));cursor:pointer;pointer-events:auto;`;
      if (hasSilArt && silArt?.image_url) {
        stampEl.innerHTML = `<img src="${silArt.image_url}" alt="" style="width:100%;height:100%;object-fit:contain;filter:url(#ma365-chroma-black)"/>`;
      } else {
        stampEl.innerHTML = silhouetteSvg;
      }
      stampEl.addEventListener("click", (e) => {
        e.stopPropagation();
        onBasePinTapRef.current?.({ kind: pin.kind, id: pin.id, is_own: pin.is_own }, (e as MouseEvent).clientX, (e as MouseEvent).clientY);
      });
      zoomWrap.appendChild(stampEl);

      // ── Stage 2: SILHOUETTE — flacher Tower + LV-Chip + Name-Banner
      const silWrap = document.createElement("div");
      const silTowerSize = pin.kind === "crew" ? 52 : 44;
      silWrap.dataset.size = String(silTowerSize);
      silWrap.style.cssText = `position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:none;flex-direction:column;align-items:center;gap:1px;cursor:pointer;pointer-events:auto;filter:drop-shadow(0 2px 5px rgba(0,0,0,0.45));`;
      const silTower = document.createElement("div");
      silTower.style.cssText = `width:${silTowerSize}px;height:${Math.round(silTowerSize * 1.18)}px;`;
      if (hasSilArt && (silArt?.image_url || silArt?.video_url)) {
        silTower.innerHTML = silArt.image_url
          ? `<img src="${silArt.image_url}" alt="" style="width:100%;height:100%;object-fit:contain;filter:url(#ma365-chroma-black)"/>`
          : `<video src="${silArt.video_url}" autoplay loop muted playsinline style="width:100%;height:100%;object-fit:contain;filter:url(#ma365-chroma-black)"></video>`;
      } else {
        silTower.innerHTML = silhouetteSvg;
      }
      silWrap.appendChild(silTower);
      const silLv = document.createElement("div");
      silLv.style.cssText = `padding:1px 6px;border-radius:999px;background:linear-gradient(135deg,${ownColor},${ownDark});color:#0F1115;font-size:8px;font-weight:900;letter-spacing:0.5px;border:1px solid rgba(255,255,255,0.4);box-shadow:0 0 6px ${ownColor}aa;line-height:1.1;margin-top:-6px;position:relative;z-index:2;font-family:system-ui;`;
      silLv.textContent = String(pin.level);
      silWrap.appendChild(silLv);
      const silName = document.createElement("div");
      silName.style.cssText = `padding:1px 6px;border-radius:4px;background:rgba(0,0,0,0.12);color:#fff;font-size:9px;font-weight:900;letter-spacing:0.3px;white-space:nowrap;line-height:1.15;font-family:system-ui;margin-top:1px;text-shadow:0 1px 2px rgba(0,0,0,0.85);`;
      const silRawLabel = (pin.kind === "runner" && pin.owner_username) ? pin.owner_username : pin.pin_label;
      const silDisplayLabel = silRawLabel;
      silName.innerHTML = (pin.kind === "crew" ? "⚔️ " : "@") + escapeHtml(silDisplayLabel) + (pin.crew_tag ? ` <span style="color:${ownColor};font-weight:800;">[${escapeHtml(pin.crew_tag)}]</span>` : "");
      silWrap.appendChild(silName);
      silWrap.addEventListener("click", (e) => {
        e.stopPropagation();
        onBasePinTapRef.current?.({ kind: pin.kind, id: pin.id, is_own: pin.is_own }, (e as MouseEvent).clientX, (e as MouseEvent).clientY);
      });
      zoomWrap.appendChild(silWrap);

      // ── Stage 3: FULL — Artwork in konstanter Größe (passt ins Tile, nicht mehr 250px)
      const ART_SIZE = 300;
      const inner = document.createElement("div");
      inner.dataset.fullSize = String(ART_SIZE);
      inner.style.cssText = [
        "position:absolute","left:50%","top:50%","transform:translate(-50%,-50%)",
        "display:none","flex-direction:column","align-items:center","gap:0px",
        "cursor:pointer","user-select:none",
        "filter:drop-shadow(0 4px 8px rgba(0,0,0,0.5))",
      ].join(";");

      const visualBase = art?.image_url
        ? `<img src="${art.image_url}" alt="" style="position:relative;z-index:1;width:${ART_SIZE}px;height:${ART_SIZE}px;object-fit:contain;filter:url(#ma365-chroma-black) ${dropShadow};" />`
        : art?.video_url
        ? `<video src="${art.video_url}" autoplay loop muted playsinline style="position:relative;z-index:1;width:${ART_SIZE}px;height:${ART_SIZE}px;object-fit:contain;filter:url(#ma365-chroma-black) ${dropShadow};"></video>`
        : `<div style="position:relative;z-index:1;width:${ART_SIZE}px;height:${ART_SIZE}px;display:flex;align-items:center;justify-content:center;font-size:${Math.round(ART_SIZE * 0.83)}px;line-height:1;filter:${dropShadow};">${pin.pin_emoji}</div>`;

      const auraColors: Record<string, { primary: string; secondary: string; ring: string; speed: string }> = {
        advanced:  { primary: "#5ddaf0", secondary: "#22D1C3", ring: "rgba(93,218,240,0.35)", speed: "5s" },
        epic:      { primary: "#a855f7", secondary: "#FF2D78", ring: "rgba(168,85,247,0.5)",  speed: "4s" },
        legendary: { primary: "#FFD700", secondary: "#FF6B4A", ring: "rgba(255,215,0,0.6)",   speed: "3s" },
      };
      const aura = pin.theme_rarity ? auraColors[pin.theme_rarity] : null;
      const auraSize = Math.round(ART_SIZE * 0.7);
      const auraSizeBig = Math.round(ART_SIZE * 0.78);
      const auraHtml = aura
        ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-45%);width:${auraSize}px;height:${auraSize}px;border-radius:50%;background:radial-gradient(circle, ${aura.ring} 0%, transparent 65%);animation:basePinShimmer ${aura.speed} ease-in-out infinite;pointer-events:none;z-index:0"></div>
           ${pin.theme_rarity === "legendary" ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-45%);width:${auraSizeBig}px;height:${auraSizeBig}px;border-radius:50%;background:conic-gradient(from 0deg, ${aura.primary}55, transparent 30%, ${aura.secondary}55 60%, transparent 90%, ${aura.primary}55);opacity:0.45;animation:basePinAuraSpin 8s linear infinite;pointer-events:none;z-index:0"></div>` : ""}`
        : "";
      const visualHtml = `<div style="position:relative;display:flex;align-items:center;justify-content:center;width:${ART_SIZE}px;height:${ART_SIZE}px">${auraHtml}${visualBase}</div>`;

      const npArt = pin.nameplate_art;
      const npStyle = "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:170%;height:28px;max-width:200px;object-fit:cover;object-position:center;pointer-events:none;filter:url(#ma365-chroma-black) drop-shadow(0 2px 6px rgba(0,0,0,0.5));z-index:0";
      const npLayer = npArt?.image_url
        ? `<img src="${npArt.image_url}" alt="" style="${npStyle}" />`
        : npArt?.video_url
        ? `<video src="${npArt.video_url}" autoplay loop muted playsinline style="${npStyle}"></video>`
        : "";

      const lvColor = aura?.primary ?? pin.pin_color;
      const lvSecondary = aura?.secondary ?? pin.pin_color;
      // Runner-Marker-Icon über LV-Badge (nur eigene Runner-Base) — wenn der
      // Runner zu Hause ist, sitzt sein Map-Icon hier auf der Base.
      const showRunnerOnBase = pin.is_own && pin.kind === "runner";
      const RUNNER_BADGE_SIZE = 64;
      const runnerBadge = showRunnerOnBase
        ? `<div style="
              position:relative;z-index:3;margin-top:-65px;
              width:${RUNNER_BADGE_SIZE}px;height:${RUNNER_BADGE_SIZE}px;border-radius:50%;
              display:flex;align-items:center;justify-content:center;
              background:radial-gradient(circle at 35% 30%, ${pin.pin_color}, rgba(15,17,21,0.92));
              border:3px solid rgba(255,255,255,0.95);
              box-shadow:0 0 18px ${pin.pin_color}cc, 0 4px 10px rgba(0,0,0,0.65);
            ">${
              markerArt?.video_url
                ? `<video src="${markerArt.video_url}" autoplay loop muted playsinline style="width:${RUNNER_BADGE_SIZE - 14}px;height:${RUNNER_BADGE_SIZE - 14}px;object-fit:contain;"></video>`
                : markerArt?.image_url
                  ? `<img src="${markerArt.image_url}" alt="" style="width:${RUNNER_BADGE_SIZE - 14}px;height:${RUNNER_BADGE_SIZE - 14}px;object-fit:contain;" />`
                  : `<span style="font-size:${RUNNER_BADGE_SIZE - 30}px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.6));">${myEmoji}</span>`
            }</div>`
        : "";
      // Display-Name auf Runner-Pin: owner_username (echter Name) bevorzugt vor pin_label (z.B. "Homebase").
      // Volle Länge (max 15 Zeichen) wird angezeigt — keine Truncation.
      const rawLabel = (pin.kind === "runner" && pin.owner_username) ? pin.owner_username : pin.pin_label;
      const displayLabel = rawLabel;
      inner.innerHTML = `
        ${visualHtml}
        ${runnerBadge}
        <div style="position:relative;display:inline-flex;align-items:center;justify-content:center;height:24px;min-width:60px;margin-top:${showRunnerOnBase ? "4px" : "-8px"}">
          ${npLayer}
          <div data-nameplate style="
            position:relative;z-index:1;transform-origin:center center;
            padding:1px 6px;border-radius:4px;
            background:rgba(0,0,0,0.12);color:#fff;
            font-size:10px;font-weight:800;letter-spacing:0.5px;
            white-space:nowrap;
            line-height:1.2;
            text-shadow:0 1px 2px rgba(0,0,0,0.85);
            font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,sans-serif;
          ">${pin.kind === "crew" ? "⚔️ " : "@"}${escapeHtml(displayLabel)}${pin.crew_tag ? ` <span style="color:${pin.pin_color};">[${escapeHtml(pin.crew_tag)}]</span>` : ""}</div>
        </div>
        <div data-levelchip style="
          padding:2px 9px;border-radius:999px;transform-origin:center top;
          background:linear-gradient(135deg, ${lvColor}, ${lvSecondary}cc);
          color:#0F1115;font-size:10px;font-weight:900;letter-spacing:0.5px;
          border:1px solid rgba(255,255,255,0.4);
          box-shadow:0 0 8px ${lvColor}aa, inset 0 1px 0 rgba(255,255,255,0.35);
          text-shadow:0 1px 0 rgba(255,255,255,0.25);
          line-height:1.1;
          margin-top:3px;position:relative;z-index:2;
          font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,sans-serif;
        ">${pin.level}</div>
      `;
      zoomWrap.appendChild(inner);
      el.appendChild(zoomWrap);

      inner.addEventListener("click", (e) => {
        e.stopPropagation();
        onBasePinTapRef.current?.({ kind: pin.kind, id: pin.id, is_own: pin.is_own }, (e as MouseEvent).clientX, (e as MouseEvent).clientY);
      });
      // KEIN Hover-Scale: würde an den Rändern Cursor wegschieben → mouseleave →
      // zurückskalieren → mouseenter-Loop = Zitter-Bug.

      // anchor:"center" → das Icon (mittleres Element) sitzt exakt auf lat/lng,
      // LV-Chip schwebt darüber, Name-Chip darunter. Wir korrigieren den Offset
      // so dass das Icon-Zentrum am Punkt sitzt (LV-Chip ~16px hoch + 3px gap).
      const marker = new mapboxgl.Marker({ element: el, anchor: "center", offset: [0, 0] })
        .setLngLat([pin.lng, pin.lat])
        .addTo(map);
      // Child-Refs einmalig cachen — in updateBasePinVisibility wird sonst
      // pro Zoom-Frame & Marker mehrfach querySelector ausgeführt.
      const zw = el.firstElementChild as HTMLElement | null;
      const cachedStamp = (zw?.children[0] as HTMLElement | undefined) ?? null;
      const cachedSil   = (zw?.children[1] as HTMLElement | undefined) ?? null;
      const cachedFull  = (zw?.children[2] as HTMLElement | undefined) ?? null;
      basePinMarkersRef.current.push({
        marker, el,
        stampEl: cachedStamp,
        silEl: cachedSil,
        fullEl: cachedFull,
        nameplate: (cachedFull?.querySelector("[data-nameplate]") as HTMLElement | null) ?? null,
        levelChip: (cachedFull?.querySelector("[data-levelchip]") as HTMLElement | null) ?? null,
      });
    });

    // 3-Stage LOD wie CoD — KEIN kontinuierliches Skalieren mehr,
    // jeder Stage hat konstante Pixel-Größe:
    //   z < 12       hidden  (Polygon übernimmt)
    //   z 12-14      STAMP   (~18px Mini-Tower)
    //   z 14-16      SIL     (~50px flache Tower-Silhouette + LV + Banner)
    //   z >= 16      FULL    (110px Artwork + LV + Banner)
    let lastZ = -1;
    let lastStage = ""; // "hidden" | "stamp" | "sil" | "full"
    let lastFullScale = -1;
    const updateBasePinVisibility = () => {
      const z = map.getZoom();
      // Skip wenn Zoom-Delta < 0.005 — passiert bei jedem Pan/Tilt-Update
      if (Math.abs(z - lastZ) < 0.005) return;
      lastZ = z;

      const stage = z < 12 ? "hidden" : z < 14 ? "stamp" : z >= 16 ? "full" : "sil";
      const stageChanged = stage !== lastStage;

      // Full-Stage-Scale berechnen (auch wenn Stage gleich, ändert sich Scale)
      let s = 1.0;
      if (stage === "full") {
        if      (z < 17)   s = 0.55 + ((z - 16) / 1) * 0.30;
        else if (z < 18)   s = 0.85 + ((z - 17) / 1) * 0.15;
        else               s = 1.0  + Math.min(0.15, (z - 18) * 0.075);
      }
      const scaleChanged = stage === "full" && Math.abs(s - lastFullScale) > 0.005;
      if (!stageChanged && !scaleChanged) return;
      lastStage = stage;
      if (stage === "full") lastFullScale = s;

      const transformStr = `translate(-50%, -50%) scale(${s.toFixed(2)})`;
      const inv = (1 / s).toFixed(3);
      const invStr = `scale(${inv})`;

      basePinMarkersRef.current.forEach((m) => {
        const { el, stampEl, silEl, fullEl, nameplate, levelChip } = m;
        if (!stampEl || !silEl || !fullEl) return;
        if (stageChanged) {
          if (stage === "hidden") {
            el.style.opacity = "0";
            el.style.visibility = "hidden";
            el.style.pointerEvents = "none";
            return;
          }
          el.style.opacity = "1";
          el.style.visibility = "visible";
          el.style.pointerEvents = "auto";
          el.style.transition = "opacity 0.25s";
          stampEl.style.display = stage === "stamp" ? "block" : "none";
          silEl.style.display   = stage === "sil"   ? "flex"  : "none";
          fullEl.style.display  = stage === "full"  ? "flex"  : "none";
        }
        if (stage === "full" && (scaleChanged || stageChanged)) {
          fullEl.style.transform = transformStr;
          if (nameplate) nameplate.style.transform = invStr;
          if (levelChip) levelChip.style.transform = invStr;
        }
      });
    };
    updateBasePinVisibility();
    const updateBasePinVisibilityThrottled = rafThrottle(updateBasePinVisibility);
    map.on("zoom", updateBasePinVisibilityThrottled);

    return () => {
      map.off("zoom", updateBasePinVisibilityThrottled);
      updateBasePinVisibilityThrottled.cancel();
      basePinMarkersRef.current.forEach((m) => m.marker.remove());
      basePinMarkersRef.current = [];
    };
  }, [mapReady, basePins, baseThemeArt, uiIconArt, markerArt, myEmoji]);

  // ── Crew-Turf: Polygons (fill) ──────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    const sourceId = "crew-turf";
    const fillId = "crew-turf-fill";
    const strokeId = "crew-turf-stroke";

    const features = (crewTurfPolygons ?? []).map((p) => {
      // Crew-eigene Farbe (Settings) > Default. Eigene Crew immer kräftig,
      // fremde mit reduzierter Opacity damit eigene Turfs visuell dominieren.
      const color = p.territory_color || (p.is_own ? "#22D1C3" : "#FF2D78");
      return {
        type: "Feature" as const,
        geometry: p.geojson,
        properties: {
          crew_id: p.crew_id,
          is_own: p.is_own,
          color,
          fill_opacity: p.is_own ? 0.22 : 0.10,
          line_opacity: p.is_own ? 0.9 : 0.45,
        },
      };
    });
    const data = { type: "FeatureCollection" as const, features };

    const existing = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(data);
    } else {
      map.addSource(sourceId, { type: "geojson", data });
      map.addLayer({
        id: fillId,
        type: "fill",
        source: sourceId,
        paint: {
          "fill-color": ["get", "color"],
          "fill-opacity": ["get", "fill_opacity"],
          "fill-emissive-strength": 0.4,
        } as mapboxgl.FillLayerSpecification["paint"],
      });
      map.addLayer({
        id: strokeId,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": ["get", "color"],
          "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.2, 16, 2.4, 19, 3.5],
          "line-opacity": ["get", "line_opacity"],
          "line-emissive-strength": 1.0,
        } as mapboxgl.LineLayerSpecification["paint"],
      });
    }
  }, [mapReady, crewTurfPolygons]);

  // ── Crew-Blocks (Phase 3): kontrollierte Stadt-Blocks pro Crew ──
  // Wenn crewBlocks-Daten existieren, wird die Kreis-Turf-Layer (oben) ausgeblendet.
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    const sourceId = "crew-blocks";
    const fillId = "crew-blocks-fill";
    const strokeId = "crew-blocks-stroke";
    const contestedId = "crew-blocks-contested";

    const features = (crewBlocks ?? []).map((b) => ({
      type: "Feature" as const,
      geometry: b.geojson,
      properties: {
        block_id: b.block_id,
        crew_id: b.crew_id,
        is_own: b.is_own,
        is_contested: b.is_contested,
        color: b.territory_color,
        fill_opacity: b.is_own ? 0.32 : 0.18,
        line_opacity: b.is_own ? 0.95 : 0.6,
      },
    }));
    const data = { type: "FeatureCollection" as const, features };

    if (map.getSource(sourceId)) {
      (map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(data);
    } else {
      map.addSource(sourceId, { type: "geojson", data });
      map.addLayer({
        id: fillId, type: "fill", source: sourceId,
        paint: {
          "fill-color": ["get", "color"],
          "fill-opacity": ["get", "fill_opacity"],
          "fill-emissive-strength": 0.5,
        } as mapboxgl.FillLayerSpecification["paint"],
      });
      map.addLayer({
        id: strokeId, type: "line", source: sourceId,
        paint: {
          "line-color": ["get", "color"],
          "line-width": ["interpolate", ["linear"], ["zoom"], 12, 1.5, 17, 3, 19, 4.5],
          "line-opacity": ["get", "line_opacity"],
          "line-emissive-strength": 1.0,
        } as mapboxgl.LineLayerSpecification["paint"],
      });
      // Konflikt-Layer: zusätzliche dashed-Border für umkämpfte Blocks
      map.addLayer({
        id: contestedId, type: "line", source: sourceId,
        filter: ["==", ["get", "is_contested"], true],
        paint: {
          "line-color": "#FFFFFF",
          "line-width": 2,
          "line-opacity": 0.8,
          "line-dasharray": [3, 2],
        } as mapboxgl.LineLayerSpecification["paint"],
      });
    }

    // Wenn Blocks existieren, Kreis-Turf-Layer dimmen (sichtbar bleiben für Crews ohne Block-Match)
    const circleFillVisible = features.length === 0 ? "visible" : "none";
    if (map.getLayer("crew-turf-fill")) map.setLayoutProperty("crew-turf-fill", "visibility", circleFillVisible);
    if (map.getLayer("crew-turf-stroke")) map.setLayoutProperty("crew-turf-stroke", "visibility", circleFillVisible);
  }, [mapReady, crewBlocks]);

  // ── Placement-Preview-Layer: Coverage-Kreise beim Repeater-Setzen ──
  // Zeigt: (a) alle eigenen existierenden Coverages (cyan ghost), (b) Cursor-Kreis
  // in Crew-Farbe für den neuen Repeater. Chain-Rule wird visuell — der Cursor-Kreis
  // muss einen ghost-Kreis berühren damit "Setzen" erlaubt ist.
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    const ghostSource = "placement-preview-ghosts";
    const ghostFill = "placement-preview-ghosts-fill";
    const ghostStroke = "placement-preview-ghosts-stroke";
    const cursorSource = "placement-preview-cursor";
    const cursorFill = "placement-preview-cursor-fill";
    const cursorStroke = "placement-preview-cursor-stroke";
    // Block-Mode-Layers (Phase 3)
    const blocksAllSource = "placement-preview-blocks-all";
    const blocksAllFill = "placement-preview-blocks-all-fill";
    const blocksAllStroke = "placement-preview-blocks-all-stroke";
    const blocksHomeSource = "placement-preview-blocks-home";
    const blocksHomeFill = "placement-preview-blocks-home-fill";
    const blocksHomeStroke = "placement-preview-blocks-home-stroke";

    // Helper: Punkt + Radius (m) → GeoJSON-Kreis-Polygon (64-edge)
    const circleGeoJSON = (lat: number, lng: number, radiusM: number): GeoJSON.Polygon => {
      const points: [number, number][] = [];
      const earthR = 6371000;
      const angDist = radiusM / earthR;
      const latRad = (lat * Math.PI) / 180;
      const lngRad = (lng * Math.PI) / 180;
      for (let i = 0; i <= 64; i++) {
        const brng = (i / 64) * 2 * Math.PI;
        const newLat = Math.asin(Math.sin(latRad) * Math.cos(angDist) + Math.cos(latRad) * Math.sin(angDist) * Math.cos(brng));
        const newLng = lngRad + Math.atan2(Math.sin(brng) * Math.sin(angDist) * Math.cos(latRad), Math.cos(angDist) - Math.sin(latRad) * Math.sin(newLat));
        points.push([(newLng * 180) / Math.PI, (newLat * 180) / Math.PI]);
      }
      return { type: "Polygon", coordinates: [points] };
    };

    const removeAllPreviewLayers = () => {
      [cursorStroke, cursorFill, ghostStroke, ghostFill,
       blocksHomeStroke, blocksHomeFill, blocksAllStroke, blocksAllFill].forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id);
      });
      [cursorSource, ghostSource, blocksHomeSource, blocksAllSource].forEach((id) => {
        if (map.getSource(id)) map.removeSource(id);
      });
    };

    if (!placementPreview) {
      removeAllPreviewLayers();
      return;
    }

    // ─── BLOCK-MODE (Phase 3) ─────────────────────────────────────
    // Wenn allBlocks gesetzt: Block-Polygone als transparenter Layer +
    // Home-Block (am Cursor) als gefüllter Polygon in Crew-Farbe.
    // Mouse-Move triggert queryRenderedFeatures auf den Block-Layer
    // → Home-Block ändern, Layer aktualisieren.
    const useBlockMode = !!(placementPreview.allBlocks && placementPreview.allBlocks.length > 0);

    if (useBlockMode) {
      // 1) Alle Blocks als transparenter Layer (für queryRenderedFeatures)
      const allFeatures = placementPreview.allBlocks!.map((b) => ({
        type: "Feature" as const,
        id: b.block_id,
        geometry: b.geojson,
        properties: { block_id: b.block_id, street_class: b.street_class ?? null },
      }));
      const allData = { type: "FeatureCollection" as const, features: allFeatures };
      if (map.getSource(blocksAllSource)) {
        (map.getSource(blocksAllSource) as mapboxgl.GeoJSONSource).setData(allData);
      } else {
        map.addSource(blocksAllSource, { type: "geojson", data: allData });
        map.addLayer({
          id: blocksAllFill, type: "fill", source: blocksAllSource,
          paint: {
            "fill-color": placementPreview.color,
            "fill-opacity": 0.05,  // sehr transparent — nur für Hover-Detection
          } as mapboxgl.FillLayerSpecification["paint"],
        });
        map.addLayer({
          id: blocksAllStroke, type: "line", source: blocksAllSource,
          paint: {
            "line-color": placementPreview.color,
            "line-width": 1,
            "line-opacity": 0.4,
            "line-dasharray": [3, 3],
          } as mapboxgl.LineLayerSpecification["paint"],
        });
      }

      // 2) Home-Block am Cursor — über Lat/Lng-Punkt-in-Polygon-Check
      const c = placementPreview.cursor;
      const homeFeature = c
        ? placementPreview.allBlocks!.find((b) => pointInGeoJSONPolygon(c.lat, c.lng, b.geojson))
        : null;
      const homeData = {
        type: "FeatureCollection" as const,
        features: homeFeature ? [{
          type: "Feature" as const,
          geometry: homeFeature.geojson,
          properties: { block_id: homeFeature.block_id },
        }] : [],
      };
      if (map.getSource(blocksHomeSource)) {
        (map.getSource(blocksHomeSource) as mapboxgl.GeoJSONSource).setData(homeData);
      } else {
        map.addSource(blocksHomeSource, { type: "geojson", data: homeData });
        map.addLayer({
          id: blocksHomeFill, type: "fill", source: blocksHomeSource,
          paint: {
            "fill-color": placementPreview.color,
            "fill-opacity": 0.45,
            "fill-emissive-strength": 0.6,
          } as mapboxgl.FillLayerSpecification["paint"],
        });
        map.addLayer({
          id: blocksHomeStroke, type: "line", source: blocksHomeSource,
          paint: {
            "line-color": placementPreview.color,
            "line-width": 3,
            "line-opacity": 0.95,
            "line-emissive-strength": 1.0,
          } as mapboxgl.LineLayerSpecification["paint"],
        });
      }

      // Kreis-Layer aus dem Fallback-Mode entfernen (falls aktiv)
      [cursorStroke, cursorFill, ghostStroke, ghostFill].forEach((id) => { if (map.getLayer(id)) map.removeLayer(id); });
      [cursorSource, ghostSource].forEach((id) => { if (map.getSource(id)) map.removeSource(id); });

      const onMove = (e: mapboxgl.MapMouseEvent) => {
        onPlacementHover?.(e.lngLat.lng, e.lngLat.lat);
      };
      const onClick = (e: mapboxgl.MapMouseEvent) => {
        e.preventDefault();
        onPlacementConfirm?.(e.lngLat.lng, e.lngLat.lat);
      };
      map.on("mousemove", onMove);
      map.on("click", onClick);
      map.getCanvas().style.cursor = "crosshair";

      return () => {
        map.off("mousemove", onMove);
        map.off("click", onClick);
        map.getCanvas().style.cursor = "";
        removeAllPreviewLayers();
      };
    }

    // ─── KREIS-MODE (Fallback ohne Block-Daten) ─────────────────────
    const ghostFeatures = placementPreview.ownRepeaters.map((r) => ({
      type: "Feature" as const,
      geometry: circleGeoJSON(r.lat, r.lng, r.radius_m),
      properties: {},
    }));
    const ghostData = { type: "FeatureCollection" as const, features: ghostFeatures };

    if (map.getSource(ghostSource)) {
      (map.getSource(ghostSource) as mapboxgl.GeoJSONSource).setData(ghostData);
    } else {
      map.addSource(ghostSource, { type: "geojson", data: ghostData });
      map.addLayer({
        id: ghostFill, type: "fill", source: ghostSource,
        paint: {
          "fill-color": placementPreview.color,
          "fill-opacity": 0.10,
        } as mapboxgl.FillLayerSpecification["paint"],
      });
      map.addLayer({
        id: ghostStroke, type: "line", source: ghostSource,
        paint: {
          "line-color": placementPreview.color,
          "line-width": 2,
          "line-opacity": 0.55,
          "line-dasharray": [2, 2],
        } as mapboxgl.LineLayerSpecification["paint"],
      });
    }

    // Cursor-Kreis (folgt Maus/Tap)
    const c = placementPreview.cursor;
    const cursorData = {
      type: "FeatureCollection" as const,
      features: c ? [{
        type: "Feature" as const,
        geometry: circleGeoJSON(c.lat, c.lng, placementPreview.newRadius_m),
        properties: {},
      }] : [],
    };
    if (map.getSource(cursorSource)) {
      (map.getSource(cursorSource) as mapboxgl.GeoJSONSource).setData(cursorData);
    } else {
      map.addSource(cursorSource, { type: "geojson", data: cursorData });
      map.addLayer({
        id: cursorFill, type: "fill", source: cursorSource,
        paint: {
          "fill-color": placementPreview.color,
          "fill-opacity": 0.25,
          "fill-emissive-strength": 0.6,
        } as mapboxgl.FillLayerSpecification["paint"],
      });
      map.addLayer({
        id: cursorStroke, type: "line", source: cursorSource,
        paint: {
          "line-color": placementPreview.color,
          "line-width": 3,
          "line-opacity": 0.95,
          "line-emissive-strength": 1.0,
        } as mapboxgl.LineLayerSpecification["paint"],
      });
    }

    // Mouse-Move auf Map → onPlacementHover (für live Cursor-Update)
    const onMove = (e: mapboxgl.MapMouseEvent) => {
      onPlacementHover?.(e.lngLat.lng, e.lngLat.lat);
    };
    const onClick = (e: mapboxgl.MapMouseEvent) => {
      e.preventDefault();
      onPlacementConfirm?.(e.lngLat.lng, e.lngLat.lat);
    };
    map.on("mousemove", onMove);
    map.on("click", onClick);
    map.getCanvas().style.cursor = "crosshair";

    return () => {
      map.off("mousemove", onMove);
      map.off("click", onClick);
      map.getCanvas().style.cursor = "";
      removeAllPreviewLayers();
    };
  }, [mapReady, placementPreview, onPlacementHover, onPlacementConfirm]);

  // ── Crew-Turf: Repeater-DOM-Marker ──────────────────────────
  const repeaterMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const lastRepeaterArtHashRef = useRef<string>("");
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    const seen = new Set<string>();
    // uiIconArt-Hash: wenn sich Artwork ändert, Marker neu bauen damit das Bild geladen wird
    const artHash = JSON.stringify({
      hq:  uiIconArt["repeater_hq"]?.image_url ?? uiIconArt["repeater_hq"]?.video_url ?? "",
      mg:  uiIconArt["repeater_mega"]?.image_url ?? uiIconArt["repeater_mega"]?.video_url ?? "",
      no:  uiIconArt["repeater_normal"]?.image_url ?? uiIconArt["repeater_normal"]?.video_url ?? "",
      shq: uiIconArt["repeater_silhouette_hq"]?.image_url     ?? uiIconArt["repeater_silhouette_hq"]?.video_url     ?? "",
      smg: uiIconArt["repeater_silhouette_mega"]?.image_url   ?? uiIconArt["repeater_silhouette_mega"]?.video_url   ?? "",
      sno: uiIconArt["repeater_silhouette_normal"]?.image_url ?? uiIconArt["repeater_silhouette_normal"]?.video_url ?? "",
    });
    if (lastRepeaterArtHashRef.current !== artHash) {
      // Artwork hat sich geändert → alle Marker entsorgen, neu bauen unten
      for (const m of repeaterMarkersRef.current.values()) m.remove();
      repeaterMarkersRef.current.clear();
      lastRepeaterArtHashRef.current = artHash;
    }
    for (const r of crewRepeaters ?? []) {
      seen.add(r.id);
      const existing = repeaterMarkersRef.current.get(r.id);
      if (existing) {
        existing.setLngLat([r.lng, r.lat]);
        continue;
      }
      // Pattern wie basePins: el = blanker Mapbox-Anker (kein size/transform),
      // zoomWrap = firstElementChild für manuellen Zoom-Scale via map.on("zoom"),
      // pin = der eigentliche Visual-Container mit fester Pixel-Größe.
      // Kein wrapForZoomScale, damit nichts mit dem globalen [data-zoom-scale]-System
      // konkurriert oder unsynchron schreibt.
      const el = document.createElement("div");
      el.style.cssText = "pointer-events:none; will-change:transform;";

      const zoomWrap = document.createElement("div");
      zoomWrap.style.cssText = "display:flex;align-items:center;justify-content:center;transform-origin:center center;will-change:transform;backface-visibility:hidden;";

      const isHQ = r.kind === "hq";
      const isMega = r.kind === "mega";
      const slot = isHQ ? "repeater_hq" : isMega ? "repeater_mega" : "repeater_normal";
      const art = uiIconArt[slot];
      const hasArt = !!(art?.video_url || art?.image_url);

      const ownColor = r.is_own ? "#22D1C3" : "#FF2D78";
      const ownDark  = r.is_own ? "#0c8478" : "#a01755";

      // SVG-Silhouetten für das Mid-LOD (CoD-Style flache mono-Tower-Icons)
      const SVG_HQ = `<svg viewBox="0 0 32 38" width="100%" height="100%" preserveAspectRatio="xMidYMax meet"><path d="M16 2 L18 5 L16 7 L14 5 Z M14 7 L18 7 L18 11 L22 11 L22 8 L25 8 L25 11 L28 11 L28 16 L26 16 L26 36 L18 36 L18 28 L14 28 L14 36 L6 36 L6 16 L4 16 L4 11 L7 11 L7 8 L10 8 L10 11 L14 11 Z" fill="${ownColor}" stroke="${ownDark}" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
      const SVG_MEGA = `<svg viewBox="0 0 32 38" width="100%" height="100%" preserveAspectRatio="xMidYMax meet"><path d="M16 2 L14 4 L14 7 L11 7 L11 10 L13 10 L13 13 L10 16 L10 36 L22 36 L22 16 L19 13 L19 10 L21 10 L21 7 L18 7 L18 4 Z" fill="${ownColor}" stroke="${ownDark}" stroke-width="1.2" stroke-linejoin="round"/><circle cx="16" cy="3" r="1.5" fill="${ownDark}"/></svg>`;
      const SVG_REPEATER = `<svg viewBox="0 0 32 38" width="100%" height="100%" preserveAspectRatio="xMidYMax meet"><path d="M16 4 L13 7 L13 14 L9 18 L9 36 L23 36 L23 18 L19 14 L19 7 Z" fill="${ownColor}" stroke="${ownDark}" stroke-width="1.2" stroke-linejoin="round"/><rect x="14" y="20" width="4" height="6" fill="${ownDark}"/></svg>`;
      // Optionales Silhouette-Artwork (überschreibt SVG falls vorhanden)
      const silSlot = isHQ ? "repeater_silhouette_hq" : isMega ? "repeater_silhouette_mega" : "repeater_silhouette_normal";
      const silArt = uiIconArt[silSlot];
      const silImg = silArt?.image_url || silArt?.video_url ? silArt : null;
      const silSvg = isHQ ? SVG_HQ : isMega ? SVG_MEGA : SVG_REPEATER;
      const silhouetteSvg = silImg?.image_url
        ? `<img src="${silImg.image_url}" alt="" style="width:100%;height:100%;object-fit:contain;filter:url(#ma365-chroma-black)"/>`
        : silImg?.video_url
        ? `<video src="${silImg.video_url}" autoplay loop muted playsinline style="width:100%;height:100%;object-fit:contain;filter:url(#ma365-chroma-black)"></video>`
        : silSvg;

      // ── 3-Stage LOD wie CoD ─────────────────────────────────────────
      //   stamp:      winziger Mini-Tower (no banner)
      //   silhouette: flache mono-Tower-Silhouette + Crew-Banner unter dem Sockel
      //   full:       echtes Artwork + Crew-Banner
      const pin = document.createElement("div");
      pin.style.cssText = `
        position:relative;
        width:0; height:0;
        display:flex; align-items:center; justify-content:center;
      `;

      // Stage 1: STAMP — Mini-Tower-Silhouette (selber SVG, sehr klein)
      const stampEl = document.createElement("div");
      const stampSize = isHQ ? 20 : isMega ? 17 : 14;
      stampEl.style.cssText = `
        position:absolute; left:50%; top:50%;
        transform:translate(-50%, -50%);
        width:${stampSize}px; height:${Math.round(stampSize * 1.18)}px;
        filter:drop-shadow(0 1px 2px rgba(0,0,0,0.55));
        cursor:pointer; pointer-events:auto;
      `;
      stampEl.innerHTML = silhouetteSvg;
      stampEl.addEventListener("click", (ev) => {
        ev.stopPropagation();
        onRepeaterClick?.(r.id, (ev as MouseEvent).clientX, (ev as MouseEvent).clientY);
      });
      pin.appendChild(stampEl);

      // Stage 2: SILHOUETTE — flache farbige Tower-Silhouette (KEIN Artwork)
      const silEl = document.createElement("div");
      const silSize = isHQ ? 48 : isMega ? 40 : 34;
      silEl.dataset.size = String(silSize);
      silEl.style.cssText = `
        position:absolute; left:50%; top:50%;
        transform:translate(-50%, -50%);
        width:${silSize}px; height:${Math.round(silSize * 1.18)}px;
        display:none;
        filter:drop-shadow(0 2px 5px rgba(0,0,0,0.45));
        cursor:pointer; pointer-events:auto;
      `;
      silEl.innerHTML = silhouetteSvg;
      silEl.addEventListener("click", (ev) => {
        ev.stopPropagation();
        onRepeaterClick?.(r.id, (ev as MouseEvent).clientX, (ev as MouseEvent).clientY);
      });
      pin.appendChild(silEl);

      // Stage 3: FULL — Artwork (oder stilisierte Tile als Fallback)
      const artEl = document.createElement("div");
      const fullArtSize = isHQ ? 150 : isMega ? 120 : 120;
      artEl.dataset.fullSize = String(fullArtSize);
      artEl.style.cssText = `
        position:absolute; left:50%; top:50%;
        transform:translate(-50%, -50%);
        width:${fullArtSize}px; height:${fullArtSize}px;
        display:none;
        align-items:center; justify-content:center;
        filter:drop-shadow(0 4px 14px ${r.is_own ? "rgba(34,209,195,0.65)" : "rgba(255,45,120,0.65)"})
               drop-shadow(0 0 10px ${r.is_own ? "rgba(34,209,195,0.45)" : "rgba(255,45,120,0.45)"});
      `;
      if (hasArt) {
        if (art?.video_url) {
          const v = document.createElement("video");
          v.src = art.video_url; v.autoplay = true; v.loop = true; v.muted = true;
          v.setAttribute("playsinline", "");
          v.style.cssText = `width:100%; height:100%; object-fit:contain; filter:url(#ma365-chroma-black); pointer-events:none;`;
          artEl.appendChild(v);
        } else if (art?.image_url) {
          const img = document.createElement("img");
          img.src = art.image_url; img.alt = "";
          img.style.cssText = `width:100%; height:100%; object-fit:contain; filter:url(#ma365-chroma-black); pointer-events:none;`;
          artEl.appendChild(img);
        }
        const hit = document.createElement("div");
        hit.style.cssText = `
          position:absolute; left:50%; top:50%; transform:translate(-50%, -50%);
          width:44px; height:44px; border-radius:50%;
          cursor:pointer; pointer-events:auto; z-index:5;
        `;
        hit.addEventListener("click", (ev) => {
          ev.stopPropagation();
          onRepeaterClick?.(r.id, (ev as MouseEvent).clientX, (ev as MouseEvent).clientY);
        });
        artEl.appendChild(hit);
      } else {
        // Ohne Artwork: vergrößerte Silhouette als Fallback
        const sil2 = document.createElement("div");
        sil2.style.cssText = `width:${fullArtSize * 0.8}px; height:${fullArtSize * 0.95}px; cursor:pointer; pointer-events:auto;`;
        sil2.innerHTML = silhouetteSvg;
        sil2.addEventListener("click", (ev) => {
          ev.stopPropagation();
          onRepeaterClick?.(r.id, (ev as MouseEvent).clientX, (ev as MouseEvent).clientY);
        });
        artEl.appendChild(sil2);
      }
      pin.appendChild(artEl);

      // Kein Nameplate auf Repeatern — alle Infos kommen via Klick auf den Tower (Modal).

      zoomWrap.appendChild(pin);
      el.appendChild(zoomWrap);

      const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([r.lng, r.lat])
        .addTo(map);
      repeaterMarkersRef.current.set(r.id, marker);
    }
    // Marker entfernen die nicht mehr da sind
    for (const [id, marker] of repeaterMarkersRef.current.entries()) {
      if (!seen.has(id)) { marker.remove(); repeaterMarkersRef.current.delete(id); }
    }

    // 3-Stage LOD wie CoD:
    //   z < 12      hidden  (Polygon übernimmt)
    //   z 12-14     STAMP   (Mini-Tower-Silhouette)
    //   z 14-16     SIL     (flache mono-Tower-Silhouette + Banner)
    //   z >= 16     FULL    (volles Artwork + Banner)
    let lastZ = -1;
    let lastStage = "";
    let lastFullScale = -1;
    const updateRepeaterLOD = () => {
      const z = map.getZoom();
      // Skip wenn Zoom-Delta minimal ist (Pan/Tilt)
      if (Math.abs(z - lastZ) < 0.005) return;
      lastZ = z;

      const stage = z < 12 ? "hidden" : z < 14 ? "stamp" : z >= 16 ? "full" : "sil";
      const stageChanged = stage !== lastStage;
      let s = 1.0;
      if (stage === "full") {
        if      (z < 17)   s = 0.55 + ((z - 16) / 1) * 0.30;
        else if (z < 18)   s = 0.85 + ((z - 17) / 1) * 0.15;
        else               s = 1.0  + Math.min(0.15, (z - 18) * 0.075);
      }
      const scaleChanged = stage === "full" && Math.abs(s - lastFullScale) > 0.005;
      if (!stageChanged && !scaleChanged) return;
      lastStage = stage;
      if (stage === "full") lastFullScale = s;

      for (const m of repeaterMarkersRef.current.values()) {
        const el = m.getElement();
        const pin = (el.firstElementChild as HTMLElement | null)?.firstElementChild as HTMLElement | null;
        if (!pin) continue;
        const stampEl  = pin.children[0] as HTMLElement | undefined;
        const silEl    = pin.children[1] as HTMLElement | undefined;
        const artEl    = pin.children[2] as HTMLElement | undefined;
        const banner   = pin.children[3] as HTMLElement | undefined;
        if (!stampEl || !silEl || !artEl) continue;

        if (z < 12) {
          el.style.opacity = "0";
          el.style.pointerEvents = "none";
          continue;
        }
        el.style.opacity = "1";
        el.style.pointerEvents = "auto";

        const stamp = z < 14;
        const full  = z >= 16;
        const sil   = !stamp && !full;

        stampEl.style.display = stamp ? "block" : "none";
        silEl.style.display   = sil   ? "block" : "none";
        artEl.style.display   = full  ? "flex"  : "none";

        // Zoom-Skalierung im FULL-Stage des Repeaters
        if (full) {
          let s = 1.0;
          if      (z < 17)   s = 0.55 + ((z - 16) / 1) * 0.30;
          else if (z < 18)   s = 0.85 + ((z - 17) / 1) * 0.15;
          else               s = 1.0  + Math.min(0.15, (z - 18) * 0.075);
          artEl.style.transform = `translate(-50%, -50%) scale(${s.toFixed(2)})`;
        }

        if (banner) {
          const showBanner = (sil || full) && (banner.dataset.label ?? "").length > 0;
          banner.style.display = showBanner ? "block" : "none";
          // Banner unter dem aktuellen Sockel positionieren
          if (showBanner) {
            const baseHeight = sil
              ? Math.round(parseInt(silEl.dataset.size ?? "44", 10) * 1.18)
              : parseInt(artEl.dataset.fullSize ?? "90", 10);
            // top:50% + halbe Sockelhöhe + 4px Abstand
            banner.style.top = `calc(50% + ${Math.round(baseHeight / 2) + 4}px)`;
          }
        }
      }
    };
    updateRepeaterLOD();
    const updateRepeaterLODThrottled = rafThrottle(updateRepeaterLOD);
    map.on("zoom", updateRepeaterLODThrottled);
    return () => {
      map.off("zoom", updateRepeaterLODThrottled);
      updateRepeaterLODThrottled.cancel();
    };
  }, [mapReady, crewRepeaters, onRepeaterClick, uiIconArt]);

  // ── Phase 4 Crew-Bauwerke: DOM-Marker (Schwarzmarkt, Bunker, Hangout, Tunnel) ──
  const buildingMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    const KIND_INFO: Record<string, { emoji: string; bg: string }> = {
      blackmarket: { emoji: "💰", bg: "rgba(255,215,0,0.85)" },
      bunker:      { emoji: "🛡", bg: "rgba(34,209,195,0.85)" },
      hangout:     { emoji: "🍻", bg: "rgba(255,107,74,0.85)" },
      tunnel:      { emoji: "🚇", bg: "rgba(168,85,247,0.85)" },
    };
    const seen = new Set<string>();
    for (const b of crewBuildings ?? []) {
      seen.add(b.id);
      const existing = buildingMarkersRef.current.get(b.id);
      if (existing) {
        existing.setLngLat([b.lng, b.lat]);
        continue;
      }
      const info = KIND_INFO[b.kind] ?? { emoji: "🏗", bg: "rgba(255,255,255,0.6)" };
      const el = document.createElement("div");
      el.style.cssText = "position:relative; width:48px; height:48px; pointer-events:auto; cursor:pointer; will-change:transform;";
      const inner = document.createElement("div");
      inner.style.cssText = `
        width:100%; height:100%;
        display:flex; align-items:center; justify-content:center;
        font-size:24px;
        background:${info.bg};
        border:2px solid ${b.is_own ? b.territory_color : "rgba(255,255,255,0.4)"};
        border-radius:12px;
        box-shadow:0 4px 12px rgba(0,0,0,0.5), 0 0 8px ${b.territory_color}66;
        backdrop-filter:blur(4px);
      `;
      inner.textContent = info.emoji;
      el.appendChild(inner);
      // Tooltip-on-Hover (kein eigener Popup für Phase 4 Stub)
      el.title = `${b.label ?? b.kind} · ${b.hp}/${b.max_hp} HP`;
      const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([b.lng, b.lat]).addTo(map);
      buildingMarkersRef.current.set(b.id, marker);
    }
    for (const [id, marker] of buildingMarkersRef.current.entries()) {
      if (!seen.has(id)) { marker.remove(); buildingMarkersRef.current.delete(id); }
    }
  }, [mapReady, crewBuildings]);

  // ── LongPress (~600 ms) auf Map → onMapLongPress (für Repeater-Setzen) ──
  useEffect(() => {
    if (!mapReady || !mapRef.current || !onMapLongPress) return;
    const map = mapRef.current;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let armed = false;
    let lastLngLat: { lng: number; lat: number } | null = null;
    const start = (e: mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent) => {
      armed = true;
      lastLngLat = { lng: e.lngLat.lng, lat: e.lngLat.lat };
      timer = setTimeout(() => {
        if (armed && lastLngLat) onMapLongPress(lastLngLat.lng, lastLngLat.lat);
        armed = false;
      }, 600);
    };
    const cancel = () => {
      armed = false;
      if (timer) { clearTimeout(timer); timer = null; }
    };
    map.on("mousedown", start);
    map.on("touchstart", start);
    map.on("mouseup", cancel);
    map.on("touchend", cancel);
    map.on("dragstart", cancel);
    map.on("zoomstart", cancel);
    return () => {
      cancel();
      map.off("mousedown", start);
      map.off("touchstart", start);
      map.off("mouseup", cancel);
      map.off("touchend", cancel);
      map.off("dragstart", cancel);
      map.off("zoomstart", cancel);
    };
  }, [mapReady, onMapLongPress]);

  // ── Place-Base-Mode: nächster Map-Klick liefert Lat/Lng ──
  useEffect(() => {
    if (!mapReady || !mapRef.current || !placeBaseMode || !onPlaceBaseClick) return;
    const map = mapRef.current;
    const canvas = map.getCanvas();
    canvas.style.cursor = "crosshair";
    const handler = (e: mapboxgl.MapMouseEvent) => {
      onPlaceBaseClick(e.lngLat.lng, e.lngLat.lat, placeBaseMode);
    };
    map.once("click", handler);
    return () => {
      canvas.style.cursor = "";
      map.off("click", handler);
    };
  }, [mapReady, placeBaseMode, onPlaceBaseClick]);

  // ── Relocate-Mode: Custom-Event → nächster Map-Klick verlegt die Base ──
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const onTrigger = () => {
      const canvas = map.getCanvas();
      canvas.style.cursor = "crosshair";
      const handler = async (e: mapboxgl.MapMouseEvent) => {
        canvas.style.cursor = "";
        try {
          const r = await fetch("/api/base/relocate", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat: e.lngLat.lat, lng: e.lngLat.lng }),
          });
          const j = await r.json() as { ok?: boolean; error?: string; tokens_left?: number };
          if (j.ok) {
            window.alert(`✓ Base verlegt. Tokens übrig: ${j.tokens_left}`);
            window.location.reload();
          } else {
            window.alert("Fehler: " + (j.error ?? "unbekannt"));
          }
        } catch (e) {
          window.alert("Netzwerkfehler beim Verlegen.");
          void e;
        }
      };
      map.once("click", handler);
    };
    window.addEventListener("ma365:relocate-base-mode", onTrigger);
    return () => { window.removeEventListener("ma365:relocate-base-mode", onTrigger); };
  }, [mapReady]);

  // ── Fly-to-coords: Listener für externe Navigation (z.B. "Öffnen" auf Base-Banner) ──
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    const onFly = (e: Event) => {
      const detail = (e as CustomEvent<{ lat: number; lng: number; zoom?: number }>).detail;
      if (!detail || typeof detail.lat !== "number" || typeof detail.lng !== "number") return;
      map.flyTo({ center: [detail.lng, detail.lat], zoom: detail.zoom ?? 17, pitch: 50, duration: 900 });
    };
    window.addEventListener("ma365:fly-to-coords", onFly);
    return () => { window.removeEventListener("ma365:fly-to-coords", onFly); };
  }, [mapReady]);

  // ── March-Lines: laufende Crew-Angriffe als animierte Linie auf der Map ──
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    let cancelled = false;
    const SRC = "ma365-marches";
    const LYR_LINE = "ma365-marches-line";
    const LYR_GLOW = "ma365-marches-glow";
    type March = {
      id: string; is_attacker: boolean;
      attacker_lat: number; attacker_lng: number;
      defender_lat: number; defender_lng: number;
      started_at: string; ends_at: string;
    };
    // Diff-basierte Marker-Verwaltung: id → { marker, march }
    const marchMarkers = new Map<string, { marker: mapboxgl.Marker; march: March }>();
    let currentMarches: March[] = [];
    let rafId = 0;

    const ensureLayers = () => {
      if (!map.getSource(SRC)) {
        map.addSource(SRC, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({
          id: LYR_GLOW, type: "line", source: SRC,
          paint: {
            "line-color": ["case", ["get", "is_attacker"], "#FF2D78", "#FF6B4A"],
            "line-width": 6, "line-opacity": 0.35, "line-blur": 6,
          },
        });
        map.addLayer({
          id: LYR_LINE, type: "line", source: SRC,
          paint: {
            "line-color": ["case", ["get", "is_attacker"], "#FF2D78", "#FF6B4A"],
            "line-width": 2, "line-opacity": 0.95, "line-dasharray": [2, 2],
          },
        });
      }
    };

    const interpolatePos = (m: March): [number, number] => {
      const start = new Date(m.started_at).getTime();
      const end = new Date(m.ends_at).getTime();
      const t = Math.max(0, Math.min(1, (Date.now() - start) / Math.max(1, end - start)));
      const lat = m.attacker_lat + (m.defender_lat - m.attacker_lat) * t;
      const lng = m.attacker_lng + (m.defender_lng - m.attacker_lng) * t;
      return [lng, lat];
    };

    const setData = (marches: March[]) => {
      ensureLayers();
      currentMarches = marches;

      // GeoJSON-Linien nur updaten wenn Anzahl/IDs sich geändert haben
      const features = marches.map((m) => ({
        type: "Feature" as const,
        properties: { id: m.id, is_attacker: m.is_attacker },
        geometry: { type: "LineString" as const, coordinates: [
          [m.attacker_lng, m.attacker_lat], [m.defender_lng, m.defender_lat],
        ]},
      }));
      const src = map.getSource(SRC) as mapboxgl.GeoJSONSource | undefined;
      if (src) src.setData({ type: "FeatureCollection", features });

      // Diff: nur neue Marker erstellen, alte entfernen, vorhandene wiederverwenden
      const seenIds = new Set<string>();
      for (const m of marches) {
        seenIds.add(m.id);
        const existing = marchMarkers.get(m.id);
        if (existing) {
          existing.march = m; // Daten aktualisieren, Marker bleibt
        } else {
          const [lng, lat] = interpolatePos(m);
          const el = document.createElement("div");
          el.style.cssText = "font-size:22px;line-height:1;filter:drop-shadow(0 0 6px " + (m.is_attacker ? "#FF2D78" : "#FF6B4A") + ")";
          el.textContent = "⚔️";
          const marker = new mapboxgl.Marker({ element: el, anchor: "center" }).setLngLat([lng, lat]).addTo(map);
          marchMarkers.set(m.id, { marker, march: m });
        }
      }
      // Entfernte Marches: Marker abbauen
      for (const [id, entry] of marchMarkers) {
        if (!seenIds.has(id)) {
          entry.marker.remove();
          marchMarkers.delete(id);
        }
      }
    };

    // RAF-Loop: interpoliert Marker-Position smooth zwischen Server-Updates
    const tickPositions = () => {
      if (cancelled) return;
      for (const [, entry] of marchMarkers) {
        const [lng, lat] = interpolatePos(entry.march);
        entry.marker.setLngLat([lng, lat]);
      }
      rafId = window.requestAnimationFrame(tickPositions);
    };

    const fetchMarches = async () => {
      try {
        const r = await fetch("/api/base/marches", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json() as { ok?: boolean; marches?: March[] };
        if (cancelled || !j.marches) return;
        setData(j.marches);
      } catch { /* silent */ }
    };

    void fetchMarches();
    rafId = window.requestAnimationFrame(tickPositions);

    // Realtime: lauscht auf base_attacks INSERT/UPDATE/DELETE für eigene Crew.
    // RLS filtert serverseitig — Client erhält nur relevante Events.
    const sb = createClient();
    const channel = sb
      .channel("ma365-marches-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "base_attacks" }, () => {
        if (!cancelled) void fetchMarches();
      })
      .subscribe();

    // Fallback-Poll falls WebSocket abreißt: 2 Minuten — nur als Sicherheitsnetz.
    let pollId: number | null = null;
    const schedulePoll = () => {
      pollId = window.setTimeout(async () => {
        await fetchMarches();
        if (!cancelled) schedulePoll();
      }, 120000);
    };
    schedulePoll();

    return () => {
      cancelled = true;
      void sb.removeChannel(channel);
      if (pollId !== null) window.clearTimeout(pollId);
      if (rafId) window.cancelAnimationFrame(rafId);
      for (const [, entry] of marchMarkers) entry.marker.remove();
      marchMarkers.clear();
      try {
        if (map.getLayer(LYR_LINE)) map.removeLayer(LYR_LINE);
        if (map.getLayer(LYR_GLOW)) map.removeLayer(LYR_GLOW);
        if (map.getSource(SRC)) map.removeSource(SRC);
      } catch { /* cleanup race */ }
    };
  }, [mapReady]);

  // ── Sammel-Marsch-Linien: Karren auf Straßen-Route zum Resource-Node ──
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const SRC = "ma365-gather-marches";
    const LYR_LINE = "ma365-gather-marches-line";
    const LYR_GLOW = "ma365-gather-marches-glow";

    type Phase = "marching" | "gathering" | "returning";
    type RouteCache = {
      coords: Array<[number, number]>; // [lng, lat]
      cumDist: number[];                // kumulative Distanz pro Punkt (in m)
      total: number;                    // Gesamt-Routen-Distanz (m)
    };
    const routeCache = new Map<number, RouteCache>(); // march_id → route
    const fetchedIds = new Set<number>();
    const cartMarkers = new Map<number, mapboxgl.Marker>();

    const ensureLayers = () => {
      if (!map.getSource(SRC)) {
        map.addSource(SRC, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({
          id: LYR_GLOW, type: "line", source: SRC,
          paint: { "line-color": "#FFD700", "line-width": 8, "line-opacity": 0.25, "line-blur": 6 },
        });
        map.addLayer({
          id: LYR_LINE, type: "line", source: SRC,
          paint: {
            "line-color": "#FFD700", "line-width": 3, "line-opacity": 0.9,
            "line-dasharray": [0, 4, 3],
          },
          layout: { "line-cap": "round", "line-join": "round" },
        });
      }
    };

    // "Marching Ants" — Dash-Phase shiftet jeden Frame, Linie wirkt sich bewegend
    const dashSequence: Array<[number, number, number] | [number, number, number, number]> = [
      [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0],
      [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5],
    ];
    let dashIdx = 0;
    let dashFrameCount = 0;

    const fetchRoute = async (marchId: number, from: [number, number], to: [number, number]) => {
      if (fetchedIds.has(marchId)) return;
      fetchedIds.add(marchId);
      try {
        const url = `/api/route?from=${from[1]},${from[0]}&to=${to[1]},${to[0]}`;
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) {
          // Fallback: Luftlinie
          routeCache.set(marchId, makeStraightRoute(from, to));
          return;
        }
        const j = await r.json() as { ok?: boolean; geometry?: { coordinates: Array<[number, number]> } };
        if (!j.ok || !j.geometry?.coordinates?.length) {
          routeCache.set(marchId, makeStraightRoute(from, to));
          return;
        }
        const coords = j.geometry.coordinates;
        const { cumDist, total } = computeCum(coords);
        routeCache.set(marchId, { coords, cumDist, total });
      } catch {
        routeCache.set(marchId, makeStraightRoute(from, to));
      }
    };

    const makeStraightRoute = (from: [number, number], to: [number, number]): RouteCache => {
      const coords: Array<[number, number]> = [[from[1], from[0]], [to[1], to[0]]];
      const { cumDist, total } = computeCum(coords);
      return { coords, cumDist, total };
    };

    const haversine = (a: [number, number], b: [number, number]) => {
      const R = 6371000;
      const lat1 = (a[1] * Math.PI) / 180;
      const lat2 = (b[1] * Math.PI) / 180;
      const dLat = lat2 - lat1;
      const dLng = ((b[0] - a[0]) * Math.PI) / 180;
      const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(x));
    };

    const computeCum = (coords: Array<[number, number]>) => {
      const cum = [0];
      let total = 0;
      for (let i = 1; i < coords.length; i++) {
        total += haversine(coords[i - 1], coords[i]);
        cum.push(total);
      }
      return { cumDist: cum, total };
    };

    // Position + Bearing entlang Route bei Fortschritt 0..1 (reverse für Rückweg)
    const interpolate = (rt: RouteCache, t: number, reversed: boolean): { lng: number; lat: number; bearing: number } | null => {
      if (rt.coords.length < 2) return null;
      const target = Math.max(0, Math.min(1, t)) * rt.total;
      const cum = rt.cumDist;
      // Binäre Suche nach dem Segment
      let lo = 0, hi = cum.length - 1;
      while (lo + 1 < hi) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] <= target) lo = mid; else hi = mid;
      }
      const segLen = cum[hi] - cum[lo] || 1;
      const segT = (target - cum[lo]) / segLen;
      const a = rt.coords[lo];
      const b = rt.coords[hi];
      const lng = a[0] + (b[0] - a[0]) * segT;
      const lat = a[1] + (b[1] - a[1]) * segT;
      // Bearing
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      let bearing = Math.atan2(dx, dy) * (180 / Math.PI);
      if (reversed) bearing = (bearing + 180) % 360;
      return { lng, lat, bearing };
    };

    const buildCartEl = (phase: Phase, label: string | null): HTMLDivElement => {
      const wrap = document.createElement("div");
      wrap.style.cssText = `
        position:relative; display:flex; flex-direction:column; align-items:center; gap:1px;
        pointer-events:none; will-change:transform; transform-origin:center;
      `;
      if (label) {
        const lbl = document.createElement("div");
        lbl.className = "ma365-cart-label";
        lbl.style.cssText = `
          padding:1px 6px; border-radius:4px;
          background:rgba(15,17,21,0.92); color:#fff;
          font-size:9px; font-weight:700; letter-spacing:0.3px;
          border:1px solid rgba(255,215,0,0.6);
          box-shadow:0 1px 3px rgba(0,0,0,0.5);
          white-space:nowrap;
          font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,sans-serif;
        `;
        lbl.textContent = label;
        wrap.appendChild(lbl);
      }
      const sprite = document.createElement("div");
      sprite.className = "ma365-cart-sprite";
      sprite.style.cssText = `
        font-size:24px; line-height:1;
        filter:drop-shadow(0 0 6px rgba(255,215,0,0.85)) drop-shadow(0 2px 4px rgba(0,0,0,0.6));
        transform-origin:center;
      `;
      sprite.textContent = phase === "gathering" ? "⛏️" : "🛒";
      wrap.appendChild(sprite);
      return wrap;
    };

    const cartLabel = (m: { owner_name?: string | null; owner_crew_tag?: string | null }): string | null => {
      if (!m.owner_name) return null;
      return m.owner_crew_tag ? `[${m.owner_crew_tag}] ${m.owner_name}` : m.owner_name;
    };

    ensureLayers();

    let raf = 0;
    const renderFrame = () => {
      const now = Date.now();
      const lineFeatures: GeoJSON.Feature[] = [];

      for (const m of gatherMarches) {
        if (!m.node || m.origin_lat == null || m.origin_lng == null) continue;
        const from: [number, number] = [m.origin_lat, m.origin_lng];
        const to:   [number, number] = [m.node.lat, m.node.lng];
        // Route fetchen wenn fehlt
        if (!routeCache.has(m.id) && !fetchedIds.has(m.id)) {
          void fetchRoute(m.id, from, to);
        }
        const rt = routeCache.get(m.id);
        if (!rt) continue;

        // Linie zeichnen — orientiert nach Phase
        const reverseLine = m.status === "returning";
        const lineCoords = reverseLine ? [...rt.coords].reverse() : rt.coords;
        lineFeatures.push({
          type: "Feature",
          properties: { id: String(m.id), status: m.status },
          geometry: { type: "LineString", coordinates: lineCoords },
        });

        // Karren-Position
        let pos: { lng: number; lat: number; bearing: number } | null;
        if (m.status === "marching") {
          const start = new Date(m.started_at).getTime();
          const end = new Date(m.arrives_at).getTime();
          const t = (now - start) / Math.max(1, end - start);
          pos = interpolate(rt, t, false);
        } else if (m.status === "gathering") {
          // Karren am Node-Punkt
          pos = { lng: rt.coords[rt.coords.length - 1][0], lat: rt.coords[rt.coords.length - 1][1], bearing: 0 };
        } else { // returning
          const start = new Date(m.finishes_at).getTime();
          const end = new Date(m.returns_at).getTime();
          const t = (now - start) / Math.max(1, end - start);
          // Zurück = von Ende zu Anfang
          pos = interpolate(rt, 1 - t, true);
        }
        if (!pos) continue;

        let cart = cartMarkers.get(m.id);
        const label = cartLabel(m);
        if (!cart) {
          const el = buildCartEl(m.status, label);
          el.dataset.phase = m.status;
          el.dataset.label = label ?? "";
          cart = new mapboxgl.Marker({ element: el, anchor: "bottom" }).setLngLat([pos.lng, pos.lat]).addTo(map);
          cartMarkers.set(m.id, cart);
        } else {
          const el = cart.getElement();
          // Phase-Wechsel oder Label-Wechsel → komplett neu bauen (selten)
          if (el.dataset.phase !== m.status || el.dataset.label !== (label ?? "")) {
            const fresh = buildCartEl(m.status, label);
            fresh.dataset.phase = m.status;
            fresh.dataset.label = label ?? "";
            cart.getElement().replaceWith(fresh);
            // Mapbox Marker hält intern das alte Element-Pointer; ersetze:
            cart.remove();
            cart = new mapboxgl.Marker({ element: fresh, anchor: "bottom" }).setLngLat([pos.lng, pos.lat]).addTo(map);
            cartMarkers.set(m.id, cart);
          } else {
            cart.setLngLat([pos.lng, pos.lat]);
          }
          // Nur das Sprite rotieren (Label bleibt aufrecht)
          const sprite = cart.getElement().querySelector(".ma365-cart-sprite") as HTMLElement | null;
          if (sprite) {
            sprite.style.transform = m.status !== "gathering" ? `rotate(${pos.bearing.toFixed(0)}deg)` : "";
          }
        }
      }

      // Linien-Source aktualisieren
      const src = map.getSource(SRC) as mapboxgl.GeoJSONSource | undefined;
      if (src) src.setData({ type: "FeatureCollection", features: lineFeatures });

      // Marching-Ants: Dash-Pattern alle ~4 Frames shiften (~15 Hz @ 60fps)
      dashFrameCount++;
      if (dashFrameCount >= 4 && lineFeatures.length > 0) {
        dashFrameCount = 0;
        dashIdx = (dashIdx + 1) % dashSequence.length;
        try {
          map.setPaintProperty(LYR_LINE, "line-dasharray", dashSequence[dashIdx]);
        } catch { /* layer evtl. weg */ }
      }

      // Karren entfernen für Märsche die nicht mehr aktiv sind
      const activeIds = new Set(gatherMarches.map((m) => m.id));
      for (const [id, marker] of cartMarkers) {
        if (!activeIds.has(id)) { marker.remove(); cartMarkers.delete(id); }
      }

      raf = requestAnimationFrame(renderFrame);
    };
    raf = requestAnimationFrame(renderFrame);

    return () => {
      cancelAnimationFrame(raf);
      cartMarkers.forEach((m) => m.remove());
      cartMarkers.clear();
      try {
        if (map.getLayer(LYR_LINE)) map.removeLayer(LYR_LINE);
        if (map.getLayer(LYR_GLOW)) map.removeLayer(LYR_GLOW);
        if (map.getSource(SRC)) map.removeSource(SRC);
      } catch { /* cleanup race */ }
    };
  }, [mapReady, gatherMarches]);

  return (
    <div style={{ position: "absolute", inset: 0 }} data-pin-theme={pinTheme ?? "default"}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

