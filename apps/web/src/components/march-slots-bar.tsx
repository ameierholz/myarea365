"use client";

/**
 * MarchSlotsBar — RoK/CoD-Style Marsch-Slot-Indikator rechts am Rand.
 *
 * Zeigt NUR belegte Slots — leere kosten Platz ohne Mehrwert. Klick auf den
 * Wächter-Avatar zentriert die Map auf das Marsch-Ziel (Fly-To). Direkt unter
 * den Slots sitzt ein dedizierter Trigger zum Öffnen der Verwaltung (Drawer
 * von rechts).
 *
 * Layout pro Slot (vertikal):
 *
 *   ┌──────┐ F1
 *   │ ICON │  ← runder Glas-Kreis mit Wächter-Artwork
 *   └──────┘
 *    01:26    ← Countdown
 */

import { useEffect, useState } from "react";

export type MarchSlot = {
  id: string;
  /** Was für ein Marsch: bestimmt Farbe + Icon. */
  kind: "gather" | "scout" | "mutant" | "stronghold" | "crew_repeater" | "player_base" | "returning";
  /** Emoji-Fallback für den runden Slot-Avatar. */
  emoji: string;
  /** ISO-Timestamp wann die aktuelle Phase endet (= Countdown-Ziel). */
  ends_at: string;
  /** Optional: Phase-Start für Progress-Berechnung. Wenn null/undefined, wird
      kein Fortschrittsbalken gezeigt. */
  started_at?: string | null;
  /** Optional: Ziel-Koordinaten — für Click-to-Fly. */
  target_lat?: number | null;
  target_lng?: number | null;
  /** Optional: Avatar-URL für runden Marker (Wächter-Artwork bevorzugt). */
  avatar_url?: string | null;
  /** Optional: Video-URL (für animierte Wächter-Artworks). */
  avatar_video_url?: string | null;
  /** Optional: Wächter-ID — wenn gesetzt, navigiert ein Klick zum Wächter-Detail. */
  guardian_id?: string | null;
  /** Optional: Rally-ID — wenn gesetzt (UUID), kann ein Marsch-Boost-Item
      angewendet werden. Wird nur für marching Mutant/Stronghold-Rallies gesetzt. */
  boost_rally_id?: string | null;
  /** Optional: Anführer-Name (z.B. "Kaelthor"). */
  leader_name?: string | null;
  /** Optional: Gesamt-Angriffskraft des Marsches. */
  power?: number | null;
  /** Optional: Ziel-Beschreibung (z.B. "Tech-Schrott · Lv 4" oder "Wegelager Lv 5"). */
  target_label?: string | null;
};

const SLOT_COLOR: Record<MarchSlot["kind"], string> = {
  gather: "#5DDAF0",          // Cyan — Sammeln
  scout: "#a855f7",           // Lila — Spionage
  mutant: "#FF2D78",          // Magenta — PvE-Boss
  stronghold: "#FFD700",      // Gold — Wegelager
  crew_repeater: "#FF6B4A",   // Orange — Crew-Funk
  player_base: "#FF3344",     // Rot — PvP
  returning: "#22D1C3",       // Teal — Rückweg (Speed-Boost)
};

function fmtCountdown(ms: number): string {
  if (ms <= 0) return "00:00";
  const s = Math.floor(ms / 1000);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (hh > 0) return `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export function MarchSlotsBar({
  slots,
  maxSlots = 5,
  onSlotClick,
  onOpenManagement,
}: {
  slots: MarchSlot[];
  maxSlots?: number;
  onSlotClick?: (slot: MarchSlot) => void;
  /** Wird vom Trigger-Button unter den Slots gefeuert. Öffnet den Verwaltungs-Drawer. */
  onOpenManagement?: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  // Nur belegte Slots zeigen — leere Slots würden Platz wegnehmen ohne Mehrwert.
  // User sieht durch die Anzahl an Cards direkt wie viele Slots noch frei sind.
  const slotArray = slots.slice(0, maxSlots);
  if (slotArray.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        right: 4,
        top: 110, // unter dem HUD-Header
        zIndex: 30,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 8,
        pointerEvents: "none",
      }}
    >
      {slotArray.map((s, idx) => {
        const fKey = `F${idx + 1}`;
        const color = SLOT_COLOR[s.kind];
        const ends = new Date(s.ends_at).getTime();
        const remainMs = Math.max(0, ends - now);

        return (
          <button
            key={s.id}
            onClick={() => onSlotClick?.(s)}
            aria-label={`Marsch ${idx + 1} — ${fmtCountdown(remainMs)} verbleibend, zentrieren`}
            title="Auf Ziel zentrieren"
            style={{
              pointerEvents: "auto",
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              padding: 0,
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
            }}>
              <div
                style={{
                  width: 52, height: 52, borderRadius: "50%",
                  background: "rgba(15,17,21,0.7)",
                  border: `2px solid ${color}`,
                  boxShadow: `0 0 8px ${color}88, inset 0 0 6px ${color}33`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22, lineHeight: 1, overflow: "hidden",
                  backdropFilter: "blur(4px)",
                  WebkitBackdropFilter: "blur(4px)",
                }}
              >
                {s.avatar_video_url
                  ? <video src={s.avatar_video_url} autoPlay loop muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : s.avatar_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={s.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span>{s.emoji}</span>}
              </div>
              <div
                style={{
                  padding: "1px 5px", borderRadius: 999,
                  background: "rgba(15,17,21,0.85)",
                  border: `1px solid ${color}88`,
                  color: "#fff", fontSize: 9, fontWeight: 800,
                  fontFamily: "system-ui",
                  letterSpacing: 0.3, lineHeight: 1.1,
                  textShadow: "0 1px 2px rgba(0,0,0,0.8)",
                  minWidth: 44, textAlign: "center", marginTop: -4,
                  fontVariantNumeric: "tabular-nums",
                }}
              >{fmtCountdown(remainMs)}</div>
            </div>
            <div style={{
              padding: "1px 4px", borderRadius: 3,
              background: `${color}33`,
              border: `1px solid ${color}66`,
              color, fontSize: 8, fontWeight: 900,
              fontFamily: "system-ui",
              letterSpacing: 0.4, lineHeight: 1.2,
              alignSelf: "flex-start", marginTop: 4,
            }}>{fKey}</div>
          </button>
        );
      })}

      {/* Trigger-Button: öffnet den Verwaltungs-Drawer. Sitzt unter dem letzten
          Slot, klar als "mehr ansehen / verwalten" lesbar. */}
      {onOpenManagement && (
        <button
          onClick={onOpenManagement}
          aria-label="Legionsverwaltung öffnen"
          title="Legionsverwaltung — alle Märsche im Detail"
          style={{
            pointerEvents: "auto",
            marginRight: 6, marginTop: 2,
            width: 36, height: 36, borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "linear-gradient(180deg, rgba(34,209,195,0.22), rgba(15,17,21,0.85))",
            border: "1px solid rgba(34,209,195,0.55)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.45), inset 0 0 6px rgba(34,209,195,0.25)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            cursor: "pointer", padding: 0,
            color: "#22D1C3", fontSize: 16, fontWeight: 900,
            lineHeight: 1,
          }}
        >
          <span style={{
            display: "inline-flex", flexDirection: "column",
            justifyContent: "center", alignItems: "center", gap: 2,
          }}>
            <span style={{ width: 14, height: 2, background: "#22D1C3", borderRadius: 1 }} />
            <span style={{ width: 14, height: 2, background: "#22D1C3", borderRadius: 1 }} />
            <span style={{ width: 14, height: 2, background: "#22D1C3", borderRadius: 1 }} />
          </span>
        </button>
      )}
    </div>
  );
}
