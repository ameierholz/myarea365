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
  generateDemoRecentRuns,
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
  const pctToNext = nextRank
    ? Math.round(((userXp - currentRankLive.minXp) / (nextRank.minXp - currentRankLive.minXp)) * 100)
    : 100;

  // Current marker icon
  const currentMarker = UNLOCKABLE_MARKERS.find((m) => m.id === equippedMarker) || UNLOCKABLE_MARKERS[0];
  const currentLight = RUNNER_LIGHTS.find((l) => l.id === equippedLight) || RUNNER_LIGHTS[0];

  const avgPace = p?.total_distance_m && p.total_distance_m > 0 && p.total_walks > 0
    ? ((p.total_walks * 60) / (p.total_distance_m / 1000)).toFixed(1)
    : "—";
  const longestKm = ((p?.longest_run_m || 0) / 1000).toFixed(1);

  const [openModal, setOpenModal] = useState<null | "health" | "settings" | "account" | "xpguide">(null);

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
    "Stadt-Pionier":      "Ich erkunde, was andere übersehen.",
    "Viertel-Boss":       "Mein Kiez, meine Regeln.",
    "Metropolen-Legende": "Die Stadt gehört denen, die sie erlaufen.",
  };
  const motto = mottos[currentRankLive.name] || mottos["Straßen-Scout"];

  // Achievements: Unlock-Status live berechnen aus Profilstats
  const achievementStatus = ACHIEVEMENTS.map((a) => {
    const lifetimeKm = (p?.total_distance_m || 0) / 1000;
    const longestKmNum = (p?.longest_run_m || 0) / 1000;
    let current = 0, target = 1, unit = "", displayFmt = (v: number) => v.toFixed(0);
    switch (a.id) {
      case "first_5k":
        current = longestKmNum; target = 5; unit = "km"; displayFmt = (v) => v.toFixed(1); break;
      case "first_10k":
        current = longestKmNum; target = 10; unit = "km"; displayFmt = (v) => v.toFixed(1); break;
      case "ten_territories":
        current = effectiveTerritoryCount; target = 10; unit = ""; break;
      case "streak_30":
        current = p?.streak_best || 0; target = 30; unit = "Tage"; break;
      case "lifetime_100k":
        current = lifetimeKm; target = 100; unit = "km"; displayFmt = (v) => v.toFixed(1); break;
      case "hundred_territories":
        current = effectiveTerritoryCount; target = 100; unit = ""; break;
    }
    const pct = Math.min(100, (current / target) * 100);
    const unlocked = current >= target;
    return { ...a, unlocked, current, target, unit, pct, displayFmt };
  });
  const achievementsUnlocked = achievementStatus.filter((a) => a.unlocked).length;

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

          {/* Next Rank Hint */}
          {nextRank && (
            <div style={{ color: MUTED, fontSize: 11, marginTop: 10, textAlign: "center" }}>
              <span style={{ color: nextRank.color, fontWeight: "bold" }}>→ {nextRank.name}</span>
              <span> in {xpToNext.toLocaleString()} XP</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ paddingLeft: 20, paddingRight: 20 }}>

        {/* QUICK STATS ROW — mit animiertem Zähler */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 6 }}>
          <QuickStat value={effectiveTerritoryCount.toString()} targetNumber={effectiveTerritoryCount} label="Territorien" color={teamColor} />
          <QuickStat value={(p?.total_walks || 0).toString()} targetNumber={p?.total_walks || 0} label="Läufe" color={PRIMARY} />
          <QuickStat value={((p?.total_distance_m || 0) / 1000).toFixed(1)} targetNumber={(p?.total_distance_m || 0) / 1000} decimals={1} label="km" color={ACCENT} />
          <QuickStat value={(p?.streak_days || 0).toString()} targetNumber={p?.streak_days || 0} label="Serie 🔥" color="#FFD700" />
        </div>

        {/* ═══ PERSÖNLICHE REKORDE ═══ */}
        <SectionHeader title="PERSÖNLICHE REKORDE" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <RecordCard emoji="📏" label="Längster Lauf" value={`${longestKm} km`} color={PRIMARY} />
          <RecordCard emoji="🔥" label="Beste Serie" value={`${p?.streak_best || 0} Tage`} color="#FFD700" />
          <RecordCard emoji="🏆" label="Territorien gesamt" value={effectiveTerritoryCount.toString()} color={teamColor} />
          <RecordCard emoji="🌍" label="Gesamt-KM" value={((p?.total_distance_m || 0) / 1000).toFixed(1)} color={ACCENT} />
        </div>

        {/* ═══ ERFOLGE ═══ */}
        <SectionHeader
          title="ERFOLGE"
          action={
            <span style={{
              color: PRIMARY, fontSize: 13, fontWeight: 800,
              background: `${PRIMARY}22`, border: `1px solid ${PRIMARY}55`,
              borderRadius: 12, padding: "4px 10px",
            }}>
              {achievementsUnlocked} / {ACHIEVEMENTS.length}
            </span>
          }
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {achievementStatus.map((a) => (
            <AchievementBadge
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

        {/* ═══ AKTIVITÄT (kompakt) ═══ */}
        <SectionHeader title="AKTIVITÄT · 13 WOCHEN" />
        <div style={{
          background: "rgba(70, 82, 122, 0.45)", borderRadius: 14, padding: 12,
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}>
          <CalendarHeatmap runs={effectiveRecentRuns} color={teamColor} />
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

        {/* ═══ LIVE STATUS ═══ */}
        <SectionHeader title="LIVE STATUS" />
        <div style={{
          background: walking ? `${teamColor}15` : "rgba(70, 82, 122, 0.45)",
          padding: 20, borderRadius: 18, width: "100%",
          border: walking ? `1px solid ${teamColor}` : "1px solid rgba(255, 255, 255, 0.1)",
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
        <Modal title="Gesundheitsdaten" onClose={() => setOpenModal(null)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <StatBox emoji="👣" value={((p?.total_distance_m || 0) / 1000).toFixed(1)} label="KM gesamt" />
            <StatBox emoji="🔥" value={(p?.total_calories || 0).toLocaleString()} label="KCAL verbrannt" />
            <StatBox emoji="🏃" value={(p?.total_walks || 0).toString()} label="Läufe" />
            <StatBox emoji="⚡" value={`${p?.streak_days || 0} Tage`} label="Aktuelle Serie" />
            <StatBox emoji="🏆" value={`${p?.streak_best || 0} Tage`} label="Beste Serie" />
            <StatBox emoji="📏" value={`${longestKm} km`} label="Längster Lauf" />
            <StatBox emoji="⏱" value={avgPace + "'"} label="Ø Pace/km" />
            <StatBox emoji="🎯" value={effectiveTerritoryCount.toString()} label="Territorien" />
          </div>
        </Modal>
      )}

      {openModal === "settings" && (
        <Modal title="Einstellungen" onClose={() => setOpenModal(null)}>
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
        <Modal title="Account" onClose={() => setOpenModal(null)}>
          <div style={{ background: "rgba(70, 82, 122, 0.45)", borderRadius: 18, overflow: "hidden", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
            <AccountRow label="✏️ Profil bearbeiten" onClick={() => alert("Profil bearbeiten – kommt bald")} />
            <AccountRow label="🔒 Privatsphäre & Daten" onClick={() => alert("Privatsphäre – kommt bald")} />
            <AccountRow label="❓ Hilfe & Support" onClick={() => alert("Hilfe – kommt bald")} />
            <AccountRow label="🚪 Ausloggen" onClick={onLogout} danger last />
          </div>
        </Modal>
      )}

      {openModal === "xpguide" && (
        <Modal title="Wofür gibt es XP?" onClose={() => setOpenModal(null)}>
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

function AchievementBadge({ icon, name, xp, unlocked, current, target, unit, pct, displayFmt }: {
  icon: string; name: string; xp: number; unlocked: boolean;
  current: number; target: number; unit: string; pct: number;
  displayFmt: (v: number) => string;
}) {
  const accentColor = unlocked ? "#FFD700" : PRIMARY;
  return (
    <div style={{
      background: unlocked
        ? `linear-gradient(135deg, ${accentColor}28 0%, rgba(70, 82, 122, 0.55) 60%)`
        : "rgba(70, 82, 122, 0.38)",
      padding: 16, borderRadius: 18,
      border: unlocked ? `1px solid ${accentColor}88` : "1px solid rgba(255,255,255,0.08)",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
      position: "relative", overflow: "hidden",
      boxShadow: unlocked
        ? `0 0 20px ${accentColor}40, inset 0 1px 0 rgba(255,255,255,0.1)`
        : "inset 0 1px 0 rgba(255,255,255,0.04)",
    }}>
      {/* Unlocked Shine-Effekt oben */}
      {unlocked && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 40,
          background: `radial-gradient(ellipse at 50% 0%, ${accentColor}50, transparent 70%)`,
          pointerEvents: "none",
        }} />
      )}

      {/* Badge-Icon in Kreis */}
      <div style={{
        width: 54, height: 54, borderRadius: 27,
        background: unlocked
          ? `radial-gradient(circle at 30% 30%, ${accentColor}55, ${accentColor}22)`
          : "rgba(255,255,255,0.05)",
        border: unlocked ? `2px solid ${accentColor}` : "1.5px solid rgba(255,255,255,0.15)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 28,
        filter: unlocked
          ? `drop-shadow(0 0 10px ${accentColor}aa)`
          : "grayscale(0.85) opacity(0.4)",
        position: "relative", zIndex: 1,
      }}>
        {icon}
        {!unlocked && (
          <div style={{
            position: "absolute", bottom: -4, right: -4,
            width: 22, height: 22, borderRadius: 11,
            background: "rgba(15, 17, 21, 0.9)",
            border: "1px solid rgba(255,255,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11,
          }}>🔒</div>
        )}
      </div>

      {/* Name */}
      <div style={{
        color: unlocked ? "#FFF" : TEXT_SOFT,
        fontSize: 13, fontWeight: 800, textAlign: "center",
        lineHeight: 1.2, minHeight: 32, display: "flex", alignItems: "center",
      }}>{name}</div>

      {/* Progress */}
      <div style={{ width: "100%", marginTop: 2 }}>
        <div style={{
          height: 6, borderRadius: 3,
          background: "rgba(255,255,255,0.08)", overflow: "hidden",
        }}>
          <div style={{
            height: "100%", width: `${pct}%`,
            background: unlocked
              ? `linear-gradient(90deg, ${accentColor}, #FF6B4A)`
              : `linear-gradient(90deg, ${PRIMARY}, ${accentColor})`,
            borderRadius: 3,
            boxShadow: `0 0 8px ${accentColor}80`,
            transition: "width 0.8s ease-out",
          }} />
        </div>
        <div style={{
          display: "flex", justifyContent: "space-between",
          marginTop: 5, fontSize: 10.5, fontWeight: 700,
        }}>
          <span style={{ color: unlocked ? accentColor : TEXT_SOFT }}>
            {displayFmt(current)}{unit ? ` ${unit}` : ""}
          </span>
          <span style={{ color: MUTED }}>
            / {displayFmt(target)}{unit ? ` ${unit}` : ""}
          </span>
        </div>
      </div>

      {/* XP Belohnung */}
      <div style={{
        marginTop: 2, padding: "3px 10px", borderRadius: 10,
        background: unlocked ? `${accentColor}30` : "rgba(255,255,255,0.05)",
        border: unlocked ? `1px solid ${accentColor}80` : "1px solid rgba(255,255,255,0.1)",
      }}>
        <span style={{
          color: unlocked ? accentColor : MUTED,
          fontSize: 11, fontWeight: 800,
        }}>
          {unlocked ? `✓ +${xp.toLocaleString()} XP` : `+${xp.toLocaleString()} XP`}
        </span>
      </div>
    </div>
  );
}

function CalendarHeatmap({ runs, color }: { runs: Territory[]; color: string }) {
  // Gruppiere Runs nach Tag (YYYY-MM-DD) und summiere Distanz
  const dayMap = new Map<string, number>();
  for (const r of runs) {
    const day = r.created_at.slice(0, 10);
    dayMap.set(day, (dayMap.get(day) || 0) + r.distance_m);
  }

  // 13 Wochen (91 Tage) rückwärts
  const days: { date: string; km: number }[] = [];
  const today = new Date();
  for (let i = 90; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, km: (dayMap.get(key) || 0) / 1000 });
  }

  // Intensität: 0 / 0.001-1km / 1-3km / 3-6km / >6km
  const intensity = (km: number): number => {
    if (km === 0) return 0;
    if (km < 1) return 1;
    if (km < 3) return 2;
    if (km < 6) return 3;
    return 4;
  };
  const bgFor = (lvl: number) => {
    if (lvl === 0) return "rgba(255,255,255,0.06)";
    const alpha = 0.25 + lvl * 0.2;
    return `${color}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
  };

  // Weekday offset (Mon=0)
  const firstDay = new Date(days[0].date);
  const weekdayOffset = (firstDay.getDay() + 6) % 7;

  // Baue 7x13 Grid
  const cells: ({ date: string; km: number } | null)[] = Array(weekdayOffset).fill(null).concat(days);
  while (cells.length < 7 * 13) cells.push(null);

  const activeDays = days.filter((d) => d.km > 0).length;
  const totalKm = days.reduce((s, d) => s + d.km, 0);

  return (
    <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
      {/* Kompakter Heatmap-Grid — feste 10px Zellen */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(13, 10px)",
        gridTemplateRows: "repeat(7, 10px)",
        gridAutoFlow: "column",
        gap: 2,
        flexShrink: 0,
      }}>
        {cells.map((cell, i) => (
          <div
            key={i}
            title={cell ? `${cell.date}: ${cell.km.toFixed(2)} km` : ""}
            style={{
              width: 10, height: 10, borderRadius: 2,
              background: cell ? bgFor(intensity(cell.km)) : "transparent",
              boxShadow: cell && cell.km > 0 ? `0 0 3px ${color}66` : "none",
            }}
          />
        ))}
      </div>

      {/* Summary rechts daneben */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 120 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ color: "#FFF", fontSize: 22, fontWeight: 900 }}>{activeDays}</span>
          <span style={{ color: MUTED, fontSize: 11 }}>aktive Tage</span>
        </div>
        <div style={{ color: color, fontSize: 13, fontWeight: 700 }}>
          {totalKm.toFixed(1)} km gesamt
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, fontSize: 9, color: MUTED }}>
          <span>–</span>
          {[0, 1, 2, 3, 4].map((lvl) => (
            <div key={lvl} style={{
              width: 9, height: 9, borderRadius: 2,
              background: bgFor(lvl),
            }} />
          ))}
          <span>+</span>
        </div>
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

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(8, 16, 36, 0.75)",
        backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        padding: 0,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 640,
          maxHeight: "85dvh",
          background: "rgba(30, 42, 68, 0.92)",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          borderTopLeftRadius: 28, borderTopRightRadius: 28,
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderBottom: "none",
          padding: "24px 20px 32px",
          overflowY: "auto",
          boxShadow: "0 -20px 60px rgba(0, 0, 0, 0.4)",
        }}
      >
        {/* Drag handle */}
        <div style={{
          width: 40, height: 4, borderRadius: 2,
          background: "rgba(255,255,255,0.2)", margin: "0 auto 18px",
        }} />

        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 18,
        }}>
          <h2 style={{ color: "#FFF", fontSize: 22, fontWeight: 900, margin: 0 }}>{title}</h2>
          <button
            onClick={onClose}
            style={{
              width: 36, height: 36, borderRadius: 18,
              background: "rgba(255,255,255,0.08)", border: "none",
              color: "#FFF", fontSize: 20, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            ×
          </button>
        </div>

        {children}
      </div>
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
