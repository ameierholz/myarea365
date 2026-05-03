"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const GOLD = "#FFD700";
const PINK = "#FF2D78";
const PRIMARY = "#22D1C3";
const TEXT_SOFT = "#a8b4cf";
const MUTED = "#8B8FA3";
const BORDER = "rgba(255,255,255,0.08)";

type Event = {
  id: string; name: string; starts_at: string; ends_at: string;
  spin_cost_gems: number; max_spins: number; pity_threshold: number;
};
type State = { spins_used: number; pity_counter: number; total_gems_won: number };
type Prize = { prize_type: string; prize_label: string; prize_amount: number; catalog_id: string | null };

export function LuckyWheelModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("LuckyWheel");
  const [event, setEvent] = useState<Event | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastPrize, setLastPrize] = useState<Prize | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/runner/lucky-wheel");
    if (!r.ok) return;
    const j = await r.json() as { event: Event | null; state: State | null };
    setEvent(j.event); setState(j.state);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function spin() {
    if (!event || busy) return;
    setBusy(true); setError(null);
    try {
      const r = await fetch("/api/runner/lucky-wheel", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: event.id }),
      });
      const j = await r.json().catch(() => null) as { ok?: boolean; prize?: Prize; error?: string } | null;
      if (j?.ok && j.prize) { setLastPrize(j.prize); await load(); }
      else setError(j?.error ?? t("error"));
    } finally { setBusy(false); }
  }

  const daysLeft = event ? Math.max(0, Math.ceil((new Date(event.ends_at).getTime() - Date.now()) / 86400000)) : 0;
  const spinsLeft = event && state ? event.max_spins - state.spins_used : 0;
  const pityLeft = event && state ? event.pity_threshold - state.pity_counter : 0;

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 9100,
      background: "rgba(0,0,0,0.78)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 12,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 460, maxHeight: "92vh",
        display: "flex", flexDirection: "column",
        background: `linear-gradient(180deg, ${PINK}1a 0%, #141a2d 60%)`,
        borderRadius: 18, border: `2px solid ${PINK}66`,
        color: "#F0F0F0", overflow: "hidden",
      }}>
        <div style={{ padding: "16px 18px 8px", display: "flex", justifyContent: "space-between" }}>
          <div>
            <div style={{ color: PINK, fontSize: 9, fontWeight: 900, letterSpacing: 2 }}>{t("kicker")}</div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>{event?.name ?? t("noEvent")}</div>
            {event && <div style={{ color: TEXT_SOFT, fontSize: 11, marginTop: 2 }}>⏳ {t("daysLeft", { n: daysLeft })}</div>}
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 16, background: "rgba(0,0,0,0.55)", border: "none",
            color: "#FFF", fontSize: 18, fontWeight: 900, cursor: "pointer",
          }}>×</button>
        </div>

        {!event ? (
          <div style={{ padding: 30, textAlign: "center", color: TEXT_SOFT }}>{t("noEventBody")}</div>
        ) : (
          <>
            {/* Wheel-Visual (vereinfacht: zentrales Spin-Pad mit Counter) */}
            <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{
                width: 180, height: 180, borderRadius: "50%",
                background: `radial-gradient(circle, ${GOLD}33, ${PINK}55, rgba(15,17,21,0.9))`,
                border: `4px solid ${GOLD}`,
                boxShadow: `0 0 30px ${GOLD}55, inset 0 0 20px ${PINK}44`,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                position: "relative",
              }}>
                <div style={{ fontSize: 64 }}>🎡</div>
                {state && (
                  <div style={{ position: "absolute", bottom: 14, color: GOLD, fontSize: 11, fontWeight: 900 }}>
                    {state.spins_used} / {event.max_spins}
                  </div>
                )}
              </div>

              {lastPrize && (
                <div style={{
                  marginTop: 16, padding: "10px 16px", borderRadius: 12,
                  background: `${GOLD}1a`, border: `1px solid ${GOLD}`,
                  textAlign: "center",
                }}>
                  <div style={{ color: GOLD, fontSize: 9, fontWeight: 900, letterSpacing: 1.5 }}>{t("youWon")}</div>
                  <div style={{ color: "#FFF", fontSize: 16, fontWeight: 900, marginTop: 2 }}>{lastPrize.prize_label}</div>
                </div>
              )}

              <div style={{ marginTop: 16, color: TEXT_SOFT, fontSize: 11, textAlign: "center" }}>
                {t("pityHint", { n: pityLeft })}
              </div>

              <button onClick={spin} disabled={busy || spinsLeft <= 0} style={{
                marginTop: 14, padding: "14px 24px",
                borderRadius: 12, border: "none",
                background: spinsLeft > 0 ? `linear-gradient(135deg, ${PINK}, ${GOLD})` : "rgba(255,255,255,0.08)",
                color: spinsLeft > 0 ? "#0F1115" : MUTED,
                fontSize: 13, fontWeight: 900, cursor: spinsLeft > 0 && !busy ? "pointer" : "default",
                boxShadow: spinsLeft > 0 ? `0 0 20px ${PINK}66` : "none",
              }}>
                {busy ? "…" : spinsLeft > 0 ? t("spinFor", { gems: event.spin_cost_gems }) : t("noSpinsLeft")}
              </button>

              {error && <div style={{ marginTop: 8, color: PINK, fontSize: 11 }}>{error}</div>}

              <div style={{ marginTop: 14, padding: "8px 12px", background: "rgba(0,0,0,0.4)", borderRadius: 8, fontSize: 10, color: TEXT_SOFT }}>
                💎 {t("totalWon", { n: state?.total_gems_won.toLocaleString("de-DE") ?? "0" })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
