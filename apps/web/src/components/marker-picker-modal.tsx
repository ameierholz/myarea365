"use client";

import { useEffect, useState } from "react";
import { UNLOCKABLE_MARKERS } from "@/lib/game-config";
import { AdminArtworkControls } from "@/components/admin-artwork-controls";
import { buildMarkerPrompt } from "@/lib/artwork-prompts";

const PRIMARY = "#5ddaf0";

type Art = { image_url: string | null; video_url: string | null };

export function MarkerPickerModal({
  userXp, currentId, onPick, onClose, isAdmin = false,
}: {
  userXp: number;
  currentId: string;
  onPick: (id: string) => void;
  onClose: () => void;
  isAdmin?: boolean;
}) {
  const [artMap, setArtMap] = useState<Record<string, Art>>({});
  async function loadArt() {
    try {
      const res = await fetch("/api/cosmetic-artwork");
      if (res.ok) {
        const j = await res.json() as { marker: Record<string, Art> };
        setArtMap(j.marker ?? {});
      }
    } catch {}
  }
  useEffect(() => { loadArt(); }, []);

  const unlockedCount = UNLOCKABLE_MARKERS.filter(m => isAdmin || m.cost <= userXp).length;

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 3700,
      background: "rgba(15,17,21,0.92)", backdropFilter: "blur(14px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 12,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 760, maxHeight: "92vh",
        display: "flex", flexDirection: "column",
        background: "#1A1D23", borderRadius: 20,
        border: `1px solid ${PRIMARY}66`,
        boxShadow: `0 0 40px ${PRIMARY}33`,
        color: "#F0F0F0", overflow: "hidden",
      }}>
        <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: PRIMARY, fontSize: 9, fontWeight: 900, letterSpacing: 2 }}>MAP-ICON WÄHLEN</div>
            <div style={{ color: "#FFF", fontSize: 16, fontWeight: 900 }}>
              {unlockedCount} / {UNLOCKABLE_MARKERS.length} freigeschaltet
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#8B8FA3", fontSize: 22, cursor: "pointer", width: 32, height: 32 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${isAdmin ? 130 : 96}px, 1fr))`, gap: 8 }}>
            {UNLOCKABLE_MARKERS.map((m) => {
              const unlocked = isAdmin || userXp >= m.cost;
              const active = m.id === currentId;
              const art = artMap[m.id];
              const hasArt = !!(art?.image_url || art?.video_url);
              return (
                <div key={m.id} style={{
                  display: "flex", flexDirection: "column", alignItems: "stretch",
                  padding: 10, borderRadius: 14,
                  background: active ? `${PRIMARY}15` : "rgba(70,82,122,0.35)",
                  border: active ? `2px solid ${PRIMARY}` : "1px solid rgba(255,255,255,0.08)",
                  boxShadow: active ? `0 0 20px ${PRIMARY}55` : "none",
                }}>
                  <button onClick={() => { if (unlocked && !active) { onPick(m.id); onClose(); } }}
                    disabled={!unlocked || active}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center",
                      background: "none", border: "none", color: "#FFF",
                      cursor: unlocked && !active ? "pointer" : "default", padding: 0,
                    }}>
                    <div style={{ width: 64, height: 64, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 6, opacity: unlocked ? 1 : 0.25 }}>
                      {art?.video_url ? (
                        <video src={art.video_url} autoPlay loop muted playsInline style={{ width: 64, height: 64, objectFit: "contain" }} />
                      ) : art?.image_url ? (
                        <img src={art.image_url} alt={m.name} style={{ width: 64, height: 64, objectFit: "contain" }} />
                      ) : (
                        <span style={{ fontSize: 34 }}>{m.icon}</span>
                      )}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 800, marginBottom: 3 }}>{m.name}</span>
                    {active
                      ? <span style={{ fontSize: 9, fontWeight: 900, color: PRIMARY }}>✓ AKTIV</span>
                      : unlocked
                        ? <span style={{ fontSize: 9, fontWeight: 800, color: "#4ade80" }}>Wählen</span>
                        : <span style={{ fontSize: 9, fontWeight: 800, color: "#FFD700" }}>🔒 {m.cost >= 1000 ? `${m.cost/1000}k` : m.cost} XP</span>
                    }
                    {isAdmin && !hasArt && (
                      <span style={{ fontSize: 7, fontWeight: 900, color: "#FF2D78", marginTop: 2 }}>KEIN ARTWORK</span>
                    )}
                  </button>
                  {isAdmin && (
                    <AdminArtworkControls
                      targetType="marker"
                      targetId={m.id}
                      hasImage={!!art?.image_url}
                      hasVideo={!!art?.video_url}
                      buildPrompt={(mode) => buildMarkerPrompt({ name: m.name, hint: m.icon, mode })}
                      onUploaded={loadArt}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
