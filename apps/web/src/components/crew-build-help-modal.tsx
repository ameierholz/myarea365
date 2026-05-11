"use client";

import { useEffect, useState, useCallback } from "react";

type CrewBuild = {
  queue_id: string;
  building_id: string;
  building_name: string;
  target_level: number;
  ends_at: string;
  original_duration_sec: number | null;
  owner_id: string;
  owner_name: string | null;
  helps_total: number;
  i_helped_recently: boolean;
};

const GREEN = "#22c55e";
const GOLD  = "#FFD700";
const ACCENT = "#22D1C3";
const PINK = "#FF2D78";
const TEXT = "#F0F0F0";
const MUTED = "#8B8FA3";
const MODAL_BG = "linear-gradient(180deg, #1A1D23 0%, #0F1115 100%)";

function fmtRemaining(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return "Fertig";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m - h * 60}m`;
}

export function CrewBuildHelpModal({ onClose }: { onClose: () => void }) {
  const [builds, setBuilds] = useState<CrewBuild[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [_now, setNow] = useState<number>(() => Date.now());

  const reload = useCallback(async () => {
    setErr(null);
    const r = await fetch("/api/base/crew-build-help", { cache: "no-store" });
    if (!r.ok) {
      setErr("Konnte Crew-Bauten nicht laden.");
      setBuilds([]);
      return;
    }
    const j = await r.json() as { builds: CrewBuild[] };
    setBuilds(j.builds);
  }, []);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  const help = async (queue_id: string) => {
    setBusy(queue_id);
    setErr(null);
    try {
      const r = await fetch("/api/base/crew-build-help", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ queue_id }),
      });
      const j = await r.json() as { ok?: boolean; error?: string; speedup_ms?: number };
      if (!r.ok || !j.ok) {
        const errMap: Record<string, string> = {
          not_in_same_crew: "Nicht in derselben Crew.",
          helper_cooldown: "Du musst 5 Minuten warten bevor du diesem Bau erneut hilfst.",
          max_helps_reached: "Dieser Bau hat das Helfer-Maximum erreicht.",
          cannot_help_self: "Du kannst dir nicht selbst helfen.",
          queue_not_found_or_finished: "Bau bereits fertig oder nicht gefunden.",
        };
        setErr(errMap[j.error ?? ""] ?? `Fehler: ${j.error}`);
      } else {
        await reload();
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)",
      zIndex: 9500,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 12,
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "min(560px, 100%)", maxHeight: "85dvh",
        background: MODAL_BG, borderRadius: 14,
        border: `1px solid ${ACCENT}33`,
        boxShadow: `0 10px 40px rgba(0,0,0,0.6), 0 0 30px ${ACCENT}22`,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "12px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", gap: 10,
          background: `linear-gradient(180deg, ${ACCENT}11, transparent)`,
        }}>
          <div style={{ fontSize: 22 }}>🤝</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: TEXT, letterSpacing: 0.3 }}>
              Crew helfen
            </div>
            <div style={{ fontSize: 10, color: MUTED }}>
              Klicke auf einen Bau deiner Crew — 1% Restzeit pro Help
            </div>
          </div>
          <button onClick={onClose} style={{
            border: "none", background: "rgba(255,255,255,0.08)",
            color: TEXT, fontSize: 14, fontWeight: 900,
            padding: "6px 12px", borderRadius: 8, cursor: "pointer",
          }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px", scrollbarWidth: "none" }}>
          {err && (
            <div style={{
              padding: "8px 10px", marginBottom: 8,
              background: `${PINK}22`, color: PINK,
              borderRadius: 8, fontSize: 12, fontWeight: 700,
            }}>⚠ {err}</div>
          )}

          {builds === null && (
            <div style={{ padding: "30px 0", textAlign: "center", color: MUTED, fontSize: 12 }}>
              Lade…
            </div>
          )}

          {builds !== null && builds.length === 0 && (
            <div style={{
              padding: "30px 12px", textAlign: "center",
              color: MUTED, fontSize: 12, lineHeight: 1.5,
            }}>
              <div style={{ fontSize: 28, marginBottom: 6, opacity: 0.5 }}>💤</div>
              Aktuell baut niemand in deiner Crew.<br />
              <span style={{ fontSize: 10 }}>Komm später wieder oder finde eine aktivere Crew.</span>
            </div>
          )}

          {builds !== null && builds.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {builds.map((b) => {
                const isBusy = busy === b.queue_id;
                const cantHelp = b.i_helped_recently || b.helps_total >= 30;
                const helpPct = Math.round((b.helps_total / 30) * 100);
                return (
                  <div key={b.queue_id} style={{
                    padding: "8px 10px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 10,
                    display: "flex", flexDirection: "column", gap: 6,
                  }}>
                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 12, fontWeight: 900, color: TEXT,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {b.building_name} <span style={{ color: ACCENT }}>Lv {b.target_level}</span>
                        </div>
                        <div style={{ fontSize: 10, color: MUTED }}>
                          {b.owner_name ?? "Unbekannt"} · ⏱ {fmtRemaining(b.ends_at)}
                        </div>
                      </div>
                      <button
                        onClick={() => help(b.queue_id)}
                        disabled={isBusy || cantHelp}
                        style={{
                          padding: "6px 12px",
                          background: cantHelp
                            ? "rgba(255,255,255,0.06)"
                            : `linear-gradient(135deg, ${GREEN}, ${ACCENT})`,
                          color: cantHelp ? MUTED : "#0F1115",
                          border: "none", borderRadius: 8,
                          fontSize: 11, fontWeight: 900,
                          cursor: cantHelp ? "default" : isBusy ? "wait" : "pointer",
                          letterSpacing: 0.3,
                          boxShadow: cantHelp ? "none" : `0 0 10px ${GREEN}55`,
                          minWidth: 80,
                        }}
                      >
                        {b.i_helped_recently ? "⏳ COOLDOWN" : b.helps_total >= 30 ? "VOLL" : "🤝 HELFEN"}
                      </button>
                    </div>

                    {/* Help-Progress */}
                    <div>
                      <div style={{
                        display: "flex", justifyContent: "space-between",
                        fontSize: 9, fontWeight: 800, color: MUTED, marginBottom: 2,
                      }}>
                        <span>{b.helps_total}/30 Hilfen</span>
                        <span style={{ color: b.helps_total > 0 ? GOLD : MUTED }}>
                          −{b.helps_total}% Restzeit
                        </span>
                      </div>
                      <div style={{
                        height: 4, borderRadius: 2,
                        background: "rgba(255,255,255,0.06)",
                        overflow: "hidden",
                      }}>
                        <div style={{
                          width: `${helpPct}%`, height: "100%",
                          background: `linear-gradient(90deg, ${GREEN}, ${GOLD})`,
                          transition: "width 250ms ease",
                        }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
