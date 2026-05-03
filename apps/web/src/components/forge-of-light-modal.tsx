"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const GOLD = "#FFD700";
const PRIMARY = "#22D1C3";
const PINK = "#FF2D78";
const TEXT_SOFT = "#a8b4cf";
const MUTED = "#8B8FA3";
const BORDER = "rgba(255,255,255,0.08)";

const RARITY_COLOR: Record<string, string> = {
  common:    "#a8b4cf",
  rare:      "#5ddaf0",
  epic:      "#a855f7",
  legendary: "#FFD700",
};

type Featured = { id: string; name: string; emoji: string; rarity: string };
type Event = {
  id: string; name: string; starts_at: string; ends_at: string;
  pull_cost_gems: number; pity_epic: number; pity_legendary: number;
  featured_artifacts: Featured[];
};
type State = { pulls_used: number; pity_epic_counter: number; pity_legendary_counter: number; featured_pulls: number };
type HistEntry = { artifact_id: string; artifact_name: string; rarity: string; is_featured: boolean; pulled_at: string };
type Pull = { artifact_id: string; artifact_name: string; emoji: string; rarity: string; is_featured: boolean };

export function ForgeOfLightModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("ForgeOfLight");
  const [event, setEvent] = useState<Event | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [history, setHistory] = useState<HistEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Pull[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/runner/forge");
    if (!r.ok) return;
    const j = await r.json() as { event: Event | null; state: State | null; history: HistEntry[] };
    setEvent(j.event); setState(j.state); setHistory(j.history);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function pull(count: 1 | 10) {
    if (!event || busy) return;
    setBusy(true); setError(null); setResults(null);
    try {
      const r = await fetch("/api/runner/forge", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: event.id, count }),
      });
      const j = await r.json().catch(() => null) as { ok?: boolean; pulls?: Pull[]; error?: string } | null;
      if (j?.ok && j.pulls) { setResults(j.pulls); await load(); }
      else setError(j?.error ?? t("error"));
    } finally { setBusy(false); }
  }

  const daysLeft = event ? Math.max(0, Math.ceil((new Date(event.ends_at).getTime() - Date.now()) / 86400000)) : 0;
  const pityEpicLeft = event && state ? event.pity_epic - state.pity_epic_counter : 0;
  const pityLegendaryLeft = event && state ? event.pity_legendary - state.pity_legendary_counter : 0;

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 9100,
      background: "rgba(0,0,0,0.78)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 12,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 520, maxHeight: "92vh",
        display: "flex", flexDirection: "column",
        background: `linear-gradient(180deg, ${PRIMARY}1a 0%, #141a2d 60%)`,
        borderRadius: 18, border: `2px solid ${PRIMARY}66`,
        color: "#F0F0F0", overflow: "hidden",
      }}>
        <div style={{ padding: "16px 18px 8px", display: "flex", justifyContent: "space-between" }}>
          <div>
            <div style={{ color: PRIMARY, fontSize: 9, fontWeight: 900, letterSpacing: 2 }}>{t("kicker")}</div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>{event?.name ?? t("noEvent")}</div>
            {event && <div style={{ color: TEXT_SOFT, fontSize: 11, marginTop: 2 }}>⏳ {t("daysLeft", { n: daysLeft })}</div>}
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 16, background: "rgba(0,0,0,0.55)", border: "none",
            color: "#FFF", fontSize: 18, fontWeight: 900, cursor: "pointer",
          }}>×</button>
        </div>

        {!event ? (
          <div style={{ padding: 30, textAlign: "center", color: TEXT_SOFT }}>{t("noEventBody")}</div>
        ) : (
          <div style={{ flex: 1, overflowY: "auto", padding: "0 14px 14px" }}>
            {/* Featured */}
            <div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: `${GOLD}11`, border: `1px solid ${GOLD}55` }}>
              <div style={{ color: GOLD, fontSize: 9, fontWeight: 900, letterSpacing: 1.5 }}>{t("featured")}</div>
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                {event.featured_artifacts.map((f) => (
                  <div key={f.id} style={{
                    flex: 1, padding: 10, borderRadius: 10,
                    background: `${RARITY_COLOR[f.rarity]}22`, border: `1px solid ${RARITY_COLOR[f.rarity]}`,
                    textAlign: "center",
                  }}>
                    <div style={{ fontSize: 32 }}>{f.emoji}</div>
                    <div style={{ color: "#FFF", fontSize: 11, fontWeight: 800, marginTop: 4 }}>{f.name}</div>
                  </div>
                ))}
              </div>
              <div style={{ color: TEXT_SOFT, fontSize: 10, marginTop: 8, textAlign: "center" }}>
                {t("featuredHint")}
              </div>
            </div>

            {/* Pity Counter */}
            {state && (
              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <PityCard label={t("pityEpic")} value={pityEpicLeft} max={event.pity_epic} color={RARITY_COLOR.epic} />
                <PityCard label={t("pityLegendary")} value={pityLegendaryLeft} max={event.pity_legendary} color={GOLD} />
              </div>
            )}

            {/* Pull Buttons */}
            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button onClick={() => pull(1)} disabled={busy} style={{
                padding: 14, borderRadius: 10, border: "none",
                background: `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY}aa)`,
                color: "#0F1115", fontSize: 12, fontWeight: 900, cursor: busy ? "wait" : "pointer",
              }}>{busy ? "…" : t("pullOne", { gems: event.pull_cost_gems })}</button>
              <button onClick={() => pull(10)} disabled={busy} style={{
                padding: 14, borderRadius: 10, border: "none",
                background: `linear-gradient(135deg, ${GOLD}, #FF9E2C)`,
                color: "#0F1115", fontSize: 12, fontWeight: 900, cursor: busy ? "wait" : "pointer",
              }}>{busy ? "…" : t("pullTen", { gems: event.pull_cost_gems * 10 })}</button>
            </div>

            {error && <div style={{ marginTop: 8, color: PINK, fontSize: 11 }}>{error}</div>}

            {/* Results */}
            {results && results.length > 0 && (
              <div style={{ marginTop: 14, padding: 10, background: "rgba(0,0,0,0.4)", borderRadius: 10 }}>
                <div style={{ color: GOLD, fontSize: 9, fontWeight: 900, letterSpacing: 1.5, marginBottom: 8 }}>{t("results")}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))", gap: 6 }}>
                  {results.map((p, i) => (
                    <div key={i} title={p.artifact_name} style={{
                      aspectRatio: "1", padding: 4,
                      background: `${RARITY_COLOR[p.rarity]}22`,
                      border: `1.5px solid ${RARITY_COLOR[p.rarity]}`,
                      borderRadius: 8,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      position: "relative",
                    }}>
                      <span style={{ fontSize: 28 }}>{p.emoji}</span>
                      {p.is_featured && (
                        <div style={{ position: "absolute", top: -4, right: -4, fontSize: 12 }}>⭐</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* History */}
            {history.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ color: TEXT_SOFT, fontSize: 9, fontWeight: 900, letterSpacing: 1.2, marginBottom: 6 }}>{t("history")}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {history.slice(0, 12).map((h, i) => (
                    <div key={i} style={{
                      padding: "4px 8px", borderRadius: 6,
                      background: `${RARITY_COLOR[h.rarity]}22`,
                      border: `1px solid ${RARITY_COLOR[h.rarity]}`,
                      color: RARITY_COLOR[h.rarity],
                      fontSize: 10, fontWeight: 700,
                    }}>
                      {h.artifact_name}{h.is_featured ? " ⭐" : ""}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PityCard({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div style={{
      padding: "8px 10px", borderRadius: 8, background: "rgba(0,0,0,0.4)",
      border: `1px solid ${color}55`,
    }}>
      <div style={{ color, fontSize: 9, fontWeight: 900, letterSpacing: 1 }}>{label}</div>
      <div style={{ color: "#FFF", fontSize: 13, fontWeight: 900 }}>{value} / {max}</div>
    </div>
  );
}
