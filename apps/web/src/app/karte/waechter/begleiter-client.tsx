"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

// Lazy-load der Three.js-Komponente — three+r3f sind ~700KB gz, sollen nur
// beim tatsächlichen Öffnen dieses Tabs geladen werden, nicht im Hauptbundle.
const Begleiter3D = dynamic(
  () => import("@/components/begleiter-3d").then((m) => m.Begleiter3D),
  { ssr: false, loading: () => <Loading /> }
);

type Animation = "idle" | "walk" | "run" | "jump" | "throw" | "interact" | "pickup" | "hit" | "spawn" | "death";

const ANIMS: Array<{ id: Animation; label: string; emoji: string }> = [
  { id: "idle",     label: "Bereit",      emoji: "🧍" },
  { id: "walk",     label: "Gehen",       emoji: "🚶" },
  { id: "run",      label: "Rennen",      emoji: "🏃" },
  { id: "jump",     label: "Springen",    emoji: "🦘" },
  { id: "throw",    label: "Werfen",      emoji: "🎯" },
  { id: "interact", label: "Interagieren", emoji: "✋" },
  { id: "pickup",   label: "Aufheben",    emoji: "🤲" },
  { id: "hit",      label: "Treffer",     emoji: "💢" },
  { id: "spawn",    label: "Erscheinen",  emoji: "✨" },
  { id: "death",    label: "Niederlage",  emoji: "💀" },
];

export function BegleiterClient() {
  const [anim, setAnim] = useState<Animation>("idle");

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, height: "100%", overflow: "hidden" }}>
      {/* LINKS — 3D-Modell */}
      <div style={{
        position: "relative",
        background: "linear-gradient(180deg, rgba(15,17,21,0.55) 0%, rgba(15,17,21,0.4) 100%)",
        backdropFilter: "blur(8px) saturate(1.1)",
        WebkitBackdropFilter: "blur(8px) saturate(1.1)",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
        overflow: "hidden",
      }}>
        <Begleiter3D animation={anim} height={350} background="transparent" />
        {/* Animation-Label oben */}
        <div style={{
          position: "absolute", top: 8, left: 12,
          padding: "3px 10px", borderRadius: 999,
          background: "rgba(255,210,122,0.25)",
          border: "1px solid rgba(255,210,122,0.5)",
          color: "#FFE4B8", fontSize: 10, fontWeight: 900, letterSpacing: 0.5,
        }}>
          {ANIMS.find((a) => a.id === anim)?.label.toUpperCase()}
        </div>
      </div>

      {/* RECHTS — Animation-Picker (Demo) — scrollbar falls mehr Buttons als Höhe */}
      <div style={{
        width: 140,
        maxHeight: "100%",
        display: "flex", flexDirection: "column", gap: 4,
        padding: 8,
        overflowY: "auto",
        background: "linear-gradient(180deg, rgba(15,17,21,0.55) 0%, rgba(15,17,21,0.4) 100%)",
        backdropFilter: "blur(8px) saturate(1.1)",
        WebkitBackdropFilter: "blur(8px) saturate(1.1)",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
      }}>
        <div style={{
          fontSize: 9, fontWeight: 900, letterSpacing: 1, color: "#FFE4B8",
          textTransform: "uppercase", textAlign: "center", marginBottom: 4,
        }}>Animationen</div>
        {ANIMS.map((a) => {
          const active = a.id === anim;
          return (
            <button
              key={a.id}
              onClick={() => setAnim(a.id)}
              style={{
                padding: "4px 8px",
                borderRadius: 8,
                background: active
                  ? "linear-gradient(135deg, rgba(255,210,122,0.3), rgba(255,160,64,0.2))"
                  : "rgba(255,255,255,0.05)",
                border: active ? "1.5px solid rgba(255,210,122,0.6)" : "1px solid rgba(255,255,255,0.08)",
                color: active ? "#FFE4B8" : "#C8CDD9",
                fontSize: 10, fontWeight: 700,
                display: "flex", alignItems: "center", gap: 5,
                cursor: "pointer",
                transition: "all 0.15s",
                textShadow: "0 1px 2px rgba(0,0,0,0.6)",
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 14 }}>{a.emoji}</span>
              <span>{a.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div style={{
      width: "100%", height: 350,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#8B8FA3", fontSize: 12,
    }}>
      Lade 3D-Modell …
    </div>
  );
}
