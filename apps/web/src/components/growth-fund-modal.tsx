"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRankName } from "@/lib/i18n-game";

const GOLD = "#FFD700";
const PRIMARY = "#22D1C3";
const PINK = "#FF2D78";
const TEXT_SOFT = "#a8b4cf";
const MUTED = "#8B8FA3";
const BORDER = "rgba(255,255,255,0.08)";

type Milestone = { id: number; required_rank_id: number; gems_reward: number; sort_order: number };

type ApiData = {
  milestones: Milestone[];
  purchased: boolean;
  purchased_at: string | null;
  claimed: number[];
  current_rank: number;
  user_xp: number;
};

export function GrowthFundModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("GrowthFund");
  const tCommon = useTranslations("Common");
  const rankName = useRankName();
  const [data, setData] = useState<ApiData | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/runner/growth-fund");
    if (!r.ok) return;
    setData(await r.json() as ApiData);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const totalGems = data?.milestones.reduce((s, m) => s + m.gems_reward, 0) ?? 0;
  const claimedSet = new Set(data?.claimed ?? []);

  async function purchase() {
    if (busy) return;
    setBusy("purchase");
    try {
      const r = await fetch("/api/runner/growth-fund", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "purchase" }),
      });
      if (r.ok) { setToast(t("purchased")); await load(); }
      else setToast(t("error"));
      setTimeout(() => setToast(null), 2000);
    } finally { setBusy(null); }
  }

  async function claim(milestoneId: number) {
    if (busy) return;
    setBusy(`claim_${milestoneId}`);
    try {
      const r = await fetch("/api/runner/growth-fund", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim", milestone_id: milestoneId }),
      });
      const j = await r.json().catch(() => null) as { ok?: boolean; gems?: number; error?: string } | null;
      if (j?.ok) { setToast(t("claimed", { gems: j.gems ?? 0 })); await load(); }
      else setToast(j?.error ?? t("error"));
      setTimeout(() => setToast(null), 2200);
    } finally { setBusy(null); }
  }

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 9100,
      background: "rgba(0,0,0,0.78)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 12,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 480, maxHeight: "92vh",
        display: "flex", flexDirection: "column",
        background: `linear-gradient(180deg, ${GOLD}1a 0%, #141a2d 60%)`,
        borderRadius: 18, border: `2px solid ${GOLD}aa`,
        boxShadow: `0 0 30px ${GOLD}55`,
        color: "#F0F0F0", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "16px 18px 8px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ color: GOLD, fontSize: 9, fontWeight: 900, letterSpacing: 2 }}>{t("kicker")}</div>
            <div style={{ fontSize: 20, fontWeight: 900, marginTop: 2 }}>{t("title")}</div>
            <div style={{ color: TEXT_SOFT, fontSize: 11, marginTop: 4 }}>{t("subtitle", { gems: totalGems.toLocaleString("de-DE") })}</div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 16,
            background: "rgba(0,0,0,0.55)", border: "none",
            color: "#FFF", fontSize: 18, fontWeight: 900, cursor: "pointer",
          }}>×</button>
        </div>

        {/* Purchase / Status */}
        {data && !data.purchased && (
          <div style={{ padding: "8px 18px 16px" }}>
            <button onClick={purchase} disabled={busy !== null} style={{
              width: "100%", padding: "14px",
              borderRadius: 12, border: "none",
              background: `linear-gradient(135deg, ${GOLD}, #FF9E2C)`,
              color: "#0F1115", fontSize: 14, fontWeight: 900, cursor: "pointer",
              boxShadow: `0 0 20px ${GOLD}66`,
            }}>
              {busy === "purchase" ? "…" : t("purchaseBtn")}
            </button>
            <div style={{ color: MUTED, fontSize: 10, marginTop: 6, textAlign: "center" }}>{t("purchaseHint")}</div>
          </div>
        )}
        {data?.purchased && (
          <div style={{ padding: "0 18px 12px" }}>
            <div style={{
              padding: "8px 12px", borderRadius: 10,
              background: `${PRIMARY}22`, border: `1px solid ${PRIMARY}66`,
              color: PRIMARY, fontSize: 11, fontWeight: 800, textAlign: "center",
            }}>✓ {t("activeStatus")}</div>
          </div>
        )}

        {/* Milestones */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 14px 14px" }}>
          {!data && <div style={{ padding: 20, textAlign: "center", color: TEXT_SOFT }}>{tCommon("ok")}…</div>}
          {data?.milestones.map((m) => {
            const claimed = claimedSet.has(m.id);
            const eligible = data.purchased && data.current_rank >= m.required_rank_id && !claimed;
            const locked = data.current_rank < m.required_rank_id;
            return (
              <div key={m.id} style={{
                marginTop: 8, padding: "10px 12px", borderRadius: 10,
                background: claimed ? "rgba(0,0,0,0.3)" : eligible ? `${GOLD}1a` : "rgba(255,255,255,0.03)",
                border: `1px solid ${claimed ? "#444" : eligible ? GOLD : BORDER}`,
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                opacity: locked ? 0.55 : 1,
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: claimed ? MUTED : "#FFF", fontSize: 12, fontWeight: 800 }}>
                    {t("milestoneN", { n: m.id })}
                    <span style={{ color: TEXT_SOFT, fontWeight: 600, marginLeft: 6 }}>
                      · {rankName(m.required_rank_id)}
                    </span>
                  </div>
                  <div style={{ color: GOLD, fontSize: 11, fontWeight: 900, marginTop: 2 }}>
                    💎 {m.gems_reward.toLocaleString("de-DE")}
                  </div>
                </div>
                {claimed ? (
                  <div style={{ color: MUTED, fontSize: 11, fontWeight: 700 }}>✓</div>
                ) : eligible ? (
                  <button onClick={() => claim(m.id)} disabled={busy !== null} style={{
                    padding: "8px 14px", borderRadius: 8, border: "none",
                    background: GOLD, color: "#0F1115",
                    fontSize: 11, fontWeight: 900, cursor: "pointer",
                  }}>{busy === `claim_${m.id}` ? "…" : t("claim")}</button>
                ) : (
                  <div style={{ color: MUTED, fontSize: 9, fontWeight: 700 }}>{locked ? "🔒" : t("notPurchased")}</div>
                )}
              </div>
            );
          })}
        </div>

        {toast && (
          <div style={{
            position: "absolute", bottom: 80, left: "50%", transform: "translateX(-50%)",
            padding: "8px 16px", borderRadius: 10,
            background: "rgba(0,0,0,0.9)", color: "#FFF", fontSize: 12, fontWeight: 700,
          }}>{toast}</div>
        )}
      </div>
    </div>
  );
}
