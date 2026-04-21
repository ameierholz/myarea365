"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Session = {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  status: "active" | "closed";
};

type RunnerRow = {
  user_id: string;
  wins: number;
  losses: number;
  fusions: number;
  trophies: number;
  points: number;
  users: { display_name: string | null; username: string | null; avatar_url: string | null };
};

type CrewRow = {
  crew_id: string;
  wins: number;
  losses: number;
  points: number;
  crews: { name: string; color: string | null; custom_emblem_url: string | null };
};

type TitleRow = {
  id: string;
  session_id: string;
  rank: number;
  title: string;
  awarded_at: string;
  arena_sessions: { name: string };
};

type Response = {
  session: Session | null;
  runners: RunnerRow[];
  crews: CrewRow[];
  titles?: TitleRow[];
};

type Tab = "runners" | "crews";

export function ArenaSessionModal({ currentUserId, onClose }: { currentUserId: string | null; onClose: () => void }) {
  const [data, setData] = useState<Response | null>(null);
  const [tab, setTab] = useState<Tab>("runners");
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    const qs = currentUserId ? `?for_user_id=${currentUserId}` : "";
    const r = await fetch(`/api/arena/session${qs}`);
    if (r.ok) setData(await r.json());
  }, [currentUserId]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const countdown = useMemo(() => {
    if (!data?.session) return "—";
    const ms = new Date(data.session.ends_at).getTime() - now;
    if (ms <= 0) return "Beendet";
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${d}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
  }, [data?.session, now]);

  const myTitles = data?.titles ?? [];

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 4500,
      background: "rgba(15,17,21,0.88)", backdropFilter: "blur(10px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 640, maxHeight: "92vh",
        display: "flex", flexDirection: "column",
        background: "#141a2d", borderRadius: 20,
        border: "1px solid rgba(255,107,74,0.4)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
        color: "#F0F0F0", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "14px 18px",
          background: "linear-gradient(135deg, rgba(255,107,74,0.2), rgba(255,215,0,0.15))",
          borderBottom: "1px solid rgba(255,107,74,0.3)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 26 }}>🏆</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#FF6B4A", fontSize: 9, fontWeight: 900, letterSpacing: 2 }}>ARENA</div>
            <div style={{ color: "#FFF", fontSize: 16, fontWeight: 900 }}>
              {data?.session?.name ?? "Keine aktive Session"}
            </div>
            {data?.session && (
              <div style={{ color: "#a8b4cf", fontSize: 10, marginTop: 2 }}>
                ⏱️ Endet in {countdown}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#8B8FA3", fontSize: 22, cursor: "pointer", width: 32, height: 32 }}>×</button>
        </div>

        {/* Meine Titel */}
        {currentUserId && myTitles.length > 0 && (
          <div style={{ padding: "12px 18px 0", display: "flex", flexWrap: "wrap", gap: 6 }}>
            {myTitles.slice(0, 5).map((t) => (
              <div key={t.id} style={{
                padding: "5px 10px", borderRadius: 999,
                background: t.rank === 1 ? "rgba(255,215,0,0.18)" : t.rank === 2 ? "rgba(200,200,200,0.18)" : "rgba(205,127,50,0.18)",
                border: `1px solid ${t.rank === 1 ? "#FFD700" : t.rank === 2 ? "#c8c8c8" : "#cd7f32"}`,
                color: t.rank === 1 ? "#FFD700" : t.rank === 2 ? "#e8e8e8" : "#e8a968",
                fontSize: 10, fontWeight: 800,
              }}>
                {t.title} · {t.arena_sessions.name}
              </div>
            ))}
          </div>
        )}

        {/* Tab-Bar */}
        <div style={{ display: "flex", padding: "8px 18px 0" }}>
          {(["runners", "crews"] as Tab[]).map((t) => {
            const active = tab === t;
            const color = t === "runners" ? "#22D1C3" : "#FF2D78";
            return (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, background: "transparent", border: "none", cursor: "pointer",
                padding: "10px 8px",
                color: active ? color : "#8B8FA3",
                fontSize: 12, fontWeight: 800,
                borderBottom: active ? `2px solid ${color}` : "2px solid transparent",
              }}>
                {t === "runners" ? "👤 Runner" : "👥 Crews"}
              </button>
            );
          })}
        </div>

        {/* Leaderboard */}
        <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
          {tab === "runners" && (
            <LeaderList rows={(data?.runners ?? []).map((r, i) => ({
              key: r.user_id,
              rank: i + 1,
              name: r.users.display_name || r.users.username || "Runner",
              avatar: r.users.avatar_url,
              wins: r.wins,
              losses: r.losses,
              points: r.points,
              extra: [
                r.fusions > 0 ? `⚡${r.fusions} Fusion` : null,
                r.trophies > 0 ? `🏆${r.trophies} Trophäe` : null,
              ].filter(Boolean).join(" · "),
              highlight: r.user_id === currentUserId,
              accentColor: "#22D1C3",
            }))} />
          )}
          {tab === "crews" && (
            <LeaderList rows={(data?.crews ?? []).map((r, i) => ({
              key: r.crew_id,
              rank: i + 1,
              name: r.crews.name,
              avatar: r.crews.custom_emblem_url,
              wins: r.wins,
              losses: r.losses,
              points: r.points,
              extra: "",
              highlight: false,
              accentColor: r.crews.color ?? "#FF2D78",
            }))} />
          )}

          {/* Reward-Info */}
          <div style={{
            marginTop: 14, padding: 12, borderRadius: 12,
            background: "rgba(255,107,74,0.08)", border: "1px dashed rgba(255,107,74,0.35)",
            fontSize: 11, lineHeight: 1.55, color: "#a8b4cf",
          }}>
            <div style={{ color: "#FF6B4A", fontWeight: 900, marginBottom: 6, letterSpacing: 0.5 }}>🎁 BELOHNUNGEN AM SESSION-ENDE</div>
            {tab === "runners" ? (
              <>
                <div>🥇 <b style={{ color: "#FFD700" }}>Area-Liga-Champion</b> · 🥈 Herausforderer · 🥉 Finalist</div>
                <div style={{ marginTop: 4 }}>Titel bleiben dauerhaft im Profil</div>
              </>
            ) : (
              <>
                <div>🥇 <b style={{ color: "#FFD700" }}>80 Universal-Siegel</b> an jedes Mitglied + Banner + 500 💎 Crew-Schatz</div>
                <div>🥈 50 Siegel + Banner</div>
                <div>🥉 25 Siegel</div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LeaderList({ rows }: {
  rows: Array<{
    key: string; rank: number; name: string; avatar: string | null;
    wins: number; losses: number; points: number; extra: string; highlight: boolean; accentColor: string;
  }>;
}) {
  if (rows.length === 0) return <div style={{ padding: 40, textAlign: "center", color: "#8B8FA3", fontSize: 12 }}>Noch keine Kämpfe in dieser Session.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {rows.map((r) => {
        const rankIcon = r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : `#${r.rank}`;
        const rankColor = r.rank === 1 ? "#FFD700" : r.rank === 2 ? "#c8c8c8" : r.rank === 3 ? "#cd7f32" : "#8B8FA3";
        return (
          <div key={r.key} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: 10, borderRadius: 10,
            background: r.highlight ? "rgba(34,209,195,0.12)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${r.highlight ? r.accentColor : "rgba(255,255,255,0.08)"}`,
          }}>
            <div style={{ width: 32, textAlign: "center", fontSize: 13, fontWeight: 900, color: rankColor }}>
              {rankIcon}
            </div>
            {r.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.avatar} alt="" style={{ width: 34, height: 34, borderRadius: 10, objectFit: "cover", border: `1px solid ${r.accentColor}55` }} />
            ) : (
              <div style={{ width: 34, height: 34, borderRadius: 10, background: `${r.accentColor}22`, border: `1px solid ${r.accentColor}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                {r.name[0]?.toUpperCase() ?? "?"}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: "#FFF", fontSize: 13, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
              <div style={{ color: "#a8b4cf", fontSize: 10, marginTop: 1 }}>
                {r.wins}W / {r.losses}L{r.extra ? ` · ${r.extra}` : ""}
              </div>
            </div>
            <div style={{ color: r.accentColor, fontSize: 14, fontWeight: 900, flexShrink: 0 }}>
              {r.points} <span style={{ fontSize: 9, color: "#8B8FA3", fontWeight: 600 }}>Pkt</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
