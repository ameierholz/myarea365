"use client";

/**
 * WeatherActionHint — kompakter Hinweis-Block für Action-Confirm-Dialoge
 * (Bau, Forschung, Marsch, Heilen). Holt das Wetter-Effekt-Bundle und zeigt
 * pro Lever die effektive Veränderung mit Quelle (Wetter, Tageszeit).
 *
 * Beispiel: in build-modal vor dem Bauen-Button:
 *   <WeatherActionHint lever="build" />
 */

import { useEffect, useState } from "react";
import { TIME_META, WEATHER_META, type TimeOfDay } from "@/components/time-weather-banner";
import type { WeatherCondition } from "@/components/weather-badge";

export type Lever = "build" | "research" | "heal" | "gather" | "movement";

const LEVER_META: Record<Lever, { label: string; goodIsLow: boolean; emoji: string }> = {
  build:    { label: "Bauzeit",       goodIsLow: true,  emoji: "🔨" },
  research: { label: "Forschung",     goodIsLow: true,  emoji: "🔬" },
  heal:     { label: "Heilzeit",      goodIsLow: true,  emoji: "🏥" },
  gather:   { label: "Sammel-Yield",  goodIsLow: false, emoji: "🌾" },
  movement: { label: "Marsch-Tempo",  goodIsLow: false, emoji: "🚶" },
};

// Synchron zu WEATHER_ECON in weather-info-modal.tsx, gespiegelt zu Mig 00367
const WEATHER_ECON: Record<WeatherCondition, Partial<Record<Lever, number>>> = {
  clear:  { gather: 1.05, build: 0.95, research: 1.02, heal: 0.93 },
  cloud:  {},
  rain:   { gather: 0.90, build: 1.10, research: 0.93, heal: 1.08, movement: 0.92 },
  snow:   { gather: 0.85, build: 1.20, research: 0.95, heal: 1.10, movement: 0.80 },
  storm:  { gather: 0.75, build: 1.30, research: 0.85, heal: 1.20, movement: 0.70 },
  heat:   { gather: 1.10, build: 1.08, heal: 1.05, movement: 0.90 },
  fog:    { gather: 0.95, build: 1.05, research: 0.92, movement: 0.88 },
  night:  { movement: 1.05 },
};

const TOD_ECON: Record<TimeOfDay, Partial<Record<Lever, number>>> = {
  morning: { build: 0.97, research: 0.98, heal: 0.97, gather: 1.05 },
  day:     { build: 0.95, research: 0.95, heal: 0.95 },
  evening: {},
  night:   { build: 1.05, research: 1.03, heal: 1.05, gather: 0.95 },
};

type Bundle = {
  bundle: {
    tod: TimeOfDay;
    weather: { condition: WeatherCondition } | null;
    mults: Record<string, number>;
  } | null;
};

export function WeatherActionHint({ lever, compact = false }: { lever: Lever; compact?: boolean }) {
  const [data, setData] = useState<Bundle | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/me/weather-effects", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (!cancelled) setData(j);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!data?.bundle) return null;
  const meta = LEVER_META[lever];

  // Quellen: was wirkt aktuell?
  const sources: Array<{ emoji: string; label: string; pct: number; color: string }> = [];
  const w = data.bundle.weather?.condition;
  const weatherMult = w ? WEATHER_ECON[w]?.[lever] : undefined;
  if (w && weatherMult && weatherMult !== 1) {
    const raw = Math.round((weatherMult - 1) * 100);
    const playerPct = meta.goodIsLow ? -raw : raw;
    sources.push({
      emoji: WEATHER_META[w].emoji,
      label: WEATHER_META[w].label,
      pct: playerPct,
      color: WEATHER_META[w].color,
    });
  }
  const todMult = TOD_ECON[data.bundle.tod]?.[lever];
  if (todMult && todMult !== 1) {
    const raw = Math.round((todMult - 1) * 100);
    const playerPct = meta.goodIsLow ? -raw : raw;
    sources.push({
      emoji: TIME_META[data.bundle.tod].emoji,
      label: TIME_META[data.bundle.tod].label,
      pct: playerPct,
      color: TIME_META[data.bundle.tod].color,
    });
  }

  if (sources.length === 0) return null;

  // Effektive Veränderung gesamt (multiplikativ)
  const combined =
    (weatherMult ?? 1) * (todMult ?? 1);
  const combinedRaw = Math.round((combined - 1) * 100);
  const combinedPlayer = meta.goodIsLow ? -combinedRaw : combinedRaw;
  const overallColor = combinedPlayer >= 0 ? "#22D1C3" : "#FF6B4A";
  const overallSign = combinedPlayer > 0 ? "+" : combinedPlayer < 0 ? "−" : "";

  if (compact) {
    return (
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontSize: 9, fontWeight: 800,
        padding: "2px 6px", borderRadius: 999,
        background: `${overallColor}1a`,
        border: `1px solid ${overallColor}55`,
        color: overallColor,
        fontFamily: "Inter,-apple-system,sans-serif",
        fontVariantNumeric: "tabular-nums",
      }}>
        <span>{meta.emoji}</span>
        <span>{overallSign}{Math.abs(combinedPlayer)} %</span>
        {sources.map((s) => (
          <span key={s.label} style={{ fontSize: 10 }}>{s.emoji}</span>
        ))}
      </div>
    );
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 4,
      padding: "6px 8px", borderRadius: 7,
      background: `${overallColor}14`,
      border: `1px solid ${overallColor}44`,
      fontFamily: "Inter,-apple-system,sans-serif",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13 }}>{meta.emoji}</span>
        <span style={{ fontSize: 10, fontWeight: 800, color: "#FFF", letterSpacing: 0.3 }}>
          Wetter+Tageszeit auf {meta.label}:
        </span>
        <span style={{ fontSize: 11, fontWeight: 900, color: overallColor, fontVariantNumeric: "tabular-nums" }}>
          {overallSign}{Math.abs(combinedPlayer)} %
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {sources.map((s) => {
          const c = s.pct >= 0 ? "#9ee5dd" : "#FFB39A";
          return (
            <span key={s.label} style={{
              display: "inline-flex", alignItems: "center", gap: 3,
              padding: "1px 5px", borderRadius: 999,
              background: `${s.color}22`,
              border: `1px solid ${s.color}55`,
              fontSize: 9, fontWeight: 800,
              color: c, whiteSpace: "nowrap",
              fontVariantNumeric: "tabular-nums",
            }}>
              <span style={{ fontSize: 10 }}>{s.emoji}</span>
              <span style={{ color: "#FFF" }}>{s.label}</span>
              <span>{s.pct > 0 ? "+" : "−"}{Math.abs(s.pct)} %</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
