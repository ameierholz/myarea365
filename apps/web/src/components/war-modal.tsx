"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Modal, Z } from "@/components/ui";

const PRIMARY = "#22D1C3";
const ACCENT  = "#FF2D78";
const GOLD    = "#FFD700";

type ActiveWar = {
  id: string;
  attacker_crew_id: string; defender_crew_id: string;
  attacker_name: string; attacker_tag: string;
  defender_name: string; defender_tag: string;
  declared_at: string; ends_at: string;
  attacker_score: number; defender_score: number;
  is_my_crew_attacker: boolean;
};

type WarHistory = {
  id: string;
  attacker_name: string; defender_name: string;
  declared_at: string; ended_at: string | null;
  attacker_score: number; defender_score: number;
  winner_crew_id: string | null;
  is_winner: boolean;
  is_my_crew_attacker: boolean;
};

type WarTarget = {
  crew_id: string; name: string; tag: string;
  repeater_count: number;
  territory_color: string;
  has_active_war: boolean;
};

export function WarModal({ onClose }: { onClose: () => void }) {
  const [active, setActive] = useState<ActiveWar[]>([]);
  const [history, setHistory] = useState<WarHistory[]>([]);
  const [targets, setTargets] = useState<WarTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"active" | "declare" | "history">("active");
  const [role, setRole] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(i); }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (user) {
      const { data: cm } = await sb.from("crew_members").select("role").eq("user_id", user.id).maybeSingle();
      setRole((cm as { role?: string } | null)?.role ?? null);
    }
    const [{ data: wars }, { data: tg }] = await Promise.all([
      sb.rpc("list_my_crew_wars"),
      sb.rpc("suggest_war_targets"),
    ]);
    const w = wars as { ok?: boolean; active?: ActiveWar[]; history?: WarHistory[] } | null;
    if (w?.ok) {
      setActive(w.active ?? []);
      setHistory(w.history ?? []);
    }
    const t = tg as { ok?: boolean; targets?: WarTarget[] } | null;
    if (t?.ok) setTargets(t.targets ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function declareWar(targetCrewId: string, durationDays: number) {
    setBusy(true); setErr(null);
    const sb = createClient();
    const { data, error } = await sb.rpc("declare_crew_war", {
      p_target_crew_id: targetCrewId, p_duration_days: durationDays,
    });
    setBusy(false);
    const r = data as { ok?: boolean; error?: string; hint?: string } | null;
    if (error || !r?.ok) {
      setErr(r?.hint || r?.error || error?.message || "Krieg-Deklaration fehlgeschlagen");
      return;
    }
    setTab("active");
    await refresh();
  }

  const isLeader = role === "leader";

  return (
    <Modal open={true} onClose={onClose} size="md" zIndex={Z.modalDeep}>
      <div style={{ position: "relative", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <div style={{
          padding: "16px 16px 12px", textAlign: "center",
          background: `radial-gradient(ellipse at 50% 0%, ${ACCENT}55 0%, transparent 70%), linear-gradient(180deg, rgba(20,22,28,0.85), rgba(15,17,21,0.95))`,
          borderBottom: `1px solid ${ACCENT}33`,
          position: "relative",
        }}>
          <button
            onClick={onClose}
            style={{
              position: "absolute", top: 10, right: 10,
              width: 28, height: 28, borderRadius: 14,
              background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.15)",
              color: "#FFF", fontSize: 14, cursor: "pointer",
            }}
          >×</button>
          <div style={{ fontSize: 40, lineHeight: 1 }}>⚔️</div>
          <div style={{ color: "#FFF", fontSize: 20, fontWeight: 400, fontFamily: "var(--font-display-stack)", letterSpacing: 0.6 }}>
            Crew-Kriege
          </div>
          <div style={{ color: ACCENT, fontSize: 10, fontWeight: 900, letterSpacing: 1.2, textTransform: "uppercase" }}>
            Deklaration · Score · Historie
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <TabButton active={tab === "active"} onClick={() => setTab("active")} count={active.length}>Aktive</TabButton>
          <TabButton active={tab === "declare"} onClick={() => setTab("declare")}>Erklären</TabButton>
          <TabButton active={tab === "history"} onClick={() => setTab("history")} count={history.length}>Historie</TabButton>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
          {loading && <div style={{ padding: 24, textAlign: "center", color: "#8B8FA3" }}>Lade…</div>}

          {!loading && tab === "active" && (
            active.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#8B8FA3", fontSize: 12 }}>
                Aktuell keine aktiven Kriege.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {active.map((w) => <ActiveWarCard key={w.id} war={w} now={now} />)}
              </div>
            )
          )}

          {!loading && tab === "declare" && (
            !isLeader ? (
              <div style={{ padding: 24, textAlign: "center", color: "#8B8FA3", fontSize: 12 }}>
                Nur der Crew-Leader darf Krieg erklären.
              </div>
            ) : (
              <DeclareWarPanel
                targets={targets}
                onDeclare={declareWar}
                busy={busy}
                error={err}
              />
            )
          )}

          {!loading && tab === "history" && (
            history.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#8B8FA3", fontSize: 12 }}>
                Noch keine beendeten Kriege.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {history.map((h) => <HistoryWarCard key={h.id} h={h} />)}
              </div>
            )
          )}
        </div>
      </div>
    </Modal>
  );
}

function TabButton({ active, onClick, children, count }: {
  active: boolean; onClick: () => void; children: React.ReactNode; count?: number;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: "10px 8px",
        background: active ? "rgba(255,45,120,0.18)" : "transparent",
        border: "none",
        color: active ? "#FFF" : "#8B8FA3",
        fontSize: 11, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase",
        cursor: "pointer",
        borderBottom: active ? `2px solid ${ACCENT}` : "2px solid transparent",
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
      }}
    >
      {children}
      {typeof count === "number" && count > 0 && (
        <span style={{
          padding: "1px 6px", borderRadius: 8, background: ACCENT, color: "#FFF",
          fontSize: 9, fontWeight: 900,
        }}>{count}</span>
      )}
    </button>
  );
}

function ActiveWarCard({ war, now }: { war: ActiveWar; now: number }) {
  const myScore = war.is_my_crew_attacker ? war.attacker_score : war.defender_score;
  const enemyScore = war.is_my_crew_attacker ? war.defender_score : war.attacker_score;
  const enemyName = war.is_my_crew_attacker ? war.defender_name : war.attacker_name;
  const enemyTag  = war.is_my_crew_attacker ? war.defender_tag  : war.attacker_tag;
  const remainingMs = new Date(war.ends_at).getTime() - now;
  const days = Math.max(0, Math.floor(remainingMs / 86400000));
  const hours = Math.max(0, Math.floor((remainingMs % 86400000) / 3600000));
  const leading = myScore >= enemyScore;

  return (
    <div style={{
      borderRadius: 12,
      background: "rgba(20,22,28,0.85)",
      border: `1px solid ${leading ? PRIMARY : ACCENT}44`,
      padding: 14,
      boxShadow: leading ? `0 0 16px ${PRIMARY}22` : `0 0 16px ${ACCENT}22`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ padding: "3px 7px", borderRadius: 6, background: `${ACCENT}22`, color: ACCENT, fontSize: 10, fontWeight: 900 }}>
            {enemyTag}
          </span>
          <span style={{ color: "#FFF", fontWeight: 800, fontSize: 13 }}>{enemyName}</span>
        </div>
        <span style={{ color: "#8B8FA3", fontSize: 10, fontWeight: 700 }}>
          {war.is_my_crew_attacker ? "wir greifen an" : "wir verteidigen"}
        </span>
      </div>

      {/* Score-Balken */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ color: leading ? PRIMARY : "#8B8FA3", fontSize: 18, fontWeight: 900, fontFamily: "var(--font-display-stack)", minWidth: 36, textAlign: "right" }}>{myScore}</span>
        <div style={{ flex: 1, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden", position: "relative" }}>
          {(() => {
            const total = Math.max(1, myScore + enemyScore);
            const myPct = (myScore / total) * 100;
            return (
              <>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${myPct}%`, background: PRIMARY }} />
                <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: `${100 - myPct}%`, background: ACCENT, opacity: 0.6 }} />
              </>
            );
          })()}
        </div>
        <span style={{ color: leading ? "#8B8FA3" : ACCENT, fontSize: 18, fontWeight: 900, fontFamily: "var(--font-display-stack)", minWidth: 36 }}>{enemyScore}</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", color: "#8B8FA3", fontSize: 10 }}>
        <span>noch {days}d {hours}h</span>
        <span>+100 für Repeater zerstört · +50 verteidigt · +25 getroffen</span>
      </div>
    </div>
  );
}

function HistoryWarCard({ h }: { h: WarHistory }) {
  const oppName = h.is_my_crew_attacker ? h.defender_name : h.attacker_name;
  const myScore = h.is_my_crew_attacker ? h.attacker_score : h.defender_score;
  const oppScore = h.is_my_crew_attacker ? h.defender_score : h.attacker_score;
  const tie = h.winner_crew_id === null;
  return (
    <div style={{
      padding: "8px 12px", borderRadius: 8,
      background: "rgba(255,255,255,0.03)",
      border: `1px solid ${h.is_winner ? PRIMARY : tie ? "#666" : ACCENT}33`,
      display: "flex", justifyContent: "space-between", alignItems: "center",
      fontSize: 12,
    }}>
      <div>
        <div style={{ color: "#FFF", fontWeight: 700 }}>vs {oppName}</div>
        <div style={{ color: "#8B8FA3", fontSize: 10 }}>
          {h.ended_at ? new Date(h.ended_at).toLocaleDateString("de-DE") : "—"}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ color: h.is_winner ? PRIMARY : tie ? GOLD : ACCENT, fontWeight: 800, fontSize: 11 }}>
          {h.is_winner ? "✓ Sieg" : tie ? "Unentschieden" : "✗ Niederlage"}
        </div>
        <div style={{ color: "#FFF", fontSize: 11 }}>{myScore} : {oppScore}</div>
      </div>
    </div>
  );
}

function DeclareWarPanel({ targets, onDeclare, busy, error }: {
  targets: WarTarget[];
  onDeclare: (crewId: string, days: number) => void;
  busy: boolean;
  error: string | null;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [days, setDays] = useState<3 | 7 | 14>(7);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {targets.length === 0 && (
        <div style={{ padding: 20, textAlign: "center", color: "#8B8FA3", fontSize: 12 }}>
          Keine Anrainer-Crews — du brauchst angrenzende Crew-Repeater um Krieg zu erklären.
        </div>
      )}
      {targets.map((t) => (
        <button
          key={t.crew_id}
          onClick={() => !t.has_active_war && setSelected(t.crew_id)}
          disabled={t.has_active_war}
          style={{
            padding: 12, borderRadius: 10, textAlign: "left",
            background: selected === t.crew_id ? `${ACCENT}22` : "rgba(255,255,255,0.04)",
            border: selected === t.crew_id ? `1px solid ${ACCENT}` : "1px solid rgba(255,255,255,0.08)",
            color: "#FFF", cursor: t.has_active_war ? "not-allowed" : "pointer",
            opacity: t.has_active_war ? 0.5 : 1,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}
        >
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <span style={{
              width: 14, height: 14, borderRadius: 7, background: t.territory_color,
              border: "1px solid rgba(255,255,255,0.3)",
            }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 13 }}>
                <span style={{ color: ACCENT, marginRight: 6 }}>{t.tag}</span>
                {t.name}
              </div>
              <div style={{ color: "#8B8FA3", fontSize: 10 }}>{t.repeater_count} Anrainer-Repeater</div>
            </div>
          </div>
          {t.has_active_war && (
            <span style={{ padding: "3px 8px", borderRadius: 6, background: `${GOLD}33`, color: GOLD, fontSize: 9, fontWeight: 900 }}>
              KRIEG LÄUFT
            </span>
          )}
        </button>
      ))}

      {selected && (
        <div style={{ padding: 12, borderRadius: 10, background: `${ACCENT}10`, border: `1px solid ${ACCENT}33` }}>
          <div style={{ color: "#FFF", fontSize: 11, fontWeight: 800, marginBottom: 8 }}>Dauer wählen:</div>
          <div style={{ display: "flex", gap: 6 }}>
            {[3, 7, 14].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d as 3 | 7 | 14)}
                style={{
                  flex: 1, padding: "8px 10px", borderRadius: 8,
                  background: days === d ? `${ACCENT}33` : "rgba(255,255,255,0.04)",
                  border: days === d ? `1px solid ${ACCENT}` : "1px solid rgba(255,255,255,0.1)",
                  color: "#FFF", fontSize: 11, fontWeight: 800, cursor: "pointer",
                }}
              >
                {d} Tage
              </button>
            ))}
          </div>
          <button
            onClick={() => onDeclare(selected, days)}
            disabled={busy}
            style={{
              marginTop: 10, width: "100%", padding: "10px 14px", borderRadius: 10,
              background: `linear-gradient(135deg, ${ACCENT}, #c41a5e)`,
              border: "none", color: "#FFF", fontWeight: 900, fontSize: 12, letterSpacing: 0.5,
              fontFamily: "var(--font-display-stack)",
              cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1,
              boxShadow: `0 4px 12px ${ACCENT}55`,
            }}
          >
            {busy ? "..." : "⚔ KRIEG ERKLÄREN"}
          </button>
          {error && <div style={{ marginTop: 6, color: ACCENT, fontSize: 11, textAlign: "center" }}>{error}</div>}
        </div>
      )}
    </div>
  );
}
