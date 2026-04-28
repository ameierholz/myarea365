"use client";

import { useEffect, useState } from "react";
import { UiIcon, useUiIconArt } from "@/components/resource-icon";
import { createClient } from "@/lib/supabase/client";

const PRIMARY = "#22D1C3";
const ACCENT = "#FF2D78";

type Repeater = {
  id: string;
  crew_id: string;
  crew_name: string | null;
  crew_tag: string | null;
  kind: "hq" | "repeater" | "mega";
  label: string | null;
  lat: number;
  lng: number;
  hp: number;
  max_hp: number;
  shield_until?: string | null;
  is_own: boolean;
};

const KIND_LABEL: Record<Repeater["kind"], string> = {
  hq: "Hauptquartier",
  mega: "Mega-Server",
  repeater: "Signal-Repeater",
};

const KIND_SLOT: Record<Repeater["kind"], string> = {
  hq: "repeater_hq",
  mega: "repeater_mega",
  repeater: "repeater_normal",
};

const KIND_FALLBACK: Record<Repeater["kind"], string> = {
  hq: "🏛️",
  mega: "📡",
  repeater: "📶",
};

/**
 * Kompakter Info-Popup direkt neben dem geklickten Repeater.
 * Kein Backdrop — Karte bleibt sichtbar/interaktiv.
 * Click irgendwo schließt. Für fremde Repeater zeigt sich ein Angriffs-CTA;
 * für eigene reicht die Info-Anzeige (kein "Öffnen"-Button mehr).
 */
export function RepeaterInfoPopup({
  repeater, anchorX, anchorY, onClose, onAttack, onDestroyed, onRepaired, userCenter,
}: {
  repeater: Repeater;
  anchorX: number;
  anchorY: number;
  onClose: () => void;
  onAttack: () => void;
  onDestroyed?: () => void;
  onRepaired?: () => void;
  userCenter?: { lat: number; lng: number } | null;
}) {
  const uiArt = useUiIconArt();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);

  // Crew-Rolle laden (für Zerstören-Berechtigung — nur Leader/Officer)
  const [canDestroy, setCanDestroy] = useState(false);
  useEffect(() => {
    if (!repeater.is_own) return;
    (async () => {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      const { data } = await sb.from("crew_members").select("role").eq("user_id", user.id).maybeSingle();
      const role = (data as { role?: string } | null)?.role;
      setCanDestroy(role === "leader" || role === "officer");
    })();
  }, [repeater.is_own]);

  const [confirmDestroy, setConfirmDestroy] = useState(false);
  const [destroying, setDestroying] = useState(false);
  const [destroyErr, setDestroyErr] = useState<string | null>(null);
  const [repairing, setRepairing] = useState(false);
  const [repairErr, setRepairErr] = useState<string | null>(null);

  // Repair-Kosten-Preview (Basis 5g/3w/3s pro HP, -50% wenn im eigenen Turf)
  const hpMissing = Math.max(0, repeater.max_hp - repeater.hp);
  const repairCostBase = { gold: 5 * hpMissing, wood: 3 * hpMissing, stone: 3 * hpMissing };
  // Turf-Discount-Vorhersage: wir wissen Client-seitig nicht ob im eigenen Turf,
  // aber wenn der User-Pin nahe am Repeater ist (< 600m), zeigen wir "wahrscheinlich Discount" an.
  const distToRepeaterM = userCenter
    ? haversineM(userCenter.lat, userCenter.lng, repeater.lat, repeater.lng)
    : Infinity;
  const likelyTurfDiscount = distToRepeaterM < 600;

  async function doRepair() {
    setRepairing(true);
    setRepairErr(null);
    const sb = createClient();
    const { data, error } = await sb.rpc("repair_crew_repeater", {
      p_repeater_id: repeater.id,
      p_hp_amount: hpMissing,
      p_runner_lat: userCenter?.lat ?? null,
      p_runner_lng: userCenter?.lng ?? null,
    });
    setRepairing(false);
    const res = data as { ok?: boolean; error?: string; need?: { gold: number; wood: number; stone: number } } | null;
    if (error || !res?.ok) {
      const need = res?.need;
      setRepairErr(
        res?.error === "insufficient_resources" && need
          ? `Brauchst ${need.gold} Gold / ${need.wood} Holz / ${need.stone} Stein`
          : res?.error || error?.message || "Reparatur fehlgeschlagen"
      );
      return;
    }
    onRepaired?.();
    onClose();
  }

  async function doDestroy() {
    setDestroying(true);
    setDestroyErr(null);
    const sb = createClient();
    const { data, error } = await sb.rpc("destroy_own_crew_repeater", { p_repeater_id: repeater.id });
    setDestroying(false);
    const res = data as { ok?: boolean; error?: string; hint?: string } | null;
    if (error || !res?.ok) {
      setDestroyErr(res?.hint || res?.error || error?.message || "Fehler beim Zerstören");
      return;
    }
    onDestroyed?.();
    onClose();
  }

  // Click anywhere (außer im Popup selbst) schließt
  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest("[data-repeater-popup]")) return;
      onClose();
    };
    // mousedown statt click damit es nicht den Pin-click direkt nach Öffnen schluckt
    setTimeout(() => {
      document.addEventListener("mousedown", onDown);
      document.addEventListener("touchstart", onDown);
    }, 0);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [onClose]);

  const hpPct = Math.max(0, Math.min(100, (repeater.hp / Math.max(repeater.max_hp, 1)) * 100));
  const shieldActive = repeater.shield_until && new Date(repeater.shield_until).getTime() > now;
  const shieldRemainSec = shieldActive ? Math.floor((new Date(repeater.shield_until!).getTime() - now) / 1000) : 0;

  const status = repeater.hp <= 0 ? "Zerstört" : shieldActive ? `🛡 Schild ${Math.floor(shieldRemainSec/60)}:${String(shieldRemainSec%60).padStart(2,"0")}` : "Aktiv";
  const statusColor = repeater.hp <= 0 ? "#FF2D78" : shieldActive ? "#FFD700" : "#4ade80";

  const accentColor = repeater.is_own ? PRIMARY : ACCENT;

  // Position berechnen — versucht oben-rechts vom Anker, mit Viewport-Clamp
  const PW = 320, PH = 380;
  const margin = 12;
  let left = anchorX + 24;
  let top = anchorY - PH / 2;
  if (typeof window !== "undefined") {
    if (left + PW + margin > window.innerWidth) left = anchorX - PW - 24;
    if (left < margin) left = margin;
    if (top < margin) top = margin;
    if (top + PH + margin > window.innerHeight) top = window.innerHeight - PH - margin;
  }

  return (
    <div
      data-repeater-popup
      style={{
        position: "fixed",
        left, top,
        width: PW,
        zIndex: 9000,
        background: "rgba(15,17,21,0.96)",
        border: `1px solid ${accentColor}66`,
        borderRadius: 14,
        boxShadow: `0 12px 40px rgba(0,0,0,0.55), 0 0 24px ${accentColor}33`,
        overflow: "hidden",
        backdropFilter: "blur(8px)",
      }}
    >
      {/* Hero-Header: großes Artwork in stylischer Bühne mit radialen Spray-Akzenten */}
      <div style={{
        position: "relative",
        padding: "20px 16px 14px",
        // Bühne: Crew-farbene radiale Spots + diagonale Stencil-Streifen,
        // dunkler Boden — das Artwork hat dann was zum draufknallen
        background: `
          radial-gradient(ellipse at 30% 20%, ${accentColor}55 0%, transparent 55%),
          radial-gradient(ellipse at 75% 75%, ${accentColor}33 0%, transparent 50%),
          repeating-linear-gradient(45deg, transparent 0 14px, rgba(255,255,255,0.025) 14px 16px),
          linear-gradient(180deg, rgba(20,22,28,0.85) 0%, rgba(15,17,21,0.95) 100%)
        `,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
        overflow: "hidden",
      }}>
        {/* Spray-Splash hinter dem Artwork als Halo */}
        <div style={{
          position: "absolute", top: 18, left: "50%", transform: "translateX(-50%)",
          width: 200, height: 200, borderRadius: "50%",
          background: `radial-gradient(circle, ${accentColor}66 0%, ${accentColor}22 35%, transparent 65%)`,
          filter: "blur(2px)", pointerEvents: "none",
        }} />
        <div style={{
          position: "relative",
          width: 180, height: 180,
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden",
          filter: `drop-shadow(0 6px 18px ${accentColor}88) drop-shadow(0 0 14px ${accentColor}55)`,
        }}>
          {/* Inner scale wrapper — zoomt INs Video rein um den Greenscreen-Padding-Rand wegzuschneiden */}
          <div style={{
            width: 180, height: 180,
            transform: "scale(1.7)",
            transformOrigin: "center center",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <UiIcon
              slot={KIND_SLOT[repeater.kind]}
              fallback={KIND_FALLBACK[repeater.kind]}
              art={uiArt}
              size={180}
            />
          </div>
        </div>
        <div style={{ position: "relative", color: "#FFF", fontSize: 24, fontWeight: 400, fontFamily: "var(--font-display-stack)", letterSpacing: 0.6, marginTop: 6, textAlign: "center", textShadow: `0 0 12px ${accentColor}88, 0 2px 4px rgba(0,0,0,0.7)` }}>
          {repeater.label || KIND_LABEL[repeater.kind]}
        </div>
        <div style={{ position: "relative", color: accentColor, fontSize: 10, fontWeight: 900, letterSpacing: 1.2, textTransform: "uppercase", fontFamily: "var(--font-display-stack)" }}>
          {KIND_LABEL[repeater.kind]}
        </div>
      </div>

      {/* Info-Rows */}
      <div style={{ padding: "4px 14px 14px" }}>
        <Row label="Besitzer" value={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, justifyContent: "flex-end", flexWrap: "wrap" }}>
            {repeater.crew_tag && (
              <span style={{
                padding: "2px 5px", borderRadius: 5,
                background: `${accentColor}22`, color: accentColor,
                fontSize: 9, fontWeight: 900, letterSpacing: 0.5,
              }}>{repeater.crew_tag}</span>
            )}
            <span style={{ color: "#FFF", fontWeight: 700, fontSize: 12 }}>{repeater.crew_name ?? "—"}</span>
            {repeater.is_own && <span style={{ color: PRIMARY, fontSize: 9, fontWeight: 800 }}>(deine Crew)</span>}
          </span>
        } />

        <div style={{ marginTop: 8, marginBottom: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <span style={{ color: "#8B8FA3", fontSize: 11, fontWeight: 700 }}>Haltbarkeit</span>
            <span style={{ color: "#FFF", fontSize: 11, fontWeight: 800 }}>
              {repeater.hp.toLocaleString("de-DE")} / {repeater.max_hp.toLocaleString("de-DE")}
            </span>
          </div>
          <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{
              width: `${hpPct}%`, height: "100%",
              background: `linear-gradient(90deg, ${hpPct > 50 ? "#22D1C3" : hpPct > 20 ? "#FFD700" : "#FF2D78"}, ${hpPct > 50 ? "#1ba89c" : hpPct > 20 ? "#FFA500" : "#e6266b"})`,
              transition: "width 0.3s",
            }} />
          </div>
        </div>

        <Row label="Status" value={<span style={{ color: statusColor, fontWeight: 900, fontSize: 12 }}>{status}</span>} />

        {/* Angriffs-CTA nur für fremde Repeater — eigene haben kein Modal-Folgeschritt nötig */}
        {!repeater.is_own && repeater.hp > 0 && !shieldActive && (
          <button
            onClick={onAttack}
            style={{
              width: "100%", marginTop: 12, padding: "10px 14px", borderRadius: 10,
              background: `linear-gradient(135deg, ${ACCENT}, #FF6B4A)`,
              border: "none", color: "#FFF",
              fontSize: 13, fontWeight: 900, letterSpacing: 0.5,
              fontFamily: "var(--font-display-stack)",
              cursor: "pointer",
              boxShadow: `0 4px 12px ${ACCENT}55`,
            }}
          >
            ANGREIFEN
          </button>
        )}

        {/* Reparieren-Aktion: alle Crew-Member dürfen reparieren, wenn HP < max */}
        {repeater.is_own && hpMissing > 0 && (
          <div style={{ marginTop: 12 }}>
            <button
              onClick={() => void doRepair()}
              disabled={repairing}
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 10,
                background: `linear-gradient(135deg, ${PRIMARY}, #1ba89c)`,
                border: "none", color: "#0F1115",
                fontSize: 12, fontWeight: 900, letterSpacing: 0.4,
                fontFamily: "var(--font-display-stack)",
                cursor: repairing ? "wait" : "pointer",
                boxShadow: `0 4px 12px ${PRIMARY}55`,
                opacity: repairing ? 0.7 : 1,
                display: "flex", flexDirection: "column", gap: 2, alignItems: "center",
              }}
            >
              <span>🔧 {repairing ? "REPARIERE..." : "VOLL REPARIEREN"}</span>
              <span style={{ fontSize: 9, fontWeight: 800, opacity: 0.85, letterSpacing: 0.3, fontFamily: "system-ui" }}>
                {likelyTurfDiscount
                  ? `${Math.ceil(repairCostBase.gold * 0.5)}🪙 ${Math.ceil(repairCostBase.wood * 0.5)}🪵 ${Math.ceil(repairCostBase.stone * 0.5)}🪨 (Turf-Bonus −50%)`
                  : `${repairCostBase.gold}🪙 ${repairCostBase.wood}🪵 ${repairCostBase.stone}🪨`}
              </span>
            </button>
            {repairErr && (
              <div style={{ marginTop: 6, color: "#FF2D78", fontSize: 10, fontWeight: 800, textAlign: "center" }}>
                {repairErr}
              </div>
            )}
          </div>
        )}

        {/* Zerstören-Aktion: nur eigene Repeater + Leader/Officer */}
        {repeater.is_own && canDestroy && (
          <div style={{ marginTop: 12 }}>
            {!confirmDestroy ? (
              <button
                onClick={() => setConfirmDestroy(true)}
                style={{
                  width: "100%", padding: "8px 12px", borderRadius: 10,
                  background: "rgba(255,45,120,0.12)",
                  border: "1px solid rgba(255,45,120,0.35)",
                  color: "#FF2D78",
                  fontSize: 11, fontWeight: 800, letterSpacing: 0.5,
                  cursor: "pointer",
                }}
              >
                ⚠ Repeater zerstören
              </button>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ color: "#FFD700", fontSize: 10, fontWeight: 800, lineHeight: 1.4, textAlign: "center" }}>
                  Sicher? Du bekommst <b>50%</b> der Baukosten als Gutschrift zurück. Das Crew-Turf schrumpft sofort.
                </div>
                {destroyErr && (
                  <div style={{ color: "#FF2D78", fontSize: 10, fontWeight: 800, textAlign: "center" }}>
                    {destroyErr}
                  </div>
                )}
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    disabled={destroying}
                    onClick={() => { setConfirmDestroy(false); setDestroyErr(null); }}
                    style={{
                      flex: 1, padding: "8px 12px", borderRadius: 10,
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.18)",
                      color: "#FFF", fontSize: 11, fontWeight: 800, cursor: "pointer",
                    }}
                  >
                    Abbrechen
                  </button>
                  <button
                    disabled={destroying}
                    onClick={() => void doDestroy()}
                    style={{
                      flex: 1, padding: "8px 12px", borderRadius: 10,
                      background: "linear-gradient(135deg, #FF2D78, #c41a5e)",
                      border: "none", color: "#FFF",
                      fontSize: 11, fontWeight: 900, letterSpacing: 0.5,
                      cursor: destroying ? "wait" : "pointer",
                      opacity: destroying ? 0.7 : 1,
                    }}
                  >
                    {destroying ? "..." : "Zerstören"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
      padding: "6px 0",
      borderTop: "1px solid rgba(255,255,255,0.06)",
    }}>
      <span style={{ color: "#8B8FA3", fontSize: 11, fontWeight: 700 }}>{label}</span>
      <span style={{ color: "#FFF", fontSize: 12, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const la1 = (lat1 * Math.PI) / 180, la2 = (lat2 * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
