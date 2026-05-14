"use client";

/**
 * QuestModal — Call-of-Dragons-Style: groß zentriert, vignettierte Ränder,
 * linke Tab-Sidebar (Icon-only), Section-Header pro Tab, große Quest-Cards.
 *
 * Backdrop ist mit blur(8px) versehen → "verwaschene Ränder auf allen Seiten".
 * Modal-Surface hat radial-gradient + inset shadow für weichen Vignette-Look.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { ResourceIcon, useResourceArt, useChestArt, type ResourceKind } from "@/components/resource-icon";

type RewardItem = { kind: string; amount?: number; code?: string };
type Quest = {
  id: string;
  code: string;
  chapter: number;
  sort_order: number;
  name: string;
  description: string;
  icon: string;
  target_metric: string;
  target_value: number;
  goto_route: string | null;
  rewards: RewardItem[];
  progress: number;
  completed_at: string | null;
  claimed_at: string | null;
  period_key: string;
};
type ByKind = { main?: Quest[]; side?: Quest[]; daily?: Quest[]; weekly?: Quest[]; seasonal?: Quest[] };
type ApiResponse = { ok: boolean; by_kind?: ByKind; summary?: { claimable: number; in_progress: number }; error?: string };
type TabId = "main" | "side" | "daily" | "weekly" | "seasonal";

const TAB_META: Record<TabId, { label: string; short: string; color: string; iconEmoji: string; sectionHeader: string }> = {
  main:     { label: "Hauptquests",    short: "HAUPT",  color: "#FFD700", iconEmoji: "📜", sectionHeader: "HAUPTQUESTS" },
  side:     { label: "Nebenquests",    short: "NEBEN",  color: "#22D1C3", iconEmoji: "🛡️", sectionHeader: "NEBENQUESTS" },
  daily:    { label: "Täglich",        short: "TAG",    color: "#FF6B4A", iconEmoji: "☀️", sectionHeader: "TAGESQUESTS" },
  weekly:   { label: "Wöchentlich",    short: "WOCHE",  color: "#FF2D78", iconEmoji: "📅", sectionHeader: "WOCHENQUESTS" },
  seasonal: { label: "Saisonal",       short: "SAISON", color: "#a855f7", iconEmoji: "🌆", sectionHeader: "SAISON-QUESTS" },
};

export function QuestModal({
  open, onClose, initialTab = "main",
}: {
  open: boolean;
  onClose: () => void;
  initialTab?: TabId;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>(initialTab);
  const [data, setData] = useState<ByKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => { if (open) setTab(initialTab); }, [open, initialTab]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    void (async () => {
      try {
        const r = await fetch("/api/me/quests", { cache: "no-store" });
        const j = (await r.json()) as ApiResponse;
        if (cancelled) return;
        if (!r.ok || !j.ok) throw new Error(j.error ?? "Fehler beim Laden");
        setData(j.by_kind ?? {});
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [open, reloadTick]);

  // Body scroll lock + ESC
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const onClaim = useCallback(async (q: Quest) => {
    setClaiming(q.id);
    try {
      const r = await fetch("/api/me/quests/claim", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ quest_id: q.id }),
      });
      const j = await r.json() as { ok: boolean; error?: string };
      if (!j.ok) { setError(j.error ?? "Belohnung konnte nicht eingelöst werden"); return; }
      setReloadTick((n) => n + 1);
    } finally {
      setClaiming(null);
    }
  }, []);

  const onGoto = useCallback((route: string | null) => {
    if (!route) return;
    onClose();
    router.push(route);
  }, [router, onClose]);

  const counts = useMemo(() => {
    const r: Record<TabId, { claimable: number; total: number }> = {
      main: { claimable: 0, total: 0 }, side: { claimable: 0, total: 0 },
      daily: { claimable: 0, total: 0 }, weekly: { claimable: 0, total: 0 },
      seasonal: { claimable: 0, total: 0 },
    };
    (Object.keys(r) as TabId[]).forEach((k) => {
      const list = data?.[k] ?? [];
      r[k].total = list.length;
      r[k].claimable = list.filter((q) => q.completed_at && !q.claimed_at).length;
    });
    return r;
  }, [data]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const list = data?.[tab] ?? [];
  const meta = TAB_META[tab];

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        // 9400 = zwischen Chat (9300) und Toast (9500), damit das Modal
        // den Chat-Overlay verdeckt (User-Request 2026-05-14).
        zIndex: 9400,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(8px) saturate(120%)",
        WebkitBackdropFilter: "blur(8px) saturate(120%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "max(env(safe-area-inset-top, 0px), 8px) 8px max(env(safe-area-inset-bottom, 0px), 8px) 8px",
        animation: "ma365-backdrop-in var(--motion-base) var(--ease-out) forwards",
      }}
    >
      <div
        role="dialog" aria-modal="true" aria-label="Quests"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(880px, calc(100vw - 16px))",
          maxHeight: "calc(100dvh - 16px)",
          display: "flex", flexDirection: "column",
          // "Verwaschene Ränder": radial-gradient fadet leicht zur Mitte hin
          // dichter, am Rand transparenter → mit inset-shadow für Vignette.
          background: "radial-gradient(ellipse at center, rgba(26,29,35,0.97) 55%, rgba(26,29,35,0.85) 100%)",
          border: "1px solid rgba(255,215,0,0.22)",
          borderRadius: 16,
          boxShadow: `
            0 12px 40px rgba(0,0,0,0.65),
            0 0 80px rgba(255,215,0,0.08),
            inset 0 0 80px rgba(15,17,21,0.55)
          `,
          color: "#F0F0F0",
          overflow: "hidden",
          animation: "ma365-modal-in var(--motion-base) var(--ease-out) forwards",
          fontFamily: "Inter,-apple-system,sans-serif",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center",
          padding: "10px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "linear-gradient(180deg, rgba(255,215,0,0.08) 0%, transparent 100%)",
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 20, marginRight: 8 }}>📜</span>
          <span style={{
            fontSize: 14, fontWeight: 900, letterSpacing: 1.8,
            color: "#FFD700", flex: 1,
            textShadow: "0 1px 4px rgba(255,215,0,0.3)",
          }}>QUESTS</span>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#8B8FA3", fontSize: 18, cursor: "pointer",
              width: 28, height: 28, padding: 0, borderRadius: 6,
              display: "flex", alignItems: "center", justifyContent: "center",
              lineHeight: 1,
            }}
            aria-label="Schließen"
          >×</button>
        </div>

        {/* Body: linke Tab-Sidebar (60px) + main content */}
        <div style={{
          display: "grid", gridTemplateColumns: "60px 1fr",
          flex: 1, minHeight: 0,
        }}>
          {/* Vertical tab sidebar */}
          <div style={{
            borderRight: "1px solid rgba(255,255,255,0.06)",
            display: "flex", flexDirection: "column", gap: 6,
            padding: 8, background: "rgba(15,17,21,0.4)",
          }}>
            {(Object.keys(TAB_META) as TabId[]).map((k) => {
              const m = TAB_META[k];
              const c = counts[k];
              const active = tab === k;
              return (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  style={{
                    width: 44, height: 50, borderRadius: 10,
                    background: active ? `${m.color}33` : "rgba(255,255,255,0.04)",
                    border: `1px solid ${active ? m.color : "rgba(255,255,255,0.08)"}`,
                    cursor: "pointer", position: "relative", padding: 0,
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", gap: 2,
                    color: active ? m.color : "#FFF",
                    filter: active ? `drop-shadow(0 0 8px ${m.color}88)` : "none",
                    transition: "all 0.15s ease",
                  }}
                  aria-label={m.label}
                  title={m.label}
                >
                  <span style={{ fontSize: 20, lineHeight: 1 }}>{m.iconEmoji}</span>
                  <span style={{
                    fontSize: 7, fontWeight: 900, letterSpacing: 0.4,
                    fontFamily: "Inter,-apple-system,sans-serif",
                  }}>{m.short}</span>
                  {c.claimable > 0 && (
                    <span style={{
                      position: "absolute", top: -4, right: -4,
                      minWidth: 16, height: 16, padding: "0 4px",
                      borderRadius: 8, background: "#FF2D78", color: "#FFF",
                      fontSize: 9, fontWeight: 900,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      border: "1.5px solid #0F1115",
                      boxShadow: "0 0 8px rgba(255,45,120,0.6)",
                    }}>{c.claimable}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Main content area */}
          <div style={{
            flex: 1, overflowY: "auto",
            padding: "10px 14px 14px 14px",
            display: "flex", flexDirection: "column", gap: 8,
            minHeight: 0,
          }}>
            {/* Section header (CoD-Style) */}
            <SectionHeader label={meta.sectionHeader} color={meta.color} />

            {error && (
              <div style={{
                padding: 10, borderRadius: 8,
                background: "rgba(255,107,74,0.1)", border: "1px solid rgba(255,107,74,0.3)",
                color: "#FF6B4A", fontSize: 12,
              }}>❌ {error}</div>
            )}
            {!data && !error && (
              <div style={{ color: "#8B8FA3", fontSize: 12, textAlign: "center", padding: 24 }}>
                Lade Quests…
              </div>
            )}
            {data && list.length === 0 && (
              <div style={{ color: "#8B8FA3", fontSize: 12, textAlign: "center", padding: 24, lineHeight: 1.6 }}>
                {tab === "main"
                  ? "Schließe Vorgänger-Quests ab, um weitere Hauptquests freizuschalten."
                  : "Keine Quests in dieser Kategorie."}
              </div>
            )}
            {data && list.map((q) => (
              <QuestRowBig
                key={q.id}
                quest={q}
                accent={meta.color}
                busy={claiming === q.id}
                onClaim={() => void onClaim(q)}
                onGoto={() => onGoto(q.goto_route)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SectionHeader({ label, color }: { label: string; color: string }) {
  return (
    <div style={{
      textAlign: "center",
      fontSize: 12, fontWeight: 900, letterSpacing: 2.5,
      color, textShadow: `0 1px 6px ${color}55`,
      padding: "4px 0 6px 0",
      borderBottom: `1px solid ${color}33`,
      marginBottom: 4,
      fontFamily: "Inter,-apple-system,sans-serif",
    }}>{label}</div>
  );
}

function QuestRowBig({
  quest: q, accent, busy, onClaim, onGoto,
}: {
  quest: Quest; accent: string; busy: boolean; onClaim: () => void; onGoto: () => void;
}) {
  const isClaimable = !!q.completed_at && !q.claimed_at;
  const isClaimed = !!q.claimed_at;
  const pct = Math.min(100, Math.round((Number(q.progress) / Math.max(1, q.target_value)) * 100));

  return (
    <div style={{
      padding: 10, borderRadius: 12,
      background: isClaimable
        ? `linear-gradient(135deg, ${accent}22, ${accent}06)`
        : isClaimed ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.04)",
      border: `1px solid ${isClaimable ? accent : "rgba(255,255,255,0.08)"}`,
      opacity: isClaimed ? 0.55 : 1,
      display: "grid",
      gridTemplateColumns: "52px 1fr auto",
      gap: 12, alignItems: "center",
      boxShadow: isClaimable ? `0 0 12px ${accent}33` : "none",
    }}>
      {/* Icon */}
      <div style={{
        width: 52, height: 52, borderRadius: 10,
        background: isClaimable ? `${accent}22` : "rgba(255,255,255,0.05)",
        border: `1.5px solid ${isClaimable ? accent : "rgba(255,255,255,0.1)"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 28, flexShrink: 0,
        filter: isClaimable ? `drop-shadow(0 0 6px ${accent}66)` : "none",
      }}>{q.icon}</div>

      {/* Center */}
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
        <div style={{
          fontSize: 13, fontWeight: 800,
          color: isClaimed ? "rgba(255,255,255,0.55)" : "#FFF",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          lineHeight: 1.2,
        }}>{q.name}</div>
        <div style={{
          fontSize: 10, color: "rgba(255,255,255,0.6)", lineHeight: 1.35,
          overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box",
          WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        }}>{q.description}</div>

        {/* Progress + Rewards inline */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
          <div style={{
            flex: "0 0 90px",
            height: 5, background: "rgba(255,255,255,0.08)",
            borderRadius: 3, overflow: "hidden", position: "relative",
          }}>
            <div style={{
              position: "absolute", inset: 0, right: `${100 - pct}%`,
              background: isClaimable
                ? `linear-gradient(90deg, ${accent}, ${accent}aa)`
                : "linear-gradient(90deg, rgba(255,255,255,0.4), rgba(255,255,255,0.25))",
            }} />
          </div>
          <span style={{
            fontSize: 10, fontWeight: 700,
            color: isClaimable ? accent : "rgba(255,255,255,0.7)",
            fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap",
          }}>{Math.min(q.target_value, Math.floor(Number(q.progress)))}/{q.target_value}</span>

          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", fontWeight: 700, letterSpacing: 0.5, marginLeft: 2 }}>
            BELOHNUNG
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            {q.rewards.map((r, i) => <RewardChip key={i} reward={r} />)}
          </div>
        </div>
      </div>

      {/* Action button */}
      <div style={{ flexShrink: 0 }}>
        {isClaimable ? (
          <button
            onClick={onClaim} disabled={busy}
            style={{
              padding: "9px 16px", borderRadius: 8,
              background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
              border: "none", color: "#0F1115",
              fontSize: 11, fontWeight: 900, letterSpacing: 0.8,
              cursor: busy ? "default" : "pointer",
              whiteSpace: "nowrap",
              boxShadow: `0 3px 10px ${accent}66`,
              minWidth: 100,
            }}
          >{busy ? "…" : "EINSAMMELN"}</button>
        ) : isClaimed ? (
          <span style={{
            padding: "9px 12px", borderRadius: 8,
            background: "rgba(255,255,255,0.05)",
            color: "rgba(255,255,255,0.45)",
            fontSize: 10, fontWeight: 800, letterSpacing: 0.5,
            whiteSpace: "nowrap",
          }}>✓ EINGESAMMELT</span>
        ) : q.goto_route ? (
          <button
            onClick={onGoto}
            style={{
              padding: "9px 16px", borderRadius: 8,
              background: "linear-gradient(135deg, rgba(34,209,195,0.22), rgba(34,209,195,0.12))",
              border: "1px solid rgba(34,209,195,0.5)",
              color: "#22D1C3",
              fontSize: 11, fontWeight: 900, letterSpacing: 0.8,
              cursor: "pointer", whiteSpace: "nowrap",
              minWidth: 100,
            }}
          >GEHE ZU</button>
        ) : null}
      </div>
    </div>
  );
}

function RewardChip({ reward }: { reward: RewardItem }) {
  const resourceArt = useResourceArt();
  const chestArt = useChestArt();
  const amount = reward.amount ?? 1;

  const renderIcon = () => {
    const size = 14;
    if (reward.kind === "gems") return <span style={{ fontSize: 13 }}>💎</span>;
    if (reward.kind === "xp")   return <span style={{ fontSize: 13 }}>⭐</span>;
    if (reward.kind === "wood")        return <ResourceIcon kind="wood"        fallback="🔩" size={size} art={resourceArt} />;
    if (reward.kind === "stone")       return <ResourceIcon kind="stone"       fallback="⚙️" size={size} art={resourceArt} />;
    if (reward.kind === "gold")        return <ResourceIcon kind="gold"        fallback="💰" size={size} art={resourceArt} />;
    if (reward.kind === "mana")        return <ResourceIcon kind="mana"        fallback="📡" size={size} art={resourceArt} />;
    if (reward.kind === "speed_token") return <ResourceIcon kind={"speed_token" as ResourceKind} fallback="⚡" size={size} art={resourceArt} />;
    if (reward.kind === "item" && reward.code) {
      const code = reward.code;
      if (code.startsWith("chest_")) {
        const chestKind = code.replace("chest_", "");
        const a = chestArt[chestKind];
        if (a?.image_url) {
          // eslint-disable-next-line @next/next/no-img-element
          return <img src={a.image_url} alt={code} style={{ width: size, height: size, objectFit: "contain" }} />;
        }
        return <span style={{ fontSize: 13 }}>🎁</span>;
      }
      if (code.startsWith("xp_pot_")) return <span style={{ fontSize: 13 }}>🧪</span>;
      return <span style={{ fontSize: 13 }}>📦</span>;
    }
    return <span style={{ fontSize: 12 }}>?</span>;
  };

  return (
    <span title={`${reward.kind} ${amount}${reward.code ? ` (${reward.code})` : ""}`} style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      padding: "2px 5px", borderRadius: 5,
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.1)",
      fontSize: 10, fontWeight: 800, color: "#FFF",
      fontVariantNumeric: "tabular-nums",
    }}>
      {renderIcon()}
      ×{amount.toLocaleString("de-DE")}
    </span>
  );
}
