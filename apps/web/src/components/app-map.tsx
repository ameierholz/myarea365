"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import { MARKER_SKINS } from "./marker-skins";

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
  { featureType: "road.local", elementType: "geometry", stylers: [{ color: "#2a3040" }] },
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
  { featureType: "landscape.man_made", elementType: "geometry", stylers: [{ color: "#1a1d23" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#141820" }] },
];

interface TrailStyle {
  color: string;
  width: number;
  glow: boolean;
  gradientColors?: string[];
}

interface AppMapProps {
  onLocationUpdate?: (lng: number, lat: number) => void;
  trackingActive?: boolean;
  markerSkin?: string;
  trailStyle?: TrailStyle;
}

function LocationTracker({ onLocationUpdate, trackingActive, markerSkin = "default", trailStyle }: AppMapProps) {
  const map = useMap();
  const [pos, setPos] = useState<google.maps.LatLngLiteral | null>(null);
  const locatedRef = useRef(false);
  const watchRef = useRef<number | null>(null);
  const markerRef = useRef<google.maps.OverlayView | null>(null);
  const markerDivRef = useRef<HTMLDivElement | null>(null);
  const trailRef = useRef<google.maps.Polyline | null>(null);
  const trailPathRef = useRef<google.maps.LatLngLiteral[]>([]);
  const glowTrailRef = useRef<google.maps.Polyline | null>(null);

  // Create custom marker overlay
  useEffect(() => {
    if (!map || !pos) return;

    const skinFn = MARKER_SKINS[markerSkin] || MARKER_SKINS.default;
    const html = skinFn({ size: 22 });

    // Remove old marker div
    if (markerDivRef.current) {
      markerDivRef.current.remove();
    }

    // Create overlay
    class CustomMarker extends google.maps.OverlayView {
      private div: HTMLDivElement | null = null;
      private position: google.maps.LatLng;

      constructor(position: google.maps.LatLng) {
        super();
        this.position = position;
      }

      onAdd() {
        this.div = document.createElement("div");
        this.div.style.position = "absolute";
        this.div.style.transform = "translate(-50%, -50%)";
        this.div.style.pointerEvents = "none";
        this.div.innerHTML = html;
        const style = document.createElement("style");
        style.textContent = `@keyframes pulse { 0%,100% { transform:scale(1); opacity:0.7; } 50% { transform:scale(1.15); opacity:1; } }`;
        this.div.appendChild(style);
        markerDivRef.current = this.div;
        const panes = this.getPanes();
        panes?.overlayMouseTarget.appendChild(this.div);
      }

      draw() {
        if (!this.div) return;
        const proj = this.getProjection();
        if (!proj) return;
        const point = proj.fromLatLngToDivPixel(this.position);
        if (point) {
          this.div.style.left = point.x + "px";
          this.div.style.top = point.y + "px";
        }
      }

      onRemove() {
        this.div?.remove();
        this.div = null;
      }

      setPosition(pos: google.maps.LatLng) {
        this.position = pos;
        this.draw();
      }
    }

    const overlay = new CustomMarker(new google.maps.LatLng(pos.lat, pos.lng));
    overlay.setMap(map);
    markerRef.current = overlay;

    return () => {
      overlay.setMap(null);
    };
  }, [map, markerSkin]);

  // Update marker position
  useEffect(() => {
    if (markerRef.current && pos) {
      (markerRef.current as any).setPosition(new google.maps.LatLng(pos.lat, pos.lng));
    }
  }, [pos]);

  // Trail polyline
  useEffect(() => {
    if (!map) return;

    const color = trailStyle?.color || "#22D1C3";
    const width = trailStyle?.width || 4;
    const glow = trailStyle?.glow || false;

    // Glow trail (wider, transparent)
    if (glow && !glowTrailRef.current) {
      glowTrailRef.current = new google.maps.Polyline({
        map,
        path: [],
        strokeColor: color,
        strokeOpacity: 0.2,
        strokeWeight: width * 3,
      });
    }

    // Main trail
    if (!trailRef.current) {
      trailRef.current = new google.maps.Polyline({
        map,
        path: [],
        strokeColor: color,
        strokeOpacity: 0.8,
        strokeWeight: width,
      });
    }

    // Update colors if trail style changes
    if (trailRef.current) {
      trailRef.current.setOptions({ strokeColor: color, strokeWeight: width });
    }
    if (glowTrailRef.current) {
      glowTrailRef.current.setOptions({ strokeColor: color, strokeWeight: width * 3 });
    }

    return () => {
      trailRef.current?.setMap(null);
      glowTrailRef.current?.setMap(null);
      trailRef.current = null;
      glowTrailRef.current = null;
    };
  }, [map, trailStyle]);

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

      // Add to trail when walking
      if (trackingActive) {
        trailPathRef.current.push(newPos);
        trailRef.current?.setPath(trailPathRef.current);
        glowTrailRef.current?.setPath(trailPathRef.current);
      }
    },
    [map, trackingActive, onLocationUpdate]
  );

  // Reset trail when walk stops
  useEffect(() => {
    if (!trackingActive) {
      // Keep trail visible for a moment, then fade
      // For now just clear on next walk start
    } else {
      trailPathRef.current = [];
      trailRef.current?.setPath([]);
      glowTrailRef.current?.setPath([]);
    }
  }, [trackingActive]);

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
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
      <APIProvider apiKey={GOOGLE_MAPS_KEY}>
        <MapInner {...props} />
      </APIProvider>
    </div>
  );
}
