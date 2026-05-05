"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useModalBackgroundArt } from "@/components/resource-icon";

/**
 * Wiederverwendbarer Fullscreen-Modal-Frame für die Tab-Routen
 * (/karte/base, /karte/waechter, /karte/crew, /karte/inventar, /karte/shop).
 *
 * Look & Feel orientiert an RoK/CoD: Top-Bar mit Titel + Close-Button,
 * scrollbarer Content, animiertes Hintergrund-Theme pro Tab.
 *
 * `theme` wählt die Hintergrund-Variante aus (urban/arena/banner/warehouse/store).
 */
export type FrameTheme = "urban" | "arena" | "banner" | "warehouse" | "store";

// Hellere, einladende Theme-Paletten — RoK/CoD-inspiriert (heller Himmel + warme Akzente)
const THEME_BG: Record<FrameTheme, { from: string; via: string; accent: string; soft: string }> = {
  urban:     { from: "#5A8FB5", via: "#8FBFE0", accent: "#FFD27A", soft: "#FFF4D6" },  // Base — heller Tageshimmel + warmes Gold
  arena:     { from: "#3A1F35", via: "#7A3A4F", accent: "#FFB088", soft: "#FFD9C2" },  // Wächter — Sunset-rosa
  banner:    { from: "#2A2A18", via: "#5C5230", accent: "#FFD700", soft: "#FFE9A8" },  // Crew — Royal-gold
  warehouse: { from: "#2A2418", via: "#5C4E32", accent: "#D4A574", soft: "#F0D4A8" },  // Inventar — Warm-braun
  store:     { from: "#2A1838", via: "#583A6F", accent: "#FFB3D9", soft: "#FFD6EC" },  // Shop — Soft-purple
};

export function FullscreenFrame({
  title,
  subtitle,
  theme = "urban",
  bgSlot,
  children,
  onClose,
}: {
  title: string;
  subtitle?: string;
  theme?: FrameTheme;
  /** Slot-ID für Modal-Background-Artwork (z.B. "karte_base_bg"). Wenn vorhanden überschreibt es den Theme-Gradient. */
  bgSlot?: string;
  children: React.ReactNode;
  onClose?: () => void;
}) {
  const router = useRouter();
  const palette = THEME_BG[theme];
  const bgArt = useModalBackgroundArt();
  const customBg = bgSlot ? bgArt[bgSlot] : null;

  // ESC = zurück zur Karte
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (onClose) onClose();
        else router.push("/karte");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, onClose]);

  const handleClose = () => {
    if (onClose) onClose();
    else router.push("/karte");
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        display: "flex",
        flexDirection: "column",
        color: "#F0F0F0",
        // Heller, einladender Himmel-Verlauf — RoK-Stil
        background: `radial-gradient(ellipse at 50% -10%, ${palette.soft} 0%, ${palette.via} 45%, ${palette.from} 100%)`,
        animation: "ma365FrameFade 280ms ease-out",
      }}
    >
      <style>{`
        @keyframes ma365FrameFade {
          from { opacity: 0; transform: scale(0.98); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes ma365FrameGrid {
          from { background-position: 0 0; }
          to   { background-position: 0 60px; }
        }
        @keyframes ma365FrameClouds {
          from { transform: translateX(0); }
          to   { transform: translateX(-200px); }
        }
        .ma365-frame-bg {
          position: absolute; inset: 0;
          background-image:
            radial-gradient(ellipse at 20% 30%, ${palette.soft}22, transparent 40%),
            radial-gradient(ellipse at 70% 20%, ${palette.soft}1a, transparent 45%),
            radial-gradient(ellipse at 50% 80%, ${palette.accent}1a, transparent 50%);
          animation: ma365FrameClouds 60s linear infinite alternate;
          pointer-events: none;
        }
        .ma365-frame-glow {
          position: absolute; inset: 0;
          background:
            radial-gradient(circle at 15% 90%, ${palette.accent}33, transparent 45%),
            radial-gradient(circle at 85% 10%, ${palette.soft}22, transparent 40%);
          pointer-events: none;
        }
        .ma365-frame-header {
          position: relative; z-index: 2;
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 14px;
          background: linear-gradient(180deg, rgba(15,17,21,0.45) 0%, transparent 100%);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border-bottom: 1px solid ${palette.accent}55;
          flex-shrink: 0;
        }
        .ma365-frame-title {
          font-size: 16px; font-weight: 900; letter-spacing: 0.5px;
          color: #FFF;
          text-shadow: 0 1px 2px rgba(0,0,0,0.7);
        }
        .ma365-frame-subtitle {
          font-size: 10px; color: #8B8FA3; margin-top: 2px;
          letter-spacing: 0.3px;
        }
        .ma365-frame-close {
          width: 32px; height: 32px; border-radius: 999px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          color: #F0F0F0;
          font-size: 16px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: background 0.15s, transform 0.1s;
        }
        .ma365-frame-close:hover {
          background: ${palette.accent}33;
          border-color: ${palette.accent};
          transform: scale(1.05);
        }
        .ma365-frame-close:active { transform: scale(0.95); }
        .ma365-frame-content {
          position: relative; z-index: 2;
          flex: 1;
          overflow-y: auto;
          padding: 12px 14px max(20px, env(safe-area-inset-bottom));
          -webkit-overflow-scrolling: touch;
        }
      `}</style>

      {/* Modal-Background-Artwork (Image oder MP4-Video) — überschreibt den Theme-Gradient wenn hochgeladen */}
      {customBg?.video_url ? (
        <video
          src={customBg.video_url}
          autoPlay loop muted playsInline
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0, pointerEvents: "none" }}
        />
      ) : customBg?.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={customBg.image_url}
          alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0, pointerEvents: "none" }}
        />
      ) : (
        <>
          <div className="ma365-frame-bg" />
          <div className="ma365-frame-glow" />
        </>
      )}

      <div className="ma365-frame-header">
        <div>
          <div className="ma365-frame-title">{title}</div>
          {subtitle && <div className="ma365-frame-subtitle">{subtitle}</div>}
        </div>
        <button
          type="button"
          className="ma365-frame-close"
          onClick={handleClose}
          aria-label="Schließen"
        >
          ✕
        </button>
      </div>

      <div className="ma365-frame-content">{children}</div>
    </div>
  );
}

/**
 * Standard-Card-Container für Tab-Sections (Hero, Stats, etc.).
 * Glass-Morphism + accent border, RoK-Vibe.
 */
export function FrameCard({
  title,
  accent = "#22D1C3",
  children,
  noPadding = false,
}: {
  title?: string;
  accent?: string;
  children: React.ReactNode;
  noPadding?: boolean;
}) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.06)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        border: `1px solid rgba(255,255,255,0.12)`,
        borderRadius: 18,
        marginBottom: 10,
        boxShadow: `0 4px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.1)`,
        overflow: "hidden",
      }}
    >
      {title && (
        <div
          style={{
            padding: "8px 12px",
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: accent,
            background: `linear-gradient(90deg, ${accent}11, transparent)`,
            borderBottom: `1px solid ${accent}22`,
          }}
        >
          {title}
        </div>
      )}
      <div style={{ padding: noPadding ? 0 : 12 }}>{children}</div>
    </div>
  );
}
