"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const ACCENT = "#22D1C3";

/**
 * Liefert den aktuellen Diamant-Stand. Lauscht auf das globale Event
 * `ma365:gems-changed` für Live-Refresh nach Käufen / Rename / etc.
 */
function useGemBalance(): number | null {
  const [gems, setGems] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch("/api/shop/gems", { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as { gems?: { gems?: number } };
        if (!cancelled) setGems(j.gems?.gems ?? 0);
      } catch {
        /* ignore */
      }
    };
    void load();
    const onChange = () => void load();
    window.addEventListener("ma365:gems-changed", onChange);
    const iv = setInterval(load, 60000);
    return () => {
      cancelled = true;
      window.removeEventListener("ma365:gems-changed", onChange);
      clearInterval(iv);
    };
  }, []);

  return gems;
}

function fmtGems(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString("de-DE");
}

/**
 * Diamant-Balance-Pill. Klick → öffnet Shop auf Diamanten-Tab.
 * `compact`: kleinere Variante für Map-Quick-Access-Bar.
 */
export function DiamantPill({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("Motivation");
  const gems = useGemBalance();
  const display = gems == null ? "…" : fmtGems(gems);

  const onClick = () => {
    window.dispatchEvent(new CustomEvent("ma365:open-deals-shop", { detail: { tab: "gems" } }));
  };

  if (compact) {
    return (
      <button
        onClick={onClick}
        title={gems != null ? `${gems.toLocaleString("de-DE")} ${t("diamantOpenTooltip")}` : t("diamantOpenTooltip")}
        style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "4px 8px", borderRadius: 999,
          background: "rgba(34,209,195,0.14)",
          border: `1px solid ${ACCENT}66`,
          color: "#FFF", fontSize: 11, fontWeight: 800,
          cursor: "pointer",
          boxShadow: `0 0 8px ${ACCENT}33`,
          fontVariantNumeric: "tabular-nums",
          flexShrink: 0,
          fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,sans-serif",
        }}
      >
        <span style={{ fontSize: 13, lineHeight: 1 }}>💎</span>
        <span>{display}</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      title={gems != null ? `${gems.toLocaleString("de-DE")} ${t("diamantOpenTooltip")}` : t("diamantOpenTooltip")}
      style={{
        paddingLeft: 6, paddingRight: 14, paddingTop: 4, paddingBottom: 4,
        borderRadius: 999, border: "none",
        background: `linear-gradient(135deg, ${ACCENT}, #4DC9DA)`,
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
      }}>💎</span>
      <span style={{
        color: "#0F1115", fontWeight: 400, fontSize: 16, letterSpacing: 0.8,
        fontFamily: "var(--font-display-stack)", lineHeight: 1,
        fontVariantNumeric: "tabular-nums",
      }}>
        {t("diamantLabel", { amount: display })}
      </span>
      <span style={{
        position: "absolute", top: 0, left: "-50%", width: "50%", height: "100%",
        background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%)",
        animation: "rankShimmer 4s ease-in-out infinite",
        pointerEvents: "none",
      }} />
    </button>
  );
}
