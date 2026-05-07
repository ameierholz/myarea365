"use client";

/**
 * EINSATZ-MODALE — Begleiter+Truppen auf einen Karten-Punkt schicken.
 *
 * Flow:
 *   1) ChoiceModal           → "1 Begleiter" oder "Mehrere Begleiter"
 *   2) SingleEinsatzModal    → 1 Begleiter, Truppen seiner Klasse, MARSCH
 *   3) MultiEinsatzModal     → bis march_queue Slots, jeweils 1 Begleiter
 *
 * Backend: /api/base/coord-march (single oder marches:[…])
 * Klassen-Mapping: guardian_type → troop_class
 *   infantry → infantry, cavalry → cavalry, marksman → marksman, mage → siege
 */

import { useEffect, useMemo, useState } from "react";

const PRIMARY = "#22D1C3";
const ACCENT = "#FF2D78";
const GOLD = "#FFD700";

type Begleiter = {
  id: string;                       // user_guardians.id (Instance-ID)
  archetype_id: string | null;
  level: number;
  name: string;
  guardian_type: string | null;     // infantry/cavalry/marksman/mage
  role: string | null;
  rarity: string | null;
  image_url: string | null;
  ability_name: string | null;
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
  guardians?: Begleiter[];
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
// 1) CHOICE-MODAL
// ════════════════════════════════════════════════════════════════════
export function EinsatzChoiceModal({
  onChoose, onClose,
}: {
  onChoose: (mode: "single" | "multi") => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[9200] bg-black/70 flex items-center justify-center p-3" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(440px, 100%)",
          background: "linear-gradient(160deg, #1A1D23 0%, #0F1115 100%)",
          border: `1px solid ${PRIMARY}40`,
          borderRadius: 18,
          boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
          overflow: "hidden",
        }}
      >
        <div style={{
          padding: "12px 16px",
          background: `linear-gradient(135deg, ${PRIMARY}30, ${ACCENT}20)`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: PRIMARY, fontWeight: 800 }}>EINSATZ STARTEN</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#8B8FA3", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <ChoiceCard
            title="Einzel-Aufgebot"
            subtitle="1 Begleiter + passende Truppen"
            color={PRIMARY}
            icon="⚔"
            onClick={() => onChoose("single")}
          />
          <ChoiceCard
            title="Multi-Aufgebot"
            subtitle="Mehrere Begleiter parallel losschicken"
            color={ACCENT}
            icon="⚔⚔"
            onClick={() => onChoose("multi")}
          />
        </div>
      </div>
    </div>
  );
}

function ChoiceCard({
  title, subtitle, color, icon, onClick,
}: { title: string; subtitle: string; color: string; icon: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "14px 16px",
        borderRadius: 14,
        background: `linear-gradient(135deg, ${color}1f, ${color}08)`,
        border: `1px solid ${color}55`,
        cursor: "pointer", textAlign: "left",
        boxShadow: `0 4px 14px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)`,
      }}
    >
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: `radial-gradient(circle at 30% 30%, ${color}, ${color}66)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22, color: "#0F1115", fontWeight: 900,
        boxShadow: `0 0 12px ${color}88`,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "#F0F0F0", fontWeight: 900, fontSize: 15 }}>{title}</div>
        <div style={{ color: "#8B8FA3", fontSize: 11, marginTop: 2 }}>{subtitle}</div>
      </div>
      <div style={{ color, fontSize: 18, fontWeight: 900 }}>›</div>
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
  const [picked, setPicked] = useState<Begleiter | null>(null);
  const [troopCounts, setTroopCounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const r = await fetch("/api/base/heimat-troops", { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json() as HeimatTroopsRes;
      setData(j);
      if (j.guardians && j.guardians.length > 0) setPicked(j.guardians[0]);
    })();
  }, []);

  const matchClass = matchingTroopClass(picked?.guardian_type);
  const matchedTroops = useMemo(
    () => (data?.troops ?? []).filter((t) => t.troop_class === matchClass && t.have > 0),
    [data, matchClass],
  );
  const total = Object.values(troopCounts).reduce((a, b) => a + (b || 0), 0);
  const cap = data?.march_capacity ?? 60;

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
    <div className="fixed inset-0 z-[9200] bg-black/75 flex items-center justify-center p-2" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(540px, 100%)", maxHeight: "94vh",
          background: "linear-gradient(160deg, #1A1D23 0%, #0F1115 100%)",
          border: `1px solid ${PRIMARY}40`,
          borderRadius: 18,
          boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
          overflow: "hidden",
          display: "flex", flexDirection: "column",
        }}
      >
        <ModalHeader title="EINSATZ" onClose={onClose} />
        <div style={{ overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
          {!data && <div style={{ color: "#8B8FA3", fontSize: 12, textAlign: "center", padding: 20 }}>Lade…</div>}
          {data && (data.guardians ?? []).length === 0 && (
            <div style={{ color: "#FF6B4A", fontSize: 12, padding: 14, textAlign: "center" }}>
              Du hast noch keinen Begleiter. Hol dir einen über das Begleiter-Modal.
            </div>
          )}

          {picked && (
            <BegleiterBanner begleiter={picked} />
          )}

          {data && (data.guardians ?? []).length > 1 && (
            <BegleiterPicker
              list={data.guardians!}
              picked={picked}
              onPick={(b) => { setPicked(b); setTroopCounts({}); }}
            />
          )}

          {picked && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ fontSize: 11, color: "#8B8FA3", letterSpacing: 1.4, fontWeight: 700 }}>BANDITEN</div>
                <ClassChip cls={matchClass} />
                <div style={{ marginLeft: "auto", fontSize: 11, color: "#8B8FA3" }}>
                  Total <span style={{ color: total > cap ? "#FF6B4A" : "#F0F0F0", fontWeight: 800 }}>
                    {total.toLocaleString("de-DE")}
                  </span> / {cap.toLocaleString("de-DE")}
                </div>
              </div>
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
          )}
        </div>

        <div style={{
          padding: "12px 14px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(15,17,21,0.85)",
          display: "flex", flexDirection: "column", gap: 8,
        }}>
          {msg && <div style={{ fontSize: 12, color: msg.startsWith("✅") ? "#4ade80" : "#FF6B4A", textAlign: "center" }}>{msg}</div>}
          <button
            onClick={() => void send()}
            disabled={busy || !picked || total < 1 || total > cap}
            style={{
              width: "100%", padding: "12px 14px", borderRadius: 12,
              background: total > 0 && total <= cap && picked
                ? `linear-gradient(135deg, ${ACCENT}, #FF6B4A)`
                : "rgba(255,255,255,0.06)",
              color: total > 0 && total <= cap && picked ? "#FFF" : "#8B8FA3",
              fontWeight: 900, fontSize: 14, letterSpacing: 1.5,
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
  );
}

// ════════════════════════════════════════════════════════════════════
// 3) MULTI-EINSATZ-MODAL
// ════════════════════════════════════════════════════════════════════
type MultiSlot = { begleiter: Begleiter | null; troops: Record<string, number> };

export function MultiEinsatzModal({
  targetLat, targetLng, onClose, onSent,
}: {
  targetLat: number; targetLng: number;
  onClose: () => void;
  onSent?: () => void;
}) {
  const [data, setData] = useState<HeimatTroopsRes | null>(null);
  const [slots, setSlots] = useState<MultiSlot[]>([{ begleiter: null, troops: {} }]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const r = await fetch("/api/base/heimat-troops", { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json() as HeimatTroopsRes;
      setData(j);
      if (j.guardians && j.guardians.length > 0) {
        setSlots([{ begleiter: j.guardians[0], troops: {} }]);
      }
    })();
  }, []);

  const queueCap = data?.march_queue ?? 1;
  const cap = data?.march_capacity ?? 60;

  function setSlot(idx: number, patch: Partial<MultiSlot>) {
    setSlots((p) => p.map((s, i) => i === idx ? { ...s, ...patch } : s));
  }
  function addSlot() {
    if (slots.length >= queueCap) return;
    const next = data?.guardians?.[slots.length] ?? data?.guardians?.[0] ?? null;
    setSlots((p) => [...p, { begleiter: next, troops: {} }]);
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
        .filter((s) => s.begleiter && Object.values(s.troops).some((n) => n > 0))
        .map((s) => ({
          target_lat: targetLat,
          target_lng: targetLng,
          troops: s.troops,
          guardian_id: s.begleiter!.id,
          legion_label: s.begleiter!.name,
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
  const matchClass = matchingTroopClass(slot?.begleiter?.guardian_type);
  const matchedTroops = useMemo(
    () => (data?.troops ?? []).filter((t) => t.troop_class === matchClass && t.have > 0),
    [data, matchClass],
  );
  const slotTotal = Object.values(slot?.troops ?? {}).reduce((a, b) => a + (b || 0), 0);

  return (
    <div className="fixed inset-0 z-[9200] bg-black/75 flex items-center justify-center p-2" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(640px, 100%)", maxHeight: "94vh",
          background: "linear-gradient(160deg, #1A1D23 0%, #0F1115 100%)",
          border: `1px solid ${ACCENT}40`,
          borderRadius: 18, boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
          overflow: "hidden",
          display: "flex", flexDirection: "column",
        }}
      >
        <ModalHeader title={`MULTI-EINSATZ · ${slots.length}/${queueCap}`} onClose={onClose} />

        {/* Slot-Tabs (CoD-Style nummeriert 1..5) */}
        <div style={{ display: "flex", gap: 6, padding: "10px 14px 4px", overflowX: "auto" }}>
          {slots.map((s, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              style={{
                width: 36, height: 36, borderRadius: 8,
                border: i === activeIdx ? `2px solid ${PRIMARY}` : "1px solid rgba(255,255,255,0.1)",
                background: i === activeIdx ? `${PRIMARY}22` : "rgba(255,255,255,0.04)",
                color: i === activeIdx ? PRIMARY : "#8B8FA3",
                fontWeight: 900, fontSize: 14, cursor: "pointer",
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
                width: 36, height: 36, borderRadius: 8,
                border: `1px dashed ${PRIMARY}77`,
                background: "transparent",
                color: PRIMARY, fontWeight: 900, fontSize: 18, cursor: "pointer",
                flexShrink: 0,
              }}
            >+</button>
          )}
          {slots.length > 1 && (
            <button
              onClick={() => removeSlot(activeIdx)}
              style={{
                marginLeft: "auto",
                padding: "0 10px", height: 36, borderRadius: 8,
                border: "1px solid rgba(255,107,74,0.4)",
                background: "rgba(255,107,74,0.08)",
                color: "#FF6B4A", fontWeight: 900, fontSize: 11, cursor: "pointer",
                flexShrink: 0,
              }}
            >Slot entfernen</button>
          )}
        </div>

        <div style={{ overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
          {!data && <div style={{ color: "#8B8FA3", fontSize: 12, textAlign: "center", padding: 20 }}>Lade…</div>}

          {slot?.begleiter && <BegleiterBanner begleiter={slot.begleiter} />}

          {data && (data.guardians ?? []).length > 0 && (
            <BegleiterPicker
              list={data.guardians!}
              picked={slot?.begleiter ?? null}
              onPick={(b) => setSlot(activeIdx, { begleiter: b, troops: {} })}
            />
          )}

          {slot?.begleiter && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ fontSize: 11, color: "#8B8FA3", letterSpacing: 1.4, fontWeight: 700 }}>BANDITEN</div>
                <ClassChip cls={matchClass} />
                <div style={{ marginLeft: "auto", fontSize: 11, color: "#8B8FA3" }}>
                  Slot {activeIdx + 1}: <span style={{ color: slotTotal > cap ? "#FF6B4A" : "#F0F0F0", fontWeight: 800 }}>
                    {slotTotal.toLocaleString("de-DE")}
                  </span> / {cap.toLocaleString("de-DE")}
                </div>
              </div>
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
          padding: "12px 14px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(15,17,21,0.85)",
          display: "flex", flexDirection: "column", gap: 8,
        }}>
          {msg && <div style={{ fontSize: 12, color: msg.startsWith("✅") ? "#4ade80" : "#FF6B4A", textAlign: "center" }}>{msg}</div>}
          <button
            onClick={() => void sendAll()}
            disabled={busy}
            style={{
              width: "100%", padding: "12px 14px", borderRadius: 12,
              background: `linear-gradient(135deg, ${ACCENT}, #FF6B4A)`,
              color: "#FFF",
              fontWeight: 900, fontSize: 14, letterSpacing: 1.5,
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
  );
}

// ════════════════════════════════════════════════════════════════════
// SHARED SUB-COMPONENTS
// ════════════════════════════════════════════════════════════════════

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div style={{
      padding: "10px 16px",
      background: `linear-gradient(135deg, ${PRIMARY}30, ${ACCENT}20)`,
      display: "flex", justifyContent: "space-between", alignItems: "center",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
    }}>
      <div style={{ fontSize: 11, letterSpacing: 2, color: PRIMARY, fontWeight: 800 }}>{title}</div>
      <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#8B8FA3", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>✕</button>
    </div>
  );
}

function BegleiterBanner({ begleiter }: { begleiter: Begleiter }) {
  const rarityColor = RARITY_COLOR[begleiter.rarity ?? "common"] ?? PRIMARY;
  const classColor = CLASS_COLOR[begleiter.guardian_type ?? "infantry"] ?? PRIMARY;
  return (
    <div style={{
      display: "flex", gap: 12, alignItems: "stretch",
      padding: 10, borderRadius: 14,
      background: `linear-gradient(135deg, ${rarityColor}1f, ${rarityColor}06)`,
      border: `1px solid ${rarityColor}55`,
      boxShadow: `0 4px 14px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)`,
    }}>
      <div style={{
        width: 86, height: 86, flexShrink: 0,
        borderRadius: 12, overflow: "hidden",
        background: `radial-gradient(circle at 50% 30%, ${rarityColor}55, ${rarityColor}11)`,
        border: `1px solid ${rarityColor}77`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {begleiter.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={begleiter.image_url} alt={begleiter.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ fontSize: 36 }}>🛡</span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 1.2, color: rarityColor, textTransform: "uppercase" }}>
            {begleiter.rarity ?? "common"}
          </div>
          <div style={{
            padding: "1px 6px", borderRadius: 4, background: `${GOLD}22`, border: `1px solid ${GOLD}66`,
            fontSize: 9, fontWeight: 900, color: GOLD, letterSpacing: 0.5,
          }}>Lv {begleiter.level}</div>
        </div>
        <div style={{ color: "#F0F0F0", fontWeight: 900, fontSize: 16, lineHeight: 1.1 }}>{begleiter.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <ClassChip cls={begleiter.guardian_type ?? "infantry"} small />
          {begleiter.role && (
            <span style={{ fontSize: 10, color: "#8B8FA3" }}>· {begleiter.role}</span>
          )}
        </div>
        {begleiter.ability_name && (
          <div style={{
            fontSize: 10, color: classColor, fontWeight: 700, marginTop: 1,
            display: "flex", alignItems: "center", gap: 4,
          }}>
            ✦ {begleiter.ability_name}
          </div>
        )}
      </div>
    </div>
  );
}

function BegleiterPicker({
  list, picked, onPick,
}: { list: Begleiter[]; picked: Begleiter | null; onPick: (b: Begleiter) => void }) {
  return (
    <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
      {list.map((b) => {
        const sel = picked?.id === b.id;
        const c = RARITY_COLOR[b.rarity ?? "common"] ?? PRIMARY;
        return (
          <button
            key={b.id}
            onClick={() => onPick(b)}
            title={`${b.name} (Lv ${b.level})`}
            style={{
              flexShrink: 0,
              width: 56, height: 56, borderRadius: 10,
              border: sel ? `2px solid ${c}` : "1px solid rgba(255,255,255,0.1)",
              background: sel ? `${c}22` : "rgba(15,17,21,0.6)",
              padding: 2, cursor: "pointer", overflow: "hidden",
              boxShadow: sel ? `0 0 12px ${c}88` : "none",
              position: "relative",
            }}
          >
            {b.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🛡</div>
            )}
            <div style={{
              position: "absolute", bottom: 1, right: 1,
              padding: "0 3px", borderRadius: 3,
              background: "rgba(15,17,21,0.85)", color: GOLD,
              fontSize: 8, fontWeight: 900, lineHeight: 1.3,
            }}>{b.level}</div>
          </button>
        );
      })}
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

function TroopSlider({
  troop, value, cap, onChange,
}: { troop: Troop; value: number; cap: number; onChange: (v: number) => void }) {
  const max = Math.min(troop.have, Math.max(0, cap));
  const color = CLASS_COLOR[troop.troop_class ?? "infantry"] ?? PRIMARY;
  return (
    <div style={{
      padding: "8px 10px", borderRadius: 10,
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.06)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 14 }}>{troop.emoji ?? "⚔"}</span>
        <span style={{ color: "#F0F0F0", fontSize: 11, fontWeight: 700, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {troop.name} · T{troop.tier}
        </span>
        <span style={{ color: "#8B8FA3", fontSize: 10 }}>{troop.have.toLocaleString("de-DE")} verfügbar</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="range" min={0} max={max} value={value}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          style={{ flex: 1, accentColor: color }}
        />
        <input
          type="number" min={0} max={max} value={value}
          onChange={(e) => onChange(Math.max(0, Math.min(max, parseInt(e.target.value || "0", 10))))}
          style={{
            width: 70, padding: "4px 6px", borderRadius: 6,
            background: "#0F1115", border: "1px solid rgba(255,255,255,0.1)",
            color: "#F0F0F0", fontSize: 11, fontWeight: 800,
            fontVariantNumeric: "tabular-nums", textAlign: "right",
          }}
        />
        <button
          onClick={() => onChange(max)}
          style={{
            padding: "4px 8px", borderRadius: 6,
            background: `${color}22`, border: `1px solid ${color}66`,
            color, fontSize: 10, fontWeight: 900, cursor: "pointer",
          }}
        >MAX</button>
      </div>
    </div>
  );
}
