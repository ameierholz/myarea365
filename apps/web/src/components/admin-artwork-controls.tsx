"use client";

import { useRef, useState } from "react";
import { uploadArtworkDirect } from "@/lib/artwork-upload";

export function AdminArtworkControls({
  targetType, targetId, variant, buildPrompt, hasImage, hasVideo, onUploaded,
}: {
  targetType: "marker" | "light" | "pin_theme" | "siegel" | "potion" | "rank" | "material" | "base_theme" | "building" | "resource" | "chest";
  targetId: string;
  variant?: "neutral" | "male" | "female";
  buildPrompt: (mode: "image" | "video") => string;
  hasImage: boolean;
  hasVideo: boolean;
  onUploaded?: () => void;
}) {
  const imgRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<"image" | "video" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function copy(mode: "image" | "video") {
    await navigator.clipboard.writeText(buildPrompt(mode));
    setCopied(mode);
    setTimeout(() => setCopied(null), 1500);
  }

  async function upload(file: File) {
    setBusy(true); setErr(null);
    try {
      const sizeMb = file.size / (1024 * 1024);
      if (sizeMb > 50) {
        const msg = `Datei ist ${sizeMb.toFixed(1)} MB — über 50 MB. Bitte komprimieren.`;
        setErr(msg); return;
      }
      const result = await uploadArtworkDirect(file, targetType, targetId, variant);
      if (!result.ok) setErr(result.error); else onUploaded?.();
    } finally { setBusy(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 6 }}>
      <div style={{ display: "flex", gap: 3 }}>
        <button onClick={(e) => { e.stopPropagation(); copy("image"); }} style={btn("#22D1C3")}>
          {copied === "image" ? "✓ Kopiert" : "📋 Prompt Bild"}
        </button>
        <button onClick={(e) => { e.stopPropagation(); copy("video"); }} style={btn("#FF2D78")}>
          {copied === "video" ? "✓ Kopiert" : "🎬 Prompt Video"}
        </button>
      </div>
      <div style={{ display: "flex", gap: 3 }}>
        <button onClick={(e) => { e.stopPropagation(); imgRef.current?.click(); }} disabled={busy} style={btn("#4ade80")}>
          {busy ? "…" : hasImage ? "🖼️ Bild ersetzen" : "🖼️ Bild hoch"}
        </button>
        <button onClick={(e) => { e.stopPropagation(); vidRef.current?.click(); }} disabled={busy} style={btn("#a855f7")}>
          {busy ? "…" : hasVideo ? "🎞️ MP4 ersetzen" : "🎞️ MP4 hoch"}
        </button>
      </div>
      {err && <div style={{ fontSize: 8, color: "#FF2D78" }}>{err}</div>}
      <input ref={imgRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
      <input ref={vidRef} type="file" accept="video/mp4,video/webm" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
    </div>
  );
}

function btn(color: string): React.CSSProperties {
  return {
    flex: 1, padding: "3px 4px", borderRadius: 5,
    background: `${color}22`, border: `1px solid ${color}55`,
    color, fontSize: 8, fontWeight: 900, cursor: "pointer",
  };
}
