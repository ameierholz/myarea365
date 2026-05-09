"use client";

/**
 * HEIMAT-MARCH-MARKERS — Live-Wächter-Marker auf der Heimat-Karte.
 *
 * Rendert für jeden aktiven Marsch (eigener + Crew) einen Mapbox-Marker mit
 * dem Wächter-Portrait, der zwischen Origin (Base) und Target interpoliert
 * läuft. Update-Tick: rAF (smooth). Polling der Marsch-Liste: 5 s.
 *
 * Map-Zugriff über window.__ma365Map (vom AppMap beim ready gesetzt).
 *
 * Datenquelle: /api/base/heimat (active_marches).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type mapboxgl from "mapbox-gl";

type MarchRow = {
  kind: string;
  id: string;
  is_own: boolean;
  is_crew: boolean;
  attacker_user_id: string;
  attacker_username: string | null;
  attacker_crew_tag: string | null;
  origin_lat: number; origin_lng: number;
  target_lat: number; target_lng: number;
  starts_at: string; ends_at: string;
  troop_count: number;
  guardian_id: string | null;
  legion_label: string | null;
};
type ArchetypeMeta = { id: string; image_url: string | null; name: string };
type GuardianMeta = { id: string; archetype_id: string | null; image_url: string | null; name: string };

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

function progress(starts_at: string, ends_at: string): number {
  const s = new Date(starts_at).getTime();
  const e = new Date(ends_at).getTime();
  const now = Date.now();
  if (now <= s) return 0;
  if (now >= e) return 1;
  return (now - s) / (e - s);
}

function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

export function HeimatMarchMarkers() {
  const [marches, setMarches] = useState<MarchRow[]>([]);
  const [guardianMeta, setGuardianMeta] = useState<Map<string, GuardianMeta>>(new Map());
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, {
    el: HTMLDivElement;
    marker: mapboxgl.Marker;
    portraitEl: HTMLImageElement | HTMLDivElement;
    countEl: HTMLDivElement;
    rotateEl: HTMLDivElement;
    line: { sourceId: string; layerId: string };
    march: MarchRow;
  }>>(new Map());
  const lineCounterRef = useRef(0);

  // Map-Zugriff (wird vom AppMap beim ready gesetzt)
  useEffect(() => {
    const grab = () => {
      const m = (window as unknown as { __ma365Map?: mapboxgl.Map }).__ma365Map ?? null;
      if (m) mapRef.current = m;
    };
    grab();
    window.addEventListener("ma365:map-ready", grab);
    return () => window.removeEventListener("ma365:map-ready", grab);
  }, []);

  // Marsch-Liste pollen (5 s) + auf Event reagieren
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch("/api/base/heimat", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json() as { active_marches?: MarchRow[] };
        if (!cancelled) setMarches(j.active_marches ?? []);
      } catch { /* silent */ }
    };
    void load();
    const onChanged = () => void load();
    window.addEventListener("ma365:march-started", onChanged);
    const iv = setInterval(load, 5000);
    return () => { cancelled = true; clearInterval(iv); window.removeEventListener("ma365:march-started", onChanged); };
  }, []);

  // Wächter-Meta laden (für Portraits) — einmal beim Mount, refresh bei Marsch-Changes
  useEffect(() => {
    if (marches.length === 0) return;
    const ids = Array.from(new Set(marches.map((m) => m.guardian_id).filter((g): g is string => !!g)));
    const missing = ids.filter((id) => !guardianMeta.has(id));
    if (missing.length === 0) return;
    void (async () => {
      try {
        const r = await fetch("/api/base/heimat-troops", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json() as { guardians?: GuardianMeta[] };
        if (!j.guardians) return;
        setGuardianMeta((prev) => {
          const next = new Map(prev);
          for (const g of j.guardians!) next.set(g.id, g);
          return next;
        });
      } catch { /* silent */ }
    })();
  }, [marches, guardianMeta]);

  // Marker erstellen / entfernen wenn Marsch-Liste ändert
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const liveIds = new Set(marches.map((m) => m.id));
    const mapboxgl = (window as unknown as { mapboxgl?: typeof import("mapbox-gl") }).mapboxgl;

    // Entfernen wegfallender Marker + Linien
    for (const [id, entry] of markersRef.current.entries()) {
      if (!liveIds.has(id)) {
        entry.marker.remove();
        try {
          if (map.getLayer(entry.line.layerId)) map.removeLayer(entry.line.layerId);
          if (map.getSource(entry.line.sourceId)) map.removeSource(entry.line.sourceId);
        } catch { /* no map */ }
        markersRef.current.delete(id);
      }
    }

    // Neue Marker erstellen
    for (const m of marches) {
      if (markersRef.current.has(m.id)) continue;
      void (async () => {
        const mb = (await import("mapbox-gl")).default;
        const el = document.createElement("div");
        el.style.cssText = "position:relative;width:36px;height:36px;pointer-events:none;will-change:transform;";

        // Drehung-Container für Wächter (zeigt in Marschrichtung)
        const rotateEl = document.createElement("div");
        rotateEl.style.cssText = "position:absolute;inset:0;transform:rotate(0deg);transition:transform 0.5s linear;will-change:transform;";

        // Portrait (Wächter-Bild)
        const meta = m.guardian_id ? guardianMeta.get(m.guardian_id) : null;
        const portraitEl = (meta?.image_url
          ? Object.assign(document.createElement("img"), { src: meta.image_url, alt: "" })
          : document.createElement("div"));
        const isCoord = m.kind === "coord_march";
        const ringColor = isCoord ? "#22D1C3" : "#FF2D78";
        portraitEl.style.cssText = `
          width:100%;height:100%;border-radius:50%;
          object-fit:cover;
          border:2px solid ${ringColor};
          box-shadow:0 0 12px ${ringColor}aa, 0 4px 10px rgba(0,0,0,0.6);
          background:radial-gradient(circle at 35% 30%, #2A2D38, #0F1115);
          display:flex;align-items:center;justify-content:center;
          font-size:18px;
        `;
        if (!meta?.image_url) (portraitEl as HTMLDivElement).textContent = "🛡";

        // Truppen-Anzahl-Badge unten
        const countEl = document.createElement("div");
        countEl.style.cssText = `
          position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);
          background:linear-gradient(135deg, #1A1D23, #0F1115);
          color:#FFD700;font-size:9px;font-weight:900;
          padding:1px 6px;border-radius:8px;
          border:1px solid rgba(255,215,0,0.45);
          white-space:nowrap;
          box-shadow:0 2px 6px rgba(0,0,0,0.6);
          font-family:Inter,-apple-system,sans-serif;
        `;
        countEl.textContent = `${m.troop_count}`;

        rotateEl.appendChild(portraitEl);
        el.appendChild(rotateEl);
        el.appendChild(countEl);

        const marker = new mb.Marker({ element: el, anchor: "center" })
          .setLngLat([m.origin_lng, m.origin_lat])
          .addTo(map);
        // Bearing einmalig setzen — Origin/Target ändern sich für nicht-redirect Märsche nicht.
        const bearing = bearingDeg(m.origin_lat, m.origin_lng, m.target_lat, m.target_lng);
        rotateEl.style.transform = `rotate(${bearing}deg)`;

        // Linie (origin → target, gestrichelt für coord, voll für attack)
        const sourceId = `ma365-march-line-${++lineCounterRef.current}`;
        const layerId = `${sourceId}-l`;
        try {
          map.addSource(sourceId, {
            type: "geojson",
            data: {
              type: "Feature", properties: {},
              geometry: { type: "LineString", coordinates: [[m.origin_lng, m.origin_lat], [m.target_lng, m.target_lat]] },
            },
          });
          map.addLayer({
            id: layerId, type: "line", source: sourceId,
            paint: {
              "line-color": ringColor,
              "line-width": 2,
              "line-opacity": 0.55,
              ...(isCoord ? { "line-dasharray": [2, 2] as unknown as undefined } : {}),
            },
            layout: { "line-cap": "round" },
          });
        } catch { /* layer/source may collide on hot-reload */ }

        markersRef.current.set(m.id, { el, marker, portraitEl, countEl, rotateEl, line: { sourceId, layerId }, march: m });
      })();
    }
    void mapboxgl;
  }, [marches, guardianMeta]);

  // Position-Update via setInterval (5 Hz reicht für 60 s+ Märsche).
  // rAF wäre 60 fps × N Marker × Mapbox-Redraw → Karte ruckelt beim Pannen.
  // Bearing wird nur einmal beim Marker-Anlegen gesetzt (Origin/Target ändern sich nicht).
  // Pulse wird nur einmal pro Marker gesetzt (kein Re-Set jeden Tick).
  useEffect(() => {
    const tick = () => {
      const m0 = markersRef.current;
      if (m0.size === 0) return;
      for (const [, entry] of m0.entries()) {
        const m = entry.march;
        const t = progress(m.starts_at, m.ends_at);
        const lat = lerp(m.origin_lat, m.target_lat, t);
        const lng = lerp(m.origin_lng, m.target_lng, t);
        const cur = entry.marker.getLngLat();
        if (Math.abs(cur.lat - lat) > 1e-6 || Math.abs(cur.lng - lng) > 1e-6) {
          entry.marker.setLngLat([lng, lat]);
        }
        // Pulse genau einmal aktivieren wenn <2 s Restzeit
        const remain = (new Date(m.ends_at).getTime() - Date.now()) / 1000;
        if (remain < 2 && remain > 0 && !entry.el.dataset.pulsing) {
          entry.el.dataset.pulsing = "1";
          entry.el.style.animation = "ma365MarchArrivePulse 0.3s ease-out infinite alternate";
        }
      }
    };
    const iv = setInterval(tick, 200);
    tick();
    return () => clearInterval(iv);
  }, []);

  // Kein DOM-Output – alles läuft via Mapbox-Marker
  return (
    <style>{`
      @keyframes ma365MarchArrivePulse { from { transform: scale(1); } to { transform: scale(1.18); } }
    `}</style>
  );
}
