"use client";

import { useCallback, useEffect, useState } from "react";
import { WeatherActionHint } from "@/components/weather-action-hint";

type Injured = { troop_id: string; count: number };
type QueueRow = { id: string; troop_id: string; count: number; ends_at: string; finished: boolean };
type Catalog = { id: string; name: string; emoji: string; troop_class: string; tier: number };

const MODAL_BG = "linear-gradient(180deg, #1a0e1a 0%, #0F1115 100%)";
const ACCENT = "#FF2D78";
const TEAL = "#22D1C3";

function fmtMin(seconds: number): string {
  if (seconds <= 0) return "fertig";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }
  return m > 0 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
}

export function HospitalModal({ catalog, onClose }: { catalog: Catalog[]; onClose: () => void }) {
  const [injured, setInjured] = useState<Injured[]>([]);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [cap, setCap] = useState<number>(50);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    const r = await fetch("/api/heal", { cache: "no-store" });
    const j = await r.json() as { ok: boolean; injured: Injured[]; queue: QueueRow[]; cap: number };
    if (j.ok) {
      setInjured(j.injured);
      setQueue(j.queue);
      setCap(j.cap);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);

  async function startHeal(troopId: string) {
    const c = counts[troopId] ?? 0;
    if (c <= 0) return;
    setBusy(troopId); setMsg(null);
    try {
      const r = await fetch("/api/heal", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ troop_id: troopId, count: c }),
      });
      const j = await r.json() as { ok?: boolean; error?: string; seconds?: number };
      if (j.ok) {
        setMsg(`✓ ${c} Truppen in Behandlung (${fmtMin(j.seconds ?? 0)})`);
        setCounts((s) => ({ ...s, [troopId]: 0 }));
        await load();
      } else if (j.error === "hospital_full") setMsg("⚠ Lazarett voll — warte oder baue Lazarett aus.");
      else if (j.error === "not_enough_injured") setMsg("⚠ So viele Verletzte hast du nicht.");
      else setMsg(`⚠ ${j.error ?? "Fehler"}`);
    } finally { setBusy(null); }
  }

  const queueTotal = queue.reduce((s, q) => s + q.count, 0);
  const injuredTotal = injured.reduce((s, i) => s + i.count, 0);
  const capUsed = queueTotal;
  const capPct = Math.min(100, (capUsed / Math.max(1, cap)) * 100);

  return (
    <div onClick={onClose} className="fixed inset-0 z-[9400] bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-2 sm:p-4">
      <div onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-dvh"
        style={{ background: MODAL_BG }}>
        <button onClick={onClose} aria-label="Schließen"
          className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-black/50 text-white text-lg font-black backdrop-blur">×</button>

        <div className="px-4 py-3 border-b border-white/10">
          <h2 className="text-lg font-black text-white tracking-wide">🏥 LAZARETT</h2>
          <div className="text-[10px] text-white/60">Verletzte Truppen heilen statt verlieren — schneller & billiger als neu trainieren.</div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-black/50 overflow-hidden">
              <div className="h-full transition-all" style={{ width: `${capPct}%`, background: capPct > 90 ? ACCENT : TEAL }} />
            </div>
            <div className="text-[10px] font-black text-white/80">{capUsed}/{cap}</div>
          </div>
        </div>

        {msg && <div className="px-4 py-2 text-[11px] font-black" style={{ color: msg.startsWith("✓") ? "#4ade80" : ACCENT, background: msg.startsWith("✓") ? "rgba(74,222,128,0.1)" : "rgba(255,45,120,0.1)" }}>{msg}</div>}

        <div className="overflow-y-auto flex-1 p-4 space-y-3 ma365-no-scrollbar" style={{ scrollbarWidth: "none" }}>
          <style>{`.ma365-no-scrollbar::-webkit-scrollbar{display:none}`}</style>

          {/* Wetter+Tageszeit auf Heilzeit */}
          <WeatherActionHint lever="heal" />

          {/* Aktive Heilung */}
          {queue.length > 0 && (
            <div>
              <div className="text-[10px] font-black tracking-widest text-[#a8b4cf] mb-2">IN BEHANDLUNG ({queue.length})</div>
              <div className="space-y-1.5">
                {queue.map((q) => {
                  const tr = catalog.find((x) => x.id === q.troop_id);
                  const remain = Math.max(0, Math.ceil((new Date(q.ends_at).getTime() - now) / 1000));
                  const total = Math.max(1, Math.ceil((new Date(q.ends_at).getTime() - new Date(q.ends_at).getTime() + remain * 1000) / 1000));
                  const pct = Math.max(0, Math.min(100, ((total - remain) / total) * 100));
                  return (
                    <div key={q.id} className="rounded-lg bg-black/40 border border-white/10 p-2">
                      <div className="flex justify-between text-[11px] text-white">
                        <span>{tr?.emoji ?? "❓"} {tr?.name ?? q.troop_id} × {q.count}</span>
                        <span className="text-[#a8b4cf]">{fmtMin(remain)}</span>
                      </div>
                      <div className="mt-1 h-1 rounded-full bg-black/50 overflow-hidden">
                        <div className="h-full" style={{ width: `${pct}%`, background: TEAL }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Verletzte Liste */}
          <div>
            <div className="text-[10px] font-black tracking-widest text-[#a8b4cf] mb-2">VERLETZTE TRUPPEN ({injuredTotal})</div>
            {injured.length === 0 ? (
              <div className="text-[11px] text-[#a8b4cf] text-center py-8 rounded-lg bg-black/30 border border-white/5">
                Keine verletzten Truppen — gewinne erstmal einen Kampf 😉
              </div>
            ) : (
              <div className="space-y-1.5">
                {injured.map((i) => {
                  const tr = catalog.find((x) => x.id === i.troop_id);
                  const v = counts[i.troop_id] ?? 0;
                  const max = Math.min(i.count, Math.max(0, cap - capUsed));
                  return (
                    <div key={i.troop_id} className="rounded-lg bg-black/40 border border-white/10 p-2">
                      <div className="flex justify-between items-center text-[11px] text-white mb-1.5">
                        <span>{tr?.emoji ?? "❓"} <b>{tr?.name ?? i.troop_id}</b> <span className="text-[#a8b4cf] font-normal">T{tr?.tier ?? "?"}</span></span>
                        <span className="text-[#FFD700] font-black">{i.count.toLocaleString("de-DE")}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="range" min={0} max={Math.max(1, max)} value={Math.min(v, max)}
                          onChange={(e) => setCounts((s) => ({ ...s, [i.troop_id]: parseInt(e.target.value) }))}
                          className="flex-1 accent-[#22D1C3]" disabled={max <= 0} />
                        <input type="number" min={0} max={max} value={v}
                          onChange={(e) => setCounts((s) => ({ ...s, [i.troop_id]: Math.max(0, Math.min(max, parseInt(e.target.value) || 0)) }))}
                          className="w-20 text-right px-2 py-1 rounded bg-black/50 border border-white/15 text-white text-[12px] font-black" />
                        <button onClick={() => void startHeal(i.troop_id)} disabled={busy === i.troop_id || v <= 0 || v > max}
                          className="px-3 py-1.5 rounded font-black text-[10px] disabled:opacity-40"
                          style={{ background: TEAL, color: "#0F1115" }}>
                          {busy === i.troop_id ? "…" : "HEILEN"}
                        </button>
                      </div>
                      <div className="flex justify-between text-[9px] text-white/50 mt-1">
                        <button onClick={() => setCounts((s) => ({ ...s, [i.troop_id]: max }))}>Max ({max})</button>
                        <button onClick={() => setCounts((s) => ({ ...s, [i.troop_id]: Math.floor(max / 2) }))}>½</button>
                        <button onClick={() => setCounts((s) => ({ ...s, [i.troop_id]: 0 }))}>0</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="text-[9px] text-[#6c7590] text-center pt-2">
            Lazarett-Cap = 50 + 50 × Lv. Baue es im <b>Bauen-Tab</b> aus für mehr Plätze.
          </div>
        </div>
      </div>
    </div>
  );
}
