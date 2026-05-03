"use client";

import { useCallback, useEffect, useState } from "react";

const PRIMARY = "#22D1C3";
const GOLD = "#FFD700";
const PINK = "#FF2D78";
const TEXT_SOFT = "#a8b4cf";
const MUTED = "#8B8FA3";
const BORDER = "rgba(255,255,255,0.08)";

type Tab = "activity" | "lore" | "drops" | "surveys" | "city_lord";

type ActivityState = {
  date: string; points: number; claimed_levels: number[];
  thresholds: Array<{ level: number; points_required: number; reward_payload: Record<string, unknown> }>;
};
type LoreSet = { id: string; name: string; description: string; pieces: Array<{ id: string; name: string; found: boolean }>; claimed: boolean };
type CryptoDrop = { id: string; crew_id: string; total_gems: number; slots: number; claimed_count: number; expires_at: string; i_claimed: boolean };
type Survey = { id: string; title: string; description: string; completed: boolean };
type CityLordState = { season: { id: string; ends_at: string } | null; lord: { user_id: string; display_name: string } | null; royal_chests: Array<{ id: string; chest_kind: string; gems: number; claimed: boolean }>; titles: Array<{ title_kind: string; expires_at: string | null }> };

export function LootHubModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("activity");
  const [activity, setActivity] = useState<ActivityState | null>(null);
  const [lore, setLore] = useState<LoreSet[]>([]);
  const [drops, setDrops] = useState<CryptoDrop[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [cityLord, setCityLord] = useState<CityLordState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const [a, l, d, s, c] = await Promise.all([
      fetch("/api/runner/daily-activity").then((r) => r.ok ? r.json() : null),
      fetch("/api/runner/lore").then((r) => r.ok ? r.json() : null),
      fetch("/api/runner/crypto-drops").then((r) => r.ok ? r.json() : null),
      fetch("/api/runner/surveys").then((r) => r.ok ? r.json() : null),
      fetch("/api/runner/city-lord").then((r) => r.ok ? r.json() : null),
    ]);
    if (a) setActivity(a);
    if (l?.sets) {
      // API liefert flache sets/pieces/found/claimed — zu nested LoreSet[] umformen
      const foundIds = new Set<string>((l.found ?? []).map((f: { piece_id: string }) => f.piece_id));
      const claimedIds = new Set<string>((l.claimed ?? []).map((c: { set_id: string }) => c.set_id));
      const piecesBySet: Record<string, Array<{ id: string; name: string; found: boolean }>> = {};
      for (const p of (l.pieces ?? []) as Array<{ id: string; set_id: string; name: string }>) {
        (piecesBySet[p.set_id] = piecesBySet[p.set_id] || []).push({ id: p.id, name: p.name, found: foundIds.has(p.id) });
      }
      setLore((l.sets as Array<{ id: string; name: string; description: string }>).map((s) => ({
        id: s.id, name: s.name, description: s.description,
        pieces: piecesBySet[s.id] ?? [],
        claimed: claimedIds.has(s.id),
      })));
    }
    if (d?.drops) setDrops(d.drops);
    if (s?.surveys) setSurveys(s.surveys);
    if (c) {
      // API liefert { seasons, lords } — auf erwartete Form mappen
      const seasonsArr = (c.seasons ?? []) as Array<{ id: string; ends_at: string; status: string }>;
      const lordsArr = (c.lords ?? []) as Array<{ user_id: string; display_name?: string; season_id: string }>;
      const activeSeason = seasonsArr.find((s) => s.status === "active") ?? seasonsArr[0] ?? null;
      const lord = activeSeason ? (lordsArr.find((l) => l.season_id === activeSeason.id) ?? null) : null;
      setCityLord({
        season: activeSeason ? { id: activeSeason.id, ends_at: activeSeason.ends_at } : null,
        lord: lord ? { user_id: lord.user_id, display_name: lord.display_name ?? "Stadtherr" } : null,
        royal_chests: (c.royal_chests ?? []) as CityLordState["royal_chests"],
        titles: (c.titles ?? []) as CityLordState["titles"],
      });
    }
  }, []);
  useEffect(() => { void loadAll(); }, [loadAll]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2200); };

  async function claimActivity(level: number) {
    if (busy) return;
    setBusy(`activity_${level}`);
    try {
      const r = await fetch("/api/runner/daily-activity", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim", level }),
      });
      const j = await r.json().catch(() => ({}));
      showToast(j.ok ? "Belohnung erhalten" : (j.error ?? "Fehler"));
      await loadAll();
    } finally { setBusy(null); }
  }

  async function claimLoreSet(setId: string) {
    if (busy) return;
    setBusy(`lore_${setId}`);
    try {
      const r = await fetch("/api/runner/lore", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim_set", set_id: setId }),
      });
      const j = await r.json().catch(() => ({}));
      showToast(j.ok ? "Set-Belohnung erhalten" : (j.error ?? "Fehler"));
      await loadAll();
    } finally { setBusy(null); }
  }

  async function claimDrop(dropId: string) {
    if (busy) return;
    setBusy(`drop_${dropId}`);
    try {
      const r = await fetch("/api/runner/crypto-drops", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim", drop_id: dropId }),
      });
      const j = await r.json().catch(() => ({}));
      showToast(j.gems != null ? `+${j.gems} 💎` : (j.error ?? "Fehler"));
      await loadAll();
    } finally { setBusy(null); }
  }

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 9100,
      background: "rgba(0,0,0,0.78)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 12,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 560, maxHeight: "92vh",
        display: "flex", flexDirection: "column",
        background: `linear-gradient(180deg, ${PRIMARY}1f 0%, #141a2d 100%)`,
        borderRadius: 18, border: `1px solid ${PRIMARY}66`,
        color: "#F0F0F0", overflow: "hidden",
      }}>
        <div style={{ padding: "14px 18px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: PRIMARY, fontSize: 9, fontWeight: 900, letterSpacing: 2 }}>LOOT-ZENTRALE</div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>Belohnungen & Aktivität</div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 16, background: "rgba(0,0,0,0.55)", border: "none",
            color: "#FFF", fontSize: 18, fontWeight: 900, cursor: "pointer",
          }}>×</button>
        </div>

        <div style={{ display: "flex", overflowX: "auto", padding: "0 8px", borderBottom: `1px solid ${BORDER}` }}>
          {([
            { id: "activity",  label: "📊 Aktivität",  color: PRIMARY },
            { id: "lore",      label: "📜 Lore",       color: GOLD },
            { id: "drops",     label: "💸 Krypto",     color: "#4ade80" },
            { id: "surveys",   label: "📋 Umfragen",   color: "#a855f7" },
            { id: "city_lord", label: "👑 Stadtherr",  color: PINK },
          ] as const).map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flexShrink: 0, padding: "10px 12px", border: "none",
              background: "transparent",
              color: tab === t.id ? t.color : TEXT_SOFT,
              borderBottom: `2px solid ${tab === t.id ? t.color : "transparent"}`,
              fontSize: 11, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap",
            }}>{t.label}</button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
          {tab === "activity" && (
            <ActivityPanel state={activity} onClaim={claimActivity} busy={busy} />
          )}
          {tab === "lore" && (
            <LorePanel sets={lore} onClaim={claimLoreSet} busy={busy} />
          )}
          {tab === "drops" && (
            <DropsPanel drops={drops} onClaim={claimDrop} busy={busy} />
          )}
          {tab === "surveys" && (
            <SurveysPanel surveys={surveys} onComplete={loadAll} />
          )}
          {tab === "city_lord" && (
            <CityLordPanel state={cityLord} onReload={loadAll} />
          )}
        </div>

        {toast && (
          <div style={{
            position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
            padding: "8px 16px", borderRadius: 10,
            background: "rgba(0,0,0,0.92)", color: "#FFF", fontSize: 12, fontWeight: 700,
          }}>{toast}</div>
        )}
      </div>
    </div>
  );
}

function ActivityPanel({ state, onClaim, busy }: { state: ActivityState | null; onClaim: (l: number) => void; busy: string | null }) {
  if (!state) return <Empty text="Lade …" />;
  const { points, claimed_levels, thresholds } = state;
  const claimed = new Set(claimed_levels);
  const max = thresholds[thresholds.length - 1]?.points_required ?? 400;
  const pct = Math.min(100, Math.round((points / max) * 100));
  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: TEXT_SOFT, fontWeight: 700 }}>Heute</div>
        <div style={{ fontSize: 22, color: PRIMARY, fontWeight: 900 }}>{points} <span style={{ fontSize: 12, color: MUTED, fontWeight: 700 }}>/ {max} Aktivitätspunkte</span></div>
        <div style={{ marginTop: 6, height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${PRIMARY}, ${GOLD})` }} />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {thresholds.map((th) => {
          const reached = points >= th.points_required;
          const wasClaimed = claimed.has(th.level);
          const reward = (th.reward_payload?.label as string | undefined) ?? "Belohnung";
          return (
            <div key={th.level} style={{
              padding: "10px 12px", borderRadius: 10,
              background: wasClaimed ? "rgba(0,0,0,0.3)" : reached ? `${GOLD}1a` : "rgba(255,255,255,0.03)",
              border: `1px solid ${wasClaimed ? "#444" : reached ? GOLD : BORDER}`,
              display: "flex", justifyContent: "space-between", alignItems: "center",
              opacity: !reached && !wasClaimed ? 0.6 : 1,
            }}>
              <div>
                <div style={{ fontSize: 11, color: wasClaimed ? MUTED : "#FFF", fontWeight: 800 }}>Stufe {th.level} · {th.points_required} Pkt</div>
                <div style={{ fontSize: 10, color: TEXT_SOFT, marginTop: 2 }}>{reward}</div>
              </div>
              {wasClaimed ? (
                <span style={{ color: MUTED, fontSize: 11 }}>✓</span>
              ) : reached ? (
                <button onClick={() => onClaim(th.level)} disabled={busy !== null} style={btn(GOLD)}>
                  {busy === `activity_${th.level}` ? "…" : "Holen"}
                </button>
              ) : (
                <span style={{ color: MUTED, fontSize: 10 }}>🔒</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LorePanel({ sets, onClaim, busy }: { sets: LoreSet[]; onClaim: (id: string) => void; busy: string | null }) {
  if (sets.length === 0) return <Empty text="Noch keine Lore-Sets entdeckt." />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {sets.map((s) => {
        const found = s.pieces.filter((p) => p.found).length;
        const total = s.pieces.length;
        const complete = found === total;
        return (
          <div key={s.id} style={{
            padding: 12, borderRadius: 10,
            background: complete && !s.claimed ? `${GOLD}1a` : "rgba(255,255,255,0.03)",
            border: `1px solid ${complete && !s.claimed ? GOLD : BORDER}`,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 900 }}>{s.name}</div>
                <div style={{ fontSize: 10, color: TEXT_SOFT }}>{found} / {total} gefunden</div>
              </div>
              {s.claimed ? <span style={{ color: MUTED, fontSize: 11 }}>✓ eingelöst</span>
                : complete ? (
                  <button onClick={() => onClaim(s.id)} disabled={busy !== null} style={btn(GOLD)}>
                    {busy === `lore_${s.id}` ? "…" : "Belohnung"}
                  </button>
                ) : null}
            </div>
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
              {s.pieces.map((p) => (
                <div key={p.id} title={p.name} style={{
                  width: 22, height: 22, borderRadius: 4,
                  background: p.found ? `${PRIMARY}55` : "rgba(255,255,255,0.06)",
                  border: `1px solid ${p.found ? PRIMARY : BORDER}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11,
                }}>{p.found ? "✓" : "?"}</div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DropsPanel({ drops, onClaim, busy }: { drops: CryptoDrop[]; onClaim: (id: string) => void; busy: string | null }) {
  if (drops.length === 0) return <Empty text="Keine offenen Krypto-Drops in deiner Crew." />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {drops.map((d) => {
        const left = Math.max(0, d.slots - d.claimed_count);
        const expSec = Math.max(0, Math.floor((new Date(d.expires_at).getTime() - Date.now()) / 1000));
        return (
          <div key={d.id} style={{
            padding: 12, borderRadius: 10,
            background: "rgba(74,222,128,0.08)",
            border: "1px solid rgba(74,222,128,0.4)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, color: "#4ade80" }}>💸 {d.total_gems} Krypto</div>
              <div style={{ fontSize: 10, color: TEXT_SOFT }}>{left} Slots offen · {Math.floor(expSec / 60)}m {expSec % 60}s</div>
            </div>
            {d.i_claimed ? <span style={{ color: MUTED, fontSize: 11 }}>✓</span>
              : left > 0 ? (
                <button onClick={() => onClaim(d.id)} disabled={busy !== null} style={btn("#4ade80")}>
                  {busy === `drop_${d.id}` ? "…" : "Greifen"}
                </button>
              ) : <span style={{ color: MUTED, fontSize: 11 }}>leer</span>}
          </div>
        );
      })}
    </div>
  );
}

function SurveysPanel({ surveys, onComplete }: { surveys: Survey[]; onComplete: () => void }) {
  if (surveys.length === 0) return <Empty text="Aktuell keine Umfragen aktiv." />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {surveys.map((s) => (
        <div key={s.id} style={{
          padding: 12, borderRadius: 10,
          background: s.completed ? "rgba(0,0,0,0.3)" : `${"#a855f7"}1a`,
          border: `1px solid ${s.completed ? "#444" : "#a855f7"}`,
        }}>
          <div style={{ fontSize: 13, fontWeight: 900 }}>{s.title}</div>
          <div style={{ fontSize: 10, color: TEXT_SOFT, marginTop: 2 }}>{s.description}</div>
          {s.completed ? (
            <div style={{ marginTop: 6, color: MUTED, fontSize: 11 }}>✓ Abgeschlossen</div>
          ) : (
            <button onClick={async () => {
              const r = await fetch("/api/runner/surveys", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ survey_id: s.id, response: { completed_via: "loot_hub" } }),
              });
              if (r.ok) onComplete();
            }} style={{ ...btn("#a855f7"), marginTop: 8 }}>Teilnehmen</button>
          )}
        </div>
      ))}
    </div>
  );
}

function CityLordPanel({ state, onReload }: { state: CityLordState | null; onReload: () => void }) {
  if (!state) return <Empty text="Lade …" />;
  return (
    <div>
      <div style={{
        padding: 12, borderRadius: 10,
        background: `${PINK}1a`, border: `1px solid ${PINK}66`, marginBottom: 10,
      }}>
        <div style={{ fontSize: 9, color: PINK, fontWeight: 900, letterSpacing: 1.5 }}>STADTHERR</div>
        <div style={{ fontSize: 14, fontWeight: 900, marginTop: 2 }}>
          {state.lord ? state.lord.display_name : "Vakant"}
        </div>
        {state.season && (
          <div style={{ fontSize: 10, color: TEXT_SOFT, marginTop: 4 }}>
            Saison endet: {new Date(state.season.ends_at).toLocaleDateString("de-DE")}
          </div>
        )}
      </div>

      {state.titles.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: TEXT_SOFT, fontWeight: 800, marginBottom: 4 }}>DEINE TITEL</div>
          {state.titles.map((t, i) => (
            <span key={i} style={{
              display: "inline-block", margin: "0 4px 4px 0",
              padding: "4px 8px", borderRadius: 4,
              background: `${GOLD}22`, border: `1px solid ${GOLD}`,
              color: GOLD, fontSize: 10, fontWeight: 800,
            }}>👑 {t.title_kind}</span>
          ))}
        </div>
      )}

      {state.royal_chests.length > 0 ? (
        <div>
          <div style={{ fontSize: 10, color: TEXT_SOFT, fontWeight: 800, marginBottom: 4 }}>KÖNIGLICHE TRUHEN</div>
          {state.royal_chests.map((c) => (
            <div key={c.id} style={{
              padding: 10, borderRadius: 10, marginTop: 6,
              background: c.claimed ? "rgba(0,0,0,0.3)" : `${GOLD}1a`,
              border: `1px solid ${c.claimed ? "#444" : GOLD}`,
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div style={{ fontSize: 12, fontWeight: 800 }}>👑 {c.chest_kind} · {c.gems} 💎</div>
              {c.claimed ? <span style={{ color: MUTED, fontSize: 11 }}>✓</span> : (
                <button onClick={async () => {
                  const r = await fetch("/api/runner/royal-chests", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "claim", chest_id: c.id }),
                  });
                  if (r.ok) onReload();
                }} style={btn(GOLD)}>Öffnen</button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ color: MUTED, fontSize: 11, textAlign: "center", padding: 12 }}>Keine Königlichen Truhen erhalten.</div>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ padding: 30, textAlign: "center", color: TEXT_SOFT, fontSize: 12 }}>{text}</div>;
}

function btn(color: string): React.CSSProperties {
  return {
    padding: "6px 12px", borderRadius: 8, border: "none",
    background: color, color: "#0F1115",
    fontSize: 11, fontWeight: 900, cursor: "pointer",
  };
}

/**
 * Auto-Trigger: ruft beim ersten Mount /api/runner/link-bonus mit kind=desktop_web auf,
 * wenn der User aus einem Desktop-Browser kommt (kein Capacitor, breiter Viewport).
 * Idempotent dank UNIQUE(user_id, kind) in der DB.
 */
export function DesktopWebBonusTrigger() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isCapacitor = !!(window as unknown as { Capacitor?: unknown }).Capacitor;
    const isDesktop = window.innerWidth >= 1024 && !isCapacitor;
    if (!isDesktop) return;
    void fetch("/api/runner/link-bonus", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "desktop_web" }),
    }).catch(() => { /* silent */ });
  }, []);
  return null;
}
