"use client";

import { useEffect, useState } from "react";

export type ActiveScout = {
  id: string;
  status: "marching" | "scouting" | "returning";
  started_at: string;
  arrives_at: string;
  scout_done_at: string;
  returns_at: string;
  from_lat: number; from_lng: number;
  target_lat: number; target_lng: number;
  distance_m: number;
  defender_user_id: string;
  defender_name: string | null;
  route_geom_json?: { type: "LineString"; coordinates: [number, number][] } | null;
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

export function ActiveScoutsBanner({ scouts, onFly }: { scouts: ActiveScout[]; onFly?: (lat: number, lng: number) => void }) {
  const [now, setNow] = useState(() => Date.now());
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (scouts.length === 0) return null;

  return (
    <div className="fixed top-3 right-3 sm:max-w-sm z-[900] pointer-events-auto">
      <div className="rounded-2xl bg-[#0F1115]/55 backdrop-blur-md border border-[#22D1C3]/40 shadow-2xl overflow-hidden">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-[#22D1C3]/25 to-transparent text-left"
        >
          <span className="text-lg">🔍</span>
          <span className="text-[11px] font-black tracking-widest text-[#22D1C3] flex-1">
            {scouts.length} SPÄHER UNTERWEGS
          </span>
          <span className="text-white/60 text-xs">{collapsed ? "▼" : "▲"}</span>
        </button>
        {!collapsed && (
          <div className="divide-y divide-white/5">
            {scouts.map((s) => {
              const target = s.status === "marching"
                ? new Date(s.arrives_at).getTime()
                : s.status === "scouting"
                ? new Date(s.scout_done_at).getTime()
                : new Date(s.returns_at).getTime();
              const remaining = target - now;
              const totalRange = s.status === "marching"
                ? new Date(s.arrives_at).getTime() - new Date(s.started_at).getTime()
                : s.status === "scouting"
                ? new Date(s.scout_done_at).getTime() - new Date(s.arrives_at).getTime()
                : new Date(s.returns_at).getTime() - new Date(s.scout_done_at).getTime();
              const elapsed = totalRange - remaining;
              const pct = Math.max(0, Math.min(100, (elapsed / Math.max(1, totalRange)) * 100));
              const statusLabel =
                s.status === "marching" ? "🚶 Anmarsch" :
                s.status === "scouting" ? "👁 Spähen" : "🏃 Rückkehr";
              return (
                <div key={s.id} className="px-3 py-2">
                  <button
                    onClick={() => onFly?.(s.target_lat, s.target_lng)}
                    className="w-full flex items-center gap-2 text-left hover:bg-white/5 -mx-1 px-1 py-0.5 rounded transition-colors">
                    <span className="text-xl">🔍</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-black text-white truncate">
                        {s.defender_name ?? "Ziel"}
                      </div>
                      <div className="text-[9px] text-[#a8b4cf]">{statusLabel}</div>
                    </div>
                    <div className="text-[12px] font-black text-[#FFD700] tabular-nums">{fmtRemaining(remaining)}</div>
                  </button>
                  <div className="mt-1.5 h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#22D1C3] to-[#FFD700]" style={{ width: `${pct.toFixed(1)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
