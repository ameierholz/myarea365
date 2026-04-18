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

  // Shops — native Mapbox Symbol-Layer (GPU-gerendert, zoom-scharf, kein DOM-Scale-Blur)
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    const SRC = "shops-source";
    const LYR_ARENA_GLOW = "shops-arena-glow";
    const LYR_GLOW       = "shops-spotlight-glow";
    const LYR_PIN        = "shops-pin-drop";
    const LYR_LABEL      = "shops-pin-label";

    // Fuer jeden Shop ein eigenes Pin-Image generieren (Color + Emoji + Gradient + Border)
    // Mapbox downsampled das high-res Image beim Zoomen → immer scharf
    function darken(hex: string, amt = 0.25): string {
      const c = hex.replace("#", "");
      const r = Math.max(0, Math.round(parseInt(c.slice(0,2),16) * (1-amt)));
      const g = Math.max(0, Math.round(parseInt(c.slice(2,4),16) * (1-amt)));
      const b = Math.max(0, Math.round(parseInt(c.slice(4,6),16) * (1-amt)));
      return `rgb(${r},${g},${b})`;
    }
    function buildShopPinImage(color: string, icon: string): ImageData | null {
      const W = 256, H = 320;
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      // Shadow unter dem Pin
      ctx.shadowColor = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = 20;
      ctx.shadowOffsetY = 10;

      // Drop-Pin-Pfad (tear-drop mit runder Top + spitzer Bottom)
      const cx = W / 2;
      const cy = W * 0.5; // Circle center
      const r  = W * 0.42;
      const tipY = H - 12;
      ctx.beginPath();
      ctx.moveTo(cx, tipY);
      ctx.bezierCurveTo(cx - r * 1.05, cy + r * 0.9, cx - r, cy + r * 0.1, cx - r, cy);
      ctx.arc(cx, cy, r, Math.PI, 0, false);
      ctx.bezierCurveTo(cx + r, cy + r * 0.1, cx + r * 1.05, cy + r * 0.9, cx, tipY);
      ctx.closePath();

      // Gradient fill
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, color);
      grad.addColorStop(1, darken(color, 0.25));
      ctx.fillStyle = grad;
      ctx.fill();

      // Weisser Border — Shadow deaktivieren
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.lineWidth = 10;
      ctx.strokeStyle = "#FFFFFF";
      ctx.stroke();

      // Innerer Kreis (weiss) fuer Emoji-Bubble
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fill();

      // Emoji
      ctx.font = `${Math.round(r * 1.1)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#0F1115";
      ctx.fillText(icon, cx, cy + 4);

      return ctx.getImageData(0, 0, W, H);
    }

    // Jedem Shop sein eigenes Image registrieren, keyed by color + icon
    const imageKeyFor = (s: ShopPin) => `shop-pin-${s.color ?? "default"}-${s.icon ?? "none"}`.replace(/[^a-zA-Z0-9-]/g, "_");
    for (const s of shops) {
      const key = imageKeyFor(s);
      if (!map.hasImage(key)) {
        const img = buildShopPinImage(s.color || "#FFD700", s.icon || "📍");
        if (img) map.addImage(key, img, { pixelRatio: 2 });
      }
    }

    const geojson = {
      type: "FeatureCollection" as const,
      features: shops.map((s) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [s.lng, s.lat] },
        properties: {
          id: s.id,
          name: s.name,
          image_key: imageKeyFor(s),
          color: s.color || "#FFD700",
          spotlight: !!s.spotlight,
          arena: !!s.arena,
        },
      })),
    };

    const existingSrc = map.getSource(SRC) as mapboxgl.GeoJSONSource | undefined;
    if (existingSrc) {
      existingSrc.setData(geojson);
    } else {
      map.addSource(SRC, { type: "geojson", data: geojson });

      // Arena-Glow (lila, drunter damit Spotlight oben drueber liegen kann)
      map.addLayer({
        id: LYR_ARENA_GLOW, type: "circle", source: SRC,
        filter: ["==", ["get", "arena"], true],
        paint: {
          "circle-color": "#a855f7",
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 10, 15, 30, 18, 50],
          "circle-opacity": 0.45,
          "circle-blur": 1.0,
        },
      });
      // Spotlight-Glow (gold, pulsiert via RAF)
      map.addLayer({
        id: LYR_GLOW, type: "circle", source: SRC,
        filter: ["==", ["get", "spotlight"], true],
        paint: {
          "circle-color": "#FFD700",
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 12, 15, 38, 18, 60],
          "circle-opacity": 0.5,
          "circle-blur": 1.2,
        },
      });
      // Drop-Pin via Full-Color-Image (enthaelt Gradient + Border + Shadow + Emoji)
      map.addLayer({
        id: LYR_PIN, type: "symbol", source: SRC,
        layout: {
          "icon-image": ["get", "image_key"],
          "icon-size": ["interpolate", ["linear"], ["zoom"], 10, 0.06, 13, 0.13, 15, 0.22, 18, 0.34],
          "icon-anchor": "bottom",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      });
      // Name-Label unter dem Pin, erst ab zoom 14 sichtbar
      map.addLayer({
        id: LYR_LABEL, type: "symbol", source: SRC,
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 13, 10, 16, 13, 18, 15],
          "text-offset": ["interpolate", ["linear"], ["zoom"], 13, ["literal", [0, 1.4]], 18, ["literal", [0, 2.2]]],
          "text-anchor": "top",
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#FFF",
          "text-halo-color": "rgba(15,17,21,0.9)",
          "text-halo-width": 2.2,
          "text-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0, 14, 1],
        },
      });

      // Click-Handler
      if (onShopClick) {
        const onClick = (e: mapboxgl.MapLayerMouseEvent) => {
          const id = e.features?.[0]?.properties?.id as string | undefined;
          if (id) onShopClick(id);
        };
        [LYR_PIN, LYR_LABEL, LYR_GLOW, LYR_ARENA_GLOW].forEach((l) => {
          map.on("click", l, onClick);
          map.on("mouseenter", l, () => { map.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", l, () => { map.getCanvas().style.cursor = ""; });
        });
      }

      // Glow-Pulse (Spotlight + Arena) via RAF
      let t = 0;
      const pulse = () => {
        t += 1;
        const phase = Math.sin(t * 0.04);
        const opSpotlight = 0.42 + phase * 0.22;
        const opArena     = 0.38 + phase * 0.18;
        const r = (base: number) => base + phase * (base * 0.2);
        if (map.getLayer(LYR_GLOW)) {
          map.setPaintProperty(LYR_GLOW, "circle-opacity", opSpotlight);
          map.setPaintProperty(LYR_GLOW, "circle-radius", [
            "interpolate", ["linear"], ["zoom"],
            11, r(12), 15, r(38), 18, r(60),
          ]);
        }
        if (map.getLayer(LYR_ARENA_GLOW)) {
          map.setPaintProperty(LYR_ARENA_GLOW, "circle-opacity", opArena);
          map.setPaintProperty(LYR_ARENA_GLOW, "circle-radius", [
            "interpolate", ["linear"], ["zoom"],
            11, r(10), 15, r(30), 18, r(50),
          ]);
        }
        pulseRaf = requestAnimationFrame(pulse);
      };
      let pulseRaf = requestAnimationFrame(pulse);
      (map as unknown as { __shopsPulseRaf?: number }).__shopsPulseRaf = pulseRaf;
    }

    return () => {
      const raf = (map as unknown as { __shopsPulseRaf?: number }).__shopsPulseRaf;
      if (raf) cancelAnimationFrame(raf);
      [LYR_LABEL, LYR_PIN, LYR_GLOW, LYR_ARENA_GLOW].forEach((l) => {
        if (map.getLayer(l)) map.removeLayer(l);
      });
      if (map.getSource(SRC)) map.removeSource(SRC);
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
