"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { XP_REWARDED_AD } from "@/lib/game-config";
import { AD_REWARDS } from "@/lib/monetization";

export type WalkSummary = {
  distance_m: number;
  duration_s: number;
  xp_earned: number;
  streets: string[];
  territory_count: number;
};

export function WalkSummaryModal({ summary, userId, isPremium, onClose }: {
  summary: WalkSummary;
  userId: string;
  isPremium: boolean;
  onClose: (bonusXp: number) => void;
}) {
  const [phase, setPhase] = useState<"checking" | "ad" | "summary">(isPremium ? "summary" : "checking");
  const [progress, setProgress] = useState(0);
  const [bonusXp, setBonusXp] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const [adDurationSec] = useState(() => {
    const r = Math.random();
    if (r < 0.35) return 15;
    if (r < 0.75) return 20;
    return 30;
  });
  const sb = createClient();

  useEffect(() => {
    if (phase !== "checking") return;
    (async () => {
      const cooldownMs = AD_REWARDS.post_walk.cooldown_min * 60 * 1000;
      const cutoff = new Date(Date.now() - cooldownMs).toISOString();
      const { data } = await sb.from("ad_views")
        .select("created_at")
        .eq("user_id", userId)
        .eq("placement", "post_walk")
        .eq("completed", true)
        .gte("created_at", cutoff)
        .limit(1);
      setPhase(data && data.length > 0 ? "summary" : "ad");
    })();
  }, [phase, userId, sb]);

  useEffect(() => {
    if (phase !== "ad") return;
    const tick = 100;
    const total = adDurationSec * 1000;
    const int = setInterval(() => {
      setProgress((p) => {
        const next = p + (tick / total) * 100;
        if (next >= 100) {
          clearInterval(int);
          void finishAd();
          return 100;
        }
        return next;
      });
    }, tick);
    return () => clearInterval(int);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  async function finishAd() {
    const xp = XP_REWARDED_AD;
    setBonusXp(xp);
    await sb.from("ad_views").insert({
      user_id: userId, placement: "post_walk", xp_awarded: xp, completed: true,
    });
    const { data: u } = await sb.from("users").select("xp").eq("id", userId).single();
    await sb.from("users").update({ xp: (u?.xp ?? 0) + xp }).eq("id", userId);
    setPhase("summary");
  }

  function skipAd() {
    setSkipped(true);
    setPhase("summary");
  }

  const km = (summary.distance_m / 1000).toFixed(2);
  const mins = Math.floor(summary.duration_s / 60);
  const secs = summary.duration_s % 60;
  const pace = summary.distance_m > 0 ? (summary.duration_s / 60) / (summary.distance_m / 1000) : 0;
  const cal = Math.round(summary.distance_m * 0.06);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2000,
      background: "rgba(15,17,21,0.92)", backdropFilter: "blur(10px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        width: "100%", maxWidth: 420,
        background: "#1A1D23", borderRadius: 20, padding: 24,
        border: "1px solid rgba(255,255,255,0.1)",
        color: "#F0F0F0",
      }}>
        {phase === "checking" ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#a8b4cf", fontSize: 13 }}>…</div>
        ) : phase === "ad" ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>📺</div>
            <div style={{ color: "#FFF", fontSize: 18, fontWeight: 900, marginBottom: 4 }}>Kurze Werbung läuft…</div>
            <div style={{ color: "#a8b4cf", fontSize: 12, marginBottom: 16 }}>
              {adDurationSec} Sek — danach siehst du deine Lauf-Zusammenfassung + <b style={{ color: "#FFD700" }}>+{XP_REWARDED_AD} XP Bonus</b>
            </div>
            <div style={{ height: 8, background: "rgba(255,255,255,0.1)", borderRadius: 4, overflow: "hidden", marginBottom: 12 }}>
              <div style={{ width: `${progress}%`, height: "100%", background: "linear-gradient(90deg, #22D1C3, #FFD700)", transition: "width 0.1s linear" }} />
            </div>
            <div style={{ color: "#22D1C3", fontSize: 12, fontWeight: 800, marginBottom: 16 }}>
              {Math.ceil((100 - progress) * (adDurationSec / 100))} Sekunden verbleibend
            </div>
            <button
              onClick={skipAd}
              style={{
                background: "none", border: "1px solid rgba(255,255,255,0.15)",
                color: "#a8b4cf", padding: "8px 18px", borderRadius: 10,
                fontSize: 11, cursor: "pointer",
              }}
            >
              Überspringen (kein Bonus)
            </button>
          </div>
        ) : (
          <div>
            <div style={{ textAlign: "center", marginBottom: 18 }}>
              <div style={{ fontSize: 48, marginBottom: 4 }}>🎉</div>
              <div style={{ color: "#FFF", fontSize: 22, fontWeight: 900 }}>Lauf beendet!</div>
              {summary.streets.length > 0 && (
                <div style={{ color: "#a8b4cf", fontSize: 12, marginTop: 4 }}>
                  {summary.streets.slice(0, 3).join(" · ")}
                </div>
              )}
            </div>

            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14,
            }}>
              <Stat icon="📏" label="Strecke" value={`${km} km`} accent="#22D1C3" />
              <Stat icon="⏱️" label="Zeit" value={`${mins}:${String(secs).padStart(2, "0")} min`} accent="#5ddaf0" />
              <Stat icon="⚡" label="Pace" value={pace > 0 ? `${pace.toFixed(1)} min/km` : "—"} accent="#FF6B4A" />
              <Stat icon="🔥" label="Kalorien" value={`${cal} kcal`} accent="#FF2D78" />
            </div>

            <div style={{
              background: "linear-gradient(135deg, rgba(255,215,0,0.15), rgba(34,209,195,0.1))",
              border: "1px solid rgba(255,215,0,0.4)",
              padding: 14, borderRadius: 14, marginBottom: 16,
            }}>
              <div style={{ color: "#a8b4cf", fontSize: 10, fontWeight: 800, letterSpacing: 1 }}>XP BELOHNUNG</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 4 }}>
                <span style={{ color: "#FFD700", fontSize: 28, fontWeight: 900 }}>
                  +{(summary.xp_earned + bonusXp).toLocaleString("de-DE")} XP
                </span>
                {bonusXp > 0 && (
                  <span style={{ color: "#22D1C3", fontSize: 11, fontWeight: 800 }}>
                    inkl. +{bonusXp} Werbe-Bonus 🙏
                  </span>
                )}
                {skipped && !isPremium && (
                  <span style={{ color: "#a8b4cf", fontSize: 10 }}>(Bonus übersprungen)</span>
                )}
              </div>
              <div style={{ color: "#a8b4cf", fontSize: 11, marginTop: 4 }}>
                {summary.territory_count}× Territorium erobert
              </div>
            </div>

            <button
              onClick={() => onClose(bonusXp)}
              style={{
                width: "100%", padding: "14px 20px", borderRadius: 14,
                background: "#22D1C3", color: "#0F1115",
                border: "none", cursor: "pointer",
                fontSize: 15, fontWeight: 900,
              }}
            >
              Weiter
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label, value, accent }: { icon: string; label: string; value: string; accent: string }) {
  return (
    <div style={{
      padding: 12, borderRadius: 12,
      background: "rgba(70, 82, 122, 0.35)",
      border: "1px solid rgba(255,255,255,0.08)",
    }}>
      <div style={{ color: "#a8b4cf", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
        <span>{icon}</span> <span>{label}</span>
      </div>
      <div style={{ color: accent, fontSize: 16, fontWeight: 900, marginTop: 4 }}>{value}</div>
    </div>
  );
}
