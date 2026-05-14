"use client";

/**
 * WeatherInfoModal — kompaktes Popup unter dem TimeWeatherBanner. Zeigt:
 *   • aktuelle Tageszeit + Wetter (Stadt + Temp + Wind)
 *   • Tageszeit-Sektion: alle 4 Zeiten mit Klassen-Effekt-Chips
 *   • Wetter-Sektion: alle 8 Bedingungen mit Klassen-Effekt-Chips
 *
 * Anchored unter dem Banner (top:48, zentriert), KEIN Vollbild-Backdrop
 * → Umgebung bleibt sichtbar. Click-außerhalb schließt.
 */

import { useEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import {
  TIME_META, WEATHER_META, CLASS_META,
  type TimeOfDay, type ClassEffect,
} from "@/components/time-weather-banner";
import type { WeatherCondition } from "@/components/weather-badge";

const TIME_ORDER: TimeOfDay[] = ["morning", "day", "evening", "night"];
const WEATHER_ORDER: WeatherCondition[] = ["clear", "cloud", "rain", "snow", "storm", "heat", "fog", "night"];

const MODAL_WIDTH = 640;

type WeatherMults = {
  movement: number;
  scout: number;
  visibility: number;
  gather: number;
  build: number;
  research: number;
  heal: number;
};

type EffectsBundle = {
  ok: boolean;
  bundle: {
    city_slug: string;
    tod: TimeOfDay;
    weather: {
      condition: WeatherCondition;
      temperature_c: number;
      wind_kmh: number;
      wind_dir_deg: number | null;
      precipitation_mm: number;
      is_night: boolean;
      provider: string;
    } | null;
    mults: WeatherMults;
  } | null;
  activeBoosts: Array<{ effect: string; expires_at: string; value_pct: number }>;
};

type ForecastDay = {
  city_slug: string;
  day_offset: number;
  forecast_date: string;
  condition: WeatherCondition;
  temp_high_c: number;
  temp_low_c: number;
  wind_kmh: number;
  precip_mm: number;
};

type ForecastResponse = {
  ok: boolean;
  days: ForecastDay[];
};

export function WeatherInfoModal({
  open, onClose, anchorRef, currentWeather, currentTod, currentTemp, currentWind, cityName,
}: {
  open: boolean;
  onClose: () => void;
  /** Banner-Button-Ref — Modal verankert sich exakt darunter, nicht am Viewport-Zentrum. */
  anchorRef?: RefObject<HTMLElement | null>;
  currentWeather: WeatherCondition | null;
  currentTod: TimeOfDay;
  currentTemp: number | null;
  currentWind: number | null;
  cityName: string | null;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [effects, setEffects] = useState<EffectsBundle | null>(null);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const [eRes, fRes] = await Promise.all([
          fetch("/api/me/weather-effects", { cache: "no-store" }),
          fetch("/api/me/weather-forecast", { cache: "no-store" }),
        ]);
        if (cancelled) return;
        if (eRes.ok) setEffects(await eRes.json());
        if (fRes.ok) setForecast(await fRes.json());
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const el = anchorRef?.current;
      if (!el || typeof window === "undefined") {
        setPos({ top: 48, left: window.innerWidth / 2 });
        return;
      }
      const r = el.getBoundingClientRect();
      const centerX = r.left + r.width / 2;
      const actualWidth = Math.min(MODAL_WIDTH, window.innerWidth - 16);
      // Clamp damit Modal nicht aus dem Viewport rutscht (Modal nutzt translateX(-50%))
      const minLeft = actualWidth / 2 + 8;
      const maxLeft = window.innerWidth - actualWidth / 2 - 8;
      const clampedLeft = Math.max(minLeft, Math.min(maxLeft, centerX));
      setPos({ top: r.bottom + 2, left: clampedLeft });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !pos) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      {/* Transparenter Click-Catcher — Umgebung bleibt sichtbar, Klick außerhalb schließt */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          zIndex: 9399,
          background: "transparent",
        }}
      />

      {/* Positioning-Wrapper — die Animation `ma365-modal-in` setzt transform
          (translateY+scale) auf dem inneren Div; deshalb hier KEIN transform.
          Stattdessen `left = pos.left - width/2` als feste Pixel-Position. */}
      <div
        role="dialog" aria-modal="true" aria-label="Tageszeit + Wetter-Effekte"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          top: pos.top,
          left: pos.left - Math.min(MODAL_WIDTH, typeof window !== "undefined" ? window.innerWidth - 16 : MODAL_WIDTH) / 2,
          zIndex: 9400,
          width: `min(${MODAL_WIDTH}px, calc(100vw - 16px))`,
          maxHeight: `calc(100dvh - ${pos.top + 12}px)`,
          display: "flex", flexDirection: "column",
          background: "linear-gradient(180deg, rgba(15,17,21,0.96), rgba(26,29,35,0.96))",
          border: "1px solid rgba(34,209,195,0.3)",
          borderRadius: 12,
          boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
          color: "#F0F0F0",
          overflow: "hidden",
          animation: "ma365-modal-in var(--motion-base) var(--ease-out) forwards",
          fontFamily: "Inter,-apple-system,sans-serif",
        }}
      >
        {/* Aktueller Status — mittig, kein separater Header mehr (Titel steht
            schon im Banner oben). Close-Button schwebt in der Ecke. */}
        <div style={{
          position: "relative",
          padding: "8px 36px 8px 12px",
          background: "rgba(34,209,195,0.06)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          textAlign: "center",
        }}>
          <button
            onClick={onClose}
            style={{
              position: "absolute", top: 6, right: 6,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#8B8FA3", fontSize: 15, cursor: "pointer",
              width: 22, height: 22, padding: 0, borderRadius: 5,
              display: "flex", alignItems: "center", justifyContent: "center",
              lineHeight: 1,
            }}
            aria-label="Schließen"
          >×</button>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.1, color: "#22D1C3", marginBottom: 2 }}>
            AKTUELL{cityName ? ` · ${cityName.toUpperCase()}` : ""}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 11, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14 }}>{TIME_META[currentTod].emoji}</span>
            <span style={{ color: TIME_META[currentTod].color, fontWeight: 800 }}>{TIME_META[currentTod].label}</span>
            {currentWeather && (
              <>
                <span style={{ color: "rgba(255,255,255,0.3)" }}>·</span>
                <span style={{ fontSize: 14 }}>{WEATHER_META[currentWeather].emoji}</span>
                <span style={{ color: WEATHER_META[currentWeather].color, fontWeight: 800 }}>
                  {WEATHER_META[currentWeather].label}
                </span>
                {currentTemp !== null && (
                  <span style={{ color: "rgba(255,255,255,0.7)", fontVariantNumeric: "tabular-nums" }}>
                    {currentTemp}°C
                  </span>
                )}
                {currentWind !== null && (
                  <span style={{ color: "rgba(255,255,255,0.55)", fontVariantNumeric: "tabular-nums" }}>
                    🌬️ Wind {currentWind} km/h
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px 12px 12px" }}>
          <SectionHeader label="TAGESZEITEN" color="#FFD700" />
          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
            {TIME_ORDER.map((k) => {
              const m = TIME_META[k];
              return <EffectRow key={k} emoji={m.emoji} label={m.label} sublabel={m.timeRange} effects={m.effects} color={m.color} isActive={k === currentTod} />;
            })}
          </div>

          <SectionHeader label="WETTER" color="#22D1C3" />
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {WEATHER_ORDER.map((k) => {
              const m = WEATHER_META[k];
              return <EffectRow key={k} emoji={m.emoji} label={m.label} effects={m.effects} color={m.color} isActive={k === currentWeather} />;
            })}
          </div>

          {effects?.bundle?.mults && (
            <>
              <div style={{ height: 8 }} />
              <SectionHeader label="WIRTSCHAFT &amp; BEWEGUNG (AKTIV)" color="#FFD700" />
              <MultGrid mults={effects.bundle.mults} windKmh={effects.bundle.weather?.wind_kmh ?? null} windDir={effects.bundle.weather?.wind_dir_deg ?? null} />
            </>
          )}

          {effects && effects.activeBoosts.length > 0 && (
            <>
              <div style={{ height: 8 }} />
              <SectionHeader label="DEINE AKTIVEN SCHUTZ-BUFFS" color="#FF2D78" />
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {effects.activeBoosts.map((b) => <BoostRow key={b.effect} boost={b} />)}
              </div>
            </>
          )}

          {forecast && forecast.days.length > 0 && (
            <>
              <div style={{ height: 8 }} />
              <SectionHeader label={`VORHERSAGE · ${forecast.days.length} TAGE`} color="#a855f7" />
              <div style={{ display: "flex", gap: 5, overflowX: "auto", paddingBottom: 4 }}>
                {forecast.days.map((d) => <ForecastCard key={d.day_offset} day={d} />)}
              </div>
            </>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}

function SectionHeader({ label, color }: { label: string; color: string }) {
  return (
    <div style={{
      textAlign: "center",
      fontSize: 10, fontWeight: 900, letterSpacing: 2,
      color, textShadow: `0 1px 4px ${color}55`,
      padding: "4px 0 5px 0",
      borderBottom: `1px solid ${color}33`,
      marginBottom: 5,
    }}>{label}</div>
  );
}

function EffectRow({
  emoji, label, sublabel, effects, color, isActive,
}: {
  emoji: string;
  label: string;
  sublabel?: string;
  effects: ClassEffect[];
  color: string;
  isActive: boolean;
}) {
  return (
    <div style={{ position: "relative" }}>
      {/* 'AKTUELL AKTIV' Label über aktiver Zeile */}
      {isActive && (
        <div style={{
          position: "absolute",
          top: -7, left: 12,
          fontSize: 7, fontWeight: 900, letterSpacing: 1.2,
          padding: "1px 6px", borderRadius: 3,
          background: color, color: "#0F1115",
          boxShadow: `0 0 6px ${color}aa`,
          fontFamily: "Inter,-apple-system,sans-serif",
          zIndex: 1,
        }}>AKTUELL AKTIV</div>
      )}
      <div style={{
        display: "grid", gridTemplateColumns: "24px 92px 1fr",
        gap: 6, alignItems: "center",
        padding: "5px 6px 5px 8px", borderRadius: 7,
        background: isActive ? `${color}1f` : "rgba(255,255,255,0.025)",
        border: `1px solid ${isActive ? color : "rgba(255,255,255,0.06)"}`,
      }}>
        <span style={{
          fontSize: 17, lineHeight: 1, textAlign: "center",
          filter: isActive ? `drop-shadow(0 0 5px ${color}88)` : "none",
        }}>{emoji}</span>

        {/* Label-Spalte: Name + optional Zeit-Bereich */}
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <span style={{
            fontSize: 11, fontWeight: 800,
            color: isActive ? color : "#FFF",
            whiteSpace: "nowrap",
            lineHeight: 1.2,
          }}>{label}</span>
          {sublabel && (
            <span style={{
              fontSize: 8, fontWeight: 700,
              color: "rgba(255,255,255,0.5)",
              whiteSpace: "nowrap",
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1.2,
            }}>{sublabel}</span>
          )}
        </div>

        {/* Chip-Reihe: eine Zeile, horizontal scrollbar wenn zu viele */}
        <div style={{
          display: "flex", alignItems: "center", gap: 4,
          flexWrap: "nowrap",
          overflowX: "auto",
          minWidth: 0,
          scrollbarWidth: "thin",
          paddingBottom: 1,
        }}>
          {effects.length === 0 ? (
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 700 }}>kein Effekt</span>
          ) : (
            effects.map((e, i) => <ClassChip key={i} effect={e} />)
          )}
        </div>
      </div>
    </div>
  );
}

function MultGrid({ mults, windKmh, windDir }: { mults: WeatherMults; windKmh: number | null; windDir: number | null }) {
  const rows: Array<{ key: keyof WeatherMults; label: string; emoji: string; goodIsLow: boolean }> = [
    { key: "movement",   label: "Marsch-Tempo",  emoji: "🚶", goodIsLow: false },
    { key: "scout",      label: "Spähreichweite", emoji: "🔭", goodIsLow: false },
    { key: "visibility", label: "Sicht",          emoji: "👁️", goodIsLow: false },
    { key: "gather",     label: "Sammel-Yield",   emoji: "🌾", goodIsLow: false },
    { key: "build",      label: "Bauzeit",        emoji: "🔨", goodIsLow: true  },
    { key: "research",   label: "Forschung",      emoji: "🔬", goodIsLow: true  },
    { key: "heal",       label: "Lazarett",       emoji: "🏥", goodIsLow: true  },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 5 }}>
      {rows.map((r) => <MultCard key={r.key} label={r.label} emoji={r.emoji} goodIsLow={r.goodIsLow} value={mults[r.key]} />)}
      {windKmh != null && windKmh >= 8 && (
        <div style={{
          display: "flex", flexDirection: "column", justifyContent: "center",
          padding: "5px 8px", borderRadius: 7,
          background: "rgba(168,85,247,0.12)",
          border: "1px solid rgba(168,85,247,0.35)",
        }}>
          <span style={{ fontSize: 9, fontWeight: 800, color: "#c084fc", letterSpacing: 0.6 }}>🌬️ WIND</span>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#FFF", fontVariantNumeric: "tabular-nums" }}>
            {windKmh} km/h{windDir != null ? ` · ${windDir}°` : ""}
          </span>
          <span style={{ fontSize: 8, color: "rgba(255,255,255,0.6)" }}>±8 % Marsch-Tempo je Richtung</span>
        </div>
      )}
    </div>
  );
}

function MultCard({ label, emoji, value, goodIsLow }: { label: string; emoji: string; value: number; goodIsLow: boolean }) {
  const pct = Math.round((value - 1) * 100);
  const isBuff = goodIsLow ? pct < 0 : pct > 0;
  const isNeutral = pct === 0;
  const color = isNeutral ? "#8B8FA3" : isBuff ? "#22D1C3" : "#FF6B4A";
  const sign = pct > 0 ? "+" : "";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "5px 8px", borderRadius: 7,
      background: `${color}1a`,
      border: `1px solid ${color}55`,
    }}>
      <span style={{ fontSize: 14, lineHeight: 1 }}>{emoji}</span>
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.7)", letterSpacing: 0.4 }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 900, color, fontVariantNumeric: "tabular-nums" }}>
          {isNeutral ? "neutral" : `${sign}${pct} %`}
        </span>
      </div>
    </div>
  );
}

function BoostRow({ boost }: { boost: { effect: string; expires_at: string; value_pct: number } }) {
  const label = BOOST_LABELS[boost.effect] ?? boost.effect;
  const exp = new Date(boost.expires_at);
  const mins = Math.max(0, Math.round((exp.getTime() - Date.now()) / 60000));
  const hours = Math.floor(mins / 60);
  const restMin = mins % 60;
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "5px 9px", borderRadius: 7,
      background: "rgba(255,45,120,0.12)",
      border: "1px solid rgba(255,45,120,0.35)",
    }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: "#FFF" }}>{label}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 700 }}>
        <span style={{ color: "#22D1C3" }}>−{boost.value_pct} %</span>
        <span style={{ color: "rgba(255,255,255,0.65)", fontVariantNumeric: "tabular-nums" }}>
          {hours > 0 ? `${hours}h ${restMin}m` : `${restMin}m`}
        </span>
      </span>
    </div>
  );
}

const BOOST_LABELS: Record<string, string> = {
  weather_rain:  "🌧️ Regenmantel — Regen-Malus reduziert",
  weather_snow:  "❄️ Schnee-Parka — Schnee-Malus reduziert",
  weather_storm: "⛈️ Sturmtrotzer — Sturm-Malus reduziert",
  weather_heat:  "🔥 Sonnenhut — Hitze-Malus reduziert",
  weather_fog:   "🌫️ Nebel-Lampe — Sicht wiederhergestellt",
  weather_night: "🌙 Nachtsichtbrille — Nacht-Malus reduziert",
  weather_any:   "💖 Wetter-Herz — Immunität gegen alle Mali",
};

function ForecastCard({ day }: { day: ForecastDay }) {
  const m = WEATHER_META[day.condition];
  const date = new Date(day.forecast_date);
  const dayLabel = day.day_offset === 0
    ? "Heute"
    : day.day_offset === 1
      ? "Morgen"
      : date.toLocaleDateString("de-DE", { weekday: "short" });
  return (
    <div style={{
      flex: "0 0 auto",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
      padding: "6px 8px", borderRadius: 8,
      background: `${m.color}14`,
      border: `1px solid ${m.color}44`,
      minWidth: 78,
    }}>
      <span style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.7)", letterSpacing: 0.4 }}>
        {dayLabel.toUpperCase()}
      </span>
      <span style={{ fontSize: 22, lineHeight: 1 }}>{m.emoji}</span>
      <span style={{ fontSize: 9, fontWeight: 800, color: m.color }}>{m.label}</span>
      <span style={{ fontSize: 10, fontWeight: 700, color: "#FFF", fontVariantNumeric: "tabular-nums" }}>
        {day.temp_high_c}° / {day.temp_low_c}°
      </span>
    </div>
  );
}

function ClassChip({ effect }: { effect: ClassEffect }) {
  const isBuff = effect.pct > 0;
  const cm = CLASS_META[effect.class];
  const kindLabel = effect.kind === "atk" ? "Angriff" : "Verteidigung";
  return (
    <span
      title={`${cm.label}: ${isBuff ? "+" : ""}${effect.pct} % ${kindLabel}`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 3,
        fontSize: 9, fontWeight: 900, letterSpacing: 0.2,
        padding: "2px 6px", borderRadius: 999,
        background: isBuff ? "rgba(34,209,195,0.18)" : "rgba(255,107,74,0.18)",
        border: `1px solid ${isBuff ? "rgba(34,209,195,0.4)" : "rgba(255,107,74,0.4)"}`,
        color: isBuff ? "#9ee5dd" : "#FFB39A",
        whiteSpace: "nowrap",
        flexShrink: 0,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <span style={{ fontSize: 11, lineHeight: 1 }}>{cm.emoji}</span>
      <span style={{ color: "#FFF", fontWeight: 800 }}>{cm.label}</span>
      <span>{isBuff ? "+" : ""}{effect.pct}%</span>
      <span style={{
        fontSize: 8, fontWeight: 800, letterSpacing: 0.2,
        padding: "0 4px", borderRadius: 3,
        background: effect.kind === "atk" ? "rgba(255,107,74,0.3)" : "rgba(255,215,0,0.3)",
        border: `1px solid ${effect.kind === "atk" ? "rgba(255,107,74,0.5)" : "rgba(255,215,0,0.5)"}`,
        color: effect.kind === "atk" ? "#FFB39A" : "#FFE07A",
      }}>{kindLabel}</span>
    </span>
  );
}
