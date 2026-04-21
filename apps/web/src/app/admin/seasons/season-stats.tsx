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

const DEMO_STATS: StatsResponse = {
  ok: true,
  season: {
    id: "demo",
    number: 1,
    name: "Saison der Klingen",
    starts_at: new Date(Date.now() - 12 * 86400_000).toISOString(),
    ends_at: new Date(Date.now() + 78 * 86400_000).toISOString(),
  },
  kpis: { total_fights: 14_823, fights_24h: 487, fights_7d: 3_241, seasonal_pickers: 1_847 },
  class_balance: [
    { type: "cavalry",  picks: 624, wins: 1_823, losses: 1_401, win_pct: 57 },
    { type: "mage",     picks: 489, wins: 1_512, losses: 1_388, win_pct: 52 },
    { type: "marksman", picks: 441, wins: 1_204, losses: 1_296, win_pct: 48 },
    { type: "infantry", picks: 293, wins:   892, losses: 1_107, win_pct: 45 },
  ],
  top_fighters: [
    { user_id: "u1", wins: 127, losses: 32, level: 42, guardian_archetypes: { name: "Straßen-Gott", emoji: "⚔️" }, users: { username: "valkyr", display_name: "Valkyr" } },
    { user_id: "u2", wins: 112, losses: 41, level: 38, guardian_archetypes: { name: "Schatten-Magier", emoji: "🔮" }, users: { username: "nyx", display_name: "Nyx" } },
    { user_id: "u3", wins: 104, losses: 28, level: 45, guardian_archetypes: { name: "Metropolen-Legende", emoji: "🛡️" }, users: { username: "titan", display_name: "Titan" } },
    { user_id: "u4", wins:  98, losses: 39, level: 36, guardian_archetypes: { name: "Nachtschütze", emoji: "🏹" }, users: { username: "shade", display_name: "Shade" } },
    { user_id: "u5", wins:  91, losses: 44, level: 34, guardian_archetypes: { name: "Flammenherz", emoji: "🔥" }, users: { username: "ember", display_name: "Ember" } },
    { user_id: "u6", wins:  82, losses: 38, level: 40, guardian_archetypes: { name: "Asphalt-Athlet", emoji: "💨" }, users: { username: "kaelthor", display_name: "Kaelthor" } },
    { user_id: "u7", wins:  76, losses: 33, level: 31, guardian_archetypes: { name: "Wildgänger", emoji: "🦅" }, users: { username: "zephyr", display_name: "Zephyr" } },
    { user_id: "u8", wins:  71, losses: 46, level: 29, guardian_archetypes: { name: "Urbaner Mythos", emoji: "🌙" }, users: { username: "frost", display_name: "Frost" } },
    { user_id: "u9", wins:  65, losses: 41, level: 27, guardian_archetypes: { name: "Straßen-Geist", emoji: "👻" }, users: { username: "raze", display_name: "Raze" } },
    { user_id: "u10", wins: 58, losses: 30, level: 33, guardian_archetypes: { name: "Kadett", emoji: "🎖️" }, users: { username: "blaze", display_name: "Blaze" } },
  ],
  daily: Array.from({ length: 14 }, (_, i) => {
    const day = new Date(Date.now() - (13 - i) * 86400_000).toISOString().slice(0, 10);
    // Synthetische Kurve: wächst + Wochenend-Peaks
    const base = 180 + i * 12;
    const weekend = new Date(Date.now() - (13 - i) * 86400_000).getDay();
    const bonus = (weekend === 0 || weekend === 6) ? 80 : 0;
    return { day, count: base + bonus + Math.round(Math.random() * 40) };
  }),
};

export function SeasonStats() {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    void fetch("/api/admin/seasons/stats", { cache: "no-store" }).then((r) => r.json()).then((j) => {
      if (!j.season || (j.kpis?.total_fights ?? 0) === 0) { setData(DEMO_STATS); setIsDemo(true); }
      else { setData(j); setIsDemo(false); }
    });
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
      {isDemo && (
        <div className="mb-3 p-2.5 rounded-lg bg-[#a855f7]/10 border border-[#a855f7]/40 text-xs text-[#c084fc] flex items-center gap-2">
          <span className="text-base">🤖</span>
          <span><b className="font-black tracking-wider">DEMO-DATEN</b> — noch keine aktive Saison mit Fight-Daten. Hier sind synthetische Metriken.</span>
        </div>
      )}
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
