"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { GuardianAvatar } from "@/components/guardian-avatar";
import { MarkerPickerModal } from "@/components/marker-picker-modal";
import { LightPickerModal } from "@/components/light-picker-modal";
import {
  TYPE_META,
  type GuardianArchetype, type GuardianType,
} from "@/lib/guardian";
import { UNLOCKABLE_MARKERS, RUNNER_LIGHTS } from "@/lib/game-config";
import { useMarkerName, useLightName } from "@/lib/i18n-game";
import { PIN_THEME_META, ALL_PIN_THEMES, type PinTheme } from "@/lib/pin-themes";
import { AdminArtworkControls } from "@/components/admin-artwork-controls";
import { buildPinThemePrompt } from "@/lib/artwork-prompts";
import { LightTrailPreview } from "@/components/light-trail-preview";
import { PinThemePreview } from "@/components/pin-theme-preview";
import { NameplatePickerModal } from "@/components/nameplate-picker-modal";
import { BaseThemeShopModal } from "@/components/base-theme-shop-modal";
import { BaseRingPickerModal } from "@/components/base-ring-picker-modal";
import { useNameplateArt, useBaseThemeArt } from "@/components/resource-icon";

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
  userXp, equippedMarker, equippedMarkerVariant = "neutral", equippedLight, onEquipMarker, onEquipLight, isAdmin = false, onPinThemeChange,
}: {
  userXp: number;
  equippedMarker: string;
  equippedMarkerVariant?: "neutral" | "male" | "female";
  equippedLight: string;
  onEquipMarker: (id: string, variant: "neutral" | "male" | "female") => void;
  onEquipLight: (id: string) => void;
  isAdmin?: boolean;
  onPinThemeChange?: (theme: PinTheme) => void;
}) {
  const tL = useTranslations("Loadout");
  const markerName = useMarkerName();
  const lightName = useLightName();
  const [col, setCol] = useState<CollectionResponse | null>(null);
  const [markerOpen, setMarkerOpen] = useState(false);
  const [lightOpen, setLightOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [nameplateOpen, setNameplateOpen] = useState(false);
  const [baseThemeOpen, setBaseThemeOpen] = useState(false);
  const [baseRingOpen, setBaseRingOpen] = useState(false);
  const [baseTheme, setBaseTheme] = useState<{ id: string; name: string; emoji: string; rarity: string; color: string } | null>(null);
  const [baseRing, setBaseRing] = useState<{ id: string; name: string; emoji: string; rarity: string; color: string } | null>(null);
  const [baseRingArt, setBaseRingArt] = useState<{ image_url: string | null; video_url: string | null } | null>(null);
  const [nameplate, setNameplate] = useState<{ id: string; name: string; emoji: string; rarity: string } | null>(null);
  const nameplateArtMap = useNameplateArt();
  const baseThemeArtMap = useBaseThemeArt();
  const [pinThemeState, setPinThemeState] = useState<{ active: PinTheme; unlocked: PinTheme[] }>({ active: "default", unlocked: ["default"] });
  const [busy, setBusy] = useState(false);
  const [cosmeticArt, setCosmeticArt] = useState<{
    marker:    Record<string, Record<string, { image_url: string | null; video_url: string | null }>>;
    light:     Record<string, { image_url: string | null; video_url: string | null }>;
    pin_theme: Record<string, { image_url: string | null; video_url: string | null }>;
  }>({ marker: {}, light: {}, pin_theme: {} });

  async function load() {
    const res = await fetch("/api/guardian/my-collection");
    if (res.ok) setCol(await res.json() as CollectionResponse);
  }
  async function loadArt() {
    const res = await fetch("/api/cosmetic-artwork", { cache: "no-store" });
    if (res.ok) setCosmeticArt(await res.json());
  }
  async function loadTheme() {
    const res = await fetch("/api/shop/pin-theme");
    if (res.ok) setPinThemeState(await res.json());
  }
  async function setPinTheme(t: PinTheme) {
    await fetch("/api/shop/pin-theme", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ theme: t }) });
    await loadTheme();
    onPinThemeChange?.(t);
    window.dispatchEvent(new CustomEvent("ma365:cosmetic-changed"));
  }
  async function loadBaseAndNameplate() {
    try {
      const [tRes, rRes, nRes, aRes] = await Promise.all([
        fetch("/api/base/theme", { cache: "no-store" }),
        fetch("/api/base/ring", { cache: "no-store" }),
        fetch("/api/nameplates", { cache: "no-store" }),
        fetch("/api/cosmetic-artwork", { cache: "no-store" }),
      ]);
      if (tRes.ok) {
        const j = await tRes.json() as { themes: Array<{ id: string; name: string; pin_emoji?: string; emoji?: string; rarity: string; pin_color?: string; accent_color?: string }>; active_theme_id: string };
        const cur = j.themes.find((t) => t.id === j.active_theme_id) ?? null;
        if (cur) setBaseTheme({ id: cur.id, name: cur.name, emoji: cur.pin_emoji ?? cur.emoji ?? "🏰", rarity: cur.rarity, color: cur.pin_color ?? cur.accent_color ?? PRIMARY });
      }
      if (rRes.ok) {
        const j = await rRes.json() as { items: Array<{ id: string; name: string; preview_emoji: string; rarity: string; preview_color: string; equipped: boolean }> };
        const cur = j.items.find((r) => r.equipped) ?? null;
        if (cur) setBaseRing({ id: cur.id, name: cur.name, emoji: cur.preview_emoji, rarity: cur.rarity, color: cur.preview_color });
      }
      if (nRes.ok) {
        const j = await nRes.json() as { items: Array<{ id: string; name: string; preview_emoji: string; rarity: string; equipped: boolean }> };
        const cur = j.items.find((p) => p.equipped) ?? null;
        if (cur) setNameplate({ id: cur.id, name: cur.name, emoji: cur.preview_emoji, rarity: cur.rarity });
        else setNameplate(null);
      }
      if (aRes.ok) {
        await aRes.json();
      }
    } catch {}
  }
  // Base-Ring artwork separat nachziehen (für Tile-Vorschau)
  useEffect(() => {
    let cancelled = false;
    fetch("/api/cosmetic-artwork", { cache: "no-store" }).then(async (r) => {
      if (!r.ok || cancelled) return;
      const j = await r.json() as { base_ring?: Record<string, { image_url: string | null; video_url: string | null }> };
      if (cancelled || !baseRing) return;
      setBaseRingArt(j.base_ring?.[baseRing.id] ?? null);
    });
    return () => { cancelled = true; };
  }, [baseRing]);
  useEffect(() => { load(); loadArt(); loadTheme(); loadBaseAndNameplate(); }, []);
  useEffect(() => {
    function onArtChanged() { void loadArt(); void loadBaseAndNameplate(); }
    window.addEventListener("ma365:artwork-changed", onArtChanged);
    return () => window.removeEventListener("ma365:artwork-changed", onArtChanged);
  }, []);

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
  const currentMarkerName = markerName(currentMarker.id);
  const currentLightName = lightName(currentLight.id);
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
          {tL("starterKicker")}
        </div>
        <div style={{ color: "#FFF", fontSize: 12, marginBottom: 10 }}>
          {tL("starterIntro")}
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
                  {typ ? tL("starterTypeLabel", { icon: typ.icon, label: typ.label.toUpperCase() }) : tL("starterEliteFallback")}
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
        {tL("loading")}
      </div>
    );
  }

  const RARITY_COLOR: Record<string, string> = { common: "#9ba8c7", advanced: "#5ddaf0", epic: "#a855f7", legendary: "#FFD700" };
  const npArt = nameplate ? nameplateArtMap[nameplate.id] : null;

  return (
    <>
      {/* ═══ SECTION 1: Auf der Karte (Runner-Loadout) ═══ */}
      <SectionHeading title={tL("runnerHeading")} subtitle={tL("runnerSubtitle")} />
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8,
        marginBottom: 14,
      }}>
        {/* ── AVATAR (Map-Icon) ── */}
        <div style={tileStyle()} onClick={() => setMarkerOpen(true)}>
          <div style={labelStyle()}>{tL("labelMapIcon")}</div>
          {(() => {
            const variants = cosmeticArt.marker[currentMarker.id];
            const mArt = variants?.[equippedMarkerVariant] ?? variants?.neutral;
            if (mArt?.video_url) return <video src={mArt.video_url} autoPlay loop muted playsInline style={{ width: 72, height: 72, objectFit: "contain", marginTop: 4, filter: "url(#ma365-chroma-black)" }} />;
            if (mArt?.image_url) return <img src={mArt.image_url} alt={currentMarkerName} style={{ width: 72, height: 72, objectFit: "contain", marginTop: 4, filter: "url(#ma365-chroma-black)" }} />;
            return <div style={{ fontSize: 44, marginTop: 4 }}>{currentMarker.icon}</div>;
          })()}
          <div style={{ color: "#FFF", fontSize: 11, fontWeight: 900, marginTop: 3 }}>{currentMarkerName}</div>
          <div style={{ fontSize: 8, color: "#8B8FA3", marginTop: 1, fontWeight: 700 }}>{tL("avatarSharedHint")}</div>
          <div style={{ fontSize: 9, color: PRIMARY, marginTop: 2, fontWeight: 800 }}>{tL("change")}</div>
        </div>

        {/* ── RUNNER-LIGHT ── */}
        <div style={tileStyle()} onClick={() => setLightOpen(true)}>
          <div style={labelStyle()}>{tL("labelLight")}</div>
          {(() => {
            const lArt = cosmeticArt.light[currentLight.id];
            if (lArt?.video_url) return <video src={lArt.video_url} autoPlay loop muted playsInline style={{ width: 90, height: 40, objectFit: "contain", marginTop: 14, marginBottom: 6, filter: "url(#ma365-chroma-black)" }} />;
            if (lArt?.image_url) return <img src={lArt.image_url} alt={currentLightName} style={{ width: 90, height: 40, objectFit: "contain", marginTop: 14, marginBottom: 6, filter: "url(#ma365-chroma-black)" }} />;
            // Animierte Live-Vorschau (Particle-Engine, identisch zur Karte)
            return (
              <div style={{ marginTop: 14, marginBottom: 6 }}>
                <LightTrailPreview lightId={currentLight.id} width={90} height={40} />
              </div>
            );
          })()}
          <div style={{ color: "#FFF", fontSize: 11, fontWeight: 900 }}>{currentLightName}</div>
          <div style={{ fontSize: 9, color: PRIMARY, marginTop: 2, fontWeight: 800 }}>{tL("change")}</div>
        </div>

        {/* ── PIN-THEME ── */}
        {(() => {
          const tMeta = PIN_THEME_META[pinThemeState.active];
          const tArt = cosmeticArt.pin_theme[pinThemeState.active];
          return (
            <div style={tileStyle()} onClick={() => setThemeOpen(true)}>
              <div style={labelStyle()}>{tL("labelPinTheme")}</div>
              {tArt?.video_url ? (
                <video src={tArt.video_url} autoPlay loop muted playsInline style={{ width: 72, height: 72, objectFit: "contain", marginTop: 4, filter: "url(#ma365-chroma-black)" }} />
              ) : tArt?.image_url ? (
                <img src={tArt.image_url} alt={tMeta.name} style={{ width: 72, height: 72, objectFit: "contain", marginTop: 4, filter: "url(#ma365-chroma-black)" }} />
              ) : (
                <div style={{ marginTop: 4 }}>
                  <PinThemePreview
                    theme={pinThemeState.active}
                    icon={tMeta.icon}
                    accent={tMeta.preview.accent}
                    glow={tMeta.preview.glow}
                    bg={tMeta.preview.bg}
                    size={70}
                  />
                </div>
              )}
              <div style={{ color: "#FFF", fontSize: 11, fontWeight: 900, marginTop: 3 }}>{tMeta.name}</div>
              <div style={{ fontSize: 9, color: PRIMARY, marginTop: 2, fontWeight: 800 }}>{tL("change")}</div>
            </div>
          );
        })()}
      </div>

      {/* ═══ SECTION 2: An deiner Base (Base-Loadout) ═══ */}
      <SectionHeading title={tL("baseHeading")} subtitle={tL("baseSubtitle")} />
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8,
        marginBottom: 14,
      }}>
        {/* ── BASE-THEME (Gebäude/Skin) ── */}
        {(() => {
          const btArt = baseTheme
            ? baseThemeArtMap[`${baseTheme.id}_runner_pin`] ?? baseThemeArtMap[`${baseTheme.id}_runner_banner`]
            : null;
          return (
            <div style={tileStyle()} onClick={() => setBaseThemeOpen(true)}>
              <div style={labelStyle()}>{tL("labelBaseTheme")}</div>
              {btArt?.video_url ? (
                <video src={btArt.video_url} autoPlay loop muted playsInline style={{ width: 72, height: 72, objectFit: "contain", marginTop: 4, filter: "url(#ma365-chroma-black)" }} />
              ) : btArt?.image_url ? (
                <img src={btArt.image_url} alt={baseTheme?.name ?? ""} style={{ width: 72, height: 72, objectFit: "contain", marginTop: 4, filter: "url(#ma365-chroma-black)" }} />
              ) : (
                <div style={{
                  width: 72, height: 72, borderRadius: 14, marginTop: 4,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: `2px solid ${baseTheme?.color ?? PRIMARY}`,
                  boxShadow: `0 0 14px ${baseTheme?.color ?? PRIMARY}66`,
                  background: "rgba(15,17,21,0.6)",
                  fontSize: 34,
                }}>
                  {baseTheme?.emoji ?? "🏰"}
                </div>
              )}
              <div style={{ color: "#FFF", fontSize: 11, fontWeight: 900, marginTop: 3 }}>{baseTheme?.name ?? "—"}</div>
              <div style={{ fontSize: 9, color: PRIMARY, marginTop: 2, fontWeight: 800 }}>{tL("change")}</div>
            </div>
          );
        })()}

        {/* ── BASE-RING (Aura/Donut um den Pin) ── */}
        <div style={tileStyle()} onClick={() => setBaseRingOpen(true)}>
          <div style={labelStyle()}>{tL("labelBaseRing")}</div>
          {baseRingArt?.video_url ? (
            <video src={baseRingArt.video_url} autoPlay loop muted playsInline style={{ width: 72, height: 72, objectFit: "contain", marginTop: 4, filter: "url(#ma365-chroma-black)" }} />
          ) : baseRingArt?.image_url ? (
            <img src={baseRingArt.image_url} alt={baseRing?.name ?? ""} style={{ width: 72, height: 72, objectFit: "contain", marginTop: 4, filter: "url(#ma365-chroma-black)" }} />
          ) : (
            <div style={{
              width: 72, height: 72, borderRadius: "50%", marginTop: 4,
              border: `5px solid ${baseRing ? RARITY_COLOR[baseRing.rarity] ?? PRIMARY : PRIMARY}`,
              boxShadow: `0 0 14px ${baseRing ? RARITY_COLOR[baseRing.rarity] ?? PRIMARY : PRIMARY}88, inset 0 0 10px ${baseRing ? RARITY_COLOR[baseRing.rarity] ?? PRIMARY : PRIMARY}55`,
              background: "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 26,
            }}>
              {baseRing?.emoji ?? "⭕"}
            </div>
          )}
          <div style={{ color: "#FFF", fontSize: 11, fontWeight: 900, marginTop: 3 }}>{baseRing?.name ?? "—"}</div>
          <div style={{ fontSize: 9, color: PRIMARY, marginTop: 2, fontWeight: 800 }}>{tL("change")}</div>
        </div>

        {/* ── BANNER (Nameplate) ── */}
        <div style={tileStyle()} onClick={() => setNameplateOpen(true)}>
          <div style={labelStyle()}>{tL("labelBaseBanner")}</div>
          {npArt?.video_url ? (
            <video src={npArt.video_url} autoPlay loop muted playsInline style={{ width: 100, height: 36, objectFit: "contain", marginTop: 14, marginBottom: 6, filter: "url(#ma365-chroma-black)" }} />
          ) : npArt?.image_url ? (
            <img src={npArt.image_url} alt={nameplate?.name ?? ""} style={{ width: 100, height: 36, objectFit: "contain", marginTop: 14, marginBottom: 6, filter: "url(#ma365-chroma-black)" }} />
          ) : (
            <div style={{
              width: 100, height: 28, marginTop: 18, marginBottom: 6,
              borderRadius: 6,
              background: `linear-gradient(90deg, ${nameplate ? RARITY_COLOR[nameplate.rarity] ?? "#5ddaf0" : "#5ddaf0"}33, ${nameplate ? RARITY_COLOR[nameplate.rarity] ?? "#5ddaf0" : "#5ddaf0"}11)`,
              border: `1px solid ${nameplate ? RARITY_COLOR[nameplate.rarity] ?? "#5ddaf0" : "#5ddaf0"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16,
            }}>
              {nameplate?.emoji ?? "🎀"}
            </div>
          )}
          <div style={{ color: "#FFF", fontSize: 11, fontWeight: 900 }}>{nameplate?.name ?? "—"}</div>
          <div style={{ fontSize: 9, color: PRIMARY, marginTop: 2, fontWeight: 800 }}>{tL("change")}</div>
        </div>
      </div>

      {/* Modals */}
      {nameplateOpen && (
        <NameplatePickerModal isAdmin={isAdmin} onClose={() => { setNameplateOpen(false); void loadBaseAndNameplate(); }} />
      )}
      {baseThemeOpen && (
        <BaseThemeShopModal onClose={() => setBaseThemeOpen(false)} onChanged={() => void loadBaseAndNameplate()} />
      )}
      {baseRingOpen && (
        <BaseRingPickerModal isAdmin={isAdmin} onClose={() => setBaseRingOpen(false)} onChanged={() => void loadBaseAndNameplate()} />
      )}
      {themeOpen && (
        <PinThemePickerModal
          active={pinThemeState.active}
          unlocked={pinThemeState.unlocked}
          artMap={cosmeticArt.pin_theme}
          isAdmin={isAdmin}
          onPick={async (t) => { await setPinTheme(t); setThemeOpen(false); }}
          onClose={() => setThemeOpen(false)}
          onArtworkChanged={loadArt}
        />
      )}
      {markerOpen && (
        <MarkerPickerModal
          userXp={userXp}
          currentId={equippedMarker}
          currentVariant={equippedMarkerVariant}
          onPick={onEquipMarker}
          onClose={() => setMarkerOpen(false)}
          isAdmin={isAdmin}
        />
      )}
      {lightOpen && (
        <LightPickerModal
          userXp={userXp}
          currentId={equippedLight}
          onPick={onEquipLight}
          onClose={() => setLightOpen(false)}
          isAdmin={isAdmin}
        />
      )}
    </>
  );
}

function PinThemePickerModal({
  active, unlocked, artMap, isAdmin, onPick, onClose, onArtworkChanged,
}: {
  active: PinTheme;
  unlocked: PinTheme[];
  artMap: Record<string, { image_url: string | null; video_url: string | null }>;
  isAdmin?: boolean;
  onPick: (t: PinTheme) => void | Promise<void>;
  onClose: () => void;
  onArtworkChanged?: () => void;
}) {
  const tL = useTranslations("Loadout");
  const unlockedSet = new Set(unlocked);
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 3700,
      background: "rgba(15,17,21,0.92)", backdropFilter: "blur(14px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 12,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 640, maxHeight: "92vh",
        display: "flex", flexDirection: "column",
        background: "#1A1D23", borderRadius: 20,
        border: `1px solid ${PRIMARY}66`,
        boxShadow: `0 0 40px ${PRIMARY}33`,
        color: "#F0F0F0", overflow: "hidden",
      }}>
        <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: PRIMARY, fontSize: 9, fontWeight: 900, letterSpacing: 2 }}>{tL("themeKicker")}</div>
            <div style={{ color: "#FFF", fontSize: 16, fontWeight: 900 }}>
              {tL("themeUnlockCount", { unlocked: unlocked.length, total: ALL_PIN_THEMES.length })}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#8B8FA3", fontSize: 22, cursor: "pointer", width: 32, height: 32 }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
            {ALL_PIN_THEMES.map((id) => {
              const m = PIN_THEME_META[id];
              const isActive = id === active;
              const isUnlocked = unlockedSet.has(id);
              const art = artMap[id];
              const hasArt = !!(art?.image_url || art?.video_url);
              return (
                <div key={id} style={{
                  display: "flex", flexDirection: "column", alignItems: "stretch",
                  padding: 10, borderRadius: 14,
                  background: isActive ? `${m.preview.accent}22` : "rgba(70,82,122,0.35)",
                  border: isActive ? `2px solid ${m.preview.accent}` : "1px solid rgba(255,255,255,0.08)",
                  boxShadow: isActive ? `0 0 22px ${m.preview.glow}` : "none",
                  opacity: isUnlocked ? 1 : 0.5,
                }}>
                  <button onClick={() => { if (isUnlocked && !isActive) onPick(id); }}
                    disabled={!isUnlocked || isActive}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center",
                      background: "none", border: "none", color: "#FFF",
                      cursor: isUnlocked && !isActive ? "pointer" : "default", padding: 0,
                    }}>
                    {art?.video_url ? (
                      <video src={art.video_url} autoPlay loop muted playsInline style={{ width: 72, height: 72, objectFit: "contain", marginBottom: 8, filter: "url(#ma365-chroma-black)" }} />
                    ) : art?.image_url ? (
                      <img src={art.image_url} alt={m.name} style={{ width: 72, height: 72, objectFit: "contain", marginBottom: 8, filter: "url(#ma365-chroma-black)" }} />
                    ) : (
                      <div style={{ marginBottom: 8 }}>
                        <PinThemePreview
                          theme={id}
                          icon={m.icon}
                          accent={m.preview.accent}
                          glow={m.preview.glow}
                          bg={m.preview.bg}
                          size={72}
                        />
                      </div>
                    )}
                    <span style={{ fontSize: 12, fontWeight: 900 }}>{m.name}</span>
                    <span style={{ fontSize: 9, color: "#a8b4cf", textAlign: "center", marginTop: 3, lineHeight: 1.3 }}>{m.description}</span>
                    <div style={{ marginTop: 6 }}>
                      {isActive
                        ? <span style={{ fontSize: 9, fontWeight: 900, color: m.preview.accent }}>{tL("themeActive")}</span>
                        : isUnlocked
                          ? <span style={{ fontSize: 9, fontWeight: 800, color: "#4ade80" }}>{tL("themeChoose")}</span>
                          : <span style={{ fontSize: 9, fontWeight: 800, color: "#FFD700" }}>{tL("themeLockedShop")}</span>
                      }
                    </div>
                    {isAdmin && !hasArt && (
                      <span style={{ fontSize: 7, fontWeight: 900, color: "#FF2D78", marginTop: 2 }}>{tL("themeNoArtwork")}</span>
                    )}
                  </button>
                  {isAdmin && (
                    <AdminArtworkControls
                      targetType="pin_theme"
                      targetId={id}
                      hasImage={!!art?.image_url}
                      hasVideo={!!art?.video_url}
                      buildPrompt={(mode) => buildPinThemePrompt({
                        name: m.name, description: m.description,
                        bg: m.preview.bg, accent: m.preview.accent, glow: m.preview.glow,
                        mode,
                      })}
                      onUploaded={onArtworkChanged}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function tileStyle(): React.CSSProperties {
  return {
    padding: 10, borderRadius: 14,
    background: "rgba(70,82,122,0.25)",
    justifyContent: "center",
    border: "1px solid rgba(255,255,255,0.08)",
    cursor: "pointer",
    display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
  };
}
function labelStyle(): React.CSSProperties {
  return { color: PRIMARY, fontSize: 8, fontWeight: 900, letterSpacing: 1.5 };
}

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: 8, marginTop: 4 }}>
      <div style={{ color: PRIMARY, fontSize: 10, fontWeight: 900, letterSpacing: 2 }}>{title}</div>
      <div style={{ color: "#8B8FA3", fontSize: 11, fontWeight: 600, marginTop: 2 }}>{subtitle}</div>
    </div>
  );
}
