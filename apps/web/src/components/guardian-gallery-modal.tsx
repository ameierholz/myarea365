"use client";

import { useEffect, useMemo, useState } from "react";
import { GuardianAvatar } from "@/components/guardian-avatar";
import {
  rarityMeta, TYPE_META, RARITY_META,
  type GuardianArchetype, type GuardianType,
} from "@/lib/guardian";
import { buildArchetypePrompt } from "@/lib/artwork-prompts";

type Tab = "all" | GuardianType;

export function GuardianGalleryModal({
  archetypes, ownedIds, onClose, isAdmin = false, onImageUploaded,
}: {
  archetypes: GuardianArchetype[];
  ownedIds: Set<string>;
  onClose: () => void;
  isAdmin?: boolean;
  onImageUploaded?: () => void;
}) {
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
            <div style={{ color: "#22D1C3", fontSize: 9, fontWeight: 900, letterSpacing: 2 }}>SAMMLUNG</div>
            <div style={{ color: "#FFF", fontSize: 16, fontWeight: 900 }}>60 Wächter · {ownedIds.size} im Besitz</div>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "#8B8FA3",
            fontSize: 22, cursor: "pointer", width: 32, height: 32,
          }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ padding: "8px 12px", display: "flex", gap: 6, borderBottom: "1px solid rgba(255,255,255,0.08)", overflowX: "auto" }}>
          {(["all", "infantry", "cavalry", "marksman", "mage"] as Tab[]).map((t) => {
            const meta = t === "all" ? { label: "Alle", icon: "🌐", color: "#22D1C3" } : TYPE_META[t];
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
              🎨 Nur ohne Art
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
                isAdmin={isAdmin}
                onUploaded={onImageUploaded}
              />
            ))}
          </div>
          {filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", color: "#8B8FA3", fontSize: 13 }}>
              Keine Wächter passen zur Auswahl.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GalleryCard({ archetype: a, owned, isAdmin, onUploaded }: {
  archetype: GuardianArchetype;
  owned: boolean;
  isAdmin: boolean;
  onUploaded?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const r = rarityMeta(a.rarity);
  const typ = a.guardian_type ? TYPE_META[a.guardian_type] : null;
  const hasArt = !!a.image_url;

  const [promptMode, setPromptMode] = useState<"image" | "video">("image");
  const prompt = useMemo(() => buildArchetypePrompt({
    name: a.name,
    rarity: a.rarity as "elite" | "epic" | "legendary",
    guardianType: a.guardian_type,
    role: a.role,
    abilityName: a.ability_name,
    lore: a.lore,
    mode: promptMode,
  }), [a, promptMode]);

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
      const form = new FormData();
      form.append("file", file);
      form.append("target_type", "archetype");
      form.append("target_id", a.id);
      const res = await fetch("/api/admin/artwork", { method: "POST", body: form });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error || "Upload fehlgeschlagen");
      } else {
        onUploaded?.();
      }
    } finally { setBusy(false); }
  }

  return (
    <div style={{
      padding: 8, borderRadius: 12,
      background: owned
        ? `linear-gradient(135deg, ${r.glow}, rgba(15,17,21,0.7))`
        : "rgba(70,82,122,0.12)",
      border: `1px solid ${owned ? r.color : "rgba(255,255,255,0.08)"}`,
      opacity: owned ? 1 : 0.75,
      position: "relative",
    }}>
      {owned && (
        <div style={{
          position: "absolute", top: 6, right: 6,
          padding: "2px 7px", borderRadius: 999,
          background: "#4ade80", color: "#0F1115",
          fontSize: 8, fontWeight: 900, letterSpacing: 0.5, zIndex: 2,
        }}>✓ Besitzt</div>
      )}
      {!hasArt && (
        <div style={{
          position: "absolute", top: 6, left: 6,
          padding: "2px 6px", borderRadius: 999,
          background: "rgba(255,45,120,0.3)", color: "#FF2D78",
          fontSize: 8, fontWeight: 900, letterSpacing: 0.5, zIndex: 2,
        }}>KEIN BILD</div>
      )}

      <div style={{
        width: "100%", aspectRatio: "1 / 1",
        display: "flex", justifyContent: "center",
        filter: owned ? "none" : "grayscale(0.5) brightness(0.85)",
        marginBottom: 4,
      }}>
        <GuardianAvatar archetype={a} size={110} animation="idle" />
      </div>

      <div style={{ color: r.color, fontSize: 8, fontWeight: 900, letterSpacing: 0.6 }}>
        {r.label.toUpperCase()}{typ ? ` · ${typ.icon}` : ""}
      </div>
      <div style={{ color: "#FFF", fontSize: 11, fontWeight: 900, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</div>
      {a.ability_name && (
        <div style={{ color: "#FFD700", fontSize: 9, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          ⚡ {a.ability_name}
        </div>
      )}

      {/* Admin-Controls: Prompt (Bild/Video) + Upload */}
      {isAdmin && (
        <>
          <div style={{ display: "flex", gap: 3, marginTop: 6 }}>
            <button onClick={() => copyPromptFor("image")} style={{
              flex: 1, padding: "4px 2px", borderRadius: 6,
              background: promptMode === "image" ? "#22D1C3" : "rgba(34,209,195,0.15)",
              border: "1px solid rgba(34,209,195,0.4)",
              color: promptMode === "image" ? "#0F1115" : "#22D1C3",
              fontSize: 9, fontWeight: 900, cursor: "pointer",
            }}>{copied && promptMode === "image" ? "✓" : "📋 Bild"}</button>
            <button onClick={() => copyPromptFor("video")} style={{
              flex: 1, padding: "4px 2px", borderRadius: 6,
              background: promptMode === "video" ? "#FF2D78" : "rgba(255,45,120,0.15)",
              border: "1px solid rgba(255,45,120,0.4)",
              color: promptMode === "video" ? "#FFF" : "#FF2D78",
              fontSize: 9, fontWeight: 900, cursor: "pointer",
            }}>{copied && promptMode === "video" ? "✓" : "🎬"}</button>
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
