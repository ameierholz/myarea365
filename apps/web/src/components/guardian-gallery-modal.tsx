"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { GuardianAvatar } from "@/components/guardian-avatar";
import {
  rarityMeta, TYPE_META, RARITY_META,
  type GuardianArchetype, type GuardianType,
} from "@/lib/guardian";
import { buildArchetypePrompt } from "@/lib/artwork-prompts";
import { uploadArtworkDirect } from "@/lib/artwork-upload";
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
  const [onlyMissingArt, setOnlyMissingArt] = useState(false);

  const filtered = useMemo(() => {
    const base = tab === "all" ? archetypes : archetypes.filter((a) => a.guardian_type === tab);
    return onlyMissingArt ? base.filter((a) => !a.image_url) : base;
  }, [archetypes, tab, onlyMissingArt]);

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { all: archetypes.length, infantry: 0, cavalry: 0, marksman: 0, mage: 0 };
    for (const a of archetypes) if (a.guardian_type) c[a.guardian_type]++;
    return c;
  }, [archetypes]);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 3700,
      background: "rgba(15,17,21,0.92)", backdropFilter: "blur(14px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 12,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 780, maxHeight: "92vh",
        display: "flex", flexDirection: "column",
        background: "#1A1D23", borderRadius: 20,
        border: "1px solid rgba(34,209,195,0.45)",
        boxShadow: "0 0 40px rgba(34,209,195,0.25)",
        color: "#F0F0F0", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "14px 18px", display: "flex", alignItems: "center", gap: 10,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#22D1C3", fontSize: 9, fontWeight: 900, letterSpacing: 2 }}>{tG("kicker")}</div>
            <div style={{ color: "#FFF", fontSize: 16, fontWeight: 900 }}>{tG("title", { owned: ownedIds.size })}</div>
          </div>
          <button onClick={onClose} aria-label={tG("closeAria")} style={{
            background: "none", border: "none", color: "#8B8FA3",
            fontSize: 22, cursor: "pointer", width: 32, height: 32,
          }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ padding: "8px 12px", display: "flex", gap: 6, borderBottom: "1px solid rgba(255,255,255,0.08)", overflowX: "auto" }}>
          {(["all", "infantry", "cavalry", "marksman", "mage"] as Tab[]).map((t) => {
            const meta = t === "all" ? { label: tG("tabAll"), icon: "🌐", color: "#22D1C3" } : TYPE_META[t];
            return (
              <button key={t} onClick={() => setTab(t)} style={{
                flexShrink: 0, padding: "7px 12px", borderRadius: 10,
                background: tab === t ? meta.color : "rgba(255,255,255,0.06)",
                color: tab === t ? "#0F1115" : "#a8b4cf",
                border: "none", fontSize: 11, fontWeight: 900, letterSpacing: 0.5,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
              }}>
                <span>{meta.icon}</span>
                <span>{meta.label.toUpperCase()}</span>
                <span style={{ opacity: 0.7 }}>({counts[t]})</span>
              </button>
            );
          })}
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
      </div>
    </div>
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
      rarity: a.rarity as "elite" | "epic" | "legendary",
      guardianType: a.guardian_type,
      role: a.role,
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
