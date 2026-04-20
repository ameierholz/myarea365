"use client";

import { RUNNER_LIGHTS } from "@/lib/game-config";

const PRIMARY = "#5ddaf0";

export function LightPickerModal({
  userXp, currentId, onPick, onClose,
}: {
  userXp: number;
  currentId: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const unlockedCount = RUNNER_LIGHTS.filter(l => l.cost <= userXp).length;

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 3700,
      background: "rgba(15,17,21,0.92)", backdropFilter: "blur(14px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 12,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 640, maxHeight: "92vh",
        display: "flex", flexDirection: "column",
        background: "#1A1D23", borderRadius: 20,
        border: `1px solid ${PRIMARY}66`,
        boxShadow: `0 0 40px ${PRIMARY}33`,
        color: "#F0F0F0", overflow: "hidden",
      }}>
        <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: PRIMARY, fontSize: 9, fontWeight: 900, letterSpacing: 2 }}>RUNNER-LIGHT WÄHLEN</div>
            <div style={{ color: "#FFF", fontSize: 16, fontWeight: 900 }}>
              {unlockedCount} / {RUNNER_LIGHTS.length} freigeschaltet
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#8B8FA3", fontSize: 22, cursor: "pointer", width: 32, height: 32 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8 }}>
            {RUNNER_LIGHTS.map((l) => {
              const unlocked = userXp >= l.cost;
              const active = l.id === currentId;
              const gradientCss = l.gradient.length > 1
                ? `linear-gradient(90deg, ${l.gradient.join(", ")})`
                : l.color;
              return (
                <button key={l.id} onClick={() => { if (unlocked && !active) { onPick(l.id); onClose(); } }}
                  disabled={!unlocked || active}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    padding: 12, borderRadius: 14,
                    background: active ? `${PRIMARY}15` : "rgba(70,82,122,0.35)",
                    border: active ? `2px solid ${PRIMARY}` : "1px solid rgba(255,255,255,0.08)",
                    boxShadow: active ? `0 0 20px ${PRIMARY}55` : "none",
                    color: "#FFF", cursor: unlocked && !active ? "pointer" : "default",
                  }}>
                  <div style={{
                    width: 70, height: l.width,
                    borderRadius: l.width / 2,
                    background: gradientCss,
                    opacity: unlocked ? 1 : 0.3,
                    marginBottom: 10, marginTop: 6,
                    boxShadow: unlocked ? `0 0 14px ${l.color}80` : "none",
                  }} />
                  <span style={{ fontSize: 11, fontWeight: 800, marginBottom: 3 }}>{l.name}</span>
                  {active
                    ? <span style={{ fontSize: 9, fontWeight: 900, color: PRIMARY }}>✓ AKTIV</span>
                    : unlocked
                      ? <span style={{ fontSize: 9, fontWeight: 800, color: "#4ade80" }}>Wählen</span>
                      : <span style={{ fontSize: 9, fontWeight: 800, color: "#FFD700" }}>🔒 {l.cost >= 1000 ? `${l.cost/1000}k` : l.cost} XP</span>
                  }
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
