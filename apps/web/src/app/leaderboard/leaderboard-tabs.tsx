"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type TabId = "runners" | "guardians" | "factions" | "crews" | "arena";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "runners",   label: "🏃 Runner" },
  { id: "guardians", label: "🛡️ Wächter" },
  { id: "factions",  label: "🏛️ Fraktionen" },
  { id: "crews",     label: "👥 Crews" },
  { id: "arena",     label: "🏆 Area-Liga" },
];

export function LeaderboardTabs() {
  const [tab, setTab] = useState<TabId>("runners");
  return (
    <div>
      <div className="flex gap-2 mb-5 flex-wrap justify-center">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-2 rounded-lg text-sm font-bold transition ${
              tab === t.id
                ? "bg-[#22D1C3] text-[#0F1115]"
                : "bg-white/5 border border-white/10 text-[#a8b4cf] hover:text-white"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "runners"   && <RunnersTab />}
      {tab === "guardians" && <GuardiansTab />}
      {tab === "factions"  && <FactionsTab />}
      {tab === "crews"     && <CrewsTab />}
      {tab === "arena"     && <ArenaTab />}
    </div>
  );
}

/* ═════════════════ RUNNERS ═════════════════ */

type Runner = {
  username: string | null;
  display_name: string | null;
  faction: string | null;
  total_distance_m: number | null;
  total_walks: number | null;
  total_xp: number | null;
  level: number | null;
};

function RunnersTab() {
  const [metric, setMetric] = useState<"xp"|"km"|"walks"|"level">("xp");
  const [faction, setFaction] = useState<"all"|"syndicate"|"vanguard">("all");
  const [runners, setRunners] = useState<Runner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = new URLSearchParams({ metric });
    if (faction !== "all") q.set("faction", faction);
    fetch(`/api/leaderboard/runners?${q}`)
      .then((r) => r.json())
      .then((d) => setRunners(d.runners ?? []))
      .finally(() => setLoading(false));
  }, [metric, faction]);

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3 justify-between items-center">
        <div className="flex flex-wrap gap-1.5">
          <Chip active={metric==="xp"}    onClick={() => setMetric("xp")}>⚡ XP</Chip>
          <Chip active={metric==="km"}    onClick={() => setMetric("km")}>🥾 Kilometer</Chip>
          <Chip active={metric==="walks"} onClick={() => setMetric("walks")}>📍 Gebiete</Chip>
          <Chip active={metric==="level"} onClick={() => setMetric("level")}>🎖️ Level</Chip>
        </div>
        <div className="flex gap-1.5">
          <Chip active={faction==="all"}       onClick={() => setFaction("all")}>🌍 Alle</Chip>
          <Chip active={faction==="syndicate"} onClick={() => setFaction("syndicate")}>🌙 Nachtpuls</Chip>
          <Chip active={faction==="vanguard"}  onClick={() => setFaction("vanguard")}>☀️ Sonnenwacht</Chip>
        </div>
      </div>

      {loading ? <Loading /> : runners.length === 0 ? <Empty text="Noch keine Runner im Ranking." /> : (
        <div className="bg-[#1A1D23] border border-white/10 rounded-2xl overflow-hidden">
          {runners.map((r, i) => {
            const km = ((r.total_distance_m ?? 0) / 1000).toFixed(1);
            const color = r.faction === "syndicate" ? "#22D1C3" : r.faction === "vanguard" ? "#FF6B4A" : "#22D1C3";
            const primary = metric === "km" ? `${km} km`
                          : metric === "walks" ? `${(r.total_walks ?? 0).toLocaleString("de-DE")} Walks`
                          : metric === "level" ? `Lvl ${r.level ?? 1}`
                          : `${(r.total_xp ?? 0).toLocaleString("de-DE")} XP`;
            return (
              <Link key={r.username ?? i} href={`/u/${r.username}`}
                className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition">
                <div className="w-8 text-center text-xs font-black" style={{ color: i < 3 ? "#FFD700" : "#8B8FA3" }}>#{i+1}</div>
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold" style={{ background: `linear-gradient(135deg, ${color}, ${color}aa)`, color: "#0F1115" }}>
                  {(r.display_name ?? r.username ?? "?").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-white font-bold truncate">{r.display_name ?? r.username}</span>
                    {r.faction === "syndicate" && <FactionBadge icon="🌙" label="Nachtpuls" color="#22D1C3" />}
                    {r.faction === "vanguard"  && <FactionBadge icon="☀️" label="Sonnenwacht" color="#FF6B4A" />}
                  </div>
                  <div className="text-xs text-[#8B8FA3]">@{r.username} · Lvl {r.level ?? 1} · {km} km</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black" style={{ color }}>{primary}</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═════════════════ GUARDIANS ═════════════════ */

type GuardianRow = {
  id: string;
  user_id: string;
  archetype_id: string;
  level: number;
  wins: number;
  losses: number;
  guardian_archetypes: { name: string; emoji: string; rarity: string; guardian_type?: string };
  users: { username: string; display_name: string | null };
};

const TYPE_META: Record<string, { label: string; icon: string; color: string }> = {
  infantry: { label: "Infanterie",    icon: "🛡️", color: "#60a5fa" },
  cavalry:  { label: "Kavallerie",    icon: "🐎", color: "#fb923c" },
  marksman: { label: "Scharfschütze", icon: "🏹", color: "#4ade80" },
  mage:     { label: "Magier",        icon: "🔮", color: "#c084fc" },
};
const RARITY_META: Record<string, { label: string; color: string }> = {
  elite:     { label: "ELITE",    color: "#22D1C3" },
  epic:      { label: "EPISCH",   color: "#a855f7" },
  legendary: { label: "LEGENDÄR", color: "#FFD700" },
};

function GuardiansTab() {
  const [view, setView] = useState<"overall"|"by_type"|"by_rarity">("overall");
  const [overall, setOverall] = useState<{ top_level: GuardianRow[]; most_played: GuardianRow[]; top_win_rate: GuardianRow[] } | null>(null);
  const [byCat, setByCat] = useState<{ by_type: Array<{ type: string; rows: GuardianRow[] }>; by_rarity: Array<{ rarity: string; rows: GuardianRow[] }> } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/leaderboard/guardians").then((r) => r.json()),
      fetch("/api/leaderboard/guardians-by-category").then((r) => r.json()),
    ]).then(([a, b]) => { setOverall(a); setByCat(b); }).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  return (
    <div>
      <div className="flex gap-1.5 mb-3 flex-wrap">
        <Chip active={view==="overall"}   onClick={() => setView("overall")}>🏆 Gesamt</Chip>
        <Chip active={view==="by_type"}   onClick={() => setView("by_type")}>⚔️ Nach Typ</Chip>
        <Chip active={view==="by_rarity"} onClick={() => setView("by_rarity")}>💎 Nach Rarität</Chip>
      </div>

      {view === "overall" && overall && (
        <div className="grid gap-4 md:grid-cols-3">
          <GuardianList title="👑 Höchstes Level" rows={overall.top_level} metric={(g) => `Lvl ${g.level}`} />
          <GuardianList title="⚔️ Meiste Kämpfe" rows={overall.most_played} metric={(g) => `${g.wins+g.losses} Kämpfe`} />
          <GuardianList title="🏅 Beste Win-Rate" rows={overall.top_win_rate}
            metric={(g) => {
              const total = g.wins + g.losses;
              return total > 0 ? `${Math.round((g.wins / total) * 100)}%` : "—";
            }} />
        </div>
      )}

      {view === "by_type" && byCat && (
        <div className="grid gap-4 md:grid-cols-2">
          {byCat.by_type.map((bt) => {
            const m = TYPE_META[bt.type];
            return <GuardianList key={bt.type} title={`${m?.icon} ${m?.label ?? bt.type}`} rows={bt.rows} metric={(g) => `Lvl ${g.level}`} accent={m?.color} />;
          })}
        </div>
      )}

      {view === "by_rarity" && byCat && (
        <div className="grid gap-4 md:grid-cols-3">
          {byCat.by_rarity.map((br) => {
            const m = RARITY_META[br.rarity];
            return <GuardianList key={br.rarity} title={m?.label ?? br.rarity} rows={br.rows} metric={(g) => `Lvl ${g.level}`} accent={m?.color} />;
          })}
        </div>
      )}
    </div>
  );
}

function GuardianList({ title, rows, metric, accent = "#22D1C3" }: { title: string; rows: GuardianRow[]; metric: (g: GuardianRow) => string; accent?: string }) {
  return (
    <div className="bg-[#1A1D23] border border-white/10 rounded-xl overflow-hidden">
      <div className="px-3 py-2 text-xs font-black tracking-wider" style={{ background: `${accent}15`, color: accent }}>{title}</div>
      {rows.length === 0 ? (
        <div className="p-6 text-center text-xs text-[#8B8FA3]">—</div>
      ) : (
        rows.map((g, i) => (
          <Link key={g.id} href={g.users?.username ? `/u/${g.users.username}` : "#"}
            className="flex items-center gap-2 px-3 py-2 border-b border-white/5 last:border-0 hover:bg-white/5 transition">
            <div className="w-5 text-center text-[10px] font-black" style={{ color: i < 3 ? "#FFD700" : "#8B8FA3" }}>#{i+1}</div>
            <div className="text-xl">{g.guardian_archetypes?.emoji}</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-white truncate">{g.guardian_archetypes?.name}</div>
              <div className="text-[10px] text-[#8B8FA3] truncate">@{g.users?.username ?? "—"} · {g.wins}W/{g.losses}L</div>
            </div>
            <div className="text-xs font-black" style={{ color: accent }}>{metric(g)}</div>
          </Link>
        ))
      )}
    </div>
  );
}

/* ═════════════════ FACTIONS ═════════════════ */

type Faction = {
  id: string; name: string; emoji: string; color: string;
  runners: number; total_xp: number; total_km: number; avg_level: number;
};

function FactionsTab() {
  const [factions, setFactions] = useState<Faction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leaderboard/factions").then((r) => r.json()).then((d) => setFactions(d.factions ?? [])).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  const total = factions.reduce((s, f) => s + f.total_xp, 0);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {factions.map((f) => {
        const share = total > 0 ? Math.round((f.total_xp / total) * 100) : 50;
        return (
          <div key={f.id} className="bg-[#1A1D23] border border-white/10 rounded-2xl p-5" style={{ boxShadow: `inset 0 0 0 1px ${f.color}22` }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="text-4xl">{f.emoji}</div>
              <div className="flex-1">
                <div className="text-xl font-black text-white">{f.name}</div>
                <div className="text-xs text-[#8B8FA3]">{f.runners.toLocaleString("de-DE")} Runner · Ø Lvl {f.avg_level}</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-black" style={{ color: f.color }}>{share}%</div>
                <div className="text-[10px] text-[#8B8FA3]">XP-Anteil</div>
              </div>
            </div>
            <div className="h-2 bg-[#0F1115] rounded overflow-hidden mb-3">
              <div className="h-full transition-all" style={{ width: `${share}%`, background: f.color }} />
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <div className="text-xs text-[#8B8FA3]">Gesamt-XP</div>
                <div className="text-sm font-bold text-white">{f.total_xp.toLocaleString("de-DE")}</div>
              </div>
              <div>
                <div className="text-xs text-[#8B8FA3]">Gesamt-km</div>
                <div className="text-sm font-bold text-white">{f.total_km.toLocaleString("de-DE")}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═════════════════ CREWS ═════════════════ */

type Crew = {
  id: string; name: string; color: string | null; custom_emblem_url: string | null;
  total_xp: number | null; member_count: number | null; territory_count: number | null;
};

function CrewsTab() {
  const [crews, setCrews] = useState<Crew[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leaderboard/crews").then((r) => r.json()).then((d) => setCrews(d.crews ?? [])).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (crews.length === 0) return <Empty text="Noch keine Crews im Ranking." />;

  return (
    <div className="bg-[#1A1D23] border border-white/10 rounded-2xl overflow-hidden">
      {crews.map((c, i) => (
        <div key={c.id} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0">
          <div className="w-8 text-center text-xs font-black" style={{ color: i < 3 ? "#FFD700" : "#8B8FA3" }}>#{i+1}</div>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center font-black" style={{ background: c.color ?? "#22D1C3" }}>
            {c.custom_emblem_url
              ? <img src={c.custom_emblem_url} alt={c.name} className="w-full h-full object-cover rounded-lg" />
              : <span className="text-[#0F1115]">{c.name?.charAt(0).toUpperCase() ?? "?"}</span>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-white truncate">{c.name}</div>
            <div className="text-xs text-[#8B8FA3]">👥 {c.member_count ?? 0} · 🗺️ {c.territory_count ?? 0} Gebiete</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-black" style={{ color: c.color ?? "#22D1C3" }}>{(c.total_xp ?? 0).toLocaleString("de-DE")} XP</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═════════════════ ARENA ═════════════════ */

type Session = { id: string; name: string; starts_at: string; ends_at: string; status: string };
type ArenaRunnerScore = {
  user_id: string; wins: number; losses: number; fusions: number; trophies: number; points: number;
  users: { display_name: string | null; username: string | null; avatar_url: string | null };
};
type ArenaCrewScore = {
  crew_id: string; wins: number; losses: number; points: number;
  crews: { name: string | null; color: string | null; custom_emblem_url: string | null };
};
type PastSession = Session & {
  titles: Array<{ id: string; rank: number; title: string; user_id: string | null; crew_id: string | null;
    users: { username: string | null; display_name: string | null } | null;
    crews: { name: string | null; color: string | null } | null;
  }>;
};

function ArenaTab() {
  const [view, setView] = useState<"current"|"past">("current");
  const [current, setCurrent] = useState<{ session: Session | null; runners: ArenaRunnerScore[]; crews: ArenaCrewScore[] } | null>(null);
  const [past, setPast] = useState<PastSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/arena/session").then((r) => r.json()).catch(() => null),
      fetch("/api/leaderboard/past-sessions").then((r) => r.json()).catch(() => ({ sessions: [] })),
    ]).then(([a, b]) => { setCurrent(a); setPast(b.sessions ?? []); }).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;

  return (
    <div>
      <div className="flex gap-1.5 mb-3">
        <Chip active={view==="current"} onClick={() => setView("current")}>🔥 Aktuelle Session</Chip>
        <Chip active={view==="past"}    onClick={() => setView("past")}>📜 Hall of Fame</Chip>
      </div>

      {view === "current" && (
        !current?.session ? <Empty text="Keine aktive Area-Liga-Session." /> : (
          <div>
            <div className="mb-3 p-3 rounded-xl bg-[#22D1C3]/10 border border-[#22D1C3]/30">
              <div className="text-xs text-[#22D1C3] font-bold tracking-wider">AKTIVE SESSION</div>
              <div className="text-lg font-black text-white">{current.session.name}</div>
              <Countdown endsAt={current.session.ends_at} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="bg-[#1A1D23] border border-white/10 rounded-xl overflow-hidden">
                <div className="px-3 py-2 text-xs font-black tracking-wider text-[#22D1C3] bg-[#22D1C3]/10">🏃 TOP RUNNER</div>
                {(current.runners ?? []).slice(0, 10).map((s, i) => (
                  <Link key={s.user_id} href={`/u/${s.users?.username ?? ""}`} className="flex items-center gap-2 px-3 py-2 border-b border-white/5 last:border-0 hover:bg-white/5">
                    <div className="w-5 text-center text-[10px] font-black" style={{ color: i < 3 ? "#FFD700" : "#8B8FA3" }}>#{i+1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white truncate">{s.users?.display_name ?? s.users?.username}</div>
                      <div className="text-[10px] text-[#8B8FA3]">{s.wins}W/{s.losses}L · {s.trophies}🏆 · {s.fusions}🔁</div>
                    </div>
                    <div className="text-xs font-black text-[#FFD700]">{s.points} P</div>
                  </Link>
                ))}
              </div>
              <div className="bg-[#1A1D23] border border-white/10 rounded-xl overflow-hidden">
                <div className="px-3 py-2 text-xs font-black tracking-wider text-[#FF2D78] bg-[#FF2D78]/10">👥 TOP CREWS</div>
                {(current.crews ?? []).slice(0, 10).map((s, i) => (
                  <div key={s.crew_id} className="flex items-center gap-2 px-3 py-2 border-b border-white/5 last:border-0">
                    <div className="w-5 text-center text-[10px] font-black" style={{ color: i < 3 ? "#FFD700" : "#8B8FA3" }}>#{i+1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white truncate">{s.crews?.name}</div>
                      <div className="text-[10px] text-[#8B8FA3]">{s.wins}W/{s.losses}L</div>
                    </div>
                    <div className="text-xs font-black text-[#FFD700]">{s.points} P</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      )}

      {view === "past" && (
        past.length === 0 ? <Empty text="Noch keine abgeschlossenen Sessions." /> : (
          <div className="space-y-3">
            {past.map((s) => (
              <div key={s.id} className="bg-[#1A1D23] border border-white/10 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-sm font-black text-white">{s.name}</div>
                    <div className="text-[10px] text-[#8B8FA3]">
                      {new Date(s.starts_at).toLocaleDateString("de-DE")} – {new Date(s.ends_at).toLocaleDateString("de-DE")}
                    </div>
                  </div>
                  <div className="text-[10px] px-2 py-0.5 rounded-full bg-[#8B8FA3]/15 text-[#8B8FA3] font-bold">BEENDET</div>
                </div>
                {s.titles.length === 0 ? (
                  <div className="text-[11px] text-[#8B8FA3]">Keine Titel vergeben.</div>
                ) : (
                  <div className="grid gap-1.5 sm:grid-cols-3">
                    {s.titles.slice(0, 6).map((t) => (
                      <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg bg-[#0F1115]">
                        <div className="text-lg">{t.rank===1 ? "🥇" : t.rank===2 ? "🥈" : t.rank===3 ? "🥉" : "🎖️"}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-bold text-white truncate">{t.title}</div>
                          <div className="text-[10px] text-[#8B8FA3] truncate">
                            {t.users?.display_name ?? t.users?.username ?? t.crews?.name ?? "—"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

/* ═════════════════ SHARED ═════════════════ */

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
        active ? "bg-[#22D1C3] text-[#0F1115]" : "bg-white/5 text-[#a8b4cf] hover:text-white border border-white/10"
      }`}>
      {children}
    </button>
  );
}

function FactionBadge({ icon, label, color }: { icon: string; label: string; color: string }) {
  return <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: `${color}15`, color }}>{icon} {label}</span>;
}

function Loading() { return <div className="p-10 text-center text-sm text-[#8B8FA3]">Lade…</div>; }
function Empty({ text }: { text: string }) { return <div className="p-10 text-center text-sm text-[#8B8FA3]">{text}</div>; }

function Countdown({ endsAt }: { endsAt: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(id); }, []);
  const diff = new Date(endsAt).getTime() - now;
  if (diff <= 0) return <div className="text-xs text-[#FF2D78] font-bold">Session beendet</div>;
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  return <div className="text-xs text-[#FFD700] font-bold">⏳ Noch {d}d {h}h</div>;
}
