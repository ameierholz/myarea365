"use client";

/**
 * HEIMAT-OVERLAY (CoD-UX) — top-level UI für die Heimat-Karte
 *
 * Mountet auf dem Dashboard und liefert:
 *   1. Tap-Action-Menü (öffnet bei map-click auf leeren Punkt)
 *   2. Verlegen-Flow (Base-Pin frei platzieren + bestätigen)
 *   3. Multi-Legion-Modal (mehrere Aufgebote parallel losschicken)
 *   4. Verstecken-Modal (Truppen in Gebäude)
 *   5. Eingehende-Angriffe HUD (oben rechts)
 *   6. Eigene Marsch-Liste (unten, mit Rückruf)
 *
 * Datenfluss: pollt alle 10 s `/api/base/heimat`. Kein direkter Map-Draw —
 * Sprites werden via app-map.tsx-Erweiterung gerendert (separate PR).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { PersonalMarkerModal, CrewMarkerModal, SharePinModal } from "./heimat-marker-modals";

type HeimatPoi = {
  owner_crew_id: string | null;
  owner_crew_name: string | null;
  owner_crew_tag: string | null;
  owner_crew_color: string | null;
  nearby_base: { user_id: string; display_name: string; distance_m: number; lat: number; lng: number } | null;
};
type HeimatAddress = { street: string | null; city: string | null; postcode: string | null; suburb: string | null } | null;

type HeimatSnap = {
  ok: boolean;
  active_marches: Array<{
    kind: string; id: string; is_own: boolean; is_crew: boolean;
    attacker_user_id: string; attacker_username: string | null; attacker_crew_tag: string | null;
    origin_lat: number; origin_lng: number; target_lat: number; target_lng: number;
    starts_at: string; ends_at: string;
    troop_count: number; guardian_id: string | null; legion_label: string | null;
    redirect_count: number;
  }>;
  incoming: Array<{
    kind: string; id: string; attacker_user_id: string;
    origin_lat: number; origin_lng: number; target_lat: number; target_lng: number;
    starts_at: string; ends_at: string;
    attacker_username: string | null; attacker_crew_tag: string | null; attacker_crew_id: string | null;
    troop_count: number; guardian_id: string | null;
  }>;
  garrisons: Array<{
    id: string; target_kind: string; target_id: string | null;
    target_lat: number; target_lng: number; troops: Record<string, number>;
    guardian_id: string | null; hidden_at: string;
  }>;
  base: { lat: number; lng: number; last_relocate_at: string | null; relocate_count: number } | null;
  relocate: {
    cooldown_seconds: number; cost_gold: number; max_distance_m: number;
    next_at: string | null; can_relocate: boolean; have_gold: number;
  };
};

export type TapAction =
  | { kind: "verlegen" }
  | { kind: "march"; lat: number; lng: number }
  | { kind: "multi"; lat: number; lng: number }
  | { kind: "hide"; lat: number; lng: number }
  | null;

type Props = {
  /** Position auf der die Tap-Menü erscheinen soll (lat/lng + Bildschirm-Pixel). null = zu */
  tapPosition: { lat: number; lng: number; screenX: number; screenY: number } | null;
  onCloseTap: () => void;
  /** Wird gerufen wenn User in den Verlegen-Modus wechselt — Parent muss Drag-Pin aktivieren */
  onEnterRelocateMode: () => void;
  /** Wird gerufen wenn User Verlegen mit neuer Position bestätigt */
  onConfirmRelocate?: (lat: number, lng: number) => void;
  /** Optionale Defender-Info wenn auf Spieler-Pin geklickt wurde */
  defenderUserId?: string | null;
  defenderName?: string | null;
};

export function HeimatOverlay({
  tapPosition, onCloseTap, onEnterRelocateMode, defenderUserId, defenderName,
}: Props) {
  const [snap, setSnap] = useState<HeimatSnap | null>(null);
  const [openModal, setOpenModal] = useState<TapAction>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/base/heimat", { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json() as HeimatSnap;
      setSnap(j);
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(refresh, 10000);
    return () => clearInterval(id);
  }, [refresh]);

  // ── POI-Daten (Adresse + Crew-Owner) für aktuellen Tap-Punkt ────────
  const [poi, setPoi] = useState<HeimatPoi | null>(null);
  const [addr, setAddr] = useState<HeimatAddress>(null);
  const [poiLoading, setPoiLoading] = useState(false);
  const [openMarker, setOpenMarker] = useState<null | "personal" | "crew" | "share">(null);

  useEffect(() => {
    if (!tapPosition) { setPoi(null); setAddr(null); return; }
    setPoiLoading(true);
    fetch(`/api/heimat/poi?lat=${tapPosition.lat}&lng=${tapPosition.lng}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { poi?: HeimatPoi; address?: HeimatAddress }) => {
        setPoi(j.poi ?? null);
        setAddr(j.address ?? null);
      })
      .catch(() => {})
      .finally(() => setPoiLoading(false));
  }, [tapPosition]);

  // ── Tap-Action-Menu (CoD-Card-Style) ───────────────────────────────
  const tapMenu = tapPosition && (() => {
    const cardW = 300;
    const cardH = 360;
    const left = Math.min(window.innerWidth - cardW - 8, Math.max(8, tapPosition.screenX - cardW / 2));
    const top = Math.min(window.innerHeight - cardH - 8, Math.max(60, tapPosition.screenY - cardH - 16));
    // Owner-Logik: defenderName (Pin-Tap) > poi.owner_crew_tag (Turf) > "Unbesetzt"
    const crewTag = poi?.owner_crew_tag;
    const crewName = poi?.owner_crew_name;
    const crewColor = poi?.owner_crew_color || "#FF2D78";
    const ownerLabel = defenderUserId
      ? (defenderName ?? "Runner")
      : crewTag
        ? `[${crewTag}] ${crewName ?? ""}`.trim()
        : "Unbesetzt";
    const ownerColor = defenderUserId ? "#FF2D78" : crewTag ? crewColor : "#22D1C3";
    const locationTitle = addr?.street || addr?.suburb || addr?.city || "Standort";
    const locationSub = [addr?.suburb && addr?.suburb !== locationTitle ? addr.suburb : null,
                        addr?.city, addr?.postcode].filter(Boolean).join(" · ");
    return (
      <>
        {/* Backdrop schließt Menü */}
        <div className="fixed inset-0 z-[9090]" onClick={onCloseTap} />
        <div
          className="fixed z-[9100] bg-gradient-to-b from-[#1A1D23] to-[#0F1115] border border-[#22D1C3]/30 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden"
          style={{ left, top, width: cardW }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Hero-Bereich */}
          <div className="relative h-[110px] bg-gradient-to-br from-[#22D1C3]/30 via-[#FF2D78]/20 to-[#0F1115] flex items-center justify-center">
            <div className="absolute inset-0 opacity-20" style={{
              backgroundImage: "radial-gradient(circle at 20% 30%, #22D1C3 0%, transparent 50%), radial-gradient(circle at 80% 70%, #FF2D78 0%, transparent 50%)",
            }} />
            <div className="relative text-5xl filter drop-shadow-lg">📍</div>
            {/* Side-Action-Icons (3 Funktionen) — Glass-Morphism, kleiner */}
            <div className="absolute right-2 top-2 flex flex-col gap-1.5">
              <button
                className="w-7 h-7 rounded-full bg-white/10 backdrop-blur-md border border-[#FFD700]/50 text-[#FFD700] flex items-center justify-center text-[11px] font-bold shadow-[0_2px_8px_rgba(255,215,0,0.25)] hover:bg-[#FFD700]/20 hover:scale-110 transition-all"
                title="Persönliche Markierung"
                onClick={() => setOpenMarker("personal")}
              >★</button>
              <button
                className="w-7 h-7 rounded-full bg-white/10 backdrop-blur-md border border-[#22D1C3]/50 text-[#22D1C3] flex items-center justify-center text-[11px] font-bold shadow-[0_2px_8px_rgba(34,209,195,0.25)] hover:bg-[#22D1C3]/20 hover:scale-110 transition-all"
                title="Im Chat teilen"
                onClick={() => setOpenMarker("share")}
              >↗</button>
              <button
                className="w-7 h-7 rounded-full bg-white/10 backdrop-blur-md border border-[#FF2D78]/50 text-[#FF2D78] flex items-center justify-center text-[11px] font-bold shadow-[0_2px_8px_rgba(255,45,120,0.25)] hover:bg-[#FF2D78]/20 hover:scale-110 transition-all"
                title="Crew-Markierung"
                onClick={() => setOpenMarker("crew")}
              >ℹ</button>
            </div>
          </div>

          {/* Body */}
          <div className="px-4 pt-3 pb-3">
            <div className="text-base font-bold text-[#F0F0F0] leading-tight" title={locationTitle}>
              {poiLoading && !addr ? "..." : locationTitle}
            </div>
            {locationSub && <div className="text-[11px] text-[#8B8FA3] mb-2 truncate" title={locationSub}>{locationSub}</div>}
            <div className="flex items-center justify-between text-xs mb-3 mt-1">
              <span className="text-[#8B8FA3]">Crew</span>
              <span className="font-bold truncate ml-2" style={{ color: ownerColor }}>
                {ownerLabel}
              </span>
            </div>

            {/* Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { onEnterRelocateMode(); onCloseTap(); }}
                className="bg-gradient-to-b from-[#22D1C3] to-[#1AA89D] text-[#0F1115] font-bold py-2.5 rounded-lg text-sm shadow-md hover:from-[#26E5D6] active:scale-95 transition"
              >
                VERLEGEN
              </button>
              <button
                onClick={() => {
                  if (defenderUserId) setOpenModal({ kind: "multi", lat: tapPosition.lat, lng: tapPosition.lng });
                  else setOpenModal({ kind: "hide", lat: tapPosition.lat, lng: tapPosition.lng });
                  onCloseTap();
                }}
                className="bg-gradient-to-b from-[#FF2D78] to-[#C4135B] text-white font-bold py-2.5 rounded-lg text-sm shadow-md hover:from-[#FF4A8E] active:scale-95 transition"
              >
                EINSETZEN
              </button>
            </div>

            <div className="text-center text-[10px] text-[#8B8FA3] mt-3 font-mono">
              {tapPosition.lat.toFixed(4)}, {tapPosition.lng.toFixed(4)}
            </div>
          </div>
        </div>
      </>
    );
  })();

  // ── Marker-Modals (geöffnet aus Side-Icons) ────────────────────────
  const personalMarkerModal = openMarker === "personal" && tapPosition && (
    <PersonalMarkerModal
      coords={{ lat: tapPosition.lat, lng: tapPosition.lng }}
      onClose={() => setOpenMarker(null)}
      onSuccess={() => { setOpenMarker(null); onCloseTap(); }}
    />
  );
  const crewMarkerModal = openMarker === "crew" && tapPosition && (
    <CrewMarkerModal
      coords={{ lat: tapPosition.lat, lng: tapPosition.lng }}
      onClose={() => setOpenMarker(null)}
      onSuccess={() => { setOpenMarker(null); onCloseTap(); }}
    />
  );
  const sharePinModal = openMarker === "share" && tapPosition && (
    <SharePinModal
      coords={{ lat: tapPosition.lat, lng: tapPosition.lng }}
      onClose={() => setOpenMarker(null)}
      onSuccess={() => { setOpenMarker(null); onCloseTap(); }}
    />
  );

  // ── Eingehende Angriffe HUD ────────────────────────────────────────
  const incoming = snap?.incoming ?? [];
  const incomingHud = incoming.length > 0 && (
    <div className="fixed top-16 right-2 z-[9050] bg-[#0F1115]/95 border-2 border-[#FF2D78]/70 rounded-xl p-2 shadow-2xl backdrop-blur-md max-w-[280px]">
      <div className="text-[11px] uppercase tracking-wider text-[#FF2D78] font-bold pb-1 border-b border-white/10 mb-1 flex items-center gap-1.5">
        <span>🚨</span> <span>{incoming.length} eingehender Angriff{incoming.length > 1 ? "e" : ""}</span>
      </div>
      <div className="max-h-[200px] overflow-y-auto space-y-1">
        {incoming.slice(0, 5).map((m) => {
          const ms = new Date(m.ends_at).getTime() - Date.now();
          const sec = Math.max(0, Math.floor(ms / 1000));
          const mm = Math.floor(sec / 60), ss = sec % 60;
          return (
            <div key={m.id} className="text-[12px] text-[#F0F0F0] bg-white/5 rounded px-2 py-1.5">
              <div className="font-medium">
                {m.attacker_username ?? "?"}{m.attacker_crew_tag ? ` [${m.attacker_crew_tag}]` : ""}
              </div>
              <div className="text-[#8B8FA3] text-[11px]">
                {m.troop_count.toLocaleString("de-DE")} Truppen · {mm}:{String(ss).padStart(2, "0")}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Eigene Märsche HUD (Rückruf-Buttons) ──────────────────────────
  const ownMarches = (snap?.active_marches ?? []).filter((m) => m.is_own);

  // ── Modals (Verlegen/Multi/Hide) ──────────────────────────────────
  const verlegenModal = (() => {
    if (!snap) return null;
    if (!tapPosition) return null;
    // Verlegen wird vom Parent gestartet (onEnterRelocateMode). Wir zeigen
    // Status / Cooldown-Hinweis falls relevant.
    return null;
  })();

  const marchModal = openModal?.kind === "march" && defenderUserId && (
    <SimpleAttackModal
      defenderUserId={defenderUserId}
      defenderName={defenderName ?? "Ziel"}
      onClose={() => { setOpenModal(null); void refresh(); }}
    />
  );

  const multiModal = openModal?.kind === "multi" && defenderUserId && (
    <MultiLegionModal
      defenderUserId={defenderUserId}
      defenderName={defenderName ?? "Ziel"}
      onClose={() => { setOpenModal(null); void refresh(); }}
    />
  );

  const hideModal = openModal?.kind === "hide" && (
    <HideInBuildingModal
      lat={openModal.lat}
      lng={openModal.lng}
      onClose={() => { setOpenModal(null); void refresh(); }}
    />
  );

  return (
    <>
      {tapMenu}
      {personalMarkerModal}
      {crewMarkerModal}
      {sharePinModal}
      {incomingHud}
      {verlegenModal}
      {marchModal}
      {multiModal}
      {hideModal}
      {ownMarches.length > 0 && (
        <div className="fixed bottom-24 right-2 z-[9040] bg-[#0F1115]/95 border border-[#22D1C3]/40 rounded-xl p-2 shadow-2xl backdrop-blur-md max-w-[280px]">
          <div className="text-[10px] uppercase tracking-wider text-[#22D1C3] font-bold pb-1 border-b border-white/10 mb-1">
            Eigene Märsche ({ownMarches.length})
          </div>
          <div className="max-h-[180px] overflow-y-auto space-y-1">
            {ownMarches.map((m) => {
              const ms = new Date(m.ends_at).getTime() - Date.now();
              const sec = Math.max(0, Math.floor(ms / 1000));
              const mm = Math.floor(sec / 60), ss = sec % 60;
              return (
                <div key={m.id} className="text-[12px] text-[#F0F0F0] bg-white/5 rounded px-2 py-1.5">
                  <div className="font-medium">
                    {m.legion_label ?? `Legion`} · {m.troop_count.toLocaleString("de-DE")} Truppen
                  </div>
                  <div className="text-[#8B8FA3] text-[11px]">
                    {mm}:{String(ss).padStart(2, "0")}{m.redirect_count > 0 ? ` · ${m.redirect_count}× umgelenkt` : ""}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════
// SUB-MODALS
// ════════════════════════════════════════════════════════════════════

function SimpleAttackModal({ defenderUserId, defenderName, onClose }: {
  defenderUserId: string; defenderName: string; onClose: () => void;
}) {
  const [troops, setTroops] = useState<Record<string, number>>({});
  const [guardianId, setGuardianId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [available, setAvailable] = useState<Array<{ id: string; name: string; tier: number; have: number }>>([]);
  const [guardians, setGuardians] = useState<Array<{ id: string; name: string; level: number }>>([]);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/base/heimat-troops", { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json() as { troops?: Array<{ id: string; name: string; tier: number; have: number }>; guardians?: Array<{ id: string; name: string; level: number }> };
      setAvailable(j.troops ?? []);
      setGuardians(j.guardians ?? []);
    })();
  }, []);

  const total = Object.values(troops).reduce((a, b) => a + (b || 0), 0);

  async function go() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/base/legion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defender_user_id: defenderUserId,
          troops,
          guardian_id: guardianId,
          legion_label: label || null,
        }),
      });
      const j = await r.json() as { ok?: boolean; error?: string; results?: Array<{ ok: boolean; error?: string; march_seconds?: number }>; march_seconds?: number };
      if (j.ok) { setMsg(`✅ Marsch gestartet`); setTimeout(onClose, 1200); }
      else setMsg(`❌ ${j.error ?? j.results?.[0]?.error ?? "Fehler"}`);
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[9200] bg-black/70 flex items-end sm:items-center justify-center p-2" onClick={onClose}>
      <div className="bg-[#1A1D23] border border-[#22D1C3]/30 rounded-2xl p-4 w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#8B8FA3]">Legion erstellen</div>
            <div className="text-lg font-bold text-[#F0F0F0]">→ {defenderName}</div>
          </div>
          <button onClick={onClose} className="text-[#8B8FA3] hover:text-white px-2">✕</button>
        </div>
        <input
          value={label} onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (optional)"
          className="w-full bg-[#0F1115] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#F0F0F0] mb-3"
        />
        {guardians.length > 0 && (
          <div className="mb-3">
            <div className="text-[11px] text-[#8B8FA3] mb-1">Wächter</div>
            <select value={guardianId ?? ""} onChange={(e) => setGuardianId(e.target.value || null)}
              className="w-full bg-[#0F1115] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#F0F0F0]">
              <option value="">Kein Wächter</option>
              {guardians.map((g) => <option key={g.id} value={g.id}>{g.name} (Lv {g.level})</option>)}
            </select>
          </div>
        )}
        <div className="space-y-2 mb-3">
          <div className="text-[11px] text-[#8B8FA3]">Truppen</div>
          {available.map((t) => (
            <div key={t.id} className="flex items-center gap-2">
              <span className="text-xs text-[#F0F0F0] flex-1">{t.name} (T{t.tier}) · {t.have.toLocaleString("de-DE")}</span>
              <input
                type="number" min={0} max={t.have}
                value={troops[t.id] ?? 0}
                onChange={(e) => setTroops((p) => ({ ...p, [t.id]: Math.max(0, Math.min(t.have, parseInt(e.target.value || "0", 10))) }))}
                className="w-24 bg-[#0F1115] border border-white/10 rounded px-2 py-1 text-xs text-[#F0F0F0]"
              />
            </div>
          ))}
        </div>
        <div className="text-xs text-[#8B8FA3] mb-2">Total: {total.toLocaleString("de-DE")} Truppen</div>
        {msg && <div className="text-xs mb-2 text-[#F0F0F0]">{msg}</div>}
        <button
          disabled={busy || total < 10}
          onClick={go}
          className="w-full bg-gradient-to-r from-[#FF2D78] to-[#22D1C3] text-white font-bold py-2.5 rounded-lg disabled:opacity-50"
        >
          {busy ? "..." : "Aufgebot senden"}
        </button>
      </div>
    </div>
  );
}

function MultiLegionModal({ defenderUserId, defenderName, onClose }: {
  defenderUserId: string; defenderName: string; onClose: () => void;
}) {
  type Legion = { troops: Record<string, number>; guardian_id: string | null; label: string };
  const [legions, setLegions] = useState<Legion[]>([{ troops: {}, guardian_id: null, label: "Legion 1" }]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [available, setAvailable] = useState<Array<{ id: string; name: string; tier: number; have: number }>>([]);
  const [guardians, setGuardians] = useState<Array<{ id: string; name: string; level: number }>>([]);
  const [maxQueue, setMaxQueue] = useState(1);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/base/troops", { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json() as { troops?: Array<{ id: string; name: string; tier: number; have: number }>; guardians?: Array<{ id: string; name: string; level: number }>; march_queue?: number };
      setAvailable(j.troops ?? []);
      setGuardians(j.guardians ?? []);
      setMaxQueue(j.march_queue ?? 1);
    })();
  }, []);

  function addLegion() {
    if (legions.length >= maxQueue) return;
    setLegions([...legions, { troops: {}, guardian_id: null, label: `Legion ${legions.length + 1}` }]);
  }
  function removeLegion(idx: number) {
    setLegions(legions.filter((_, i) => i !== idx));
  }
  function updateLegion(idx: number, patch: Partial<Legion>) {
    setLegions(legions.map((l, i) => i === idx ? { ...l, ...patch } : l));
  }

  async function go() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/base/legion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legions: legions.map((l) => ({
            defender_user_id: defenderUserId,
            troops: l.troops,
            guardian_id: l.guardian_id,
            legion_label: l.label,
          })),
        }),
      });
      const j = await r.json() as { ok?: boolean; results?: Array<{ ok: boolean; error?: string }> };
      if (j.ok) { setMsg(`✅ ${legions.length} Legionen unterwegs`); setTimeout(onClose, 1500); }
      else {
        const failed = (j.results ?? []).filter((r) => !r.ok);
        setMsg(`❌ ${failed.length} Legionen fehlgeschlagen: ${failed.map((f) => f.error).join(", ")}`);
      }
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[9200] bg-black/70 flex items-end sm:items-center justify-center p-2" onClick={onClose}>
      <div className="bg-[#1A1D23] border border-[#FF6B4A]/40 rounded-2xl p-4 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#FF6B4A]">Multi-Aufgebot</div>
            <div className="text-lg font-bold text-[#F0F0F0]">→ {defenderName}</div>
            <div className="text-xs text-[#8B8FA3]">{legions.length} / {maxQueue} Slots</div>
          </div>
          <button onClick={onClose} className="text-[#8B8FA3] hover:text-white px-2">✕</button>
        </div>
        {legions.map((l, idx) => {
          const total = Object.values(l.troops).reduce((a, b) => a + (b || 0), 0);
          return (
            <div key={idx} className="border border-white/10 rounded-lg p-2 mb-2 bg-white/[0.03]">
              <div className="flex items-center gap-2 mb-2">
                <input
                  value={l.label} onChange={(e) => updateLegion(idx, { label: e.target.value })}
                  className="flex-1 bg-[#0F1115] border border-white/10 rounded px-2 py-1 text-xs text-[#F0F0F0]"
                />
                <button onClick={() => removeLegion(idx)} className="text-[#FF2D78] text-xs px-2">✕</button>
              </div>
              <select
                value={l.guardian_id ?? ""}
                onChange={(e) => updateLegion(idx, { guardian_id: e.target.value || null })}
                className="w-full bg-[#0F1115] border border-white/10 rounded px-2 py-1 text-xs text-[#F0F0F0] mb-2"
              >
                <option value="">Kein Wächter</option>
                {guardians.map((g) => <option key={g.id} value={g.id}>{g.name} (Lv {g.level})</option>)}
              </select>
              <div className="space-y-1">
                {available.map((t) => (
                  <div key={t.id} className="flex items-center gap-2">
                    <span className="text-[11px] text-[#8B8FA3] flex-1">{t.name} (T{t.tier})</span>
                    <input
                      type="number" min={0} max={t.have}
                      value={l.troops[t.id] ?? 0}
                      onChange={(e) => updateLegion(idx, { troops: { ...l.troops, [t.id]: Math.max(0, Math.min(t.have, parseInt(e.target.value || "0", 10))) } })}
                      className="w-20 bg-[#0F1115] border border-white/10 rounded px-2 py-1 text-[11px] text-[#F0F0F0]"
                    />
                  </div>
                ))}
              </div>
              <div className="text-[11px] text-[#8B8FA3] mt-1">Σ {total.toLocaleString("de-DE")}</div>
            </div>
          );
        })}
        {legions.length < maxQueue && (
          <button onClick={addLegion} className="w-full border border-dashed border-white/20 rounded-lg py-2 text-xs text-[#8B8FA3] hover:bg-white/5 mb-3">
            + Legion hinzufügen
          </button>
        )}
        {msg && <div className="text-xs mb-2 text-[#F0F0F0]">{msg}</div>}
        <button
          disabled={busy || legions.length === 0}
          onClick={go}
          className="w-full bg-gradient-to-r from-[#FF6B4A] to-[#FF2D78] text-white font-bold py-2.5 rounded-lg disabled:opacity-50"
        >
          {busy ? "..." : `${legions.length} Legion${legions.length > 1 ? "en" : ""} losschicken`}
        </button>
      </div>
    </div>
  );
}

function HideInBuildingModal({ lat, lng, onClose }: { lat: number; lng: number; onClose: () => void }) {
  const [troops, setTroops] = useState<Record<string, number>>({});
  const [targetKind, setTargetKind] = useState<"base" | "crew_repeater" | "wegelager" | "mega_repeater">("base");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [available, setAvailable] = useState<Array<{ id: string; name: string; tier: number; have: number }>>([]);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/base/troops", { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json() as { troops?: Array<{ id: string; name: string; tier: number; have: number }> };
      setAvailable(j.troops ?? []);
    })();
  }, []);

  const total = Object.values(troops).reduce((a, b) => a + (b || 0), 0);

  async function go() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/base/hide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_kind: targetKind, target_lat: lat, target_lng: lng, troops }),
      });
      const j = await r.json() as { ok?: boolean; error?: string; total_troops?: number };
      if (j.ok) { setMsg(`✅ ${j.total_troops} Truppen versteckt`); setTimeout(onClose, 1200); }
      else setMsg(`❌ ${j.error ?? "Fehler"}`);
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[9200] bg-black/70 flex items-end sm:items-center justify-center p-2" onClick={onClose}>
      <div className="bg-[#1A1D23] border border-[#FFD700]/40 rounded-2xl p-4 w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#FFD700]">Truppen verstecken</div>
            <div className="text-sm text-[#8B8FA3]">In Gebäude bei {lat.toFixed(4)}, {lng.toFixed(4)}</div>
          </div>
          <button onClick={onClose} className="text-[#8B8FA3] hover:text-white px-2">✕</button>
        </div>
        <div className="mb-3">
          <div className="text-[11px] text-[#8B8FA3] mb-1">Gebäude-Typ</div>
          <select value={targetKind} onChange={(e) => setTargetKind(e.target.value as typeof targetKind)}
            className="w-full bg-[#0F1115] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#F0F0F0]">
            <option value="base">Eigene Base</option>
            <option value="crew_repeater">Crew-Repeater</option>
            <option value="wegelager">Wegelager</option>
            <option value="mega_repeater">Mega-Repeater</option>
          </select>
        </div>
        <div className="space-y-2 mb-3">
          {available.map((t) => (
            <div key={t.id} className="flex items-center gap-2">
              <span className="text-xs text-[#F0F0F0] flex-1">{t.name} (T{t.tier}) · {t.have.toLocaleString("de-DE")}</span>
              <input
                type="number" min={0} max={t.have}
                value={troops[t.id] ?? 0}
                onChange={(e) => setTroops((p) => ({ ...p, [t.id]: Math.max(0, Math.min(t.have, parseInt(e.target.value || "0", 10))) }))}
                className="w-24 bg-[#0F1115] border border-white/10 rounded px-2 py-1 text-xs text-[#F0F0F0]"
              />
            </div>
          ))}
        </div>
        <div className="text-xs text-[#8B8FA3] mb-2">Total: {total.toLocaleString("de-DE")}</div>
        {msg && <div className="text-xs mb-2 text-[#F0F0F0]">{msg}</div>}
        <button
          disabled={busy || total < 1}
          onClick={go}
          className="w-full bg-[#FFD700] text-[#0F1115] font-bold py-2.5 rounded-lg disabled:opacity-50"
        >
          {busy ? "..." : "Verstecken"}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// RELOCATE-FLOW (eigene Komponente, mountet via Parent-Trigger)
// ════════════════════════════════════════════════════════════════════
export function HeimatRelocateConfirm({
  newLat, newLng, currentLat, currentLng, onCancel, onSuccess,
}: {
  newLat: number; newLng: number;
  currentLat: number; currentLng: number;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const distM = useMemo(() => {
    const R = 6371000;
    const dLat = ((newLat - currentLat) * Math.PI) / 180;
    const dLng = ((newLng - currentLng) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos((currentLat * Math.PI) / 180) * Math.cos((newLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
    return Math.round(2 * R * Math.asin(Math.sqrt(a)));
  }, [newLat, newLng, currentLat, currentLng]);

  async function go() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/base/relocate-v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: newLat, lng: newLng }),
      });
      const j = await r.json() as { ok?: boolean; error?: string; cost_gold?: number; distance_m?: number };
      if (j.ok) { setMsg(`✅ Base verlegt (${j.distance_m} m, -${j.cost_gold} Krypto)`); setTimeout(onSuccess, 1200); }
      else setMsg(`❌ ${j.error ?? "Fehler"}`);
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-x-2 bottom-20 z-[9100] bg-[#0F1115]/95 border-2 border-[#22D1C3]/60 rounded-xl p-3 shadow-2xl backdrop-blur-md max-w-md mx-auto">
      <div className="text-[11px] uppercase tracking-wider text-[#22D1C3] mb-1 flex items-center gap-1.5">
        <span>🏠</span> Base verlegen
      </div>
      <div className="text-xs text-[#F0F0F0] mb-1">
        Distanz: <b>{distM.toLocaleString("de-DE")} m</b> {distM > 5000 && <span className="text-[#FF2D78]">(zu weit, max. 5 km)</span>}
      </div>
      <div className="text-xs text-[#8B8FA3] mb-2">Kosten: 50 Krypto · Cooldown: 24 h</div>
      {msg && <div className="text-xs mb-2 text-[#F0F0F0]">{msg}</div>}
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 bg-white/5 text-[#8B8FA3] py-2 rounded-lg text-sm">Abbrechen</button>
        <button
          disabled={busy || distM > 5000}
          onClick={go}
          className="flex-1 bg-gradient-to-r from-[#22D1C3] to-[#FF2D78] text-white font-bold py-2 rounded-lg disabled:opacity-50 text-sm"
        >
          {busy ? "..." : "Verlegen bestätigen"}
        </button>
      </div>
    </div>
  );
}
