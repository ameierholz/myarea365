"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { getDateLocale } from "@/i18n/config";
import { TabTech, TabBauwerke, TabKopfgelder, TabShop, type BuildingKind } from "@/components/crew-modal";
import { GuardianCard } from "@/components/guardian-card";
import { GuardianHelpButton } from "@/components/guardian-help-modal";
import type { GuardianWithArchetype } from "@/lib/guardian";
import { GuardianDetailModal } from "@/components/guardian-detail-modal";
import { GemShopModal } from "@/components/gem-shop-modal";
import { PotionInventoryModal } from "@/components/potion-inventory-modal";
import { RunRouteModal } from "@/components/run-route-modal";
import { CrewLiveHub } from "@/components/crew-live-hub";
import { DemoBadge } from "@/components/demo-badge";
import { useRankArt, RankBadge, rankIdByName } from "@/components/rank-badge";
import { useBaseRingArt, UiIcon, useUiIconArt, useInventoryItemArt } from "@/components/resource-icon";
import { appAlert, appConfirm } from "@/components/app-dialog";
import { createClient } from "@/lib/supabase/client";
import {
  FACTIONS,
  RUNNER_RANKS,
  CREW_TYPES,
  CREW_PRIVACY_OPTIONS,
  CREW_COLORS,
  DEMO_CREW_MEMBERS,
  DEMO_CREW_CHALLENGES,
  DEMO_CREW_EVENTS,
  DEMO_CREW_CHAT,
  DEMO_NEARBY_CREWS,
  DEMO_CREW_STATS,
  DEMO_CREW_FEED,
  DEMO_RIVAL_DUEL,
  DEMO_LAST_SEASON_TIER_ID,
  XP_PER_TERRITORY,
  XP_PER_SEGMENT,
  XP_PER_STREET_CLAIMED,
  XP_PER_KM,
  XP_PER_WALK,
  LEAGUE_TIERS,
  leagueTierFor,
  nextLeagueTier,
  currentSeason,
  groupCrewsByLevel,
  emojiForContinent,
  factionPowerForCrews,
  type CrewTypeId,
  type CrewPrivacy,
  type NearbyCrew,
  type CrewMember,
} from "@/lib/game-config";
import {
  type Profile,
  type Crew,
  type GeoLevel,
  BG_DEEP,
  BORDER,
  MUTED,
  TEXT_SOFT,
  PRIMARY,
  ACCENT,
  GEO_LEVEL_SEQ,
  GEO_LABEL,
  GEO_ICON,
  primaryBtnStyle,
  outlineBtnStyle,
  inputStyle,
  breadcrumbStyle,
  CountryFlag,
  LeagueBadge,
  LastSeasonBadge,
  TopThreeRanking,
  FilterPill,
  Badge,
} from "./_shared";

// ───────────────────────────────────────────────────────────────
// Color/Layout-Konstanten, die in CrewTab gebraucht werden, aber
// nicht im _shared-Modul liegen (analog zu map-dashboard.tsx).
// ───────────────────────────────────────────────────────────────
const CARD = "rgba(41, 51, 73, 0.55)";

type CrewSubTab = "overview" | "feed" | "members" | "guardians" | "challenges" | "events" | "chat" | "tech" | "buildings" | "bounties" | "shop" | "settings" | "attacks" | "help" | "lager" | "territories" | "gifts";

export function CrewTab({
  profile: p,
  myCrew,
  setMyCrew,
  setProfile,
  onOpenRanking,
  onPlaceBuilding,
  onClose,
}: {
  profile: Profile | null;
  myCrew: Crew | null;
  setMyCrew: (c: Crew | null) => void;
  setProfile: (p: Profile) => void;
  onOpenRanking: () => void;
  onPlaceBuilding?: (kind: BuildingKind) => void;
  /** Schließt das Crew-Modal — wird in den Hero-Header eingebaut wenn in einem Modal-Frame. */
  onClose?: () => void;
}) {
  const supabase = createClient();
  const tC = useTranslations("Crew");
  const tMD = useTranslations("MapDashboard");
  const [mode, setMode] = useState<"idle" | "create" | "join" | "discover">("idle");
  const [subTab, setSubTab] = useState<CrewSubTab>("overview");

  // Create-Form State
  const [newName, setNewName] = useState("");
  const [newMotto, setNewMotto] = useState("");
  const [newZip, setNewZip] = useState("");
  const [newType, setNewType] = useState<CrewTypeId>("friends");
  const [newColor, setNewColor] = useState<string>(CREW_COLORS[0]);
  const [newPrivacy, setNewPrivacy] = useState<CrewPrivacy>("invite");
  const [newCrewFaction, setNewCrewFaction] = useState<"pfadfinder" | "waechterorden" | "stadtlaeufer" | "mystiker">("pfadfinder");
  const [joinCode, setJoinCode] = useState("");

  async function handleCreate() {
    if (!newName.trim() || !newZip.trim()) return appAlert(tMD("enterNameAndZip"));
    if (!p) return;

    const { data, error } = await supabase.from("crews").insert({
      name: newName.trim(),
      zip: newZip.trim(),
      color: newColor,
      owner_id: p.id,
      faction: p.faction || "syndicate",
      crew_faction: newCrewFaction,
      crew_faction_switched_at: new Date().toISOString(),
    }).select().single();

    if (error) return appAlert(error.message);

    await supabase.from("crew_members").insert({ crew_id: data.id, user_id: p.id, role: "admin" });
    await supabase.from("users").update({ current_crew_id: data.id, team_color: newColor }).eq("id", p.id);

    // Pending-Gebiete vom Solo-Zeit upgraden + XP gutschreiben
    const { data: promote } = await supabase.rpc("promote_pending_territories", { p_user_id: p.id });
    const promoted = Array.isArray(promote) && promote[0] ? promote[0] as { promoted_count: number; xp_granted: number } : null;

    setMyCrew(data);
    setProfile({ ...p, current_crew_id: data.id, team_color: newColor });
    setMode("idle");
    if (promoted && promoted.promoted_count > 0) {
      appAlert(tMD("crewFoundedWithSolo", { name: newName, count: promoted.promoted_count, xp: promoted.xp_granted }));
    } else {
      appAlert(tMD("crewFoundedWithType", { name: newName, typeLabel: CREW_TYPES.find(ct => ct.id === newType)?.name ?? "" }));
    }
  }

  async function handleLeave() {
    if (!p || !myCrew) return;
    const isOwner = myCrew.owner_id === p.id;
    const msg = isOwner
      ? `"${myCrew.name}" wirklich AUFLÖSEN? Alle Buildings/Tech/Treasury werden gelöscht.`
      : `"${myCrew.name}" wirklich verlassen?`;
    if (!await appConfirm(msg)) return;

    const r = await fetch("/api/crew/hierarchy", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: isOwner ? "disband" : "leave", crew_id: myCrew.id }),
    });
    const j = await r.json() as { ok?: boolean; error?: string };
    if (!j.ok) {
      await appAlert(j.error === "transfer_leadership_first"
        ? "Übertrage zuerst die Leitung an ein anderes Mitglied."
        : `Fehler: ${j.error ?? "unbekannt"}`);
      return;
    }
    await supabase.from("users").update({ current_crew_id: null }).eq("id", p.id);
    setMyCrew(null);
    setProfile({ ...p, current_crew_id: null });
  }

  // ═══ Crew vorhanden → Management-View ═══
  if (myCrew) {
    return (
      <MyCrewView
        crew={myCrew}
        profile={p}
        subTab={subTab}
        setSubTab={setSubTab}
        onLeave={handleLeave}
        onPlaceBuilding={onPlaceBuilding}
        onClose={onClose}
      />
    );
  }

  // ═══ Profil hat current_crew_id, myCrew lädt noch → Loading statt Onboarding ═══
  // Verhindert den Freelancer-Flash beim Öffnen des Crew-Modals.
  if (p?.current_crew_id) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: "#8B8FA3", fontSize: 12 }}>
        Lade Crew-Verwaltung…
      </div>
    );
  }

  // ═══ Keine Crew → Onboarding ═══
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 40 }}>
      <div style={{ padding: "20px 20px 40px", width: "100%", maxWidth: 960, margin: "0 auto" }}>
        {mode === "idle" && (
          <CrewOnboarding
            onCreate={() => setMode("create")}
            onDiscover={() => setMode("discover")}
            onJoin={() => setMode("join")}
            onOpenRanking={onOpenRanking}
          />
        )}

        {mode === "create" && (
          <CreateCrewForm
            name={newName}                setName={setNewName}
            motto={newMotto}              setMotto={setNewMotto}
            zip={newZip}                  setZip={setNewZip}
            type={newType}                setType={setNewType}
            color={newColor}              setColor={setNewColor}
            privacy={newPrivacy}          setPrivacy={setNewPrivacy}
            crewFaction={newCrewFaction}  setCrewFaction={setNewCrewFaction}
            onSubmit={handleCreate}
            onCancel={() => setMode("idle")}
          />
        )}

        {mode === "join" && (
          <div style={{ background: CARD, padding: 22, borderRadius: 18 }}>
            <div style={{ color: "#FFF", fontSize: 18, fontWeight: 900, marginBottom: 6 }}>{tC("joinTitle")}</div>
            <div style={{ color: MUTED, fontSize: 12, marginBottom: 16 }}>
              {tC("joinIntro")}
            </div>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder={tC("joinCodePlaceholder")}
              style={{
                ...inputStyle(),
                fontFamily: "monospace", textAlign: "center", fontSize: 18,
                letterSpacing: 2,
              }}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={() => setMode("idle")} style={outlineBtnStyle()}>{tC("joinCancel")}</button>
              <button
                onClick={async () => {
                  const code = joinCode.trim();
                  if (!code) return;
                  const r = await fetch("/api/crew/join", {
                    method: "POST", headers: { "content-type": "application/json" },
                    body: JSON.stringify({ code }),
                  });
                  const j = await r.json();
                  if (!r.ok) { await appAlert(j.error === "crew_not_found" ? tC("joinNotFound") : tC("joinError", { error: String(j.error ?? r.status) })); return; }
                  const msg = j.promoted_territories > 0
                    ? tC("joinSuccessWithTerritories", { name: j.crew.name, count: j.promoted_territories, xp: j.promoted_xp })
                    : tC("joinSuccess", { name: j.crew.name });
                  await appAlert(msg);
                  setMyCrew(j.crew);
                  setMode("idle");
                }}
                style={primaryBtnStyle(PRIMARY)}
              >
                {tC("joinSubmit")}
              </button>
            </div>
          </div>
        )}

        {mode === "discover" && (
          <DiscoverView onBack={() => setMode("idle")} />
        )}
      </div>
    </div>
  );
}

/* ═══ Crew Onboarding — Hero + Stats + Features + Typen + Testimonial ═══ */
function CrewOnboarding({
  onCreate, onDiscover, onJoin, onOpenRanking,
}: { onCreate: () => void; onDiscover: () => void; onJoin: () => void; onOpenRanking: () => void }) {
  const tC = useTranslations("Crew");
  // Live-Stats aus Demo-Daten (wirkt echt)
  const totalCrews = DEMO_NEARBY_CREWS.length;
  const totalMembers = DEMO_NEARBY_CREWS.reduce((s, c) => s + c.member_count, 0);
  const totalKm = DEMO_NEARBY_CREWS.reduce((s, c) => s + c.weekly_km, 0);

  // Schwebende Avatare für Hero
  const floatingAvatars = ["🦊", "🚀", "👑", "🐆", "👟", "🧭", "🏃", "🦋", "⚡", "🐺"];

  return (
    <>
      {/* Inject CSS animations */}
      <style>{`
        @keyframes crewFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes crewPulse { 0%,100% { opacity: 0.8; transform: scale(1); } 50% { opacity: 1; transform: scale(1.05); } }
        @keyframes crewGlow { 0%,100% { box-shadow: 0 0 20px #22D1C388, 0 0 40px #22D1C344; } 50% { box-shadow: 0 0 30px #22D1C3cc, 0 0 60px #22D1C366; } }
      `}</style>

      {/* ═══ HERO ═══ */}
      <div style={{
        position: "relative",
        padding: "40px 28px",
        borderRadius: 24,
        background: `
          radial-gradient(circle at 20% 20%, ${PRIMARY}22 0%, transparent 45%),
          radial-gradient(circle at 80% 60%, ${ACCENT}22 0%, transparent 50%),
          linear-gradient(135deg, rgba(30, 38, 60, 0.75) 0%, rgba(20, 26, 44, 0.85) 100%)
        `,
        border: `1px solid ${BORDER}`,
        overflow: "hidden",
        marginBottom: 18,
      }}>
        {/* Schwebende Avatare (Hintergrund) */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden",
        }}>
          {floatingAvatars.map((emoji, i) => {
            const seed = (i + 1) * 137;
            const left = (seed * 13) % 90 + 3;
            const top = (seed * 17) % 85 + 5;
            const duration = 3 + (seed % 4);
            const delay = (seed % 7) * 0.3;
            return (
              <span key={i} style={{
                position: "absolute",
                left: `${left}%`,
                top: `${top}%`,
                fontSize: 22 + (seed % 14),
                opacity: 0.14,
                animation: `crewFloat ${duration}s ease-in-out ${delay}s infinite`,
              }}>{emoji}</span>
            );
          })}
        </div>

        <div style={{ position: "relative", zIndex: 1, maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "4px 12px", borderRadius: 999,
            background: `${PRIMARY}22`, border: `1px solid ${PRIMARY}55`,
            color: PRIMARY, fontSize: 11, fontWeight: 900, letterSpacing: 1,
            marginBottom: 14,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: 3, background: PRIMARY,
              animation: "crewPulse 1.6s ease-in-out infinite",
            }} />
            {tC("freelancerBadge")}
          </div>
          <h1 style={{
            color: "#FFF", fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 900,
            margin: 0, lineHeight: 1.1, letterSpacing: -0.5,
          }}>
            {tC("heroTitle1")}<br />
            <span style={{
              background: `linear-gradient(90deg, ${PRIMARY}, ${ACCENT})`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>{tC("heroTitleAccent")}</span> {tC("heroTitle2")}
          </h1>
          <p style={{
            color: TEXT_SOFT, fontSize: 15, lineHeight: 1.55,
            margin: "14px auto 24px", maxWidth: 520,
          }}>
            {tC("heroSubtitle")}
          </p>
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center",
            marginBottom: 8,
          }}>
            <button
              onClick={onCreate}
              style={{
                padding: "14px 26px", borderRadius: 14,
                background: PRIMARY, color: BG_DEEP,
                fontSize: 14, fontWeight: 900, border: "none", cursor: "pointer",
                animation: "crewGlow 2.6s ease-in-out infinite",
              }}
            >
              {tC("btnFound")}
            </button>
            <button
              onClick={onDiscover}
              style={{
                padding: "14px 22px", borderRadius: 14,
                background: "rgba(0,0,0,0.35)", color: "#FFF",
                fontSize: 14, fontWeight: 700,
                border: `1px solid ${BORDER}`, cursor: "pointer",
              }}
            >
              {tC("btnDiscover")}
            </button>
            <button
              onClick={onJoin}
              style={{
                padding: "14px 22px", borderRadius: 14,
                background: "transparent", color: "#FFF",
                fontSize: 14, fontWeight: 700,
                border: `1px solid ${BORDER}`, cursor: "pointer",
              }}
            >
              {tC("btnJoinCode")}
            </button>
          </div>
        </div>
      </div>

      {/* ═══ LIVE STATS ═══ */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 10, marginBottom: 20,
      }}>
        <LiveStat icon="👥" value={totalCrews.toString()} label={tC("statCrews")} accent={PRIMARY} />
        <LiveStat icon="🏃" value={totalMembers.toLocaleString("de-DE")} label={tC("statRunners")} accent="#FFD700" />
        <LiveStat icon="📏" value={`${totalKm.toLocaleString("de-DE")} km`} label={tC("statKmThisWeek")} accent={ACCENT} />
      </div>

      {/* ═══ FEATURES ═══ */}
      <div style={{ marginBottom: 26 }}>
        <div style={{ color: MUTED, fontSize: 11, fontWeight: 800, letterSpacing: 1, marginBottom: 12 }}>
          {tC("whyCrewHeader")}
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          gap: 12,
        }}>
          {[
            { icon: "🗺️", title: tC("featTerritory"),   desc: tC("featTerritoryDesc"),   accent: "#22D1C3" },
            { icon: "🏆", title: tC("featLeague"),      desc: tC("featLeagueDesc"),      accent: "#FFD700" },
            { icon: "⚔️", title: tC("featRivals"),      desc: tC("featRivalsDesc"),      accent: "#FF2D78" },
            { icon: "🔥", title: tC("featChallenges"),  desc: tC("featChallengesDesc"),  accent: "#FF6B4A" },
            { icon: "📅", title: tC("featEvents"),      desc: tC("featEventsDesc"),      accent: "#a855f7" },
            { icon: "💬", title: tC("featChat"),        desc: tC("featChatDesc"),        accent: "#4ade80" },
          ].map((f) => (
            <div key={f.title} style={{
              background: "rgba(30, 38, 60, 0.55)",
              borderRadius: 14, padding: 14,
              border: `1px solid ${BORDER}`,
              borderTop: `3px solid ${f.accent}`,
            }}>
              <div style={{ fontSize: 26, marginBottom: 6 }}>{f.icon}</div>
              <div style={{ color: "#FFF", fontSize: 14, fontWeight: 900, marginBottom: 4 }}>
                {f.title}
              </div>
              <div style={{ color: MUTED, fontSize: 12, lineHeight: 1.45 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ GESUNDHEITSEFFEKT ═══ */}
      <div style={{ marginBottom: 26 }}>
        <div style={{ color: MUTED, fontSize: 11, fontWeight: 800, letterSpacing: 1, marginBottom: 4 }}>
          {tC("healthHeader")}
        </div>
        <div style={{ color: TEXT_SOFT, fontSize: 13, marginBottom: 12 }}>
          {tC("healthIntro")}
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 10,
        }}>
          {[
            { icon: "❤️", stat: "+42%", title: tC("healthHeart"),     desc: tC("healthHeartDesc"),     accent: "#FF2D78" },
            { icon: "🧠", stat: "+23%", title: tC("healthMental"),    desc: tC("healthMentalDesc"),    accent: "#22D1C3" },
            { icon: "💪", stat: "2×",   title: tC("healthEndurance"), desc: tC("healthEnduranceDesc"), accent: "#FFD700" },
            { icon: "😴", stat: "+18%", title: tC("healthSleep"),     desc: tC("healthSleepDesc"),     accent: "#a855f7" },
            { icon: "🔥", stat: "+350", title: tC("healthCal"),       desc: tC("healthCalDesc"),       accent: "#F97316" },
            { icon: "🦴", stat: "+15%", title: tC("healthBones"),     desc: tC("healthBonesDesc"),     accent: "#5ddaf0" },
            { icon: "🌿", stat: "-30%", title: tC("healthStress"),    desc: tC("healthStressDesc"),    accent: "#4ade80" },
            { icon: "👥", stat: "3×",   title: tC("healthSocial"),    desc: tC("healthSocialDesc"),    accent: "#ef7169" },
          ].map((h) => (
            <div key={h.title} style={{
              background: `linear-gradient(135deg, ${h.accent}14 0%, rgba(30, 38, 60, 0.55) 100%)`,
              borderRadius: 14, padding: 14,
              border: `1px solid ${h.accent}33`,
              display: "flex", alignItems: "flex-start", gap: 10,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: `${h.accent}22`, border: `1px solid ${h.accent}55`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, flexShrink: 0,
              }}>{h.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{
                    color: h.accent, fontSize: 18, fontWeight: 900,
                    textShadow: `0 0 10px ${h.accent}55`,
                  }}>{h.stat}</span>
                  <span style={{ color: "#FFF", fontSize: 13, fontWeight: 800 }}>{h.title}</span>
                </div>
                <div style={{ color: MUTED, fontSize: 11, marginTop: 3, lineHeight: 1.45 }}>
                  {h.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{
          marginTop: 10, fontSize: 10, color: MUTED, fontStyle: "italic", textAlign: "center",
        }}>
          {tC("healthSourceNote")}
        </div>
      </div>

      {/* ═══ LIGA-SYSTEM ═══ */}
      <div style={{ marginBottom: 26 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4, gap: 10, flexWrap: "wrap" }}>
          <div style={{ color: MUTED, fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>
            {tC("leagueHeader", { season: currentSeason().label.toUpperCase() })}
          </div>
          <div style={{ color: PRIMARY, fontSize: 11, fontWeight: 800 }}>
            {tC("leagueDaysLeft", { daysLeft: currentSeason().daysLeft, daysTotal: currentSeason().daysTotal })}
          </div>
        </div>
        <div style={{ color: TEXT_SOFT, fontSize: 13, marginBottom: 12 }}>
          {tC.rich("leagueIntro", { b: (c) => <b style={{ color: "#FFF" }}>{c}</b> })}
        </div>
        <div style={{
          background: "rgba(30, 38, 60, 0.55)", borderRadius: 16, padding: 16,
          border: `1px solid ${BORDER}`,
        }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(${LEAGUE_TIERS.length}, 1fr)`,
            gap: 6, marginBottom: 10,
          }}>
            {LEAGUE_TIERS.map((t, i) => {
              const count = DEMO_NEARBY_CREWS.filter((c) => leagueTierFor(c.weekly_km).id === t.id).length;
              return (
                <button
                  key={t.id}
                  onClick={onOpenRanking}
                  style={{
                    textAlign: "center", cursor: "pointer",
                    padding: "10px 6px", borderRadius: 10,
                    background: `${t.color}18`,
                    border: `1px solid ${t.color}55`,
                    color: "#FFF",
                  }}
                >
                  <div style={{ fontSize: 24, marginBottom: 2 }}>{t.icon}</div>
                  <div style={{ color: t.color, fontSize: 11, fontWeight: 900, letterSpacing: 0.5 }}>
                    {t.name.toUpperCase()}
                  </div>
                  <div style={{ color: MUTED, fontSize: 10, marginTop: 3 }}>
                    {i === LEAGUE_TIERS.length - 1
                      ? `${t.minWeeklyKm}+ km`
                      : `${t.minWeeklyKm}${i === 0 ? "" : "+"} km`}
                  </div>
                  <div style={{
                    marginTop: 6, padding: "2px 6px", borderRadius: 8,
                    background: "rgba(0,0,0,0.35)",
                    color: "#FFF", fontSize: 11, fontWeight: 900,
                    display: "inline-block",
                  }}>
                    {count === 1 ? tC("leagueCrewsCountOne", { count }) : tC("leagueCrewsCountMany", { count })}
                  </div>
                </button>
              );
            })}
          </div>
          {/* Animated multi-step bar */}
          <div style={{
            height: 10, borderRadius: 5, overflow: "hidden", display: "flex",
            background: "rgba(0,0,0,0.35)", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.4)",
          }}>
            {LEAGUE_TIERS.map((t) => (
              <div key={t.id} style={{
                flex: 1, background: t.color, opacity: 0.85,
                boxShadow: `0 0 8px ${t.color}66`,
              }} />
            ))}
          </div>
          <div style={{ color: MUTED, fontSize: 12, marginTop: 12, textAlign: "center", lineHeight: 1.5 }}>
            {tC.rich("leagueExplain", { b: (c) => <b style={{ color: "#FFF" }}>{c}</b> })}
          </div>
          <button
            onClick={onOpenRanking}
            style={{
              ...primaryBtnStyle(PRIMARY),
              marginTop: 14, width: "100%",
            }}
          >
            {tC("leagueViewAll")}
          </button>
        </div>
      </div>

      {/* ═══ TYPEN-SHOWCASE ═══ */}
      <div style={{ marginBottom: 26 }}>
        <div style={{ color: MUTED, fontSize: 11, fontWeight: 800, letterSpacing: 1, marginBottom: 4 }}>
          {tC("typesHeader")}
        </div>
        <div style={{ color: TEXT_SOFT, fontSize: 13, marginBottom: 12 }}>
          {tC("typesIntro")}
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: 10,
        }}>
          {CREW_TYPES.map((t) => (
            <button
              key={t.id}
              onClick={onCreate}
              style={{
                background: "rgba(30, 38, 60, 0.55)",
                borderRadius: 14, padding: "12px 10px",
                border: `1px solid ${BORDER}`,
                color: "#FFF", textAlign: "center", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              }}
            >
              <div style={{ fontSize: 30, marginBottom: 2 }}>{t.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 900 }}>{t.name}</div>
              <div style={{ color: MUTED, fontSize: 10, lineHeight: 1.3 }}>{t.tagline}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ═══ TESTIMONIAL ═══ */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: 12,
        marginBottom: 10,
      }}>
        {[
          { name: "Lena K.",  role: tC("testimonial1Role"), quote: tC("testimonial1Quote") },
          { name: "Jonas B.", role: tC("testimonial2Role"), quote: tC("testimonial2Quote") },
          { name: "Ines R.",  role: tC("testimonial3Role"), quote: tC("testimonial3Quote") },
        ].map((t) => (
          <div key={t.name} style={{
            background: "rgba(30, 38, 60, 0.55)",
            borderRadius: 14, padding: 16,
            border: `1px solid ${BORDER}`,
          }}>
            <div style={{ fontSize: 22, color: PRIMARY, marginBottom: 4 }}>&ldquo;</div>
            <div style={{ color: "#FFF", fontSize: 13, lineHeight: 1.55, fontStyle: "italic" }}>
              {t.quote}
            </div>
            <div style={{ marginTop: 10, fontSize: 11 }}>
              <span style={{ color: "#FFF", fontWeight: 900 }}>{t.name}</span>
              <span style={{ color: MUTED }}> · {t.role}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ═══ BOTTOM CTA ═══ */}
      <div style={{
        marginTop: 18, padding: 18, borderRadius: 18,
        background: `linear-gradient(135deg, ${PRIMARY}22 0%, ${ACCENT}22 100%)`,
        border: `1px solid ${PRIMARY}44`,
        display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div>
          <div style={{ color: "#FFF", fontSize: 16, fontWeight: 900 }}>{tC("testimonialReady")}</div>
          <div style={{ color: TEXT_SOFT, fontSize: 12, marginTop: 2 }}>
            {tC("testimonialFooter")}
          </div>
        </div>
        <button onClick={onCreate} style={primaryBtnStyle(PRIMARY)}>
          {tC("btnFoundNow")}
        </button>
      </div>
    </>
  );
}

function CalcBox({ label, value, hint, color, highlight }: {
  label: string; value: string; hint: string; color: string; highlight?: boolean;
}) {
  return (
    <div style={{
      background: highlight
        ? `linear-gradient(135deg, ${color}26 0%, ${color}0a 100%)`
        : "rgba(0, 0, 0, 0.28)",
      borderRadius: 12,
      padding: "12px 14px",
      border: `1px solid ${highlight ? color + "88" : BORDER}`,
      textAlign: "center",
    }}>
      <div style={{ color: MUTED, fontSize: 10, fontWeight: 800, letterSpacing: 0.5 }}>
        {label.toUpperCase()}
      </div>
      <div style={{
        color, fontSize: 22, fontWeight: 900, marginTop: 4,
        textShadow: highlight ? `0 0 10px ${color}55` : "none",
      }}>
        {value}
      </div>
      <div style={{ color: MUTED, fontSize: 10, marginTop: 2 }}>{hint}</div>
    </div>
  );
}

function LiveStat({ icon, value, label, accent }: { icon: string; value: string; label: string; accent: string }) {
  return (
    <div style={{
      background: "rgba(30, 38, 60, 0.55)", borderRadius: 14,
      padding: "12px 14px", border: `1px solid ${BORDER}`,
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: `${accent}22`, border: `1px solid ${accent}55`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 18,
      }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: "#FFF", fontSize: 18, fontWeight: 900, lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ color: MUTED, fontSize: 11, marginTop: 3, fontWeight: 700 }}>
          {label}
        </div>
      </div>
    </div>
  );
}

/* ═══ Favoriten-Crews (localStorage) ═══ */
const FAV_KEY = "myarea.favoriteCrews";
function readFavSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(FAV_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}
function writeFavSet(s: Set<string>) {
  try { window.localStorage.setItem(FAV_KEY, JSON.stringify([...s])); } catch { /* noop */ }
  window.dispatchEvent(new CustomEvent("fav-crews-changed"));
}
function useFavoriteCrews() {
  const [favs, setFavs] = useState<Set<string>>(() => readFavSet());
  useEffect(() => {
    const onChange = () => setFavs(readFavSet());
    window.addEventListener("fav-crews-changed", onChange);
    return () => window.removeEventListener("fav-crews-changed", onChange);
  }, []);
  return {
    favs,
    toggle: (id: string) => {
      const s = new Set(favs);
      if (s.has(id)) s.delete(id); else s.add(id);
      writeFavSet(s);
      setFavs(s);
    },
  };
}
function FavoriteHeart({ crewId }: { crewId: string }) {
  const { favs, toggle } = useFavoriteCrews();
  const active = favs.has(crewId);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); toggle(crewId); }}
      aria-label={active ? "Favorit entfernen" : "Als Favorit speichern"}
      style={{
        background: "transparent", border: "none", cursor: "pointer",
        fontSize: 18, lineHeight: 1, padding: 2,
        filter: active ? "drop-shadow(0 0 5px #FF2D7899)" : "grayscale(0.6) opacity(0.6)",
        transition: "filter 0.2s",
      }}
    >
      {active ? "❤️" : "🤍"}
    </button>
  );
}

/* CountryFlag, GeoLevel, GEO_LEVEL_SEQ, GEO_LABEL, GEO_ICON moved to ./_tabs/_shared */

/* ═══════════════════════════════════════════════════════
 * DISCOVER VIEW — Browse crews by geo hierarchy
 * ═══════════════════════════════════════════════════════ */
function DiscoverView({ onBack }: { onBack: () => void }) {
  const tR = useTranslations("Ranking");
  const tC = useTranslations("Crew");
  const [filters, setFilters] = useState<Partial<Record<GeoLevel, string>>>({});
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<CrewTypeId | null>(null);
  const [privacyFilter, setPrivacyFilter] = useState<CrewPrivacy | null>(null);
  const [leagueFilter, setLeagueFilter] = useState<string | null>(null);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const { favs } = useFavoriteCrews();

  // Desktop / Tablet-Detection für Sidebar-Layout
  const [isWide, setIsWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 860px)");
    setIsWide(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsWide(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const filtered = DEMO_NEARBY_CREWS.filter((c) => {
    for (const lvl of GEO_LEVEL_SEQ) {
      const f = filters[lvl];
      if (f && c[lvl] !== f) return false;
    }
    if (typeFilter && c.type !== typeFilter) return false;
    if (privacyFilter && c.privacy !== privacyFilter) return false;
    if (leagueFilter && leagueTierFor(c.weekly_km).id !== leagueFilter) return false;
    if (onlyFavorites && !favs.has(c.id)) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = [c.name, c.motto, c.city, c.region, c.state, c.country, c.zip].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const activeFilterCount =
    Object.values(filters).filter(Boolean).length +
    (typeFilter ? 1 : 0) + (privacyFilter ? 1 : 0) + (leagueFilter ? 1 : 0) + (search ? 1 : 0) + (onlyFavorites ? 1 : 0);

  // Nächstes Drill-Down-Level bestimmen
  const activeLevelIdx = GEO_LEVEL_SEQ.findIndex((l) => !filters[l]);
  const nextLevel: GeoLevel | null = activeLevelIdx >= 0 ? GEO_LEVEL_SEQ[activeLevelIdx] : null;
  const buckets = nextLevel ? groupCrewsByLevel(filtered, nextLevel) : [];

  // Breadcrumb-Pfad
  const trail: { level: GeoLevel; label: string }[] = [];
  for (const lvl of GEO_LEVEL_SEQ) {
    if (filters[lvl]) trail.push({ level: lvl, label: filters[lvl]! });
  }

  function setFilter(level: GeoLevel, value: string) {
    // Alle tieferen Filter zurücksetzen bei Auswahl
    const idx = GEO_LEVEL_SEQ.indexOf(level);
    const next: Partial<Record<GeoLevel, string>> = {};
    for (let i = 0; i <= idx; i++) {
      const l = GEO_LEVEL_SEQ[i];
      next[l] = l === level ? value : filters[l];
    }
    setFilters(next);
  }
  function clearFrom(level: GeoLevel | null) {
    if (!level) { setFilters({}); return; }
    const idx = GEO_LEVEL_SEQ.indexOf(level);
    const next: Partial<Record<GeoLevel, string>> = {};
    for (let i = 0; i < idx; i++) {
      const l = GEO_LEVEL_SEQ[i];
      if (filters[l]) next[l] = filters[l];
    }
    setFilters(next);
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
        <button onClick={onBack} style={{
          background: "transparent", border: "none", color: PRIMARY,
          fontSize: 14, cursor: "pointer", padding: 0,
        }}>{tC("discoverBack")}</button>
      </div>

      <div style={{ color: "#FFF", fontSize: 22, fontWeight: 900, marginBottom: 4 }}>{tC("discoverTitle")}</div>
      <div style={{ color: MUTED, fontSize: 13, marginBottom: 16 }}>
        {countLabel(filtered.length, trail)}
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: isWide ? "260px 1fr" : "1fr",
        gap: 20,
        alignItems: "start",
      }}>
        {/* ═══ SIDEBAR (Search + Filter) ═══ */}
        <aside style={{
          position: isWide ? "sticky" : "static",
          top: isWide ? 12 : undefined,
          background: isWide ? "rgba(30, 38, 60, 0.45)" : "transparent",
          border: isWide ? `1px solid ${BORDER}` : "none",
          borderRadius: isWide ? 14 : 0,
          padding: isWide ? 14 : 0,
        }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tC("discoverSearchPh")}
            style={{ ...inputStyle(), marginBottom: 10 }}
          />
          <button
            onClick={() => setOnlyFavorites((v) => !v)}
            style={{
              width: "100%", padding: "8px 12px", borderRadius: 10,
              background: onlyFavorites ? "#FF2D7822" : "rgba(20, 26, 44, 0.6)",
              border: `1px solid ${onlyFavorites ? "#FF2D78" : BORDER}`,
              color: onlyFavorites ? "#FF2D78" : "#FFF",
              fontSize: 12, fontWeight: 800, cursor: "pointer", marginBottom: 14,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            {tC("discoverFavoritesOnly")} {favs.size > 0 && `(${favs.size})`}
          </button>
          <div style={{ color: MUTED, fontSize: 10, fontWeight: 800, marginBottom: 6, letterSpacing: 0.5 }}>
            {tC("labelType")}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            <FilterPill active={typeFilter === null} onClick={() => setTypeFilter(null)}>{tC("filterAll")}</FilterPill>
            {CREW_TYPES.map((t) => (
              <FilterPill key={t.id} active={typeFilter === t.id} onClick={() => setTypeFilter(typeFilter === t.id ? null : t.id)}>
                {t.icon} {t.name}
              </FilterPill>
            ))}
          </div>
          <div style={{ color: MUTED, fontSize: 10, fontWeight: 800, marginBottom: 6, letterSpacing: 0.5 }}>
            {tC("labelPrivacy")}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            <FilterPill active={privacyFilter === null} onClick={() => setPrivacyFilter(null)}>{tC("filterAll")}</FilterPill>
            {CREW_PRIVACY_OPTIONS.map((p) => (
              <FilterPill key={p.id} active={privacyFilter === p.id} onClick={() => setPrivacyFilter(privacyFilter === p.id ? null : p.id)}>
                {p.icon} {p.label}
              </FilterPill>
            ))}
          </div>

          <div style={{ color: MUTED, fontSize: 10, fontWeight: 800, marginBottom: 6, letterSpacing: 0.5 }}>
            {tC("labelLeague")}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <FilterPill active={leagueFilter === null} onClick={() => setLeagueFilter(null)}>{tC("filterAll")}</FilterPill>
            {LEAGUE_TIERS.map((t) => (
              <FilterPill key={t.id} active={leagueFilter === t.id} onClick={() => setLeagueFilter(leagueFilter === t.id ? null : t.id)}>
                {t.icon} {t.name}
              </FilterPill>
            ))}
          </div>
          {activeFilterCount > 0 && (
            <button
              onClick={() => { setFilters({}); setTypeFilter(null); setPrivacyFilter(null); setLeagueFilter(null); setSearch(""); setOnlyFavorites(false); }}
              style={{
                marginTop: 14, background: "transparent", border: "none",
                color: ACCENT, cursor: "pointer", fontSize: 12, fontWeight: 700, padding: 0,
              }}
            >
              {tR("clearAllFilters", { count: activeFilterCount })}
            </button>
          )}

          {/* Geo-Drill-Down (NACH KONTINENT/LAND/… FILTERN) */}
          {nextLevel && buckets.length > 1 && (
            <div style={{ marginTop: 18, borderTop: `1px solid ${BORDER}`, paddingTop: 14 }}>
              <div style={{ color: MUTED, fontSize: 10, fontWeight: 800, marginBottom: 8, letterSpacing: 0.5 }}>
                {tR("filterByLevel", { level: GEO_LABEL[nextLevel].toUpperCase() })}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {buckets.map((b) => (
                  <button
                    key={b.key}
                    onClick={() => setFilter(nextLevel, b.key)}
                    style={{
                      background: "rgba(20, 26, 44, 0.6)", border: `1px solid ${BORDER}`,
                      borderRadius: 10, padding: "8px 10px", color: "#FFF",
                      display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                      textAlign: "left", width: "100%",
                    }}
                  >
                    {nextLevel === "country"
                      ? <CountryFlag country={b.key} size={16} />
                      : nextLevel === "continent"
                        ? <span style={{ fontSize: 16 }}>{emojiForContinent(b.key)}</span>
                        : <span style={{ fontSize: 14, opacity: 0.9 }}>{GEO_ICON[nextLevel]}</span>
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {b.label}
                      </div>
                    </div>
                    <span style={{ fontSize: 10, color: MUTED, fontWeight: 700 }}>
                      {b.child_count}
                    </span>
                    <span style={{ color: MUTED, fontSize: 12 }}>›</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* ═══ MAIN (Breadcrumb + Top3 + Buckets + List) ═══ */}
        <main>

      {/* Breadcrumb */}
      <div style={{
        display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6,
        background: "rgba(0,0,0,0.2)", padding: "10px 12px", borderRadius: 12,
        marginBottom: 14, border: `1px solid ${BORDER}`,
      }}>
        <button
          onClick={() => clearFrom(null)}
          style={breadcrumbStyle(trail.length === 0)}
        >
          🌍 Alle
        </button>
        {trail.map((t, i) => (
          <React.Fragment key={t.level}>
            <span style={{ color: MUTED, fontSize: 12 }}>›</span>
            <button
              onClick={() => {
                const idx = GEO_LEVEL_SEQ.indexOf(t.level);
                const keep: Partial<Record<GeoLevel, string>> = {};
                for (let j = 0; j <= idx; j++) {
                  const l = GEO_LEVEL_SEQ[j];
                  if (filters[l]) keep[l] = filters[l];
                }
                setFilters(keep);
              }}
              style={{ ...breadcrumbStyle(i === trail.length - 1), display: "inline-flex", alignItems: "center", gap: 5 }}
            >
              {t.level === "country"   && <CountryFlag country={t.label} size={20} />}
              {t.level === "continent" && <span>{emojiForContinent(t.label)}</span>}
              {t.level !== "country" && t.level !== "continent" && <span>{GEO_ICON[t.level]}</span>}
              <span>{t.label}</span>
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Faction-War-Bar */}
      {filtered.length >= 2 && (
        <FactionWarBar
          scopeLabel={trail.length ? trail[trail.length - 1].label : tC("scopeWorld")}
          crews={filtered}
        />
      )}

      {/* Top-3-Ranking auf aktueller Ebene */}
      {filtered.length >= 2 && (
        <TopThreeRanking
          scopeLabel={trail.length ? trail[trail.length - 1].label : tC("scopeWorld")}
          crews={filtered}
        />
      )}

      {/* Drill-Down-Buckets: auf Desktop/Tablet in Sidebar, hier nur auf Mobile */}
      {!isWide && nextLevel && buckets.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: MUTED, fontSize: 11, fontWeight: 800, marginBottom: 8, letterSpacing: 0.5 }}>
            NACH {GEO_LABEL[nextLevel].toUpperCase()} FILTERN
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
            gap: 8,
          }}>
            {buckets.map((b) => (
              <button
                key={b.key}
                onClick={() => setFilter(nextLevel, b.key)}
                style={{
                  background: "rgba(30, 38, 60, 0.55)", border: `1px solid ${BORDER}`,
                  borderRadius: 12, padding: "10px 12px", color: "#FFF",
                  display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {nextLevel === "country"
                  ? <CountryFlag country={b.key} size={20} />
                  : nextLevel === "continent"
                    ? <span style={{ fontSize: 20 }}>{emojiForContinent(b.key)}</span>
                    : <span style={{ fontSize: 20, opacity: 0.9 }}>{GEO_ICON[nextLevel]}</span>
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {b.label}
                  </div>
                  <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>
                    {b.child_count === 1 ? tC("leagueCrewsCountOne", { count: b.child_count }) : tC("leagueCrewsCountMany", { count: b.child_count })}
                  </div>
                </div>
                <span style={{ color: MUTED }}>›</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Crew-Liste */}
      <div>
        <div style={{ color: MUTED, fontSize: 11, fontWeight: 800, marginBottom: 8, letterSpacing: 0.5 }}>
          {countLabel(filtered.length, trail).toUpperCase()}
        </div>
        {filtered.length === 0 ? (
          <div style={{
            background: "rgba(30, 38, 60, 0.45)", padding: 30, borderRadius: 16,
            textAlign: "center", color: MUTED, border: `1px solid ${BORDER}`,
          }}>
            {tC("noCrewsFound")}<br />
            <button onClick={() => { setFilters({}); setSearch(""); }} style={{
              marginTop: 10, background: "transparent", border: "none",
              color: PRIMARY, cursor: "pointer", fontSize: 13, fontWeight: 700,
            }}>{tC("resetFilters")}</button>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: isWide ? "1fr 1fr" : "1fr",
            gap: 12,
          }}>
            {filtered
              .sort((a, b) => leagueFilter ? b.weekly_km - a.weekly_km : a.distance_km - b.distance_km)
              .map((c) => <NearbyCrewCard key={c.id} crew={c} />)}
          </div>
        )}
      </div>
        </main>
      </div>
    </div>
  );
}

/* ═══ FactionWarBar ═══ — Nachtpuls vs Sonnenwacht Macht-Balance */
function FactionWarBar({
  scopeLabel, crews, compact = false,
}: { scopeLabel: string; crews: NearbyCrew[]; compact?: boolean }) {
  const power = factionPowerForCrews(crews);
  const total = power.syndicate + power.vanguard || 1;
  const leftPct = (power.syndicate / total) * 100;
  const rightPct = 100 - leftPct;
  const winner: "syndicate" | "vanguard" | "tie" =
    power.syndicate === power.vanguard ? "tie"
      : power.syndicate > power.vanguard ? "syndicate" : "vanguard";

  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    setAnimated(false);
    const t = setTimeout(() => setAnimated(true), 60);
    return () => clearTimeout(t);
  }, [scopeLabel, crews.length]);

  const F0 = FACTIONS[0];
  const F1 = FACTIONS[1];

  if (compact) {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, fontWeight: 800, marginBottom: 3 }}>
          <span style={{ color: F0.color }}>{F0.icon} {Math.round(leftPct)}%</span>
          <span style={{ color: MUTED, fontSize: 9 }}>{scopeLabel}</span>
          <span style={{ color: F1.color }}>{Math.round(rightPct)}% {F1.icon}</span>
        </div>
        <div style={{ height: 5, borderRadius: 3, display: "flex", overflow: "hidden", background: "rgba(0,0,0,0.4)" }}>
          <div style={{ width: animated ? `${leftPct}%` : "50%", background: F0.color, transition: "width 1s cubic-bezier(0.2, 0.8, 0.2, 1)" }} />
          <div style={{ width: animated ? `${rightPct}%` : "50%", background: F1.color, transition: "width 1s cubic-bezier(0.2, 0.8, 0.2, 1)" }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: "rgba(30, 38, 60, 0.55)", border: `1px solid ${BORDER}`,
      borderRadius: 14, padding: 14, marginBottom: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 16 }}>⚔️</span>
        <span style={{ color: "#FFF", fontSize: 12, fontWeight: 900, letterSpacing: 0.5 }}>
          FRAKTIONS-MACHT · {scopeLabel.toUpperCase()}
        </span>
        <span style={{ color: MUTED, fontSize: 11, marginLeft: "auto" }}>diese Woche</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 18 }}>{F0.icon}</span>
          <div>
            <div style={{ color: F0.color, fontSize: 13, fontWeight: 900 }}>{F0.name}</div>
            <div style={{ color: MUTED, fontSize: 10 }}>{Math.round(power.syndicate).toLocaleString()} km</div>
          </div>
        </div>
        <div style={{
          color: winner === "tie" ? MUTED : (winner === "syndicate" ? F0.color : F1.color),
          fontSize: 11, fontWeight: 900,
        }}>
          {winner === "tie" ? "UNENTSCHIEDEN" : `+${Math.abs(Math.round(power.syndicate - power.vanguard))} km`}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: F1.color, fontSize: 13, fontWeight: 900 }}>{F1.name}</div>
            <div style={{ color: MUTED, fontSize: 10 }}>{Math.round(power.vanguard).toLocaleString()} km</div>
          </div>
          <span style={{ fontSize: 18 }}>{F1.icon}</span>
        </div>
      </div>
      <div style={{ height: 10, borderRadius: 5, display: "flex", overflow: "hidden", background: "rgba(0,0,0,0.4)", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.4)" }}>
        <div style={{
          width: animated ? `${leftPct}%` : "50%", background: F0.color,
          transition: "width 1.1s cubic-bezier(0.2, 0.8, 0.2, 1)",
          boxShadow: `0 0 10px ${F0.color}66`,
        }} />
        <div style={{
          width: animated ? `${rightPct}%` : "50%", background: F1.color,
          transition: "width 1.1s cubic-bezier(0.2, 0.8, 0.2, 1)",
          boxShadow: `0 0 10px ${F1.color}66`,
        }} />
      </div>
    </div>
  );
}


/* LastSeasonBadge, LeagueBadge, MEDALS, MEDAL_COLORS, TopThreeRanking, FilterPill, breadcrumbStyle moved to ./_tabs/_shared */

function countLabel(n: number, trail: { level: GeoLevel; label: string }[]): string {
  const last = trail[trail.length - 1];
  const noun = n === 1 ? "Crew" : "Crews";
  if (!last) return `${n} ${noun} weltweit`;
  const prep = last.level === "zip" ? "in PLZ" : last.level === "state" ? "in" : "in";
  return `${n} ${noun} ${prep} ${last.label}`;
}

function NearbyCrewCard({ crew: c }: { crew: typeof DEMO_NEARBY_CREWS[number] }) {
  const tMD = useTranslations("MapDashboard");
  const t = CREW_TYPES.find((x) => x.id === c.type)!;
  const priv = CREW_PRIVACY_OPTIONS.find((x) => x.id === c.privacy)!;
  return (
    <div style={{
      background: "rgba(30, 38, 60, 0.55)", padding: 16, borderRadius: 14,
      border: `1px solid ${BORDER}`,
      borderLeft: `3px solid ${c.color}`,
      display: "flex", flexDirection: "column",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{ fontSize: 22, opacity: 0.9 }}>{t.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <div style={{ color: "#FFF", fontSize: 16, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
              {c.name}
            </div>
            <LeagueBadge weeklyKm={c.weekly_km} />
          </div>
          <div style={{ color: MUTED, fontSize: 11, marginTop: 3, fontWeight: 700 }}>
            {t.name} · {FACTIONS.find((f) => f.id === c.faction)?.icon} {FACTIONS.find((f) => f.id === c.faction)?.name}
          </div>
          <div style={{ color: MUTED, fontSize: 11, marginTop: 2, display: "flex", alignItems: "center", gap: 5 }}>
            <CountryFlag country={c.country} size={20} />
            <span>{c.city} · {c.zip}{c.distance_km < 1000 ? ` · ${c.distance_km.toFixed(1)} km weg` : ""}</span>
          </div>
        </div>
        <FavoriteHeart crewId={c.id} />
        <div style={{
          background: "rgba(255,255,255,0.05)", border: `1px solid ${BORDER}`,
          padding: "3px 8px", borderRadius: 8,
          color: MUTED, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap",
        }}>{priv.icon} {priv.label}</div>
      </div>
      <div style={{ color: TEXT_SOFT, fontSize: 12, fontStyle: "italic", marginBottom: 10, flex: 1, opacity: 0.85 }}>
        &quot;{c.motto}&quot;
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", gap: 14, fontSize: 11, color: MUTED }}>
          <span>👥 <b style={{ color: "#FFF" }}>{c.member_count}</b></span>
          <span>📏 <b style={{ color: "#FFF" }}>{c.weekly_km}</b> km/Wo</span>
        </div>
        <button
          onClick={() => appAlert(tMD("joinRequestSent", { name: c.name }))}
          disabled={c.privacy === "closed"}
          style={{
            padding: "7px 14px", borderRadius: 10,
            background: c.privacy === "closed" ? "transparent" : c.color,
            color: c.privacy === "closed" ? MUTED : BG_DEEP,
            fontSize: 11, fontWeight: 800,
            cursor: c.privacy === "closed" ? "not-allowed" : "pointer",
            border: c.privacy === "closed" ? `1px solid ${BORDER}` : "none",
            opacity: c.privacy === "closed" ? 0.6 : 1,
          }}
        >
          {c.privacy === "open" ? "Beitreten" : c.privacy === "invite" ? "Anfragen" : "Geschlossen"}
        </button>
      </div>
    </div>
  );
}
/* ═══ Create Crew Form ═══ */
function CreateCrewForm({
  name, setName, motto, setMotto, zip, setZip, type, setType,
  color, setColor, privacy, setPrivacy,
  crewFaction, setCrewFaction,
  onSubmit, onCancel,
}: {
  name: string; setName: (s: string) => void;
  motto: string; setMotto: (s: string) => void;
  zip: string; setZip: (s: string) => void;
  type: CrewTypeId; setType: (t: CrewTypeId) => void;
  color: string; setColor: (c: string) => void;
  privacy: CrewPrivacy; setPrivacy: (p: CrewPrivacy) => void;
  crewFaction: "pfadfinder" | "waechterorden" | "stadtlaeufer" | "mystiker";
  setCrewFaction: (f: "pfadfinder" | "waechterorden" | "stadtlaeufer" | "mystiker") => void;
  onSubmit: () => void; onCancel: () => void;
}) {
  const tC = useTranslations("Crew");
  const tMD = useTranslations("MapDashboard");
  const selectedType = CREW_TYPES.find((t) => t.id === type)!;
  const initial = (name.trim() || placeholderForType(type, tMD)).charAt(0).toUpperCase();
  const displayName = name.trim() || placeholderForType(type, tMD);
  const displayMotto = motto.trim() || mottoForType(type, tMD);
  const displayZip = zip || "_____";

  const [isWide, setIsWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    setIsWide(mq.matches);
    const h = (e: MediaQueryListEvent) => setIsWide(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  return (
    <div>
      <style>{`
        @keyframes cardPulse { 0%,100% { transform: scale(1); opacity: 0.95; } 50% { transform: scale(1.02); opacity: 1; } }
        @keyframes rotateSlow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
        <button onClick={onCancel} style={{
          background: "transparent", border: "none", color: PRIMARY,
          fontSize: 14, cursor: "pointer", padding: 0,
        }}>{tC("createBack")}</button>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: isWide ? "1fr 340px" : "1fr",
        gap: 24, alignItems: "start",
      }}>
        {/* ═══ LEFT — FORM ═══ */}
        <div style={{ background: CARD, padding: 20, borderRadius: 18 }}>
          <div style={{ color: "#FFF", fontSize: 24, fontWeight: 900, marginBottom: 4 }}>
            {tC("createTitle")}
          </div>
          <div style={{ color: MUTED, fontSize: 13, marginBottom: 18 }}>
            {tC("createSubtitle")}
          </div>

          {/* Schritt 1 — Typ */}
          <StepLabel num={1} title={tC("step1Title")} />
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
            gap: 8, marginBottom: 10,
          }}>
            {CREW_TYPES.map((t) => {
              const active = type === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setType(t.id)}
                  style={{
                    padding: "12px 8px", borderRadius: 12,
                    background: active ? `${color}22` : "rgba(0,0,0,0.2)",
                    border: active ? `1.5px solid ${color}` : `1px solid ${BORDER}`,
                    boxShadow: active ? `0 0 14px ${color}44` : "none",
                    color: "#FFF", cursor: "pointer",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                    transition: "all 0.2s",
                  }}
                >
                  <span style={{ fontSize: 26 }}>{t.icon}</span>
                  <span style={{ fontSize: 11, fontWeight: 800 }}>{t.name}</span>
                </button>
              );
            })}
          </div>
          <div style={{
            fontSize: 12, color: TEXT_SOFT, background: `${color}11`,
            padding: "10px 12px", borderRadius: 10, marginBottom: 20,
            borderLeft: `3px solid ${color}`, lineHeight: 1.5,
          }}>
            <b style={{ color: "#FFF" }}>{selectedType.tagline}:</b> {selectedType.description}
          </div>

          {/* Schritt 2 — Identität */}
          <StepLabel num={2} title={tC("step2Title")} />
          <Label>{tC("labelCrewName")}</Label>
          <input
            value={name} onChange={(e) => setName(e.target.value.slice(0, 32))}
            placeholder={placeholderForType(type, tMD)}
            style={{ ...inputStyle(), marginBottom: 12 }}
          />
          <Label>{tC("labelMotto")} <span style={{ color: MUTED, fontWeight: 400 }}>{tC("labelMottoOptional")}</span></Label>
          <input
            value={motto} onChange={(e) => setMotto(e.target.value.slice(0, 60))}
            placeholder={mottoForType(type, tMD)}
            style={{ ...inputStyle(), marginBottom: 12 }}
          />
          <Label>{tC("labelColor")}</Label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
            {CREW_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                aria-label={tC("colorAria", { color: c })}
                style={{
                  width: 40, height: 40, borderRadius: 20,
                  background: c,
                  border: color === c ? "3px solid #FFF" : "2px solid rgba(255,255,255,0.15)",
                  cursor: "pointer",
                  boxShadow: color === c ? `0 0 16px ${c}aa` : "none",
                  transition: "all 0.15s",
                }}
              />
            ))}
          </div>

          {/* Schritt 3 — Revier */}
          <StepLabel num={3} title={tC("step3Title")} />
          <Label>{tC("labelZip")}</Label>
          <input
            value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
            placeholder={tC("zipPlaceholder")}
            style={{ ...inputStyle(), marginBottom: 6, fontFamily: "monospace", fontSize: 16, letterSpacing: 2 }}
          />
          <div style={{ fontSize: 11, color: MUTED, marginBottom: 20 }}>
            {tC("zipHint")}
          </div>

          {/* Schritt 4 — Sichtbarkeit */}
          <StepLabel num={4} title={tC("step4Title")} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
            {CREW_PRIVACY_OPTIONS.map((opt) => {
              const active = privacy === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setPrivacy(opt.id)}
                  style={{
                    padding: "12px 14px", borderRadius: 12,
                    background: active ? `${color}22` : "rgba(0,0,0,0.2)",
                    border: active ? `1.5px solid ${color}` : `1px solid ${BORDER}`,
                    color: "#FFF", cursor: "pointer", textAlign: "left",
                    display: "flex", alignItems: "center", gap: 12,
                  }}
                >
                  <span style={{ fontSize: 22 }}>{opt.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 800 }}>{opt.label}</div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{opt.hint}</div>
                  </div>
                  {active && <span style={{ color, fontSize: 18 }}>✓</span>}
                </button>
              );
            })}
          </div>

          {/* ═══ CREW-FRAKTION ═══ */}
          <div>
            <div style={{ color: MUTED, fontSize: 10, fontWeight: 800, letterSpacing: 1, marginBottom: 8 }}>
              {tC("factionHeader")}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
              {([
                { id: "pfadfinder",    icon: "🏃", name: tC("factionPfadfinder"), color: "#4ade80", buff: tC("factionPfadfinderBuff"), hint: tC("factionPfadfinderHint") },
                { id: "waechterorden", icon: "⚔️", name: tC("factionWaechter"),   color: "#FF6B4A", buff: tC("factionWaechterBuff"),   hint: tC("factionWaechterHint") },
                { id: "stadtlaeufer",  icon: "🏙️", name: tC("factionStadt"),      color: "#22D1C3", buff: tC("factionStadtBuff"),      hint: tC("factionStadtHint") },
                { id: "mystiker",      icon: "🔮", name: tC("factionMystiker"),   color: "#a855f7", buff: tC("factionMystikerBuff"),   hint: tC("factionMystikerHint") },
              ] as const).map((f) => {
                const active = crewFaction === f.id;
                return (
                  <button key={f.id} onClick={() => setCrewFaction(f.id)}
                    style={{
                      padding: 10, borderRadius: 12, textAlign: "left",
                      background: active ? `${f.color}22` : CARD,
                      border: active ? `2px solid ${f.color}` : `1px solid ${BORDER}`,
                      color: "#FFF", cursor: "pointer",
                      boxShadow: active ? `0 0 18px ${f.color}55` : "none",
                    }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 22 }}>{f.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 900, color: f.color }}>{f.name}</div>
                        <div style={{ fontSize: 10, color: MUTED }}>{f.hint}</div>
                      </div>
                      {active && <span style={{ color: f.color, fontSize: 16 }}>✓</span>}
                    </div>
                    <div style={{ marginTop: 6, padding: "3px 8px", borderRadius: 999, background: `${f.color}33`, color: f.color, fontSize: 10, fontWeight: 900, display: "inline-block" }}>
                      {f.buff}
                    </div>
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 10, color: MUTED, marginTop: 6 }}>
              {tC("factionSwitchHint")}
            </div>
          </div>

          <button
            onClick={onSubmit}
            style={{
              ...primaryBtnStyle(color),
              padding: "16px 20px", fontSize: 15,
              background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`,
              boxShadow: `0 4px 20px ${color}66`,
              animation: "cardPulse 2.4s ease-in-out infinite",
            }}
          >
            {tC("createButton", { name: name.trim() || tC("createButtonFallback") })}
          </button>
        </div>

        {/* ═══ RIGHT — LIVE PREVIEW + PERKS ═══ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, position: isWide ? "sticky" : "static", top: 12 }}>
          <div style={{ color: MUTED, fontSize: 10, fontWeight: 800, letterSpacing: 1 }}>
            {tC("livePreview")}
          </div>

          {/* Live Crew Card Preview */}
          <div style={{
            borderRadius: 18, overflow: "hidden",
            background: `linear-gradient(135deg, ${color}44 0%, rgba(20, 26, 44, 0.9) 70%)`,
            border: `1.5px solid ${color}66`,
            boxShadow: `0 8px 30px ${color}33`,
          }}>
            <div style={{
              height: 68, position: "relative",
              background: `linear-gradient(135deg, ${color} 0%, ${color}66 100%)`,
            }}>
              <div style={{
                position: "absolute", inset: 0,
                backgroundImage: `radial-gradient(circle at 20% 30%, ${color}66, transparent 50%)`,
              }} />
            </div>
            <div style={{ padding: "0 14px 14px", marginTop: -26 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 14,
                background: `linear-gradient(135deg, ${color}, ${color}aa)`,
                color: BG_DEEP, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 28, fontWeight: 900,
                boxShadow: `0 0 0 3px ${BG_DEEP}, 0 0 18px ${color}88`,
                marginBottom: 8,
              }}>{initial}</div>
              <div style={{ color: "#FFF", fontSize: 16, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {displayName}
              </div>
              <div style={{ color: MUTED, fontSize: 11, marginTop: 2, display: "flex", alignItems: "center", gap: 5 }}>
                <span>{selectedType.icon} {selectedType.name}</span>
                <span>·</span>
                <span style={{ fontFamily: "monospace" }}>{displayZip}</span>
              </div>
              <div style={{ color: TEXT_SOFT, fontSize: 12, marginTop: 8, fontStyle: "italic", lineHeight: 1.4 }}>
                &ldquo;{displayMotto}&rdquo;
              </div>
              <div style={{ display: "flex", gap: 5, marginTop: 10 }}>
                <LeagueBadge weeklyKm={0} />
                <span style={{
                  fontSize: 10, fontWeight: 800,
                  padding: "3px 8px", borderRadius: 8,
                  background: "rgba(255,255,255,0.08)", color: MUTED,
                  border: `1px solid ${BORDER}`,
                }}>
                  {CREW_PRIVACY_OPTIONS.find((o) => o.id === privacy)?.icon}{" "}
                  {CREW_PRIVACY_OPTIONS.find((o) => o.id === privacy)?.label}
                </span>
              </div>
            </div>
          </div>

          {/* Das bekommt ihr */}
          <div>
            <div style={{ color: MUTED, fontSize: 10, fontWeight: 800, letterSpacing: 1, marginBottom: 8 }}>
              {tC("youGetHeader")}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { icon: "🔑", title: tC("perkInviteCode"),  desc: tC("perkInviteCodeDesc") },
                { icon: "💬", title: tC("perkChat"),        desc: tC("perkChatDesc") },
                { icon: "🏆", title: tC("perkChallenges"),  desc: tC("perkChallengesDesc") },
                { icon: "⚔️", title: tC("perkRivals"),      desc: tC("perkRivalsDesc") },
                { icon: "📅", title: tC("perkGroupRuns"),   desc: tC("perkGroupRunsDesc") },
                { icon: "🏅", title: tC("perkLeague"),      desc: tC("perkLeagueDesc") },
                { icon: "🛡️", title: tC("perkTerritory"),   desc: tC("perkTerritoryDesc") },
              ].map((p) => (
                <div key={p.title} style={{
                  background: "rgba(30, 38, 60, 0.55)", borderRadius: 10,
                  padding: "8px 10px", border: `1px solid ${BORDER}`,
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: `${color}22`, border: `1px solid ${color}55`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, flexShrink: 0,
                  }}>{p.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#FFF", fontSize: 12, fontWeight: 800 }}>{p.title}</div>
                    <div style={{ color: MUTED, fontSize: 10, marginTop: 1 }}>{p.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{
            padding: 12, borderRadius: 12,
            background: `linear-gradient(135deg, ${color}18 0%, ${color}0a 100%)`,
            border: `1px dashed ${color}55`,
            color: TEXT_SOFT, fontSize: 11, lineHeight: 1.5,
            textAlign: "center",
          }}>
            {tC("noContractHint")}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepLabel({ num, title }: { num: number; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, marginTop: 4 }}>
      <div style={{
        width: 24, height: 24, borderRadius: 12,
        background: PRIMARY, color: BG_DEEP,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 900,
      }}>{num}</div>
      <div style={{ color: "#FFF", fontSize: 14, fontWeight: 800 }}>{title}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: PRIMARY, fontSize: 11, fontWeight: 800, marginBottom: 6, letterSpacing: 0.5 }}>
      {children}
    </div>
  );
}

function placeholderForType(t: CrewTypeId, tMD: (key: string) => string): string {
  const map: Record<CrewTypeId, string> = {
    friends: tMD("placeholderCrewFriends"),
    family: tMD("placeholderCrewFamily"),
    school: tMD("placeholderCrewSchool"),
    work: tMD("placeholderCrewWork"),
    sports: tMD("placeholderCrewSports"),
    neighborhood: tMD("placeholderCrewNeighborhood"),
    open: tMD("placeholderCrewOpen"),
  };
  return map[t];
}
function mottoForType(t: CrewTypeId, tMD: (key: string) => string): string {
  const map: Record<CrewTypeId, string> = {
    friends: tMD("mottoCrewFriends"),
    family: tMD("mottoCrewFamily"),
    school: tMD("mottoCrewSchool"),
    work: tMD("mottoCrewWork"),
    sports: tMD("mottoCrewSports"),
    neighborhood: tMD("mottoCrewNeighborhood"),
    open: tMD("mottoCrewOpen"),
  };
  return map[t];
}

/* ═══════════════════════════════════════════════════════
 * MY CREW VIEW — Crew-Hub im "Meine Base"-Stil
 * Background-Image fülltt den ganzen Modal-Body; Hero-Info-Card
 * + Feature-Button-Grid liegen als Overlays drauf. Klick auf eine
 * Feature-Kachel öffnet das Sub-View (Mitglieder/Wächter/Bauwerke
 * etc.) mit Back-Button. Walking-Ära-Stats (km/Liga/Saison) komplett
 * raus — Crew ist ein RoK/CoD-System mit Ansehen/Bauen/Trupps.
 * ═══════════════════════════════════════════════════════ */
function MyCrewView({
  crew, profile, subTab, setSubTab, onLeave, onPlaceBuilding, onClose,
}: {
  crew: Crew;
  profile: Profile | null;
  subTab: CrewSubTab;
  setSubTab: (t: CrewSubTab) => void;
  onLeave: () => void;
  onPlaceBuilding?: (kind: BuildingKind) => void;
  onClose?: () => void;
}) {
  const tC = useTranslations("Crew");
  const isAdmin = profile?.id === crew.owner_id;
  // Background-Artwork (karte_crew_bg) wird vom äußeren FullscreenFrame geladen — hier nur Akzent.
  const accent = crew.color;
  const uiIconArt = useUiIconArt();

  // ─── Crew-Stats (CoD/RoK-Konzept) ───
  // Ansehen = Summe aller Mitglieder-Ansehen (keine Crew-Stufen, kein Vertrauen).
  // Werte: aktuell aus dem crew-Objekt + DEMO-Set. Sobald die Crew-RPCs live
  // sind (ansehen_total/repeater_count/cvc_wins), springen die Werte ein.
  const ansehen = (crew as unknown as { ansehen_total?: number }).ansehen_total ?? 0;
  const memberCount = DEMO_CREW_MEMBERS.length;
  const territoryCount = DEMO_CREW_STATS.total_territories ?? 0;
  const cvcWins = (crew as unknown as { cvc_wins?: number }).cvc_wins ?? 0;
  const repeaterCount = (crew as unknown as { repeater_count?: number }).repeater_count ?? 0;
  const crewPower = ansehen + memberCount * 1000 + territoryCount * 500;

  // Pending-Counts für Tile-Badges (Geschenke: häufig+selten). Wird per
  // /api/crews/gifts/count alle 20s aktualisiert.
  const [giftCount, setGiftCount] = useState<{ common: number; rare: number; total: number }>({ common: 0, rare: 0, total: 0 });
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/crews/gifts/count", { cache: "no-store" });
        if (!r.ok || !alive) return;
        const j = await r.json() as { common?: number; rare?: number; total?: number };
        if (alive) setGiftCount({ common: j.common ?? 0, rare: j.rare ?? 0, total: j.total ?? 0 });
      } catch { /* noop */ }
    };
    void load();
    const iv = setInterval(load, 20000);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  // Top-Tabs sind die 3 Main-Views (analog RoK-Pattern, aber neutralere Namen
  // damit man nicht direkt an RoK denkt):
  //   "overview"  → "Lage"        (Dashboard mit Tile-Grid)
  //   "members"   → "Mitglieder"  (Mitglieder-Liste, Officer-Roster, etc.)
  //   "settings"  → "Hausregeln"  (Crew-Einstellungen)
  // Tile-Klick öffnet eine Feature-Detail-View (inFeature = true) — die hat
  // einen Back-Button und blendet die Top-Tabs solange aus.
  const isMainView = subTab === "overview" || subTab === "members" || subTab === "settings";
  const inFeature = !isMainView;

  // X-Close-Button oben rechts (FullscreenFrame) wirkt dynamisch als Back-Knopf:
  // Wenn wir in einer Feature-Detail-View sind, schließen wir nur die Detail-
  // View (zurück zu "overview"); der Klick auf X schließt nicht das Crew-Modal.
  // Der Frame dispatchet ein cancelable Event vor dem onClose-Call.
  useEffect(() => {
    const onIntent = (e: Event) => {
      if (inFeature) {
        e.preventDefault();
        setSubTab("overview");
      }
    };
    window.addEventListener("ma365:crew-modal-close-intent", onIntent);
    return () => window.removeEventListener("ma365:crew-modal-close-intent", onIntent);
  }, [inFeature, setSubTab]);

  type Feature = { id: CrewSubTab; label: string; icon: string; slot?: string; badge?: number };
  // 7 Crew-Funktionen im Tile-Grid. NICHT enthalten:
  //   - Bauwerke + Events (gibt es nicht als Crew-Feature)
  //   - Wächter, Crew-Chat, Lagerhaus, Kopfgelder, Challenges, Crew-Kriege
  //   - Mitglieder + Einstellungen (Top-Tabs)
  // `slot` referenziert cosmetic_artwork.kind='ui_icon' → Admin-Artwork
  // überschreibt den Emoji-Fallback (siehe artwork-prompts-admin.ts).
  const features: Feature[] = [
    { id: "tech",        label: "Forschung",   icon: "🧪", slot: "crew_tile_forschung" },
    { id: "lager",       label: "Lager",       icon: "📦", slot: "crew_tile_lager" },
    { id: "shop",        label: "Shop",        icon: "🛒", slot: "crew_tile_shop" },
    { id: "attacks",     label: "Angriffe",    icon: "⚔",  slot: "crew_tile_angriffe" },
    { id: "territories", label: "Gebiete",     icon: "🗺", slot: "crew_tile_gebiete" },
    { id: "help",        label: "Hilfe",       icon: "🤝", slot: "crew_tile_hilfe" },
    { id: "gifts",       label: "Crew-Beute",  icon: "🎁", slot: "crew_tile_beute", badge: giftCount.total },
  ];

  type TopTab = { id: "overview" | "members" | "settings"; label: string; icon: string; slot: string };
  const topTabs: TopTab[] = [
    { id: "overview", label: "Übersicht",  icon: "📋", slot: "crew_tab_uebersicht" },
    { id: "members",  label: "Mitglieder", icon: "👥", slot: "crew_tab_mitglieder" },
    { id: "settings", label: "Hausregeln", icon: "⚙",  slot: "crew_tab_hausregeln" },
  ];

  // Officer-Rollen (CoD-Pattern: King/Diplomacy/Warmaster/RoW/Territory).
  // Aktuell Placeholder — sobald Crew-Offizier-RPCs live sind, ziehen wir
  // die Inhaber aus der DB. "::FREI::" für unbesetzte Slots.
  const officers: { role: string; holder: string }[] = [
    { role: "Don",                holder: (crew as unknown as { leader_name?: string }).leader_name ?? "—" },
    { role: "Innere Angelegenheiten", holder: "::FREI::" },
    { role: "Diplomatie",         holder: "::FREI::" },
    { role: "Kriegsmeister",      holder: "::FREI::" },
    { role: "Event-Management",   holder: "::FREI::" },
    { role: "Turf-Management",    holder: "::FREI::" },
  ];

  // Per-Tile-Akzentfarbe (für transparente Tiles mit feiner Akzent-Linie).
  // Jede Funktion bekommt einen eigenen Hauch — kein Neon, nur als feiner Indikator.
  const TILE_ACCENT: Record<string, string> = {
    buildings:   "#FFD700",
    tech:        "#A855F7",
    lager:       "#FF6B4A",
    shop:        "#FFB13A",
    attacks:     "#FF2D78",
    territories: "#A855F7",
    help:        "#22D1C3",
    gifts:       "#FF6B9D",
    events:      "#22D1C3",
  };

  // Chamfered Octagon-Clip-Path — sci-fi/blueprint Look, klar anders als Base-Rounded.
  const TILE_CLIP = "polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px)";

  // Chat-Reservierung: Chat-Widget sitzt bottom-left fixed.
  // Wenn collapsed ~340×60, expanded bis ~340×300. Wir reservieren konservativ
  // die KOMPLETTE linke Spalte (340 breit, volle Höhe) — dort wird KEIN Modal-Inhalt
  // gerendert, weder Banner noch Tile. Banner spannt nur die rechte Spalte.
  const CHAT_RESERVE_WIDTH = 340;

  return (
    <div className="flex flex-col h-full relative overflow-hidden" style={{ color: "#F0F0F0" }}>
      {!inFeature && (
        <div
          className="grid h-full gap-3"
          style={{
            gridTemplateColumns: `${CHAT_RESERVE_WIDTH}px 1fr`,
            gridTemplateRows: "1fr",
          }}
        >
          {/* LINKE SPALTE — Banner oben, Top-Tabs darunter (über dem Chat),
              dann Chat-Zone. */}
          <div className="flex flex-col min-w-0">
            <CrewBanner
              crew={crew}
              isAdmin={isAdmin}
              ansehen={ansehen}
              memberCount={memberCount}
              territoryCount={territoryCount}
              leaderName={(crew as unknown as { leader_name?: string }).leader_name ?? "—"}
              accent={accent}
            />

            {/* ═══ TOP-TABS ═══ — Parallelogramm-Form via clip-path (KEIN skew-Transform
                damit der Text gestochen scharf rendert, Sub-pixel-Antialiasing erhalten). */}
            <div className="shrink-0 mt-2 flex items-stretch gap-1 pr-2">
              {topTabs.map((t) => {
                const active = subTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSubTab(t.id)}
                    className="relative flex items-center justify-center transition flex-1"
                    style={{
                      // Kein clip-path/Filter auf dem Button — sonst greyscale-AA → unscharf.
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      color: "#FFF",
                      height: 44,
                      padding: 0,
                    }}
                  >
                    {/* Slant-BG als separater Layer; Text bleibt un-geclippt scharf. */}
                    <span
                      aria-hidden
                      style={{
                        position: "absolute",
                        inset: 0,
                        clipPath: "polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)",
                        background: active
                          ? "linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(10,14,22,0.80) 100%)"
                          : "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(10,14,22,0.78) 100%)",
                        boxShadow: active
                          ? `inset 0 0 0 1px rgba(255,255,255,0.18), inset 0 -2px 0 0 ${accent}aa`
                          : "inset 0 0 0 1px rgba(255,255,255,0.08)",
                        pointerEvents: "none",
                      }}
                    />
                    <span className="relative flex items-center gap-2 px-3" style={{ zIndex: 1 }}>
                      <span
                        style={{
                          fontSize: 17,
                          lineHeight: 1,
                          filter: active ? "none" : "grayscale(40%) brightness(0.8)",
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                        }}
                      >
                        <UiIcon slot={t.slot} fallback={t.icon} art={uiIconArt} size={20} />
                      </span>
                      <span
                        className="font-black uppercase truncate"
                        style={{
                          color: active ? "#FFF" : "rgba(205,212,227,0.78)",
                          fontFamily: "var(--font-display-stack)",
                          fontSize: 13,
                          letterSpacing: 1.1,
                          textShadow: active ? "0 1px 0 rgba(0,0,0,0.55)" : "0 1px 0 rgba(0,0,0,0.4)",
                          WebkitFontSmoothing: "antialiased",
                          MozOsxFontSmoothing: "grayscale",
                        }}
                      >
                        {t.label}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Rest der linken Spalte: leer. Chat-Widget liegt drüber. */}
            <div className="flex-1" aria-hidden style={{ pointerEvents: "none" }} />
          </div>

          {/* RECHTE SPALTE — Content abhängig vom aktiven Top-Tab */}
          <div className="flex flex-col h-full min-w-0 overflow-hidden pr-3">
            {/* ═══ MAIN-CONTENT ═══ — Tile-Grid / Mitglieder / Hausregeln */}
            {subTab === "overview" && (
              <div className="flex-1 min-h-0 flex flex-col gap-2">
                {/* Crew-Botschaft — größerer editierbarer Bereich */}
                <CrewMessageEditor crewId={crew.id} accent={accent} canEdit={isAdmin} />
                {/* Tile-Grid: 3×3, kompakter — Tiles nicht über volle Breite,
                    sondern auf max 360px begrenzt damit Icons enger zusammenrücken. */}
                <div
                  className="flex-1 min-h-0 grid mx-auto"
                  style={{
                    gridTemplateColumns: "repeat(4, minmax(100px, 130px))",
                    gridTemplateRows: "repeat(2, minmax(0, 1fr))",
                    gap: 0,
                    width: "100%",
                    maxWidth: 520,
                  }}
                >
                  {features.map((f) => (
                    <TileButton
                      key={f.id}
                      onClick={() => {
                        // Angriffe öffnet die globale Rally-Liste über Custom-Event,
                        // OHNE das Crew-Modal zu schließen. Das Popover positioniert
                        // sich rechts vom Chat-Bereich (left:360px) und liegt z-9100
                        // über dem Modal-Content.
                        if (f.id === "attacks") {
                          window.dispatchEvent(new CustomEvent("ma365:open-rally-list"));
                          return;
                        }
                        setSubTab(f.id);
                      }}
                      icon={f.icon}
                      slot={f.slot}
                      label={f.label}
                      accent={TILE_ACCENT[f.id] ?? accent}
                      clip={TILE_CLIP}
                      badge={f.badge}
                    />
                  ))}
                </div>
              </div>
            )}

            {subTab === "members" && (
              <div
                className="flex-1 min-h-0 rounded-xl overflow-y-auto pt-7 px-3 pb-3"
                style={{
                  background: "rgba(15,17,21,0.55)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                }}
              >
                <CrewMembers crew={crew} profile={profile} isAdmin={isAdmin} />
              </div>
            )}

            {subTab === "settings" && (
              <div
                className="flex-1 min-h-0 rounded-xl overflow-y-auto p-3"
                style={{
                  background: "rgba(15,17,21,0.55)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                }}
              >
                <CrewSettings crew={crew} isAdmin={isAdmin} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ FEATURE-DETAIL: Sub-View. KEIN Back-Button — X-Schließen oben
          rechts vom FullscreenFrame fungiert dynamisch als Back-Knopf wenn
          inFeature (siehe Close-Intent-Event-Listener weiter oben). ═══ */}
      {inFeature && (
        <div className="flex-1 min-h-0 flex flex-col">
          <div
            className={`flex-1 min-h-0 rounded-xl p-3 ${subTab === "gifts" ? "overflow-hidden" : "overflow-y-auto"}`}
            style={{
              background: "rgba(15,17,21,0.78)",
              border: "1px solid rgba(255,255,255,0.08)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
            }}
          >
            {subTab === "feed"        && <CrewFeed color={crew.color} />}
            {subTab === "guardians"   && <CrewGuardians crewId={crew.id} crewColor={crew.color} />}
            {subTab === "challenges"  && <CrewChallenges color={crew.color} />}
            {subTab === "events"      && <CrewEvents color={crew.color} />}
            {subTab === "chat"        && <CrewChat color={crew.color} meUsername={profile?.username || "me"} />}
            {subTab === "tech"        && <TabTech />}
            {subTab === "buildings"   && <TabBauwerke onPlaceBuilding={onPlaceBuilding} />}
            {subTab === "bounties"    && <TabKopfgelder crewId={crew.id} />}
            {subTab === "shop"        && <TabShop />}
            {subTab === "attacks"     && <ComingSoonStub title="Angriffe" hint="Crew-Angriffs-Logs werden hier bald angezeigt." />}
            {subTab === "help"        && <ComingSoonStub title="Hilfe" hint="Bau-/Forschungs-Hilfen anderer Crew-Mitglieder werden hier sichtbar." />}
            {subTab === "lager"       && <ComingSoonStub title="Lager" hint="Crew-Lager mit gemeinsamen Resourcen kommt bald." />}
            {subTab === "territories" && <ComingSoonStub title="Gebiete" hint="Eroberte Crew-Gebiete und Repeater-Statusfunktionen folgen." />}
            {subTab === "gifts"       && <CrewGiftsView accent={accent} />}
          </div>
        </div>
      )}
    </div>
  );
}

/* Crew-Banner mit Wappen (Image-Upload für Admins) + 5 Stats.
   Schrift bewusst ohne backdrop-blur und mit 0-Blur-Shadow → keine "verschwommene" Optik. */
function CrewBanner({
  crew, isAdmin, ansehen, memberCount, territoryCount, leaderName, accent,
}: {
  crew: Crew;
  isAdmin: boolean;
  ansehen: number;
  memberCount: number;
  territoryCount: number;
  leaderName: string;
  accent: string;
}) {
  const logoUrl = (crew as unknown as { custom_logo_url?: string | null }).custom_logo_url ?? null;
  const [currentLogo, setCurrentLogo] = useState<string | null>(logoUrl);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      // Step 1: Sign upload URL
      const signRes = await fetch("/api/crew/media", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "sign", kind: "logo", crew_id: crew.id, file_name: file.name, content_type: file.type }),
      });
      if (!signRes.ok) throw new Error("Sign fehlgeschlagen");
      const { upload_url, path } = await signRes.json() as { upload_url: string; path: string };

      // Step 2: PUT direkt zur Signed-URL
      const putRes = await fetch(upload_url, { method: "PUT", body: file, headers: { "content-type": file.type } });
      if (!putRes.ok) throw new Error("Upload fehlgeschlagen");

      // Step 3: Finalize → DB update + Public-URL zurück
      const finRes = await fetch("/api/crew/media", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "finalize", kind: "logo", crew_id: crew.id, path }),
      });
      if (!finRes.ok) throw new Error("Finalize fehlgeschlagen");
      const fin = await finRes.json() as { ok: boolean; url: string };
      setCurrentLogo(fin.url);
    } catch (e) {
      console.error(e);
      alert(`Logo-Upload fehlgeschlagen: ${e instanceof Error ? e.message : "unbekannt"}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      className="shrink-0 p-2.5 flex items-center gap-2.5"
      style={{
        // Banner und Chat starten beide bei viewport-x=0 (FullscreenFrame
        // läuft mit flushContent ohne Padding). Volle Chat-Breite.
        width: "min(340px, 60vw)",
        // Links flach (am Modal-Rand) — nur rechts abgerundet.
        borderRadius: "0 12px 12px 0",
        background: "rgba(15,17,21,0.65)",
        border: `1px solid ${accent}44`,
        borderLeft: "none",
        boxShadow: "0 2px 10px rgba(0,0,0,0.4)",
      }}
    >
      {/* Crew-Wappen — Image-Upload für Admin, sonst Buchstabe */}
      <button
        type="button"
        disabled={!isAdmin || uploading}
        onClick={() => fileRef.current?.click()}
        className="shrink-0 relative group"
        style={{
          width: 64, height: 64,
          borderRadius: "50%",
          border: `2px solid ${accent}`,
          background: currentLogo ? "transparent" : `linear-gradient(160deg, ${accent}, ${accent}aa)`,
          overflow: "hidden",
          cursor: isAdmin ? "pointer" : "default",
          padding: 0,
        }}
        title={isAdmin ? "Wappen hochladen" : crew.name}
      >
        {currentLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={currentLogo} alt="Crew-Wappen" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span
            className="flex items-center justify-center w-full h-full"
            style={{
              color: BG_DEEP,
              fontSize: 30, fontWeight: 900,
              fontFamily: "var(--font-display-stack)",
            }}
          >
            {crew.name.charAt(0).toUpperCase()}
          </span>
        )}
        {isAdmin && (
          <span
            className="absolute inset-0 flex items-center justify-center text-white text-[20px] transition opacity-0 group-hover:opacity-100"
            style={{ background: "rgba(0,0,0,0.6)" }}
          >
            {uploading ? "…" : "📷"}
          </span>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            if (fileRef.current) fileRef.current.value = "";
          }}
        />
      </button>

      {/* Identity + Stats */}
      <div className="flex-1 min-w-0">
        {/* Name + Tag — items-center auf einer Box von gleicher Höhe.
            Beide Spans bekommen exakt dieselbe Höhe (cap-Höhe des Display-Fonts ≈ 14px
            bei 16px font-size), dann zentrieren sie visuell sauber zueinander. */}
        <div className="flex items-center gap-2 min-w-0" style={{ height: 18 }}>
          <span
            className="text-[16px] font-black truncate inline-flex items-center"
            style={{
              color: "#FFF",
              fontFamily: "var(--font-display-stack)",
              letterSpacing: 0.3,
              lineHeight: 1,
              height: "100%",
            }}
          >
            {crew.name}
          </span>
          <span
            className="shrink-0 rounded text-[10px] font-black inline-flex items-center"
            style={{
              color: accent,
              background: "rgba(0,0,0,0.4)",
              border: `1px solid ${accent}88`,
              letterSpacing: 0.6,
              padding: "0 6px",
              height: "100%",
              lineHeight: 1,
              transform: "translateY(-2px)",
            }}
          >
            [{(crew as unknown as { tag?: string }).tag ?? crew.name.slice(0, 4).toUpperCase()}]
          </span>
        </div>

        {/* Ansehen prominent */}
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-[10.5px] font-black uppercase tracking-wider" style={{ color: "#FFD700" }}>⚜ Ansehen</span>
          <span className="text-[17px] font-black tabular-nums" style={{ color: "#FFD700", fontFamily: "var(--font-display-stack)", letterSpacing: -0.3, lineHeight: 1 }}>
            {ansehen.toLocaleString("de-DE")}
          </span>
        </div>

        {/* Anführer — eigene Zeile, full-width (Name kann lang sein) */}
        <div className="mt-1">
          <BannerStat label="Anführer" value={leaderName} />
        </div>

        {/* Heimat + Gebiete nebeneinander */}
        <div className="grid grid-cols-2 gap-x-3 mt-0.5">
          <BannerStat label="Heimat"  value={cityNameFromZip(crew.zip)} />
          <BannerStat label="Gebiete" value={territoryCount.toLocaleString("de-DE")} />
        </div>

        {/* Mitglieder + Geschenkestufe darunter */}
        <div className="grid grid-cols-2 gap-x-3 mt-0.5">
          <BannerStat label="Mitglieder"    value={`${memberCount}/50`} />
          <BannerStat label="Geschenkestufe" value={String((crew as unknown as { gift_tier?: number }).gift_tier ?? 1)} />
        </div>
      </div>
    </div>
  );
}

/* Crew-Botschaft — Boss kann formatieren (Fett, Kursiv, Größe, Farbe).
   Speichert in localStorage (key: crewMessage:{crewId}) — Backend folgt später.
   Members sehen den Text read-only. */
function CrewMessageEditor({ crewId, accent, canEdit }: { crewId: string; accent: string; canEdit: boolean }) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const storageKey = `ma365:crewMessage:${crewId}`;
  const [editing, setEditing] = useState(false);
  const [html, setHtml] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(storageKey) ?? "";
  });
  const [translated, setTranslated] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [trErr, setTrErr] = useState(false);

  // Plain-Text aus dem aktuellen HTML (für Übersetzungs-API)
  const plainText = useMemo(() => {
    if (typeof window === "undefined" || !html) return "";
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return (tmp.textContent ?? "").trim();
  }, [html]);

  async function translate() {
    if (translating) return;
    // Toggle: wenn schon übersetzt, zurück zum Original
    if (translated) { setTranslated(null); return; }
    if (plainText.length < 2) return;
    setTranslating(true); setTrErr(false);
    const target = typeof navigator !== "undefined" ? navigator.language.slice(0, 2) : "de";
    try {
      const r = await fetch("/api/chat/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: plainText, target }),
      });
      if (!r.ok) { setTrErr(true); return; }
      const j = await r.json() as { text?: string };
      if (j.text && j.text.trim() !== plainText) setTranslated(j.text);
      else setTranslated(plainText);
    } catch { setTrErr(true); } finally { setTranslating(false); }
  }

  function exec(cmd: string, value?: string) {
    if (!editorRef.current) return;
    editorRef.current.focus();
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    document.execCommand(cmd, false, value);
  }

  function save() {
    const next = editorRef.current?.innerHTML ?? "";
    setHtml(next);
    localStorage.setItem(storageKey, next);
    setEditing(false);
  }

  function cancel() {
    if (editorRef.current) editorRef.current.innerHTML = html;
    setEditing(false);
  }

  return (
    <div
      className="shrink-0 rounded-xl p-2"
      style={{
        background: "rgba(15,17,21,0.55)",
        border: `1px solid ${accent}33`,
      }}
    >
      {/* Toolbar — nur sichtbar im Edit-Mode */}
      {editing && (
        <div className="flex items-center gap-1 mb-1.5 flex-wrap">
          <ToolbarBtn label="B" onClick={() => exec("bold")} bold />
          <ToolbarBtn label="I" onClick={() => exec("italic")} italic />
          <ToolbarBtn label="U" onClick={() => exec("underline")} underline />
          <select
            onChange={(e) => exec("fontSize", e.target.value)}
            defaultValue=""
            className="text-[10px] font-black bg-black/40 text-white border border-white/20 rounded px-1 py-0.5"
          >
            <option value="" disabled>Größe</option>
            <option value="2">Klein</option>
            <option value="3">Normal</option>
            <option value="5">Groß</option>
            <option value="6">XL</option>
          </select>
          <input
            type="color"
            onChange={(e) => exec("foreColor", e.target.value)}
            defaultValue={accent}
            className="w-6 h-6 rounded border border-white/20 bg-transparent cursor-pointer"
            title="Textfarbe"
          />
          <div className="flex-1" />
          <button
            onClick={save}
            className="px-2 py-0.5 text-[10px] font-black rounded uppercase tracking-wider"
            style={{ background: accent, color: BG_DEEP }}
          >Speichern</button>
          <button
            onClick={cancel}
            className="px-2 py-0.5 text-[10px] font-black text-white rounded uppercase tracking-wider"
            style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}
          >Abbruch</button>
        </div>
      )}

      {/* Content-Area — zeigt entweder Original (HTML) ODER Übersetzung (plain).
          Beim Editieren immer Original. Sobald Übersetzung aktiv ist, wird die
          Box mit Accent-Border markiert damit man sieht "das ist gerade übersetzt". */}
      <div
        ref={editorRef}
        contentEditable={editing}
        suppressContentEditableWarning
        className="text-[12px] text-white outline-none overflow-y-auto"
        style={{
          lineHeight: 1.5,
          minHeight: 140,
          maxHeight: 200,
          padding: "4px 2px",
          ...(translated && !editing ? {
            background: `${accent}11`,
            border: `1px dashed ${accent}66`,
            borderRadius: 6,
          } : {}),
        }}
        {...(translated && !editing
          ? { children: translated }
          : { dangerouslySetInnerHTML: { __html: html || (canEdit ? `<span style="color:#8B8FA3;font-style:italic">Klicke auf Bearbeiten um eine Botschaft an die Crew zu schreiben…</span>` : `<span style="color:#8B8FA3;font-style:italic">Keine Botschaft vom Crew-Anführer.</span>`) } })}
      />

      {/* Action-Row: Übersetzen (für alle) + Bearbeiten (nur Boss) */}
      {!editing && (
        <div className="flex justify-end items-center gap-1 mt-1">
          <button
            onClick={translate}
            disabled={translating || (!translated && plainText.length < 2)}
            title={
              plainText.length < 2 ? "Keine Botschaft zum Übersetzen"
              : translated ? "Original anzeigen"
              : trErr ? "Fehler — nochmal" : "Übersetzen"
            }
            className="text-[11px] px-2 py-0.5 rounded inline-flex items-center justify-center transition"
            style={{
              color: translated ? accent : "#C8CDD9",
              background: "rgba(0,0,0,0.4)",
              border: `1px solid ${translated ? accent : "rgba(255,255,255,0.18)"}`,
              opacity: plainText.length < 2 ? 0.4 : (translated ? 1 : 0.85),
              lineHeight: 1,
              cursor: plainText.length < 2 ? "not-allowed" : "pointer",
            }}
          >
            {translating ? "⏳" : translated ? "✓" : "🌐"}
          </button>
          {canEdit && (
          <button
            onClick={() => { setEditing(true); setTimeout(() => editorRef.current?.focus(), 0); }}
            className="text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider"
            style={{ color: accent, background: "rgba(0,0,0,0.4)", border: `1px solid ${accent}66` }}
          >
            ✎ Bearbeiten
          </button>
          )}
        </div>
      )}
    </div>
  );
}

function ToolbarBtn({ label, onClick, bold, italic, underline }: { label: string; onClick: () => void; bold?: boolean; italic?: boolean; underline?: boolean }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className="w-6 h-6 rounded inline-flex items-center justify-center text-[12px] text-white"
      style={{
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.18)",
        fontWeight: bold ? 900 : 700,
        fontStyle: italic ? "italic" : "normal",
        textDecoration: underline ? "underline" : "none",
      }}
    >
      {label}
    </button>
  );
}

function BannerStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5 min-w-0 leading-tight">
      <span className="text-[#9ba4ba] uppercase tracking-wider font-black shrink-0 text-[10px]">{label}</span>
      <span className="text-white font-bold truncate tabular-nums text-[11.5px]">{value}</span>
    </div>
  );
}

/* Platzhalter für noch nicht implementierte Crew-Features (Angriffe, Hilfe,
   Lager, Gebiete). Zeigt sauber an, was als Nächstes kommt. */
function ComingSoonStub({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-10 gap-3">
      <div className="text-3xl">🚧</div>
      <div className="text-base font-black text-white" style={{ letterSpacing: 0.4 }}>{title}</div>
      <div className="text-[11px] text-[#cdd4e3] max-w-xs leading-snug">{hint}</div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// CrewGiftsView — Allianzgeschenke-Klon (Mig 00397/00398)
// ════════════════════════════════════════════════════════════════════════

type GiftPending = {
  gift_id: string;
  rarity: "common" | "rare";
  source: "mutant" | "shop";
  mutant_level: number | null;
  mutant_tier: string | null;
  title: string;
  created_at: string;
  expires_at: string;
  drop_item_id: string | null;
  drop_item_qty: number;
  drop_key_points: number;
  drop_crystal_points: number;
  drop_item_name: string | null;
  drop_item_emoji: string | null;
  donor_name: string | null;
};
type GiftsPayload = {
  pending: GiftPending[];
  claimed_recent: Array<{ gift_id: string; title: string; rarity: string; mutant_level: number | null; claimed_at: string }>;
  segenstruhe: {
    level: number; key_points: number; crystal_points: number;
    opened_count: number; upgraded_count: number;
    open_cost: number; upgrade_cost: number;
    is_max_level: boolean;
    next_level_preview: string;
  };
  donation_limits: {
    weekly_limit: number;
    elite_used: number; elite_remaining: number;
    mega_used: number;  mega_remaining: number;
  };
};

function CrewGiftsView({ accent }: { accent: string }) {
  const [data, setData] = useState<GiftsPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [tab, setTab] = useState<"common" | "rare">("common");
  const [showDropPool, setShowDropPool] = useState(false);
  const uiIconArt = useUiIconArt();
  const inventoryArt = useInventoryItemArt();

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/crews/gifts", { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json() as GiftsPayload;
      setData(j);
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    void load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  async function claimOne(giftId: string) {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/crews/gifts/claim", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gift_id: giftId }),
      });
      if (r.ok) {
        const j = await r.json() as { item_qty?: number; key_points?: number; crystal_points?: number; auto_upgrades?: number };
        setToast(`+${j.key_points ?? 0} 🔓 · +${j.crystal_points ?? 0} 💠`
          + (j.item_qty ? ` · +${j.item_qty} Item` : "")
          + (j.auto_upgrades && j.auto_upgrades > 0 ? ` · 🆙 ${j.auto_upgrades} Stufe(n)` : ""));
        void load();
      }
    } finally { setBusy(false); }
  }
  async function claimAll() {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/crews/gifts/claim", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      if (r.ok) {
        const j = await r.json() as { items?: number; key_points?: number; crystal_points?: number; auto_upgrades?: number };
        setToast(`Alle: +${j.key_points ?? 0} 🔓 · +${j.crystal_points ?? 0} 💠 · +${j.items ?? 0} Items`
          + (j.auto_upgrades && j.auto_upgrades > 0 ? ` · 🆙 ${j.auto_upgrades} Stufe(n)` : ""));
        void load();
      }
    } finally { setBusy(false); }
  }
  async function donate(cost: number) {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/crews/gifts/donate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cost }),
      });
      const j = await r.json() as { error?: string; gems_spent?: number; tier_remaining?: number; tier?: string };
      if (!r.ok) {
        setToast(j.error === "not_enough_gems" ? "Nicht genug Diamanten"
              : j.error === "not_in_crew" ? "Keine Crew gefunden"
              : j.error === "tier_limit_reached" ? "Limit erreicht (4×/Woche pro Paket)"
              : "Fehler: " + (j.error ?? "unbekannt"));
      } else {
        const left = j.tier_remaining ?? 0;
        const tierLabel = j.tier === "mega" ? "Mega" : "Elite";
        setToast(`${tierLabel} gespendet — −${j.gems_spent ?? cost} 💎 · noch ${left}× ${tierLabel} diese Woche`);
        void load();
      }
    } finally { setBusy(false); }
  }
  async function tresorAction(action: "open") {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/crews/gifts/segenstruhe", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const j = await r.json() as { error?: string; item_id?: string; item_qty?: number };
      if (!r.ok) {
        setToast(j.error === "not_enough_key_points" ? "Nicht genug Bypass-Codes"
              : "Fehler: " + (j.error ?? "unbekannt"));
      } else {
        setToast(`Tresor geknackt — +${j.item_qty ?? 0} ${j.item_id ?? ""}`);
      }
      void load();
    } finally { setBusy(false); }
  }

  const filteredGifts = useMemo(() => {
    if (!data) return [] as GiftPending[];
    return data.pending.filter((g) => (tab === "common" ? g.rarity === "common" : g.rarity === "rare"));
  }, [data, tab]);

  const seg = data?.segenstruhe;
  const segPct = seg ? Math.min(100, Math.round((seg.key_points / Math.max(1, seg.open_cost)) * 100)) : 0;

  const segPctUpgrade = seg ? Math.min(100, Math.round((seg.crystal_points / Math.max(1, seg.upgrade_cost)) * 100)) : 0;
  const canOpen = !!seg && seg.key_points >= seg.open_cost;

  return (
    <div
      style={{
        color: "#F0F0F0",
        display: "grid",
        gridTemplateColumns: "340px 1fr",
        gap: 12,
        // Volle Höhe; nur die RECHTE Spalte hat overflow für Scroll.
        // Outer NICHT overflow-hidden, sonst clippt der Tresor-Inhalt.
        height: "100%",
        minHeight: 0,
      }}
    >
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/*  LINKE SPALTE — Crew-Tresor sitzt oben, Chat liegt fixed darunter.  */}
      {/*  KEIN overflow-clip hier (sonst wird Tresor abgeschnitten). Die      */}
      {/*  Spalte ist nicht-scrollend; die Card hat ihre eigene natürliche    */}
      {/*  Höhe. Chat-Widget überlagert die unteren ~320 px der Spalte.       */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col min-w-0">
        {seg && (
          <div
            className="rounded-2xl p-2 relative overflow-hidden"
            style={{
              background: `
                radial-gradient(ellipse at 50% 30%, rgba(255,215,0,0.16) 0%, transparent 55%),
                linear-gradient(180deg, rgba(15,17,21,0.92) 0%, rgba(10,12,16,0.95) 100%)
              `,
              border: `1px solid ${accent}55`,
              boxShadow: `0 6px 24px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)`,
            }}
          >
            {/* Header: Tresor-Label + Info-Button + Stufe-Pill */}
            <div className="relative flex items-center justify-between mb-1 gap-1">
              <div
                className="text-[9px] font-black uppercase"
                style={{ color: "#FFD700", letterSpacing: 2 }}
              >Crew-Tresor</div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowDropPool(true)}
                  className="text-[10px] font-black px-1.5 py-0.5 rounded transition"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    color: "#FFD700",
                    border: "1px solid rgba(255,215,0,0.4)",
                    cursor: "pointer",
                    lineHeight: 1,
                  }}
                  title="Drop-Pool anzeigen"
                >ℹ️ Drops</button>
                <div className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded"
                  style={{ background: `${accent}33`, color: "#FFF", letterSpacing: 1 }}>
                  Stufe {seg.level}{seg.is_max_level ? " · MAX" : ""}
                </div>
              </div>
            </div>

            {/* Kompakter Layout: Ring links + Werte rechts, statt vertikal stacked.
                Spart ~80 px Höhe und macht den Tresor garantiert kleiner als 220 px. */}
            <div className="relative flex items-center gap-2 my-1">
              {/* Ring + Icon — 76 px */}
              <div className="relative shrink-0" style={{ width: 76, height: 76 }}>
                <div aria-hidden style={{
                  position: "absolute", inset: 0, borderRadius: "50%",
                  border: "3px solid rgba(255,255,255,0.08)",
                }} />
                <div aria-hidden style={{
                  position: "absolute", inset: 0, borderRadius: "50%",
                  background: `conic-gradient(#FFD700 ${segPct * 3.6}deg, transparent ${segPct * 3.6}deg 360deg)`,
                  WebkitMask: "radial-gradient(circle, transparent 34px, #000 36px, #000 38px, transparent 40px)",
                  mask: "radial-gradient(circle, transparent 34px, #000 36px, #000 38px, transparent 40px)",
                  filter: "drop-shadow(0 0 6px rgba(255,215,0,0.4))",
                }} />
                <div className="absolute inset-0 flex items-center justify-center" style={{ filter: "drop-shadow(0 2px 6px rgba(255,215,0,0.3))" }}>
                  <UiIcon slot="crew_tresor" fallback="🗄" art={uiIconArt} size={44} />
                </div>
              </div>
              {/* Werte rechts vom Ring */}
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <div className="text-[10px] flex items-center justify-between">
                  <span className="font-black uppercase inline-flex items-center gap-1" style={{ color: "#FFD700", letterSpacing: 1 }}>
                    <UiIcon slot="crew_bypass_code" fallback="🔓" art={uiIconArt} size={11} />
                    Bypass
                  </span>
                  <span className="tabular-nums font-black text-white text-[10px]">
                    {seg.key_points.toLocaleString("de-DE")}/{seg.open_cost.toLocaleString("de-DE")}
                  </span>
                </div>
                <div className="text-[10px] flex items-center justify-between">
                  <span className="font-black uppercase inline-flex items-center gap-1" style={{ color: accent, letterSpacing: 1 }}>
                    <UiIcon slot="crew_mikrochip" fallback="💠" art={uiIconArt} size={11} />
                    Chips
                  </span>
                  <span className="tabular-nums font-black text-white text-[10px]">
                    {seg.crystal_points.toLocaleString("de-DE")}/{seg.upgrade_cost.toLocaleString("de-DE")}
                  </span>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <div style={{ width: `${segPctUpgrade}%`, height: "100%", background: `linear-gradient(90deg, ${accent}, ${accent}AA)`, transition: "width 0.3s" }} />
                </div>
              </div>
            </div>

            <button
              onClick={() => tresorAction("open")}
              disabled={busy || !canOpen}
              className="relative w-full px-2 py-1.5 rounded text-[10px] font-black uppercase tracking-wider transition mt-1"
              style={{
                background: canOpen ? "linear-gradient(135deg, #FFD700, #FFB13A)" : "rgba(255,255,255,0.06)",
                color: canOpen ? "#0F1115" : "#666",
                cursor: canOpen ? "pointer" : "not-allowed",
                border: "1px solid rgba(255,215,0,0.4)",
              }}
            >Tresor knacken</button>

            {/* Inline-Footer ein-zeilig */}
            <div className="relative mt-1 text-[8.5px] text-[#8B8FA3] flex items-center justify-between gap-2">
              <span className="whitespace-nowrap">🔨 {seg.opened_count}× · 🆙 {seg.upgraded_count}×</span>
              <span className="truncate text-right" style={{ color: "#cdd4e3" }}>
                {seg.next_level_preview}
              </span>
            </div>
          </div>
        )}
        {/* Spacer unten — Chat-Widget (fixed bottom-left) liegt hier drüber */}
        <div className="flex-1" aria-hidden />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/*  RECHTE SPALTE — Tabs Häufig/Selten + Gift-Cards                    */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col min-w-0 gap-2 overflow-hidden">
        {/* Tab-Bar Häufig / Selten */}
        <div className="flex gap-1 shrink-0">
          {(["common", "rare"] as const).map((t) => {
            const active = tab === t;
            const cnt = data ? data.pending.filter((g) => g.rarity === t).length : 0;
            const label = t === "common" ? "Häufig" : "Selten";
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 px-3 py-2 rounded text-[12px] font-black uppercase tracking-wider transition"
                style={{
                  background: active ? `${accent}33` : "rgba(255,255,255,0.05)",
                  color: active ? "#FFF" : "rgba(205,212,227,0.7)",
                  border: `1px solid ${active ? accent : "rgba(255,255,255,0.1)"}`,
                }}
              >
                {label} {cnt > 0 && <span style={{ color: "#FF2D78" }}>({cnt})</span>}
              </button>
            );
          })}
        </div>

        {/* SPENDE-SEKTION (Selten): Text spannt sich ÜBER alle drei Bereiche.
            Darunter: Elite-Pill + Mega-Pill + Alle-einsammeln nebeneinander. */}
        {tab === "rare" && (
          <div
            className="shrink-0 rounded-lg p-2 flex flex-col gap-1.5"
            style={{
              background: "linear-gradient(135deg, rgba(255,45,120,0.06) 0%, rgba(255,215,0,0.06) 100%)",
              border: "1px solid rgba(255,255,255,0.10)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            {/* Motivations-Text — über volle Breite, 2-zeilig */}
            <div className="text-[10px] font-bold leading-snug" style={{ lineHeight: 1.35 }}>
              <span className="inline-flex items-center align-middle gap-1" style={{ color: "#FFD700" }}>
                <UiIcon slot="crew_donate_diamond" fallback="💎" art={uiIconArt} size={12} />
                Spende für deine Crew
              </span>
              <span className="text-white"> — jede Einzahlung versorgt </span><b className="text-white">ALLE Mitglieder</b>
              <span className="text-white"> mit Premium-Speedups, Tresor-Bypässen und einem Auto-Upgrade-Schub für die ganze Crew.</span>
            </div>
            {/* Drei Spalten: Elite · Mega · Alle einsammeln nebeneinander */}
            <div className="flex items-stretch gap-2">
              <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                <DonatePill
                  label="Elite"
                  cost={500}
                  description="1× 12h zufällig"
                  description2="500🔓 · 250💠"
                  bgStart="#FF2D78"
                  bgEnd="#FF6B9D"
                  textColor="#FFF"
                  starSlot="crew_donate_star_elite"
                  onClick={() => donate(500)}
                  disabled={busy || (data?.donation_limits.elite_remaining ?? 4) <= 0}
                />
                <TierCounterBadge
                  remaining={data?.donation_limits.elite_remaining ?? 4}
                  limit={data?.donation_limits.weekly_limit ?? 4}
                  activeColor="#FF6B9D"
                />
              </div>
              <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                <DonatePill
                  label="Mega"
                  cost={1000}
                  description="1× 24h zufällig"
                  description2="1.500🔓 · 750💠"
                  bgStart="#FFD700"
                  bgEnd="#FFB13A"
                  textColor="#0F1115"
                  starSlot="crew_donate_star_mega"
                  onClick={() => donate(1000)}
                  disabled={busy || (data?.donation_limits.mega_remaining ?? 4) <= 0}
                />
                <TierCounterBadge
                  remaining={data?.donation_limits.mega_remaining ?? 4}
                  limit={data?.donation_limits.weekly_limit ?? 4}
                  activeColor="#FFD700"
                />
              </div>
              {filteredGifts.length > 0 && (
                <button
                  onClick={claimAll}
                  disabled={busy}
                  className="shrink-0 px-3 rounded text-[10px] font-black uppercase tracking-wider transition"
                  style={{
                    background: `linear-gradient(135deg, ${accent}, ${accent}AA)`,
                    color: "#0F1115",
                    border: `1px solid ${accent}`,
                    cursor: "pointer",
                    width: 84, lineHeight: 1.15,
                    // KEIN alignSelf — Button stretcht auf gleiche Höhe wie Pill+Counter daneben
                  }}
                >Alle ein­sammeln</button>
              )}
            </div>
          </div>
        )}

        {/* Im Häufig-Tab steht "Alle einsammeln" außerhalb der Spende-Sektion (rechts) */}
        {tab === "common" && filteredGifts.length > 0 && (
          <div className="shrink-0 flex justify-end">
            <button
              onClick={claimAll}
              disabled={busy}
              className="px-3 py-2 rounded text-[10px] font-black uppercase tracking-wider transition"
              style={{
                background: `linear-gradient(135deg, ${accent}, ${accent}AA)`,
                color: "#0F1115",
                border: `1px solid ${accent}`,
                cursor: "pointer",
                width: 88, lineHeight: 1.15,
              }}
            >Alle ein­sammeln</button>
          </div>
        )}

        {/* Gift-Liste — scrollbar */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {filteredGifts.length === 0 ? (
            <div className="text-center py-10 text-[12px] text-[#8B8FA3] leading-snug px-4">
              {tab === "common"
                ? "Aktuell keine offene Crew-Beute. Besiegt zusammen Mutanten, um Beute zu sichern."
                : "Noch keine Elite-Drops aktiv — spende oben 💎 und versorge die ganze Crew mit Premium-Speedups."}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredGifts.map((g) => (
                <GiftCard key={g.gift_id} gift={g} accent={accent} onClaim={() => claimOne(g.gift_id)} disabled={busy} inventoryArt={inventoryArt} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Toast — oberhalb des Chat-Widgets, rechts angedockt */}
      {toast && (
        <div
          className="fixed px-4 py-2 rounded text-[12px] font-bold z-[9200]"
          style={{
            bottom: 80, right: 24,
            background: "rgba(15,17,21,0.95)",
            color: accent,
            border: `1px solid ${accent}AA`,
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          }}
        >{toast}</div>
      )}

      {/* Drop-Pool-Preview Modal */}
      {showDropPool && seg && (
        <TresorDropPoolModal
          level={seg.level}
          accent={accent}
          inventoryArt={inventoryArt}
          onClose={() => setShowDropPool(false)}
        />
      )}
    </div>
  );
}

function GiftCard({ gift, accent, onClaim, disabled, inventoryArt }: {
  gift: GiftPending; accent: string; onClaim: () => void; disabled: boolean;
  inventoryArt: Record<string, { image_url?: string | null; video_url?: string | null } | undefined>;
}) {
  const expiresIn = Math.max(0, Math.floor((new Date(gift.expires_at).getTime() - Date.now()) / 60000));
  const isRare = gift.rarity === "rare";
  const isMega = isRare && gift.title.includes("MEGA");
  const art = gift.drop_item_id ? inventoryArt[gift.drop_item_id] : undefined;
  const artUrl = art?.image_url ?? art?.video_url ?? null;

  // Tier-spezifische Farbschemata — Mega (gold) markanter als Elite (pink),
  // beide deutlich markanter als Common-Drops (schlicht dark).
  const palette = isMega ? {
    bg: "linear-gradient(135deg, rgba(255,215,0,0.18) 0%, rgba(75,55,10,0.92) 100%)",
    border: "rgba(255,215,0,0.65)",
    glow: "0 0 16px rgba(255,215,0,0.30), inset 0 1px 0 rgba(255,255,255,0.10)",
    frameBg: "rgba(255,215,0,0.10)",
    frameBorder: "rgba(255,215,0,0.45)",
    btnBg: "linear-gradient(135deg, #FFD700, #FFB13A)",
    btnColor: "#0F1115",
    btnBorder: "rgba(255,215,0,0.7)",
    qtyBg: "rgba(255,215,0,0.90)",
    qtyColor: "#0F1115",
    donorColor: "#FFE9A8",
  } : isRare ? {
    bg: "linear-gradient(135deg, rgba(255,45,120,0.16) 0%, rgba(70,15,40,0.92) 100%)",
    border: "rgba(255,45,120,0.6)",
    glow: "0 0 14px rgba(255,45,120,0.28), inset 0 1px 0 rgba(255,255,255,0.08)",
    frameBg: "rgba(255,45,120,0.10)",
    frameBorder: "rgba(255,45,120,0.40)",
    btnBg: "linear-gradient(135deg, #FF2D78, #FF6B9D)",
    btnColor: "#FFF",
    btnBorder: "rgba(255,45,120,0.7)",
    qtyBg: "rgba(255,45,120,0.90)",
    qtyColor: "#FFF",
    donorColor: "#FFB3D9",
  } : {
    bg: "rgba(15,17,21,0.7)",
    border: "rgba(255,255,255,0.1)",
    glow: undefined,
    frameBg: "rgba(255,255,255,0.04)",
    frameBorder: "rgba(255,255,255,0.1)",
    btnBg: accent,
    btnColor: "#0F1115",
    btnBorder: accent,
    qtyBg: "rgba(15,17,21,0.85)",
    qtyColor: "#FFF",
    donorColor: "#cdd4e3",
  };

  // Donor-Name aus title parsen wenn vorhanden (Fallback) — vorzugsweise donor_name aus DB
  const donorName = gift.donor_name ?? (() => {
    const m = gift.title.match(/von (.+)$/);
    return m ? m[1] : null;
  })();
  const tierLabel = isMega ? "MEGA-DROP" : isRare ? "ELITE-DROP" : null;

  return (
    <div
      className="rounded-lg p-2 flex items-center gap-3 relative"
      style={{
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        boxShadow: palette.glow,
      }}
    >
      {/* Item-Artwork — quadratischer Frame, qty als schlanke Zahl rechts unten */}
      <div
        className="shrink-0 relative flex items-center justify-center overflow-hidden"
        style={{
          width: 48, height: 48, borderRadius: 8,
          background: palette.frameBg,
          border: `1px solid ${palette.frameBorder}`,
        }}
      >
        {artUrl ? (
          art?.video_url ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={artUrl} autoPlay loop muted playsInline style={{ width: "100%", height: "100%", objectFit: "contain", filter: "url(#ma365-chroma-soft)" }} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={artUrl} alt={gift.drop_item_name ?? ""} style={{ width: "100%", height: "100%", objectFit: "contain", filter: "url(#ma365-chroma-soft)" }} />
          )
        ) : (
          <span style={{ fontSize: 28, lineHeight: 1 }}>{gift.drop_item_emoji ?? (isRare ? "💎" : "🎁")}</span>
        )}
        {/* Qty-Zahl: minimal, kein ×, kleine fette Zahl rechts unten */}
        {gift.drop_item_qty > 1 && (
          <span
            style={{
              position: "absolute", bottom: 1, right: 3,
              fontSize: 11, fontWeight: 900,
              color: "#FFF",
              textShadow: "0 1px 2px rgba(0,0,0,0.95), 0 0 4px rgba(0,0,0,0.85)",
              lineHeight: 1,
              letterSpacing: -0.3,
            }}
          >{gift.drop_item_qty}</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        {/* Header-Zeile: Tier-Tag + Donor-Name prominent. Bei common: Mutant-Title */}
        {isRare ? (
          <div className="flex items-center gap-1.5 mb-0.5">
            <span
              className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded shrink-0"
              style={{
                background: "rgba(0,0,0,0.4)", color: palette.donorColor,
                letterSpacing: 1.3, border: `1px solid ${palette.border}`,
              }}
            >★ {tierLabel}</span>
            <span className="text-[11px] font-black truncate" style={{ color: "#FFF", textShadow: `0 0 8px ${palette.donorColor}33` }}>
              von <span style={{ color: palette.donorColor }}>{donorName ?? "?"}</span>
            </span>
          </div>
        ) : (
          <div className="text-[11px] font-black text-white truncate mb-0.5">{gift.title}</div>
        )}
        {/* Item + Punkte */}
        <div className="text-[10px] text-[#cdd4e3] truncate">
          {gift.drop_item_name && <><b className="text-white">{gift.drop_item_qty}× {gift.drop_item_name}</b> · </>}
          <span style={{ color: "#FFD700" }}>🔓 {gift.drop_key_points}</span> · <span style={{ color: "#22D1C3" }}>💠 {gift.drop_crystal_points}</span>
        </div>
        <div className="text-[9px] text-[#8B8FA3]">Läuft in {expiresIn < 60 ? `${expiresIn}m` : `${Math.floor(expiresIn / 60)}h ${expiresIn % 60}m`} ab</div>
      </div>
      <button
        onClick={onClaim}
        disabled={disabled}
        className="shrink-0 px-3 py-1.5 rounded text-[10px] font-black uppercase tracking-wider"
        style={{
          background: palette.btnBg,
          color: palette.btnColor,
          border: `1px solid ${palette.btnBorder}`,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
        }}
      >Sammeln</button>
    </div>
  );
}

/** Tresor-Drop-Pool-Preview — zeigt alle möglichen Drops einer Stufe mit Wahrscheinlichkeit. */
type DropPoolEntry = {
  item_id: string;
  item_qty: number;
  weight: number;
  pct: number;
  item_name: string | null;
  item_emoji: string | null;
  item_rarity: string | null;
};
function TresorDropPoolModal({
  level, accent, inventoryArt, onClose,
}: {
  level: number;
  accent: string;
  inventoryArt: Record<string, { image_url?: string | null; video_url?: string | null } | undefined>;
  onClose: () => void;
}) {
  const [pool, setPool] = useState<DropPoolEntry[]>([]);
  const [previewLevel, setPreviewLevel] = useState(level);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const r = await fetch(`/api/crews/gifts/pool?level=${previewLevel}`, { cache: "no-store" });
        if (!r.ok || !alive) return;
        const j = await r.json() as { pool?: DropPoolEntry[] };
        if (alive) setPool(j.pool ?? []);
      } catch { /* noop */ }
    })();
    return () => { alive = false; };
  }, [previewLevel]);

  const rarityColor = (r: string | null) =>
    r === "legendary" ? "#FFD700" : r === "epic" ? "#A855F7" : r === "rare" ? "#22D1C3" : "#9CA3AF";

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 9300, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-2xl flex flex-col"
        style={{
          width: "min(520px, calc(100vw - 32px))",
          maxHeight: "calc(100vh - 64px)",
          background: "linear-gradient(180deg, rgba(20,22,28,0.98) 0%, rgba(10,12,16,0.98) 100%)",
          border: `1px solid ${accent}66`,
          boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b" style={{ borderColor: `${accent}33` }}>
          <div>
            <div className="text-[10px] font-black uppercase" style={{ color: "#FFD700", letterSpacing: 2 }}>
              Crew-Tresor · Drop-Pool
            </div>
            <div className="text-[14px] font-black text-white" style={{ fontFamily: "var(--font-display-stack)" }}>
              Stufe {previewLevel}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center transition text-[#F0F0F0] font-bold"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer" }}
            aria-label="Schließen"
          >✕</button>
        </div>

        {/* Stufe-Slider/Buttons */}
        <div className="flex items-center gap-1 px-3 py-2 border-b text-[9px] font-black uppercase" style={{ borderColor: "rgba(255,255,255,0.06)", letterSpacing: 1 }}>
          <span className="text-[#8B8FA3] mr-1">Stufen-Pool:</span>
          {[5, 15, 25, 35, 45].map((lv) => (
            <button
              key={lv}
              onClick={() => setPreviewLevel(lv)}
              className="px-2 py-0.5 rounded transition"
              style={{
                background: previewLevel === lv ? `${accent}33` : "rgba(255,255,255,0.05)",
                color: previewLevel === lv ? "#FFF" : "#cdd4e3",
                border: `1px solid ${previewLevel === lv ? accent : "rgba(255,255,255,0.1)"}`,
                cursor: "pointer",
              }}
            >{lv}</button>
          ))}
          <button
            onClick={() => setPreviewLevel(level)}
            className="ml-auto px-2 py-0.5 rounded text-[9px] font-bold"
            style={{ background: `${accent}55`, color: "#FFF", cursor: "pointer", border: `1px solid ${accent}` }}
          >Meine ({level})</button>
        </div>

        {/* Item-Liste */}
        <div className="flex-1 overflow-y-auto p-2">
          {pool.length === 0 ? (
            <div className="text-center py-10 text-[12px] text-[#8B8FA3]">Lade Drop-Pool…</div>
          ) : (
            <div className="flex flex-col gap-1">
              {pool.map((e) => {
                const art = inventoryArt[e.item_id];
                const artUrl = art?.image_url ?? art?.video_url ?? null;
                const rColor = rarityColor(e.item_rarity);
                return (
                  <div
                    key={e.item_id}
                    className="rounded-lg p-1.5 flex items-center gap-2"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div
                      className="shrink-0 relative flex items-center justify-center overflow-hidden"
                      style={{
                        width: 36, height: 36, borderRadius: 6,
                        background: `${rColor}11`,
                        border: `1px solid ${rColor}66`,
                      }}
                    >
                      {artUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={artUrl} alt={e.item_name ?? ""} style={{ width: "100%", height: "100%", objectFit: "contain", filter: "url(#ma365-chroma-soft)" }} />
                      ) : (
                        <span style={{ fontSize: 22 }}>{e.item_emoji ?? "📦"}</span>
                      )}
                      {e.item_qty > 1 && (
                        <span
                          style={{
                            position: "absolute", bottom: 0, right: 2,
                            fontSize: 10, fontWeight: 900, color: "#FFF",
                            textShadow: "0 1px 2px rgba(0,0,0,0.95)",
                            lineHeight: 1,
                          }}
                        >{e.item_qty}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-black truncate" style={{ color: rColor }}>
                        {e.item_name ?? e.item_id}
                      </div>
                      <div className="text-[9px] text-[#8B8FA3]">{e.item_qty}× pro Drop</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[14px] font-black tabular-nums" style={{ color: "#FFD700" }}>{e.pct.toFixed(1)}%</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="px-3 py-2 text-[9px] text-[#8B8FA3] border-t" style={{ borderColor: "rgba(255,255,255,0.06)", lineHeight: 1.35 }}>
          Pro „Tresor knacken" wird genau 1 zufälliger Drop aus diesem Pool gezogen. Mit steigender Tresor-Stufe wächst der Pool und höhere Items werden wahrscheinlicher.
        </div>
      </div>
    </div>
  );
}

/** Mini-Counter unter einer Spende-Pille: "X / 4 diese Woche". */
function TierCounterBadge({ remaining, limit, activeColor }: { remaining: number; limit: number; activeColor: string }) {
  const empty = remaining <= 0;
  return (
    <div
      className="text-[8px] font-black uppercase tracking-wider text-center"
      style={{
        color: empty ? "#FF6B6B" : activeColor,
        letterSpacing: 1,
        opacity: 0.9,
      }}
    >
      {empty ? "Limit erreicht" : `${remaining} / ${limit} diese Woche`}
    </div>
  );
}

/**
 * Kompakte Spende-Pille — Single-Row-Button mit Tier · Preis · Mini-Beschreibung.
 * Sitzt direkt in der Action-Zeile neben "Alle einsammeln".
 */
function DonatePill({
  label, cost, description, description2, bgStart, bgEnd, textColor, onClick, disabled, starSlot,
}: {
  label: string; cost: number; description: string; description2?: string;
  bgStart: string; bgEnd: string; textColor: string;
  onClick: () => void; disabled: boolean;
  /** Slot fürs Tier-Star-Icon (crew_donate_star_elite/mega). */
  starSlot?: string;
}) {
  const uiIconArt = useUiIconArt();
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex-1 rounded text-left px-2.5 py-1.5 transition relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${bgStart}, ${bgEnd})`,
        color: textColor,
        border: `1px solid ${bgStart}AA`,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        boxShadow: `0 2px 8px ${bgStart}55, inset 0 1px 0 rgba(255,255,255,0.15)`,
        minWidth: 0,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-black uppercase tracking-wider truncate inline-flex items-center gap-1" style={{ letterSpacing: 1.2 }}>
          {starSlot ? <UiIcon slot={starSlot} fallback="★" art={uiIconArt} size={12} /> : <span>★</span>}
          {label}
        </div>
        <div className="text-[12px] font-black tabular-nums whitespace-nowrap inline-flex items-center gap-0.5" style={{ textShadow: "0 1px 1px rgba(0,0,0,0.3)" }}>
          {cost.toLocaleString("de-DE")}
          <UiIcon slot="crew_donate_diamond" fallback="💎" art={uiIconArt} size={12} />
        </div>
      </div>
      <div className="text-[9px] font-bold leading-tight mt-0.5 truncate opacity-95 inline-flex items-center gap-0.5">
        <UiIcon slot="crew_speedup_build" fallback="🏗️" art={uiIconArt} size={11} />
        <UiIcon slot="crew_speedup_research" fallback="🔬" art={uiIconArt} size={11} />
        <UiIcon slot="crew_speedup_universal" fallback="⚡" art={uiIconArt} size={11} />
        <UiIcon slot="crew_speedup_march" fallback="🏃" art={uiIconArt} size={11} />
        <span className="ml-1">{description}</span>
      </div>
      {description2 && (
        <div className="text-[8.5px] font-bold leading-tight truncate opacity-80 tabular-nums">
          {description2}
        </div>
      )}
    </button>
  );
}

function PremiumDropCard({
  tier, cost, accentBg, borderColor, glowColor, labelColor, buttonBg, buttonColor,
  title, subline, items, points, onDonate, busy,
}: {
  tier: "elite" | "mega";
  cost: number;
  accentBg: string; borderColor: string; glowColor: string; labelColor: string;
  buttonBg: string; buttonColor: string;
  title: string; subline: string; items: string;
  points: { bypass: number; chip: number };
  onDonate: () => void; busy: boolean;
}) {
  return (
    <div
      className="rounded-lg p-2 flex flex-col gap-1.5 relative overflow-hidden"
      style={{
        background: accentBg,
        border: `1px solid ${borderColor}`,
        boxShadow: `0 0 14px ${glowColor}, inset 0 1px 0 rgba(255,255,255,0.08)`,
      }}
    >
      {/* Sub-Header mit Tier + Preis */}
      <div className="flex items-center justify-between">
        <div
          className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded"
          style={{ background: "rgba(0,0,0,0.4)", color: labelColor, letterSpacing: 1.5, border: `1px solid ${borderColor}` }}
        >
          {tier === "mega" ? "★ MEGA" : "★ ELITE"}
        </div>
        <div className="text-[14px] font-black text-white tabular-nums" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.7)" }}>
          {cost.toLocaleString("de-DE")}💎
        </div>
      </div>

      {/* Title */}
      <div className="text-[13px] font-black text-white leading-tight" style={{ fontFamily: "var(--font-display-stack)", letterSpacing: 0.3 }}>
        {title}
      </div>

      {/* Sub-Liste */}
      <div className="text-[9px] text-[#cdd4e3] leading-snug">{subline}</div>

      {/* Items & Punkte */}
      <div className="text-[10px] text-white flex items-center justify-between mt-0.5">
        <span><b>{items}</b></span>
      </div>
      <div className="text-[10px] flex items-center gap-3" style={{ color: "#cdd4e3" }}>
        <span><b style={{ color: "#FFD700" }}>🔓 +{points.bypass}</b></span>
        <span><b style={{ color: "#22D1C3" }}>💠 +{points.chip}</b></span>
      </div>

      {/* CTA */}
      <button
        onClick={onDonate}
        disabled={busy}
        className="mt-1 px-2 py-1.5 rounded text-[10px] font-black uppercase tracking-wider"
        style={{
          background: buttonBg, color: buttonColor,
          border: `1px solid ${borderColor}`,
          cursor: busy ? "not-allowed" : "pointer",
          opacity: busy ? 0.5 : 1,
          boxShadow: `0 2px 8px ${glowColor}`,
          letterSpacing: 0.8,
        }}
      >Jetzt spenden</button>
    </div>
  );
}

/* Crew-Hub Tile — komplett ohne Ränder/Hintergrund.
   Nur Icon + Label, schwebt direkt auf dem Artwork.
   Hover gibt einen sehr dezenten Akzent-Schimmer als Feedback. */
function TileButton({
  onClick, icon, slot, label, accent, hero = false, hint, badge,
}: {
  onClick: () => void;
  icon: string;
  /** Artwork-Slot (cosmetic_artwork kind=ui_icon). Wenn Artwork hochgeladen ist, überschreibt es den Emoji-Fallback. */
  slot?: string;
  label: string;
  accent: string;
  clip?: string;
  hero?: boolean;
  hint?: string;
  /** Roter Indikator-Count oben rechts. 0/undefined → kein Badge. */
  badge?: number;
}) {
  const [hover, setHover] = useState(false);
  const uiIconArt = useUiIconArt();
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="relative flex flex-col items-center justify-center transition active:scale-95"
      style={{
        background: hover ? `${accent}1A` : "transparent",
        borderRadius: 8,
        minWidth: 0,
        cursor: "pointer",
        padding: "2px 4px",
        gap: 0,
      }}
      title={hint ? `${label} — ${hint}` : label}
    >
      {badge !== undefined && badge > 0 && (
        <span
          aria-hidden
          style={{
            position: "absolute", top: 2, right: 4,
            minWidth: 18, height: 18, padding: "0 4px",
            borderRadius: 999,
            background: "#FF2D78",
            color: "#FFF",
            fontSize: 10, fontWeight: 900,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 6px rgba(0,0,0,0.5), 0 0 8px rgba(255,45,120,0.6)",
            border: "1px solid rgba(255,255,255,0.3)",
            lineHeight: 1,
          }}
        >{badge > 99 ? "99+" : badge}</span>
      )}
      <span style={{ fontSize: 28, lineHeight: 1, textShadow: "0 2px 4px rgba(0,0,0,0.95)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        {slot ? <UiIcon slot={slot} fallback={icon} art={uiIconArt} size={32} /> : icon}
      </span>
      <span
        className="text-[10px] font-black text-white text-center truncate w-full px-1"
        style={{
          letterSpacing: 0.3,
          textShadow: "0 1px 3px rgba(0,0,0,1), 0 0 4px rgba(0,0,0,0.85)",
          marginTop: 1,
        }}
      >
        {label}
      </span>
      {hint && (
        <span
          className="text-[8px] font-bold"
          style={{ color: "#FFF", letterSpacing: 0.3, textShadow: "0 1px 2px rgba(0,0,0,0.95)" }}
        >
          {hint}
        </span>
      )}
    </button>
  );
}

// Heimat-Stadt aus PLZ ableiten (Crews werden city-server-zugeordnet, nicht PLZ-spezifisch).
// Mapping basiert auf PLZ-Präfixen der 3 aktiven Städte (siehe cities-Tabelle).
function cityNameFromZip(zip: string | null | undefined): string {
  if (!zip) return "—";
  const z = zip.trim();
  if (!z) return "—";
  // Berlin: 10xxx–14xxx
  if (/^1[0-4]/.test(z)) return "Berlin";
  // Hamburg: 20xxx–22xxx
  if (/^2[012]/.test(z)) return "Hamburg";
  // München: 80xxx–85xxx (vor allem 80/81)
  if (/^8[0-5]/.test(z)) return "München";
  // Fallback: PLZ behalten, aber als Hinweis dass die Stadt nicht erkannt wurde
  return `PLZ ${z}`;
}

function compactCrewNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString("de-DE");
}

/* Widget zeigt wo die eigene Crew steht — weltweit, Kontinent, Land, Stadt */
function LeagueStandingsWidget({ crew }: { crew: Crew }) {
  const myKm = DEMO_CREW_STATS.weekly_km;
  const myTier = leagueTierFor(myKm);

  // Realistische Rang-Simulation: Ränge sind relativ zur Tier-Verteilung.
  // Bronze-Crew landet im unteren Mittelfeld, Legende vorne.
  // tierPosition: 0.0 (Bronze-Unterseite) bis 1.0 (Legende-Spitze)
  const tierIdx = LEAGUE_TIERS.findIndex((t) => t.id === myTier.id);
  const tierFraction = tierIdx / Math.max(1, LEAGUE_TIERS.length - 1); // 0..1
  // Wie weit innerhalb der Tier? (km relativ zur Tier-Range)
  const nextTier = LEAGUE_TIERS[tierIdx + 1];
  const intraTier = nextTier
    ? (myKm - myTier.minWeeklyKm) / (nextTier.minWeeklyKm - myTier.minWeeklyKm)
    : 1;
  // Kombiniert: 0.0 = letzter Platz, 1.0 = erster Platz
  const perfScore = Math.min(1, (tierFraction * 0.85) + (intraTier * 0.15));
  // Rang = (1 - perfScore) × total
  const rankOf = (total: number) => Math.max(1, Math.round((1 - perfScore) * total * 0.95) + Math.floor(total * 0.02));

  const totalGlobal = 12450;
  const totalEurope = 4820;
  const totalCountry = 1890;
  const totalCity = 182;

  const scopes = [
    { label: "Weltweit",    icon: "🌐", rank: rankOf(totalGlobal),  total: totalGlobal  },
    { label: "Europa",      icon: "🌍", rank: rankOf(totalEurope),  total: totalEurope  },
    { label: "Deutschland", icon: "🇩🇪", rank: rankOf(totalCountry), total: totalCountry },
    { label: `${crew.zip.slice(0, 2) === "10" || crew.zip.slice(0, 2) === "13" ? "Berlin" : "Stadt"}`, icon: "🏙️", rank: rankOf(totalCity), total: totalCity },
  ];

  return (
    <div style={{
      background: "rgba(70, 82, 122, 0.45)", borderRadius: 16, padding: 14,
      border: `1px solid ${myTier.color}55`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 18 }}>{myTier.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#FFF", fontSize: 13, fontWeight: 900 }}>
            Liga-Standings · {currentSeason().label}
          </div>
          <div style={{ color: MUTED, fontSize: 11 }}>
            Euer aktueller Rang in der <b style={{ color: myTier.color }}>{myTier.name}-Liga</b>
          </div>
        </div>
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
        gap: 8,
      }}>
        {scopes.map((s) => {
          const pct = Math.min(100, ((s.total - s.rank) / s.total) * 100);
          const top10 = s.rank / s.total < 0.1;
          return (
            <div key={s.label} style={{
              background: "rgba(0,0,0,0.25)", borderRadius: 12,
              padding: "10px 12px", border: `1px solid ${BORDER}`,
            }}>
              <div style={{ color: MUTED, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                <span>{s.icon}</span>
                <span>{s.label}</span>
              </div>
              <div style={{
                color: top10 ? "#FFD700" : "#FFF", fontSize: 18, fontWeight: 900, marginTop: 3,
                textShadow: top10 ? "0 0 10px #FFD70066" : "none",
              }}>
                #{s.rank}
                {top10 && <span style={{ fontSize: 11, marginLeft: 4 }}>🔥</span>}
              </div>
              <div style={{ color: MUTED, fontSize: 10, marginTop: 2 }}>
                von {s.total.toLocaleString("de-DE")}
              </div>
              <div style={{ marginTop: 6, height: 4, background: "rgba(0,0,0,0.5)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${pct}%`,
                  background: myTier.color, boxShadow: `0 0 6px ${myTier.color}88`,
                }} />
              </div>
              <div style={{ color: MUTED, fontSize: 9, marginTop: 2, textAlign: "right", fontWeight: 700 }}>
                {(() => {
                  const pctRaw = (s.rank / s.total) * 100;
                  if (pctRaw < 1) return "Top <1%";
                  if (pctRaw < 5) return `Top ${pctRaw.toFixed(1)}%`;
                  return `Top ${Math.round(pctRaw)}%`;
                })()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CrewStat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div
      style={{
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        borderRadius: 12,
        padding: "10px 8px",
        textAlign: "center",
        border: `1px solid ${accent}55`,
        boxShadow: `0 0 14px ${accent}22, inset 0 1px 0 rgba(255,255,255,0.05)`,
      }}
    >
      <div
        style={{
          color: accent,
          fontSize: 20,
          fontWeight: 900,
          fontFamily: "var(--font-display-stack)",
          letterSpacing: 0.4,
          textShadow: `0 0 12px ${accent}88, 0 2px 4px rgba(0,0,0,0.5)`,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div style={{ color: "#cdd4e3", fontSize: 9, fontWeight: 800, marginTop: 4, letterSpacing: 0.6 }}>
        {label.toUpperCase()}
      </div>
    </div>
  );
}

/* ═══ Overview ═══ */
function CrewOverview({ crew, isAdmin, onLeave }: { crew: Crew; isAdmin: boolean; onLeave: () => void }) {
  const tCrew = useTranslations("Crew");
  const locale = useLocale();
  const [potionsOpen, setPotionsOpen] = useState(false);
  const topChallenge = DEMO_CREW_CHALLENGES[0];
  const topEvent = DEMO_CREW_EVENTS[0];
  const pct = Math.min(100, (topChallenge.current / topChallenge.target) * 100);

  // Rivalen-Duell
  const rival = DEMO_RIVAL_DUEL;
  const rivalTotal = rival.our_weekly_km + rival.rival_weekly_km || 1;
  const ourPct = (rival.our_weekly_km / rivalTotal) * 100;

  // Aktivitäts-Rate (Onboarding-Bar)
  const activeMembers = DEMO_CREW_MEMBERS.filter((m) => m.weekly_km > 0).length;
  const activePct = Math.round((activeMembers / DEMO_CREW_MEMBERS.length) * 100);

  // Mein Waechter laden (Runner-Level)
  const sb = useMemo(() => createClient(), []);
  const [guardian, setGuardian] = useState<GuardianWithArchetype | null>(null);
  const [trophies, setTrophies] = useState<Array<{ id: string; archetype_id: string; captured_level: number }>>([]);
  const [crewTitles, setCrewTitles] = useState<Array<{ id: string; rank: number; title: string; arena_sessions: { name: string } }>>([]);
  useEffect(() => {
    (async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      const { data: g } = await sb.from("user_guardians")
        .select("id, user_id, crew_id, archetype_id, custom_name, level, xp, wins, losses, current_hp_pct, wounded_until, is_active, acquired_at, source, kind, season_id")
        .eq("user_id", user.id).eq("is_active", true).maybeSingle();
      if (!g) return;
      const { data: arch } = await sb.from("guardian_archetypes").select("*").eq("id", g.archetype_id).single();
      if (arch) setGuardian({ ...(g as Omit<GuardianWithArchetype, "archetype">), archetype: arch });
      const { data: t } = await sb.from("guardian_trophies").select("id, archetype_id, captured_level").eq("user_id", user.id);
      if (t) setTrophies(t);
    })();
  }, [sb]);
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/arena/session?for_crew_id=${crew.id}`);
        if (r.ok) {
          const j = await r.json() as { titles?: Array<{ id: string; rank: number; title: string; arena_sessions: { name: string } }> };
          setCrewTitles(j.titles ?? []);
        }
      } catch { /* stumm */ }
    })();
  }, [crew.id]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ═══ Arena-Titel der Crew ═══ */}
      {crewTitles.length > 0 && (
        <div style={{
          padding: 12, borderRadius: 14,
          background: "linear-gradient(135deg, rgba(255,107,74,0.14), rgba(255,215,0,0.10))",
          border: "1px solid rgba(255,107,74,0.4)",
        }}>
          <div style={{ color: "#FF6B4A", fontSize: 10, fontWeight: 900, letterSpacing: 1.2, marginBottom: 8 }}>
            {tCrew("ovArenaTitles")}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {crewTitles.map((t) => {
              const color = t.rank === 1 ? "#FFD700" : t.rank === 2 ? "#e8e8e8" : "#cd7f32";
              return (
                <div key={t.id} style={{
                  padding: "5px 10px", borderRadius: 999,
                  background: `${color}22`, border: `1px solid ${color}`,
                  color, fontSize: 10, fontWeight: 800,
                }}>
                  {t.title} · <span style={{ color: MUTED, fontWeight: 600 }}>{t.arena_sessions.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ Aktiver Waechter (kompakt) ═══ */}
      {guardian && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 8 }}>
            <div style={{ color: MUTED, fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>{tCrew("ovGuardianHeader")}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {trophies.length > 0 && (
                <span style={{ color: "#FFD700", fontSize: 10, fontWeight: 900 }}>🏆 {trophies.length}</span>
              )}
              <button
                onClick={() => setPotionsOpen(true)}
                title={tCrew("ovPotionsTitle")}
                style={{
                  padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(168,85,247,0.4)",
                  background: "rgba(168,85,247,0.12)", color: "#a855f7",
                  fontSize: 11, fontWeight: 800, cursor: "pointer",
                }}
              >
                {tCrew("ovPotionsButton")}
              </button>
              <GuardianHelpButton />
            </div>
          </div>
          <GuardianCard guardian={guardian} compact />
        </div>
      )}

      {potionsOpen && <PotionInventoryModal onClose={() => setPotionsOpen(false)} />}


      {/* Rivalen-Duell */}
      <div style={{
        background: "rgba(70, 82, 122, 0.45)", borderRadius: 16, padding: 14,
        border: `1px solid ${BORDER}`, position: "relative",
      }}>
        <div style={{ position: "absolute", top: 10, right: 10 }}>
          <DemoBadge hint={tCrew("ovDuelDemoHint")} />
        </div>
        <div style={{ color: MUTED, fontSize: 11, fontWeight: 800, marginBottom: 10, letterSpacing: 0.5 }}>
          {tCrew("ovDuelHeader")}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
          <div>
            <div style={{ color: crew.color, fontWeight: 900 }}>{crew.name}</div>
            <div style={{ color: MUTED, fontSize: 11 }}>{tCrew("ovKm", { km: rival.our_weekly_km })}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: rival.rival_color, fontWeight: 900 }}>{rival.rival_name}</div>
            <div style={{ color: MUTED, fontSize: 11 }}>{tCrew("ovKm", { km: rival.rival_weekly_km })}</div>
          </div>
        </div>
        <div style={{ height: 10, background: "rgba(0,0,0,0.35)", borderRadius: 5, overflow: "hidden", display: "flex" }}>
          <div style={{ width: `${ourPct}%`, background: crew.color, boxShadow: `0 0 8px ${crew.color}88`, transition: "width 1s" }} />
          <div style={{ width: `${100 - ourPct}%`, background: rival.rival_color, boxShadow: `0 0 8px ${rival.rival_color}88`, transition: "width 1s" }} />
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: MUTED, display: "flex", justifyContent: "space-between" }}>
          <span>{tCrew.rich("ovDuelPrize", { prize: rival.prize, b: (chunks) => <b style={{ color: "#FFD700" }}>{chunks}</b> })}</span>
          <span>{daysUntil(rival.ends_at, tCrew)}</span>
        </div>
      </div>

      {/* Liga-Standings: wo steht meine Crew */}
      <LeagueStandingsWidget crew={crew} />

      {/* Aktivitäts-Onboarding-Bar */}
      <div style={{
        background: "rgba(70, 82, 122, 0.45)", borderRadius: 14, padding: 12,
        border: `1px solid ${BORDER}`,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
          <span style={{ color: "#FFF" }}>{tCrew("ovActivityWeek")}</span>
          <span style={{ color: activePct >= 75 ? "#4ade80" : activePct >= 50 ? "#FFD700" : ACCENT }}>
            {tCrew("ovActivityActive", { active: activeMembers, total: DEMO_CREW_MEMBERS.length, pct: activePct })}
          </span>
        </div>
        <div style={{ height: 6, background: "rgba(0,0,0,0.35)", borderRadius: 3, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${activePct}%`,
            background: activePct >= 75 ? "#4ade80" : activePct >= 50 ? "#FFD700" : ACCENT,
            transition: "width 0.8s",
          }} />
        </div>
        {activePct < 100 && (
          <div style={{ color: MUTED, fontSize: 11, marginTop: 6 }}>
            {tCrew(
              (DEMO_CREW_MEMBERS.length - activeMembers) === 1 ? "ovActivityHintOne" : "ovActivityHintMany",
              { count: DEMO_CREW_MEMBERS.length - activeMembers },
            )}
          </div>
        )}
      </div>

      {/* Invite Card */}
      <div style={{
        background: "rgba(70, 82, 122, 0.45)", borderRadius: 16, padding: 14,
        border: `1px solid ${BORDER}`,
      }}>
        <div style={{ color: MUTED, fontSize: 11, fontWeight: 700, marginBottom: 6 }}>{tCrew("ovInviteHeader")}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            flex: 1, fontFamily: "monospace", fontSize: 18, fontWeight: 900,
            color: "#FFF", letterSpacing: 2,
          }}>
            {crew.invite_code}
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(crew.invite_code);
              appAlert(tCrew("ovInviteCopiedAlert"));
            }}
            style={{
              padding: "8px 14px", borderRadius: 10,
              background: crew.color, color: BG_DEEP,
              fontSize: 12, fontWeight: 900, cursor: "pointer", border: "none",
            }}
          >
            {tCrew("ovInviteCopy")}
          </button>
        </div>
      </div>

      {/* Aktive Challenge Highlight */}
      <div>
        <div style={{ color: MUTED, fontSize: 11, fontWeight: 800, marginBottom: 8, letterSpacing: 0.5 }}>
          {tCrew("ovActiveChallenge")}
        </div>
        <div style={{
          background: "rgba(70, 82, 122, 0.45)", borderRadius: 16, padding: 14,
          border: `1px solid ${crew.color}55`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ fontSize: 24 }}>{topChallenge.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#FFF", fontSize: 14, fontWeight: 900 }}>{topChallenge.title}</div>
              <div style={{ color: MUTED, fontSize: 11 }}>{tCrew("ovChallengeReward", { xp: topChallenge.reward_xp })}</div>
            </div>
          </div>
          <div style={{ height: 8, background: "rgba(0,0,0,0.35)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${pct}%`, background: crew.color,
              boxShadow: `0 0 10px ${crew.color}88`,
            }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11 }}>
            <span style={{ color: "#FFF", fontWeight: 900 }}>{topChallenge.current} / {topChallenge.target} {topChallenge.unit}</span>
            <span style={{ color: MUTED }}>{daysUntil(topChallenge.ends_at, tCrew)}</span>
          </div>
        </div>
      </div>

      {/* Nächstes Event */}
      <div>
        <div style={{ color: MUTED, fontSize: 11, fontWeight: 800, marginBottom: 8, letterSpacing: 0.5 }}>
          {tCrew("ovNextEvent")}
        </div>
        <div style={{
          background: "rgba(70, 82, 122, 0.45)", borderRadius: 16, padding: 14,
          border: `1px solid ${BORDER}`,
        }}>
          <div style={{ color: "#FFF", fontSize: 14, fontWeight: 900 }}>{topEvent.title}</div>
          <div style={{ color: MUTED, fontSize: 12, marginTop: 4 }}>
            {fmtEventTime(topEvent.when_iso, tCrew, locale)} · 📍 {topEvent.meeting_point}
          </div>
          <div style={{ color: TEXT_SOFT, fontSize: 12, marginTop: 8, display: "flex", gap: 12 }}>
            <span>🏃 {topEvent.distance_km} km</span>
            <span>⏱️ {topEvent.pace}</span>
            <span>👥 {topEvent.attendees}</span>
          </div>
        </div>
      </div>

      {/* Aktionen */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
        <button
          onClick={() => navigator.share?.({ title: crew.name, text: tCrew("ovShareText", { code: crew.invite_code }) })
            .catch(() => navigator.clipboard.writeText(crew.invite_code))}
          style={primaryBtnStyle(crew.color)}
        >
          {tCrew("ovShareInvite")}
        </button>
        {isAdmin && (
          <button
            onClick={() => appAlert(tCrew("ovManageSoonAlert"))}
            style={outlineBtnStyle()}
          >
            {tCrew("ovManageCrew")}
          </button>
        )}
        <button onClick={onLeave} style={{
          ...outlineBtnStyle(),
          color: ACCENT, border: `1px solid ${ACCENT}44`,
        }}>
          {isAdmin ? tCrew("ovDisband") : tCrew("ovLeave")}
        </button>
      </div>
    </div>
  );
}

/* ═══ Members ═══ */
function CrewGuardians({ crewId, crewColor }: { crewId: string; crewColor: string }) {
  const tCrew = useTranslations("Crew");
  const sb = useMemo(() => createClient(), []);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [myGuardian, setMyGuardian] = useState<GuardianWithArchetype | null>(null);
  const [memberGuardians, setMemberGuardians] = useState<Array<GuardianWithArchetype & { user_display: string }>>([]);
  const [trophies, setTrophies] = useState<Array<{ id: string; archetype_id: string; captured_level: number; captured_at: string; archetype?: { name: string; emoji: string; rarity: string } }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (user) setMyUserId(user.id);

      // Alle Crew-Mitglieder
      const { data: members } = await sb.from("users").select("id, display_name, username").eq("current_crew_id", crewId);
      const memberIds = (members ?? []).map((m: { id: string }) => m.id);
      const memberMap = new Map((members ?? []).map((m: { id: string; display_name: string | null; username: string | null }) => [m.id, m.display_name ?? m.username ?? "Runner"]));

      // Crew-vs-Shop arena_battles archived (pivot 2026-05-05) — Battle-History entfernt.
      const [guardsRes, trophiesRes] = await Promise.all([
        memberIds.length > 0
          ? sb.from("user_guardians")
              .select("id, user_id, crew_id, archetype_id, custom_name, level, xp, wins, losses, current_hp_pct, wounded_until, is_active, acquired_at, source, kind, season_id")
              .in("user_id", memberIds).eq("is_active", true)
          : Promise.resolve({ data: [] }),
        memberIds.length > 0
          ? sb.from("guardian_trophies").select("id, archetype_id, captured_level, captured_at").in("user_id", memberIds).order("captured_at", { ascending: false })
          : Promise.resolve({ data: [] }),
      ]);
      if (cancelled) return;

      const archIds = Array.from(new Set([
        ...(guardsRes.data ?? []).map((g: { archetype_id: string }) => g.archetype_id),
        ...(trophiesRes.data ?? []).map((t: { archetype_id: string }) => t.archetype_id),
      ]));
      const { data: archs } = archIds.length > 0
        ? await sb.from("guardian_archetypes").select("*").in("id", archIds)
        : { data: [] };
      const archMap = new Map((archs ?? []).map((a: { id: string }) => [a.id, a]));

      const guards: Array<GuardianWithArchetype & { user_display: string }> = (guardsRes.data ?? [])
        .map((g) => {
          const arch = archMap.get((g as { archetype_id: string }).archetype_id);
          if (!arch) return null;
          return {
            ...(g as Omit<GuardianWithArchetype, "archetype">),
            archetype: arch as GuardianWithArchetype["archetype"],
            user_display: memberMap.get((g as { user_id: string }).user_id) ?? "Runner",
          };
        })
        .filter((g): g is GuardianWithArchetype & { user_display: string } => g !== null);

      if (user) setMyGuardian(guards.find((g) => g.user_id === user.id) ?? null);
      setMemberGuardians(guards);

      setTrophies((trophiesRes.data ?? []).map((t) => ({ ...(t as { id: string; archetype_id: string; captured_level: number; captured_at: string }), archetype: archMap.get((t as { archetype_id: string }).archetype_id) as { name: string; emoji: string; rarity: string } | undefined })));

      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [sb, crewId]);

  if (loading) return <div style={{ padding: 30, textAlign: "center", color: MUTED }}>{tCrew("gdLoading")}</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Mein Waechter — groß */}
      {myGuardian && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ color: MUTED, fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>{tCrew("gdMyHeader")}</div>
            <GuardianHelpButton />
          </div>
          <GuardianCard guardian={myGuardian} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 10 }}>
            <MiniKpi label={tCrew("gdMiniWins")} value={`${myGuardian.wins}`} color="#4ade80" />
            <MiniKpi label={tCrew("gdMiniLosses")} value={`${myGuardian.losses}`} color="#FF2D78" />
            <MiniKpi label={tCrew("gdMiniSource")} value={tCrew(
              myGuardian.source === "initial" ? "gdSourceInitial"
              : myGuardian.source === "fused" ? "gdSourceFused"
              : myGuardian.source === "captured" ? "gdSourceCaptured"
              : "gdSourceBought",
            )} color={crewColor} />
          </div>
        </div>
      )}

      {/* Waechter der anderen Crew-Mitglieder */}
      {memberGuardians.filter((g) => g.user_id !== myUserId).length > 0 && (
        <div>
          <div style={{ color: MUTED, fontSize: 11, fontWeight: 800, letterSpacing: 1, marginBottom: 8 }}>
            {tCrew("gdMembersHeader", { count: memberGuardians.filter((g) => g.user_id !== myUserId).length })}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {memberGuardians.filter((g) => g.user_id !== myUserId).map((g) => (
              <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, borderRadius: 12, background: "rgba(70,82,122,0.35)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ fontSize: 28 }}>{g.archetype.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#FFF", fontSize: 13, fontWeight: 900 }}>{g.user_display}</div>
                  <div style={{ color: "#a8b4cf", fontSize: 11 }}>{tCrew("gdMemberMeta", { archetype: g.archetype.name, level: g.level, wins: g.wins, losses: g.losses })}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trophaeen */}
      <div>
        <div style={{ color: MUTED, fontSize: 11, fontWeight: 800, letterSpacing: 1, marginBottom: 8 }}>
          {tCrew("gdTrophiesHeader", { count: trophies.length })}
        </div>
        {trophies.length === 0 ? (
          <div style={{ padding: 16, borderRadius: 12, background: "rgba(70,82,122,0.35)", color: MUTED, fontSize: 12, textAlign: "center" }}>
            {tCrew("gdNoTrophies")}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
            {trophies.map((tr) => (
              <div key={tr.id} style={{ padding: 10, borderRadius: 12, background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.3)", textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 4 }}>{tr.archetype?.emoji ?? "❓"}</div>
                <div style={{ color: "#FFF", fontSize: 12, fontWeight: 900 }}>{tr.archetype?.name ?? "?"}</div>
                <div style={{ color: "#FFD700", fontSize: 10, fontWeight: 800 }}>{tCrew("gdTrophyLevel", { level: tr.captured_level })}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Kampf-Historie entfernt: Crew-vs-Shop arena_battles archived 2026-05-05 */}
    </div>
  );
}

function ProfileGuardianBlock({ userId }: { userId: string | null }) {
  const tCrew = useTranslations("Crew");
  const sb = useMemo(() => createClient(), []);
  const [guardian, setGuardian] = useState<GuardianWithArchetype | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      // CoD-Rework: crew_guardians (neues System) — alte user_guardians-Tabelle raus
      const { data: g } = await sb.from("user_guardians")
        .select("id, user_id, crew_id, archetype_id, custom_name, level, xp, wins, losses, current_hp_pct, wounded_until, is_active, acquired_at, source, kind, season_id, talent_points_available, talent_points_spent, last_respec_at, archetype:archetype_id(*)")
        .eq("user_id", userId).eq("is_active", true).maybeSingle();
      if (g) {
        const row = g as unknown as GuardianWithArchetype & { talent_points_available?: number };
        setGuardian(row);
      }
    })();
  }, [sb, userId]);

  if (!guardian) {
    return (
      <div style={{ background: "rgba(70, 82, 122, 0.45)", padding: 20, borderRadius: 18, textAlign: "center", color: MUTED, border: "1px solid rgba(255, 255, 255, 0.1)" }}>
        {tCrew("gdNoActive")}
      </div>
    );
  }

  const pts = (guardian as GuardianWithArchetype & { talent_points_available?: number }).talent_points_available ?? 0;

  return (
    <div>
      {detailOpen && <GuardianDetailModal guardianId={guardian.id} onClose={() => setDetailOpen(false)} />}
      {shopOpen && <GemShopModal onClose={() => setShopOpen(false)} />}
    </div>
  );
}

function MiniKpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ padding: 8, borderRadius: 8, background: "rgba(15,17,21,0.5)", textAlign: "center" }}>
      <div style={{ color: "#8B8FA3", fontSize: 9, fontWeight: 800, letterSpacing: 1 }}>{label.toUpperCase()}</div>
      <div style={{ color, fontSize: 13, fontWeight: 900, marginTop: 2 }}>{value}</div>
    </div>
  );
}

type LiveMember = {
  user_id: string;
  role: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  ansehen: number;
  gebietsruf: number;
  level: number;
  equipped_base_ring_id: string | null;
};

// Demo-Member-Pool — wird nach dem API-Fetch eingespielt damit man UI-mäßig
// sieht wie's mit voller Crew aussieht. ID-Präfix "demo-" als Marker.
const DEMO_LIVE_MEMBERS: LiveMember[] = [
  { user_id: "demo-r4-1", role: "captain", display_name: "Marek Voss",       username: "marek_v",   avatar_url: null, ansehen: 1820_000, gebietsruf: 0, level: 22, equipped_base_ring_id: null },
  { user_id: "demo-r4-2", role: "captain", display_name: "Yuki Nakamura",    username: "yuki_n",    avatar_url: null, ansehen: 1410_000, gebietsruf: 0, level: 20, equipped_base_ring_id: null },
  { user_id: "demo-r4-3", role: "captain", display_name: "Salim Bekiri",     username: "salim_b",   avatar_url: null, ansehen: 1230_000, gebietsruf: 0, level: 19, equipped_base_ring_id: null },
  { user_id: "demo-r3-1", role: "member",  display_name: "Anouk Lefèvre",    username: "anouk_l",   avatar_url: null, ansehen:  980_000, gebietsruf: 0, level: 17, equipped_base_ring_id: null },
  { user_id: "demo-r3-2", role: "member",  display_name: "Tomek Wojcik",     username: "tomek_w",   avatar_url: null, ansehen:  720_000, gebietsruf: 0, level: 16, equipped_base_ring_id: null },
  { user_id: "demo-r3-3", role: "member",  display_name: "Aylin Şahin",      username: "aylin_s",   avatar_url: null, ansehen:  540_000, gebietsruf: 0, level: 14, equipped_base_ring_id: null },
  { user_id: "demo-r3-4", role: "member",  display_name: "Dario Costa",      username: "dario_c",   avatar_url: null, ansehen:  380_000, gebietsruf: 0, level: 12, equipped_base_ring_id: null },
];

function CrewMembers({ crew, profile, isAdmin }: { crew: Crew; profile: Profile | null; isAdmin: boolean }) {
  const tCrew = useTranslations("Crew");
  const baseRingArt = useBaseRingArt();
  const uiIconArt = useUiIconArt();

  // ─── Live-Members aus API ───
  const [liveMembers, setLiveMembers] = useState<LiveMember[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/crew/members?crew_id=${encodeURIComponent(crew.id)}`, { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json() as { members?: LiveMember[] };
        if (!cancelled) {
          const real = j.members ?? [];
          // Demo-Members hinten dran — visualisiert wie's mit voller Crew aussieht
          setLiveMembers([...real, ...DEMO_LIVE_MEMBERS]);
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [crew.id]);

  // ─── Anführer (owner) ───
  const leader = useMemo<LiveMember | null>(() => {
    if (!liveMembers) return null;
    return liveMembers.find((m) => m.user_id === crew.owner_id) ?? liveMembers.find((m) => m.role === "admin" || m.role === "owner") ?? null;
  }, [liveMembers, crew.owner_id]);

  // ─── Restliche Mitglieder (ohne Anführer) ───
  const restMembers = useMemo(() => {
    if (!liveMembers) return [];
    return liveMembers.filter((m) => m.user_id !== leader?.user_id);
  }, [liveMembers, leader]);

  // ─── Suche ───
  const [memberSearch, setMemberSearch] = useState("");
  const filteredRest = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return restMembers;
    return restMembers.filter((m) =>
      (m.display_name?.toLowerCase().includes(q) ?? false) ||
      (m.username?.toLowerCase().includes(q) ?? false),
    );
  }, [restMembers, memberSearch]);

  // ─── Rang-Gruppen für Rest (R4 Offiziere, R3 Mitglieder) ───
  type RankGroup = { id: string; label: string; tag: string; color: string; members: LiveMember[] };
  const groups: RankGroup[] = useMemo(() => {
    const all: RankGroup[] = [
      { id: "r4", label: "Veteranen",  tag: "R4", color: "#FF6B4A", members: filteredRest.filter((m) => m.role === "captain" || m.role === "officer") },
      { id: "r3", label: "Mitglieder", tag: "R3", color: "#22D1C3", members: filteredRest.filter((m) => m.role !== "captain" && m.role !== "officer" && m.role !== "admin" && m.role !== "owner") },
    ];
    return all.filter((x) => x.members.length > 0);
  }, [filteredRest]);

  // ─── Collapse-State ───
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setCollapsed((p) => ({ ...p, [id]: !p[id] }));

  // Leader-Display-Name fallback: bei eigener Crew nutzt profile, sonst leader.display_name
  const leaderRing = leader?.equipped_base_ring_id;
  const leaderName = leader?.display_name || leader?.username || "—";
  const leaderAvatar = leader?.avatar_url ?? null;
  const leaderAnsehen = leader?.ansehen ?? 0;
  const ringAsset = leaderRing && leaderRing !== "default" ? baseRingArt[leaderRing] : null;
  const GOLD = "#FFD700";

  return (
    <div className="flex flex-col gap-2">
      {/* ═══ DON-BANNER ═══ — Avatar+Rahmen größer und überlappt die Banner-Kante.
          overflow NICHT hidden (Avatar darf raus); Stripes haben einen eigenen
          inneren overflow-hidden-Layer damit sie sauber geklippt bleiben. */}
      <div
        className="relative"
        style={{
          background: "linear-gradient(120deg, rgba(15,17,21,0.95) 0%, rgba(15,17,21,0.82) 45%, rgba(15,17,21,0.7) 100%)",
          borderRadius: 4,
          padding: "12px 14px 12px 12px",
          boxShadow: `0 6px 20px rgba(0,0,0,0.5), inset 0 0 0 1px ${crew.color}44`,
        }}
      >
        {/* Clipping-Layer für Streifen — hier overflow:hidden, NICHT auf dem ganzen Banner */}
        <div
          aria-hidden
          className="absolute inset-0 overflow-hidden pointer-events-none"
          style={{ borderRadius: 4 }}
        >
          {/* Diagonale Akzent-Streifen (Crew-Farbe) — die "DNA" dieses Banners */}
          <span
            style={{
              position: "absolute",
              top: -8, bottom: -8, right: 84,
              width: 3,
              background: crew.color,
              opacity: 0.55,
              transform: "skewX(-22deg)",
            }}
          />
          <span
            style={{
              position: "absolute",
              top: -8, bottom: -8, right: 96,
              width: 1.5,
              background: crew.color,
              opacity: 0.3,
              transform: "skewX(-22deg)",
            }}
          />
          {/* Goldener Top-Stripe (Anführer-Glanz) */}
          <span
            style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 2,
              background: `linear-gradient(90deg, ${GOLD}99 0%, ${GOLD} 30%, transparent 80%)`,
            }}
          />
        </div>

        <div className="relative flex items-center gap-3">
          {/* Avatar mit Rahmen — 132×132, negative Margins damit's deutlich über
              den Banner-Rand hinausragt ohne die Banner-Höhe zu vergrößern. */}
          <div
            className="shrink-0 relative"
            style={{
              width: 132, height: 132,
              marginTop: -38, marginBottom: -38, marginLeft: -12,
              zIndex: 3,
            }}
          >
            {ringAsset?.image_url || ringAsset?.video_url ? (
              ringAsset.video_url ? (
                <video
                  src={ringAsset.video_url}
                  autoPlay loop muted playsInline
                  style={{
                    position: "absolute", top: "50%", left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: 132, height: 132, objectFit: "contain",
                    filter: `url(#ma365-chroma-black) drop-shadow(0 3px 14px ${GOLD}99)`,
                    pointerEvents: "none", zIndex: 1,
                  }}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ringAsset.image_url!}
                  alt=""
                  style={{
                    position: "absolute", top: "50%", left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: 132, height: 132, objectFit: "contain",
                    filter: `url(#ma365-chroma-black) drop-shadow(0 3px 14px ${GOLD}99)`,
                    pointerEvents: "none", zIndex: 1,
                  }}
                />
              )
            ) : (
              <div
                style={{
                  position: "absolute", top: "50%", left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: 122, height: 122,
                  borderRadius: "50%",
                  border: `4px solid ${GOLD}`,
                  boxShadow: `0 0 20px ${GOLD}88, inset 0 0 8px ${GOLD}44`,
                }}
              />
            )}
            <div
              style={{
                position: "absolute", top: "50%", left: "50%",
                transform: "translate(-50%, -50%)",
                width: 92, height: 92,
                borderRadius: "50%",
                background: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.12), rgba(70,82,122,0.6))",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "inset 0 0 12px rgba(0,0,0,0.45)",
                overflow: "hidden",
                zIndex: 2,
              }}
            >
              {leaderAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={leaderAvatar} alt="Profil Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontSize: 42, color: "#FFE4B8", fontWeight: 900, textShadow: "0 1px 2px rgba(0,0,0,0.7)" }}>
                  {(leaderName[0] ?? "?").toUpperCase()}
                </span>
              )}
            </div>
          </div>

          {/* Name + Sub-Label + Ansehen */}
          <div className="flex-1 min-w-0">
            {/* Sub-Label — "DER DON" über dem Namen */}
            <div
              className="text-[8.5px] font-black uppercase"
              style={{
                color: GOLD,
                letterSpacing: 3,
                textShadow: `0 0 6px ${GOLD}44`,
                fontFamily: "var(--font-display-stack)",
              }}
            >
              ★ Der Don
            </div>
            {/* Name groß im Display-Font */}
            <div
              className="text-[18px] font-black uppercase truncate"
              style={{
                color: "#FFF",
                fontFamily: "var(--font-display-stack)",
                letterSpacing: 0.6,
                textShadow: `0 2px 6px rgba(0,0,0,0.85), 0 0 14px ${crew.color}33`,
                lineHeight: 1.05,
                marginTop: 1,
              }}
            >
              {leaderName}
            </div>
            {/* Ansehen-Reihe — Icon via UiIcon (Artwork wenn vorhanden, sonst ⚜).
                Identisches Rendering wie base-client ScoreCard: inline span ohne
                Flex-Wrapping damit der Emoji-Glyph genauso aussieht. */}
            <div className="flex items-baseline gap-2 mt-1.5">
              <span style={{ fontSize: 16, lineHeight: 1, color: GOLD }}>
                <UiIcon slot="stat_ansehen" fallback="🌟" art={uiIconArt} size={16} />
              </span>
              <span
                className="text-[15px] font-black uppercase tracking-wider"
                style={{ color: "#cdd4e3", letterSpacing: 1.5 }}
              >
                Ansehen
              </span>
              <span
                className="text-[20px] font-black tabular-nums ml-1"
                style={{
                  color: GOLD,
                  fontFamily: "var(--font-display-stack)",
                  lineHeight: 1,
                  letterSpacing: -0.3,
                  textShadow: `0 1px 2px rgba(0,0,0,0.7)`,
                }}
              >
                {leaderAnsehen.toLocaleString("de-DE")}
              </span>
            </div>
          </div>

          {/* R5-Wachs-Siegel rechts — Stempel-Optik mit Doppelring */}
          <div className="shrink-0 relative" style={{ width: 56, height: 56 }}>
            {/* Outer ornamental ring */}
            <div
              style={{
                position: "absolute", inset: 0,
                borderRadius: "50%",
                border: `2px dashed ${GOLD}88`,
                animation: "ma365LeaderSeal 18s linear infinite",
              }}
            />
            {/* Inner solid medallion */}
            <div
              className="absolute flex items-center justify-center"
              style={{
                inset: 6,
                borderRadius: "50%",
                background: `radial-gradient(circle at 35% 30%, ${GOLD} 0%, ${GOLD}cc 50%, #B8860B 100%)`,
                border: `2px solid ${GOLD}`,
                boxShadow: `0 2px 8px rgba(0,0,0,0.5), inset 0 -2px 4px rgba(0,0,0,0.3)`,
              }}
            >
              <span
                style={{
                  color: BG_DEEP,
                  fontSize: 18,
                  fontWeight: 900,
                  fontFamily: "var(--font-display-stack)",
                  letterSpacing: 0.5,
                  textShadow: "0 1px 0 rgba(255,255,255,0.4)",
                }}
              >
                R5
              </span>
            </div>
          </div>
        </div>

        {/* Bottom-Akzent in Crew-Farbe */}
        <span
          aria-hidden
          style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: 2,
            background: `linear-gradient(90deg, transparent, ${crew.color}aa 30%, ${crew.color} 60%, ${crew.color}aa 80%, transparent)`,
          }}
        />
      </div>

      <style>{`
        @keyframes ma365LeaderSeal {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>

      {/* ═══ SUCHE ═══ — schmal, mit Abstand zum Anführer-Banner */}
      <div className="relative mt-4">
        <input
          type="text"
          value={memberSearch}
          onChange={(e) => setMemberSearch(e.target.value)}
          placeholder="Mitglied suchen…"
          className="w-full pl-8 pr-3 py-1.5 rounded-md text-[11px] text-white outline-none"
          style={{
            background: "rgba(15,17,21,0.55)",
            border: `1px solid ${crew.color}22`,
          }}
        />
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px]" style={{ color: crew.color }}>🔍</span>
        {memberSearch && (
          <button
            onClick={() => setMemberSearch("")}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded text-white text-[10px]"
            style={{ background: "rgba(255,255,255,0.1)" }}
          >✕</button>
        )}
      </div>

      {/* Loading-State */}
      {!liveMembers && (
        <div style={{ padding: 20, textAlign: "center", color: MUTED, fontSize: 12 }}>
          Lade Mitglieder…
        </div>
      )}

      {liveMembers && filteredRest.length === 0 && memberSearch && (
        <div style={{ padding: 16, textAlign: "center", color: MUTED, fontSize: 12 }}>
          Keine Mitglieder gefunden für „{memberSearch}".
        </div>
      )}

      {/* ═══ RANG-GRUPPEN ═══ — R4 + R3 (R5 ist jetzt der Banner oben) */}
      {liveMembers && groups.map((grp) => {
        const isOpen = !collapsed[grp.id];
        return (
          <div key={grp.id} className="flex flex-col gap-1.5">
            <button
              onClick={() => toggle(grp.id)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition hover:brightness-110"
              style={{
                background: `linear-gradient(90deg, ${grp.color}22, ${grp.color}08 70%, transparent)`,
                border: `1px solid ${grp.color}44`,
                cursor: "pointer",
              }}
            >
              <span
                className="shrink-0 inline-flex items-center justify-center font-black"
                style={{
                  width: 26, height: 26,
                  background: `linear-gradient(135deg, ${grp.color}, ${grp.color}aa)`,
                  color: BG_DEEP,
                  borderRadius: 5,
                  fontSize: 10,
                  letterSpacing: 0.5,
                  border: `1.5px solid ${grp.color}`,
                  fontFamily: "var(--font-display-stack)",
                }}
              >
                {grp.tag}
              </span>
              <span
                className="flex-1 text-left text-[12px] font-black uppercase tracking-wider truncate text-white"
                style={{ letterSpacing: 1.2, textShadow: "0 1px 2px rgba(0,0,0,0.7)" }}
              >
                {grp.label}
              </span>
              <span
                className="inline-flex items-center gap-1 text-[11px] font-black tabular-nums"
                style={{ color: grp.color }}
              >
                <span style={{ fontSize: 12 }}>👥</span>
                {grp.members.length}
              </span>
              <span
                className="ml-1 text-[12px] transition"
                style={{ color: grp.color, transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
              >
                ▼
              </span>
            </button>
            {isOpen && (
              <div className="grid grid-cols-2 gap-1.5">
                {grp.members.map((m) => (
                  <LiveCrewMemberCard
                    key={m.user_id}
                    member={m}
                    rankColor={grp.color}
                    crewColor={crew.color}
                    uiIconArt={uiIconArt}
                    canManage={isAdmin}
                    onMore={() => appAlert(tCrew("memActionsAlert", { name: m.display_name || m.username || "Mitglied" }))}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

    </div>
  );
}

/* Member-Card für Live-Daten (mit avatar_url) */
function LiveCrewMemberCard({ member: m, rankColor, crewColor, uiIconArt, canManage, onMore }: {
  member: LiveMember;
  rankColor: string;
  crewColor: string;
  uiIconArt: ReturnType<typeof useUiIconArt>;
  canManage: boolean;
  onMore: () => void;
}) {
  const name = m.display_name || m.username || "Mitglied";
  return (
    <div
      className="flex items-center gap-2 p-2 rounded-lg relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(15,17,21,0.65) 100%)",
        border: `1px solid ${rankColor}33`,
        minHeight: 52,
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute", top: 0, bottom: 0, left: 0, width: 3,
          background: `linear-gradient(180deg, ${rankColor}, ${rankColor}66)`,
        }}
      />
      <div
        className="shrink-0 relative inline-flex items-center justify-center overflow-hidden"
        style={{
          width: 36, height: 36,
          borderRadius: "50%",
          background: `${crewColor}22`,
          border: `2px solid ${crewColor}88`,
        }}
      >
        {m.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ fontSize: 18, color: "#FFE4B8", fontWeight: 900 }}>{name[0]?.toUpperCase() ?? "?"}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-black text-white truncate" style={{ letterSpacing: 0.2, lineHeight: 1.15 }}>
          {name}
        </div>
        <div className="inline-flex items-center gap-1 text-[10px] font-bold tabular-nums truncate" style={{ color: "#FFD700", lineHeight: 1.2 }}>
          <UiIcon slot="stat_ansehen" fallback="🌟" art={uiIconArt} size={12} />
          {(m.ansehen ?? 0).toLocaleString("de-DE")}
        </div>
      </div>
      {canManage && (
        <button
          onClick={onMore}
          className="shrink-0 w-6 h-6 rounded text-[12px] text-white"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.15)",
          }}
        >⋯</button>
      )}
    </div>
  );
}

/* Einzelne Mitglieder-Card im RoK-Stil — Avatar links mit farbigem Ring,
   Name + Ansehen rechts, dezenter Rang-Akzent in der Border. */
function CrewMemberCard({ member: m, rankColor, crewColor, canManage, onMore }: {
  member: CrewMember;
  rankColor: string;
  crewColor: string;
  canManage: boolean;
  onMore: () => void;
}) {
  return (
    <div
      className="flex items-center gap-2 p-2 rounded-lg relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(15,17,21,0.65) 100%)",
        border: `1px solid ${rankColor}33`,
        minHeight: 56,
      }}
    >
      {/* Akzent-Linie links — Rang-Farbe */}
      <span
        aria-hidden
        style={{
          position: "absolute", top: 0, bottom: 0, left: 0, width: 3,
          background: `linear-gradient(180deg, ${rankColor}, ${rankColor}66)`,
        }}
      />
      {/* Avatar mit Ring */}
      <div
        className="shrink-0 relative inline-flex items-center justify-center"
        style={{
          width: 40, height: 40,
          borderRadius: "50%",
          background: `${crewColor}22`,
          border: `2px solid ${crewColor}88`,
          fontSize: 22,
        }}
      >
        {m.avatar_emoji}
        {m.online && (
          <span
            aria-hidden
            style={{
              position: "absolute", bottom: -1, right: -1,
              width: 11, height: 11, borderRadius: "50%",
              background: "#4ade80",
              border: "2px solid rgba(15,17,21,1)",
            }}
          />
        )}
      </div>
      {/* Name + Ansehen */}
      <div className="flex-1 min-w-0">
        <div
          className="text-[12px] font-black text-white truncate"
          style={{ letterSpacing: 0.2, lineHeight: 1.15 }}
        >
          {m.display_name}
        </div>
        <div
          className="text-[10.5px] font-bold tabular-nums truncate"
          style={{ color: "#FFD700", lineHeight: 1.2 }}
        >
          ⚜ {m.weekly_xp.toLocaleString("de-DE")}
        </div>
      </div>
      {/* Optional: Aktionen-Menü */}
      {canManage && (
        <button
          onClick={onMore}
          className="shrink-0 w-6 h-6 rounded text-[12px] text-white"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.15)",
          }}
        >⋯</button>
      )}
    </div>
  );
}

/* Badge moved to ./_tabs/_shared */

/* ═══ Challenges ═══ */
function CrewChallenges({ color }: { color: string }) {
  const tCrew = useTranslations("Crew");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <DemoBadge hint={tCrew("chDemoHint")} />
      </div>
      {DEMO_CREW_CHALLENGES.map((c) => {
        const pct = Math.min(100, (c.current / c.target) * 100);
        return (
          <div key={c.id} style={{
            background: "rgba(70, 82, 122, 0.45)", borderRadius: 16, padding: 14,
            border: `1px solid ${BORDER}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ fontSize: 26 }}>{c.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#FFF", fontSize: 14, fontWeight: 900 }}>{c.title}</div>
                <div style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>{c.description}</div>
              </div>
            </div>
            <div style={{ height: 8, background: "rgba(0,0,0,0.35)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${pct}%`, background: color,
                boxShadow: `0 0 10px ${color}88`, transition: "width 0.4s",
              }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11 }}>
              <span style={{ color: "#FFF", fontWeight: 900 }}>{c.current} / {c.target} {c.unit}</span>
              <span style={{ color: "#FFD700", fontWeight: 900 }}>{tCrew("chRewardXp", { xp: c.reward_xp })}</span>
              <span style={{ color: MUTED }}>{daysUntil(c.ends_at, tCrew)}</span>
            </div>
          </div>
        );
      })}
      <button style={{ ...outlineBtnStyle(), marginTop: 6 }}>
        {tCrew("chOwnChallenge")}
      </button>
    </div>
  );
}

/* ═══ Events ═══ */
function CrewEvents({ color }: { color: string }) {
  const tCrew = useTranslations("Crew");
  const locale = useLocale();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <DemoBadge hint={tCrew("evDemoHint")} />
      </div>
      {DEMO_CREW_EVENTS.map((e) => (
        <div key={e.id} style={{
          background: "rgba(70, 82, 122, 0.45)", borderRadius: 16, padding: 14,
          border: `1px solid ${BORDER}`, borderLeft: `4px solid ${color}`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#FFF", fontSize: 14, fontWeight: 900 }}>{e.title}</div>
              <div style={{ color: color, fontSize: 12, fontWeight: 700, marginTop: 2 }}>
                {fmtEventTime(e.when_iso, tCrew, locale)}
              </div>
            </div>
            <div style={{
              background: `${color}22`, border: `1px solid ${color}55`,
              padding: "4px 8px", borderRadius: 10,
              color, fontSize: 11, fontWeight: 900,
            }}>👥 {e.attendees}</div>
          </div>
          <div style={{ color: MUTED, fontSize: 12, marginTop: 8 }}>
            📍 {e.meeting_point} · 🏃 {e.distance_km} km · ⏱️ {e.pace}
          </div>
          <div style={{ color: MUTED, fontSize: 11, marginTop: 4 }}>
            {tCrew("evHostLabel", { name: e.host_username })}
          </div>
          {e.note && (
            <div style={{
              color: TEXT_SOFT, fontSize: 12, fontStyle: "italic",
              marginTop: 8, padding: 8, background: "rgba(0,0,0,0.2)", borderRadius: 8,
            }}>
              &quot;{e.note}&quot;
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button style={{ ...primaryBtnStyle(color), padding: "10px 14px", fontSize: 12, width: "auto", flex: 1 }}>
              {tCrew("evJoin")}
            </button>
            <button style={{ ...outlineBtnStyle(), padding: "10px 14px", fontSize: 12, width: "auto", flex: 1 }}>
              {tCrew("evDetails")}
            </button>
          </div>
        </div>
      ))}
      <button style={{ ...outlineBtnStyle(), marginTop: 6 }}>
        {tCrew("evNew")}
      </button>
    </div>
  );
}

/* ═══ Chat ═══ */
const CHAT_REACTIONS = ["👏", "🔥", "💪", "❤️", "😂", "🎉"];

function CrewChat({ color, meUsername }: { color: string; meUsername: string }) {
  const tCrew = useTranslations("Crew");
  const [draft, setDraft] = useState("");
  const [reactions, setReactions] = useState<Record<string, string[]>>({}); // msgId → emojis
  const [reactPickerFor, setReactPickerFor] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);

  const toggleReact = (msgId: string, emoji: string) => {
    setReactions((prev) => {
      const list = prev[msgId] || [];
      const has = list.includes(emoji);
      return { ...prev, [msgId]: has ? list.filter((e) => e !== emoji) : [...list, emoji] };
    });
    setReactPickerFor(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <DemoBadge hint={tCrew("chatDemoHint")} />
      </div>
      <div style={{
        background: "rgba(0,0,0,0.2)", borderRadius: 14, padding: 12,
        maxHeight: 460, overflowY: "auto",
        display: "flex", flexDirection: "column", gap: 10,
      }}>
        {DEMO_CREW_CHAT.map((m) => {
          const mine = m.username === meUsername;
          const myReacts = reactions[m.id] || [];
          return (
            <div key={m.id} style={{
              display: "flex", gap: 8,
              flexDirection: mine ? "row-reverse" : "row",
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: 15,
                background: `${color}22`, border: `1px solid ${color}55`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, flexShrink: 0,
              }}>{m.avatar_emoji}</div>
              <div style={{ maxWidth: "75%", position: "relative" }}>
                <div style={{
                  display: "flex", gap: 6, fontSize: 10, color: MUTED,
                  marginBottom: 3, flexDirection: mine ? "row-reverse" : "row",
                }}>
                  <span style={{ fontWeight: 700 }}>{m.display_name}</span>
                  <span>·</span>
                  <span>{fmtRelTime(m.ts_iso, tCrew)}</span>
                </div>
                <div
                  onDoubleClick={() => setReactPickerFor(reactPickerFor === m.id ? null : m.id)}
                  style={{
                    background: mine ? color : "rgba(70, 82, 122, 0.6)",
                    color: mine ? BG_DEEP : "#FFF",
                    padding: "8px 12px",
                    borderRadius: 14,
                    fontSize: 13, lineHeight: 1.4,
                    border: `1px solid ${mine ? color : BORDER}`,
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                  title={tCrew("chatReactTitle")}
                >
                  {m.text}
                </div>
                {myReacts.length > 0 && (
                  <div style={{
                    display: "flex", gap: 3, marginTop: 4,
                    justifyContent: mine ? "flex-end" : "flex-start",
                  }}>
                    {myReacts.map((e) => (
                      <span key={e} onClick={() => toggleReact(m.id, e)} style={{
                        fontSize: 13, padding: "2px 6px", borderRadius: 10,
                        background: "rgba(255,255,255,0.08)", border: `1px solid ${BORDER}`,
                        cursor: "pointer",
                      }}>{e}</span>
                    ))}
                  </div>
                )}
                {reactPickerFor === m.id && (
                  <div style={{
                    position: "absolute", [mine ? "right" : "left"]: 0, top: "100%",
                    marginTop: 4, padding: "6px 8px", borderRadius: 14,
                    background: BG_DEEP, border: `1px solid ${BORDER}`,
                    display: "flex", gap: 6, zIndex: 20,
                    boxShadow: "0 6px 18px rgba(0,0,0,0.5)",
                  }}>
                    {CHAT_REACTIONS.map((e) => (
                      <button key={e} onClick={() => toggleReact(m.id, e)} style={{
                        background: "transparent", border: "none", cursor: "pointer",
                        fontSize: 20, padding: 2, lineHeight: 1,
                      }}>{e}</button>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setReactPickerFor(reactPickerFor === m.id ? null : m.id)}
                  aria-label={tCrew("chatReactAria")}
                  style={{
                    position: "absolute", top: 14,
                    [mine ? "left" : "right"]: -26,
                    background: "rgba(0,0,0,0.4)", border: `1px solid ${BORDER}`,
                    borderRadius: 12, width: 22, height: 22,
                    color: MUTED, cursor: "pointer", fontSize: 12, padding: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >+</button>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => {
            setRecording((r) => !r);
            if (!recording) appAlert(tCrew("chatVoiceAlert"));
          }}
          aria-label={tCrew("chatVoiceAria")}
          style={{
            padding: "0 14px", borderRadius: 12,
            background: recording ? ACCENT : "rgba(20, 26, 44, 0.6)",
            border: `1px solid ${recording ? ACCENT : BORDER}`,
            color: recording ? "#FFF" : MUTED, fontSize: 16, cursor: "pointer",
          }}
        >🎙️</button>
        <input
          value={draft} onChange={(e) => setDraft(e.target.value)}
          placeholder={tCrew("chatPlaceholder")}
          style={inputStyle()}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              appAlert(tCrew("chatSendAlert"));
              setDraft("");
            }
          }}
        />
        <button
          onClick={() => { if (draft.trim()) { appAlert(tCrew("chatSendSoon")); setDraft(""); } }}
          style={{
            padding: "0 18px", borderRadius: 12,
            background: color, color: BG_DEEP,
            fontSize: 14, fontWeight: 900, border: "none", cursor: "pointer",
          }}
        >
          ➤
        </button>
      </div>
    </div>
  );
}

/* ═══ Crew Feed ═══ */
function CrewFeed({ color }: { color: string }) {
  const tCrew = useTranslations("Crew");
  const [reactions, setReactions] = useState<Record<string, string[]>>({});
  const toggleReact = (id: string, emoji: string) => {
    setReactions((prev) => {
      const list = prev[id] || [];
      return { ...prev, [id]: list.includes(emoji) ? list.filter((e) => e !== emoji) : [...list, emoji] };
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
        <span style={{ color: MUTED, fontSize: 11, fontWeight: 800, letterSpacing: 0.5 }}>
          {tCrew("feedHeader")}
        </span>
        <DemoBadge hint={tCrew("feedDemoHint")} />
      </div>
      {DEMO_CREW_FEED.map((item) => {
        const my = reactions[item.id] || [];
        const existing = item.reactions || [];
        return (
          <div key={item.id} style={{
            background: "rgba(70, 82, 122, 0.45)", borderRadius: 14,
            padding: "12px 14px", border: `1px solid ${BORDER}`,
            borderLeft: `3px solid ${item.accent || color}`,
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              {item.avatar_emoji && (
                <div style={{
                  width: 32, height: 32, borderRadius: 16,
                  background: `${color}22`, border: `1px solid ${color}55`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, flexShrink: 0,
                }}>{item.avatar_emoji}</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#FFF", fontSize: 13, lineHeight: 1.45 }}>
                  {item.username && <b style={{ color: item.accent || "#FFF" }}>@{item.username}</b>}
                  {item.username && " "}
                  <span dangerouslySetInnerHTML={{ __html: item.text.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>") }} />
                </div>
                <div style={{ color: MUTED, fontSize: 10, marginTop: 3 }}>{fmtRelTime(item.ts_iso, tCrew)}</div>
              </div>
            </div>
            <div style={{ marginTop: 8, display: "flex", gap: 5, flexWrap: "wrap" }}>
              {existing.map((r) => {
                const mine = my.includes(r.emoji);
                return (
                  <button key={r.emoji} onClick={() => toggleReact(item.id, r.emoji)} style={{
                    padding: "3px 8px", borderRadius: 12,
                    background: mine ? `${color}33` : "rgba(255,255,255,0.06)",
                    border: `1px solid ${mine ? color : BORDER}`,
                    color: "#FFF", fontSize: 11, fontWeight: 700, cursor: "pointer",
                  }}>
                    {r.emoji} {r.count + (mine ? 1 : 0)}
                  </button>
                );
              })}
              {CHAT_REACTIONS.filter((e) => !existing.some((r) => r.emoji === e)).slice(0, 3).map((e) => (
                <button key={e} onClick={() => toggleReact(item.id, e)} style={{
                  padding: "3px 8px", borderRadius: 12,
                  background: "transparent", border: `1px solid ${BORDER}`,
                  color: MUTED, fontSize: 11, cursor: "pointer",
                }}>{e}</button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══ Crew Settings ═══ */
function CrewSettings({ crew, isAdmin }: { crew: Crew; isAdmin: boolean }) {
  const tCrew = useTranslations("Crew");
  const [rules, setRules] = useState(tCrew("setRulesDefault"));
  const [pushNewChat, setPushNewChat] = useState(true);
  const [pushChallenges, setPushChallenges] = useState(true);
  const [pushEvents, setPushEvents] = useState(true);
  const [pushRivalDuel, setPushRivalDuel] = useState(true);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Crew-Identität */}
      {isAdmin && (
        <div style={{ background: "rgba(70, 82, 122, 0.45)", padding: 14, borderRadius: 14, border: `1px solid ${BORDER}` }}>
          <div style={{ color: MUTED, fontSize: 11, fontWeight: 800, letterSpacing: 0.5, marginBottom: 10 }}>
            {tCrew("setIdentity")}
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <button style={outlineBtnStyle()} onClick={() => appAlert(tCrew("setCoverAlert"))}>
              {tCrew("setCoverUpload")}
            </button>
            <button style={outlineBtnStyle()} onClick={() => appAlert(tCrew("setLogoAlert"))}>
              {tCrew("setLogoUpload")}
            </button>
          </div>
          <div style={{ color: MUTED, fontSize: 11, marginBottom: 4 }}>{tCrew("setCrewLink")}</div>
          <div style={{
            background: "rgba(0,0,0,0.3)", padding: "8px 10px", borderRadius: 10,
            fontFamily: "monospace", fontSize: 12, color: "#FFF",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span>myarea365.de/crew/{crew.invite_code.toLowerCase()}</span>
            <button onClick={() => { navigator.clipboard.writeText(`https://myarea365.de/crew/${crew.invite_code.toLowerCase()}`); appAlert(tCrew("setLinkCopiedAlert")); }} style={{
              background: "transparent", border: "none", color: crew.color,
              fontSize: 11, fontWeight: 700, cursor: "pointer",
            }}>{tCrew("setLinkCopy")}</button>
          </div>
        </div>
      )}

      {/* Verhaltenskodex */}
      <div style={{ background: "rgba(70, 82, 122, 0.45)", padding: 14, borderRadius: 14, border: `1px solid ${BORDER}` }}>
        <div style={{ color: MUTED, fontSize: 11, fontWeight: 800, letterSpacing: 0.5, marginBottom: 8 }}>
          {tCrew("setRulesHeader")}
        </div>
        <textarea
          value={rules} onChange={(e) => setRules(e.target.value)}
          disabled={!isAdmin}
          rows={5}
          style={{
            ...inputStyle(), fontFamily: "inherit", resize: "vertical",
            opacity: isAdmin ? 1 : 0.8,
          }}
        />
        {isAdmin && (
          <button style={{ ...primaryBtnStyle(crew.color), marginTop: 8 }} onClick={() => appAlert(tCrew("setRulesSavedAlert"))}>
            {tCrew("setRulesSave")}
          </button>
        )}
      </div>

      {/* Push-Notifications */}
      <div style={{ background: "rgba(70, 82, 122, 0.45)", padding: 14, borderRadius: 14, border: `1px solid ${BORDER}` }}>
        <div style={{ color: MUTED, fontSize: 11, fontWeight: 800, letterSpacing: 0.5, marginBottom: 10 }}>
          {tCrew("setPushHeader")}
        </div>
        <SettingsToggle label={tCrew("setPushNewChat")} value={pushNewChat} onChange={setPushNewChat} />
        <SettingsToggle label={tCrew("setPushChallenges")} value={pushChallenges} onChange={setPushChallenges} />
        <SettingsToggle label={tCrew("setPushEvents")} value={pushEvents} onChange={setPushEvents} />
        <SettingsToggle label={tCrew("setPushRivals")} value={pushRivalDuel} onChange={setPushRivalDuel} />
        <button
          onClick={() => appAlert(tCrew("setPushAlert"))}
          style={{ ...outlineBtnStyle(), marginTop: 10 }}
        >
          {tCrew("setPushEnable")}
        </button>
      </div>

      {/* Premium-Teaser */}
      <div style={{
        background: `linear-gradient(135deg, #FFD70022 0%, #FF2D7822 100%)`,
        padding: 16, borderRadius: 14, border: `1px solid #FFD70055`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 22 }}>⭐</span>
          <div style={{ color: "#FFF", fontSize: 16, fontWeight: 900 }}>{tCrew("setPremiumTitle")}</div>
        </div>
        <div style={{ color: TEXT_SOFT, fontSize: 12, marginBottom: 10 }}>
          {tCrew("setPremiumDesc")}
        </div>
        <button style={primaryBtnStyle("#FFD700")} onClick={() => appAlert(tCrew("setPremiumAlert"))}>
          {tCrew("setPremiumBtn")}
        </button>
      </div>

      {/* Sponsored-Teaser */}
      <div style={{ background: "rgba(70, 82, 122, 0.45)", padding: 14, borderRadius: 14, border: `1px solid ${BORDER}` }}>
        <div style={{ color: MUTED, fontSize: 11, fontWeight: 800, letterSpacing: 0.5, marginBottom: 6 }}>
          {tCrew("setSponsorHeader")}
        </div>
        <div style={{ color: TEXT_SOFT, fontSize: 12, marginBottom: 10 }}>
          {tCrew("setSponsorDesc")}
        </div>
        <button style={outlineBtnStyle()} onClick={() => appAlert(tCrew("setSponsorAlert"))}>
          {tCrew("setSponsorBtn")}
        </button>
      </div>

      {/* Merch */}
      <div style={{ background: "rgba(70, 82, 122, 0.45)", padding: 14, borderRadius: 14, border: `1px solid ${BORDER}` }}>
        <div style={{ color: MUTED, fontSize: 11, fontWeight: 800, letterSpacing: 0.5, marginBottom: 6 }}>
          {tCrew("setMerchHeader")}
        </div>
        <div style={{ color: TEXT_SOFT, fontSize: 12, marginBottom: 10 }}>
          {tCrew("setMerchDesc")}
        </div>
        <button style={outlineBtnStyle()} onClick={() => appAlert(tCrew("setMerchAlert"))}>
          {tCrew("setMerchBtn")}
        </button>
      </div>
    </div>
  );
}

function SettingsToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "8px 0", borderBottom: `1px solid ${BORDER}`, cursor: "pointer",
    }}>
      <span style={{ color: "#FFF", fontSize: 13 }}>{label}</span>
      <button
        onClick={() => onChange(!value)}
        aria-pressed={value}
        style={{
          width: 40, height: 22, borderRadius: 11,
          background: value ? PRIMARY : "rgba(255,255,255,0.1)",
          border: `1px solid ${value ? PRIMARY : BORDER}`,
          cursor: "pointer", position: "relative", transition: "all 0.2s",
        }}
      >
        <span style={{
          position: "absolute", top: 2, left: value ? 20 : 2,
          width: 16, height: 16, borderRadius: 8, background: "#FFF",
          transition: "left 0.2s",
        }} />
      </button>
    </label>
  );
}

/* ═══ Datum/Zeit Helper ═══ */
type CrewT = ReturnType<typeof useTranslations<"Crew">>;
function daysUntil(iso: string, t: CrewT): string {
  const diff = new Date(iso).getTime() - Date.now();
  const d = Math.ceil(diff / (24 * 3600 * 1000));
  if (d <= 0) return t("daysEndsToday");
  if (d === 1) return t("daysOne");
  return t("daysMany", { n: d });
}
function fmtEventTime(iso: string, t: CrewT, locale: string): string {
  const dl = getDateLocale(locale);
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const time = d.toLocaleTimeString(dl, { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return t("evtToday", { time });
  if (isTomorrow) return t("evtTomorrow", { time });
  return d.toLocaleDateString(dl, { weekday: "short", day: "2-digit", month: "short" }) + ", " + time;
}
function fmtRelTime(iso: string, t: CrewT): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return t("relNow");
  if (m < 60) return t("relMin", { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t("relHour", { n: h });
  return t("relDay", { n: Math.floor(h / 24) });
}
