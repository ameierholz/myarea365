"use client";

import { useState } from "react";

const LS_KEY = "ma365:onboardingSeenV1";

export function markOnboardingSeen() {
  try { window.localStorage.setItem(LS_KEY, "1"); } catch { /* ignore */ }
}

export function shouldShowOnboarding(): boolean {
  try { return typeof window !== "undefined" && window.localStorage.getItem(LS_KEY) !== "1"; }
  catch { return false; }
}

type Slide = {
  emoji: string;
  title: string;
  color: string;
  gradient: string;
  xp: string;
  body: string;
  visual: React.ReactNode;
};

/**
 * Mini-SVG als Illustration eines Straßenabschnitts (fetter Liniensegment).
 */
function SegmentVisual() {
  return (
    <svg viewBox="0 0 200 120" style={{ width: "100%", height: 120 }}>
      <line x1="20" y1="60" x2="180" y2="60" stroke="rgba(255,255,255,0.12)" strokeWidth="3" strokeDasharray="4 6" />
      <line x1="60" y1="60" x2="140" y2="60" stroke="#22D1C3" strokeWidth="6" strokeLinecap="round" />
      <circle cx="60" cy="60" r="6" fill="#22D1C3" />
      <circle cx="140" cy="60" r="6" fill="#22D1C3" />
      <text x="100" y="92" fill="#22D1C3" fontSize="11" fontWeight="900" textAnchor="middle" letterSpacing="1.5">1 ABSCHNITT</text>
    </svg>
  );
}

/**
 * Straßenzug: mehrere verbundene Segmente in einer Reihe.
 */
function StreetVisual() {
  return (
    <svg viewBox="0 0 200 120" style={{ width: "100%", height: 120 }}>
      <line x1="20" y1="60" x2="180" y2="60" stroke="#FFD700" strokeWidth="8" strokeLinecap="round" />
      {[20, 60, 100, 140, 180].map((x) => (
        <circle key={x} cx={x} cy={60} r="5" fill="#FFD700" />
      ))}
      <text x="100" y="92" fill="#FFD700" fontSize="11" fontWeight="900" textAnchor="middle" letterSpacing="1.5">KOMPLETTER STRASSENZUG</text>
    </svg>
  );
}

/**
 * Territorium: geschlossenes Polygon aus 4 Straßenzügen.
 */
function TerritoryVisual() {
  return (
    <svg viewBox="0 0 200 120" style={{ width: "100%", height: 120 }}>
      {/* Polygon-Fill */}
      <polygon points="40,30 160,30 160,90 40,90"
        fill="#FF2D78" fillOpacity="0.18"
        stroke="#FF2D78" strokeWidth="4" strokeLinejoin="round" />
      <polygon points="40,30 160,30 160,90 40,90"
        fill="none" stroke="#FFD700" strokeWidth="1" strokeDasharray="3 3" />
      {[[40, 30], [160, 30], [160, 90], [40, 90]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4" fill="#FFD700" />
      ))}
      <text x="100" y="112" fill="#FF2D78" fontSize="11" fontWeight="900" textAnchor="middle" letterSpacing="1.5">GESCHLOSSENES TERRITORIUM</text>
    </svg>
  );
}

const SLIDES: Slide[] = [
  {
    emoji: "🛤️",
    title: "1. Straßenabschnitt",
    color: "#22D1C3",
    gradient: "radial-gradient(at 50% 0%, rgba(34,209,195,0.25), transparent 60%)",
    xp: "+50 XP",
    body: "Der kleinste Baustein: ein einzelnes Straßenstück zwischen zwei Kreuzungen. Jeder Abschnitt den du als Erster abläufst, gehört dir — und bringt 50 XP.",
    visual: <SegmentVisual />,
  },
  {
    emoji: "🛣️",
    title: "2. Straßenzug",
    color: "#FFD700",
    gradient: "radial-gradient(at 50% 0%, rgba(255,215,0,0.28), transparent 60%)",
    xp: "+250 XP Bonus",
    body: "Hast du ALLE Abschnitte einer Straße gesammelt, wird sie als kompletter Straßenzug für dich freigeschaltet — plus einem satten 250-XP-Bonus obendrauf.",
    visual: <StreetVisual />,
  },
  {
    emoji: "🏆",
    title: "3. Territorium (Crew-Sache)",
    color: "#FF2D78",
    gradient: "radial-gradient(at 50% 0%, rgba(255,45,120,0.28), transparent 60%)",
    xp: "+500 XP",
    body: "Wenn sich mehrere Straßenzüge zu einem geschlossenen Ring treffen (Block, Viereck, Kreis), wird das Innere zum Territorium. Wichtig: Territorien sind Crew-Gebiet. Bist du Mitglied, kassiert deine Crew 500 XP. Solo kannst du den Ring zwar sichtbar machen — der Loot geht aber erst los, sobald du einer Crew beitrittst.",
    visual: <TerritoryVisual />,
  },
];

export function OnboardingModal({ onClose }: { onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const slide = SLIDES[idx];
  const isLast = idx === SLIDES.length - 1;

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(8, 10, 14, 0.88)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 440, maxHeight: "90vh", overflow: "auto",
        background: `#1A1D23 ${slide.gradient.includes("radial") ? "" : ""}`,
        backgroundImage: `${slide.gradient}, linear-gradient(180deg, #1A1D23 0%, #0F1115 100%)`,
        borderRadius: 20,
        border: `1px solid ${slide.color}44`,
        boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 30px ${slide.color}22`,
        padding: 24,
        color: "#FFF",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: "#8B8FA3", fontWeight: 900 }}>
            WILLKOMMEN BEI MYAREA365
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
            color: "#8B8FA3", fontSize: 16, fontWeight: 900, cursor: "pointer",
          }}>✕</button>
        </div>

        <div style={{ fontSize: 54, textAlign: "center", marginTop: 4, filter: `drop-shadow(0 0 20px ${slide.color}aa)` }}>
          {slide.emoji}
        </div>
        <div style={{ textAlign: "center", fontSize: 22, fontWeight: 900, marginTop: 6, color: slide.color }}>
          {slide.title}
        </div>
        <div style={{
          margin: "10px auto 0",
          width: "max-content",
          padding: "4px 12px", borderRadius: 999,
          background: `${slide.color}22`, border: `1px solid ${slide.color}`,
          color: slide.color, fontSize: 12, fontWeight: 900, letterSpacing: 0.5,
        }}>
          {slide.xp}
        </div>

        <div style={{
          marginTop: 20, borderRadius: 14,
          background: "rgba(15,17,21,0.6)",
          border: "1px solid rgba(255,255,255,0.06)",
          padding: 12,
        }}>
          {slide.visual}
        </div>

        <p style={{ fontSize: 14, lineHeight: 1.55, color: "#D0D0D5", marginTop: 16 }}>
          {slide.body}
        </p>

        {/* Progress-Dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 22 }}>
          {SLIDES.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)} style={{
              width: i === idx ? 22 : 8, height: 8, borderRadius: 999,
              background: i === idx ? slide.color : "rgba(255,255,255,0.15)",
              border: "none", cursor: "pointer", transition: "all 0.2s",
            }} aria-label={`Slide ${i + 1}`} />
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          {idx > 0 && (
            <button onClick={() => setIdx((i) => Math.max(0, i - 1))} style={{
              flex: 1, padding: "12px", borderRadius: 12,
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
              color: "#FFF", fontSize: 13, fontWeight: 800, cursor: "pointer",
            }}>← Zurück</button>
          )}
          <button onClick={() => isLast ? onClose() : setIdx((i) => i + 1)} style={{
            flex: 2, padding: "12px", borderRadius: 12, border: "none",
            background: `linear-gradient(135deg, ${slide.color}, ${slide.color}dd)`,
            color: "#0F1115", fontSize: 14, fontWeight: 900, cursor: "pointer",
            boxShadow: `0 4px 20px ${slide.color}55`,
          }}>
            {isLast ? "Los geht's! 🏃" : "Weiter →"}
          </button>
        </div>
      </div>
    </div>
  );
}
