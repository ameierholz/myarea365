"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { getNumberLocale, getDateLocale } from "@/i18n/config";

type TabId = "runners" | "guardians" | "factions" | "crews" | "arena" | "arena-fights" | "kiez";
type LBT = ReturnType<typeof useTranslations<"Leaderboard">>;

export function LeaderboardTabs() {
  const t = useTranslations("Leaderboard");
  const [tab, setTab] = useState<TabId>("runners");
  const TABS: Array<{ id: TabId; label: string }> = [
    { id: "runners",       label: t("tabRunners") },
    { id: "guardians",     label: t("tabGuardians") },
    { id: "factions",      label: t("tabFactions") },
    { id: "crews",         label: t("tabCrews") },
    { id: "arena-fights",  label: t("tabArenaFights") },
    { id: "arena",         label: t("tabArena") },
    { id: "kiez",          label: t("tabKiez") },
  ];
  return (
    <div>
      <div className="flex gap-2 mb-5 flex-wrap justify-center">
        {TABS.map((tt) => (
          <button key={tt.id} onClick={() => setTab(tt.id)}
            className={`px-3 py-2 rounded-lg text-sm font-bold transition ${
              tab === tt.id
                ? "bg-[#22D1C3] text-[#0F1115]"
                : "bg-white/5 border border-white/10 text-[#a8b4cf] hover:text-white"
            }`}>
            {tt.label}
          </button>
        ))}
      </div>

      {tab === "runners"      && <RunnersTab />}
      {tab === "guardians"    && <GuardiansTab />}
      {tab === "factions"     && <FactionsTab />}
      {tab === "crews"        && <CrewsTab />}
      {tab === "arena-fights" && <ArenaFightsTab />}
      {tab === "arena"        && <ArenaTab />}
      {tab === "kiez"         && <KiezTab />}
    </div>
  );
}

type Runner = {
  username: string | null;
  display_name: string | null;
  faction: string | null;
  total_distance_m: number | null;
  total_walks: number | null;
  total_xp: number | null;
  wegemuenzen: number | null;
  gebietsruf: number | null;
  sessionehre: number | null;
  level: number | null;
};

type RunnerMetric = "wegemuenzen" | "gebietsruf" | "sessionehre" | "km" | "walks" | "level";

function RunnersTab() {
  const t = useTranslations("Leaderboard");
  const locale = useLocale();
  const numLocale = getNumberLocale(locale);
  const [metric, setMetric] = useState<RunnerMetric>("wegemuenzen");
  const [faction, setFaction] = useState<"all"|"gossenbund"|"kronenwacht">("all");
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
          <Chip active={metric==="wegemuenzen"} onClick={() => setMetric("wegemuenzen")}>{t("metricCoins")}</Chip>
          <Chip active={metric==="gebietsruf"}  onClick={() => setMetric("gebietsruf")}>{t("metricRep")}</Chip>
          <Chip active={metric==="sessionehre"} onClick={() => setMetric("sessionehre")}>{t("metricHonor")}</Chip>
          <Chip active={metric==="km"}    onClick={() => setMetric("km")}>{t("metricKm")}</Chip>
          <Chip active={metric==="walks"} onClick={() => setMetric("walks")}>{t("metricWalks")}</Chip>
          <Chip active={metric==="level"} onClick={() => setMetric("level")}>{t("metricLevel")}</Chip>
        </div>
        <div className="flex gap-1.5">
          <Chip active={faction==="all"}       onClick={() => setFaction("all")}>{t("filterAll")}</Chip>
          <Chip active={faction==="gossenbund"} onClick={() => setFaction("gossenbund")}>{t("filterGossen")}</Chip>
          <Chip active={faction==="kronenwacht"} onClick={() => setFaction("kronenwacht")}>{t("filterKronen")}</Chip>
        </div>
      </div>

      {loading ? <Loading /> : runners.length === 0 ? <Empty text={t("emptyRunners")} /> : (
        <div className="bg-[#1A1D23] border border-white/10 rounded-2xl overflow-hidden">
          {runners.map((r, i) => {
            const km = ((r.total_distance_m ?? 0) / 1000).toFixed(1);
            const color = (r.faction === "syndicate" || r.faction === "gossenbund") ? "#22D1C3" : (r.faction === "vanguard" || r.faction === "kronenwacht") ? "#FFD700" : "#22D1C3";
            const primary = metric === "km" ? `${km} km`
                          : metric === "walks" ? t("valueWalks", { n: (r.total_walks ?? 0).toLocaleString(numLocale) })
                          : metric === "level" ? t("valueLevel", { n: r.level ?? 1 })
                          : metric === "gebietsruf"  ? t("valueRep", { n: (r.gebietsruf ?? 0).toLocaleString(numLocale) })
                          : metric === "sessionehre" ? t("valueHonor", { n: (r.sessionehre ?? 0).toLocaleString(numLocale) })
                          : t("valueCoins", { n: (r.wegemuenzen ?? 0).toLocaleString(numLocale) });
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
                    {(r.faction === "syndicate" || r.faction === "gossenbund") && <FactionBadge icon="🗝️" label={t("factionGossen")} color="#22D1C3" />}
                    {(r.faction === "vanguard"  || r.faction === "kronenwacht") && <FactionBadge icon="👑" label={t("factionKronen")} color="#FFD700" />}
                  </div>
                  <div className="text-xs text-[#8B8FA3]">{t("valueLvlKm", { username: r.username ?? "", level: r.level ?? 1, km })}</div>
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

const TYPE_DEFS: Record<string, { labelKey: "typeInfantry"|"typeCavalry"|"typeMarksman"|"typeMage"; icon: string; color: string }> = {
  infantry: { labelKey: "typeInfantry", icon: "🛡️", color: "#60a5fa" },
  cavalry:  { labelKey: "typeCavalry",  icon: "🐎", color: "#fb923c" },
  marksman: { labelKey: "typeMarksman", icon: "🏹", color: "#4ade80" },
  mage:     { labelKey: "typeMage",     icon: "🔮", color: "#c084fc" },
};
const RARITY_DEFS: Record<string, { labelKey: "rarityElite"|"rarityEpic"|"rarityLegendary"; color: string }> = {
  elite:     { labelKey: "rarityElite",     color: "#22D1C3" },
  epic:      { labelKey: "rarityEpic",      color: "#a855f7" },
  legendary: { labelKey: "rarityLegendary", color: "#FFD700" },
};

function GuardiansTab() {
  const t = useTranslations("Leaderboard");
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
        <Chip active={view==="overall"}   onClick={() => setView("overall")}>{t("viewOverall")}</Chip>
        <Chip active={view==="by_type"}   onClick={() => setView("by_type")}>{t("viewByType")}</Chip>
        <Chip active={view==="by_rarity"} onClick={() => setView("by_rarity")}>{t("viewByRarity")}</Chip>
      </div>

      {view === "overall" && overall && (
        <div className="grid gap-4 md:grid-cols-3">
          <GuardianList title={t("gTopLevel")} rows={overall.top_level} metric={(g) => t("valueLevel", { n: g.level })} />
          <GuardianList title={t("gMostFights")} rows={overall.most_played} metric={(g) => t("fightsLabel", { n: g.wins+g.losses })} />
          <GuardianList title={t("gBestWinrate")} rows={overall.top_win_rate}
            metric={(g) => {
              const total = g.wins + g.losses;
              return total > 0 ? `${Math.round((g.wins / total) * 100)}%` : "—";
            }} />
        </div>
      )}

      {view === "by_type" && byCat && (
        <div className="grid gap-4 md:grid-cols-2">
          {byCat.by_type.map((bt) => {
            const m = TYPE_DEFS[bt.type];
            const label = m ? t(m.labelKey) : bt.type;
            return <GuardianList key={bt.type} title={`${m?.icon ?? ""} ${label}`} rows={bt.rows} metric={(g) => t("valueLevel", { n: g.level })} accent={m?.color} />;
          })}
        </div>
      )}

      {view === "by_rarity" && byCat && (
        <div className="grid gap-4 md:grid-cols-3">
          {byCat.by_rarity.map((br) => {
            const m = RARITY_DEFS[br.rarity];
            const label = m ? t(m.labelKey) : br.rarity;
            return <GuardianList key={br.rarity} title={label} rows={br.rows} metric={(g) => t("valueLevel", { n: g.level })} accent={m?.color} />;
          })}
        </div>
      )}
    </div>
  );
}

function GuardianList({ title, rows, metric, accent = "#22D1C3" }: { title: string; rows: GuardianRow[]; metric: (g: GuardianRow) => string; accent?: string }) {
  const t = useTranslations("Leaderboard");
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
              <div className="text-[10px] text-[#8B8FA3] truncate">@{g.users?.username ?? "—"} · {t("winLossLabel", { w: g.wins, l: g.losses })}</div>
            </div>
            <div className="text-xs font-black" style={{ color: accent }}>{metric(g)}</div>
          </Link>
        ))
      )}
    </div>
  );
}

type Faction = {
  id: string; name: string; emoji: string; color: string;
  runners: number; total_xp: number; total_km: number; avg_level: number;
};

function FactionsTab() {
  const t = useTranslations("Leaderboard");
  const locale = useLocale();
  const numLocale = getNumberLocale(locale);
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
                <div className="text-xs text-[#8B8FA3]">{t("factionsRunnersLine", { n: f.runners.toLocaleString(numLocale), lvl: f.avg_level })}</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-black" style={{ color: f.color }}>{share}%</div>
                <div className="text-[10px] text-[#8B8FA3]">{t("coinShare")}</div>
              </div>
            </div>
            <div className="h-2 bg-[#0F1115] rounded overflow-hidden mb-3">
              <div className="h-full transition-all" style={{ width: `${share}%`, background: f.color }} />
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <div className="text-xs text-[#8B8FA3]">{t("totalCoins")}</div>
                <div className="text-sm font-bold text-white">{f.total_xp.toLocaleString(numLocale)}</div>
              </div>
              <div>
                <div className="text-xs text-[#8B8FA3]">{t("totalKm")}</div>
                <div className="text-sm font-bold text-white">{f.total_km.toLocaleString(numLocale)}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

type Crew = {
  id: string; name: string; color: string | null; custom_emblem_url: string | null;
  total_xp: number | null; member_count: number | null; territory_count: number | null;
};

function CrewsTab() {
  const t = useTranslations("Leaderboard");
  const locale = useLocale();
  const numLocale = getNumberLocale(locale);
  const [crews, setCrews] = useState<Crew[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leaderboard/crews").then((r) => r.json()).then((d) => setCrews(d.crews ?? [])).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (crews.length === 0) return <Empty text={t("emptyCrews")} />;

  return (
    <div className="bg-[#1A1D23] border border-white/10 rounded-2xl overflow-hidden">
      {crews.map((c, i) => (
        <div key={c.id} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0">
          <div className="w-8 text-center text-xs font-black" style={{ color: i < 3 ? "#FFD700" : "#8B8FA3" }}>#{i+1}</div>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center font-black" style={{ background: c.color ?? "#22D1C3" }}>
            {c.custom_emblem_url
              /* eslint-disable-next-line @next/next/no-img-element */
              ? <img src={c.custom_emblem_url} alt={c.name} className="w-full h-full object-cover rounded-lg" />
              : <span className="text-[#0F1115]">{c.name?.charAt(0).toUpperCase() ?? "?"}</span>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-white truncate">{c.name}</div>
            <div className="text-xs text-[#8B8FA3]">{t("crewMeta", { members: c.member_count ?? 0, territories: c.territory_count ?? 0 })}</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-black" style={{ color: c.color ?? "#22D1C3" }}>{t("valueCoins", { n: (c.total_xp ?? 0).toLocaleString(numLocale) })}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ArenaFightsTab() {
  const t = useTranslations("Leaderboard");
  const locale = useLocale();
  const numLocale = getNumberLocale(locale);
  const [rows, setRows] = useState<HallOfHonorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"honor" | "wins" | "winrate">("honor");

  useEffect(() => {
    setLoading(true);
    fetch("/api/leaderboard/hall-of-honor")
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;

  const sorted = [...rows].sort((a, b) => {
    if (sortBy === "wins") return b.wins - a.wins;
    if (sortBy === "winrate") {
      const wa = a.wins + a.losses > 0 ? a.wins / (a.wins + a.losses) : 0;
      const wb = b.wins + b.losses > 0 ? b.wins / (b.wins + b.losses) : 0;
      return wb - wa;
    }
    return b.honor - a.honor;
  });

  const topThree = sorted.slice(0, 3);

  return (
    <div>
      <div className="mb-4 p-4 rounded-xl border border-[#FFD700]/30" style={{
        background: "radial-gradient(ellipse at top, rgba(255,107,74,0.15) 0%, transparent 60%), linear-gradient(180deg, rgba(255,215,0,0.08) 0%, rgba(15,17,21,0.9) 100%)",
      }}>
        <div className="flex items-center gap-3">
          <div className="text-3xl">⚔️</div>
          <div className="flex-1">
            <div className="text-[10px] font-black tracking-widest text-[#FFD700]">{t("arenaKicker")}</div>
            <div className="text-lg font-black text-white">{t("arenaTitle")}</div>
            <div className="text-xs text-[#a8b4cf]">{t("arenaSubtitle")}</div>
          </div>
        </div>
      </div>

      {topThree.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[topThree[1], topThree[0], topThree[2]].filter(Boolean).map((r) => {
            const actualRank = r === topThree[0] ? 1 : r === topThree[1] ? 2 : 3;
            const medal = actualRank === 1 ? "🥇" : actualRank === 2 ? "🥈" : "🥉";
            const color = actualRank === 1 ? "#FFD700" : actualRank === 2 ? "#C0C0C0" : "#CD7F32";
            const height = actualRank === 1 ? 120 : actualRank === 2 ? 100 : 80;
            return (
              <div key={r.user_id} className="flex flex-col items-center justify-end">
                <div style={{ fontSize: 32 }}>{medal}</div>
                <div className="text-xs font-black text-white text-center truncate w-full px-1" title={r.display_name ?? r.username ?? ""}>
                  {r.display_name ?? r.username}
                </div>
                <div className="text-[10px] text-[#8B8FA3] mb-1">{t("podiumWinsLevel", { w: r.wins, level: r.level })}</div>
                <div style={{
                  width: "100%", height,
                  background: `linear-gradient(180deg, ${color}dd 0%, ${color}55 100%)`,
                  borderRadius: "8px 8px 0 0",
                  border: `1px solid ${color}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexDirection: "column",
                  boxShadow: `0 0 16px ${color}55`,
                }}>
                  <div className="text-xs font-black" style={{ color: "#0F1115" }}>#{actualRank}</div>
                  <div className="text-[10px] font-black" style={{ color: "#0F1115" }}>{r.honor.toLocaleString(numLocale)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-1.5 mb-3 flex-wrap">
        <Chip active={sortBy==="honor"}   onClick={() => setSortBy("honor")}>{t("sortHonor")}</Chip>
        <Chip active={sortBy==="wins"}    onClick={() => setSortBy("wins")}>{t("sortWins")}</Chip>
        <Chip active={sortBy==="winrate"} onClick={() => setSortBy("winrate")}>{t("sortWinrate")}</Chip>
      </div>

      {sorted.length === 0 ? (
        <Empty text={t("emptyFights")} />
      ) : (
        <HallOfHonorView rows={sorted} t={t} numLocale={numLocale} />
      )}
    </div>
  );
}

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

type HallOfHonorRow = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  level: number;
  faction: string | null;
  crew_name: string | null;
  crew_color: string | null;
  wins: number;
  losses: number;
  honor: number;
};

function ArenaTab() {
  const t = useTranslations("Leaderboard");
  const locale = useLocale();
  const numLocale = getNumberLocale(locale);
  const dateLocale = getDateLocale(locale);
  const [view, setView] = useState<"current"|"past"|"honor">("current");
  const [current, setCurrent] = useState<{ session: Session | null; runners: ArenaRunnerScore[]; crews: ArenaCrewScore[] } | null>(null);
  const [past, setPast] = useState<PastSession[]>([]);
  const [honor, setHonor] = useState<HallOfHonorRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/arena/session").then((r) => r.json()).catch(() => null),
      fetch("/api/leaderboard/past-sessions").then((r) => r.json()).catch(() => ({ sessions: [] })),
      fetch("/api/leaderboard/hall-of-honor").then((r) => r.json()).catch(() => ({ rows: [] })),
    ]).then(([a, b, c]) => { setCurrent(a); setPast(b.sessions ?? []); setHonor(c.rows ?? []); }).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;

  return (
    <div>
      <div className="flex gap-1.5 mb-3 flex-wrap">
        <Chip active={view==="current"} onClick={() => setView("current")}>{t("viewCurrent")}</Chip>
        <Chip active={view==="honor"}   onClick={() => setView("honor")}>{t("viewHonor")}</Chip>
        <Chip active={view==="past"}    onClick={() => setView("past")}>{t("viewPast")}</Chip>
      </div>

      {view === "honor" && <HallOfHonorView rows={honor} t={t} numLocale={numLocale} />}

      {view === "current" && (
        !current?.session ? <Empty text={t("emptyArenaSession")} /> : (
          <div>
            <div className="mb-3 p-3 rounded-xl bg-[#22D1C3]/10 border border-[#22D1C3]/30">
              <div className="text-xs text-[#22D1C3] font-bold tracking-wider">{t("activeSessionKicker")}</div>
              <div className="text-lg font-black text-white">{current.session.name}</div>
              <Countdown endsAt={current.session.ends_at} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="bg-[#1A1D23] border border-white/10 rounded-xl overflow-hidden">
                <div className="px-3 py-2 text-xs font-black tracking-wider text-[#22D1C3] bg-[#22D1C3]/10">{t("topRunner")}</div>
                {(current.runners ?? []).slice(0, 10).map((s, i) => (
                  <Link key={s.user_id} href={`/u/${s.users?.username ?? ""}`} className="flex items-center gap-2 px-3 py-2 border-b border-white/5 last:border-0 hover:bg-white/5">
                    <div className="w-5 text-center text-[10px] font-black" style={{ color: i < 3 ? "#FFD700" : "#8B8FA3" }}>#{i+1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white truncate">{s.users?.display_name ?? s.users?.username}</div>
                      <div className="text-[10px] text-[#8B8FA3]">{t("arenaRunnerMeta", { w: s.wins, l: s.losses, trophies: s.trophies, fusions: s.fusions })}</div>
                    </div>
                    <div className="text-xs font-black text-[#FFD700]">{t("pointsShort", { n: s.points })}</div>
                  </Link>
                ))}
              </div>
              <div className="bg-[#1A1D23] border border-white/10 rounded-xl overflow-hidden">
                <div className="px-3 py-2 text-xs font-black tracking-wider text-[#FF2D78] bg-[#FF2D78]/10">{t("topCrews")}</div>
                {(current.crews ?? []).slice(0, 10).map((s, i) => (
                  <div key={s.crew_id} className="flex items-center gap-2 px-3 py-2 border-b border-white/5 last:border-0">
                    <div className="w-5 text-center text-[10px] font-black" style={{ color: i < 3 ? "#FFD700" : "#8B8FA3" }}>#{i+1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white truncate">{s.crews?.name}</div>
                      <div className="text-[10px] text-[#8B8FA3]">{t("winLossLabel", { w: s.wins, l: s.losses })}</div>
                    </div>
                    <div className="text-xs font-black text-[#FFD700]">{t("pointsShort", { n: s.points })}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      )}

      {view === "past" && (
        past.length === 0 ? <Empty text={t("emptyPastSessions")} /> : (
          <div className="space-y-3">
            {past.map((s) => (
              <div key={s.id} className="bg-[#1A1D23] border border-white/10 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-sm font-black text-white">{s.name}</div>
                    <div className="text-[10px] text-[#8B8FA3]">
                      {t("pastDateRange", {
                        start: new Date(s.starts_at).toLocaleDateString(dateLocale),
                        end: new Date(s.ends_at).toLocaleDateString(dateLocale),
                      })}
                    </div>
                  </div>
                  <div className="text-[10px] px-2 py-0.5 rounded-full bg-[#8B8FA3]/15 text-[#8B8FA3] font-bold">{t("pastEndedBadge")}</div>
                </div>
                {s.titles.length === 0 ? (
                  <div className="text-[11px] text-[#8B8FA3]">{t("noTitles")}</div>
                ) : (
                  <div className="grid gap-1.5 sm:grid-cols-3">
                    {s.titles.slice(0, 6).map((tl) => (
                      <div key={tl.id} className="flex items-center gap-2 p-2 rounded-lg bg-[#0F1115]">
                        <div className="text-lg">{tl.rank===1 ? "🥇" : tl.rank===2 ? "🥈" : tl.rank===3 ? "🥉" : "🎖️"}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-bold text-white truncate">{tl.title}</div>
                          <div className="text-[10px] text-[#8B8FA3] truncate">
                            {tl.users?.display_name ?? tl.users?.username ?? tl.crews?.name ?? "—"}
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

function HallOfHonorView({ rows, t, numLocale }: { rows: HallOfHonorRow[]; t: LBT; numLocale: string }) {
  if (rows.length === 0) {
    return <Empty text={t("emptyFights")} />;
  }
  return (
    <div className="rounded-xl overflow-hidden border border-[#FFD700]/30" style={{
      background: "linear-gradient(180deg, rgba(255,215,0,0.06) 0%, rgba(15,17,21,0.95) 100%)",
    }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "48px 1fr 1.2fr 60px 100px",
        gap: 8, padding: "10px 12px",
        background: "linear-gradient(180deg, rgba(255,215,0,0.15), rgba(255,215,0,0.05))",
        borderBottom: "1px solid rgba(255,215,0,0.3)",
        fontSize: 10, fontWeight: 900, letterSpacing: 1.5, color: "#FFD700",
      }}>
        <div>{t("thRank")}</div>
        <div>{t("thName")}</div>
        <div>{t("thCrew")}</div>
        <div className="text-right">{t("thLevel")}</div>
        <div className="text-right">{t("thHonor")}</div>
      </div>

      {rows.map((r, i) => {
        const bgColor = i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)";
        const rankColor = i === 0 ? "#FFD700" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : "#8B8FA3";
        const flagEmoji = i < 3 ? "👑" : "🇩🇪";
        const factionColor = (r.faction === "syndicate" || r.faction === "gossenbund") ? "#22D1C3" : (r.faction === "vanguard" || r.faction === "kronenwacht") ? "#FFD700" : "#F0F0F0";
        return (
          <div key={r.user_id} style={{
            display: "grid",
            gridTemplateColumns: "48px 1fr 1.2fr 60px 100px",
            gap: 8, padding: "8px 12px",
            background: bgColor,
            borderBottom: "1px solid rgba(255,255,255,0.04)",
            alignItems: "center",
            fontSize: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ color: rankColor, fontWeight: 900, minWidth: 22 }}>{i + 1}</span>
              <span style={{ fontSize: 14 }}>{flagEmoji}</span>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: factionColor, fontWeight: 900, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.display_name ?? r.username ?? "—"}
              </div>
              <div style={{ color: "#8B8FA3", fontSize: 10 }}>
                {t("winLossLabel", { w: r.wins, l: r.losses })}
              </div>
            </div>
            <div style={{ minWidth: 0 }}>
              {r.crew_name ? (
                <span style={{
                  display: "inline-block", padding: "2px 8px", borderRadius: 999,
                  background: `${r.crew_color ?? "#8B8FA3"}15`,
                  border: `1px solid ${r.crew_color ?? "#8B8FA3"}44`,
                  color: r.crew_color ?? "#F0F0F0",
                  fontSize: 11, fontWeight: 700,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%",
                }}>[{r.crew_name}]</span>
              ) : (
                <span style={{ color: "#4a5370", fontSize: 10 }}>—</span>
              )}
            </div>
            <div className="text-right" style={{ color: "#F0F0F0", fontWeight: 700 }}>{r.level}</div>
            <div className="text-right" style={{ color: "#FFD700", fontWeight: 900, fontSize: 13, fontFamily: "ui-monospace, monospace" }}>
              {r.honor.toLocaleString(numLocale)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

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

function Loading() {
  const t = useTranslations("Leaderboard");
  return <div className="p-10 text-center text-sm text-[#8B8FA3]">{t("loading")}</div>;
}
function Empty({ text }: { text: string }) { return <div className="p-10 text-center text-sm text-[#8B8FA3]">{text}</div>; }

function Countdown({ endsAt }: { endsAt: string }) {
  const t = useTranslations("Leaderboard");
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(id); }, []);
  const diff = new Date(endsAt).getTime() - now;
  if (diff <= 0) return <div className="text-xs text-[#FF2D78] font-bold">{t("sessionEnded")}</div>;
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  return <div className="text-xs text-[#FFD700] font-bold">{t("sessionRemaining", { d, h })}</div>;
}

type KiezKing = {
  plz: string;
  user_id: string;
  display_name: string | null;
  username: string | null;
  heimat_plz: string | null;
  total_km: number;
  segments: number;
  week_start: string;
};

type KiezRankingRow = {
  rank: number;
  user_id: string;
  display_name: string | null;
  username: string | null;
  heimat_plz: string | null;
  total_km: number;
  segments: number;
};

function KiezTab() {
  const t = useTranslations("Leaderboard");
  const [kings, setKings] = useState<KiezKing[] | null>(null);
  const [selectedPlz, setSelectedPlz] = useState<string | null>(null);
  const [ranking, setRanking] = useState<KiezRankingRow[] | null>(null);
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/leaderboard/kiez", { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json();
      setKings(j.kings ?? []);
    })();
  }, []);

  useEffect(() => {
    if (!selectedPlz) { setRanking(null); return; }
    (async () => {
      const r = await fetch(`/api/leaderboard/kiez?plz=${selectedPlz}`, { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json();
      setRanking(j.ranking ?? []);
      setWeekStart(j.week_start ?? null);
    })();
  }, [selectedPlz]);

  if (kings === null) return <Empty text={t("kiezLoading")} />;

  const filtered = filter
    ? kings.filter((k) => k.plz.startsWith(filter) || (k.display_name ?? k.username ?? "").toLowerCase().includes(filter.toLowerCase()))
    : kings;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">👑</span>
          <div className="flex-1">
            <div className="font-bold text-[#FFD700]">{t("kiezTitle")}</div>
            <div className="text-xs text-[#a8b4cf] mt-0.5 leading-relaxed">
              {t("kiezBody")}
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <input
          type="text" inputMode="numeric" maxLength={5}
          value={filter}
          onChange={(e) => setFilter(e.target.value.replace(/\D/g, "").slice(0, 5))}
          placeholder={t("kiezSearchPh")}
          className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-[#22D1C3]/50"
        />
        {selectedPlz && (
          <button onClick={() => setSelectedPlz(null)} className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-[#a8b4cf] hover:text-white">
            {t("kiezBack")}
          </button>
        )}
      </div>

      {selectedPlz && ranking !== null && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-baseline justify-between">
            <div>
              <span className="text-sm font-bold">📍 {selectedPlz}</span>
              <span className="text-[11px] text-[#8B8FA3] ml-2">{t("kiezRunningWeek", { date: weekStart ?? "—" })}</span>
            </div>
            <span className="text-[10px] text-[#8B8FA3]">{t("kiezTop10")}</span>
          </div>
          {ranking.length === 0 ? (
            <Empty text={t("kiezNoActivity")} />
          ) : (
            <div className="divide-y divide-white/5">
              {ranking.map((row) => {
                const name = row.display_name ?? row.username ?? t("unknown");
                const isKing = row.rank === 1;
                return (
                  <div key={row.user_id} className="flex items-center gap-3 px-4 py-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isKing ? "bg-[#FFD700]/20 text-[#FFD700] border border-[#FFD700]/40" : "bg-white/5 text-[#a8b4cf]"}`}>
                      {isKing ? "👑" : row.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{name}{row.heimat_plz && <span className="ml-2 text-[10px] text-[#22D1C3]">📍{row.heimat_plz}</span>}</div>
                      <div className="text-[11px] text-[#8B8FA3]">{t("kiezSegments", { n: row.segments })}</div>
                    </div>
                    <div className="text-sm font-bold text-[#22D1C3]">{t("kiezKm", { km: row.total_km.toFixed(2) })}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!selectedPlz && (
        filtered.length === 0 ? (
          <Empty text={kings.length === 0 ? t("kiezNoCrowns") : t("kiezNoMatches")} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filtered.map((k) => {
              const name = k.display_name ?? k.username ?? t("unknown");
              return (
                <button
                  key={k.plz}
                  onClick={() => setSelectedPlz(k.plz)}
                  className="text-left p-3 rounded-xl border border-white/10 bg-gradient-to-br from-[#FFD700]/10 to-transparent hover:border-[#FFD700]/40 transition"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-bold">📍 {k.plz}</span>
                    <span className="text-xl">👑</span>
                  </div>
                  <div className="font-semibold truncate text-sm">{name}</div>
                  <div className="flex justify-between items-baseline mt-1">
                    <span className="text-[11px] text-[#8B8FA3]">{t("kiezSegments", { n: k.segments })}</span>
                    <span className="text-sm font-bold text-[#FFD700]">{t("kiezKm", { km: k.total_km.toFixed(2) })}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
