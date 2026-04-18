"use client";

import { useState } from "react";

export function AdBanner({ isPremium, onUpgradeClick }: { isPremium: boolean; onUpgradeClick: () => void }) {
  const [closed, setClosed] = useState(false);
  if (isPremium || closed) return null;

  return (
    <div style={{
      position: "relative",
      background: "linear-gradient(90deg, rgba(34,209,195,0.12) 0%, rgba(255,45,120,0.12) 100%)",
      border: "1px solid rgba(34,209,195,0.3)",
      borderRadius: 14, padding: 12,
      display: "flex", alignItems: "center", gap: 12,
      marginBottom: 10,
    }}>
      <div style={{ fontSize: 24 }}>💎</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "#FFF", fontSize: 12, fontWeight: 900 }}>Werbefrei mit MyArea+</div>
        <div style={{ color: "#a8b4cf", fontSize: 10 }}>Ab € 3,99 / Monat · Offline-Karten, Themes, Streak-Freeze…</div>
      </div>
      <button
        onClick={onUpgradeClick}
        style={{
          padding: "6px 12px", borderRadius: 8, border: "none",
          background: "#22D1C3", color: "#0F1115", fontSize: 11, fontWeight: 800, cursor: "pointer",
        }}
      >
        Upgraden
      </button>
      <button
        onClick={() => setClosed(true)}
        style={{ background: "none", border: "none", color: "#a8b4cf", fontSize: 14, cursor: "pointer", padding: 4 }}
        aria-label="Banner schließen"
      >
        ✕
      </button>
    </div>
  );
}
