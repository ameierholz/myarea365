import type mapboxgl from "mapbox-gl";
import type { ClaimedArea } from "@/lib/game-config";

/**
 * rAF-Throttle: koalesziert viele Aufrufe (z.B. Mapbox "zoom" mit ~60Hz während Pinch/Wheel)
 * auf einen einzigen Aufruf pro Frame. Drastische Perf-Verbesserung bei vielen DOM-Markern.
 */
export function rafThrottle<F extends (...args: unknown[]) => void>(fn: F): F & { cancel(): void } {
  let scheduled = false;
  let lastArgs: unknown[] | null = null;
  const wrapped = ((...args: unknown[]) => {
    lastArgs = args;
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      const a = lastArgs;
      lastArgs = null;
      if (a) fn(...(a as Parameters<F>));
    });
  }) as F & { cancel(): void };
  wrapped.cancel = () => { scheduled = false; lastArgs = null; };
  return wrapped;
}

export function getCurrentLightPreset(): "dawn" | "day" | "dusk" | "night" {
  const h = new Date().getHours();
  if (h >= 5 && h < 8)   return "dawn";
  if (h >= 8 && h < 18)  return "day";
  if (h >= 18 && h < 21) return "dusk";
  return "night";
}

export function pointInGeoJSONPolygon(lat: number, lng: number, geom: GeoJSON.Geometry): boolean {
  const x = lng, y = lat;
  const ringContains = (ring: number[][]): boolean => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1];
      const xj = ring[j][0], yj = ring[j][1];
      const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };
  if (geom.type === "Polygon") {
    if (!ringContains(geom.coordinates[0])) return false;
    for (let i = 1; i < geom.coordinates.length; i++) {
      if (ringContains(geom.coordinates[i])) return false;  // im Loch
    }
    return true;
  }
  if (geom.type === "MultiPolygon") {
    return geom.coordinates.some((poly) => {
      if (!ringContains(poly[0])) return false;
      for (let i = 1; i < poly.length; i++) if (ringContains(poly[i])) return false;
      return true;
    });
  }
  return false;
}

export function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

/**
 * Zoom-responsive line-width.
 * Linien haben FIXE Screen-Pixel-Breite -> beim Rauszoomen werden Strassen-
 * Features kleiner, aber Linie bleibt gleich breit -> wirkt relativ dicker.
 * Fix: multiplikativer Zoom-Faktor (klein bei weitem Rauszoomen).
 */
export function zoomWidth(base: number): mapboxgl.ExpressionSpecification {
  return [
    "interpolate", ["exponential", 1.6], ["zoom"],
    10, base * 0.18,
    13, base * 0.40,
    16, base * 0.75,
    19, base * 1.25,
  ];
}

export function polygonFeature(area: ClaimedArea) {
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

/**
 * Wrap-Helper für Zoom-Scale: Wrap mit absolute-positioned Inner-Div, damit
 * Pseudoelemente (::before/::after) Theme-Effekte mitskalieren.
 */
export function wrapForZoomScale(el: HTMLElement): void {
  if (el.querySelector(':scope > [data-zoom-scale="1"]')) return;
  if (!el.style.position) el.style.position = "relative";
  const inner = document.createElement("div");
  inner.dataset.zoomScale = "1";
  inner.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;transform-origin:center center;will-change:transform;backface-visibility:hidden;-webkit-font-smoothing:subpixel-antialiased";
  if (el.dataset.runnerPinHost === "1") {
    inner.classList.add("ma365-runner-pin");
  }
  while (el.firstChild) inner.appendChild(el.firstChild);
  el.appendChild(inner);
}
