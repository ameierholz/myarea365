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
  XP_PER_KM,
  XP_PER_WALK,
  XP_REWARDED_AD,
  XP_KIEZ_CHECKIN,
  XP_CREW_WIN,
  ACHIEVEMENTS,
  DEMO_MODE,
  DEMO_STATS,
  DEMO_MAP_LIVE,
  DEMO_RUNNERS,
  generateDemoRecentRuns,
} from "@/lib/game-config";
import type { DemoRunnerProfile } from "@/lib/game-config";

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
const BG = "transparent"; // Dashboard-Gradient scheint durch
const BG_DEEP = "#0F1115"; // für dunklen Text auf hellen Buttons
const CARD = "rgba(41, 51, 73, 0.55)";
const BORDER = "rgba(255, 255, 255, 0.14)";
const MUTED = "#a8b4cf";
const TEXT_SOFT = "#dde3f5";
const PRIMARY = "#22D1C3";
const ACCENT = "#FF2D78";

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
  const [viewingRunner, setViewingRunner] = useState<string | null>(null);

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
    <div style={{
      height: "100dvh",
      display: "flex",
      flexDirection: "column",
      background: `
        radial-gradient(at 12% 18%, rgba(34, 209, 195, 0.4) 0%, transparent 42%),
        radial-gradient(at 88% 82%, rgba(93, 218, 240, 0.32) 0%, transparent 48%),
        radial-gradient(at 100% 0%, rgba(255, 45, 120, 0.12) 0%, transparent 38%),
        radial-gradient(at 0% 100%, rgba(168, 85, 247, 0.14) 0%, transparent 42%),
        linear-gradient(135deg, #0d2142 0%, #1e3f7a 50%, #091833 100%)
      `,
    }}>
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

            {/* Live-Info-Panel (oben links) */}
            <MapLivePanel teamColor={teamColor} onViewRunner={setViewingRunner} />

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
                  color: BG_DEEP,
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
              onSwitchToMap={() => setActiveTab("map")}
              distance={distance}
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
        background: "transparent",
        paddingBottom: 4,
        paddingTop: 8,
      }}>
        {[
          { id: "profil",  label: "Profil",  icon: "👤", color: "#22D1C3" }, // Teal
          { id: "map",     label: "Karte",   icon: "🗺️", color: "#5ddaf0" }, // Cyan
          { id: "crew",    label: "Crew",    icon: "👥", color: "#FF2D78" }, // Magenta
          { id: "shops",   label: "Shops",   icon: "🏪", color: "#FFD700" }, // Gold
          { id: "ranking", label: "Ranking", icon: "🏆", color: "#FF6B4A" }, // Coral
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
                gap: 0,
                position: "relative",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {active && (
                <div style={{
                  position: "absolute",
                  top: -16,
                  left: "28%",
                  right: "28%",
                  height: 3,
                  borderRadius: 3,
                  background: tab.color,
                  boxShadow: `0 0 14px ${tab.color}`,
                }} />
              )}
              <span style={{
                fontSize: active ? 38 : 30,
                lineHeight: 1,
                filter: active
                  ? `drop-shadow(0 0 10px ${tab.color}cc) drop-shadow(0 0 20px ${tab.color}66)`
                  : "grayscale(0.3) opacity(0.75)",
                transform: active ? "translateY(-2px) scale(1.05)" : "none",
                transition: "all 0.2s",
              }}>
                {tab.icon}
              </span>
              <span style={{
                color: active ? tab.color : MUTED,
                fontSize: 12,
                fontWeight: active ? 800 : 600,
                textAlign: "center",
                letterSpacing: 0.3,
                textShadow: active ? `0 0 12px ${tab.color}80` : "none",
              }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Runner-Profil-Modal (öffnet beim Klick auf Angreifer) */}
      {viewingRunner && DEMO_RUNNERS[viewingRunner] && (
        <RunnerProfileModal
          runner={DEMO_RUNNERS[viewingRunner]}
          myFaction={profile?.faction || "syndicate"}
          onClose={() => setViewingRunner(null)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
 * PROFIL TAB (1:1 alte App)
 * ═══════════════════════════════════════════════════════ */

function ProfilTab({
  profile: origP,
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
  onSwitchToMap,
  distance,
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
  onSwitchToMap: () => void;
  distance: number;
}) {
  const supabase = createClient();

  // ═══ DEMO-OVERLAY: zeigt realistische Werte falls DEMO_MODE=true und Profil leer ═══
  const isEmptyProfile = !origP || ((origP.xp || 0) === 0 && (origP.total_walks || 0) === 0);
  const p: Profile | null = DEMO_MODE && isEmptyProfile && origP
    ? ({ ...origP, ...DEMO_STATS } as Profile)
    : origP;
  const effectiveRecentRuns: Territory[] = DEMO_MODE && isEmptyProfile && recentRuns.length === 0
    ? generateDemoRecentRuns() as Territory[]
    : recentRuns;
  const effectiveTerritoryCount = DEMO_MODE && isEmptyProfile && territoryCount === 0
    ? DEMO_STATS.territory_count
    : territoryCount;

  const userXp = p?.xp || 0;
  const teamColor = myCrew?.color || p?.team_color || PRIMARY;
  const nextRank = getNextRank(userXp);
  const xpToNext = nextRank ? nextRank.minXp - userXp : 0;
  const currentRankLive = getCurrentRank(userXp);
  // Bar-Fortschritt: total XP / Ziel-XP (passt zu "noch X XP")
  const pctToNext = nextRank
    ? Math.round((userXp / nextRank.minXp) * 100)
    : 100;

  // Current marker icon
  const currentMarker = UNLOCKABLE_MARKERS.find((m) => m.id === equippedMarker) || UNLOCKABLE_MARKERS[0];
  const currentLight = RUNNER_LIGHTS.find((l) => l.id === equippedLight) || RUNNER_LIGHTS[0];

  const avgPace = p?.total_distance_m && p.total_distance_m > 0 && p.total_walks > 0
    ? ((p.total_walks * 60) / (p.total_distance_m / 1000)).toFixed(1)
    : "—";
  const longestKm = ((p?.longest_run_m || 0) / 1000).toFixed(1);

  const [openModal, setOpenModal] = useState<null | "health" | "settings" | "account" | "xpguide" | "achievements">(null);

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

  // Rang-basiertes Motto (persönliches Motto-Feld kommt später via DB-Migration)
  const mottos: Record<string, string> = {
    "Straßen-Scout":      "Jeder Weg beginnt mit dem ersten Schritt.",
    "Kiez-Wanderer":      "Schritt für Schritt näher zum Kiez.",
    "Block-Kundschafter": "Jede Straße ein neuer Datenpunkt.",
    "Stadt-Pionier":      "Ich erkunde, was andere übersehen.",
    "Bezirks-Entdecker":  "Mein Bezirk, meine Karte.",
    "Viertel-Boss":       "Mein Kiez, meine Regeln.",
    "Kiez-König":         "Unangefochten auf meinen Straßen.",
    "Metropolen-Legende": "Die Stadt gehört denen, die sie erlaufen.",
    "Urbaner Mythos":     "Von mir erzählen die Laternen.",
    "Straßen-Gott":       "Ich bin der Puls der Stadt.",
  };
  const motto = mottos[currentRankLive.name] || mottos["Straßen-Scout"];

  // Achievements: Unlock-Status live berechnen aus Profilstats
  const stats = {
    longest_km:   (p?.longest_run_m || 0) / 1000,
    lifetime_km:  (p?.total_distance_m || 0) / 1000,
    territories:  effectiveTerritoryCount,
    streak_best:  p?.streak_best || 0,
    total_walks:  p?.total_walks || 0,
  };
  const achievementStatus = ACHIEVEMENTS.map((a) => {
    const current = stats[a.stat];
    const pct = Math.min(100, (current / a.target) * 100);
    const unlocked = current >= a.target;
    const displayFmt = a.unit === "km"
      ? (v: number) => v.toFixed(1)
      : (v: number) => Math.floor(v).toString();
    return { ...a, unlocked, current, pct, displayFmt };
  });
  const achievementsUnlocked = achievementStatus.filter((a) => a.unlocked).length;

  // Priorisierung: unlocked zuerst, dann höchster Progress → top 5 für Liste
  const sortedAchievements = [...achievementStatus].sort((a, b) => {
    if (a.unlocked && !b.unlocked) return -1;
    if (!a.unlocked && b.unlocked) return 1;
    return b.pct - a.pct;
  });
  const topAchievements = sortedAchievements.slice(0, 5);

  return (
    <div style={{ background: BG, paddingBottom: 30 }}>
      {/* ═══ HERO — Cover + Avatar mit XP-Ring + Hologramm-Marker ═══ */}
      <div style={{
        position: "relative",
        background: `
          radial-gradient(at 50% 0%, ${currentRankLive.color}30 0%, transparent 55%),
          linear-gradient(180deg, ${currentRankLive.color}12 0%, transparent 100%)
        `,
        paddingTop: 36, paddingBottom: 28, paddingLeft: 20, paddingRight: 20,
      }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>

          {/* Avatar mit SVG Progress Ring */}
          <div style={{ position: "relative", width: 160, height: 160, marginBottom: 14 }}>
            <XpProgressRing
              size={160}
              stroke={8}
              pct={pctToNext}
              colorFrom={currentRankLive.color}
              colorTo={nextRank?.color || currentRankLive.color}
            />
            {/* Avatar selbst */}
            <div style={{
              position: "absolute",
              top: 14, left: 14, right: 14, bottom: 14,
              borderRadius: "50%",
              background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.12), rgba(70, 82, 122, 0.5))`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `inset 0 0 30px rgba(0,0,0,0.3), 0 0 35px ${currentRankLive.color}40`,
              border: `2px solid ${teamColor}`,
            }}>
              <span style={{ fontSize: 66, filter: "drop-shadow(0 4px 14px rgba(0,0,0,0.4))" }}>
                {currentMarker.icon}
              </span>
            </div>

            {/* Hologramm des equipped Runner-Lights (unten) */}
            <div style={{
              position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)",
              width: 70, height: currentLight.width + 4,
              borderRadius: (currentLight.width + 4) / 2,
              background: currentLight.gradient.length > 1
                ? `linear-gradient(90deg, ${currentLight.gradient.join(", ")})`
                : currentLight.color,
              boxShadow: `0 0 20px ${currentLight.color}cc, 0 0 40px ${currentLight.color}66`,
              opacity: 0.95,
            }} />
          </div>

          <div style={{ fontSize: 10, color: MUTED, fontWeight: "bold", letterSpacing: 2, marginTop: 10 }}>LÄUFER</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: "#FFF", marginTop: 4, textAlign: "center" }}>
            {p?.display_name || p?.username || "Eroberer"}
          </div>
          <div style={{ color: MUTED, fontSize: 13, marginTop: 2 }}>@{p?.username}</div>

          {/* Motto */}
          <div style={{
            color: TEXT_SOFT, fontSize: 13, marginTop: 8,
            fontStyle: "italic", textAlign: "center", maxWidth: 340,
          }}>{motto}</div>

          {/* Holographic Rank Badge */}
          <div style={{
            marginTop: 14, paddingLeft: 18, paddingRight: 18, paddingTop: 8, paddingBottom: 8,
            borderRadius: 22,
            background: `
              linear-gradient(90deg,
                ${currentRankLive.color} 0%,
                #fff 50%,
                ${currentRankLive.color} 100%
              )
            `,
            backgroundSize: "200% 100%",
            animation: "rankShimmer 3s linear infinite",
            boxShadow: `0 4px 24px ${currentRankLive.color}60, inset 0 1px 0 rgba(255,255,255,0.4)`,
          }}>
            <span style={{ color: BG_DEEP, fontWeight: 900, fontSize: 13, letterSpacing: 0.5 }}>
              {currentRankLive.name} · {userXp.toLocaleString()} XP
            </span>
          </div>
          <style>{`@keyframes rankShimmer { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }`}</style>

          {/* Next Rank — animierter Balken mit klaren Anker-Werten */}
          {nextRank && (
            <div style={{ width: "100%", maxWidth: 340, marginTop: 14 }}>
              {/* XP-Anker oberhalb des Balkens */}
              <div style={{
                display: "flex", justifyContent: "space-between",
                marginBottom: 5, fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
              }}>
                <span style={{ color: currentRankLive.color }}>
                  {userXp.toLocaleString()} XP
                </span>
                <span style={{ color: nextRank.color }}>
                  {nextRank.minXp.toLocaleString()} XP
                </span>
              </div>

              {/* Balken */}
              <div style={{
                height: 10, borderRadius: 5,
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                overflow: "hidden", position: "relative",
              }}>
                <div style={{
                  height: "100%", width: `${pctToNext}%`,
                  background: `linear-gradient(90deg, ${currentRankLive.color}, ${nextRank.color})`,
                  borderRadius: 5,
                  boxShadow: `0 0 10px ${nextRank.color}99`,
                  transition: "width 1.2s cubic-bezier(0.22, 1, 0.36, 1)",
                  position: "relative",
                  overflow: "hidden",
                }}>
                  <div style={{
                    position: "absolute", inset: 0,
                    background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%)",
                    backgroundSize: "200% 100%",
                    animation: "rankBarShimmer 2.2s linear infinite",
                  }} />
                </div>
              </div>
              <style>{`@keyframes rankBarShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>

              {/* Nächster Rang + verbleibende XP */}
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "baseline",
                marginTop: 6, fontSize: 11, fontWeight: 600,
              }}>
                <span style={{ color: nextRank.color, fontWeight: 700 }}>
                  → {nextRank.name}
                </span>
                <span style={{ color: MUTED }}>
                  noch <span style={{ color: "#FFF", fontWeight: 800 }}>{xpToNext.toLocaleString()}</span> XP
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ paddingLeft: 20, paddingRight: 20 }}>

        {/* ═══ TODAY HERO — Live-Status + heutige Zahlen + Wochen-Trend + CTA ═══ */}
        <TodayHero
          walking={walking}
          currentStreet={currentStreet}
          currentDistance={distance}
          runs={effectiveRecentRuns}
          streak={p?.streak_days || 0}
          teamColor={teamColor}
          onSwitchToMap={onSwitchToMap}
        />

        {/* ═══ ERFOLGE (Top 5 als Balken + Modal für Rest) ═══ */}
        <SectionHeader
          title="ERFOLGE"
          action={
            <button
              onClick={() => setOpenModal("achievements")}
              style={{
                background: `${PRIMARY}22`, border: `1px solid ${PRIMARY}88`,
                borderRadius: 14, padding: "6px 12px",
                color: PRIMARY, fontSize: 12, fontWeight: 800, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <span>{achievementsUnlocked} / {ACHIEVEMENTS.length}</span>
              <span>→</span>
            </button>
          }
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {topAchievements.map((a) => (
            <AchievementRow
              key={a.id}
              icon={a.icon}
              name={a.name}
              xp={a.xp}
              unlocked={a.unlocked}
              current={a.current}
              target={a.target}
              unit={a.unit}
              pct={a.pct}
              displayFmt={a.displayFmt}
            />
          ))}
        </div>

        {/* ═══ AKTIVITÄT (aktueller Monat, zentriert) ═══ */}
        <SectionHeader title="AKTUELLER MONAT" />
        <div style={{
          background: "rgba(70, 82, 122, 0.45)", borderRadius: 16, padding: 16,
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}>
          <MonthlyCalendar runs={effectiveRecentRuns} color={teamColor} />
        </div>

        {/* ═══ MAP-ICONS (10 Stück) ═══ */}
        <div style={{ width: "100%", marginTop: 25, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 15, color: PRIMARY, fontWeight: "bold", letterSpacing: 1.5 }}>DEINE MAP-ICONS</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>
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
                  background: isEquipped ? `${PRIMARY}15` : "rgba(70, 82, 122, 0.45)",
                  padding: 14, borderRadius: 16,
                  display: "flex", flexDirection: "column", alignItems: "center",
                  minWidth: 90, maxWidth: 90,
                  border: isEquipped ? `2px solid ${PRIMARY}` : "1px solid rgba(255, 255, 255, 0.1)",
                  cursor: "pointer",
                  flexShrink: 0,
                  boxShadow: isEquipped ? `0 0 20px ${PRIMARY}40` : "none",
                }}
              >
                <span style={{ fontSize: 36, marginBottom: 8, opacity: isUnlocked ? 1 : 0.25 }}>{marker.icon}</span>
                <span style={{ color: "#FFF", fontSize: 13, fontWeight: "bold", marginBottom: 5 }}>{marker.name}</span>
                {isUnlocked ? (
                  <span style={{ fontSize: 12, fontWeight: "bold", color: isEquipped ? PRIMARY : "#4ade80" }}>
                    {isEquipped ? "✓ AKTIV" : "Frei"}
                  </span>
                ) : (
                  <span style={{ fontSize: 12, fontWeight: "bold", color: "#FFD700" }}>🔒 {marker.cost >= 1000 ? `${marker.cost/1000}k` : marker.cost}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* ═══ RUNNER LIGHTS (10 Schweif-Varianten) ═══ */}
        <div style={{ width: "100%", marginTop: 25, marginBottom: 10 }}>
          <div style={{ fontSize: 15, color: PRIMARY, fontWeight: "bold", letterSpacing: 1.5 }}>DEINE RUNNER LIGHTS</div>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>
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
                  background: isEquipped ? `${PRIMARY}15` : "rgba(70, 82, 122, 0.45)",
                  padding: 14, borderRadius: 16,
                  display: "flex", flexDirection: "column", alignItems: "center",
                  minWidth: 100, maxWidth: 100,
                  border: isEquipped ? `2px solid ${PRIMARY}` : "1px solid rgba(255, 255, 255, 0.1)",
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
                <span style={{ color: "#FFF", fontSize: 13, fontWeight: "bold", marginBottom: 5 }}>{light.name}</span>
                {isUnlocked ? (
                  <span style={{ fontSize: 12, fontWeight: "bold", color: isEquipped ? PRIMARY : "#4ade80" }}>
                    {isEquipped ? "✓ AKTIV" : "Frei"}
                  </span>
                ) : (
                  <span style={{ fontSize: 12, fontWeight: "bold", color: "#FFD700" }}>🔒 {light.cost >= 1000 ? `${light.cost/1000}k` : light.cost}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* ═══ DEINE CREW ═══ */}
        <SectionHeader title="DEINE CREW" />
        <div style={{
          display: "flex", flexDirection: "row", background: "rgba(70, 82, 122, 0.45)",
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


        {/* ═══ LETZTE LÄUFE ═══ */}
        <SectionHeader title="LETZTE LÄUFE" />
        {effectiveRecentRuns.length === 0 ? (
          <div style={{ background: "rgba(70, 82, 122, 0.45)", padding: 20, borderRadius: 18, textAlign: "center", color: MUTED, border: "1px solid rgba(255, 255, 255, 0.1)" }}>
            Noch keine Läufe. Starte deine erste Eroberung auf der Karte!
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {effectiveRecentRuns.slice(0, 5).map((run) => (
              <div key={run.id} style={{
                background: "rgba(70, 82, 122, 0.45)", padding: 16, borderRadius: 16,
                display: "flex", alignItems: "center", gap: 14,
                border: "1px solid rgba(255, 255, 255, 0.1)",
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

        {/* ═══ GESUNDHEITSDATEN (nur 2 Kennzahlen, Rest im Modal) ═══ */}
        <SectionHeader
          title="GESUNDHEITSDATEN"
          action={
            <button
              onClick={() => setOpenModal("health")}
              style={{
                background: "transparent", border: `1px solid ${PRIMARY}`,
                borderRadius: 14, padding: "6px 14px", color: PRIMARY,
                fontSize: 12, fontWeight: "bold", cursor: "pointer",
              }}
            >
              Mehr Details →
            </button>
          }
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <StatBox emoji="👣" value={((p?.total_distance_m || 0) / 1000).toFixed(1)} label="KM Gesamt" />
          <StatBox emoji="🔥" value={(p?.total_calories || 0).toLocaleString()} label="KCAL Verbrannt" />
        </div>

        {/* ═══ EINSTELLUNGEN, ACCOUNT, XP-GUIDE, SHARE als Modal-Trigger ═══ */}
        <div style={{ marginTop: 30, display: "flex", flexDirection: "column", gap: 10 }}>
          <ModalTriggerButton
            icon="📤"
            label="Profil teilen"
            onClick={async () => {
              const shareText = `${p?.display_name || "Ich"} · ${currentRankLive.name} · ${userXp.toLocaleString()} XP\n${effectiveTerritoryCount} Territorien · ${((p?.total_distance_m || 0) / 1000).toFixed(1)} km\n\nMyArea365.de`;
              const shareData = {
                title: "Mein MyArea365 Profil",
                text: shareText,
                url: typeof window !== "undefined" ? window.location.origin : "https://myarea365.de",
              };
              try {
                if (navigator.share) {
                  await navigator.share(shareData);
                } else {
                  await navigator.clipboard.writeText(`${shareText}\n${shareData.url}`);
                  alert("Profil-Text in Zwischenablage kopiert!");
                }
              } catch { /* User hat abgebrochen */ }
            }}
          />
          <ModalTriggerButton icon="⭐" label="Wofür gibt es XP?" onClick={() => setOpenModal("xpguide")} />
          <ModalTriggerButton icon="⚙️" label="Einstellungen" onClick={() => setOpenModal("settings")} />
          <ModalTriggerButton icon="👤" label="Account" onClick={() => setOpenModal("account")} />
        </div>

        <div style={{ textAlign: "center", color: MUTED, fontSize: 11, marginTop: 20 }}>
          MyArea365 · v0.1 · Made with ❤️ in Berlin
        </div>
      </div>

      {/* ═══════════ MODALS ═══════════ */}
      {openModal === "health" && (
        <Modal
          title="Gesundheitsdaten"
          subtitle="Dein kompletter Fitness-Überblick"
          icon="💪"
          accent={PRIMARY}
          onClose={() => setOpenModal(null)}
        >
          <HealthDashboard
            profile={p}
            runs={effectiveRecentRuns}
            territoryCount={effectiveTerritoryCount}
            teamColor={teamColor}
            achievements={achievementStatus}
          />
        </Modal>
      )}

      {openModal === "settings" && (
        <Modal title="Einstellungen" subtitle="Deine App-Präferenzen" icon="⚙️" accent="#5ddaf0" onClose={() => setOpenModal(null)}>
          <div style={{ background: "rgba(70, 82, 122, 0.45)", borderRadius: 18, overflow: "hidden", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
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
        </Modal>
      )}

      {openModal === "account" && (
        <Modal title="Account" subtitle="Profil, Daten & Sicherheit" icon="👤" accent="#a855f7" onClose={() => setOpenModal(null)}>
          <div style={{ background: "rgba(70, 82, 122, 0.45)", borderRadius: 18, overflow: "hidden", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
            <AccountRow label="✏️ Profil bearbeiten" onClick={() => alert("Profil bearbeiten – kommt bald")} />
            <AccountRow label="🔒 Privatsphäre & Daten" onClick={() => alert("Privatsphäre – kommt bald")} />
            <AccountRow label="❓ Hilfe & Support" onClick={() => alert("Hilfe – kommt bald")} />
            <AccountRow label="🚪 Ausloggen" onClick={onLogout} danger last />
          </div>
        </Modal>
      )}

      {openModal === "achievements" && (
        <Modal
          title="Alle Erfolge"
          subtitle={`${achievementsUnlocked} von ${ACHIEVEMENTS.length} freigeschaltet`}
          icon="🏆"
          accent="#FFD700"
          onClose={() => setOpenModal(null)}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sortedAchievements.map((a) => (
              <AchievementRow
                key={a.id}
                icon={a.icon}
                name={a.name}
                xp={a.xp}
                unlocked={a.unlocked}
                current={a.current}
                target={a.target}
                unit={a.unit}
                pct={a.pct}
                displayFmt={a.displayFmt}
              />
            ))}
          </div>
        </Modal>
      )}

      {openModal === "xpguide" && (
        <Modal
          title="Wofür gibt es XP?"
          subtitle="Alle Quellen für Erfahrungspunkte"
          icon="⭐"
          accent="#FFD700"
          onClose={() => setOpenModal(null)}
        >
          <div style={{ color: TEXT_SOFT, fontSize: 14, lineHeight: 1.5, marginBottom: 20 }}>
            Je mehr du dich bewegst, desto mehr XP sammelst du. Hier alle Quellen:
          </div>

          <XpGuideSection title="🏃 Pro Aktivität">
            <XpGuideRow icon="📍" label="Territorium erobert" xp={`+${XP_PER_TERRITORY}`} />
            <XpGuideRow icon="📏" label="Pro gelaufener km" xp={`+${XP_PER_KM}`} />
            <XpGuideRow icon="✅" label="Walk abgeschlossen" xp={`+${XP_PER_WALK} Base`} last />
          </XpGuideSection>

          <XpGuideSection title="🔥 Tages-Streak">
            <XpGuideRow icon="2️⃣" label="Tag 2–3" xp="+25 / Tag" />
            <XpGuideRow icon="4️⃣" label="Tag 4–6" xp="+50 / Tag" />
            <XpGuideRow icon="7️⃣" label="Tag 7–9" xp="+100 / Tag" />
            <XpGuideRow icon="🔟" label="Ab Tag 10" xp="+200 / Tag" last />
          </XpGuideSection>

          <XpGuideSection title="🏆 Achievements (einmalig)">
            {ACHIEVEMENTS.map((a, i) => (
              <XpGuideRow
                key={a.id}
                icon={a.icon}
                label={a.name}
                xp={`+${a.xp.toLocaleString()}`}
                last={i === ACHIEVEMENTS.length - 1}
              />
            ))}
          </XpGuideSection>

          <XpGuideSection title="🎁 Bonus-Quellen">
            <XpGuideRow icon="📺" label="Rewarded Ad (Supply Drop / Boost)" xp={`+${XP_REWARDED_AD}`} />
            <XpGuideRow icon="🏪" label="Kiez-Deal Check-in" xp={`+${XP_KIEZ_CHECKIN}`} />
            <XpGuideRow icon="👥" label="Crew-Sieg im Wochen-Ranking" xp={`+${XP_CREW_WIN}`} last />
          </XpGuideSection>

          <div style={{ color: MUTED, fontSize: 12, marginTop: 16, textAlign: "center", fontStyle: "italic" }}>
            XP schaltet neue Ränge, Map-Icons und Runner Lights frei.
          </div>
        </Modal>
      )}
    </div>
  );
}

function QuickStat({ value, targetNumber, decimals, label, color }: {
  value: string;
  targetNumber?: number;
  decimals?: number;
  label: string;
  color: string;
}) {
  const animated = useCountUp(targetNumber ?? 0, 1000, decimals ?? 0);
  const display = targetNumber !== undefined ? animated : value;
  return (
    <div style={{
      background: "rgba(70, 82, 122, 0.45)", padding: "14px 8px", borderRadius: 14,
      display: "flex", flexDirection: "column", alignItems: "center",
      border: "1px solid rgba(255, 255, 255, 0.1)",
    }}>
      <span style={{ fontSize: 26, fontWeight: 900, color, lineHeight: 1 }}>{display}</span>
      <span style={{ fontSize: 13, color: MUTED, marginTop: 6, textAlign: "center", fontWeight: 600 }}>{label}</span>
    </div>
  );
}

function useCountUp(target: number, duration = 1000, decimals = 0): string {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const from = 0;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return decimals > 0 ? value.toFixed(decimals) : Math.floor(value).toLocaleString();
}

function XpProgressRing({ size, stroke, pct, colorFrom, colorTo }: {
  size: number; stroke: number; pct: number; colorFrom: string; colorTo: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(1, pct / 100)));
  const gradientId = `xp-ring-${colorFrom.replace("#", "")}-${colorTo.replace("#", "")}`;
  return (
    <svg width={size} height={size} style={{ position: "absolute", top: 0, left: 0, transform: "rotate(-90deg)" }}>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colorFrom} />
          <stop offset="100%" stopColor={colorTo} />
        </linearGradient>
      </defs>
      {/* Track */}
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
      {/* Progress */}
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={`url(#${gradientId})`} strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 1s ease-out", filter: `drop-shadow(0 0 6px ${colorFrom})` }} />
    </svg>
  );
}

function RecordCard({ emoji, label, value, color }: { emoji: string; label: string; value: string; color: string }) {
  return (
    <div style={{
      background: "rgba(70, 82, 122, 0.45)",
      padding: 16, borderRadius: 16,
      border: "1px solid rgba(255, 255, 255, 0.1)",
      display: "flex", flexDirection: "column", gap: 6,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 22 }}>{emoji}</span>
        <span style={{ color: MUTED, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>
          {label}
        </span>
      </div>
      <span style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1 }}>{value}</span>
    </div>
  );
}

function MapLivePanel({ teamColor, onViewRunner }: { teamColor: string; onViewRunner: (username: string) => void }) {
  const live = DEMO_MAP_LIVE;
  const aa = live.active_attack;
  const ta = live.territory_attack;

  const row = (icon: string, value: React.ReactNode, label: string, accent?: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
      <span style={{ fontSize: 14, width: 18, textAlign: "center" }}>{icon}</span>
      <span style={{
        color: accent || "#FFF", fontSize: 15, fontWeight: 900, minWidth: 28,
        textShadow: accent ? `0 0 8px ${accent}88` : "none",
      }}>{value}</span>
      <span style={{ color: MUTED, fontSize: 11, fontWeight: 600, flex: 1 }}>{label}</span>
    </div>
  );

  return (
    <div style={{
      position: "absolute", top: 20, left: 20, zIndex: 40,
      minWidth: 200, maxWidth: 240,
      background: "rgba(18, 26, 46, 0.38)",
      backdropFilter: "blur(20px) saturate(180%)",
      WebkitBackdropFilter: "blur(20px) saturate(180%)",
      borderRadius: 14,
      border: "1px solid rgba(255, 255, 255, 0.12)",
      boxShadow: "0 8px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.1)",
      padding: "10px 12px",
      pointerEvents: "none",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        marginBottom: 4, paddingBottom: 6,
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: 3,
          background: "#4ade80",
          boxShadow: "0 0 8px #4ade80",
          animation: "livePanelPulse 1.6s ease-in-out infinite",
        }} />
        <span style={{
          color: "#4ade80", fontSize: 9, fontWeight: 800, letterSpacing: 1.5,
        }}>LIVE</span>
      </div>
      <style>{`@keyframes livePanelPulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.5);opacity:0.5} }`}</style>

      {/* Runner-Zähler */}
      {row("👥", live.runners_in_zip, `im Kiez (${live.zip})`, teamColor)}
      {row("🏙️", live.runners_in_city, `in ${live.city}`, "#5ddaf0")}

      {/* Divider */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "4px 0" }} />

      {/* Aktueller Angriff (Straßenzug im Lauf) */}
      <AttackIndicator
        active={aa.active}
        icon="⚔️"
        labelActive="ANGRIFF!"
        labelInactive="Kein Angriff"
        street={aa.street_name}
        attacker={aa.attacker_username}
        attackerColor={aa.attacker_color}
        alertColor="#FF2D78"
        onViewRunner={onViewRunner}
      />

      {/* Territorium-Angriff */}
      <AttackIndicator
        active={ta.active}
        icon="🛡️"
        labelActive="TERRITORIUM!"
        labelInactive="Gebiete sicher"
        street={ta.street_name}
        attacker={ta.attacker_username}
        attackerColor={ta.attacker_color}
        alertColor="#FF6B4A"
        onViewRunner={onViewRunner}
      />
    </div>
  );
}

function AttackIndicator({ active, icon, labelActive, labelInactive, street, attacker, attackerColor, alertColor, onViewRunner }: {
  active: boolean;
  icon: string;
  labelActive: string;
  labelInactive: string;
  street: string;
  attacker: string;
  attackerColor: string;
  alertColor: string;
  onViewRunner: (username: string) => void;
}) {
  return (
    <div style={{
      padding: "6px 8px",
      borderRadius: 10,
      margin: "4px 0",
      background: active ? `${alertColor}22` : "transparent",
      border: active ? `1px solid ${alertColor}88` : "1px solid transparent",
      boxShadow: active ? `0 0 10px ${alertColor}66` : "none",
      animation: active ? "attackPulse 1.4s ease-in-out infinite" : "none",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 13 }}>{icon}</span>
        <span style={{
          color: active ? alertColor : MUTED,
          fontSize: 10, fontWeight: 800, letterSpacing: 0.5, flex: 1,
        }}>
          {active ? labelActive : labelInactive}
        </span>
      </div>
      {active && (
        <div style={{ marginTop: 3, paddingLeft: 19 }}>
          <div style={{ color: "#FFF", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {street}
          </div>
          <button
            onClick={() => onViewRunner(attacker)}
            style={{
              pointerEvents: "auto", // Panel hat pointerEvents:none, Button braucht es explizit
              background: "transparent", border: "none", padding: "2px 0",
              cursor: "pointer", textAlign: "left",
              color: attackerColor, fontSize: 10, fontWeight: 700,
              textDecoration: "underline", textDecorationStyle: "dotted",
              textUnderlineOffset: 3,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              maxWidth: "100%",
            }}
          >
            ← {attacker}
          </button>
        </div>
      )}
      {active && (
        <style>{`@keyframes attackPulse { 0%,100%{box-shadow:0 0 10px ${alertColor}66} 50%{box-shadow:0 0 22px ${alertColor}cc} }`}</style>
      )}
    </div>
  );
}

function RunnerProfileModal({ runner, myFaction, onClose }: {
  runner: DemoRunnerProfile;
  myFaction: string;
  onClose: () => void;
}) {
  const isEnemy = runner.faction !== myFaction;
  const relationColor = isEnemy ? "#FF2D78" : "#4ade80";
  const memberSince = new Date(runner.member_since).toLocaleDateString("de-DE", {
    month: "short", year: "numeric",
  });

  return (
    <Modal
      title={runner.display_name}
      subtitle={`@${runner.username} · ${runner.last_seen}`}
      icon={runner.marker_icon}
      accent={runner.team_color}
      onClose={onClose}
    >
      {/* Friend/Foe Banner */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 14px", borderRadius: 12, marginBottom: 16,
        background: `${relationColor}15`,
        border: `1px solid ${relationColor}66`,
      }}>
        <span style={{ fontSize: 18 }}>{isEnemy ? "⚔️" : "🤝"}</span>
        <div style={{ flex: 1 }}>
          <div style={{ color: relationColor, fontSize: 12, fontWeight: 900, letterSpacing: 0.5 }}>
            {isEnemy ? "FEINDLICHE FRAKTION" : "VERBÜNDETE FRAKTION"}
          </div>
          <div style={{ color: TEXT_SOFT, fontSize: 11, marginTop: 1 }}>
            {runner.faction === "vanguard" ? "Vanguard" : "Syndicate"}
            {runner.crew_name && (
              <> · Crew: <span style={{ color: runner.crew_color || "#FFF", fontWeight: 700 }}>{runner.crew_name}</span></>
            )}
          </div>
        </div>
      </div>

      {/* Rang */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 14px", borderRadius: 12, marginBottom: 16,
        background: "rgba(70, 82, 122, 0.45)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: `linear-gradient(135deg, ${runner.rank_color}44, ${runner.rank_color}18)`,
          border: `1px solid ${runner.rank_color}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 0 14px ${runner.rank_color}55`,
        }}>
          <span style={{ fontSize: 22 }}>🏆</span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: MUTED, fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>RANG</div>
          <div style={{ color: runner.rank_color, fontSize: 16, fontWeight: 900 }}>
            {runner.rank_name}
          </div>
          <div style={{ color: "#FFD700", fontSize: 12, fontWeight: 700, marginTop: 2 }}>
            {runner.xp.toLocaleString()} XP
          </div>
        </div>
      </div>

      {/* Stats-Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <RunnerStat emoji="🏆" value={runner.territories.toString()} label="Territorien" color={runner.team_color} />
        <RunnerStat emoji="🌍" value={runner.total_km.toFixed(1)} label="KM gesamt" unit="km" color="#5ddaf0" />
        <RunnerStat emoji="🔥" value={runner.streak_days.toString()} label="Akt. Serie" unit="Tage" color="#FFD700" />
        <RunnerStat emoji="⭐" value={runner.streak_best.toString()} label="Beste Serie" unit="Tage" color="#FF6B4A" />
      </div>

      {/* Equipment */}
      <div style={{
        display: "flex", gap: 10, padding: "10px 14px", borderRadius: 12, marginBottom: 16,
        background: "rgba(70, 82, 122, 0.45)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 20,
            background: `${runner.team_color}22`,
            border: `1px solid ${runner.team_color}`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
          }}>{runner.marker_icon}</div>
          <div>
            <div style={{ color: MUTED, fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>MAP-ICON</div>
          </div>
        </div>
        <div style={{ width: 1, background: "rgba(255,255,255,0.1)" }} />
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 40, height: 16, borderRadius: 8,
            background: runner.light_color,
            boxShadow: `0 0 12px ${runner.light_color}aa`,
          }} />
          <div>
            <div style={{ color: MUTED, fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>LIGHT</div>
          </div>
        </div>
      </div>

      {/* Mitglied seit */}
      <div style={{
        textAlign: "center", color: MUTED, fontSize: 11, fontStyle: "italic",
      }}>
        Mitglied seit {memberSince}
      </div>
    </Modal>
  );
}

function RunnerStat({ emoji, value, label, unit, color }: {
  emoji: string; value: string; label: string; unit?: string; color: string;
}) {
  return (
    <div style={{
      padding: "12px 14px", borderRadius: 12,
      background: "rgba(70, 82, 122, 0.45)",
      border: "1px solid rgba(255,255,255,0.08)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
        <span style={{ fontSize: 16 }}>{emoji}</span>
        <span style={{ color: MUTED, fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>{label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
        <span style={{ color, fontSize: 20, fontWeight: 900 }}>{value}</span>
        {unit && <span style={{ color: MUTED, fontSize: 11, fontWeight: 600 }}>{unit}</span>}
      </div>
    </div>
  );
}

function TodayHero({ walking, currentStreet, currentDistance, runs, streak, teamColor, onSwitchToMap }: {
  walking: boolean;
  currentStreet: string | null;
  currentDistance: number;
  runs: Territory[];
  streak: number;
  teamColor: string;
  onSwitchToMap: () => void;
}) {
  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  const todayKey = now.toISOString().slice(0, 10);

  // KM heute
  const todayKm = runs
    .filter((r) => r.created_at.slice(0, 10) === todayKey)
    .reduce((s, r) => s + r.distance_m, 0) / 1000;

  // Wochen-Trend: km pro Tag letzte 7 Tage (älteste → heute)
  const weekKm: { label: string; km: number; isToday: boolean }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * msPerDay);
    const key = d.toISOString().slice(0, 10);
    const km = runs
      .filter((r) => r.created_at.slice(0, 10) === key)
      .reduce((s, r) => s + r.distance_m, 0) / 1000;
    weekKm.push({
      label: d.toLocaleDateString("de-DE", { weekday: "narrow" }),
      km,
      isToday: i === 0,
    });
  }
  const maxWeekKm = Math.max(0.1, ...weekKm.map((w) => w.km));
  const weekTotal = weekKm.reduce((s, w) => s + w.km, 0);

  // Live-km während Walk: distance ist in Metern
  const liveKm = currentDistance / 1000;

  return (
    <div style={{
      marginTop: 4,
      background: walking
        ? `linear-gradient(135deg, ${teamColor}25 0%, rgba(70, 82, 122, 0.5) 80%)`
        : "linear-gradient(135deg, rgba(34, 209, 195, 0.12) 0%, rgba(70, 82, 122, 0.5) 80%)",
      borderRadius: 20,
      border: walking ? `1px solid ${teamColor}88` : "1px solid rgba(255, 255, 255, 0.12)",
      boxShadow: walking
        ? `0 0 24px ${teamColor}55, inset 0 1px 0 rgba(255,255,255,0.08)`
        : "0 8px 24px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.08)",
      padding: 18,
      position: "relative", overflow: "hidden",
    }}>
      {/* Status-Zeile */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{
          width: 10, height: 10, borderRadius: 5,
          background: walking ? "#4ade80" : teamColor,
          boxShadow: walking ? "0 0 12px #4ade80, 0 0 24px #4ade8066" : `0 0 10px ${teamColor}99`,
          animation: walking ? "livePulse 1.4s ease-in-out infinite" : "none",
          flexShrink: 0,
        }} />
        <div style={{
          color: walking ? "#4ade80" : teamColor,
          fontSize: 11, fontWeight: 800, letterSpacing: 1.2, flexShrink: 0,
        }}>
          {walking ? "LÄUFT GERADE" : "BEREIT ZUM START"}
        </div>
        {walking && currentStreet && (
          <div style={{
            color: TEXT_SOFT, fontSize: 13, fontWeight: 600,
            flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            · {currentStreet}
          </div>
        )}
      </div>
      <style>{`@keyframes livePulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.4);opacity:0.55} }`}</style>

      {/* Haupt-Zahlen: Heute + Serie + Wochen-Trend */}
      <div style={{ display: "flex", gap: 18, alignItems: "flex-start", marginBottom: 16 }}>

        {/* Heute (großes km) */}
        <div style={{ flex: "0 0 auto" }}>
          <div style={{ color: MUTED, fontSize: 10, fontWeight: 800, letterSpacing: 1, marginBottom: 2 }}>
            {walking ? "JETZT" : "HEUTE"}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{
              fontSize: 38, fontWeight: 900, color: "#FFF", lineHeight: 1,
              textShadow: walking ? `0 0 16px ${teamColor}aa` : "none",
            }}>
              {(walking ? liveKm : todayKm).toFixed(1)}
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: MUTED }}>km</span>
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: 1, alignSelf: "stretch", background: "rgba(255,255,255,0.1)" }} />

        {/* Serie */}
        <div style={{ flex: "0 0 auto" }}>
          <div style={{ color: MUTED, fontSize: 10, fontWeight: 800, letterSpacing: 1, marginBottom: 2 }}>
            SERIE 🔥
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{
              fontSize: 38, fontWeight: 900, color: streak > 0 ? "#FFD700" : "#FFF", lineHeight: 1,
              textShadow: streak > 0 ? "0 0 14px rgba(255, 215, 0, 0.6)" : "none",
            }}>
              {streak}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: MUTED }}>
              {streak === 1 ? "Tag" : "Tage"}
            </span>
          </div>
        </div>

        {/* Wochen-Trend Mini-Chart */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4,
          }}>
            <span style={{ color: MUTED, fontSize: 10, fontWeight: 800, letterSpacing: 1 }}>DIESE WOCHE</span>
            <span style={{ color: teamColor, fontSize: 12, fontWeight: 800 }}>
              {weekTotal.toFixed(1)} km
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 44 }}>
            {weekKm.map((w, i) => {
              const h = w.km > 0 ? Math.max(10, (w.km / maxWeekKm) * 100) : 6;
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <div style={{
                    width: "100%", height: `${h}%`,
                    background: w.km > 0
                      ? `linear-gradient(180deg, ${teamColor}, ${teamColor}55)`
                      : "rgba(255,255,255,0.08)",
                    borderRadius: 2,
                    boxShadow: w.km > 0 ? `0 0 6px ${teamColor}99` : "none",
                    border: w.isToday ? `1px solid ${w.km > 0 ? "#FFF" : teamColor}` : "none",
                  }} />
                  <span style={{
                    fontSize: 8, color: w.isToday ? teamColor : MUTED,
                    fontWeight: w.isToday ? 800 : 600,
                  }}>{w.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* CTA Button */}
      <button
        onClick={onSwitchToMap}
        style={{
          width: "100%",
          padding: "13px 18px", borderRadius: 14,
          background: walking
            ? `linear-gradient(135deg, #4ade80, ${teamColor})`
            : `linear-gradient(135deg, ${teamColor}, ${PRIMARY})`,
          border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          color: BG_DEEP, fontSize: 15, fontWeight: 900, letterSpacing: 0.5,
          boxShadow: `0 8px 24px ${teamColor}55, inset 0 1px 0 rgba(255,255,255,0.3)`,
          transition: "transform 0.12s ease-out",
        }}
        onMouseDown={(e) => e.currentTarget.style.transform = "scale(0.98)"}
        onMouseUp={(e) => e.currentTarget.style.transform = "scale(1)"}
        onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
      >
        <span style={{ fontSize: 18 }}>{walking ? "🗺️" : "🏃"}</span>
        <span>{walking ? "ZUR KARTE — LAUF VERFOLGEN" : "JETZT LOSLAUFEN"}</span>
        <span style={{ fontSize: 16 }}>→</span>
      </button>
    </div>
  );
}

function AchievementRow({ icon, name, xp, unlocked, current, target, unit, pct, displayFmt }: {
  icon: string; name: string; xp: number; unlocked: boolean;
  current: number; target: number; unit: string; pct: number;
  displayFmt: (v: number) => string;
}) {
  const accent = unlocked ? "#FFD700" : PRIMARY;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 14px", borderRadius: 14,
      background: unlocked
        ? `linear-gradient(90deg, ${accent}26 0%, rgba(70, 82, 122, 0.5) 70%)`
        : "rgba(70, 82, 122, 0.4)",
      border: unlocked ? `1px solid ${accent}80` : "1px solid rgba(255,255,255,0.08)",
      boxShadow: unlocked ? `0 0 14px ${accent}33` : "none",
    }}>
      {/* Icon-Circle */}
      <div style={{
        width: 42, height: 42, borderRadius: 21,
        background: unlocked
          ? `radial-gradient(circle at 30% 30%, ${accent}55, ${accent}22)`
          : "rgba(255,255,255,0.05)",
        border: unlocked ? `1.5px solid ${accent}` : "1px solid rgba(255,255,255,0.15)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22, flexShrink: 0, position: "relative",
        filter: unlocked ? `drop-shadow(0 0 8px ${accent}aa)` : "grayscale(0.85) opacity(0.5)",
      }}>
        {icon}
        {!unlocked && (
          <div style={{
            position: "absolute", bottom: -3, right: -3,
            width: 18, height: 18, borderRadius: 9,
            background: "rgba(15,17,21,0.9)", border: "1px solid rgba(255,255,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 9,
          }}>🔒</div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <span style={{
            color: unlocked ? "#FFF" : TEXT_SOFT,
            fontSize: 14, fontWeight: 800,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>{name}</span>
          <span style={{ color: accent, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
            {displayFmt(current)} / {displayFmt(target)}{unit ? ` ${unit}` : ""}
          </span>
        </div>
        <div style={{
          marginTop: 6, height: 6, borderRadius: 3,
          background: "rgba(255,255,255,0.08)", overflow: "hidden",
        }}>
          <div style={{
            height: "100%", width: `${pct}%`,
            background: `linear-gradient(90deg, ${PRIMARY}, ${accent})`,
            borderRadius: 3,
            boxShadow: `0 0 8px ${accent}80`,
            transition: "width 0.8s ease-out",
          }} />
        </div>
      </div>

      {/* XP Badge */}
      <div style={{
        padding: "3px 8px", borderRadius: 10, flexShrink: 0,
        background: unlocked ? `${accent}35` : "rgba(255,255,255,0.06)",
        border: unlocked ? `1px solid ${accent}` : "1px solid rgba(255,255,255,0.1)",
      }}>
        <span style={{
          color: unlocked ? accent : MUTED,
          fontSize: 10, fontWeight: 800,
        }}>
          {unlocked ? "✓ " : ""}+{xp.toLocaleString()} XP
        </span>
      </div>
    </div>
  );
}

function MonthlyCalendar({ runs, color }: { runs: Territory[]; color: string }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastOfMonth.getDate();
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7; // Mo=0

  // km pro Tag aggregieren
  const kmMap = new Map<number, number>();
  for (const r of runs) {
    const d = new Date(r.created_at);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      kmMap.set(day, (kmMap.get(day) || 0) + r.distance_m);
    }
  }

  const intensity = (km: number): number => {
    if (km === 0) return 0;
    if (km < 1) return 1;
    if (km < 3) return 2;
    if (km < 6) return 3;
    return 4;
  };
  const bgFor = (lvl: number) => {
    if (lvl === 0) return "rgba(255,255,255,0.05)";
    const alpha = 0.25 + lvl * 0.2;
    return `${color}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
  };

  const monthName = firstOfMonth.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  const weekdays = ["M", "D", "M", "D", "F", "S", "S"];
  const todayDay = today.getDate();
  const activeDays = Array.from(kmMap.values()).filter((v) => v > 0).length;
  const totalKm = Array.from(kmMap.values()).reduce((s, v) => s + v, 0) / 1000;

  // Zellen
  const cells: (number | null)[] = Array(firstWeekday).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      {/* Header */}
      <div style={{ textAlign: "center" }}>
        <div style={{ color: "#FFF", fontSize: 16, fontWeight: 800, textTransform: "capitalize" }}>
          {monthName}
        </div>
        <div style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>
          {activeDays} aktive Tage · {totalKm.toFixed(1)} km
        </div>
      </div>

      {/* Grid */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {/* Wochentage */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 32px)", gap: 4 }}>
          {weekdays.map((w, i) => (
            <div key={i} style={{
              textAlign: "center", fontSize: 10, fontWeight: 700,
              color: MUTED, letterSpacing: 0.5,
            }}>{w}</div>
          ))}
        </div>
        {/* Tage */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 32px)", gap: 4 }}>
          {cells.map((day, i) => {
            if (day === null) return <div key={i} />;
            const km = (kmMap.get(day) || 0) / 1000;
            const isToday = day === todayDay;
            const isFuture = day > todayDay;
            return (
              <div
                key={i}
                title={km > 0 ? `${day}.: ${km.toFixed(2)} km` : `${day}.`}
                style={{
                  width: 32, height: 32, borderRadius: 6,
                  background: isFuture ? "rgba(255,255,255,0.03)" : bgFor(intensity(km)),
                  border: isToday ? `2px solid ${color}` : "1px solid rgba(255,255,255,0.06)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: km > 0 ? 800 : 500,
                  color: isFuture ? MUTED : (km > 0 ? "#FFF" : TEXT_SOFT),
                  boxShadow: km > 0 ? `0 0 6px ${color}66` : "none",
                  opacity: isFuture ? 0.35 : 1,
                }}
              >
                {day}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legende */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: MUTED }}>
        <span>Weniger</span>
        {[0, 1, 2, 3, 4].map((lvl) => (
          <div key={lvl} style={{ width: 10, height: 10, borderRadius: 2, background: bgFor(lvl) }} />
        ))}
        <span>Mehr</span>
      </div>
    </div>
  );
}


function StatBox({ emoji, value, label }: { emoji: string; value: string; label: string }) {
  return (
    <div style={{ background: "rgba(70, 82, 122, 0.45)", padding: 18, borderRadius: 16, border: "1px solid rgba(255, 255, 255, 0.1)" }}>
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
      borderBottom: last ? "none" : "1px solid rgba(255, 255, 255, 0.1)",
    }}>
      <span style={{ color: "#FFF", fontSize: 15 }}>{label}</span>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: 44, height: 26, borderRadius: 13,
          background: checked ? PRIMARY : "rgba(255, 255, 255, 0.1)",
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
      borderBottom: last ? "none" : "1px solid rgba(255, 255, 255, 0.1)",
    }}>
      <span style={{ color: "#FFF", fontSize: 15 }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: "rgba(255, 255, 255, 0.1)", color: "#FFF", border: "none",
          padding: "6px 12px", borderRadius: 8, fontSize: 13,
          cursor: "pointer",
        }}
      >
        {options.map((o) => (
          <option key={o.id} value={o.id} style={{ background: "rgba(255, 255, 255, 0.1)" }}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div style={{
      width: "100%", marginBottom: 10, marginTop: 25,
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
    }}>
      <div style={{ fontSize: 12, color: PRIMARY, fontWeight: "bold", letterSpacing: 1.5 }}>{title}</div>
      {action}
    </div>
  );
}

function ModalTriggerButton({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 20px", borderRadius: 18,
        background: "rgba(70, 82, 122, 0.45)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        cursor: "pointer", color: "#FFF", fontSize: 15, fontWeight: 600,
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        {label}
      </span>
      <span style={{ color: MUTED, fontSize: 20 }}>›</span>
    </button>
  );
}

function AccountRow({ label, onClick, danger, last }: { label: string; onClick: () => void; danger?: boolean; last?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "16px 20px",
        background: "transparent", border: "none", cursor: "pointer", textAlign: "left",
        borderBottom: last ? "none" : "1px solid rgba(255, 255, 255, 0.1)",
      }}
    >
      <span style={{
        color: danger ? ACCENT : "#FFF", fontSize: 15, fontWeight: danger ? "bold" : 500,
      }}>{label}</span>
      {!danger && <span style={{ color: MUTED }}>›</span>}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════
 * HEALTH DASHBOARD — vollständiges Fitness-Statistik-Modal
 * ═══════════════════════════════════════════════════════ */

type HealthPeriod = "week" | "month" | "year" | "all";

function HealthDashboard({ profile: p, runs, territoryCount, teamColor, achievements }: {
  profile: Profile | null;
  runs: Territory[];
  territoryCount: number;
  teamColor: string;
  achievements: Array<{ id: string; name: string; icon: string; unlocked: boolean; pct: number; current: number; target: number; unit: string; xp: number; displayFmt: (v: number) => string }>;
}) {
  const [period, setPeriod] = useState<HealthPeriod>("month");
  const [weeklyGoalKm, setWeeklyGoalKm] = useState<number>(() => {
    if (typeof window === "undefined") return 10;
    return Number(localStorage.getItem("health_weekly_goal_km") || 10);
  });

  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;

  // Perioden-Grenzen
  const periodDays = period === "week" ? 7 : period === "month" ? 30 : period === "year" ? 365 : 365 * 10;
  const periodStart = new Date(now.getTime() - periodDays * msPerDay);
  const prevPeriodStart = new Date(now.getTime() - 2 * periodDays * msPerDay);

  const inPeriod = runs.filter((r) => new Date(r.created_at) >= periodStart);
  const inPrevPeriod = runs.filter((r) => {
    const d = new Date(r.created_at);
    return d >= prevPeriodStart && d < periodStart;
  });

  const sumKm = (arr: Territory[]) => arr.reduce((s, r) => s + r.distance_m, 0) / 1000;
  const sumSec = (arr: Territory[]) => arr.reduce((s, r) => s + r.duration_s, 0);

  const kmNow = sumKm(inPeriod);
  const kmPrev = sumKm(inPrevPeriod);
  const walksNow = inPeriod.length;
  const walksPrev = inPrevPeriod.length;

  // Kcal-Schätzung: ~70 kcal pro km (moderates Joggen, 70kg)
  const kcalNow = kmNow * 70;
  const kcalPrev = kmPrev * 70;

  const secNow = sumSec(inPeriod);
  const secPrev = sumSec(inPrevPeriod);

  const uniqueDaysNow = new Set(inPeriod.map((r) => r.created_at.slice(0, 10))).size;

  // Lauf-Stats
  const avgDistance = walksNow > 0 ? kmNow / walksNow : 0;
  const avgDurationMin = walksNow > 0 ? secNow / walksNow / 60 : 0;
  const avgPaceMinPerKm = kmNow > 0 ? (secNow / 60) / kmNow : 0;
  const longest = inPeriod.reduce((max, r) => r.distance_m > max ? r.distance_m : max, 0) / 1000;
  const shortest = inPeriod.length > 0 ? inPeriod.reduce((min, r) => r.distance_m < min ? r.distance_m : min, Infinity) / 1000 : 0;
  const fastestPace = inPeriod.reduce((best, r) => {
    if (r.distance_m < 500) return best; // Nur relevante Distanzen
    const pace = (r.duration_s / 60) / (r.distance_m / 1000);
    return pace < best ? pace : best;
  }, Infinity);

  // Tageszeit-Verteilung (4 Slots)
  const timeSlots = { morgens: 0, mittags: 0, abends: 0, nachts: 0 };
  inPeriod.forEach((r) => {
    const h = new Date(r.created_at).getHours();
    if (h >= 5 && h < 11) timeSlots.morgens++;
    else if (h >= 11 && h < 17) timeSlots.mittags++;
    else if (h >= 17 && h < 22) timeSlots.abends++;
    else timeSlots.nachts++;
  });

  // Wochentag-Verteilung
  const weekdayData = [0, 0, 0, 0, 0, 0, 0]; // Mo=0
  inPeriod.forEach((r) => {
    const wd = (new Date(r.created_at).getDay() + 6) % 7;
    weekdayData[wd] += r.distance_m / 1000;
  });

  // Chart-Daten: Balken über Zeitraum
  const chartBuckets = period === "week" ? 7 : period === "month" ? 30 : 12;
  const bucketKm: number[] = new Array(chartBuckets).fill(0);
  const bucketLabels: string[] = [];
  if (period === "year") {
    // 12 Monate
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      bucketLabels.push(d.toLocaleDateString("de-DE", { month: "short" }));
    }
    inPeriod.forEach((r) => {
      const d = new Date(r.created_at);
      const mDiff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      const idx = 11 - mDiff;
      if (idx >= 0 && idx < 12) bucketKm[idx] += r.distance_m / 1000;
    });
  } else {
    // Tages-Buckets
    for (let i = chartBuckets - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * msPerDay);
      bucketLabels.push(d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }));
    }
    inPeriod.forEach((r) => {
      const d = new Date(r.created_at);
      const daysAgo = Math.floor((now.getTime() - d.getTime()) / msPerDay);
      const idx = chartBuckets - 1 - daysAgo;
      if (idx >= 0 && idx < chartBuckets) bucketKm[idx] += r.distance_m / 1000;
    });
  }
  const maxBucket = Math.max(1, ...bucketKm);

  // Weekly-Goal Progress (letzte 7 Tage)
  const last7Days = runs.filter((r) => new Date(r.created_at) >= new Date(now.getTime() - 7 * msPerDay));
  const weeklyKm = sumKm(last7Days);
  const weeklyPct = Math.min(100, (weeklyKm / weeklyGoalKm) * 100);

  // Lifetime Total für Äquivalente
  const lifetimeKm = (p?.total_distance_m || 0) / 1000;
  const lifetimeKcal = p?.total_calories || Math.round(lifetimeKm * 70);
  const estimatedSteps = Math.round(lifetimeKm * 1300);
  const savedCo2Kg = (lifetimeKm * 120) / 1000; // 120g/km vs Auto

  // Achievements: nächste 3 die am nächsten am Unlock sind
  const nextMilestones = achievements
    .filter((a) => !a.unlocked)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 3);

  const deltaPct = (n: number, prev: number) => {
    if (prev === 0 && n === 0) return 0;
    if (prev === 0) return 100;
    return Math.round(((n - prev) / prev) * 100);
  };

  const periodLabel: Record<HealthPeriod, string> = {
    week: "7 Tage",
    month: "30 Tage",
    year: "12 Monate",
    all: "Gesamt",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ═══ Period-Tabs ═══ */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6,
        background: "rgba(70, 82, 122, 0.45)", borderRadius: 14, padding: 4,
      }}>
        {(["week", "month", "year", "all"] as HealthPeriod[]).map((pp) => (
          <button
            key={pp}
            onClick={() => setPeriod(pp)}
            style={{
              padding: "8px 4px", borderRadius: 11, border: "none", cursor: "pointer",
              background: period === pp
                ? `linear-gradient(135deg, ${PRIMARY}, ${teamColor})`
                : "transparent",
              color: period === pp ? BG_DEEP : TEXT_SOFT,
              fontSize: 12, fontWeight: 800,
              boxShadow: period === pp ? `0 4px 14px ${PRIMARY}50` : "none",
              transition: "all 0.15s",
            }}
          >
            {periodLabel[pp]}
          </button>
        ))}
      </div>

      {/* ═══ Haupt-Kennzahlen mit Delta ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <HealthHeroStat emoji="📏" value={kmNow.toFixed(1)} unit="km" label="Gelaufen" delta={deltaPct(kmNow, kmPrev)} color={PRIMARY} />
        <HealthHeroStat emoji="🏃" value={walksNow.toString()} unit="" label="Läufe" delta={deltaPct(walksNow, walksPrev)} color="#5ddaf0" />
        <HealthHeroStat emoji="🔥" value={Math.round(kcalNow).toLocaleString()} unit="kcal" label="Verbrannt" delta={deltaPct(kcalNow, kcalPrev)} color="#FF6B4A" />
        <HealthHeroStat emoji="📅" value={uniqueDaysNow.toString()} unit={`/ ${periodDays}`} label="Aktive Tage" delta={0} color="#FFD700" hideDelta />
      </div>

      {/* ═══ Chart: km-Verlauf ═══ */}
      <HealthSection title="KM-VERLAUF" emoji="📈">
        <div style={{
          display: "flex", alignItems: "flex-end", gap: 3,
          height: 130, padding: "10px 4px 0",
        }}>
          {bucketKm.map((km, i) => (
            <div
              key={i}
              title={`${bucketLabels[i]}: ${km.toFixed(2)} km`}
              style={{
                flex: 1,
                height: `${Math.max(2, (km / maxBucket) * 100)}%`,
                background: km > 0
                  ? `linear-gradient(180deg, ${teamColor}, ${teamColor}66)`
                  : "rgba(255,255,255,0.06)",
                borderRadius: 3,
                boxShadow: km > 0 ? `0 0 6px ${teamColor}aa` : "none",
                minHeight: 2,
                transition: "height 0.5s ease-out",
              }}
            />
          ))}
        </div>
        <div style={{
          display: "flex", justifyContent: "space-between",
          marginTop: 6, fontSize: 9, color: MUTED,
        }}>
          <span>{bucketLabels[0]}</span>
          <span>Heute</span>
        </div>
      </HealthSection>

      {/* ═══ Wöchentliches Ziel ═══ */}
      <HealthSection title="WÖCHENTLICHES ZIEL" emoji="🎯" action={
        <div style={{ display: "flex", gap: 4 }}>
          {[5, 10, 20, 50].map((g) => (
            <button
              key={g}
              onClick={() => {
                setWeeklyGoalKm(g);
                if (typeof window !== "undefined") localStorage.setItem("health_weekly_goal_km", String(g));
              }}
              style={{
                padding: "3px 8px", borderRadius: 8,
                background: weeklyGoalKm === g ? `${PRIMARY}33` : "rgba(255,255,255,0.05)",
                border: weeklyGoalKm === g ? `1px solid ${PRIMARY}` : "1px solid rgba(255,255,255,0.1)",
                color: weeklyGoalKm === g ? PRIMARY : MUTED,
                fontSize: 10, fontWeight: 800, cursor: "pointer",
              }}
            >
              {g}km
            </button>
          ))}
        </div>
      }>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ color: "#FFF", fontSize: 22, fontWeight: 900 }}>
            {weeklyKm.toFixed(1)} / {weeklyGoalKm} km
          </span>
          <span style={{ color: weeklyPct >= 100 ? "#4ade80" : PRIMARY, fontSize: 15, fontWeight: 800, alignSelf: "center" }}>
            {weeklyPct >= 100 ? "✓ Geschafft!" : `${Math.round(weeklyPct)}%`}
          </span>
        </div>
        <div style={{ height: 10, borderRadius: 5, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${weeklyPct}%`,
            background: weeklyPct >= 100
              ? "linear-gradient(90deg, #4ade80, #22D1C3)"
              : `linear-gradient(90deg, ${PRIMARY}, ${ACCENT})`,
            borderRadius: 5,
            boxShadow: `0 0 10px ${PRIMARY}80`,
            transition: "width 0.8s ease-out",
          }} />
        </div>
      </HealthSection>

      {/* ═══ Lauf-Statistiken ═══ */}
      <HealthSection title="LAUF-STATISTIKEN" emoji="🏃">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <MiniStat label="Ø Distanz" value={avgDistance.toFixed(1)} unit="km" />
          <MiniStat label="Ø Dauer" value={avgDurationMin.toFixed(0)} unit="min" />
          <MiniStat label="Ø Pace" value={avgPaceMinPerKm > 0 ? avgPaceMinPerKm.toFixed(1) : "—"} unit="min/km" />
          <MiniStat label="Längster" value={longest.toFixed(1)} unit="km" />
          <MiniStat label="Kürzester" value={shortest > 0 ? shortest.toFixed(1) : "—"} unit="km" />
          <MiniStat label="Schnellste" value={isFinite(fastestPace) ? fastestPace.toFixed(1) : "—"} unit="min/km" />
        </div>
      </HealthSection>

      {/* ═══ Wochentag-Verteilung ═══ */}
      <HealthSection title="WANN LÄUFST DU?" emoji="📆">
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100, marginBottom: 6 }}>
          {weekdayData.map((km, i) => {
            const max = Math.max(0.1, ...weekdayData);
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ fontSize: 9, color: MUTED, fontWeight: 700 }}>{km.toFixed(1)}</div>
                <div style={{
                  width: "100%", height: `${Math.max(4, (km / max) * 100)}%`, minHeight: 4,
                  background: km > 0
                    ? `linear-gradient(180deg, ${teamColor}, ${teamColor}55)`
                    : "rgba(255,255,255,0.05)",
                  borderRadius: 4,
                  boxShadow: km > 0 ? `0 0 6px ${teamColor}66` : "none",
                }} />
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d, i) => (
            <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 10, color: MUTED, fontWeight: 700 }}>{d}</div>
          ))}
        </div>
      </HealthSection>

      {/* ═══ Tageszeit-Verteilung ═══ */}
      <HealthSection title="TAGESZEIT" emoji="🌅">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
          <TimeSlot icon="🌅" label="Morgens" count={timeSlots.morgens} total={walksNow} color="#FFD700" />
          <TimeSlot icon="☀️" label="Mittags" count={timeSlots.mittags} total={walksNow} color="#FF6B4A" />
          <TimeSlot icon="🌆" label="Abends" count={timeSlots.abends} total={walksNow} color="#a855f7" />
          <TimeSlot icon="🌙" label="Nachts" count={timeSlots.nachts} total={walksNow} color="#5ddaf0" />
        </div>
      </HealthSection>

      {/* ═══ Kalorien & Äquivalente ═══ */}
      <HealthSection title="KALORIEN-ÄQUIVALENTE" emoji="🍕" subtitle={`Lifetime: ${lifetimeKcal.toLocaleString()} kcal`}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Equivalent icon="🍕" count={(lifetimeKcal / 285).toFixed(1)} label="Pizza-Stücke" />
          <Equivalent icon="🍌" count={Math.round(lifetimeKcal / 105).toString()} label="Bananen" />
          <Equivalent icon="🍫" count={Math.round(lifetimeKcal / 235).toString()} label="Schokoriegel" />
          <Equivalent icon="🥨" count={Math.round(lifetimeKcal / 340).toString()} label="Brezeln" />
        </div>
      </HealthSection>

      {/* ═══ Geografie & Umwelt ═══ */}
      <HealthSection title="GEOGRAFIE & UMWELT" emoji="🌍">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <MiniStat label="Territorien" value={territoryCount.toString()} unit="" big />
          <MiniStat label="Einzigartige Straßen" value={new Set(runs.map((r) => r.street_name).filter(Boolean)).size.toString()} unit="" big />
          <MiniStat label="Geschätzte Schritte" value={estimatedSteps.toLocaleString()} unit="" big />
          <MiniStat label="CO₂-Ersparnis" value={savedCo2Kg.toFixed(1)} unit="kg" big />
        </div>
        <div style={{
          marginTop: 10, padding: "10px 12px", borderRadius: 12,
          background: "rgba(34, 209, 195, 0.08)",
          border: "1px solid rgba(34, 209, 195, 0.2)",
          fontSize: 11, color: TEXT_SOFT, lineHeight: 1.5,
        }}>
          💚 Du hast {savedCo2Kg.toFixed(1)} kg CO₂ eingespart, indem du nicht Auto gefahren bist. Das entspricht ca. {(savedCo2Kg / 0.12).toFixed(0)} km nicht-gefahrener Strecke im Schnitt-PKW.
        </div>
      </HealthSection>

      {/* ═══ Nächste Meilensteine ═══ */}
      {nextMilestones.length > 0 && (
        <HealthSection title="NÄCHSTE MEILENSTEINE" emoji="🎖️">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {nextMilestones.map((m) => (
              <div key={m.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 12,
                background: "rgba(70, 82, 122, 0.45)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}>
                <span style={{ fontSize: 22 }}>{m.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ color: "#FFF", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</span>
                    <span style={{ color: PRIMARY, fontSize: 11, fontWeight: 800 }}>
                      {m.displayFmt(m.current)} / {m.displayFmt(m.target)}{m.unit ? ` ${m.unit}` : ""}
                    </span>
                  </div>
                  <div style={{ marginTop: 4, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                    <div style={{
                      height: "100%", width: `${m.pct}%`,
                      background: `linear-gradient(90deg, ${PRIMARY}, #FFD700)`,
                      borderRadius: 3, boxShadow: `0 0 6px ${PRIMARY}88`,
                    }} />
                  </div>
                </div>
                <span style={{ color: "#FFD700", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>+{m.xp.toLocaleString()} XP</span>
              </div>
            ))}
          </div>
        </HealthSection>
      )}

      {/* ═══ Medizinischer Disclaimer ═══ */}
      <div style={{
        padding: "10px 12px", borderRadius: 12,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.06)",
        fontSize: 10.5, color: MUTED, lineHeight: 1.5, fontStyle: "italic",
      }}>
        ℹ️ Kalorien- und Schritt-Angaben sind Schätzwerte auf Basis deiner gelaufenen Distanz (~70 kcal/km, ~1.300 Schritte/km). Für medizinisch relevante Daten nutze zertifizierte Geräte.
      </div>
    </div>
  );
}

function HealthHeroStat({ emoji, value, unit, label, delta, color, hideDelta }: {
  emoji: string; value: string; unit: string; label: string; delta: number; color: string; hideDelta?: boolean;
}) {
  const deltaColor = delta > 0 ? "#4ade80" : delta < 0 ? "#FF6B4A" : MUTED;
  return (
    <div style={{
      background: `linear-gradient(135deg, ${color}15 0%, rgba(70, 82, 122, 0.5) 70%)`,
      padding: 14, borderRadius: 14,
      border: `1px solid ${color}44`,
      boxShadow: `0 0 14px ${color}22`,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 22 }}>{emoji}</span>
        {!hideDelta && delta !== 0 && (
          <span style={{
            fontSize: 10, fontWeight: 800, color: deltaColor,
            padding: "2px 6px", borderRadius: 8,
            background: `${deltaColor}18`, border: `1px solid ${deltaColor}55`,
          }}>
            {delta > 0 ? "↑" : "↓"} {Math.abs(delta)}%
          </span>
        )}
      </div>
      <div style={{ display: "baseline", gap: 4 }}>
        <span style={{ fontSize: 26, fontWeight: 900, color: "#FFF" }}>{value}</span>
        {unit && <span style={{ fontSize: 12, color: MUTED, fontWeight: 700, marginLeft: 4 }}>{unit}</span>}
      </div>
      <div style={{ fontSize: 11, color: MUTED, marginTop: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
    </div>
  );
}

function HealthSection({ title, emoji, subtitle, action, children }: {
  title: string; emoji?: string; subtitle?: string;
  action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div style={{
      background: "rgba(70, 82, 122, 0.38)",
      borderRadius: 14, padding: 14,
      border: "1px solid rgba(255,255,255,0.08)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: PRIMARY, fontWeight: 800, letterSpacing: 1 }}>
            {emoji && <span style={{ marginRight: 6 }}>{emoji}</span>}
            {title}
          </div>
          {subtitle && <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{subtitle}</div>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function MiniStat({ label, value, unit, big }: { label: string; value: string; unit: string; big?: boolean }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      padding: big ? "10px 12px" : "8px 10px",
      borderRadius: 10,
      border: "1px solid rgba(255,255,255,0.06)",
    }}>
      <div style={{ fontSize: 10, color: MUTED, fontWeight: 600, marginBottom: 3 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
        <span style={{ fontSize: big ? 18 : 15, fontWeight: 900, color: "#FFF" }}>{value}</span>
        {unit && <span style={{ fontSize: 10, color: MUTED, fontWeight: 600 }}>{unit}</span>}
      </div>
    </div>
  );
}

function TimeSlot({ icon, label, count, total, color }: {
  icon: string; label: string; count: number; total: number; color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div style={{
      padding: 10, borderRadius: 12,
      background: count > 0 ? `${color}15` : "rgba(255,255,255,0.04)",
      border: count > 0 ? `1px solid ${color}55` : "1px solid rgba(255,255,255,0.06)",
      textAlign: "center",
    }}>
      <div style={{ fontSize: 20, marginBottom: 3 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 900, color: count > 0 ? color : MUTED }}>{count}</div>
      <div style={{ fontSize: 9, color: MUTED, marginTop: 2, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 9, color: count > 0 ? color : MUTED, fontWeight: 700, marginTop: 2 }}>{Math.round(pct)}%</div>
    </div>
  );
}

function Equivalent({ icon, count, label }: { icon: string; count: string; label: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 12px", borderRadius: 12,
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.06)",
    }}>
      <span style={{ fontSize: 24 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 18, fontWeight: 900, color: "#FFD700" }}>{count}</div>
        <div style={{ fontSize: 10, color: MUTED, fontWeight: 600 }}>{label}</div>
      </div>
    </div>
  );
}

function XpGuideSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 13, color: PRIMARY, fontWeight: "bold", letterSpacing: 1, marginBottom: 8 }}>
        {title}
      </div>
      <div style={{
        background: "rgba(70, 82, 122, 0.45)",
        borderRadius: 14, overflow: "hidden",
        border: "1px solid rgba(255, 255, 255, 0.1)",
      }}>
        {children}
      </div>
    </div>
  );
}

function XpGuideRow({ icon, label, xp, last }: { icon: string; label: string; xp: string; last?: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 16px",
      borderBottom: last ? "none" : "1px solid rgba(255, 255, 255, 0.08)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ color: "#FFF", fontSize: 14 }}>{label}</span>
      </div>
      <span style={{ color: "#FFD700", fontSize: 14, fontWeight: "bold" }}>{xp}</span>
    </div>
  );
}

function Modal({ title, icon, subtitle, accent, children, onClose }: {
  title: string;
  icon?: string;
  subtitle?: string;
  accent?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const accentColor = accent || PRIMARY;

  // Escape zum Schließen
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "radial-gradient(at 50% 50%, rgba(15, 26, 52, 0.85), rgba(8, 12, 24, 0.92))",
        backdropFilter: "blur(14px) saturate(150%)",
        WebkitBackdropFilter: "blur(14px) saturate(150%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px",
        animation: "modalBackdropFade 0.22s ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 540,
          maxHeight: "90dvh",
          position: "relative",
          background: `
            radial-gradient(at 0% 0%, ${accentColor}22 0%, transparent 45%),
            radial-gradient(at 100% 100%, ${ACCENT}18 0%, transparent 50%),
            linear-gradient(180deg, rgba(45, 58, 90, 0.94), rgba(26, 36, 58, 0.96))
          `,
          backdropFilter: "blur(30px) saturate(180%)",
          WebkitBackdropFilter: "blur(30px) saturate(180%)",
          borderRadius: 24,
          border: "1px solid rgba(255, 255, 255, 0.16)",
          overflow: "hidden",
          boxShadow: `
            0 30px 80px rgba(0, 0, 0, 0.55),
            0 0 0 1px rgba(255, 255, 255, 0.04),
            inset 0 1px 0 rgba(255, 255, 255, 0.12)
          `,
          animation: "modalScaleIn 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Top Accent Gradient Bar */}
        <div style={{
          height: 3,
          background: `linear-gradient(90deg, transparent 0%, ${accentColor} 20%, ${ACCENT} 80%, transparent 100%)`,
          boxShadow: `0 0 12px ${accentColor}88`,
        }} />

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 14,
          padding: "20px 22px 16px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        }}>
          {icon && (
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: `linear-gradient(135deg, ${accentColor}44, ${accentColor}18)`,
              border: `1px solid ${accentColor}66`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24,
              boxShadow: `0 0 18px ${accentColor}40, inset 0 1px 0 rgba(255,255,255,0.15)`,
              flexShrink: 0,
            }}>{icon}</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{
              color: "#FFF", fontSize: 20, fontWeight: 900, margin: 0,
              letterSpacing: 0.3,
            }}>{title}</h2>
            {subtitle && (
              <div style={{
                color: MUTED, fontSize: 12, marginTop: 3, fontWeight: 500,
              }}>{subtitle}</div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              width: 36, height: 36, borderRadius: 12,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#FFF", fontSize: 22, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
          >×</button>
        </div>

        {/* Body */}
        <div style={{
          padding: "20px 22px 26px",
          overflowY: "auto",
          flex: 1,
        }}>
          {children}
        </div>
      </div>

      <style>{`
        @keyframes modalBackdropFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalScaleIn {
          from { opacity: 0; transform: scale(0.92) translateY(12px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
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
                color: BG_DEEP, fontWeight: "bold", fontSize: 16,
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
                color: BG_DEEP, fontWeight: "bold", fontSize: 16,
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
                  color: BG_DEEP, fontWeight: "bold", border: "none", cursor: "pointer",
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
              color: BG_DEEP, fontWeight: "bold", fontSize: 15,
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
