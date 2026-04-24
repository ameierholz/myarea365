"use client";

import { useEffect, useState } from "react";

export type ActiveRoute = {
  shopId: string;
  shopName: string;
  destLat: number;
  destLng: number;
  geometry: { type: "LineString"; coordinates: [number, number][] };
  distanceM: number;
  durationS: number;
};

/**
 * Floating-Banner oben am Bildschirm waehrend In-App-Routing.
 * - Live-Distanz zum Ziel (aus User-Position berechnet)
 * - Cancel-Button schliesst Route via onCancel
 * - "Angekommen!"-Toast bei Distanz < 30 m, dann auto-cancel nach 3 s
 */
export function RouteBanner({
  route, userPos, onCancel, onArrived,
}: {
  route: ActiveRoute;
  userPos: { lat: number; lng: number } | null;
  onCancel: () => void;
  onArrived: () => void;
}) {
  const [arrived, setArrived] = useState(false);

  // Live-Distanz (Haversine vereinfacht — gut genug fuer kurze Strecken)
  const remainingM = userPos
    ? haversineMeters(userPos.lat, userPos.lng, route.destLat, route.destLng)
    : route.distanceM;

  useEffect(() => {
    if (arrived || !userPos) return;
    if (remainingM < 30) {
      setArrived(true);
      onArrived();
      const t = setTimeout(() => onCancel(), 3000);
      return () => clearTimeout(t);
    }
  }, [arrived, userPos, remainingM, onArrived, onCancel]);

  const remainLabel = remainingM < 1000
    ? `${Math.round(remainingM)} m`
    : `${(remainingM / 1000).toFixed(2)} km`;

  return (
    <div style={{
      position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)",
      zIndex: 1500, maxWidth: "92vw", width: "auto",
      padding: "10px 14px", borderRadius: 14,
      background: arrived
        ? "linear-gradient(135deg, rgba(74,222,128,0.95), rgba(34,209,195,0.95))"
        : "linear-gradient(135deg, rgba(34,209,195,0.95), rgba(255,215,0,0.85))",
      color: "#0F1115", fontWeight: 900,
      boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", gap: 10,
      backdropFilter: "blur(8px)",
    }}>
      <span style={{ fontSize: 22 }}>{arrived ? "🎉" : "🧭"}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 9, letterSpacing: 1.2, opacity: 0.7 }}>
          {arrived ? "ANGEKOMMEN" : "UNTERWEGS ZU"}
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>
          {route.shopName}
        </div>
        {!arrived && (
          <div style={{ fontSize: 11, opacity: 0.85 }}>
            noch {remainLabel} · ~{Math.max(1, Math.round(route.durationS / 60))} min
          </div>
        )}
      </div>
      <button
        onClick={onCancel}
        aria-label="Route abbrechen"
        style={{
          flexShrink: 0,
          background: "rgba(15,17,21,0.25)", border: "none", color: "#0F1115",
          width: 32, height: 32, borderRadius: 999, cursor: "pointer",
          fontSize: 16, fontWeight: 900,
        }}
      >×</button>
    </div>
  );
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180)
    * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
