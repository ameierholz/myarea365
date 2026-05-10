"use client";

import { useEffect, useState } from "react";
import { setVisibilityAwareInterval } from "@/lib/visibility-interval";

type Siege = {
  stronghold_id: string;
  lat: number; lng: number;
  level: number;
  npc_id: string | null;
  city_slug: string | null;
  hp_pct: number;
  last_damage_at: string;
  damage_last_hour: number;
  attacker_crews: number;
  distance_km: number;
};

const ACCENT = "#FF2D78";
const PRIMARY = "#22D1C3";

/**
 * Live-Banner: zeigt Wegelager in 10km Umkreis die GERADE belagert werden.
 * Refresh alle 30s (nur bei sichtbarem Tab). Klick öffnet das Stronghold-Modal.
 */
export function ActiveSiegeBanner({
  userCenter,
  onClickSiege,
}: {
  userCenter: { lat: number; lng: number } | null;
  onClickSiege?: (strongholdId: string) => void;
}) {
  const [sieges, setSieges] = useState<Siege[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!userCenter) return;
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(`/api/strongholds/active-sieges?lat=${userCenter.lat}&lng=${userCenter.lng}&radius_km=10`, { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json() as { ok?: boolean; sieges?: Siege[] };
        if (!cancelled && j.ok) setSieges(j.sieges ?? []);
      } catch { /* ignore */ }
    };
    void load();
    const stop = setVisibilityAwareInterval(load, 30_000);
    return () => { cancelled = true; stop(); };
  }, [userCenter]);

  if (sieges.length === 0) return null;

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        style={{
          position: "fixed", left: 8, bottom: 76, zIndex: 600,
          padding: "6px 10px", borderRadius: 999,
          background: `linear-gradient(135deg, ${ACCENT}, #cc2160)`,
          color: "#FFF", fontSize: 11, fontWeight: 800,
          border: "none", cursor: "pointer",
          boxShadow: `0 0 16px ${ACCENT}66`,
        }}
        aria-label="Aktive Belagerungen einblenden"
      >
        ⚔️ {sieges.length} Belagerung{sieges.length === 1 ? "" : "en"}
      </button>
    );
  }

  return (
    <div style={{
      position: "fixed", left: 8, right: 8, bottom: 76, zIndex: 600,
      padding: "8px 10px", borderRadius: 12,
      background: "linear-gradient(135deg, rgba(255,45,120,0.18), rgba(34,209,195,0.10))",
      border: `1px solid ${ACCENT}66`,
      backdropFilter: "blur(8px)",
      boxShadow: `0 4px 16px ${ACCENT}33`,
      maxWidth: 460, margin: "0 auto",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#FFF", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            width: 8, height: 8, borderRadius: 999, background: ACCENT,
            boxShadow: `0 0 8px ${ACCENT}`, animation: "ma365-pulse 1.4s ease-in-out infinite",
          }} />
          ⚔️ Belagerungen in der Nähe
        </div>
        <button
          onClick={() => setCollapsed(true)}
          aria-label="Banner einklappen"
          style={{
            padding: "2px 8px", fontSize: 10,
            background: "rgba(255,255,255,0.08)", color: "#a8b4cf",
            border: "none", borderRadius: 6, cursor: "pointer",
          }}
        >×</button>
      </div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "thin" }}>
        {sieges.slice(0, 5).map((s) => (
          <button
            key={s.stronghold_id}
            onClick={() => onClickSiege?.(s.stronghold_id)}
            style={{
              flex: "0 0 auto",
              padding: "6px 10px", borderRadius: 10,
              background: "rgba(0,0,0,0.35)",
              border: `1px solid ${PRIMARY}55`,
              color: "#FFF", fontSize: 10,
              cursor: "pointer", textAlign: "left",
            }}
          >
            <div style={{ fontWeight: 800 }}>Lv {s.level} · {s.distance_km}km</div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
              <div style={{
                width: 50, height: 4, borderRadius: 2,
                background: "rgba(255,255,255,0.1)", overflow: "hidden",
              }}>
                <div style={{
                  width: `${s.hp_pct}%`, height: "100%",
                  background: s.hp_pct < 30 ? ACCENT : s.hp_pct < 60 ? "#FFA64A" : PRIMARY,
                }} />
              </div>
              <span style={{ color: "#a8b4cf", fontSize: 9 }}>{s.hp_pct}%</span>
            </div>
            <div style={{ color: "#a8b4cf", fontSize: 9, marginTop: 2 }}>
              {s.attacker_crews} Crew{s.attacker_crews === 1 ? "" : "s"}
            </div>
          </button>
        ))}
      </div>
      <style jsx>{`
        @keyframes ma365-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}
