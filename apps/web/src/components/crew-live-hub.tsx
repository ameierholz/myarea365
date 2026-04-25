"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { appAlert, appConfirm } from "@/components/app-dialog";
import { getDateLocale, getNumberLocale } from "@/i18n/config";

type Crew = {
  id: string;
  name: string;
  color: string | null;
  owner_id: string | null;
  invite_code: string | null;
};

type Tab = "overview" | "war" | "season" | "flags" | "duel" | "challenges" | "events" | "chat" | "feed" | "shop" | "power";
type CrewT = ReturnType<typeof useTranslations<"CrewLiveHub">>;

const TAB_DEFS: Array<{ id: Tab; icon: string; color: string; labelKey: "tabWar" | "tabSeason" | "tabFlags" | "tabDuel" | "tabShop" | "tabPower" }> = [
  { id: "war",       icon: "🔥", color: "#FF2D78", labelKey: "tabWar" },
  { id: "season",    icon: "🏆", color: "#FFD700", labelKey: "tabSeason" },
  { id: "flags",     icon: "🚩", color: "#4ade80", labelKey: "tabFlags" },
  { id: "duel",      icon: "⚔️", color: "#FF6B4A", labelKey: "tabDuel" },
  { id: "shop",      icon: "💎", color: "#FF6B4A", labelKey: "tabShop" },
  { id: "power",     icon: "⚡", color: "#FFD700", labelKey: "tabPower" },
];

export function CrewLiveHub({ crew, userId, isAdmin }: {
  crew: Crew;
  userId: string;
  isAdmin: boolean;
}) {
  const t = useTranslations("CrewLiveHub");
  const [tab, setTab] = useState<Tab>("war");
  return (
    <div style={{
      background: "rgba(30,38,60,0.55)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 18,
      padding: 14,
      marginTop: 12,
      marginBottom: 18,
    }}>
      <div style={{ fontSize: 10, letterSpacing: 1.5, color: "#22D1C3", fontWeight: 900, marginBottom: 10 }}>
        {t("liveHeader")}
      </div>

      <div style={{
        display: "flex", gap: 4, overflowX: "auto", marginBottom: 14,
        scrollbarWidth: "none",
      }}>
        {TAB_DEFS.map((td) => {
          const active = tab === td.id;
          return (
            <button
              key={td.id}
              onClick={() => setTab(td.id)}
              style={{
                flexShrink: 0, padding: "8px 12px", borderRadius: 999,
                background: active ? `${td.color}22` : "rgba(255,255,255,0.04)",
                border: `1px solid ${active ? td.color : "rgba(255,255,255,0.1)"}`,
                color: active ? td.color : "#a8b4cf",
                fontSize: 12, fontWeight: 800, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 4,
              }}
            >
              <span>{td.icon}</span>
              <span>{t(td.labelKey)}</span>
            </button>
          );
        })}
      </div>

      {tab === "war"        && <WarPanel     crew={crew} isAdmin={isAdmin} />}
      {tab === "season"     && <SeasonPanel  crew={crew} />}
      {tab === "flags"      && <FlagsPanel   crew={crew} userId={userId} />}
      {tab === "duel"       && <DuelPanel    crew={crew} />}
      {tab === "shop"       && <ShopPanel    crew={crew} userId={userId} isAdmin={isAdmin} />}
      {tab === "power"      && <PowerPanel   crew={crew} userId={userId} isAdmin={isAdmin} />}
    </div>
  );
}

// ═══ WAR ═══
type War = {
  id: string; status: string; starts_at: string | null; ends_at: string | null;
  crew_a_id: string; crew_b_id: string;
  crew_a_score: number; crew_b_score: number;
  crew_a_km: number; crew_b_km: number;
  crew_a_territories: number; crew_b_territories: number;
  winner_crew_id: string | null; prize_xp: number; declared_by: string;
  crew_a: { id: string; name: string; color: string | null } | { id: string; name: string; color: string | null }[] | null;
  crew_b: { id: string; name: string; color: string | null } | { id: string; name: string; color: string | null }[] | null;
};
function WarPanel({ crew, isAdmin }: { crew: Crew; isAdmin: boolean }) {
  const t = useTranslations("CrewLiveHub");
  const locale = useLocale();
  const numLocale = getNumberLocale(locale);
  const [wars, setWars] = useState<War[] | null>(null);
  const [declaring, setDeclaring] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/crew/wars?crew_id=${crew.id}`);
    const j = await r.json();
    setWars(j.wars ?? []);
  }, [crew.id]);
  useEffect(() => { void load(); }, [load]);

  async function act(id: string, action: "accept" | "decline" | "cancel") {
    setBusy(id);
    try {
      await fetch("/api/crew/wars", {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      await load();
    } finally { setBusy(null); }
  }

  const active = wars?.find((w) => w.status === "active");
  const pending = wars?.filter((w) => w.status === "pending") ?? [];
  const past = wars?.filter((w) => ["finished","cancelled","declined"].includes(w.status)) ?? [];

  return (
    <div>
      <CrewTabInfo tab="war" />
      {wars === null && <Loading />}
      {isAdmin && wars !== null && !active && (
        <button onClick={() => setDeclaring(true)} style={{
          width: "100%", marginBottom: 10, padding: "10px 12px", borderRadius: 10,
          background: "rgba(255,45,120,0.15)", border: "1px dashed rgba(255,45,120,0.5)",
          color: "#FF2D78", fontWeight: 900, fontSize: 12, cursor: "pointer",
        }}>{t("warDeclareButton")}</button>
      )}

      {active && <WarCard war={active} myCrewId={crew.id} t={t} numLocale={numLocale} />}

      {pending.length > 0 && (
        <>
          <div style={{ fontSize: 10, color: "#FFD700", fontWeight: 900, letterSpacing: 1.5, marginTop: 12, marginBottom: 6 }}>{t("warPendingHeading")}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {pending.map((w) => {
              const a = Array.isArray(w.crew_a) ? w.crew_a[0] : w.crew_a;
              const b = Array.isArray(w.crew_b) ? w.crew_b[0] : w.crew_b;
              const iAmTarget = w.crew_b_id === crew.id;
              const iAmDeclarer = w.crew_a_id === crew.id;
              return (
                <div key={w.id} style={{ padding: 12, borderRadius: 12, background: "rgba(15,17,21,0.55)", border: "1px solid rgba(255,215,0,0.35)" }}>
                  <div style={{ color: "#FFF", fontSize: 13, fontWeight: 900 }}>
                    {a?.name} <span style={{ color: "#FF2D78" }}>vs</span> {b?.name}
                  </div>
                  <div style={{ color: "#a8b4cf", fontSize: 11, marginTop: 2 }}>
                    {iAmTarget ? t("warOtherWants") : t("warWaitResponse")}
                  </div>
                  {isAdmin && (
                    <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                      {iAmTarget && (
                        <>
                          <button onClick={() => act(w.id, "accept")} disabled={busy === w.id} style={{ ...btnPrimary, background: "linear-gradient(135deg,#4ade80,#22D1C3)", color: "#0F1115" }}>{t("warAccept")}</button>
                          <button onClick={() => act(w.id, "decline")} disabled={busy === w.id} style={btnSecondary}>{t("warDecline")}</button>
                        </>
                      )}
                      {iAmDeclarer && (
                        <button onClick={() => act(w.id, "cancel")} disabled={busy === w.id} style={btnSecondary}>{t("warWithdraw")}</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {past.length > 0 && (
        <>
          <div style={{ fontSize: 10, color: "#8B8FA3", fontWeight: 900, letterSpacing: 1.5, marginTop: 14, marginBottom: 6 }}>{t("warPastHeading")}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {past.slice(0, 5).map((w) => <WarCard key={w.id} war={w} myCrewId={crew.id} compact t={t} numLocale={numLocale} />)}
          </div>
        </>
      )}

      {!active && pending.length === 0 && past.length === 0 && (
        <Empty text={t("warEmpty")} />
      )}

      {declaring && <DeclareWarModal onClose={() => { setDeclaring(false); void load(); }} />}
    </div>
  );
}
function WarCard({ war, myCrewId, compact, t, numLocale }: { war: War; myCrewId: string; compact?: boolean; t: CrewT; numLocale: string }) {
  const a = Array.isArray(war.crew_a) ? war.crew_a[0] : war.crew_a;
  const b = Array.isArray(war.crew_b) ? war.crew_b[0] : war.crew_b;
  const total = war.crew_a_score + war.crew_b_score;
  const aPct = total > 0 ? (war.crew_a_score / total) * 100 : 50;
  const iAmA = war.crew_a_id === myCrewId;
  const mine = iAmA ? war.crew_a_score : war.crew_b_score;
  const opp = iAmA ? war.crew_b_score : war.crew_a_score;
  const iWon = war.winner_crew_id === myCrewId;
  const isActive = war.status === "active";
  const hoursLeft = war.ends_at ? Math.max(0, Math.ceil((new Date(war.ends_at).getTime() - Date.now()) / 3600000)) : 0;

  return (
    <div style={{
      padding: compact ? 10 : 14, borderRadius: 12,
      background: isActive ? "linear-gradient(135deg,rgba(255,45,120,0.12),rgba(255,107,74,0.08))" : "rgba(15,17,21,0.5)",
      border: `1px solid ${isActive ? "#FF2D78" : "rgba(255,255,255,0.08)"}`,
      boxShadow: isActive ? "0 0 16px rgba(255,45,120,0.25)" : undefined,
    }}>
      {isActive && (
        <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 1.5, color: "#FF2D78", marginBottom: 6 }}>
          {hoursLeft < 48
            ? t("warActiveHoursLeft", { hours: hoursLeft, prize: war.prize_xp })
            : t("warActiveDaysLeft", { days: Math.ceil(hoursLeft/24), prize: war.prize_xp })}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
        <span style={{ color: a?.color ?? "#22D1C3", fontWeight: 900 }}>{a?.name ?? "?"}</span>
        <span style={{ color: b?.color ?? "#FF2D78", fontWeight: 900 }}>{b?.name ?? "?"}</span>
      </div>
      <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", background: "rgba(255,255,255,0.05)" }}>
        <div style={{ width: `${aPct}%`, background: a?.color ?? "#22D1C3" }} />
        <div style={{ flex: 1, background: b?.color ?? "#FF2D78" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginTop: 4, color: "#a8b4cf" }}>
        <span>{t("warStatsLine", { score: Math.round(war.crew_a_score), km: Number(war.crew_a_km).toFixed(1), terr: war.crew_a_territories })}</span>
        <span>{t("warStatsLine", { score: Math.round(war.crew_b_score), km: Number(war.crew_b_km).toFixed(1), terr: war.crew_b_territories })}</span>
      </div>
      {!isActive && war.winner_crew_id && (
        <div style={{ fontSize: 10, marginTop: 6, color: iWon ? "#4ade80" : "#FF2D78", fontWeight: 900, textAlign: "center" }}>
          {iWon ? t("warYouWin", { prize: war.prize_xp }) : t("warLost")}
        </div>
      )}
      {isActive && (
        <div style={{ fontSize: 10, marginTop: 6, color: "#FFF", fontWeight: 700, textAlign: "center" }}>
          {mine > opp ? t("warLeading", { n: Math.round(mine - opp) }) : mine < opp ? t("warBehind", { n: Math.round(opp - mine) }) : t("warTie")}
        </div>
      )}
      {/* numLocale reserved for future */}
      <span hidden>{numLocale}</span>
    </div>
  );
}
function DeclareWarModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("CrewLiveHub");
  const sb = useMemo(() => createClient(), []);
  const [search, setSearch] = useState("");
  const [candidates, setCandidates] = useState<Array<{ id: string; name: string; color: string | null; zip: string | null; member_count: number | null }> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: me } = await sb.auth.getUser();
      if (!me.user) return;
      const { data: prof } = await sb.from("users").select("current_crew_id").eq("id", me.user.id).maybeSingle<{ current_crew_id: string | null }>();
      let q = sb.from("crews").select("id, name, color, zip, member_count").limit(50);
      if (prof?.current_crew_id) q = q.neq("id", prof.current_crew_id);
      if (search.trim()) q = q.ilike("name", `%${search.trim()}%`);
      const { data } = await q;
      setCandidates(data as Array<{ id: string; name: string; color: string | null; zip: string | null; member_count: number | null }> ?? []);
    })();
  }, [sb, search]);

  async function declare(targetId: string) {
    setBusy(targetId);
    try {
      const r = await fetch("/api/crew/wars", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ target_crew_id: targetId }),
      });
      const j = await r.json();
      if (!r.ok) { await appAlert(t("warErrorPrefix", { msg: String(j.error ?? r.status) })); return; }
      await appAlert(t("warSentAlert"));
      onClose();
    } finally { setBusy(null); }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 440, maxHeight: "90vh", overflow: "auto", background: "#1A1D23", borderRadius: 16, border: "1px solid rgba(255,45,120,0.4)", padding: 20, color: "#FFF" }}>
        <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 4 }}>{t("warModalTitle")}</div>
        <div style={{ fontSize: 11, color: "#a8b4cf", marginBottom: 12 }}>
          {t("warModalSub")}
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("warSearchPlaceholder")}
          style={{ ...selectStyle, width: "100%", marginBottom: 10 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 360, overflowY: "auto" }}>
          {candidates === null ? <Loading /> : candidates.length === 0 ? <Empty text={t("warNoCrewsFound")} /> : candidates.map((c) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, background: "rgba(15,17,21,0.5)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: c.color ?? "#22D1C3", display: "flex", alignItems: "center", justifyContent: "center", color: "#0F1115", fontWeight: 900, fontSize: 13, flexShrink: 0 }}>
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#FFF", fontSize: 12, fontWeight: 900 }}>{c.name}</div>
                <div style={{ color: "#8B8FA3", fontSize: 10 }}>{t("warPlzMembers", { plz: c.zip ?? "?", n: c.member_count ?? 0 })}</div>
              </div>
              <button onClick={() => declare(c.id)} disabled={busy === c.id} style={{
                padding: "6px 10px", borderRadius: 8, border: "none",
                background: "linear-gradient(135deg,#FF2D78,#FF6B4A)", color: "#FFF",
                fontSize: 11, fontWeight: 900, cursor: "pointer", opacity: busy === c.id ? 0.6 : 1,
              }}>{t("warBtnDeclare")}</button>
            </div>
          ))}
        </div>
        <button onClick={onClose} style={{ ...btnSecondary, width: "100%", marginTop: 12 }}>{t("abort")}</button>
      </div>
    </div>
  );
}

// ═══ SEASON ═══
type SeasonStanding = {
  crew_id: string; tier: string; points: number; duel_wins: number; war_wins: number; territories_claimed: number;
  crew: { id: string; name: string; color: string | null } | { id: string; name: string; color: string | null }[] | null;
};
function SeasonPanel({ crew }: { crew: Crew }) {
  const t = useTranslations("CrewLiveHub");
  const [data, setData] = useState<{ standings: SeasonStanding[]; my_rank: number | null; my_entry: { tier: string; points: number } | null; season: { year: number; month: number; ends_at: string } | null } | null>(null);

  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/crew/season?crew_id=${crew.id}`);
      const j = await r.json();
      setData(j);
    })();
  }, [crew.id]);

  if (!data) return <div><CrewTabInfo tab="season" /><Loading /></div>;
  const daysLeft = data.season ? Math.max(0, Math.ceil((new Date(data.season.ends_at).getTime() - Date.now()) / 86400000)) : 0;

  return (
    <div>
      <CrewTabInfo tab="season" />
      <div style={{ padding: 14, borderRadius: 12, background: "linear-gradient(135deg,rgba(255,215,0,0.12),rgba(255,107,74,0.08))", border: "1px solid rgba(255,215,0,0.3)", marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1.5, color: "#FFD700" }}>
          {data.season
            ? t("seasonInfo", { month: data.season.month, year: data.season.year, days: daysLeft })
            : t("seasonInfoUnknown", { days: daysLeft })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#FFF", fontSize: 18, fontWeight: 900 }}>
              {data.my_rank ? t("seasonRank", { rank: data.my_rank }) : t("seasonUnranked")}
            </div>
            <div style={{ color: "#a8b4cf", fontSize: 11 }}>
              {data.my_entry
                ? t("seasonTierLine", { tier: data.my_entry.tier.toUpperCase(), points: Math.round(data.my_entry.points) })
                : t("seasonStartHint")}
            </div>
          </div>
        </div>
      </div>

      <div style={{ fontSize: 10, color: "#8B8FA3", fontWeight: 900, letterSpacing: 1.5, marginBottom: 6 }}>{t("seasonTopHeading")}</div>
      {data.standings.length === 0 ? <Empty text={t("seasonNoStandings")} /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {data.standings.slice(0, 20).map((s, i) => {
            const c = Array.isArray(s.crew) ? s.crew[0] : s.crew;
            const isMe = s.crew_id === crew.id;
            return (
              <div key={s.crew_id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "6px 10px", borderRadius: 8,
                background: isMe ? "rgba(34,209,195,0.12)" : "rgba(15,17,21,0.4)",
                border: `1px solid ${isMe ? "rgba(34,209,195,0.4)" : "rgba(255,255,255,0.05)"}`,
              }}>
                <div style={{ width: 24, textAlign: "center", fontSize: 11, fontWeight: 900, color: i < 3 ? "#FFD700" : "#8B8FA3" }}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i+1}`}
                </div>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: c?.color ?? "#22D1C3", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#0F1115", fontSize: 11, fontWeight: 900 }}>
                  {c?.name.charAt(0).toUpperCase() ?? "?"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#FFF", fontSize: 12, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c?.name ?? "?"}</div>
                  <div style={{ color: "#8B8FA3", fontSize: 9 }}>
                    {t("seasonRowSub", { tier: s.tier, d: s.duel_wins, w: s.war_wins, t: s.territories_claimed })}
                  </div>
                </div>
                <div style={{ color: "#FFD700", fontSize: 13, fontWeight: 900 }}>{Math.round(s.points)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══ FLAGS ═══
type FlagEvent = {
  id: string; name: string; lat: number; lng: number; radius_m: number; plz: string | null;
  ends_at: string; target_visits: number; prize_xp: number; status: string;
  leaderboard: Array<{ crew_id: string; name: string; color: string | null; visits: number }>;
};
function FlagsPanel({ crew }: { crew: Crew; userId: string }) {
  const t = useTranslations("CrewLiveHub");
  const [events, setEvents] = useState<FlagEvent[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/crew/flags`);
    const j = await r.json();
    setEvents(j.events ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function claimVisit(eventId: string) {
    if (!navigator.geolocation) { await appAlert(t("flagGpsUnavail")); return; }
    setBusy(eventId);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 }));
      const r = await fetch("/api/crew/flags", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ event_id: eventId, lat: pos.coords.latitude, lng: pos.coords.longitude }),
      });
      const j = await r.json();
      if (!r.ok) {
        await appAlert(j.error === "out_of_range"
          ? t("flagOutOfRange", { distance: j.distance })
          : t("flagGenericError", { error: String(j.error) }));
        return;
      }
      if (j.won) await appAlert(t("flagWonAlert", { xp: j.gebietsruf ?? j.xp ?? 0 }));
      else await appAlert(t("flagVisitAlert", { visits: j.crew_visits }));
      await load();
    } catch (e) {
      await appAlert(t("flagGpsError", { msg: e instanceof Error ? e.message : "?" }));
    } finally { setBusy(null); }
  }

  return (
    <div>
      <CrewTabInfo tab="flags" />
      {events === null ? <Loading /> : events.length === 0 ? (
        <Empty text={t("flagsEmpty")} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {renderFlagEvents(events, crew.id, busy, claimVisit, t)}
        </div>
      )}
    </div>
  );
}

function renderFlagEvents(
  events: FlagEvent[],
  crewId: string,
  busy: string | null,
  claimVisit: (eventId: string) => void,
  t: CrewT,
) {
  return events.map((e) => {
    const hoursLeft = Math.max(0, Math.ceil((new Date(e.ends_at).getTime() - Date.now()) / 3600000));
    const myRank = e.leaderboard.findIndex((l) => l.crew_id === crewId);
    const myVisits = myRank >= 0 ? e.leaderboard[myRank].visits : 0;
    const pctToTarget = Math.min(100, (myVisits / e.target_visits) * 100);
    return (
      <div key={e.id} style={{ padding: 12, borderRadius: 12, background: "rgba(15,17,21,0.5)", border: "1px solid rgba(74,222,128,0.35)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#4ade80", fontSize: 9, fontWeight: 900, letterSpacing: 1.5 }}>{t("flagBadge")}</div>
            <div style={{ color: "#FFF", fontSize: 14, fontWeight: 900, marginTop: 2 }}>{e.name}</div>
            <div style={{ color: "#a8b4cf", fontSize: 10, marginTop: 2 }}>
              {e.plz
                ? t("flagDetails", { plz: e.plz, radius: e.radius_m, hours: hoursLeft })
                : t("flagDetailsNoPlz", { radius: e.radius_m, hours: hoursLeft })}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#FFD700", fontSize: 12, fontWeight: 900 }}>{t("flagPrize", { xp: e.prize_xp })}</div>
            <div style={{ color: "#8B8FA3", fontSize: 9 }}>{t("flagWinnerTo")}</div>
          </div>
        </div>
        <div style={{ marginTop: 10, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pctToTarget}%`, background: "linear-gradient(90deg,#4ade80,#22D1C3)" }} />
        </div>
        <div style={{ fontSize: 10, color: "#8B8FA3", marginTop: 4, textAlign: "right" }}>
          {t("flagYourCrew", { visits: myVisits, target: e.target_visits })}
        </div>
        {e.leaderboard.length > 0 && (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 3 }}>
            {e.leaderboard.slice(0, 3).map((l, i) => (
              <div key={l.crew_id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                <span style={{ color: i === 0 ? "#FFD700" : "#8B8FA3", fontWeight: 900, width: 18 }}>#{i+1}</span>
                <span style={{ color: l.color ?? "#22D1C3", fontWeight: 800, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</span>
                <span style={{ color: "#FFF", fontWeight: 800 }}>{l.visits}</span>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={() => claimVisit(e.id)}
          disabled={busy === e.id}
          style={{
            width: "100%", marginTop: 10, padding: "10px 12px", borderRadius: 10, border: "none",
            background: "linear-gradient(135deg,#4ade80,#22D1C3)", color: "#0F1115",
            fontSize: 13, fontWeight: 900, cursor: "pointer", opacity: busy === e.id ? 0.6 : 1,
          }}
        >{busy === e.id ? t("flagChecking") : t("flagAtSpot")}</button>
      </div>
    );
  });
}

// ═══ MEMBERS (currently unused but kept) ═══
type Member = {
  user_id: string; role: string; joined_at: string | null;
  username: string | null; display_name: string | null; avatar_url: string | null;
  level: number; xp: number;
  wegemuenzen: number; gebietsruf: number; sessionehre: number;
  team_color: string | null;
  last_seen_at: string | null; streak_days: number;
};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _MembersPanel({ crew }: { crew: Crew }) {
  const t = useTranslations("CrewLiveHub");
  const locale = useLocale();
  const numLocale = getNumberLocale(locale);
  const [members, setMembers] = useState<Member[] | null>(null);
  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/crew/members?crew_id=${crew.id}`);
      const j = await r.json();
      setMembers(j.members ?? []);
    })();
  }, [crew.id]);

  return (
    <div>
      <CrewTabInfo tab="overview" />
      {members === null ? <Loading /> : members.length === 0 ? <Empty text={t("membersEmpty")} /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {renderMemberRows(members, t, numLocale)}
        </div>
      )}
    </div>
  );
}

function renderMemberRows(members: Member[], t: CrewT, numLocale: string) {
  return members.map((m) => {
    const online = m.last_seen_at && Date.now() - new Date(m.last_seen_at).getTime() < 5 * 60 * 1000;
    return (
      <div key={m.user_id} style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 10px", borderRadius: 10,
        background: "rgba(15,17,21,0.5)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
          background: m.team_color ?? "#22D1C3",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#0F1115", fontWeight: 900, fontSize: 13,
          position: "relative",
        }}>
          {(m.display_name ?? m.username ?? "?").charAt(0).toUpperCase()}
          {online && (
            <span style={{
              position: "absolute", bottom: -2, right: -2,
              width: 10, height: 10, borderRadius: "50%",
              background: "#4ade80", border: "2px solid #0F1115",
            }} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "#FFF", fontSize: 13, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {m.display_name ?? m.username ?? "?"}
            </span>
            {(m.role === "admin" || m.role === "owner") && (
              <span style={{ fontSize: 9, fontWeight: 900, padding: "1px 5px", borderRadius: 4, background: "rgba(255,215,0,0.2)", color: "#FFD700" }}>
                {m.role === "owner" ? t("memberOwner") : t("memberAdmin")}
              </span>
            )}
          </div>
          <div style={{ color: "#8B8FA3", fontSize: 10, marginTop: 1 }}>
            {t("memberLevelLine", { level: m.level, gebietsruf: (m.gebietsruf ?? 0).toLocaleString(numLocale) })}
            {m.streak_days > 0 && t("memberStreak", { days: m.streak_days })}
          </div>
        </div>
      </div>
    );
  });
}

// ═══ DUEL ═══
type Duel = {
  id: string; week_start: string;
  crew_a: { id: string; name: string; color: string | null } | null;
  crew_b: { id: string; name: string; color: string | null } | null;
  crew_a_km: number; crew_b_km: number;
  winner_crew_id: string | null; status: string; prize_xp: number;
  my_side: "a" | "b";
};
function DuelPanel({ crew }: { crew: Crew }) {
  const t = useTranslations("CrewLiveHub");
  const [duels, setDuels] = useState<Duel[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/crew/duels?crew_id=${crew.id}`);
    const j = await r.json();
    setDuels(j.duels ?? []);
  }, [crew.id]);
  useEffect(() => { void load(); }, [load]);

  async function triggerMatch() {
    setBusy(true);
    try {
      await fetch("/api/crew/duels", { method: "POST" });
      await load();
    } finally { setBusy(false); }
  }

  if (duels === null) return <div><CrewTabInfo tab="duel" /><Loading /></div>;
  const active = duels.find((d) => d.status === "active");
  const past = duels.filter((d) => d.status !== "active");

  return (
    <div>
      <CrewTabInfo tab="duel" />
      {active ? <DuelCard duel={active} t={t} /> : (
        <div style={{ padding: 16, textAlign: "center", borderRadius: 12, background: "rgba(255,45,120,0.05)", border: "1px dashed rgba(255,45,120,0.3)" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚔️</div>
          <div style={{ color: "#FFF", fontSize: 13, fontWeight: 800, marginBottom: 4 }}>{t("duelEmptyTitle")}</div>
          <div style={{ color: "#a8b4cf", fontSize: 11, marginBottom: 12 }}>
            {t("duelEmptySub")}
          </div>
          <button onClick={triggerMatch} disabled={busy} style={{
            padding: "8px 18px", borderRadius: 10, border: "none",
            background: "linear-gradient(135deg, #FF2D78, #FF6B4A)",
            color: "#FFF", fontWeight: 900, fontSize: 12, cursor: "pointer",
            opacity: busy ? 0.6 : 1,
          }}>{busy ? "…" : t("duelStart")}</button>
        </div>
      )}

      {past.length > 0 && (
        <>
          <div style={{ fontSize: 10, color: "#8B8FA3", fontWeight: 900, letterSpacing: 1.5, marginTop: 14, marginBottom: 6 }}>
            {t("duelPastHeading")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {past.map((d) => <DuelCard key={d.id} duel={d} compact t={t} />)}
          </div>
        </>
      )}
    </div>
  );
}
function DuelCard({ duel, compact, t }: { duel: Duel; compact?: boolean; t: CrewT }) {
  const a = duel.crew_a; const b = duel.crew_b;
  const myKm = duel.my_side === "a" ? duel.crew_a_km : duel.crew_b_km;
  const oppKm = duel.my_side === "a" ? duel.crew_b_km : duel.crew_a_km;
  const totalKm = myKm + oppKm;
  const myPct = totalKm > 0 ? (myKm / totalKm) * 100 : 50;
  const iWon = duel.winner_crew_id === (duel.my_side === "a" ? a?.id : b?.id);

  return (
    <div style={{
      padding: compact ? 10 : 14, borderRadius: 12,
      background: "rgba(15,17,21,0.5)",
      border: "1px solid rgba(255,45,120,0.3)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
        <span style={{ color: a?.color ?? "#22D1C3", fontWeight: 900 }}>{a?.name ?? "?"}</span>
        <span style={{ color: b?.color ?? "#FF2D78", fontWeight: 900 }}>{b?.name ?? "?"}</span>
      </div>
      <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", background: "rgba(255,255,255,0.05)" }}>
        <div style={{ width: `${duel.my_side === "a" ? myPct : 100 - myPct}%`, background: a?.color ?? "#22D1C3" }} />
        <div style={{ flex: 1, background: b?.color ?? "#FF2D78" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginTop: 4, color: "#a8b4cf" }}>
        <span>{t("duelKm", { km: Number(duel.crew_a_km).toFixed(1) })}</span>
        <span>{duel.status === "finished" ? (iWon ? t("duelYouWin") : t("duelLost")) : t("duelPrize", { xp: duel.prize_xp })}</span>
        <span>{t("duelKm", { km: Number(duel.crew_b_km).toFixed(1) })}</span>
      </div>
    </div>
  );
}

// ═══ CHALLENGES (unused — kept for future) ═══
type Challenge = {
  id: string; name: string; description: string | null; icon: string;
  target_metric: string; target_value: number; progress: number; reward_xp: number;
  starts_at: string; ends_at: string; completed_at: string | null;
};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _ChallengesPanel({ crew, isAdmin }: { crew: Crew; isAdmin: boolean }) {
  const t = useTranslations("CrewLiveHub");
  const [items, setItems] = useState<Challenge[] | null>(null);
  const [creating, setCreating] = useState(false);
  const load = useCallback(async () => {
    const r = await fetch(`/api/crew/challenges?crew_id=${crew.id}`);
    const j = await r.json();
    setItems(j.challenges ?? []);
  }, [crew.id]);
  useEffect(() => { void load(); }, [load]);

  if (items === null) return <div><CrewTabInfo tab="challenges" /><Loading /></div>;
  return (
    <div>
      <CrewTabInfo tab="challenges" />
      {isAdmin && (
        <button onClick={() => setCreating(true)} style={{
          width: "100%", marginBottom: 10, padding: "10px 12px", borderRadius: 10,
          background: "rgba(255,215,0,0.12)", border: "1px dashed rgba(255,215,0,0.5)",
          color: "#FFD700", fontWeight: 900, fontSize: 12, cursor: "pointer",
        }}>{t("challengeNewBtn")}</button>
      )}
      {items.length === 0 ? <Empty text={t("challengeEmpty")} /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((c) => {
            const pct = Math.min(100, (Number(c.progress) / Number(c.target_value)) * 100);
            const done = !!c.completed_at;
            const daysLeft = Math.max(0, Math.ceil((new Date(c.ends_at).getTime() - Date.now()) / 86400000));
            return (
              <div key={c.id} style={{
                padding: 12, borderRadius: 12,
                background: done ? "rgba(74,222,128,0.08)" : "rgba(15,17,21,0.5)",
                border: `1px solid ${done ? "rgba(74,222,128,0.4)" : "rgba(255,215,0,0.3)"}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontSize: 24 }}>{c.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#FFF", fontSize: 13, fontWeight: 900 }}>{c.name}</div>
                    {c.description && <div style={{ color: "#a8b4cf", fontSize: 10, marginTop: 1 }}>{c.description}</div>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "#FFD700", fontSize: 11, fontWeight: 900 }}>{t("challengeReward", { xp: c.reward_xp })}</div>
                    <div style={{ color: "#8B8FA3", fontSize: 9 }}>{t("challengeDays", { n: daysLeft })}</div>
                  </div>
                </div>
                <div style={{ marginTop: 8, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", width: `${pct}%`,
                    background: done ? "#4ade80" : "linear-gradient(90deg, #FFD700, #22D1C3)",
                    transition: "width 0.6s",
                  }} />
                </div>
                <div style={{ fontSize: 10, color: "#8B8FA3", marginTop: 4, textAlign: "right" }}>
                  {t("challengeProgress", { progress: Number(c.progress).toFixed(1), target: c.target_value })}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {creating && <_ChallengeEditor crewId={crew.id} onClose={() => { setCreating(false); void load(); }} />}
    </div>
  );
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _ChallengeEditor({ crewId, onClose }: { crewId: string; onClose: () => void }) {
  const t = useTranslations("CrewLiveHub");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [metric, setMetric] = useState<Challenge["target_metric"]>("weekly_km");
  const [target, setTarget] = useState(50);
  const [reward, setReward] = useState(2500);
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name || target <= 0) return;
    setBusy(true);
    try {
      const r = await fetch("/api/crew/challenges", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ crew_id: crewId, name, description: desc, target_metric: metric, target_value: target, reward_xp: reward, days }),
      });
      if (!r.ok) { const j = await r.json().catch(() => ({})); await appAlert(t("warErrorPrefix", { msg: String(j.error ?? r.status) })); return; }
      onClose();
    } finally { setBusy(false); }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 440, background: "#1A1D23", borderRadius: 16, border: "1px solid rgba(255,215,0,0.4)", padding: 20, color: "#FFF" }}>
        <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 12 }}>{t("challengeEditorTitle")}</div>
        <Input label={t("challengeFieldName")} value={name} onChange={setName} placeholder={t("challengeFieldNamePh")} />
        <Input label={t("challengeFieldDesc")} value={desc} onChange={setDesc} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <Label>{t("challengeFieldMetric")}</Label>
            <select value={metric} onChange={(e) => setMetric(e.target.value as Challenge["target_metric"])} style={selectStyle}>
              <option value="weekly_km">{t("challengeMetricKm")}</option>
              <option value="new_streets">{t("challengeMetricStreets")}</option>
              <option value="territories">{t("challengeMetricTerritories")}</option>
              <option value="arena_wins">{t("challengeMetricArena")}</option>
              <option value="members_active">{t("challengeMetricMembers")}</option>
            </select>
          </div>
          <Input label={t("challengeFieldTarget")} type="number" value={String(target)} onChange={(v) => setTarget(Number(v))} />
          <Input label={t("challengeFieldReward")} type="number" value={String(reward)} onChange={(v) => setReward(Number(v))} />
          <Input label={t("challengeFieldDays")} type="number" value={String(days)} onChange={(v) => setDays(Number(v))} />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={onClose} style={btnSecondary}>{t("abort")}</button>
          <button onClick={save} disabled={busy || !name} style={{ ...btnPrimary, background: "linear-gradient(135deg,#FFD700,#FF6B4A)", color: "#0F1115" }}>
            {busy ? "…" : t("challengeSave")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══ EVENTS (unused — kept for future) ═══
type CrewEvent = {
  id: string; title: string; description: string | null;
  starts_at: string; meeting_point: string | null;
  target_distance_km: number | null; target_pace_min_per_km: number | null;
  max_attendees: number | null;
  going_count: number; maybe_count: number; my_rsvp: string | null;
};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _EventsPanel({ crew, userId }: { crew: Crew; userId: string }) {
  const t = useTranslations("CrewLiveHub");
  const locale = useLocale();
  const dateLocale = getDateLocale(locale);
  const [events, setEvents] = useState<CrewEvent[] | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/crew/events?crew_id=${crew.id}`);
    const j = await r.json();
    setEvents(j.events ?? []);
  }, [crew.id]);
  useEffect(() => { void load(); }, [load]);

  async function rsvp(eventId: string, status: "going" | "maybe" | "declined") {
    await fetch("/api/crew/events/rsvp", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ event_id: eventId, status }),
    });
    await load();
  }

  if (events === null) return <div><CrewTabInfo tab="events" /><Loading /></div>;
  return (
    <div>
      <CrewTabInfo tab="events" />
      <button onClick={() => setCreating(true)} style={{
        width: "100%", marginBottom: 10, padding: "10px 12px", borderRadius: 10,
        background: "rgba(74,222,128,0.12)", border: "1px dashed rgba(74,222,128,0.5)",
        color: "#4ade80", fontWeight: 900, fontSize: 12, cursor: "pointer",
      }}>{t("eventNewBtn")}</button>
      {events.length === 0 ? <Empty text={t("eventEmpty")} /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {events.map((e) => {
            const start = new Date(e.starts_at);
            const isPast = start.getTime() < Date.now();
            return (
              <div key={e.id} style={{
                padding: 12, borderRadius: 12,
                background: "rgba(15,17,21,0.5)",
                border: `1px solid ${isPast ? "rgba(255,255,255,0.06)" : "rgba(74,222,128,0.3)"}`,
                opacity: isPast ? 0.6 : 1,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#FFF", fontSize: 14, fontWeight: 900 }}>{e.title}</div>
                    <div style={{ color: "#a8b4cf", fontSize: 11, marginTop: 2 }}>
                      📅 {start.toLocaleString(dateLocale, { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      {e.meeting_point && <> · 📍 {e.meeting_point}</>}
                    </div>
                    {(e.target_distance_km || e.target_pace_min_per_km) && (
                      <div style={{ color: "#8B8FA3", fontSize: 10, marginTop: 2 }}>
                        {e.target_distance_km && <>{t("eventDistanceKm", { km: e.target_distance_km })}</>}
                        {e.target_pace_min_per_km && <> · {t("eventPace", { pace: e.target_pace_min_per_km })}</>}
                      </div>
                    )}
                    {e.description && <div style={{ color: "#a8b4cf", fontSize: 11, marginTop: 4, lineHeight: 1.4 }}>{e.description}</div>}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ color: "#4ade80", fontSize: 11, fontWeight: 900 }}>{t("eventGoingCount", { n: e.going_count })}</div>
                    <div style={{ color: "#FFD700", fontSize: 10 }}>{t("eventMaybeCount", { n: e.maybe_count })}</div>
                  </div>
                </div>
                {!isPast && (
                  <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    {(["going","maybe","declined"] as const).map((s) => {
                      const active = e.my_rsvp === s;
                      const label = s === "going" ? t("eventGoing") : s === "maybe" ? t("eventMaybe") : t("eventDeclined");
                      return (
                        <button key={s} onClick={() => rsvp(e.id, s)} style={{
                          flex: 1, padding: "6px 10px", borderRadius: 8,
                          background: active ? (s === "going" ? "rgba(74,222,128,0.2)" : s === "maybe" ? "rgba(255,215,0,0.2)" : "rgba(255,45,120,0.15)") : "rgba(255,255,255,0.04)",
                          border: `1px solid ${active ? (s === "going" ? "#4ade80" : s === "maybe" ? "#FFD700" : "#FF2D78") : "rgba(255,255,255,0.08)"}`,
                          color: active ? (s === "going" ? "#4ade80" : s === "maybe" ? "#FFD700" : "#FF2D78") : "#a8b4cf",
                          fontSize: 11, fontWeight: 800, cursor: "pointer",
                        }}>{label}</button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {creating && <_EventEditor crewId={crew.id} userId={userId} onClose={() => { setCreating(false); void load(); }} />}
    </div>
  );
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _EventEditor({ crewId, onClose }: { crewId: string; userId: string; onClose: () => void }) {
  const t = useTranslations("CrewLiveHub");
  const now = new Date(Date.now() + 86400000);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState(now.toISOString().slice(0, 16));
  const [mp, setMp] = useState("");
  const [km, setKm] = useState(5);
  const [pace, setPace] = useState(6);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!title || !date) return;
    setBusy(true);
    try {
      const r = await fetch("/api/crew/events", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          crew_id: crewId, title, description: desc,
          starts_at: new Date(date).toISOString(),
          meeting_point: mp || null,
          target_distance_km: km || null,
          target_pace_min_per_km: pace || null,
        }),
      });
      if (!r.ok) { const j = await r.json().catch(() => ({})); await appAlert(t("warErrorPrefix", { msg: String(j.error ?? r.status) })); return; }
      onClose();
    } finally { setBusy(false); }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 440, background: "#1A1D23", borderRadius: 16, border: "1px solid rgba(74,222,128,0.4)", padding: 20, color: "#FFF" }}>
        <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 12 }}>{t("eventEditorTitle")}</div>
        <Input label={t("eventFieldTitle")} value={title} onChange={setTitle} placeholder={t("eventFieldTitlePh")} />
        <Input label={t("eventFieldDesc")} value={desc} onChange={setDesc} />
        <Input label={t("eventFieldDate")} type="datetime-local" value={date} onChange={setDate} />
        <Input label={t("eventFieldMp")} value={mp} onChange={setMp} placeholder={t("eventFieldMpPh")} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Input label={t("eventFieldKm")} type="number" value={String(km)} onChange={(v) => setKm(Number(v))} />
          <Input label={t("eventFieldPace")} type="number" value={String(pace)} onChange={(v) => setPace(Number(v))} />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={onClose} style={btnSecondary}>{t("abort")}</button>
          <button onClick={save} disabled={busy || !title} style={{ ...btnPrimary, background: "linear-gradient(135deg,#4ade80,#22D1C3)", color: "#0F1115" }}>
            {busy ? "…" : t("eventSave")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══ CHAT (unused — kept for future) ═══
type ChatMessage = {
  id: string; user_id: string; body: string; reply_to: string | null;
  created_at: string; deleted_at: string | null;
  user: { username: string | null; display_name: string | null; avatar_url: string | null; team_color: string | null } | { username: string | null; display_name: string | null; avatar_url: string | null; team_color: string | null }[] | null;
};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _ChatPanel({ crew, userId }: { crew: Crew; userId: string }) {
  const t = useTranslations("CrewLiveHub");
  const locale = useLocale();
  const dateLocale = getDateLocale(locale);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const sb = useMemo(() => createClient(), []);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/crew/messages?crew_id=${crew.id}`);
    const j = await r.json();
    setMessages(j.messages ?? []);
  }, [crew.id]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const ch = sb.channel(`crew_chat_${crew.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "crew_messages", filter: `crew_id=eq.${crew.id}` },
        () => { void load(); })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [crew.id, load, sb]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  async function send() {
    const tx = text.trim();
    if (!tx || busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/crew/messages", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ crew_id: crew.id, body: tx }),
      });
      if (r.ok) setText("");
      await load();
    } finally { setBusy(false); }
  }

  async function del(id: string) {
    if (!await appConfirm(t("chatDeleteConfirm"))) return;
    await fetch(`/api/crew/messages?id=${id}`, { method: "DELETE" });
    await load();
  }

  if (messages === null) return <div><CrewTabInfo tab="chat" /><Loading /></div>;

  return (
    <div>
      <CrewTabInfo tab="chat" />
      <div ref={scrollRef} style={{ maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, padding: "4px 2px" }}>
        {messages.length === 0 && <Empty text={t("chatEmpty")} />}
        {messages.map((m) => {
          const u = Array.isArray(m.user) ? m.user[0] : m.user;
          const mine = m.user_id === userId;
          return (
            <div key={m.id} style={{
              alignSelf: mine ? "flex-end" : "flex-start",
              maxWidth: "80%",
              padding: "6px 10px", borderRadius: 12,
              background: mine ? "rgba(34,209,195,0.15)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${mine ? "rgba(34,209,195,0.35)" : "rgba(255,255,255,0.08)"}`,
            }}>
              {!mine && (
                <div style={{ fontSize: 9, fontWeight: 900, color: u?.team_color ?? "#22D1C3", marginBottom: 2 }}>
                  {u?.display_name ?? u?.username ?? "?"}
                </div>
              )}
              <div style={{ color: "#FFF", fontSize: 13, lineHeight: 1.4, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {m.body}
              </div>
              <div style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", alignItems: "center", gap: 6, marginTop: 2 }}>
                <span style={{ fontSize: 8, color: "#8B8FA3" }}>
                  {new Date(m.created_at).toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" })}
                </span>
                {mine && <button onClick={() => del(m.id)} style={{ background: "transparent", border: "none", color: "#8B8FA3", fontSize: 9, cursor: "pointer" }}>✕</button>}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 600))}
          onKeyDown={(e) => { if (e.key === "Enter") void send(); }}
          placeholder={t("chatPlaceholder")}
          maxLength={600}
          style={{
            flex: 1, padding: "10px 12px", borderRadius: 10,
            background: "rgba(0,0,0,0.3)", color: "#FFF",
            border: "1px solid rgba(255,255,255,0.1)",
            fontSize: 13,
          }}
        />
        <button onClick={send} disabled={!text.trim() || busy} style={{
          padding: "0 16px", borderRadius: 10, border: "none",
          background: text.trim() ? "linear-gradient(135deg,#22D1C3,#5ddaf0)" : "rgba(255,255,255,0.08)",
          color: text.trim() ? "#0F1115" : "#8B8FA3",
          fontWeight: 900, cursor: text.trim() ? "pointer" : "not-allowed",
        }}>📤</button>
      </div>
    </div>
  );
}

// ═══ FEED (unused — kept for future) ═══
type FeedItem = {
  id: string; kind: string; data: Record<string, unknown>; created_at: string;
  user: { username: string | null; display_name: string | null; avatar_url: string | null } | { username: string | null; display_name: string | null; avatar_url: string | null }[] | null;
};
const FEED_META: Record<string, { icon: string; color: string }> = {
  member_joined:        { icon: "🎉", color: "#4ade80" },
  member_left:          { icon: "👋", color: "#8B8FA3" },
  territory_claimed:    { icon: "🏴", color: "#FFD700" },
  challenge_completed:  { icon: "🏆", color: "#FFD700" },
  duel_won:             { icon: "⚔️", color: "#4ade80" },
  duel_lost:            { icon: "⚔️", color: "#FF2D78" },
  event_created:        { icon: "📅", color: "#5ddaf0" },
  km_milestone:         { icon: "🏃", color: "#22D1C3" },
  arena_victory:        { icon: "🛡️", color: "#a855f7" },
};
function feedLabel(t: CrewT, kind: string, data: Record<string, unknown>, actor: string): string {
  switch (kind) {
    case "member_joined": return t("feedJoined", { actor });
    case "member_left": return t("feedLeft", { actor });
    case "territory_claimed":
      return data.area_m2
        ? t("feedTerritoryClaimedM2", { actor, m2: Math.round(Number(data.area_m2)) })
        : t("feedTerritoryClaimed", { actor });
    case "challenge_completed": return t("feedChallengeCompleted", { name: String(data.name ?? "") });
    case "duel_won": return t("feedDuelWon", { opponent: String(data.opponent ?? "?") });
    case "duel_lost": return t("feedDuelLost", { opponent: String(data.opponent ?? "?") });
    case "event_created": return t("feedEventCreated", { title: String(data.title ?? "") });
    case "km_milestone": return t("feedKmMilestone", { actor, km: String(data.km ?? "?") });
    case "arena_victory": return t("feedArenaVictory", { actor });
    default: return kind;
  }
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _FeedPanel({ crew }: { crew: Crew }) {
  const t = useTranslations("CrewLiveHub");
  const locale = useLocale();
  const dateLocale = getDateLocale(locale);
  const [items, setItems] = useState<FeedItem[] | null>(null);
  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/crew/feed?crew_id=${crew.id}`);
      const j = await r.json();
      setItems(j.feed ?? []);
    })();
  }, [crew.id]);

  return (
    <div>
      <CrewTabInfo tab="feed" />
      {items === null ? <Loading /> : items.length === 0 ? (
        <Empty text={t("feedEmpty")} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {renderFeedItems(items, t, dateLocale)}
        </div>
      )}
    </div>
  );
}

function renderFeedItems(items: FeedItem[], t: CrewT, dateLocale: string) {
  return items.map((item) => {
    const meta = FEED_META[item.kind] ?? { icon: "•", color: "#8B8FA3" };
    const u = Array.isArray(item.user) ? item.user[0] : item.user;
    const actor = u?.display_name ?? u?.username ?? t("feedSomeone");
    const d = item.data ?? {};
    return (
      <div key={item.id} style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 10px", borderRadius: 10,
        background: "rgba(15,17,21,0.45)",
        border: `1px solid ${meta.color}33`,
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: "50%",
          background: `${meta.color}22`,
          border: `1px solid ${meta.color}66`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, flexShrink: 0,
        }}>{meta.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "#FFF", fontSize: 12, fontWeight: 700 }}>{feedLabel(t, item.kind, d, actor)}</div>
          <div style={{ color: "#8B8FA3", fontSize: 9, marginTop: 1 }}>
            {new Date(item.created_at).toLocaleString(dateLocale)}
          </div>
        </div>
      </div>
    );
  });
}

// ═══ SHOP ═══
type ShopItem = {
  id: string; category: string; name: string; description: string; icon: string;
  price_gems: number; duration_hours: number | null; payload: Record<string, unknown>;
};
function ShopPanel({ crew, userId, isAdmin }: { crew: Crew; userId: string; isAdmin: boolean }) {
  const t = useTranslations("CrewLiveHub");
  const locale = useLocale();
  const numLocale = getNumberLocale(locale);
  const [items, setItems] = useState<ShopItem[] | null>(null);
  const [gems, setGems] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const sb = useMemo(() => createClient(), []);

  const load = useCallback(async () => {
    const { data } = await sb.from("gem_shop_items").select("*").eq("category", "crew_emblem").order("sort");
    setItems(data as ShopItem[] | null ?? []);
    const { data: g } = await sb.from("user_gems").select("gems").eq("user_id", userId).maybeSingle<{ gems: number }>();
    setGems(g?.gems ?? 0);
  }, [sb, userId]);

  useEffect(() => { void load(); }, [load]);

  async function buy(item: ShopItem) {
    if (!isAdmin) { await appAlert(t("shopOnlyAdminAlert")); return; }
    if (gems < item.price_gems) { await appAlert(t("shopNotEnough", { have: gems, need: item.price_gems })); return; }
    if (!await appConfirm(t("shopBuyConfirm", { name: item.name, price: item.price_gems }))) return;

    setBusy(item.id);
    try {
      const { error } = await sb.rpc("purchase_gem_item", { p_user_id: userId, p_item_id: item.id, p_crew_id: crew.id });
      if (error) { await appAlert(t("shopErrorPrefix", { msg: error.message })); return; }
      await appAlert(t("shopActivated", { name: item.name }));
      await load();
    } finally { setBusy(null); }
  }

  if (items === null) return <div><CrewTabInfo tab="shop" /><Loading /></div>;
  return (
    <div>
      <CrewTabInfo tab="shop" />
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 12px", borderRadius: 10, marginBottom: 10,
        background: "rgba(93,218,240,0.08)", border: "1px solid rgba(93,218,240,0.3)",
      }}>
        <span style={{ color: "#a8b4cf", fontSize: 11, fontWeight: 700 }}>{t("shopBalance")}</span>
        <span style={{ color: "#5ddaf0", fontSize: 15, fontWeight: 900 }}>💎 {gems.toLocaleString(numLocale)}</span>
      </div>
      {!isAdmin && (
        <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(255,215,0,0.08)", border: "1px dashed rgba(255,215,0,0.3)", fontSize: 10, color: "#FFD700", marginBottom: 10 }}>
          {t("shopAdminOnly")}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((i) => (
          <div key={i.id} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: 12, borderRadius: 12,
            background: "rgba(15,17,21,0.5)",
            border: "1px solid rgba(255,107,74,0.3)",
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10, flexShrink: 0,
              background: "rgba(255,107,74,0.15)", border: "1px solid rgba(255,107,74,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
            }}>{i.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: "#FFF", fontSize: 13, fontWeight: 900 }}>{i.name}</div>
              <div style={{ color: "#a8b4cf", fontSize: 10, marginTop: 2 }}>{i.description}</div>
            </div>
            <button
              onClick={() => buy(i)}
              disabled={busy === i.id || !isAdmin || gems < i.price_gems}
              style={{
                padding: "8px 14px", borderRadius: 10, border: "none",
                background: gems >= i.price_gems && isAdmin ? "linear-gradient(135deg,#5ddaf0,#22D1C3)" : "rgba(255,255,255,0.05)",
                color: gems >= i.price_gems && isAdmin ? "#0F1115" : "#8B8FA3",
                fontSize: 12, fontWeight: 900, cursor: gems >= i.price_gems && isAdmin ? "pointer" : "not-allowed",
                flexShrink: 0, opacity: busy === i.id ? 0.6 : 1,
              }}
            >{t("shopBuyBtn", { price: i.price_gems })}</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══ SHARED ═══
function Loading() {
  const t = useTranslations("CrewLiveHub");
  return <div style={{ padding: 30, textAlign: "center", color: "#8B8FA3", fontSize: 12 }}>{t("loading")}</div>;
}
function Empty({ text }: { text: string }) { return <div style={{ padding: 24, textAlign: "center", color: "#8B8FA3", fontSize: 12, lineHeight: 1.5 }}>{text}</div>; }

const selectStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: 8,
  background: "rgba(0,0,0,0.3)", color: "#FFF",
  border: "1px solid rgba(255,255,255,0.1)",
  fontSize: 12, fontFamily: "inherit",
};
const btnSecondary: React.CSSProperties = {
  flex: 1, padding: "10px 14px", borderRadius: 10,
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
  color: "#FFF", fontSize: 13, fontWeight: 800, cursor: "pointer",
};
const btnPrimary: React.CSSProperties = {
  flex: 2, padding: "10px 14px", borderRadius: 10, border: "none",
  fontSize: 13, fontWeight: 900, cursor: "pointer",
};
function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 9, color: "#8B8FA3", fontWeight: 800, letterSpacing: 1, marginBottom: 4, marginTop: 8 }}>{children}</div>;
}
function Input({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <Label>{label.toUpperCase()}</Label>
      <input
        type={type} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...selectStyle, width: "100%" }}
      />
    </div>
  );
}

// ═══ INFO-BOX PRO TAB ═══
const TAB_META: Record<Tab, { icon: string; color: string }> = {
  overview:   { icon: "👥", color: "#22D1C3" },
  war:        { icon: "🔥", color: "#FF2D78" },
  season:     { icon: "🏆", color: "#FFD700" },
  flags:      { icon: "🚩", color: "#4ade80" },
  duel:       { icon: "⚔️", color: "#FF6B4A" },
  challenges: { icon: "🎯", color: "#FFD700" },
  events:     { icon: "📅", color: "#4ade80" },
  chat:       { icon: "💬", color: "#5ddaf0" },
  feed:       { icon: "📜", color: "#a855f7" },
  shop:       { icon: "💎", color: "#FF6B4A" },
  power:      { icon: "⚡", color: "#FFD700" },
};

function CrewTabInfo({ tab }: { tab: Tab }) {
  const t = useTranslations("CrewLiveHub");
  const meta = TAB_META[tab];
  const title = t(`info.${tab}.title` as const);
  const how = t(`info.${tab}.how` as const);
  const loot = t(`info.${tab}.loot` as const);
  const tips = t(`info.${tab}.tips` as const);
  const storageKey = `ma365:crewInfoDismissed:${tab}`;
  const [collapsed, setCollapsed] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      if (typeof window === "undefined") { setCollapsed(true); return; }
      setCollapsed(window.localStorage.getItem(storageKey) === "1");
    } catch { setCollapsed(true); }
  }, [storageKey]);

  function toggle() {
    setCollapsed((v) => {
      const next = !v;
      try { window.localStorage.setItem(storageKey, next ? "1" : "0"); } catch { /* noop */ }
      return next;
    });
  }

  if (collapsed === null) return null;

  return (
    <div style={{
      marginBottom: 12, borderRadius: 12,
      background: `${meta.color}0d`,
      border: `1px solid ${meta.color}44`,
      overflow: "hidden",
    }}>
      <button
        onClick={toggle}
        style={{
          width: "100%", padding: "8px 12px",
          display: "flex", alignItems: "center", gap: 8,
          background: "transparent", border: "none", cursor: "pointer",
          color: meta.color, fontSize: 11, fontWeight: 900, letterSpacing: 0.5,
        }}
      >
        <span style={{ fontSize: 14 }}>{meta.icon}</span>
        <span style={{ flex: 1, textAlign: "left" }}>
          {collapsed ? t("infoToggleCollapsed", { title }) : title.toUpperCase()}
        </span>
        <span style={{ fontSize: 13, transform: collapsed ? "none" : "rotate(180deg)", transition: "transform 0.2s" }}>▾</span>
      </button>
      {!collapsed && (
        <div style={{ padding: "4px 14px 14px", color: "#D0D0D5", fontSize: 12, lineHeight: 1.55 }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: "#8B8FA3", fontWeight: 900, letterSpacing: 1.5, marginBottom: 4 }}>{t("infoHowHeading")}</div>
            <div>{how}</div>
          </div>
          <div style={{ marginBottom: tips ? 10 : 0 }}>
            <div style={{ fontSize: 9, color: "#FFD700", fontWeight: 900, letterSpacing: 1.5, marginBottom: 4 }}>{t("infoLootHeading")}</div>
            <div>{loot}</div>
          </div>
          {tips && (
            <div>
              <div style={{ fontSize: 9, color: "#4ade80", fontWeight: 900, letterSpacing: 1.5, marginBottom: 4 }}>{t("infoTipHeading")}</div>
              <div>{tips}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══ POWER ═══
type PoolData = {
  pool: { gems: number; total_deposited: number; total_spent: number };
  my_gems: number;
  recent_transactions: Array<{ kind: string; amount: number; reason: string | null; created_at: string }>;
};
type BoostCatalog = Record<string, { cost: number; duration_hours: number | null; name: string; icon: string; description: string }>;
type ActiveBoost = { id: string; kind: string; activated_at: string; expires_at: string | null; consumed_at: string | null; gems_paid: number };

const CREW_GEM_PACKS_CLIENT = [
  { sku: "crew_gems_500",   name: "Crew-Paket S",  gems: 500,   bonus: 0,    price: 499,  icon: "💎" },
  { sku: "crew_gems_1500",  name: "Crew-Paket M",  gems: 1500,  bonus: 200,  price: 1299, icon: "💎" },
  { sku: "crew_gems_5000",  name: "Crew-Paket L",  gems: 5000,  bonus: 1000, price: 3999, icon: "💎" },
  { sku: "crew_gems_12000", name: "Crew-Paket XL", gems: 12000, bonus: 3000, price: 7999, icon: "💎" },
];

const CREW_SLOT_PACKS_CLIENT = [
  { sku: "crew_slots_plus5",  name: "+5 Slots",  slots: 5,  price: 299 },
  { sku: "crew_slots_plus10", name: "+10 Slots", slots: 10, price: 499 },
];

function PowerPanel({ crew, isAdmin }: { crew: Crew; userId: string; isAdmin: boolean }) {
  const t = useTranslations("CrewLiveHub");
  const locale = useLocale();
  const numLocale = getNumberLocale(locale);
  const [pool, setPool] = useState<PoolData | null>(null);
  const [catalog, setCatalog] = useState<BoostCatalog>({});
  const [active, setActive] = useState<ActiveBoost[]>([]);
  const [depositAmount, setDepositAmount] = useState<string>("100");
  const [busy, setBusy] = useState<string | null>(null);
  const [memberCap, setMemberCap] = useState<number>(10);
  const [memberCount, setMemberCount] = useState<number>(0);
  const sb = useMemo(() => createClient(), []);

  const load = useCallback(async () => {
    const [{ data: crewRow }, { data: members }] = await Promise.all([
      sb.from("crews").select("member_cap").eq("id", crew.id).maybeSingle<{ member_cap: number }>(),
      sb.from("crew_members").select("user_id", { count: "exact" }).eq("crew_id", crew.id),
    ]);
    setMemberCap(crewRow?.member_cap ?? 10);
    setMemberCount((members ?? []).length);

    const [poolRes, boostsRes] = await Promise.all([
      fetch(`/api/crew/gem-pool?crew_id=${crew.id}`),
      fetch(`/api/crew/boosts?crew_id=${crew.id}`),
    ]);
    const poolJ = await poolRes.json();
    const boostsJ = await boostsRes.json();
    setPool(poolJ);
    setCatalog(boostsJ.catalog ?? {});
    setActive(boostsJ.active ?? []);
  }, [crew.id, sb]);

  useEffect(() => { void load(); }, [load]);

  async function deposit() {
    const amount = parseInt(depositAmount, 10);
    if (!amount || amount <= 0) return;
    if (!pool || pool.my_gems < amount) { await appAlert(t("powerDepositLowGems")); return; }
    if (!await appConfirm(t("powerDepositConfirm", { amount }))) return;
    setBusy("deposit");
    try {
      const r = await fetch("/api/crew/gem-pool", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ crew_id: crew.id, amount }),
      });
      if (!r.ok) { const j = await r.json().catch(() => ({})); await appAlert(t("powerErrorPrefix", { msg: String(j.error ?? r.status) })); return; }
      await appAlert(t("powerDepositOk", { amount }));
      setDepositAmount("100");
      await load();
    } finally { setBusy(null); }
  }

  async function activate(kind: string) {
    if (!isAdmin) { await appAlert(t("powerOnlyAdmin")); return; }
    const item = catalog[kind];
    if (!item) return;
    if ((pool?.pool.gems ?? 0) < item.cost) { await appAlert(t("powerNotEnoughPool", { have: pool?.pool.gems ?? 0, need: item.cost })); return; }
    if (!await appConfirm(t("powerActivateConfirm", { name: item.name, cost: item.cost }))) return;
    setBusy(kind);
    try {
      const r = await fetch("/api/crew/boosts", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ crew_id: crew.id, kind }),
      });
      const j = await r.json();
      if (!r.ok) { await appAlert(String(j.error ?? t("powerErrorPrefix", { msg: "?" }))); return; }
      await appAlert(t("powerActivatedAlert", { name: item.name }));
      await load();
    } finally { setBusy(null); }
  }

  async function buyPack(sku: string, name: string, price: number) {
    setBusy(sku);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ sku, name, amount_cents: price, crew_id: crew.id, ui_mode: "hosted" }),
      });
      const j = await res.json();
      if (j.url) { window.location.href = j.url; return; }
      if (!res.ok) { await appAlert(t("powerStripeError", { msg: String(j.error ?? res.status) })); return; }
    } finally { setBusy(null); }
  }

  if (!pool) return <div><CrewTabInfo tab="power" /><Loading /></div>;

  return (
    <div>
      <CrewTabInfo tab="power" />

      <div style={{
        padding: 14, borderRadius: 12, marginBottom: 10,
        background: "linear-gradient(135deg, rgba(93,218,240,0.12), rgba(255,215,0,0.08))",
        border: "1px solid rgba(93,218,240,0.35)",
      }}>
        <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1.5, color: "#5ddaf0" }}>{t("powerPoolTitle")}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
          <div style={{ color: "#FFF", fontSize: 26, fontWeight: 900 }}>{pool.pool.gems.toLocaleString(numLocale)}</div>
          <div style={{ color: "#a8b4cf", fontSize: 11 }}>{t("powerGemsAvailable")}</div>
        </div>
        <div style={{ color: "#8B8FA3", fontSize: 10, marginTop: 2 }}>
          {t("powerDepositedSpent", { dep: pool.pool.total_deposited.toLocaleString(numLocale), sp: pool.pool.total_spent.toLocaleString(numLocale) })}
        </div>

        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <input
            type="number" min="1" value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            style={{
              flex: 1, padding: "8px 10px", borderRadius: 8,
              background: "rgba(0,0,0,0.3)", color: "#FFF",
              border: "1px solid rgba(255,255,255,0.1)", fontSize: 13,
            }}
            placeholder="💎"
          />
          <button
            onClick={deposit}
            disabled={busy === "deposit"}
            style={{
              padding: "8px 14px", borderRadius: 8, border: "none",
              background: "linear-gradient(135deg,#5ddaf0,#22D1C3)",
              color: "#0F1115", fontSize: 12, fontWeight: 900, cursor: "pointer",
              opacity: busy === "deposit" ? 0.6 : 1,
            }}
          >{t("powerDepositBtn", { gems: pool.my_gems })}</button>
        </div>
      </div>

      {active.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: "#4ade80", fontWeight: 900, letterSpacing: 1.5, marginBottom: 6 }}>{t("powerActiveBoosts")}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {active.map((b) => {
              const item = catalog[b.kind];
              const remainingMs = b.expires_at ? new Date(b.expires_at).getTime() - Date.now() : 0;
              const remainingH = Math.max(0, Math.ceil(remainingMs / 3600000));
              return (
                <div key={b.id} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 10px", borderRadius: 8,
                  background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.35)",
                }}>
                  <span style={{ fontSize: 14 }}>{item?.icon ?? "⚡"}</span>
                  <span style={{ color: "#FFF", fontSize: 11, fontWeight: 800, flex: 1 }}>{item?.name ?? b.kind}</span>
                  <span style={{ color: "#4ade80", fontSize: 10, fontWeight: 800 }}>
                    {b.expires_at ? (remainingH > 24 ? `${Math.ceil(remainingH/24)}d` : `${remainingH}h`) : t("powerReady")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ fontSize: 10, color: "#FFD700", fontWeight: 900, letterSpacing: 1.5, marginBottom: 6 }}>{t("powerItemsHeading")}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
        {Object.entries(catalog).map(([kind, item]) => {
          const alreadyActive = active.some((a) => a.kind === kind);
          const canAfford = (pool.pool.gems ?? 0) >= item.cost;
          return (
            <div key={kind} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: 10, borderRadius: 10,
              background: "rgba(15,17,21,0.5)",
              border: "1px solid rgba(255,215,0,0.25)",
              opacity: alreadyActive ? 0.55 : 1,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: "rgba(255,215,0,0.12)", border: "1px solid rgba(255,215,0,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
              }}>{item.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#FFF", fontSize: 12, fontWeight: 900 }}>{item.name}</div>
                <div style={{ color: "#a8b4cf", fontSize: 10, marginTop: 1 }}>{item.description}</div>
              </div>
              <button
                onClick={() => activate(kind)}
                disabled={busy === kind || alreadyActive || !canAfford || !isAdmin}
                title={!isAdmin ? t("powerActiveTagAdmin") : alreadyActive ? t("powerActiveTagAlready") : !canAfford ? t("powerActiveTagPool") : ""}
                style={{
                  padding: "6px 10px", borderRadius: 8, border: "none", flexShrink: 0,
                  background: alreadyActive ? "rgba(74,222,128,0.2)" : canAfford && isAdmin ? "linear-gradient(135deg,#FFD700,#FF6B4A)" : "rgba(255,255,255,0.05)",
                  color: alreadyActive ? "#4ade80" : canAfford && isAdmin ? "#0F1115" : "#8B8FA3",
                  fontSize: 11, fontWeight: 900,
                  cursor: alreadyActive || !canAfford || !isAdmin ? "not-allowed" : "pointer",
                  opacity: busy === kind ? 0.6 : 1,
                }}
              >{alreadyActive ? t("powerActiveBadge") : t("powerCost", { cost: item.cost })}</button>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 10, color: "#5ddaf0", fontWeight: 900, letterSpacing: 1.5, marginBottom: 6 }}>{t("powerGemPacksHeading")}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14 }}>
        {CREW_GEM_PACKS_CLIENT.map((p) => (
          <button
            key={p.sku}
            onClick={() => buyPack(p.sku, p.name, p.price)}
            disabled={busy === p.sku}
            style={{
              padding: 10, borderRadius: 10,
              background: "rgba(93,218,240,0.08)",
              border: "1px solid rgba(93,218,240,0.35)",
              color: "#FFF", cursor: "pointer", textAlign: "left",
              opacity: busy === p.sku ? 0.6 : 1,
            }}
          >
            <div style={{ fontSize: 18 }}>{p.icon}</div>
            <div style={{ fontSize: 12, fontWeight: 900, marginTop: 2 }}>
              {t("powerGemAmount", { gems: p.gems.toLocaleString(numLocale) })}
              {p.bonus > 0 && <span style={{ color: "#4ade80" }}>{t("powerGemBonus", { bonus: p.bonus })}</span>}
            </div>
            <div style={{ fontSize: 10, color: "#a8b4cf" }}>{p.name}</div>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#FFD700", marginTop: 4 }}>
              {t("powerPriceEur", { price: (p.price / 100).toFixed(2).replace(".", locale === "de" ? "," : ".") })}
            </div>
          </button>
        ))}
      </div>

      <div style={{ fontSize: 10, color: "#22D1C3", fontWeight: 900, letterSpacing: 1.5, marginBottom: 6 }}>{t("powerSlotsHeading")}</div>
      <div style={{
        padding: 10, borderRadius: 10, marginBottom: 6,
        background: "rgba(34,209,195,0.08)", border: "1px solid rgba(34,209,195,0.3)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ color: "#22D1C3", fontSize: 11, fontWeight: 700 }}>{t("powerSlotsOccupied")}</span>
          <span style={{ color: "#FFF", fontSize: 14, fontWeight: 900 }}>
            {t("powerSlotsCount", { used: memberCount, cap: memberCap })} <span style={{ color: "#8B8FA3", fontSize: 10 }}>{t("powerSlotsMax")}</span>
          </span>
        </div>
        <div style={{ marginTop: 6, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.min(100, (memberCount / memberCap) * 100)}%`, background: "linear-gradient(90deg,#22D1C3,#5ddaf0)" }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {CREW_SLOT_PACKS_CLIENT.map((p) => (
          <button
            key={p.sku}
            onClick={() => buyPack(p.sku, p.name, p.price)}
            disabled={busy === p.sku || memberCap >= 100}
            style={{
              flex: 1, padding: 10, borderRadius: 10,
              background: memberCap >= 100 ? "rgba(255,255,255,0.04)" : "rgba(34,209,195,0.1)",
              border: `1px solid ${memberCap >= 100 ? "rgba(255,255,255,0.1)" : "rgba(34,209,195,0.4)"}`,
              color: memberCap >= 100 ? "#8B8FA3" : "#FFF",
              cursor: memberCap >= 100 ? "not-allowed" : "pointer",
              opacity: busy === p.sku ? 0.6 : 1,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 900 }}>{t("powerSlotsBtn", { n: p.slots })}</div>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#FFD700", marginTop: 4 }}>
              {t("powerPriceEur", { price: (p.price / 100).toFixed(2).replace(".", locale === "de" ? "," : ".") })}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
