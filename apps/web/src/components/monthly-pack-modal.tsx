"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const PRIMARY = "#22D1C3";
const GOLD = "#FFD700";
const PINK = "#FF2D78";
const TEXT_SOFT = "#a8b4cf";
const MUTED = "#8B8FA3";
const BORDER = "rgba(255,255,255,0.08)";

type Sku = {
  sku: string; name: string; price_eur: number; duration_days: number;
  daily_gems: number; daily_coins: number;
  daily_items: Array<{ catalog_id: string; count: number }>;
  instant_gems: number; instant_coins: number; sort_order: number;
};
type Owned = {
  id: string; sku: string; started_at: string; expires_at: string;
  last_claimed_date: string | null; total_claims: number;
  can_claim_today: boolean;
};
type ApiData = { skus: Sku[]; owned: Owned[] };

export function MonthlyPackModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("MonthlyPacks");
  const [data, setData] = useState<ApiData | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/runner/monthly-packs");
    if (!r.ok) return;
    setData(await r.json() as ApiData);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function purchase(sku: string) {
    if (busy) return;
    setBusy(`buy_${sku}`);
    try {
      const r = await fetch("/api/runner/monthly-packs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "purchase", sku }),
      });
      if (r.ok) { setToast(t("purchased")); await load(); }
      else setToast(t("error"));
      setTimeout(() => setToast(null), 2000);
    } finally { setBusy(null); }
  }

  async function claimAll() {
    if (busy) return;
    setBusy("claim");
    try {
      const r = await fetch("/api/runner/monthly-packs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim_all" }),
      });
      const j = await r.json().catch(() => null) as { ok?: boolean; results?: Array<{ sku: string; claimed: boolean }> } | null;
      if (j?.ok) {
        const claimedCount = (j.results ?? []).filter((r) => r.claimed).length;
        setToast(claimedCount > 0 ? t("claimedN", { n: claimedCount }) : t("nothingToClaim"));
        await load();
      } else setToast(t("error"));
      setTimeout(() => setToast(null), 2000);
    } finally { setBusy(null); }
  }

  const ownedSet = new Set(data?.owned.map((o) => o.sku) ?? []);
  const canClaimAny = (data?.owned ?? []).some((o) => o.can_claim_today);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 9100,
      background: "rgba(0,0,0,0.78)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 12,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 520, maxHeight: "92vh",
        display: "flex", flexDirection: "column",
        background: `linear-gradient(180deg, ${PRIMARY}1a 0%, #141a2d 60%)`,
        borderRadius: 18, border: `1px solid ${PRIMARY}66`,
        color: "#F0F0F0", overflow: "hidden",
      }}>
        <div style={{ padding: "16px 18px 8px", display: "flex", justifyContent: "space-between" }}>
          <div>
            <div style={{ color: PRIMARY, fontSize: 9, fontWeight: 900, letterSpacing: 2 }}>{t("kicker")}</div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>{t("title")}</div>
            <div style={{ color: TEXT_SOFT, fontSize: 11, marginTop: 2 }}>{t("subtitle")}</div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 16,
            background: "rgba(0,0,0,0.55)", border: "none",
            color: "#FFF", fontSize: 18, fontWeight: 900, cursor: "pointer",
          }}>×</button>
        </div>

        {/* Aktive Packs + Claim */}
        {data && data.owned.length > 0 && (
          <div style={{ padding: "0 14px 12px" }}>
            <div style={{
              padding: 12, borderRadius: 12,
              background: `linear-gradient(135deg, ${PRIMARY}22, rgba(0,0,0,0.4))`,
              border: `1px solid ${PRIMARY}66`,
            }}>
              <div style={{ color: PRIMARY, fontSize: 9, fontWeight: 900, letterSpacing: 1.5, marginBottom: 6 }}>{t("activePacks")}</div>
              {data.owned.map((o) => {
                const days = Math.max(0, Math.ceil((new Date(o.expires_at).getTime() - Date.now()) / 86400000));
                const sku = data.skus.find((s) => s.sku === o.sku);
                return (
                  <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800 }}>{sku?.name ?? o.sku}</div>
                      <div style={{ color: TEXT_SOFT, fontSize: 10 }}>{t("daysLeft", { n: days })}</div>
                    </div>
                    <div style={{ fontSize: 10, color: o.can_claim_today ? GOLD : MUTED, fontWeight: 700 }}>
                      {o.can_claim_today ? `🎁 ${t("claimReady")}` : `✓ ${t("claimedToday")}`}
                    </div>
                  </div>
                );
              })}
              <button onClick={claimAll} disabled={!canClaimAny || busy !== null} style={{
                marginTop: 8, width: "100%", padding: "10px",
                borderRadius: 10, border: "none",
                background: canClaimAny ? `linear-gradient(135deg, ${GOLD}, #FF9E2C)` : "rgba(255,255,255,0.08)",
                color: canClaimAny ? "#0F1115" : MUTED,
                fontSize: 12, fontWeight: 900, cursor: canClaimAny ? "pointer" : "default",
              }}>{busy === "claim" ? "…" : canClaimAny ? t("claimAllBtn") : t("nothingToClaim")}</button>
            </div>
          </div>
        )}

        {/* SKUs zum Kauf */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 14px 14px" }}>
          {data?.skus.map((s) => {
            const owned = ownedSet.has(s.sku);
            return (
              <div key={s.sku} style={{
                marginTop: 10, padding: 14, borderRadius: 12,
                background: owned ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${owned ? "#444" : BORDER}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 900, color: owned ? MUTED : "#FFF" }}>{s.name}</div>
                  <div style={{ color: GOLD, fontSize: 14, fontWeight: 900 }}>{s.price_eur.toFixed(2)} €</div>
                </div>
                <div style={{ color: TEXT_SOFT, fontSize: 11, marginTop: 6, lineHeight: 1.5 }}>
                  ✓ {t("durationDays", { n: s.duration_days })}<br />
                  ✓ {t("dailyReward", { gems: s.daily_gems, coins: s.daily_coins.toLocaleString("de-DE") })}<br />
                  {s.instant_gems > 0 && <>✓ {t("instantGems", { gems: s.instant_gems })}<br /></>}
                </div>
                <button onClick={() => !owned && purchase(s.sku)} disabled={owned || busy !== null} style={{
                  marginTop: 10, width: "100%", padding: "10px",
                  borderRadius: 8, border: "none",
                  background: owned ? "rgba(255,255,255,0.06)" : `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY}aa)`,
                  color: owned ? MUTED : "#0F1115",
                  fontSize: 12, fontWeight: 900, cursor: owned ? "default" : "pointer",
                }}>{owned ? `✓ ${t("alreadyOwned")}` : busy === `buy_${s.sku}` ? "…" : t("purchaseBtn")}</button>
              </div>
            );
          })}
        </div>

        {toast && (
          <div style={{
            position: "absolute", bottom: 60, left: "50%", transform: "translateX(-50%)",
            padding: "8px 16px", borderRadius: 10,
            background: "rgba(0,0,0,0.9)", color: "#FFF", fontSize: 12, fontWeight: 700,
          }}>{toast}</div>
        )}
      </div>
    </div>
  );
}
