"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type PlayerBaseRallyState = {
  rally_id: string;
  leader_name: string;
  is_leader: boolean;
  defender_name: string;
  defender_user_id: string;
  defender_lat: number;
  defender_lng: number;
  status: "preparing" | "marching" | "fighting" | "done" | "aborted";
  prep_ends_at: string;
  march_ends_at: string | null;
  total_atk: number;
  participants: number;
  joined: boolean;
};

export function ActivePlayerBaseRallyBanner({ rally, onOpen }: {
  rally: PlayerBaseRallyState | null;
  onOpen: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  if (!rally) return null;
  // Status done/aborted → Banner ist tot, weg damit
  if (rally.status === "done" || rally.status === "aborted") return null;

  const target = rally.status === "preparing"
    ? new Date(rally.prep_ends_at).getTime()
    : rally.march_ends_at ? new Date(rally.march_ends_at).getTime() : 0;
  const remain = Math.max(0, target - now);
  // Timer ist abgelaufen aber Cron hat noch nicht resolved → Banner ausblenden
  // (sonst hängt "0:00" dauerhaft auf der Map)
  if (remain === 0 && target > 0) return null;
  const mm = Math.floor(remain / 60000);
  const ss = Math.floor((remain % 60000) / 1000);
  const countdown = `${mm}:${String(ss).padStart(2, "0")}`;

  const color = rally.status === "preparing" ? "#FF6B4A" : rally.status === "marching" ? "#FF2D78" : "#FFD700";
  const phase = rally.status === "preparing" ? "⏳ Sammeln" : rally.status === "marching" ? "🏃 Marsch" : "⚔️ Kampf";

  return (
    <button onClick={onOpen}
      className="w-full px-3 py-2 rounded-xl flex items-center gap-2 backdrop-blur"
      style={{
        background: `linear-gradient(135deg, ${color}33, rgba(15,17,21,0.85))`,
        border: `1px solid ${color}77`,
      }}>
      <span className="text-xl">📣</span>
      <div className="flex-1 text-left min-w-0">
        <div className="text-[10px] font-black tracking-widest truncate" style={{ color }}>
          CREW-ANGRIFF · {phase} · {rally.participants}👥
        </div>
        <div className="text-[12px] font-black text-white truncate">
          {countdown} · auf {rally.defender_name} · {rally.total_atk.toLocaleString("de-DE")} Angriff
        </div>
      </div>
      {!rally.joined && rally.status === "preparing" && (
        <span className="text-[10px] font-black px-2 py-1 rounded bg-white text-[#0F1115] shrink-0">BEITRETEN</span>
      )}
      <span className="text-white text-lg">›</span>
    </button>
  );
}

// ─── Join-Modal: Crew-Mitglied tritt laufendem Aufgebot bei ──────────
type Troop = {
  id: string;
  name: string;
  emoji: string;
  troop_class: string;
  tier: number;
  base_atk: number;
};

const CLASS_LABEL: Record<string, string> = {
  infantry: "Türsteher",
  cavalry: "Kuriere",
  marksman: "Schleuderer",
  siege: "Brecher",
};

export function JoinPlayerBaseRallyModal({ rally, onClose, onJoined }: {
  rally: PlayerBaseRallyState;
  onClose: () => void;
  onJoined: () => void | Promise<void>;
}) {
  const [troops, setTroops] = useState<Troop[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);

  const load = useCallback(async () => {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const [catalog, mine] = await Promise.all([
      sb.from("troops_catalog").select("id, name, emoji, troop_class, tier, base_atk").order("troop_class").order("tier"),
      sb.from("user_troops").select("troop_id, count").eq("user_id", user.id),
    ]);
    setTroops((catalog.data ?? []) as Troop[]);
    const c: Record<string, number> = {};
    (mine.data ?? []).forEach((r: { troop_id: string; count: number }) => { c[r.troop_id] = r.count; });
    setCounts(c);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const totalAtk = useMemo(() => {
    let s = 0;
    for (const t of troops) s += (selected[t.id] ?? 0) * t.base_atk;
    return s;
  }, [selected, troops]);

  const totalCount = useMemo(() => Object.values(selected).reduce((a, b) => a + b, 0), [selected]);

  const grouped = useMemo(() => {
    const g: Record<string, Troop[]> = {};
    for (const t of troops) {
      if ((counts[t.id] ?? 0) <= 0) continue;
      (g[t.troop_class] ??= []).push(t);
    }
    return g;
  }, [troops, counts]);

  function setQty(id: string, n: number) {
    const max = counts[id] ?? 0;
    setSelected((s) => ({ ...s, [id]: Math.max(0, Math.min(max, Math.floor(n) || 0)) }));
  }

  async function join() {
    if (totalCount < 1) { setMsg("Wähle mindestens 1 Truppe."); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`/api/base/rally/${rally.rally_id}/join`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ troops: selected }),
      });
      const j = await r.json() as { ok?: boolean; error?: string };
      if (j.ok) {
        setMsg("✓ Beigetreten!");
        await onJoined();
        setTimeout(onClose, 1000);
      } else if (j.error === "already_joined") setMsg("Du bist schon beigetreten.");
      else if (j.error === "prep_ended") setMsg("Vorbereitungszeit ist abgelaufen.");
      else if (j.error === "wrong_crew") setMsg("Du bist nicht in dieser Crew.");
      else setMsg(j.error ?? "Fehler");
    } finally { setBusy(false); }
  }

  const target = new Date(rally.prep_ends_at).getTime();
  const remain = Math.max(0, target - now);
  const mm = Math.floor(remain / 60000);
  const ss = Math.floor((remain % 60000) / 1000);

  return (
    <div onClick={onClose} className="fixed inset-0 z-[9000] bg-black/85 backdrop-blur-md flex items-center justify-center p-3">
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
        style={{ background: "linear-gradient(180deg, #1A1D23 0%, #0F1115 100%)" }}>

        <div className="px-3 py-2.5 border-b border-white/10 flex items-center gap-2 shrink-0"
          style={{ background: "linear-gradient(135deg, rgba(255,107,74,0.20) 0%, rgba(255,215,0,0.12) 100%)" }}>
          <span className="text-2xl">📣</span>
          <div className="flex-1 min-w-0">
            <div className="text-[8px] font-black tracking-[2px] text-[#FF6B4A]/90">CREW-ANGRIFF</div>
            <div className="text-[13px] font-black text-white truncate">Aufgebot von {rally.leader_name}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-black/40 text-white text-base font-black">×</button>
        </div>

        <div className="px-3 py-2 border-b border-white/5 shrink-0 grid grid-cols-3 gap-1.5 text-[10px]">
          <div className="px-2 py-1 rounded bg-black/35 border border-white/5">
            <div className="text-[7px] text-white/45 font-black">ZIEL</div>
            <div className="text-[11px] font-black text-white truncate">{rally.defender_name}</div>
          </div>
          <div className="px-2 py-1 rounded bg-black/35 border border-white/5">
            <div className="text-[7px] text-white/45 font-black">CREW-ANGRIFF</div>
            <div className="text-[11px] font-black text-[#FF6B4A] tabular-nums">{rally.total_atk.toLocaleString("de-DE")}</div>
          </div>
          <div className="px-2 py-1 rounded bg-black/35 border border-white/5">
            <div className="text-[7px] text-white/45 font-black">REST</div>
            <div className="text-[11px] font-black text-[#FFD700] tabular-nums">{mm}:{String(ss).padStart(2, "0")}</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {Object.keys(grouped).length === 0 && (
            <div className="text-center text-[12px] text-white/60 py-12">Keine Truppen verfügbar.</div>
          )}
          {Object.entries(grouped).map(([cls, list]) => (
            <div key={cls}>
              <div className="text-[10px] font-black tracking-[2px] mb-1.5 px-1 text-[#22D1C3]">★ {CLASS_LABEL[cls] ?? cls}</div>
              <div className="space-y-1.5">
                {list.map((t) => {
                  const have = counts[t.id] ?? 0;
                  const v = selected[t.id] ?? 0;
                  return (
                    <div key={t.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-black/30 border border-white/5">
                      <span className="text-base shrink-0 w-6 text-center">{t.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-black text-white truncate">{t.name} <span className="text-white/40">T{t.tier}</span></div>
                        <div className="text-[9px] text-white/50">Angriff {t.base_atk} · da {have.toLocaleString("de-DE")}</div>
                      </div>
                      <input type="number" min={0} max={have} value={v}
                        onChange={(e) => setQty(t.id, Number(e.target.value))}
                        className="w-20 text-right text-[11px] font-black px-2 py-1 rounded bg-black/50 border border-white/10 text-white" />
                      <button onClick={() => setQty(t.id, have)} className="text-[9px] font-black text-[#22D1C3] px-2 py-1 rounded bg-[#22D1C3]/10 hover:bg-[#22D1C3]/20">MAX</button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-white/10 p-3 shrink-0 space-y-2"
          style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.4), transparent)" }}>
          <div className="text-[11px] text-center">
            <span className="text-white/60">Dein Beitrag: </span>
            <span className="text-white font-black tabular-nums">{totalCount.toLocaleString("de-DE")}</span>
            <span className="text-white/40 mx-2">·</span>
            <span className="text-[#FF6B4A] font-black tabular-nums">{totalAtk.toLocaleString("de-DE")} Angriff</span>
          </div>
          {msg && (
            <div className="text-[11px] text-center font-black py-1.5 px-2 rounded"
              style={{ color: msg.startsWith("✓") ? "#4ade80" : "#FF6B9A", background: msg.startsWith("✓") ? "rgba(74,222,128,0.1)" : "rgba(255,107,154,0.1)" }}>
              {msg}
            </div>
          )}
          <button onClick={join} disabled={busy || totalCount < 1}
            className="w-full text-[13px] font-black px-4 py-3 rounded-xl text-white disabled:opacity-40 transition"
            style={{ background: "linear-gradient(135deg, #FF6B4A, #FFD700)", boxShadow: "0 4px 16px rgba(255,107,74,0.4)" }}>
            {busy ? "…" : `📣 BEITRETEN${totalCount > 0 ? ` (${totalCount.toLocaleString("de-DE")})` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
