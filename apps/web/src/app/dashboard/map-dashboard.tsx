"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AppMap } from "@/components/app-map";
import {
  getCurrentRank,
  getNextRank,
  haversine,
  reverseGeocode,
  FACTIONS,
  UNLOCKABLE_MARKERS,
  CREW_COLORS,
  XP_PER_TERRITORY,
  MIN_ROUTE_POINTS,
  LIVE_OTHER_RUNNERS,
} from "@/lib/game-config";

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  xp: number;
  level: number;
  total_distance_m: number;
  total_walks: number;
  total_calories: number;
  streak_days: number;
  team_color: string;
  faction: string;
  current_crew_id: string | null;
}

interface Crew {
  id: string;
  name: string;
  zip: string;
  color: string;
  owner_id: string;
  faction: string;
  invite_code: string;
  member_count: number;
}

interface Coord {
  lat: number;
  lng: number;
}

type TabId = "karte" | "ranking" | "crew" | "shops" | "profil";

const TABS: { id: TabId; emoji: string; label: string }[] = [
  { id: "karte",   emoji: "🗺️",  label: "Karte"   },
  { id: "ranking", emoji: "🏆",  label: "Ranking" },
  { id: "crew",    emoji: "👥",  label: "Crew"    },
  { id: "shops",   emoji: "🏪",  label: "Shops"   },
  { id: "profil",  emoji: "⚡",  label: "Profil"  },
];

export function MapDashboard({ profile: initialProfile }: { profile: Profile | null }) {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [activeTab, setActiveTab] = useState<TabId>("karte");
  const [equippedMarker, setEquippedMarker] = useState("👣");

  // Walk state
  const [walking, setWalking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [currentStreet, setCurrentStreet] = useState<string | null>(null);
  const [activeRoute, setActiveRoute] = useState<Coord[]>([]);
  const [savedTerritories, setSavedTerritories] = useState<Coord[][]>([]);
  const [territoryCount, setTerritoryCount] = useState(0);

  // Crew
  const [myCrew, setMyCrew] = useState<Crew | null>(null);
  const [leaderboard, setLeaderboard] = useState<Profile[]>([]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPosRef = useRef<Coord | null>(null);
  const lastGeoRef = useRef<number>(0);

  // Auto-equip highest unlocked marker
  useEffect(() => {
    if (!profile) return;
    const available = UNLOCKABLE_MARKERS.filter((m) => m.cost <= (profile.xp || 0));
    if (available.length > 0) setEquippedMarker(available[available.length - 1].icon);
  }, [profile?.xp]);

  // Load crew + territories
  useEffect(() => {
    if (!profile) return;

    (async () => {
      // Count territories
      const { count } = await supabase
        .from("territories")
        .select("*", { count: "exact", head: true })
        .eq("user_id", profile.id);
      setTerritoryCount(count || 0);

      // Load saved territory routes
      const { data: terrData } = await supabase
        .from("territories")
        .select("route")
        .eq("user_id", profile.id)
        .limit(50);
      if (terrData) {
        setSavedTerritories(terrData.map((t: { route: Coord[] }) => t.route));
      }

      // Load crew
      if (profile.current_crew_id) {
        const { data: crewData } = await supabase
          .from("crews")
          .select("*")
          .eq("id", profile.current_crew_id)
          .single();
        if (crewData) setMyCrew(crewData);
      }
    })();
  }, [profile?.id, profile?.current_crew_id]);

  // Load leaderboard when tab active
  useEffect(() => {
    if (activeTab !== "ranking") return;
    (async () => {
      const { data } = await supabase
        .from("users")
        .select("id, username, display_name, xp, level, team_color")
        .order("xp", { ascending: false })
        .limit(20);
      if (data) setLeaderboard(data as Profile[]);
    })();
  }, [activeTab]);

  const startWalk = () => {
    setWalking(true);
    setElapsed(0);
    setDistance(0);
    setCurrentStreet("Suche Position...");
    setActiveRoute([]);
    lastPosRef.current = null;
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  };

  const stopWalk = async () => {
    setWalking(false);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;

    if (activeRoute.length < MIN_ROUTE_POINTS) {
      alert("Lauf zu kurz! Du musst dich etwas mehr bewegen, um eine Straße zu erobern.");
      setActiveRoute([]);
      setCurrentStreet(null);
      return;
    }

    // Save territory to DB
    if (profile) {
      const { error } = await supabase.from("territories").insert({
        user_id: profile.id,
        crew_id: profile.current_crew_id,
        street_name: currentStreet,
        route: activeRoute,
        distance_m: Math.round(distance),
        duration_s: elapsed,
        xp_earned: XP_PER_TERRITORY,
      });

      if (!error) {
        // Update user XP
        const newXp = (profile.xp || 0) + XP_PER_TERRITORY;
        const newDistance = (profile.total_distance_m || 0) + Math.round(distance);
        const newWalks = (profile.total_walks || 0) + 1;
        const newCal = (profile.total_calories || 0) + Math.round(distance * 0.06);

        await supabase
          .from("users")
          .update({
            xp: newXp,
            total_distance_m: newDistance,
            total_walks: newWalks,
            total_calories: newCal,
          })
          .eq("id", profile.id);

        setProfile({
          ...profile,
          xp: newXp,
          total_distance_m: newDistance,
          total_walks: newWalks,
          total_calories: newCal,
        });
        setSavedTerritories((prev) => [...prev, activeRoute]);
        setTerritoryCount((c) => c + 1);

        alert(`🎉 Straßenzug erobert!\n+${XP_PER_TERRITORY} XP`);
      }
    }

    setActiveRoute([]);
    setCurrentStreet(null);
  };

  const onLocationUpdate = useCallback(
    (lng: number, lat: number) => {
      if (!walking) return;

      const now = Date.now();
      if (lastPosRef.current) {
        const d = haversine(lastPosRef.current.lat, lastPosRef.current.lng, lat, lng);
        if (d > 3) {
          setDistance((prev) => prev + d);
          setActiveRoute((prev) => [...prev, { lat, lng }]);
          lastPosRef.current = { lat, lng };
        }
      } else {
        setActiveRoute([{ lat, lng }]);
        lastPosRef.current = { lat, lng };
      }

      // Reverse geocode every 5 seconds max
      if (now - lastGeoRef.current > 5000) {
        lastGeoRef.current = now;
        reverseGeocode(lat, lng).then(setCurrentStreet);
      }
    },
    [walking]
  );

  const fmt = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
  const fmtDist = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const p = profile;
  const currentRank = getCurrentRank(p?.xp || 0);
  const nextRank = getNextRank(p?.xp || 0);
  const teamColor = myCrew?.color || p?.team_color || "#22D1C3";

  return (
    <div style={{ height: "100dvh", width: "100%", display: "flex", flexDirection: "column", background: "#0B0E13" }}>

      {/* ═══ Main content ═══ */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>

        {/* KARTE */}
        {activeTab === "karte" && (
          <>
            <AppMap
              onLocationUpdate={onLocationUpdate}
              trackingActive={walking}
              teamColor={teamColor}
              markerEmoji={equippedMarker}
              username={p?.display_name || p?.username || "Ich"}
              activeRoute={activeRoute}
              savedTerritories={savedTerritories}
            />

            {/* Top pills */}
            <div style={{ position: "absolute", top: 12, left: 12, right: 12, zIndex: 50, display: "flex", justifyContent: "space-between", pointerEvents: "none" }}>
              <GlassPill>
                <Image src="/logo.png" alt="" width={22} height={22} className="rounded-full" />
                <span className="text-xs font-bold">{p?.display_name || p?.username}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-black" style={{ background: `${currentRank.color}25`, color: currentRank.color }}>
                  {currentRank.name}
                </span>
              </GlassPill>
              <div style={{ display: "flex", gap: 6 }}>
                <GlassPill>
                  <span className="text-xs">⚡</span>
                  <span className="text-xs font-black text-xp">{p?.xp || 0}</span>
                </GlassPill>
                <GlassPill>
                  <span className="text-xs">🏁</span>
                  <span className="text-xs font-black">{territoryCount}</span>
                </GlassPill>
              </div>
            </div>

            {/* Live Walk HUD */}
            {walking && (
              <div style={{ position: "absolute", top: 64, left: 12, right: 12, zIndex: 50, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
                <div className="flex items-center rounded-2xl overflow-hidden" style={glassStyle}>
                  <HudCell emoji="⏱" value={fmt(elapsed)} label="Zeit" />
                  <div className="w-px self-stretch bg-white/10" />
                  <HudCell emoji="👣" value={fmtDist(distance)} label="Distanz" />
                  <div className="w-px self-stretch bg-white/10" />
                  <HudCell emoji="🎯" value={`${activeRoute.length}`} label="Punkte" />
                </div>
              </div>
            )}

            {/* Current street badge */}
            {walking && currentStreet && (
              <div style={{ position: "absolute", top: 140, left: 12, right: 12, zIndex: 50, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
                <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{ ...glassStyle, border: `1px solid ${teamColor}40` }}>
                  <span style={{ color: teamColor }}>📍</span>
                  <span className="text-sm font-bold" style={{ color: teamColor }}>{currentStreet}</span>
                </div>
              </div>
            )}

            {/* Eroberung Button */}
            <div style={{ position: "absolute", bottom: 20, left: 0, right: 0, zIndex: 50, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
              <button
                onClick={walking ? stopWalk : startWalk}
                className="flex items-center gap-2.5 px-8 py-4 rounded-full font-bold text-lg text-white active:scale-95 transition-transform"
                style={{
                  pointerEvents: "auto",
                  background: walking
                    ? "linear-gradient(135deg, #FF2D78 0%, #E0246A 50%, #FF2D78 100%)"
                    : `linear-gradient(135deg, ${teamColor} 0%, ${teamColor}cc 50%, ${teamColor} 100%)`,
                  boxShadow: `0 4px 25px ${walking ? "#FF2D7860" : `${teamColor}60`}, inset 0 1px 0 rgba(255,255,255,0.2)`,
                }}
              >
                <span className="text-xl">{walking ? "⏹" : "▶"}</span>
                {walking ? "Eroberung abschließen" : "Eroberung starten"}
              </button>
            </div>
          </>
        )}

        {/* RANKING */}
        {activeTab === "ranking" && (
          <div className="h-full overflow-y-auto p-4" style={{ background: "#0B0E13" }}>
            <RankingTab profile={p} leaderboard={leaderboard} />
          </div>
        )}

        {/* CREW */}
        {activeTab === "crew" && (
          <div className="h-full overflow-y-auto" style={{ background: "#0B0E13" }}>
            <CrewTab profile={p} myCrew={myCrew} setMyCrew={setMyCrew} setProfile={setProfile} />
          </div>
        )}

        {/* SHOPS */}
        {activeTab === "shops" && (
          <div className="h-full overflow-y-auto p-4" style={{ background: "#0B0E13" }}>
            <ShopsTab />
          </div>
        )}

        {/* PROFIL */}
        {activeTab === "profil" && (
          <div className="h-full overflow-y-auto p-4" style={{ background: "#0B0E13" }}>
            <ProfilTab
              profile={p}
              equippedMarker={equippedMarker}
              setEquippedMarker={setEquippedMarker}
              territoryCount={territoryCount}
              currentStreet={currentStreet}
              walking={walking}
              myCrew={myCrew}
              onLogout={handleLogout}
              currentRank={currentRank}
              nextRank={nextRank}
            />
          </div>
        )}
      </div>

      {/* ═══ Tab Bar – outside map container, guaranteed clickable ═══ */}
      <div
        className="safe-bottom shrink-0"
        style={{
          background: "rgba(14,17,23,0.95)",
          backdropFilter: "blur(30px) saturate(1.5)",
          WebkitBackdropFilter: "blur(30px) saturate(1.5)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          position: "relative",
          zIndex: 1000,
        }}
      >
        <div className="flex items-stretch">
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 active:scale-90 transition-transform relative cursor-pointer"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                {active && (
                  <div
                    className="absolute top-0 inset-x-4 h-0.5 rounded-full"
                    style={{ background: "#22D1C3", boxShadow: "0 0 8px #22D1C3" }}
                  />
                )}
                <span
                  style={{
                    fontSize: active ? 28 : 24,
                    lineHeight: 1,
                    filter: active ? "none" : "grayscale(1) opacity(0.4)",
                    transition: "all 0.2s",
                  }}
                >
                  {tab.emoji}
                </span>
                <span
                  className="text-[10px] font-bold"
                  style={{ color: active ? "#22D1C3" : "rgba(255,255,255,0.4)" }}
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

/* ═══════════════════════════════════════════════════════════
   Shared Styles & Components
   ═══════════════════════════════════════════════════════════ */

const glassStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  backdropFilter: "blur(40px) saturate(1.8)",
  WebkitBackdropFilter: "blur(40px) saturate(1.8)",
  border: "1px solid rgba(255,255,255,0.12)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)",
};

function GlassPill({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full pointer-events-auto" style={glassStyle}>
      {children}
    </div>
  );
}

function HudCell({ emoji, value, label }: { emoji: string; value: string; label: string }) {
  return (
    <div className="px-4 py-2.5 text-center">
      <div className="text-sm">{emoji}</div>
      <div className="text-lg font-mono font-black">{value}</div>
      <div className="text-[8px] text-white/50 uppercase tracking-widest">{label}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Ranking Tab
   ═══════════════════════════════════════════════════════════ */

function RankingTab({ profile: p, leaderboard }: { profile: Profile | null; leaderboard: Profile[] }) {
  const medals: Record<number, string> = { 0: "🥇", 1: "🥈", 2: "🥉" };

  return (
    <div className="max-w-md mx-auto space-y-3 pb-4">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-black flex items-center gap-2">🏆 Top Eroberer</h2>
          <p className="text-xs text-white/40 mt-1">Die Legenden der Straßen</p>
        </div>
      </div>

      {leaderboard.length === 0 ? (
        <div className="p-6 rounded-2xl text-center" style={glassStyle}>
          <p className="text-sm text-white/50">Keine Daten verfügbar</p>
        </div>
      ) : (
        <div className="space-y-2">
          {leaderboard.map((entry, i) => {
            const isMe = entry.id === p?.id;
            return (
              <div
                key={entry.id}
                className={`flex items-center gap-3 p-3.5 rounded-2xl ${isMe ? "ring-2 ring-primary/60" : ""}`}
                style={glassStyle}
              >
                <div className="w-8 text-center text-lg">
                  {medals[i] || <span className="text-sm text-white/40 font-black">{i + 1}</span>}
                </div>
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black text-white"
                  style={{
                    background: `linear-gradient(135deg, ${entry.team_color || "#22D1C3"}, ${entry.team_color || "#22D1C3"}80)`,
                  }}
                >
                  {(entry.display_name || entry.username || "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate">
                    {entry.display_name || entry.username}
                    {isMe && <span className="ml-2 text-[10px] text-primary">(Du)</span>}
                  </div>
                  <div className="text-[10px] text-white/40">Lv.{entry.level || 1}</div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-black text-xp">{(entry.xp || 0).toLocaleString()}</span>
                  <span className="text-xs">⚡</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Crew Tab
   ═══════════════════════════════════════════════════════════ */

function CrewTab({
  profile: p,
  myCrew,
  setMyCrew,
  setProfile,
}: {
  profile: Profile | null;
  myCrew: Crew | null;
  setMyCrew: (c: Crew | null) => void;
  setProfile: (p: Profile) => void;
}) {
  const supabase = createClient();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newZip, setNewZip] = useState("");
  const [newColor, setNewColor] = useState<string>(CREW_COLORS[0]);
  const [error, setError] = useState("");

  async function handleCreate() {
    setError("");
    if (!newName.trim() || !newZip.trim()) {
      setError("Name und PLZ erforderlich");
      return;
    }
    if (!p) return;

    const { data, error: createErr } = await supabase
      .from("crews")
      .insert({
        name: newName.trim(),
        zip: newZip.trim(),
        color: newColor,
        owner_id: p.id,
        faction: p.faction || "syndicate",
      })
      .select()
      .single();

    if (createErr) {
      setError(createErr.message);
      return;
    }

    // Add self as admin member
    await supabase.from("crew_members").insert({
      crew_id: data.id,
      user_id: p.id,
      role: "admin",
    });

    // Update user with current_crew_id + team_color
    await supabase
      .from("users")
      .update({ current_crew_id: data.id, team_color: newColor })
      .eq("id", p.id);

    setMyCrew(data);
    setProfile({ ...p, current_crew_id: data.id, team_color: newColor });
    setCreating(false);
  }

  async function handleLeave() {
    if (!p || !myCrew) return;
    if (!confirm(`"${myCrew.name}" wirklich verlassen?`)) return;

    await supabase.from("crew_members").delete().eq("crew_id", myCrew.id).eq("user_id", p.id);

    // If owner, delete crew
    if (myCrew.owner_id === p.id) {
      await supabase.from("crews").delete().eq("id", myCrew.id);
    }

    await supabase.from("users").update({ current_crew_id: null }).eq("id", p.id);

    setMyCrew(null);
    setProfile({ ...p, current_crew_id: null });
  }

  return (
    <>
      {/* Faction Battle Header */}
      <div className="p-6 pb-8" style={{ background: "linear-gradient(180deg, #141820, #0B0E13)" }}>
        <h2 className="text-xl font-black text-center">Fraktions-Macht</h2>
        <p className="text-[11px] text-white/40 text-center mt-1 mb-5">Stadtweite Kontrolle</p>

        <div className="flex items-center justify-around mb-3">
          <div className="text-center">
            <div className="text-base font-black" style={{ color: FACTIONS[0].color }}>
              {FACTIONS[0].name}
            </div>
            <div className="text-xs text-white/50 mt-1">{FACTIONS[0].power.toLocaleString()} ⚡</div>
          </div>
          <div className="text-sm font-black text-white/30 px-3">VS</div>
          <div className="text-center">
            <div className="text-base font-black" style={{ color: FACTIONS[1].color }}>
              {FACTIONS[1].name}
            </div>
            <div className="text-xs text-white/50 mt-1">{FACTIONS[1].power.toLocaleString()} ⚡</div>
          </div>
        </div>

        <div className="flex h-2.5 rounded-full overflow-hidden">
          <div style={{ width: "47%", background: FACTIONS[0].color }} />
          <div style={{ width: "53%", background: FACTIONS[1].color }} />
        </div>
      </div>

      <div className="p-4 max-w-md mx-auto">
        {!myCrew && !creating && (
          <div className="p-6 rounded-2xl text-center" style={glassStyle}>
            <div className="text-4xl mb-3">🏃‍♂️🏃‍♀️</div>
            <h3 className="text-lg font-bold mb-1">Du bist ein Freelancer</h3>
            <p className="text-sm text-white/50 mb-5">
              Gründe deine eigene Crew oder schließe dich einer an, um gemeinsam zu erobern.
            </p>
            <button
              onClick={() => setCreating(true)}
              className="w-full py-3 rounded-xl font-bold text-bg mb-2"
              style={{ background: "linear-gradient(135deg, #22D1C3, #1AB5A8)" }}
            >
              Eigene Crew gründen
            </button>
            <button className="w-full py-3 rounded-xl font-bold text-primary border border-primary/30">
              Einladungscode eingeben
            </button>
          </div>
        )}

        {!myCrew && creating && (
          <div className="p-5 rounded-2xl space-y-3" style={glassStyle}>
            <h3 className="text-lg font-black">Neue Crew gründen</h3>

            <div>
              <label className="text-[11px] font-bold text-primary uppercase tracking-wider">Crew-Name</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="z.B. Kiez Läufer"
                className="w-full mt-1 px-4 py-2.5 rounded-lg bg-bg-elevated border border-border text-sm focus:outline-none focus:border-primary/50"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-primary uppercase tracking-wider">Einsatzgebiet (PLZ)</label>
              <input
                value={newZip}
                onChange={(e) => setNewZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                placeholder="z.B. 13435"
                className="w-full mt-1 px-4 py-2.5 rounded-lg bg-bg-elevated border border-border text-sm focus:outline-none focus:border-primary/50"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-primary uppercase tracking-wider">Crew-Farbe</label>
              <div className="flex gap-2 mt-2">
                {CREW_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className="w-10 h-10 rounded-full transition-transform active:scale-95"
                    style={{
                      background: c,
                      border: newColor === c ? "3px solid white" : "none",
                      boxShadow: newColor === c ? `0 0 16px ${c}80` : "none",
                    }}
                  />
                ))}
              </div>
            </div>

            {error && <p className="text-xs text-danger text-center">{error}</p>}

            <button
              onClick={handleCreate}
              className="w-full py-3 rounded-xl font-bold text-bg mt-2"
              style={{ background: `linear-gradient(135deg, ${newColor}, ${newColor}cc)` }}
            >
              Crew registrieren
            </button>
            <button onClick={() => setCreating(false)} className="w-full py-2 text-sm text-white/50">
              Abbrechen
            </button>
          </div>
        )}

        {myCrew && (
          <div className="space-y-4">
            <div className="p-5 rounded-2xl" style={{ ...glassStyle, borderTop: `4px solid ${myCrew.color}` }}>
              <h3 className="text-2xl font-black">{myCrew.name}</h3>
              <p className="text-sm text-white/50 mt-1">Revier: {myCrew.zip}</p>
              <div className="flex items-center gap-2 mt-3 px-3 py-1.5 rounded-full bg-white/5 w-fit">
                <span className="text-xs text-white/50">Code:</span>
                <span className="text-xs font-mono font-bold text-primary">{myCrew.invite_code}</span>
              </div>
            </div>

            <button
              onClick={() => navigator.clipboard.writeText(myCrew.invite_code)}
              className="w-full py-3 rounded-xl font-bold text-bg"
              style={{ background: `linear-gradient(135deg, ${myCrew.color}, ${myCrew.color}cc)` }}
            >
              + Einladungscode kopieren
            </button>

            <div className="pt-4">
              <button onClick={handleLeave} className="w-full py-2 text-sm text-accent underline">
                Crew {myCrew.owner_id === p?.id ? "auflösen" : "verlassen"}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   Shops Tab (Platzhalter bis Vertragspartner da sind)
   ═══════════════════════════════════════════════════════════ */

function ShopsTab() {
  return (
    <div className="max-w-md mx-auto space-y-3 pb-4">
      <h2 className="text-2xl font-black flex items-center gap-2">🏪 Lokale Geschäfte</h2>
      <p className="text-xs text-white/40">XP gegen echte Rabatte</p>

      <div className="p-6 rounded-2xl text-center mt-4" style={glassStyle}>
        <div className="text-4xl mb-3">🎁💰</div>
        <h3 className="text-lg font-bold mb-1">Bald verfügbar</h3>
        <p className="text-sm text-white/50 mb-4">
          Wir suchen gerade lokale Partner in deiner Stadt. Sobald die ersten dabei sind, kannst du hier deine XP gegen echte Rabatte einlösen.
        </p>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/30 text-xs text-accent font-semibold">
          Coming soon
        </div>
      </div>

      <div className="p-4 rounded-2xl mt-3" style={glassStyle}>
        <h4 className="text-sm font-bold mb-2">Du hast ein Geschäft?</h4>
        <p className="text-xs text-white/50 mb-3">
          Bringe Läufer zu deiner Tür – Pay-per-Visit ab 0,50 €. Keine Flyer, kein Blindschuss.
        </p>
        <button className="w-full py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm font-semibold">
          Als Partner bewerben
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Profil Tab
   ═══════════════════════════════════════════════════════════ */

function ProfilTab({
  profile: p,
  equippedMarker,
  setEquippedMarker,
  territoryCount,
  currentStreet,
  walking,
  myCrew,
  onLogout,
  currentRank,
  nextRank,
}: {
  profile: Profile | null;
  equippedMarker: string;
  setEquippedMarker: (s: string) => void;
  territoryCount: number;
  currentStreet: string | null;
  walking: boolean;
  myCrew: Crew | null;
  onLogout: () => void;
  currentRank: { name: string; color: string; minXp: number };
  nextRank: { name: string; color: string; minXp: number } | null;
}) {
  const userXp = p?.xp || 0;
  const xpToNext = nextRank ? nextRank.minXp - userXp : 0;
  const pctToNext = nextRank ? ((userXp - currentRank.minXp) / (nextRank.minXp - currentRank.minXp)) * 100 : 100;

  return (
    <div className="max-w-md mx-auto space-y-4 pb-4">
      {/* Header */}
      <div className="flex flex-col items-center text-center pt-2">
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center text-5xl mb-3"
          style={{
            background: "#141820",
            border: `4px solid ${currentRank.color}`,
            boxShadow: `0 0 30px ${currentRank.color}40`,
          }}
        >
          {equippedMarker}
        </div>
        <div className="text-[10px] font-black text-white/40 tracking-[0.2em]">RUNNER NAME</div>
        <div className="text-2xl font-black">{p?.display_name || p?.username || "Eroberer"}</div>
        <div
          className="mt-2 px-4 py-1.5 rounded-full text-xs font-black text-bg"
          style={{ background: currentRank.color }}
        >
          {currentRank.name} · {userXp.toLocaleString()} XP
        </div>

        {/* XP Progress to next rank */}
        {nextRank && (
          <div className="w-full max-w-xs mt-4">
            <div className="flex items-center justify-between text-[10px] text-white/40 mb-1">
              <span>→ {nextRank.name}</span>
              <span>{xpToNext.toLocaleString()} XP</span>
            </div>
            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${pctToNext}%`,
                  background: `linear-gradient(90deg, ${currentRank.color}, ${nextRank.color})`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Map Icons */}
      <Section title="DEINE MAP-ICONS">
        <div className="grid grid-cols-4 gap-2">
          {UNLOCKABLE_MARKERS.map((m) => {
            const unlocked = userXp >= m.cost;
            const equipped = equippedMarker === m.icon;
            return (
              <button
                key={m.id}
                onClick={() =>
                  unlocked ? setEquippedMarker(m.icon) : alert(`🔒 Gesperrt: ${m.cost} XP benötigt`)
                }
                className="p-2.5 rounded-xl text-center transition-all active:scale-95"
                style={{
                  background: equipped ? "rgba(34,209,195,0.15)" : "rgba(255,255,255,0.03)",
                  border: equipped ? "2px solid #22D1C3" : "1px solid rgba(255,255,255,0.05)",
                  opacity: unlocked ? 1 : 0.35,
                }}
              >
                <div className="text-2xl mb-1">{unlocked ? m.icon : "🔒"}</div>
                <div className="text-[9px] font-bold">{m.name}</div>
                {!unlocked && <div className="text-[8px] text-white/40 mt-0.5">{m.cost.toLocaleString()} XP</div>}
                {equipped && <div className="text-[8px] text-primary font-bold mt-0.5">AKTIV</div>}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Crew */}
      <Section title="DEINE CREW">
        <div className="flex items-center gap-3 p-4 rounded-2xl" style={glassStyle}>
          <div
            className="w-3 h-12 rounded-full"
            style={{ background: myCrew?.color || "#333" }}
          />
          <div className="flex-1">
            <div className="text-base font-bold">{myCrew ? myCrew.name : "Keine Crew"}</div>
            <div className="text-xs text-white/40 mt-0.5">
              {myCrew ? `PLZ ${myCrew.zip}` : "Werde jetzt aktiv!"}
            </div>
          </div>
        </div>
      </Section>

      {/* Live Status */}
      <Section title="LIVE STATUS">
        <div
          className="p-4 rounded-2xl"
          style={{
            ...glassStyle,
            border: walking ? `1px solid ${currentRank.color}40` : glassStyle.border,
          }}
        >
          <div className="text-xs text-white/50">Aktueller Straßenzug</div>
          <div
            className="text-base font-bold mt-1"
            style={{ color: walking ? currentRank.color : "rgba(255,255,255,0.3)" }}
          >
            {walking ? currentStreet || "Wird ermittelt..." : "Kein aktiver Lauf"}
          </div>
        </div>
      </Section>

      {/* Territorium */}
      <Section title="DEIN TERRITORIUM">
        <div className="p-4 rounded-2xl flex items-center justify-between" style={glassStyle}>
          <span className="text-sm text-white/70">Gewonnene Straßenzüge</span>
          <span className="text-3xl font-black" style={{ color: currentRank.color }}>
            {territoryCount}
          </span>
        </div>
      </Section>

      {/* Gesundheitsdaten */}
      <Section title="GESUNDHEITSDATEN">
        <div className="grid grid-cols-2 gap-3">
          <StatBox emoji="👣" label="KM Gesamt" value={((p?.total_distance_m || 0) / 1000).toFixed(1)} />
          <StatBox emoji="🔥" label="KCAL" value={`${p?.total_calories || 0}`} />
          <StatBox emoji="🏃" label="Walks" value={`${p?.total_walks || 0}`} />
          <StatBox emoji="⚡" label="Streak" value={`${p?.streak_days || 0}d`} />
        </div>
      </Section>

      {/* Einstellungen */}
      <Section title="EINSTELLUNGEN">
        <button
          onClick={onLogout}
          className="w-full p-4 rounded-2xl text-left flex items-center gap-3 text-accent font-semibold"
          style={glassStyle}
        >
          <span>🚪</span>
          <span>Ausloggen</span>
        </button>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-black text-primary tracking-[0.2em] mb-2 px-1">{title}</div>
      {children}
    </div>
  );
}

function StatBox({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <div className="p-4 rounded-2xl" style={glassStyle}>
      <div className="text-xl mb-1">{emoji}</div>
      <div className="text-xl font-black">{value}</div>
      <div className="text-[10px] text-white/40 uppercase tracking-wider">{label}</div>
    </div>
  );
}
