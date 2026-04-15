"use client";

import { useState, useCallback, useRef } from "react";
import Image from "next/image";
import { AppMap } from "@/components/app-map";
import {
  Play,
  Square,
  Zap,
  Flame,
  Footprints,
  Clock,
  MapPin,
  Crosshair,
  Trophy,
  Target,
  Star,
  ChevronRight,
  Users,
  Store,
  Map as MapIcon,
  User,
} from "lucide-react";

interface Profile {
  username: string;
  display_name: string | null;
  xp: number;
  level: number;
  total_distance_m: number;
  total_walks: number;
  streak_days: number;
  streak_best: number;
  equipped_marker: string;
  equipped_trail: string;
}

const TABS = [
  { id: "karte", label: "Karte", icon: MapIcon, emoji: "🗺️" },
  { id: "ranking", label: "Ranking", icon: Trophy, emoji: "🏆" },
  { id: "gruppen", label: "Gruppen", icon: Users, emoji: "👥" },
  { id: "shops", label: "Shops", icon: Store, emoji: "🏪" },
  { id: "profil", label: "Ich", icon: User, emoji: "⚡" },
];

export function MapDashboard({ profile }: { profile: Profile | null }) {
  const [walking, setWalking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [activeTab, setActiveTab] = useState("karte");
  const [equippedMarker, setEquippedMarker] = useState(profile?.equipped_marker || "default");
  const [equippedTrail, setEquippedTrail] = useState(profile?.equipped_trail || "default");

  const TRAIL_CONFIGS: Record<string, { color: string; width: number; glow: boolean; gradientColors?: string[] }> = {
    default: { color: "#22D1C3", width: 4, glow: false },
    fire: { color: "#FF6B4A", width: 5, glow: true, gradientColors: ["#FF6B4A", "#FFD700", "#FF2D78"] },
    ice: { color: "#7CC8F0", width: 4, glow: true },
    neon: { color: "#A855F7", width: 5, glow: true },
    rainbow: { color: "#FF0000", width: 6, glow: true },
    shadow: { color: "#2a3040", width: 6, glow: false },
    gold: { color: "#FFD700", width: 5, glow: true },
    aurora: { color: "#22D1C3", width: 8, glow: true },
  };
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPosRef = useRef<{ lng: number; lat: number } | null>(null);

  const startWalk = () => {
    setWalking(true);
    setElapsed(0);
    setDistance(0);
    lastPosRef.current = null;
    timerRef.current = setInterval(() => setElapsed((prev) => prev + 1), 1000);
  };

  const stopWalk = () => {
    setWalking(false);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const onLocationUpdate = useCallback(
    (lng: number, lat: number) => {
      if (!walking) return;
      if (lastPosRef.current) {
        const d = haversine(lastPosRef.current.lat, lastPosRef.current.lng, lat, lng);
        if (d > 3) setDistance((prev) => prev + d);
      }
      lastPosRef.current = { lng, lat };
    },
    [walking]
  );

  const fmt = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
  const fmtDist = (m: number) =>
    m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`;

  const p = profile;
  const xpForNext = (p?.level || 1) * 500;
  const xpPct = Math.min(((p?.xp || 0) % xpForNext) / xpForNext * 100, 100);

  return (
    <div style={{ height: "100dvh", width: "100%", position: "relative", background: "#0B0E13" }}>

      {/* ══ Main content area – full screen ══ */}
      <div style={{ position: "absolute", inset: 0 }}>

        {/* === Karte Tab === */}
        {activeTab === "karte" && (
          <>
            <AppMap
              onLocationUpdate={onLocationUpdate}
              trackingActive={walking}
              markerSkin={equippedMarker}
              trailStyle={TRAIL_CONFIGS[equippedTrail] || TRAIL_CONFIGS.default}
            />

            {/* Top floating pills */}
            <div style={{ position: "fixed", top: 12, left: 12, right: 12, zIndex: 99999, display: "flex", justifyContent: "space-between", pointerEvents: "none" }}>
              <div style={{ display: "flex", gap: 8, pointerEvents: "auto" }}>
                <div className="flex items-center gap-2 px-3 py-2 rounded-2xl" style={glassStyle}>
                  <Image src="/logo.png" alt="" width={24} height={24} className="rounded-full" />
                  <span className="text-xs font-bold">{p?.display_name || p?.username || "Runner"}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-black">Lv.{p?.level || 1}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, pointerEvents: "auto" }}>
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl" style={glassStyle}>
                  <Zap className="w-3.5 h-3.5 text-xp" />
                  <span className="text-xs font-black text-xp">{p?.xp || 0}</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl" style={glassStyle}>
                  <Flame className="w-3.5 h-3.5 text-accent" />
                  <span className="text-xs font-black text-accent">{p?.streak_days || 0}</span>
                </div>
              </div>
            </div>

            {/* Walk HUD */}
            {walking && (
              <div style={{ position: "fixed", top: 60, left: 12, right: 12, zIndex: 99999, display: "flex", justifyContent: "center" }}>
                <div className="flex items-center rounded-2xl overflow-hidden" style={glassStyle}>
                  <HudCell icon={Clock} value={fmt(elapsed)} label="Zeit" />
                  <div className="w-px self-stretch bg-white/5" />
                  <HudCell icon={Footprints} value={fmtDist(distance)} label="Distanz" />
                  <div className="w-px self-stretch bg-white/5" />
                  <HudCell icon={Target} value="0" label="Areas" />
                </div>
              </div>
            )}

            {/* Walk button + recenter */}
            <div style={{ position: "fixed", bottom: 90, left: 0, right: 0, zIndex: 99999, display: "flex", justifyContent: "center", alignItems: "center", gap: 12 }}>
              <button
                onClick={() => navigator.geolocation?.getCurrentPosition(() => {})}
                className="w-12 h-12 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                style={glassStyle}
              >
                <Crosshair className="w-5 h-5 text-primary" />
              </button>

              {!walking ? (
                <button
                  onClick={startWalk}
                  className="flex items-center gap-2.5 px-8 py-4 rounded-full font-bold text-lg text-white active:scale-95 transition-transform"
                  style={{
                    background: "linear-gradient(135deg, #22D1C3 0%, #1AB5A8 50%, #22D1C3 100%)",
                    boxShadow: "0 4px 25px rgba(34,209,195,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
                  }}
                >
                  <Play className="w-6 h-6" fill="currentColor" />
                  Walk starten
                </button>
              ) : (
                <button
                  onClick={stopWalk}
                  className="flex items-center gap-2.5 px-8 py-4 rounded-full font-bold text-lg text-white active:scale-95 transition-transform"
                  style={{
                    background: "linear-gradient(135deg, #FF2D78 0%, #E0246A 50%, #FF2D78 100%)",
                    boxShadow: "0 4px 25px rgba(255,45,120,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
                  }}
                >
                  <Square className="w-5 h-5" fill="currentColor" />
                  Beenden
                </button>
              )}

              <div className="w-12" />
            </div>
          </>
        )}

        {/* === Non-map tabs === */}
        {activeTab !== "karte" && (
          <div className="h-full overflow-y-auto p-4" style={{ background: "#0B0E13" }}>
            {activeTab === "ranking" && <RankingTab profile={p} />}
            {activeTab === "gruppen" && <GruppenTab />}
            {activeTab === "shops" && <ShopsTab />}
            {activeTab === "profil" && <ProfilTab profile={p} xpPct={xpPct} xpForNext={xpForNext} equippedMarker={equippedMarker} equippedTrail={equippedTrail} onMarkerChange={setEquippedMarker} onTrailChange={setEquippedTrail} />}
          </div>
        )}
      </div>

      {/* ══ Tab bar – fixed at bottom, glassmorphism over map ══ */}
      <div
        className="safe-bottom"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "rgba(11,14,19,0.75)",
          backdropFilter: "blur(40px) saturate(1.8)",
          WebkitBackdropFilter: "blur(40px) saturate(1.8)",
          borderTop: "1px solid rgba(255,255,255,0.1)",
          zIndex: 100000,
        }}
      >
        <div className="flex items-stretch">
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex-1 flex flex-col items-center gap-0.5 py-3 relative transition-all active:scale-95 cursor-pointer"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                {active && (
                  <div
                    className="absolute top-0 left-1/4 right-1/4 h-[2px] rounded-full"
                    style={{ background: "#22D1C3", boxShadow: "0 0 8px #22D1C3" }}
                  />
                )}
                <span style={{ fontSize: active ? 26 : 22, lineHeight: 1, filter: active ? "none" : "grayscale(1) opacity(0.4)" }}>
                  {tab.emoji}
                </span>
                <span
                  className="text-[10px] font-semibold"
                  style={{ color: active ? "#22D1C3" : "rgba(255,255,255,0.3)" }}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Styles ─────────────────────────────────────────── */
const glassStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  backdropFilter: "blur(40px) saturate(1.8)",
  WebkitBackdropFilter: "blur(40px) saturate(1.8)",
  border: "1px solid rgba(255,255,255,0.12)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)",
};

/* ── Components ─────────────────────────────────────── */

function HudCell({ icon: Icon, value, label }: { icon: typeof Clock; value: string; label: string }) {
  return (
    <div className="px-4 py-2.5 text-center">
      <Icon className="w-3.5 h-3.5 text-primary mx-auto mb-0.5" />
      <div className="text-lg font-mono font-black">{value}</div>
      <div className="text-[8px] text-white/40 uppercase tracking-widest">{label}</div>
    </div>
  );
}

/* ── Tab: Ranking ──────────────────────────────────── */
function RankingTab({ profile: p }: { profile: Profile | null }) {
  const entries = [
    { rank: 1, name: p?.username || "Du", xp: p?.xp || 0, walks: p?.total_walks || 0, isYou: true },
    { rank: 2, name: "ShadowWalker", xp: 3200, walks: 67 },
    { rank: 3, name: "NightRunner", xp: 1800, walks: 43 },
    { rank: 4, name: "TrailBlazer", xp: 1500, walks: 42 },
    { rank: 5, name: "CityExplorer", xp: 1200, walks: 38 },
  ];
  const medals: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

  return (
    <div className="max-w-md mx-auto space-y-3 pb-4">
      <h2 className="text-xl font-black flex items-center gap-2">🏆 Leaderboard</h2>
      <div className="space-y-2">
        {entries.map((e) => (
          <div key={e.rank} className={`flex items-center gap-3 p-3.5 rounded-2xl ${e.isYou ? "ring-1 ring-primary/30" : ""}`} style={glassStyle}>
            <div className="w-8 text-center text-lg">{medals[e.rank] || <span className="text-sm text-white/30">{e.rank}</span>}</div>
            <div className="flex-1">
              <div className="text-sm font-semibold">{e.name} {e.isYou && <span className="text-primary text-[10px]">(Du)</span>}</div>
              <div className="text-[10px] text-white/30">{e.walks} Walks</div>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-sm font-black text-xp">{e.xp.toLocaleString()}</span>
              <span className="text-xs">⚡</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Tab: Gruppen ──────────────────────────────────── */
function GruppenTab() {
  return (
    <div className="max-w-md mx-auto pb-4">
      <h2 className="text-xl font-black flex items-center gap-2 mb-4">👥 Gruppen</h2>
      <div className="p-8 rounded-2xl text-center" style={glassStyle}>
        <div className="text-5xl mb-4">🏃‍♂️🏃‍♀️</div>
        <p className="text-lg font-bold mb-1">Gründe dein Team</p>
        <p className="text-sm text-white/40 mb-5">Erobert gemeinsam Gebiete und dominiert das Leaderboard.</p>
        <button className="px-6 py-2.5 rounded-full font-bold text-white active:scale-95 transition-transform" style={{ background: "linear-gradient(135deg, #A855F7, #7C3AED)", boxShadow: "0 4px 20px rgba(168,85,247,0.3)" }}>
          Gruppe erstellen
        </button>
      </div>
    </div>
  );
}

/* ── Tab: Shops ────────────────────────────────────── */
function ShopsTab() {
  return (
    <div className="max-w-md mx-auto pb-4">
      <h2 className="text-xl font-black flex items-center gap-2 mb-4">🏪 Lokale Geschäfte</h2>
      <div className="p-8 rounded-2xl text-center" style={glassStyle}>
        <div className="text-5xl mb-4">🎁💰</div>
        <p className="text-lg font-bold mb-1">Rabatte in deiner Nähe</p>
        <p className="text-sm text-white/40 mb-5">Löse deine XP bei lokalen Geschäften gegen echte Rabatte ein.</p>
        <button className="px-6 py-2.5 rounded-full font-bold text-white active:scale-95 transition-transform" style={{ background: "linear-gradient(135deg, #FF2D78, #E0246A)", boxShadow: "0 4px 20px rgba(255,45,120,0.3)" }}>
          Geschäfte entdecken
        </button>
      </div>
    </div>
  );
}

/* ── Tab: Profil ───────────────────────────────────── */
function ProfilTab({ profile: p, xpPct, xpForNext, equippedMarker, equippedTrail, onMarkerChange, onTrailChange }: { profile: Profile | null; xpPct: number; xpForNext: number; equippedMarker: string; equippedTrail: string; onMarkerChange: (s: string) => void; onTrailChange: (s: string) => void }) {
  const markers = [
    { slug: "default", name: "Runner", emoji: "📍", xp: 0, level: 1, rarity: "common" },
    { slug: "flame", name: "Flamme", emoji: "🔥", xp: 100, level: 3, rarity: "common" },
    { slug: "star", name: "Stern", emoji: "⭐", xp: 250, level: 5, rarity: "uncommon" },
    { slug: "bolt", name: "Blitz", emoji: "⚡", xp: 500, level: 8, rarity: "uncommon" },
    { slug: "crown", name: "Krone", emoji: "👑", xp: 1000, level: 12, rarity: "rare" },
    { slug: "diamond", name: "Diamant", emoji: "💎", xp: 2500, level: 18, rarity: "rare" },
    { slug: "dragon", name: "Drache", emoji: "🐉", xp: 5000, level: 25, rarity: "epic" },
    { slug: "phoenix", name: "Phoenix", emoji: "🦅", xp: 10000, level: 35, rarity: "legendary" },
  ];

  const trails = [
    { slug: "default", name: "Standard", emoji: "〰️", xp: 0, level: 1, rarity: "common", color: "#22D1C3" },
    { slug: "fire", name: "Feuer", emoji: "🔥", xp: 200, level: 4, rarity: "common", color: "#FF6B4A" },
    { slug: "ice", name: "Eis", emoji: "❄️", xp: 200, level: 4, rarity: "common", color: "#7CC8F0" },
    { slug: "neon", name: "Neon", emoji: "💜", xp: 500, level: 8, rarity: "uncommon", color: "#A855F7" },
    { slug: "rainbow", name: "Regenbogen", emoji: "🌈", xp: 1000, level: 12, rarity: "rare", color: "#FF0000" },
    { slug: "shadow", name: "Schatten", emoji: "🖤", xp: 1500, level: 15, rarity: "rare", color: "#2a3040" },
    { slug: "gold", name: "Gold", emoji: "✨", xp: 3000, level: 20, rarity: "epic", color: "#FFD700" },
    { slug: "aurora", name: "Aurora", emoji: "🌌", xp: 7500, level: 30, rarity: "legendary", color: "#22D1C3" },
  ];

  const rarityColors: Record<string, string> = { common: "#9BA3B5", uncommon: "#22D1C3", rare: "#A855F7", epic: "#FF2D78", legendary: "#FFD700" };
  const userXp = p?.xp || 0;
  const userLevel = p?.level || 1;
  return (
    <div className="max-w-md mx-auto space-y-4 pb-4">
      <div className="p-5 rounded-2xl" style={glassStyle}>
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black text-white" style={{ background: "linear-gradient(135deg, #22D1C3, #FF2D78)" }}>
              {(p?.display_name || p?.username || "?")[0].toUpperCase()}
            </div>
            <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full text-[9px] font-black text-white" style={{ background: "linear-gradient(135deg, #22D1C3, #1AB5A8)", border: "2px solid #0B0E13" }}>
              {p?.level || 1}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-lg font-bold truncate">{p?.display_name || p?.username}</div>
            <div className="text-xs text-white/30">@{p?.username}</div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${xpPct}%`, background: "linear-gradient(90deg, #22D1C3, #FF2D78)" }} />
              </div>
              <span className="text-[10px] text-white/30 shrink-0">{p?.xp || 0}/{xpForNext}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatBox emoji="⚡" label="XP" value={`${p?.xp || 0}`} />
        <StatBox emoji="👣" label="Walks" value={`${p?.total_walks || 0}`} />
        <StatBox emoji="📍" label="Distanz" value={`${((p?.total_distance_m || 0) / 1000).toFixed(1)} km`} />
        <StatBox emoji="🔥" label="Streak" value={`${p?.streak_days || 0} Tage`} />
      </div>

      <div className="p-4 rounded-2xl" style={glassStyle}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold">🏅 Achievements</span>
          <ChevronRight className="w-4 h-4 text-white/20" />
        </div>
        <div className="flex gap-2">
          {["Erste Schritte", "5 km Club", "Eroberer"].map((name) => (
            <div key={name} className="flex-1 p-2.5 rounded-xl text-center opacity-30" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="text-lg mb-1">⭐</div>
              <div className="text-[9px] text-white/50">{name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Marker Customization */}
      <div className="p-4 rounded-2xl" style={glassStyle}>
        <span className="text-sm font-bold block mb-3">🎯 Dein Marker</span>
        <div className="grid grid-cols-4 gap-2">
          {markers.map((m) => {
            const locked = userLevel < m.level;
            const active = equippedMarker === m.slug;
            return (
              <button
                key={m.slug}
                onClick={() => !locked && onMarkerChange(m.slug)}
                className={`p-2.5 rounded-xl text-center transition-all active:scale-95 ${locked ? "opacity-30" : ""}`}
                style={{
                  background: active ? `${rarityColors[m.rarity]}15` : "rgba(255,255,255,0.03)",
                  border: active ? `2px solid ${rarityColors[m.rarity]}` : "1px solid rgba(255,255,255,0.05)",
                  boxShadow: active ? `0 0 12px ${rarityColors[m.rarity]}30` : "none",
                }}
              >
                <div className="text-2xl mb-0.5">{locked ? "🔒" : m.emoji}</div>
                <div className="text-[8px] font-semibold truncate" style={{ color: active ? rarityColors[m.rarity] : "rgba(255,255,255,0.5)" }}>{m.name}</div>
                {locked && <div className="text-[7px] text-white/30">Lv.{m.level}</div>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Trail Customization */}
      <div className="p-4 rounded-2xl" style={glassStyle}>
        <span className="text-sm font-bold block mb-3">✨ Dein Schweif</span>
        <div className="grid grid-cols-4 gap-2">
          {trails.map((t) => {
            const locked = userLevel < t.level;
            const active = equippedTrail === t.slug;
            return (
              <button
                key={t.slug}
                onClick={() => !locked && onTrailChange(t.slug)}
                className={`p-2.5 rounded-xl text-center transition-all active:scale-95 ${locked ? "opacity-30" : ""}`}
                style={{
                  background: active ? `${rarityColors[t.rarity]}15` : "rgba(255,255,255,0.03)",
                  border: active ? `2px solid ${rarityColors[t.rarity]}` : "1px solid rgba(255,255,255,0.05)",
                  boxShadow: active ? `0 0 12px ${rarityColors[t.rarity]}30` : "none",
                }}
              >
                <div className="text-2xl mb-0.5">{locked ? "🔒" : t.emoji}</div>
                <div className="text-[8px] font-semibold truncate" style={{ color: active ? rarityColors[t.rarity] : "rgba(255,255,255,0.5)" }}>{t.name}</div>
                {!locked && <div className="w-full h-1 rounded-full mt-1" style={{ background: t.color }} />}
                {locked && <div className="text-[7px] text-white/30">Lv.{t.level}</div>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatBox({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <div className="p-4 rounded-2xl" style={glassStyle}>
      <div className="text-xl mb-2">{emoji}</div>
      <div className="text-xl font-black">{value}</div>
      <div className="text-[10px] text-white/30 uppercase tracking-wider">{label}</div>
    </div>
  );
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
