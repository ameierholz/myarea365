"use client";

import { useEffect, useState } from "react";

export type CrewRally = {
  id: string;
  status: "preparing" | "marching" | "fighting";
  prep_seconds: number;
  prep_ends_at: string;
  march_ends_at: string | null;
  total_atk: number;
  created_at: string;
  leader_user_id: string;
  leader_name: string | null;
  attacker_crew_id: string;
  attacker_crew_tag: string | null;
  attacker_crew_name: string | null;
  defender_crew_id: string | null;
  defender_crew_tag: string | null;
  defender_crew_name: string | null;
  repeater_id: string;
  repeater_kind: "hq" | "repeater" | "mega";
  repeater_label: string | null;
  repeater_lat: number;
  repeater_lng: number;
  repeater_hp: number;
  repeater_max_hp: number;
  participant_count: number;
  is_attacker: boolean;
  is_defender: boolean;
  leader_base_lat?: number | null;
  leader_base_lng?: number | null;
  route_geom_json?: { type: "LineString"; coordinates: [number, number][] } | null;
};

const KIND_LABEL: Record<string, string> = { hq: "HQ", repeater: "Repeater", mega: "Mega-Repeater" };
const KIND_EMOJI: Record<string, string> = { hq: "🏰", repeater: "📡", mega: "🗼" };

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

export function ActiveCrewRallyBanner({ rallies, onFly }: { rallies: CrewRally[]; onFly?: (lat: number, lng: number) => void }) {
  const [now, setNow] = useState(() => Date.now());
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (rallies.length === 0) return null;

  return (
    <div className="fixed top-16 sm:top-20 left-1/2 -translate-x-1/2 sm:left-3 sm:translate-x-0 sm:max-w-sm w-[92vw] sm:w-[340px] z-[900] pointer-events-auto">
      <div className="rounded-2xl bg-[#0F1115]/60 backdrop-blur-md border border-[#FF2D78]/40 shadow-2xl overflow-hidden">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-[#FF2D78]/25 to-transparent text-left"
        >
          <span className="text-lg">⚔️</span>
          <span className="text-[11px] font-black tracking-widest text-[#FF2D78] flex-1">
            {rallies.length} CREW-AUFGEBOT{rallies.length > 1 ? "E" : ""}
          </span>
          <span className="text-white/60 text-xs">{collapsed ? "▼" : "▲"}</span>
        </button>
        {!collapsed && (
          <div className="divide-y divide-white/5">
            {rallies.map((r) => {
              const target = r.status === "preparing"
                ? new Date(r.prep_ends_at).getTime()
                : (r.march_ends_at ? new Date(r.march_ends_at).getTime() : new Date(r.prep_ends_at).getTime() + 60_000);
              const remaining = target - now;
              const total = r.status === "preparing"
                ? (r.prep_seconds * 1000)
                : 60_000;
              const elapsed = total - remaining;
              const pct = Math.max(0, Math.min(100, (elapsed / Math.max(1, total)) * 100));
              const statusLabel =
                r.status === "preparing" ? "🟡 Sammelphase" :
                r.status === "marching"  ? "🟠 Anmarsch" :
                                            "🔴 Kampf";
              const sideTag = r.is_attacker
                ? <span className="text-[#FF2D78]">⚔ ANGREIFER</span>
                : <span className="text-[#22D1C3]">🛡 VERTEIDIGER</span>;
              const repName = r.repeater_label ?? KIND_LABEL[r.repeater_kind];
              return (
                <div key={r.id} className="px-3 py-2">
                  <button
                    onClick={() => onFly?.(r.repeater_lat, r.repeater_lng)}
                    className="w-full flex items-center gap-2 text-left hover:bg-white/5 -mx-1 px-1 py-0.5 rounded transition-colors">
                    <span className="text-xl">{KIND_EMOJI[r.repeater_kind]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-black text-white truncate">
                        {repName}
                        {r.defender_crew_tag && <span className="text-white/50 ml-1">[{r.defender_crew_tag}]</span>}
                      </div>
                      <div className="text-[9px] text-[#a8b4cf] truncate">
                        {statusLabel} · {sideTag}
                      </div>
                    </div>
                    <div className="text-[12px] font-black text-[#FFD700] tabular-nums">{fmtRemaining(remaining)}</div>
                  </button>
                  <div className="mt-1.5 h-1 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#FF2D78] to-[#FFD700]"
                      style={{ width: `${pct.toFixed(1)}%` }}
                    />
                  </div>
                  <div className="mt-1 grid grid-cols-3 gap-x-2 text-[9px] text-[#a8b4cf]">
                    <div>
                      Anführer:<br />
                      <span className="text-white font-bold truncate inline-block max-w-full">
                        {r.leader_name ?? "—"}
                      </span>
                    </div>
                    <div>
                      Teilnehmer:<br />
                      <span className="text-[#22D1C3] font-black tabular-nums">{r.participant_count}</span>
                    </div>
                    <div>
                      Atk:<br />
                      <span className="text-[#FF6B4A] font-black tabular-nums">{r.total_atk.toLocaleString("de-DE")}</span>
                    </div>
                  </div>
                  {r.is_defender && r.repeater_max_hp > 0 && (
                    <div className="mt-1.5 text-[9px] text-[#a8b4cf] flex items-center gap-1.5">
                      <span>HP:</span>
                      <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#4ade80] to-[#FFD700]"
                          style={{ width: `${Math.max(0, Math.min(100, (r.repeater_hp / r.repeater_max_hp) * 100)).toFixed(1)}%` }}
                        />
                      </div>
                      <span className="text-white tabular-nums">{r.repeater_hp}/{r.repeater_max_hp}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
