"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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
  RUNNER_LIGHTS,
  CREW_COLORS,
  XP_PER_TERRITORY,
  MIN_ROUTE_POINTS,
  UNITS,
  LANGUAGES,
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

interface Territory {
  id: string;
  street_name: string | null;
  distance_m: number;
  duration_s: number;
  xp_earned: number;
  created_at: string;
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

interface Coord { lat: number; lng: number; }

type TabId = "profil" | "map" | "crew" | "shops" | "ranking";

/* ═══════════════════════════════════════════════════════
 * 1:1 Farb-Konstanten aus alter App (styles.ts)
 * ═══════════════════════════════════════════════════════ */
const BG = "#0F1115";
const CARD = "#16181D";
const BORDER = "#2A2A2A";
const MUTED = "#888";
const TEXT_SOFT = "#BBB";
const PRIMARY = "#5ddaf0";
const ACCENT = "#ef7169";

export function MapDashboard({ profile: initialProfile }: { profile: Profile | null }) {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [activeTab, setActiveTab] = useState<TabId>("map");
  const [equippedMarker, setEquippedMarker] = useState(initialProfile?.equipped_marker_id || "foot");
  const [equippedLight, setEquippedLight] = useState(initialProfile?.equipped_light_id || "classic");
  const [recentRuns, setRecentRuns] = useState<Territory[]>([]);

  // Walk state
  const [walking, setWalking] = useState(false);
  const [distance, setDistance] = useState(0);
  const [elapsed, setElapsed] = useState(0);
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

  // Load recent runs when profile changes
  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data } = await supabase
        .from("territories")
        .select("id, street_name, distance_m, duration_s, xp_earned, created_at")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (data) setRecentRuns(data as Territory[]);
    })();
  }, [profile?.id]);

  // Load crew + territories
  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { count } = await supabase
        .from("territories")
        .select("*", { count: "exact", head: true })
        .eq("user_id", profile.id);
      setTerritoryCount(count || 0);

      const { data: terrData } = await supabase
        .from("territories")
        .select("route")
        .eq("user_id", profile.id)
        .limit(50);
      if (terrData) setSavedTerritories(terrData.map((t: { route: Coord[] }) => t.route));

      if (profile.current_crew_id) {
        const { data: crewData } = await supabase
          .from("crews").select("*").eq("id", profile.current_crew_id).single();
        if (crewData) setMyCrew(crewData);
      }
    })();
  }, [profile?.id, profile?.current_crew_id]);

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
      alert("Lauf zu kurz! Du musst dich etwas mehr bewegen.");
      setActiveRoute([]);
      setCurrentStreet(null);
      return;
    }

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
        const newXp = (profile.xp || 0) + XP_PER_TERRITORY;
        const newDistance = (profile.total_distance_m || 0) + Math.round(distance);
        const newWalks = (profile.total_walks || 0) + 1;
        const newCal = (profile.total_calories || 0) + Math.round(distance * 0.06);

        await supabase.from("users").update({
          xp: newXp,
          total_distance_m: newDistance,
          total_walks: newWalks,
          total_calories: newCal,
        }).eq("id", profile.id);

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

  const clearMap = () => {
    if (!confirm("Karte wirklich leeren?")) return;
    setSavedTerritories([]);
    setActiveRoute([]);
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

      if (now - lastGeoRef.current > 5000) {
        lastGeoRef.current = now;
        reverseGeocode(lat, lng).then(setCurrentStreet);
      }
    },
    [walking]
  );

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const p = profile;
  const currentRank = getCurrentRank(p?.xp || 0);
  const teamColor = myCrew?.color || p?.team_color || PRIMARY;

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: BG }}>
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>

        {/* ══ MAP TAB ══ */}
        {activeTab === "map" && (
          <>
            <AppMap
              onLocationUpdate={onLocationUpdate}
              trackingActive={walking}
              teamColor={teamColor}
              username={p?.display_name || p?.username || "Ich"}
              markerId={equippedMarker}
              lightId={equippedLight}
              activeRoute={activeRoute}
              savedTerritories={savedTerritories}
            />

            {/* cheatContainer: top 50 right 20 */}
            {!walking && (
              <div style={{ position: "absolute", top: 20, right: 20, zIndex: 50 }}>
                <button
                  onClick={clearMap}
                  style={{
                    background: BORDER,
                    padding: "12px 16px",
                    borderRadius: 20,
                    border: `1px solid ${ACCENT}`,
                    color: ACCENT,
                    fontSize: 12,
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  🗑 Karte leeren
                </button>
              </div>
            )}

            {/* mapActionOverlay: bottom 30 */}
            <div style={{ position: "absolute", bottom: 30, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", zIndex: 50, pointerEvents: "none" }}>
              {walking && currentStreet && (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  background: "rgba(0,0,0,0.8)",
                  padding: "12px 20px",
                  borderRadius: 25,
                  border: `1px solid ${teamColor}`,
                  marginBottom: 15,
                }}>
                  <span style={{ color: "#FFF", fontWeight: "bold", fontSize: 14 }}>📍 {currentStreet}</span>
                  <span style={{ marginLeft: 10, color: "#FFF" }}>⏳</span>
                </div>
              )}
              <button
                onClick={walking ? stopWalk : startWalk}
                style={{
                  background: walking ? ACCENT : teamColor,
                  padding: "18px 40px",
                  borderRadius: 35,
                  border: "none",
                  color: BG,
                  fontWeight: "bold",
                  fontSize: 16,
                  cursor: "pointer",
                  boxShadow: "0 4px 5px rgba(0,0,0,0.3)",
                  pointerEvents: "auto",
                }}
              >
                {walking ? "Eroberung abschließen" : "Eroberung starten"}
              </button>
            </div>
          </>
        )}

        {/* ══ PROFIL TAB ══ */}
        {activeTab === "profil" && (
          <div style={{ height: "100%", overflowY: "auto" }}>
            <ProfilTab
              profile={p}
              setProfile={setProfile}
              equippedMarker={equippedMarker}
              setEquippedMarker={setEquippedMarker}
              equippedLight={equippedLight}
              setEquippedLight={setEquippedLight}
              recentRuns={recentRuns}
              territoryCount={territoryCount}
              currentStreet={currentStreet}
              walking={walking}
              myCrew={myCrew}
              onLogout={handleLogout}
              currentRank={currentRank}
            />
          </div>
        )}

        {/* ══ CREW TAB ══ */}
        {activeTab === "crew" && (
          <div style={{ height: "100%", overflowY: "auto" }}>
            <CrewTab profile={p} myCrew={myCrew} setMyCrew={setMyCrew} setProfile={setProfile} />
          </div>
        )}

        {/* ══ SHOPS TAB ══ */}
        {activeTab === "shops" && (
          <div style={{ height: "100%", overflowY: "auto" }}>
            <ShopsTab />
          </div>
        )}

        {/* ══ RANKING TAB ══ */}
        {activeTab === "ranking" && (
          <div style={{ height: "100%", overflowY: "auto" }}>
            <RankingTab profile={p} leaderboard={leaderboard} />
          </div>
        )}
      </div>

      {/* ══ BOTTOM NAV ══ */}
      <div style={{
        display: "flex",
        flexDirection: "row",
        background: "#1C1F26",
        paddingBottom: 20,
        paddingTop: 12,
        borderTop: `1px solid #2A2E36`,
        boxShadow: "0 -4px 20px rgba(0,0,0,0.4)",
      }}>
        {[
          { id: "profil",  label: "Profil",  icon: "👤" },
          { id: "map",     label: "Karte",   icon: "🗺️" },
          { id: "crew",    label: "Crew",    icon: "👥" },
          { id: "shops",   label: "Shops",   icon: "🏪" },
          { id: "ranking", label: "Ranking", icon: "🏆" },
        ].map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabId)}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "6px 0",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                position: "relative",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {active && (
                <div style={{
                  position: "absolute",
                  top: -12,
                  left: "30%",
                  right: "30%",
                  height: 3,
                  borderRadius: 3,
                  background: PRIMARY,
                  boxShadow: `0 0 12px ${PRIMARY}`,
                }} />
              )}
              <span style={{
                fontSize: active ? 24 : 20,
                lineHeight: 1,
                filter: active ? "none" : "grayscale(0.5) opacity(0.6)",
                transition: "all 0.2s",
              }}>
                {tab.icon}
              </span>
              <span style={{
                color: active ? PRIMARY : MUTED,
                fontSize: 11,
                fontWeight: active ? "bold" : 600,
                textAlign: "center",
                letterSpacing: 0.3,
              }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
 * PROFIL TAB (1:1 alte App)
 * ═══════════════════════════════════════════════════════ */

function ProfilTab({
  profile: p,
  setProfile,
  equippedMarker,
  setEquippedMarker,
  equippedLight,
  setEquippedLight,
  recentRuns,
  territoryCount,
  currentStreet,
  walking,
  myCrew,
  onLogout,
  currentRank,
}: {
  profile: Profile | null;
  setProfile: (p: Profile) => void;
  equippedMarker: string;
  setEquippedMarker: (s: string) => void;
  equippedLight: string;
  setEquippedLight: (s: string) => void;
  recentRuns: Territory[];
  territoryCount: number;
  currentStreet: string | null;
  walking: boolean;
  myCrew: Crew | null;
  onLogout: () => void;
  currentRank: { name: string; color: string };
}) {
  const supabase = createClient();
  const userXp = p?.xp || 0;
  const teamColor = myCrew?.color || p?.team_color || PRIMARY;
  const nextRank = getNextRank(userXp);
  const xpToNext = nextRank ? nextRank.minXp - userXp : 0;
  const pctToNext = nextRank ? Math.round(((userXp - (currentRank as { minXp?: number }).minXp!) / (nextRank.minXp - (currentRank as { minXp?: number }).minXp!)) * 100) : 100;

  // Current marker icon
  const currentMarker = UNLOCKABLE_MARKERS.find((m) => m.id === equippedMarker) || UNLOCKABLE_MARKERS[0];
  const currentLight = RUNNER_LIGHTS.find((l) => l.id === equippedLight) || RUNNER_LIGHTS[0];

  const avgPace = p?.total_distance_m && p.total_distance_m > 0 && p.total_walks > 0
    ? ((p.total_walks * 60) / (p.total_distance_m / 1000)).toFixed(1)
    : "—";
  const longestKm = ((p?.longest_run_m || 0) / 1000).toFixed(1);

  const handleRewardedAd = () => {
    if (confirm("📺 Schau dir ein kurzes Video an, um sofort +250 XP zu erhalten!")) {
      alert("Danke! Du hast 250 XP erhalten! (Simulation)");
    }
  };

  async function equipMarker(id: string) {
    setEquippedMarker(id);
    if (p) await supabase.from("users").update({ equipped_marker_id: id }).eq("id", p.id);
  }

  async function equipLight(id: string) {
    setEquippedLight(id);
    if (p) await supabase.from("users").update({ equipped_light_id: id }).eq("id", p.id);
  }

  async function updateSetting(key: string, value: boolean | string) {
    if (!p) return;
    await supabase.from("users").update({ [key]: value }).eq("id", p.id);
    setProfile({ ...p, [key]: value } as Profile);
  }

  function fmtDuration(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}:${sec.toString().padStart(2, "0")} min` : `${sec}s`;
  }

  function fmtDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div style={{ background: BG, paddingBottom: 30 }}>
      {/* ═══ HEADER mit Gradient ═══ */}
      <div style={{
        background: `linear-gradient(180deg, ${currentRank.color}20 0%, ${BG} 100%)`,
        paddingTop: 40, paddingBottom: 30, paddingLeft: 20, paddingRight: 20,
      }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{
            width: 110, height: 110, borderRadius: 55,
            border: `4px solid ${teamColor}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "#22262E", marginBottom: 12,
            boxShadow: `0 0 40px ${currentRank.color}40`,
          }}>
            <span style={{ fontSize: 50 }}>{currentMarker.icon}</span>
          </div>
          <div style={{ fontSize: 10, color: MUTED, fontWeight: "bold", letterSpacing: 2 }}>RUNNER NAME</div>
          <div style={{ fontSize: 30, fontWeight: 900, color: "#FFF", marginTop: 4 }}>
            {p?.display_name || p?.username || "Eroberer"}
          </div>
          <div style={{ color: MUTED, fontSize: 13, marginTop: 2 }}>@{p?.username}</div>

          <div style={{
            marginTop: 12, paddingLeft: 16, paddingRight: 16, paddingTop: 7, paddingBottom: 7,
            borderRadius: 20, background: currentRank.color,
            boxShadow: `0 4px 20px ${currentRank.color}50`,
          }}>
            <span style={{ color: BG, fontWeight: 900, fontSize: 13 }}>
              {currentRank.name} · {userXp.toLocaleString()} XP
            </span>
          </div>

          {/* XP Progress */}
          {nextRank && (
            <div style={{ width: "100%", maxWidth: 360, marginTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: MUTED, marginBottom: 6 }}>
                <span>→ {nextRank.name}</span>
                <span>{xpToNext.toLocaleString()} XP</span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: "#22262E", overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${pctToNext}%`,
                  background: `linear-gradient(90deg, ${currentRank.color}, ${nextRank.color})`,
                  borderRadius: 4,
                }} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ paddingLeft: 20, paddingRight: 20 }}>

        {/* QUICK STATS ROW */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 6 }}>
          <QuickStat value={territoryCount.toString()} label="Territorien" color={teamColor} />
          <QuickStat value={(p?.total_walks || 0).toString()} label="Walks" color={PRIMARY} />
          <QuickStat value={((p?.total_distance_m || 0) / 1000).toFixed(1)} label="km" color={ACCENT} />
          <QuickStat value={(p?.streak_days || 0).toString()} label="Streak 🔥" color="#FFD700" />
        </div>

        {/* ═══ MAP-ICONS (10 Stück) ═══ */}
        <div style={{ width: "100%", marginTop: 25, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 12, color: PRIMARY, fontWeight: "bold", letterSpacing: 1.5 }}>DEINE MAP-ICONS</div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
              {UNLOCKABLE_MARKERS.filter(m => m.cost <= userXp).length} / {UNLOCKABLE_MARKERS.length} freigeschaltet
            </div>
          </div>
          <button
            onClick={handleRewardedAd}
            style={{
              background: "rgba(93, 218, 240, 0.1)",
              paddingTop: 8, paddingBottom: 8, paddingLeft: 14, paddingRight: 14,
              borderRadius: 15,
              border: `1px solid ${PRIMARY}`,
              display: "flex", alignItems: "center", gap: 6,
              cursor: "pointer",
            }}
          >
            <span>📺</span>
            <span style={{ color: PRIMARY, fontSize: 11, fontWeight: "bold" }}>+250 XP</span>
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "row", paddingTop: 10, paddingBottom: 10, overflowX: "auto", gap: 10 }}>
          {UNLOCKABLE_MARKERS.map((marker) => {
            const isUnlocked = userXp >= marker.cost;
            const isEquipped = equippedMarker === marker.id;
            return (
              <button
                key={marker.id}
                onClick={() => {
                  if (isUnlocked) equipMarker(marker.id);
                  else alert(`🔒 Du brauchst ${marker.cost.toLocaleString()} XP für "${marker.name}"`);
                }}
                style={{
                  background: isEquipped ? `${PRIMARY}15` : "#22262E",
                  padding: 14, borderRadius: 16,
                  display: "flex", flexDirection: "column", alignItems: "center",
                  minWidth: 90, maxWidth: 90,
                  border: isEquipped ? `2px solid ${PRIMARY}` : "1px solid #2A2E36",
                  cursor: "pointer",
                  flexShrink: 0,
                  boxShadow: isEquipped ? `0 0 20px ${PRIMARY}40` : "none",
                }}
              >
                <span style={{ fontSize: 32, marginBottom: 6, opacity: isUnlocked ? 1 : 0.25 }}>{marker.icon}</span>
                <span style={{ color: "#FFF", fontSize: 11, fontWeight: "bold", marginBottom: 4 }}>{marker.name}</span>
                {isUnlocked ? (
                  <span style={{ fontSize: 10, fontWeight: "bold", color: isEquipped ? PRIMARY : "#4ade80" }}>
                    {isEquipped ? "✓ AKTIV" : "Frei"}
                  </span>
                ) : (
                  <span style={{ fontSize: 9, fontWeight: "bold", color: ACCENT }}>🔒 {marker.cost >= 1000 ? `${marker.cost/1000}k` : marker.cost}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* ═══ RUNNER LIGHTS (10 Schweif-Varianten) ═══ */}
        <div style={{ width: "100%", marginTop: 25, marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: PRIMARY, fontWeight: "bold", letterSpacing: 1.5 }}>DEINE RUNNER LIGHTS</div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
            Schweif beim Laufen · {RUNNER_LIGHTS.filter(l => l.cost <= userXp).length} / {RUNNER_LIGHTS.length} freigeschaltet
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "row", paddingTop: 10, paddingBottom: 10, overflowX: "auto", gap: 10 }}>
          {RUNNER_LIGHTS.map((light) => {
            const isUnlocked = userXp >= light.cost;
            const isEquipped = equippedLight === light.id;
            const gradientCss = light.gradient.length > 1
              ? `linear-gradient(90deg, ${light.gradient.join(", ")})`
              : light.color;
            return (
              <button
                key={light.id}
                onClick={() => {
                  if (isUnlocked) equipLight(light.id);
                  else alert(`🔒 Du brauchst ${light.cost.toLocaleString()} XP für "${light.name}"`);
                }}
                style={{
                  background: isEquipped ? `${PRIMARY}15` : "#22262E",
                  padding: 14, borderRadius: 16,
                  display: "flex", flexDirection: "column", alignItems: "center",
                  minWidth: 100, maxWidth: 100,
                  border: isEquipped ? `2px solid ${PRIMARY}` : "1px solid #2A2E36",
                  cursor: "pointer",
                  flexShrink: 0,
                  boxShadow: isEquipped ? `0 0 20px ${PRIMARY}40` : "none",
                }}
              >
                <div style={{
                  width: 60, height: light.width,
                  borderRadius: light.width / 2,
                  background: gradientCss,
                  opacity: isUnlocked ? 1 : 0.3,
                  marginBottom: 8, marginTop: 8,
                  boxShadow: isUnlocked ? `0 0 12px ${light.color}80` : "none",
                }} />
                <span style={{ color: "#FFF", fontSize: 11, fontWeight: "bold", marginBottom: 4 }}>{light.name}</span>
                {isUnlocked ? (
                  <span style={{ fontSize: 10, fontWeight: "bold", color: isEquipped ? PRIMARY : "#4ade80" }}>
                    {isEquipped ? "✓ AKTIV" : "Frei"}
                  </span>
                ) : (
                  <span style={{ fontSize: 9, fontWeight: "bold", color: ACCENT }}>🔒 {light.cost >= 1000 ? `${light.cost/1000}k` : light.cost}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* ═══ DEINE CREW ═══ */}
        <SectionHeader title="DEINE CREW" />
        <div style={{
          display: "flex", flexDirection: "row", background: "#22262E",
          padding: 20, borderRadius: 18, alignItems: "center",
        }}>
          <div style={{ width: 22, height: 44, borderRadius: 11, marginRight: 15, background: myCrew?.color || "#333" }} />
          <div style={{ flex: 1 }}>
            <div style={{ color: "#FFF", fontSize: 18, fontWeight: "bold" }}>
              {myCrew ? myCrew.name : "Keine Crew"}
            </div>
            <div style={{ color: MUTED, fontSize: 12, marginTop: 4 }}>
              {myCrew ? `Revier: PLZ ${myCrew.zip}` : "Werde jetzt aktiv!"}
            </div>
          </div>
          {myCrew && (
            <div style={{
              padding: "4px 10px", borderRadius: 12,
              background: `${myCrew.color}20`, border: `1px solid ${myCrew.color}40`,
            }}>
              <span style={{ color: myCrew.color, fontSize: 10, fontWeight: "bold" }}>
                {p?.faction === "vanguard" ? "VANGUARD" : "SYNDICATE"}
              </span>
            </div>
          )}
        </div>

        {/* ═══ LIVE STATUS ═══ */}
        <SectionHeader title="LIVE STATUS" />
        <div style={{
          background: walking ? `${teamColor}15` : "#22262E",
          padding: 20, borderRadius: 18, width: "100%",
          border: walking ? `1px solid ${teamColor}` : "1px solid #2A2E36",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <div style={{
              width: 8, height: 8, borderRadius: 4,
              background: walking ? "#4ade80" : MUTED,
              boxShadow: walking ? "0 0 8px #4ade80" : "none",
            }} />
            <span style={{ color: TEXT_SOFT, fontSize: 13 }}>
              {walking ? "Läuft gerade" : "Kein aktiver Lauf"}
            </span>
          </div>
          <div style={{
            fontSize: 18, fontWeight: "bold",
            color: walking ? teamColor : MUTED,
          }}>
            {walking ? currentStreet || "Suche Position..." : "Klicke auf Karte, um zu starten"}
          </div>
        </div>

        {/* ═══ LETZTE RUNS ═══ */}
        <SectionHeader title="LETZTE RUNS" />
        {recentRuns.length === 0 ? (
          <div style={{ background: "#22262E", padding: 20, borderRadius: 18, textAlign: "center", color: MUTED, border: "1px solid #2A2E36" }}>
            Noch keine Runs. Starte deine erste Eroberung auf der Karte!
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {recentRuns.map((run) => (
              <div key={run.id} style={{
                background: "#22262E", padding: 16, borderRadius: 16,
                display: "flex", alignItems: "center", gap: 14,
                border: "1px solid #2A2E36",
              }}>
                <div style={{
                  width: 46, height: 46, borderRadius: 23,
                  background: `${teamColor}20`, border: `1px solid ${teamColor}40`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <span style={{ fontSize: 22 }}>🏁</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#FFF", fontSize: 14, fontWeight: "bold", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {run.street_name || "Unbekannter Weg"}
                  </div>
                  <div style={{ color: MUTED, fontSize: 11, marginTop: 3 }}>
                    {fmtDate(run.created_at)} · {(run.distance_m / 1000).toFixed(2)} km · {fmtDuration(run.duration_s)}
                  </div>
                </div>
                <div style={{ color: PRIMARY, fontSize: 13, fontWeight: "bold" }}>+{run.xp_earned}</div>
              </div>
            ))}
          </div>
        )}

        {/* ═══ GESUNDHEITSDATEN ═══ */}
        <SectionHeader title="GESUNDHEITSDATEN" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <StatBox emoji="👣" value={((p?.total_distance_m || 0) / 1000).toFixed(1)} label="KM Gesamt" />
          <StatBox emoji="🔥" value={(p?.total_calories || 0).toLocaleString()} label="KCAL Verbrannt" />
          <StatBox emoji="🏃" value={(p?.total_walks || 0).toString()} label="Walks" />
          <StatBox emoji="⚡" value={`${p?.streak_days || 0} Tage`} label="Aktuelle Streak" />
          <StatBox emoji="🏆" value={`${p?.streak_best || 0} Tage`} label="Beste Streak" />
          <StatBox emoji="📏" value={`${longestKm} km`} label="Längster Run" />
          <StatBox emoji="⏱" value={avgPace + "'"} label="Ø Pace/km" />
          <StatBox emoji="🎯" value={territoryCount.toString()} label="Territorien" />
        </div>

        {/* ═══ EINSTELLUNGEN ═══ */}
        <SectionHeader title="EINSTELLUNGEN" />
        <div style={{ background: "#22262E", borderRadius: 18, width: "100%", overflow: "hidden", border: "1px solid #2A2E36" }}>
          <SettingRow label="🔔 Benachrichtigungen" checked={p?.setting_notifications ?? true} onChange={(v) => updateSetting("setting_notifications", v)} />
          <SettingRow label="🔊 Sound-Effekte" checked={p?.setting_sound ?? true} onChange={(v) => updateSetting("setting_sound", v)} />
          <SettingRow label="⏸ Auto-Pause bei Stillstand" checked={p?.setting_auto_pause ?? true} onChange={(v) => updateSetting("setting_auto_pause", v)} />
          <SettingRow label="🌍 Öffentliches Profil" checked={p?.setting_privacy_public ?? true} onChange={(v) => updateSetting("setting_privacy_public", v)} />

          <SettingSelect
            label="📏 Einheiten"
            value={p?.setting_units || "metric"}
            options={UNITS.map(u => ({ id: u.id, label: u.label }))}
            onChange={(v) => updateSetting("setting_units", v)}
          />
          <SettingSelect
            label="🌐 Sprache"
            value={p?.setting_language || "de"}
            options={LANGUAGES.map(l => ({ id: l.id, label: l.label }))}
            onChange={(v) => updateSetting("setting_language", v)}
            last
          />
        </div>

        {/* ═══ ACCOUNT ═══ */}
        <SectionHeader title="ACCOUNT" />
        <div style={{ background: "#22262E", borderRadius: 18, width: "100%", overflow: "hidden", border: "1px solid #2A2E36" }}>
          <button
            onClick={() => alert("Profil bearbeiten – kommt bald")}
            style={{
              width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
              paddingTop: 16, paddingBottom: 16, paddingLeft: 20, paddingRight: 20,
              background: "transparent", border: "none", cursor: "pointer", textAlign: "left",
              borderBottom: "1px solid #2A2E36",
            }}
          >
            <span style={{ color: "#FFF", fontSize: 15 }}>✏️ Profil bearbeiten</span>
            <span style={{ color: MUTED }}>›</span>
          </button>
          <button
            onClick={() => alert("Privatsphäre – kommt bald")}
            style={{
              width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
              paddingTop: 16, paddingBottom: 16, paddingLeft: 20, paddingRight: 20,
              background: "transparent", border: "none", cursor: "pointer", textAlign: "left",
              borderBottom: "1px solid #2A2E36",
            }}
          >
            <span style={{ color: "#FFF", fontSize: 15 }}>🔒 Privatsphäre & Daten</span>
            <span style={{ color: MUTED }}>›</span>
          </button>
          <button
            onClick={() => alert("Hilfe – kommt bald")}
            style={{
              width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
              paddingTop: 16, paddingBottom: 16, paddingLeft: 20, paddingRight: 20,
              background: "transparent", border: "none", cursor: "pointer", textAlign: "left",
              borderBottom: "1px solid #2A2E36",
            }}
          >
            <span style={{ color: "#FFF", fontSize: 15 }}>❓ Hilfe & Support</span>
            <span style={{ color: MUTED }}>›</span>
          </button>
          <button
            onClick={onLogout}
            style={{
              width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
              paddingTop: 16, paddingBottom: 16, paddingLeft: 20, paddingRight: 20,
              background: "transparent", border: "none", cursor: "pointer", textAlign: "left",
            }}
          >
            <span style={{ color: ACCENT, fontSize: 15, fontWeight: "bold" }}>🚪 Ausloggen</span>
          </button>
        </div>

        <div style={{ textAlign: "center", color: MUTED, fontSize: 11, marginTop: 20 }}>
          MyArea365 · v0.1 · Made with ❤️ in Berlin
        </div>
      </div>
    </div>
  );
}

function QuickStat({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div style={{
      background: "#22262E", padding: "14px 8px", borderRadius: 14,
      display: "flex", flexDirection: "column", alignItems: "center",
      border: "1px solid #2A2E36",
    }}>
      <span style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 10, color: MUTED, marginTop: 4, textAlign: "center" }}>{label}</span>
    </div>
  );
}

function StatBox({ emoji, value, label }: { emoji: string; value: string; label: string }) {
  return (
    <div style={{ background: "#22262E", padding: 18, borderRadius: 16, border: "1px solid #2A2E36" }}>
      <div style={{ fontSize: 22, marginBottom: 6 }}>{emoji}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: "#FFF" }}>{value}</div>
      <div style={{ fontSize: 10, color: MUTED, marginTop: 4, letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}

function SettingRow({ label, checked, onChange, last }: { label: string; checked: boolean; onChange: (v: boolean) => void; last?: boolean }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      paddingTop: 16, paddingBottom: 16, paddingLeft: 20, paddingRight: 20,
      borderBottom: last ? "none" : "1px solid #2A2E36",
    }}>
      <span style={{ color: "#FFF", fontSize: 15 }}>{label}</span>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: 44, height: 26, borderRadius: 13,
          background: checked ? PRIMARY : "#2A2E36",
          border: "none", cursor: "pointer",
          position: "relative", transition: "background 0.2s",
        }}
      >
        <div style={{
          position: "absolute", top: 3, left: checked ? 22 : 3,
          width: 20, height: 20, borderRadius: 10,
          background: "#FFF", transition: "left 0.2s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        }} />
      </button>
    </div>
  );
}

function SettingSelect({ label, value, options, onChange, last }: { label: string; value: string; options: { id: string; label: string }[]; onChange: (v: string) => void; last?: boolean }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      paddingTop: 16, paddingBottom: 16, paddingLeft: 20, paddingRight: 20,
      borderBottom: last ? "none" : "1px solid #2A2E36",
    }}>
      <span style={{ color: "#FFF", fontSize: 15 }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: "#2A2E36", color: "#FFF", border: "none",
          padding: "6px 12px", borderRadius: 8, fontSize: 13,
          cursor: "pointer",
        }}
      >
        {options.map((o) => (
          <option key={o.id} value={o.id} style={{ background: "#2A2E36" }}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{ width: "100%", marginBottom: 10, marginTop: 25 }}>
      <div style={{ fontSize: 12, color: PRIMARY, fontWeight: "bold", letterSpacing: 1.5 }}>{title}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
 * CREW TAB (1:1 alte App – Fraktions-Header + Gründen + Dashboard)
 * ═══════════════════════════════════════════════════════ */

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

  async function handleCreate() {
    if (!newName.trim() || !newZip.trim()) return alert("Bitte Name und PLZ eingeben");
    if (!p) return;

    const { data, error } = await supabase.from("crews").insert({
      name: newName.trim(), zip: newZip.trim(), color: newColor,
      owner_id: p.id, faction: p.faction || "syndicate",
    }).select().single();

    if (error) return alert(error.message);

    await supabase.from("crew_members").insert({ crew_id: data.id, user_id: p.id, role: "admin" });
    await supabase.from("users").update({ current_crew_id: data.id, team_color: newColor }).eq("id", p.id);

    setMyCrew(data);
    setProfile({ ...p, current_crew_id: data.id, team_color: newColor });
    setCreating(false);
    alert(`✅ Crew "${newName}" gegründet!`);
  }

  async function handleLeave() {
    if (!p || !myCrew) return;
    if (!confirm(`"${myCrew.name}" wirklich verlassen/auflösen?`)) return;

    await supabase.from("crew_members").delete().eq("crew_id", myCrew.id).eq("user_id", p.id);
    if (myCrew.owner_id === p.id) {
      await supabase.from("crews").delete().eq("id", myCrew.id);
    }
    await supabase.from("users").update({ current_crew_id: null }).eq("id", p.id);

    setMyCrew(null);
    setProfile({ ...p, current_crew_id: null });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 40 }}>
      {/* factionWarHeader */}
      <div style={{
        padding: 30, paddingTop: 50, background: CARD,
        display: "flex", flexDirection: "column", alignItems: "center",
        borderBottom: `1px solid ${BORDER}`, width: "100%",
      }}>
        <div style={{ fontSize: 24, color: "#FFF", fontWeight: "bold" }}>Fraktions-Macht</div>
        <div style={{ color: MUTED, marginTop: 5, marginBottom: 20 }}>Stadtweite Kontrolle</div>
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", width: "100%", justifyContent: "space-between", marginBottom: 15 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: "bold", color: FACTIONS[0].color, textAlign: "center" }}>{FACTIONS[0].name}</div>
            <div style={{ color: MUTED, fontSize: 14, marginTop: 4 }}>{FACTIONS[0].power.toLocaleString()} ⚡</div>
          </div>
          <div style={{ color: MUTED, fontWeight: 900, fontSize: 20, paddingLeft: 15, paddingRight: 15 }}>VS</div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: "bold", color: FACTIONS[1].color, textAlign: "center" }}>{FACTIONS[1].name}</div>
            <div style={{ color: MUTED, fontSize: 14, marginTop: 4 }}>{FACTIONS[1].power.toLocaleString()} ⚡</div>
          </div>
        </div>
        <div style={{ width: "100%", height: 12, borderRadius: 6, display: "flex", flexDirection: "row", overflow: "hidden" }}>
          <div style={{ width: "47%", height: "100%", background: FACTIONS[0].color }} />
          <div style={{ width: "53%", height: "100%", background: FACTIONS[1].color }} />
        </div>
      </div>

      {/* Content */}
      <div style={{ paddingLeft: 20, paddingRight: 20, paddingTop: 30, width: "100%", maxWidth: 500 }}>
        {!myCrew && !creating && (
          <div style={{ background: CARD, padding: 25, borderRadius: 20, display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
            <div style={{ color: "#FFF", fontSize: 20, fontWeight: "bold", marginBottom: 10 }}>Du bist ein Freelancer</div>
            <div style={{ color: MUTED, textAlign: "center", marginBottom: 25, lineHeight: "22px" }}>
              Schließe dich einer Crew an oder gründe dein eigenes lokales Team, um gemeinsam Gebiete zu erobern.
            </div>
            <button
              onClick={() => setCreating(true)}
              style={{
                padding: "18px 40px", borderRadius: 35,
                background: PRIMARY, width: "100%", marginBottom: 15,
                color: BG, fontWeight: "bold", fontSize: 16,
                border: "none", cursor: "pointer",
              }}
            >
              Eigene Crew gründen
            </button>
            <button
              style={{
                padding: "18px 40px", borderRadius: 35,
                background: BORDER, width: "100%",
                color: PRIMARY, fontWeight: "bold", fontSize: 16,
                border: `1px solid ${PRIMARY}`, cursor: "pointer",
              }}
            >
              Einladungscode eingeben
            </button>
          </div>
        )}

        {!myCrew && creating && (
          <div style={{ background: CARD, padding: 25, borderRadius: 20, width: "100%" }}>
            <div style={{ color: "#FFF", fontSize: 22, fontWeight: "bold", marginBottom: 20 }}>Neue Crew gründen</div>

            <div style={{ color: PRIMARY, fontSize: 12, fontWeight: "bold", marginBottom: 8, marginTop: 10 }}>Crew Name</div>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="z.B. Kiez Läufer"
              style={{
                background: CARD, color: "#FFF", padding: 16, borderRadius: 12,
                marginBottom: 15, border: `1px solid #333`, width: "100%",
              }}
            />

            <div style={{ color: PRIMARY, fontSize: 12, fontWeight: "bold", marginBottom: 8, marginTop: 10 }}>Einsatzgebiet (PLZ)</div>
            <input
              value={newZip}
              onChange={(e) => setNewZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
              placeholder="z.B. 13435"
              style={{
                background: CARD, color: "#FFF", padding: 16, borderRadius: 12,
                marginBottom: 15, border: `1px solid #333`, width: "100%",
              }}
            />

            <div style={{ color: PRIMARY, fontSize: 12, fontWeight: "bold", marginBottom: 8, marginTop: 10 }}>Crew Farbe</div>
            <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", marginTop: 10, marginBottom: 10 }}>
              {CREW_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  style={{
                    width: 50, height: 50, borderRadius: 25,
                    background: c,
                    border: newColor === c ? "3px solid #FFF" : "none",
                    cursor: "pointer",
                  }}
                />
              ))}
            </div>

            <button
              onClick={handleCreate}
              style={{
                padding: "18px 40px", borderRadius: 35,
                background: newColor, width: "100%", marginTop: 20,
                color: BG, fontWeight: "bold", fontSize: 16,
                border: "none", cursor: "pointer",
              }}
            >
              Crew registrieren
            </button>
            <button
              onClick={() => setCreating(false)}
              style={{
                marginTop: 20, width: "100%",
                background: "transparent", border: "none",
                color: MUTED, cursor: "pointer",
              }}
            >
              Abbrechen
            </button>
          </div>
        )}

        {myCrew && (
          <div>
            <div style={{
              background: CARD, padding: 25, borderRadius: 20, width: "100%",
              borderTop: `4px solid ${myCrew.color}`,
            }}>
              <div style={{ color: "#FFF", fontSize: 28, fontWeight: 900, marginBottom: 5 }}>{myCrew.name}</div>
              <div style={{ color: MUTED, fontSize: 14, fontWeight: 600 }}>Revier: {myCrew.zip}</div>
              <div style={{ marginTop: 12, color: MUTED, fontSize: 12 }}>
                Einladungscode: <span style={{ color: PRIMARY, fontFamily: "monospace", fontWeight: "bold" }}>{myCrew.invite_code}</span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "row", marginTop: 15, marginBottom: 30 }}>
              <button
                onClick={() => navigator.clipboard.writeText(myCrew.invite_code)}
                style={{
                  padding: "12px 20px", borderRadius: 10,
                  background: myCrew.color, flex: 1,
                  color: BG, fontWeight: "bold", border: "none", cursor: "pointer",
                }}
              >
                + Einladungscode kopieren
              </button>
            </div>

            <button
              onClick={handleLeave}
              style={{
                marginTop: 30, width: "100%",
                background: "transparent", border: "none",
                color: ACCENT, textDecoration: "underline", cursor: "pointer",
              }}
            >
              Crew auflösen / verlassen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
 * RANKING TAB (1:1 alte App)
 * ═══════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════
 * SHOPS TAB (Lokale Geschäfte – Kiez-Deals)
 * ═══════════════════════════════════════════════════════ */

function ShopsTab() {
  const categories = [
    { icon: "☕", name: "Café & Bäcker" },
    { icon: "🛍️", name: "Sport & Mode" },
    { icon: "🥗", name: "Gesundheit" },
    { icon: "🍔", name: "Gastro" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 40 }}>
      {/* Header */}
      <div style={{
        padding: 30, paddingTop: 50, background: CARD,
        display: "flex", flexDirection: "column", alignItems: "center",
        borderBottom: `1px solid ${BORDER}`, width: "100%",
      }}>
        <div style={{ fontSize: 24, color: "#FFF", fontWeight: "bold" }}>Kiez-Deals</div>
        <div style={{ color: MUTED, marginTop: 5, marginBottom: 20 }}>XP gegen echte Rabatte</div>

        <div style={{ display: "flex", flexDirection: "row", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          {categories.map((c) => (
            <div key={c.name} style={{
              background: BG, padding: "8px 14px", borderRadius: 20,
              border: `1px solid ${BORDER}`,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <span>{c.icon}</span>
              <span style={{ color: "#FFF", fontSize: 12, fontWeight: 600 }}>{c.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: 20, width: "100%", maxWidth: 500 }}>
        {/* Coming Soon Card */}
        <div style={{
          background: CARD, padding: 25, borderRadius: 20,
          display: "flex", flexDirection: "column", alignItems: "center", width: "100%",
          marginBottom: 20,
        }}>
          <div style={{ fontSize: 50, marginBottom: 15 }}>🎁</div>
          <div style={{ color: "#FFF", fontSize: 20, fontWeight: "bold", marginBottom: 10 }}>
            Bald verfügbar
          </div>
          <div style={{ color: MUTED, textAlign: "center", marginBottom: 20, lineHeight: "22px" }}>
            Wir suchen gerade lokale Partner in deiner Stadt. Sobald die ersten Geschäfte dabei sind, kannst du hier deine XP gegen echte Rabatte einlösen.
          </div>
          <div style={{
            paddingLeft: 15, paddingRight: 15, paddingTop: 6, paddingBottom: 6,
            borderRadius: 15,
            background: "rgba(239, 113, 105, 0.1)",
            border: `1px solid ${ACCENT}`,
          }}>
            <span style={{ color: ACCENT, fontSize: 12, fontWeight: "bold" }}>COMING SOON</span>
          </div>
        </div>

        {/* Wie funktioniert's */}
        <div style={{ width: "100%", marginBottom: 10, marginTop: 10 }}>
          <div style={{ fontSize: 12, color: PRIMARY, fontWeight: "bold", letterSpacing: 1.5 }}>WIE ES FUNKTIONIERT</div>
        </div>
        <div style={{ background: CARD, padding: 20, borderRadius: 18, width: "100%" }}>
          {[
            { num: "01", title: "Lauf in der Nähe", desc: "Komme in den GPS-Radius eines Partner-Geschäfts (20m)" },
            { num: "02", title: "Check-in via QR", desc: "Scanne den QR-Code an der Theke – Anwesenheit bewiesen" },
            { num: "03", title: "Rabatt kassieren", desc: "Zeige den Screen an der Kasse und löse deine XP ein" },
          ].map((step) => (
            <div key={step.num} style={{
              display: "flex", flexDirection: "row", alignItems: "flex-start",
              paddingBottom: 16, marginBottom: 16,
              borderBottom: `1px solid ${BORDER}`,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 16,
                background: `${PRIMARY}20`,
                display: "flex", alignItems: "center", justifyContent: "center",
                marginRight: 12,
              }}>
                <span style={{ color: PRIMARY, fontSize: 11, fontWeight: "bold" }}>{step.num}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#FFF", fontSize: 14, fontWeight: "bold", marginBottom: 2 }}>{step.title}</div>
                <div style={{ color: MUTED, fontSize: 12, lineHeight: "18px" }}>{step.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Partner-CTA */}
        <div style={{ width: "100%", marginBottom: 10, marginTop: 25 }}>
          <div style={{ fontSize: 12, color: PRIMARY, fontWeight: "bold", letterSpacing: 1.5 }}>FÜR GESCHÄFTE</div>
        </div>
        <div style={{ background: CARD, padding: 25, borderRadius: 20, width: "100%" }}>
          <div style={{ color: "#FFF", fontSize: 18, fontWeight: "bold", marginBottom: 10 }}>
            Du hast ein Geschäft?
          </div>
          <div style={{ color: MUTED, marginBottom: 20, lineHeight: "22px", fontSize: 13 }}>
            Bringe Läufer direkt zu deiner Tür. Pay-per-Visit ab 0,50 € – nur wenn jemand wirklich bei dir ankommt. Keine Flyer, kein Blindschuss.
          </div>
          <button
            onClick={() => alert("Partner-Anfrage: Bitte kontaktiere a.meierholz@gmail.com")}
            style={{
              padding: "16px 40px", borderRadius: 12,
              background: PRIMARY, width: "100%",
              color: BG, fontWeight: "bold", fontSize: 15,
              border: "none", cursor: "pointer",
            }}
          >
            Als Partner bewerben
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
 * RANKING TAB (1:1 alte App)
 * ═══════════════════════════════════════════════════════ */

function RankingTab({ profile: p, leaderboard }: { profile: Profile | null; leaderboard: Profile[] }) {
  return (
    <>
      <div style={{ padding: 20, paddingTop: 40, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ fontSize: 24, color: "#FFF", fontWeight: "bold" }}>Top Einzel-Eroberer</div>
        <div style={{ color: MUTED, marginTop: 5, marginBottom: 20 }}>Die Legenden der Straßen</div>
      </div>
      <div style={{ padding: 20 }}>
        {leaderboard.length === 0 ? (
          <div style={{ background: CARD, padding: 20, borderRadius: 15, textAlign: "center", color: MUTED }}>
            Keine Daten verfügbar
          </div>
        ) : (
          leaderboard.map((entry, i) => {
            const isMe = entry.id === p?.id;
            return (
              <div
                key={entry.id}
                style={{
                  display: "flex", flexDirection: "row", alignItems: "center",
                  background: CARD, padding: 15, borderRadius: 15, marginBottom: 10,
                  border: isMe ? `1px solid ${PRIMARY}` : "none",
                }}
              >
                <span style={{ color: ACCENT, fontWeight: "bold", width: 30, fontSize: 16 }}>#{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#FFF", fontWeight: "bold", fontSize: 16 }}>
                    {entry.display_name || entry.username}
                    {isMe && <span style={{ color: PRIMARY, fontSize: 10, marginLeft: 8 }}>(Du)</span>}
                  </div>
                </div>
                <span style={{ color: PRIMARY, fontWeight: "bold" }}>{entry.xp || 0} XP</span>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
