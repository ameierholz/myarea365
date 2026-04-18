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
  // 3-Ebenen-Modell (Abschnitt/Zug/Territorium) aus DB
  walkedSegments?: Array<{ id: string; geom: Array<{ lat: number; lng: number }>; is_mine: boolean; is_crew: boolean }>;
  claimedStreets?: Array<{ id: string; geoms: Array<Array<{ lat: number; lng: number }>>; is_mine: boolean; is_crew: boolean }>;
  ownedTerritories?: Array<{ id: string; polygon: Array<{ lat: number; lng: number }>; is_mine: boolean; is_crew: boolean; status: string }>;
  onOwnershipClick?: (kind: "segment" | "street" | "territory", id: string) => void;
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
function buildSelfMarkerEl(emoji: string, color: string, isRunning: boolean, supporterTier?: "bronze" | "silver" | "gold" | null, auraActive = false): HTMLDivElement {
  const size = isRunning ? 52 : 44;
  const glow = isRunning ? 30 : 18;
  const el = document.createElement("div");
  el.style.cssText = `position:relative;display:flex;align-items:center;justify-content:center;width:${size + 20}px;height:${size + 20}px;pointer-events:none`;
  const tierCfg = supporterTier === "gold"
    ? { bg: "linear-gradient(135deg,#FFD700,#B8860B)", border: "#FFD700", icon: "★", shadow: "0 0 10px #FFD700cc" }
    : supporterTier === "silver"
      ? { bg: "linear-gradient(135deg,#E0E0E0,#9A9A9A)", border: "#C0C0C0", icon: "★", shadow: "0 0 8px #C0C0C0cc" }
      : supporterTier === "bronze"
        ? { bg: "linear-gradient(135deg,#CD7F32,#A0522D)", border: "#CD7F32", icon: "★", shadow: "0 0 8px #CD7F32cc" }
        : null;
  const supporterChip = tierCfg
    ? `<div style="position:absolute;top:2px;right:2px;width:16px;height:16px;border-radius:50%;background:${tierCfg.bg};border:1.5px solid ${tierCfg.border};display:flex;align-items:center;justify-content:center;font-size:9px;color:#0F1115;font-weight:900;box-shadow:${tierCfg.shadow};z-index:3">${tierCfg.icon}</div>`
    : "";
  const auraLayer = auraActive
    ? `<div style="position:absolute;width:${size + 28}px;height:${size + 28}px;border-radius:50%;background:conic-gradient(from 0deg,#FFD700 0deg,#22D1C3 120deg,#FF2D78 240deg,#FFD700 360deg);opacity:0.35;filter:blur(6px);animation:auraSpin 4s linear infinite"></div>
       <div style="position:absolute;width:${size + 14}px;height:${size + 14}px;border-radius:50%;border:2px solid #FFD700aa;box-shadow:0 0 20px #FFD700cc;animation:auraPulse 2s ease-in-out infinite"></div>`
    : "";
  el.innerHTML = `
    ${auraLayer}
    <div style="position:absolute;width:${size}px;height:${size}px;border-radius:50%;background:${color}25;box-shadow:0 0 ${glow}px ${color}cc;${isRunning ? "animation:selfPulse 1.5s ease-in-out infinite" : ""}"></div>
    <span style="position:relative;font-size:${isRunning ? 40 : 34}px;filter:drop-shadow(0 2px 8px rgba(0,0,0,0.6)) drop-shadow(0 0 12px ${color}aa)">${emoji}</span>
    ${supporterChip}
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
  inner.style.cssText = "display:inline-block;transform-origin:center;transition:transform 0.15s ease-out";
  while (el.firstChild) inner.appendChild(el.firstChild);
  el.appendChild(inner);
}

function buildShopMarkerEl(shop: ShopPin): HTMLDivElement {
  const color = shop.color || "#FFD700";
  // Outer wrapper: Mapbox setzt translate() hier drauf → NICHT selbst anfassen
  const el = document.createElement("div");
  el.style.cssText = "position:relative;cursor:pointer;pointer-events:auto";
  // Inner wrapper: hier wenden wir Zoom-Scaling an (wird ueber data-Attribut gefunden)
  const inner = document.createElement("div");
  inner.dataset.zoomScale = "1";
  inner.style.cssText = "position:relative;display:flex;flex-direction:column;align-items:center;transform-origin:bottom center;transition:transform 0.15s ease-out";
  el.appendChild(inner);

  let spotlightLayers = "";
  let spotlightLabel = "";
  if (shop.spotlight) {
    spotlightLayers = `
      <!-- outer soft halo pulse -->
      <div style="position:absolute;top:-28px;left:50%;margin-left:-54px;width:108px;height:108px;border-radius:50%;background:radial-gradient(circle,#FFD70066 0%,#FFD70022 45%,transparent 70%);animation:shopSpotlightHalo 2.2s ease-in-out infinite;pointer-events:none"></div>
      <!-- middle halo ring -->
      <div style="position:absolute;top:-14px;left:50%;margin-left:-38px;width:76px;height:76px;border-radius:50%;background:radial-gradient(circle,#FFD70099 0%,#FFD70044 50%,transparent 75%);animation:shopSpotlightHalo 2.2s ease-in-out infinite 0.4s;pointer-events:none"></div>
      <!-- rotating light rays behind -->
      <div style="position:absolute;top:-22px;left:50%;margin-left:-45px;width:90px;height:90px;border-radius:50%;background:conic-gradient(from 0deg,transparent 0deg,#FFD70088 15deg,transparent 35deg,transparent 90deg,#FFD70066 110deg,transparent 140deg,transparent 210deg,#FFD70088 230deg,transparent 260deg,transparent 330deg,#FFD70066 350deg,transparent 360deg);animation:shopSpotlightRays 6s linear infinite;pointer-events:none;opacity:0.7;filter:blur(2px)"></div>
      <!-- inner bright ring -->
      <div style="position:absolute;top:-6px;left:50%;margin-left:-28px;width:56px;height:56px;border-radius:50%;background:transparent;border:2px solid #FFD700cc;animation:shopSpotlightRing 1.6s ease-in-out infinite;pointer-events:none"></div>
    `;
    spotlightLabel = `<div style="position:absolute;top:-38px;left:50%;transform:translateX(-50%);padding:2px 8px;border-radius:999px;background:linear-gradient(90deg,#FFD700,#FF6B4A);color:#0F1115;font-size:9px;font-weight:900;letter-spacing:1px;box-shadow:0 2px 8px rgba(0,0,0,0.45);animation:shopSpotlightLabel 1.6s ease-in-out infinite;white-space:nowrap">⭐ SPOTLIGHT</div>`;
  }

  inner.innerHTML = `
    ${spotlightLayers}
    ${spotlightLabel}
    <div style="position:relative;width:44px;height:44px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:linear-gradient(135deg,${color},${color}cc);border:2.5px solid #FFF;box-shadow:0 4px 10px rgba(0,0,0,0.45)${shop.spotlight ? ",0 0 22px #FFD700cc" : ""};display:flex;align-items:center;justify-content:center;animation:shopBounce 2.2s ease-in-out infinite;z-index:2;overflow:hidden">
      ${shop.custom_pin_url
        ? `<img src="${shop.custom_pin_url}" alt="${shop.name}" style="transform:rotate(45deg);width:28px;height:28px;border-radius:50%;object-fit:cover" />`
        : `<span style="transform:rotate(45deg);font-size:22px;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.45))">${shop.icon}</span>`
      }
    </div>
    <div data-shop-label="1" style="margin-top:2px;padding:2px 6px;border-radius:8px;background:rgba(15,17,21,0.85);border:1px solid ${color}88;color:#FFF;font-size:10px;font-weight:800;white-space:nowrap;max-width:140px;overflow:hidden;text-overflow:ellipsis;pointer-events:none;position:relative;z-index:2;transition:opacity 0.2s">${shop.name}</div>
  `;
  return el;
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
  walkedSegments = [],
  claimedStreets = [],
  ownedTerritories = [],
  onOwnershipClick,
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
  const shopMarkersRef = useRef<mapboxgl.Marker[]>([]);

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

    map.addControl(new mapboxgl.NavigationControl({ showCompass: true, visualizePitch: true }), "top-right");
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
      const el = buildSelfMarkerEl(myEmoji, teamColor, !!trackingActive, supporterTier, auraActive);
      wrapForZoomScale(el);
      selfMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([pos.lng, pos.lat])
        .addTo(map);
    } else {
      selfMarkerRef.current.setLngLat([pos.lng, pos.lat]);
    }
  }, [mapReady, pos, teamColor, myEmoji, trackingActive, supporterTier, auraActive]);

  // Tier-Wechsel: Marker neu bauen
  useEffect(() => {
    if (!selfMarkerRef.current || !pos) return;
    const el = buildSelfMarkerEl(myEmoji, teamColor, !!trackingActive, supporterTier, auraActive);
    wrapForZoomScale(el);
    selfMarkerRef.current.getElement().replaceWith(el);
    const map = mapRef.current;
    if (map) {
      selfMarkerRef.current.remove();
      selfMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([pos.lng, pos.lat])
        .addTo(map);
    }
  }, [supporterTier, auraActive]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Shops
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    shopMarkersRef.current.forEach((m) => m.remove());
    shopMarkersRef.current = [];

    shops.forEach((shop) => {
      const el = buildShopMarkerEl(shop);
      el.addEventListener("click", () => onShopClick?.(shop.id));
      const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([shop.lng, shop.lat])
        .addTo(map);
      shopMarkersRef.current.push(marker);
    });

    return () => {
      shopMarkersRef.current.forEach((m) => m.remove());
      shopMarkersRef.current = [];
    };
  }, [mapReady, shops, onShopClick]);

  // Globaler Zoom-Scaling-Effect: skaliert ALLE Marker (Self, Runner, Drops, Shops)
  // anhand des aktuellen Map-Zooms. Label-Fade fuer Shop-Namen.
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    const container = map.getContainer();

    const applyZoomScale = () => {
      const zoom = map.getZoom();
      let scale = 1;
      if (zoom < 11)      scale = 0.32;
      else if (zoom < 13) scale = 0.35 + ((zoom - 11) / 2) * 0.2;
      else if (zoom < 15) scale = 0.55 + ((zoom - 13) / 2) * 0.25;
      else if (zoom < 17) scale = 0.8  + ((zoom - 15) / 2) * 0.2;
      const showLabel = zoom >= 14;
      const scaleStr = `scale(${scale.toFixed(2)})`;
      container.querySelectorAll<HTMLElement>('[data-zoom-scale="1"]').forEach((el) => {
        el.style.transform = scaleStr;
      });
      container.querySelectorAll<HTMLElement>('[data-shop-label="1"]').forEach((el) => {
        el.style.opacity = showLabel ? "1" : "0";
      });
    };
    applyZoomScale();
    map.on("zoom", applyZoomScale);
    // Marker werden oft NACH Zoom-Ende hinzugefuegt (neuer Shop etc.) → auch beim moveend neu skalieren
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
          "line-width": ["*", ["get", "strokeWeight"], 4],
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
          "line-width": ["get", "strokeWeight"],
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
        paint: { "line-color": color, "line-opacity": 0.3, "line-width": light.width + 10, "line-blur": 4 },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      map.addLayer({
        id: mainId, type: "line", source: sourceId,
        paint: { "line-color": color, "line-opacity": 1, "line-width": light.width },
        layout: { "line-cap": "round", "line-join": "round" },
      });
    }
    if (map.getLayer(mainId)) {
      map.setPaintProperty(glowId, "line-color", color);
      map.setPaintProperty(mainId, "line-color", color);
      map.setPaintProperty(mainId, "line-width", light.width);
      map.setPaintProperty(glowId, "line-width", light.width + 10);
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
        paint: { "line-color": color, "line-opacity": 0.35, "line-width": light.width + 8, "line-blur": 3 },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      map.addLayer({
        id: mainId, type: "line", source: sourceId,
        paint: { "line-color": color, "line-opacity": 1, "line-width": light.width + 2 },
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
          "line-width": 3,
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
          "line-width": 6,
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
          "line-width": 2.5,
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

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
