"use client";

/**
 * TimeWeatherBanner — kompakte Pille oben in der HUD-Mitte mit
 * Tageszeit-Icon + Wetter-Icon + Temperatur. Klick öffnet das Info-Modal
 * mit allen möglichen Effekten (Reference).
 */

import { useEffect, useRef, useState } from "react";
import { useCityWeather, type WeatherCondition } from "@/components/weather-badge";
import { WeatherInfoModal } from "@/components/weather-info-modal";

export type TimeOfDay = "morning" | "day" | "evening" | "night";

export type ClassKey = "infantry" | "cavalry" | "marksman" | "siege" | "gatherer" | "architect";
export type EffectKind = "atk" | "def";
export type ClassEffect = { class: ClassKey; pct: number; kind: EffectKind };

/**
 * Wächter-Klassen — match Migration 00320 troop_class names (siehe
 * project_urban_combat_classes). Emoji + Farbe sind cosmetic; die troop_class
 * IDs (infantry/cavalry/marksman/siege/gatherer/architect) sind die DB-Keys.
 */
export const CLASS_META: Record<ClassKey, { emoji: string; label: string; color: string }> = {
  infantry:  { emoji: "🛡️", label: "Türsteher",    color: "#FFD700" },
  cavalry:   { emoji: "🏇", label: "Kurier",       color: "#22D1C3" },
  marksman:  { emoji: "🎯", label: "Schütze",      color: "#FF6B4A" },
  siege:     { emoji: "🔨", label: "Brecher",      color: "#a855f7" },
  gatherer:  { emoji: "🌾", label: "Sammler",      color: "#5ddaf0" },
  architect: { emoji: "📐", label: "Konstrukteur", color: "#FFB347" },
};

/**
 * Tageszeit-Effekte — jede Klasse bekommt logisch eine Stellschraube je
 * Tageszeit. Werte sind Prozent-Modifier (positiv=Buff, negativ=Debuff).
 * Synchron mit DB-Funktion `_tod_combat_mult` (Mig 00366).
 */
export const TIME_META: Record<TimeOfDay, { emoji: string; label: string; color: string; timeRange: string; effects: ClassEffect[] }> = {
  morning: {
    emoji: "🌅", label: "Morgen", color: "#FFB347", timeRange: "6–10 Uhr",
    effects: [
      { class: "cavalry",  pct: 10, kind: "atk" },  // Frische
      { class: "gatherer", pct: 10, kind: "atk" },  // Frühaufsteher
      { class: "siege",    pct: -5, kind: "atk" },  // Geräte kalt
    ],
  },
  day: {
    emoji: "☀️", label: "Tag", color: "#FFD700", timeRange: "10–17 Uhr",
    effects: [
      { class: "marksman",  pct: 10, kind: "atk" },  // beste Sicht
      { class: "architect", pct: 10, kind: "atk" },  // präzises Bauen
      { class: "infantry",  pct: 5,  kind: "atk" },
    ],
  },
  evening: {
    emoji: "🌇", label: "Abend", color: "#FF6B4A", timeRange: "17–21 Uhr",
    effects: [
      { class: "infantry", pct: 5,  kind: "atk" },
      { class: "gatherer", pct: 5,  kind: "atk" },
      { class: "marksman", pct: -5, kind: "atk" },
      { class: "infantry", pct: 5,  kind: "def" },
    ],
  },
  night: {
    emoji: "🌙", label: "Nacht", color: "#818cf8", timeRange: "21–6 Uhr",
    effects: [
      { class: "cavalry",  pct: 15,  kind: "atk" },
      { class: "infantry", pct: 5,   kind: "atk" },
      { class: "marksman", pct: -15, kind: "atk" },
      { class: "architect", pct: -5, kind: "atk" },
      { class: "infantry", pct: 5,   kind: "def" },
    ],
  },
};

/**
 * Wetter-Effekte — jede Bedingung berührt 2-4 Klassen logisch.
 * Synchron mit DB-Funktion `_weather_combat_mult` (Mig 00366).
 */
export const WEATHER_META: Record<WeatherCondition, { emoji: string; label: string; color: string; effects: ClassEffect[] }> = {
  clear: {
    emoji: "☀️", label: "Klar", color: "#FFD700",
    effects: [
      { class: "marksman", pct: 5, kind: "atk" },   // Sicht
    ],
  },
  cloud: {
    emoji: "☁️", label: "Bewölkt", color: "#a8b4cf",
    effects: [],
  },
  rain: {
    emoji: "🌧️", label: "Regen", color: "#22D1C3",
    effects: [
      { class: "marksman", pct: -20, kind: "atk" }, // Bogensehne nass
      { class: "gatherer", pct: -5,  kind: "atk" }, // matschig
      { class: "infantry", pct: 10,  kind: "def" }, // rutschfeste Position
    ],
  },
  snow: {
    emoji: "❄️", label: "Schnee", color: "#e0f2fe",
    effects: [
      { class: "architect", pct: 10,  kind: "atk" }, // Eis verstärkt Bauten
      { class: "cavalry",   pct: -15, kind: "atk" }, // Schneematsch
      { class: "infantry",  pct: 5,   kind: "def" }, // Defensiver Vorteil
    ],
  },
  storm: {
    emoji: "⛈️", label: "Sturm", color: "#a855f7",
    effects: [
      { class: "marksman",  pct: -30, kind: "atk" }, // Sturmböen
      { class: "siege",     pct: 15,  kind: "atk" }, // Kraftvolle Belagerung
      { class: "architect", pct: -10, kind: "atk" }, // Bauschäden
      { class: "cavalry",   pct: -10, kind: "atk" },
    ],
  },
  heat: {
    emoji: "🔥", label: "Hitze", color: "#FF6B4A",
    effects: [
      { class: "gatherer", pct: 10,  kind: "atk" }, // Sommerernte
      { class: "siege",    pct: -10, kind: "atk" }, // Geräte überhitzen
      { class: "infantry", pct: -10, kind: "def" }, // Rüstung erhitzt
    ],
  },
  fog: {
    emoji: "🌫️", label: "Nebel", color: "#94a3b8",
    effects: [
      { class: "marksman", pct: -15, kind: "atk" }, // keine Sicht
      { class: "cavalry",  pct: -10, kind: "atk" }, // Orientierung
      { class: "infantry", pct: 10,  kind: "def" }, // Hinterhalt-Vorteil
    ],
  },
  night: {
    emoji: "🌙", label: "Nacht", color: "#818cf8",
    effects: [
      { class: "cavalry",  pct: 15,  kind: "atk" },
      { class: "marksman", pct: -15, kind: "atk" },
      { class: "infantry", pct: 5,   kind: "def" },
    ],
  },
};

export function getTimeOfDay(): TimeOfDay {
  const h = new Date().getHours();
  if (h >= 6 && h < 10) return "morning";
  if (h >= 10 && h < 17) return "day";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

export function TimeWeatherBanner() {
  const weather = useCityWeather();
  const [tod, setTod] = useState<TimeOfDay>(getTimeOfDay);
  const [modalOpen, setModalOpen] = useState(false);
  const bannerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const tick = () => setTod(getTimeOfDay());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  // Globaler Open-Hook: WeatherActionHint in beliebigen Action-Modals kann
  // den Effekt-Modal öffnen ohne den Banner-Ref durchzureichen.
  useEffect(() => {
    const handler = () => setModalOpen(true);
    window.addEventListener("ma365:open-weather-info", handler);
    return () => window.removeEventListener("ma365:open-weather-info", handler);
  }, []);

  const t = TIME_META[tod];
  const w = weather ? WEATHER_META[weather.condition] : null;

  return (
    <>
      <button
        ref={bannerRef}
        onClick={() => setModalOpen(true)}
        title="Tageszeit + Wetter — alle Klassen-Effekte anzeigen"
        aria-label="Tageszeiten- & Wetterbuffs öffnen"
        aria-expanded={modalOpen}
        style={{
          position: "fixed",
          top: 6,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 9050,
          pointerEvents: "auto",
          fontFamily: "Inter,-apple-system,sans-serif",
          // KEIN maxWidth — sonst staucht der Constraint die Badge auf engen
          // Viewports und das Zentrieren wird visuell verzerrt.
          display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
          padding: "3px 6px 4px 6px", borderRadius: 10,
          background: "rgba(15,17,21,0.55)",
          border: "1px solid rgba(255,255,255,0.1)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
          cursor: "pointer",
          color: "inherit",
          whiteSpace: "nowrap",
        }}
      >
        {/* Titel-Label oben */}
        <span style={{
          fontSize: 7, fontWeight: 900, letterSpacing: 1.2,
          color: "#22D1C3",
          textShadow: "0 1px 2px rgba(0,0,0,0.6)",
          whiteSpace: "nowrap",
        }}>
          TAGESZEITEN- &amp; WETTERBUFFS
        </span>

        {/* Untere Zeile: Tageszeit + Wetter + Aufklapp-Indikator */}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
          {/* Tageszeit-Badge */}
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 2,
            padding: "1px 7px 1px 5px", borderRadius: 999,
            background: `${t.color}22`,
            color: t.color,
            fontSize: 9, fontWeight: 900, letterSpacing: 0.3,
          }}>
            <span style={{ fontSize: 11, lineHeight: 1 }}>{t.emoji}</span>
            {t.label}
          </span>

          {/* Wetter-Badge */}
          {w && weather && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 2,
              padding: "1px 7px 1px 5px", borderRadius: 999,
              background: `${w.color}22`,
              color: w.color,
              fontSize: 9, fontWeight: 900, letterSpacing: 0.3,
            }}>
              <span style={{ fontSize: 11, lineHeight: 1 }}>{w.emoji}</span>
              {w.label}
              <span style={{ color: w.color, opacity: 0.85, marginLeft: 2 }}>
                {weather.temperature_c}°
              </span>
            </span>
          )}

          {/* Aufklapp-Indikator — klares Chevron-Pill */}
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            gap: 2,
            padding: "1px 4px 1px 4px", borderRadius: 999,
            background: "rgba(34,209,195,0.18)",
            border: "1px solid rgba(34,209,195,0.4)",
            color: "#22D1C3",
            fontSize: 7, fontWeight: 900, letterSpacing: 0.4,
          }}>
            MEHR
            <span style={{
              fontSize: 9, lineHeight: 1,
              transition: "transform 0.15s ease",
              transform: modalOpen ? "rotate(180deg)" : "rotate(0deg)",
            }}>▾</span>
          </span>
        </span>
      </button>

      <WeatherInfoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        anchorRef={bannerRef}
        currentWeather={weather?.condition ?? null}
        currentTod={tod}
        currentTemp={weather?.temperature_c ?? null}
        currentWind={weather?.wind_kmh ?? null}
        cityName={weather?.city_slug ?? null}
      />
    </>
  );
}
