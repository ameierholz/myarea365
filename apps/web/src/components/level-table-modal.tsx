"use client";

/**
 * LevelTableModal — generisches Modal für Stufen-Tabellen.
 *
 * Wiederverwendbar für Buildings + Forschung. Nimmt eine vorab-berechnete
 * Stufen-Liste entgegen und rendert sie als Scroll-Tabelle mit Highlight
 * für aktuelle/nächste Stufe.
 */

import { useEffect } from "react";
import { ResourceIcon, type ResourceArtMap } from "@/components/resource-icon";

const ACCENT = "#22D1C3";
const ORANGE = "#FF6B4A";
const GOLD = "#FFD700";
const GREEN = "#4ade80";
const TEXT = "#F0F0F0";
const MUTED = "#a8b4cf";

export type LevelRow = {
  level: number;
  /** Hauptstat als String, z.B. "+5/h" oder "+10%" */
  effect: string;
  /** Optional: Sub-Stat unter dem Haupt-Effekt, z.B. "Cap 30" für Production-Buildings */
  effectSub?: string;
  cost: { wood: number; stone: number; gold: number; mana: number };
  /** Bauzeit/Forschungszeit in Minuten */
  timeMinutes: number;
};

function compactNum(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 1_000_000) return (n / 1000).toFixed(n < 10_000 ? 1 : 0) + "k";
  return (n / 1_000_000).toFixed(1) + "M";
}

function fmtTime(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return min % 60 > 0 ? `${h}h${min % 60}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return h % 24 > 0 ? `${d}T${h % 24}h` : `${d}T`;
}

const RES_FB = {
  wood:  { icon: "⚙️", color: "#FF6B4A" },
  stone: { icon: "🔩", color: "#8B8FA3" },
  gold:  { icon: "💸", color: GOLD },
  mana:  { icon: "📡", color: ACCENT },
} as const;

export function LevelTableModal({
  title, subtitle, accent, currentLevel, rows, effectLabel,
  resourceArt, onClose,
}: {
  title: string;
  subtitle?: string;
  accent: string;
  currentLevel: number;
  rows: LevelRow[];
  effectLabel: string;
  resourceArt: ResourceArtMap;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9102,
        background: "rgba(0,0,0,0.88)",
        backdropFilter: "blur(16px) saturate(140%)",
        WebkitBackdropFilter: "blur(16px) saturate(140%)",
        display: "flex", alignItems: "stretch", justifyContent: "center",
        padding: "12px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 560,
          display: "flex", flexDirection: "column",
          background: "linear-gradient(165deg, #2A2F4A 0%, #1E2238 50%, #14182A 100%)",
          border: `1px solid ${accent}66`,
          borderRadius: 18,
          boxShadow: `0 20px 60px rgba(0,0,0,0.55), 0 0 80px ${accent}33, inset 0 1px 0 rgba(255,255,255,0.08)`,
          overflow: "hidden", minHeight: 0,
          position: "relative",
        }}
      >
        {/* Ambient warm-Glow + Sparkles für freundliche Atmosphäre */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: `
            radial-gradient(ellipse at 50% -10%, ${accent}22, transparent 50%),
            radial-gradient(ellipse at 100% 100%, ${GOLD}11, transparent 55%)
          `,
        }} />
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} style={{
              position: "absolute",
              top: `${(i * 29) % 95}%`,
              left: `${(i * 43) % 95}%`,
              width: 2, height: 2, borderRadius: "50%",
              background: "#FFE4B8",
              boxShadow: "0 0 4px rgba(255,228,184,0.7)",
              opacity: 0.4,
            }} />
          ))}
        </div>

        {/* HEADER */}
        <div style={{
          position: "relative",
          padding: "10px 12px",
          background: `linear-gradient(90deg, ${accent}33, ${accent}11)`,
          borderBottom: `1px solid ${accent}44`,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <button
            onClick={onClose}
            aria-label="Zurück"
            style={{
              width: 30, height: 30, borderRadius: 8, border: "none",
              background: "rgba(0,0,0,0.45)", color: "rgba(255,255,255,0.85)",
              fontSize: 16, fontWeight: 900, cursor: "pointer", flexShrink: 0,
            }}
          >‹</button>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{
              fontSize: 12, fontWeight: 900, color: accent, letterSpacing: 1.5,
              textTransform: "uppercase",
            }}>STUFEN-TABELLE</div>
            <div style={{
              fontSize: 14, fontWeight: 900, color: TEXT, marginTop: 1,
            }}>{title}</div>
            {subtitle && (
              <div style={{ fontSize: 9, color: MUTED, fontWeight: 700 }}>{subtitle}</div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Schließen"
            style={{
              width: 30, height: 30, borderRadius: 8, border: "none",
              background: "rgba(0,0,0,0.45)", color: "rgba(255,255,255,0.85)",
              fontSize: 18, fontWeight: 900, cursor: "pointer", flexShrink: 0,
            }}
          >×</button>
        </div>

        {/* Spalten-Header */}
        <div style={{
          position: "relative",
          padding: "8px 10px",
          display: "grid",
          gridTemplateColumns: "44px 1fr 1fr 60px",
          gap: 6,
          fontSize: 9, fontWeight: 900, color: MUTED, letterSpacing: 1,
          background: "rgba(0,0,0,0.3)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}>
          <div>STUFE</div>
          <div style={{ textAlign: "center" }}>{effectLabel.toUpperCase()}</div>
          <div style={{ textAlign: "center" }}>KOSTEN</div>
          <div style={{ textAlign: "right" }}>ZEIT</div>
        </div>

        {/* SCROLL-CONTENT — Stufen-Liste */}
        <div style={{
          position: "relative",
          flex: 1, minHeight: 0, overflowY: "auto",
          scrollbarWidth: "none",
        }}>
          <style>{`.ma365-leveltable-scroll::-webkit-scrollbar { display: none; }`}</style>
          <div className="ma365-leveltable-scroll">
            {rows.map((row) => {
              const isCurrent = row.level === currentLevel;
              const isNext = row.level === currentLevel + 1;
              const isPast = row.level < currentLevel;
              return (
                <div
                  key={row.level}
                  style={{
                    padding: "8px 10px",
                    display: "grid",
                    gridTemplateColumns: "44px 1fr 1fr 60px",
                    gap: 6,
                    alignItems: "center",
                    background: isCurrent
                      ? `linear-gradient(90deg, ${accent}33, ${accent}11)`
                      : isNext
                        ? `linear-gradient(90deg, ${GREEN}1a, transparent)`
                        : isPast
                          ? "rgba(0,0,0,0.15)"
                          : "transparent",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    borderLeft: isCurrent
                      ? `3px solid ${accent}`
                      : isNext
                        ? `3px solid ${GREEN}`
                        : "3px solid transparent",
                    color: isPast ? MUTED : TEXT,
                    opacity: isPast ? 0.55 : 1,
                  }}
                >
                  {/* Stufen-Badge */}
                  <div style={{
                    fontSize: 13, fontWeight: 900,
                    color: isCurrent ? accent : isNext ? GREEN : TEXT,
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    {row.level}
                    {isCurrent && (
                      <span style={{
                        display: "inline-block", marginLeft: 4,
                        fontSize: 8, color: accent, letterSpacing: 0.5,
                      }}>●</span>
                    )}
                  </div>

                  {/* Effekt (mit optionaler Sub-Zeile für Cap o.ä.) */}
                  <div style={{
                    textAlign: "center",
                    fontVariantNumeric: "tabular-nums",
                    display: "flex", flexDirection: "column", gap: 1,
                    alignItems: "center", justifyContent: "center",
                  }}>
                    <span style={{
                      fontSize: 12, fontWeight: 900,
                      color: isCurrent ? accent : isNext ? GREEN : TEXT,
                    }}>{row.effect}</span>
                    {row.effectSub && (
                      <span style={{
                        fontSize: 9, fontWeight: 700,
                        color: MUTED, letterSpacing: 0.2,
                      }}>{row.effectSub}</span>
                    )}
                  </div>

                  {/* Kosten — kompakt mit Icons */}
                  <div style={{
                    display: "flex", flexWrap: "wrap", gap: 4,
                    justifyContent: "center", alignItems: "center",
                  }}>
                    {(["wood","stone","gold","mana"] as const)
                      .filter((k) => row.cost[k] > 0)
                      .map((k) => (
                        <span key={k} style={{
                          fontSize: 9, fontWeight: 800,
                          display: "inline-flex", alignItems: "center", gap: 2,
                          color: TEXT, fontVariantNumeric: "tabular-nums",
                        }}>
                          <ResourceIcon kind={k} size={11} fallback={RES_FB[k].icon} art={resourceArt} />
                          {compactNum(row.cost[k])}
                        </span>
                      ))}
                    {row.cost.wood === 0 && row.cost.stone === 0 && row.cost.gold === 0 && row.cost.mana === 0 && (
                      <span style={{ fontSize: 9, color: MUTED }}>—</span>
                    )}
                  </div>

                  {/* Zeit */}
                  <div style={{
                    fontSize: 10, fontWeight: 800, textAlign: "right",
                    color: MUTED, fontVariantNumeric: "tabular-nums",
                  }}>{fmtTime(row.timeMinutes)}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* FOOTER mit Legende */}
        <div style={{
          position: "relative",
          padding: "8px 12px",
          background: "rgba(0,0,0,0.4)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          display: "flex", justifyContent: "center", gap: 14,
          fontSize: 9, color: MUTED, fontWeight: 700,
        }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: accent }} /> Aktuell
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: GREEN }} /> Nächste
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, opacity: 0.55 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: MUTED }} /> Erledigt
          </span>
        </div>
      </div>
    </div>
  );
}
