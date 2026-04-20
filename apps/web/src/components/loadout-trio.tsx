"use client";

import { useState, useEffect } from "react";
import { GuardianAvatar } from "@/components/guardian-avatar";
import { GuardianGalleryModal } from "@/components/guardian-gallery-modal";
import { GuardianDetailModal } from "@/components/guardian-detail-modal";
import { MarkerPickerModal } from "@/components/marker-picker-modal";
import { LightPickerModal } from "@/components/light-picker-modal";
import {
  rarityMeta, TYPE_META,
  type GuardianArchetype, type GuardianType,
} from "@/lib/guardian";
import { UNLOCKABLE_MARKERS, RUNNER_LIGHTS } from "@/lib/game-config";

const PRIMARY = "#5ddaf0";

type OwnedGuardian = {
  id: string;
  archetype_id: string;
  custom_name: string | null;
  level: number;
  xp: number;
  wins: number;
  losses: number;
  is_active: boolean;
  talent_points_available: number;
  acquired_at: string;
  archetype: GuardianArchetype;
};

type CollectionResponse = {
  owned: OwnedGuardian[];
  archetypes: GuardianArchetype[];
  active_id: string | null;
};

export function LoadoutTrio({
  userXp, equippedMarker, equippedLight, onEquipMarker, onEquipLight, isAdmin = false,
}: {
  userXp: number;
  equippedMarker: string;
  equippedLight: string;
  onEquipMarker: (id: string) => void;
  onEquipLight: (id: string) => void;
  isAdmin?: boolean;
}) {
  const [col, setCol] = useState<CollectionResponse | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [markerOpen, setMarkerOpen] = useState(false);
  const [lightOpen, setLightOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/guardian/my-collection");
    if (res.ok) setCol(await res.json() as CollectionResponse);
  }
  useEffect(() => { load(); }, []);

  async function activateGuardian(guardianId: string) {
    setBusy(true);
    try {
      await fetch("/api/guardian/my-collection", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "activate", guardian_id: guardianId }),
      });
      await load();
    } finally { setBusy(false); }
  }

  async function claimStarter(archetypeId: string) {
    setBusy(true);
    try {
      await fetch("/api/guardian/claim-starter", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ archetype_id: archetypeId }),
      });
      await load();
    } finally { setBusy(false); }
  }

  const active = col?.owned.find((g) => g.is_active) ?? null;
  const currentMarker = UNLOCKABLE_MARKERS.find((m) => m.id === equippedMarker) || UNLOCKABLE_MARKERS[0];
  const currentLight = RUNNER_LIGHTS.find((l) => l.id === equippedLight) || RUNNER_LIGHTS[0];
  const lightGradient = currentLight.gradient.length > 1
    ? `linear-gradient(90deg, ${currentLight.gradient.join(", ")})`
    : currentLight.color;

  // Starter-Wahl wenn noch kein Wächter vorhanden
  if (col && col.owned.length === 0) {
    return (
      <div style={{
        padding: 14, borderRadius: 14,
        background: "linear-gradient(135deg, rgba(34,209,195,0.18), rgba(255,45,120,0.1))",
        border: "1px solid rgba(34,209,195,0.4)",
      }}>
        <div style={{ color: "#22D1C3", fontSize: 10, fontWeight: 900, letterSpacing: 1.5, marginBottom: 4 }}>
          🎮 WÄHLE DEINEN STARTER
        </div>
        <div style={{ color: "#FFF", fontSize: 12, marginBottom: 10 }}>
          Such dir einen Elite-Wächter aus — je nach Typ spielt er sich anders.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 6 }}>
          {col.archetypes.filter((a) => a.rarity === "elite").map((a) => {
            const typ = a.guardian_type ? TYPE_META[a.guardian_type] : null;
            return (
              <button key={a.id} onClick={() => claimStarter(a.id)} disabled={busy}
                style={{
                  padding: 8, borderRadius: 10, textAlign: "left",
                  background: "rgba(15,17,21,0.6)", border: "1px solid rgba(34,209,195,0.3)",
                  color: "#FFF", cursor: busy ? "not-allowed" : "pointer",
                }}>
                <div style={{ width: "100%", aspectRatio: "1 / 1", display: "flex", justifyContent: "center", marginBottom: 4 }}>
                  <GuardianAvatar archetype={a} size={72} animation="idle" />
                </div>
                <div style={{ color: typ?.color ?? "#22D1C3", fontSize: 8, fontWeight: 900 }}>
                  {typ ? `${typ.icon} ${typ.label.toUpperCase()}` : "ELITE"}
                </div>
                <div style={{ fontSize: 11, fontWeight: 900, marginTop: 1 }}>{a.name}</div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (!col || !active) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "#8B8FA3", fontSize: 12 }}>
        Lade Wächter …
      </div>
    );
  }

  const r = rarityMeta(active.archetype.rarity);
  const typ = active.archetype.guardian_type ? TYPE_META[active.archetype.guardian_type] : null;

  return (
    <>
      <div style={{
        display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", gap: 8,
        marginBottom: 14,
      }}>
        {/* ── WÄCHTER ── */}
        <div style={{
          padding: 10, borderRadius: 14,
          background: `linear-gradient(135deg, ${r.glow}, rgba(15,17,21,0.7))`,
          border: `1px solid ${r.color}66`,
          boxShadow: `0 0 16px ${r.glow}`,
          position: "relative",
        }}>
          {active.talent_points_available > 0 && (
            <div style={{
              position: "absolute", top: 6, right: 6,
              padding: "2px 6px", borderRadius: 999,
              background: "#FFD700", color: "#0F1115",
              fontSize: 9, fontWeight: 900, zIndex: 2,
            }}>+{active.talent_points_available}</div>
          )}
          <div style={{ color: r.color, fontSize: 8, fontWeight: 900, letterSpacing: 1 }}>
            {r.label.toUpperCase()}{typ ? ` · ${typ.icon}` : ""}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <div style={{ width: 60, height: 75, flexShrink: 0 }}>
              <GuardianAvatar archetype={active.archetype} size={60} animation="idle" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: "#FFF", fontSize: 13, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {active.custom_name ?? active.archetype.name}
              </div>
              <div style={{ color: "#a8b4cf", fontSize: 10 }}>Lvl {active.level}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
            <button onClick={() => setDetailId(active.id)} style={btnSmall(r.color, true)}>Öffnen</button>
            <button onClick={() => setGalleryOpen(true)} style={btnSmall(r.color, false)}>Wechseln</button>
          </div>
        </div>

        {/* ── MAP-ICON ── */}
        <div style={tileStyle()} onClick={() => setMarkerOpen(true)}>
          <div style={labelStyle()}>MAP-ICON</div>
          <div style={{ fontSize: 44, marginTop: 4 }}>{currentMarker.icon}</div>
          <div style={{ color: "#FFF", fontSize: 11, fontWeight: 900, marginTop: 3 }}>{currentMarker.name}</div>
          <div style={{ fontSize: 9, color: PRIMARY, marginTop: 2, fontWeight: 800 }}>Ändern →</div>
        </div>

        {/* ── RUNNER-LIGHT ── */}
        <div style={tileStyle()} onClick={() => setLightOpen(true)}>
          <div style={labelStyle()}>RUNNER-LIGHT</div>
          <div style={{
            width: 70, height: currentLight.width,
            borderRadius: currentLight.width / 2,
            background: lightGradient, marginTop: 20, marginBottom: 6,
            boxShadow: `0 0 14px ${currentLight.color}80`,
          }} />
          <div style={{ color: "#FFF", fontSize: 11, fontWeight: 900 }}>{currentLight.name}</div>
          <div style={{ fontSize: 9, color: PRIMARY, marginTop: 2, fontWeight: 800 }}>Ändern →</div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "#8B8FA3", marginBottom: 10 }}>
        <span>🛡️ Sammlung: {col.owned.length}/{col.archetypes.length}</span>
        <button onClick={() => setGalleryOpen(true)} style={{
          padding: "5px 10px", borderRadius: 999,
          background: "rgba(34,209,195,0.15)", border: "1px solid rgba(34,209,195,0.4)",
          color: "#22D1C3", fontSize: 10, fontWeight: 900, cursor: "pointer",
        }}>📖 Alle 60 Wächter</button>
      </div>

      {/* Modals */}
      {galleryOpen && (
        <GuardianGalleryModal
          archetypes={col.archetypes}
          ownedIds={new Set(col.owned.map((g) => g.archetype_id))}
          onClose={() => setGalleryOpen(false)}
          isAdmin={isAdmin}
          onImageUploaded={() => load()}
          ownedGuardians={col.owned}
          activeArchetypeId={active.archetype_id}
          onActivate={async (archetypeId) => {
            const g = col.owned.find((x) => x.archetype_id === archetypeId);
            if (g) await activateGuardian(g.id);
          }}
        />
      )}
      {detailId && <GuardianDetailModal guardianId={detailId} onClose={() => setDetailId(null)} />}
      {markerOpen && (
        <MarkerPickerModal
          userXp={userXp}
          currentId={equippedMarker}
          onPick={onEquipMarker}
          onClose={() => setMarkerOpen(false)}
        />
      )}
      {lightOpen && (
        <LightPickerModal
          userXp={userXp}
          currentId={equippedLight}
          onPick={onEquipLight}
          onClose={() => setLightOpen(false)}
        />
      )}
    </>
  );
}

function tileStyle(): React.CSSProperties {
  return {
    padding: 10, borderRadius: 14,
    background: "rgba(70,82,122,0.25)",
    border: "1px solid rgba(255,255,255,0.08)",
    cursor: "pointer",
    display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
  };
}
function labelStyle(): React.CSSProperties {
  return { color: PRIMARY, fontSize: 8, fontWeight: 900, letterSpacing: 1.5 };
}
function btnSmall(color: string, primary: boolean): React.CSSProperties {
  return {
    flex: 1, padding: "4px 6px", borderRadius: 6,
    background: primary ? "rgba(255,255,255,0.08)" : `${color}33`,
    border: primary ? "none" : `1px solid ${color}`,
    color: primary ? "#FFF" : color,
    fontSize: 9, fontWeight: 900, cursor: "pointer", textAlign: "center",
  };
}
