"use client";

import { useEffect, useState } from "react";

export type WeatherCondition = "clear" | "cloud" | "rain" | "snow" | "storm" | "heat" | "fog" | "night";

export type CityWeather = {
  city_slug: string;
  condition: WeatherCondition;
  temperature_c: number;
  wind_kmh: number;
  precipitation_mm: number;
  is_night: boolean;
  provider: "mock" | "openweathermap";
  updated_at: string;
};

const WEATHER_META: Record<WeatherCondition, { emoji: string; label: string; color: string; gradient: string }> = {
  clear:  { emoji: "☀️", label: "Klar",      color: "#FFD700", gradient: "linear-gradient(135deg, rgba(255,215,0,0.25), rgba(255,107,74,0.15))" },
  cloud:  { emoji: "☁️", label: "Bewölkt",   color: "#a8b4cf", gradient: "linear-gradient(135deg, rgba(168,180,207,0.22), rgba(70,82,122,0.18))" },
  rain:   { emoji: "🌧️", label: "Regen",     color: "#22D1C3", gradient: "linear-gradient(135deg, rgba(34,209,195,0.25), rgba(96,165,250,0.18))" },
  snow:   { emoji: "❄️", label: "Schnee",    color: "#e0f2fe", gradient: "linear-gradient(135deg, rgba(224,242,254,0.30), rgba(168,180,207,0.18))" },
  storm:  { emoji: "⛈️", label: "Sturm",     color: "#a855f7", gradient: "linear-gradient(135deg, rgba(168,85,247,0.30), rgba(255,45,120,0.20))" },
  heat:   { emoji: "🔥", label: "Hitze",     color: "#FF6B4A", gradient: "linear-gradient(135deg, rgba(255,107,74,0.30), rgba(255,215,0,0.20))" },
  fog:    { emoji: "🌫️", label: "Nebel",     color: "#94a3b8", gradient: "linear-gradient(135deg, rgba(148,163,184,0.25), rgba(70,82,122,0.18))" },
  night:  { emoji: "🌙", label: "Nacht",     color: "#818cf8", gradient: "linear-gradient(135deg, rgba(129,140,248,0.28), rgba(168,85,247,0.18))" },
};

const COMBAT_EFFECT: Record<WeatherCondition, string> = {
  clear:  "Keine Wetter-Modifier aktiv.",
  cloud:  "Keine Wetter-Modifier aktiv.",
  rain:   "🌧️ Schützen −20 % Schaden · Türsteher +10 % Verteidigung",
  snow:   "❄️ Marsch −25 % · Konstrukteur +10 % Schaden",
  storm:  "⛈️ Schützen −30 % · Brecher +10 % · Marsch −10 %",
  heat:   "🔥 Verteidigung −10 % · Sammler +10 % Tempo",
  fog:    "🌫️ Schützen −15 % · Kurier −15 % Tempo",
  night:  "🌙 Kurier +15 % Schaden · Schützen −15 %",
};

export function useCityWeather(pollMs = 5 * 60_000): CityWeather | null {
  const [weather, setWeather] = useState<CityWeather | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;
    async function poll() {
      try {
        const r = await fetch("/api/city-weather", { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          if (!cancelled) setWeather(j.weather ?? null);
        }
      } catch { /* ignore */ }
      if (!cancelled) timer = window.setTimeout(poll, pollMs);
    }
    void poll();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [pollMs]);

  return weather;
}

export function WeatherBadge({ weather, variant = "compact", showEffect = false }: {
  weather: CityWeather | null;
  variant?: "compact" | "expanded";
  showEffect?: boolean;
}) {
  if (!weather) return null;
  const m = WEATHER_META[weather.condition] ?? WEATHER_META.clear;
  if (variant === "compact") {
    return (
      <div title={`${m.label} · ${weather.temperature_c}°C · ${COMBAT_EFFECT[weather.condition]}`}
           style={{
             display: "inline-flex", alignItems: "center", gap: 6,
             padding: "4px 10px", borderRadius: 999,
             background: m.gradient,
             border: `1px solid ${m.color}55`,
             fontSize: 11, fontWeight: 900, color: "#FFF",
             textShadow: "0 1px 2px rgba(0,0,0,0.7)",
           }}>
        <span style={{ fontSize: 14 }}>{m.emoji}</span>
        <span>{m.label}</span>
        <span style={{ color: m.color }}>{weather.temperature_c}°</span>
      </div>
    );
  }
  return (
    <div style={{
      padding: "10px 14px", borderRadius: 12,
      background: m.gradient,
      border: `1px solid ${m.color}55`,
      color: "#FFF",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 28 }}>{m.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 900 }}>{m.label} · {weather.temperature_c}°C</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>
            💨 {weather.wind_kmh} km/h
            {weather.precipitation_mm > 0 && <> · 💧 {weather.precipitation_mm.toFixed(1)} mm</>}
          </div>
        </div>
      </div>
      {showEffect && weather.condition !== "clear" && weather.condition !== "cloud" && (
        <div style={{
          marginTop: 8, padding: "6px 8px", borderRadius: 8,
          background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.08)",
          fontSize: 10, fontWeight: 700, color: m.color,
        }}>
          {COMBAT_EFFECT[weather.condition]}
        </div>
      )}
    </div>
  );
}
