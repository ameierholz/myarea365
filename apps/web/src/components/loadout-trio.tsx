"use client";

import { useState, useEffect } from "react";
import { GuardianAvatar } from "@/components/guardian-avatar";
import { GuardianGalleryModal } from "@/components/guardian-gallery-modal";
import { GuardianDetailModal } from "@/components/guardian-detail-modal";
import { GuardianHelpModal } from "@/components/guardian-help-modal";
import { MarkerPickerModal } from "@/components/marker-picker-modal";
import { LightPickerModal } from "@/components/light-picker-modal";
import {
  rarityMeta, TYPE_META, statsAtLevel, GUARDIAN_LEVEL_CAP,
  type GuardianArchetype, type GuardianType,
} from "@/lib/guardian";
import { UNLOCKABLE_MARKERS, RUNNER_LIGHTS } from "@/lib/game-config";
import { PIN_THEME_META, ALL_PIN_THEMES, type PinTheme } from "@/lib/pin-themes";
import { AdminArtworkControls } from "@/components/admin-artwork-controls";
import { buildPinThemePrompt } from "@/lib/artwork-prompts";

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
  const [col, setCol] = useState<CollectionResponse | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [markerOpen, setMarkerOpen] = useState(false);
  const [lightOpen, setLightOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [pinThemeState, setPinThemeState] = useState<{ active: PinTheme; unlocked: PinTheme[] }>({ active: "default", unlocked: ["default"] });
  const [busy, setBusy] = useState(false);
  type HelpTab = "overview" | "guardians" | "talents" | "skills" | "arena" | "boss";
  const [helpTab, setHelpTab] = useState<HelpTab | null>(null);
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
    const res = await fetch("/api/cosmetic-artwork");
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
  }
  useEffect(() => { load(); loadArt(); loadTheme(); }, []);

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
      <div style={{ marginBottom: 10 }}>
        {/* ── WÄCHTER (volle Breite) ── */}
        {(() => {
          const stats = statsAtLevel(active.archetype, active.level);
          const totalBattles = active.wins + active.losses;
          const winRate = totalBattles > 0 ? Math.round((active.wins / totalBattles) * 100) : 0;
          const collectionPct = Math.round((col.owned.length / col.archetypes.length) * 100);
          const levelPct = Math.min(100, Math.round((active.level / GUARDIAN_LEVEL_CAP) * 100));
          return (
            <div style={{
              padding: 10, borderRadius: 14,
              background: `linear-gradient(135deg, ${r.glow}, rgba(15,17,21,0.75))`,
              border: `1px solid ${r.color}66`,
              boxShadow: `0 0 16px ${r.glow}`,
              position: "relative",
              display: "flex", flexDirection: "column",
            }}>
              {active.talent_points_available > 0 && (
                <div style={{
                  position: "absolute", top: 6, right: 6,
                  padding: "2px 6px", borderRadius: 999,
                  background: "#FFD700", color: "#0F1115",
                  fontSize: 9, fontWeight: 900, zIndex: 2,
                }}>+{active.talent_points_available}</div>
              )}

              {/* Top-Row: Grosses Avatar + Name + Rarity */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 120, height: 150, flexShrink: 0 }}>
                  <GuardianAvatar archetype={active.archetype} size={120} animation="idle" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: r.color, fontSize: 9, fontWeight: 900, letterSpacing: 1 }}>
                    {r.label.toUpperCase()}{typ ? ` · ${typ.icon} ${typ.label.toUpperCase()}` : ""}
                  </div>
                  <div style={{ color: "#FFF", fontSize: 16, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>
                    {active.custom_name ?? active.archetype.name}
                  </div>
                  <div style={{ color: "#a8b4cf", fontSize: 11, marginTop: 2 }}>
                    Lvl {active.level} / {GUARDIAN_LEVEL_CAP}
                  </div>
                  {/* Level-Progress-Bar */}
                  <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden", marginTop: 4 }}>
                    <div style={{ width: `${levelPct}%`, height: "100%", background: r.color }} />
                  </div>
                  {/* Sammlung + Alle-60-Button */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginTop: 8 }}>
                    <span style={{ fontSize: 10, color: "#a8b4cf", fontWeight: 700 }}>
                      🛡️ Sammlung {col.owned.length}/{col.archetypes.length}
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); setGalleryOpen(true); }} style={{
                      padding: "3px 8px", borderRadius: 999,
                      background: "rgba(34,209,195,0.18)", border: "1px solid rgba(34,209,195,0.45)",
                      color: "#22D1C3", fontSize: 9, fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap",
                    }}>📖 Alle 60 Wächter</button>
                  </div>
                </div>
              </div>

              {/* Stats-Grid: HP/ATK/DEF/SPD */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 3, marginTop: 8 }}>
                <MiniStat label="HP"  value={stats.hp}  color="#4ade80" />
                <MiniStat label="ATK" value={stats.atk} color="#FF6B4A" />
                <MiniStat label="DEF" value={stats.def} color="#5ddaf0" />
                <MiniStat label="SPD" value={stats.spd} color="#FFD700" />
              </div>

              {/* Battle + Collection Row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 3, marginTop: 3 }}>
                <MiniStat label="W / L"  value={`${active.wins} / ${active.losses}`} color="#a855f7" />
                <MiniStat label="WIN %"  value={totalBattles > 0 ? `${winRate}%` : "–"}   color="#4ade80" />
                <MiniStat label="COLL."  value={`${col.owned.length}/${col.archetypes.length}`} color="#22D1C3" small={`${collectionPct}%`} />
              </div>

              {/* CTA-Buttons */}
              <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                <button onClick={() => setDetailId(active.id)} style={btnSmall(r.color, true)}>Wächter öffnen</button>
                <button onClick={() => setGalleryOpen(true)} style={btnSmall(r.color, false)}>Wächter wechseln</button>
              </div>

              {/* Wächter-Guide Button */}
              <button onClick={() => setHelpTab("overview")} style={{
                marginTop: 8, padding: "6px 10px", borderRadius: 8,
                background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.4)",
                color: "#FFF", fontSize: 10, fontWeight: 800, cursor: "pointer",
                textAlign: "center", width: "100%",
              }}>
                📖 Alle Infos zu Wächtern im Guide
              </button>
            </div>
          );
        })()}
      </div>

      {/* ── 3-Col: Map-Icon · Runner-Light · Pin-Theme (alles Runner-bezogen) ── */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8,
        marginBottom: 14,
      }}>
        {/* ── MAP-ICON ── */}
        <div style={tileStyle()} onClick={() => setMarkerOpen(true)}>
          <div style={labelStyle()}>MAP-ICON</div>
          {(() => {
            const variants = cosmeticArt.marker[currentMarker.id];
            const mArt = variants?.[equippedMarkerVariant] ?? variants?.neutral;
            if (mArt?.video_url) return <video src={mArt.video_url} autoPlay loop muted playsInline style={{ width: 72, height: 72, objectFit: "contain", marginTop: 4 }} />;
            if (mArt?.image_url) return <img src={mArt.image_url} alt={currentMarker.name} style={{ width: 72, height: 72, objectFit: "contain", marginTop: 4 }} />;
            return <div style={{ fontSize: 44, marginTop: 4 }}>{currentMarker.icon}</div>;
          })()}
          <div style={{ color: "#FFF", fontSize: 11, fontWeight: 900, marginTop: 3 }}>{currentMarker.name}</div>
          <div style={{ fontSize: 9, color: PRIMARY, marginTop: 2, fontWeight: 800 }}>Ändern →</div>
        </div>

        {/* ── RUNNER-LIGHT ── */}
        <div style={tileStyle()} onClick={() => setLightOpen(true)}>
          <div style={labelStyle()}>RUNNER-LIGHT</div>
          {(() => {
            const lArt = cosmeticArt.light[currentLight.id];
            if (lArt?.video_url) return <video src={lArt.video_url} autoPlay loop muted playsInline style={{ width: 90, height: 40, objectFit: "contain", marginTop: 14, marginBottom: 6 }} />;
            if (lArt?.image_url) return <img src={lArt.image_url} alt={currentLight.name} style={{ width: 90, height: 40, objectFit: "contain", marginTop: 14, marginBottom: 6 }} />;
            return (
              <div style={{
                width: 70, height: currentLight.width,
                borderRadius: currentLight.width / 2,
                background: lightGradient, marginTop: 20, marginBottom: 6,
                boxShadow: `0 0 14px ${currentLight.color}80`,
              }} />
            );
          })()}
          <div style={{ color: "#FFF", fontSize: 11, fontWeight: 900 }}>{currentLight.name}</div>
          <div style={{ fontSize: 9, color: PRIMARY, marginTop: 2, fontWeight: 800 }}>Ändern →</div>
        </div>

        {/* ── PIN-THEME ── */}
        {(() => {
          const tMeta = PIN_THEME_META[pinThemeState.active];
          const tArt = cosmeticArt.pin_theme[pinThemeState.active];
          return (
            <div style={tileStyle()} onClick={() => setThemeOpen(true)}>
              <div style={labelStyle()}>PIN-THEME</div>
              {tArt?.video_url ? (
                <video src={tArt.video_url} autoPlay loop muted playsInline style={{ width: 72, height: 72, objectFit: "contain", marginTop: 4 }} />
              ) : tArt?.image_url ? (
                <img src={tArt.image_url} alt={tMeta.name} style={{ width: 72, height: 72, objectFit: "contain", marginTop: 4 }} />
              ) : (
                <div style={{
                  width: 70, height: 70, borderRadius: 16,
                  background: tMeta.preview.bg,
                  border: `2px solid ${tMeta.preview.accent}`,
                  boxShadow: `0 0 16px ${tMeta.preview.glow}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 34, marginTop: 4,
                }}>
                  {tMeta.icon}
                </div>
              )}
              <div style={{ color: "#FFF", fontSize: 11, fontWeight: 900, marginTop: 3 }}>{tMeta.name}</div>
              <div style={{ fontSize: 9, color: PRIMARY, marginTop: 2, fontWeight: 800 }}>Ändern →</div>
            </div>
          );
        })()}
      </div>

      {/* Modals */}
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
      {helpTab && <GuardianHelpModal initialTab={helpTab} onClose={() => setHelpTab(null)} />}
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
            <div style={{ color: PRIMARY, fontSize: 9, fontWeight: 900, letterSpacing: 2 }}>PIN-THEME WÄHLEN</div>
            <div style={{ color: "#FFF", fontSize: 16, fontWeight: 900 }}>
              {unlocked.length} / {ALL_PIN_THEMES.length} freigeschaltet
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
                      <video src={art.video_url} autoPlay loop muted playsInline style={{ width: 72, height: 72, objectFit: "contain", marginBottom: 8 }} />
                    ) : art?.image_url ? (
                      <img src={art.image_url} alt={m.name} style={{ width: 72, height: 72, objectFit: "contain", marginBottom: 8 }} />
                    ) : (
                      <div style={{
                        width: 72, height: 72, borderRadius: 16, marginBottom: 8,
                        background: m.preview.bg, border: `2px solid ${m.preview.accent}`,
                        boxShadow: `0 0 14px ${m.preview.glow}`,
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34,
                      }}>{m.icon}</div>
                    )}
                    <span style={{ fontSize: 12, fontWeight: 900 }}>{m.name}</span>
                    <span style={{ fontSize: 9, color: "#a8b4cf", textAlign: "center", marginTop: 3, lineHeight: 1.3 }}>{m.description}</span>
                    <div style={{ marginTop: 6 }}>
                      {isActive
                        ? <span style={{ fontSize: 9, fontWeight: 900, color: m.preview.accent }}>✓ AKTIV</span>
                        : isUnlocked
                          ? <span style={{ fontSize: 9, fontWeight: 800, color: "#4ade80" }}>Wählen</span>
                          : <span style={{ fontSize: 9, fontWeight: 800, color: "#FFD700" }}>🔒 Gem-Shop</span>
                      }
                    </div>
                    {isAdmin && !hasArt && (
                      <span style={{ fontSize: 7, fontWeight: 900, color: "#FF2D78", marginTop: 2 }}>KEIN ARTWORK</span>
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

function MiniStat({ label, value, color, small }: { label: string; value: string | number; color: string; small?: string }) {
  return (
    <div style={{
      padding: "4px 2px", borderRadius: 6,
      background: "rgba(15,17,21,0.55)",
      border: "1px solid rgba(255,255,255,0.05)",
      textAlign: "center",
      display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
    }}>
      <div style={{ color: "#8B8FA3", fontSize: 7, fontWeight: 800, letterSpacing: 0.8 }}>{label}</div>
      <div style={{ color, fontSize: 11, fontWeight: 900, marginTop: 1, lineHeight: 1 }}>{value}</div>
      {small && <div style={{ color: "#6c7590", fontSize: 7, marginTop: 1 }}>{small}</div>}
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
function btnSmall(color: string, primary: boolean): React.CSSProperties {
  return {
    flex: 1, padding: "4px 6px", borderRadius: 6,
    background: primary ? "rgba(255,255,255,0.08)" : `${color}33`,
    border: primary ? "none" : `1px solid ${color}`,
    color: primary ? "#FFF" : color,
    fontSize: 9, fontWeight: 900, cursor: "pointer", textAlign: "center",
  };
}
