"use client";

/**
 * Demo-Page für den MarchSpritesLayer (Phase 3a).
 *
 * Generiert 100 zufällige Marches innerhalb eines Berliner BBox und
 * rendert sie als animierte Sprite-Billboards via Custom WebGL Layer.
 *
 * Verifikation: Performance bei 100 simultanen animierten Chars.
 *
 * URL: /march-demo
 */

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { MarchSpritesLayer, type MarchInstance } from "@/lib/march-sprites-layer";
import "mapbox-gl/dist/mapbox-gl.css";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

// Berlin BBox
const BERLIN_BOUNDS = { minLat: 52.45, maxLat: 52.55, minLng: 13.30, maxLng: 13.50 };

const ACTIONS: Array<MarchInstance["action"]> = ["walk", "run", "idle"];

function randomMarch(idx: number): MarchInstance {
  const r = (a: number, b: number) => a + Math.random() * (b - a);
  const fromLat = r(BERLIN_BOUNDS.minLat, BERLIN_BOUNDS.maxLat);
  const fromLng = r(BERLIN_BOUNDS.minLng, BERLIN_BOUNDS.maxLng);
  const toLat = r(BERLIN_BOUNDS.minLat, BERLIN_BOUNDS.maxLat);
  const toLng = r(BERLIN_BOUNDS.minLng, BERLIN_BOUNDS.maxLng);
  const action = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
  const durMs = action === "run" ? 60_000 : action === "walk" ? 120_000 : 999_999_999;
  const startMs = Date.now() - Math.floor(Math.random() * durMs * 0.8);
  return {
    id: `demo-${idx}`,
    charId: "lorekeeper",
    action,
    fromLat, fromLng, toLat, toLng,
    startMs,
    endMs: startMs + durMs,
    spriteScale: 56,
  };
}

export default function MarchDemoPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const layerRef = useRef<MarchSpritesLayer | null>(null);
  const [count, setCount] = useState(100);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!TOKEN) {
      console.error("NEXT_PUBLIC_MAPBOX_TOKEN is missing");
      return;
    }
    mapboxgl.accessToken = TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [13.40, 52.50],
      zoom: 13,
      pitch: 0,
      bearing: 0,
    });
    mapRef.current = map;

    map.on("load", async () => {
      console.log("[march-demo] map loaded, adding sprite layer");
      const initial = Array.from({ length: count }, (_, i) => randomMarch(i));
      const layer = new MarchSpritesLayer(initial);
      layerRef.current = layer;
      map.addLayer(layer);
      console.log("[march-demo] sprite layer added with", initial.length, "marches");
    });

    map.on("error", (e) => console.error("[march-demo] map error:", e));

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh marches when count changes
  useEffect(() => {
    if (!layerRef.current) return;
    const list = Array.from({ length: count }, (_, i) => randomMarch(i));
    layerRef.current.setMarches(list);
  }, [count]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0F1115", zIndex: 9999 }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      <div style={{
        position: "absolute", top: 12, left: 12, zIndex: 10,
        padding: "10px 12px", borderRadius: 12,
        background: "rgba(15,17,21,0.85)", color: "#FFF",
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(255,255,255,0.1)",
        fontSize: 12, fontFamily: "monospace",
      }}>
        <div style={{ fontWeight: 900, color: "#22D1C3", marginBottom: 6 }}>March Sprites Demo</div>
        <div style={{ marginBottom: 6 }}>Active marches: <b>{count}</b></div>
        <div style={{ display: "flex", gap: 6 }}>
          {[10, 50, 100, 200, 500].map((n) => (
            <button
              key={n}
              onClick={() => setCount(n)}
              style={{
                padding: "4px 8px", borderRadius: 6,
                background: count === n ? "#22D1C3" : "rgba(255,255,255,0.1)",
                color: count === n ? "#0F1115" : "#FFF",
                border: "none", cursor: "pointer",
                fontWeight: 700, fontSize: 11,
              }}
            >{n}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
