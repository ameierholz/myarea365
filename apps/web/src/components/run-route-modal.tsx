"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { createClient } from "@/lib/supabase/client";

const PRIMARY = "#22D1C3";

type Coord = { lat: number; lng: number };

export function RunRouteModal({ runId, streetName, teamColor, onClose }: {
  runId: string;
  streetName: string | null;
  teamColor: string;
  onClose: () => void;
}) {
  const tM = useTranslations("Modals");
  const [route, setRoute] = useState<Coord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const sb = createClient();
      const { data, error } = await sb.from("territories").select("route").eq("id", runId).maybeSingle<{ route: Coord[] | null }>();
      if (error || !data?.route || data.route.length < 2) {
        setError(tM("rtRouteUnavailable"));
        return;
      }
      setRoute(data.route);
    })();
  }, [runId, tM]);

  useEffect(() => {
    if (!route || !mapContainer.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [route[0].lng, route[0].lat],
      zoom: 15,
      attributionControl: false,
    });
    map.on("load", () => {
      map.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature", properties: {},
          geometry: { type: "LineString", coordinates: route.map((p) => [p.lng, p.lat]) },
        },
      });
      map.addLayer({
        id: "route-glow", type: "line", source: "route",
        paint: { "line-color": teamColor, "line-opacity": 0.4, "line-width": 12, "line-blur": 4 },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      map.addLayer({
        id: "route-line", type: "line", source: "route",
        paint: { "line-color": teamColor, "line-width": 5 },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      // Fit bounds to route
      const bounds = route.reduce(
        (b, p) => b.extend([p.lng, p.lat]),
        new mapboxgl.LngLatBounds([route[0].lng, route[0].lat], [route[0].lng, route[0].lat])
      );
      map.fitBounds(bounds, { padding: 40, duration: 0 });
      // Start + End marker
      new mapboxgl.Marker({ color: "#4ade80" }).setLngLat([route[0].lng, route[0].lat]).addTo(map);
      new mapboxgl.Marker({ color: "#FF2D78" }).setLngLat([route[route.length - 1].lng, route[route.length - 1].lat]).addTo(map);
    });
    return () => { map.remove(); };
  }, [route, teamColor]);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 9000,
      background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 720, maxHeight: "90vh",
        display: "flex", flexDirection: "column",
        background: "#141a2d", borderRadius: 20,
        border: `1px solid ${teamColor}66`,
        boxShadow: `0 8px 32px rgba(0,0,0,0.6)`,
        color: "#F0F0F0", overflow: "hidden",
      }}>
        <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: teamColor, fontSize: 9, fontWeight: 900, letterSpacing: 2 }}>{tM("rtKicker")}</div>
            <div style={{ color: "#FFF", fontSize: 16, fontWeight: 900 }}>{streetName || tM("rtUnknownPath")}</div>
          </div>
          <button onClick={onClose} aria-label={tM("closeAria")} style={{ background: "none", border: "none", color: "#8B8FA3", fontSize: 22, cursor: "pointer", width: 32, height: 32 }}>×</button>
        </div>
        <div style={{ flex: 1, minHeight: 400, position: "relative", background: "#0F1115" }}>
          {error ? (
            <div style={{ padding: 40, textAlign: "center", color: "#FF2D78" }}>{error}</div>
          ) : !route ? (
            <div style={{ padding: 40, textAlign: "center", color: "#a8b4cf" }}>{tM("rtLoading")}</div>
          ) : (
            <div ref={mapContainer} style={{ width: "100%", height: "100%", minHeight: 400 }} />
          )}
          {route && (
            <div style={{
              position: "absolute", bottom: 10, left: 10, padding: "6px 10px",
              borderRadius: 999, background: "rgba(15,17,21,0.85)",
              color: "#a8b4cf", fontSize: 11, display: "flex", gap: 10,
              border: "1px solid rgba(255,255,255,0.1)",
            }}>
              <span style={{ color: "#4ade80" }}>● {tM("rtStart")}</span>
              <span style={{ color: "#FF2D78" }}>● {tM("rtEnd")}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
