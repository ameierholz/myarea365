"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Live-Pace-HUD: schwebt während eines Walks oben und zeigt in Echtzeit
 * Distanz, Pace, Zeit, XP-Tick, Streak-Counter. Animiert auf Updates.
 */
export function LivePaceHud({
  distance,
  durationMs,
  xpGained,
  streak,
  walking,
  xpBoost,
}: {
  distance: number;       // meters
  durationMs: number;
  xpGained: number;
  streak: number;
  walking: boolean;
  xpBoost?: number;       // z.B. 2 = 2×
}) {
  const [pulseXp, setPulseXp] = useState(false);
  const [pulseKm, setPulseKm] = useState(false);
  const [lastXp, setLastXp] = useState(xpGained);
  const [lastKm, setLastKm] = useState(Math.floor(distance / 1000));

  // Animiere wenn sich XP oder km ändern
  useEffect(() => {
    if (xpGained !== lastXp) {
      setPulseXp(true);
      setLastXp(xpGained);
      const t = setTimeout(() => setPulseXp(false), 450);
      return () => clearTimeout(t);
    }
  }, [xpGained, lastXp]);

  useEffect(() => {
    const km = Math.floor(distance / 1000);
    if (km !== lastKm) {
      setPulseKm(true);
      setLastKm(km);
      const t = setTimeout(() => setPulseKm(false), 600);
      return () => clearTimeout(t);
    }
  }, [distance, lastKm]);

  const pace = useMemo(() => {
    if (distance < 20 || durationMs < 5000) return "—";
    const km = distance / 1000;
    const min = durationMs / 60000;
    const mpk = min / km;
    const m = Math.floor(mpk);
    const s = Math.floor((mpk - m) * 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, [distance, durationMs]);

  const time = useMemo(() => {
    const s = Math.floor(durationMs / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    if (m >= 60) {
      const h = Math.floor(m / 60);
      return `${h}:${(m % 60).toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
    }
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }, [durationMs]);

  if (!walking) return null;

  return (
    <div className="ma365-pace-hud">
      <div className={`ma365-pace-stat ${pulseKm ? "pulse" : ""}`}>
        <div className="ma365-pace-label">DISTANZ</div>
        <div className="ma365-pace-value">{(distance / 1000).toFixed(2)} <span className="unit">km</span></div>
      </div>
      <div className="ma365-pace-stat">
        <div className="ma365-pace-label">PACE</div>
        <div className="ma365-pace-value">{pace} <span className="unit">/km</span></div>
      </div>
      <div className="ma365-pace-stat">
        <div className="ma365-pace-label">ZEIT</div>
        <div className="ma365-pace-value">{time}</div>
      </div>
      <div className={`ma365-pace-stat xp ${pulseXp ? "pulse" : ""}`}>
        <div className="ma365-pace-label">
          🪙 {xpBoost && xpBoost > 1 ? <span className="boost">{xpBoost}×</span> : null}
        </div>
        <div className="ma365-pace-value gold">+{xpGained}</div>
      </div>
      {streak > 1 && (
        <div className="ma365-pace-streak">
          🔥 <span>{streak}</span>
        </div>
      )}
      <style>{`
        @keyframes ma365PacePulse {
          0%,100% { transform: scale(1); }
          50%     { transform: scale(1.12); color: #FFD700; }
        }
        @keyframes ma365PaceSlideIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ma365-pace-hud {
          position: absolute;
          top: 14px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 60;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 14px;
          background: rgba(18, 26, 46, 0.82);
          backdrop-filter: blur(16px) saturate(180%);
          -webkit-backdrop-filter: blur(16px) saturate(180%);
          border: 1px solid rgba(255,255,255,0.14);
          box-shadow: 0 4px 18px rgba(0,0,0,0.4);
          color: #FFF;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
          pointer-events: none;
          animation: ma365PaceSlideIn 0.25s ease-out;
          max-width: calc(100vw - 40px);
        }
        .ma365-pace-stat {
          display: flex; flex-direction: column; align-items: center; gap: 1px;
          padding: 0 6px;
          border-right: 1px solid rgba(255,255,255,0.12);
          min-width: 52px;
        }
        .ma365-pace-stat:last-of-type { border-right: none; }
        .ma365-pace-label {
          font-size: 8px; font-weight: 800; letter-spacing: 0.6px;
          color: #8B8FA3; text-transform: uppercase;
          display: inline-flex; align-items: center; gap: 3px;
        }
        .ma365-pace-label .boost {
          color: #FFD700; font-size: 9px; font-weight: 900;
          background: rgba(255,215,0,0.15); padding: 0 3px; border-radius: 4px;
          animation: ma365PacePulse 1s ease-in-out infinite;
        }
        .ma365-pace-value {
          font-size: 13px; font-weight: 900; line-height: 1;
          transition: transform 0.2s, color 0.2s;
        }
        .ma365-pace-value .unit { font-size: 9px; font-weight: 700; opacity: 0.6; }
        .ma365-pace-value.gold { color: #FFD700; text-shadow: 0 0 8px rgba(255,215,0,0.5); }
        .ma365-pace-stat.pulse .ma365-pace-value { animation: ma365PacePulse 0.4s ease-out; }
        .ma365-pace-stat.xp.pulse .ma365-pace-value { animation: ma365PacePulse 0.4s ease-out; }
        .ma365-pace-streak {
          display: inline-flex; align-items: center; gap: 3px;
          padding: 2px 6px 2px 4px;
          border-radius: 999px;
          background: linear-gradient(135deg, #FF6B4A, #FF2D78);
          font-size: 12px;
          font-weight: 900;
        }
        .ma365-pace-streak span { font-size: 11px; color: #FFF; text-shadow: 0 1px 2px rgba(0,0,0,0.5); }
      `}</style>
    </div>
  );
}
