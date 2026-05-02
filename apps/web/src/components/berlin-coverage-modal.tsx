"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";

const ACCENT = "#22D1C3";
const COVERED = "#22D1C3";
const NOT_COVERED = "#3B3F4A";
const BG = "#0F1115";
const TEXT = "#F0F0F0";
const MUTED = "#8B8FA3";

type Stats = { ok: boolean; total_blocks: number; covered_blocks: number; percent: number; covered_ids: number[] };
type GeoJsonFC = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    id: number;
    geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
    properties: { covered: boolean; area_m2: number };
  }>;
};

/**
 * Modal das die persönliche Berlin-Block-Coverage als Heatmap rendert.
 * - Großer Hero-Wert: X% von Berlin erkundet
 * - Mapbox-Karte mit Choropleth aller Kieze (covered=teal, missing=grau)
 * - Liste der nächsten Schritte
 */
export function BerlinCoverageModal({ onClose }: { onClose: () => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [geo, setGeo] = useState<GeoJsonFC | null>(null);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [s, g] = await Promise.all([
          fetch("/api/me/coverage", { cache: "no-store" }).then((r) => r.json()),
          fetch("/api/me/coverage/geojson", { cache: "no-store" }).then((r) => r.json()),
        ]);
        if (cancelled) return;
        setStats(s as Stats);
        setGeo(g as GeoJsonFC);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!geo || !containerRef.current || mapRef.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;
    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [13.405, 52.52],
      zoom: 10.2,
      attributionControl: false,
    });
    mapRef.current = map;

    map.on("load", () => {
      map.addSource("blocks", { type: "geojson", data: geo as unknown as GeoJSON.FeatureCollection });
      map.addLayer({
        id: "blocks-fill",
        type: "fill",
        source: "blocks",
        paint: {
          "fill-color": [
            "case",
            ["==", ["get", "covered"], true], COVERED,
            NOT_COVERED,
          ],
          "fill-opacity": [
            "case",
            ["==", ["get", "covered"], true], 0.55,
            0.18,
          ],
        },
      });
      map.addLayer({
        id: "blocks-line",
        type: "line",
        source: "blocks",
        paint: {
          "line-color": [
            "case",
            ["==", ["get", "covered"], true], COVERED,
            "#555",
          ],
          "line-width": 1,
          "line-opacity": 0.5,
        },
      });
    });

    return () => { map.remove(); mapRef.current = null; };
  }, [geo]);

  const milestones = useMemo(() => {
    if (!stats) return [];
    const targets = [1, 5, 10, 25, 50, 75, 100];
    return targets.map((t) => ({ percent: t, hit: stats.percent >= t }));
  }, [stats]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)",
        zIndex: 9500, display: "flex", alignItems: "center", justifyContent: "center",
        padding: 12,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: BG, borderRadius: 16, width: "100%", maxWidth: 720, maxHeight: "92vh",
          border: `1px solid ${ACCENT}55`,
          boxShadow: `0 20px 60px ${ACCENT}33`,
          overflow: "hidden", display: "flex", flexDirection: "column",
        }}
      >
        {/* Header mit Hero-% */}
        <div style={{
          padding: "16px 18px 12px",
          background: `linear-gradient(135deg, ${ACCENT}22, transparent 60%)`,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: MUTED, fontSize: 11, fontWeight: 700, letterSpacing: 1.3, textTransform: "uppercase" }}>
              Berlin-Erkundung
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
              <div style={{ fontSize: 36, fontWeight: 900, color: TEXT, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                {loading ? "…" : `${stats?.percent ?? 0}%`}
              </div>
              <div style={{ color: MUTED, fontSize: 13, fontWeight: 600 }}>
                {loading ? "" : `${stats?.covered_blocks ?? 0} / ${stats?.total_blocks ?? 0} Kieze`}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Schließen"
            style={{
              background: "transparent", border: "none", color: MUTED,
              fontSize: 22, cursor: "pointer", padding: 4, lineHeight: 1,
            }}
          >✕</button>
        </div>

        {/* Map */}
        <div style={{ position: "relative", height: "min(50vh, 360px)", background: "#0a0c0f" }}>
          <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
          {loading && (
            <div style={{
              position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
              color: MUTED, fontSize: 13,
            }}>Lade Heatmap…</div>
          )}
        </div>

        {/* Milestone-Liste */}
        <div style={{ padding: "12px 18px 18px", overflowY: "auto" }}>
          <div style={{ color: TEXT, fontSize: 13, fontWeight: 800, marginBottom: 8 }}>Meilensteine</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {milestones.map((m) => (
              <span
                key={m.percent}
                style={{
                  padding: "6px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800,
                  background: m.hit ? `${ACCENT}33` : "transparent",
                  color: m.hit ? ACCENT : MUTED,
                  border: `1px solid ${m.hit ? ACCENT : "#2a2f38"}`,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {m.hit ? "✓" : "○"} {m.percent}%
              </span>
            ))}
          </div>
          <div style={{ color: MUTED, fontSize: 12, marginTop: 12, lineHeight: 1.55 }}>
            Jeder Walk durch einen neuen Kiez färbt das Stück deiner Karte ein.
            Wer schafft 100% Berlin?
          </div>
        </div>
      </div>
    </div>
  );
}
