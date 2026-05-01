// Runner-Light V3 Renderer — name-passende organische Effekte.
// KEINE line-trim-offset mehr (sah aus wie wandernde Boxen).
// Stattdessen:
//  - Bloom-Stack (3-4 Halos) für echtes HDR-Glow
//  - Core mit optional gradient
//  - Inner-White Hot-Core
//  - Pro Animation organische Modifikation der Paint-Properties:
//      * static / breathe / wave_breathe / wisp_drift / flame_glow → opacity-Modulation
//      * flow / molten_flow / metal_sheen → animierter line-gradient
//      * electric_arcs → kurze opacity/blur-Spikes
//  - Particle-System: zusätzliche circle-layer mit Punkten entlang der Linie
//      * sparkle: zwinkern in place
//      * embers: driften nach oben + faden
//      * stars: langsamere größere Twinkles

import type { Map as MapboxMap, ExpressionSpecification } from "mapbox-gl";
import type { LightVisualSpec, RunnerLightId } from "./game-config";

export type LightRenderHandles = {
  sourceId: string;
  layerIds: string[];
  particleSourceId?: string;
  raf?: number;
};

export type LightRenderInput = {
  light: { id: RunnerLightId; gradient: readonly string[]; width: number };
  spec: LightVisualSpec;
  overrideColor?: string | null;
  widthExpression?: (basePx: number) => number | ExpressionSpecification;
};

// ── Helpers ─────────────────────────────────────────────────────────

function staticGradientStops(colors: readonly string[]): (number | string)[] {
  if (colors.length < 2) return [];
  const flat: (number | string)[] = [];
  colors.forEach((c, i) => { flat.push(i / (colors.length - 1), c); });
  return flat;
}

// Soft "bright bump" gradient — zwei Stops links/rechts vom Bump dunkel,
// in der Mitte hell. Bewegt sich mit `pos` von 0..1. Kein Wraparound, ist
// einfach am Rand begrenzt damit keine harten Kanten entstehen.
function bumpGradient(baseColor: string, brightColor: string, pos: number, width = 0.20): (number | string)[] {
  const halfW = width / 2;
  const stops: Array<[number, string]> = [];
  stops.push([0, baseColor]);
  if (pos - halfW > 0) stops.push([pos - halfW, baseColor]);
  stops.push([pos, brightColor]);
  if (pos + halfW < 1) stops.push([pos + halfW, baseColor]);
  stops.push([1, baseColor]);
  // Sortieren + dedupen (für edge cases pos < 0 oder > 1)
  stops.sort((a, b) => a[0] - b[0]);
  const cleaned: Array<[number, string]> = [];
  for (const s of stops) {
    if (s[0] < 0 || s[0] > 1) continue;
    if (cleaned.length === 0 || cleaned[cleaned.length - 1][0] < s[0]) cleaned.push(s);
  }
  if (cleaned.length === 0 || cleaned[0][0] !== 0) cleaned.unshift([0, baseColor]);
  if (cleaned[cleaned.length - 1][0] !== 1) cleaned.push([1, baseColor]);
  const flat: (number | string)[] = [];
  for (const [p, c] of cleaned) flat.push(p, c);
  return flat;
}

// Multi-color gradient mit geshiftedem Offset (für flow/aurora)
function flowGradient(colors: readonly string[], offset: number): (number | string)[] {
  if (colors.length < 2) {
    // Mono-Farbe: simulate „flow" via bump
    return bumpGradient(colors[0], "#FFFFFF", offset, 0.25);
  }
  // Wickel die Farben so dass eine glatte zyklische Übergabe entsteht
  const seq = [...colors, colors[0]];
  const stops: Array<[number, string]> = [];
  for (let i = 0; i < seq.length; i++) {
    let t = (i / (seq.length - 1) + offset) % 1;
    if (t < 0) t += 1;
    stops.push([t, seq[i]]);
  }
  // Sicherstellen dass 0 und 1 abgedeckt sind
  stops.sort((a, b) => a[0] - b[0]);
  if (stops[0][0] > 0) stops.unshift([0, stops[stops.length - 1][1]]);
  if (stops[stops.length - 1][0] < 1) stops.push([1, stops[0][1]]);
  const flat: (number | string)[] = [];
  for (const [p, c] of stops) flat.push(p, c);
  return flat;
}

// Sample N Punkte entlang einer LineString (in [lng, lat])
function sampleLine(coords: Array<[number, number]>, n: number): Array<[number, number]> {
  if (coords.length === 0 || n <= 0) return [];
  if (coords.length === 1) return Array(n).fill(coords[0]);
  // Cumulative distance per segment (euclid in lat/lng → reicht für sample)
  const segLens: number[] = [];
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const dx = coords[i][0] - coords[i - 1][0];
    const dy = coords[i][1] - coords[i - 1][1];
    const d = Math.hypot(dx, dy);
    segLens.push(d);
    total += d;
  }
  if (total === 0) return Array(n).fill(coords[0]);
  const out: Array<[number, number]> = [];
  for (let k = 0; k < n; k++) {
    const t = ((k + 0.5) / n) * total;
    let acc = 0;
    for (let i = 0; i < segLens.length; i++) {
      if (acc + segLens[i] >= t) {
        const local = (t - acc) / segLens[i];
        const lng = coords[i][0] + (coords[i + 1][0] - coords[i][0]) * local;
        const lat = coords[i][1] + (coords[i + 1][1] - coords[i][1]) * local;
        out.push([lng, lat]);
        break;
      }
      acc += segLens[i];
    }
  }
  return out;
}

// ── Main: addRunnerLight ────────────────────────────────────────────

export function addRunnerLight(
  map: MapboxMap,
  uid: string,
  data: GeoJSON.Feature<GeoJSON.LineString>,
  input: LightRenderInput,
): LightRenderHandles {
  const { light, spec, overrideColor, widthExpression } = input;
  const sourceId = `light-${uid}`;
  const handles: LightRenderHandles = { sourceId, layerIds: [] };

  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, { type: "geojson", data, lineMetrics: true });
  } else {
    (map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(data);
  }

  const baseColor = overrideColor || light.gradient[0];
  const isMultiColor = !overrideColor && light.gradient.length > 1;
  const w = (px: number): number | ExpressionSpecification => widthExpression ? widthExpression(px) : px;

  // ── 1. Bloom-Stack (außen → innen) ───────────────────────────────
  const bloomSorted = [...spec.bloom].sort((a, b) => b.widthAdd - a.widthAdd);
  bloomSorted.forEach((bl, i) => {
    const id = `${sourceId}-bloom-${i}`;
    map.addLayer({
      id, type: "line", source: sourceId,
      paint: {
        "line-color": baseColor,
        "line-opacity": bl.opacity,
        "line-width": w(light.width + bl.widthAdd),
        "line-blur": bl.blur,
      },
      layout: { "line-cap": "round", "line-join": "round" },
    });
    handles.layerIds.push(id);
  });

  // ── 2. Core-Layer ────────────────────────────────────────────────
  const coreId = `${sourceId}-core`;
  const corePaint: Record<string, unknown> = {
    "line-color": baseColor,
    "line-opacity": 1,
    "line-width": w(light.width),
    "line-blur": spec.coreBlur,
  };
  if (isMultiColor) {
    const stops = staticGradientStops(light.gradient);
    if (stops.length > 0) {
      corePaint["line-gradient"] = ["interpolate", ["linear"], ["line-progress"], ...stops] as ExpressionSpecification;
    }
  }
  map.addLayer({
    id: coreId, type: "line", source: sourceId,
    paint: corePaint as mapboxgl.LinePaint,
    layout: { "line-cap": "round", "line-join": "round" },
  });
  handles.layerIds.push(coreId);

  // ── 3. Inner-White Hot-Core ──────────────────────────────────────
  let innerId: string | null = null;
  if (spec.innerWhite) {
    innerId = `${sourceId}-inner`;
    map.addLayer({
      id: innerId, type: "line", source: sourceId,
      paint: {
        "line-color": "#FFFFFF",
        "line-opacity": spec.innerWhite.opacity,
        "line-width": w(Math.max(1, light.width * spec.innerWhite.widthMult)),
        "line-blur": 0,
      },
      layout: { "line-cap": "round", "line-join": "round" },
    });
    handles.layerIds.push(innerId);
  }

  // ── 4. Particle-System (sparkle / embers / stars) ────────────────
  let particleId: string | null = null;
  let particles: Array<{ basePos: [number, number]; phase: number; born: number; lifeSec: number }> = [];
  if (spec.particles && data.geometry.coordinates.length >= 2) {
    const coords = data.geometry.coordinates as Array<[number, number]>;
    const positions = sampleLine(coords, spec.particles.count);
    particles = positions.map((p) => ({
      basePos: p,
      phase: Math.random() * Math.PI * 2,
      born: performance.now() - Math.random() * (spec.particles!.lifeSec ?? 5) * 1000,
      lifeSec: spec.particles!.lifeSec ?? 0,
    }));
    handles.particleSourceId = `${sourceId}-particles`;
    if (!map.getSource(handles.particleSourceId)) {
      map.addSource(handles.particleSourceId, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
    }
    particleId = `${sourceId}-particle-layer`;
    map.addLayer({
      id: particleId, type: "circle", source: handles.particleSourceId,
      paint: {
        "circle-color": spec.particles.color,
        "circle-radius": ["coalesce", ["get", "size"], spec.particles.sizeMin] as ExpressionSpecification,
        "circle-opacity": ["coalesce", ["get", "opacity"], 0.8] as ExpressionSpecification,
        "circle-blur": 0.6,
      },
    });
    handles.layerIds.push(particleId);
  }

  // ── 5. Animation-Loop ────────────────────────────────────────────
  const start = performance.now();
  const animAmp = spec.animAmp ?? 0.15;
  const period = Math.max(0.1, spec.animSpeedSec || 1);

  const tick = (now: number) => {
    const elapsed = (now - start) / 1000;
    const t = (elapsed / period) % 1;
    const tau = elapsed * 2 * Math.PI / period;

    try {
      // ── Line-Animationen ──
      switch (spec.animation) {
        case "static": break;

        case "breathe": {
          const op = 1 - animAmp * (0.5 + 0.5 * Math.sin(tau));
          map.setPaintProperty(coreId, "line-opacity", op);
          if (innerId) map.setPaintProperty(innerId, "line-opacity", (spec.innerWhite!.opacity) * op);
          break;
        }

        case "wave_breathe": {
          // 2 verschachtelte Wellen für organisches Wellen-Atmen
          const v = 0.5 + 0.5 * (0.6 * Math.sin(tau) + 0.4 * Math.sin(tau * 1.7 + 0.5));
          const op = 1 - animAmp * v;
          map.setPaintProperty(coreId, "line-opacity", op);
          break;
        }

        case "wisp_drift": {
          // Sehr langsames, nicht-rhythmisches Wabern via 3 Sinus-Wellen
          const v = 0.5 + 0.5 * (0.5 * Math.sin(tau) + 0.3 * Math.sin(tau * 0.7 + 1.3) + 0.2 * Math.sin(tau * 2.1));
          map.setPaintProperty(coreId, "line-opacity", 1 - animAmp * v);
          break;
        }

        case "flame_glow": {
          // Pseudo-zufälliger Flicker via 3 hochfrequente Sinus
          const f = 0.4 * Math.sin(elapsed * 11) + 0.3 * Math.sin(elapsed * 27 + 1.7) + 0.3 * Math.sin(elapsed * 53 + 0.3);
          const v = 0.5 + 0.5 * f;
          map.setPaintProperty(coreId, "line-opacity", 1 - animAmp * v);
          if (innerId) {
            map.setPaintProperty(innerId, "line-opacity", spec.innerWhite!.opacity * (0.6 + 0.4 * v));
          }
          break;
        }

        case "metal_sheen": {
          // Soft bump-gradient, läuft 0..1 und wieder zurück
          const pos = 0.5 - 0.5 * Math.cos(tau); // ease in/out
          const stops = bumpGradient(baseColor, "#FFFFFF", pos, 0.25);
          map.setPaintProperty(coreId, "line-gradient", ["interpolate", ["linear"], ["line-progress"], ...stops] as ExpressionSpecification);
          break;
        }

        case "flow": {
          if (isMultiColor) {
            const stops = flowGradient(light.gradient, t);
            map.setPaintProperty(coreId, "line-gradient", ["interpolate", ["linear"], ["line-progress"], ...stops] as ExpressionSpecification);
          } else {
            const stops = bumpGradient(baseColor, "#FFFFFF", t, 0.30);
            map.setPaintProperty(coreId, "line-gradient", ["interpolate", ["linear"], ["line-progress"], ...stops] as ExpressionSpecification);
          }
          break;
        }

        case "molten_flow": {
          // Lava: drei Bumps versetzt, mit warmen Farben, sehr langsam
          const colors = light.gradient.length >= 3 ? light.gradient : ["#7f1d1d", "#ef4444", "#fbbf24"];
          // 3-Color flow: build a longer gradient with multiple repeating bumps
          const segments = 4;
          const stops: Array<[number, string]> = [];
          for (let i = 0; i <= segments; i++) {
            const pos = ((i / segments) + t) % 1;
            const colorIdx = i % colors.length;
            stops.push([pos, colors[colorIdx]]);
          }
          stops.sort((a, b) => a[0] - b[0]);
          if (stops[0][0] > 0) stops.unshift([0, stops[stops.length - 1][1]]);
          if (stops[stops.length - 1][0] < 1) stops.push([1, stops[0][1]]);
          const flat: (number | string)[] = [];
          for (const [p, c] of stops) flat.push(p, c);
          map.setPaintProperty(coreId, "line-gradient", ["interpolate", ["linear"], ["line-progress"], ...flat] as ExpressionSpecification);
          break;
        }

        case "electric_arcs": {
          // Random short flashes: line-blur und line-width spiken
          // Wir nutzen schnelle Sinus mit hoher Frequenz und Threshold
          const noise = Math.sin(elapsed * 31 + Math.sin(elapsed * 7) * 4);
          const burst = noise > 0.7 ? 1 : 0;
          const intensityBase = 1 - 0.15 * Math.abs(Math.sin(elapsed * 4));
          const opacity = burst === 1 ? 1 : intensityBase;
          map.setPaintProperty(coreId, "line-opacity", opacity);
          if (innerId) map.setPaintProperty(innerId, "line-opacity", burst === 1 ? 1 : spec.innerWhite!.opacity);
          // kurzes Blur-Spike beim Burst
          map.setPaintProperty(coreId, "line-blur", burst === 1 ? spec.coreBlur + 1.5 : spec.coreBlur);
          break;
        }
      }

      // ── Particle-Updates ──
      if (particles.length > 0 && handles.particleSourceId) {
        const p = spec.particles!;
        const features: GeoJSON.Feature[] = [];
        for (let i = 0; i < particles.length; i++) {
          const part = particles[i];
          const localT = elapsed + part.phase;
          let opacity = 0;
          let size = p.sizeMin;
          let pos: [number, number] = part.basePos;

          if (p.kind === "sparkle" || p.kind === "stars") {
            // Twinkle: smooth pulsing
            const tw = 0.5 + 0.5 * Math.sin(localT * (Math.PI * 2 / p.twinkleSec));
            // Threshold so dass die meiste Zeit dim ist
            opacity = Math.pow(tw, 2.5) * 0.95;
            size = p.sizeMin + (p.sizeMax - p.sizeMin) * (0.3 + 0.7 * tw);
          } else if (p.kind === "embers") {
            // Lifetime in Sekunden seit Geburt
            const ageSec = (now - part.born) / 1000;
            const life = part.lifeSec;
            if (ageSec >= life) {
              // Respawn: setze born zurück und phase neu
              part.born = now;
              part.phase = Math.random() * Math.PI * 2;
              continue;
            }
            const lifeT = ageSec / life;
            opacity = (1 - lifeT) * 0.95;
            size = p.sizeMin + (p.sizeMax - p.sizeMin) * (1 - lifeT * 0.5);
            // Drift nach „oben" (norden = +lat)
            // driftPxSec ist ungefähr — wir nehmen pseudo-lat-Schritt (small)
            const latShift = ((p.driftPxSec ?? 10) * lifeT) * 0.000001;
            pos = [part.basePos[0] + (Math.sin(part.phase) * 0.000003), part.basePos[1] + latShift];
          }

          if (opacity > 0.05) {
            features.push({
              type: "Feature",
              geometry: { type: "Point", coordinates: pos },
              properties: { opacity, size },
            });
          }
        }
        const src = map.getSource(handles.particleSourceId) as mapboxgl.GeoJSONSource | undefined;
        if (src) src.setData({ type: "FeatureCollection", features });
      }
    } catch { /* layer entfernt */ }
    handles.raf = requestAnimationFrame(tick);
  };
  handles.raf = requestAnimationFrame(tick);

  return handles;
}

export function removeRunnerLight(map: MapboxMap, h: LightRenderHandles) {
  if (h.raf) cancelAnimationFrame(h.raf);
  for (const id of h.layerIds) {
    try { if (map.getLayer(id)) map.removeLayer(id); } catch { /* race */ }
  }
  try { if (map.getSource(h.sourceId)) map.removeSource(h.sourceId); } catch { /* race */ }
  if (h.particleSourceId) {
    try { if (map.getSource(h.particleSourceId)) map.removeSource(h.particleSourceId); } catch { /* race */ }
  }
}
