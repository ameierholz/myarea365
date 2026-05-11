"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { GuardianAvatar } from "@/components/guardian-avatar";
import {
  rarityMeta, TYPE_META, RARITY_META, FACTION_META,
  type GuardianArchetype, type GuardianType, type GuardianFaction,
} from "@/lib/guardian";
import { buildArchetypePrompt } from "@/lib/artwork-prompts";
import { uploadArtworkDirect } from "@/lib/artwork-upload";
import { Modal, ModalHeader, ModalBody, Z } from "@/components/ui";
// referenced below but linter misdetects — keep explicit
void uploadArtworkDirect;

type Tab = "all" | GuardianType;

type OwnedLite = { id: string; archetype_id: string; level: number; is_active: boolean };

export function GuardianGalleryModal({
  archetypes, ownedIds, onClose, isAdmin = false, onImageUploaded,
  ownedGuardians, activeArchetypeId, onActivate,
}: {
  archetypes: GuardianArchetype[];
  ownedIds: Set<string>;
  onClose: () => void;
  isAdmin?: boolean;
  onImageUploaded?: () => void;
  ownedGuardians?: OwnedLite[];
  activeArchetypeId?: string | null;
  onActivate?: (archetypeId: string) => Promise<void> | void;
}) {
  const tG = useTranslations("GuardianGallery");
  const [tab, setTab] = useState<Tab>("all");
  const [factionFilter, setFactionFilter] = useState<GuardianFaction | "all">("all");
  const [onlyMissingArt, setOnlyMissingArt] = useState(false);

  // Pre-Launch (W0) komplett ausblenden — nur live-released Wellen sichtbar
  const releasedArchetypes = useMemo(
    () => archetypes.filter((a) => a.wave_number != null && a.wave_number > 0),
    [archetypes]
  );

  // owned-Count nur über sichtbare (released) Wächter
  const visibleOwned = useMemo(
    () => releasedArchetypes.reduce((n, a) => n + (ownedIds.has(a.id) ? 1 : 0), 0),
    [releasedArchetypes, ownedIds]
  );

  const filtered = useMemo(() => {
    let base = tab === "all" ? releasedArchetypes : releasedArchetypes.filter((a) => a.guardian_type === tab);
    if (factionFilter !== "all") base = base.filter((a) => a.faction === factionFilter);
    return onlyMissingArt ? base.filter((a) => !a.image_url) : base;
  }, [releasedArchetypes, tab, factionFilter, onlyMissingArt]);

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { all: releasedArchetypes.length, infantry: 0, cavalry: 0, marksman: 0, siege: 0, collector: 0, architect: 0 };
    for (const a of releasedArchetypes) if (a.guardian_type) c[a.guardian_type]++;
    return c;
  }, [releasedArchetypes]);

  const factionCounts = useMemo(() => {
    const c: Record<GuardianFaction | "all", number> = { all: releasedArchetypes.length, gossenbund: 0, kronenwacht: 0, netzhueter: 0 };
    for (const a of releasedArchetypes) if (a.faction) c[a.faction]++;
    return c;
  }, [releasedArchetypes]);

  return (
    <Modal open={true} onClose={onClose} size="lg" zIndex={Z.modal} reserveLeftSpace={372}>
      <ModalHeader
        kicker={tG("kicker")}
        title={tG("title", { total: releasedArchetypes.length, owned: visibleOwned })}
        onClose={onClose}
        accent="primary"
      />
      <ModalBody padding="flush">
        {/* Type-Tabs */}
        <div style={{ padding: "6px 8px 4px", display: "flex", gap: 4, borderBottom: "1px solid rgba(255,255,255,0.05)", overflowX: "auto", scrollbarWidth: "none" }}>
          {(["all", "infantry", "cavalry", "marksman", "siege", "collector", "architect"] as Tab[]).map((t) => {
            const rawMeta = t === "all" ? { label: tG("tabAll"), icon: "🌐", color: "#22D1C3" } : TYPE_META[t];
            // Defensive fallback falls TYPE_META veraltete Bundle-Version (Turbopack-Cache)
            const meta = rawMeta ?? { label: t.toUpperCase(), icon: "?", color: "#8B8FA3" };
            return (
              <button key={t} onClick={() => setTab(t)} style={{
                flexShrink: 0, padding: "5px 9px", borderRadius: 8,
                background: tab === t ? meta.color : "rgba(255,255,255,0.04)",
                color: tab === t ? "#0F1115" : "#a8b4cf",
                border: "none", fontSize: 10, fontWeight: 900, letterSpacing: 0.4,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap",
              }}>
                <span>{meta.icon}</span>
                <span>{meta.label.toUpperCase()}</span>
                <span style={{ opacity: 0.7 }}>({counts[t] ?? 0})</span>
              </button>
            );
          })}
        </div>

        {/* Faction-Filter */}
        <div style={{ padding: "4px 8px 6px", display: "flex", gap: 4, borderBottom: "1px solid rgba(255,255,255,0.08)", overflowX: "auto", scrollbarWidth: "none" }}>
          {(["all", "gossenbund", "kronenwacht", "netzhueter"] as const).map((f) => {
            const rawMeta = f === "all" ? { label: "Alle Fraktionen", emoji: "⚔", color: "#8B8FA3" } : FACTION_META[f];
            const meta = rawMeta ?? { label: f.toUpperCase(), emoji: "?", color: "#8B8FA3" };
            const active = factionFilter === f;
            return (
              <button key={f} onClick={() => setFactionFilter(f)} style={{
                flexShrink: 0, padding: "4px 8px", borderRadius: 999,
                background: active ? `${meta.color}33` : "rgba(255,255,255,0.03)",
                color: active ? meta.color : "#8B8FA3",
                border: `1px solid ${active ? `${meta.color}77` : "rgba(255,255,255,0.06)"}`,
                fontSize: 9, fontWeight: 800, letterSpacing: 0.3,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 3, whiteSpace: "nowrap",
              }}>
                <span>{meta.emoji}</span>
                <span>{meta.label}</span>
                <span style={{ opacity: 0.6 }}>({factionCounts[f]})</span>
              </button>
            );
          })}
        </div>

        {/* Admin-Toggle */}
        <div style={{ padding: "4px 8px", display: "flex", justifyContent: "flex-end" }}>
          {isAdmin && (
            <label style={{
              flexShrink: 0, padding: "7px 10px", borderRadius: 10,
              background: "rgba(255,215,0,0.12)", border: "1px solid rgba(255,215,0,0.35)",
              color: "#FFD700", fontSize: 10, fontWeight: 800,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
            }}>
              <input type="checkbox" checked={onlyMissingArt}
                onChange={(e) => setOnlyMissingArt(e.target.checked)}
                style={{ margin: 0 }}
              />
              {tG("onlyMissingArt")}
            </label>
          )}
        </div>

        {/* Grid */}
        <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
            {filtered.map((a) => (
              <GalleryCard
                key={a.id} archetype={a}
                owned={ownedIds.has(a.id)}
                isActive={activeArchetypeId === a.id}
                ownedLevel={ownedGuardians?.find((g) => g.archetype_id === a.id)?.level ?? null}
                isAdmin={isAdmin}
                onUploaded={onImageUploaded}
                onActivate={onActivate}
              />
            ))}
          </div>
          {filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", color: "#8B8FA3", fontSize: 13 }}>
              {tG("noResults")}
            </div>
          )}
        </div>
      </ModalBody>
    </Modal>
  );
}

function GalleryCard({ archetype: a, owned, isActive = false, ownedLevel = null, isAdmin, onUploaded, onActivate }: {
  archetype: GuardianArchetype;
  owned: boolean;
  isActive?: boolean;
  ownedLevel?: number | null;
  isAdmin: boolean;
  onUploaded?: () => void;
  onActivate?: (archetypeId: string) => Promise<void> | void;
}) {
  const tG = useTranslations("GuardianGallery");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const r = rarityMeta(a.rarity);
  const typ = a.guardian_type ? TYPE_META[a.guardian_type] : null;
  const hasImage = !!a.image_url;
  const hasVideo = !!a.video_url;
  const hasArt = hasImage || hasVideo;

  const [promptMode, setPromptMode] = useState<"image" | "video">("image");

  async function copyPromptFor(mode: "image" | "video") {
    setPromptMode(mode);
    const text = buildArchetypePrompt({
      name: a.name,
      rarity: a.rarity as "common" | "elite" | "epic" | "legendary",
      classId: a.class_id ?? null,
      guardianType: a.guardian_type,
      role: a.role,
      species: a.species ?? null,
      gender: a.gender ?? null,
      abilityName: a.ability_name,
      lore: a.lore,
      mode,
    });
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function upload(file: File) {
    setBusy(true); setErr(null);
    try {
      const result = await uploadArtworkDirect(file, "archetype", a.id);
      if (!result.ok) setErr(result.error);
      else onUploaded?.();
    } finally { setBusy(false); }
  }

  return (
    <div style={{
      position: "relative",
      // Kein Hintergrund-Rechteck mehr — nur dezenter Rahmen + Boden-Glow
      padding: 6,
      borderRadius: 12,
      background: "transparent",
      border: isActive
        ? `1.5px solid ${r.color}`
        : owned ? `1px solid ${r.color}33` : "1px solid rgba(255,255,255,0.06)",
      boxShadow: isActive ? `0 0 18px ${r.color}66, inset 0 0 18px ${r.color}22` : "none",
      opacity: owned ? 1 : 0.55,
      display: "flex", flexDirection: "column",
    }}>
      {owned && (
        <div style={{
          position: "absolute", top: 4, right: 4,
          padding: "2px 7px", borderRadius: 999,
          background: isActive ? r.color : "rgba(74,222,128,0.2)",
          color: isActive ? "#0F1115" : "#4ade80",
          border: isActive ? "none" : "1px solid rgba(74,222,128,0.5)",
          fontSize: 8, fontWeight: 900, letterSpacing: 0.5, zIndex: 2,
        }}>{isActive ? tG("active") : tG("level", { n: ownedLevel ?? 1 })}</div>
      )}

      {/* Wave-Badge oben links — W1, W2 ... (W0 = Pre-Launch nicht zeigen) */}
      {a.wave_number != null && a.wave_number > 0 && (
        <div style={{
          position: "absolute", top: 4, left: 4, zIndex: 2,
          padding: "2px 6px", borderRadius: 4,
          background: "linear-gradient(135deg, #22D1C3, #1ba59a)",
          color: "#0F1115",
          fontSize: 8, fontWeight: 900, letterSpacing: 0.6,
          boxShadow: "0 0 6px rgba(34,209,195,0.5)",
        }} title={`Wächter-Welle ${a.wave_number}`}>W{a.wave_number}</div>
      )}

      {/* Faction-Indicator unter dem Wave-Badge (mini) */}
      {a.faction && FACTION_META[a.faction] && (
        <div style={{
          position: "absolute", top: a.wave_number != null && a.wave_number > 0 ? 24 : 4, left: 4, zIndex: 2,
          width: 18, height: 18, borderRadius: "50%",
          background: `${FACTION_META[a.faction].color}33`,
          border: `1px solid ${FACTION_META[a.faction].color}88`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10,
        }} title={`${FACTION_META[a.faction].label} — ${FACTION_META[a.faction].theme}`}>
          {FACTION_META[a.faction].emoji}
        </div>
      )}

      {/* Wächter-Portrait — groß, transparenter Hintergrund, nur Boden-Glow */}
      <div style={{
        position: "relative",
        width: "100%", minHeight: 220,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        filter: owned ? "none" : "grayscale(0.7) brightness(0.7)",
        marginBottom: 4, overflow: "hidden",
      }}>
        {/* Boden-Glow für den Charakter (statt Box-Background) */}
        <div style={{
          position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)",
          width: "70%", height: 24, borderRadius: "50%",
          background: `radial-gradient(ellipse, ${r.glow} 0%, transparent 70%)`,
          opacity: owned ? 0.8 : 0.3,
          pointerEvents: "none",
        }} />
        <GuardianAvatar archetype={a} size={190} animation="idle" fillMode="cover" />
        {!hasArt && owned && (
          <div style={{
            position: "absolute", top: 2, left: 2,
            padding: "2px 6px", borderRadius: 999,
            background: "rgba(255,45,120,0.2)", color: "#FF2D78",
            fontSize: 8, fontWeight: 900, letterSpacing: 0.5,
          }}>{tG("noImage")}</div>
        )}
      </div>

      <div style={{ color: r.color, fontSize: 8, fontWeight: 900, letterSpacing: 0.6, paddingLeft: 2 }}>
        {r.label.toUpperCase()}{typ ? ` · ${typ.icon}` : ""}
      </div>
      <div style={{ color: "#FFF", fontSize: 12, fontWeight: 900, marginTop: 1, paddingLeft: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</div>
      {a.ability_name && (
        <div style={{ color: "#FFD700", fontSize: 9, marginTop: 1, paddingLeft: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          ⚡ {a.ability_name}
        </div>
      )}

      {/* Activate-Button für owned + not active */}
      {owned && !isActive && onActivate && (
        <button onClick={() => onActivate(a.id)} style={{
          width: "100%", marginTop: 6, padding: "6px 6px", borderRadius: 8,
          background: `${r.color}22`, border: `1px solid ${r.color}88`,
          color: r.color, fontSize: 10, fontWeight: 900, cursor: "pointer",
          letterSpacing: 0.5,
        }}>{tG("activate")}</button>
      )}

      {/* Admin-Controls: Prompt (Bild/Video) + Upload */}
      {isAdmin && (
        <>
          <div style={{ display: "flex", gap: 3, marginTop: 6 }}>
            <button onClick={() => copyPromptFor("image")} title={hasImage ? "Bild bereits hochgeladen" : "Bild-Prompt kopieren"}
              style={{
                flex: 1, padding: "4px 2px", borderRadius: 6,
                background: hasImage ? "rgba(74,222,128,0.2)"
                  : promptMode === "image" ? "#22D1C3" : "rgba(34,209,195,0.15)",
                border: `1px solid ${hasImage ? "rgba(74,222,128,0.5)" : "rgba(34,209,195,0.4)"}`,
                color: hasImage ? "#4ade80"
                  : promptMode === "image" ? "#0F1115" : "#22D1C3",
                fontSize: 9, fontWeight: 900, cursor: "pointer",
              }}>
              {copied && promptMode === "image" ? "✓ kopiert" : hasImage ? "✅ Bild" : "📋 Bild"}
            </button>
            <button onClick={() => copyPromptFor("video")} title={hasVideo ? "Video bereits hochgeladen" : "Video-Prompt kopieren"}
              style={{
                flex: 1, padding: "4px 2px", borderRadius: 6,
                background: hasVideo ? "rgba(74,222,128,0.2)"
                  : promptMode === "video" ? "#FF2D78" : "rgba(255,45,120,0.15)",
                border: `1px solid ${hasVideo ? "rgba(74,222,128,0.5)" : "rgba(255,45,120,0.4)"}`,
                color: hasVideo ? "#4ade80"
                  : promptMode === "video" ? "#FFF" : "#FF2D78",
                fontSize: 9, fontWeight: 900, cursor: "pointer",
              }}>
              {copied && promptMode === "video" ? "✓ kopiert" : hasVideo ? "✅ Video" : "🎬 Video"}
            </button>
          </div>
          <label style={{
            marginTop: 4, display: "block", padding: "4px 4px", borderRadius: 6,
            background: hasArt ? "rgba(74,222,128,0.15)" : "rgba(255,45,120,0.15)",
            border: `1px solid ${hasArt ? "rgba(74,222,128,0.4)" : "rgba(255,45,120,0.4)"}`,
            color: hasArt ? "#4ade80" : "#FF2D78",
            fontSize: 9, fontWeight: 900, cursor: busy ? "wait" : "pointer",
            textAlign: "center",
          }}>
            {busy ? "…" : hasArt ? "🔄 Ersetzen" : "⬆️ Bild/MP4"}
            <input type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime" className="hidden" disabled={busy}
              style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }}
            />
          </label>
        </>
      )}
      {err && <div style={{ color: "#FF2D78", fontSize: 8, marginTop: 3 }}>{err}</div>}

      {/* Silence unused var */}
      <span style={{ display: "none" }}>{RARITY_META.elite.label}</span>
    </div>
  );
}
