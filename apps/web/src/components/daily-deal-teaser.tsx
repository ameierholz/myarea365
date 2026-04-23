"use client";

import { useCallback, useEffect, useState } from "react";

type DailyContent = { type: string; amount?: number; min?: number; max?: number; label: string };
type DailyPack = {
  id: string; sort: number; tier: "bronze" | "silver" | "gold";
  name: string; subtitle: string; icon: string;
  price_gems: number; bonus_gem_badge: number;
  contents: DailyContent[];
  price_cents?: number | null;
  is_bundle?: boolean;
};
type DailyResponse = {
  packs: DailyPack[];
  purchased_today: string[];
  gems?: number;
  reset_in_seconds: number;
};

const TIER_META: Record<DailyPack["tier"], { color: string; glow: string; label: string }> = {
  bronze: { color: "#cd7f32", glow: "rgba(205,127,50,0.28)",  label: "BRONZE" },
  silver: { color: "#d8d8d8", glow: "rgba(216,216,216,0.28)", label: "SILBER" },
  gold:   { color: "#FFD700", glow: "rgba(255,215,0,0.38)",   label: "GOLD" },
};

function formatPrice(p: DailyPack): string {
  if (p.price_cents != null) return `${(p.price_cents / 100).toFixed(2).replace(".", ",")} €`;
  return `💎 ${p.price_gems}`;
}

export function DailyDealTeaser(_props: { onOpen: () => void }) {
  const [data, setData] = useState<DailyResponse | null>(null);
  const [resetIn, setResetIn] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/shop/daily");
      if (!r.ok) return;
      const j = await r.json() as DailyResponse;
      setData(j);
      setResetIn(j.reset_in_seconds ?? 0);
    } catch { /* stumm */ }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (resetIn <= 0) return;
    const id = setInterval(() => setResetIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [resetIn]);

  async function buy(packId: string) {
    setBusy(packId);
    try {
      const res = await fetch("/api/shop/daily", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ pack_id: packId }),
      });
      const j = await res.json() as { ok?: boolean; error?: string; seals_granted?: number };
      if (j.ok) {
        setToast(j.seals_granted ? `🎁 Eingelöst · ${j.seals_granted} Siegel dazu!` : "🎁 Eingelöst!");
        await load();
      } else {
        setToast(j.error === "already_purchased_today" ? "Heute schon gekauft" : (j.error ?? "Fehler"));
      }
    } finally {
      setBusy(null);
      setTimeout(() => setToast(null), 2600);
    }
  }

  if (!data) return null;
  const unclaimed = data.packs.filter((p) => !data.purchased_today.includes(p.id));
  if (unclaimed.length === 0) return null;

  const standardPacks = data.packs.filter((p) => !p.is_bundle).sort((a, b) => a.sort - b.sort);
  const bundlePack = data.packs.find((p) => p.is_bundle);
  const standardOpen = standardPacks.filter((p) => !data.purchased_today.includes(p.id));
  const bundleOpen = bundlePack && !data.purchased_today.includes(bundlePack.id);
  const hasBundleOpen = !!bundleOpen;

  const featured = unclaimed.find((p) => p.is_bundle)
    ?? unclaimed.find((p) => p.tier === "gold")
    ?? unclaimed[0];

  const h = Math.floor(resetIn / 3600);
  const m = Math.floor((resetIn % 3600) / 60);
  const s = resetIn % 60;
  const countdown = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  // Günstigster offener Standard-Deal als Preis-Teaser (ab X 💎)
  const cheapestOpen = [...standardOpen].sort((a, b) => a.price_gems - b.price_gems)[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <style>{`
        @keyframes daily-pulse-strong {
          0%,100% { box-shadow: 0 0 14px rgba(255,215,0,0.35), 0 0 30px rgba(255,45,120,0.15); }
          50%     { box-shadow: 0 0 28px rgba(255,215,0,0.65), 0 0 50px rgba(255,45,120,0.35); }
        }
        @keyframes daily-shimmer { 0% { transform: translateX(-120%); } 100% { transform: translateX(340%); } }
      `}</style>

      {/* Banner */}
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          position: "relative", overflow: "hidden",
          padding: "14px 14px",
          borderRadius: expanded ? "14px 14px 0 0" : 14,
          background: hasBundleOpen
            ? "linear-gradient(135deg, rgba(255,45,120,0.28), rgba(255,215,0,0.22), rgba(34,209,195,0.22))"
            : "linear-gradient(135deg, rgba(255,107,74,0.22), rgba(255,215,0,0.16))",
          border: `1px solid ${hasBundleOpen ? "rgba(255,215,0,0.7)" : "rgba(255,107,74,0.55)"}`,
          borderBottom: expanded ? "1px solid rgba(255,215,0,0.4)" : undefined,
          cursor: "pointer", textAlign: "left",
          display: "flex", alignItems: "center", gap: 12, color: "#FFF",
          animation: !expanded ? "daily-pulse-strong 2.4s ease-in-out infinite" : undefined,
        }}
      >
        {/* Shimmer-Overlay */}
        {!expanded && (
          <span style={{
            position: "absolute", top: 0, left: 0, width: "35%", height: "100%",
            background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%)",
            animation: "daily-shimmer 3.8s ease-in-out infinite",
            pointerEvents: "none",
          }} />
        )}
        <div style={{
          width: 46, height: 46, borderRadius: 12, flexShrink: 0,
          background: "rgba(255,215,0,0.18)", border: "1px solid rgba(255,215,0,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
          boxShadow: "inset 0 0 10px rgba(255,215,0,0.2)",
        }}>{featured.icon}</div>
        <div style={{ flex: 1, minWidth: 0, zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: 1.2, color: "#FFD700" }}>
              🔥 TAGES-DEALS
            </span>
            {hasBundleOpen && (
              <span style={{
                fontSize: 8, fontWeight: 900, letterSpacing: 0.8,
                padding: "1px 6px", borderRadius: 4,
                background: "linear-gradient(135deg, #FF2D78, #FFD700)",
                color: "#0F1115",
              }}>SUPER-BUNDLE</span>
            )}
          </div>
          <div style={{ fontSize: 14, fontWeight: 900, color: "#FFF", marginTop: 2 }}>
            {standardOpen.length} Deal{standardOpen.length === 1 ? "" : "s"} offen
            {hasBundleOpen && <span style={{ color: "#FFD700" }}> + 🎁 Bundle</span>}
          </div>
          {/* Mini-Tier-Chips */}
          <div style={{ display: "flex", gap: 4, marginTop: 5, alignItems: "center", flexWrap: "wrap" }}>
            {standardPacks.map((p) => {
              const owned = data.purchased_today.includes(p.id);
              const tm = TIER_META[p.tier];
              return (
                <span key={p.id} title={`${tm.label} · ${owned ? "gekauft" : formatPrice(p)}`} style={{
                  fontSize: 9, fontWeight: 900, letterSpacing: 0.4,
                  padding: "2px 6px", borderRadius: 4,
                  background: owned ? "rgba(74,222,128,0.12)" : `${tm.color}22`,
                  color: owned ? "#4ade80" : tm.color,
                  border: `1px solid ${owned ? "rgba(74,222,128,0.4)" : tm.color + "77"}`,
                  opacity: owned ? 0.6 : 1,
                  textDecoration: owned ? "line-through" : "none",
                }}>{owned ? "✓" : ""}{p.icon} {tm.label}</span>
              );
            })}
            <span style={{ color: "#8B8FA3", fontSize: 10, marginLeft: 4 }}>
              ⏱️ {countdown}
            </span>
          </div>
        </div>
        {!expanded && cheapestOpen && (
          <div style={{
            padding: "6px 10px", borderRadius: 10, flexShrink: 0, textAlign: "center",
            background: "linear-gradient(135deg, #FFD700, #FF6B4A)",
            color: "#0F1115", fontWeight: 900,
            boxShadow: "0 0 14px rgba(255,215,0,0.5)",
          }}>
            <div style={{ fontSize: 8, letterSpacing: 0.8, opacity: 0.75 }}>AB</div>
            <div style={{ fontSize: 13 }}>💎 {cheapestOpen.price_gems}</div>
          </div>
        )}
        <span style={{ color: "#FFD700", fontSize: 18, fontWeight: 900, flexShrink: 0, transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>›</span>
      </button>

      {/* Aufgeklappter Bereich */}
      {expanded && (
        <div style={{
          padding: 12,
          borderRadius: "0 0 14px 14px",
          background: "rgba(26,29,35,0.85)",
          border: "1px solid rgba(255,215,0,0.4)",
          borderTop: "none",
          display: "flex", flexDirection: "column", gap: 10,
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            {standardPacks.map((p) => {
              const tm = TIER_META[p.tier];
              const owned = data.purchased_today.includes(p.id);
              return (
                <div key={p.id} style={{
                  padding: 8, borderRadius: 10,
                  background: owned ? "rgba(74,222,128,0.08)" : `linear-gradient(180deg, ${tm.glow}, rgba(15,17,21,0.7))`,
                  border: `1px solid ${owned ? "rgba(74,222,128,0.4)" : tm.color}`,
                  position: "relative",
                }}>
                  {/* Badge entfernt: wurde als Zusatz-Bonus missverstanden — die 💎
                      stehen bereits im Pack-Inhalt und müssen nicht doppelt beworben werden. */}
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 22 }}>{p.icon}</div>
                    <div style={{ color: tm.color, fontSize: 8, fontWeight: 900, letterSpacing: 0.8, marginTop: 1 }}>{tm.label}</div>
                  </div>
                  <ul style={{ margin: "6px 0 6px 12px", padding: 0, listStyle: "disc", color: "#a8b4cf", fontSize: 9, lineHeight: 1.35 }}>
                    {p.contents.map((c, i) => <li key={i}>{c.label}</li>)}
                  </ul>
                  <button
                    onClick={() => !owned && buy(p.id)}
                    disabled={owned || busy === p.id}
                    style={{
                      width: "100%", padding: "6px 4px", borderRadius: 7,
                      background: owned ? "rgba(74,222,128,0.15)" : `linear-gradient(135deg, ${tm.color}, #FFD700)`,
                      color: owned ? "#4ade80" : "#0F1115",
                      border: owned ? "1px solid rgba(74,222,128,0.4)" : "none",
                      fontSize: 10, fontWeight: 900,
                      cursor: owned ? "not-allowed" : "pointer",
                    }}>
                    {owned ? "✓ geholt" : formatPrice(p)}
                  </button>
                </div>
              );
            })}
          </div>

          {bundlePack && (() => {
            const owned = data.purchased_today.includes(bundlePack.id);
            return (
              <button
                onClick={() => !owned && buy(bundlePack.id)}
                disabled={owned || busy === bundlePack.id}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 12,
                  background: owned
                    ? "rgba(74,222,128,0.12)"
                    : "linear-gradient(135deg, rgba(255,45,120,0.22), rgba(255,215,0,0.22), rgba(34,209,195,0.22))",
                  border: owned ? "1px solid rgba(74,222,128,0.4)" : "1px solid rgba(255,215,0,0.55)",
                  boxShadow: owned ? "none" : "0 0 12px rgba(255,215,0,0.3)",
                  cursor: owned ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", gap: 10,
                  textAlign: "left", color: "#FFF",
                }}>
                <span style={{ fontSize: 22 }}>{bundlePack.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 900, color: "#FFD700", letterSpacing: 0.4 }}>{bundlePack.name}</div>
                  <div style={{ fontSize: 9, color: "#a8b4cf", marginTop: 1 }}>Bronze + Silber + Gold zusammen</div>
                </div>
                <div style={{
                  padding: "6px 12px", borderRadius: 8,
                  background: owned ? "rgba(74,222,128,0.2)" : "linear-gradient(135deg, #FFD700, #FF6B4A)",
                  color: owned ? "#4ade80" : "#0F1115",
                  fontSize: 12, fontWeight: 900, flexShrink: 0,
                }}>{owned ? "✓" : formatPrice(bundlePack)}</div>
              </button>
            );
          })()}

          {toast && (
            <div style={{
              textAlign: "center", padding: "6px 10px", borderRadius: 8,
              background: "rgba(15,17,21,0.9)", border: "1px solid rgba(255,215,0,0.4)",
              color: "#FFF", fontSize: 11, fontWeight: 800,
            }}>{toast}</div>
          )}
        </div>
      )}
    </div>
  );
}
