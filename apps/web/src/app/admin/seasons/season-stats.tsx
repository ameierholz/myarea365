"use client";

import { useEffect, useState } from "react";

type TypeRow = { type: string; picks: number; wins: number; losses: number; win_pct: number };
type DailyRow = { day: string; count: number };
type TopFighter = {
  user_id: string; wins: number; losses: number; level: number;
  guardian_archetypes: { name: string; emoji: string } | { name: string; emoji: string }[];
  users: { username: string; display_name: string | null } | { username: string; display_name: string | null }[];
};

type StatsResponse = {
  ok: boolean;
  season: { id: string; number: number; name: string; starts_at: string; ends_at: string } | null;
  kpis?: { total_fights: number; fights_24h: number; fights_7d: number; seasonal_pickers: number };
  class_balance?: TypeRow[];
  top_fighters?: TopFighter[];
  daily?: DailyRow[];
};

const TYPE_META: Record<string, { label: string; icon: string; color: string }> = {
  infantry: { label: "Infanterie",    icon: "🛡️", color: "#60a5fa" },
  cavalry:  { label: "Kavallerie",    icon: "🐎", color: "#fb923c" },
  marksman: { label: "Scharfschütze", icon: "🏹", color: "#4ade80" },
  mage:     { label: "Magier",        icon: "🔮", color: "#c084fc" },
};

export function SeasonStats() {
  const [data, setData] = useState<StatsResponse | null>(null);

  useEffect(() => {
    void fetch("/api/admin/seasons/stats", { cache: "no-store" }).then((r) => r.json()).then(setData);
  }, []);

  if (!data) return <div className="text-sm text-[#8B8FA3] p-6 text-center">Lade Live-Metriken …</div>;
  if (!data.season) return <div className="text-sm text-[#8B8FA3] p-6 text-center">Keine aktive Saison.</div>;

  const { season, kpis, class_balance, top_fighters, daily } = data;
  const daysLeft = Math.max(0, Math.ceil((new Date(season.ends_at).getTime() - Date.now()) / 86_400_000));
  const maxDaily = Math.max(1, ...(daily ?? []).map((d) => d.count));

  const totalPicks = (class_balance ?? []).reduce((s, r) => s + r.picks, 0) || 1;
  const bestWinRate = [...(class_balance ?? [])].sort((a, b) => b.win_pct - a.win_pct)[0];
  const imbalance = bestWinRate ? bestWinRate.win_pct - 50 : 0;

  function unnest<T>(x: T | T[]): T | null {
    if (!x) return null;
    return Array.isArray(x) ? (x[0] ?? null) : x;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[10px] font-black tracking-widest text-[#FFD700]">AKTIVE SAISON · LIVE-METRIKEN</div>
          <div className="text-lg font-black text-white mt-0.5">Saison {season.number} · {season.name}</div>
          <div className="text-xs text-[#a8b4cf]">Noch {daysLeft} Tage</div>
        </div>
        {imbalance >= 15 && bestWinRate && (
          <div className="px-3 py-1.5 rounded-lg bg-[#FF2D78]/15 border border-[#FF2D78]/40 text-[#FF2D78] text-xs font-black">
            ⚠️ Klassen-Imbalance: {TYPE_META[bestWinRate.type]?.label ?? bestWinRate.type} @ {bestWinRate.win_pct}%
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KPI label="KÄMPFE GESAMT" value={kpis?.total_fights ?? 0} color="#22D1C3" />
        <KPI label="KÄMPFE 24H" value={kpis?.fights_24h ?? 0} color="#FFD700" />
        <KPI label="KÄMPFE 7T" value={kpis?.fights_7d ?? 0} color="#FF6B4A" />
        <KPI label="SAISON-PICKER" value={kpis?.seasonal_pickers ?? 0} color="#a855f7" />
      </div>

      {/* Daily Chart */}
      {daily && daily.length > 0 && (
        <div className="mb-5">
          <div className="text-[10px] font-black tracking-widest text-[#8B8FA3] mb-2">KÄMPFE PRO TAG (LETZTE 14 TAGE)</div>
          <div className="flex items-end gap-1 h-24">
            {daily.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1" title={`${d.day}: ${d.count} Fights`}>
                <div style={{
                  width: "100%",
                  height: `${Math.round((d.count / maxDaily) * 100)}%`,
                  background: "linear-gradient(180deg, #22D1C3, #0f8178)",
                  borderRadius: "3px 3px 0 0",
                  minHeight: 2,
                }} />
                <div className="text-[8px] text-[#6c7590]">{d.day.slice(5)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Klassen-Balance */}
      {class_balance && class_balance.length > 0 && (
        <div className="mb-5">
          <div className="text-[10px] font-black tracking-widest text-[#8B8FA3] mb-2">KLASSEN-BALANCE</div>
          <div className="grid gap-2">
            {class_balance.map((c) => {
              const meta = TYPE_META[c.type] ?? { label: c.type, icon: "❓", color: "#8B8FA3" };
              const pickPct = Math.round((c.picks / totalPicks) * 100);
              return (
                <div key={c.type} className="flex items-center gap-3 p-2 rounded-lg bg-[#0F1115] border border-white/5">
                  <div className="text-lg w-6 text-center">{meta.icon}</div>
                  <div className="w-24 text-xs font-black" style={{ color: meta.color }}>{meta.label}</div>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1">
                      <div className="h-2 rounded bg-white/5 overflow-hidden">
                        <div style={{ width: `${pickPct}%`, height: "100%", background: meta.color }} />
                      </div>
                    </div>
                    <div className="text-[10px] text-[#a8b4cf] w-12 text-right">{pickPct}% Pick</div>
                  </div>
                  <div className="text-xs font-black w-16 text-right" style={{ color: c.win_pct >= 55 ? "#4ade80" : c.win_pct <= 45 ? "#FF2D78" : "#a8b4cf" }}>
                    {c.win_pct}% WR
                  </div>
                  <div className="text-[10px] text-[#8B8FA3] w-20 text-right">{c.wins}W / {c.losses}L</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top Fighters */}
      {top_fighters && top_fighters.length > 0 && (
        <div>
          <div className="text-[10px] font-black tracking-widest text-[#8B8FA3] mb-2">TOP 10 SAISON-FIGHTER</div>
          <div className="grid grid-cols-2 gap-2">
            {top_fighters.map((f, i) => {
              const arch = unnest(f.guardian_archetypes);
              const user = unnest(f.users);
              return (
                <div key={f.user_id} className="flex items-center gap-2 p-2 rounded-lg bg-[#0F1115] border border-white/5">
                  <div className="text-[10px] font-black text-[#FFD700] w-5">#{i + 1}</div>
                  <div className="text-lg">{arch?.emoji ?? "⚔️"}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white truncate">{user?.display_name ?? user?.username}</div>
                    <div className="text-[10px] text-[#8B8FA3] truncate">{arch?.name} · Lv {f.level}</div>
                  </div>
                  <div className="text-[10px] text-[#4ade80] font-black">{f.wins}W</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function KPI({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="p-3 rounded-lg bg-[#0F1115] border border-white/5">
      <div className="text-[9px] font-black tracking-widest text-[#8B8FA3]">{label}</div>
      <div className="text-2xl font-black mt-1" style={{ color }}>{value.toLocaleString("de-DE")}</div>
    </div>
  );
}
