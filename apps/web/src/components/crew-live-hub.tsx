"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { appAlert, appConfirm } from "@/components/app-dialog";

type Crew = {
  id: string;
  name: string;
  color: string | null;
  owner_id: string | null;
  invite_code: string | null;
};

type Tab = "overview" | "duel" | "challenges" | "events" | "chat" | "feed" | "shop";

const TABS: Array<{ id: Tab; label: string; icon: string; color: string }> = [
  { id: "overview",  label: "Mitglieder",  icon: "👥", color: "#22D1C3" },
  { id: "duel",      label: "Duell",       icon: "⚔️", color: "#FF2D78" },
  { id: "challenges",label: "Challenges",  icon: "🎯", color: "#FFD700" },
  { id: "events",    label: "Events",      icon: "📅", color: "#4ade80" },
  { id: "chat",      label: "Chat",        icon: "💬", color: "#5ddaf0" },
  { id: "feed",      label: "Feed",        icon: "📜", color: "#a855f7" },
  { id: "shop",      label: "Shop",        icon: "💎", color: "#FF6B4A" },
];

export function CrewLiveHub({ crew, userId, isAdmin }: {
  crew: Crew;
  userId: string;
  isAdmin: boolean;
}) {
  const [tab, setTab] = useState<Tab>("overview");
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
        🛰️ LIVE · CREW-ZENTRALE
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex", gap: 4, overflowX: "auto", marginBottom: 14,
        scrollbarWidth: "none",
      }}>
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flexShrink: 0, padding: "8px 12px", borderRadius: 999,
                background: active ? `${t.color}22` : "rgba(255,255,255,0.04)",
                border: `1px solid ${active ? t.color : "rgba(255,255,255,0.1)"}`,
                color: active ? t.color : "#a8b4cf",
                fontSize: 12, fontWeight: 800, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 4,
              }}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {tab === "overview"   && <MembersPanel crew={crew} />}
      {tab === "duel"       && <DuelPanel    crew={crew} />}
      {tab === "challenges" && <ChallengesPanel crew={crew} isAdmin={isAdmin} />}
      {tab === "events"     && <EventsPanel  crew={crew} userId={userId} />}
      {tab === "chat"       && <ChatPanel    crew={crew} userId={userId} />}
      {tab === "feed"       && <FeedPanel    crew={crew} />}
      {tab === "shop"       && <ShopPanel    crew={crew} userId={userId} isAdmin={isAdmin} />}
    </div>
  );
}

// ═══ MEMBERS ═══
type Member = {
  user_id: string; role: string; joined_at: string | null;
  username: string | null; display_name: string | null; avatar_url: string | null;
  level: number; xp: number; team_color: string | null;
  last_seen_at: string | null; streak_days: number;
};
function MembersPanel({ crew }: { crew: Crew }) {
  const [members, setMembers] = useState<Member[] | null>(null);
  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/crew/members?crew_id=${crew.id}`);
      const j = await r.json();
      setMembers(j.members ?? []);
    })();
  }, [crew.id]);

  if (members === null) return <Loading />;
  if (members.length === 0) return <Empty text="Noch keine Mitglieder." />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {members.map((m) => {
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
                    {m.role === "owner" ? "👑 OWNER" : "ADMIN"}
                  </span>
                )}
              </div>
              <div style={{ color: "#8B8FA3", fontSize: 10, marginTop: 1 }}>
                Lvl {m.level} · {m.xp.toLocaleString("de-DE")} XP
                {m.streak_days > 0 && <> · 🔥 {m.streak_days}</>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
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

  if (duels === null) return <Loading />;
  const active = duels.find((d) => d.status === "active");
  const past = duels.filter((d) => d.status !== "active");

  return (
    <div>
      {active ? <DuelCard duel={active} /> : (
        <div style={{ padding: 16, textAlign: "center", borderRadius: 12, background: "rgba(255,45,120,0.05)", border: "1px dashed rgba(255,45,120,0.3)" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚔️</div>
          <div style={{ color: "#FFF", fontSize: 13, fontWeight: 800, marginBottom: 4 }}>Kein aktives Duell</div>
          <div style={{ color: "#a8b4cf", fontSize: 11, marginBottom: 12 }}>
            Match mit Auto-Matchmaking starten — Gegner-Crew in ähnlicher Liga
          </div>
          <button onClick={triggerMatch} disabled={busy} style={{
            padding: "8px 18px", borderRadius: 10, border: "none",
            background: "linear-gradient(135deg, #FF2D78, #FF6B4A)",
            color: "#FFF", fontWeight: 900, fontSize: 12, cursor: "pointer",
            opacity: busy ? 0.6 : 1,
          }}>{busy ? "…" : "Duell starten"}</button>
        </div>
      )}

      {past.length > 0 && (
        <>
          <div style={{ fontSize: 10, color: "#8B8FA3", fontWeight: 900, letterSpacing: 1.5, marginTop: 14, marginBottom: 6 }}>
            VERGANGENE DUELLE
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {past.map((d) => <DuelCard key={d.id} duel={d} compact />)}
          </div>
        </>
      )}
    </div>
  );
}
function DuelCard({ duel, compact }: { duel: Duel; compact?: boolean }) {
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
        <span>{Number(duel.crew_a_km).toFixed(1)} km</span>
        <span>{duel.status === "finished" ? (iWon ? "✓ Du gewinnst" : "✗ Niederlage") : `Preis: +${duel.prize_xp} XP`}</span>
        <span>{Number(duel.crew_b_km).toFixed(1)} km</span>
      </div>
    </div>
  );
}

// ═══ CHALLENGES ═══
type Challenge = {
  id: string; name: string; description: string | null; icon: string;
  target_metric: string; target_value: number; progress: number; reward_xp: number;
  starts_at: string; ends_at: string; completed_at: string | null;
};
function ChallengesPanel({ crew, isAdmin }: { crew: Crew; isAdmin: boolean }) {
  const [items, setItems] = useState<Challenge[] | null>(null);
  const [creating, setCreating] = useState(false);
  const load = useCallback(async () => {
    const r = await fetch(`/api/crew/challenges?crew_id=${crew.id}`);
    const j = await r.json();
    setItems(j.challenges ?? []);
  }, [crew.id]);
  useEffect(() => { void load(); }, [load]);

  if (items === null) return <Loading />;
  return (
    <div>
      {isAdmin && (
        <button onClick={() => setCreating(true)} style={{
          width: "100%", marginBottom: 10, padding: "10px 12px", borderRadius: 10,
          background: "rgba(255,215,0,0.12)", border: "1px dashed rgba(255,215,0,0.5)",
          color: "#FFD700", fontWeight: 900, fontSize: 12, cursor: "pointer",
        }}>+ Neue Crew-Challenge anlegen</button>
      )}
      {items.length === 0 ? <Empty text="Noch keine aktiven Challenges." /> : (
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
                    <div style={{ color: "#FFD700", fontSize: 11, fontWeight: 900 }}>+{c.reward_xp} XP</div>
                    <div style={{ color: "#8B8FA3", fontSize: 9 }}>{daysLeft}d</div>
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
                  {Number(c.progress).toFixed(1)} / {c.target_value}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {creating && <ChallengeEditor crewId={crew.id} onClose={() => { setCreating(false); void load(); }} />}
    </div>
  );
}
function ChallengeEditor({ crewId, onClose }: { crewId: string; onClose: () => void }) {
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
      if (!r.ok) { const j = await r.json().catch(() => ({})); await appAlert(`Fehler: ${j.error ?? r.status}`); return; }
      onClose();
    } finally { setBusy(false); }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 440, background: "#1A1D23", borderRadius: 16, border: "1px solid rgba(255,215,0,0.4)", padding: 20, color: "#FFF" }}>
        <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 12 }}>🎯 Neue Crew-Challenge</div>
        <Input label="Titel" value={name} onChange={setName} placeholder="z. B. 100 km Wochen-Sprint" />
        <Input label="Beschreibung (optional)" value={desc} onChange={setDesc} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <Label>Metrik</Label>
            <select value={metric} onChange={(e) => setMetric(e.target.value as Challenge["target_metric"])} style={selectStyle}>
              <option value="weekly_km">Gesamt-km</option>
              <option value="new_streets">Neue Straßen</option>
              <option value="territories">Territorien</option>
              <option value="arena_wins">Arena-Siege</option>
              <option value="members_active">Aktive Mitglieder</option>
            </select>
          </div>
          <Input label="Ziel" type="number" value={String(target)} onChange={(v) => setTarget(Number(v))} />
          <Input label="Reward XP" type="number" value={String(reward)} onChange={(v) => setReward(Number(v))} />
          <Input label="Dauer (Tage)" type="number" value={String(days)} onChange={(v) => setDays(Number(v))} />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={onClose} style={btnSecondary}>Abbrechen</button>
          <button onClick={save} disabled={busy || !name} style={{ ...btnPrimary, background: "linear-gradient(135deg,#FFD700,#FF6B4A)", color: "#0F1115" }}>
            {busy ? "…" : "Anlegen"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══ EVENTS ═══
type CrewEvent = {
  id: string; title: string; description: string | null;
  starts_at: string; meeting_point: string | null;
  target_distance_km: number | null; target_pace_min_per_km: number | null;
  max_attendees: number | null;
  going_count: number; maybe_count: number; my_rsvp: string | null;
};
function EventsPanel({ crew, userId }: { crew: Crew; userId: string }) {
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

  if (events === null) return <Loading />;
  return (
    <div>
      <button onClick={() => setCreating(true)} style={{
        width: "100%", marginBottom: 10, padding: "10px 12px", borderRadius: 10,
        background: "rgba(74,222,128,0.12)", border: "1px dashed rgba(74,222,128,0.5)",
        color: "#4ade80", fontWeight: 900, fontSize: 12, cursor: "pointer",
      }}>+ Neuen Gruppenlauf planen</button>
      {events.length === 0 ? <Empty text="Kein geplantes Event. Lade zu einem Gruppenlauf ein!" /> : (
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
                      📅 {start.toLocaleString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      {e.meeting_point && <> · 📍 {e.meeting_point}</>}
                    </div>
                    {(e.target_distance_km || e.target_pace_min_per_km) && (
                      <div style={{ color: "#8B8FA3", fontSize: 10, marginTop: 2 }}>
                        {e.target_distance_km && <>{e.target_distance_km} km</>}
                        {e.target_pace_min_per_km && <> · Pace {e.target_pace_min_per_km}:00</>}
                      </div>
                    )}
                    {e.description && <div style={{ color: "#a8b4cf", fontSize: 11, marginTop: 4, lineHeight: 1.4 }}>{e.description}</div>}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ color: "#4ade80", fontSize: 11, fontWeight: 900 }}>✓ {e.going_count}</div>
                    <div style={{ color: "#FFD700", fontSize: 10 }}>~ {e.maybe_count}</div>
                  </div>
                </div>
                {!isPast && (
                  <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    {(["going","maybe","declined"] as const).map((s) => {
                      const active = e.my_rsvp === s;
                      const label = s === "going" ? "✓ Dabei" : s === "maybe" ? "~ Vielleicht" : "✗ Nein";
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
      {creating && <EventEditor crewId={crew.id} userId={userId} onClose={() => { setCreating(false); void load(); }} />}
    </div>
  );
}
function EventEditor({ crewId, onClose }: { crewId: string; userId: string; onClose: () => void }) {
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
      if (!r.ok) { const j = await r.json().catch(() => ({})); await appAlert(`Fehler: ${j.error ?? r.status}`); return; }
      onClose();
    } finally { setBusy(false); }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 440, background: "#1A1D23", borderRadius: 16, border: "1px solid rgba(74,222,128,0.4)", padding: 20, color: "#FFF" }}>
        <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 12 }}>📅 Neuer Gruppenlauf</div>
        <Input label="Titel" value={title} onChange={setTitle} placeholder="z. B. Mittwochs-Kiez-Runde" />
        <Input label="Beschreibung" value={desc} onChange={setDesc} />
        <Input label="Datum & Uhrzeit" type="datetime-local" value={date} onChange={setDate} />
        <Input label="Treffpunkt" value={mp} onChange={setMp} placeholder="z. B. Südkreuz Haupteingang" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Input label="Distanz (km)" type="number" value={String(km)} onChange={(v) => setKm(Number(v))} />
          <Input label="Pace (min/km)" type="number" value={String(pace)} onChange={(v) => setPace(Number(v))} />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={onClose} style={btnSecondary}>Abbrechen</button>
          <button onClick={save} disabled={busy || !title} style={{ ...btnPrimary, background: "linear-gradient(135deg,#4ade80,#22D1C3)", color: "#0F1115" }}>
            {busy ? "…" : "Anlegen"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══ CHAT ═══
type ChatMessage = {
  id: string; user_id: string; body: string; reply_to: string | null;
  created_at: string; deleted_at: string | null;
  user: { username: string | null; display_name: string | null; avatar_url: string | null; team_color: string | null } | { username: string | null; display_name: string | null; avatar_url: string | null; team_color: string | null }[] | null;
};
function ChatPanel({ crew, userId }: { crew: Crew; userId: string }) {
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

  // Realtime-Subscribe
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
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/crew/messages", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ crew_id: crew.id, body: t }),
      });
      if (r.ok) setText("");
      await load();
    } finally { setBusy(false); }
  }

  async function del(id: string) {
    if (!await appConfirm("Nachricht löschen?")) return;
    await fetch(`/api/crew/messages?id=${id}`, { method: "DELETE" });
    await load();
  }

  if (messages === null) return <Loading />;

  return (
    <div>
      <div ref={scrollRef} style={{ maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, padding: "4px 2px" }}>
        {messages.length === 0 && <Empty text="Noch keine Nachrichten. Schreib die erste!" />}
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
                  {new Date(m.created_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
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
          placeholder="Nachricht an Crew…"
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

// ═══ FEED ═══
type FeedItem = {
  id: string; kind: string; data: Record<string, unknown>; created_at: string;
  user: { username: string | null; display_name: string | null; avatar_url: string | null } | { username: string | null; display_name: string | null; avatar_url: string | null }[] | null;
};
const FEED_META: Record<string, { icon: string; color: string; label: (data: Record<string, unknown>, actor: string) => string }> = {
  member_joined:        { icon: "🎉", color: "#4ade80",  label: (_, a) => `${a} ist der Crew beigetreten` },
  member_left:          { icon: "👋", color: "#8B8FA3",  label: (_, a) => `${a} hat die Crew verlassen` },
  territory_claimed:    { icon: "🏴", color: "#FFD700",  label: (d, a) => `${a} hat ein Territorium erobert${d.area_m2 ? ` (${Math.round(Number(d.area_m2))} m²)` : ""}` },
  challenge_completed:  { icon: "🏆", color: "#FFD700",  label: (d) => `Challenge abgeschlossen: ${d.name ?? ""}` },
  duel_won:             { icon: "⚔️", color: "#4ade80",  label: (d) => `Duell gewonnen gegen ${d.opponent ?? "?"}` },
  duel_lost:            { icon: "⚔️", color: "#FF2D78",  label: (d) => `Duell verloren gegen ${d.opponent ?? "?"}` },
  event_created:        { icon: "📅", color: "#5ddaf0",  label: (d) => `Neuer Gruppenlauf: ${d.title ?? ""}` },
  km_milestone:         { icon: "🏃", color: "#22D1C3",  label: (d, a) => `${a} hat ${d.km ?? "?"} km erreicht` },
  arena_victory:        { icon: "🛡️", color: "#a855f7", label: (_, a) => `${a} hat ein Arena-Duell gewonnen` },
};
function FeedPanel({ crew }: { crew: Crew }) {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/crew/feed?crew_id=${crew.id}`);
      const j = await r.json();
      setItems(j.feed ?? []);
    })();
  }, [crew.id]);

  if (items === null) return <Loading />;
  if (items.length === 0) return <Empty text="Noch keine Crew-Aktivität. Sobald Mitglieder laufen, Territorien erobern oder Challenges schaffen, erscheint es hier." />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((item) => {
        const meta = FEED_META[item.kind] ?? { icon: "•", color: "#8B8FA3", label: () => item.kind };
        const u = Array.isArray(item.user) ? item.user[0] : item.user;
        const actor = u?.display_name ?? u?.username ?? "Jemand";
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
              <div style={{ color: "#FFF", fontSize: 12, fontWeight: 700 }}>{meta.label(d, actor)}</div>
              <div style={{ color: "#8B8FA3", fontSize: 9, marginTop: 1 }}>
                {new Date(item.created_at).toLocaleString("de-DE")}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══ SHOP ═══
type ShopItem = {
  id: string; category: string; name: string; description: string; icon: string;
  price_gems: number; duration_hours: number | null; payload: Record<string, unknown>;
};
function ShopPanel({ crew, userId, isAdmin }: { crew: Crew; userId: string; isAdmin: boolean }) {
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
    if (!isAdmin) { await appAlert("Nur Crew-Admins dürfen Crew-Kosmetik kaufen."); return; }
    if (gems < item.price_gems) { await appAlert(`Zu wenig Diamanten: ${gems} / ${item.price_gems} 💎`); return; }
    if (!await appConfirm(`"${item.name}" für ${item.price_gems} 💎 kaufen?`)) return;

    setBusy(item.id);
    try {
      const { error } = await sb.rpc("purchase_gem_item", { p_user_id: userId, p_item_id: item.id, p_crew_id: crew.id });
      if (error) { await appAlert(`Fehler: ${error.message}`); return; }
      await appAlert(`✓ ${item.name} aktiviert!`);
      await load();
    } finally { setBusy(null); }
  }

  if (items === null) return <Loading />;
  return (
    <div>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 12px", borderRadius: 10, marginBottom: 10,
        background: "rgba(93,218,240,0.08)", border: "1px solid rgba(93,218,240,0.3)",
      }}>
        <span style={{ color: "#a8b4cf", fontSize: 11, fontWeight: 700 }}>Dein Guthaben</span>
        <span style={{ color: "#5ddaf0", fontSize: 15, fontWeight: 900 }}>💎 {gems.toLocaleString("de-DE")}</span>
      </div>
      {!isAdmin && (
        <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(255,215,0,0.08)", border: "1px dashed rgba(255,215,0,0.3)", fontSize: 10, color: "#FFD700", marginBottom: 10 }}>
          ℹ️ Crew-Kosmetik kann nur von Admins gekauft werden.
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
            >💎 {i.price_gems}</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══ SHARED ═══
function Loading() { return <div style={{ padding: 30, textAlign: "center", color: "#8B8FA3", fontSize: 12 }}>Lade…</div>; }
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
