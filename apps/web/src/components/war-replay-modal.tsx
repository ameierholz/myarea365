"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Modal, ModalHeader, ModalBody, Z } from "@/components/ui";

const PRIMARY = "#22D1C3";
const ACCENT  = "#FF2D78";
const GOLD    = "#FFD700";
const MUTED   = "#8B8FA3";

type WarEvent = {
  id: string;
  recorded_at: string;
  event_type: string;
  actor_user_id: string | null;
  attacker_crew: string | null;
  outcome: string | null;
  points_attacker: number;
  points_defender: number;
  payload: { repeater_name?: string | null; [k: string]: unknown } | null;
};

type WarHeader = {
  id: string;
  attacker_crew: string; defender_crew: string;
  attacker_score: number; defender_score: number;
  declared_at: string; ends_at: string; ended_at: string | null;
  status: string; winner_crew: string | null;
  is_my_crew_attacker: boolean;
};

const EVENT_LABELS: Record<string, { icon: string; text: string }> = {
  repeater_destroyed: { icon: "💥", text: "Sender zerstört" },
  repeater_defended:  { icon: "🛡", text: "Sender verteidigt" },
  manual:             { icon: "⭐", text: "Manueller Punkt" },
  siege:              { icon: "⚔", text: "Belagerung" },
};

export function WarReplayModal({ warId, onClose }: { warId: string; onClose: () => void }) {
  const [war, setWar] = useState<WarHeader | null>(null);
  const [events, setEvents] = useState<WarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const sb = createClient();
      const { data, error } = await sb.rpc("get_war_events", { p_war_id: warId });
      if (cancel) return;
      if (error) { setErr(error.message); setLoading(false); return; }
      const r = data as { ok?: boolean; error?: string; war?: WarHeader; events?: WarEvent[] } | null;
      if (!r?.ok) { setErr(r?.error ?? "load_failed"); setLoading(false); return; }
      setWar(r.war ?? null);
      setEvents(r.events ?? []);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [warId]);

  const tie = war?.winner_crew == null && war?.status === "ended";
  const isWinner = war ? (war.winner_crew != null && (
    (war.is_my_crew_attacker && war.winner_crew === war.attacker_crew) ||
    (!war.is_my_crew_attacker && war.winner_crew === war.defender_crew)
  )) : false;
  const headerColor = war?.status === "active" ? PRIMARY : isWinner ? PRIMARY : tie ? GOLD : ACCENT;

  return (
    <Modal open={true} onClose={onClose} size="md" zIndex={Z.modalDeep}>
      <ModalHeader title="Battle-Replay" onClose={onClose} accent={isWinner ? "primary" : "accent"} />
      <ModalBody padding="padded">
        {loading && <div style={{ padding: 24, textAlign: "center", color: MUTED }}>Lade Events …</div>}
        {!loading && err && (
          <div style={{ padding: 16, color: ACCENT, fontSize: 12, fontWeight: 700 }}>{err}</div>
        )}
        {!loading && !err && war && (
          <>
            {/* Score-Kopf */}
            <div style={{
              borderRadius: 12, padding: "12px 14px",
              background: "rgba(20,22,28,0.85)",
              border: `1px solid ${headerColor}44`,
              marginBottom: 12,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: MUTED, fontWeight: 700 }}>
                  {war.status === "active" ? "Laufend" : isWinner ? "Sieg" : tie ? "Unentschieden" : "Niederlage"}
                </span>
                <span style={{ fontSize: 10, color: MUTED }}>
                  {new Date(war.declared_at).toLocaleDateString("de-DE")}
                  {war.ended_at ? ` – ${new Date(war.ended_at).toLocaleDateString("de-DE")}` : ""}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: war.is_my_crew_attacker ? PRIMARY : ACCENT, fontSize: 22, fontWeight: 900, minWidth: 44, textAlign: "right" }}>
                  {war.attacker_score}
                </span>
                <div style={{ flex: 1, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden", position: "relative" }}>
                  {(() => {
                    const total = Math.max(1, war.attacker_score + war.defender_score);
                    const aPct = (war.attacker_score / total) * 100;
                    return (
                      <>
                        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${aPct}%`, background: PRIMARY }} />
                        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: `${100 - aPct}%`, background: ACCENT, opacity: 0.6 }} />
                      </>
                    );
                  })()}
                </div>
                <span style={{ color: !war.is_my_crew_attacker ? PRIMARY : ACCENT, fontSize: 22, fontWeight: 900, minWidth: 44 }}>
                  {war.defender_score}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 9, color: MUTED }}>
                <span>{war.is_my_crew_attacker ? "Wir (angreifend)" : "Gegner"}</span>
                <span>{!war.is_my_crew_attacker ? "Wir (verteidigend)" : "Gegner"}</span>
              </div>
            </div>

            {/* Event-Timeline */}
            <div style={{ fontSize: 10, color: MUTED, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
              Ereignisse ({events.length})
            </div>
            {events.length === 0 && (
              <div style={{
                padding: 16, borderRadius: 10, textAlign: "center",
                background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.10)",
                color: MUTED, fontSize: 11,
              }}>
                Noch keine geloggten Ereignisse für diesen Krieg.
                <br />
                <span style={{ fontSize: 10 }}>Repeater-Hits und -Verteidigungen werden ab jetzt einzeln dokumentiert.</span>
              </div>
            )}
            {events.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {events.map((e) => {
                  const meta = EVENT_LABELS[e.event_type] ?? { icon: "•", text: e.event_type };
                  const isAttackerEvent = (e.points_attacker ?? 0) > (e.points_defender ?? 0);
                  const myPoints = war.is_my_crew_attacker ? e.points_attacker : e.points_defender;
                  const oppPoints = war.is_my_crew_attacker ? e.points_defender : e.points_attacker;
                  const myGain = myPoints >= oppPoints;
                  const repeaterName = (e.payload?.repeater_name as string | undefined) ?? null;
                  return (
                    <div key={e.id} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "8px 10px", borderRadius: 8,
                      background: "rgba(255,255,255,0.03)",
                      border: `1px solid ${myGain ? PRIMARY : ACCENT}22`,
                    }}>
                      <span style={{ fontSize: 16 }}>{meta.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "#FFF" }}>
                          {meta.text}
                          {repeaterName && <span style={{ color: MUTED, fontWeight: 600 }}> · {repeaterName}</span>}
                        </div>
                        <div style={{ fontSize: 9, color: MUTED }}>
                          {new Date(e.recorded_at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        {myPoints > 0 && (
                          <div style={{ color: PRIMARY, fontWeight: 900, fontSize: 12 }}>+{myPoints}</div>
                        )}
                        {oppPoints > 0 && (
                          <div style={{ color: ACCENT, fontWeight: 800, fontSize: 10 }}>Gegner +{oppPoints}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </ModalBody>
    </Modal>
  );
}
