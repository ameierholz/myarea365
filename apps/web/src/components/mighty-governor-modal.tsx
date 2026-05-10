"use client";

import { useCallback, useEffect, useState } from "react";

type Task = { task_id: string; task_kind: string; task_label: string; target: number; points: number; progress: number; completed: boolean };
type Reward = { threshold: number; rewards: Record<string, number>; claimed: boolean };
type Status = {
  ok: boolean;
  season: { id: string; name: string; starts_at: string; ends_at: string; day: number; total_days: number } | null;
  total_points: number;
  today_points: number;
  today_tasks: Task[];
  rewards: Reward[];
  next_unlock?: { threshold: number; rewards: Record<string, number> } | null;
};

const MODAL_BG = "linear-gradient(180deg, #1a140e 0%, #0F1115 100%)";
const GOLD = "#FFD700";
const TEAL = "#22D1C3";
const ACCENT = "#FF2D78";

const RES_LABEL: Record<string, string> = {
  gems: "💎 Diamanten",
  speed_tokens: "⚡ Speedup",
  wood: "⚙️ Tech-Schrott",
  stone: "🔩 Komponenten",
  gold: "💸 Krypto",
  mana: "📡 Bandbreite",
  vip_points: "⭐ VIP-Punkte",
  guardian_xp: "🛡 Wächter-XP",
};

export function MightyGovernorModal({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<Status | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    const r = await fetch("/api/mighty-governor", { cache: "no-store" });
    setData(await r.json());
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(id); }, []);

  async function claim(threshold: number) {
    setBusy(threshold); setMsg(null);
    try {
      const r = await fetch("/api/mighty-governor", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "claim", threshold }),
      });
      const j = await r.json() as { ok?: boolean; error?: string };
      if (j.ok) { setMsg(`✓ Belohnung Stufe ${threshold} eingelöst!`); await load(); }
      else if (j.error === "not_enough_points") setMsg("⚠ Noch nicht genug Punkte.");
      else if (j.error === "already_claimed") setMsg("ℹ Schon eingelöst.");
      else setMsg(`⚠ ${j.error ?? "Fehler"}`);
    } finally { setBusy(null); }
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-[9400] bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-2 sm:p-4">
      <div onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[96vh]"
        style={{ background: MODAL_BG }}>
        <button onClick={onClose} aria-label="Schließen"
          className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-black/50 text-white text-lg font-black backdrop-blur">×</button>

        <div className="px-4 py-3 border-b border-white/10">
          <h2 className="text-lg font-black text-white tracking-wide">👑 GOUVERNEUR-EVENT</h2>
          <div className="text-[10px] text-white/60">28-Tage-Event · Tagesaufgaben → Stufenbelohnungen sammeln</div>
        </div>

        {msg && <div className="px-4 py-2 text-[11px] font-black" style={{ color: msg.startsWith("✓") ? "#4ade80" : ACCENT }}>{msg}</div>}

        {!data && <div className="p-6 text-[11px] text-white/60 text-center">Lade…</div>}
        {data && !data.season && (
          <div className="p-8 text-center">
            <div className="text-4xl mb-2">🌙</div>
            <div className="text-[12px] text-white font-black mb-1">Aktuell läuft keine Saison.</div>
            <div className="text-[10px] text-white/60">Die nächste Gouverneur-Saison startet bald — Augen auf!</div>
          </div>
        )}

        {data?.season && (
          <div className="overflow-y-auto flex-1 ma365-no-scrollbar" style={{ scrollbarWidth: "none" }}>
            <style>{`.ma365-no-scrollbar::-webkit-scrollbar{display:none}`}</style>

            {/* Header */}
            <div className="px-4 py-3 border-b border-white/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black text-white">{data.season.name}</span>
                <span className="text-[10px] text-white/60">Tag {data.season.day}/{data.season.total_days}</span>
              </div>
              <div className="h-2 rounded-full bg-black/50 overflow-hidden mb-3">
                <div className="h-full" style={{ width: `${(data.season.day / data.season.total_days) * 100}%`, background: GOLD }} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-black/40 border border-white/10 p-2 text-center">
                  <div className="text-[9px] text-white/60">Saison-Punkte</div>
                  <div className="text-xl font-black" style={{ color: GOLD }}>{data.total_points.toLocaleString("de-DE")}</div>
                </div>
                <div className="rounded-lg bg-black/40 border border-white/10 p-2 text-center">
                  <div className="text-[9px] text-white/60">Heute</div>
                  <div className="text-xl font-black" style={{ color: TEAL }}>+{data.today_points}</div>
                </div>
              </div>
            </div>

            {/* Heutige Aufgaben */}
            <div className="px-4 py-3 border-b border-white/5">
              <div className="text-[10px] font-black tracking-widest text-[#a8b4cf] mb-2">HEUTE · {data.today_tasks.length} AUFGABEN</div>
              {data.today_tasks.length === 0 ? (
                <div className="text-[11px] text-white/60 text-center py-3">Heute sind alle Aufgaben erledigt 🎉</div>
              ) : (
                <div className="space-y-1.5">
                  {data.today_tasks.map((t) => {
                    const pct = Math.min(100, (t.progress / Math.max(1, t.target)) * 100);
                    return (
                      <div key={t.task_id} className="rounded-lg bg-black/40 border border-white/10 p-2">
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-white">{t.task_label}</span>
                          <span className="text-[#FFD700] font-black">+{t.points} pts</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-black/50 overflow-hidden">
                          <div className="h-full" style={{ width: `${pct}%`, background: t.completed ? "#4ade80" : TEAL }} />
                        </div>
                        <div className="text-[9px] text-white/60 mt-1">{t.progress}/{t.target}{t.completed ? " · ✓ erledigt" : ""}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Belohnungs-Stufen */}
            <div className="px-4 py-3">
              <div className="text-[10px] font-black tracking-widest text-[#a8b4cf] mb-2">BELOHNUNGS-STUFEN</div>
              <div className="space-y-1.5">
                {data.rewards.map((r) => {
                  const unlocked = data.total_points >= r.threshold;
                  return (
                    <div key={r.threshold} className="rounded-lg p-2 flex items-center justify-between"
                      style={{
                        background: r.claimed ? "rgba(74,222,128,0.05)" : unlocked ? "rgba(255,215,0,0.08)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${r.claimed ? "rgba(74,222,128,0.3)" : unlocked ? "rgba(255,215,0,0.4)" : "rgba(255,255,255,0.08)"}`,
                      }}>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-black text-white">{r.threshold.toLocaleString("de-DE")} Pkt</div>
                        <div className="text-[9px] text-white/60 truncate">
                          {Object.entries(r.rewards).map(([k, v]) => `${RES_LABEL[k] ?? k} ${v}`).join(" · ")}
                        </div>
                      </div>
                      {r.claimed ? (
                        <span className="text-[10px] font-black text-[#4ade80]">✓ EINGELÖST</span>
                      ) : unlocked ? (
                        <button onClick={() => void claim(r.threshold)} disabled={busy === r.threshold}
                          className="px-3 py-1.5 rounded font-black text-[10px] disabled:opacity-40"
                          style={{ background: GOLD, color: "#1a0e00" }}>
                          {busy === r.threshold ? "…" : "ABHOLEN"}
                        </button>
                      ) : (
                        <span className="text-[10px] text-white/40">🔒</span>
                      )}
                    </div>
                  );
                })}
              </div>
              {data.next_unlock && (
                <div className="mt-2 text-[9px] text-white/50 text-center">
                  Nächste Stufe: {data.next_unlock.threshold} Pkt (noch {(data.next_unlock.threshold - data.total_points).toLocaleString("de-DE")})
                </div>
              )}
            </div>
            <div suppressHydrationWarning style={{ display: "none" }}>{now}</div>
          </div>
        )}
      </div>
    </div>
  );
}
