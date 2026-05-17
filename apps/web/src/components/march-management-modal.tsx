"use client";

/**
 * MarchManagementModal — Legionsverwaltung als Right-Drawer (CoD-Style).
 *
 * Öffnet sich vom rechten Bildschirmrand bis maximal zur Bildschirmmitte
 * (50vw, gedeckelt auf 640px), Backdrop links ist klickbar zum Schliessen.
 *
 * Pro Marsch-Zeile: Rückruf-Button · Wächter-Avatar · Kind-Label + Power +
 * Ziel · Fortschrittsbalken + Countdown · Boost-Button. Klick auf Avatar
 * fliegt die Karte aufs Ziel.
 */

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MarchSlot } from "@/components/march-slots-bar";

const KIND_COLOR: Record<MarchSlot["kind"], string> = {
  gather: "#5DDAF0",
  scout: "#a855f7",
  mutant: "#FF2D78",
  stronghold: "#FFD700",
  crew_repeater: "#FF6B4A",
  player_base: "#FF3344",
  returning: "#22D1C3",
};

const KIND_LABEL: Record<MarchSlot["kind"], string> = {
  gather: "Sammeln",
  scout: "Späher",
  mutant: "Mutant-Angriff",
  stronghold: "Wegelager",
  crew_repeater: "Crew-Funk",
  player_base: "Spieler-Base",
  returning: "Rückweg",
};

const KIND_ICON: Record<MarchSlot["kind"], string> = {
  gather: "⛏",
  scout: "🔭",
  mutant: "👹",
  stronghold: "🏰",
  crew_repeater: "📡",
  player_base: "🏚",
  returning: "🏠",
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

function fmtCoord(lat: number | null | undefined, lng: number | null | undefined): string {
  if (lat == null || lng == null) return "—";
  return `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;
}

// Marsch-Boost-Items: Reihenfolge = Common → Legendary. Catalog-IDs matchen
// die Migration `march_speed_boost_items`.
const BOOST_ITEMS: Array<{ id: string; label: string; mult: number; color: string }> = [
  { id: "speedup_march_50",  label: "+50%",  mult: 1.5, color: "#9ba8c7" },
  { id: "speedup_march_100", label: "+100%", mult: 2.0, color: "#5ddaf0" },
  { id: "speedup_march_250", label: "+250%", mult: 3.5, color: "#a855f7" },
  { id: "speedup_march_500", label: "+500%", mult: 6.0, color: "#FFD700" },
];

export function MarchManagementModal({
  slots,
  maxSlots = 5,
  onClose,
  onSlotClick,
  onRecall,
  onBoostApplied,
}: {
  slots: MarchSlot[];
  maxSlots?: number;
  onClose: () => void;
  onSlotClick?: (slot: MarchSlot) => void;
  onRecall?: (slot: MarchSlot) => void;
  /** Wird sofort nach erfolgreichem Boost gefeuert. Parent patcht den Slot-
      Countdown lokal mit `newMarchEndsAt`, damit der User die kürzere Zeit
      INSTANT sieht — ohne auf refresh/Realtime zu warten. */
  onBoostApplied?: (rallyId: string, newMarchEndsAt: string) => void;
}) {
  const [now, setNow] = useState(Date.now());
  const [pickerForRallyId, setPickerForRallyId] = useState<string | null>(null);
  const [inventoryCounts, setInventoryCounts] = useState<Record<string, number>>({});
  const [busyBoost, setBusyBoost] = useState(false);
  // Slide-In Animation — kurzer Mount-Zustand für CSS transition.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    // Tick auf nächsten Frame, damit transition tatsächlich anläuft.
    const r = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(r);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  // Inventar-Counts laden wenn Picker geöffnet wird
  useEffect(() => {
    if (!pickerForRallyId) return;
    let cancelled = false;
    void (async () => {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await sb.from("user_inventory_items")
        .select("catalog_id, count")
        .eq("user_id", user.id)
        .in("catalog_id", BOOST_ITEMS.map((b) => b.id));
      if (cancelled) return;
      const counts: Record<string, number> = {};
      for (const row of (data ?? []) as Array<{ catalog_id: string; count: number }>) {
        counts[row.catalog_id] = row.count;
      }
      setInventoryCounts(counts);
    })();
    return () => { cancelled = true; };
  }, [pickerForRallyId]);

  const applyBoost = async (rallyId: string, catalogId: string) => {
    if (busyBoost) return;
    const boost = BOOST_ITEMS.find((b) => b.id === catalogId);
    if (!boost) return;
    const targetSlot = slots.find((s) => s.boost_rally_id === rallyId);
    if (!targetSlot) return;

    // OPTIMISTIC: neuen ends_at sofort berechnen + nach oben durchreichen.
    const nowMs = Date.now();
    const currentEnds = new Date(targetSlot.ends_at).getTime();
    const remaining = Math.max(0, currentEnds - nowMs);
    const newRemaining = Math.floor(remaining / boost.mult);
    const newEndsAt = new Date(nowMs + newRemaining).toISOString();

    setBusyBoost(true);
    setPickerForRallyId(null);
    setInventoryCounts((prev) => ({ ...prev, [catalogId]: Math.max(0, (prev[catalogId] ?? 0) - 1) }));
    onBoostApplied?.(rallyId, newEndsAt);

    try {
      const r = await fetch(`/api/rally/${rallyId}/apply-boost`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ catalog_id: catalogId }),
      });
      const j = await r.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!j?.ok) {
        alert(`Boost fehlgeschlagen: ${j?.error ?? "unbekannter Fehler"}`);
        setInventoryCounts((prev) => ({ ...prev, [catalogId]: (prev[catalogId] ?? 0) + 1 }));
      }
    } finally {
      setBusyBoost(false);
    }
  };

  const close = () => {
    setOpen(false);
    setTimeout(onClose, 220);
  };

  return (
    <div
      onClick={close}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9200,
        background: open ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0)",
        transition: "background 220ms ease",
        backdropFilter: open ? "blur(2px)" : "blur(0px)",
        WebkitBackdropFilter: open ? "blur(2px)" : "blur(0px)",
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(50vw, 640px)",
          minWidth: 320,
          height: "100dvh",
          background: "linear-gradient(180deg, rgba(26,29,35,0.98), rgba(15,17,21,0.98))",
          borderLeft: "1px solid rgba(34,209,195,0.35)",
          boxShadow: "-10px 0 40px rgba(0,0,0,0.6)",
          padding: "14px 14px 24px",
          color: "#F0F0F0",
          overflowY: "auto",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 12, paddingBottom: 10,
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            position: "sticky", top: -14, zIndex: 2,
            background: "linear-gradient(180deg, rgba(26,29,35,0.98) 75%, rgba(26,29,35,0))",
            paddingTop: 14, marginTop: -14, marginLeft: -14, marginRight: -14,
            paddingLeft: 14, paddingRight: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>⚔</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: 1, color: "#22D1C3" }}>
                LEGIONSVERWALTUNG
              </div>
              <div style={{ fontSize: 11, color: "#8B8FA3", marginTop: 1 }}>
                {slots.length}/{maxSlots} Slots belegt · Klick auf Wächter zentriert die Karte
              </div>
            </div>
          </div>
          <button
            onClick={close}
            style={{
              width: 30, height: 30, borderRadius: "50%",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "#F0F0F0", fontSize: 15,
              cursor: "pointer", lineHeight: 1, padding: 0,
            }}
            aria-label="Schließen"
          >✕</button>
        </div>

        {slots.length === 0 && (
          <div style={{ textAlign: "center", color: "#8B8FA3", fontSize: 12, padding: "32px 8px" }}>
            Aktuell keine Märsche unterwegs.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {slots.map((s) => {
            const color = KIND_COLOR[s.kind];
            const label = KIND_LABEL[s.kind];
            const kindIcon = KIND_ICON[s.kind];
            const ends = new Date(s.ends_at).getTime();
            const remainMs = Math.max(0, ends - now);
            const started = s.started_at ? new Date(s.started_at).getTime() : null;
            const totalMs = started != null ? Math.max(1, ends - started) : null;
            const progress = totalMs != null
              ? Math.min(1, Math.max(0, 1 - remainMs / totalMs))
              : null;

            return (
              <div
                key={s.id}
                style={{
                  display: "flex", alignItems: "stretch", gap: 8,
                  padding: "10px 10px 8px",
                  background: `linear-gradient(90deg, ${color}22, rgba(15,17,21,0.5))`,
                  border: `1px solid ${color}55`,
                  borderRadius: 12,
                  position: "relative",
                }}
              >
                {/* Rückruf-Button (orange) — fester Slot ganz links */}
                {onRecall ? (
                  <button
                    onClick={() => onRecall(s)}
                    aria-label="Truppen zurückrufen"
                    title="Truppen zurückrufen"
                    style={{
                      width: 32, height: 32, borderRadius: "50%",
                      background: "rgba(255,107,74,0.18)",
                      border: "1px solid rgba(255,107,74,0.6)",
                      color: "#FF6B4A", fontSize: 14, fontWeight: 900,
                      cursor: "pointer", padding: 0, flexShrink: 0,
                      lineHeight: 1, alignSelf: "center",
                    }}
                  >↶</button>
                ) : <div style={{ width: 32, flexShrink: 0 }} />}

                {/* Wächter-Avatar (Click = Fly-To) */}
                <button
                  onClick={() => onSlotClick?.(s)}
                  aria-label="Auf Ziel zentrieren"
                  title="Auf Ziel zentrieren"
                  style={{
                    width: 56, height: 56, borderRadius: "50%",
                    background: "rgba(15,17,21,0.6)",
                    border: `2px solid ${color}`,
                    boxShadow: `0 0 8px ${color}66, inset 0 0 6px ${color}33`,
                    overflow: "hidden", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 24, padding: 0, cursor: "pointer",
                    alignSelf: "center",
                  }}
                >
                  {s.avatar_video_url
                    ? <video src={s.avatar_video_url} autoPlay loop muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : s.avatar_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={s.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <span>{s.emoji}</span>}
                </button>

                {/* Hauptblock: Label/Leader/Power + Progress + Coords */}
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 4 }}>
                  {/* Zeile 1: Kind + Power */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                    <span style={{ fontSize: 13, lineHeight: 1 }}>{kindIcon}</span>
                    <span style={{
                      fontSize: 12, fontWeight: 900, color,
                      letterSpacing: 0.6, lineHeight: 1.1,
                      whiteSpace: "nowrap", textTransform: "uppercase",
                    }}>{label}</span>
                    {s.power != null && (
                      <span style={{
                        marginLeft: "auto",
                        fontSize: 11, fontWeight: 800, color: "#FFD700",
                        fontVariantNumeric: "tabular-nums",
                        display: "flex", alignItems: "center", gap: 3,
                      }}>
                        <span style={{ fontSize: 10 }}>⚔</span>
                        {s.power.toLocaleString("de-DE")}
                      </span>
                    )}
                  </div>

                  {/* Zeile 2: Leader + Target */}
                  <div style={{
                    fontSize: 10, color: "#8B8FA3", lineHeight: 1.2,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {s.leader_name && <span style={{ color: "#F0F0F0", fontWeight: 700 }}>{s.leader_name}</span>}
                    {s.leader_name && (s.target_label || s.target_lat != null) && <span> · </span>}
                    {s.target_label
                      ? <span>{s.target_label}</span>
                      : <span>{fmtCoord(s.target_lat, s.target_lng)}</span>}
                  </div>

                  {/* Zeile 3: Progress-Bar */}
                  {progress != null ? (
                    <div style={{
                      position: "relative", height: 8, borderRadius: 4,
                      background: "rgba(15,17,21,0.7)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      overflow: "hidden", marginTop: 2,
                    }}>
                      <div style={{
                        position: "absolute", left: 0, top: 0, bottom: 0,
                        width: `${(progress * 100).toFixed(1)}%`,
                        background: `linear-gradient(90deg, ${color}, ${color}cc)`,
                        boxShadow: `0 0 6px ${color}88`,
                        transition: "width 1s linear",
                      }} />
                      <div style={{
                        position: "absolute", inset: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 8, fontWeight: 900, letterSpacing: 0.4,
                        color: "#fff", textShadow: "0 1px 1px rgba(0,0,0,0.85)",
                      }}>{Math.round(progress * 100)}%</div>
                    </div>
                  ) : (
                    <div style={{ height: 2 }} />
                  )}
                </div>

                {/* Rechte Spalte: Countdown + Boost */}
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "flex-end",
                  justifyContent: "space-between", flexShrink: 0, gap: 4,
                  minWidth: 60,
                }}>
                  <div style={{
                    fontSize: 14, fontWeight: 900, color: "#F0F0F0",
                    fontFamily: "system-ui",
                    fontVariantNumeric: "tabular-nums",
                    textShadow: "0 1px 2px rgba(0,0,0,0.8)",
                    lineHeight: 1,
                  }}>{fmtCountdown(remainMs)}</div>
                  <div style={{
                    fontSize: 8, color, fontWeight: 800,
                    letterSpacing: 0.5, marginTop: -2,
                  }}>VERBLEIBEND</div>
                  {s.boost_rally_id && (
                    <button
                      onClick={() => setPickerForRallyId(
                        pickerForRallyId === s.boost_rally_id ? null : s.boost_rally_id!,
                      )}
                      aria-label="Marsch-Boost anwenden"
                      title="Marsch mit Speed-Boost beschleunigen"
                      style={{
                        width: 30, height: 30, borderRadius: "50%",
                        background: pickerForRallyId === s.boost_rally_id
                          ? "rgba(255,215,0,0.5)"
                          : "rgba(255,215,0,0.18)",
                        border: "1px solid rgba(255,215,0,0.6)",
                        color: "#FFD700", fontSize: 14, fontWeight: 900,
                        cursor: "pointer", padding: 0,
                        lineHeight: 1, transition: "background 0.15s",
                      }}
                    >💨</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Boost-Item-Picker (Popup unten am Drawer) */}
        {pickerForRallyId && (
          <div style={{
            marginTop: 14, padding: 12,
            background: "rgba(255,215,0,0.06)",
            border: "1px solid rgba(255,215,0,0.35)",
            borderRadius: 10,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 900, letterSpacing: 0.8,
              color: "#FFD700", marginBottom: 8,
            }}>💨 MARSCH-BOOST WÄHLEN</div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: 8,
            }}>
              {BOOST_ITEMS.map((b) => {
                const owned = inventoryCounts[b.id] ?? 0;
                const disabled = owned <= 0 || busyBoost;
                return (
                  <button
                    key={b.id}
                    disabled={disabled}
                    onClick={() => void applyBoost(pickerForRallyId, b.id)}
                    style={{
                      padding: "8px 6px",
                      background: disabled
                        ? "rgba(255,255,255,0.03)"
                        : `linear-gradient(180deg, ${b.color}33, ${b.color}11)`,
                      border: `1px solid ${disabled ? "rgba(255,255,255,0.08)" : b.color + "88"}`,
                      borderRadius: 8,
                      color: disabled ? "rgba(255,255,255,0.3)" : "#fff",
                      cursor: disabled ? "not-allowed" : "pointer",
                      display: "flex", flexDirection: "column",
                      alignItems: "center", gap: 3,
                      opacity: disabled ? 0.5 : 1,
                    }}
                  >
                    <span style={{ fontSize: 22, lineHeight: 1 }}>💨</span>
                    <span style={{
                      fontSize: 12, fontWeight: 900,
                      color: disabled ? "rgba(255,255,255,0.4)" : b.color,
                    }}>{b.label}</span>
                    <span style={{ fontSize: 9, color: "#8B8FA3", fontWeight: 700 }}>
                      Besitzt: {owned}
                    </span>
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 9, color: "#8B8FA3", marginTop: 8, lineHeight: 1.3 }}>
              Boost verkürzt die verbleibende Marsch-Zeit um den gewählten Multiplier.
              Nur während Anmarsch-Phase anwendbar.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
