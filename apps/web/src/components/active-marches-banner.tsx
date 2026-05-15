"use client";

import { useEffect, useState } from "react";
import { useResourceNodeArt } from "@/components/resource-icon";

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
  terrain_tag?: string | null;
  terrain_gather_mult?: number | null;
  terrain_speed_mult?: number | null;
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

const TERRAIN_EMOJI: Record<string, string> = {
  industrial: "🏭", residential: "🏘️", commercial: "🏪", park: "🌳",
  water: "💧", forest: "🌲", motorway: "🛣️", railway: "🚂",
  university: "🎓", hospital: "🏥", government: "🏛️", tourism: "🗿",
  warehouse: "📦",
};
const TERRAIN_LABEL: Record<string, string> = {
  industrial: "Industrie", residential: "Wohngebiet", commercial: "Gewerbe", park: "Park",
  water: "Wasser", forest: "Wald", motorway: "Autobahn", railway: "Bahn",
  university: "Uni", hospital: "Klinik", government: "Behörde", tourism: "Sehenswert",
  warehouse: "Lager",
};
// Erklärt dem Spieler WARUM ein Terrain-Bonus wirkt (Tooltip + Klick-Popover).
const TERRAIN_REASON: Record<string, string> = {
  industrial: "Industrie-Zone: dichte Fabriken & Schrott — Tech-Schrott & Komponenten sind reichlich vorhanden.",
  residential: "Wohngebiet: viele Haushalte, aber wenig industrieller Rohstoff — neutrale Erträge.",
  commercial: "Gewerbegebiet: viele Geschäfte — Krypto/Gold-Erträge steigen leicht.",
  park: "Park: kaum Beute, aber freie Wege — Sammler bewegen sich schneller.",
  water: "Wasser: blockiert direkten Zugang — Routen länger, Erträge gering.",
  forest: "Wald: Bewegung verlangsamt durch Unterholz.",
  motorway: "Autobahn: gerade & schnell — Marsch beschleunigt.",
  railway: "Bahntrasse: schneller Korridor — Marsch beschleunigt.",
  university: "Campus: Tech-Hub — Komponenten & Bandbreite besser ausbeutbar.",
  hospital: "Klinik-Zone: hohe Sicherheit — weniger Verluste, langsameres Plündern.",
  government: "Behördenviertel: streng bewacht — Erträge gedrosselt.",
  tourism: "Sehenswürdigkeit: Touristen-Hotspot — Krypto/Gold leicht erhöht.",
  warehouse: "Warenhaus-Cluster: Lagerhäuser & Logistik-Hubs — Beute deutlich erhöht.",
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
  const [openTerrain, setOpenTerrain] = useState<number | null>(null); // march-id whose terrain explainer is expanded
  const nodeArt = useResourceNodeArt();
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
    <div className="fixed top-16 right-3 sm:max-w-[300px] z-[900] pointer-events-auto">
      <div className="rounded-xl bg-[#0F1115]/65 backdrop-blur-md border border-[#FFD700]/35 shadow-2xl overflow-hidden">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center gap-1.5 px-2 py-1 bg-gradient-to-r from-[#FFD700]/20 to-transparent text-left"
        >
          <span className="text-sm">⛏️</span>
          <span className="text-[10px] font-black tracking-wide text-[#FFD700] flex-1">
            {marches.length} PLÜNDERZUG{marches.length > 1 ? "ÜGE" : ""}
          </span>
          <span className="text-white/60 text-[10px]">{collapsed ? "▼" : "▲"}</span>
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
              const kArt = nodeArt[kind];
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
              const totalDuration = total;
              return (
                <div key={m.id} className="px-2 py-1.5">
                  <button onClick={flyToNode} className="w-full flex items-center gap-1.5 text-left hover:bg-white/5 -mx-1 px-1 py-0.5 rounded transition-colors">
                    {kArt?.video_url ? (
                      <video src={kArt.video_url} autoPlay loop muted playsInline className="w-7 h-7 shrink-0 object-contain" style={{ filter: "url(#ma365-chroma-black)" }} />
                    ) : kArt?.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={kArt.image_url} alt={KIND_LABEL[kind]} className="w-7 h-7 shrink-0 object-contain" style={{ filter: "url(#ma365-chroma-black)" }} />
                    ) : (
                      <span className="text-base shrink-0">{KIND_EMOJI[kind]}</span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-black text-white truncate leading-tight">
                        {m.node?.name ?? KIND_LABEL[kind]} <span className="text-[#FFD700]">Lv {m.node?.level ?? "?"}</span>
                      </div>
                      <div className="text-[9px] text-[#a8b4cf] leading-tight">{statusLabel} · {m.troop_count.toLocaleString("de-DE")} Banditen</div>
                    </div>
                    <div className="text-[11px] font-black text-[#22D1C3] tabular-nums">{fmtRemaining(remaining)}</div>
                  </button>
                  {m.status === "marching" && gatherSeconds > 0 && (
                    <div className="text-[9px] text-[#a8b4cf] mt-0.5 ml-8 leading-tight">
                      Plünderzeit: <span className="text-[#FFD700] font-bold">{fmtRemaining(gatherSeconds * 1000)}</span>
                    </div>
                  )}
                  {(m.terrain_tag && m.terrain_tag !== "default") && (() => {
                    const gMult = m.terrain_gather_mult ?? 1;
                    const sMult = m.terrain_speed_mult ?? 1;
                    const gDelta = Math.round((gMult - 1) * 100);
                    const sDelta = Math.round((sMult - 1) * 100);
                    const sigG = Math.abs(gDelta) >= 5;
                    const sigS = Math.abs(sDelta) >= 5;
                    if (!sigG && !sigS) return null;
                    const reason = TERRAIN_REASON[m.terrain_tag] ?? `Terrain "${TERRAIN_LABEL[m.terrain_tag] ?? m.terrain_tag}" beeinflusst diesen Marsch.`;
                    const isOpen = openTerrain === m.id;
                    return (
                      <>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setOpenTerrain(isOpen ? null : m.id); }}
                          title={reason}
                          className="text-[9px] text-[#a8b4cf] mt-1 ml-8 inline-flex flex-wrap items-center gap-1 hover:text-white transition-colors"
                        >
                          <span>{TERRAIN_EMOJI[m.terrain_tag] ?? "📍"} {TERRAIN_LABEL[m.terrain_tag] ?? m.terrain_tag}</span>
                          {sigG && (
                            <span className={gDelta > 0 ? "text-[#4ade80] font-bold" : "text-[#FF6B8D] font-bold"}>
                              {gDelta > 0 ? "+" : ""}{gDelta}% Beute
                            </span>
                          )}
                          {sigS && (
                            <span className={sDelta > 0 ? "text-[#22D1C3] font-bold" : "text-[#FF6B8D] font-bold"}>
                              {sDelta > 0 ? "+" : ""}{sDelta}% Tempo
                            </span>
                          )}
                          <span className="text-[#a8b4cf]/60 text-[8px]">{isOpen ? "▾" : "▸ warum?"}</span>
                        </button>
                        {isOpen && (
                          <div className="mt-1 ml-8 mr-1 text-[9px] leading-snug text-white/85 bg-white/5 border border-white/10 rounded px-1.5 py-1">
                            {reason}
                          </div>
                        )}
                      </>
                    );
                  })()}
                  <div className="mt-1.5 relative h-2.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#FFD700] to-[#FF8C00]" style={{ width: `${pct.toFixed(1)}%` }} />
                    <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-white tabular-nums" style={{ textShadow: "0 0 3px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.6)" }}>
                      {fmtRemaining(Math.max(0, elapsed))} / {fmtRemaining(Math.max(1, totalDuration))}
                    </span>
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px]">
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
                      className="mt-1.5 w-full py-0.5 rounded text-[9px] font-black bg-[#FF2D78]/20 hover:bg-[#FF2D78]/30 text-[#FF6B8D] border border-[#FF2D78]/40 disabled:opacity-50"
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
