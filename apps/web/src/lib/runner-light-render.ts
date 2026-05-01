// Runner-Light V2 Renderer.
// Erzeugt für eine GeoJSON-LineString-Source einen Stack aus Bloom-Layern,
// Core-Layer, optionalem Inner-White-Layer und dem animations-spezifischen
// Effekt-Layer. Wiederverwendbar in app-map.tsx (Live-Trail) und in
// /admin/lights-preview (alle 20 nebeneinander).
//
// Animations:
//  - "static"      : kein extra Effekt
//  - "shimmer"     : sanftes Atmen der Core-Opacity (RAF)
//  - "comet"       : line-trim-offset bewegt einen Spot über die Linie
//  - "plasma"      : zwei versetzte Cometen mit Chroma-Split
//  - "color_cycle" : line-gradient rotiert die Farb-Stops
//  - "flicker"     : Core-Opacity oszilliert irregulär (Pseudo-Random Walk)

import type { Map as MapboxMap, ExpressionSpecification } from "mapbox-gl";
import type { LightVisualSpec, RunnerLightId, BloomLayer } from "./game-config";

export type LightRenderHandles = {
  sourceId: string;
  layerIds: string[];
  raf?: number;
};

export type LightRenderInput = {
  light: { id: RunnerLightId; gradient: readonly string[]; width: number };
  spec: LightVisualSpec;
  /** Override-Farbe für Legacy-Special-Trails (golden_trail, neon_trail). */
  overrideColor?: string | null;
  /** Multiplier für alle Breiten — nutzbar wenn der Renderer eine zoom-responsive
      width-expression statt Pixel-Werten haben will. */
  widthExpression?: (basePx: number) => number | ExpressionSpecification;
};

/** Erzeuge sortierte line-gradient-Stops aus den Light-Farben. */
function gradientStops(colors: readonly string[], offset = 0): (number | string)[] {
  if (colors.length < 2) return [];
  // Stops mit Offset rotiert (für color_cycle). Sicherstellen dass 0 und 1 abgedeckt sind.
  const n = colors.length;
  const stops: Array<[number, string]> = [];
  for (let i = 0; i <= n; i++) {
    const t = ((i / n) + offset) % 1;
    stops.push([t, colors[i % n]]);
  }
  // Sortiert nach Position
  stops.sort((a, b) => a[0] - b[0]);
  // Sicherstellen dass first=0 und last=1
  if (stops[0][0] > 0) stops.unshift([0, stops[stops.length - 1][1]]);
  if (stops[stops.length - 1][0] < 1) stops.push([1, stops[0][1]]);
  const flat: (number | string)[] = [];
  for (const [pos, c] of stops) flat.push(pos, c);
  return flat;
}

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
  // Sortiere absteigend nach widthAdd damit die größten Halos UNTEN liegen.
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
    const stops = gradientStops(light.gradient);
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

  // ── 3. Inner-White (Hot-Core) ─────────────────────────────────────
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

  // ── 4. Animation ─────────────────────────────────────────────────
  if (spec.animation === "static") return handles;

  // Comet-Layer (für comet + plasma): zusätzliche helle Linie die per
  // line-trim-offset windowed wird. Bei plasma zwei versetzt mit Farb-Split.
  let cometIds: string[] = [];
  if (spec.animation === "comet" || spec.animation === "plasma") {
    const isPlasma = spec.animation === "plasma";
    const colors = isPlasma
      ? [light.gradient[0], light.gradient[light.gradient.length - 1] !== light.gradient[0] ? light.gradient[light.gradient.length - 1] : "#FF00FF"]
      : ["#FFFFFF"];
    colors.forEach((c, idx) => {
      const id = `${sourceId}-comet-${idx}`;
      map.addLayer({
        id, type: "line", source: sourceId,
        paint: {
          "line-color": c,
          "line-opacity": isPlasma ? 0.85 : 0.95,
          "line-width": w(Math.max(2, light.width * (isPlasma ? 0.6 : 0.8))),
          "line-blur": 1,
          "line-trim-offset": [0, 0] as unknown as [number, number],
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      cometIds.push(id);
      handles.layerIds.push(id);
    });
  }

  const start = performance.now();
  const cometWindow = spec.cometWindow ?? 0.18;
  const flickerAmp = spec.flickerAmp ?? 0.15;

  const tick = (now: number) => {
    const elapsed = (now - start) / 1000; // s
    const t = (elapsed / Math.max(0.1, spec.animSpeedSec)) % 1;

    try {
      switch (spec.animation) {
        case "comet": {
          const head = t * (1 + cometWindow);
          const tail = head - cometWindow;
          // Mapbox: trim-offset hides the part WITHIN [start, end].
          // Wir wollen NUR das Window zeigen → wir „verstecken" alles VOR tail
          // und alles NACH head. Trick: trim hides between start..end. Also:
          // Layer A versteckt 0..tail, Layer B versteckt head..1. Geht nicht
          // mit einem trim. Alternative: verwende trim-offset = [tail, head]
          // → versteckt das Window in der Mitte. Wir invertieren indem wir das
          // Comet-Layer „löschen" außer im Window via line-opacity ramping.
          // Praktisch: nutze trim-offset = [head, 1] kombiniert mit zweitem
          // Trick. Mapbox-elegantester Weg ist ABER einfach:
          //   line-trim-offset = [head, 1]  → versteckt die SCHWANZ-Hälfte
          // Damit wandert die sichtbare „Front" mit. Für ein „Window" brauchen
          // wir zwei Layer (komplex). Wir machen den simpleren Sweep-Effekt:
          // Einer hellen Linie die NUR die Position 0..head zeigt + tail
          // gradiert weg via opacity. Das gibt Comet-Look mit Schweif.
          for (const id of cometIds) {
            if (map.getLayer(id)) {
              map.setPaintProperty(id, "line-trim-offset", [Math.max(0, head), 1]);
              // Mehr Glanz an der Spitze: leichte opacity-Modulation
              map.setPaintProperty(id, "line-opacity", 0.7 + 0.3 * Math.sin(t * Math.PI));
            }
          }
          break;
        }
        case "plasma": {
          // Zwei Cometen, leicht versetzt, mit unterschiedlichen Farben
          cometIds.forEach((id, idx) => {
            if (!map.getLayer(id)) return;
            const offset = idx * 0.08; // 8% Versatz für Chroma-Split
            const tt = ((elapsed + offset * spec.animSpeedSec) / Math.max(0.1, spec.animSpeedSec)) % 1;
            const head = tt * (1 + cometWindow);
            map.setPaintProperty(id, "line-trim-offset", [Math.max(0, head), 1]);
            // Schnellerer flicker zusätzlich
            const flicker = 0.7 + 0.3 * Math.sin(elapsed * 12 + idx);
            map.setPaintProperty(id, "line-opacity", 0.6 + 0.3 * flicker);
          });
          break;
        }
        case "color_cycle": {
          if (isMultiColor) {
            const stops = gradientStops(light.gradient, t);
            if (stops.length > 0) {
              map.setPaintProperty(coreId, "line-gradient", ["interpolate", ["linear"], ["line-progress"], ...stops] as ExpressionSpecification);
            }
          } else {
            // Single-Color: pulsiere die Helligkeit (HSL-shift)
            const pulse = 0.85 + 0.15 * Math.sin(elapsed * (Math.PI * 2 / spec.animSpeedSec));
            map.setPaintProperty(coreId, "line-opacity", pulse);
          }
          break;
        }
        case "shimmer": {
          // Sanftes Atmen
          const breath = 1 - 0.12 * (0.5 + 0.5 * Math.sin(elapsed * (Math.PI * 2 / spec.animSpeedSec)));
          if (innerId && map.getLayer(innerId)) map.setPaintProperty(innerId, "line-opacity", breath * (spec.innerWhite?.opacity ?? 0.7));
          break;
        }
        case "flicker": {
          // Pseudo-zufälliger Flicker via mehreren Sinus-Wellen
          const f1 = Math.sin(elapsed * 9);
          const f2 = Math.sin(elapsed * 23 + 1.7);
          const f3 = Math.sin(elapsed * 47 + 0.3);
          const noise = (f1 * 0.5 + f2 * 0.3 + f3 * 0.2);
          const op = 1 - flickerAmp * (0.5 + 0.5 * noise);
          map.setPaintProperty(coreId, "line-opacity", op);
          if (innerId && map.getLayer(innerId)) {
            map.setPaintProperty(innerId, "line-opacity", (spec.innerWhite?.opacity ?? 0.7) * (0.6 + 0.4 * (0.5 + 0.5 * noise)));
          }
          break;
        }
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
}
