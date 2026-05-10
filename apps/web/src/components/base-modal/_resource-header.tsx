"use client";

import { useEffect, useState } from "react";
import { ResourceIcon, useResourceArt } from "@/components/resource-icon";
import { fetchBaseMe } from "@/lib/base-me-cache";

const ACCENT = "#22D1C3";
const ORANGE = "#FF6B4A";
const GOLD   = "#FFD700";

type Resources = { wood: number; stone: number; gold: number; mana: number };
type Caps = { wood: number; stone: number; gold: number; mana: number };

type BaseMeLite = {
  resources?: Resources;
  caps?: Caps;
  protected_amounts?: Caps;
};

const RES_FALLBACK = {
  wood:  { icon: "⚙️", color: ORANGE,    label: "Tech-Schrott" },
  stone: { icon: "🔩", color: "#8B8FA3", label: "Komponenten" },
  gold:  { icon: "💸", color: GOLD,      label: "Krypto" },
  mana:  { icon: "📡", color: ACCENT,    label: "Bandbreite" },
} as const;

function compactNum(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 1_000_000) return (n / 1000).toFixed(n < 10_000 ? 1 : 0) + "k";
  return (n / 1_000_000).toFixed(1) + "M";
}

/**
 * In-Modal RSS-Header — zeigt aktuelle Resourcen + Kapazität + geschützten Betrag.
 * Wird in Build-/Forschungs-/Truppen-Modal über dem Tab-Inhalt eingeblendet,
 * damit Spieler beim Bauen/Forschen sofort sehen ob die Resourcen reichen.
 */
export function ResourceHeader() {
  const resourceArt = useResourceArt();
  const [data, setData] = useState<BaseMeLite | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async (force = false) => {
      try {
        const j = await fetchBaseMe(force ? { force: true } : undefined) as BaseMeLite | null;
        if (!cancelled && j) setData(j);
      } catch { /* silent */ }
    };
    void load();
    const onChange = () => void load(true);
    window.addEventListener("ma365:resources-changed", onChange);
    return () => { cancelled = true; window.removeEventListener("ma365:resources-changed", onChange); };
  }, []);

  if (!data?.resources) return null;

  return (
    <div style={{ padding: "10px 12px", flexShrink: 0 }}>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
        background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
        overflow: "hidden",
      }}>
        {(["wood", "stone", "gold", "mana"] as const).map((k, i) => {
          const current = data.resources?.[k] ?? 0;
          const cap = data.caps?.[k] ?? 0;
          const prot = data.protected_amounts?.[k] ?? 0;
          const fillPct = cap > 0 ? Math.min(100, (current / cap) * 100) : 0;
          const isFull = cap > 0 && current >= cap;
          const isHigh = fillPct >= 80;
          return (
            <div key={k}
              data-rss-pill={k}
              style={{
                padding: "6px 8px 8px",
                display: "flex", flexDirection: "column", alignItems: "stretch", gap: 4,
                borderRight: i < 3 ? "1px solid rgba(255,255,255,0.06)" : "none",
                minWidth: 0,
              }}>
              <div style={{
                fontSize: 8, fontWeight: 900, letterSpacing: 0.8,
                color: RES_FALLBACK[k].color, opacity: 0.85,
                textAlign: "center",
                textTransform: "uppercase",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                lineHeight: 1,
              }}>{RES_FALLBACK[k].label}</div>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                minWidth: 0,
              }}>
              <ResourceIcon kind={k} size={40} fallback={RES_FALLBACK[k].icon} art={resourceArt} />
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0, gap: 1 }}>
                <div style={{
                  fontSize: 14, fontWeight: 900, color: RES_FALLBACK[k].color,
                  fontVariantNumeric: "tabular-nums", letterSpacing: -0.3,
                  textShadow: "0 1px 2px rgba(0,0,0,0.6)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  lineHeight: 1,
                }}>{compactNum(current)}</div>
                {cap > 0 && (
                  <div style={{
                    fontSize: 9, fontWeight: 700,
                    color: isFull ? "#FF2D78" : isHigh ? "#FF6B4A" : "#a8b4cf",
                    fontVariantNumeric: "tabular-nums",
                    lineHeight: 1,
                  }}>/ {compactNum(cap)}</div>
                )}
                <div
                  title={prot > 0
                    ? `Geschützt vor Plünderung: ${prot.toLocaleString("de-DE")}`
                    : "Kein Schutz aktiv – Geheim-Tresor bauen"}
                  style={{
                    fontSize: 9, fontWeight: 800,
                    color: prot > 0 ? "#4ade80" : "rgba(255,255,255,0.35)",
                    fontVariantNumeric: "tabular-nums",
                    lineHeight: 1,
                    display: "inline-flex", alignItems: "center", gap: 2,
                  }}>🛡️{compactNum(prot)}</div>
              </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
