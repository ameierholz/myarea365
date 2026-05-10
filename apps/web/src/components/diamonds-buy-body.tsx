"use client";

import { useEffect, useState } from "react";

const PRIMARY = "#22D1C3";
const GOLD = "#FFD700";
const PINK = "#FF2D78";

type GemTier = { id: string; price_cents: number; base_gems: number; bonus_gems: number; badge_label?: string; bonus_rewards: Array<{ kind: string; qty?: number; tier?: string; resource?: string; theme_id?: string; marker_id?: string; days?: number; buff?: string; label?: string }> };
type Threshold = { id: string; threshold: number; reward_label: string; sort: number };

type Data = {
  tiers: GemTier[];
  thresholds: Threshold[];
  progress: { gem_threshold?: { gems_purchased: number; thresholds_claimed: number[] } };
};

const fmtPrice = (cents: number) => `EUR ${(cents / 100).toFixed(2).replace(".", ",")}`;
const fmtNum = (n: number) => n.toLocaleString("de-DE");

export function DiamondsBuyBody() {
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/monetization/deals", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setData({
        tiers: j.tiers ?? [],
        thresholds: j.thresholds ?? [],
        progress: j.progress ?? {},
      }))
      .catch(() => setData(null));
  }, []);

  async function checkout(tierId: string) {
    setBusy(tierId);
    try {
      const r = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sku: `gem_tier:${tierId}` }),
      });
      const j = await r.json() as { url?: string; error?: string };
      if (j.url) window.location.href = j.url;
      else if (j.error) alert(j.error);
    } finally { setBusy(null); }
  }

  if (!data) return <div style={{ color: "#a8b4cf", fontSize: 12, textAlign: "center", padding: 24 }}>Lade Diamant-Pakete…</div>;

  const purchased = data.progress.gem_threshold?.gems_purchased ?? 0;
  const claimed = new Set(data.progress.gem_threshold?.thresholds_claimed ?? []);
  const nextThreshold = data.thresholds.find((t) => purchased < t.threshold && !claimed.has(t.threshold));

  return (
    <div>
      {/* Hero */}
      <div style={{
        padding: "12px 14px", borderRadius: 14, marginBottom: 14,
        background: `linear-gradient(135deg, ${GOLD}18, rgba(255,215,0,0.04))`,
        border: `1px solid ${GOLD}44`,
      }}>
        <div style={{ color: GOLD, fontSize: 10, fontWeight: 900, letterSpacing: 1.5, marginBottom: 4 }}>💎 DIAMANTEN KAUFEN</div>
        <div style={{ color: "#a8b4cf", fontSize: 11, lineHeight: 1.5 }}>
          Diamanten sind die Premium-Währung — beschleunige Bauten, kauf Speed-Tokens, schalte Cosmetics frei.
          <b style={{ color: "#FFF" }}> Kein Pay-to-Win:</b> Wächter, CvC-Rang & Trupps bleiben skill-basiert.
        </div>
        {nextThreshold && (
          <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 8, background: "rgba(0,0,0,0.3)", border: "1px dashed rgba(255,215,0,0.3)" }}>
            <div style={{ color: GOLD, fontSize: 10, fontWeight: 800 }}>
              🏆 Nächste Schwelle: {fmtNum(nextThreshold.threshold)} 💎 → {nextThreshold.reward_label}
            </div>
            <div style={{ color: "#a8b4cf", fontSize: 10 }}>Bisher gekauft: {fmtNum(purchased)} / {fmtNum(nextThreshold.threshold)} 💎</div>
          </div>
        )}
      </div>

      {/* Diamanten-Tiers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: 10 }}>
        {data.tiers.map((t) => {
          const isBusy = busy === t.id;
          const total = t.base_gems + t.bonus_gems;
          const hasBonus = t.bonus_gems > 0;
          const accent = t.badge_label?.includes("First") ? PRIMARY : t.badge_label?.includes("Bonus") ? GOLD : t.badge_label?.includes("Legend") ? PINK : "#a855f7";
          return (
            <div key={t.id} style={{
              padding: 14, borderRadius: 14,
              background: `linear-gradient(135deg, ${accent}18, rgba(15,17,21,0.7))`,
              border: `1px solid ${accent}55`,
              display: "flex", flexDirection: "column", gap: 10,
              boxShadow: t.badge_label?.includes("Legend") ? `0 0 18px ${accent}33` : "none",
            }}>
              {t.badge_label && (
                <div style={{
                  alignSelf: "flex-start",
                  padding: "3px 8px", borderRadius: 999,
                  background: `${accent}33`, color: accent,
                  fontSize: 9, fontWeight: 900, letterSpacing: 0.5,
                }}>{t.badge_label}</div>
              )}
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 28, marginBottom: 4 }}>💎</div>
                <div style={{ color: GOLD, fontSize: 24, fontWeight: 900, lineHeight: 1 }}>{fmtNum(total)}</div>
                {hasBonus && (
                  <div style={{ color: "#a8b4cf", fontSize: 10, marginTop: 4 }}>
                    {fmtNum(t.base_gems)} + <b style={{ color: "#4ade80" }}>{fmtNum(t.bonus_gems)} Bonus</b>
                  </div>
                )}
              </div>
              {Array.isArray(t.bonus_rewards) && t.bonus_rewards.length > 0 && (
                <div style={{ padding: 8, borderRadius: 8, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ color: "#a8b4cf", fontSize: 9, fontWeight: 800, letterSpacing: 0.5, marginBottom: 4 }}>EXTRA</div>
                  {t.bonus_rewards.map((br, i) => (
                    <div key={i} style={{ color: "#FFF", fontSize: 10, lineHeight: 1.4 }}>
                      • {br.label ?? `${br.qty ?? 1}× ${br.kind}`}
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => void checkout(t.id)} disabled={isBusy}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 10,
                  background: `linear-gradient(180deg, ${accent}, ${accent}dd)`,
                  color: "#0F1115", border: "none",
                  fontSize: 13, fontWeight: 900, cursor: "pointer",
                }}>
                {isBusy ? "…" : fmtPrice(t.price_cents)}
              </button>
            </div>
          );
        })}
      </div>

      {/* Schwellen-Belohnungen */}
      {data.thresholds.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ color: PRIMARY, fontSize: 10, fontWeight: 900, letterSpacing: 2, marginBottom: 6 }}>🏆 SCHWELLEN-BELOHNUNGEN</div>
          <div style={{ color: "#a8b4cf", fontSize: 11, marginBottom: 10, lineHeight: 1.4 }}>
            Bei kumuliertem Diamant-Kauf bekommst du extra Boni gratis dazu.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {data.thresholds.map((th) => {
              const reached = purchased >= th.threshold;
              const isClaimed = claimed.has(th.threshold);
              return (
                <div key={th.id} style={{
                  padding: "8px 12px", borderRadius: 10,
                  background: isClaimed ? "rgba(74,222,128,0.08)" : reached ? `${GOLD}18` : "rgba(255,255,255,0.04)",
                  border: `1px solid ${isClaimed ? "rgba(74,222,128,0.3)" : reached ? GOLD + "55" : "rgba(255,255,255,0.08)"}`,
                  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#FFF", fontSize: 12, fontWeight: 800 }}>
                      {fmtNum(th.threshold)} 💎 kumuliert → {th.reward_label}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 900, color: isClaimed ? "#4ade80" : reached ? GOLD : "#8B8FA3" }}>
                    {isClaimed ? "✓ EINGELÖST" : reached ? "🔓 BEREIT" : "🔒"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
