"use client";

import { useEffect, useState } from "react";

type March = {
  id: number;
  node_id: number;
  guardian_id: string | null;
  guardian_name?: string | null;
  troop_count: number;
  status: "marching" | "gathering" | "returning";
  started_at: string;
  arrives_at: string;
  finishes_at: string;
  returns_at: string;
  collected: number;
  node: {
    id: number;
    kind: "scrapyard" | "factory" | "atm" | "datacenter";
    resource_type: "wood" | "stone" | "gold" | "mana";
    name: string | null;
    lat: number;
    lng: number;
    level: number;
    total_yield?: number;
    current_yield?: number;
  } | null;
};

const KIND_EMOJI: Record<string, string> = {
  scrapyard: "⚙️", factory: "🔩", atm: "💸", datacenter: "📡",
};
const KIND_LABEL: Record<string, string> = {
  scrapyard: "Schrottplatz", factory: "Fabrik", atm: "ATM", datacenter: "Datacenter",
};

function fmtRemaining(ms: number): string {
  if (ms <= 0) return "0s";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m === 0) return `${sec}s`;
  if (m < 60) return `${m}m ${String(sec).padStart(2, "0")}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function ActiveMarchesBanner({ marches, onClose, onCancelled }: { marches: March[]; onClose?: () => void; onCancelled?: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const [collapsed, setCollapsed] = useState(false);
  const [cancelling, setCancelling] = useState<number | null>(null);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  async function recall(marchId: number) {
    if (cancelling != null) return;
    setCancelling(marchId);
    try {
      const r = await fetch("/api/gather/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ march_id: marchId }),
      });
      if (r.ok) onCancelled?.();
    } finally {
      setCancelling(null);
    }
  }

  if (marches.length === 0) return null;

  return (
    <div className="fixed top-3 right-3 sm:max-w-sm z-[900] pointer-events-auto">
      <div className="rounded-2xl bg-[#0F1115]/95 backdrop-blur border-2 border-[#FFD700]/50 shadow-2xl overflow-hidden">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-[#FFD700]/20 to-transparent text-left"
        >
          <span className="text-lg">⛏️</span>
          <span className="text-[11px] font-black tracking-widest text-[#FFD700] flex-1">
            {marches.length} PLÜNDERZUG{marches.length > 1 ? "ÜGE" : ""}
          </span>
          <span className="text-white/60 text-xs">{collapsed ? "▼" : "▲"}</span>
        </button>
        {!collapsed && (
          <div className="divide-y divide-white/5">
            {marches.map((m) => {
              const target =
                m.status === "marching" ? new Date(m.arrives_at).getTime() :
                m.status === "gathering" ? new Date(m.finishes_at).getTime() :
                new Date(m.returns_at).getTime();
              const remaining = target - now;
              const statusLabel =
                m.status === "marching" ? "🚶 Anmarsch" :
                m.status === "gathering" ? "⛏ Plündert" : "🏃 Rückkehr";
              const kind = m.node?.kind ?? "scrapyard";
              const total = m.status === "marching" ? new Date(m.arrives_at).getTime() - new Date(m.started_at).getTime()
                          : m.status === "gathering" ? new Date(m.finishes_at).getTime() - new Date(m.arrives_at).getTime()
                          : new Date(m.returns_at).getTime() - new Date(m.finishes_at).getTime();
              const elapsed = total - remaining;
              const pct = Math.max(0, Math.min(100, (elapsed / Math.max(1, total)) * 100));
              const gatherSeconds = Math.round((new Date(m.finishes_at).getTime() - new Date(m.arrives_at).getTime()) / 1000);
              // Live-Werte während des Plünderns: Pool runter, Collected hoch (linear interpoliert)
              const livePool = (() => {
                if (m.status !== "gathering" || m.node?.current_yield == null) return m.node?.current_yield ?? null;
                const arrives = new Date(m.arrives_at).getTime();
                const finishes = new Date(m.finishes_at).getTime();
                const elapsedFrac = Math.max(0, Math.min(1, (now - arrives) / Math.max(1, finishes - arrives)));
                // Annahme: User ist alleiniger Plünderer → Pool sinkt linear bis 0 wenn fertig
                const startPool = m.node.current_yield + m.collected; // Pool zum Ankunfts-Zeitpunkt
                return Math.max(0, Math.round(startPool * (1 - elapsedFrac)));
              })();
              const liveCollected = (() => {
                if (m.status !== "gathering") return m.collected;
                const arrives = new Date(m.arrives_at).getTime();
                const finishes = new Date(m.finishes_at).getTime();
                const elapsedFrac = Math.max(0, Math.min(1, (now - arrives) / Math.max(1, finishes - arrives)));
                const startPool = (m.node?.current_yield ?? 0) + m.collected;
                return Math.round(startPool * elapsedFrac);
              })();
              const flyToNode = () => {
                if (!m.node) return;
                window.dispatchEvent(new CustomEvent("ma365:fly-to-coords", {
                  detail: { lat: m.node.lat, lng: m.node.lng, zoom: 17 },
                }));
              };
              return (
                <div key={m.id} className="px-3 py-2">
                  <button onClick={flyToNode} className="w-full flex items-center gap-2 text-left hover:bg-white/5 -mx-1 px-1 py-0.5 rounded transition-colors">
                    <span className="text-xl">{KIND_EMOJI[kind]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-black text-white truncate">
                        {m.node?.name ?? KIND_LABEL[kind]} <span className="text-[#FFD700]">Lv {m.node?.level ?? "?"}</span>
                      </div>
                      <div className="text-[9px] text-[#a8b4cf]">{statusLabel} · {m.troop_count.toLocaleString("de-DE")} Banditen sind beteiligt</div>
                    </div>
                    <div className="text-[12px] font-black text-[#22D1C3] tabular-nums">{fmtRemaining(remaining)}</div>
                  </button>
                  {m.status === "marching" && gatherSeconds > 0 && (
                    <div className="text-[9px] text-[#a8b4cf] mt-0.5 ml-7">
                      Plünderzeit nach Ankunft: <span className="text-[#FFD700] font-bold">{fmtRemaining(gatherSeconds * 1000)}</span>
                    </div>
                  )}
                  <div className="mt-1.5 h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#FFD700] to-[#FF8C00]" style={{ width: `${pct.toFixed(1)}%` }} />
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px]">
                    {m.guardian_name && (
                      <div className="text-[#a8b4cf] truncate">
                        🛡 <span className="text-white font-bold">{m.guardian_name}</span>
                      </div>
                    )}
                    {livePool != null && (
                      <div className="text-[#a8b4cf] text-right">
                        Pool: <span className="text-[#FFD700] font-bold tabular-nums">{livePool.toLocaleString("de-DE")}</span>
                      </div>
                    )}
                    {liveCollected > 0 && (
                      <div className="text-[9px] text-[#FFD700] col-span-2">
                        +<span className="tabular-nums">{liveCollected.toLocaleString("de-DE")}</span> geplündert
                      </div>
                    )}
                  </div>
                  {(m.status === "marching" || m.status === "gathering") && (
                    <button
                      onClick={() => void recall(m.id)}
                      disabled={cancelling === m.id}
                      className="mt-1.5 w-full py-1 rounded text-[10px] font-black bg-[#FF2D78]/20 hover:bg-[#FF2D78]/30 text-[#FF6B8D] border border-[#FF2D78]/40 disabled:opacity-50"
                    >
                      {cancelling === m.id ? "…" : "↩ ZURÜCKRUFEN"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      {onClose && (
        <button onClick={onClose} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs">×</button>
      )}
    </div>
  );
}
