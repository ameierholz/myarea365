"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { BerlinCoverageModal } from "@/components/berlin-coverage-modal";

const ACCENT = "#22D1C3";

/**
 * Kompakte Pill mit Berlin-Erkundungs-Prozent. Klick öffnet Heatmap-Modal.
 * Lauscht auf `ma365:coverage-changed` für Live-Refresh nach Walks.
 */
export function BerlinCoveragePill() {
  const t = useTranslations("Motivation");
  const [percent, setPercent] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch("/api/me/coverage", { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as { percent?: number };
        if (!cancelled) setPercent(j.percent ?? 0);
      } catch { /* ignore */ }
    };
    void load();
    const onChange = () => void load();
    window.addEventListener("ma365:coverage-changed", onChange);
    const iv = setInterval(load, 120000);
    return () => {
      cancelled = true;
      window.removeEventListener("ma365:coverage-changed", onChange);
      clearInterval(iv);
    };
  }, []);

  const display = percent == null ? "…" : `${percent}%`;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={t("berlinPillTooltip")}
        style={{
          paddingLeft: 6, paddingRight: 14, paddingTop: 4, paddingBottom: 4,
          borderRadius: 999, border: "none",
          background: `linear-gradient(135deg, ${ACCENT}, #1FB8AC)`,
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
        }}>🗺</span>
        <span style={{
          color: "#0F1115", fontWeight: 400, fontSize: 16, letterSpacing: 0.8,
          fontFamily: "var(--font-display-stack)", lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}>
          {t("berlinPillLabel")} · {display}
        </span>
        <span style={{
          position: "absolute", top: 0, left: "-50%", width: "50%", height: "100%",
          background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%)",
          animation: "rankShimmer 4s ease-in-out infinite",
          pointerEvents: "none",
        }} />
      </button>
      {open && <BerlinCoverageModal onClose={() => setOpen(false)} />}
    </>
  );
}
