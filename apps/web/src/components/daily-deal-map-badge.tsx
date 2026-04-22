"use client";

import { useEffect, useState } from "react";
import { ShopHubModal } from "@/components/shop-hub-modal";

type DailyPack = {
  id: string; is_bundle?: boolean;
  price_gems: number; icon: string; tier: string;
};
type DailyResponse = {
  packs: DailyPack[];
  purchased_today: string[];
  reset_in_seconds: number;
};

const LS_KEY = "ma365:dailyDealMapBadgeDismissed";

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * Floating Badge oben rechts auf der Map.
 * Zeigt wie viele Tagesangebote noch offen sind und pulsiert auffällig.
 * Kann pro Tag weggeklickt werden (per localStorage).
 */
export function DailyDealMapBadge({ userId, hidden = false }: { userId: string | null | undefined; hidden?: boolean }) {
  const [data, setData] = useState<DailyResponse | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [resetIn, setResetIn] = useState(0);
  const [openShop, setOpenShop] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Mobile-Detection für kompakte Darstellung (reines Icon-Pill unter 480 px)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 480px)");
    const upd = () => setIsMobile(mq.matches);
    upd();
    mq.addEventListener("change", upd);
    return () => mq.removeEventListener("change", upd);
  }, []);

  // Dismiss-State aus localStorage laden
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const stored = window.localStorage.getItem(LS_KEY);
      if (stored === todayKey()) setDismissed(true);
    } catch { /* ignore */ }
  }, []);

  // Daten laden
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const r = await fetch("/api/shop/daily");
        if (!r.ok) return;
        const j = await r.json() as DailyResponse;
        setData(j);
        setResetIn(j.reset_in_seconds ?? 0);
      } catch { /* stumm */ }
    })();
  }, [userId]);

  // Countdown-Timer
  useEffect(() => {
    if (resetIn <= 0) return;
    const id = setInterval(() => setResetIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [resetIn]);

  function dismiss(e: React.MouseEvent) {
    e.stopPropagation();
    try { window.localStorage.setItem(LS_KEY, todayKey()); } catch { /* ignore */ }
    setDismissed(true);
  }

  if (!userId || !data || dismissed || hidden) return null;

  const standardOpen = data.packs.filter((p) => !p.is_bundle && !data.purchased_today.includes(p.id));
  const bundleOpen = !!data.packs.find((p) => p.is_bundle && !data.purchased_today.includes(p.id));
  if (standardOpen.length === 0 && !bundleOpen) return null;

  const h = Math.floor(resetIn / 3600);
  const m = Math.floor((resetIn % 3600) / 60);
  const countdown = h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;

  return (
    <>
      <style>{`
        @keyframes ma365-deal-pulse-centered {
          0%,100% { box-shadow: 0 0 14px rgba(255,215,0,0.45), 0 0 30px rgba(255,45,120,0.25); transform: translateX(-50%) scale(1); }
          50%     { box-shadow: 0 0 24px rgba(255,215,0,0.75), 0 0 50px rgba(255,45,120,0.45); transform: translateX(-50%) scale(1.04); }
        }
        @keyframes ma365-deal-shimmer { 0% { transform: translateX(-120%); } 100% { transform: translateX(340%); } }
      `}</style>

      <button
        onClick={() => setOpenShop(true)}
        aria-label="Tägliche Angebote öffnen"
        style={{
          position: "absolute",
          top: 14, left: "50%", transform: "translateX(-50%)", zIndex: 55,
          padding: "8px 14px 8px 10px",
          borderRadius: 999,
          background: bundleOpen
            ? "linear-gradient(135deg, rgba(255,45,120,0.95), rgba(255,215,0,0.95), rgba(255,107,74,0.95))"
            : "linear-gradient(135deg, rgba(255,107,74,0.95), rgba(255,215,0,0.9))",
          border: "1.5px solid rgba(255,255,255,0.35)",
          color: "#0F1115",
          cursor: "pointer",
          display: "flex", alignItems: "center", gap: 8,
          fontWeight: 900,
          animation: "ma365-deal-pulse-centered 2.2s ease-in-out infinite",
          overflow: "hidden",
        }}
      >
        {/* Shimmer */}
        <span style={{
          position: "absolute", top: 0, left: 0, width: "40%", height: "100%",
          background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%)",
          animation: "ma365-deal-shimmer 3.4s ease-in-out infinite",
          pointerEvents: "none",
        }} />

        <span style={{
          width: 26, height: 26, borderRadius: "50%",
          background: "rgba(15,17,21,0.75)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 15, flexShrink: 0, zIndex: 1,
        }}>🔥</span>

        {isMobile ? (
          <span style={{ display: "flex", alignItems: "center", gap: 4, zIndex: 1, fontSize: 12, fontWeight: 900 }}>
            {standardOpen.length}{bundleOpen ? "+🎁" : ""}
          </span>
        ) : (
          <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.1, zIndex: 1 }}>
            <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: 0.3 }}>
              {standardOpen.length} Deal{standardOpen.length === 1 ? "" : "s"} offen
              {bundleOpen && " + Bundle"}
            </span>
            <span style={{ fontSize: 9, opacity: 0.75, fontWeight: 700 }}>
              Reset in {countdown}
            </span>
          </span>
        )}

        {/* Dismiss */}
        <span
          role="button"
          aria-label="Für heute ausblenden"
          onClick={dismiss}
          style={{
            width: 18, height: 18, borderRadius: "50%",
            background: "rgba(15,17,21,0.55)", color: "#FFF",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 900, cursor: "pointer",
            marginLeft: 4, flexShrink: 0, zIndex: 1,
          }}
        >✕</span>
      </button>

      {openShop && (
        <ShopHubModal userId={userId} onClose={() => setOpenShop(false)} />
      )}
    </>
  );
}
