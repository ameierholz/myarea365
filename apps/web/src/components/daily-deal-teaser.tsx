"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useDailyDismiss } from "@/lib/use-daily-dismiss";

type DailyContent = { type: string; amount?: number; min?: number; max?: number; label: string; kind?: string; rarity?: string };
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

const TIER_DEFS: Record<DailyPack["tier"], { color: string; glow: string; labelKey: "tierBronze" | "tierSilver" | "tierGold" }> = {
  bronze: { color: "#cd7f32", glow: "rgba(205,127,50,0.28)",  labelKey: "tierBronze" },
  silver: { color: "#d8d8d8", glow: "rgba(216,216,216,0.28)", labelKey: "tierSilver" },
  gold:   { color: "#FFD700", glow: "rgba(255,215,0,0.38)",   labelKey: "tierGold" },
};

const CONTENT_ICON: Record<string, string> = {
  gems:             "💎",
  xp_boost_hours:   "🚀",
  random_seals:     "🏅",
  random_potion:    "🧪",
  random_materials: "🧱",
  arena_pass_days:  "⚔️",
  speed_token:      "⚡",
  treasure_chest:   "🗝️",
};
function iconFor(type: string, entry?: { kind?: string }): string {
  if (type === "treasure_chest") {
    return entry?.kind === "gold" ? "🥇" : entry?.kind === "event" ? "🎉" : "🥈";
  }
  return CONTENT_ICON[type] ?? "✨";
}

export function DailyDealTeaser({ bannerHidden = false }: { onOpen?: () => void; bannerHidden?: boolean }) {
  const t = useTranslations("DailyDeals");
  const [data, setData] = useState<DailyResponse | null>(null);
  const [resetIn, setResetIn] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { dismissed, dismiss } = useDailyDismiss("daily-deals-banner");

  function formatPrice(p: DailyPack): string {
    if (p.price_cents != null) return t("priceEur", { price: (p.price_cents / 100).toFixed(2).replace(".", ",") });
    return t("priceGems", { gems: p.price_gems });
  }

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    function handler() {
      setExpanded(true);
    }
    window.addEventListener("ma365:open-daily-deals", handler);
    return () => window.removeEventListener("ma365:open-daily-deals", handler);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setExpanded(false);
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [expanded]);

  async function buy(packId: string) {
    setBusy(packId);
    try {
      const res = await fetch("/api/shop/daily", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ pack_id: packId }),
      });
      const j = await res.json() as { ok?: boolean; error?: string; seals_granted?: number };
      if (j.ok) {
        setToast(j.seals_granted ? t("alertRedeemedSeals", { n: j.seals_granted }) : t("alertRedeemed"));
        await load();
      } else {
        setToast(j.error === "already_purchased_today" ? t("alertAlready") : (j.error ?? t("alertGenericErr")));
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

  const cheapestOpen = [...standardOpen].sort((a, b) => {
    const ap = a.price_cents ?? a.price_gems * 10;
    const bp = b.price_cents ?? b.price_gems * 10;
    return ap - bp;
  })[0];

  const openLabel = standardOpen.length === 1 ? t("openOne", { n: 1 }) : t("openMany", { n: standardOpen.length });

  return (
    <div ref={rootRef} style={{ display: "flex", flexDirection: "column", gap: 0, scrollMarginTop: 80 }}>
      <style>{`
        @keyframes daily-pulse-strong {
          0%,100% { box-shadow: 0 0 14px rgba(255,215,0,0.35), 0 0 30px rgba(255,45,120,0.15); }
          50%     { box-shadow: 0 0 28px rgba(255,215,0,0.65), 0 0 50px rgba(255,45,120,0.35); }
        }
        @keyframes daily-shimmer { 0% { transform: translateX(-120%); } 100% { transform: translateX(340%); } }
      `}</style>

      {!bannerHidden && !dismissed && (
      <div
        onClick={() => setExpanded(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setExpanded(true); }}
        style={{
          position: "relative", overflow: "hidden",
          padding: "14px 14px",
          borderRadius: 14,
          background: hasBundleOpen
            ? "linear-gradient(135deg, rgba(255,45,120,0.28), rgba(255,215,0,0.22), rgba(34,209,195,0.22))"
            : "linear-gradient(135deg, rgba(255,107,74,0.22), rgba(255,215,0,0.16))",
          border: `1px solid ${hasBundleOpen ? "rgba(255,215,0,0.7)" : "rgba(255,107,74,0.55)"}`,
          cursor: "pointer", textAlign: "left",
          display: "flex", alignItems: "center", gap: 12, color: "#FFF",
          animation: !expanded ? "daily-pulse-strong 2.4s ease-in-out infinite" : undefined,
        }}
      >
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
              {t("kicker")}
            </span>
            {hasBundleOpen && (
              <span style={{
                fontSize: 8, fontWeight: 900, letterSpacing: 0.8,
                padding: "1px 6px", borderRadius: 4,
                background: "linear-gradient(135deg, #FF2D78, #FFD700)",
                color: "#0F1115",
              }}>{t("superBundle")}</span>
            )}
          </div>
          <div style={{ fontSize: 14, fontWeight: 900, color: "#FFF", marginTop: 2 }}>
            {openLabel}
            {hasBundleOpen && <span style={{ color: "#FFD700" }}>{t("plusBundle")}</span>}
          </div>
          <div style={{
            fontSize: 10, fontWeight: 800, color: "#FFD700",
            marginTop: 3, letterSpacing: 0.3,
            textShadow: "0 0 8px rgba(255,215,0,0.4)",
          }}>{t("lootTeaser")}</div>
          <div style={{ display: "flex", gap: 4, marginTop: 5, alignItems: "center", flexWrap: "wrap" }}>
            {standardPacks.map((p) => {
              const owned = data.purchased_today.includes(p.id);
              const td = TIER_DEFS[p.tier];
              const tierLabel = t(td.labelKey);
              return (
                <span key={p.id} title={owned ? t("tierTitleOwned", { tier: tierLabel }) : t("tierTitle", { tier: tierLabel, price: formatPrice(p) })} style={{
                  fontSize: 9, fontWeight: 900, letterSpacing: 0.4,
                  padding: "2px 6px", borderRadius: 4,
                  background: owned ? "rgba(74,222,128,0.12)" : `${td.color}22`,
                  color: owned ? "#4ade80" : td.color,
                  border: `1px solid ${owned ? "rgba(74,222,128,0.4)" : td.color + "77"}`,
                  opacity: owned ? 0.6 : 1,
                  textDecoration: owned ? "line-through" : "none",
                }}>{owned ? "✓" : ""}{p.icon} {tierLabel}</span>
              );
            })}
            <span style={{ color: "#8B8FA3", fontSize: 10, marginLeft: 4 }}>
              {t("resetTimer", { countdown })}
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
            <div style={{ fontSize: 8, letterSpacing: 0.8, opacity: 0.75 }}>{t("fromLabel")}</div>
            <div style={{ fontSize: 13 }}>{formatPrice(cheapestOpen)}</div>
          </div>
        )}
        <span style={{ color: "#FFD700", fontSize: 18, fontWeight: 900, flexShrink: 0 }}>›</span>
        <button
          onClick={(e) => { e.stopPropagation(); dismiss(); }}
          aria-label={t("ariaDismiss")}
          title={t("ariaDismiss")}
          style={{
            position: "absolute", top: 4, right: 4,
            width: 22, height: 22, borderRadius: 999,
            background: "rgba(15,17,21,0.55)", border: "1px solid rgba(255,255,255,0.12)",
            color: "#a8b4cf", fontSize: 12, lineHeight: 1, cursor: "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            zIndex: 2,
          }}
        >×</button>
      </div>
      )}

      {expanded && (
        <div
          onClick={() => setExpanded(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 4000,
            background: "rgba(10,12,20,0.85)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16, paddingBottom: "max(16px, env(safe-area-inset-bottom))",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 760, maxHeight: "92vh",
              borderRadius: 18, overflow: "auto",
              background: "rgba(26,29,35,0.98)",
              border: "1px solid rgba(255,215,0,0.45)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.7), 0 0 40px rgba(255,215,0,0.18)",
            }}
          >
            <div style={{
              position: "sticky", top: 0, zIndex: 1,
              display: "flex", alignItems: "center", gap: 10,
              padding: "14px 16px",
              background: "linear-gradient(135deg, rgba(255,107,74,0.22), rgba(255,215,0,0.16))",
              borderBottom: "1px solid rgba(255,215,0,0.3)",
            }}>
              <span style={{ fontSize: 22 }}>🔥</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 1.2, color: "#FFD700" }}>{t("kicker")}</div>
                <div style={{ fontSize: 14, fontWeight: 900, color: "#FFF" }}>
                  {openLabel}
                  {hasBundleOpen && <span style={{ color: "#FFD700" }}>{t("plusBundle")}</span>}
                </div>
                <div style={{ fontSize: 10, color: "#a8b4cf", marginTop: 1 }}>{t("resetIn", { countdown })}</div>
              </div>
              <button
                onClick={() => setExpanded(false)}
                aria-label={t("ariaClose")}
                style={{
                  background: "rgba(255,255,255,0.08)", border: "none",
                  color: "#a8b4cf", width: 34, height: 34, borderRadius: 999,
                  cursor: "pointer", fontSize: 18, lineHeight: 1, flexShrink: 0,
                }}
              >×</button>
            </div>

            <div style={{
              padding: 14,
              display: "flex", flexDirection: "column", gap: 12,
            }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
            {standardPacks.map((p) => {
              const td = TIER_DEFS[p.tier];
              const owned = data.purchased_today.includes(p.id);
              return (
                <div key={p.id} style={{
                  padding: 8, borderRadius: 10,
                  background: owned ? "rgba(74,222,128,0.08)" : `linear-gradient(180deg, ${td.glow}, rgba(15,17,21,0.7))`,
                  border: `1px solid ${owned ? "rgba(74,222,128,0.4)" : td.color}`,
                  position: "relative",
                }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 22 }}>{p.icon}</div>
                    <div style={{ color: td.color, fontSize: 8, fontWeight: 900, letterSpacing: 0.8, marginTop: 1 }}>{t(td.labelKey)}</div>
                  </div>
                  <ul style={{ margin: "6px 0", padding: 0, listStyle: "none", color: "#a8b4cf", fontSize: 10, lineHeight: 1.4 }}>
                    {p.contents.map((c, i) => (
                      <li key={i} style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 12, lineHeight: 1, flexShrink: 0 }}>{iconFor(c.type, c as { kind?: string })}</span>
                        <span>{c.label}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => !owned && buy(p.id)}
                    disabled={owned || busy === p.id}
                    style={{
                      width: "100%", padding: "6px 4px", borderRadius: 7,
                      background: owned ? "rgba(74,222,128,0.15)" : `linear-gradient(135deg, ${td.color}, #FFD700)`,
                      color: owned ? "#4ade80" : "#0F1115",
                      border: owned ? "1px solid rgba(74,222,128,0.4)" : "none",
                      fontSize: 10, fontWeight: 900,
                      cursor: owned ? "not-allowed" : "pointer",
                    }}>
                    {owned ? t("ownedLong") : formatPrice(p)}
                  </button>
                </div>
              );
            })}
          </div>

          {bundlePack && (() => {
            const owned = data.purchased_today.includes(bundlePack.id);
            const usesEur = bundlePack.price_cents != null;
            const sumCents = standardPacks.reduce((acc, p) => acc + (p.price_cents ?? 0), 0);
            const sumGems = standardPacks.reduce((acc, p) => acc + (p.price_gems ?? 0), 0);
            const bundleVal = usesEur ? (bundlePack.price_cents ?? 0) : (bundlePack.price_gems ?? 0);
            const fullVal = usesEur ? sumCents : sumGems;
            const canShowSaving = fullVal > 0 && bundleVal > 0 && fullVal > bundleVal;
            const savePct = canShowSaving ? Math.round((1 - bundleVal / fullVal) * 100) : 0;
            const fullLabel = usesEur
              ? t("priceEur", { price: (fullVal / 100).toFixed(2).replace(".", ",") })
              : t("priceGems", { gems: fullVal });
            return (
              <button
                onClick={() => !owned && buy(bundlePack.id)}
                disabled={owned || busy === bundlePack.id}
                style={{
                  width: "100%", padding: "12px 14px", borderRadius: 14,
                  background: owned
                    ? "rgba(74,222,128,0.12)"
                    : "linear-gradient(135deg, rgba(255,45,120,0.28), rgba(255,215,0,0.26), rgba(34,209,195,0.26))",
                  border: owned ? "1px solid rgba(74,222,128,0.4)" : "1px solid rgba(255,215,0,0.7)",
                  boxShadow: owned ? "none" : "0 0 18px rgba(255,215,0,0.45), inset 0 1px 0 rgba(255,255,255,0.1)",
                  cursor: owned ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", gap: 12,
                  textAlign: "left", color: "#FFF",
                  position: "relative", overflow: "hidden",
                }}>
                <span style={{ fontSize: 28, flexShrink: 0 }}>{bundlePack.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{
                      fontSize: 8, fontWeight: 900, letterSpacing: 0.8,
                      padding: "2px 6px", borderRadius: 4,
                      background: "linear-gradient(135deg, #FFD700, #FF6B4A)",
                      color: "#0F1115",
                    }}>{t("bestPrice")}</span>
                    <span style={{
                      fontSize: 8, fontWeight: 900, letterSpacing: 0.8,
                      padding: "2px 6px", borderRadius: 4,
                      background: "rgba(255,215,0,0.15)",
                      border: "1px solid rgba(255,215,0,0.5)",
                      color: "#FFD700",
                    }}>{t("allPacks")}</span>
                    {!owned && canShowSaving && (
                      <span style={{
                        fontSize: 9, fontWeight: 900, letterSpacing: 0.6,
                        padding: "2px 7px", borderRadius: 999,
                        background: "linear-gradient(135deg, #FF2D78, #FF6B4A)",
                        color: "#FFF",
                        boxShadow: "0 0 10px rgba(255,45,120,0.5)",
                      }}>−{savePct}%</span>
                    )}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: "#FFD700", letterSpacing: 0.4, marginTop: 3 }}>{bundlePack.name}</div>
                  <div style={{ fontSize: 10, color: "#FFF", marginTop: 1, fontWeight: 700 }}>🥉 Bronze + 🥈 Silber + 🥇 Gold</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                  {!owned && canShowSaving && (
                    <div style={{ fontSize: 14, fontWeight: 900, lineHeight: 1 }}>
                      <span style={{ color: "#a8b4cf", fontSize: 11 }}>{t("insteadOf")} </span>
                      <span style={{
                        textDecoration: "line-through",
                        textDecorationColor: "#FF2D78",
                        textDecorationThickness: 2.5,
                        color: "#FFF",
                      }}>{fullLabel}</span>
                    </div>
                  )}
                  <div style={{
                    padding: "10px 16px", borderRadius: 10,
                    background: owned ? "rgba(74,222,128,0.2)" : "linear-gradient(135deg, #FFD700, #FF6B4A)",
                    color: owned ? "#4ade80" : "#0F1115",
                    fontSize: 16, fontWeight: 900,
                    boxShadow: owned ? "none" : "0 0 14px rgba(255,215,0,0.55)",
                    textAlign: "center", lineHeight: 1.1,
                  }}>{owned ? t("ownedShort") : formatPrice(bundlePack)}</div>
                </div>
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
          </div>
        </div>
      )}
    </div>
  );
}
