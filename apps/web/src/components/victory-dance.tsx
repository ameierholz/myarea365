"use client";

import { useEffect, useState } from "react";

export function VictoryDance({ trigger, onDone }: { trigger: number; onDone?: () => void }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!trigger) return;
    setShow(true);
    const t = setTimeout(() => {
      setShow(false);
      onDone?.();
    }, 2600);
    return () => clearTimeout(t);
  }, [trigger]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!show) return null;

  const pieces = Array.from({ length: 36 });
  const colors = ["#FFD700", "#FF2D78", "#22D1C3", "#a855f7", "#FF6B4A", "#5ddaf0", "#4ade80"];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 5000, pointerEvents: "none",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        fontSize: 72, fontWeight: 900,
        background: "linear-gradient(135deg,#FFD700,#FF6B4A,#FF2D78)",
        WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
        WebkitTextFillColor: "transparent",
        filter: "drop-shadow(0 4px 20px rgba(255,215,0,0.6))",
        animation: "victoryPop 2.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}>
        VICTORY!
      </div>
      {pieces.map((_, i) => {
        const c = colors[i % colors.length];
        const left = 50 + (Math.random() - 0.5) * 80;
        const delay = Math.random() * 0.3;
        const dur = 1.6 + Math.random() * 0.8;
        const rot = Math.random() * 360;
        return (
          <div key={i} style={{
            position: "absolute", top: "50%", left: `${left}%`,
            width: 10, height: 14, background: c,
            borderRadius: 2,
            transform: `rotate(${rot}deg)`,
            animation: `confettiFall ${dur}s ${delay}s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`,
            opacity: 0,
          }} />
        );
      })}
      <style>{`
        @keyframes victoryPop {
          0% { transform: scale(0.3) rotate(-8deg); opacity: 0 }
          20% { transform: scale(1.25) rotate(3deg); opacity: 1 }
          40% { transform: scale(1) rotate(0deg); opacity: 1 }
          80% { transform: scale(1) rotate(0deg); opacity: 1 }
          100% { transform: scale(0.9) rotate(0deg); opacity: 0 }
        }
        @keyframes confettiFall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1 }
          100% { transform: translateY(80vh) rotate(720deg); opacity: 0 }
        }
      `}</style>
    </div>
  );
}
