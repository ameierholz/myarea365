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

      {/* Wetter-Partikel-Layer — Regen/Sturm-Streaks deaktiviert (sahen komisch aus).
          Schnee+Nebel bleiben aktiv, weil unauffälliger. */}
      {cond === "snow"  && <SnowOverlay />}
      {cond === "fog"   && <FogOverlay />}

      <WeatherSoundHook condition={cond} />
    </>
  );
}

/* ─── Regen / Sturm — zwei Layer mit unterschiedlichem Speed für Tiefe ──── */
function RainOverlay({ intensity }: { intensity: 1 | 2 }) {
  const isStorm = intensity === 2;
  // Tilt simuliert Wind: Sturm = mehr Schräglage.
  const tiltFar = isStorm ? 14 : 8;   // hintere Schicht steiler
  const tiltNear = isStorm ? 22 : 14; // vordere Schicht stärker geneigt
  // Speeds: hintere Schicht langsamer (Parallax-Effekt = mehr Tiefe).
  const speedFar = isStorm ? 0.9 : 1.4;
  const speedNear = isStorm ? 0.5 : 0.8;
  // Streaks: kürzer, dünner, semi-transparent → echtes Regen-Feeling statt Jalousie.
  return (
    <>
      <style>{`
        @keyframes ma365-rain-fall-far {
          0%   { background-position: 0 -120vh; }
          100% { background-position: 0 120vh; }
        }
        @keyframes ma365-rain-fall-near {
          0%   { background-position: 0 -120vh; }
          100% { background-position: 0 120vh; }
        }
      `}</style>
      {/* hintere Schicht: feiner Sprühregen, schwach + langsamer */}
      <div
        aria-hidden
        style={{
          position: "fixed", inset: 0, pointerEvents: "none", zIndex: 11,
          backgroundImage: `linear-gradient(
            ${tiltFar}deg,
            transparent 0,
            transparent 40%,
            rgba(180, 210, 230, ${isStorm ? 0.10 : 0.06}) 45%,
            rgba(180, 210, 230, ${isStorm ? 0.14 : 0.09}) 50%,
            rgba(180, 210, 230, ${isStorm ? 0.10 : 0.06}) 55%,
            transparent 60%,
            transparent 100%
          )`,
          backgroundSize: `3px ${isStorm ? 28 : 36}px`,
          backgroundRepeat: "repeat",
          animation: `ma365-rain-fall-far ${speedFar}s linear infinite`,
          opacity: 0.9,
        }}
      />
      {/* vordere Schicht: schnellere, gröbere Tropfen */}
      <div
        aria-hidden
        style={{
          position: "fixed", inset: 0, pointerEvents: "none", zIndex: 12,
          backgroundImage: `linear-gradient(
            ${tiltNear}deg,
            transparent 0,
            transparent 35%,
            rgba(200, 220, 240, ${isStorm ? 0.18 : 0.13}) 42%,
            rgba(220, 235, 250, ${isStorm ? 0.28 : 0.20}) 50%,
            rgba(200, 220, 240, ${isStorm ? 0.18 : 0.13}) 58%,
            transparent 65%,
            transparent 100%
          )`,
          backgroundSize: `4px ${isStorm ? 22 : 32}px`,
          backgroundRepeat: "repeat",
          animation: `ma365-rain-fall-near ${speedNear}s linear infinite`,
          mixBlendMode: "screen",
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
