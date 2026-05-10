"use client";

/**
 * EINSATZ-MODALE — Wächter+Truppen auf einen Karten-Punkt schicken.
 *
 * Flow:
 *   1) ChoiceModal           → "1 Wächter" oder "Mehrere Wächter"
 *   2) SingleEinsatzModal    → 1 Wächter, Truppen seiner Klasse, MARSCH
 *   3) MultiEinsatzModal     → bis march_queue Slots, jeweils 1 Wächter
 *
 * Backend: /api/base/coord-march (single oder marches:[…])
 * Klassen-Mapping: guardian_type → troop_class
 *   infantry → infantry, cavalry → cavalry, marksman → marksman, mage → siege
 */

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { fetchBaseMe } from "@/lib/base-me-cache";

// 3D-Modell lazy: spart Bundle-Kosten wenn das Modal nicht offen ist.
const Waechter3D = dynamic(() => import("@/components/waechter-3d").then((m) => m.Waechter3D), {
  ssr: false,
  loading: () => <div style={{ width: "100%", height: "100%" }} />,
});

const PRIMARY = "#22D1C3";
const ACCENT = "#FF2D78";
const GOLD = "#FFD700";

type Waechter = {
  id: string;                       // user_guardians.id (Instance-ID)
  archetype_id: string | null;
  level: number;
  name: string;
  emoji: string | null;
  guardian_type: string | null;     // infantry/cavalry/marksman/mage
  role: string | null;
  rarity: string | null;
  image_url: string | null;
  ability_name: string | null;
  ability_desc: string | null;
};
type Troop = {
  id: string;
  name: string;
  tier: number;
  troop_class: string | null;       // infantry/cavalry/marksman/siege/collector
  emoji: string | null;
  have: number;
};
type HeimatTroopsRes = {
  troops?: Troop[];
  guardians?: Waechter[];
  march_capacity?: number;
  march_queue?: number;
};

const CLASS_LABEL: Record<string, string> = {
  infantry: "Infanterie",
  cavalry: "Kavallerie",
  marksman: "Scharfschütze",
  mage: "Magie",
  siege: "Belagerung",
  collector: "Sammler",
};
const CLASS_COLOR: Record<string, string> = {
  infantry: "#FF6B4A",
  cavalry: "#22D1C3",
  marksman: "#FFD700",
  mage: "#A855F7",
  siege: "#A855F7",
  collector: "#a07a3c",
};
const RARITY_COLOR: Record<string, string> = {
  common: "#9ba8c7",
  rare: "#22D1C3",
  epic: "#A855F7",
  legendary: "#FFD700",
  legend: "#FFD700",
  artifact: "#FF2D78",
  transcendent: "#FF2D78",
  elite: "#FF6B4A",
};

// guardian_type → troop_class
function matchingTroopClass(gtype: string | null | undefined): string {
  if (gtype === "mage") return "siege";
  return gtype ?? "infantry";
}

// ════════════════════════════════════════════════════════════════════
// 1) CHOICE-MODAL — Banner oben am Screen-Rand, Buttons horizontal,
// Hinweis darunter. Wording "Wächter" statt "Legion".
// ════════════════════════════════════════════════════════════════════
export function EinsatzChoiceModal({
  onChoose, onClose,
}: {
  /** Anchor wird ignoriert — Modal sitzt fest oben */
  anchor?: { screenX: number; screenY: number } | null;
  onChoose: (mode: "single" | "multi") => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-[9180]" onClick={onClose} />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          width: "min(360px, calc(100vw - 16px))",
          zIndex: 9190,
          background: "linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(232,238,248,0.94) 100%)",
          border: "2px solid #6B8FB8",
          borderRadius: 12,
          boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
          padding: "10px 12px",
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          <ChoiceButton label="EINZEL" onClick={() => onChoose("single")} />
          <ChoiceButton label="MULTI"  onClick={() => onChoose("multi")} />
        </div>
        <div style={{
          fontSize: 11, fontWeight: 600, color: "#3A4A60", textAlign: "center",
          marginTop: 8, lineHeight: 1.35,
        }}>
          Schick einen Wächter mit Banditen los — oder mehrere parallel.
        </div>
      </div>
    </>
  );
}

function ChoiceButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: "10px 10px",
        borderRadius: 6,
        background: "linear-gradient(180deg, #5BA0E0 0%, #3578C0 50%, #2F6BB0 100%)",
        border: "1.5px solid #1F4F88",
        color: "#FFF",
        fontSize: 12, fontWeight: 800, letterSpacing: 0.6,
        cursor: "pointer",
        boxShadow: "0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -2px 0 rgba(0,0,0,0.15)",
        textShadow: "0 1px 1px rgba(0,0,0,0.45)",
      }}
    >
      {label}
    </button>
  );
}

// ════════════════════════════════════════════════════════════════════
// 2) SINGLE-EINSATZ-MODAL
// ════════════════════════════════════════════════════════════════════
export function SingleEinsatzModal({
  targetLat, targetLng, onClose, onSent,
}: {
  targetLat: number; targetLng: number;
  onClose: () => void;
  onSent?: () => void;
}) {
  const [data, setData] = useState<HeimatTroopsRes | null>(null);
  const [picked, setPicked] = useState<Waechter | null>(null);
  const [troopCounts, setTroopCounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [base, setBase] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    void (async () => {
      const [troopsR, baseJ] = await Promise.all([
        fetch("/api/base/heimat-troops", { cache: "no-store" }),
        fetchBaseMe(),
      ]);
      if (troopsR.ok) {
        const j = await troopsR.json() as HeimatTroopsRes;
        setData(j);
        if (j.guardians && j.guardians.length > 0) setPicked(j.guardians[0]);
      }
      {
        const j = baseJ as { base?: { lat?: number | null; lng?: number | null } } | null;
        if (j?.base?.lat != null && j?.base?.lng != null) {
          setBase({ lat: j.base.lat, lng: j.base.lng });
        }
      }
    })();
  }, []);

  const matchClass = matchingTroopClass(picked?.guardian_type);
  const matchedTroops = useMemo(
    () => (data?.troops ?? []).filter((t) => t.troop_class === matchClass && t.have > 0),
    [data, matchClass],
  );
  const total = Object.values(troopCounts).reduce((a, b) => a + (b || 0), 0);
  const cap = data?.march_capacity ?? 60;
  const distance = base ? haversineMeters(base.lat, base.lng, targetLat, targetLng) : null;
  const marchSeconds = distance != null ? estimateMarchSeconds(distance) : null;

  async function send() {
    if (!picked) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/base/coord-march", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_lat: targetLat, target_lng: targetLng,
          troops: troopCounts,
          guardian_id: picked.id,
          legion_label: picked.name,
        }),
      });
      const j = await r.json() as { ok?: boolean; results?: Array<{ ok: boolean; error?: string }>; error?: string };
      if (j.ok) {
        setMsg("✅ Marsch gestartet");
        setTimeout(() => { onSent?.(); onClose(); }, 900);
      } else {
        setMsg(`❌ ${j.results?.[0]?.error ?? j.error ?? "Fehler"}`);
      }
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[9200] bg-black/75 overflow-y-auto" onClick={onClose}>
      <div className="flex items-start justify-center" style={{ minHeight: "100%", padding: 6 }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(620px, 100%)", maxHeight: "100dvh",
          background: "linear-gradient(160deg, #1A1D23 0%, #0F1115 100%)",
          border: "none",
          borderRadius: 16,
          boxShadow: `
            0 0 0 1px ${PRIMARY}22,
            0 0 28px ${PRIMARY}28,
            0 0 70px ${PRIMARY}14,
            0 24px 64px rgba(0,0,0,0.7)
          `,
          overflow: "hidden",
          display: "flex", flexDirection: "column",
        }}
      >
        <ModalHeader title="EINSATZ" onClose={onClose} />
        <div style={{ overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 8, flex: 1, minHeight: 0 }}>
          {!data && <div style={{ color: "#8B8FA3", fontSize: 12, textAlign: "center", padding: 20 }}>Lade…</div>}
          {data && (data.guardians ?? []).length === 0 && (
            <div style={{ color: "#FF6B4A", fontSize: 12, padding: 14, textAlign: "center" }}>
              Du hast noch keinen Wächter. Hol dir einen über das Wächter-Modal.
            </div>
          )}

          {/* 2-Spalten-Grid: Showcase | Banditen — Picker liegt außerhalb am rechten Bildschirmrand */}
          {picked && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              alignItems: "stretch",
            }}>
              {/* Linke Spalte: Wächter-Showcase, streckt sich auf volle Spalten-Höhe */}
              <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
                <WaechterShowcase waechter={picked} fillHeight />
              </div>

              {/* Rechte Spalte: Banditen-Auswahl */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                {matchedTroops.length === 0 && (
                  <div style={{ color: "#8B8FA3", fontSize: 11, padding: 10, textAlign: "center", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 8 }}>
                    Keine {CLASS_LABEL[matchClass] ?? matchClass}-Truppen vorhanden.
                  </div>
                )}
                {matchedTroops.map((t) => (
                  <TroopSlider
                    key={t.id}
                    troop={t}
                    value={troopCounts[t.id] ?? 0}
                    cap={cap - (total - (troopCounts[t.id] ?? 0))}
                    onChange={(v) => setTroopCounts((p) => ({ ...p, [t.id]: v }))}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{
          padding: "6px 8px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(15,17,21,0.85)",
          display: "flex", flexDirection: "column", gap: 5, flexShrink: 0,
        }}>
          <MarchInfoLine distanceM={distance} marchSeconds={marchSeconds} />
          {msg && <div style={{ fontSize: 11, color: msg.startsWith("✅") ? "#4ade80" : "#FF6B4A", textAlign: "center" }}>{msg}</div>}
          <button
            onClick={() => void send()}
            disabled={busy || !picked || total < 1 || total > cap}
            style={{
              width: "100%", padding: "7px 10px", borderRadius: 10,
              background: total > 0 && total <= cap && picked
                ? `linear-gradient(135deg, ${ACCENT}, #FF6B4A)`
                : "rgba(255,255,255,0.06)",
              color: total > 0 && total <= cap && picked ? "#FFF" : "#8B8FA3",
              fontWeight: 900, fontSize: 12, letterSpacing: 1.2,
              border: "none",
              boxShadow: total > 0 && total <= cap && picked ? `0 6px 20px ${ACCENT}55` : "none",
              cursor: busy || !picked || total < 1 || total > cap ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "…" : "⚔  MARSCH STARTEN"}
          </button>
        </div>
      </div>
      </div>

      {/* Wächter-Sidebar am rechten Bildschirmrand — fix positioniert, außerhalb des Modals */}
      {data && (data.guardians ?? []).length > 1 && picked && (
        <WaechterSidebar
          list={data.guardians!}
          picked={picked}
          onPick={(b) => { setPicked(b); setTroopCounts({}); }}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// 3) MULTI-EINSATZ-MODAL
// ════════════════════════════════════════════════════════════════════
type MultiSlot = { waechter: Waechter | null; troops: Record<string, number> };

export function MultiEinsatzModal({
  targetLat, targetLng, onClose, onSent,
}: {
  targetLat: number; targetLng: number;
  onClose: () => void;
  onSent?: () => void;
}) {
  const [data, setData] = useState<HeimatTroopsRes | null>(null);
  const [slots, setSlots] = useState<MultiSlot[]>([{ waechter: null, troops: {} }]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [base, setBase] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    void (async () => {
      const [troopsR, baseJ] = await Promise.all([
        fetch("/api/base/heimat-troops", { cache: "no-store" }),
        fetchBaseMe(),
      ]);
      if (troopsR.ok) {
        const j = await troopsR.json() as HeimatTroopsRes;
        setData(j);
        if (j.guardians && j.guardians.length > 0) {
          setSlots([{ waechter: j.guardians[0], troops: {} }]);
        }
      }
      {
        const j = baseJ as { base?: { lat?: number | null; lng?: number | null } } | null;
        if (j?.base?.lat != null && j?.base?.lng != null) {
          setBase({ lat: j.base.lat, lng: j.base.lng });
        }
      }
    })();
  }, []);

  const distance = base ? haversineMeters(base.lat, base.lng, targetLat, targetLng) : null;
  const marchSeconds = distance != null ? estimateMarchSeconds(distance) : null;

  const queueCap = data?.march_queue ?? 1;
  const cap = data?.march_capacity ?? 60;

  function setSlot(idx: number, patch: Partial<MultiSlot>) {
    setSlots((p) => p.map((s, i) => i === idx ? { ...s, ...patch } : s));
  }
  function addSlot() {
    if (slots.length >= queueCap) return;
    const next = data?.guardians?.[slots.length] ?? data?.guardians?.[0] ?? null;
    setSlots((p) => [...p, { waechter: next, troops: {} }]);
    setActiveIdx(slots.length);
  }
  function removeSlot(idx: number) {
    if (slots.length <= 1) return;
    setSlots((p) => p.filter((_, i) => i !== idx));
    setActiveIdx((i) => Math.max(0, Math.min(i, slots.length - 2)));
  }

  async function sendAll() {
    setBusy(true); setMsg(null);
    try {
      const marches = slots
        .filter((s) => s.waechter && Object.values(s.troops).some((n) => n > 0))
        .map((s) => ({
          target_lat: targetLat,
          target_lng: targetLng,
          troops: s.troops,
          guardian_id: s.waechter!.id,
          legion_label: s.waechter!.name,
        }));
      if (marches.length === 0) { setMsg("❌ Mindestens 1 Slot mit Truppen nötig"); setBusy(false); return; }
      const r = await fetch("/api/base/coord-march", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marches }),
      });
      const j = await r.json() as { ok?: boolean; results?: Array<{ ok: boolean; error?: string }>; error?: string };
      if (j.ok) {
        setMsg(`✅ ${marches.length} Märsche unterwegs`);
        setTimeout(() => { onSent?.(); onClose(); }, 900);
      } else {
        const failed = (j.results ?? []).filter((rr) => !rr.ok);
        setMsg(`❌ ${failed.length} fehlgeschlagen: ${failed.map((f) => f.error).join(", ")}`);
      }
    } finally { setBusy(false); }
  }

  const slot = slots[activeIdx];
  const matchClass = matchingTroopClass(slot?.waechter?.guardian_type);
  const matchedTroops = useMemo(
    () => (data?.troops ?? []).filter((t) => t.troop_class === matchClass && t.have > 0),
    [data, matchClass],
  );
  const slotTotal = Object.values(slot?.troops ?? {}).reduce((a, b) => a + (b || 0), 0);

  return (
    <div className="fixed inset-0 z-[9200] bg-black/75 overflow-y-auto" onClick={onClose}>
      <div className="flex items-start justify-center" style={{ minHeight: "100%", padding: 6 }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(620px, 100%)", maxHeight: "100dvh",
          background: "linear-gradient(160deg, #1A1D23 0%, #0F1115 100%)",
          border: "none",
          borderRadius: 16,
          boxShadow: `
            0 0 0 1px ${ACCENT}22,
            0 0 28px ${ACCENT}28,
            0 0 70px ${ACCENT}14,
            0 24px 64px rgba(0,0,0,0.7)
          `,
          overflow: "hidden",
          display: "flex", flexDirection: "column",
        }}
      >
        <ModalHeader title={`MULTI-EINSATZ · ${slots.length}/${queueCap}`} onClose={onClose} />

        {/* Slot-Tabs (CoD-Style nummeriert 1..5) */}
        <div style={{ display: "flex", gap: 4, padding: "5px 8px 3px", overflowX: "auto", flexShrink: 0 }}>
          {slots.map((s, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              style={{
                width: 28, height: 28, borderRadius: 6,
                border: i === activeIdx ? `2px solid ${PRIMARY}` : "1px solid rgba(255,255,255,0.1)",
                background: i === activeIdx ? `${PRIMARY}22` : "rgba(255,255,255,0.04)",
                color: i === activeIdx ? PRIMARY : "#8B8FA3",
                fontWeight: 900, fontSize: 12, cursor: "pointer",
                position: "relative",
                flexShrink: 0,
              }}
            >
              {i + 1}
              {Object.values(s.troops).some((n) => n > 0) && (
                <span style={{
                  position: "absolute", top: -4, right: -4,
                  width: 10, height: 10, borderRadius: 5,
                  background: "#4ade80", border: "1.5px solid #0F1115",
                }} />
              )}
            </button>
          ))}
          {slots.length < queueCap && (
            <button
              onClick={addSlot}
              style={{
                width: 28, height: 28, borderRadius: 6,
                border: `1px dashed ${PRIMARY}77`,
                background: "transparent",
                color: PRIMARY, fontWeight: 900, fontSize: 14, cursor: "pointer",
                flexShrink: 0,
              }}
            >+</button>
          )}
          {slots.length > 1 && (
            <button
              onClick={() => removeSlot(activeIdx)}
              style={{
                marginLeft: "auto",
                padding: "0 8px", height: 28, borderRadius: 6,
                border: "1px solid rgba(255,107,74,0.4)",
                background: "rgba(255,107,74,0.08)",
                color: "#FF6B4A", fontWeight: 900, fontSize: 10, cursor: "pointer",
                flexShrink: 0, whiteSpace: "nowrap",
              }}
            >Slot entfernen</button>
          )}
        </div>

        <div style={{ overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 8, flex: 1, minHeight: 0 }}>
          {!data && <div style={{ color: "#8B8FA3", fontSize: 11, textAlign: "center", padding: 16 }}>Lade…</div>}

          {slot?.waechter && <WaechterBanner waechter={slot.waechter} />}

          {slot?.waechter && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {matchedTroops.length === 0 && (
                <div style={{ color: "#8B8FA3", fontSize: 11, padding: 10, textAlign: "center", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 8 }}>
                  Keine {CLASS_LABEL[matchClass] ?? matchClass}-Truppen vorhanden.
                </div>
              )}
              {matchedTroops.map((t) => (
                <TroopSlider
                  key={t.id}
                  troop={t}
                  value={slot.troops[t.id] ?? 0}
                  cap={cap - (slotTotal - (slot.troops[t.id] ?? 0))}
                  onChange={(v) => setSlot(activeIdx, { troops: { ...slot.troops, [t.id]: v } })}
                />
              ))}
            </div>
          )}
        </div>

        <div style={{
          padding: "6px 8px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(15,17,21,0.85)",
          display: "flex", flexDirection: "column", gap: 5, flexShrink: 0,
        }}>
          <MarchInfoLine distanceM={distance} marchSeconds={marchSeconds} />
          {msg && <div style={{ fontSize: 11, color: msg.startsWith("✅") ? "#4ade80" : "#FF6B4A", textAlign: "center" }}>{msg}</div>}
          <button
            onClick={() => void sendAll()}
            disabled={busy}
            style={{
              width: "100%", padding: "7px 10px", borderRadius: 10,
              background: `linear-gradient(135deg, ${ACCENT}, #FF6B4A)`,
              color: "#FFF",
              fontWeight: 900, fontSize: 12, letterSpacing: 1.2,
              border: "none",
              boxShadow: `0 6px 20px ${ACCENT}55`,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "…" : `⚔  ALLE MARSCH STARTEN (${slots.filter((s) => Object.values(s.troops).some((n) => n > 0)).length})`}
          </button>
        </div>
      </div>
      </div>

      {/* Wächter-Sidebar am rechten Bildschirmrand */}
      {data && (data.guardians ?? []).length > 0 && (
        <WaechterSidebar
          list={data.guardians!}
          picked={slot?.waechter ?? null}
          onPick={(b) => setSlot(activeIdx, { waechter: b, troops: {} })}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// SHARED SUB-COMPONENTS
// ════════════════════════════════════════════════════════════════════

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div style={{
      padding: "6px 10px", flexShrink: 0,
      background: `linear-gradient(135deg, ${PRIMARY}30, ${ACCENT}20)`,
      display: "flex", justifyContent: "space-between", alignItems: "center",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
    }}>
      <div style={{ fontSize: 10, letterSpacing: 1.5, color: PRIMARY, fontWeight: 800 }}>{title}</div>
      <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#8B8FA3", fontSize: 16, cursor: "pointer", lineHeight: 1 }}>✕</button>
    </div>
  );
}

// Großformatige Showcase-Card mit Portrait oben + Stats unten
function WaechterShowcase({ waechter, fillHeight }: { waechter: Waechter; fillHeight?: boolean }) {
  const rarityColor = RARITY_COLOR[waechter.rarity ?? "common"] ?? PRIMARY;
  const classColor = CLASS_COLOR[waechter.guardian_type ?? "infantry"] ?? PRIMARY;
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      borderRadius: 14,
      background: `linear-gradient(180deg, ${rarityColor}1f 0%, ${rarityColor}06 60%, transparent)`,
      border: `1px solid ${rarityColor}55`,
      boxShadow: `0 4px 14px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)`,
      overflow: "hidden",
      flex: fillHeight ? 1 : undefined,
      minHeight: fillHeight ? 0 : undefined,
    }}>
      {/* 3D-Modell — bei fillHeight streckt es sich auf den verfügbaren Platz, sonst quadratisch */}
      <div style={{
        width: "100%",
        aspectRatio: fillHeight ? undefined : "1 / 1",
        flex: fillHeight ? 1 : undefined,
        minHeight: fillHeight ? 180 : undefined,
        background: `radial-gradient(circle at 50% 40%, ${rarityColor}55, ${rarityColor}11 70%, transparent)`,
        position: "relative",
      }}>
        <div style={{ position: "absolute", inset: 0 }}>
          <Waechter3D
            archetypeId={waechter.archetype_id ?? undefined}
            animation="idle"
            height="100%"
            background="transparent"
          />
        </div>
      </div>
      {/* Info-Block */}
      <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
          <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 1.2, color: rarityColor, textTransform: "uppercase" }}>
            {waechter.rarity ?? "common"}
          </div>
          <div style={{
            padding: "1px 5px", borderRadius: 4, background: `${GOLD}22`, border: `1px solid ${GOLD}66`,
            fontSize: 9, fontWeight: 900, color: GOLD, letterSpacing: 0.5,
          }}>Lv {waechter.level}</div>
          <ClassChip cls={waechter.guardian_type ?? "infantry"} small />
        </div>
        <div style={{ color: "#F0F0F0", fontWeight: 900, fontSize: 14, lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{waechter.name}</div>
        {waechter.ability_name && (
          <div style={{
            marginTop: 2, padding: "4px 6px",
            borderRadius: 6,
            background: `${classColor}14`,
            border: `1px solid ${classColor}33`,
          }}>
            <div style={{ fontSize: 9, color: classColor, fontWeight: 800, letterSpacing: 0.4 }}>
              ✦ {waechter.ability_name}
            </div>
            {waechter.ability_desc && (
              <div style={{ fontSize: 9, color: "#C8CDD9", lineHeight: 1.35, marginTop: 2 }}>
                {waechter.ability_desc}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function WaechterBanner({ waechter }: { waechter: Waechter }) {
  const rarityColor = RARITY_COLOR[waechter.rarity ?? "common"] ?? PRIMARY;
  const classColor = CLASS_COLOR[waechter.guardian_type ?? "infantry"] ?? PRIMARY;
  return (
    <div style={{
      display: "flex", gap: 12, alignItems: "stretch",
      padding: 10, borderRadius: 14,
      background: `linear-gradient(135deg, ${rarityColor}1f, ${rarityColor}06)`,
      border: `1px solid ${rarityColor}55`,
      boxShadow: `0 4px 14px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)`,
    }}>
      <div style={{
        width: 80, height: 80, flexShrink: 0,
        borderRadius: 12, overflow: "hidden",
        background: `radial-gradient(circle at 50% 35%, ${rarityColor}66, ${rarityColor}11 70%, transparent)`,
        border: `1px solid ${rarityColor}77`,
        position: "relative",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <PortraitCard waechter={waechter} medium />
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 1.2, color: rarityColor, textTransform: "uppercase" }}>
            {waechter.rarity ?? "common"}
          </div>
          <div style={{
            padding: "1px 6px", borderRadius: 4, background: `${GOLD}22`, border: `1px solid ${GOLD}66`,
            fontSize: 9, fontWeight: 900, color: GOLD, letterSpacing: 0.5,
          }}>Lv {waechter.level}</div>
        </div>
        <div style={{ color: "#F0F0F0", fontWeight: 900, fontSize: 16, lineHeight: 1.1 }}>{waechter.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <ClassChip cls={waechter.guardian_type ?? "infantry"} small />
          {waechter.role && (
            <span style={{ fontSize: 10, color: "#8B8FA3" }}>· {waechter.role}</span>
          )}
        </div>
        {waechter.ability_name && (
          <div style={{
            fontSize: 10, color: classColor, fontWeight: 700, marginTop: 1,
            display: "flex", alignItems: "center", gap: 4,
          }}>
            ✦ {waechter.ability_name}
          </div>
        )}
      </div>
    </div>
  );
}

// Portrait-Card: image_url falls Admin eines hochgeladen hat, sonst stylisierte
// Emoji-Card mit Klassen-Farbe + Rarity-Glow. Funktioniert für alle Archetypes,
// keine 3D- oder PNG-Probleme.
function PortraitCard({
  waechter, large, medium, thumb,
}: { waechter: Waechter; large?: boolean; medium?: boolean; thumb?: boolean }) {
  const rarityColor = RARITY_COLOR[waechter.rarity ?? "common"] ?? PRIMARY;
  const classColor = CLASS_COLOR[waechter.guardian_type ?? "infantry"] ?? PRIMARY;
  const url = waechter.image_url;
  if (url) {
    return (
      <img
        src={url}
        alt={waechter.name}
        style={{
          width: thumb ? "92%" : "94%",
          height: thumb ? "92%" : "94%",
          objectFit: "contain",
          filter: large ? `drop-shadow(0 6px 14px ${rarityColor}55)` : undefined,
          pointerEvents: "none", userSelect: "none",
        }}
        draggable={false}
      />
    );
  }
  // Fallback: Emoji-Card. Großer Emoji mit Klassen-Farbverlauf-BG + Rarity-Border.
  const emojiSize = large ? 96 : medium ? 44 : 28;
  return (
    <div style={{
      width: "92%", height: "92%",
      borderRadius: thumb ? 6 : 12,
      background: `linear-gradient(160deg, ${classColor}33 0%, ${rarityColor}1a 60%, transparent)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative",
      boxShadow: large ? `inset 0 0 22px ${rarityColor}33, inset 0 -10px 24px ${classColor}33` : undefined,
    }}>
      <span style={{
        fontSize: emojiSize,
        lineHeight: 1,
        filter: `drop-shadow(0 4px 8px ${classColor}88)`,
        userSelect: "none",
      }}>
        {waechter.emoji ?? "🛡"}
      </span>
    </div>
  );
}

// Sidebar am LINKEN Bildschirmrand — fixe Position, schwebt neben dem Modal.
// Zeigt eine vertikale Säule der verfügbaren Wächter zum schnellen Wechsel.
function WaechterSidebar({
  list, picked, onPick,
}: { list: Waechter[]; picked: Waechter | null; onPick: (b: Waechter) => void }) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        left: 8,
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 9210,
        maxHeight: "92dvh",
        display: "flex", flexDirection: "column", gap: 6,
        padding: 8,
        borderRadius: 16,
        background: "linear-gradient(180deg, rgba(26,29,35,0.92), rgba(15,17,21,0.92))",
        boxShadow: `
          0 0 0 1px ${PRIMARY}22,
          0 0 24px ${PRIMARY}22,
          0 12px 32px rgba(0,0,0,0.6)
        `,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        overflowY: "auto",
      }}
    >
      <div style={{
        fontSize: 8, fontWeight: 900, color: PRIMARY, letterSpacing: 1.4,
        textAlign: "center", padding: "0 2px 2px",
      }}>BEGLEITER</div>
      {list.map((b) => {
        const sel = picked?.id === b.id;
        const c = RARITY_COLOR[b.rarity ?? "common"] ?? PRIMARY;
        const cls = b.guardian_type ?? "infantry";
        const clsColor = CLASS_COLOR[cls] ?? PRIMARY;
        return (
          <button
            key={b.id}
            onClick={() => onPick(b)}
            title={`${b.name} (Lv ${b.level})`}
            style={{
              flexShrink: 0,
              width: 56,
              padding: "3px 2px",
              borderRadius: 10,
              border: sel ? `2px solid ${c}` : "1px solid rgba(255,255,255,0.1)",
              background: sel ? `${c}1f` : "rgba(255,255,255,0.03)",
              cursor: "pointer", overflow: "hidden",
              boxShadow: sel ? `0 0 12px ${c}77` : "none",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: 8,
              background: `radial-gradient(circle at 35% 30%, ${clsColor}33, ${clsColor}08)`,
              border: `1px solid ${clsColor}66`,
              overflow: "hidden",
              position: "relative",
            }}>
              <Waechter3D
                archetypeId={b.archetype_id ?? undefined}
                animation="idle"
                height="100%"
                background="transparent"
                thumbnail
              />
            </div>
            <div style={{
              fontSize: 8, fontWeight: 900, color: GOLD, letterSpacing: 0.4,
            }}>Lv {b.level}</div>
          </button>
        );
      })}
    </div>
  );
}

function WaechterPicker({
  list, picked, onPick, vertical,
}: { list: Waechter[]; picked: Waechter | null; onPick: (b: Waechter) => void; vertical?: boolean }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: vertical ? "column" : "row",
      gap: 4,
      overflowX: vertical ? "visible" : "auto",
      overflowY: vertical ? "auto" : "visible",
      paddingBottom: vertical ? 0 : 4,
      paddingRight: vertical ? 2 : 0,
      maxHeight: vertical ? "100%" : undefined,
    }}>
      {list.map((b) => {
        const sel = picked?.id === b.id;
        const c = RARITY_COLOR[b.rarity ?? "common"] ?? PRIMARY;
        const cls = b.guardian_type ?? "infantry";
        const clsColor = CLASS_COLOR[cls] ?? PRIMARY;
        return (
          <button
            key={b.id}
            onClick={() => onPick(b)}
            title={`${b.name} (Lv ${b.level})`}
            style={{
              flexShrink: 0,
              minWidth: vertical ? 0 : 60,
              width: vertical ? "100%" : undefined,
              padding: vertical ? "3px 2px" : "4px 6px",
              borderRadius: 8,
              border: sel ? `2px solid ${c}` : "1px solid rgba(255,255,255,0.1)",
              background: sel ? `${c}1f` : "rgba(15,17,21,0.45)",
              cursor: "pointer", overflow: "hidden",
              boxShadow: sel ? `0 0 10px ${c}66` : "none",
              position: "relative",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            }}
          >
            <div style={{
              width: vertical ? 48 : 44,
              height: vertical ? 48 : 44,
              borderRadius: 8,
              background: `radial-gradient(circle at 35% 30%, ${clsColor}33, ${clsColor}08)`,
              border: `1px solid ${clsColor}66`,
              overflow: "hidden",
              boxShadow: `0 0 6px ${clsColor}33`,
              position: "relative",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <PortraitCard waechter={b} thumb />
            </div>
            {!vertical && (
              <div style={{
                fontSize: 9, fontWeight: 800, color: sel ? "#F0F0F0" : "#C8CDD9",
                lineHeight: 1.1, maxWidth: 56, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{b.name}</div>
            )}
            <div style={{
              fontSize: 8, fontWeight: 900, color: GOLD, letterSpacing: 0.4,
            }}>Lv {b.level}</div>
          </button>
        );
      })}
    </div>
  );
}

// Kapazitäts-Bar im CoD-Stil: Round-Icon links, gefüllter Progress-Bar mit Klasse,
// rechts die Zahl total/cap. Ersetzt die textuelle "Total X / Y"-Anzeige.
function CapacityBar({
  cls, total, cap, slotLabel,
}: { cls: string; total: number; cap: number; slotLabel?: string }) {
  const color = CLASS_COLOR[cls] ?? PRIMARY;
  const label = CLASS_LABEL[cls] ?? cls;
  const overflow = total > cap;
  const pct = cap > 0 ? Math.min(100, (total / cap) * 100) : 0;
  const icon = cls === "cavalry" ? "🐎" : cls === "marksman" ? "🏹" : cls === "siege" || cls === "mage" ? "🔮" : cls === "collector" ? "🛠" : "⚔";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "4px 6px 4px 4px",
      borderRadius: 999,
      background: "linear-gradient(180deg, #2A2018 0%, #1B1410 100%)",
      border: "1px solid #3D2C1E",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 4px rgba(0,0,0,0.4)",
    }}>
      {/* Round-Icon links, Goldring */}
      <div style={{
        width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
        background: `radial-gradient(circle at 35% 30%, ${color}66, ${color}22 60%, #1B1410)`,
        border: "2px solid #C8924A",
        boxShadow: "inset 0 0 6px rgba(0,0,0,0.5), 0 0 4px rgba(200,146,74,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 16, lineHeight: 1,
      }}>{icon}</div>

      {/* Progress-Bar mit Label */}
      <div style={{
        flex: 1, minWidth: 0, position: "relative",
        height: 22, borderRadius: 11,
        background: "linear-gradient(180deg, #14100C 0%, #0A0806 100%)",
        border: "1px solid #2A1F16",
        boxShadow: "inset 0 1px 2px rgba(0,0,0,0.6)",
        overflow: "hidden",
      }}>
        {/* Fill */}
        <div style={{
          position: "absolute", inset: 0,
          width: `${pct}%`,
          background: overflow
            ? "linear-gradient(180deg, #FF8855 0%, #C84A1E 100%)"
            : `linear-gradient(180deg, ${color} 0%, ${color}cc 50%, ${color}88 100%)`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -2px 0 rgba(0,0,0,0.3), 0 0 8px ${overflow ? "#FF6B4A" : color}66`,
          transition: "width 0.2s ease",
        }} />
        {/* Label im Bar */}
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", gap: 6,
          padding: "0 10px",
          fontSize: 11, fontWeight: 800, color: "#FFF",
          textShadow: "0 1px 2px rgba(0,0,0,0.7)",
          letterSpacing: 0.4,
        }}>
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {slotLabel ? `${slotLabel} · ${label}` : label}
          </span>
        </div>
      </div>

      {/* Total / Cap rechts */}
      <div style={{
        flexShrink: 0, display: "flex", alignItems: "center", gap: 4,
        padding: "0 4px",
        fontSize: 12, fontWeight: 900,
        fontVariantNumeric: "tabular-nums",
        color: overflow ? "#FF6B4A" : "#F0F0F0",
        textShadow: "0 1px 2px rgba(0,0,0,0.5)",
      }}>
        <span>{total.toLocaleString("de-DE")}</span>
        <span style={{ color: "#8B8FA3", fontWeight: 700 }}>/</span>
        <span style={{ color: "#8B8FA3", fontWeight: 700 }}>{cap.toLocaleString("de-DE")}</span>
      </div>
    </div>
  );
}

function ClassChip({ cls, small }: { cls: string; small?: boolean }) {
  const color = CLASS_COLOR[cls] ?? PRIMARY;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: small ? "1px 6px" : "2px 8px", borderRadius: 4,
      background: `${color}22`, border: `1px solid ${color}66`,
      color, fontWeight: 900, letterSpacing: 0.6,
      fontSize: small ? 9 : 10, lineHeight: 1.4,
    }}>
      {CLASS_LABEL[cls] ?? cls}
    </span>
  );
}

// CoD-Pill-Bar: Round-Portrait + dicker Progress-Pill mit grünem Fill, sichtbarem
// Drag-Thumb am Fill-Ende, Klassen-emoji-Portrait + Tap auf Count → Number-Pad.
function TroopSlider({
  troop, value, cap, onChange,
}: { troop: Troop; value: number; cap: number; onChange: (v: number) => void }) {
  const max = Math.min(troop.have, Math.max(0, cap));
  const color = CLASS_COLOR[troop.troop_class ?? "infantry"] ?? PRIMARY;
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const overflow = value > max && max > 0;
  const [padOpen, setPadOpen] = useState(false);

  function setFromEvent(e: React.MouseEvent<HTMLDivElement> | MouseEvent, el: HTMLDivElement) {
    const rect = el.getBoundingClientRect();
    const x = (e as MouseEvent).clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    onChange(Math.round(ratio * max));
  }
  function onPointerDown(e: React.MouseEvent<HTMLDivElement>) {
    if (max <= 0) return;
    e.preventDefault();
    const el = e.currentTarget;
    setFromEvent(e, el);
    const move = (ev: MouseEvent) => setFromEvent(ev, el);
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  return (
    <>
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "4px 6px 4px 4px",
        borderRadius: 999,
        background: "linear-gradient(180deg, #2A2018 0%, #1B1410 100%)",
        border: "1px solid #3D2C1E",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 4px rgba(0,0,0,0.4)",
      }}>
        {/* Round-Portrait mit Goldring */}
        <div style={{
          width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
          background: `radial-gradient(circle at 35% 30%, ${color}66, ${color}22 60%, #1B1410)`,
          border: "2px solid #C8924A",
          boxShadow: "inset 0 0 6px rgba(0,0,0,0.5), 0 0 4px rgba(200,146,74,0.35)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, lineHeight: 1,
        }}>{troop.emoji ?? "⚔"}</div>

        {/* Progress-Pill — dicker, klickbar/drag-bar, mit sichtbarem Thumb */}
        <div
          onMouseDown={onPointerDown}
          onDoubleClick={() => onChange(max)}
          style={{
            flex: 1, minWidth: 0, position: "relative",
            height: 30, borderRadius: 15,
            background: "linear-gradient(180deg, #14100C 0%, #0A0806 100%)",
            border: "1px solid #2A1F16",
            boxShadow: "inset 0 1px 2px rgba(0,0,0,0.6)",
            overflow: "visible",
            cursor: max > 0 ? "ew-resize" : "not-allowed",
            userSelect: "none",
          }}
        >
          {/* Innerer Container für den Fill — clipped */}
          <div style={{
            position: "absolute", inset: 0, borderRadius: 15, overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", top: 0, bottom: 0, left: 0,
              width: `${pct}%`,
              background: overflow
                ? "linear-gradient(180deg, #FF8855 0%, #C84A1E 100%)"
                : "linear-gradient(180deg, #6BD46B 0%, #2EA84A 50%, #1F7A36 100%)",
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -2px 0 rgba(0,0,0,0.3), 0 0 8px ${overflow ? "#FF6B4A" : "#2EA84A"}66`,
              transition: "width 0.08s linear",
            }} />
            {/* Label im Bar */}
            <div style={{
              position: "absolute", inset: 0, display: "flex", alignItems: "center",
              padding: "0 12px",
              fontSize: 12, fontWeight: 800, color: "#FFF",
              textShadow: "0 1px 2px rgba(0,0,0,0.7)", letterSpacing: 0.3,
              pointerEvents: "none",
            }}>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {troop.name} · T{troop.tier}
              </span>
            </div>
          </div>
          {/* Sichtbarer Drag-Thumb am Fill-Ende */}
          {max > 0 && (
            <div style={{
              position: "absolute",
              top: "50%",
              left: `calc(${pct}% - 13px)`,
              width: 26, height: 26,
              borderRadius: "50%",
              transform: "translateY(-50%)",
              background: overflow
                ? "radial-gradient(circle at 35% 30%, #FFB494, #C84A1E)"
                : "radial-gradient(circle at 35% 30%, #B4F5B4, #2EA84A 60%, #1F7A36)",
              border: "2px solid #FFFFFF",
              boxShadow: "0 2px 6px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.4)",
              pointerEvents: "none",
              transition: "left 0.08s linear",
            }} />
          )}
        </div>

        {/* Count rechts — Klick öffnet Number-Pad */}
        <button
          onClick={() => setPadOpen(true)}
          disabled={max <= 0}
          style={{
            flexShrink: 0, display: "flex", alignItems: "center", gap: 4,
            padding: "4px 8px",
            fontSize: 13, fontWeight: 900,
            fontVariantNumeric: "tabular-nums",
            color: overflow ? "#FF6B4A" : "#F0F0F0",
            textShadow: "0 1px 2px rgba(0,0,0,0.5)",
            minWidth: 80, justifyContent: "flex-end",
            background: "transparent", border: "none",
            cursor: max > 0 ? "pointer" : "not-allowed",
          }}
          title="Klick für Zifferneingabe"
        >
          <span>{value.toLocaleString("de-DE")}</span>
          <span style={{ color: "#8B8FA3", fontWeight: 700 }}>/</span>
          <span style={{ color: "#8B8FA3", fontWeight: 700 }}>{troop.have.toLocaleString("de-DE")}</span>
        </button>
      </div>

      {padOpen && (
        <NumberPadModal
          title={troop.name}
          initial={value}
          max={max}
          onConfirm={(v) => { onChange(v); setPadOpen(false); }}
          onClose={() => setPadOpen(false)}
        />
      )}
    </>
  );
}

// Number-Pad — CoD-Style Tasten 1–9, 0, ⌫, MAX, BESTÄTIGEN.
function NumberPadModal({
  title, initial, max, onConfirm, onClose,
}: { title: string; initial: number; max: number; onConfirm: (v: number) => void; onClose: () => void }) {
  const [text, setText] = useState(String(initial || 0));
  const numericValue = Math.max(0, Math.min(max, parseInt(text || "0", 10) || 0));

  function press(d: string) {
    setText((cur) => {
      const next = cur === "0" ? d : cur + d;
      const n = parseInt(next, 10) || 0;
      return n > max ? String(max) : next;
    });
  }
  function backspace() { setText((cur) => (cur.length <= 1 ? "0" : cur.slice(0, -1))); }
  function clearAll() { setText("0"); }
  function setMax() { setText(String(max)); }
  function confirm() { onConfirm(numericValue); }

  const Btn = ({ label, onClick, big, accent }: { label: string; onClick: () => void; big?: boolean; accent?: "primary" | "ok" | "warn" }) => (
    <button
      onClick={onClick}
      style={{
        gridColumn: big ? "span 2" : undefined,
        padding: "12px 0",
        borderRadius: 8,
        background: accent === "ok"
          ? "linear-gradient(180deg, #6BD46B 0%, #2EA84A 100%)"
          : accent === "primary"
          ? "linear-gradient(180deg, #2A323A 0%, #1A1F25 100%)"
          : accent === "warn"
          ? "linear-gradient(180deg, #2A1F16 0%, #1A1410 100%)"
          : "linear-gradient(180deg, #2A323A 0%, #1A1F25 100%)",
        border: accent === "ok" ? "1px solid #1F7A36" : "1px solid #3A4250",
        color: accent === "ok" ? "#FFF" : "#F0F0F0",
        fontSize: big ? 13 : 18, fontWeight: 900,
        textShadow: "0 1px 2px rgba(0,0,0,0.5)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), 0 2px 4px rgba(0,0,0,0.4)",
        cursor: "pointer",
        letterSpacing: big ? 1 : 0,
      }}
    >{label}</button>
  );

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 9300, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(320px, 100%)",
          background: "linear-gradient(160deg, #1A1D23 0%, #0F1115 100%)",
          border: "none", borderRadius: 18,
          boxShadow: `0 0 0 1px ${PRIMARY}22, 0 0 28px ${PRIMARY}28, 0 24px 64px rgba(0,0,0,0.7)`,
          padding: 14,
          display: "flex", flexDirection: "column", gap: 10,
        }}
      >
        <div style={{ fontSize: 11, color: PRIMARY, letterSpacing: 1.4, fontWeight: 800, textAlign: "center" }}>
          {title.toUpperCase()}
        </div>
        {/* Anzeige */}
        <div style={{
          padding: "10px 12px", borderRadius: 10,
          background: "#0A0806", border: "1px solid #2A1F16",
          fontSize: 22, fontWeight: 900, color: "#F0F0F0",
          fontVariantNumeric: "tabular-nums", textAlign: "right",
          boxShadow: "inset 0 1px 4px rgba(0,0,0,0.6)",
        }}>
          {numericValue.toLocaleString("de-DE")}
          <span style={{ color: "#8B8FA3", fontSize: 12, fontWeight: 700, marginLeft: 6 }}>
            / {max.toLocaleString("de-DE")}
          </span>
        </div>
        {/* Tasten 1-9 + 0 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          {["1","2","3","4","5","6","7","8","9"].map((d) => (
            <Btn key={d} label={d} onClick={() => press(d)} />
          ))}
          <Btn label="C" onClick={clearAll} accent="warn" />
          <Btn label="0" onClick={() => press("0")} />
          <Btn label="⌫" onClick={backspace} accent="warn" />
        </div>
        {/* Bottom-Row: MAX + BESTÄTIGEN */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 6 }}>
          <Btn label="MAX" onClick={setMax} accent="primary" big />
          <Btn label="BESTÄTIGEN" onClick={confirm} accent="ok" big />
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// MARCH-INFO (Distanz + ETA) — gleiche Formel wie Backend RPC
// ════════════════════════════════════════════════════════════════════
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

// Spiegelt RPC-Logik: greatest(60, least(1800, ceil(distance/50)))
function estimateMarchSeconds(distanceM: number): number {
  return Math.max(60, Math.min(1800, Math.ceil(distanceM / 50)));
}

function formatDuration(s: number): string {
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 2 : 1)} km`;
}

function MarchInfoLine({ distanceM, marchSeconds }: { distanceM: number | null; marchSeconds: number | null }) {
  if (distanceM == null || marchSeconds == null) return null;
  return (
    <div style={{
      display: "flex", justifyContent: "center", alignItems: "center", gap: 14,
      fontSize: 11, color: "#C8CDD9",
      padding: "6px 10px", borderRadius: 8,
      background: "rgba(34,209,195,0.08)",
      border: "1px solid rgba(34,209,195,0.25)",
    }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <span style={{ color: "#8B8FA3", letterSpacing: 0.6, fontSize: 9, fontWeight: 700 }}>DISTANZ</span>
        <span style={{ color: "#F0F0F0", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
          {formatDistance(distanceM)}
        </span>
      </span>
      <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <span style={{ color: "#8B8FA3", letterSpacing: 0.6, fontSize: 9, fontWeight: 700 }}>MARSCH</span>
        <span style={{ color: "#22D1C3", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
          {formatDuration(marchSeconds)}
        </span>
      </span>
    </div>
  );
}
