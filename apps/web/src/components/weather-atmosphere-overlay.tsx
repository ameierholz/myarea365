"use client";

/**
 * WeatherAtmosphereOverlay — kombiniert drei dezente Atmosphäre-Layer
 * über der Karte:
 *   1) Tageszeit-Tönung (radialer Gradient, je nach Tageszeit)
 *   2) Wetter-Partikel (CSS-only: Regen-Streifen, Schnee-Punkte, Sturm-Linien)
 *   3) Wetter-Sound (Web-Audio, sehr leise, optional togglebar via localStorage)
 *
 * Alle Layer sind pointer-events: none, blockieren also keine Map-Interaktion.
 * Spielt sich um die karten-hud + map-quick-access herum an.
 *
 * Mount-Punkt: nahe der MapLibre-Map (siehe map-dashboard.tsx oder app-map.tsx).
 */

import { useEffect, useRef, useState } from "react";
import { useCityWeather, type WeatherCondition } from "@/components/weather-badge";
import { getTimeOfDay, type TimeOfDay } from "@/components/time-weather-banner";

const TOD_TINT: Record<TimeOfDay, { color: string; opacity: number }> = {
  morning: { color: "rgba(255, 179, 71, 0.10)", opacity: 1 },   // Sonnenaufgang warm
  day:     { color: "rgba(255, 215, 0, 0.0)",    opacity: 0 },   // tagsüber neutral
  evening: { color: "rgba(255, 107, 74, 0.12)", opacity: 1 },   // Sonnenuntergang orange
  night:   { color: "rgba(70, 82, 138, 0.22)",  opacity: 1 },   // Nachtblau-Veil
};

const SOUND_PREF_KEY = "ma365_weather_sound";

export function WeatherAtmosphereOverlay() {
  const weather = useCityWeather();
  const [tod, setTod] = useState<TimeOfDay>(getTimeOfDay);

  useEffect(() => {
    const tick = () => setTod(getTimeOfDay());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const tint = TOD_TINT[tod];
  const cond: WeatherCondition | null = weather?.condition ?? null;

  return (
    <>
      {/* Tageszeit-Tönung (radial, mittig heller, an Rändern dunkler/wärmer) */}
      {tint.opacity > 0 && (
        <div
          aria-hidden
          style={{
            position: "fixed", inset: 0, pointerEvents: "none", zIndex: 11,
            background: `radial-gradient(120% 100% at 50% 0%, transparent 30%, ${tint.color} 100%)`,
            mixBlendMode: "multiply",
          }}
        />
      )}

      {/* Wetter-Partikel-Layer (CSS-only) */}
      {cond === "rain"  && <RainOverlay intensity={1} />}
      {cond === "storm" && <RainOverlay intensity={2} />}
      {cond === "snow"  && <SnowOverlay />}
      {cond === "fog"   && <FogOverlay />}

      <WeatherSoundHook condition={cond} />
    </>
  );
}

/* ─── Regen / Sturm — vertikale Streifen mit CSS-Animation ──────────────── */
function RainOverlay({ intensity }: { intensity: 1 | 2 }) {
  return (
    <>
      <style>{`
        @keyframes ma365-rain-fall {
          0%   { transform: translateY(-12vh); }
          100% { transform: translateY(112vh); }
        }
      `}</style>
      <div
        aria-hidden
        style={{
          position: "fixed", inset: 0, pointerEvents: "none", zIndex: 12,
          backgroundImage: `repeating-linear-gradient(
            ${intensity === 2 ? "115deg" : "100deg"},
            transparent 0,
            transparent ${intensity === 2 ? 8 : 14}px,
            rgba(120, 200, 240, ${intensity === 2 ? 0.32 : 0.22}) ${intensity === 2 ? 9 : 15}px,
            transparent ${intensity === 2 ? 10 : 16}px
          )`,
          animation: `ma365-rain-fall ${intensity === 2 ? 0.45 : 0.7}s linear infinite`,
        }}
      />
    </>
  );
}

/* ─── Schnee — gepunktete Wolke mit langsamer Drift ─────────────────────── */
function SnowOverlay() {
  return (
    <>
      <style>{`
        @keyframes ma365-snow-drift {
          0%   { transform: translate(0, -8vh); }
          100% { transform: translate(2vw, 108vh); }
        }
      `}</style>
      <div
        aria-hidden
        style={{
          position: "fixed", inset: 0, pointerEvents: "none", zIndex: 12,
          backgroundImage: `radial-gradient(circle 1.5px at 20% 30%, rgba(255,255,255,0.9), transparent),
                            radial-gradient(circle 2px   at 60% 70%, rgba(255,255,255,0.7), transparent),
                            radial-gradient(circle 1px   at 80% 20%, rgba(255,255,255,0.8), transparent),
                            radial-gradient(circle 1.5px at 40% 90%, rgba(255,255,255,0.6), transparent),
                            radial-gradient(circle 1px   at 10% 80%, rgba(255,255,255,0.9), transparent)`,
          backgroundSize: "200px 200px",
          animation: "ma365-snow-drift 8s linear infinite",
        }}
      />
    </>
  );
}

/* ─── Nebel — sanfter weißer Gauze ──────────────────────────────────────── */
function FogOverlay() {
  return (
    <>
      <style>{`
        @keyframes ma365-fog-drift {
          0%, 100% { opacity: 0.35; }
          50%      { opacity: 0.55; }
        }
      `}</style>
      <div
        aria-hidden
        style={{
          position: "fixed", inset: 0, pointerEvents: "none", zIndex: 12,
          background: "linear-gradient(180deg, rgba(220,228,240,0.45) 0%, rgba(220,228,240,0.15) 60%, transparent 100%)",
          animation: "ma365-fog-drift 6s ease-in-out infinite",
        }}
      />
    </>
  );
}

/* ─── Sound — Web-Audio mit Procedural-Noise (kein externes Asset) ─────── */
function WeatherSoundHook({ condition }: { condition: WeatherCondition | null }) {
  const ctxRef = useRef<AudioContext | null>(null);
  const nodeRef = useRef<{ src: AudioBufferSourceNode; gain: GainNode } | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const pref = localStorage.getItem(SOUND_PREF_KEY);
      setEnabled(pref === "on");
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!enabled || !condition) return;
    if (typeof window === "undefined") return;

    // Nur audible Conditions
    if (!["rain", "storm", "snow", "fog"].includes(condition)) return;

    let cancelled = false;
    (async () => {
      try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AC();
        if (ctx.state === "suspended") await ctx.resume();
        if (cancelled) { void ctx.close(); return; }

        // 2 Sekunden Brown-Noise als Buffer, loopt
        const bufferSize = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let last = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          last = (last + 0.02 * white) / 1.02;
          data[i] = last * 3.5;
        }
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.loop = true;

        const gain = ctx.createGain();
        gain.gain.value = condition === "storm" ? 0.05 : condition === "rain" ? 0.035 : 0.018;

        // Optional: Tiefpass je nach Condition
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = condition === "storm" ? 1400 : condition === "rain" ? 2200 : condition === "fog" ? 600 : 800;

        src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
        src.start();

        ctxRef.current = ctx;
        nodeRef.current = { src, gain };
      } catch { /* ignore audio failures */ }
    })();

    return () => {
      cancelled = true;
      try {
        nodeRef.current?.src.stop();
        void ctxRef.current?.close();
      } catch { /* ignore */ }
      nodeRef.current = null;
      ctxRef.current = null;
    };
  }, [enabled, condition]);

  // Toggle-Button — fixed unten links, sehr klein
  if (!condition || !["rain", "storm", "snow", "fog"].includes(condition)) return null;
  return (
    <button
      onClick={() => {
        const next = !enabled;
        setEnabled(next);
        try { localStorage.setItem(SOUND_PREF_KEY, next ? "on" : "off"); } catch { /* ignore */ }
      }}
      aria-label={enabled ? "Wetter-Sound ausschalten" : "Wetter-Sound einschalten"}
      title={enabled ? "Wetter-Sound aktiv (Klick zum Ausschalten)" : "Wetter-Sound (Klick zum Aktivieren)"}
      style={{
        position: "fixed", bottom: 88, right: 8,
        zIndex: 12,
        background: enabled ? "rgba(34,209,195,0.25)" : "rgba(15,17,21,0.55)",
        border: `1px solid ${enabled ? "rgba(34,209,195,0.55)" : "rgba(255,255,255,0.1)"}`,
        borderRadius: 999, width: 28, height: 28,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", fontSize: 13, color: "#FFF",
        boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >{enabled ? "🔊" : "🔇"}</button>
  );
}
