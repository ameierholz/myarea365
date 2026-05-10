"use client";

/**
 * Radar-Hintergrund für die Loader-Phase des Game-Splash.
 *
 * Identischer Look zur Landing-Page (HeroMap): CARTO-Dark-Tiles mit
 * Teal-Tint + 4 konzentrische Radar-Ringe + sweep-Linie.
 *
 * Center: User-Base aus /api/base/me (cached durch den Splash-Pre-Loader).
 * Fallback Berlin, dann sanft auf echte Position fliegen sobald da.
 */

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { fetchBaseMe } from "@/lib/base-me-cache";

const FALLBACK_CENTER: [number, number] = [13.405, 52.52];

export function SplashRadarBg() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    }

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          "carto-dark": {
            type: "raster",
            tiles: [
              "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
              "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
              "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
            ],
            tileSize: 256,
          },
        },
        layers: [
          {
            id: "carto-dark-layer",
            type: "raster",
            source: "carto-dark",
            paint: {
              "raster-brightness-max": 0.8,
              "raster-brightness-min": 0.1,
              "raster-contrast": 0.15,
              "raster-saturation": 0.4,
            },
          },
        ],
      },
      center: FALLBACK_CENTER,
      zoom: 14,
      pitch: 30,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
    });

    mapRef.current = map;

    map.once("load", () => {
      // Hole User-Base-Position aus shared cache (vom Splash-Pre-Loader gefüllt).
      void (async () => {
        try {
          const j = await fetchBaseMe() as { base?: { lat?: number | null; lng?: number | null } } | null;
          if (!j) throw new Error("no base");
          const lat = j.base?.lat;
          const lng = j.base?.lng;
          if (typeof lat === "number" && typeof lng === "number" && mapRef.current) {
            // Sofort jumpen auf echte Position, dann sanfter Auto-Zoom
            mapRef.current.jumpTo({ center: [lng, lat], zoom: 14 });
            mapRef.current.flyTo({ center: [lng, lat], zoom: 15.5, duration: 8000, curve: 1.2 });
            return;
          }
        } catch { /* fallback unten */ }
        // Fallback: Berlin Auto-Pan
        mapRef.current?.flyTo({ center: FALLBACK_CENTER, zoom: 15.5, duration: 8000, curve: 1.2 });
      })();
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      {/* Teal-Tint */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        mixBlendMode: "multiply",
        background: "rgba(10,40,50,0.45)",
      }} />
      {/* Vignette → fadet die Ränder ins Schwarz */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(15,17,21,0.85) 90%)",
      }} />
      {/* Radar — 4 konzentrische Ringe + Sweep */}
      <div style={{
        position: "absolute", left: "50%", top: "50%",
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
      }}>
        {/* Outer rotating ring with sweep */}
        <div style={{
          position: "absolute", left: "-200px", top: "-200px",
          width: 400, height: 400, borderRadius: "50%",
          border: "1px solid rgba(34,209,195,0.18)",
          animation: "splashRadarSpin 10s linear infinite",
        }}>
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            width: "50%", height: 1,
            transformOrigin: "left center",
            background: "linear-gradient(to right, rgba(34,209,195,0.6), transparent)",
          }} />
        </div>
        {/* Middle ring */}
        <div style={{
          position: "absolute", left: "-140px", top: "-140px",
          width: 280, height: 280, borderRadius: "50%",
          border: "1px solid rgba(34,209,195,0.22)",
        }} />
        {/* Inner ring */}
        <div style={{
          position: "absolute", left: "-90px", top: "-90px",
          width: 180, height: 180, borderRadius: "50%",
          border: "1px solid rgba(34,209,195,0.28)",
        }} />
        {/* Core dot */}
        <div style={{
          position: "absolute", left: "-50px", top: "-50px",
          width: 100, height: 100, borderRadius: "50%",
          border: "1px solid rgba(34,209,195,0.35)",
          background: "rgba(34,209,195,0.04)",
        }} />
      </div>
      <style>{`
        @keyframes splashRadarSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
