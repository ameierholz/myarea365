"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import { LIVE_OTHER_RUNNERS, UNLOCKABLE_MARKERS, RUNNER_LIGHTS } from "@/lib/game-config";

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "";
const FALLBACK = { lat: 52.6000, lng: 13.3565 };

// 1:1 mapStyleDark aus der alten App
const MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "poi.government", stylers: [{ visibility: "off" }] },
  { featureType: "poi.school", stylers: [{ visibility: "off" }] },
  { featureType: "poi.medical", stylers: [{ visibility: "off" }] },
  { featureType: "poi.place_of_worship", stylers: [{ visibility: "off" }] },
  { featureType: "poi.sports_complex", stylers: [{ visibility: "off" }] },
  { featureType: "poi.attraction", stylers: [{ visibility: "off" }] },
];

interface AppMapProps {
  onLocationUpdate?: (lng: number, lat: number) => void;
  trackingActive?: boolean;
  teamColor?: string;
  username?: string;
  markerId?: string;
  lightId?: string;
  activeRoute?: Array<{ lat: number; lng: number }>;
  savedTerritories?: Array<Array<{ lat: number; lng: number }>>;
}

// Emoji-Marker für MICH (nur das Icon, mit Glow)
function emojiMarkerHtml(emoji: string, color: string, isRunning: boolean) {
  const size = isRunning ? 52 : 44;
  const glow = isRunning ? 30 : 18;
  return `
    <div style="position:relative;display:flex;align-items:center;justify-content:center;width:${size + 20}px;height:${size + 20}px">
      <div style="position:absolute;width:${size}px;height:${size}px;border-radius:50%;background:${color}25;box-shadow:0 0 ${glow}px ${color}80;${isRunning ? "animation:mePulse 1.5s ease-in-out infinite" : ""}"></div>
      <span style="position:relative;font-size:${isRunning ? 40 : 34}px;filter:drop-shadow(0 2px 8px rgba(0,0,0,0.6)) drop-shadow(0 0 12px ${color}80)">${emoji}</span>
    </div>
    <style>@keyframes mePulse{0%,100%{transform:scale(1);opacity:0.9}50%{transform:scale(1.15);opacity:0.5}}</style>
  `;
}

// Andere Runner: kleiner Emoji-Marker in Team-Farbe
function otherRunnerHtml(emoji: string, color: string) {
  return `
    <div style="position:relative;display:flex;align-items:center;justify-content:center;width:44px;height:44px">
      <div style="position:absolute;width:36px;height:36px;border-radius:50%;background:${color}20;box-shadow:0 0 12px ${color}60"></div>
      <span style="position:relative;font-size:26px;filter:drop-shadow(0 1px 4px rgba(0,0,0,0.7))">${emoji}</span>
    </div>
  `;
}

function createMarkerOverlay(
  pos: google.maps.LatLng,
  html: string
): google.maps.OverlayView & { setPosition: (p: google.maps.LatLng) => void } {
  class Overlay extends google.maps.OverlayView {
    private div: HTMLDivElement | null = null;
    constructor(private pos: google.maps.LatLng) {
      super();
    }
    onAdd() {
      this.div = document.createElement("div");
      this.div.style.position = "absolute";
      this.div.style.transform = "translate(-50%, -50%)";
      this.div.style.pointerEvents = "none";
      this.div.innerHTML = html;
      this.getPanes()?.overlayMouseTarget.appendChild(this.div);
    }
    draw() {
      if (!this.div) return;
      const p = this.getProjection()?.fromLatLngToDivPixel(this.pos);
      if (p) {
        this.div.style.left = p.x + "px";
        this.div.style.top = p.y + "px";
      }
    }
    onRemove() {
      this.div?.remove();
      this.div = null;
    }
    setPosition(pos: google.maps.LatLng) {
      this.pos = pos;
      this.draw();
    }
  }
  return new Overlay(pos) as google.maps.OverlayView & { setPosition: (p: google.maps.LatLng) => void };
}

function LocationTracker({
  onLocationUpdate,
  trackingActive,
  teamColor = "#5ddaf0",
  markerId = "foot",
  lightId = "classic",
  activeRoute = [],
  savedTerritories = [],
}: AppMapProps) {
  const myEmoji = UNLOCKABLE_MARKERS.find((m) => m.id === markerId)?.icon || "👣";
  const light = RUNNER_LIGHTS.find((l) => l.id === lightId) || RUNNER_LIGHTS[0];
  const map = useMap();
  const [pos, setPos] = useState<google.maps.LatLngLiteral | null>(null);
  const locatedRef = useRef(false);
  const watchRef = useRef<number | null>(null);
  const meMarkerRef = useRef<(google.maps.OverlayView & { setPosition: (p: google.maps.LatLng) => void }) | null>(null);
  const otherMarkersRef = useRef<google.maps.OverlayView[]>([]);
  const activeLinesRef = useRef<google.maps.Polyline[]>([]);
  const territoryPolylinesRef = useRef<google.maps.Polyline[]>([]);

  // My marker (Emoji mit Glow)
  useEffect(() => {
    if (!map || !pos) return;
    const html = emojiMarkerHtml(myEmoji, teamColor, !!trackingActive);

    meMarkerRef.current?.setMap(null);
    const overlay = createMarkerOverlay(new google.maps.LatLng(pos.lat, pos.lng), html);
    overlay.setMap(map);
    meMarkerRef.current = overlay;

    return () => {
      meMarkerRef.current?.setMap(null);
      meMarkerRef.current = null;
    };
  }, [map, pos, teamColor, myEmoji, trackingActive]);

  // Other runners
  useEffect(() => {
    if (!map) return;
    otherMarkersRef.current.forEach((m) => m.setMap(null));
    otherMarkersRef.current = [];

    const emojis = ["🏃", "🚶", "🥾"];
    LIVE_OTHER_RUNNERS.forEach((r, i) => {
      const html = otherRunnerHtml(emojis[i % emojis.length], r.team_color);
      const overlay = createMarkerOverlay(new google.maps.LatLng(r.lat, r.lng), html);
      overlay.setMap(map);
      otherMarkersRef.current.push(overlay);
    });

    return () => {
      otherMarkersRef.current.forEach((m) => m.setMap(null));
      otherMarkersRef.current = [];
    };
  }, [map]);

  // Active route mit Runner Light (gradient + glow)
  useEffect(() => {
    if (!map) return;
    activeLinesRef.current.forEach((l) => l.setMap(null));
    activeLinesRef.current = [];

    if (trackingActive && activeRoute.length > 0) {
      const path = activeRoute.map((p) => ({ lat: p.lat, lng: p.lng }));
      const colors = light.gradient;
      const width = light.width;

      // Outer Glow (breit, transparent)
      activeLinesRef.current.push(
        new google.maps.Polyline({
          map,
          path,
          strokeColor: colors[0],
          strokeOpacity: 0.25,
          strokeWeight: width + 14,
          zIndex: 1,
        })
      );

      // Mid Glow
      activeLinesRef.current.push(
        new google.maps.Polyline({
          map,
          path,
          strokeColor: colors[0],
          strokeOpacity: 0.45,
          strokeWeight: width + 6,
          zIndex: 2,
        })
      );

      if (colors.length === 1) {
        // Single color line
        activeLinesRef.current.push(
          new google.maps.Polyline({
            map,
            path,
            strokeColor: colors[0],
            strokeOpacity: 1,
            strokeWeight: width,
            zIndex: 3,
          })
        );
      } else {
        // Gradient: Pfad in Segmente aufteilen, jedes Segment bekommt eine Farbe
        const segments = Math.max(colors.length * 4, path.length - 1);
        const step = (path.length - 1) / segments;

        for (let i = 0; i < segments; i++) {
          const startIdx = Math.floor(i * step);
          const endIdx = Math.min(Math.ceil((i + 1) * step), path.length - 1);
          if (endIdx <= startIdx) continue;

          const segPath = path.slice(startIdx, endIdx + 1);
          const t = i / (segments - 1);
          const colorIdx = Math.min(Math.floor(t * colors.length), colors.length - 1);
          const color = colors[colorIdx];

          activeLinesRef.current.push(
            new google.maps.Polyline({
              map,
              path: segPath,
              strokeColor: color,
              strokeOpacity: 1,
              strokeWeight: width,
              zIndex: 3,
            })
          );
        }
      }
    }

    return () => {
      activeLinesRef.current.forEach((l) => l.setMap(null));
      activeLinesRef.current = [];
    };
  }, [map, activeRoute, trackingActive, light]);

  // Saved territories (Glow + Main-Line in Light-Farbe)
  useEffect(() => {
    if (!map) return;
    territoryPolylinesRef.current.forEach((p) => p.setMap(null));
    territoryPolylinesRef.current = [];

    savedTerritories.forEach((territory) => {
      const path = territory.map((p) => ({ lat: p.lat, lng: p.lng }));
      const color = light.gradient[0];

      territoryPolylinesRef.current.push(
        new google.maps.Polyline({
          map,
          path,
          strokeColor: color,
          strokeOpacity: 0.35,
          strokeWeight: light.width + 8,
          zIndex: 1,
        })
      );
      territoryPolylinesRef.current.push(
        new google.maps.Polyline({
          map,
          path,
          strokeColor: color,
          strokeOpacity: 1,
          strokeWeight: light.width + 2,
          zIndex: 2,
        })
      );
    });

    return () => {
      territoryPolylinesRef.current.forEach((p) => p.setMap(null));
      territoryPolylinesRef.current = [];
    };
  }, [map, savedTerritories, light]);

  const handlePosition = useCallback(
    (geoPos: GeolocationPosition) => {
      const newPos = { lat: geoPos.coords.latitude, lng: geoPos.coords.longitude };
      setPos(newPos);
      onLocationUpdate?.(newPos.lng, newPos.lat);

      if (map && !locatedRef.current) {
        map.panTo(newPos);
        map.setZoom(17);
        locatedRef.current = true;
      } else if (map && trackingActive) {
        map.panTo(newPos);
      }
    },
    [map, trackingActive, onLocationUpdate]
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

  return null;
}

function MapInner(props: AppMapProps) {
  return (
    <Map
      defaultCenter={FALLBACK}
      defaultZoom={15}
      gestureHandling="greedy"
      disableDefaultUI
      zoomControl
      clickableIcons={false}
      styles={MAP_STYLE}
      style={{ width: "100%", height: "100%" }}
    >
      <LocationTracker {...props} />
    </Map>
  );
}

export function AppMap(props: AppMapProps) {
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <APIProvider apiKey={GOOGLE_MAPS_KEY}>
        <MapInner {...props} />
      </APIProvider>
    </div>
  );
}
