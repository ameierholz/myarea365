"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const ACCENT = "#FFD700";
const PREMIUM = "#A855F7";
const TEXT = "#F0F0F0";
const MUTED = "#8B8FA3";
const BG = "#0F1115";

type Reward = {
  level: number;
  free_label: string; free_kind: string; free_amount: number;
  premium_label: string; premium_kind: string; premium_amount: number;
};
type Status = {
  ok: boolean;
  season?: { id: number; name: string; days_left: number };
  progress?: {
    season_xp: number; level: number; next_level_xp: number;
    premium: boolean; free_claims: number[]; premium_claims: number[];
  };
  rewards?: Reward[];
};

export function SeasonPassModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("Motivation");
  const [s, setS] = useState<Status | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    try {
      const r = await fetch("/api/season/status", { cache: "no-store" });
      if (!r.ok) return;
      setS(await r.json() as Status);
    } catch { /* ignore */ }
  };
  useEffect(() => { void load(); }, []);

  const claim = async (level: number, track: "free" | "premium") => {
    const k = `${track}-${level}`;
    setBusy(k);
    try {
      const r = await fetch("/api/season/claim", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level, track }),
      });
      const j = await r.json() as { ok?: boolean; label?: string; error?: string };
      setToast(j.ok ? `🎉 ${j.label}` : (j.error ?? t("dividendError")));
      if (j.ok) {
        try { window.dispatchEvent(new CustomEvent("ma365:gems-changed")); } catch { /* ignore */ }
        await load();
      }
      setTimeout(() => setToast(null), 2500);
    } finally { setBusy(null); }
  };

  const unlockPremium = async () => {
    setBusy("unlock");
    try {
      const r = await fetch("/api/season/unlock-premium", { method: "POST" });
      const j = await r.json() as { ok?: boolean; error?: string };
      if (j.ok) {
        setToast(t("seasonPremiumUnlocked"));
        try { window.dispatchEvent(new CustomEvent("ma365:gems-changed")); } catch { /* ignore */ }
        await load();
      } else setToast(j.error === "not_enough_gems" ? t("seasonNotEnoughGems") : (j.error ?? t("dividendError")));
      setTimeout(() => setToast(null), 3000);
    } finally { setBusy(null); }
  };

  if (!s?.ok) {
    return (
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9500, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: BG, padding: 30, borderRadius: 16, color: MUTED }}>{t("seasonLoading")}</div>
      </div>
    );
  }

  const { season, progress, rewards } = s;
  const xpInCurLevel = (progress?.season_xp ?? 0) % 1000;
  const xpProgressPct = Math.min(100, Math.round((xpInCurLevel / 1000) * 100));

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)",
      zIndex: 9500, display: "flex", alignItems: "center", justifyContent: "center", padding: 12,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: BG, borderRadius: 16, width: "100%", maxWidth: 760, maxHeight: "92vh",
        border: `1px solid ${ACCENT}55`, overflow: "hidden",
        display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{
          padding: "14px 18px",
          background: `linear-gradient(135deg, ${ACCENT}33, ${PREMIUM}22 60%, transparent 100%)`,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: ACCENT, fontSize: 11, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase" }}>
              {t("seasonPillLabel")} · {t("seasonDaysLeft", { days: season?.days_left ?? 0 })}
            </div>
            <div style={{ color: TEXT, fontSize: 18, fontWeight: 900, marginTop: 2 }}>{season?.name}</div>
            <div style={{ color: MUTED, fontSize: 12, marginTop: 4 }}>
              {t("seasonLevel", { level: progress?.level ?? 0 })}
              {" · "}
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{t("seasonXpProgress", { cur: xpInCurLevel, total: 1000 })}</span>
            </div>
            <div style={{ marginTop: 6, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${xpProgressPct}%`, background: `linear-gradient(90deg, ${ACCENT}, ${PREMIUM})`, transition: "width 300ms" }} />
            </div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: MUTED, fontSize: 22, cursor: "pointer", padding: 4 }}>✕</button>
        </div>

        {/* Premium-Unlock-CTA */}
        {!progress?.premium && (
          <div style={{
            margin: "12px 18px 0",
            padding: 12, borderRadius: 12,
            background: `linear-gradient(135deg, ${PREMIUM}22, transparent)`,
            border: `1px solid ${PREMIUM}66`,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <span style={{ fontSize: 28 }}>✨</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: TEXT, fontSize: 13, fontWeight: 800 }}>{t("seasonPremiumTitle")}</div>
              <div style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>
                {t("seasonPremiumDesc")}
              </div>
            </div>
            <button
              onClick={unlockPremium}
              disabled={busy === "unlock"}
              style={{
                padding: "8px 14px", borderRadius: 8, border: "none",
                background: `linear-gradient(135deg, ${PREMIUM}, #FF2D78)`, color: "#FFF",
                fontSize: 12, fontWeight: 900, cursor: busy === "unlock" ? "wait" : "pointer",
                opacity: busy === "unlock" ? 0.6 : 1, flexShrink: 0,
                boxShadow: `0 4px 12px ${PREMIUM}66`,
              }}
            >{t("seasonPremiumPrice")}</button>
          </div>
        )}

        {/* Rewards-Liste */}
        <div style={{ overflowY: "auto", padding: "12px 18px 18px", flex: 1 }}>
          {rewards?.map((r) => {
            const reached = (progress?.level ?? 0) >= r.level;
            const freeClaimed = progress?.free_claims?.includes(r.level);
            const premiumClaimed = progress?.premium_claims?.includes(r.level);
            return (
              <div key={r.level} style={{
                display: "grid",
                gridTemplateColumns: "44px 1fr 1fr",
                gap: 8,
                padding: "8px 0",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                alignItems: "center",
                opacity: reached ? 1 : 0.5,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 18,
                  background: reached ? `linear-gradient(135deg, ${ACCENT}, ${PREMIUM})` : "rgba(255,255,255,0.08)",
                  color: reached ? BG : MUTED,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 900, fontSize: 13,
                }}>{r.level}</div>

                {/* Free-Track */}
                <div style={{
                  padding: 8, borderRadius: 8,
                  background: freeClaimed ? "rgba(34,209,195,0.1)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${freeClaimed ? "rgba(34,209,195,0.4)" : "rgba(255,255,255,0.08)"}`,
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6,
                }}>
                  <span style={{ color: TEXT, fontSize: 12, fontWeight: 700, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.free_label}</span>
                  {freeClaimed ? (
                    <span style={{ color: "#22D1C3", fontSize: 11, fontWeight: 800 }}>✓</span>
                  ) : reached ? (
                    <button
                      onClick={() => claim(r.level, "free")}
                      disabled={busy === `free-${r.level}`}
                      style={{ padding: "3px 8px", borderRadius: 6, border: "none", background: ACCENT, color: BG, fontSize: 10, fontWeight: 900, cursor: "pointer" }}
                    >{busy === `free-${r.level}` ? "…" : t("seasonClaim")}</button>
                  ) : null}
                </div>

                {/* Premium-Track */}
                <div style={{
                  padding: 8, borderRadius: 8,
                  background: premiumClaimed ? "rgba(168,85,247,0.1)" : "rgba(168,85,247,0.04)",
                  border: `1px solid ${premiumClaimed ? "rgba(168,85,247,0.4)" : "rgba(168,85,247,0.15)"}`,
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6,
                }}>
                  <span style={{ color: progress?.premium ? TEXT : MUTED, fontSize: 12, fontWeight: 700, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {progress?.premium ? r.premium_label : `🔒 ${r.premium_label}`}
                  </span>
                  {progress?.premium && (
                    premiumClaimed ? <span style={{ color: PREMIUM, fontSize: 11, fontWeight: 800 }}>✓</span> :
                    reached ? (
                      <button
                        onClick={() => claim(r.level, "premium")}
                        disabled={busy === `premium-${r.level}`}
                        style={{ padding: "3px 8px", borderRadius: 6, border: "none", background: PREMIUM, color: "#FFF", fontSize: 10, fontWeight: 900, cursor: "pointer" }}
                      >{busy === `premium-${r.level}` ? "…" : t("seasonClaim")}</button>
                    ) : null
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {toast && (
          <div style={{
            position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
            padding: "8px 16px", borderRadius: 8,
            background: "rgba(15,17,21,0.95)", border: "1px solid rgba(255,255,255,0.15)",
            color: TEXT, fontSize: 13, fontWeight: 700,
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          }}>{toast}</div>
        )}
      </div>
    </div>
  );
}
