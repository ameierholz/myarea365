"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const FALLBACK_CENTER: [number, number] = [13.405, 52.52];

export function HeroMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [showRadar, setShowRadar] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

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
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
          },
        },
        layers: [
          {
            id: "carto-dark-layer",
            type: "raster",
            source: "carto-dark",
            minzoom: 0,
            maxzoom: 20,
            paint: {
              "raster-brightness-max": 1,
              "raster-brightness-min": 0.15,
              "raster-contrast": 0.1,
              "raster-saturation": 0.3,
            },
          },
        ],
      },
      center: FALLBACK_CENTER,
      zoom: 12,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
    });

    mapRef.current = map;

    function zoomIn(center: [number, number]) {
      map.flyTo({
        center,
        zoom: 16,
        duration: 3500,
        curve: 1.2,
      });
      setTimeout(() => setShowRadar(true), 3200);
    }

    // DSGVO: Auf der Landing-Page NIEMALS unaufgefordert GPS abfragen.
    // Wir zoomen auf den Fallback-Center (Berlin); der User kann per Button auf
    // seinen Standort zoomen (siehe zoomToMe unten).
    map.once("load", () => zoomIn(FALLBACK_CENTER));

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="w-full h-full" />

      {/* Teal tint */}
      <div
        className="absolute inset-0 pointer-events-none mix-blend-multiply"
        style={{ background: "rgba(10,40,50,0.3)" }}
      />

      {/* Gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, rgba(11,14,19,0.9) 0%, rgba(11,14,19,0.35) 25%, rgba(11,14,19,0) 40%, rgba(11,14,19,0) 58%, rgba(11,14,19,0.5) 72%, rgba(11,14,19,0.92) 85%, rgba(11,14,19,0.98) 100%)",
        }}
      />

      {/* Radar at map center */}
      {showRadar && (
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
          style={{ animation: "radarIn 0.8s ease-out" }}
        >
          {/* Outer radar ring – slow rotation */}
          <div className="absolute -inset-44 rounded-full border border-primary/12" style={{ animation: "radarSpin 10s linear infinite" }}>
            {/* Sweep line */}
            <div className="absolute top-1/2 left-1/2 w-1/2 h-px origin-left" style={{ background: "linear-gradient(to right, rgba(34,209,195,0.5), transparent)" }} />
          </div>

          {/* Second ring */}
          <div className="absolute -inset-32 rounded-full border border-primary/15" />

          {/* Third ring */}
          <div className="absolute -inset-20 rounded-full border border-primary/20" />

          {/* Inner ring */}
          <div className="absolute -inset-10 rounded-full border border-primary/25 bg-primary/3" />
        </div>
      )}

      <style>{`
        @keyframes radarIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes radarSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
