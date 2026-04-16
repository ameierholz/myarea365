"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import { LIVE_OTHER_RUNNERS } from "@/lib/game-config";

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "";
const FALLBACK = { lat: 52.52, lng: 13.405 };

const DARK_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#1a1d23" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1d23" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#6b7280" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#2a3040" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#303845" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1f2937" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#404a5a" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8b95a5" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#1f2937" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#6b7280" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#1a2e1a" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#4ade80" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "poi.government", stylers: [{ visibility: "off" }] },
  { featureType: "poi.school", stylers: [{ visibility: "off" }] },
  { featureType: "poi.medical", stylers: [{ visibility: "off" }] },
  { featureType: "poi.place_of_worship", stylers: [{ visibility: "off" }] },
  { featureType: "poi.sports_complex", stylers: [{ visibility: "off" }] },
  { featureType: "poi.attraction", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#1f2937" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1a2b" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4a6fa5" }] },
];

interface AppMapProps {
  onLocationUpdate?: (lng: number, lat: number) => void;
  trackingActive?: boolean;
  teamColor?: string;
  markerEmoji?: string;
  username?: string;
  activeRoute?: Array<{ lat: number; lng: number }>;
  savedTerritories?: Array<Array<{ lat: number; lng: number }>>;
}

function createMarkerOverlay(
  pos: google.maps.LatLng,
  html: string
): google.maps.OverlayView {
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
  return new Overlay(pos);
}

function LocationTracker({
  onLocationUpdate,
  trackingActive,
  teamColor = "#22D1C3",
  markerEmoji = "👣",
  username = "Ich",
  activeRoute = [],
  savedTerritories = [],
}: AppMapProps) {
  const map = useMap();
  const [pos, setPos] = useState<google.maps.LatLngLiteral | null>(null);
  const locatedRef = useRef(false);
  const watchRef = useRef<number | null>(null);
  const meMarkerRef = useRef<google.maps.OverlayView | null>(null);
  const otherMarkersRef = useRef<google.maps.OverlayView[]>([]);
  const activePolylineRef = useRef<google.maps.Polyline | null>(null);
  const activeGlowRef = useRef<google.maps.Polyline | null>(null);
  const territoryPolylinesRef = useRef<google.maps.Polyline[]>([]);

  // Render my marker
  useEffect(() => {
    if (!map || !pos) return;

    const html = `
      <div style="position:relative;display:flex;align-items:center;justify-content:center">
        <div style="position:absolute;width:60px;height:60px;border-radius:50%;background:${teamColor}15;box-shadow:0 0 30px ${teamColor}40;${trackingActive ? "animation:meping 2s ease-in-out infinite" : ""}"></div>
        <div style="width:46px;height:46px;border-radius:50%;background:#141820;border:${trackingActive ? 4 : 3}px solid ${teamColor};display:flex;align-items:center;justify-content:center;font-size:22px;box-shadow:0 0 20px ${teamColor}60">
          ${markerEmoji}
        </div>
      </div>
      <style>@keyframes meping{0%,100%{transform:scale(1);opacity:0.7}50%{transform:scale(1.2);opacity:1}}</style>
    `;

    if (meMarkerRef.current) {
      (meMarkerRef.current as unknown as { setPosition: (p: google.maps.LatLng) => void }).setPosition(
        new google.maps.LatLng(pos.lat, pos.lng)
      );
    } else {
      const overlay = createMarkerOverlay(new google.maps.LatLng(pos.lat, pos.lng), html);
      overlay.setMap(map);
      meMarkerRef.current = overlay;
    }

    return () => {
      meMarkerRef.current?.setMap(null);
      meMarkerRef.current = null;
    };
  }, [map, pos, teamColor, markerEmoji, trackingActive]);

  // Render other runners
  useEffect(() => {
    if (!map) return;

    otherMarkersRef.current.forEach((m) => m.setMap(null));
    otherMarkersRef.current = [];

    LIVE_OTHER_RUNNERS.forEach((r) => {
      const html = `
        <div style="position:relative;display:flex;align-items:center;justify-content:center">
          <div style="width:40px;height:40px;border-radius:50%;background:#141820;border:2px solid ${r.team_color};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;color:${r.team_color}">
            ${r.username[0].toUpperCase()}
          </div>
        </div>
      `;
      const overlay = createMarkerOverlay(new google.maps.LatLng(r.lat, r.lng), html);
      overlay.setMap(map);
      otherMarkersRef.current.push(overlay);
    });

    return () => {
      otherMarkersRef.current.forEach((m) => m.setMap(null));
      otherMarkersRef.current = [];
    };
  }, [map]);

  // Render active route (while walking)
  useEffect(() => {
    if (!map) return;

    // Clear old
    activePolylineRef.current?.setMap(null);
    activeGlowRef.current?.setMap(null);

    if (trackingActive && activeRoute.length > 0) {
      const path = activeRoute.map((p) => ({ lat: p.lat, lng: p.lng }));

      // Glow line (wider, transparent)
      activeGlowRef.current = new google.maps.Polyline({
        map,
        path,
        strokeColor: teamColor,
        strokeOpacity: 0.25,
        strokeWeight: 16,
      });

      // Main line
      activePolylineRef.current = new google.maps.Polyline({
        map,
        path,
        strokeColor: teamColor,
        strokeOpacity: 0.9,
        strokeWeight: 6,
      });
    }

    return () => {
      activePolylineRef.current?.setMap(null);
      activeGlowRef.current?.setMap(null);
    };
  }, [map, activeRoute, trackingActive, teamColor]);

  // Render saved territories (past conquests)
  useEffect(() => {
    if (!map) return;

    territoryPolylinesRef.current.forEach((p) => p.setMap(null));
    territoryPolylinesRef.current = [];

    savedTerritories.forEach((territory) => {
      const path = territory.map((p) => ({ lat: p.lat, lng: p.lng }));
      const line = new google.maps.Polyline({
        map,
        path,
        strokeColor: teamColor,
        strokeOpacity: 0.7,
        strokeWeight: 10,
      });
      territoryPolylinesRef.current.push(line);
    });

    return () => {
      territoryPolylinesRef.current.forEach((p) => p.setMap(null));
      territoryPolylinesRef.current = [];
    };
  }, [map, savedTerritories, teamColor]);

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
      styles={DARK_STYLE}
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
