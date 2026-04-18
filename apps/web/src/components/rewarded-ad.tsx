"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AD_REWARDS } from "@/lib/monetization";

type Placement = keyof typeof AD_REWARDS;

export function RewardedAdButton({ placement, userId, onReward, variant = "default" }: {
  placement: Placement;
  userId: string;
  onReward?: (xp: number) => void;
  variant?: "default" | "chip";
}) {
  const cfg = AD_REWARDS[placement];
  const [cooldownMin, setCooldownMin] = useState<number | null>(null);
  const [showing, setShowing] = useState(false);
  const [progress, setProgress] = useState(0);
  const sb = createClient();

  useEffect(() => {
    (async () => {
      const cutoff = new Date(Date.now() - cfg.cooldown_min * 60 * 1000).toISOString();
      const { data } = await sb.from("ad_views")
        .select("created_at")
        .eq("user_id", userId)
        .eq("placement", placement)
        .eq("completed", true)
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(1);
      if (data?.[0]) {
        const elapsed = (Date.now() - new Date(data[0].created_at).getTime()) / 60000;
        setCooldownMin(Math.ceil(cfg.cooldown_min - elapsed));
      }
    })();
  }, [placement, userId, cfg.cooldown_min, sb]);

  async function watchAd() {
    setShowing(true);
    setProgress(0);
    const tick = 100;
    const total = 30_000; // 30 sec
    const int = setInterval(() => {
      setProgress((p) => {
        const next = p + (tick / total) * 100;
        if (next >= 100) { clearInterval(int); finish(); return 100; }
        return next;
      });
    }, tick);
  }

  async function finish() {
    const xp = cfg.xp || 0;
    const { data: adRow } = await sb.from("ad_views").insert({
      user_id: userId, placement, xp_awarded: xp, completed: true,
    }).select("id").single();

    if (placement === "boost_24h") {
      await sb.from("users").update({
        xp_boost_until: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        xp_boost_multiplier: 2,
      }).eq("id", userId);
    } else if (placement === "double_xp") {
      await sb.from("users").update({
        xp_boost_until: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        xp_boost_multiplier: 2,
      }).eq("id", userId);
    } else if (xp > 0) {
      const { data: u } = await sb.from("users").select("xp").eq("id", userId).single();
      await sb.from("users").update({ xp: (u?.xp ?? 0) + xp }).eq("id", userId);
    }

    void adRow;
    setShowing(false);
    setCooldownMin(cfg.cooldown_min);
    onReward?.(xp);
  }

  if (showing) {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.85)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}>
        <div style={{
          background: "#1A1D23", borderRadius: 20, padding: 28, maxWidth: 400, width: "100%",
          textAlign: "center", border: "1px solid rgba(255,255,255,0.1)",
        }}>
          <div style={{ fontSize: 48, marginBottom: 10 }}>📺</div>
          <div style={{ color: "#FFF", fontSize: 16, fontWeight: 900, marginBottom: 4 }}>Werbung läuft…</div>
          <div style={{ color: "#a8b4cf", fontSize: 12, marginBottom: 16 }}>
            Nach dem Video: {cfg.description}
          </div>
          <div style={{ height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden", marginBottom: 14 }}>
            <div style={{ width: `${progress}%`, height: "100%", background: "#22D1C3", transition: "width 0.1s linear" }} />
          </div>
          <div style={{ color: "#22D1C3", fontSize: 11, fontWeight: 800 }}>
            {Math.ceil((100 - progress) * 0.3)} Sekunden verbleibend
          </div>
          <button
            onClick={() => setShowing(false)}
            style={{ marginTop: 14, background: "none", border: "1px solid rgba(255,255,255,0.15)", color: "#a8b4cf", padding: "6px 14px", borderRadius: 8, fontSize: 11, cursor: "pointer" }}
          >
            Abbrechen (kein Reward)
          </button>
        </div>
      </div>
    );
  }

  const disabled = cooldownMin !== null && cooldownMin > 0;
  const cooldownLabel = cooldownMin === null ? "" : cooldownMin >= 60
    ? `${Math.floor(cooldownMin / 60)}h ${cooldownMin % 60 > 0 ? `${cooldownMin % 60}m` : ""}`.trim()
    : `${cooldownMin}m`;
  const label = disabled ? `⏱ Nächstes Video in ${cooldownLabel}` : `📺 ${cfg.label}`;

  if (variant === "chip") {
    return (
      <button
        onClick={watchAd}
        disabled={disabled}
        style={{
          padding: "6px 12px", borderRadius: 999,
          background: disabled ? "rgba(255,255,255,0.06)" : "rgba(255, 215, 0, 0.15)",
          border: `1px solid ${disabled ? "rgba(255,255,255,0.1)" : "rgba(255, 215, 0, 0.5)"}`,
          color: disabled ? "#a8b4cf" : "#FFD700",
          fontSize: 11, fontWeight: 800, cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <button
      onClick={watchAd}
      disabled={disabled}
      style={{
        width: "100%", padding: "10px 14px", borderRadius: 12,
        background: disabled ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,107,74,0.2))",
        border: `1px solid ${disabled ? "rgba(255,255,255,0.1)" : "rgba(255,215,0,0.5)"}`,
        color: disabled ? "#a8b4cf" : "#FFD700",
        fontSize: 13, fontWeight: 800, cursor: disabled ? "not-allowed" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
      }}
    >
      <span>{label}</span>
      <span style={{ fontSize: 11, opacity: 0.8 }}>
        {disabled ? `alle ${cfg.cooldown_min >= 60 ? `${Math.round(cfg.cooldown_min / 60)} h` : `${cfg.cooldown_min} min`} verfügbar` : cfg.description}
      </span>
    </button>
  );
}
