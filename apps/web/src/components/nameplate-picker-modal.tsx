"use client";

import { useCallback, useEffect, useState } from "react";
import { useNameplateArt } from "@/components/resource-icon";
import { AdminArtworkControls } from "@/components/admin-artwork-controls";
import { buildNameplatePrompt } from "@/lib/artwork-prompts";

type Plate = {
  id: string;
  name: string;
  description: string;
  rarity: "common" | "advanced" | "epic" | "legendary";
  unlock_kind: "free" | "vip" | "coins" | "event" | "crew_level" | "achievement";
  unlock_value: number;
  preview_emoji: string;
  owned: boolean;
  equipped: boolean;
};

const RARITY_COLOR: Record<Plate["rarity"], string> = {
  common: "#9ba8c7", advanced: "#5ddaf0", epic: "#a855f7", legendary: "#FFD700",
};
const RARITY_LABEL: Record<Plate["rarity"], string> = {
  common: "Standard", advanced: "Fortgeschritten", epic: "Episch", legendary: "Legendär",
};

export function NameplatePickerModal({ onClose, isAdmin = false }: { onClose: () => void; isAdmin?: boolean }) {
  const [items, setItems] = useState<Plate[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const art = useNameplateArt();

  const load = useCallback(async () => {
    const r = await fetch("/api/nameplates", { cache: "no-store" });
    if (r.ok) setItems((await r.json() as { items: Plate[] }).items);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const action = async (id: string, kind: "equip" | "claim") => {
    setBusy(id);
    try {
      await fetch("/api/nameplates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: kind, nameplate_id: id }),
      });
      await load();
      if (kind === "equip") window.dispatchEvent(new CustomEvent("ma365:cosmetic-changed"));
    } finally { setBusy(null); }
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-[1100] bg-black/85 backdrop-blur-md flex items-center justify-center p-3">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl bg-[#1A1D23] border border-white/10 shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FFD700] to-[#FF2D78] flex items-center justify-center text-xl">🎀</div>
          <div className="flex-1">
            <div className="text-[9px] font-black tracking-[2px] text-[#8B8FA3]">COSMETIC</div>
            <div className="text-base font-black text-white">Namensschild</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 text-white text-base">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {items.map((p) => {
            const c = RARITY_COLOR[p.rarity];
            const a = art[p.id];
            return (
              <div key={p.id} className="flex flex-col gap-2 p-3 rounded-xl bg-black/40 border" style={{ borderColor: `${c}55` }}>
                {/* Banner-Preview wide 4:1 mit Runner-Name in der Mitte für Echtheits-Eindruck */}
                <div className="relative w-full mx-auto" style={{ maxWidth: 360, aspectRatio: "4 / 1", background: `linear-gradient(135deg, ${c}11, ${c}05)`, borderRadius: 6, border: `1px solid ${c}33`, overflow: "hidden" }}>
                  {a?.video_url ? (
                    <video src={a.video_url} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover" style={{ filter: "url(#ma365-chroma-black)" }} />
                  ) : a?.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ filter: "url(#ma365-chroma-black)" }} />
                  ) : (
                    // Fallback: Banner-shape mit großem Emoji
                    <div className="absolute inset-0 flex items-center justify-center" style={{ background: `linear-gradient(90deg, ${c}33, ${c}10, ${c}33)` }}>
                      <span style={{ fontSize: 26, opacity: 0.6 }}>{p.preview_emoji}</span>
                    </div>
                  )}
                  {/* Runner-Name-Overlay (mittig) — zeigt wie's später aussieht */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-white font-black" style={{ fontSize: 14, textShadow: "0 1px 4px rgba(0,0,0,0.85)", letterSpacing: 0.5 }}>
                      Runner-Name
                    </span>
                  </div>
                </div>

                {/* Header: Name + Rarity + Action */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-black text-white truncate">{p.name}</span>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded shrink-0" style={{ background: `${c}33`, color: c }}>{RARITY_LABEL[p.rarity]}</span>
                    </div>
                    <div className="text-[10px] text-[#a8b4cf] line-clamp-2 mt-0.5">{p.description}</div>
                  </div>
                  {p.equipped ? (
                    <span className="text-[10px] font-black px-3 py-2 rounded-lg shrink-0" style={{ background: "#22D1C322", color: "#22D1C3" }}>✓ AKTIV</span>
                  ) : p.owned ? (
                    <button disabled={busy === p.id} onClick={() => void action(p.id, "equip")}
                      className="text-[11px] font-black px-3 py-2 rounded-lg bg-[#22D1C3] text-[#0F1115] disabled:opacity-50 shrink-0">
                      Anlegen
                    </button>
                  ) : (
                    <button disabled={busy === p.id} onClick={() => void action(p.id, "claim")}
                      className="text-[10px] font-black px-3 py-2 rounded-lg bg-white/5 text-[#a8b4cf] border border-white/10 disabled:opacity-50 shrink-0">
                      {p.unlock_kind === "vip" ? `🔒 Premium ${p.unlock_value}` : p.unlock_kind === "event" ? "🎁 Event" : p.unlock_kind === "achievement" ? `🏆 ${p.unlock_value}` : "🔒"}
                    </button>
                  )}
                </div>

                {isAdmin && (
                  <AdminArtworkControls
                    targetType="nameplate"
                    targetId={p.id}
                    hasImage={!!a?.image_url}
                    hasVideo={!!a?.video_url}
                    buildPrompt={(mode) => buildNameplatePrompt({
                      id: p.id, name: p.name, description: p.description, rarity: p.rarity, mode,
                    })}
                    onUploaded={() => void load()}
                  />
                )}
              </div>
            );
          })}
          {items.length === 0 && <div className="text-[11px] text-center text-[#8B8FA3] py-12">Lade Namensschilder...</div>}
        </div>
      </div>
    </div>
  );
}
