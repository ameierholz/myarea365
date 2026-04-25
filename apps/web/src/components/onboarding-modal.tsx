"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";

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

function SegmentVisual({ label }: { label: string }) {
  return (
    <svg viewBox="0 0 200 120" style={{ width: "100%", height: 120 }}>
      <line x1="20" y1="60" x2="180" y2="60" stroke="rgba(255,255,255,0.12)" strokeWidth="3" strokeDasharray="4 6" />
      <line x1="60" y1="60" x2="140" y2="60" stroke="#22D1C3" strokeWidth="6" strokeLinecap="round" />
      <circle cx="60" cy="60" r="6" fill="#22D1C3" />
      <circle cx="140" cy="60" r="6" fill="#22D1C3" />
      <text x="100" y="92" fill="#22D1C3" fontSize="11" fontWeight="900" textAnchor="middle" letterSpacing="1.5">{label}</text>
    </svg>
  );
}

function StreetVisual({ label }: { label: string }) {
  return (
    <svg viewBox="0 0 200 120" style={{ width: "100%", height: 120 }}>
      <line x1="20" y1="60" x2="180" y2="60" stroke="#FFD700" strokeWidth="8" strokeLinecap="round" />
      {[20, 60, 100, 140, 180].map((x) => (
        <circle key={x} cx={x} cy={60} r="5" fill="#FFD700" />
      ))}
      <text x="100" y="92" fill="#FFD700" fontSize="11" fontWeight="900" textAnchor="middle" letterSpacing="1.5">{label}</text>
    </svg>
  );
}

function TerritoryVisual({ label }: { label: string }) {
  return (
    <svg viewBox="0 0 200 120" style={{ width: "100%", height: 120 }}>
      <polygon points="40,30 160,30 160,90 40,90"
        fill="#FF2D78" fillOpacity="0.18"
        stroke="#FF2D78" strokeWidth="4" strokeLinejoin="round" />
      <polygon points="40,30 160,30 160,90 40,90"
        fill="none" stroke="#FFD700" strokeWidth="1" strokeDasharray="3 3" />
      {[[40, 30], [160, 30], [160, 90], [40, 90]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4" fill="#FFD700" />
      ))}
      <text x="100" y="112" fill="#FF2D78" fontSize="11" fontWeight="900" textAnchor="middle" letterSpacing="1.5">{label}</text>
    </svg>
  );
}

function FirstWeekVisual({ labels }: { labels: { run: string; crew: string; arena: string; shop: string } }) {
  const items: { icon: string; label: string; color: string }[] = [
    { icon: "🏃", label: labels.run,   color: "#22D1C3" },
    { icon: "👥", label: labels.crew,  color: "#FFD700" },
    { icon: "⚔️", label: labels.arena, color: "#FF2D78" },
    { icon: "💎", label: labels.shop,  color: "#5ddaf0" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, padding: "8px 4px" }}>
      {items.map((it) => (
        <div key={it.label} style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
          padding: "10px 4px", borderRadius: 10,
          background: `${it.color}14`, border: `1px solid ${it.color}44`,
        }}>
          <div style={{ fontSize: 26 }}>{it.icon}</div>
          <div style={{ fontSize: 10, fontWeight: 900, color: it.color, letterSpacing: 0.5 }}>{it.label}</div>
        </div>
      ))}
    </div>
  );
}

export function OnboardingModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("Onboarding");
  const [idx, setIdx] = useState(0);

  const slides = useMemo<Slide[]>(() => [
    {
      emoji: "🛤️",
      title: t("Slide1.title"),
      color: "#22D1C3",
      gradient: "radial-gradient(at 50% 0%, rgba(34,209,195,0.25), transparent 60%)",
      xp: t("Slide1.xp"),
      body: t("Slide1.body"),
      visual: <SegmentVisual label={t("labelSegment")} />,
    },
    {
      emoji: "🛣️",
      title: t("Slide2.title"),
      color: "#FFD700",
      gradient: "radial-gradient(at 50% 0%, rgba(255,215,0,0.28), transparent 60%)",
      xp: t("Slide2.xp"),
      body: t("Slide2.body"),
      visual: <StreetVisual label={t("labelStreet")} />,
    },
    {
      emoji: "🏆",
      title: t("Slide3.title"),
      color: "#FF2D78",
      gradient: "radial-gradient(at 50% 0%, rgba(255,45,120,0.28), transparent 60%)",
      xp: t("Slide3.xp"),
      body: t("Slide3.body"),
      visual: <TerritoryVisual label={t("labelTerritory")} />,
    },
    {
      emoji: "🚀",
      title: t("Slide4.title"),
      color: "#5ddaf0",
      gradient: "radial-gradient(at 50% 0%, rgba(93,218,240,0.28), transparent 60%)",
      xp: t("Slide4.xp"),
      body: t("Slide4.body"),
      visual: <FirstWeekVisual labels={{
        run: t("firstWeekLaufLabel"),
        crew: t("firstWeekCrewLabel"),
        arena: t("firstWeekArenaLabel"),
        shop: t("firstWeekShopLabel"),
      }} />,
    },
  ], [t]);

  const slide = slides[idx];
  const isLast = idx === slides.length - 1;

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
            {t("header")}
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

        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 22 }}>
          {slides.map((_, i) => (
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
            }}>{t("back")}</button>
          )}
          <button onClick={() => isLast ? onClose() : setIdx((i) => i + 1)} style={{
            flex: 2, padding: "12px", borderRadius: 12, border: "none",
            background: `linear-gradient(135deg, ${slide.color}, ${slide.color}dd)`,
            color: "#0F1115", fontSize: 14, fontWeight: 900, cursor: "pointer",
            boxShadow: `0 4px 20px ${slide.color}55`,
          }}>
            {isLast ? t("finish") : t("next")}
          </button>
        </div>
      </div>
    </div>
  );
}
