"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminArtworkControls } from "@/components/admin-artwork-controls";
import { buildBaseRingPrompt } from "@/lib/artwork-prompts";

type Ring = {
  id: string;
  name: string;
  description: string;
  rarity: "common" | "advanced" | "epic" | "legendary";
  unlock_kind: "free" | "vip" | "coins" | "event" | "crew_level" | "achievement";
  unlock_value: number;
  preview_emoji: string;
  preview_color: string;
  owned: boolean;
  equipped: boolean;
};

const PRIMARY = "#5ddaf0";
const RARITY_COLOR: Record<Ring["rarity"], string> = {
  common: "#9ba8c7", advanced: "#5ddaf0", epic: "#a855f7", legendary: "#FFD700",
};
const RARITY_LABEL: Record<Ring["rarity"], string> = {
  common: "Standard", advanced: "Fortgeschritten", epic: "Episch", legendary: "Legendär",
};

type Art = { image_url: string | null; video_url: string | null };

export function BaseRingPickerModal({
  isAdmin = false,
  onClose,
  onChanged,
}: {
  isAdmin?: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [items, setItems] = useState<Ring[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [artMap, setArtMap] = useState<Record<string, Art>>({});

  const load = useCallback(async () => {
    const [r, a] = await Promise.all([
      fetch("/api/base/ring", { cache: "no-store" }),
      fetch("/api/cosmetic-artwork", { cache: "no-store" }),
    ]);
    if (r.ok) setItems((await r.json() as { items: Ring[] }).items);
    if (a.ok) setArtMap(((await a.json() as { base_ring?: Record<string, Art> }).base_ring) ?? {});
  }, []);
  useEffect(() => { void load(); }, [load]);

  const action = async (id: string, kind: "equip" | "claim") => {
    setBusy(id);
    try {
      await fetch("/api/base/ring", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: kind, ring_id: id }),
      });
      await load();
      onChanged?.();
    } finally { setBusy(null); }
  };

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
            <div style={{ color: PRIMARY, fontSize: 9, fontWeight: 900, letterSpacing: 2 }}>BASE-RING</div>
            <div style={{ color: "#FFF", fontSize: 16, fontWeight: 900 }}>
              Base-Ring wählen ({items.filter((r) => r.owned).length} / {items.length})
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#8B8FA3", fontSize: 22, cursor: "pointer", width: 32, height: 32 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${isAdmin ? 160 : 130}px, 1fr))`, gap: 8 }}>
            {items.map((r) => {
              const art = artMap[r.id];
              const hasArt = !!(art?.image_url || art?.video_url);
              const rColor = RARITY_COLOR[r.rarity];
              return (
                <div key={r.id} style={{
                  display: "flex", flexDirection: "column", alignItems: "stretch",
                  padding: 10, borderRadius: 14,
                  background: r.equipped ? `${rColor}22` : "rgba(70,82,122,0.35)",
                  border: r.equipped ? `2px solid ${rColor}` : "1px solid rgba(255,255,255,0.08)",
                  boxShadow: r.equipped ? `0 0 22px ${rColor}55` : "none",
                  opacity: r.owned ? 1 : 0.6,
                }}>
                  <button
                    onClick={() => { if (r.owned && !r.equipped) action(r.id, "equip"); else if (!r.owned && r.unlock_kind === "free") action(r.id, "claim"); }}
                    disabled={busy === r.id || r.equipped || (!r.owned && r.unlock_kind !== "free")}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center",
                      background: "none", border: "none", color: "#FFF",
                      cursor: r.equipped ? "default" : (r.owned || r.unlock_kind === "free" ? "pointer" : "not-allowed"),
                      padding: 0,
                    }}>
                    <div style={{ width: 84, height: 84, marginBottom: 6, position: "relative" }}>
                      {art?.video_url ? (
                        <video src={art.video_url} autoPlay loop muted playsInline style={{ width: 84, height: 84, objectFit: "contain", filter: "url(#ma365-chroma-black)" }} />
                      ) : art?.image_url ? (
                        <img src={art.image_url} alt={r.name} style={{ width: 84, height: 84, objectFit: "contain", filter: "url(#ma365-chroma-black)" }} />
                      ) : (
                        // Fallback: gezeichneter Donut mit Emoji in Mitte
                        <div style={{
                          width: 84, height: 84, borderRadius: "50%",
                          border: `5px solid ${rColor}`,
                          boxShadow: `0 0 18px ${rColor}88, inset 0 0 12px ${rColor}55`,
                          background: "rgba(15,17,21,0.5)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 32,
                        }}>{r.preview_emoji}</div>
                      )}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 900 }}>{r.name}</span>
                    <span style={{ fontSize: 8, color: rColor, fontWeight: 900, marginTop: 2 }}>{RARITY_LABEL[r.rarity]}</span>
                    <span style={{ fontSize: 9, color: "#a8b4cf", textAlign: "center", marginTop: 3, lineHeight: 1.3 }}>{r.description}</span>
                    <div style={{ marginTop: 6 }}>
                      {r.equipped
                        ? <span style={{ fontSize: 9, fontWeight: 900, color: rColor }}>✓ AKTIV</span>
                        : r.owned
                          ? <span style={{ fontSize: 9, fontWeight: 800, color: "#4ade80" }}>Wählen</span>
                          : <span style={{ fontSize: 9, fontWeight: 800, color: "#FFD700" }}>
                              {r.unlock_kind === "vip" ? `VIP ${r.unlock_value}` :
                               r.unlock_kind === "event" ? "Event" :
                               r.unlock_kind === "achievement" ? `Achievement ${r.unlock_value}` :
                               "🔒"}
                            </span>}
                    </div>
                    {isAdmin && !hasArt && (
                      <span style={{ fontSize: 7, fontWeight: 900, color: "#FF2D78", marginTop: 2 }}>KEIN ARTWORK</span>
                    )}
                  </button>
                  {isAdmin && (
                    <AdminArtworkControls
                      targetType="base_ring"
                      targetId={r.id}
                      hasImage={!!art?.image_url}
                      hasVideo={!!art?.video_url}
                      buildPrompt={(mode) => buildBaseRingPrompt({
                        id: r.id, name: r.name, description: r.description,
                        color: r.preview_color, rarity: r.rarity, mode,
                      })}
                      onUploaded={load}
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
