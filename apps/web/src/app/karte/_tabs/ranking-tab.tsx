"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  type Profile,
  type RankingMode,
  type GeoLevel,
  BG_DEEP,
  BORDER,
  MUTED,
  PRIMARY,
  ACCENT,
  GEO_LEVEL_SEQ,
  GEO_LABEL,
  GEO_ICON,
  inputStyle,
  breadcrumbStyle,
  CountryFlag,
  LeagueBadge,
  FilterPill,
  MEDALS,
  ARENA_TYPE_META,
} from "./_shared";
import {
  DEMO_RANKING_RUNNERS,
  DEMO_NEARBY_CREWS,
  DEMO_FACTION_RANKING,
  LEAGUE_TIERS,
  RUNNER_RANKS,
  CREW_TYPES,
  groupCrewsByLevel,
  groupFactionsByLevel,
  leagueTierFor,
  getRunnerGuardian,
  emojiForContinent,
  type FactionCityStats,
  type FactionBucket,
  type NearbyCrew,
} from "@/lib/game-config";
import { MMR_TIERS, type MmrTier } from "@/lib/mmr-tiers";
import { GUARDIAN_CLASSES, legacyTypeToClass, type GuardianClass } from "@/lib/guardian-classes";
import { normalizeFaction } from "@/lib/factions";
import { useRankArt, RankBadge, rankIdByName } from "@/components/rank-badge";
import { GuardianAvatar } from "@/components/guardian-avatar";
import { SupporterBadge } from "@/components/supporter-badge";
import { AdSenseSlot } from "@/components/adsense-slot";

type RankingSortRunner = "weekly_xp" | "weekly_km" | "total_xp";
type RankingSortCrew = "weekly_km" | "member_count";

function FactionTile({ which, stats, leads, total }: {
  which: "n" | "s";
  stats: { runners: number; km_week: number; territories: number };
  leads: boolean;
  total: number;
}) {
  const color = which === "n" ? "#22D1C3" : "#FFD700";
  const icon = which === "n" ? "🗝️" : "👑";
  const name = which === "n" ? "Gossenbund" : "Kronenwacht";
  const pct = total > 0 ? (stats.km_week / total) * 100 : 50;
  return (
    <div style={{
      flex: 1, minWidth: 0,
      padding: 16, borderRadius: 14,
      background: `linear-gradient(135deg, ${color}22, ${color}08)`,
      border: `1px solid ${leads ? color : BORDER}`,
      boxShadow: leads ? `0 0 24px ${color}33` : "none",
      position: "relative",
    }}>
      {leads && (
        <div style={{
          position: "absolute", top: 10, right: 10,
          background: color, color: "#0F1115",
          fontSize: 9, fontWeight: 900, letterSpacing: 0.5,
          padding: "3px 7px", borderRadius: 999,
        }}>FÜHRT</div>
      )}
      <div style={{ fontSize: 32, marginBottom: 6 }}>{icon}</div>
      <div style={{ color, fontSize: 16, fontWeight: 900, marginBottom: 10 }}>{name}</div>
      <div style={{ color: "#FFF", fontSize: 24, fontWeight: 900, lineHeight: 1 }}>{stats.km_week.toFixed(0)} <span style={{ fontSize: 12, color: MUTED, fontWeight: 700 }}>km</span></div>
      <div style={{ color: MUTED, fontSize: 10, marginTop: 2, marginBottom: 10 }}>diese Woche · {pct.toFixed(0)} %</div>
      <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#F0F0F0" }}>
        <div>👤 <b>{stats.runners}</b> <span style={{ color: MUTED }}>Runner</span></div>
        <div>🗺️ <b>{stats.territories}</b> <span style={{ color: MUTED }}>Gebiete</span></div>
      </div>
    </div>
  );
}

function FactionLeaderRow({ label, icon, nKm, sKm }: { label: string; icon: React.ReactNode; nKm: number; sKm: number }) {
  const leader = nKm >= sKm ? "n" : "s";
  const color = leader === "n" ? "#22D1C3" : "#FFD700";
  const leaderName = leader === "n" ? "🗝️ Gossenbund" : "👑 Kronenwacht";
  const diff = Math.abs(nKm - sKm);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 12px", borderRadius: 10,
      background: "rgba(20, 26, 44, 0.6)", border: `1px solid ${BORDER}`,
    }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ color: "#FFF", fontSize: 13, fontWeight: 700, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {label}
      </span>
      <span style={{ color, fontSize: 11, fontWeight: 800 }}>
        {leaderName} <span style={{ color: MUTED, fontWeight: 700 }}>+{diff.toFixed(0)} km</span>
      </span>
    </div>
  );
}

function AnimatedDuelBar({ nKm, sKm }: { nKm: number; sKm: number }) {
  const total = nKm + sKm;
  const targetPct = total > 0 ? (nKm / total) * 100 : 50;
  const [pct, setPct] = useState(50);
  useEffect(() => {
    const t = setTimeout(() => setPct(targetPct), 60);
    return () => clearTimeout(t);
  }, [targetPct]);
  const diff = Math.abs(nKm - sKm);
  const leader = nKm >= sKm ? "n" : "s";
  return (
    <div style={{ padding: "16px 18px", borderRadius: 14, background: "rgba(30, 38, 60, 0.55)", border: `1px solid ${BORDER}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 12 }}>
        <span style={{ color: "#22D1C3", fontWeight: 900 }}>🗝️ {nKm.toFixed(0)} km</span>
        <span style={{ flex: 1, textAlign: "center", color: leader === "n" ? "#22D1C3" : "#FFD700", fontSize: 10, fontWeight: 800, letterSpacing: 0.5 }}>
          {leader === "n" ? "🗝️ FÜHRT" : "👑 FÜHRT"} · +{diff.toFixed(0)} km
        </span>
        <span style={{ color: "#FFD700", fontWeight: 900 }}>{sKm.toFixed(0)} km 👑</span>
      </div>
      <div style={{ position: "relative", height: 18, borderRadius: 9, overflow: "hidden", background: "rgba(255,255,255,0.06)" }}>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex",
        }}>
          <div style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, #22D1C3, #22D1C3dd)",
            boxShadow: "inset 0 0 18px rgba(34,209,195,0.6)",
            transition: "width 1200ms cubic-bezier(0.22, 1, 0.36, 1)",
            position: "relative", overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)",
              animation: "duel-shimmer 2.5s infinite",
            }} />
          </div>
          <div style={{
            flex: 1,
            background: "linear-gradient(90deg, #FFD700dd, #FFD700)",
            boxShadow: "inset 0 0 18px rgba(255,215,0,0.6)",
            position: "relative", overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)",
              animation: "duel-shimmer 2.5s infinite",
            }} />
          </div>
        </div>
        <div style={{
          position: "absolute", left: `${pct}%`, top: -2, bottom: -2,
          width: 3, background: "#FFF", boxShadow: "0 0 12px rgba(255,255,255,0.8)",
          transform: "translateX(-50%)",
          transition: "left 1200ms cubic-bezier(0.22, 1, 0.36, 1)",
        }} />
      </div>
      <style>{`@keyframes duel-shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }`}</style>
    </div>
  );
}

function FactionDuelView({ items, buckets, scopeLabel }: {
  items: FactionCityStats[]; buckets: FactionBucket[]; scopeLabel: string;
}) {
  const n = {
    runners: items.reduce((s, x) => s + x.nachtpuls.runners, 0),
    km_week: items.reduce((s, x) => s + x.nachtpuls.km_week, 0),
    territories: items.reduce((s, x) => s + x.nachtpuls.territories, 0),
  };
  const s = {
    runners: items.reduce((s, x) => s + x.sonnenwacht.runners, 0),
    km_week: items.reduce((s, x) => s + x.sonnenwacht.km_week, 0),
    territories: items.reduce((s, x) => s + x.sonnenwacht.territories, 0),
  };
  const total = n.km_week + s.km_week;
  const nLeads = n.km_week >= s.km_week;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ color: MUTED, fontSize: 11, fontWeight: 800, letterSpacing: 0.5 }}>
        ⚔️ {scopeLabel.toUpperCase()}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <FactionTile which="n" stats={n} leads={nLeads} total={total} />
        <FactionTile which="s" stats={s} leads={!nLeads} total={total} />
      </div>
      <AnimatedDuelBar nKm={n.km_week} sKm={s.km_week} />
      {buckets.length > 1 && (
        <>
          <div style={{ color: MUTED, fontSize: 11, fontWeight: 800, marginTop: 6, letterSpacing: 0.5 }}>
            WER FÜHRT WO
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {buckets.map((b) => (
              <FactionLeaderRow
                key={b.key}
                label={b.label}
                icon="›"
                nKm={b.nachtpuls.km_week}
                sKm={b.sonnenwacht.km_week}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

type GuardianArt = { id: string; emoji: string; image_url: string | null; video_url: string | null };

export function RankingTab({ profile: p, leaderboard, initialMode }: { profile: Profile | null; leaderboard: Profile[]; initialMode?: RankingMode }) {
  void leaderboard;
  const tR = useTranslations("Ranking");
  const [mode, setMode] = useState<RankingMode>(initialMode ?? "runners");
  const [guardianArt, setGuardianArt] = useState<Record<string, GuardianArt>>({});
  useEffect(() => {
    const ids = Array.from(new Set(
      DEMO_RANKING_RUNNERS.map((r) => getRunnerGuardian(r.id)?.id).filter((x): x is string => !!x),
    ));
    if (ids.length === 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/guardian/archetypes-public?ids=${ids.join(",")}`, { cache: "no-store" });
        if (!res.ok) return;
        const j = await res.json() as { archetypes?: GuardianArt[] };
        if (!cancelled && j.archetypes) {
          const map: Record<string, GuardianArt> = {};
          for (const a of j.archetypes) map[a.id] = a;
          setGuardianArt(map);
        }
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, []);
  const [filters, setFilters] = useState<Partial<Record<GeoLevel, string>>>({});
  const [search, setSearch] = useState("");
  const [leagueFilter, setLeagueFilter] = useState<string | null>(null);
  const [sortRunner, setSortRunner] = useState<RankingSortRunner>("weekly_xp");
  const [sortCrew, setSortCrew] = useState<RankingSortCrew>("weekly_km");

  const [isWide, setIsWide] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 860px)");
    setIsWide(mq.matches);
    const h = (e: MediaQueryListEvent) => setIsWide(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  // Live- oder Demo-Runner verwenden — wenn Supabase-Leaderboard leer, Demo
  const runnerPool = DEMO_RANKING_RUNNERS;
  const crewPool = DEMO_NEARBY_CREWS;

  const filteredRunners = runnerPool.filter((r) => {
    for (const lvl of GEO_LEVEL_SEQ) {
      const f = filters[lvl];
      if (f && r[lvl] !== f) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      const hay = [r.display_name, r.username, r.crew_name || "", r.city, r.region, r.country].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => b[sortRunner] - a[sortRunner]);

  const factionPool: FactionCityStats[] = DEMO_FACTION_RANKING;
  const filteredFactions = factionPool.filter((it) => {
    for (const lvl of GEO_LEVEL_SEQ) {
      const f = filters[lvl];
      if (f && it[lvl] !== f) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      const hay = [it.city, it.region, it.state, it.country].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const filteredCrews = crewPool.filter((c) => {
    for (const lvl of GEO_LEVEL_SEQ) {
      const f = filters[lvl];
      if (f && c[lvl] !== f) return false;
    }
    if (leagueFilter && leagueTierFor(c.weekly_km).id !== leagueFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = [c.name, c.motto, c.city, c.region, c.country].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => b[sortCrew] - a[sortCrew]);

  const trail: { level: GeoLevel; label: string }[] = [];
  for (const lvl of GEO_LEVEL_SEQ) {
    if (filters[lvl]) trail.push({ level: lvl, label: filters[lvl]! });
  }
  const activeLevelIdx = GEO_LEVEL_SEQ.findIndex((l) => !filters[l]);
  const nextLevel: GeoLevel | null = activeLevelIdx >= 0 ? GEO_LEVEL_SEQ[activeLevelIdx] : null;
  const buckets = nextLevel
    ? (mode === "runners"
        ? groupRunnersByLevel(filteredRunners, nextLevel)
        : mode === "crews"
          ? groupCrewsByLevel(filteredCrews, nextLevel)
          : groupFactionsByLevel(filteredFactions, nextLevel))
    : [];
  const factionBuckets: FactionBucket[] = mode === "factions" && nextLevel
    ? groupFactionsByLevel(filteredFactions, nextLevel)
    : [];

  function setFilter(level: GeoLevel, value: string) {
    const idx = GEO_LEVEL_SEQ.indexOf(level);
    const next: Partial<Record<GeoLevel, string>> = {};
    for (let i = 0; i <= idx; i++) {
      const l = GEO_LEVEL_SEQ[i];
      next[l] = l === level ? value : filters[l];
    }
    setFilters(next);
  }
  function clearAll() {
    setFilters({}); setSearch(""); setLeagueFilter(null);
  }

  const scopeLabel = trail.length ? trail[trail.length - 1].label : tR("scopeWorld");
  const activeFilterCount =
    Object.values(filters).filter(Boolean).length +
    (leagueFilter ? 1 : 0) + (search ? 1 : 0);

  // Meine Position in der Liste finden
  const myPositionRunner = p?.username
    ? filteredRunners.findIndex((r) => r.username === p.username)
    : -1;
  const myRunnerRow = myPositionRunner >= 0 ? filteredRunners[myPositionRunner] : null;

  return (
    <div style={{ padding: "20px 20px 40px", width: "100%", maxWidth: 1100, margin: "0 auto" }}>
      {/* Kompakter Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
        <div style={{ color: "#FFF", fontSize: 22, fontWeight: 900, display: "flex", alignItems: "center", gap: 8 }}>
          {tR("title")}
          <span style={{
            padding: "2px 8px", borderRadius: 999, fontSize: 9, fontWeight: 900, letterSpacing: 1.5,
            background: "rgba(168,85,247,0.2)", border: "1px solid rgba(168,85,247,0.5)", color: "#c084fc",
          }}>{tR("demoBadge")}</span>
        </div>
        {scopeLabel !== tR("scopeWorld") && (
          <button onClick={clearAll} style={{
            padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800,
            background: "rgba(255,45,120,0.15)", color: "#FF2D78", border: "1px solid rgba(255,45,120,0.3)",
            cursor: "pointer",
          }}>{tR("filterChip", { scope: scopeLabel })}</button>
        )}
      </div>

      {/* Mode-Toggle — horizontal scrollbar auf Mobile */}
      <div style={{
        display: "flex", gap: 4, marginBottom: 18,
        overflowX: "auto", padding: 4, borderRadius: 12,
        background: "rgba(30, 38, 60, 0.55)", border: `1px solid ${BORDER}`,
        scrollbarWidth: "none",
      }}>
        {([
          { id: "runners",    label: tR("modeRunners") },
          { id: "crews",      label: tR("modeCrews") },
          { id: "factions",   label: tR("modeFactions") },
          { id: "guardians",  label: tR("modeGuardians") },
          { id: "turfWar",    label: tR("modeTurfWar") },
          { id: "arena",      label: tR("modeArena") },
          { id: "mmr",        label: tR("modeMmr") },
        ] as const).map((m) => {
          const active = mode === m.id;
          return (
            <button key={m.id} onClick={() => setMode(m.id)} style={{
              padding: "8px 16px", borderRadius: 9, flexShrink: 0, whiteSpace: "nowrap",
              background: active ? PRIMARY : "transparent",
              color: active ? BG_DEEP : "#FFF",
              border: "none", fontSize: 13, fontWeight: 900, cursor: "pointer",
            }}>
              {m.label}
            </button>
          );
        })}
      </div>

      {/* "Meine Position" — nur bei Runner-Tab und wenn in Liste */}
      {mode === "runners" && myRunnerRow && (
        <div style={{
          marginBottom: 14, padding: "12px 16px", borderRadius: 14,
          background: "linear-gradient(135deg, rgba(34,209,195,0.2), rgba(34,209,195,0.06))",
          border: `1.5px solid ${PRIMARY}`,
          boxShadow: `0 0 16px ${PRIMARY}33`,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: PRIMARY, color: BG_DEEP,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 900,
            flexShrink: 0,
          }}>#{myPositionRunner + 1}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 1.5, color: PRIMARY }}>{tR("myPositionLabel")}</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#FFF" }}>
              {myRunnerRow.display_name} · {myRunnerRow[sortRunner].toLocaleString("de-DE")} {sortRunner === "weekly_km" ? "km" : "Erfahrung"}
            </div>
            <div style={{ fontSize: 11, color: MUTED }}>
              {myPositionRunner === 0 ? tR("youLead") :
               myPositionRunner <= 2 ? tR("podium") :
               myPositionRunner <= 9 ? tR("top10", {
                 gap: (filteredRunners[myPositionRunner - 1][sortRunner] - myRunnerRow[sortRunner]).toLocaleString("de-DE"),
                 unit: sortRunner === "weekly_km" ? "km" : "🪙"
               }) :
               tR("behindYou", { count: filteredRunners.length - myPositionRunner - 1 })}
            </div>
          </div>
        </div>
      )}

      {/* Mobile-Filter-Toggle */}
      {!isWide && mode !== "arena" && (
        <button
          onClick={() => setMobileFiltersOpen((v) => !v)}
          style={{
            width: "100%", marginBottom: 12, padding: "10px 14px",
            borderRadius: 10, textAlign: "left", cursor: "pointer",
            background: mobileFiltersOpen ? `${PRIMARY}15` : "rgba(30, 38, 60, 0.55)",
            border: `1px solid ${mobileFiltersOpen ? PRIMARY : BORDER}`,
            color: "#FFF", fontSize: 13, fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
          }}
        >
          <span>{tR("filtersToggle")}{activeFilterCount > 0 ? ` ${tR("filtersActive", { count: activeFilterCount })}` : ""}</span>
          <span style={{ color: MUTED, fontSize: 12 }}>{mobileFiltersOpen ? "▲" : "▼"}</span>
        </button>
      )}

      <div style={{
        display: "grid",
        gridTemplateColumns: isWide && mode !== "arena" && mode !== "mmr" && mode !== "guardians" ? "260px 1fr" : "1fr",
        gap: 20, alignItems: "start",
      }}>
        {/* ═══ SIDEBAR ═══ */}
        {mode !== "arena" && mode !== "mmr" && mode !== "guardians" && (isWide || mobileFiltersOpen) && <aside style={{
          position: isWide ? "sticky" : "static",
          top: isWide ? 12 : undefined,
          background: isWide ? "rgba(30, 38, 60, 0.45)" : "rgba(30, 38, 60, 0.35)",
          border: `1px solid ${BORDER}`,
          borderRadius: 14,
          padding: 14,
        }}>
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={`🔎 ${mode === "runners" ? tR("searchRunners") : mode === "crews" ? tR("searchCrews") : tR("searchGeo")}`}
            style={{ ...inputStyle(), marginBottom: 14 }}
          />

          {mode === "factions" && (
            <details style={{ marginBottom: 14 }}>
              <summary style={{ cursor: "pointer", color: "#a8b4cf", fontSize: 10, fontWeight: 800, listStyle: "none", userSelect: "none", padding: "6px 10px", background: "rgba(30,38,60,0.55)", borderRadius: 8, border: `1px solid ${BORDER}` }}>
                {tR("factionDuelTitle")}
              </summary>
              <div style={{ marginTop: 6, padding: 10, borderRadius: 8, background: "rgba(15,17,21,0.6)", border: `1px solid ${BORDER}`, fontSize: 10, color: "#a8b4cf", lineHeight: 1.5, display: "flex", flexDirection: "column", gap: 4 }}>
                <div><b style={{ color: "#FFD700" }}>{tR("factionDuelKronenwacht")}</b> vs <b style={{ color: "#22D1C3" }}>{tR("factionDuelGossenbund")}</b></div>
                <div>{tR.rich("factionDuelDesc", { b: (c: React.ReactNode) => <b style={{ color: "#FFF" }}>{c}</b> })}</div>
                <div>{tR("factionDuelHowTo")}</div>
                <div style={{ color: "#8B8FA3", marginTop: 2 }}>{tR("factionDuelRegion")}</div>
              </div>
            </details>
          )}

          {(mode === "runners" || mode === "crews") && <div style={{ color: MUTED, fontSize: 10, fontWeight: 800, marginBottom: 6, letterSpacing: 0.5 }}>
            {tR("sortLabel")}
          </div>}
          {mode === "runners" && <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              <FilterPill active={sortRunner === "weekly_xp"} onClick={() => setSortRunner("weekly_xp")}>{tR("sortWeeklyXp")}</FilterPill>
              <FilterPill active={sortRunner === "weekly_km"} onClick={() => setSortRunner("weekly_km")}>{tR("sortWeeklyKm")}</FilterPill>
              <FilterPill active={sortRunner === "total_xp"}  onClick={() => setSortRunner("total_xp")}>{tR("sortTotalXp")}</FilterPill>
            </div>
            <details style={{ marginBottom: 14 }}>
              <summary style={{ cursor: "pointer", color: "#a8b4cf", fontSize: 10, fontWeight: 800, listStyle: "none", userSelect: "none", padding: "6px 10px", background: "rgba(30,38,60,0.55)", borderRadius: 8, border: `1px solid ${BORDER}` }}>
                {tR("valuesExpand")}
              </summary>
              <div style={{ marginTop: 6, padding: 10, borderRadius: 8, background: "rgba(15,17,21,0.6)", border: `1px solid ${BORDER}`, fontSize: 10, color: "#a8b4cf", lineHeight: 1.5, display: "flex", flexDirection: "column", gap: 4 }}>
                <div>{tR.rich("weeklyXpDesc", { b: (c: React.ReactNode) => <b style={{ color: "#FFF" }}>{c}</b> })}</div>
                <div>{tR.rich("weeklyKmDesc", { b: (c: React.ReactNode) => <b style={{ color: "#FFF" }}>{c}</b> })}</div>
                <div>{tR.rich("totalXpDesc", { b: (c: React.ReactNode) => <b style={{ color: "#FFF" }}>{c}</b> })}</div>
                <div style={{ color: "#8B8FA3", marginTop: 2 }}>{tR("xpHowTo")}</div>
              </div>
            </details>
          </>}
          {mode === "crews" && <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              <FilterPill active={sortCrew === "weekly_km"}    onClick={() => setSortCrew("weekly_km")}>{tR("sortWeeklyKm")}</FilterPill>
              <FilterPill active={sortCrew === "member_count"} onClick={() => setSortCrew("member_count")}>{tR("sortMembers")}</FilterPill>
            </div>
            <details style={{ marginBottom: 14 }}>
              <summary style={{ cursor: "pointer", color: "#a8b4cf", fontSize: 10, fontWeight: 800, listStyle: "none", userSelect: "none", padding: "6px 10px", background: "rgba(30,38,60,0.55)", borderRadius: 8, border: `1px solid ${BORDER}` }}>
                {tR("valuesExpand")}
              </summary>
              <div style={{ marginTop: 6, padding: 10, borderRadius: 8, background: "rgba(15,17,21,0.6)", border: `1px solid ${BORDER}`, fontSize: 10, color: "#a8b4cf", lineHeight: 1.5, display: "flex", flexDirection: "column", gap: 4 }}>
                <div>{tR.rich("weeklyKmCrewDesc", { b: (c: React.ReactNode) => <b style={{ color: "#FFF" }}>{c}</b> })}</div>
                <div>{tR.rich("membersDesc", { b: (c: React.ReactNode) => <b style={{ color: "#FFF" }}>{c}</b> })}</div>
              </div>
            </details>
          </>}

          {mode === "crews" && (
            <>
              <div style={{ color: MUTED, fontSize: 10, fontWeight: 800, marginBottom: 6, letterSpacing: 0.5 }}>
                {tR("leagueLabel")}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                <FilterPill active={leagueFilter === null} onClick={() => setLeagueFilter(null)}>{tR("leagueAll")}</FilterPill>
                {LEAGUE_TIERS.map((t) => (
                  <FilterPill key={t.id} active={leagueFilter === t.id} onClick={() => setLeagueFilter(leagueFilter === t.id ? null : t.id)}>
                    {t.icon} {t.name}
                  </FilterPill>
                ))}
              </div>
              <details style={{ marginBottom: 14 }}>
                <summary style={{ cursor: "pointer", color: "#a8b4cf", fontSize: 10, fontWeight: 800, listStyle: "none", userSelect: "none", padding: "6px 10px", background: "rgba(30,38,60,0.55)", borderRadius: 8, border: `1px solid ${BORDER}` }}>
                  {tR("leagueExpand")}
                </summary>
                <div style={{ marginTop: 6, padding: 10, borderRadius: 8, background: "rgba(15,17,21,0.6)", border: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", gap: 3 }}>
                  {LEAGUE_TIERS.map((t, i) => {
                    const next = LEAGUE_TIERS[i + 1];
                    const range = next ? `${t.minWeeklyKm}–${next.minWeeklyKm - 1} km` : `${t.minWeeklyKm}+ km`;
                    return (
                      <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 6px", borderRadius: 6, background: `${t.color}11`, border: `1px solid ${t.color}33` }}>
                        <span style={{ fontSize: 12 }}>{t.icon}</span>
                        <span style={{ color: t.color, fontSize: 10, fontWeight: 900, flex: 1 }}>{t.name}</span>
                        <span style={{ color: "#8B8FA3", fontSize: 9, fontFamily: "monospace" }}>{range}</span>
                      </div>
                    );
                  })}
                  <div style={{ marginTop: 4, fontSize: 9, color: "#8B8FA3", lineHeight: 1.5 }}>
                    {tR("leagueExplain")}
                  </div>
                </div>
              </details>
            </>
          )}

          {activeFilterCount > 0 && (
            <button
              onClick={clearAll}
              style={{
                background: "transparent", border: "none", padding: 0,
                color: ACCENT, cursor: "pointer", fontSize: 12, fontWeight: 700,
                marginBottom: 14,
              }}
            >
              {tR("clearAllFilters", { count: activeFilterCount })}
            </button>
          )}

          {/* Geo-Drill-Down */}
          {nextLevel && buckets.length > 1 && (
            <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 14 }}>
              <div style={{ color: MUTED, fontSize: 10, fontWeight: 800, marginBottom: 8, letterSpacing: 0.5 }}>
                {tR("filterByLevel", { level: GEO_LABEL[nextLevel].toUpperCase() })}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {buckets.map((b) => (
                  <button
                    key={b.key}
                    onClick={() => setFilter(nextLevel, b.key)}
                    style={{
                      background: "rgba(20, 26, 44, 0.6)", border: `1px solid ${BORDER}`,
                      borderRadius: 10, padding: "8px 10px", color: "#FFF",
                      display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                      textAlign: "left", width: "100%",
                    }}
                  >
                    {nextLevel === "country"
                      ? <CountryFlag country={b.key} size={16} />
                      : nextLevel === "continent"
                        ? <span style={{ fontSize: 16 }}>{emojiForContinent(b.key)}</span>
                        : <span style={{ fontSize: 14, opacity: 0.9 }}>{GEO_ICON[nextLevel]}</span>
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {b.label}
                      </div>
                    </div>
                    <span style={{ fontSize: 10, color: MUTED, fontWeight: 700 }}>{b.child_count}</span>
                    <span style={{ color: MUTED, fontSize: 12 }}>›</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>}

        {/* ═══ MAIN ═══ */}
        <main>
          {/* Breadcrumb (Geo-Filter nicht relevant fuer Arena/MMR/Waechter) */}
          {mode !== "arena" && mode !== "mmr" && mode !== "guardians" && <div style={{
            display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6,
            background: "rgba(0,0,0,0.2)", padding: "10px 12px", borderRadius: 12,
            marginBottom: 14, border: `1px solid ${BORDER}`,
          }}>
            <button onClick={() => setFilters({})} style={{ ...breadcrumbStyle(trail.length === 0), display: "inline-flex", alignItems: "center", gap: 5 }}>
              {tR("breadcrumbAll")}
            </button>
            {trail.map((t, i) => (
              <React.Fragment key={t.level}>
                <span style={{ color: MUTED, fontSize: 12 }}>›</span>
                <button
                  onClick={() => {
                    const idx = GEO_LEVEL_SEQ.indexOf(t.level);
                    const keep: Partial<Record<GeoLevel, string>> = {};
                    for (let j = 0; j <= idx; j++) {
                      const l = GEO_LEVEL_SEQ[j];
                      if (filters[l]) keep[l] = filters[l];
                    }
                    setFilters(keep);
                  }}
                  style={{ ...breadcrumbStyle(i === trail.length - 1), display: "inline-flex", alignItems: "center", gap: 5 }}
                >
                  {t.level === "country"   && <CountryFlag country={t.label} size={20} />}
                  {t.level === "continent" && <span>{emojiForContinent(t.label)}</span>}
                  {t.level !== "country" && t.level !== "continent" && <span>{GEO_ICON[t.level]}</span>}
                  <span>{t.label}</span>
                </button>
              </React.Fragment>
            ))}
          </div>}

          {/* Podium (Top 3) */}
          {mode === "runners" && filteredRunners.length >= 3 && (
            <PodiumRunners scope={scopeLabel} runners={filteredRunners.slice(0, 3)} myUsername={p?.username || ""} guardianArt={guardianArt} />
          )}
          {mode === "crews" && filteredCrews.length >= 3 && (
            <PodiumCrews scope={scopeLabel} crews={filteredCrews.slice(0, 3)} />
          )}

          {/* Liste */}
          {mode !== "arena" && mode !== "mmr" && mode !== "guardians" && <div style={{ color: MUTED, fontSize: 11, fontWeight: 800, margin: "10px 0 8px", letterSpacing: 0.5 }}>
            {mode === "runners"
              ? tR("runnerCount", { count: filteredRunners.length, scope: scopeLabel.toUpperCase() })
              : mode === "crews"
                ? tR("crewCount", { count: filteredCrews.length, scope: scopeLabel.toUpperCase() })
                : tR("factionCount", { scope: scopeLabel.toUpperCase() })}
          </div>}

          {mode === "runners" && (
            filteredRunners.length === 0 ? (
              <EmptyHint onReset={clearAll} />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {filteredRunners.map((r, i) => (
                  <React.Fragment key={r.id}>
                    <RunnerRankRow runner={r} rank={i + 1} isMe={r.username === p?.username} sortBy={sortRunner} guardianArt={guardianArt} />
                    {i === 4 && <AdSenseSlot placement="ranking_list" />}
                  </React.Fragment>
                ))}
              </div>
            )
          )}
          {mode === "crews" && (
            filteredCrews.length === 0 ? (
              <EmptyHint onReset={clearAll} />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {filteredCrews.map((c, i) => (
                  <CrewRankRow key={c.id} crew={c} rank={i + 1} sortBy={sortCrew} />
                ))}
              </div>
            )
          )}
          {mode === "factions" && (
            filteredFactions.length === 0 ? (
              <EmptyHint onReset={clearAll} />
            ) : (
              <FactionDuelView items={filteredFactions} buckets={factionBuckets} scopeLabel={scopeLabel} />
            )
          )}
          {mode === "guardians" && (
            <GuardianLeaderboardView />
          )}
          {mode === "turfWar" && (
            <TurfWarLeaderboardView />
          )}
          {mode === "arena" && (
            <ArenaLeaderboardView />
          )}
          {mode === "mmr" && (
            <MmrLeaderboardView />
          )}

          {/* Public-Leaderboard-Link — gleiche Daten ohne Demo-Overlay,
              shareable URL für Out-of-App-Sharing. */}
          <div style={{ marginTop: 18, padding: "12px 14px", borderRadius: 10,
                        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                        textAlign: "center" }}>
            <a href="/leaderboard" target="_blank" rel="noopener"
               style={{ color: PRIMARY, fontSize: 12, fontWeight: 800, textDecoration: "none" }}>
              🌐 Öffentliche Rangliste · myarea365.de/leaderboard ↗
            </a>
            <div style={{ color: MUTED, fontSize: 10, marginTop: 3 }}>
              Teilbarer Link · zeigt nur freigegebene Profile
            </div>
          </div>
        </main>
      </div>

    </div>
  );
}

function groupRunnersByLevel(runners: typeof DEMO_RANKING_RUNNERS, level: GeoLevel): { key: string; label: string; child_count: number }[] {
  const m = new Map<string, number>();
  for (const r of runners) m.set(r[level], (m.get(r[level]) || 0) + 1);
  return [...m.entries()].map(([k, c]) => ({ key: k, label: k, child_count: c }))
    .sort((a, b) => b.child_count - a.child_count);
}

function EmptyHint({ onReset }: { onReset: () => void }) {
  const tR = useTranslations("Ranking");
  return (
    <div style={{
      background: "rgba(30, 38, 60, 0.45)", padding: 30, borderRadius: 16,
      textAlign: "center", color: MUTED, border: `1px solid ${BORDER}`,
    }}>
      {tR("emptyHint")}<br />
      <button onClick={onReset} style={{
        marginTop: 10, background: "transparent", border: "none",
        color: PRIMARY, cursor: "pointer", fontSize: 13, fontWeight: 700,
      }}>{tR("resetFilters")}</button>
    </div>
  );
}

/* Podium für Top 3 */
function PodiumRunners({ scope, runners, myUsername, guardianArt }: {
  scope: string;
  runners: typeof DEMO_RANKING_RUNNERS;
  myUsername: string;
  guardianArt: Record<string, GuardianArt>;
}) {
  const tR = useTranslations("Ranking");
  return (
    <div style={{
      background: "rgba(30, 38, 60, 0.55)", border: `1px solid ${BORDER}`,
      borderRadius: 14, padding: 14, marginBottom: 12,
    }}>
      <div style={{ color: MUTED, fontSize: 11, fontWeight: 800, marginBottom: 10, letterSpacing: 0.5 }}>
        {tR("podiumLabel", { scope: scope.toUpperCase() })}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {runners.map((r, i) => {
          const isMe = r.username === myUsername;
          const g = getRunnerGuardian(r.id);
          const art = g ? guardianArt[g.id] : null;
          return (
            <div key={r.id} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 10px", borderRadius: 10,
              background: isMe ? `${PRIMARY}18` : "rgba(0,0,0,0.25)",
              border: `1px solid ${isMe ? PRIMARY : BORDER}`,
            }}>
              <span style={{ fontSize: 20, width: 26, textAlign: "center" }}>{MEDALS[i]}</span>
              {g ? (
                <div style={{ width: 32, height: 40, flexShrink: 0 }}>
                  <GuardianAvatar
                    archetype={{ id: g.id, emoji: art?.emoji ?? r.avatar_emoji, rarity: g.rarity, image_url: art?.image_url ?? null, video_url: art?.video_url ?? null }}
                    size={32}
                    animation="idle"
                    fillMode="contain"
                  />
                </div>
              ) : (
                <span style={{ fontSize: 20 }}>{r.avatar_emoji}</span>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#FFF", fontSize: 13, fontWeight: 900 }}>
                  {r.display_name} {isMe && <span style={{ color: PRIMARY, fontSize: 10 }}>· Du</span>}
                </div>
                <div style={{ color: MUTED, fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
                  <CountryFlag country={r.country} size={18} />
                  <span>{r.city} · {r.crew_name || "Freelancer"}</span>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: PRIMARY, fontSize: 13, fontWeight: 900 }}>{r.weekly_xp.toLocaleString("de-DE")} 🪙</div>
                <div style={{ color: MUTED, fontSize: 10 }}>{r.weekly_km} km</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PodiumCrews({ scope, crews }: { scope: string; crews: NearbyCrew[] }) {
  return (
    <div style={{
      background: "rgba(30, 38, 60, 0.55)", border: `1px solid ${BORDER}`,
      borderRadius: 14, padding: 14, marginBottom: 12,
    }}>
      <div style={{ color: MUTED, fontSize: 11, fontWeight: 800, marginBottom: 10, letterSpacing: 0.5 }}>
        🏆 PODIUM · {scope.toUpperCase()}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {crews.map((c, i) => (
          <div key={c.id} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "8px 10px", borderRadius: 10,
            background: "rgba(0,0,0,0.25)", border: `1px solid ${BORDER}`,
            borderLeft: `3px solid ${c.color}`,
          }}>
            <span style={{ fontSize: 20, width: 26, textAlign: "center" }}>{MEDALS[i]}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: "#FFF", fontSize: 13, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 6 }}>
                <span>{c.name}</span>
                <LeagueBadge weeklyKm={c.weekly_km} />
              </div>
              <div style={{ color: MUTED, fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
                <CountryFlag country={c.country} size={18} />
                <span>{c.city} · {c.zip}</span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: c.color, fontSize: 13, fontWeight: 900 }}>{c.weekly_km} km</div>
              <div style={{ color: MUTED, fontSize: 10 }}>{c.member_count}👥</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Listen-Zeile Runner */
function RunnerRankRow({ runner: r, rank, isMe, sortBy, guardianArt }: {
  runner: typeof DEMO_RANKING_RUNNERS[number]; rank: number; isMe: boolean; sortBy: RankingSortRunner;
  guardianArt: Record<string, GuardianArt>;
}) {
  const rankArt = useRankArt();
  const rId = rankIdByName(r.rank_name);
  const g = getRunnerGuardian(r.id);
  const gArt = g ? guardianArt[g.id] : null;
  const rankColor = RUNNER_RANKS.find((x) => x.id === rId)?.color ?? "#FFD700";
  const primaryValue = sortBy === "weekly_km"
    ? `${r.weekly_km} km`
    : sortBy === "total_xp"
      ? `${r.total_xp.toLocaleString("de-DE")} 🪙`
      : `${r.weekly_xp.toLocaleString("de-DE")} 🪙`;
  const primaryLabel = sortBy === "weekly_km" ? "Woche km" : sortBy === "total_xp" ? "Gesamt 🪙" : "Woche 🪙";
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      background: isMe ? `linear-gradient(135deg, ${PRIMARY}22, ${PRIMARY}08)` : "rgba(30, 38, 60, 0.55)",
      padding: "10px 14px", borderRadius: 12,
      border: `${isMe ? 2 : 1}px solid ${isMe ? PRIMARY : BORDER}`,
      boxShadow: isMe ? `0 0 12px ${PRIMARY}44` : "none",
    }}>
      <span style={{
        color: rank <= 3 ? "#FFD700" : rank <= 10 ? "#FFD700cc" : MUTED,
        fontWeight: 900, fontSize: medal ? 18 : 14, width: 34, textAlign: "right",
      }}>{medal ?? `#${rank}`}</span>
      {g ? (
        <div style={{ width: 32, height: 40, flexShrink: 0 }}>
          <GuardianAvatar
            archetype={{ id: g.id, emoji: gArt?.emoji ?? r.avatar_emoji, rarity: g.rarity, image_url: gArt?.image_url ?? null, video_url: gArt?.video_url ?? null }}
            size={32}
            animation="idle"
            fillMode="contain"
          />
        </div>
      ) : (
        <span style={{ fontSize: 20 }}>{r.avatar_emoji}</span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "#FFF", fontSize: 13, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{r.display_name}</span>
          <SupporterBadge tier={r.supporter_tier} size="xs" />
          {isMe && <span style={{ color: PRIMARY, fontSize: 10 }}>· Du</span>}
        </div>
        <div style={{ color: MUTED, fontSize: 11, marginTop: 1, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          <CountryFlag country={r.country} size={18} />
          {rId && <RankBadge rankId={rId} color={rankColor} size={18} rankArt={rankArt} />}
          <span>{r.city} · {r.rank_name}{r.crew_name ? ` · ${r.crew_name}` : ""}</span>
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ color: PRIMARY, fontSize: 13, fontWeight: 900 }}>{primaryValue}</div>
        <div style={{ color: MUTED, fontSize: 10 }}>{primaryLabel}</div>
      </div>
    </div>
  );
}

/* Listen-Zeile Crew */
function CrewRankRow({ crew: c, rank, sortBy }: {
  crew: NearbyCrew; rank: number; sortBy: RankingSortCrew;
}) {
  const t = CREW_TYPES.find((x) => x.id === c.type)!;
  const primary = sortBy === "member_count" ? `${c.member_count} 👥` : `${c.weekly_km} km`;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      background: "rgba(30, 38, 60, 0.55)",
      padding: "10px 14px", borderRadius: 12,
      border: `1px solid ${BORDER}`, borderLeft: `3px solid ${c.color}`,
    }}>
      <span style={{
        color: rank <= 10 ? "#FFD700" : MUTED,
        fontWeight: 900, fontSize: 14, width: 34, textAlign: "right",
      }}>#{rank}</span>
      <span style={{ fontSize: 20, opacity: 0.9 }}>{t.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <div style={{ color: "#FFF", fontSize: 13, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
            {c.name}
          </div>
          <LeagueBadge weeklyKm={c.weekly_km} />
        </div>
        <div style={{ color: MUTED, fontSize: 11, marginTop: 1, display: "flex", alignItems: "center", gap: 6 }}>
          <CountryFlag country={c.country} size={18} />
          <span>{c.city} · {c.zip} · {c.member_count} Mitglieder</span>
        </div>
      </div>
      <div style={{ color: c.color, fontSize: 13, fontWeight: 900, whiteSpace: "nowrap" }}>
        {primary}
      </div>
    </div>
  );
}

/* ═══ Guardian-Leaderboard ═══ */
type GuardianArchMini = { name: string; emoji: string; rarity: string; guardian_type?: string | null; image_url?: string | null; video_url?: string | null };
type GuardianLeaderRow = {
  id: string; user_id: string; archetype_id: string;
  level: number; xp?: number; wins: number; losses: number;
  guardian_archetypes: GuardianArchMini | GuardianArchMini[] | null;
  users: { username: string; display_name: string | null; team_color: string | null; country: string | null } | { username: string; display_name: string | null; team_color: string | null; country: string | null }[] | null;
};
type WinRateRow = {
  guardian_id: string; user_id: string; archetype_id: string;
  level: number; wins: number; losses: number;
  total: number; win_rate: number;
  username: string; display_name: string | null; team_color: string | null; country: string | null;
  arch_name: string; arch_emoji: string; arch_rarity: string;
};

type GuardianTypeFilter = "all" | GuardianClass;
const GUARDIAN_TYPE_CHIPS: Array<{ id: GuardianTypeFilter; label: string; color: string }> = [
  { id: "all",     label: "🌐 Alle",       color: "#22D1C3" },
  { id: "tank",    label: `${GUARDIAN_CLASSES.tank.icon} Tank`,        color: GUARDIAN_CLASSES.tank.color },
  { id: "support", label: `${GUARDIAN_CLASSES.support.icon} Support`,  color: GUARDIAN_CLASSES.support.color },
  { id: "ranged",  label: `${GUARDIAN_CLASSES.ranged.icon} Fernkampf`, color: GUARDIAN_CLASSES.ranged.color },
  { id: "melee",   label: `${GUARDIAN_CLASSES.melee.icon} Nahkampf`,   color: GUARDIAN_CLASSES.melee.color },
];

function GuardianLeaderboardView() {
  const [data, setData] = useState<{ top_level: GuardianLeaderRow[]; most_played: GuardianLeaderRow[]; top_win_rate: WinRateRow[] } | null>(null);
  const [subTab, setSubTab] = useState<"level" | "played" | "winrate">("level");
  const [typeFilter, setTypeFilter] = useState<GuardianTypeFilter>("all");
  const [subArchetypeFilter, setSubArchetypeFilter] = useState<string | null>(null);
  const [isWide, setIsWide] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const upd = () => setIsWide(mq.matches);
    upd();
    mq.addEventListener("change", upd);
    return () => mq.removeEventListener("change", upd);
  }, []);

  useEffect(() => {
    fetch("/api/leaderboard/guardians").then(r => r.json()).then(setData).catch(() => {});
  }, []);

  const unnest = <T extends object>(x: T | T[] | null): T | null => {
    if (!x) return null;
    return Array.isArray(x) ? (x[0] ?? null) : x;
  };

  const rawRows: Array<{
    emoji: string; imageUrl: string | null; videoUrl: string | null;
    archName: string; archRarity: string; guardianType: string | null;
    level: number; stat: string; username: string; teamColor: string; country: string | null;
  }> = !data ? [] : (() => {
    if (subTab === "level") {
      return data.top_level.map((r) => {
        const arch = unnest(r.guardian_archetypes);
        const user = unnest(r.users);
        return {
          emoji: arch?.emoji ?? "🛡️",
          imageUrl: arch?.image_url ?? null,
          videoUrl: arch?.video_url ?? null,
          archName: arch?.name ?? "?",
          archRarity: arch?.rarity ?? "common",
          guardianType: arch?.guardian_type ?? null,
          level: r.level,
          stat: `Lvl ${r.level} · ${r.wins}W/${r.losses}L`,
          username: user?.display_name || user?.username || "?",
          teamColor: user?.team_color || "#22D1C3",
          country: user?.country ?? null,
        };
      });
    }
    if (subTab === "played") {
      return data.most_played.map((r) => {
        const arch = unnest(r.guardian_archetypes);
        const user = unnest(r.users);
        return {
          emoji: arch?.emoji ?? "🛡️",
          imageUrl: arch?.image_url ?? null,
          videoUrl: arch?.video_url ?? null,
          archName: arch?.name ?? "?",
          archRarity: arch?.rarity ?? "common",
          guardianType: arch?.guardian_type ?? null,
          level: r.level,
          stat: `${r.wins + r.losses} Kämpfe · ${r.wins}W/${r.losses}L`,
          username: user?.display_name || user?.username || "?",
          teamColor: user?.team_color || "#22D1C3",
          country: user?.country ?? null,
        };
      });
    }
    return data.top_win_rate.map((r) => ({
      emoji: r.arch_emoji,
      imageUrl: null,
      videoUrl: null,
      archName: r.arch_name,
      archRarity: r.arch_rarity,
      guardianType: null,
      level: r.level,
      stat: `${r.win_rate}% · ${r.wins}W/${r.losses}L`,
      username: r.display_name || r.username,
      teamColor: r.team_color || "#22D1C3",
      country: r.country ?? null,
    }));
  })();

  const filtered = rawRows.filter((r) => {
    if (typeFilter !== "all" && legacyTypeToClass(r.guardianType) !== typeFilter) return false;
    if (subArchetypeFilter && !r.archName.toLowerCase().includes(subArchetypeFilter.toLowerCase())) return false;
    return true;
  });
  const currentRows = filtered.slice(0, 30).map((r, i) => ({ ...r, rank: i + 1 }));

  const rarityColor: Record<string, string> = { common: "#9ba8c7", rare: "#5ddaf0", epic: "#a855f7", legend: "#FFD700" };

  const sidebar = (
    <aside style={{
      position: isWide ? "sticky" : "static",
      top: isWide ? 12 : undefined,
      background: isWide ? "rgba(30, 38, 60, 0.45)" : "rgba(30, 38, 60, 0.35)",
      border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14,
      display: "flex", flexDirection: "column", gap: 14,
    }}>
      <div>
        <div style={{ color: MUTED, fontSize: 10, fontWeight: 800, marginBottom: 6, letterSpacing: 0.5 }}>ANSICHT</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <FilterPill active={subTab === "level"}   onClick={() => setSubTab("level")}>⭐ Top-Level</FilterPill>
          <FilterPill active={subTab === "played"}  onClick={() => setSubTab("played")}>⚔️ Meist-Siege</FilterPill>
          <FilterPill active={subTab === "winrate"} onClick={() => setSubTab("winrate")}>📈 Win-Rate</FilterPill>
        </div>
      </div>
      <div>
        <div style={{ color: MUTED, fontSize: 10, fontWeight: 800, marginBottom: 6, letterSpacing: 0.5 }}>KLASSE</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, opacity: subTab === "winrate" ? 0.4 : 1 }}>
          {GUARDIAN_TYPE_CHIPS.map((c) => {
            const active = typeFilter === c.id;
            const disabled = subTab === "winrate" && c.id !== "all";
            return (
              <FilterPill
                key={c.id}
                active={active}
                onClick={() => {
                  if (disabled) return;
                  setTypeFilter(c.id);
                  setSubArchetypeFilter(null);
                }}
              >{c.label}</FilterPill>
            );
          })}
        </div>
        {subTab === "winrate" && (
          <div style={{ color: MUTED, fontSize: 10, marginTop: 4 }}>Klassen-Filter in Win-Rate nicht verfügbar</div>
        )}
      </div>
      {typeFilter !== "all" && subTab !== "winrate" && (
        <div>
          <div style={{ color: MUTED, fontSize: 10, fontWeight: 800, marginBottom: 6, letterSpacing: 0.5 }}>
            SUB-KLASSE · {GUARDIAN_CLASSES[typeFilter].label.toUpperCase()}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <FilterPill active={subArchetypeFilter === null} onClick={() => setSubArchetypeFilter(null)}>Alle</FilterPill>
            {GUARDIAN_CLASSES[typeFilter].sub_archetypes.map((sub) => (
              <FilterPill
                key={sub}
                active={subArchetypeFilter === sub}
                onClick={() => setSubArchetypeFilter(subArchetypeFilter === sub ? null : sub)}
              >{sub}</FilterPill>
            ))}
          </div>
        </div>
      )}
    </aside>
  );

  const main = (
    <div>
      {!data ? (
        <div style={{ padding: 20, textAlign: "center", color: "#8B8FA3", fontSize: 12 }}>Lade Wächter-Ranglisten…</div>
      ) : currentRows.length === 0 ? (
        <div style={{ padding: 30, textAlign: "center", color: "#8B8FA3", fontSize: 12 }}>
          {subTab === "winrate" ? "Win-Rate-Rangliste benötigt mindestens 5 Kämpfe" : "Noch keine Daten"}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {currentRows.map((r) => (
            <div key={r.rank} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 12,
              background: "rgba(30,38,60,0.55)",
              border: `1px solid ${rarityColor[r.archRarity] ?? "#8B8FA3"}44`,
            }}>
              <span style={{
                color: r.rank <= 3 ? "#FFD700" : "#8B8FA3",
                fontWeight: 900, fontSize: 14, width: 28, textAlign: "center",
              }}>
                {r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : `#${r.rank}`}
              </span>
              <div style={{
                width: 44, height: 48, borderRadius: 8, overflow: "hidden",
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${rarityColor[r.archRarity] ?? "#8B8FA3"}55`,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
                boxShadow: `0 0 10px ${rarityColor[r.archRarity] ?? "#8B8FA3"}33`,
              }}>
                {r.videoUrl ? (
                  <video src={r.videoUrl} autoPlay loop muted playsInline
                    style={{ width: "100%", height: "100%", objectFit: "cover", filter: "url(#ma365-chroma-black)" }} />
                ) : r.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.imageUrl} alt={r.archName}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ fontSize: 24, filter: `drop-shadow(0 0 6px ${rarityColor[r.archRarity]}66)` }}>{r.emoji}</span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#FFF", fontSize: 13, fontWeight: 900 }}>{r.archName}</div>
                <div style={{ color: "#a8b4cf", fontSize: 10, marginTop: 1, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: r.teamColor, fontWeight: 700 }}>{r.username}</span>
                  {r.country && (
                    <CountryFlag country={r.country} size={18} />
                  )}
                </div>
              </div>
              <div style={{ color: rarityColor[r.archRarity] ?? "#8B8FA3", fontSize: 11, fontWeight: 900, textAlign: "right", minWidth: 80 }}>
                {r.stat}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: isWide ? "260px 1fr" : "1fr",
      gap: 20, alignItems: "start",
    }}>
      {sidebar}
      <div>{main}</div>
    </div>
  );
}

/* ═══ Arena Leaderboard (Wächter-PvP) ═══ */
type ArenaHonorRow = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  level: number;
  faction: string | null;
  country?: string | null;
  guardian_archetype_id?: string | null;
  guardian_type?: string | null;
  guardian_name?: string | null;
  guardian_emoji?: string | null;
  guardian_image_url?: string | null;
  guardian_video_url?: string | null;
  crew_name: string | null;
  crew_color: string | null;
  wins: number;
  losses: number;
  streak?: number;
  honor: number;
};

const DEMO_ARENA_ROWS: ArenaHonorRow[] = [
  { user_id: "d1", username: "iron_fist", display_name: "Kaelthor Malven", level: 58, faction: "vanguard", country: "Deutschland", guardian_type: "infantry", guardian_name: "Eisenhand",         guardian_emoji: "🛡️", crew_name: "Kreuzkölln Runners", crew_color: "#FF6B4A", wins: 214, losses: 42, streak: 18, honor: 124_120 },
  { user_id: "d2", username: "scrapking", display_name: "Savo_BMW",        level: 55, faction: "syndicate", country: "Deutschland", guardian_type: "infantry", guardian_name: "Altmetall-Krieger", guardian_emoji: "⚒️", crew_name: "Nachtpuls Berlin",   crew_color: "#22D1C3", wins: 198, losses: 54, streak: 11, honor: 108_900 },
  { user_id: "d3", username: "titan",    display_name: "Titan",    level: 60, faction: "vanguard",  country: "Vereinigte Staaten", guardian_type: "infantry", guardian_emoji: "🛡️", crew_name: "Sonnenwacht Prenzl.",  crew_color: "#FFD700", wins: 176, losses: 38, streak: 24, honor: 105_600 },
  { user_id: "d4", username: "shade",    display_name: "Shade",    level: 52, faction: "syndicate", country: "Niederlande",     guardian_type: "marksman", guardian_emoji: "🏹", crew_name: "Schatten-Syndikat",    crew_color: "#a855f7", wins: 161, losses: 61, streak:  7, honor:  83_720 },
  { user_id: "d5", username: "ember",    display_name: "Ember",    level: 49, faction: "vanguard",  country: "Vereinigte Staaten", guardian_type: "mage",     guardian_emoji: "🔮", crew_name: "Central Park Crew",    crew_color: "#FF6B4A", wins: 148, losses: 47, streak: 13, honor:  72_520 },
  { user_id: "d6", username: "kaelth",   display_name: "Kaelthor", level: 56, faction: null,        country: "Deutschland",     guardian_type: "infantry", guardian_emoji: "🛡️", crew_name: null,                   crew_color: null,      wins: 132, losses: 58, streak:  9, honor:  73_920 },
  { user_id: "d7", username: "zephyr",   display_name: "Zephyr",   level: 44, faction: "syndicate", country: "Niederlande",     guardian_type: "cavalry",  guardian_emoji: "⚔️", crew_name: "Vondelpark Pack",      crew_color: "#22D1C3", wins: 122, losses: 51, streak:  5, honor:  53_680 },
  { user_id: "d8", username: "frost",    display_name: "Frost",    level: 47, faction: "vanguard",  country: "Vereinigtes Königreich", guardian_type: "marksman", guardian_emoji: "🏹", crew_name: "Regent's Park Pacers", crew_color: "#FF6B4A", wins: 118, losses: 64, streak:  3, honor:  55_460 },
  { user_id: "d9", username: "raze",     display_name: "Raze",     level: 41, faction: "syndicate", country: "Deutschland",     guardian_type: "mage",     guardian_emoji: "🔮", crew_name: "Nachtpuls Hamburg",    crew_color: "#22D1C3", wins: 104, losses: 56, streak:  6, honor:  42_640 },
  { user_id: "d10",username: "blaze",    display_name: "Blaze",    level: 43, faction: "vanguard",  country: "Vereinigtes Königreich", guardian_type: "cavalry",  guardian_emoji: "⚔️", crew_name: "Camden Striders",      crew_color: "#FFD700", wins:  97, losses: 48, streak:  8, honor:  41_710 },
  { user_id: "d11",username: "mira",     display_name: "Mira",     level: 38, faction: "syndicate", country: "Österreich",      guardian_type: "infantry", guardian_emoji: "🛡️", crew_name: null,                   crew_color: null,      wins:  89, losses: 51, streak:  4, honor:  33_820 },
  { user_id: "d12",username: "draven",   display_name: "Draven",   level: 40, faction: null,        country: "Schweiz",         guardian_type: "marksman", guardian_emoji: "🏹", crew_name: "Freelance",            crew_color: "#8B8FA3", wins:  82, losses: 47, streak:  2, honor:  32_800 },
  { user_id: "d13",username: "lumen",    display_name: "Lumen",    level: 36, faction: "vanguard",  country: "Vereinigte Staaten", guardian_type: "mage",     guardian_emoji: "🔮", crew_name: "Upper West Side",      crew_color: "#FF6B4A", wins:  76, losses: 44, streak:  5, honor:  27_360 },
  { user_id: "d14",username: "onyx",     display_name: "Onyx",     level: 34, faction: "syndicate", country: "Deutschland",     guardian_type: "cavalry",  guardian_emoji: "⚔️", crew_name: "Kreuzberg Wölfe",      crew_color: "#22D1C3", wins:  71, losses: 52, streak:  0, honor:  24_140 },
  { user_id: "d15",username: "vex",      display_name: "Vex",      level: 32, faction: "vanguard",  country: "Frankreich",      guardian_type: "infantry", guardian_emoji: "🛡️", crew_name: null,                   crew_color: null,      wins:  64, losses: 41, streak:  1, honor:  20_480 },
];

type MmrEntry = {
  rank: number;
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  faction: string | null;
  team_color: string | null;
  supporter_tier: string | null;
  mmr: number;
  games: number;
  wins: number;
  losses: number;
  win_rate: number;
  peak_mmr: number;
  tier: MmrTier;
};

type MmrSort = "mmr" | "peak" | "winrate" | "games";
type MmrFactionFilter = "all" | "kronenwacht" | "gossenbund";

// ═══════════════════════════════════════════════════════════════════
// TURF-KRIEG-LIGA — monatliche Crew-Standings
// (Schwester-Komponente zur öffentlichen /leaderboard TurfWarTab)
// ═══════════════════════════════════════════════════════════════════
type TurfStandingDash = {
  crew_id: string; points: number; war_wins: number; duel_wins: number;
  territories_claimed: number;
  crews: { name: string | null; color: string | null; member_count: number | null } | null;
};
type TurfSeasonDash = { id: string; year: number; month: number; ends_at: string };

function TurfWarLeaderboardView() {
  const tR = useTranslations("Ranking");
  const [data, setData] = useState<{ season: TurfSeasonDash | null; standings: TurfStandingDash[] } | null>(null);

  useEffect(() => {
    fetch("/api/leaderboard/turf-war").then((r) => r.json()).then(setData);
  }, []);

  if (!data) return <div style={{ padding: 20, textAlign: "center", color: "#8B8FA3", fontSize: 12 }}>Lade…</div>;
  if (!data.season || data.standings.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: "center" }}>
        <div style={{ fontSize: 38, marginBottom: 8 }}>🏴</div>
        <div style={{ color: "#FFF", fontWeight: 900, fontSize: 14 }}>{tR("tlTurfWarHero")}</div>
        <div style={{ color: "#8B8FA3", fontSize: 11, marginTop: 6 }}>{tR("tlTurfWarEmpty")}</div>
      </div>
    );
  }

  const seasonLabel = tR("tlTurfWarSeasonLabel", {
    y: data.season.year, m: String(data.season.month).padStart(2, "0"),
  });

  return (
    <div style={{ padding: 12 }}>
      {/* Hero-Banner */}
      <div style={{
        padding: 14, borderRadius: 14, marginBottom: 14,
        background: "radial-gradient(ellipse at top, rgba(255,45,120,0.18) 0%, transparent 60%), linear-gradient(180deg, rgba(255,45,120,0.06) 0%, rgba(15,17,21,0.9) 100%)",
        border: "1px solid rgba(255,45,120,0.35)",
      }}>
        <div style={{ color: "#FF2D78", fontSize: 10, fontWeight: 900, letterSpacing: 2 }}>🏴 TURF-KRIEG · {seasonLabel}</div>
        <div style={{ color: "#FFF", fontSize: 16, fontWeight: 900, marginTop: 2 }}>{tR("tlTurfWarHero")}</div>
        <div style={{ color: "#a8b4cf", fontSize: 11, marginTop: 2 }}>{tR("tlTurfWarSub")}</div>
      </div>

      {/* Standings-Tabelle */}
      <div style={{ borderRadius: 12, overflow: "hidden", background: "#1A1D23", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "44px 1fr 60px 60px 80px",
          gap: 8, padding: "10px 12px",
          background: "rgba(255,45,120,0.10)",
          borderBottom: "1px solid rgba(255,45,120,0.3)",
          fontSize: 9, fontWeight: 900, letterSpacing: 1.5, color: "#FF2D78",
        }}>
          <div>RANG</div>
          <div>CREW</div>
          <div style={{ textAlign: "right" }}>⚔️</div>
          <div style={{ textAlign: "right" }}>📍</div>
          <div style={{ textAlign: "right" }}>PUNKTE</div>
        </div>
        {data.standings.map((s, i) => {
          const accent = s.crews?.color ?? "#22D1C3";
          return (
            <div key={s.crew_id} style={{
              display: "grid", gridTemplateColumns: "44px 1fr 60px 60px 80px",
              gap: 8, padding: "8px 12px",
              background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
              alignItems: "center", fontSize: 12,
            }}>
              <div style={{ fontWeight: 900, color: i < 3 ? "#FFD700" : "#8B8FA3" }}>#{i + 1}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: accent, color: "#0F1115", fontWeight: 900, fontSize: 13,
                }}>{s.crews?.name?.charAt(0).toUpperCase() ?? "?"}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: "#FFF", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.crews?.name ?? "—"}
                  </div>
                  <div style={{ color: "#8B8FA3", fontSize: 10 }}>👥 {s.crews?.member_count ?? 0}</div>
                </div>
              </div>
              <div style={{ textAlign: "right", color: "#FF6B4A", fontWeight: 700 }}>{s.war_wins}</div>
              <div style={{ textAlign: "right", color: "#22D1C3", fontWeight: 700 }}>{s.territories_claimed}</div>
              <div style={{ textAlign: "right", color: accent, fontWeight: 900 }}>
                {Number(s.points ?? 0).toLocaleString("de-DE")}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MmrLeaderboardView() {
  const tMD = useTranslations("MapDashboard");
  const [entries, setEntries] = useState<MmrEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<MmrSort>("mmr");
  const [factionFilter, setFactionFilter] = useState<MmrFactionFilter>("all");
  const [tierFilter, setTierFilter] = useState<string | null>(null);
  const [isWide, setIsWide] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const upd = () => setIsWide(mq.matches);
    upd();
    mq.addEventListener("change", upd);
    return () => mq.removeEventListener("change", upd);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/runner/mmr/leaderboard?limit=100");
        if (!res.ok) { setError(tMD("leaderboardLoadFailed")); return; }
        const j = await res.json() as { entries: MmrEntry[] };
        setEntries(j.entries);
      } catch {
        setError(tMD("networkError"));
      }
    })();
  }, []);

  const visible = useMemo(() => {
    if (!entries) return null;
    const filtered = entries.filter((e) => {
      if (factionFilter !== "all" && normalizeFaction(e.faction) !== factionFilter) return false;
      if (tierFilter && e.tier.id !== tierFilter) return false;
      return true;
    });
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === "peak") return b.peak_mmr - a.peak_mmr;
      if (sortBy === "winrate") return b.win_rate - a.win_rate;
      if (sortBy === "games") return (b.wins + b.losses) - (a.wins + a.losses);
      return b.mmr - a.mmr;
    });
    return sorted.map((e, i) => ({ ...e, rank: i + 1 }));
  }, [entries, sortBy, factionFilter, tierFilter]);

  const filterSidebar = (
    <aside style={{
      position: isWide ? "sticky" : "static",
      top: isWide ? 12 : undefined,
      background: isWide ? "rgba(30, 38, 60, 0.45)" : "rgba(30, 38, 60, 0.35)",
      border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14,
      display: "flex", flexDirection: "column", gap: 14,
    }}>
      <div>
        <div style={{ color: MUTED, fontSize: 10, fontWeight: 800, marginBottom: 6, letterSpacing: 0.5 }}>SORTIERUNG</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <FilterPill active={sortBy === "mmr"} onClick={() => setSortBy("mmr")}>Wertung</FilterPill>
          <FilterPill active={sortBy === "peak"} onClick={() => setSortBy("peak")}>Peak</FilterPill>
          <FilterPill active={sortBy === "winrate"} onClick={() => setSortBy("winrate")}>Winrate</FilterPill>
          <FilterPill active={sortBy === "games"} onClick={() => setSortBy("games")}>Kämpfe</FilterPill>
        </div>
      </div>
      <div>
        <div style={{ color: MUTED, fontSize: 10, fontWeight: 800, marginBottom: 6, letterSpacing: 0.5 }}>FRAKTION</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <FilterPill active={factionFilter === "all"} onClick={() => setFactionFilter("all")}>Alle</FilterPill>
          <FilterPill active={factionFilter === "kronenwacht"} onClick={() => setFactionFilter("kronenwacht")}>👑 Kronenwacht</FilterPill>
          <FilterPill active={factionFilter === "gossenbund"} onClick={() => setFactionFilter("gossenbund")}>🗝️ Gossenbund</FilterPill>
        </div>
      </div>
      <div>
        <div style={{ color: MUTED, fontSize: 10, fontWeight: 800, marginBottom: 6, letterSpacing: 0.5 }}>RANG</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <FilterPill active={tierFilter === null} onClick={() => setTierFilter(null)}>Alle</FilterPill>
          {MMR_TIERS.map((t) => (
            <FilterPill key={t.id} active={tierFilter === t.id} onClick={() => setTierFilter(tierFilter === t.id ? null : t.id)}>
              {t.icon} {t.label}
            </FilterPill>
          ))}
        </div>
        <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: "pointer", color: "#a8b4cf", fontSize: 10, fontWeight: 800, listStyle: "none", userSelect: "none", padding: "6px 10px", background: "rgba(30,38,60,0.55)", borderRadius: 8, border: `1px solid ${BORDER}` }}>
            ▸ Wie erreicht man welchen Rang?
          </summary>
          <div style={{ marginTop: 6, padding: 10, borderRadius: 8, background: "rgba(15,17,21,0.6)", border: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", gap: 3 }}>
            {MMR_TIERS.map((t) => {
              const next = MMR_TIERS.find((x) => x.minMmr > t.minMmr);
              const range = next ? `${t.minMmr}–${next.minMmr - 1}` : `${t.minMmr}+`;
              return (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 6px", borderRadius: 6, background: `${t.color}11`, border: `1px solid ${t.color}33` }}>
                  <span style={{ fontSize: 12 }}>{t.icon}</span>
                  <span style={{ color: t.color, fontSize: 10, fontWeight: 900, flex: 1 }}>{t.label}</span>
                  <span style={{ color: "#8B8FA3", fontSize: 9, fontFamily: "monospace" }}>{range} Wertung</span>
                </div>
              );
            })}
            <div style={{ marginTop: 4, fontSize: 9, color: "#8B8FA3", lineHeight: 1.5 }}>
              Jeder startet bei 1000 MMR (Bronze). Sieg gegen Stärkere = viele MMR, Sieg gegen Schwächere = wenige. Nur Ranked-Runner-Fights zählen.
              K-Faktor: 32 in den ersten 30 Kämpfen (Kalibrierung), 16 ab Meister (≥2000 MMR), sonst 24.
            </div>
          </div>
        </details>
      </div>
    </aside>
  );

  const mainContent = (
    <div>
      {error && <div style={{ color: "#FF2D78", padding: 16, textAlign: "center" }}>{error}</div>}
      {!entries && !error && (
        <div style={{ color: "#8B8FA3", padding: 16, textAlign: "center" }}>Lade Leaderboard …</div>
      )}
      {visible && visible.length === 0 && (
        <div style={{ color: "#8B8FA3", padding: 24, textAlign: "center", fontSize: 13, lineHeight: 1.6 }}>
          {entries && entries.length > 0
            ? <>Keine Treffer für die gewählten Filter.</>
            : <>Noch keine gewerteten Kämpfe.<br/>Sei der Erste im Ranked-Modus!</>}
        </div>
      )}
      {visible && visible.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {visible.map((e) => {
            const isTop3 = e.rank <= 3;
            const rankColor = e.rank === 1 ? "#FFD700" : e.rank === 2 ? "#C0C0C0" : e.rank === 3 ? "#CD7F32" : "#8B8FA3";
            return (
              <div key={e.user_id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 12,
                background: isTop3 ? `linear-gradient(90deg, ${e.tier.color}18, transparent 80%)` : "rgba(30,38,60,0.45)",
                border: `1px solid ${isTop3 ? `${e.tier.color}66` : BORDER}`,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 16, flexShrink: 0,
                  background: `${rankColor}22`, border: `1px solid ${rankColor}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: rankColor, fontSize: 12, fontWeight: 900,
                }}>#{e.rank}</div>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: e.avatar_url ? `url("${e.avatar_url}") center/cover` : `linear-gradient(135deg, ${e.team_color ?? "#22D1C3"}, ${e.team_color ?? "#22D1C3"}55)`,
                  border: `1px solid ${e.team_color ?? "rgba(255,255,255,0.1)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                }}>{!e.avatar_url && "👣"}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#FFF", fontSize: 13, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {e.display_name ?? e.username ?? "Runner"}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2, fontSize: 10, color: "#8B8FA3" }}>
                    <span style={{ color: e.tier.color, fontWeight: 900 }}>{e.tier.icon} {e.tier.label}</span>
                    <span>·</span>
                    <span style={{ color: "#4ade80" }}>{e.wins}W</span>
                    <span style={{ color: "#FF2D78" }}>{e.losses}L</span>
                    <span>·</span>
                    <span>{e.win_rate}% WR</span>
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ color: "#FFF", fontSize: 16, fontWeight: 900, lineHeight: 1 }}>{e.mmr}</div>
                  <div style={{ color: "#8B8FA3", fontSize: 9, marginTop: 2 }}>
                    PEAK <span style={{ color: "#FFD700", fontWeight: 800 }}>{e.peak_mmr}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: isWide ? "260px 1fr" : "1fr",
      gap: 20, alignItems: "start",
    }}>
      {filterSidebar}
      <div>{mainContent}</div>
    </div>
  );
}

type ArenaView = "honor" | "wins" | "winrate" | "classes";

function ArenaLeaderboardView() {
  const [rows, setRows] = useState<ArenaHonorRow[] | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [view, setView] = useState<ArenaView>("honor");
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    const upd = () => setIsMobile(mq.matches);
    upd();
    mq.addEventListener("change", upd);
    return () => mq.removeEventListener("change", upd);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/leaderboard/hall-of-honor");
        const j = await r.json();
        const apiRows = (j.rows ?? []) as ArenaHonorRow[];
        const hasTypeData = apiRows.some((rr) => rr.guardian_type);
        if (apiRows.length > 0 && hasTypeData) {
          setRows(apiRows);
          setIsDemo(false);
          return;
        }
      } catch {}
      setIsDemo(true);
      // Demo-Rows mit realen Wächter-URLs anreichern (Eisenhand + Altmetall-Krieger)
      try {
        const r = await fetch("/api/guardian/archetypes-public?ids=eisenhand,schrotthaendler");
        const j = await r.json();
        const artMap = new Map<string, { image_url: string | null; video_url: string | null }>(
          ((j.archetypes ?? []) as Array<{ id: string; image_url: string | null; video_url: string | null }>).map((a) => [a.id, { image_url: a.image_url, video_url: a.video_url }]),
        );
        const patched = DEMO_ARENA_ROWS.map((row) => {
          if (row.user_id === "d1") {
            const art = artMap.get("eisenhand");
            return { ...row, guardian_archetype_id: "eisenhand", guardian_image_url: art?.image_url ?? null, guardian_video_url: art?.video_url ?? null };
          }
          if (row.user_id === "d2") {
            const art = artMap.get("schrotthaendler");
            return { ...row, guardian_archetype_id: "schrotthaendler", guardian_image_url: art?.image_url ?? null, guardian_video_url: art?.video_url ?? null };
          }
          return row;
        });
        setRows(patched);
      } catch {
        setRows(DEMO_ARENA_ROWS);
      }
    })();
  }, []);

  if (!rows) return <div style={{ padding: 20, textAlign: "center", color: "#8B8FA3", fontSize: 12 }}>Lade Arena-Rangliste…</div>;

  const sorted = [...rows].sort((a, b) => {
    if (view === "wins") return b.wins - a.wins;
    if (view === "winrate") {
      const wa = a.wins + a.losses > 0 ? a.wins / (a.wins + a.losses) : 0;
      const wb = b.wins + b.losses > 0 ? b.wins / (b.wins + b.losses) : 0;
      return wb - wa;
    }
    return b.honor - a.honor;
  });

  const top3 = sorted.slice(0, 3);
  return (
    <div style={{ padding: 12 }}>
      {/* Hero-Banner */}
      <div style={{
        padding: 14, borderRadius: 14, marginBottom: 14,
        background: "radial-gradient(ellipse at top, rgba(255,107,74,0.18) 0%, transparent 60%), linear-gradient(180deg, rgba(255,215,0,0.08) 0%, rgba(15,17,21,0.9) 100%)",
        border: "1px solid rgba(255,215,0,0.35)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ color: "#FFD700", fontSize: 10, fontWeight: 900, letterSpacing: 2 }}>🏟️ KAMPFARENA</div>
          {isDemo && (
            <span style={{
              padding: "2px 8px", borderRadius: 999,
              background: "rgba(168,85,247,0.2)", border: "1px solid rgba(168,85,247,0.5)",
              color: "#c084fc", fontSize: 9, fontWeight: 900, letterSpacing: 1.2,
            }}>🤖 DEMO-DATEN</span>
          )}
        </div>
        <div style={{ color: "#FFF", fontSize: 16, fontWeight: 900, marginTop: 2 }}>Rangliste der Gladiatoren</div>
        <div style={{ color: "#a8b4cf", fontSize: 11, marginTop: 2 }}>Ehre = Siege × Level × 10 — Wächter-PvP aus der Arena</div>
      </div>

      {/* Globale Stats (über Podium) */}
      <ArenaGlobalStats rows={rows} />

      {/* Podium Top 3 */}
      {top3.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: isMobile ? 4 : 8, marginBottom: 14, alignItems: "end" }}>
          {[top3[1], top3[0], top3[2]].filter(Boolean).map((r) => {
            const rank = r === top3[0] ? 1 : r === top3[1] ? 2 : 3;
            const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
            const color = rank === 1 ? "#FFD700" : rank === 2 ? "#C0C0C0" : "#CD7F32";
            const h = isMobile ? (rank === 1 ? 78 : rank === 2 ? 62 : 48) : (rank === 1 ? 110 : rank === 2 ? 90 : 70);
            const avatarSize = isMobile ? (rank === 1 ? 54 : 44) : (rank === 1 ? 72 : 56);
            return (
              <div key={r.user_id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                {/* Wächter-Avatar (Video > Bild > Emoji) */}
                <div style={{
                  width: avatarSize, height: avatarSize, borderRadius: "50%", overflow: "hidden",
                  border: `2px solid ${color}`,
                  boxShadow: `0 0 14px ${color}66`,
                  background: "rgba(15,17,21,0.8)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 4,
                }}>
                  {r.guardian_video_url ? (
                    <video src={r.guardian_video_url} autoPlay loop muted playsInline
                      style={{ width: "100%", height: "100%", objectFit: "cover", filter: "url(#ma365-chroma-black)" }} />
                  ) : r.guardian_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.guardian_image_url} alt={r.guardian_name ?? ""}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span style={{ fontSize: avatarSize * 0.5 }}>{r.guardian_emoji ?? "🛡️"}</span>
                  )}
                </div>
                <div style={{ fontSize: 22, marginTop: -6, filter: `drop-shadow(0 0 4px ${color})` }}>{medal}</div>
                <div style={{ color: "#FFF", fontSize: 11, fontWeight: 900, textAlign: "center", width: "100%", padding: "0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.display_name ?? r.username}
                </div>
                <div style={{ color: "#8B8FA3", fontSize: 9, marginBottom: 4 }}>{r.wins}W · Lvl {r.level}</div>
                <div style={{
                  width: "100%", height: h,
                  background: `linear-gradient(180deg, ${color}dd 0%, ${color}55 100%)`,
                  borderRadius: "8px 8px 0 0",
                  border: `1px solid ${color}`,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  boxShadow: `0 0 14px ${color}44`,
                }}>
                  <div style={{ color: "#0F1115", fontSize: 11, fontWeight: 900 }}>#{rank}</div>
                  <div style={{ color: "#0F1115", fontSize: 10, fontWeight: 900 }}>{r.honor.toLocaleString("de-DE")}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tabs: Ehre / Siege / Win-Rate / Klassen-Statistik */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {([
          { k: "honor",   label: "🏆 Ehre" },
          { k: "wins",    label: "⚔️ Siege" },
          { k: "winrate", label: "📊 Win-Rate" },
          { k: "classes", label: "⚔️ Klassen-Statistik" },
        ] as const).map((c) => (
          <button key={c.k} onClick={() => setView(c.k)} style={{
            padding: "8px 16px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.1)",
            background: view === c.k ? "#22D1C3" : "rgba(255,255,255,0.05)",
            color: view === c.k ? "#0F1115" : "#a8b4cf",
            fontSize: 13, fontWeight: 900, cursor: "pointer",
          }}>{c.label}</button>
        ))}
      </div>

      {view === "classes" ? (
        <ArenaClassesPanel rows={rows} />
      ) : (

      /* Table / Card-List */
      <div style={{
        borderRadius: 14, overflow: "hidden",
        border: "1px solid rgba(255,215,0,0.3)",
        background: "linear-gradient(180deg, rgba(255,215,0,0.04) 0%, rgba(15,17,21,0.9) 100%)",
      }}>
        {!isMobile && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "50px 28px 52px 1fr 110px 90px 70px 90px",
            gap: 8,
            padding: "12px 14px",
            background: "rgba(255,215,0,0.12)",
            borderBottom: "1px solid rgba(255,215,0,0.3)",
            fontSize: 11, fontWeight: 900, letterSpacing: 1.5, color: "#FFD700",
          }}>
            <div>RANG</div>
            <div></div>
            <div></div>
            <div>KÄMPFER</div>
            <div style={{ textAlign: "center" }}>SIEGE/NIEDERL.</div>
            <div style={{ textAlign: "center" }}>STREAK</div>
            <div style={{ textAlign: "right" }}>STUFE</div>
            <div style={{ textAlign: "right" }}>EHRE</div>
          </div>
        )}
        {sorted.slice(0, 100).map((r, i) => {
          const fNorm = normalizeFaction(r.faction);
          const factionColor = fNorm === "gossenbund" ? "#22D1C3" : fNorm === "kronenwacht" ? "#FFD700" : "#F0F0F0";
          const rankColor = i === 0 ? "#FFD700" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : "#8B8FA3";
          const typeMeta = r.guardian_type ? ARENA_TYPE_META[r.guardian_type] : null;
          const streak = r.streak ?? 0;
          const avatar = (
            <div style={{
              width: isMobile ? 44 : 48, height: isMobile ? 48 : 52, borderRadius: 8, overflow: "hidden",
              background: typeMeta ? `${typeMeta.color}11` : "rgba(255,255,255,0.03)",
              border: typeMeta ? `1px solid ${typeMeta.color}55` : "1px solid rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              {r.guardian_video_url ? (
                <video src={r.guardian_video_url} autoPlay loop muted playsInline
                  style={{ width: "100%", height: "100%", objectFit: "cover", filter: "url(#ma365-chroma-black)" }} />
              ) : r.guardian_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.guardian_image_url} alt={r.guardian_name ?? ""}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontSize: 22 }}>{r.guardian_emoji ?? typeMeta?.icon ?? "🛡️"}</span>
              )}
            </div>
          );

          if (isMobile) {
            // Mobile Karten-Layout
            return (
              <div key={r.user_id} style={{
                display: "flex", gap: 10, alignItems: "center",
                padding: "10px 12px",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
              }}>
                <div style={{ color: rankColor, fontWeight: 900, fontSize: 14, width: 34, textAlign: "center", flexShrink: 0 }}>
                  {i < 3 ? (i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉") : `#${i + 1}`}
                </div>
                {avatar}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {r.country && <CountryFlag country={r.country} size={20} />}
                    <div style={{ color: factionColor, fontWeight: 900, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                      {r.display_name ?? r.username}
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: "#8B8FA3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>
                    Lvl {r.level}
                    {typeMeta && <> · <span style={{ color: typeMeta.color, fontWeight: 700 }}>{typeMeta.label}</span></>}
                    {r.crew_name && <> · <span style={{ color: r.crew_color ?? "#8B8FA3", fontWeight: 700 }}>[{r.crew_name}]</span></>}
                  </div>
                  <div style={{ fontSize: 10, marginTop: 2, display: "flex", alignItems: "center", gap: 8 }}>
                    <span><span style={{ color: "#4ade80", fontWeight: 900 }}>{r.wins}</span><span style={{ color: "#8B8FA3" }}>/</span><span style={{ color: "#FF2D78", fontWeight: 900 }}>{r.losses}</span></span>
                    {streak >= 3 && (
                      <span style={{
                        padding: "1px 6px", borderRadius: 999,
                        background: streak >= 10 ? "rgba(255,45,120,0.25)" : "rgba(255,107,74,0.2)",
                        border: `1px solid ${streak >= 10 ? "#FF2D78" : "#FF6B4A"}`,
                        color: streak >= 10 ? "#FF2D78" : "#FF6B4A",
                        fontSize: 10, fontWeight: 900,
                      }}>🔥 {streak}</span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ color: "#FFD700", fontWeight: 900, fontFamily: "ui-monospace, monospace", fontSize: 13, lineHeight: 1 }}>
                    {r.honor.toLocaleString("de-DE")}
                  </div>
                  <div style={{ color: "#8B8FA3", fontSize: 9, marginTop: 2 }}>Ehre</div>
                </div>
              </div>
            );
          }

          // Desktop Tabellen-Layout
          return (
            <div key={r.user_id} style={{
              display: "grid",
              gridTemplateColumns: "50px 28px 52px 1fr 110px 90px 70px 90px",
              gap: 8,
              padding: "12px 14px", alignItems: "center", fontSize: 14,
              borderBottom: "1px solid rgba(255,255,255,0.04)",
              background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
            }}>
              <div style={{ color: rankColor, fontWeight: 900, fontSize: 16 }}>
                {i < 3 ? (i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉") : `#${i + 1}`}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                {r.country ? <CountryFlag country={r.country} size={24} /> : <span style={{ fontSize: 16 }}>🏳️</span>}
              </div>
              {avatar}
              <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ color: factionColor, fontWeight: 900, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.display_name ?? r.username}
                  </div>
                  <div style={{ fontSize: 11, color: "#8B8FA3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {typeMeta && <span style={{ color: typeMeta.color, fontWeight: 700 }}>{typeMeta.label}</span>}
                    {typeMeta && r.crew_name && " · "}
                    {r.crew_name && <span style={{ color: r.crew_color ?? "#8B8FA3", fontWeight: 700 }}>[{r.crew_name}]</span>}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: "center", fontSize: 13 }}>
                <span style={{ color: "#4ade80", fontWeight: 900 }}>{r.wins}</span>
                <span style={{ color: "#8B8FA3" }}> / </span>
                <span style={{ color: "#FF2D78", fontWeight: 900 }}>{r.losses}</span>
              </div>
              <div style={{ textAlign: "center" }}>
                {streak >= 3 ? (
                  <span style={{
                    padding: "3px 9px", borderRadius: 999,
                    background: streak >= 10 ? "rgba(255,45,120,0.25)" : "rgba(255,107,74,0.2)",
                    border: `1px solid ${streak >= 10 ? "#FF2D78" : "#FF6B4A"}`,
                    color: streak >= 10 ? "#FF2D78" : "#FF6B4A",
                    fontSize: 12, fontWeight: 900,
                  }}>🔥 {streak}</span>
                ) : (
                  <span style={{ color: "#8B8FA3", fontSize: 12 }}>{streak || "—"}</span>
                )}
              </div>
              <div style={{ textAlign: "right", color: "#F0F0F0", fontWeight: 700, fontSize: 14 }}>{r.level}</div>
              <div style={{ textAlign: "right", color: "#FFD700", fontWeight: 900, fontFamily: "ui-monospace, monospace", fontSize: 14 }}>
                {r.honor.toLocaleString("de-DE")}
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}

function ArenaGlobalStats({ rows }: { rows: ArenaHonorRow[] }) {
  const totalFights = rows.reduce((s, r) => s + r.wins + r.losses, 0);
  const topStreak = rows.reduce((best, r) => Math.max(best, r.streak ?? 0), 0);
  const streakHolder = rows.find((r) => (r.streak ?? 0) === topStreak && topStreak > 0);

  const vanguardWins = rows.filter((r) => normalizeFaction(r.faction) === "kronenwacht").reduce((s, r) => s + r.wins, 0);
  const syndicateWins = rows.filter((r) => normalizeFaction(r.faction) === "gossenbund").reduce((s, r) => s + r.wins, 0);
  const facTotal = vanguardWins + syndicateWins || 1;
  const vanguardPct = Math.round((vanguardWins / facTotal) * 100);

  const countryCounts = new Map<string, number>();
  for (const r of rows) {
    if (!r.country) continue;
    countryCounts.set(r.country, (countryCounts.get(r.country) ?? 0) + 1);
  }
  const topCountries = Array.from(countryCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 14 }}>
      <StatCard icon="⚔️" label="GESAMT-KÄMPFE" value={totalFights.toLocaleString("de-DE")} sub="seit Launch" color="#22D1C3" />
      <StatCard icon="🔥" label="LÄNGSTE SERIE" value={topStreak > 0 ? `${topStreak} Siege` : "—"} sub={streakHolder?.display_name ?? streakHolder?.username ?? "Noch keine Serie"} color="#FF2D78" />
      <StatCard icon="🏛️" label="FRAKTIONS-DUELL"
        value={`${vanguardPct}% vs ${100 - vanguardPct}%`}
        sub="👑 Kronenwacht vs 🗝️ Gossenbund"
        color="#FFD700" />
      <StatCard icon="🌍" label="TOP-LÄNDER"
        value={topCountries.length > 0 ? topCountries.map(([, c]) => c).join(" · ") : "—"}
        sub={topCountries.length > 0 ? topCountries.map(([c]) => c).join(", ") : "—"}
        color="#a855f7" />
    </div>
  );
}

function ArenaClassesPanel({ rows }: { rows: ArenaHonorRow[] }) {
  const typeStats = new Map<string, { picks: number; wins: number; losses: number; honor: number }>();
  for (const r of rows) {
    const t = r.guardian_type;
    if (!t) continue;
    const cur = typeStats.get(t) ?? { picks: 0, wins: 0, losses: 0, honor: 0 };
    cur.picks += 1;
    cur.wins += r.wins;
    cur.losses += r.losses;
    cur.honor += r.honor;
    typeStats.set(t, cur);
  }
  const totalPicks = Array.from(typeStats.values()).reduce((s, v) => s + v.picks, 0) || 1;

  // Top-Typ nach Win-Rate
  const typeRanking = Object.keys(ARENA_TYPE_META)
    .map((k) => {
      const s = typeStats.get(k) ?? { picks: 0, wins: 0, losses: 0, honor: 0 };
      const total = s.wins + s.losses;
      return { key: k, winPct: total > 0 ? s.wins / total : 0, picks: s.picks };
    })
    .sort((a, b) => b.winPct - a.winPct);

  return (
    <div>
      <div style={{
        padding: 14, borderRadius: 14, marginBottom: 12,
        background: "rgba(30,38,60,0.45)", border: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{ color: "#FFD700", fontSize: 12, fontWeight: 900, letterSpacing: 2, marginBottom: 12 }}>
          ⚔️ KLASSEN-VERTEILUNG & WIN-RATE
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {Object.entries(ARENA_TYPE_META).map(([key, meta]) => {
            const stat = typeStats.get(key) ?? { picks: 0, wins: 0, losses: 0, honor: 0 };
            const pickPct = Math.round((stat.picks / totalPicks) * 100);
            const total = stat.wins + stat.losses;
            const winPct = total > 0 ? Math.round((stat.wins / total) * 100) : 0;
            const isMeta = typeRanking[0]?.key === key && winPct > 0;
            return (
              <div key={key} style={{
                position: "relative",
                padding: 14, borderRadius: 12,
                background: `linear-gradient(135deg, ${meta.color}22 0%, rgba(15,17,21,0.8) 100%)`,
                border: `1px solid ${meta.color}77`,
                boxShadow: isMeta ? `0 0 20px ${meta.color}55` : "none",
              }}>
                {isMeta && (
                  <div style={{
                    position: "absolute", top: 8, right: 8,
                    padding: "2px 8px", borderRadius: 999,
                    background: "#FFD700", color: "#0F1115",
                    fontSize: 9, fontWeight: 900, letterSpacing: 1.2,
                  }}>👑 META</div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 10,
                    background: `${meta.color}33`, border: `1px solid ${meta.color}`,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
                  }}>{meta.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: meta.color, fontSize: 15, fontWeight: 900 }}>{meta.label}</div>
                    <div style={{ color: "#8B8FA3", fontSize: 11 }}>{stat.picks} Runner · {stat.wins}W/{stat.losses}L</div>
                  </div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#a8b4cf", marginBottom: 3 }}>
                    <span>Pick-Rate</span><span style={{ color: meta.color, fontWeight: 900, fontSize: 13 }}>{pickPct}%</span>
                  </div>
                  <div style={{ height: 7, background: "rgba(0,0,0,0.4)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${pickPct}%`, height: "100%", background: meta.color }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#a8b4cf", marginBottom: 3 }}>
                    <span>Win-Rate</span><span style={{ color: winPct >= 50 ? "#4ade80" : "#FF2D78", fontWeight: 900, fontSize: 13 }}>{winPct}%</span>
                  </div>
                  <div style={{ height: 7, background: "rgba(0,0,0,0.4)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${winPct}%`, height: "100%", background: winPct >= 50 ? "#4ade80" : "#FF2D78" }} />
                  </div>
                </div>
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", fontSize: 10, color: "#a8b4cf" }}>
                  <span>Ehre-Beitrag</span>
                  <span style={{ color: "#FFD700", fontWeight: 900 }}>{stat.honor.toLocaleString("de-DE")}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color }: { icon: string; label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{
      position: "relative",
      padding: "12px 14px", borderRadius: 12,
      background: `linear-gradient(135deg, ${color}18 0%, rgba(15,17,21,0.7) 90%)`,
      border: `1px solid ${color}55`,
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06)`,
    }}>
      <div style={{ position: "absolute", top: 8, right: 10, fontSize: 22, opacity: 0.35 }}>{icon}</div>
      <div style={{ color: "#8B8FA3", fontSize: 10, fontWeight: 900, letterSpacing: 1.5 }}>{label}</div>
      <div style={{ color, fontSize: 18, fontWeight: 900, lineHeight: 1.2, marginTop: 3 }}>{value}</div>
      <div style={{ color: "#a8b4cf", fontSize: 10, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>
    </div>
  );
}
