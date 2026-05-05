"use client";

import React, { useState, useEffect } from "react";
import { isoForCountry, leagueTierFor, LEAGUE_TIERS, previousSeasonLabel, type NearbyCrew } from "@/lib/game-config";

/* ═══════════════════════════════════════════════════════
 * Shared Types
 * ═══════════════════════════════════════════════════════ */
export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  xp: number;
  wegemuenzen?: number;
  gebietsruf?: number;
  sessionehre?: number;
  level: number;
  total_distance_m: number;
  total_walks: number;
  total_calories: number;
  streak_days: number;
  streak_best: number;
  team_color: string;
  faction: string;
  current_crew_id: string | null;
  equipped_marker_id: string;
  equipped_light_id: string;
  longest_run_m: number;
  longest_run_s: number;
  setting_units: string;
  setting_language: string;
  setting_notifications: boolean;
  setting_sound: boolean;
  setting_auto_pause: boolean;
  setting_privacy_public: boolean;
}

export interface Territory {
  id: string;
  street_name: string | null;
  distance_m: number;
  duration_s: number;
  xp_earned: number;
  created_at: string;
  segments_claimed?: number;
  streets_claimed?: number;
  polygons_claimed?: number;
  start_address?: string | null;
  end_address?: string | null;
  wood_dropped?: number;
  stone_dropped?: number;
  gold_dropped?: number;
  mana_dropped?: number;
  tokens_dropped?: number;
  xp_bonuses?: Array<{ kind: string; label: string; pct?: number; extra_amount?: number; unit?: string; amount?: number }>;
  achievements_unlocked?: Array<{ id?: string; name?: string; emoji?: string; xp?: number }>;
  chests_collected?: Array<{ id?: string; name?: string; rarity?: string }>;
}

export interface Crew {
  id: string;
  name: string;
  zip: string;
  color: string;
  owner_id: string;
  faction: string;
  invite_code: string;
  member_count: number;
  territory_color?: string | null;
}

export type TabId = "profil" | "map" | "crew" | "ranking";

export type RankingMode = "runners" | "crews" | "factions" | "guardians" | "turfWar" | "arena" | "mmr";

/* ═══════════════════════════════════════════════════════
 * Shared Color Constants
 * ═══════════════════════════════════════════════════════ */
export const BG_DEEP = "#0F1115";
export const BORDER = "rgba(255, 255, 255, 0.14)";
export const MUTED = "#a8b4cf";
export const TEXT_SOFT = "#dde3f5";
export const PRIMARY = "#22D1C3";
export const ACCENT = "#FF2D78";

/* ═══════════════════════════════════════════════════════
 * Geo-Hierarchy
 * ═══════════════════════════════════════════════════════ */
export type GeoLevel = "continent" | "country" | "state" | "region" | "city" | "zip";

export const GEO_LEVEL_SEQ: GeoLevel[] = ["continent", "country", "state", "region", "city", "zip"];
export const GEO_LABEL: Record<GeoLevel, string> = {
  continent: "Kontinent", country: "Land", state: "Bundesland / Region", region: "Stadt", city: "Bezirk / Stadtteil", zip: "PLZ",
};
export const GEO_ICON: Record<GeoLevel, string> = {
  continent: "🌐", country: "🌍", state: "🏛️", region: "🏙️", city: "🗺️", zip: "📍",
};

/* ═══════════════════════════════════════════════════════
 * TabSkeleton — Loading-Fallback für lazy-Tabs
 * ═══════════════════════════════════════════════════════ */
export function TabSkeleton() {
  return (
    <div className="absolute inset-0 flex items-center justify-center text-[#8B8FA3] text-xs">
      Lädt…
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
 * Style Helpers
 * ═══════════════════════════════════════════════════════ */
export function primaryBtnStyle(color: string): React.CSSProperties {
  return {
    padding: "14px 20px", borderRadius: 14,
    background: color, color: BG_DEEP, fontSize: 14, fontWeight: 900,
    border: "none", cursor: "pointer", width: "100%",
  };
}
export function outlineBtnStyle(): React.CSSProperties {
  return {
    padding: "14px 20px", borderRadius: 14,
    background: "transparent", color: "#FFF", fontSize: 14, fontWeight: 700,
    border: `1px solid ${BORDER}`, cursor: "pointer", width: "100%",
  };
}
export function inputStyle(): React.CSSProperties {
  return {
    background: "rgba(0,0,0,0.25)", color: "#FFF",
    padding: "12px 14px", borderRadius: 12,
    border: `1px solid ${BORDER}`, width: "100%",
    fontSize: 14,
  };
}
export function breadcrumbStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? PRIMARY : "rgba(70, 82, 122, 0.5)",
    color: active ? BG_DEEP : "#FFF",
    padding: "5px 10px", borderRadius: 10,
    border: "none", cursor: "pointer",
    fontSize: 11, fontWeight: 800,
  };
}

/* ═══════════════════════════════════════════════════════
 * Country Flag (PNG via flagcdn.com)
 * ═══════════════════════════════════════════════════════ */
export function CountryFlag({ country, size = 16 }: { country: string; size?: number }) {
  const iso = isoForCountry(country);
  if (!iso) return <span style={{ fontSize: size }}>🏳️</span>;
  const w = size;
  const h = Math.round(size * 0.75);
  return (
    <img
      src={`https://flagcdn.com/w80/${iso}.png`}
      srcSet={`https://flagcdn.com/w160/${iso}.png 2x`}
      width={w}
      height={h}
      alt={country}
      loading="lazy"
      style={{
        borderRadius: 2,
        display: "inline-block",
        verticalAlign: "middle",
        boxShadow: "0 0 0 0.5px rgba(255,255,255,0.15)",
        objectFit: "cover",
        flexShrink: 0,
      }}
    />
  );
}

/* ═══ Last Season Trophy Badge ═══ */
export function LastSeasonBadge({ tierId }: { tierId: string }) {
  const tier = LEAGUE_TIERS.find((t) => t.id === tierId);
  if (!tier) return null;
  return (
    <span
      title={`Letzte Saison (${previousSeasonLabel()}): ${tier.name}`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "3px 7px", borderRadius: 10,
        background: "rgba(0,0,0,0.3)",
        border: `1px dashed ${tier.color}aa`,
        color: tier.color, fontSize: 10, fontWeight: 800, letterSpacing: 0.3,
        whiteSpace: "nowrap",
      }}
    >
      <span>{tier.icon}</span>
      <span>LETZTE</span>
    </span>
  );
}

/* ═══ League Badge ═══ */
export function LeagueBadge({ weeklyKm, size = "sm" }: { weeklyKm: number; size?: "sm" | "md" }) {
  const tier = leagueTierFor(weeklyKm);
  const p = size === "md" ? "4px 10px" : "3px 7px";
  const fs = size === "md" ? 12 : 10;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: p, borderRadius: 10,
      background: `${tier.color}22`, border: `1px solid ${tier.color}66`,
      color: tier.color, fontSize: fs, fontWeight: 900, letterSpacing: 0.3,
      whiteSpace: "nowrap",
    }}>
      <span>{tier.icon}</span>
      <span>{tier.name.toUpperCase()}</span>
    </span>
  );
}

/* ═══ Top-3-Teams-Ranking ═══ */
export const MEDALS = ["🥇", "🥈", "🥉"];
export const MEDAL_COLORS = ["#FFD700", "#C0C8D8", "#CD7F32"];

export function TopThreeRanking({ scopeLabel, crews }: { scopeLabel: string; crews: NearbyCrew[] }) {
  const sorted = [...crews].sort((a, b) => b.weekly_km - a.weekly_km).slice(0, 3);
  const max = sorted[0]?.weekly_km || 1;
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    setAnimated(false);
    const t = setTimeout(() => setAnimated(true), 80);
    return () => clearTimeout(t);
  }, [scopeLabel, crews.length]);

  return (
    <div style={{
      background: "rgba(30, 38, 60, 0.55)", border: `1px solid ${BORDER}`,
      borderRadius: 14, padding: 14, marginBottom: 16,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
      }}>
        <span style={{ fontSize: 16 }}>🏆</span>
        <span style={{ color: "#FFF", fontSize: 12, fontWeight: 900, letterSpacing: 0.5 }}>
          TOP 3 · {scopeLabel.toUpperCase()}
        </span>
        <span style={{ color: MUTED, fontSize: 11, marginLeft: "auto" }}>diese Woche</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {sorted.map((c, i) => {
          const pct = animated ? (c.weekly_km / max) * 100 : 0;
          const location = `${c.city} · ${c.region}${c.country !== c.region ? ` · ${c.country}` : ""}`;
          return (
            <div key={c.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <span style={{ color: MEDAL_COLORS[i], fontSize: 16, fontWeight: 900, width: 22, textAlign: "center" }}>
                  {MEDALS[i]}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    color: "#FFF", fontSize: 13, fontWeight: 800,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {c.name}
                  </div>
                  <div style={{
                    color: MUTED, fontSize: 10, fontWeight: 600, marginTop: 2,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    display: "flex", alignItems: "center", gap: 5,
                  }}>
                    <CountryFlag country={c.country} size={12} />
                    <span>{location} · {c.zip}</span>
                  </div>
                </div>
                <span style={{ color: MUTED, fontSize: 11, whiteSpace: "nowrap" }}>
                  {c.member_count}👥
                </span>
                <span style={{
                  color: c.color, fontWeight: 900, fontSize: 13,
                  minWidth: 72, textAlign: "right",
                }}>
                  {c.weekly_km} km
                </span>
              </div>
              <div style={{ height: 6, background: "rgba(0,0,0,0.35)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${pct}%`, background: c.color,
                  transition: "width 1.1s cubic-bezier(0.2, 0.8, 0.2, 1)",
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══ Filter Pill ═══ */
export function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "5px 10px", borderRadius: 14,
        background: active ? PRIMARY : "rgba(30, 38, 60, 0.55)",
        color: active ? BG_DEEP : "#FFF",
        border: active ? "none" : `1px solid ${BORDER}`,
        fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

/* ═══ Badge ═══ */
export function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 900, letterSpacing: 0.5,
      padding: "2px 6px", borderRadius: 6,
      background: `${color}22`, color, border: `1px solid ${color}55`,
    }}>{children}</span>
  );
}

/* ═══ Arena Type Meta ═══ */
export const ARENA_TYPE_META: Record<string, { label: string; icon: string; color: string }> = {
  infantry: { label: "Infanterie",    icon: "🛡️", color: "#60a5fa" },
  cavalry:  { label: "Kavallerie",    icon: "🐎", color: "#fb923c" },
  marksman: { label: "Scharfschütze", icon: "🏹", color: "#4ade80" },
  mage:     { label: "Magier",        icon: "🔮", color: "#c084fc" },
};

