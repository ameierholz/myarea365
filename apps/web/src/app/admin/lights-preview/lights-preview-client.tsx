"use client";

// Visual-Testbed für Map-Effekte. Zeigt alle Runner-Lights und Rally-Märsche
// auf einer echten Mapbox-Karte mit dem identischen 3-Layer-Render-Code wie
// in app-map.tsx (Halo + Core + Pulse + dasharray-Animation). Ermöglicht das
// Vergleichen aller 20 Lights ohne dass man im Spiel jedes einzeln equippen
// und draußen rumlaufen muss.

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { RUNNER_LIGHTS, LIGHT_VISUAL_SPECS, type RunnerLightId } from "@/lib/game-config";
import { addRunnerLight, removeRunnerLight, type LightRenderHandles } from "@/lib/runner-light-render";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
const BERLIN_CENTER: [number, number] = [13.3777, 52.5163];

// Fake-Walking-Route durch Berlin Mitte (rein dekorativ).
const RUNNER_ROUTE: Array<[number, number]> = [
  [13.3680, 52.5150], [13.3700, 52.5152], [13.3720, 52.5155], [13.3740, 52.5158],
  [13.3755, 52.5162], [13.3770, 52.5163], [13.3785, 52.5165], [13.3800, 52.5168],
  [13.3820, 52.5172], [13.3840, 52.5175], [13.3860, 52.5178], [13.3880, 52.5180],
];

const RALLY_ROUTES = {
  stronghold:    { from: [13.3650, 52.5100] as [number, number], to: BERLIN_CENTER, color: "#FFD700", label: "Wegelager-Rally" },
  crew_repeater: { from: [13.3650, 52.5230] as [number, number], to: BERLIN_CENTER, color: "#FF6B4A", label: "Crew-Repeater" },
  player_base:   { from: [13.3920, 52.5230] as [number, number], to: BERLIN_CENTER, color: "#FF2D78", label: "Player-Base" },
  scout:         { from: [13.3920, 52.5100] as [number, number], to: BERLIN_CENTER, color: "#22D1C3", label: "Späher" },
};

type LayerHandles = { sourceId: string; layerIds: string[]; raf?: number };

// Wrapper um den shared V2-Renderer (siehe lib/runner-light-render.ts).
// latOffset versetzt die Route vertikal damit alle 20 Lights nebeneinander
// passen ohne sich zu überlagern.
function addLightToMap(
  map: mapboxgl.Map,
  light: typeof RUNNER_LIGHTS[number],
  spec: typeof LIGHT_VISUAL_SPECS[RunnerLightId],
  uid: string,
  latOffset: number,
): LightRenderHandles {
  const coords = RUNNER_ROUTE.map(([lng, lat]) => [lng, lat + latOffset] as [number, number]);
  const data: GeoJSON.Feature<GeoJSON.LineString> = {
    type: "Feature",
    geometry: { type: "LineString", coordinates: coords },
    properties: {},
  };
  return addRunnerLight(map, uid, data, { light, spec });
}

function removeLightFromMap(map: mapboxgl.Map, h: LightRenderHandles) {
  removeRunnerLight(map, h);
}

function addRallyToMap(map: mapboxgl.Map, kind: keyof typeof RALLY_ROUTES, uid: string): LayerHandles {
  const r = RALLY_ROUTES[kind];
  const sourceId = `rally-${uid}`;
  const glowId = `${sourceId}-glow`;
  const casingId = `${sourceId}-casing`;
  const lineId = `${sourceId}-line`;
  const arrowId = `${sourceId}-arrows`;
  const data = {
    type: "Feature" as const,
    geometry: { type: "LineString" as const, coordinates: [r.from, r.to] },
    properties: { color: r.color },
  };
  map.addSource(sourceId, { type: "geojson", data });
  map.addLayer({
    id: glowId, type: "line", source: sourceId,
    paint: { "line-color": r.color, "line-width": 14, "line-opacity": 0.22, "line-blur": 10 },
    layout: { "line-cap": "round", "line-join": "round" },
  });
  map.addLayer({
    id: casingId, type: "line", source: sourceId,
    paint: { "line-color": "#1a1a1a", "line-width": 6, "line-opacity": 0.85 },
    layout: { "line-cap": "round", "line-join": "round" },
  });
  map.addLayer({
    id: lineId, type: "line", source: sourceId,
    paint: { "line-color": r.color, "line-width": 3.5, "line-opacity": 1, "line-dasharray": [0, 4, 3] },
    layout: { "line-cap": "round", "line-join": "round" },
  });
  map.addLayer({
    id: arrowId, type: "symbol", source: sourceId,
    layout: {
      "symbol-placement": "line", "symbol-spacing": 90,
      "text-field": "▶", "text-size": 13, "text-keep-upright": false,
      "text-rotation-alignment": "map", "text-pitch-alignment": "map",
      "text-allow-overlap": true, "text-ignore-placement": true, "text-padding": 2,
    },
    paint: { "text-color": "#1a1a1a", "text-halo-color": r.color, "text-halo-width": 1.5 },
  });

  const handles: LayerHandles = { sourceId, layerIds: [glowId, casingId, lineId, arrowId] };
  // Animierter "Marsch-Strich"-Effekt
  const dashSeq: Array<[number, number, number]> = [
    [0, 4, 3], [1, 4, 2], [2, 4, 1], [3, 4, 0],
  ];
  let idx = 0; let frameCount = 0;
  const tick = () => {
    frameCount++;
    if (frameCount % 8 === 0) {
      idx = (idx + 1) % dashSeq.length;
      if (map.getLayer(lineId)) {
        try { map.setPaintProperty(lineId, "line-dasharray", dashSeq[idx]); } catch { /* gone */ }
      }
    }
    handles.raf = requestAnimationFrame(tick);
  };
  handles.raf = requestAnimationFrame(tick);
  return handles;
}

export function LightsPreviewClient() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const lightHandlesRef = useRef<Map<string, LightRenderHandles>>(new Map());
  const rallyHandlesRef = useRef<Map<string, LayerHandles>>(new Map());
  const [mapReady, setMapReady] = useState(false);

  const [mode, setMode] = useState<"single" | "all">("single");
  const [selectedLight, setSelectedLight] = useState<RunnerLightId>("classic");
  const [showStronghold, setShowStronghold] = useState(true);
  const [showCrew, setShowCrew] = useState(true);
  const [showBase, setShowBase] = useState(true);
  const [showScout, setShowScout] = useState(true);

  // Map einmalig initialisieren
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!TOKEN) return;
    mapboxgl.accessToken = TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: BERLIN_CENTER,
      zoom: 13,
      pitch: 35,
      bearing: -10,
    });
    map.on("load", () => {
      setMapReady(true);
      mapRef.current = map;
    });
    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, []);

  // Light-Layer rebuild bei Mode/Selection-Wechsel
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current!;
    // Cleanup alle alten
    for (const h of lightHandlesRef.current.values()) removeLightFromMap(map, h);
    lightHandlesRef.current.clear();

    if (mode === "single") {
      const l = RUNNER_LIGHTS.find((x) => x.id === selectedLight) ?? RUNNER_LIGHTS[0];
      const spec = LIGHT_VISUAL_SPECS[l.id];
      const h = addLightToMap(map, l, spec, l.id, 0);
      lightHandlesRef.current.set(l.id, h);
    } else {
      // Alle 20 vertikal gestaffelt — Offset 0.0008° lat = ~90m
      const ROW_HEIGHT = 0.0006;
      RUNNER_LIGHTS.forEach((l, i) => {
        const spec = LIGHT_VISUAL_SPECS[l.id];
        const offset = (i - RUNNER_LIGHTS.length / 2) * ROW_HEIGHT;
        const h = addLightToMap(map, l, spec, l.id, offset);
        lightHandlesRef.current.set(l.id, h);
      });
      // Ranzoomen damit alle 20 reihen sichtbar sind
      const span = (RUNNER_LIGHTS.length / 2) * ROW_HEIGHT * 1.2;
      map.fitBounds([
        [13.3650, BERLIN_CENTER[1] - span],
        [13.3900, BERLIN_CENTER[1] + span],
      ], { padding: 60, duration: 800 });
    }
  }, [mapReady, mode, selectedLight]);

  // Rally-Layer rebuild bei Toggle-Wechsel
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current!;
    for (const h of rallyHandlesRef.current.values()) {
      if (h.raf) cancelAnimationFrame(h.raf);
      for (const id of h.layerIds) if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(h.sourceId)) map.removeSource(h.sourceId);
    }
    rallyHandlesRef.current.clear();
    if (showStronghold) rallyHandlesRef.current.set("stronghold", addRallyToMap(map, "stronghold", "stronghold"));
    if (showCrew)       rallyHandlesRef.current.set("crew",       addRallyToMap(map, "crew_repeater", "crew"));
    if (showBase)       rallyHandlesRef.current.set("base",       addRallyToMap(map, "player_base",   "base"));
    if (showScout)      rallyHandlesRef.current.set("scout",      addRallyToMap(map, "scout",         "scout"));
  }, [mapReady, showStronghold, showCrew, showBase, showScout]);

  const selectedSpec = LIGHT_VISUAL_SPECS[selectedLight];
  const selectedLightObj = useMemo(() => RUNNER_LIGHTS.find((l) => l.id === selectedLight)!, [selectedLight]);

  if (!TOKEN) {
    return <div className="p-6 text-red-400">NEXT_PUBLIC_MAPBOX_TOKEN fehlt — Mapbox kann nicht initialisiert werden.</div>;
  }

  return (
    <div className="min-h-screen bg-[#0F1115] text-white">
      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-0 h-screen">
        {/* Sidebar */}
        <div className="bg-[#1A1D23] border-r border-white/10 overflow-y-auto p-4 space-y-6">
          <div>
            <h1 className="text-xl font-black mb-1">🎨 Map-Effekte Preview</h1>
            <p className="text-xs text-[#8B8FA3]">Visual-Testbed für Lights & Märsche — echte Mapbox-Render-Pipeline.</p>
          </div>

          {/* Runner-Lights-Section */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#22D1C3]">Runner-Lights ({RUNNER_LIGHTS.length})</h2>
              <div className="flex gap-1 text-[10px]">
                <button
                  onClick={() => setMode("single")}
                  className={`px-2 py-1 rounded ${mode === "single" ? "bg-[#22D1C3] text-black font-bold" : "bg-white/10"}`}
                >Einzeln</button>
                <button
                  onClick={() => setMode("all")}
                  className={`px-2 py-1 rounded ${mode === "all" ? "bg-[#22D1C3] text-black font-bold" : "bg-white/10"}`}
                >Alle 20</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {RUNNER_LIGHTS.map((l) => {
                const grad = l.gradient.length > 1 ? `linear-gradient(90deg, ${l.gradient.join(", ")})` : l.color;
                const active = mode === "single" && selectedLight === l.id;
                return (
                  <button
                    key={l.id}
                    onClick={() => { setMode("single"); setSelectedLight(l.id); }}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-left ${active ? "border-[#22D1C3] bg-[#22D1C3]/10" : "border-white/10 hover:bg-white/5"}`}
                  >
                    <div style={{
                      width: 20, height: Math.max(3, l.width - 2),
                      borderRadius: l.width / 2, background: grad,
                      boxShadow: `0 0 6px ${l.color}aa`,
                    }} />
                    <span className="text-[11px] font-semibold truncate flex-1">{l.name}</span>
                    {l.cost > 0 && <span className="text-[9px] text-[#8B8FA3]">{l.cost >= 1000 ? `${l.cost / 1000}k` : l.cost}</span>}
                  </button>
                );
              })}
            </div>
            {mode === "single" && selectedSpec && (
              <div className="mt-3 p-2 bg-[#0F1115] rounded-lg border border-white/10 text-[10px] space-y-1">
                <div className="font-bold text-[#22D1C3] uppercase">{selectedLightObj.name} Spec</div>
                <div className="grid grid-cols-2 gap-x-2 text-[#a8b4cf]">
                  <div>Bloom-Layer: <b className="text-white">{selectedSpec.bloom.length}</b></div>
                  <div>Core-Blur: <b className="text-white">{selectedSpec.coreBlur}</b></div>
                  <div>Animation: <b className="text-white">{selectedSpec.animation}</b></div>
                  <div>Speed: <b className="text-white">{selectedSpec.animSpeedSec}s</b></div>
                  {selectedSpec.animAmp && <div>Anim-Amp: <b className="text-white">{(selectedSpec.animAmp * 100).toFixed(0)}%</b></div>}
                  {selectedSpec.particles && <div>Partikel: <b className="text-white">{selectedSpec.particles.count}× {selectedSpec.particles.kind}</b></div>}
                  {selectedSpec.innerWhite && <div>Inner-White: <b className="text-white">opacity {selectedSpec.innerWhite.opacity}</b></div>}
                </div>
                <div className="pt-1 border-t border-white/5"><span className="text-[#8B8FA3]">Vibe:</span> {selectedSpec.vibe}</div>
              </div>
            )}
          </section>

          {/* Rally-Section */}
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#FF6B4A] mb-2">Märsche & Späher</h2>
            <div className="space-y-1.5">
              {([
                { key: "stronghold", state: showStronghold, set: setShowStronghold, color: "#FFD700", label: "Wegelager-Rally (PvE)" },
                { key: "crew",       state: showCrew,       set: setShowCrew,       color: "#FF6B4A", label: "Crew-Repeater" },
                { key: "base",       state: showBase,       set: setShowBase,       color: "#FF2D78", label: "Player-Base (PvP)" },
                { key: "scout",      state: showScout,      set: setShowScout,      color: "#22D1C3", label: "Späher-Marsch" },
              ] as const).map((r) => (
                <label key={r.key} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer">
                  <input type="checkbox" checked={r.state} onChange={(e) => r.set(e.target.checked)} className="accent-[#22D1C3]" />
                  <div style={{ width: 24, height: 4, borderRadius: 2, background: r.color, boxShadow: `0 0 6px ${r.color}aa` }} />
                  <span className="text-xs font-semibold">{r.label}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="text-[10px] text-[#8B8FA3] leading-relaxed border-t border-white/10 pt-3">
            <p><b className="text-white">Tipp:</b> "Alle 20" zeigt jede Light als horizontalen Trail — vertikal gestaffelt. Perfekt für Marketing-Screenshots oder um Lights nebeneinander zu vergleichen.</p>
          </section>
        </div>

        {/* Map */}
        <div ref={containerRef} className="w-full h-screen" />
      </div>
    </div>
  );
}
