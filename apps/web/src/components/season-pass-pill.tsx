"use client";

import { useEffect, useState } from "react";
import { SeasonPassModal } from "@/components/season-pass-modal";

const ACCENT = "#FFD700";

/**
 * Saison-Pass-Pill: Level + Days-Left. Klick öffnet Saison-Pass-Modal.
 */
export function SeasonPassPill() {
  const [info, setInfo] = useState<{ level: number; days_left: number } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch("/api/season/status", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json() as { season?: { days_left?: number }; progress?: { level?: number } };
        if (!cancelled && j.season && j.progress) {
          setInfo({ level: j.progress.level ?? 0, days_left: j.season.days_left ?? 0 });
        }
      } catch { /* ignore */ }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Saison-Pass öffnen"
        style={{
          paddingLeft: 6, paddingRight: 14, paddingTop: 4, paddingBottom: 4,
          borderRadius: 999, border: "none",
          background: `linear-gradient(135deg, ${ACCENT}, #FFA500)`,
          position: "relative", overflow: "hidden", cursor: "pointer",
          boxShadow: `0 4px 24px ${ACCENT}55, inset 0 1px 0 rgba(255,255,255,0.4)`,
          display: "inline-flex", alignItems: "center", gap: 8,
        }}
      >
        <span style={{
          width: 32, height: 32, borderRadius: 16,
          background: "rgba(15,17,21,0.85)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18,
        }}>🎫</span>
        <span style={{
          color: "#0F1115", fontWeight: 400, fontSize: 16, letterSpacing: 0.8,
          fontFamily: "var(--font-display-stack)", lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}>
          Saison · Lv {info?.level ?? "…"}
        </span>
        <span style={{
          position: "absolute", top: 0, left: "-50%", width: "50%", height: "100%",
          background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%)",
          animation: "rankShimmer 4s ease-in-out infinite",
          pointerEvents: "none",
        }} />
      </button>
      {open && <SeasonPassModal onClose={() => setOpen(false)} />}
    </>
  );
}
