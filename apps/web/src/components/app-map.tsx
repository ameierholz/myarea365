"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
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

// Marker-Animationen EINMAL global im <head> injecten (verhindert Flickering bei Zoom)
if (typeof window !== "undefined" && !document.getElementById("mapbox-marker-animations")) {
  const style = document.createElement("style");
  style.id = "mapbox-marker-animations";
  style.textContent = `
    @keyframes selfPulse { 0%,100% { transform: scale(1); opacity: 0.95; } 50% { transform: scale(1.15); opacity: 0.5; } }
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
      min-width: 110px;
      padding: 8px 10px;
      border-radius: 14px;
      background: linear-gradient(135deg, rgba(120,0,40,0.95) 0%, rgba(40,0,20,0.95) 100%);
      border: 2px solid rgba(255,45,120,0.8);
      color: #FFF;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
      animation: ma365BossPulse 1.8s ease-in-out infinite;
      text-align: center;
    }
    .ma365-boss-emoji { font-size: 28px; line-height: 1; margin-bottom: 4px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)); }
    .ma365-boss-name { font-size: 10px; font-weight: 900; letter-spacing: 0.3px; margin-bottom: 5px; text-shadow: 0 1px 2px rgba(0,0,0,0.7); }
    .ma365-boss-hpbar {
      height: 5px; background: rgba(0,0,0,0.6); border-radius: 3px; overflow: hidden;
      border: 1px solid rgba(255,255,255,0.2);
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
  pinTheme?: "default" | "neon" | "cyberpunk" | "arcade" | "golden" | "frost" | null;
  crewColor?: string | null;
  crewName?: string | null;
  displayName?: string | null;
  // 3-Ebenen-Modell (Abschnitt/Zug/Territorium) aus DB
  walkedSegments?: Array<{ id: string; geom: Array<{ lat: number; lng: number }>; is_mine: boolean; is_crew: boolean }>;
  claimedStreets?: Array<{ id: string; geoms: Array<Array<{ lat: number; lng: number }>>; is_mine: boolean; is_crew: boolean }>;
  ownedTerritories?: Array<{ id: string; polygon: Array<{ lat: number; lng: number }>; is_mine: boolean; is_crew: boolean; status: string }>;
  onOwnershipClick?: (kind: "segment" | "street" | "territory", id: string) => void;
  // ── Map-Features Wave ────────────────────────────────────
  powerZones?: Array<{ id: string; name: string; kind: string; center_lat: number; center_lng: number; radius_m: number; color: string; buff_hp: number; buff_atk: number; buff_def: number; buff_spd: number }>;
  bossRaids?: Array<{ id: string; name: string; emoji: string; lat: number; lng: number; max_hp: number; current_hp: number }>;
  sanctuaries?: Array<{ id: string; name: string; lat: number; lng: number; emoji: string; xp_reward: number; trained_today?: boolean }>;
  flashPushes?: Array<{ id: string; business_id: string; business_lat: number; business_lng: number; radius_m: number; expires_at: string }>;
  shopTrail?: Array<{ business_id: string; name: string; lat: number; lng: number }>;
  shadowRoute?: { id: string; runner_color: string; geom: Array<{ lat: number; lng: number }> } | null;
  shopReviews?: Array<{ business_id: string; avg_rating: number; review_count: number }>;
  exploredCells?: Array<{ cell_x: number; cell_y: number }>;
  fogOfWarEnabled?: boolean;
  lootDrops?: Array<{ id: string; lat: number; lng: number; rarity: string; kind: string }>;
  arenaCountdowns?: Array<{ business_id: string; business_lat: number; business_lng: number; starts_at: string }>;
  onBossClick?: (raidId: string) => void;
  onSanctuaryClick?: (sanctuaryId: string) => void;
  onPowerZoneClick?: (zoneId: string) => void;
  onLootClick?: (dropId: string) => void;
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
): HTMLDivElement {
  const size = isRunning ? 52 : 44;
  const glow = isRunning ? 30 : 18;
  const el = document.createElement("div");
  el.className = "ma365-runner-pin";
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
  // Name-Pill direkt unter dem Pin. Bei Crew-Mitgliedschaft bekommt die Pill
  // einen Crew-farbigen Border + kleinen Crew-Farb-Dot als Marker. Kollidiert
  // nicht mit Theme (stylt Pin oben) oder Supporter-Badge (oben rechts).
  const cleanName = (displayName ?? "").trim();
  const crewDot = crewColor
    ? `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${crewColor};box-shadow:0 0 6px ${crewColor};vertical-align:middle;margin-right:4px"></span>`
    : "";
  const nameLabel = cleanName
    ? `<div title="${crewName ? "Crew: " + crewName : "Solo"}" style="position:absolute;top:calc(100% - 4px);left:50%;transform:translateX(-50%);padding:3px 9px;background:rgba(15,17,21,0.88);border:1.5px solid ${crewColor ?? "rgba(255,255,255,0.18)"};border-radius:999px;color:#FFF;font-size:10px;font-weight:800;white-space:nowrap;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,sans-serif;text-shadow:0 1px 2px rgba(0,0,0,0.9);letter-spacing:0.2px;pointer-events:none;z-index:4;box-shadow:0 2px 8px rgba(0,0,0,0.6)${crewColor ? `,0 0 12px ${crewColor}66` : ""}">${crewDot}@${cleanName}</div>`
    : "";
  const auraLayer = auraActive
    ? `<div style="position:absolute;width:${size + 28}px;height:${size + 28}px;border-radius:50%;background:conic-gradient(from 0deg,#FFD700 0deg,#22D1C3 120deg,#FF2D78 240deg,#FFD700 360deg);opacity:0.35;filter:blur(6px);animation:auraSpin 4s linear infinite"></div>
       <div style="position:absolute;width:${size + 14}px;height:${size + 14}px;border-radius:50%;border:2px solid #FFD700aa;box-shadow:0 0 20px #FFD700cc;animation:auraPulse 2s ease-in-out infinite"></div>`
    : "";
  el.innerHTML = `
    ${auraLayer}
    <div class="runner-ring" style="position:absolute;width:${size}px;height:${size}px;border-radius:50%;background:${color}25;box-shadow:0 0 ${glow}px ${color}cc;${isRunning ? "animation:selfPulse 1.5s ease-in-out infinite" : ""}"></div>
    <span class="runner-emoji" style="position:relative;font-size:${isRunning ? 40 : 34}px;filter:drop-shadow(0 2px 8px rgba(0,0,0,0.6)) drop-shadow(0 0 12px ${color}aa)">${emoji}</span>
    ${supporterChip}
    ${nameLabel}
    <style>
      @keyframes selfPulse{0%,100%{transform:scale(1);opacity:0.95}50%{transform:scale(1.15);opacity:0.5}}
      @keyframes auraSpin{to{transform:rotate(360deg)}}
      @keyframes auraPulse{0%,100%{transform:scale(1);opacity:0.9}50%{transform:scale(1.1);opacity:0.5}}
    </style>
  `;
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
  const inner = document.createElement("div");
  inner.dataset.zoomScale = "1";
  // inline-flex hält Inhalt zentriert, Origin auf center center damit scale3d die Figur mittig skaliert
  inner.style.cssText = "display:flex;align-items:center;justify-content:center;transform-origin:center center;will-change:transform;backface-visibility:hidden;-webkit-font-smoothing:subpixel-antialiased";
  while (el.firstChild) inner.appendChild(el.firstChild);
  el.appendChild(inner);
}


export function AppMap({
  onLocationUpdate,
  trackingActive,
  teamColor = "#5ddaf0",
  markerId = "foot",
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
  exploredCells = [],
  fogOfWarEnabled = false,
  lootDrops = [],
  arenaCountdowns = [],
  onBossClick,
  onSanctuaryClick,
  onPowerZoneClick,
  onLootClick,
}: AppMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const myEmoji = UNLOCKABLE_MARKERS.find((m) => m.id === markerId)?.icon || "👣";
  const light = RUNNER_LIGHTS.find((l) => l.id === lightId) || RUNNER_LIGHTS[0];

  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const locatedRef = useRef(false);
  const userInteractedRef = useRef(false);
  const watchRef = useRef<number | null>(null);
  const selfMarkerRef = useRef<mapboxgl.Marker | null>(null);
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
        map.panTo([newPos.lng, newPos.lat], { duration: 600 });
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

  // Recenter (expliziter Klick) → Auto-Follow wieder aktivieren
  useEffect(() => {
    if (!mapReady || !recenterAt || !pos) return;
    userInteractedRef.current = false;
    mapRef.current?.flyTo({ center: [pos.lng, pos.lat], zoom: 17, pitch: 50, duration: 900 });
  }, [recenterAt, mapReady, pos]);

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

  // Overview-Mode: Zoom raus + Pitch zurück auf flach
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    if (overviewMode) {
      map.flyTo({ zoom: 13, pitch: 0, duration: 900 });
    } else if (pos) {
      map.flyTo({ center: [pos.lng, pos.lat], zoom: 17, pitch: 50, duration: 900 });
    }
  }, [overviewMode, mapReady, pos]);

  // Eigenes Marker — Instanz wiederverwenden, nur Position updaten
  useEffect(() => {
    if (!mapReady || !pos) return;
    const map = mapRef.current;
    if (!map) return;

    if (!selfMarkerRef.current) {
      const el = buildSelfMarkerEl(myEmoji, teamColor, !!trackingActive, supporterTier, auraActive, crewColor, crewName, displayName);
      wrapForZoomScale(el);
      selfMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([pos.lng, pos.lat])
        .addTo(map);
    } else {
      selfMarkerRef.current.setLngLat([pos.lng, pos.lat]);
    }
  }, [mapReady, pos, teamColor, myEmoji, trackingActive, supporterTier, auraActive, crewColor, crewName, displayName]);

  // Tier-/Crew-Wechsel: Marker neu bauen
  useEffect(() => {
    if (!selfMarkerRef.current || !pos) return;
    const el = buildSelfMarkerEl(myEmoji, teamColor, !!trackingActive, supporterTier, auraActive, crewColor, crewName, displayName);
    wrapForZoomScale(el);
    selfMarkerRef.current.getElement().replaceWith(el);
    const map = mapRef.current;
    if (map) {
      selfMarkerRef.current.remove();
      selfMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([pos.lng, pos.lat])
        .addTo(map);
    }
  }, [supporterTier, auraActive, crewColor, crewName, displayName]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup beim Unmount
  useEffect(() => {
    return () => {
      selfMarkerRef.current?.remove();
      selfMarkerRef.current = null;
    };
  }, []);

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
      badgeInner.innerHTML = `<span class="shield">🛡️</span><span>ARENA</span>`;
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
        // Scale via CSS-Var (Animation liest var(--s) aus; kein Konflikt mit Float-Anim)
        const wrap = marker.getElement().querySelector(".ma365-countdown-wrap") as HTMLElement | null;
        if (wrap) wrap.style.setProperty("--s", countdownScale.toFixed(2));
      });
      // Loot-Kisten skalieren mit Zoom (aggressiver schrumpfen beim Rauszoomen)
      // Basis 64px, Faktor 0.22 (far) bis 0.85 (close)
      const lootScale = Math.max(0.22, Math.min(0.85, (zoom - 12) / 6 * 0.65 + 0.25));
      lootMarkersRef.current.forEach(({ el }) => {
        if (el) el.style.setProperty("--loot-scale", lootScale.toFixed(2));
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
    map.on("zoom", updateMarkerGeometry);

    return () => {
      map.off("zoom", updateMarkerGeometry);
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

    const applyZoomScale = () => {
      const zoom = map.getZoom();
      // 1x-Scale fuer Marker mit nativer Groesse (Self, Runner, Drop)
      let scale = 1;
      if (zoom < 11)      scale = 0.32;
      else if (zoom < 13) scale = 0.35 + ((zoom - 11) / 2) * 0.2;
      else if (zoom < 15) scale = 0.55 + ((zoom - 13) / 2) * 0.25;
      else if (zoom < 17) scale = 0.8  + ((zoom - 15) / 2) * 0.2;
      const showLabel = zoom >= 14;
      // Marker mit 2x-Source (Shop): nochmal × 0.5 → End-Skala identisch zum 1x-Marker,
      // aber immer Downscale → schaerfer dargestellt
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

    applyZoomScale();
    map.on("zoom", applyZoomScale);
    map.on("moveend", applyZoomScale);
    const mo = new MutationObserver(() => applyZoomScale());
    mo.observe(container, { childList: true, subtree: true });
    return () => {
      map.off("zoom", applyZoomScale);
      map.off("moveend", applyZoomScale);
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
    const showLine = trackingActive && activeRoute.length > 0;

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
          const id = e.features?.[0]?.properties?.id as string | undefined;
          if (id) onOwnershipClick("segment", id);
        });
        map.on("mouseenter", layerId, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", layerId, () => { map.getCanvas().style.cursor = ""; });
      }
    }
  }, [mapReady, walkedSegments, onOwnershipClick]);

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
          "line-color": ["case", ["get", "is_crew"], "#22D1C3", ["get", "is_mine"], "#FF6B4A", "#8B8FA3"],
          "line-opacity": 0.95,
          "line-width": zoomWidth(6),
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      if (onOwnershipClick) {
        map.on("click", layerId, (e) => {
          const id = e.features?.[0]?.properties?.id as string | undefined;
          if (id) onOwnershipClick("street", id);
        });
        map.on("mouseenter", layerId, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", layerId, () => { map.getCanvas().style.cursor = ""; });
      }
    }
  }, [mapReady, claimedStreets, onOwnershipClick]);

  // ═══ 3-Ebenen-Modell: Territorien (gefüllte Polygone) ═══
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
          properties: { id: t.id, is_mine: t.is_mine, is_crew: t.is_crew, status: t.status },
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
          "fill-opacity": 0.22,
        },
      });
      map.addLayer({
        id: strokeId, type: "line", source: sourceId,
        paint: {
          "line-color": ["case", ["get", "is_crew"], "#22D1C3", ["get", "is_mine"], "#FFD700", "#FF2D78"],
          "line-opacity": 0.9,
          "line-width": zoomWidth(2.5),
        },
      });
      if (onOwnershipClick) {
        map.on("click", fillId, (e) => {
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

  // ── Fog-of-War: dunkle Overlay, explored cells ausgestanzt ──
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const srcId = "fog-cells";
    const layerId = "fog-cells-fill";
    const fogLayerId = "fog-overlay";

    if (!fogOfWarEnabled) {
      try {
        if (map.getLayer(fogLayerId)) map.removeLayer(fogLayerId);
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(srcId)) map.removeSource(srcId);
      } catch { /* noop */ }
      return;
    }

    const features = exploredCells.map((c) => {
      const x = c.cell_x / 1000, y = c.cell_y / 1000, s = 0.001;
      return {
        type: "Feature" as const,
        geometry: {
          type: "Polygon" as const,
          coordinates: [[[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]]],
        },
        properties: {},
      };
    });
    const data = { type: "FeatureCollection" as const, features };

    const existing = map.getSource(srcId) as mapboxgl.GeoJSONSource | undefined;
    if (existing) existing.setData(data);
    else {
      map.addSource(srcId, { type: "geojson", data });
      // Dunkler Overlay über gesamten Viewport
      map.addLayer({
        id: fogLayerId, type: "background",
        paint: { "background-color": "#0F1115", "background-opacity": 0.0 },
      });
      // Explored Cells "stanzen" ein Loch durch subtile Aufhellung
      map.addLayer({
        id: layerId, type: "fill", source: srcId,
        paint: {
          "fill-color": "#22D1C3",
          "fill-opacity": 0.06,
          "fill-outline-color": "#22D1C3",
        },
      });
    }
  }, [mapReady, exploredCells, fogOfWarEnabled]);

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
          <div class="ma365-boss-emoji">${b.emoji}</div>
          <div class="ma365-boss-name">${b.name}</div>
          <div class="ma365-boss-hpbar"><div class="ma365-boss-hpfill" style="width:${pct}%"></div></div>`;
      outer.appendChild(inner);
      outer.addEventListener("click", () => onBossClick?.(b.id));
      const marker = new mapboxgl.Marker({ element: outer, anchor: "bottom" })
        .setLngLat([b.lng, b.lat]).addTo(map);
      bossMarkersRef.current.push({ marker, el: inner });
    });

    const applyScale = () => {
      const zoom = map.getZoom();
      const hide = zoom < 11;
      const scale = Math.max(0.35, Math.min(1.0, (zoom - 11) / 6 + 0.4));
      bossMarkersRef.current.forEach(({ el }) => {
        el.style.transform = `scale(${scale.toFixed(2)})`;
        el.style.opacity = hide ? "0" : "1";
        el.style.transition = "opacity 0.25s";
      });
    };
    applyScale();
    map.on("zoom", applyScale);

    return () => {
      map.off("zoom", applyScale);
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
    map.on("zoom", applyScale);

    return () => {
      map.off("zoom", applyScale);
      sanctuaryMarkersRef.current.forEach(({ marker }) => marker.remove());
      sanctuaryMarkersRef.current = [];
    };
  }, [mapReady, sanctuaries, onSanctuaryClick]);

  // ── Loot-Drops: animierte Kisten mit Proximity-Pickup ──
  const lootMarkersRef = useRef<Array<{ marker: mapboxgl.Marker; el: HTMLElement; drop: typeof lootDrops[0] }>>([]);
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    lootMarkersRef.current.forEach(({ marker }) => marker.remove());
    lootMarkersRef.current = [];

    const rarityColor: Record<string, string> = {
      common: "#9ba8c7", rare: "#5ddaf0", epic: "#a855f7", legendary: "#FFD700",
    };
    // Rarity -> Kiste/Emoji: Legendary = Krone, Epic = Gem, Rare = Geschenk, Common = Kiste
    const crateByRarity: Record<string, string> = {
      common: "📦", rare: "🎁", epic: "💎", legendary: "👑",
    };
    lootDrops.forEach((d) => {
      const outer = document.createElement("div");
      outer.style.pointerEvents = "auto";
      const color = rarityColor[d.rarity] || "#5ddaf0";
      const crate = crateByRarity[d.rarity] || "📦";
      outer.innerHTML = `
        <div class="ma365-loot-wrap" style="--color:${color}">
          <div class="ma365-loot-proximity"></div>
          <div class="ma365-loot-proximity two"></div>
          <div class="ma365-loot-crate">${crate}</div>
        </div>`;
      outer.addEventListener("click", () => onLootClick?.(d.id));
      const marker = new mapboxgl.Marker({ element: outer, anchor: "center" })
        .setLngLat([d.lng, d.lat]).addTo(map);
      lootMarkersRef.current.push({ marker, el: outer.querySelector(".ma365-loot-wrap") as HTMLElement, drop: d });
    });
    return () => { lootMarkersRef.current.forEach(({ marker }) => marker.remove()); lootMarkersRef.current = []; };
  }, [mapReady, lootDrops, onLootClick]);

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

  return (
    <div style={{ position: "absolute", inset: 0 }} data-pin-theme={pinTheme ?? "default"}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
