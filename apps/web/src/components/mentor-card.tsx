"use client";

import { useEffect, useState } from "react";

const ACCENT = "#A855F7";
const TEXT = "#F0F0F0";
const MUTED = "#8B8FA3";

type MentorRel = {
  rel_id: string;
  mentor_user_id?: string;
  mentor_name?: string | null;
  mentee_user_id?: string;
  mentee_name?: string | null;
  started_at: string;
  graduates_at: string;
  walks_together: number;
  total_bonus_coins: number;
};
type MentorStatus = {
  ok: boolean;
  my_mentor: MentorRel | null;
  my_mentees: MentorRel[];
};

function daysLeft(graduatesAt: string): number {
  const ms = new Date(graduatesAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 3600000)));
}

/**
 * Mentor-Karte: zeigt deinen Mentor + deine Mentees.
 * Bietet Adoption via User-ID-Eingabe (vereinfachte v1, später Such-UI).
 */
export function MentorCard() {
  const [s, setS] = useState<MentorStatus | null>(null);
  const [adopting, setAdopting] = useState(false);
  const [menteeId, setMenteeId] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    try {
      const r = await fetch("/api/mentor/status", { cache: "no-store" });
      if (!r.ok) return;
      setS(await r.json() as MentorStatus);
    } catch { /* ignore */ }
  };

  useEffect(() => { void load(); }, []);

  const adopt = async () => {
    if (!menteeId.trim()) return;
    setAdopting(true);
    try {
      const r = await fetch("/api/mentor/adopt", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mentee_user_id: menteeId.trim() }),
      });
      const j = await r.json() as { ok?: boolean; error?: string; message?: string };
      setToast(j.ok ? "Mentee adoptiert!" : (j.message ?? j.error ?? "Fehler"));
      if (j.ok) { setMenteeId(""); await load(); }
      setTimeout(() => setToast(null), 3500);
    } finally { setAdopting(false); }
  };

  if (!s?.ok) return null;

  return (
    <div style={{
      borderRadius: 14,
      background: `linear-gradient(135deg, ${ACCENT}1f, transparent 70%), rgba(15,17,21,0.85)`,
      border: `1px solid ${ACCENT}55`,
      padding: "14px 16px",
      display: "flex", flexDirection: "column", gap: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 22 }}>🎓</span>
        <div style={{ color: TEXT, fontSize: 14, fontWeight: 800 }}>Mentor-Programm</div>
      </div>

      {/* Mein Mentor */}
      {s.my_mentor && (
        <div style={{
          padding: 10, borderRadius: 10,
          background: "rgba(168,85,247,0.08)",
          border: "1px solid rgba(168,85,247,0.25)",
        }}>
          <div style={{ color: ACCENT, fontSize: 11, fontWeight: 800, letterSpacing: 1, marginBottom: 4 }}>
            DEIN MENTOR
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <span style={{ color: TEXT, fontSize: 14, fontWeight: 800 }}>{s.my_mentor.mentor_name ?? "—"}</span>
            <span style={{ color: MUTED, fontSize: 11 }}>
              · {s.my_mentor.walks_together} gemeinsame Walks · {daysLeft(s.my_mentor.graduates_at)}d übrig
            </span>
          </div>
        </div>
      )}

      {/* Meine Mentees */}
      {(s.my_mentees?.length ?? 0) > 0 && (
        <div style={{
          padding: 10, borderRadius: 10,
          background: "rgba(168,85,247,0.05)",
          border: "1px solid rgba(168,85,247,0.2)",
          display: "flex", flexDirection: "column", gap: 6,
        }}>
          <div style={{ color: ACCENT, fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>
            DEINE MENTEES ({s.my_mentees.length}/3)
          </div>
          {s.my_mentees.map((m) => (
            <div key={m.rel_id} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 12, flexWrap: "wrap" }}>
              <span style={{ color: TEXT, fontWeight: 800 }}>{m.mentee_name ?? "—"}</span>
              <span style={{ color: MUTED }}>
                · {m.walks_together} Walks · {m.total_bonus_coins} 🪙 Bonus · {daysLeft(m.graduates_at)}d übrig
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Mentee adoptieren — nur sichtbar wenn noch Slots frei */}
      {(s.my_mentees?.length ?? 0) < 3 && (
        <div style={{ display: "flex", gap: 6 }}>
          <input
            value={menteeId}
            onChange={(e) => setMenteeId(e.target.value)}
            placeholder="Mentee User-ID einfügen…"
            style={{
              flex: 1, minWidth: 0,
              background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8, padding: "8px 10px", color: TEXT, fontSize: 12,
              outline: "none",
            }}
          />
          <button
            onClick={adopt}
            disabled={adopting || !menteeId.trim()}
            style={{
              padding: "8px 14px", borderRadius: 8, border: "none",
              background: ACCENT, color: "#FFF", fontSize: 12, fontWeight: 800,
              cursor: adopting ? "wait" : "pointer", opacity: adopting ? 0.6 : 1, flexShrink: 0,
            }}
          >Adoptieren</button>
        </div>
      )}

      <div style={{ color: MUTED, fontSize: 11, lineHeight: 1.5 }}>
        Pro Walk deines Mentees bekommt ihr beide +50 🪙. Beziehung läuft 30 Tage,
        danach +500 🪙 für den Mentor.
      </div>

      {toast && (
        <div style={{
          padding: "6px 10px", borderRadius: 8,
          background: "rgba(34,209,195,0.12)", border: "1px solid rgba(34,209,195,0.4)",
          color: "#22D1C3", fontSize: 12, fontWeight: 700, textAlign: "center",
        }}>{toast}</div>
      )}
    </div>
  );
}
