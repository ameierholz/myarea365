"use client";

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useTranslations, useLocale } from "next-intl";
import { getDateLocale, getNumberLocale } from "@/i18n/config";
import Link from "next/link";
import { openLegalModal } from "@/components/legal-modal";
import { claimIntensity } from "@/lib/claim-intensity";
import { InboxContent } from "./inbox-content";
import { InboxClient } from "../inbox/inbox-client";
import { MapQuickAccess } from "@/components/map-quick-access";
import { DiamantPill } from "@/components/diamant-pill";
import { BerlinCoveragePill } from "@/components/berlin-coverage-pill";
import { DividendClaimCard } from "@/components/dividend-claim-card";
import { CrewSynergyCard } from "@/components/crew-synergy-card";
import { MentorCard } from "@/components/mentor-card";
import { SeasonPassPill } from "@/components/season-pass-pill";
import { CrewModal, TabTech, TabBauwerke, TabKopfgelder, TabShop, type BuildingKind } from "@/components/crew-modal";
import { RepeaterInfoPopup } from "@/components/repeater-info-popup";
import { PlaceRepeaterModal, AttackRepeaterModal } from "@/components/repeater-modals";
import { SupportContent } from "./support-content";
// runner-fights archived (pivot 2026-05-05) — Modal-Slot bleibt, Inhalt wird im
// neuen March-System ersetzt
import { ReferralWidget } from "@/components/referral-widget";
// Modals: in PROD lazy via dynamic, in DEV direkt — Turbopack HMR-Bug
// "module factory not available" bei dynamic+ssr-mix. process.env.NODE_ENV
// wird zur Build-Zeit ersetzt → Tree-Shaking lässt im PROD-Bundle den
// Static-Import raus, im DEV den dynamic-Branch.
import { UpgradeModal as UpgradeModalDirect } from "@/components/upgrade-modal";
import { BoostShopModal as PowerShopModalDirect, BoostShopBody } from "@/components/boost-shop";
import { RewardedAdButton } from "@/components/rewarded-ad";
import { SupporterBadge, type SupporterTier } from "@/components/supporter-badge";
import { WalkSummaryModal as WalkSummaryModalDirect } from "@/components/walk-summary-modal";
import type { WalkSummary } from "@/components/walk-summary-modal";
import { RunRouteModal as RunRouteModalDirect } from "@/components/run-route-modal";
import { OwnershipModal as OwnershipModalDirect } from "@/components/ownership-modal";
import { ArenaChallengeModal as ArenaChallengeModalDirect } from "@/components/arena-challenge-modal";
import { GuardianCard } from "@/components/guardian-card";
import { GuardianAvatar } from "@/components/guardian-avatar";
import { GuardianDetailModal as GuardianDetailModalDirect } from "@/components/guardian-detail-modal";
import { GuardianGalleryModal as GuardianGalleryModalDirect } from "@/components/guardian-gallery-modal";

const _IS_PROD = process.env.NODE_ENV === "production";
const UpgradeModal = _IS_PROD ? dynamic(() => import("@/components/upgrade-modal").then(m => m.UpgradeModal)) : UpgradeModalDirect;
const PowerShopModal = _IS_PROD ? dynamic(() => import("@/components/boost-shop").then(m => m.BoostShopModal)) : PowerShopModalDirect;
const WalkSummaryModal = _IS_PROD ? dynamic(() => import("@/components/walk-summary-modal").then(m => m.WalkSummaryModal)) : WalkSummaryModalDirect;
const RunRouteModal = _IS_PROD ? dynamic(() => import("@/components/run-route-modal").then(m => m.RunRouteModal)) : RunRouteModalDirect;
const OwnershipModal = _IS_PROD ? dynamic(() => import("@/components/ownership-modal").then(m => m.OwnershipModal)) : OwnershipModalDirect;
const ArenaChallengeModal = _IS_PROD ? dynamic(() => import("@/components/arena-challenge-modal").then(m => m.ArenaChallengeModal)) : ArenaChallengeModalDirect;
const GuardianDetailModal = _IS_PROD ? dynamic(() => import("@/components/guardian-detail-modal").then(m => m.GuardianDetailModal)) : GuardianDetailModalDirect;
const GuardianGalleryModal = _IS_PROD ? dynamic(() => import("@/components/guardian-gallery-modal").then(m => m.GuardianGalleryModal)) : GuardianGalleryModalDirect;
import { MMR_TIERS, type MmrTier } from "@/lib/mmr-tiers";
import { GUARDIAN_CLASSES, legacyTypeToClass, type GuardianClass } from "@/lib/guardian-classes";
import { normalizeFaction } from "@/lib/factions";
import { AdSenseSlot } from "@/components/adsense-slot";
import { GemShopModal as GemShopModalDirect } from "@/components/gem-shop-modal";
import { ShopHubModal as ShopHubModalDirect } from "@/components/shop-hub-modal";
const GemShopModal = _IS_PROD ? dynamic(() => import("@/components/gem-shop-modal").then(m => m.GemShopModal)) : GemShopModalDirect;
const ShopHubModal = _IS_PROD ? dynamic(() => import("@/components/shop-hub-modal").then(m => m.ShopHubModal)) : ShopHubModalDirect;
import { useRankArt, RankBadge, rankIdByName } from "@/components/rank-badge";
import { useResourceArt, ResourceIcon, useStrongholdArt, useBaseThemeArt, useNameplateArt, useBaseRingArt, useMarkerArt, useUiIconArt, UiIcon, useArtworkReady } from "@/components/resource-icon";
import { RouteBanner, type ActiveRoute } from "@/components/route-banner";
import { RunnerActivityCards } from "@/components/runner-activity-cards";
import { DailyDealTeaser } from "@/components/daily-deal-teaser";
import { DailyDealMapBadge } from "@/components/daily-deal-map-badge";
import { MapHelpButton } from "@/components/map-help-button";
import { MapLegendModal } from "@/components/map-legend-modal";
import { CrewLiveHub } from "@/components/crew-live-hub";
import { markOnboardingSeen, shouldShowOnboarding } from "@/components/onboarding-modal";
import { OnboardingModal as OnboardingModalDirect } from "@/components/onboarding-modal";
import { FaqModal as FaqModalDirect } from "@/components/faq-modal";
import { PotionInventoryModal as PotionInventoryModalDirect } from "@/components/potion-inventory-modal";
import { PopupOfferGate } from "@/components/popup-offer-modal";
import { RunnerInventoryModal } from "@/components/runner-inventory-modal";
import { GrowthFundModal } from "@/components/growth-fund-modal";
import { MonthlyPackModal } from "@/components/monthly-pack-modal";
import { LuckyWheelModal } from "@/components/lucky-wheel-modal";
import { ForgeOfLightModal } from "@/components/forge-of-light-modal";
import { LootHubModal, DesktopWebBonusTrigger } from "@/components/loot-hub-modal";
import { ResourceBar } from "@/components/resource-bar";
import { LoadoutTrio } from "@/components/loadout-trio";
import { RunnerStatsModal as RunnerStatsModalDirect } from "@/components/runner-stats-modal";
const OnboardingModal = _IS_PROD ? dynamic(() => import("@/components/onboarding-modal").then(m => m.OnboardingModal)) : OnboardingModalDirect;
const FaqModal = _IS_PROD ? dynamic(() => import("@/components/faq-modal").then(m => m.FaqModal)) : FaqModalDirect;
const PotionInventoryModal = _IS_PROD ? dynamic(() => import("@/components/potion-inventory-modal").then(m => m.PotionInventoryModal)) : PotionInventoryModalDirect;
const RunnerStatsModal = _IS_PROD ? dynamic(() => import("@/components/runner-stats-modal").then(m => m.RunnerStatsModal)) : RunnerStatsModalDirect;
import { GuardianHelpButton } from "@/components/guardian-help-modal";
import { GuardianCollectionPanel } from "@/components/guardian-collection";
import type { GuardianWithArchetype } from "@/lib/guardian";
import { VictoryDance } from "@/components/victory-dance";
import { RainbowName, isRainbowActive } from "@/components/rainbow-name";
import { DemoBadge } from "@/components/demo-badge";
// FlashPushBanner + RedeemFlow archived (pivot 2026-05-05)
import { isPremium, hasActiveBoost } from "@/lib/monetization";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { deferIdle } from "@/lib/defer";
// AppMap (Mapbox) ist ein 1.7 MB-Chunk — dynamic-import + ssr:false vermeidet,
// dass dieser Code im Initial-Bundle landet. Loading-Skeleton bleibt während
// der Map-Code geladen wird sichtbar (passt zum dunklen Map-Hintergrund).
const AppMap = dynamic(() => import("@/components/app-map").then(m => ({ default: m.AppMap })), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-[#0F1115] flex items-center justify-center text-[#8B8FA3] text-xs">Karte lädt…</div>,
});

// Modul-stabile Empty-Arrays für entfernte AppMap-Props (Loyalty-Shops archiviert).
// Default-Parameter `flashPushes = []` würden bei jedem Parent-Render ein neues
// Array erzeugen → AppMap-useEffects mit diesen Deps refeuern pro Sekunde
// (Clock-Tick) → DOM-Marker-Rebuild → Mapbox-Label-Recompute → Hausnummern-Flicker.
const EMPTY_FLASH_PUSHES: never[] = [];
const EMPTY_SHOP_TRAIL: never[] = [];
const EMPTY_SHOP_REVIEWS: never[] = [];
const EMPTY_ARENA_COUNTDOWNS: never[] = [];
const EMPTY_SHOPS: never[] = [];
import { BaseModal as BaseModalDirect } from "@/components/base-modal";
import { AttackBaseModal as AttackBaseModalDirect } from "@/components/attack-base-modal";
import { ActivePlayerBaseRallyBanner, JoinPlayerBaseRallyModal, type PlayerBaseRallyState } from "@/components/active-player-base-rally-banner";
import { StrongholdModal, ActiveRallyBanner } from "@/components/stronghold-modal";
import { GatherModal as GatherModalDirect } from "@/components/gather-modal";
import { AppSettingsContent as AppSettingsContentDirect } from "@/components/settings/app-settings-modal";
import { HealthDashboard as HealthDashboardDirect } from "@/components/health/health-dashboard";
const BaseModal = _IS_PROD ? dynamic(() => import("@/components/base-modal").then(m => m.BaseModal)) : BaseModalDirect;
const AttackBaseModal = _IS_PROD ? dynamic(() => import("@/components/attack-base-modal").then(m => m.AttackBaseModal), { loading: () => null }) : AttackBaseModalDirect;
const GatherModal = _IS_PROD ? dynamic(() => import("@/components/gather-modal").then(m => m.GatherModal), { loading: () => null }) : GatherModalDirect;
const AppSettingsContent = _IS_PROD ? dynamic(() => import("@/components/settings/app-settings-modal").then(m => m.AppSettingsContent)) : AppSettingsContentDirect;
const HealthDashboard = _IS_PROD ? dynamic(() => import("@/components/health/health-dashboard").then(m => m.HealthDashboard)) : HealthDashboardDirect;
import { ActiveMarchesBanner } from "@/components/active-marches-banner";
import { HeimatOverlay, HeimatRelocateConfirm } from "@/components/heimat/heimat-overlay";
import { CrewMemberModal } from "@/components/heimat/crew-member-modal";
import { ActiveCrewRallyBanner, type CrewRally } from "@/components/active-crew-rally-banner";
import { useRealtimeAwareInterval } from "@/lib/use-realtime-aware-interval";
import { ActiveScoutsBanner, type ActiveScout } from "@/components/active-scouts-banner";
import { LivePaceHud } from "@/components/live-pace-hud";
import { cellOf, demoShadowRoute } from "@/lib/map-features";
import { snapToRoads } from "@/lib/snap-to-roads";
import { appAlert, appConfirm } from "@/components/app-dialog";
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
  XP_PER_SEGMENT,
  XP_PER_STREET_CLAIMED,
  MIN_ROUTE_POINTS,
  UNITS,
  LANGUAGES,
  XP_PER_KM,
  XP_PER_WALK,
  XP_REWARDED_AD,
  XP_KIEZ_CHECKIN,
  ACHIEVEMENTS,
  ACHIEVEMENT_CATEGORIES,
  RUNNER_RANKS,
  DEMO_MODE,
  DEMO_STATS,
  DEMO_MAP_LIVE,
  DEMO_FACTION_STATS,
  DEMO_FACTION_RANKING,
  groupFactionsByLevel,
  type FactionCityStats,
  type FactionBucket,
  DEMO_NEARBY_CREWS_MAP,
  DEMO_RUNNERS,
  generateDemoMapData,
  generateDemoRecentRuns,
  getCurrentHappyHour,
  CREW_TYPES,
  CREW_PRIVACY_OPTIONS,
  DEMO_CREW_MEMBERS,
  DEMO_CREW_CHALLENGES,
  DEMO_CREW_EVENTS,
  DEMO_CREW_CHAT,
  DEMO_NEARBY_CREWS,
  DEMO_CREW_STATS,
  DEMO_RANKING_RUNNERS,
  getRunnerGuardian,
  groupCrewsByLevel,
  isoForCountry,
  emojiForContinent,
  LEAGUE_TIERS,
  leagueTierFor,
  nextLeagueTier,
  currentSeason,
  previousSeasonLabel,
  DEMO_LAST_SEASON_TIER_ID,
  factionPowerForCrews,
  DEMO_CREW_FEED,
  DEMO_RIVAL_DUEL,
} from "@/lib/game-config";
import type {
  DemoRunnerProfile,
  ClaimedArea,
  CrewTypeId,
  CrewPrivacy,
  NearbyCrew,
} from "@/lib/game-config";

import {
  type Profile,
  type Territory,
  type Crew,
  type TabId,
  type RankingMode,
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
  TabSkeleton,
  primaryBtnStyle,
  outlineBtnStyle,
  inputStyle,
  breadcrumbStyle,
  CountryFlag,
  LeagueBadge,
  LastSeasonBadge,
  TopThreeRanking,
  MEDALS,
  MEDAL_COLORS,
  FilterPill,
  Badge,
  ARENA_TYPE_META,
} from "./_tabs/_shared";

interface Coord { lat: number; lng: number; }

/* ═══════════════════════════════════════════════════════
 * 1:1 Farb-Konstanten aus alter App (styles.ts)
 * Color-Constants live in ./_tabs/_shared.tsx (BG_DEEP/BORDER/MUTED/etc.)
 * ═══════════════════════════════════════════════════════ */
const BG = "transparent"; // Dashboard-Gradient scheint durch
const CARD = "rgba(41, 51, 73, 0.55)";

export function MapDashboard({ profile: initialProfile }: { profile: Profile | null }) {
  const router = useRouter();
  const supabase = createClient();
  const tPre = useTranslations("Popups.PreWalk");
  const tStreak = useTranslations("Popups.StreakSave");
  const tMD = useTranslations("MapDashboard");

  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [walkSummary, setWalkSummary] = useState<WalkSummary | null>(null);
  // Cosmetic-Change-Bumper: bei jedem Equip-Event hochzählen → alle abhängigen
  // Effects (basePins, nameplateArt-Cache) re-fetchen sofort statt erst nach Reload
  const [cosmeticVersion, setCosmeticVersion] = useState(0);
  useEffect(() => {
    const onChange = () => setCosmeticVersion((v) => v + 1);
    window.addEventListener("ma365:cosmetic-changed", onChange);
    return () => window.removeEventListener("ma365:cosmetic-changed", onChange);
  }, []);
  // Bei jedem Cosmetic-Change Profile von DB neu laden (für equipped_*-IDs)
  useEffect(() => {
    if (cosmeticVersion === 0 || !profile?.id) return;
    void (async () => {
      const { data } = await supabase.from("users").select("*").eq("id", profile.id).maybeSingle();
      if (data) setProfile(data as unknown as Profile);
    })();
  }, [cosmeticVersion, profile?.id]);
  // Unified Shop-Hub: Listener auf Top-Level damit auch der Map-Tab-Quick-Access-SHOPS-Button funktioniert
  const [showShopHubGlobal, setShowShopHubGlobal] = useState(false);
  const [shopHubGlobalTab, setShopHubGlobalTab] = useState<"deals" | "plus" | "power" | "gems" | "cosmetics">("deals");
  useEffect(() => {
    const onOpen = (e: Event) => {
      const ev = e as CustomEvent<{ tab?: "deals" | "plus" | "power" | "gems" | "cosmetics" } | undefined>;
      setShopHubGlobalTab(ev.detail?.tab ?? "deals");
      setShowShopHubGlobal(true);
    };
    window.addEventListener("ma365:open-deals-shop", onOpen as EventListener);
    return () => window.removeEventListener("ma365:open-deals-shop", onOpen as EventListener);
  }, []);
  const [preWalkModal, setPreWalkModal] = useState<null | "asking" | "playing">(null);
  const [preWalkAdProgress, setPreWalkAdProgress] = useState(0);
  const [streakSaveModal, setStreakSaveModal] = useState<null | "asking" | "playing">(null);
  const [streakSaveAdProgress, setStreakSaveAdProgress] = useState(0);
  const [victoryTrigger, setVictoryTrigger] = useState(0);
  const [activeTab, setActiveTab] = useState<TabId>("map");
  const [rankingInitialMode, setRankingInitialMode] = useState<RankingMode | undefined>(undefined);
  // In-App-Routing: Mapbox-Direction zu Shop, gerendert auf der Karte
  const [routingRoute, setRoutingRoute] = useState<ActiveRoute | null>(null);
  const [equippedMarker, setEquippedMarker] = useState(initialProfile?.equipped_marker_id || "foot");
  const [equippedMarkerVariant, setEquippedMarkerVariant] = useState<"neutral" | "male" | "female">(
    ((initialProfile as unknown as { equipped_marker_variant?: "neutral"|"male"|"female" })?.equipped_marker_variant) || "neutral"
  );
  const [equippedLight, setEquippedLight] = useState(initialProfile?.equipped_light_id || "classic");
  const [pinThemeOverride, setPinThemeOverride] = useState<import("@/lib/pin-themes").PinTheme | null>(null);
  const [rootRunnerProfileUserId, setRootRunnerProfileUserId] = useState<string | null>(null);

  // Klick auf Runner-Badge im Map-Marker oeffnet Runner-Profil-Modal (Map-Tab).
  // Listener MUESSEN auf Root-Level sein, weil der ProfilTab nicht gemountet ist
  // ── In-App-Routing: Shop ruft `ma365:start-route` mit { shopId, name, lat, lng } ──
  // Wir holen die Wanderroute via /api/route (Mapbox Directions) und rendern
  // sie auf der Karte. Bei Ankunft (Distanz <30m) auto-cancel + Toast.
  useEffect(() => {
    if (typeof window === "undefined") return;
    async function handler(ev: Event) {
      const detail = (ev as CustomEvent).detail as
        | { shopId: string; name: string; lat: number; lng: number }
        | undefined;
      if (!detail) return;
      // Aktuelle GPS-Position holen — fallback auf last-known im AppMap-State
      const userPos = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 },
        );
      });
      if (!userPos) {
        alert("Kein GPS-Signal — Standort kann nicht bestimmt werden.");
        return;
      }
      try {
        const r = await fetch(
          `/api/route?from=${userPos.lat},${userPos.lng}&to=${detail.lat},${detail.lng}`,
        );
        const j = await r.json() as
          | { ok: true; geometry: { type: "LineString"; coordinates: [number, number][] }; distance_m: number; duration_s: number }
          | { ok: false; error: string };
        if (!j.ok) {
          alert(tMD("routeLoadFailed", { error: String(j.error) }));
          return;
        }
        setRoutingRoute({
          shopId: detail.shopId,
          shopName: detail.name,
          destLat: detail.lat,
          destLng: detail.lng,
          geometry: j.geometry,
          distanceM: j.distance_m,
          durationS: j.duration_s,
        });
        // Auf Map-Tab wechseln, damit User die Route sieht
        setActiveTab("map");
      } catch {
        alert(tMD("routeLoadFailedShort"));
      }
    }
    window.addEventListener("ma365:start-route", handler as EventListener);
    return () => window.removeEventListener("ma365:start-route", handler as EventListener);
  }, []);

  // waehrend man auf der Karte ist.
  useEffect(() => {
    const uid = initialProfile?.id ?? null;
    const open = () => { if (uid) setRootRunnerProfileUserId(uid); };
    const onOpen = () => open();
    const onDocClick = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest('[data-action="open-runner-profile"]')) {
        e.preventDefault();
        e.stopPropagation();
        open();
      }
    };
    window.addEventListener("ma365:open-runner-profile", onOpen);
    document.addEventListener("click", onDocClick, true);
    document.addEventListener("pointerdown", onDocClick, true);
    document.addEventListener("touchend", onDocClick, true);
    return () => {
      window.removeEventListener("ma365:open-runner-profile", onOpen);
      document.removeEventListener("click", onDocClick, true);
      document.removeEventListener("pointerdown", onDocClick, true);
      document.removeEventListener("touchend", onDocClick, true);
    };
  }, [initialProfile?.id]);
  const [recentRuns, setRecentRuns] = useState<Territory[]>([]);

  // Walk state
  const [walking, setWalking] = useState(false);
  const wakeLock = useWakeLock(walking);
  const [screenLocked, setScreenLocked] = useState(false);
  const [wakeHintDismissed, setWakeHintDismissed] = useState(false);
  const [distance, setDistance] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [currentStreet, setCurrentStreet] = useState<string | null>(null);
  // ── activeRoute mit sessionStorage-Persistenz ──
  // Damit die Walk-Linie bei Tab-Wechsel + Reload nicht verloren geht.
  const ROUTE_STORAGE_KEY = "ma365.activeRoute.v1";
  const [activeRoute, setActiveRoute] = useState<Coord[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = sessionStorage.getItem(ROUTE_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as { route: Coord[]; ts: number };
      // Stale-Schutz: nur Routen aus den letzten 6 h wiederherstellen
      if (!parsed?.route || Date.now() - (parsed.ts ?? 0) > 6 * 3600_000) return [];
      return parsed.route;
    } catch { return []; }
  });
  // Persist bei jeder Änderung (außer leer → komplett löschen)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (activeRoute.length === 0) sessionStorage.removeItem(ROUTE_STORAGE_KEY);
      else sessionStorage.setItem(ROUTE_STORAGE_KEY, JSON.stringify({ route: activeRoute, ts: Date.now() }));
    } catch { /* quota */ }
  }, [activeRoute]);
  const [savedTerritories, setSavedTerritories] = useState<Coord[][]>([]);
  const [territoryCount, setTerritoryCount] = useState(0);
  const [viewingRunner, setViewingRunner] = useState<string | null>(null);
  const [viewingArea, setViewingArea] = useState<string | null>(null);
  const [overviewMode, setOverviewMode] = useState(false);
  const [missionsOpen, setMissionsOpen] = useState(false);
  const [controlsExpanded, setControlsExpanded] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  // Profil-Modal (öffnet die ProfilTab-Inhalte als Overlay über der Karte,
  // ohne aus dem Map-Tab zu wechseln). Aktiviert vom Quickaccess-Profil-Button.
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const [lightPreset, setLightPreset] = useState<"auto" | "dawn" | "day" | "dusk" | "night">("auto");

  // Live-Pace-HUD: XP und Streak live mitlaufen lassen
  const [liveXpGained, setLiveXpGained] = useState(0);
  const [walkStartTime, setWalkStartTime] = useState(0);
  const [liveStreak, setLiveStreak] = useState(0);
  // Map-Features (Power-Zones, Boss, Sanctuary, Fog)
  // Loyalty/Shop-Layer (flash_pushes, shop_reviews, shop_trail) archived 2026-05-05.
  const [mapFeatures, setMapFeatures] = useState<{
    power_zones: Array<{ id: string; name: string; kind: string; center_lat: number; center_lng: number; radius_m: number; color: string; buff_hp: number; buff_atk: number; buff_def: number; buff_spd: number }>;
    boss_raids: Array<{ id: string; name: string; emoji: string; lat: number; lng: number; max_hp: number; current_hp: number }>;
    sanctuaries: Array<{ id: string; name: string; lat: number; lng: number; emoji: string; xp_reward: number; trained_today?: boolean }>;
    explored_cells: Array<{ cell_x: number; cell_y: number }>;
  } | null>(null);
  const [lorePieces, setLorePieces] = useState<Array<{ piece_id: string; lat: number; lng: number; name: string; set_name?: string }>>([]);
  const [mapGemShopOpen, setMapGemShopOpen] = useState(false);
  const [viewingBoss, setViewingBoss] = useState<string | null>(null);
  const [viewingSanctuary, setViewingSanctuary] = useState<string | null>(null);
  const [viewingPowerZone, setViewingPowerZone] = useState<string | null>(null);
  const [shadowEnabled, setShadowEnabled] = useState(false);

  // 3-Ebenen-Modell: DB-geladene Layer fuer Karte
  // mapLayersVersion wird nach Walk-Save inkrementiert, damit der Loader re-fetcht.
  const [mapLayersVersion, setMapLayersVersion] = useState(0);
  const [walkedSegments, setWalkedSegments] = useState<Array<{ id: string; geom: Array<{ lat: number; lng: number }>; is_mine: boolean; is_crew: boolean }>>([]);
  const [claimedStreets, setClaimedStreets] = useState<Array<{ id: string; geoms: Array<Array<{ lat: number; lng: number }>>; is_mine: boolean; is_crew: boolean; intensity: number }>>([]);
  const [ownedTerritories, setOwnedTerritories] = useState<Array<{ id: string; polygon: Array<{ lat: number; lng: number }>; is_mine: boolean; is_crew: boolean; status: string; intensity: number }>>([]);
  const [ownershipQuery, setOwnershipQuery] = useState<{ type: "segment" | "street" | "territory"; id: string } | null>(null);

  // Crew
  const [myCrew, setMyCrew] = useState<Crew | null>(null);
  const [leaderboard, setLeaderboard] = useState<Profile[]>([]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup auf Unmount — verhindert Timer-Leak wenn User die App schließt oder
  // das Dashboard unmountet während ein Walk läuft.
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);
  const lastPosRef = useRef<Coord | null>(null);
  const lastPosTimeRef = useRef<number>(0);
  const speedViolationRef = useRef<number>(0);
  const [speedWarning, setSpeedWarning] = useState(false);
  const lastGeoRef = useRef<number>(0);

  // Walks/Runs archiviert (Phase-4-Pivot) — recentRuns bleibt leer bis March-System ersetzt

  // 3-Ebenen-Layer laden (eigene + Crew-eigene + gestohlene fremde)
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    const myCrewId = profile.current_crew_id ?? null;
    (async () => {
      const [segsRes, streetsRes, terrsRes] = await Promise.all([
        supabase.from("street_segments").select("id, user_id, crew_id, street_name, geom").limit(2000),
        supabase.from("streets_claimed").select("id, user_id, crew_id, street_name, last_painted_at"),
        supabase.from("territory_polygons").select("id, owner_user_id, owner_crew_id, claimed_by_user_id, polygon, status, last_painted_at").in("status", ["active", "pending_crew"]),
      ]);
      if (cancelled) return;

      type SegRow = { id: string; user_id: string; crew_id: string | null; street_name: string | null; geom: Array<{ lat: number; lng: number }> };
      const allSegs = (segsRes.data ?? []) as SegRow[];

      setWalkedSegments(
        allSegs.map((s) => ({
          id: s.id,
          geom: s.geom,
          is_mine: s.user_id === profile.id,
          is_crew: !!(myCrewId && s.crew_id === myCrewId),
        })),
      );

      if (streetsRes.data) {
        // Segmente per (user_id, street_name) buendeln damit Straßenzuege MultiLineString bekommen
        const byKey = new Map<string, Array<Array<{ lat: number; lng: number }>>>();
        for (const s of allSegs) {
          if (!s.street_name) continue;
          const k = `${s.user_id}|${s.street_name}`;
          const arr = byKey.get(k) ?? [];
          arr.push(s.geom);
          byKey.set(k, arr);
        }
        setClaimedStreets(
          (streetsRes.data as Array<{ id: string; user_id: string; crew_id: string | null; street_name: string; last_painted_at: string | null }>).map((row) => ({
            id: row.id,
            geoms: byKey.get(`${row.user_id}|${row.street_name}`) ?? [],
            is_mine: row.user_id === profile.id,
            is_crew: !!(myCrewId && row.crew_id === myCrewId),
            intensity: claimIntensity(row.last_painted_at),
          })),
        );
      }
      if (terrsRes.data) {
        setOwnedTerritories(
          (terrsRes.data as Array<{ id: string; owner_user_id: string | null; owner_crew_id: string | null; claimed_by_user_id: string | null; polygon: Array<{ lat: number; lng: number }>; status: string; last_painted_at: string | null }>).map((t) => ({
            id: t.id,
            polygon: t.polygon,
            // pending_crew: claimed_by_user_id gehört dem User, owner_user_id ist null → trotzdem als "is_mine" markieren
            is_mine: t.owner_user_id === profile.id || (t.status === "pending_crew" && t.claimed_by_user_id === profile.id),
            is_crew: !!(myCrewId && t.owner_crew_id === myCrewId),
            status: t.status,
            intensity: claimIntensity(t.last_painted_at),
          })),
        );
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.id, profile?.current_crew_id, supabase, mapLayersVersion]);

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
      } else if (["admin", "super_admin"].includes((profile as Profile & { role?: string }).role ?? "user")) {
        // Admin-Accounts starten automatisch mit Demo-Crew für Verwaltungs-Tests
        setMyCrew({
          id: "demo-crew-kaelthor",
          name: "Kaelthors Kiez-Crew",
          zip: "13435",
          color: "#22D1C3",
          owner_id: profile.id,
          faction: profile.faction || "syndicate",
          invite_code: "KAEL-DEMO",
          member_count: 6,
        });
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

  // Live-XP-Tick waehrend Walk (50m = 10 XP approximation)
  useEffect(() => {
    if (!walking) return;
    setLiveXpGained(Math.floor(distance / 5));
  }, [distance, walking]);

  // Map-Features laden (Power-Zones, Boss, Sanctuary, Flash-Push, Trail, Reviews, explored-Cells)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/map-features", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setMapFeatures(data);
      } catch { /* network */ }
    };
    load();
    const int = setInterval(load, 60_000);  // alle 60s
    return () => { cancelled = true; clearInterval(int); };
  }, []);

  // Cell-Tracking waehrend Walks: jedes neue Route-Segment -> cell markieren
  const sentCellsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!walking || activeRoute.length === 0) return;
    const last = activeRoute[activeRoute.length - 1];
    const c = cellOf(last.lat, last.lng);
    const key = `${c.x}:${c.y}`;
    if (sentCellsRef.current.has(key)) return;
    sentCellsRef.current.add(key);
    if (sentCellsRef.current.size % 5 === 0) {
      const cells = Array.from(sentCellsRef.current).map((k) => {
        const [x, y] = k.split(":").map(Number);
        return { x, y };
      });
      fetch("/api/map-features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_cells", cells }),
      }).catch(() => {});
    }
  }, [activeRoute, walking]);

  const startWalk = () => {
    setWalking(true);
    setElapsed(0);
    setDistance(0);
    setLiveXpGained(0);
    setWalkStartTime(Date.now());
    setCurrentStreet("Suche Position...");
    setActiveRoute([]);
    lastPosRef.current = null;
    lastPosTimeRef.current = 0;
    speedViolationRef.current = 0;
    setSpeedWarning(false);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  };

  // Pre-Walk: optional Video-Bonus anbieten bevor startWalk() läuft.
  const handleStartClick = async () => {
    if (!profile) return startWalk();
    // MyArea+ Supporter: kein Werbe-Prompt, direkt los
    if ((profile as unknown as { supporter_tier?: string }).supporter_tier) return startWalk();
    try {
      const cutoff = new Date(Date.now() - 360 * 60 * 1000).toISOString(); // 6 h cooldown
      const { data } = await supabase.from("ad_views")
        .select("id")
        .eq("user_id", profile.id)
        .eq("placement", "pre_walk")
        .eq("completed", true)
        .gte("created_at", cutoff)
        .limit(1);
      if (data && data.length > 0) {
        // Cooldown aktiv → direkt starten, kein Modal
        return startWalk();
      }
    } catch { /* fail-open: bei Fehler direkt starten */ }
    setPreWalkModal("asking");
  };

  const playPreWalkAd = () => {
    setPreWalkModal("playing");
    setPreWalkAdProgress(0);
    const tick = 100;
    const total = 30_000;
    const int = setInterval(() => {
      setPreWalkAdProgress((p) => {
        const next = p + (tick / total) * 100;
        if (next >= 100) {
          clearInterval(int);
          void finishPreWalkAd();
          return 100;
        }
        return next;
      });
    }, tick);
  };

  const finishPreWalkAd = async () => {
    if (!profile) return;
    try {
      const xp = 250; // AD_REWARDS.pre_walk.xp
      await supabase.from("ad_views").insert({
        user_id: profile.id, placement: "pre_walk", xp_awarded: xp, completed: true,
      });
      const { data: u } = await supabase.from("users").select("wegemuenzen, xp").eq("id", profile.id).single();
      const cur = (u?.wegemuenzen ?? u?.xp ?? 0) as number;
      await supabase.from("users").update({ wegemuenzen: cur + xp, xp: cur + xp }).eq("id", profile.id);
      setProfile({ ...profile, wegemuenzen: cur + xp, xp: cur + xp });
      appAlert(tPre("claimedAlert"));
    } catch { /* noop */ }
    setPreWalkModal(null);
    startWalk();
  };

  const skipPreWalkAd = () => {
    setPreWalkModal(null);
    startWalk();
  };

  // Streak-Save: Beim Laden prüfen ob Streak gefährdet ist und Popup anbieten
  useEffect(() => {
    if (!profile?.id) return;
    if ((profile.streak_days ?? 0) <= 0) return;
    return deferIdle(() => void (async () => {
      try {
        const { data: u } = await supabase.from("users")
          .select("last_walk_at, streak_freezes_remaining")
          .eq("id", profile.id)
          .single<{ last_walk_at: string | null; streak_freezes_remaining: number | null }>();
        if (!u?.last_walk_at) return;
        const hoursSinceWalk = (Date.now() - new Date(u.last_walk_at).getTime()) / 3600000;
        // Fenster: 18-36 h — Streak läuft demnächst aus, aber noch nicht gebrochen
        if (hoursSinceWalk < 18 || hoursSinceWalk > 36) return;
        // Cooldown prüfen: letzter Streak-Save max 12 h her
        const cutoff = new Date(Date.now() - 12 * 3600000).toISOString();
        const { data: recent } = await supabase.from("ad_views")
          .select("id")
          .eq("user_id", profile.id)
          .eq("placement", "streak_save")
          .eq("completed", true)
          .gte("created_at", cutoff)
          .limit(1);
        if (recent && recent.length > 0) return;
        setStreakSaveModal("asking");
      } catch { /* noop */ }
    })());
  }, [profile?.id, profile?.streak_days, supabase]);

  const playStreakSaveAd = () => {
    setStreakSaveModal("playing");
    setStreakSaveAdProgress(0);
    const tick = 100;
    const total = 30_000;
    const int = setInterval(() => {
      setStreakSaveAdProgress((p) => {
        const next = p + (tick / total) * 100;
        if (next >= 100) {
          clearInterval(int);
          void finishStreakSaveAd();
          return 100;
        }
        return next;
      });
    }, tick);
  };

  const finishStreakSaveAd = async () => {
    if (!profile) return;
    try {
      // last_walk_at auf now() setzen → Streak-Fenster verlängert sich
      await supabase.from("users").update({ last_walk_at: new Date().toISOString() }).eq("id", profile.id);
      await supabase.from("ad_views").insert({
        user_id: profile.id, placement: "streak_save", xp_awarded: 0, completed: true,
      });
      appAlert(tMD("streakSaved", { days: profile.streak_days ?? 0 }));
    } catch { /* noop */ }
    setStreakSaveModal(null);
  };

  const skipStreakSaveAd = () => {
    setStreakSaveModal(null);
  };

  const stopWalk = async () => {
    setWalking(false);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;

    if (activeRoute.length < MIN_ROUTE_POINTS) {
      appAlert(tMD("tooShort"));
      setActiveRoute([]);
      setCurrentStreet(null);
      return;
    }

    // Snap-to-Roads: GPS-Trace auf tatsächliche Straßen/Gehwege ausrichten.
    // Fallback auf rohe GPS-Daten wenn Service nicht verfügbar.
    setSnapping(true);
    const snapped = await snapToRoads(activeRoute);
    setSnapping(false);

    const finalRoute = snapped?.path ?? activeRoute;
    const finalDistance = snapped?.distance_m ?? Math.round(distance);
    const finalDuration = snapped?.duration_s ?? elapsed;
    // Straßenname: immer aus Live-GPS (currentStreet), nicht aus Snap-Ergebnis —
    // Snap-to-Roads matcht zu oft die falsche Straße.
    const finalStreet = currentStreet ?? snapped?.streets[0] ?? null;

    if (profile) {
      const km = finalDistance / 1000;
      const kmXp = Math.round(XP_PER_KM * km);

      // 1) Walk-Row zuerst anlegen, damit wir walk_id haben
      const { data: walkRow, error: walkErr } = await supabase.from("territories").insert({
        user_id: profile.id,
        crew_id: profile.current_crew_id,
        street_name: finalStreet,
        route: finalRoute,
        distance_m: Math.round(finalDistance),
        duration_s: Math.round(finalDuration),
        xp_earned: 0, // wird unten mit echtem Wert ueberschrieben
      }).select("id").single<{ id: string }>();

      if (walkErr || !walkRow) {
        appAlert(tMD("saveFailed"));
        setActiveRoute([]);
        setCurrentStreet(null);
        return;
      }

      // 2) Segment/Strassenzug/Polygon-Detection serverseitig
      type SegmentsResp = {
        total_new: number;
        total_length_m: number;
        newly_claimed_streets: Array<{ street_name: string; segments_count: number; total_length_m: number }>;
        new_territory: { id: string; area_m2: number } | null;
        new_territories?: Array<{ id: string; area_m2: number; stole_from: boolean; pending_crew?: boolean }>;
        reclaim?: { reclaim_count: number; reclaim_xp: number; segments_cooldown: number } | null;
      };
      let segResp: SegmentsResp = { total_new: 0, total_length_m: 0, newly_claimed_streets: [], new_territory: null, new_territories: [] };
      try {
        const res = await fetch("/api/walk/segments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trace: finalRoute, walk_id: walkRow.id }),
        });
        if (res.ok) segResp = await res.json() as SegmentsResp;
      } catch {}

      // 3) Base-XP aus 3-Ebenen-Modell (V2: ggf. mehrere Gebiete in einem Walk)
      const territoryCountNew = (segResp.new_territories?.length ?? (segResp.new_territory ? 1 : 0));
      const segmentsXp = segResp.total_new * XP_PER_SEGMENT;
      const streetsXp = segResp.newly_claimed_streets.length * XP_PER_STREET_CLAIMED;
      const territoryXp = territoryCountNew * XP_PER_TERRITORY;
      let baseXp = segmentsXp + streetsXp + territoryXp + kmXp + XP_PER_WALK;
      let doubleClaimBonus = 0;

      // Doppel-Claim-Charge verdoppelt das Gebiet-XP (V1)
      const doubleClaimCharges = (profile as unknown as { double_claim_charges?: number }).double_claim_charges ?? 0;
      if (doubleClaimCharges > 0 && territoryXp > 0) {
        baseXp += territoryXp;
        doubleClaimBonus = territoryXp;
        await supabase.from("users").update({ double_claim_charges: doubleClaimCharges - 1 }).eq("id", profile.id);
      }

      const { computeAndApplyWalkBonuses } = await import("@/lib/walk-bonuses");
      const bonuses = await computeAndApplyWalkBonuses(
        supabase,
        profile.id,
        baseXp,
        Math.round(finalDistance),
        (profile.total_walks || 0) + 1,
      );

      // Pfadfinder-Crew-Fraktion: +10% Lauf-XP
      let totalXpGained = bonuses.finalXp + bonuses.achievementXp;
      if (myCrew && (myCrew as { crew_faction?: string }).crew_faction === "pfadfinder") {
        totalXpGained = Math.round(totalXpGained * 1.10);
      }

      // Fraktions-Buff: Gossenbund bekommt +25 % auf neue Claims + 50 pro Feind-Übermalung.
      // Kronenwacht-Buff wirkt passiv über claim_intensity_v2 / prune_expired_claims (keine XP hier).
      let factionClaimBonus = 0;
      try {
        const baseClaimXp = segmentsXp + streetsXp + territoryXp;
        if (baseClaimXp > 0) {
          const repaintedStreetNames = segResp.newly_claimed_streets.map((s) => s.street_name);
          const { data: enemyCount } = await supabase.rpc("count_enemy_repaints", {
            p_user_id: profile.id,
            p_street_names: repaintedStreetNames,
          });
          const { data: bonus } = await supabase.rpc("faction_claim_bonus", {
            p_user_id: profile.id,
            p_base_claim_xp: baseClaimXp,
            p_enemy_repaints: Number(enemyCount ?? 0),
          });
          factionClaimBonus = Number(bonus ?? 0);
          if (factionClaimBonus > 0) {
            totalXpGained += factionClaimBonus;
          }
        }
      } catch (e) {
        console.warn("[walk-save] faction_claim_bonus failed", e);
      }

      // 4) Walk-Row aktualisieren mit echten Werten
      const { error } = await supabase.from("territories").update({
        xp_earned: totalXpGained,
        segments_claimed: segResp.total_new,
        streets_claimed: segResp.newly_claimed_streets.length,
        polygons_claimed: territoryCountNew,
      }).eq("id", walkRow.id);

      if (error) {
        console.error("[walk-save] territories.update failed", error);
      }

      // Lokale State-Updates + Summary sollen IMMER laufen — ein fehlschlagender
      // DB-Update (z. B. RLS-Policy-Problem) darf dem User nicht die Zusammenfassung
      // und den Milestone-Check klauen. Server-Daten werden beim nächsten Reload
      // korrekt geladen.
      const newXp = (profile.wegemuenzen ?? profile.xp ?? 0) + totalXpGained;
      const newDistance = (profile.total_distance_m || 0) + Math.round(finalDistance);
      const newWalks = (profile.total_walks || 0) + 1;
      const newCal = (profile.total_calories || 0) + Math.round(finalDistance * 0.06);
      const newLongest = Math.max(profile.longest_run_m || 0, Math.round(finalDistance));

      // Dual-Write: wegemuenzen ist die neue Currency (Migration 00046),
      // xp bleibt als Legacy-Spalte bestehen. Falls die Migration noch nicht
      // gelaufen ist, versuchen wir es auf xp alleine.
      const { error: updErr } = await supabase.from("users").update({
        wegemuenzen: newXp,
        xp: newXp,
        total_distance_m: newDistance,
        total_walks: newWalks,
        total_calories: newCal,
        longest_run_m: newLongest,
      }).eq("id", profile.id);

      if (updErr) {
        console.error("[walk-save] users.update failed, fallback to xp-only", updErr);
        await supabase.from("users").update({
          xp: newXp,
          total_distance_m: newDistance,
          total_walks: newWalks,
          total_calories: newCal,
          longest_run_m: newLongest,
        }).eq("id", profile.id);
      }

      setProfile({
        ...profile,
        wegemuenzen: newXp,
        xp: newXp,
        total_distance_m: newDistance,
        total_walks: newWalks,
        total_calories: newCal,
        longest_run_m: newLongest,
      });
      setSavedTerritories((prev) => [...prev, finalRoute]);
      if (territoryCountNew > 0) setTerritoryCount((c) => c + territoryCountNew);
      // Map-Layer neu laden: /api/walk/segments hat serverseitig street_segments
      // + streets_claimed + territory_polygons geschrieben — ohne Refetch würden
      // diese bis zum nächsten Reload nicht auf der Lifemap erscheinen.
      setMapLayersVersion((v) => v + 1);

      // Km-Meilenstein-Check (10/50/100 km gesamt) -> gibt Beschwoerungssteine
      try {
        const ms = await fetch("/api/guardian/collection", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "check_milestones", total_km: newDistance / 1000 }),
        });
        if (ms.ok) {
          const data = await ms.json();
          if (data.new_stones > 0) {
            const unlocks = (data.new_unlocks as number[]).join(", ");
            appAlert(tMD("milestoneReached", { km: unlocks, stones: data.new_stones }));
          }
        }
      } catch { /* non-blocking */ }

      // Victory-Dance triggern (nur bei echtem Gebiet)
      if (territoryCountNew > 0 && (profile as unknown as { victory_dance_enabled?: boolean }).victory_dance_enabled) {
        setVictoryTrigger((v) => v + 1);
      }

      {
        const stoleCount = (segResp.new_territories ?? []).filter((t) => t.stole_from).length;
        const pendingCount = (segResp.new_territories ?? []).filter((t) => t.pending_crew).length;

        setWalkSummary({
          distance_m: Math.round(finalDistance),
          duration_s: Math.round(finalDuration),
          xp_earned: bonuses.finalXp,
          streets: finalStreet ? [finalStreet] : (snapped?.streets ?? []),
          segment_count: segResp.total_new,
          street_count: segResp.newly_claimed_streets.length,
          territory_count: territoryCountNew,
          stolen_count: stoleCount,
          pending_territory_count: pendingCount,
          reclaim: segResp.reclaim ?? null,
          bonuses: {
            streakBonus: bonuses.streakBonus,
            happyHourMult: bonuses.happyHourMult,
            boostMult: bonuses.boostMult,
            crewBoostMult: bonuses.crewBoostMult,
          },
          newAchievements: bonuses.newAchievements,
          achievementXp: bonuses.achievementXp,
          breakdown: {
            walkBase: XP_PER_WALK,
            kmXp,
            segmentsXp,
            streetsXp,
            territoryXp,
            doubleClaimBonus,
            factionClaimBonus,
          },
        });
      }
    }
    // activeRoute bewusst NICHT leeren — Walk-Line bleibt als fertiger Pfad
    // bis der naechste Walk startet (setActiveRoute([]) im startWalk).
    setCurrentStreet(null);
    // Heatmap-Coverage könnte sich um neue Kieze erweitert haben → Pill triggern
    try { window.dispatchEvent(new CustomEvent("ma365:coverage-changed")); } catch { /* ignore */ }
  };

  const clearMap = async () => {
    if (!(await appConfirm({ message: tMD("clearMapConfirm"), danger: true, confirmLabel: tMD("clearMapConfirmButton") }))) return;
    setSavedTerritories([]);
    setActiveRoute([]);
  };

  const [userCenter, setUserCenter] = useState<{ lat: number; lng: number } | null>(null);

  // Lore-Pieces laden — API stellt Spawn-Coords pro User sicher (in dessen Stadt um Base/letzte Walk-Position).
  useEffect(() => {
    let cancelled = false;
    const cancelIdle = deferIdle(() => void (async () => {
      const r = await fetch("/api/runner/lore");
      if (!r.ok) return;
      const j = await r.json() as {
        spawns?: Array<{ piece_id: string; lat: number; lng: number }>;
        pieces?: Array<{ id: string; name: string; set_id: string }>;
        sets?: Array<{ id: string; name: string }>;
        found?: Array<{ piece_id: string }>;
      };
      if (cancelled) return;
      const foundIds = new Set((j.found ?? []).map((f) => f.piece_id));
      const pieceMeta = new Map((j.pieces ?? []).map((p) => [p.id, p]));
      const setNames = new Map((j.sets ?? []).map((s) => [s.id, s.name]));
      setLorePieces((j.spawns ?? [])
        .filter((s) => !foundIds.has(s.piece_id))
        .map((s) => {
          const p = pieceMeta.get(s.piece_id);
          return { piece_id: s.piece_id, lat: s.lat, lng: s.lng, name: p?.name ?? s.piece_id, set_name: p ? setNames.get(p.set_id) : undefined };
        }));
    })());
    return () => { cancelled = true; cancelIdle(); };
  }, [userCenter?.lat]);

  const onLocationUpdate = useCallback(
    (lng: number, lat: number) => {
      // Demo-Daten nur EINMAL beim allerersten GPS-Fix um die User-Position verankern.
      // Danach bleiben Runner, Drops und Gebiete an den gesetzten lat/lng fest,
      // damit sie beim Zoom/Walk nicht mit wandern.
      setUserCenter((prev) => prev ?? { lat, lng });

      if (!walking) return;
      const now = Date.now();

      if (lastPosRef.current) {
        const d = haversine(lastPosRef.current.lat, lastPosRef.current.lng, lat, lng);
        if (d > 3) {
          // Anti-Cheat: Segment-Speed prüfen (kein Fahrrad/Roller/Auto-Farming)
          // Max plausibel: ~25 km/h (6.94 m/s) — schnelle Läufer ok, Fahrrad+ raus
          const dt = lastPosTimeRef.current > 0 ? (now - lastPosTimeRef.current) / 1000 : 0;
          const speed = dt > 0 ? d / dt : 0; // m/s
          const MAX_SPEED = 6.94; // 25 km/h
          if (speed > MAX_SPEED) {
            speedViolationRef.current += 1;
            // Segment verwerfen (keine Distanz, keine Route), nur Position updaten
            lastPosRef.current = { lat, lng };
            lastPosTimeRef.current = now;
            if (speedViolationRef.current >= 3) setSpeedWarning(true);
            return;
          }
          if (speedViolationRef.current > 0) setSpeedWarning(false);
          speedViolationRef.current = 0;
          setDistance((prev) => prev + d);
          setActiveRoute((prev) => [...prev, { lat, lng }]);
          lastPosRef.current = { lat, lng };
          lastPosTimeRef.current = now;
        }
      } else {
        // lastPosRef leer (z. B. nach Reload mitten im Walk) → neuen Punkt anhängen
        // statt Route komplett zu überschreiben, damit wiederhergestellte Route erhalten bleibt
        setActiveRoute((prev) => prev.length === 0 ? [{ lat, lng }] : [...prev, { lat, lng }]);
        lastPosRef.current = { lat, lng };
        lastPosTimeRef.current = now;
      }

      if (now - lastGeoRef.current > 5000) {
        lastGeoRef.current = now;
        reverseGeocode(lat, lng).then(setCurrentStreet);
      }
    },
    [walking]
  );

  // Demo-Daten um User-Position (fällt auf Berlin-Prenzlauer Berg zurück falls keine Pos)
  const demoMap = useMemo(
    () => generateDemoMapData(userCenter || { lat: 52.5400, lng: 13.4100 }),
    [userCenter],
  );

  // local-businesses (Café Kaelthor / Loyalty-Shops) archived 2026-05-05 —
  // Pivot weg von Shop-Layer: keine Demo-Shops, kein Geocoding, kein
  // ShopDetailModal mehr auf der Map.

  // ── Base-System: Pins auf der Karte + Click-Modal ──
  type BasePin = { kind: "runner" | "crew"; id: string; owner_user_id?: string; owner_username?: string | null; lat: number; lng: number; level: number; pin_emoji: string; pin_color: string; pin_label: string; crew_tag?: string | null; is_own: boolean; theme_id?: string; theme_rarity?: "advanced" | "epic" | "legendary"; nameplate_art?: { image_url: string | null; video_url: string | null } | null; base_ring_id?: string | null; base_ring_art?: { image_url: string | null; video_url: string | null } | null };
  const [basePins, setBasePins] = useState<BasePin[]>([]);
  const [mapCrewModalOpen, setMapCrewModalOpen] = useState(false);
  const [inboxModalOpen, setInboxModalOpen] = useState(false);
  const [inboxUnreadCount, setInboxUnreadCount] = useState(0);
  // Unread-Counts laden + Realtime-Update bei neuen Inbox-Einträgen
  useEffect(() => {
    const refresh = async () => {
      try {
        const r = await fetch("/api/inbox/counts", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json() as { counts?: Record<string, { unread?: number }> };
        // Counts ist nach Kategorie gruppiert (personal/report/crew/event/system) — alle unread aufsummieren.
        const total = Object.values(j.counts ?? {}).reduce((sum, c) => sum + (c?.unread ?? 0), 0);
        setInboxUnreadCount(total);
      } catch { /* silent */ }
    };
    const cancelIdle = deferIdle(() => { void refresh(); });
    // Bei Modal-Close neu laden (User hat ggf. Mails gelesen)
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    // Realtime: bei neuen Inbox-Einträgen direkt aktualisieren
    const sb = createClient();
    const channel = sb
      .channel("ma365-inbox-counts-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_inbox" }, () => { void refresh(); })
      .subscribe();
    // Fallback-Poll
    const id = setInterval(refresh, 60_000);
    return () => {
      cancelIdle();
      window.removeEventListener("focus", onFocus);
      clearInterval(id);
      void sb.removeChannel(channel);
    };
  }, [inboxModalOpen]);
  const [rankingModalOpen, setRankingModalOpen] = useState(false);
  const [ownBaseId, setOwnBaseId] = useState<string | null>(null);
  const [ownBaseHasPos, setOwnBaseHasPos] = useState<boolean>(false);
  const [ownBasePos, setOwnBasePos] = useState<{ lat: number; lng: number } | null>(null);
  const [ownBaseThemeId, setOwnBaseThemeId] = useState<string | null>(null);
  const [baseModalTarget, setBaseModalTarget] = useState<{ kind: "runner" | "crew"; id: string; is_own: boolean } | null>(null);
  const [attackTarget, setAttackTarget] = useState<{ defenderUserId: string; x: number; y: number } | null>(null);
  const [pbRally, setPbRally] = useState<PlayerBaseRallyState | null>(null);

  // ── Crew-Turf: Repeater + Polygon-State ──────────────────────
  type Repeater = {
    id: string; crew_id: string; crew_name: string | null; crew_tag: string | null;
    kind: "hq" | "repeater" | "mega"; label: string | null; lat: number; lng: number;
    hp: number; max_hp: number; is_own: boolean;
    territory_color?: string | null;
    turf_radius_m?: number | null;
    shield_until?: string | null;
  };
  type TurfPoly = { crew_id: string; crew_name: string | null; crew_tag: string | null; is_own: boolean; territory_color?: string | null; geojson: GeoJSON.Geometry };
  type CrewBlock = { block_id?: number; crew_id: string; crew_name: string | null; is_own: boolean; is_contested: boolean; territory_color: string; geojson: GeoJSON.Geometry };
  type CrewBuilding = { id: string; crew_id: string; crew_name: string | null; crew_tag: string | null; kind: "blackmarket" | "bunker" | "hangout" | "tunnel"; level: number; label: string | null; lat: number; lng: number; hp: number; max_hp: number; kind_data: Record<string, unknown>; is_own: boolean; territory_color: string };
  const [crewRepeaters, setCrewRepeaters] = useState<Repeater[]>([]);
  const [crewTurfPolygons, setCrewTurfPolygons] = useState<TurfPoly[]>([]);
  const [crewBlocks, setCrewBlocks] = useState<CrewBlock[]>([]);
  const [crewBuildings, setCrewBuildings] = useState<CrewBuilding[]>([]);
  const [placeRepeaterAt, setPlaceRepeaterAt] = useState<{ lat: number; lng: number } | null>(null);
  // Placement-Mode: User wählt Repeater-Typ → Map zeigt Coverage-Preview & Ghost-Kreise
  // existierender Repeater. Tap auf Karte öffnet PlaceRepeaterModal an Cursor-Position.
  const [repeaterPlaceMode, setRepeaterPlaceMode] = useState<null | { kind: "hq" | "repeater" | "mega" }>(null);
  // ── Heimat-Karte CoD-UX (Tap-Action-Menu, Verlegen, Multi-Aufgebot, Hide) ──
  const [heimatTapPos, setHeimatTapPos] = useState<null | { lat: number; lng: number; screenX: number; screenY: number }>(null);
  const [heimatTapDefender, setHeimatTapDefender] = useState<null | { id: string; name: string }>(null);
  const [heimatRelocateMode, setHeimatRelocateMode] = useState(false);
  const [heimatRelocateTarget, setHeimatRelocateTarget] = useState<null | { lat: number; lng: number }>(null);
  const [crewMemberTarget, setCrewMemberTarget] = useState<null | { userId: string; x: number; y: number }>(null);
  const [heimatCrewMarkers, setHeimatCrewMarkers] = useState<Array<{ id: string; lat: number; lng: number; action_kind: string; label: string | null; is_urgent: boolean }>>([]);
  useEffect(() => {
    let cancelled = false;
    async function fetchMarkers() {
      try {
        const r = await fetch("/api/heimat/crew-marker", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json() as { markers?: Array<{ id: string; lat: number; lng: number; action_kind: string; label: string | null; is_urgent: boolean }> };
        if (!cancelled) setHeimatCrewMarkers(j.markers ?? []);
      } catch { /* noop */ }
    }
    void fetchMarkers();
    const id = setInterval(fetchMarkers, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);
  const [buildingPlaceMode, setBuildingPlaceMode] = useState<null | { kind: "blackmarket" | "bunker" | "hangout" | "tunnel" }>(null);
  const [repeaterPlaceCursor, setRepeaterPlaceCursor] = useState<{ lat: number; lng: number } | null>(null);
  // Alle Stadt-Blocks im Sichtbereich — nur im Placement-Mode geladen,
  // damit AppMap statt Kreis das richtige Block-Polygon highlighten kann.
  const [cityBlocksAll, setCityBlocksAll] = useState<Array<{ block_id: number; geojson: GeoJSON.Geometry; street_class: string | null }>>([]);
  useEffect(() => {
    if ((!repeaterPlaceMode && !buildingPlaceMode) || !userCenter) { setCityBlocksAll([]); return; }
    const dLat = 0.020, dLng = 0.030;
    const bbox = [userCenter.lat - dLat, userCenter.lng - dLng, userCenter.lat + dLat, userCenter.lng + dLng].join(",");
    fetch(`/api/city-blocks?bbox=${bbox}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setCityBlocksAll(j.blocks ?? []))
      .catch(() => setCityBlocksAll([]));
  }, [repeaterPlaceMode, buildingPlaceMode, userCenter]);
  const [attackRepeaterTarget, setAttackRepeaterTarget] = useState<Repeater | null>(null);
  const [repeaterInfoTarget, setRepeaterInfoTarget] = useState<{ r: Repeater; x: number; y: number } | null>(null);
  const [showJoinPbRally, setShowJoinPbRally] = useState<boolean>(false);

  // Player-Base-Rally polling alle 20 s (nur State updaten wenn sich was
  // wirklich ändert, sonst flackert das ganze Dashboard).
  useEffect(() => {
    let cancelled = false;
    let last: string | null = null;
    const poll = async () => {
      try {
        const r = await fetch("/api/base/rally", { cache: "no-store" });
        if (!r.ok || cancelled) return;
        const j = await r.json() as { rally: PlayerBaseRallyState | null };
        const sig = JSON.stringify(j.rally);
        if (sig === last) return;
        last = sig;
        if (!cancelled) setPbRally(j.rally);
      } catch { /* network blip — ignorieren */ }
    };
    const cancelIdle = deferIdle(() => { void poll(); });
    const iv = setInterval(poll, 20000);
    return () => { cancelled = true; cancelIdle(); clearInterval(iv); };
  }, []);
  const [placeBaseMode, setPlaceBaseMode] = useState<null | "runner" | "crew">(null);

  // ── Wegelager (Strongholds) + Rally-State ──
  type Stronghold = { id: string; lat: number; lng: number; level: number; total_hp: number; current_hp: number; hp_pct: number };
  const [strongholds, setStrongholds] = useState<Stronghold[]>([]);
  const [strongholdModalTarget, setStrongholdModalTarget] = useState<{ s: Stronghold; x: number; y: number } | null>(null);
  const strongholdArt = useStrongholdArt();
  const dashboardBaseThemeArt = useBaseThemeArt();
  const dashboardUiIconArt = useUiIconArt();
  const dashboardMarkerArt = useMarkerArt();
  const nameplateArt = useNameplateArt();
  const baseRingArt = useBaseRingArt();
  const artworkReady = useArtworkReady();
  const fetchStrongholds = useCallback(async (lat: number, lng: number) => {
    try {
      const r = await fetch(`/api/strongholds/nearby?lat=${lat}&lng=${lng}&radius_km=30`, { cache: "no-store" });
      if (r.ok) {
        const j = await r.json() as { strongholds: Stronghold[] };
        const next = j.strongholds ?? [];
        // Stabiles Update: nur setzen wenn sich IDs/HP geändert haben (verhindert Flackern)
        setStrongholds((prev) => {
          if (prev.length !== next.length) return next;
          for (let i = 0; i < prev.length; i++) {
            if (prev[i].id !== next[i].id || prev[i].current_hp !== next[i].current_hp) return next;
          }
          return prev;
        });
      }
    } catch { /* silent */ }
  }, []);
  type RallyData = { ok: boolean; rally: { id: string; leader_user_id: string; crew_id: string; stronghold_id: string; prep_ends_at: string; march_ends_at: string | null; status: "preparing" | "marching" | "fighting" | "done" | "aborted"; total_atk: number; leader_base_lat?: number | null; leader_base_lng?: number | null; route_geom_json?: { type: "LineString"; coordinates: [number, number][] } | null } | null; i_joined?: boolean; participants?: Array<{ user_id: string; guardian_id: string | null; troops: Record<string, number>; atk_contribution: number }>; stronghold?: Stronghold };
  const [rallyData, setRallyData] = useState<RallyData | null>(null);
  const refreshRally = useCallback(async () => {
    try {
      const r = await fetch("/api/rally", { cache: "no-store" });
      if (r.ok) setRallyData(await r.json() as RallyData);
    } catch { /* silent */ }
  }, []);
  useEffect(() => {
    const cancelIdle = deferIdle(() => { void refreshRally(); });
    const id = setInterval(refreshRally, 15000);
    return () => { cancelIdle(); clearInterval(id); };
  }, [refreshRally]);

  // ─── Event: Wegelager-Modal öffnen (z.B. via Crew-Angriffe-Panel) ──
  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ strongholdId: string; lat: number; lng: number }>).detail;
      if (!detail) return;
      const s = strongholds.find((x) => x.id === detail.strongholdId);
      window.dispatchEvent(new CustomEvent("ma365:fly-to-coords", {
        detail: { lat: detail.lat, lng: detail.lng, zoom: 17 },
      }));
      if (s) setStrongholdModalTarget({ s, x: window.innerWidth / 2, y: window.innerHeight / 2 });
    };
    window.addEventListener("ma365:open-stronghold", onOpen as EventListener);
    return () => window.removeEventListener("ma365:open-stronghold", onOpen as EventListener);
  }, [strongholds]);

  // ─── Aktive Späher (eigene) ─────────────────────────────────────────
  const [activeScouts, setActiveScouts] = useState<ActiveScout[]>([]);
  const refreshScouts = useCallback(async () => {
    try {
      const r = await fetch("/api/base/scouts/active", { cache: "no-store" });
      if (r.ok) {
        const j = await r.json() as { scouts?: ActiveScout[] };
        setActiveScouts(j.scouts ?? []);
      }
    } catch { /* silent */ }
  }, []);
  // Realtime-aware: bei aktivem Channel nur 60s-Watchdog statt 5s-Poll.
  useRealtimeAwareInterval(refreshScouts, "player_base_scouts", { fastMs: 5000, slowMs: 60_000, channelName: "ma365-scouts-rt" });

  // ─── Crew-Repeater-Rallies (eigene Crew als Angreifer ODER Verteidiger) ─
  const [crewRallies, setCrewRallies] = useState<CrewRally[]>([]);
  const refreshCrewRallies = useCallback(async () => {
    try {
      const r = await fetch("/api/crews/turf/rally/active", { cache: "no-store" });
      if (r.ok) {
        const j = await r.json() as { rallies?: CrewRally[] };
        setCrewRallies(j.rallies ?? []);
      }
    } catch { /* silent */ }
  }, []);
  useRealtimeAwareInterval(refreshCrewRallies, "crew_repeater_rallies", { fastMs: 15_000, slowMs: 60_000, channelName: "ma365-crew-rallies-rt" });
  // Wegelager sind Welt-Content (Berlin-weit pre-seeded in DB, Migration 00193).
  // Frontend triggert keinen Spawn mehr — nur Fetch der bestehenden + Respawn-Trigger
  // bei Defeat läuft DB-seitig (respawn_due_strongholds, gleiche Position).
  const userCenterRef = useRef<{ lat: number; lng: number } | null>(null);
  useEffect(() => { userCenterRef.current = userCenter ?? null; }, [userCenter]);
  useEffect(() => {
    const center = userCenter ?? { lat: 52.520, lng: 13.405 };
    const cancelIdle = deferIdle(() => { void fetchStrongholds(center.lat, center.lng); });
    const id = setInterval(() => void fetchStrongholds(center.lat, center.lng), 60000);
    return () => { cancelIdle(); clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userCenter?.lat, userCenter?.lng]);

  // ── Resource-Nodes (Schrottplatz/Fabrik/ATM/Datacenter) ──
  type ResourceNode = { id: number; kind: "scrapyard" | "factory" | "atm" | "datacenter"; resource_type: "wood" | "stone" | "gold" | "mana"; name: string | null; lat: number; lng: number; level: number; total_yield: number; current_yield: number; gather_count?: number; gather_active?: boolean; gather_someone_gathering?: boolean; gather_finish_at?: string | null; gather_mine?: boolean; gather_username?: string | null; gather_crew_tag?: string | null };
  const [resourceNodes, setResourceNodes] = useState<ResourceNode[]>([]);
  const [gatherModalNode, setGatherModalNode] = useState<{ n: ResourceNode; x: number; y: number } | null>(null);
  const lastBboxRef = useRef<string>("");
  // Aktive Sammel-Märsche des Users (für Banner mit Live-Countdown)
  type ActiveMarch = {
    id: number; node_id: number; guardian_id: string | null; guardian_name?: string | null; troop_count: number;
    status: "marching" | "gathering" | "returning";
    started_at: string; arrives_at: string; finishes_at: string; returns_at: string;
    collected: number;
    origin_lat: number | null; origin_lng: number | null;
    owner_name?: string | null; owner_crew_tag?: string | null;
    route_geom_json?: string | null;
    route_distance_m?: number | null;
    recall_progress?: number | null;
    node: { id: number; kind: "scrapyard" | "factory" | "atm" | "datacenter"; resource_type: "wood" | "stone" | "gold" | "mana"; name: string | null; lat: number; lng: number; level: number; total_yield?: number; current_yield?: number } | null;
  };
  const [activeMarches, setActiveMarches] = useState<ActiveMarch[]>([]);
  const refreshActiveMarches = useCallback(async () => {
    try {
      const r = await fetch("/api/gather/active", { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json() as { marches: ActiveMarch[] };
      setActiveMarches(j.marches ?? []);
    } catch { /* silent */ }
  }, []);
  useEffect(() => {
    const cancelIdle = deferIdle(() => { void refreshActiveMarches(); });
    // Realtime: lauscht auf gather_marches-Änderungen — RLS filtert auf eigene Märsche.
    const sb = createClient();
    const channel = sb
      .channel("ma365-gather-marches-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "gather_marches" }, () => {
        void refreshActiveMarches();
      })
      .subscribe();
    // Fallback-Poll: 2 Minuten falls WebSocket abreißt.
    const id = setInterval(refreshActiveMarches, 120000);

    // Targeted Refresh: wenn ein Marsch returns_at überschreitet, fired kein
    // Realtime-Event (nur tick_gather_marches transitioniert returning→completed).
    // Daher exakt zu dem Zeitpunkt einen zusätzlichen Refresh schedulen → Tick
    // läuft, Status springt auf completed, Banner verschwinden ohne Verzögerung.
    const nextTransition = activeMarches
      .map((m) => new Date(m.status === "returning" ? m.returns_at : m.status === "gathering" ? m.finishes_at : m.arrives_at).getTime())
      .filter((t) => t > Date.now())
      .sort((a, b) => a - b)[0];
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    if (nextTransition) {
      const delay = Math.max(500, nextTransition - Date.now() + 250); // +250ms Sicherheits-Puffer
      timeoutId = setTimeout(() => { void refreshActiveMarches(); }, delay);
    }
    return () => {
      cancelIdle();
      clearInterval(id);
      if (timeoutId) clearTimeout(timeoutId);
      void sb.removeChannel(channel);
    };
  }, [refreshActiveMarches, activeMarches]);

  const onMapViewportChange = useCallback((vp: { minLng: number; minLat: number; maxLng: number; maxLat: number; zoom: number }) => {
    if (vp.zoom < 13) { setResourceNodes([]); return; }
    const bbox = `${vp.minLng.toFixed(4)},${vp.minLat.toFixed(4)},${vp.maxLng.toFixed(4)},${vp.maxLat.toFixed(4)}`;
    if (bbox === lastBboxRef.current) return;
    lastBboxRef.current = bbox;
    void (async () => {
      try {
        const r = await fetch(`/api/resource-nodes/nearby?bbox=${bbox}`, { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json() as { nodes: ResourceNode[] };
        setResourceNodes(j.nodes ?? []);
      } catch { /* silent */ }
    })();
  }, []);

  // Theme-Lookup für Pin-Rendering (cache als Map id → { emoji, color })
  type ThemeMeta = { pin_emoji: string; pin_color: string };
  const [themeMeta, setThemeMeta] = useState<Map<string, ThemeMeta>>(new Map());
  useEffect(() => {
    void (async () => {
      const r = await fetch("/api/base/me", { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json() as {
        ok: boolean;
        base: { id: string; lat: number | null; lng: number | null; theme_id: string } | null;
        themes: Array<{ id: string; pin_emoji: string; pin_color: string }>;
      };
      if (j.base) {
        setOwnBaseId(j.base.id);
        const has = j.base.lat != null && j.base.lng != null;
        setOwnBaseHasPos(has);
        setOwnBasePos(has ? { lat: j.base.lat as number, lng: j.base.lng as number } : null);
        setOwnBaseThemeId(j.base.theme_id);
      }
      const map = new Map<string, ThemeMeta>();
      (j.themes ?? []).forEach((t) => map.set(t.id, { pin_emoji: t.pin_emoji, pin_color: t.pin_color }));
      setThemeMeta(map);
    })();
  }, []);

  // Nearby-Bases laden (5km bbox um userCenter, alle 30s)
  useEffect(() => {
    if (!userCenter) return;
    let cancelled = false;
    const load = async () => {
      const dLat = 0.090;  // ≈ 10 km Halbradius
      const dLng = 0.140;
      const bbox = [userCenter.lng - dLng, userCenter.lat - dLat, userCenter.lng + dLng, userCenter.lat + dLat].join(",");
      const r = await fetch(`/api/bases/nearby?bbox=${bbox}`, { cache: "no-store" });
      if (!r.ok || cancelled) return;
      const j = await r.json() as { ok: boolean; runner: Array<{ id: string; owner_user_id?: string; owner_username?: string | null; lat: number; lng: number; level: number; theme_id: string; pin_label: string; crew_tag?: string | null; is_own: boolean; base_ring_id?: string | null }>; crew: Array<{ id: string; lat: number; lng: number; level: number; theme_id: string; pin_label: string; crew_tag?: string | null; is_own: boolean }> };
      const merged: BasePin[] = [];
      const fb = { pin_emoji: "🏰", pin_color: "#22D1C3" };
      (j.runner ?? []).forEach((b) => {
        const t = themeMeta.get(b.theme_id) ?? fb;
        merged.push({ kind: "runner", id: b.id, owner_user_id: b.owner_user_id, owner_username: b.owner_username, lat: b.lat, lng: b.lng, level: b.level, pin_label: b.pin_label, crew_tag: b.crew_tag, is_own: b.is_own, theme_id: b.theme_id, base_ring_id: b.base_ring_id, ...t });
      });
      (j.crew ?? []).forEach((b) => {
        const t = themeMeta.get(b.theme_id) ?? fb;
        merged.push({ kind: "crew", id: b.id, lat: b.lat, lng: b.lng, level: b.level, pin_label: b.pin_label, crew_tag: b.crew_tag, is_own: b.is_own, theme_id: b.theme_id, ...t });
      });
      setBasePins(merged);
    };
    void load();
    const iv = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [userCenter, themeMeta, cosmeticVersion]);

  // Crew-Turf laden (Repeater + Polygons in 10km bbox, alle 30s)
  useEffect(() => {
    if (!userCenter) return;
    let cancelled = false;
    const load = async () => {
      const dLat = 0.090;
      const dLng = 0.140;
      const bbox = [userCenter.lat - dLat, userCenter.lng - dLng, userCenter.lat + dLat, userCenter.lng + dLng].join(",");
      const r = await fetch(`/api/crews/turf?bbox=${bbox}`, { cache: "no-store" });
      if (!r.ok || cancelled) return;
      const j = await r.json() as { repeaters: Repeater[]; turf: TurfPoly[]; blocks?: CrewBlock[]; buildings?: CrewBuilding[] };
      setCrewRepeaters(j.repeaters ?? []);
      setCrewTurfPolygons(j.turf ?? []);
      setCrewBlocks(j.blocks ?? []);
      setCrewBuildings(j.buildings ?? []);
    };
    void load();
    const iv = setInterval(load, 30000);
    // Custom-Event: andere Komponenten (z.B. Crew-Farb-Picker) können ein
    // sofortiges Refresh anfordern statt auf den 30s-Tick zu warten.
    const onRefreshEvent = () => { void load(); };
    window.addEventListener("ma365:refresh-turf", onRefreshEvent);
    return () => {
      cancelled = true;
      clearInterval(iv);
      window.removeEventListener("ma365:refresh-turf", onRefreshEvent);
    };
  }, [userCenter]);

  const onPlaceBaseClick = useCallback(async (lng: number, lat: number, kind: "runner" | "crew") => {
    const url = kind === "runner" ? "/api/base/position" : "/api/crew/base/position";
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lat, lng }) });
    setPlaceBaseMode(null);
    if (r.ok) {
      if (kind === "runner") setOwnBaseHasPos(true);
      // refetch pins
      if (userCenter) {
        const dLat = 0.090, dLng = 0.140;
        const bbox = [userCenter.lng - dLng, userCenter.lat - dLat, userCenter.lng + dLng, userCenter.lat + dLat].join(",");
        const rr = await fetch(`/api/bases/nearby?bbox=${bbox}`, { cache: "no-store" });
        if (rr.ok) {
          const j = await rr.json() as { runner: BasePin[]; crew: BasePin[] };
          const merged: BasePin[] = [];
          const fb = { pin_emoji: "🏰", pin_color: "#22D1C3" };
          (j.runner ?? []).forEach((b: BasePin & { theme_id?: string }) => {
            const t = themeMeta.get(b.theme_id ?? "") ?? fb;
            merged.push({ ...b, kind: "runner", ...t });
          });
          (j.crew ?? []).forEach((b: BasePin & { theme_id?: string }) => {
            const t = themeMeta.get(b.theme_id ?? "") ?? fb;
            merged.push({ ...b, kind: "crew", ...t });
          });
          setBasePins(merged);
        }
      }
    }
  }, [userCenter, themeMeta, cosmeticVersion]);

  // Shadow-Route (Demo): wenn toggled, nutze demoShadowRoute um User-Position
  const shadowRoute = useMemo(() => {
    if (!shadowEnabled || !userCenter) return null;
    return demoShadowRoute(userCenter);
  }, [shadowEnabled, userCenter]);

  // Recenter-Trigger (Counter)
  const [recenterAt, setRecenterAt] = useState(0);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const p = profile;
  const currentRank = getCurrentRank(p?.wegemuenzen ?? p?.xp ?? 0);
  const teamColor = myCrew?.color || p?.team_color || PRIMARY;

  // ── Stable references for AppMap array props (prevents marker flicker on parent re-renders)
  const powerZonesForMap = useMemo(
    () => mapFeatures?.power_zones ?? EMPTY_SHOPS,
    [mapFeatures?.power_zones],
  );
  const bossRaidsForMap = useMemo(
    () => mapFeatures?.boss_raids ?? EMPTY_SHOPS,
    [mapFeatures?.boss_raids],
  );
  const sanctuariesForMap = useMemo(
    () => mapFeatures?.sanctuaries ?? EMPTY_SHOPS,
    [mapFeatures?.sanctuaries],
  );
  const strongholdsForMap = useMemo(
    () => (artworkReady ? strongholds : EMPTY_SHOPS),
    [artworkReady, strongholds],
  );
  const crewRepeatersForMap = useMemo(
    () => (artworkReady ? crewRepeaters : EMPTY_SHOPS),
    [artworkReady, crewRepeaters],
  );
  const crewBuildingsForMap = useMemo(
    () => (artworkReady ? crewBuildings : EMPTY_SHOPS),
    [artworkReady, crewBuildings],
  );
  const gatherMarchesForMap = useMemo(
    () =>
      activeMarches.map((m) => ({
        ...m,
        recall_progress: m.recall_progress ?? null,
        route_geom: (() => {
          if (!m.route_geom_json) return null;
          try {
            const g = JSON.parse(m.route_geom_json) as { type?: string; coordinates?: [number, number][] };
            if (g.type === "LineString" && Array.isArray(g.coordinates)) {
              return { type: "LineString" as const, coordinates: g.coordinates };
            }
            return null;
          } catch { return null; }
        })(),
      })),
    [activeMarches],
  );
  const activeScoutsForMap = useMemo(
    () =>
      activeScouts.map((s) => ({
        ...s,
        route_geom_json: s.route_geom_json && s.route_geom_json.type === "LineString" ? s.route_geom_json : null,
      })),
    [activeScouts],
  );
  const activeRallyMarchesForMap = useMemo(
    () => [
      ...crewRallies
        .filter((r) => r.status === "marching" || r.status === "fighting")
        .map((r) => ({
          id: `crew_repeater:${r.id}`,
          kind: "crew_repeater" as const,
          status: r.status as "marching" | "fighting",
          prep_ends_at: r.prep_ends_at,
          march_ends_at: r.march_ends_at,
          origin_lat: r.leader_base_lat ?? null,
          origin_lng: r.leader_base_lng ?? null,
          target_lat: r.repeater_lat,
          target_lng: r.repeater_lng,
          target_label: r.repeater_label,
          leader_name: r.leader_name,
          crew_tag: r.attacker_crew_tag,
          route_geom_json: r.route_geom_json && r.route_geom_json.type === "LineString" ? r.route_geom_json : null,
        })),
      ...(pbRally && (pbRally.status === "marching" || pbRally.status === "fighting")
        ? [{
            id: `player_base:${pbRally.rally_id}`,
            kind: "player_base" as const,
            status: pbRally.status as "marching" | "fighting",
            prep_ends_at: pbRally.prep_ends_at,
            march_ends_at: pbRally.march_ends_at,
            origin_lat: pbRally.leader_base_lat ?? null,
            origin_lng: pbRally.leader_base_lng ?? null,
            target_lat: pbRally.defender_lat,
            target_lng: pbRally.defender_lng,
            target_label: pbRally.defender_name,
            leader_name: pbRally.leader_name,
            crew_tag: null,
            route_geom_json: pbRally.route_geom_json && pbRally.route_geom_json.type === "LineString" ? pbRally.route_geom_json : null,
          }]
        : []),
      ...(rallyData?.rally && (rallyData.rally.status === "marching" || rallyData.rally.status === "fighting") && rallyData.stronghold
        ? [{
            id: `stronghold:${rallyData.rally.id}`,
            kind: "stronghold" as const,
            status: rallyData.rally.status as "marching" | "fighting",
            prep_ends_at: rallyData.rally.prep_ends_at,
            march_ends_at: rallyData.rally.march_ends_at,
            origin_lat: rallyData.rally.leader_base_lat ?? null,
            origin_lng: rallyData.rally.leader_base_lng ?? null,
            target_lat: rallyData.stronghold.lat,
            target_lng: rallyData.stronghold.lng,
            target_label: `Wegelager Lv ${rallyData.stronghold.level}`,
            leader_name: null,
            crew_tag: null,
            route_geom_json: rallyData.rally.route_geom_json && rallyData.rally.route_geom_json.type === "LineString" ? rallyData.rally.route_geom_json : null,
          }]
        : []),
    ],
    [crewRallies, pbRally, rallyData],
  );
  const equippedNameplateId = (p as unknown as { equipped_nameplate_id?: string | null })?.equipped_nameplate_id ?? null;
  const basePinsForMap = useMemo(
    () => {
      if (!artworkReady) return EMPTY_SHOPS;
      // Theme-Rarity-Lookup (Migration 00209: Urban-Berlin-Themes) für FX-Layer
      const themeRarity: Record<string, "advanced" | "epic" | "legendary"> = {
        // common (plattenbau, altbau_hof) bekommen keinen FX-Layer → bewusst nicht im Mapping
        spaeti: "advanced", hinterhof: "advanced", werkstatt: "advanced", container_camp: "advanced",
        ubahn: "epic", graffiti_tower: "epic", techno_club: "epic", penthouse: "epic",
        dachterrasse: "legendary", wagenburg: "legendary",
        // Saisonale & Spezial-Themes behalten
        halloween: "epic", frost_keep: "epic", night_rose: "legendary",
      };
      return basePins.map((b) => {
        const rar = b.theme_id ? themeRarity[b.theme_id] : undefined;
        const ringArt = b.base_ring_id
          ? (baseRingArt[b.base_ring_id] ?? null)
          : null;
        if (!b.is_own) return { ...b, theme_rarity: rar, base_ring_art: ringArt };
        const np = equippedNameplateId ? (nameplateArt[equippedNameplateId] ?? null) : null;
        return { ...b, theme_rarity: rar, nameplate_art: np, base_ring_art: ringArt };
      });
    },
    [artworkReady, basePins, baseRingArt, equippedNameplateId, nameplateArt],
  );

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
              markerVariant={equippedMarkerVariant}
              lightId={equippedLight}
              activeRoute={activeRoute}
              routeGeometry={routingRoute?.geometry ?? null}
              savedTerritories={EMPTY_SHOPS}
              claimedAreas={EMPTY_SHOPS}
              glitchZones={EMPTY_SHOPS}
              crewMembers={EMPTY_SHOPS}
              shops={EMPTY_SHOPS}
              flashPushes={EMPTY_FLASH_PUSHES}
              shopTrail={EMPTY_SHOP_TRAIL}
              shopReviews={EMPTY_SHOP_REVIEWS}
              arenaCountdowns={EMPTY_ARENA_COUNTDOWNS}
              onAreaClick={setViewingArea}
              overviewMode={overviewMode}
              recenterAt={recenterAt}
              ownBasePos={ownBasePos}
              lightPreset={lightPreset}
              supporterTier={(p as unknown as { supporter_tier?: SupporterTier | null })?.supporter_tier ?? null}
              equippedTrail={(p as unknown as { equipped_trail?: string | null })?.equipped_trail ?? null}
              auraActive={(() => {
                const until = (p as unknown as { aura_until?: string | null })?.aura_until;
                return !!(until && new Date(until).getTime() > Date.now());
              })()}
              mapTheme={(p as unknown as { map_theme?: string | null })?.map_theme ?? null}
              pinTheme={pinThemeOverride ?? ((p as unknown as { pin_theme?: import("@/lib/pin-themes").PinTheme | null })?.pin_theme) ?? "default"}
              crewColor={myCrew?.color ?? null}
              crewName={myCrew?.name ?? null}
              displayName={p?.username ?? p?.display_name ?? null}
              walkedSegments={walkedSegments}
              claimedStreets={claimedStreets}
              ownedTerritories={ownedTerritories}
              onOwnershipClick={(kind, id) => setOwnershipQuery({ type: kind, id })}
              powerZones={powerZonesForMap}
              bossRaids={bossRaidsForMap}
              sanctuaries={sanctuariesForMap}
              shadowRoute={shadowRoute}
              lorePieces={lorePieces}
              onLorePickup={async (pieceId) => {
                if (!userCenter) return;
                const r = await fetch("/api/runner/lore", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "pickup", piece_id: pieceId, lat: userCenter.lat, lng: userCenter.lng }),
                });
                const j = await r.json().catch(() => null) as { ok?: boolean; set_complete?: boolean } | null;
                if (j?.ok) {
                  setLorePieces((prev) => prev.filter((p) => p.piece_id !== pieceId));
                }
              }}
              onBossClick={setViewingBoss}
              onSanctuaryClick={setViewingSanctuary}
              onPowerZoneClick={setViewingPowerZone}
              strongholds={strongholdsForMap}
              strongholdArt={strongholdArt}
              onStrongholdClick={(id, x, y) => {
                const s = strongholds.find((x) => x.id === id);
                if (s) setStrongholdModalTarget({ s, x, y });
              }}
              resourceNodes={resourceNodes}
              gatherMarches={gatherMarchesForMap}
              activeScouts={activeScoutsForMap}
              activeRallyMarches={activeRallyMarchesForMap}
              onResourceNodeClick={(id, x, y) => {
                const n = resourceNodes.find((x) => x.id === id);
                if (n) setGatherModalNode({ n, x, y });
              }}
              onViewportChange={onMapViewportChange}
              basePins={basePinsForMap}
              baseThemeArt={dashboardBaseThemeArt}
              uiIconArt={dashboardUiIconArt}
              onBasePinTap={(pin, x, y) => {
                // Crew-Mate-Base (gleicher Crew-Tag, nicht eigen) → CrewMemberModal
                // Fremde Runner-Base → Heimat-Tap-Menü (Aufgebot/Multi/Verstecken/Verlegen)
                // Eigene → BaseModal
                if (!pin.is_own && pin.kind === "runner") {
                  const full = basePins.find((b) => b.id === pin.id);
                  if (full?.owner_user_id) {
                    const myTag = (myCrew as unknown as { tag?: string } | null)?.tag;
                    const isCrewMate = !!myTag && !!full.crew_tag && full.crew_tag === myTag;
                    if (isCrewMate) {
                      setCrewMemberTarget({ userId: full.owner_user_id, x, y });
                      return;
                    }
                    setHeimatTapDefender({
                      id: full.owner_user_id,
                      name: (full as { label?: string; pin_label?: string }).label
                        ?? (full as { label?: string; pin_label?: string }).pin_label
                        ?? "Runner",
                    });
                    setHeimatTapPos({ lat: full.lat, lng: full.lng, screenX: x, screenY: y });
                    return;
                  }
                }
                setBaseModalTarget(pin);
              }}
              placeBaseMode={placeBaseMode}
              onPlaceBaseClick={onPlaceBaseClick}
              crewRepeaters={crewRepeatersForMap}
              crewTurfPolygons={crewTurfPolygons}
              crewBlocks={crewBlocks}
              crewBuildings={crewBuildingsForMap}
              onRepeaterClick={(id, x, y) => {
                const r = crewRepeaters.find((p) => p.id === id);
                if (r) setRepeaterInfoTarget({ r, x, y });
              }}
              crewMarkers={heimatCrewMarkers}
              onMapTap={(lng, lat, screenX, screenY) => {
                // Heimat-Karte CoD-UX: kurzer Tap auf leere Map öffnet das
                // Tap-Action-Menü (Verlegen/Aufgebot/Verstecken).
                if (repeaterPlaceMode || buildingPlaceMode) return;
                if (heimatRelocateMode) { setHeimatRelocateTarget({ lat, lng }); return; }
                setHeimatTapDefender(null);
                setHeimatTapPos({ lat, lng, screenX, screenY });
              }}
              onMapLongPress={(lng, lat) => {
                // Long-Press: Placement-Mode-Trigger (Repeater/Buildings).
                // Heimat-Tap-Menü läuft jetzt über onMapTap.
                if (!repeaterPlaceMode && !buildingPlaceMode && !heimatRelocateMode) {
                  setHeimatTapDefender(null);
                  setHeimatTapPos({ lat, lng, screenX: window.innerWidth / 2, screenY: window.innerHeight / 2 });
                  return;
                }
                // Verlegen-Mode: Long-Press = neue Position für Base-Verlegen
                if (heimatRelocateMode) {
                  setHeimatRelocateTarget({ lat, lng });
                  return;
                }
                if (repeaterPlaceMode) {
                  setPlaceRepeaterAt({ lat, lng });
                  setRepeaterPlaceMode(null);
                } else if (buildingPlaceMode) {
                  // Direkt RPC-Aufruf für neue Bauwerke (kein Modal-Step)
                  void (async () => {
                    const { createClient } = await import("@/lib/supabase/client");
                    const sb = createClient();
                    const { data } = await sb.rpc("place_crew_building", {
                      p_kind: buildingPlaceMode.kind,
                      p_lat: lat, p_lng: lng,
                    });
                    const res = data as { ok?: boolean; error?: string; hint?: string } | null;
                    if (res?.ok) {
                      setBuildingPlaceMode(null);
                      // Buildings im Sichtbereich neu laden
                      if (userCenter) {
                        const dLat = 0.090, dLng = 0.140;
                        const bbox = [userCenter.lat - dLat, userCenter.lng - dLng, userCenter.lat + dLat, userCenter.lng + dLng].join(",");
                        fetch(`/api/crews/turf?bbox=${bbox}`, { cache: "no-store" })
                          .then((r) => r.json())
                          .then((j) => { setCrewRepeaters(j.repeaters ?? []); setCrewTurfPolygons(j.turf ?? []); setCrewBlocks(j.blocks ?? []); setCrewBuildings(j.buildings ?? []); });
                      }
                    } else {
                      alert(res?.hint || res?.error || "Bauwerk konnte nicht platziert werden");
                    }
                  })();
                }
              }}
              placementPreview={(repeaterPlaceMode || buildingPlaceMode) ? {
                kind: repeaterPlaceMode?.kind ?? "repeater",  // generischer Default für Buildings
                color: myCrew?.territory_color || "#22D1C3",
                ownRepeaters: crewRepeaters
                  .filter((r) => r.is_own && r.hp > 0)
                  .map((r) => ({
                    lat: r.lat, lng: r.lng,
                    radius_m: r.turf_radius_m
                      ?? (r.kind === "hq" ? 350 : r.kind === "mega" ? 250 : 150),
                  })),
                cursor: repeaterPlaceCursor ?? userCenter,
                newRadius_m: repeaterPlaceMode
                  ? (repeaterPlaceMode.kind === "hq" ? 350 : repeaterPlaceMode.kind === "mega" ? 250 : 150)
                  : 50,  // Buildings: kleiner Cursor-Kreis
                allBlocks: cityBlocksAll.length > 0 ? cityBlocksAll : undefined,
                blockClaimCount: repeaterPlaceMode
                  ? (repeaterPlaceMode.kind === "hq" ? 4 : repeaterPlaceMode.kind === "mega" ? 2 : 1)
                  : 1,
              } : null}
              onPlacementHover={(lng, lat) => setRepeaterPlaceCursor({ lat, lng })}
              onPlacementConfirm={(lng, lat) => {
                // Click im Placement-Mode = sofort platzieren (kein 600ms Long-Press warten)
                if (repeaterPlaceMode) {
                  setPlaceRepeaterAt({ lat, lng });
                  setRepeaterPlaceMode(null);
                } else if (buildingPlaceMode) {
                  void (async () => {
                    const { createClient } = await import("@/lib/supabase/client");
                    const sb = createClient();
                    const { data, error } = await sb.rpc("place_crew_building", {
                      p_kind: buildingPlaceMode.kind,
                      p_lat: lat, p_lng: lng,
                    });
                    const res = data as { ok?: boolean; error?: string; hint?: string; need?: { gold: number; wood: number; stone: number; mana: number } } | null;
                    if (res?.ok) {
                      setBuildingPlaceMode(null);
                      if (userCenter) {
                        const dLat = 0.090, dLng = 0.140;
                        const bbox = [userCenter.lat - dLat, userCenter.lng - dLng, userCenter.lat + dLat, userCenter.lng + dLng].join(",");
                        fetch(`/api/crews/turf?bbox=${bbox}`, { cache: "no-store" })
                          .then((r) => r.json())
                          .then((j) => { setCrewRepeaters(j.repeaters ?? []); setCrewTurfPolygons(j.turf ?? []); setCrewBlocks(j.blocks ?? []); setCrewBuildings(j.buildings ?? []); });
                      }
                    } else {
                      const need = res?.need;
                      const msg = res?.error === "insufficient_resources" && need
                        ? `Brauchst ${need.gold}🪙 ${need.wood}🪵 ${need.stone}🪨 ${need.mana}💧`
                        : res?.hint || res?.error || error?.message || "Bauwerk konnte nicht platziert werden";
                      alert(msg);
                    }
                  })();
                }
              }}
            />

            {/* Map-Quickaccess: vertikaler Icon-Stack rechts unten (Profil, Crew, Inbox etc.) */}
            <MapQuickAccess
              onOpenProfile={() => { window.location.href = "/karte/base"; }}
              profileIcon={(() => {
                // Eigenes Base-Theme als FAB-Icon (Pin-Variante des aktuellen Themes).
                // Fallback auf Banner-Variante, dann Marker, dann null.
                if (ownBaseThemeId) {
                  const pin = dashboardBaseThemeArt[`${ownBaseThemeId}_runner_pin`];
                  if (pin?.image_url || pin?.video_url) return pin;
                  const banner = dashboardBaseThemeArt[`${ownBaseThemeId}_runner_banner`];
                  if (banner?.image_url || banner?.video_url) return banner;
                }
                const m = dashboardMarkerArt[equippedMarker]?.[equippedMarkerVariant]
                       ?? dashboardMarkerArt[equippedMarker]?.neutral;
                return m?.image_url || m?.video_url ? m : null;
              })()}
              onOpenCrewModal={() => setMapCrewModalOpen(true)}
              onOpenInbox={() => setInboxModalOpen(true)}
              onOpenAchievements={() => setActiveTab("profil")}
              onOpenRanking={() => setRankingModalOpen(true)}
              onJoinRepeaterRally={(repeaterId) => {
                const r = crewRepeaters.find((x) => x.id === repeaterId);
                if (r) setAttackRepeaterTarget(r);
              }}
              onJoinBaseRally={(_rallyId) => {
                if (pbRally?.status === "preparing" && !pbRally.joined) {
                  setShowJoinPbRally(true);
                }
              }}
              onFlyTo={(lat, lng) => {
                window.dispatchEvent(new CustomEvent("ma365:fly-to-coords", {
                  detail: { lng, lat, zoom: 16 },
                }));
              }}
              strongholdsNearby={strongholds.length}
              inboxUnread={inboxUnreadCount}
            />

            <LivePaceHud
              distance={distance}
              durationMs={walking ? Date.now() - walkStartTime : 0}
              xpGained={liveXpGained}
              streak={liveStreak}
              walking={walking}
              xpBoost={1}
            />

            {/* Active-Rally-Banner — oben auf der Karte wenn Crew eine Versammlung laufen hat */}
            {rallyData?.rally && !strongholdModalTarget && !baseModalTarget && !attackTarget && !pbRally && (
              <div style={{ position: "absolute", top: 14, left: 12, right: 12, zIndex: 56 }}>
                <ActiveRallyBanner
                  rally={rallyData.rally}
                  onOpen={async () => {
                    if (rallyData.stronghold) {
                      // Aufruf via Banner (kein Map-Click) → Popup mittig öffnen
                      setStrongholdModalTarget({ s: rallyData.stronghold, x: window.innerWidth / 2, y: window.innerHeight / 2 });
                    }
                  }}
                />
              </div>
            )}

            {/* Aktive Späher (eigene) */}
            {activeScouts.length > 0 && !strongholdModalTarget && !baseModalTarget && !attackTarget && (
              <ActiveScoutsBanner
                scouts={activeScouts}
                onFly={(lat, lng) => {
                  window.dispatchEvent(new CustomEvent("ma365:fly-to-coords", {
                    detail: { lat, lng, zoom: 17 },
                  }));
                }}
              />
            )}

            {/* Crew-Repeater-Rally-Banner (Aufgebote gegen feindliche Repeater) */}
            {crewRallies.length > 0 && !strongholdModalTarget && !baseModalTarget && !attackTarget && (
              <ActiveCrewRallyBanner
                rallies={crewRallies}
                onFly={(lat, lng) => {
                  window.dispatchEvent(new CustomEvent("ma365:fly-to-coords", {
                    detail: { lat, lng, zoom: 17 },
                  }));
                }}
              />
            )}

            {/* Player-Base-Crew-Angriff-Banner */}
            {pbRally && !strongholdModalTarget && !baseModalTarget && !attackTarget && (
              <div style={{ position: "absolute", top: 14, left: 12, right: 12, zIndex: 56 }}>
                <ActivePlayerBaseRallyBanner
                  rally={pbRally}
                  onOpen={() => {
                    if (!pbRally.joined && pbRally.status === "preparing") setShowJoinPbRally(true);
                    else {
                      // Zentriere Karte auf Defender-Base
                      window.dispatchEvent(new CustomEvent("ma365:fly-to-coords", {
                        detail: { lng: pbRally.defender_lng, lat: pbRally.defender_lat, zoom: 16 },
                      }));
                    }
                  }}
                />
              </div>
            )}

            {/* (Help/FAQ — verschoben in den Controls-Stack rechts oben) */}

            {/* Snap-Loading-Indikator */}
            {snapping && (
              <div style={{
                position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                zIndex: 60,
                background: "rgba(18, 26, 46, 0.92)",
                backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
                padding: "18px 24px", borderRadius: 18,
                border: `1px solid ${PRIMARY}66`,
                boxShadow: `0 0 28px ${PRIMARY}66`,
                display: "flex", alignItems: "center", gap: 12,
                color: "#FFF", fontSize: 14, fontWeight: 800,
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: 10,
                  border: `3px solid ${PRIMARY}`,
                  borderTopColor: "transparent",
                  animation: "snapSpin 0.8s linear infinite",
                }} />
                <span>{tMD("routeAligning")}</span>
                <style>{`@keyframes snapSpin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}

            {/* Happy Hour Banner (oben zentriert) */}
            <HappyHourBanner />

            {/* Live-Info-Panel (oben links) */}
            <MapLivePanel teamColor={teamColor} onViewRunner={setViewingRunner} />

            {/* Fraktions-Ranking entfernt (User-Wunsch) */}

            {/* Map-Controls (rechts, gleiche Hoehe wie Live-Panel links) - collapsible */}
            <div style={{
              position: "absolute", top: 20, right: 10, zIndex: 50,
              display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8,
            }}>
              <MapIconButton
                icon={controlsExpanded ? "✕" : "⋯"}
                label={controlsExpanded ? tMD("controlsCollapse") : tMD("controlsExpand")}
                onClick={() => setControlsExpanded(!controlsExpanded)}
                active={controlsExpanded}
                size={32}
              />
              {controlsExpanded && (
                <>
                  <MapIconButton
                    icon="📍"
                    label={tMD("centerOnMe")}
                    onClick={() => setRecenterAt(Date.now())}
                    accent="#4ade80"
                  />
                  <MapIconButton
                    icon={
                      lightPreset === "auto" ? "🕐" :
                      lightPreset === "dawn" ? "🌅" :
                      lightPreset === "day" ? "☀️" :
                      lightPreset === "dusk" ? "🌆" : "🌙"
                    }
                    label={tMD("labelTimeOfDay")}
                    onClick={() => {
                      const order: Array<typeof lightPreset> = ["auto", "day", "dusk", "night", "dawn"];
                      const idx = order.indexOf(lightPreset);
                      setLightPreset(order[(idx + 1) % order.length]);
                    }}
                    accent="#FFD700"
                  />
                  <MapIconButton
                    icon={overviewMode ? "🎯" : "🗺️"}
                    label={overviewMode ? tMD("labelBack") : tMD("labelOverview")}
                    onClick={() => setOverviewMode(!overviewMode)}
                    active={overviewMode}
                  />
                  <MapIconButton icon="📋" label={tMD("labelMissions")} onClick={() => setMissionsOpen(true)} badge={4} />
                  {/* Repeater platzieren — Mode aktivieren, Coverage-Preview erscheint */}
                  {myCrew && (
                    <MapIconButton
                      icon="📡"
                      label={crewRepeaters.some((r) => r.is_own && r.kind === "hq") ? tMD("labelPlaceRepeater") : tMD("labelPlaceHQ")}
                      onClick={() => {
                        const hasHQ = crewRepeaters.some((r) => r.is_own && r.kind === "hq");
                        setRepeaterPlaceMode({ kind: hasHQ ? "repeater" : "hq" });
                        setRepeaterPlaceCursor(userCenter);
                      }}
                      active={!!repeaterPlaceMode}
                      accent={myCrew?.territory_color || "#22D1C3"}
                    />
                  )}
                  {!walking && process.env.NODE_ENV !== "production" && (
                    <button
                      onClick={clearMap}
                      style={{
                        background: "rgba(18, 26, 46, 0.6)",
                        backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
                        padding: "8px 12px", borderRadius: 12,
                        border: `1px solid ${ACCENT}66`,
                        color: ACCENT, fontSize: 11, fontWeight: 700, cursor: "pointer",
                      }}
                    >
                      {tMD("labelClearMap")}
                    </button>
                  )}
                  {/* Hilfe / Intro / Karten-Legende / FAQ — als Submenü ans Ende des Controls-Stacks */}
                  <MapHelpButton inline />
                </>
              )}
            </div>

            {/* Wake-Lock-Hinweis während Lauf */}
            {walking && !wakeHintDismissed && (
              <div style={{
                position: "absolute", top: 90, left: 12, right: 12, zIndex: 55,
                padding: "8px 12px", borderRadius: 12,
                background: "rgba(15, 17, 21, 0.9)",
                backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                border: `1px solid ${wakeLock.locked ? "#4ade8055" : "#FFD70055"}`,
                display: "flex", alignItems: "center", gap: 10,
                fontSize: 11, color: "#FFF",
                boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
              }}>
                <span style={{ fontSize: 16 }}>{wakeLock.locked ? "🔋" : wakeLock.supported ? "⚠️" : "📵"}</span>
                <div style={{ flex: 1, lineHeight: 1.4 }}>
                  {wakeLock.locked && tMD.rich("screenStaysOn", { b: (c) => <b>{c}</b> })}
                  {!wakeLock.locked && wakeLock.supported && <><b>Screen-an fehlgeschlagen</b> · tippe den Screen um ihn wach zu halten.</>}
                  {!wakeLock.supported && <><b>iOS Safari</b> · Tracking pausiert wenn Screen schläft. Für Dauerbetrieb: App installieren.</>}
                </div>
                <button
                  onClick={() => setScreenLocked(true)}
                  style={{
                    padding: "5px 10px", borderRadius: 8,
                    background: "#FFD700", color: BG_DEEP,
                    border: "none", fontSize: 11, fontWeight: 900, cursor: "pointer",
                  }}
                >🔒 Sperren</button>
                <button
                  onClick={() => setWakeHintDismissed(true)}
                  aria-label={tMD("ariaCloseHint")}
                  style={{
                    background: "transparent", border: "none", color: MUTED,
                    fontSize: 16, lineHeight: 1, cursor: "pointer", padding: 2,
                  }}
                >×</button>
              </div>
            )}

            {/* Losgehen-Button entfernt (Pivot 2026-05-05): Walking als Gameplay weg, March-System ersetzt */}
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
              equippedMarkerVariant={equippedMarkerVariant}
              setEquippedMarkerVariant={setEquippedMarkerVariant}
              equippedLight={equippedLight}
              setEquippedLight={setEquippedLight}
              setPinThemeOverride={setPinThemeOverride}
              recentRuns={recentRuns}
              territoryCount={territoryCount}
              currentStreet={currentStreet}
              walking={walking}
              myCrew={myCrew}
              setMyCrew={setMyCrew}
              setActiveTab={setActiveTab}
              onOpenMmrRanking={() => { setRankingInitialMode("mmr"); setActiveTab("ranking"); }}
              onLogout={handleLogout}
              onSwitchToMap={() => setActiveTab("map")}
              distance={distance}
              onOpenBase={(id) => { setActiveTab("map"); setBaseModalTarget({ kind: "runner", id, is_own: true }); }}
              onPlaceBase={() => { setActiveTab("map"); setPlaceBaseMode("runner"); }}
            />
          </div>
        )}

        {/* ══ CREW TAB ══ */}
        {activeTab === "crew" && (
          <div style={{ height: "100%", overflowY: "auto" }}>
            <CrewTab profile={p} myCrew={myCrew} setMyCrew={setMyCrew} setProfile={setProfile} onOpenRanking={() => setActiveTab("ranking")} />
          </div>
        )}

        {/* ══ RANKING TAB ══ */}
        {activeTab === "ranking" && (
          <div style={{ height: "100%", overflowY: "auto" }}>
            <RankingTab profile={p} leaderboard={leaderboard} initialMode={rankingInitialMode} />
          </div>
        )}
      </div>

      {/* ══ LAUF-BILDSCHIRM-SPERRE ══ */}
      {screenLocked && (
        <LockOverlay
          onUnlock={() => setScreenLocked(false)}
          teamColor={teamColor}
          walking={walking}
          currentStreet={currentStreet}
          distance={distance}
        />
      )}

      {/* Runner-Profil-Modal (öffnet beim Klick auf Angreifer) */}
      {viewingRunner && DEMO_RUNNERS[viewingRunner] && (
        <RunnerProfileModal
          runner={DEMO_RUNNERS[viewingRunner]}
          myFaction={profile?.faction || "syndicate"}
          onClose={() => setViewingRunner(null)}
        />
      )}

      {/* Territory-Detail-Modal */}
      {viewingArea && demoMap.claimed_areas.find((a) => a.id === viewingArea) && (
        <AreaDetailModal
          area={demoMap.claimed_areas.find((a) => a.id === viewingArea)!}
          onClose={() => setViewingArea(null)}
          onViewRunner={(username) => {
            setViewingArea(null);
            setViewingRunner(username);
          }}
        />
      )}

      {/* Base-Modal (eigenes oder fremdes Pin) */}
      {baseModalTarget && (
        <BaseModal target={baseModalTarget} onClose={() => setBaseModalTarget(null)} />
      )}

      {/* Profil-Modal: Dashboard-Karten (Base/Wächter/Crew) als Overlay über der Map */}
      {profileModalOpen && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9100,
          background: "rgba(0,0,0,0.78)",
          display: "flex", alignItems: "stretch", justifyContent: "center",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
        }}>
          <div style={{
            width: "100%", maxWidth: 720, height: "100%",
            background: "linear-gradient(180deg, #0F1115 0%, #14181f 100%)",
            position: "relative", overflowY: "auto",
            borderLeft: "1px solid rgba(255,255,255,0.08)",
            borderRight: "1px solid rgba(255,255,255,0.08)",
          }}>
            <button
              onClick={() => setProfileModalOpen(false)}
              style={{
                position: "absolute", top: 8, right: 8,
                width: 36, height: 36, borderRadius: 18,
                background: "rgba(15,17,21,0.92)",
                border: "1px solid rgba(255,255,255,0.18)",
                color: "#fff", fontSize: 18, fontWeight: 900,
                cursor: "pointer", zIndex: 5,
              }}
              aria-label={tMD("ariaClose")}
            >×</button>
            <div style={{ padding: "0 0 80px" }}>
              <ProfilTab
                profile={p}
                setProfile={setProfile}
                equippedMarker={equippedMarker}
                setEquippedMarker={setEquippedMarker}
                equippedMarkerVariant={equippedMarkerVariant}
                setEquippedMarkerVariant={setEquippedMarkerVariant}
                equippedLight={equippedLight}
                setEquippedLight={setEquippedLight}
                setPinThemeOverride={setPinThemeOverride}
                recentRuns={recentRuns}
                territoryCount={territoryCount}
                currentStreet={currentStreet}
                walking={walking}
                myCrew={myCrew}
                setMyCrew={setMyCrew}
                setActiveTab={setActiveTab}
                onOpenMmrRanking={() => { setRankingInitialMode("mmr"); setActiveTab("ranking"); setProfileModalOpen(false); }}
                onLogout={handleLogout}
                onSwitchToMap={() => setProfileModalOpen(false)}
                distance={distance}
                onOpenBase={(id) => { setProfileModalOpen(false); setBaseModalTarget({ kind: "runner", id, is_own: true }); }}
                onPlaceBase={() => { setProfileModalOpen(false); setPlaceBaseMode("runner"); }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Crew-Modal: vollwertige CrewTab-Inhalte als Overlay über der Karte
          (alle 12 Subtabs: Übersicht/Feed/Mitglieder/Wächter/Challenges/Events/Chat/
          Forschung/Bauwerke/Kopfgelder/Lagerhaus/Einstellungen) */}
      {mapCrewModalOpen && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9100,
          background: "rgba(0,0,0,0.78)",
          display: "flex", alignItems: "stretch", justifyContent: "center",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
        }}>
          <div style={{
            width: "100%", maxWidth: 960, height: "100%",
            background: "linear-gradient(180deg, #0F1115 0%, #14181f 100%)",
            position: "relative", overflowY: "auto",
            borderLeft: "1px solid rgba(255,255,255,0.08)",
            borderRight: "1px solid rgba(255,255,255,0.08)",
          }}>
            <button
              onClick={() => setMapCrewModalOpen(false)}
              style={{
                position: "absolute", top: 8, right: 8,
                width: 36, height: 36, borderRadius: 18,
                background: "rgba(15,17,21,0.92)",
                border: "1px solid rgba(255,255,255,0.18)",
                color: "#fff", fontSize: 18, fontWeight: 900,
                cursor: "pointer", zIndex: 5,
              }}
              aria-label={tMD("ariaClose")}
            >×</button>
            <div style={{ padding: "0 0 80px" }}>
              <CrewTab
                profile={p}
                myCrew={myCrew}
                setMyCrew={setMyCrew}
                setProfile={setProfile}
                onOpenRanking={() => { setMapCrewModalOpen(false); setActiveTab("ranking"); }}
                onPlaceBuilding={(kind) => {
                  setMapCrewModalOpen(false);
                  if (kind === "hq" || kind === "mega" || kind === "repeater") {
                    setRepeaterPlaceMode({ kind });
                    setRepeaterPlaceCursor(userCenter);
                  } else {
                    setBuildingPlaceMode({ kind });
                    setRepeaterPlaceCursor(userCenter);
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Repeater-Info-Popup — schwebt direkt neben dem Pin, kein Backdrop.
          Click irgendwo auf Karte schließt. Nur fremde Repeater haben "Angreifen". */}
      {repeaterInfoTarget && (
        <RepeaterInfoPopup
          repeater={repeaterInfoTarget.r}
          anchorX={repeaterInfoTarget.x}
          anchorY={repeaterInfoTarget.y}
          userCenter={userCenter}
          onClose={() => setRepeaterInfoTarget(null)}
          onAttack={() => {
            const r = repeaterInfoTarget.r;
            setRepeaterInfoTarget(null);
            setAttackRepeaterTarget(r);
          }}
          onDestroyed={() => {
            // Turf neu laden — zerstörter Repeater verschwindet, Crew-Polygon schrumpft
            if (userCenter) {
              const dLat = 0.090, dLng = 0.140;
              const bbox = [userCenter.lat - dLat, userCenter.lng - dLng, userCenter.lat + dLat, userCenter.lng + dLng].join(",");
              fetch(`/api/crews/turf?bbox=${bbox}`, { cache: "no-store" })
                .then((r) => r.json())
                .then((j) => { setCrewRepeaters(j.repeaters ?? []); setCrewTurfPolygons(j.turf ?? []); setCrewBlocks(j.blocks ?? []); setCrewBuildings(j.buildings ?? []); });
            }
          }}
          onRepaired={() => {
            // Repeater-Liste neu laden (HP-Update)
            if (userCenter) {
              const dLat = 0.090, dLng = 0.140;
              const bbox = [userCenter.lat - dLat, userCenter.lng - dLng, userCenter.lat + dLat, userCenter.lng + dLng].join(",");
              fetch(`/api/crews/turf?bbox=${bbox}`, { cache: "no-store" })
                .then((r) => r.json())
                .then((j) => { setCrewRepeaters(j.repeaters ?? []); setCrewTurfPolygons(j.turf ?? []); setCrewBlocks(j.blocks ?? []); setCrewBuildings(j.buildings ?? []); });
            }
          }}
        />
      )}

      {/* Angriffs-Modal — wenn fremde Spieler-Base getappt wird */}
      {attackTarget && (
        <AttackBaseModal
          defenderUserId={attackTarget.defenderUserId}
          anchorX={attackTarget.x}
          anchorY={attackTarget.y}
          onClose={() => setAttackTarget(null)}
        />
      )}

      {/* Crew-Mate-Tap → CrewMemberModal (Avatar/Stats/Unterstützen/Verstärken) */}
      {crewMemberTarget && (
        <CrewMemberModal
          userId={crewMemberTarget.userId}
          anchorX={crewMemberTarget.x}
          anchorY={crewMemberTarget.y}
          onClose={() => setCrewMemberTarget(null)}
        />
      )}

      {/* Heimat-Karte CoD-UX Overlay (Tap-Action-Menü + Multi-Aufgebot + Verstecken + Eingehende Märsche) */}
      <HeimatOverlay
        tapPosition={heimatTapPos}
        onCloseTap={() => { setHeimatTapPos(null); setHeimatTapDefender(null); }}
        onEnterRelocateMode={() => { setHeimatRelocateMode(true); setHeimatTapPos(null); }}
        defenderUserId={heimatTapDefender?.id ?? null}
        defenderName={heimatTapDefender?.name ?? null}
      />

      {/* Verlegen-Modus: Banner oben + Bestätigung wenn Ziel gesetzt */}
      {heimatRelocateMode && !heimatRelocateTarget && (
        <div className="fixed inset-x-2 top-16 z-[9080] bg-[#22D1C3] text-[#0F1115] rounded-xl p-3 text-center font-bold shadow-2xl max-w-md mx-auto">
          🏠 Long-Press auf neue Position halten zum Verlegen
          <button
            onClick={() => setHeimatRelocateMode(false)}
            className="ml-3 text-xs underline"
          >Abbrechen</button>
        </div>
      )}
      {heimatRelocateMode && heimatRelocateTarget && profile && (
        <HeimatRelocateConfirm
          newLat={heimatRelocateTarget.lat}
          newLng={heimatRelocateTarget.lng}
          currentLat={(profile as { base_lat?: number }).base_lat ?? userCenter?.lat ?? 0}
          currentLng={(profile as { base_lng?: number }).base_lng ?? userCenter?.lng ?? 0}
          onCancel={() => { setHeimatRelocateMode(false); setHeimatRelocateTarget(null); }}
          onSuccess={() => {
            setHeimatRelocateMode(false);
            setHeimatRelocateTarget(null);
            // Reload page state
            window.location.reload();
          }}
        />
      )}

      {/* Crew-Turf: Repeater setzen via Long-Press */}
      {placeRepeaterAt && (
        <PlaceRepeaterModal
          lat={placeRepeaterAt.lat}
          lng={placeRepeaterAt.lng}
          onClose={() => setPlaceRepeaterAt(null)}
          onPlaced={() => {
            // Polling triggern: bbox neu laden
            if (userCenter) {
              const dLat = 0.090, dLng = 0.140;
              const bbox = [userCenter.lat - dLat, userCenter.lng - dLng, userCenter.lat + dLat, userCenter.lng + dLng].join(",");
              fetch(`/api/crews/turf?bbox=${bbox}`, { cache: "no-store" })
                .then((r) => r.json())
                .then((j) => { setCrewRepeaters(j.repeaters ?? []); setCrewTurfPolygons(j.turf ?? []); setCrewBlocks(j.blocks ?? []); setCrewBuildings(j.buildings ?? []); });
            }
          }}
        />
      )}

      {/* Crew-Turf: Repeater-Pin Click → Angriff/Info */}
      {attackRepeaterTarget && (
        <AttackRepeaterModal
          repeater={attackRepeaterTarget}
          onClose={() => setAttackRepeaterTarget(null)}
          onAttacked={() => { void refreshCrewRallies(); /* Cron-Tick resolved den Angriff, Inbox-Report kommt automatisch */ }}
        />
      )}

      {/* Beitritts-Modal für Crew-Aufgebot gegen Spieler-Base */}
      {showJoinPbRally && pbRally && (
        <JoinPlayerBaseRallyModal
          rally={pbRally}
          onClose={() => setShowJoinPbRally(false)}
          onJoined={async () => {
            const r = await fetch("/api/base/rally", { cache: "no-store" });
            if (r.ok) {
              const j = await r.json() as { rally: PlayerBaseRallyState | null };
              setPbRally(j.rally);
            }
          }}
        />
      )}

      {/* Aktive Sammel-Märsche (Banner oben rechts) */}
      {activeMarches.length > 0 && !strongholdModalTarget && !baseModalTarget && !attackTarget && !gatherModalNode && (
        <ActiveMarchesBanner marches={activeMarches} onCancelled={() => { void refreshActiveMarches(); }} />
      )}

      {/* Sammel-Modal (Resource-Node-Click) */}

      {/* Inbox-Modal */}
      {inboxModalOpen && (
        <FullscreenMapModal title={tMD("labelInbox")} onClose={() => setInboxModalOpen(false)}>
          <InboxClient />
        </FullscreenMapModal>
      )}

      {/* Ranking-Modal */}
      {rankingModalOpen && (
        <FullscreenMapModal title={tMD("labelLeaderboard")} onClose={() => setRankingModalOpen(false)}>
          <RankingTab profile={p} leaderboard={leaderboard} initialMode={rankingInitialMode} />
        </FullscreenMapModal>
      )}

      {gatherModalNode && (
        <GatherModal
          node={gatherModalNode.n}
          anchorX={gatherModalNode.x}
          anchorY={gatherModalNode.y}
          userCenter={userCenter}
          basePos={ownBasePos}
          onClose={() => setGatherModalNode(null)}
          onSuccess={() => { void refreshActiveMarches(); }}
        />
      )}

      {/* Stronghold-Popup (Wegelager-Pin auf der Map — neben dem Pin) */}
      {strongholdModalTarget && (
        <StrongholdModal
          stronghold={strongholdModalTarget.s}
          anchorX={strongholdModalTarget.x}
          anchorY={strongholdModalTarget.y}
          onClose={() => setStrongholdModalTarget(null)}
          activeRally={rallyData?.rally ?? null}
          refreshRally={async () => {
            await refreshRally();
            if (userCenter) await fetchStrongholds(userCenter.lat, userCenter.lng);
          }}
        />
      )}

      {/* Place-Base Prompt — nur wenn eigene Base noch keine Position hat */}
      {!ownBaseHasPos && ownBaseId && !placeBaseMode && !baseModalTarget && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[900] px-4 py-3 rounded-2xl bg-[#0F1115]/95 backdrop-blur border-2 border-[#22D1C3] shadow-2xl flex items-center gap-3 max-w-sm">
          <div className="text-3xl">🏰</div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-black text-white">Setze deine Base</div>
            <div className="text-[10px] text-[#a8b4cf]">Tippe auf der Karte, wo dein Versteck stehen soll.</div>
          </div>
          <button onClick={() => setPlaceBaseMode("runner")}
            className="px-3 py-2 rounded-lg bg-[#22D1C3] text-[#0F1115] text-[11px] font-black">
            📍 PLATZIEREN
          </button>
        </div>
      )}
      {placeBaseMode && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[900] px-4 py-2 rounded-full bg-[#22D1C3] text-[#0F1115] text-xs font-black shadow-2xl flex items-center gap-3">
          <span>👆 Tippe auf der Karte, um deine Base zu setzen</span>
          <button onClick={() => setPlaceBaseMode(null)} className="opacity-70 hover:opacity-100">✕</button>
        </div>
      )}
      {repeaterPlaceMode && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[900] px-4 py-2 rounded-full text-[#0F1115] text-xs font-black shadow-2xl flex items-center gap-3"
             style={{ background: myCrew?.territory_color || "#22D1C3" }}>
          <span>
            👆 {repeaterPlaceMode.kind === "hq" ? tMD("labelHQ") : repeaterPlaceMode.kind === "mega" ? tMD("labelMegaRepeater") : tMD("labelRepeater")} platzieren — Coverage muss bestehenden Repeater berühren
          </span>
          <button onClick={() => { setRepeaterPlaceMode(null); setRepeaterPlaceCursor(null); }} className="opacity-70 hover:opacity-100">✕</button>
        </div>
      )}
      {buildingPlaceMode && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[900] px-4 py-2 rounded-full text-[#0F1115] text-xs font-black shadow-2xl flex items-center gap-3"
             style={{ background: myCrew?.territory_color || "#22D1C3" }}>
          <span>
            👆 {buildingPlaceMode.kind === "blackmarket" ? "Schwarzmarkt"
              : buildingPlaceMode.kind === "bunker" ? "Bunker"
              : buildingPlaceMode.kind === "hangout" ? "Kiez-Treffpunkt"
              : "Tunnel"} platzieren — muss im eigenen Crew-Turf liegen
          </span>
          <button onClick={() => { setBuildingPlaceMode(null); setRepeaterPlaceCursor(null); }} className="opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Missionen-Modal */}
      {missionsOpen && (
        <MissionsModal onClose={() => setMissionsOpen(false)} />
      )}
      {legendOpen && <MapLegendModal onClose={() => setLegendOpen(false)} />}

      {/* Area-Boss Modal */}
      {viewingBoss && (() => {
        const boss = mapFeatures?.boss_raids.find((b) => b.id === viewingBoss);
        if (!boss) return null;
        const distM = userCenter
          ? Math.round(6371000 * 2 * Math.asin(Math.sqrt(
              Math.sin(((boss.lat - userCenter.lat) * Math.PI / 180) / 2) ** 2 +
              Math.cos(userCenter.lat * Math.PI / 180) * Math.cos(boss.lat * Math.PI / 180) *
              Math.sin(((boss.lng - userCenter.lng) * Math.PI / 180) / 2) ** 2
            )))
          : null;
        const inRange = distM !== null && distM <= 500;
        return (
          <BossRaidModal
            boss={boss}
            distM={distM}
            inRange={inRange}
            onClose={() => setViewingBoss(null)}
            onAttack={async () => {
              if (!userCenter) { await appAlert(tMD("gpsRequired")); return; }
              const res = await fetch("/api/map-features", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "boss_damage",
                  raid_id: boss.id,
                  damage: Math.floor(500 + Math.random() * 1500),
                  user_lat: userCenter.lat,
                  user_lng: userCenter.lng,
                }),
              });
              const data = await res.json();
              if (data.error === "too_far") { await appAlert(tMD("tooFar", { meters: data.distance_m })); return; }
              if (data.error === "location_required") { await appAlert(tMD("gpsRequiredShort")); return; }
              if (data.error === "crew_full") { await appAlert(tMD("crewFull")); return; }
              if (data.defeated) await appAlert(tMD("areaBossDefeated"));
              const r = await fetch("/api/map-features", { cache: "no-store" });
              if (r.ok) setMapFeatures(await r.json());
            }}
          />
        );
      })()}

      {/* Power-Zone Info Modal */}
      {viewingPowerZone && (() => {
        const z = mapFeatures?.power_zones.find((x) => x.id === viewingPowerZone);
        if (!z) return null;
        return <PowerZoneModal zone={z} onClose={() => setViewingPowerZone(null)} />;
      })()}

      {/* Sanctuary Training Modal */}
      {viewingSanctuary && (() => {
        const s = mapFeatures?.sanctuaries.find((x) => x.id === viewingSanctuary);
        if (!s) return null;
        const distM = userCenter
          ? Math.round(6371000 * 2 * Math.asin(Math.sqrt(
              Math.sin(((s.lat - userCenter.lat) * Math.PI / 180) / 2) ** 2 +
              Math.cos(userCenter.lat * Math.PI / 180) * Math.cos(s.lat * Math.PI / 180) *
              Math.sin(((s.lng - userCenter.lng) * Math.PI / 180) / 2) ** 2
            )))
          : null;
        const inRange = distM !== null && distM <= 50;
        return (
          <SanctuaryModal
            sanctuary={s}
            distM={distM}
            inRange={inRange}
            onClose={() => setViewingSanctuary(null)}
            onTrain={async () => {
              if (!userCenter) { await appAlert(tMD("gpsRequired")); return; }
              const res = await fetch("/api/map-features", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "train_sanctuary", sanctuary_id: s.id, user_lat: userCenter.lat, user_lng: userCenter.lng }),
              });
              const data = await res.json();
              if (data.error === "already_trained_today") { await appAlert(tMD("alreadyTrainedToday")); return; }
              if (data.error === "too_far") { await appAlert(tMD("tooFarTemple", { meters: data.distance_m })); return; }
              if (data.error === "location_required") { await appAlert(tMD("gpsRequired")); return; }
              if (data.ok) {
                await appAlert(`🙏 +${data.xp_gained} Wächter-Erfahrung`);
                const r = await fetch("/api/map-features", { cache: "no-store" });
                if (r.ok) setMapFeatures(await r.json());
              }
              setViewingSanctuary(null);
            }}
          />
        );
      })()}

      <VictoryDance trigger={victoryTrigger} />

      {ownershipQuery && (
        <OwnershipModal query={ownershipQuery} onClose={() => setOwnershipQuery(null)} />
      )}

      {walkSummary && profile && (
        <WalkSummaryModal
          summary={walkSummary}
          userId={profile.id}
          isPremium={isPremium(profile as never)}
          onClose={(bonusXp) => {
            if (bonusXp > 0) {
              const next = (profile.wegemuenzen ?? profile.xp ?? 0) + bonusXp;
              setProfile({ ...profile, wegemuenzen: next, xp: next });
            }
            setWalkSummary(null);
          }}
        />
      )}

      {preWalkModal && (
        <div
          onClick={preWalkModal === "asking" ? skipPreWalkAd : undefined}
          style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(15,17,21,0.92)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 400, background: "#1A1D23", borderRadius: 20, padding: 24, border: "1px solid rgba(255,215,0,0.35)", color: "#F0F0F0" }}>
            {preWalkModal === "asking" ? (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 6 }}>🎁</div>
                <div style={{ color: "#FFF", fontSize: 20, fontWeight: 900, marginBottom: 4 }}>{tPre("title")}</div>
                <div style={{ color: "#a8b4cf", fontSize: 13, lineHeight: 1.55, marginBottom: 18 }}>
                  {tPre.rich("subtitle", { b: (c) => <b style={{ color: "#FFD700" }}>{c}</b> })}<br/>
                  <span style={{ color: "#8B8FA3", fontSize: 11 }}>
                    {tPre.rich("hint", { b: (c) => <b>{c}</b> })}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={skipPreWalkAd} style={{ flex: 1, padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.18)", color: "#FFF", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                    {tPre("skipButton")}
                  </button>
                  <button onClick={playPreWalkAd} style={{ flex: 1, padding: "12px 16px", borderRadius: 12, background: "linear-gradient(135deg,#FFD700,#FF6B4A)", border: "none", color: "#0F1115", fontSize: 13, fontWeight: 900, cursor: "pointer" }}>
                    {tPre("watchButton")}
                  </button>
                </div>
                <div style={{ color: "#6c7590", fontSize: 10, marginTop: 10 }}>
                  {tPre("footer")}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 6 }}>📺</div>
                <div style={{ color: "#FFF", fontSize: 18, fontWeight: 900, marginBottom: 4 }}>{tPre("playingTitle")}</div>
                <div style={{ color: "#a8b4cf", fontSize: 12, marginBottom: 16 }}>
                  {tPre.rich("playingSubtitle", { b: (c) => <b style={{ color: "#FFD700" }}>{c}</b> })}
                </div>
                <div style={{ height: 8, background: "rgba(255,255,255,0.1)", borderRadius: 4, overflow: "hidden", marginBottom: 12 }}>
                  <div style={{ width: `${preWalkAdProgress}%`, height: "100%", background: "linear-gradient(90deg,#22D1C3,#FFD700)", transition: "width 0.1s linear" }} />
                </div>
                <div style={{ color: "#22D1C3", fontSize: 11, fontWeight: 800, marginBottom: 14 }}>
                  {tPre("secondsLeft", { seconds: Math.ceil((100 - preWalkAdProgress) * 0.3) })}
                </div>
                <button onClick={skipPreWalkAd} style={{ background: "none", border: "1px solid rgba(255,255,255,0.15)", color: "#a8b4cf", padding: "6px 14px", borderRadius: 8, fontSize: 11, cursor: "pointer" }}>
                  {tPre("skipDuringPlaying")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {streakSaveModal && profile && (
        <div
          onClick={streakSaveModal === "asking" ? skipStreakSaveAd : undefined}
          style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(15,17,21,0.92)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 400, background: "#1A1D23", borderRadius: 20, padding: 24, border: "1px solid rgba(255,107,74,0.45)", color: "#F0F0F0" }}>
            {streakSaveModal === "asking" ? (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 6 }}>🔥</div>
                <div style={{ color: "#FFF", fontSize: 20, fontWeight: 900, marginBottom: 4 }}>{tStreak("title")}</div>
                <div style={{ color: "#a8b4cf", fontSize: 13, lineHeight: 1.5, marginBottom: 18 }}>
                  {tStreak.rich("subtitle", { days: profile.streak_days, b: (c) => <b style={{ color: "#FF6B4A" }}>{c}</b> })}<br/>
                  <span style={{ color: "#8B8FA3", fontSize: 11 }}>{tStreak("hint")}</span>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={skipStreakSaveAd} style={{ flex: 1, padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#a8b4cf", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                    {tStreak("skipButton")}
                  </button>
                  <button onClick={playStreakSaveAd} style={{ flex: 1, padding: "12px 16px", borderRadius: 12, background: "linear-gradient(135deg,#FF6B4A,#FF2D78)", border: "none", color: "#FFF", fontSize: 13, fontWeight: 900, cursor: "pointer" }}>
                    {tStreak("watchButton")}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 6 }}>📺</div>
                <div style={{ color: "#FFF", fontSize: 18, fontWeight: 900, marginBottom: 4 }}>{tStreak("playingTitle")}</div>
                <div style={{ color: "#a8b4cf", fontSize: 12, marginBottom: 16 }}>
                  {tStreak.rich("playingSubtitle", { days: profile.streak_days, b: (c) => <b style={{ color: "#FF6B4A" }}>{c}</b> })}
                </div>
                <div style={{ height: 8, background: "rgba(255,255,255,0.1)", borderRadius: 4, overflow: "hidden", marginBottom: 12 }}>
                  <div style={{ width: `${streakSaveAdProgress}%`, height: "100%", background: "linear-gradient(90deg,#FF6B4A,#FF2D78)", transition: "width 0.1s linear" }} />
                </div>
                <div style={{ color: "#FF6B4A", fontSize: 11, fontWeight: 800 }}>
                  {tStreak("secondsLeft", { seconds: Math.ceil((100 - streakSaveAdProgress) * 0.3) })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {rootRunnerProfileUserId && (
        <RunnerStatsModal
          userId={rootRunnerProfileUserId}
          onClose={() => setRootRunnerProfileUserId(null)}
          canEditBanner={rootRunnerProfileUserId === initialProfile?.id}
        />
      )}

      {/* Modal-only DailyDealTeaser am MapDashboard-Root: lauscht auf das
          ma365:open-daily-deals-Event, das vom Map-Badge gefeuert wird.
          Auf Profil-Tab gibt's eine zweite Instanz mit sichtbarem Banner —
          beide listenen, modale rendern uebereinander (identisch), aber
          Map-Badge funktioniert auf jedem Tab. */}
      {initialProfile && activeTab !== "profil" && <DailyDealTeaser bannerHidden />}

      {/* In-App-Routing-Banner: oben sichtbar waehrend zu einem Shop navigiert wird */}
      {routingRoute && (
        <RouteBanner
          route={routingRoute}
          userPos={userCenter}
          onCancel={() => setRoutingRoute(null)}
          onArrived={() => { /* Toast wird im Banner gezeigt */ }}
        />
      )}

      {/* Unified Shop-Hub — top-level mount damit auch von der Map-Tab SHOPS-Button erreichbar */}
      {showShopHubGlobal && profile && (
        <ShopHubModal
          userId={profile.id}
          initialTab={shopHubGlobalTab}
          isAdmin={["admin","super_admin"].includes((profile as unknown as { role?: string })?.role ?? "user")}
          onClose={() => setShowShopHubGlobal(false)}
        />
      )}

      {/* Top-Level Overlays: Pop-Ups, Desktop-Bonus, ResourceBar */}
      <PopupOfferGate />
      <DesktopWebBonusTrigger />
      <ResourceBar onAddGems={() => setMapGemShopOpen(true)} />
      {mapGemShopOpen && <GemShopModal onClose={() => setMapGemShopOpen(false)} />}
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
  equippedMarkerVariant,
  setEquippedMarkerVariant,
  equippedLight,
  setEquippedLight,
  setPinThemeOverride,
  recentRuns,
  territoryCount,
  currentStreet,
  walking,
  myCrew,
  setMyCrew,
  setActiveTab,
  onOpenMmrRanking,
  onLogout,
  onSwitchToMap,
  distance,
  onOpenBase,
  onPlaceBase,
}: {
  profile: Profile | null;
  setProfile: (p: Profile) => void;
  equippedMarker: string;
  setEquippedMarker: (s: string) => void;
  equippedMarkerVariant: "neutral" | "male" | "female";
  setEquippedMarkerVariant: (v: "neutral" | "male" | "female") => void;
  equippedLight: string;
  setEquippedLight: (s: string) => void;
  setPinThemeOverride: (t: import("@/lib/pin-themes").PinTheme | null) => void;
  recentRuns: Territory[];
  territoryCount: number;
  currentStreet: string | null;
  walking: boolean;
  myCrew: Crew | null;
  setMyCrew: (c: Crew | null) => void;
  setActiveTab: (t: TabId) => void;
  onOpenMmrRanking: () => void;
  onLogout: () => void;
  onSwitchToMap: () => void;
  distance: number;
  onOpenBase: (baseId: string) => void;
  onPlaceBase: () => void;
}) {
  const supabase = createClient();
  const tMD = useTranslations("MapDashboard");
  const tXG = useTranslations("XpGuide");
  const resourceArt = useResourceArt();
  const baseThemeArt = useBaseThemeArt();
  const markerArt = useMarkerArt();
  const uiIconArt = useUiIconArt();
  const baseRingArt = useBaseRingArt();

  // ═══ Premium-Hub Modals (Inventar, Wachstumsfond, Monatspakete, Berlin-Rad, Schmiede) ═══
  const [showInventory, setShowInventory] = useState(false);
  const [showGrowthFund, setShowGrowthFund] = useState(false);
  const [showMonthly, setShowMonthly] = useState(false);
  const [showWheel, setShowWheel] = useState(false);
  const [showForge, setShowForge] = useState(false);
  const [showLootHub, setShowLootHub] = useState(false);

  // ═══ Base-Banner-State (eigene Base-Daten für Hero-Banner) ═══
  const [ownBaseId, setOwnBaseId] = useState<string | null>(null);
  const [ownBaseHasPos, setOwnBaseHasPos] = useState<boolean>(false);
  const [ownBaseInfo, setOwnBaseInfo] = useState<{ level: number; plz: string; lat: number | null; lng: number | null; theme_id: string; theme_name: string; pin_emoji: string; accent: string; resources: { wood: number; stone: number; gold: number; mana: number; speed_tokens: number }; queue_count: number; chest_count: number } | null>(null);
  useEffect(() => {
    return deferIdle(() => void (async () => {
      try {
        const r = await fetch("/api/base/me", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json() as {
          base: { id: string; level: number; plz: string; lat: number | null; lng: number | null; theme_id: string } | null;
          resources: { wood: number; stone: number; gold: number; mana: number; speed_tokens: number };
          queue: unknown[]; chests: unknown[];
          themes: Array<{ id: string; name: string; pin_emoji: string; accent_color: string }>;
        };
        if (!j.base) return;
        setOwnBaseId(j.base.id);
        setOwnBaseHasPos(j.base.lat != null && j.base.lng != null);
        const t = (j.themes ?? []).find((x) => x.id === j.base!.theme_id);
        setOwnBaseInfo({
          level: j.base.level, plz: j.base.plz,
          lat: j.base.lat, lng: j.base.lng,
          theme_id: j.base.theme_id,
          theme_name: t?.name ?? "Mittelalter",
          pin_emoji: t?.pin_emoji ?? "🏰",
          accent: t?.accent_color ?? "#22D1C3",
          resources: j.resources ?? { wood: 0, stone: 0, gold: 0, mana: 0, speed_tokens: 0 },
          queue_count: (j.queue ?? []).length,
          chest_count: (j.chests ?? []).length,
        });
      } catch {}
    })());
  }, []);

  // ═══ DEMO-OVERLAY ═══
  // Aktiv wenn entweder DEMO_MODE global und Profil leer ODER User hat Demo-Overlay manuell aktiviert
  const [demoOverride, setDemoOverride] = useState(false);
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        setDemoOverride(window.localStorage.getItem("demoOverrideProfile") === "1");
      }
    } catch { /* ignore */ }
  }, []);

  // Onboarding-Modal beim ersten Login automatisch zeigen
  useEffect(() => {
    if (origP && shouldShowOnboarding()) {
      const t = setTimeout(() => setOpenModal("onboarding"), 600);
      return () => clearTimeout(t);
    }
  }, [origP]);
  const toggleDemoOverride = () => {
    const next = !demoOverride;
    setDemoOverride(next);
    try { window.localStorage.setItem("demoOverrideProfile", next ? "1" : "0"); } catch { /* ignore */ }
  };
  const isEmptyProfile = !origP || ((origP.xp || 0) === 0 && (origP.total_walks || 0) === 0);
  const useDemo = (DEMO_MODE && isEmptyProfile) || demoOverride;
  const p: Profile | null = useDemo && origP
    ? ({ ...origP, ...DEMO_STATS } as Profile)
    : origP;
  // Demo-Runs nur EINMAL pro Session generieren — sonst spuckt Math.random
  // bei jedem Render andere Werte aus → Heatmap & Run-Liste flackern.
  const memoDemoRuns = useMemo(() => generateDemoRecentRuns() as Territory[], []);
  const effectiveRecentRuns: Territory[] = useDemo && recentRuns.length === 0
    ? memoDemoRuns
    : recentRuns;
  const effectiveTerritoryCount = useDemo && territoryCount === 0
    ? DEMO_STATS.territory_count
    : territoryCount;

  const userXp = p?.wegemuenzen ?? p?.xp ?? 0;
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

  const [openModal, setOpenModal] = useState<null | "health" | "settings" | "xpguide" | "achievements" | "ranks" | "inbox" | "support" | "arena" | "faq" | "onboarding">(null);
  const rankArt = useRankArt();
  const [showUpgrade, setShowUpgrade] = useState<null | "plus" | "crew">(null);
  const [showBoostShop, setShowBoostShop] = useState(false);
  const [showGemShop, setShowGemShop] = useState(false);
  const [showShopHub, setShowShopHub] = useState(false);
  const [shopHubInitialTab, setShopHubInitialTab] = useState<"deals" | "plus" | "power" | "gems" | "cosmetics">("deals");

  // ShopHub-Listener lebt auf MapDashboard-Top-Level — nicht hier doppeln.
  const [runnerProfileUserId, setRunnerProfileUserId] = useState<string | null>(null);
  const [guideShopExpanded, setGuideShopExpanded] = useState(false);

  // Crew-Modal-State (öffnet sich per Click auf Crew-Banner)
  const [crewModalOpen, setCrewModalOpen] = useState(false);

  // Ansehen (Power/Might wie RoK/CoD) — eigene Fetch, lebt auf users.ansehen
  const [ansehen, setAnsehen] = useState<number | null>(null);
  useEffect(() => {
    if (!p?.id) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.from("users").select("ansehen").eq("id", p.id).maybeSingle();
      if (!cancelled) setAnsehen((data as { ansehen?: number } | null)?.ansehen ?? 0);
    })();
    const iv = setInterval(async () => {
      const { data } = await supabase.from("users").select("ansehen").eq("id", p!.id).maybeSingle();
      if (!cancelled) setAnsehen((data as { ansehen?: number } | null)?.ansehen ?? 0);
    }, 60000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [p?.id, supabase]);

  // Aktiver Wächter für den Profil-Teaser-Block
  type ActiveGuardian = {
    id: string; level: number; wins: number; losses: number;
    current_hp_pct: number;
    archetype: { id: string; name: string; emoji: string; rarity: string; guardian_type: string | null; image_url: string | null; video_url: string | null } | null;
    siegel_count: number;
  };
  const [activeGuardian, setActiveGuardian] = useState<ActiveGuardian | null>(null);
  const [teaserDetailOpen, setTeaserDetailOpen] = useState(false);

  // Crew-Turf-Summary für Banner-Anzeige (Repeater-Count + has_hq)
  const [crewSummary, setCrewSummary] = useState<{ count_alive: number; has_hq: boolean } | null>(null);
  useEffect(() => {
    if (!myCrew) { setCrewSummary(null); return; }
    let cancelled = false;
    const load = async () => {
      const sb = createClient();
      const { data } = await sb.rpc("my_crew_repeater_summary");
      if (!cancelled && data) {
        setCrewSummary({
          count_alive: (data as { count_alive?: number })?.count_alive ?? 0,
          has_hq: !!(data as { has_hq?: boolean })?.has_hq,
        });
      }
    };
    const cancelIdle = deferIdle(() => { void load(); });
    const iv = setInterval(load, 60000);
    return () => { cancelled = true; cancelIdle(); clearInterval(iv); };
  }, [myCrew]);
  const [guardianGalleryData, setGuardianGalleryData] = useState<{
    archetypes: import("@/lib/guardian").GuardianArchetype[];
    owned: Array<{ id: string; archetype_id: string; level: number; is_active: boolean }>;
    active_id: string | null;
  } | null>(null);
  const [guardianGalleryOpen, setGuardianGalleryOpen] = useState(false);

  async function openGuardianGallery() {
    try {
      const res = await fetch("/api/guardian/my-collection");
      if (!res.ok) { alert(tMD("guardianCollectionLoadFailed")); return; }
      const j = await res.json() as {
        owned: Array<{ id: string; archetype_id: string; level: number; is_active: boolean }>;
        archetypes: import("@/lib/guardian").GuardianArchetype[];
        active_id: string | null;
      };
      setGuardianGalleryData(j);
      setGuardianGalleryOpen(true);
    } catch {
      alert(tMD("loadingCollectionFailed"));
    }
  }
  useEffect(() => {
    if (!p?.id) return;
    let cancelled = false;
    (async () => {
      const { data: g } = await supabase.from("user_guardians")
        .select("id, level, wins, losses, current_hp_pct, archetype:archetype_id(id, name, emoji, rarity, guardian_type, image_url, video_url)")
        .eq("user_id", p.id).eq("is_active", true).maybeSingle();
      if (cancelled || !g) { setActiveGuardian(null); return; }
      const { count: siegelCount } = await supabase.from("user_siegel")
        .select("user_id", { count: "exact", head: true })
        .eq("user_id", p.id);
      if (cancelled) return;
      const arch = Array.isArray((g as { archetype?: unknown }).archetype)
        ? ((g as { archetype: unknown[] }).archetype[0] as ActiveGuardian["archetype"])
        : ((g as { archetype: unknown }).archetype as ActiveGuardian["archetype"]);
      setActiveGuardian({
        id: (g as { id: string }).id,
        level: (g as { level: number }).level,
        wins: (g as { wins: number }).wins,
        losses: (g as { losses: number }).losses,
        current_hp_pct: (g as { current_hp_pct: number }).current_hp_pct,
        archetype: arch,
        siegel_count: siegelCount ?? 0,
      });
    })();
    return () => { cancelled = true; };
  }, [p?.id, supabase]);

  // Click auf Runner-Badge im Map-Marker oeffnet Runner-Profil-Modal.
  // Drei parallele Wege, damit Mapbox den Klick nicht schlucken kann:
  //   1) Custom-Event vom Badge-eigenen onclick/addEventListener
  //   2) Document-Capture-Listener (faengt Click VOR allen anderen Handlern)
  useEffect(() => {
    const open = () => { if (p?.id) setRunnerProfileUserId(p.id); };
    const onOpen = () => open();
    const onDocClick = (e: MouseEvent | TouchEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest('[data-action="open-runner-profile"]')) {
        e.preventDefault();
        e.stopPropagation();
        open();
      }
    };
    window.addEventListener("ma365:open-runner-profile", onOpen);
    document.addEventListener("click", onDocClick, true);
    document.addEventListener("touchend", onDocClick as EventListener, true);
    return () => {
      window.removeEventListener("ma365:open-runner-profile", onOpen);
      document.removeEventListener("click", onDocClick, true);
      document.removeEventListener("touchend", onDocClick as EventListener, true);
    };
  }, [p?.id]);

  const handleRewardedAd = async () => {
    if (await appConfirm("📺 Schau dir ein kurzes Video an, um sofort +250 🪙 zu erhalten!")) {
      appAlert(tMD("donationThanks"));
    }
  };

  async function equipMarker(id: string, variant: "neutral" | "male" | "female" = "neutral") {
    setEquippedMarker(id);
    setEquippedMarkerVariant(variant);
    if (p) await supabase.from("users").update({ equipped_marker_id: id, equipped_marker_variant: variant }).eq("id", p.id);
    window.dispatchEvent(new CustomEvent("ma365:cosmetic-changed"));
  }

  async function equipLight(id: string) {
    setEquippedLight(id);
    if (p) await supabase.from("users").update({ equipped_light_id: id }).eq("id", p.id);
    window.dispatchEvent(new CustomEvent("ma365:cosmetic-changed"));
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

  // Rang-basiertes Motto via i18n (key by rank id, fallback Stufe 1)
  const motto = tMD(`motto${Math.max(1, Math.min(10, currentRankLive.id))}` as
    "motto1"|"motto2"|"motto3"|"motto4"|"motto5"|"motto6"|"motto7"|"motto8"|"motto9"|"motto10");

  // Achievements: Unlock-Status live berechnen aus Profilstats
  const stats = {
    longest_km:   (p?.longest_run_m || 0) / 1000,
    lifetime_km:  (p?.total_distance_m || 0) / 1000,
    territories:  effectiveTerritoryCount,
    segments:     (p as { segments_total?: number } | null)?.segments_total ?? 0,
    streets:      (p as { streets_total?: number } | null)?.streets_total ?? 0,
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

  // Voll-Liste (Modal): unlocked zuerst, dann höchster Progress
  const sortedAchievements = [...achievementStatus].sort((a, b) => {
    if (a.unlocked && !b.unlocked) return -1;
    if (!a.unlocked && b.unlocked) return 1;
    return b.pct - a.pct;
  });
  // Profil-Top-5: zeige, woran der Runner gerade arbeitet
  // (nicht-freigeschaltete nach Fortschritt absteigend; wenn weniger als 5 offen, mit zuletzt freigeschalteten auffüllen)
  const inProgress = achievementStatus
    .filter((a) => !a.unlocked)
    .sort((a, b) => b.pct - a.pct);
  const recentlyUnlocked = achievementStatus.filter((a) => a.unlocked);
  const topAchievements = [...inProgress, ...recentlyUnlocked].slice(0, 3);

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
            {/* Equippierter Base-Ring (Halo um das Avatar-Badge) — gleicher
                Look wie auf der Map, mit chroma-black Filter (greenscreen
                → transparent) und Scale-Up gegen das Padding im Artwork. */}
            {(() => {
              const ringId = (p as unknown as { equipped_base_ring_id?: string | null })?.equipped_base_ring_id;
              if (!ringId || ringId === "default") return null;
              const ringArt = baseRingArt[ringId];
              if (!ringArt?.image_url && !ringArt?.video_url) return null;
              const ringStyle: React.CSSProperties = {
                position: "absolute", top: "50%", left: "50%",
                transform: "translate(-50%, -50%) scale(1.5)",
                width: 150, height: 150, objectFit: "contain",
                filter: `url(#ma365-chroma-black) drop-shadow(0 0 10px ${teamColor}77)`,
                pointerEvents: "none", zIndex: 1,
              };
              return ringArt.video_url
                ? <video src={ringArt.video_url} autoPlay loop muted playsInline style={ringStyle} />
                : <img src={ringArt.image_url!} alt="" style={ringStyle} />;
            })()}
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
              {(() => {
                const a = markerArt[equippedMarker]?.[equippedMarkerVariant] ?? markerArt[equippedMarker]?.neutral;
                const dropShadow = "drop-shadow(0 4px 14px rgba(0,0,0,0.4))";
                if (a?.video_url) return <video src={a.video_url} autoPlay loop muted playsInline style={{ width: 110, height: 110, objectFit: "contain", filter: `url(#ma365-chroma-black) ${dropShadow}` }} />;
                if (a?.image_url) return <img src={a.image_url} alt="" style={{ width: 110, height: 110, objectFit: "contain", filter: `url(#ma365-chroma-black) ${dropShadow}` }} />;
                return <span style={{ fontSize: 66, filter: dropShadow }}>{currentMarker.icon}</span>;
              })()}
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
          {(p as unknown as { supporter_tier?: SupporterTier | null })?.supporter_tier && (
            <div style={{ marginTop: 6, display: "flex", justifyContent: "center" }}>
              <SupporterBadge tier={(p as unknown as { supporter_tier?: SupporterTier | null })?.supporter_tier} size="md" showLabel />
            </div>
          )}
          <div style={{ fontSize: 32, fontWeight: 900, color: "#FFF", marginTop: 4, textAlign: "center", display: "flex", alignItems: "center", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <RainbowName
              name={p?.display_name || p?.username || "Eroberer"}
              active={isRainbowActive((p as unknown as { rainbow_name_until?: string | null })?.rainbow_name_until)}
              size={32}
            />
          </div>
          <div style={{ color: MUTED, fontSize: 13, marginTop: 2 }}>@{p?.username}</div>

          {/* Motto */}
          <div style={{
            color: TEXT_SOFT, fontSize: 13, marginTop: 8,
            fontStyle: "italic", textAlign: "center", maxWidth: 340,
          }}>{motto}</div>

          {/* Rang-Badge + Streak-Badge */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 14, flexWrap: "wrap", justifyContent: "center" }}>
            <button
              onClick={() => setOpenModal("ranks")}
              title={tMD("titleCoinsExplain")}
              style={{
                paddingLeft: 6, paddingRight: 28, paddingTop: 4, paddingBottom: 4,
                borderRadius: 999, border: "none",
                background: currentRankLive.color,
                position: "relative", overflow: "hidden", cursor: "pointer",
                boxShadow: `0 4px 24px ${currentRankLive.color}60, inset 0 1px 0 rgba(255,255,255,0.4)`,
                display: "inline-flex", alignItems: "center", gap: 8,
              }}
              aria-label={tMD("ariaShowAllRanks")}
            >
              <span style={{ position: "relative", zIndex: 1 }}>
                <RankBadge rankId={currentRankLive.id} color={currentRankLive.color} size={32} rankArt={rankArt} />
              </span>
              <span style={{ position: "relative", zIndex: 1, color: BG_DEEP, fontWeight: 400, fontSize: 16, letterSpacing: 0.8, fontFamily: "var(--font-display-stack)", lineHeight: 1 }}>
                {currentRankLive.name} · {userXp.toLocaleString()} 🪙
              </span>
              <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", zIndex: 1, color: BG_DEEP, fontSize: 14, fontWeight: 900 }}>›</span>
              <span style={{
                position: "absolute", top: 0, left: "-50%", width: "50%", height: "100%",
                background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%)",
                animation: "rankShimmer 4s ease-in-out infinite",
                pointerEvents: "none",
              }} />
            </button>
            {ansehen !== null && (
              <div
                title={tMD("titlePowerScore", { n: ansehen.toLocaleString() })}
                style={{
                  paddingLeft: 6, paddingRight: 14, paddingTop: 4, paddingBottom: 4,
                  borderRadius: 999, border: "none",
                  background: "linear-gradient(135deg, #FFD700, #FFA500)",
                  position: "relative", overflow: "hidden",
                  boxShadow: "0 4px 24px rgba(255,215,0,0.45), inset 0 1px 0 rgba(255,255,255,0.4)",
                  display: "inline-flex", alignItems: "center", gap: 8,
                }}
              >
                <span style={{
                  width: 32, height: 32, borderRadius: 16,
                  background: "rgba(15,17,21,0.85)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#FFD700",
                }}>
                  <UiIcon slot="stat_ansehen" fallback="⚜" art={uiIconArt} size={20} />
                </span>
                <span style={{ color: BG_DEEP, fontWeight: 400, fontSize: 16, letterSpacing: 0.8, fontFamily: "var(--font-display-stack)", lineHeight: 1 }}>
                  Ansehen · {ansehen.toLocaleString()}
                </span>
                <span style={{
                  position: "absolute", top: 0, left: "-50%", width: "50%", height: "100%",
                  background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%)",
                  animation: "rankShimmer 4s ease-in-out infinite",
                  pointerEvents: "none",
                }} />
              </div>
            )}
            <DiamantPill />
            <BerlinCoveragePill />
            <SeasonPassPill />
          </div>
          <style>{`@keyframes rankShimmer { 0% { transform: translateX(0); } 100% { transform: translateX(400%); } }`}</style>

          {/* Next Rank — animierter Balken mit klaren Anker-Werten */}
          {nextRank && (
            <div style={{ width: "100%", maxWidth: 340, marginTop: 14 }}>
              {/* XP-Anker oberhalb des Balkens */}
              <div style={{
                display: "flex", justifyContent: "space-between",
                marginBottom: 5, fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
              }}>
                <span style={{ color: currentRankLive.color }}>
                  {userXp.toLocaleString()} 🪙
                </span>
                <span style={{ color: nextRank.color }}>
                  {nextRank.minXp.toLocaleString()} 🪙
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
                  noch <span style={{ color: "#FFF", fontWeight: 800 }}>{xpToNext.toLocaleString()}</span> 🪙
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ 3-WÄHRUNGEN-TRIO — immer sichtbar, Tap öffnet Guide ═══ */}
      <div style={{ padding: "0 20px", marginTop: 12 }}>
        <div
          onClick={() => setOpenModal("xpguide")}
          role="button"
          title={tMD("currencyTooltip")}
          style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8,
            padding: 10, borderRadius: 12, cursor: "pointer",
            background: "rgba(30, 38, 60, 0.45)",
            border: `1px solid ${BORDER}`,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#8B8FA3", fontWeight: 800, letterSpacing: 0.3 }}>🪙 WEGEMÜNZEN</div>
            <div style={{ fontSize: 15, color: "#FFD700", fontWeight: 900, marginTop: 2 }}>{(p?.wegemuenzen ?? p?.xp ?? 0).toLocaleString("de-DE")}</div>
          </div>
          <div style={{ textAlign: "center", borderLeft: `1px solid ${BORDER}`, borderRight: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: 11, color: "#8B8FA3", fontWeight: 800, letterSpacing: 0.3 }}>🏴 GEBIETSRUF</div>
            <div style={{ fontSize: 15, color: "#FF2D78", fontWeight: 900, marginTop: 2 }}>{(p?.gebietsruf ?? 0).toLocaleString("de-DE")}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#8B8FA3", fontWeight: 800, letterSpacing: 0.3 }}>⚔️ SESSIONEHRE</div>
            <div style={{ fontSize: 15, color: "#22D1C3", fontWeight: 900, marginTop: 2 }}>{(p?.sessionehre ?? 0).toLocaleString("de-DE")}</div>
          </div>
        </div>
        <div style={{ textAlign: "center", fontSize: 10, color: "#8B8FA3", marginTop: 4 }}>{tMD("currencyGuideHint")}</div>
      </div>

      {/* ═══ WAS DU HIER TUN KANNST — Aktivitäten-Overview mit Info-Modals ═══ */}
      <RunnerActivityCards />

      {/* ═══ Repeater-Tagesdividende (nur in Crew sichtbar, autohide ohne Repeater) ═══ */}
      <div style={{ paddingLeft: 20, paddingRight: 20, marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
        <DividendClaimCard />
        <CrewSynergyCard />
        <MentorCard />
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

        {/* ═══ TAGES-DEALS — Promo-Banner direkt unter dem Hero ═══ */}
        {p && (
          <div style={{ marginTop: 14 }}>
            <DailyDealTeaser />
          </div>
        )}

        {/* ═══ QUICK ACTIONS — 6 Kacheln: Arena · Angebote · Crew · Shop · Deals · Inbox ═══ */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
          gap: 8, marginTop: 14, width: "100%",
        }}>
          {[
            { key: "arena",      icon: "⚔️", label: "Arena",    color: "#FF2D78", title: tMD("titleSessionHonor"), onClick: () => setOpenModal("arena") },
            { key: "deals",      icon: "🔥", label: "Angebote", color: "#FFD700", title: "🔥 Tagesangebote: Bronze / Silber / Gold + SUPER-Bundle. Reset um 00:00 UTC.", onClick: () => { setShopHubInitialTab("deals"); setShowShopHub(true); } },
            { key: "crew",       icon: "👥", label: "Crew",     color: "#FFD700", title: tMD("titleTerritoryFame"), onClick: () => setActiveTab("crew") },
            { key: "shop",       icon: "💎", label: "Shop",     color: "#22D1C3", title: "💎 Alles was du kaufen kannst — Tagesangebote, Gems, Premium, Power-Boosts, Kosmetik. Niemals Pay-to-Win.", onClick: () => { setShopHubInitialTab("deals"); setShowShopHub(true); } },
            { key: "inbox",      icon: "📬", label: "Inbox",    color: "#a855f7", title: "📬 Nachrichten, Crew-Einladungen und Event-Benachrichtigungen.", onClick: () => setOpenModal("inbox") },
          ].map((a) => (
            <button key={a.key} onClick={a.onClick} title={a.title} style={{
              width: "100%", padding: "12px 6px", borderRadius: 12,
              background: `linear-gradient(135deg, ${a.color}22 0%, rgba(15,17,21,0.7) 100%)`,
              border: `1px solid ${a.color}55`,
              color: "#FFF", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              boxShadow: `0 2px 10px ${a.color}22`,
              minWidth: 0,
            }}>
              <span style={{ fontSize: 24, filter: `drop-shadow(0 0 8px ${a.color}88)`, lineHeight: 1 }}>{a.icon}</span>
              <span style={{
                fontSize: 11, fontWeight: 900, color: a.color, letterSpacing: 0.3,
                textAlign: "center", lineHeight: 1.1, maxWidth: "100%",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{a.label}</span>
            </button>
          ))}
        </div>

        {/* ═══ DEINE BASE — Banner mit Theme, Resourcen-HUD, Bau-Status ═══ */}
        {ownBaseInfo && ownBaseId && (
          <button
            onClick={() => {
              if (ownBaseHasPos) {
                // Nur zur Karte wechseln + zur Base fliegen — KEIN Modal öffnen
                onSwitchToMap();
                if (ownBaseInfo.lat != null && ownBaseInfo.lng != null) {
                  const lat = ownBaseInfo.lat, lng = ownBaseInfo.lng;
                  setTimeout(() => {
                    window.dispatchEvent(new CustomEvent("ma365:fly-to-coords", {
                      detail: { lat, lng, zoom: 17 },
                    }));
                  }, 400);
                }
              } else onPlaceBase();
            }}
            style={{
              marginTop: 12, width: "100%", padding: 14, borderRadius: 16,
              background: `linear-gradient(135deg, ${ownBaseInfo.accent}1f 0%, rgba(15,17,21,0.4) 60%, rgba(15,17,21,0.6) 100%)`,
              border: `1px solid ${ownBaseInfo.accent}55`,
              display: "flex", alignItems: "center", gap: 12,
              cursor: "pointer", textAlign: "left",
              boxShadow: `0 2px 16px ${ownBaseInfo.accent}22`,
            }}
            aria-label={tMD("ariaOpenBase")}
          >
            {/* Theme-Icon (Artwork aus cosmetic_artwork.kind=base_theme) */}
            <div style={{
              width: 76, height: 84, borderRadius: 12, flexShrink: 0,
              background: `radial-gradient(circle at 50% 30%, ${ownBaseInfo.accent}55 0%, ${ownBaseInfo.accent}22 45%, rgba(15,17,21,0.55) 100%)`,
              border: `1px solid ${ownBaseInfo.accent}77`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 0 14px ${ownBaseInfo.accent}44, inset 0 0 18px ${ownBaseInfo.accent}22`,
              overflow: "hidden",
            }}>
              {(() => {
                const slotPin = `${ownBaseInfo.theme_id}_runner_pin`;
                const slotBanner = `${ownBaseInfo.theme_id}_runner_banner`;
                const a = baseThemeArt[slotPin] ?? baseThemeArt[slotBanner] ?? baseThemeArt[ownBaseInfo.theme_id];
                const f = "url(#ma365-chroma-black) drop-shadow(0 2px 6px rgba(0,0,0,0.5))";
                // Artwork füllt den Kasten komplett — nicht abgeschnitten dank objectFit:contain
                if (a?.image_url) return <img src={a.image_url} alt={ownBaseInfo.theme_name} style={{ width: "100%", height: "100%", objectFit: "contain", filter: f }} />;
                if (a?.video_url) return <video src={a.video_url} autoPlay loop muted playsInline style={{ width: "100%", height: "100%", objectFit: "contain", filter: f }} />;
                return <span style={{ fontSize: 56, lineHeight: 1 }}>{ownBaseInfo.pin_emoji}</span>;
              })()}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 1.4, color: ownBaseInfo.accent }}>🏰 DEINE BASE</div>
              <div style={{ color: "#FFF", fontSize: 16, fontWeight: 900, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {ownBaseInfo.theme_name} · Stufe {ownBaseInfo.level}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 4, fontSize: 11, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ color: "#a16f32", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 3 }}>
                  <ResourceIcon kind="wood" size={20} fallback="⚙️" art={resourceArt} /> {ownBaseInfo.resources.wood.toLocaleString("de-DE")}
                </span>
                <span style={{ color: "#8B8FA3", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 3 }}>
                  <ResourceIcon kind="stone" size={20} fallback="🔩" art={resourceArt} /> {ownBaseInfo.resources.stone.toLocaleString("de-DE")}
                </span>
                <span style={{ color: "#FFD700", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 3 }}>
                  <ResourceIcon kind="gold" size={20} fallback="💸" art={resourceArt} /> {ownBaseInfo.resources.gold.toLocaleString("de-DE")}
                </span>
                <span style={{ color: "#22D1C3", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 3 }}>
                  <ResourceIcon kind="mana" size={20} fallback="📡" art={resourceArt} /> {ownBaseInfo.resources.mana.toLocaleString("de-DE")}
                </span>
                <span style={{ color: "#FFD700", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 3 }}>
                  <ResourceIcon kind="speed_token" size={20} fallback="⚡" art={resourceArt} /> {ownBaseInfo.resources.speed_tokens}
                </span>
              </div>
              {(ownBaseInfo.queue_count > 0 || ownBaseInfo.chest_count > 0 || !ownBaseHasPos) && (
                <div style={{ display: "flex", gap: 8, marginTop: 6, fontSize: 10, fontWeight: 900 }}>
                  {!ownBaseHasPos && <span style={{ color: "#22D1C3" }}>📍 Noch nicht platziert — Tippen zum Setzen</span>}
                  {ownBaseInfo.queue_count > 0 && <span style={{ color: "#FF6B4A" }}>🔨 {ownBaseInfo.queue_count} in Bau</span>}
                  {ownBaseInfo.chest_count > 0 && <span style={{ color: "#FFD700" }}>🗝️ {ownBaseInfo.chest_count} Truhen</span>}
                </div>
              )}
            </div>
            <span style={{
              flexShrink: 0,
              width: 120, padding: "8px 0", borderRadius: 10,
              background: `linear-gradient(135deg, ${ownBaseInfo.accent}, ${ownBaseInfo.accent}cc)`,
              color: "#0F1115", fontSize: 12, fontWeight: 900, letterSpacing: 0.4,
              boxShadow: `0 0 14px ${ownBaseInfo.accent}66`,
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
              whiteSpace: "nowrap",
            }}>
              <span>{ownBaseHasPos ? tMD("labelOpen") : tMD("labelPlace")}</span>
              <span style={{ fontSize: 14 }}>›</span>
            </span>
          </button>
        )}

        {/* ═══ AKTIVER WÄCHTER — Teaser-Block mit Video/Bild, Stats, Arena-CTA ═══ */}
        {activeGuardian && activeGuardian.archetype && (
          <SectionHeader title={tMD("labelGuardian")} action={<GuardianHelpButton />} />
        )}
        {activeGuardian && activeGuardian.archetype && (
          <button
            onClick={() => setTeaserDetailOpen(true)}
            style={{
              marginTop: 12, width: "100%", padding: 14, borderRadius: 16,
              background: "linear-gradient(135deg, rgba(255,45,120,0.10) 0%, rgba(168,85,247,0.10) 50%, rgba(34,209,195,0.10) 100%)",
              border: "1px solid rgba(255,45,120,0.35)",
              display: "flex", alignItems: "center", gap: 12,
              cursor: "pointer", textAlign: "left",
              boxShadow: "0 2px 16px rgba(255,45,120,0.15)",
            }}
            aria-label={tMD("ariaOpenGuardianDetails")}
          >
            {/* Portrait — bunter Gradient damit chroma-keyed Wächter pop'pt */}
            {(() => {
              const typeColor = ARENA_TYPE_META[activeGuardian.archetype.guardian_type ?? ""]?.color ?? "#FF2D78";
              return (
                <div style={{
                  width: 76, height: 84, borderRadius: 12, overflow: "hidden", flexShrink: 0,
                  background: `radial-gradient(circle at 50% 30%, ${typeColor}55 0%, ${typeColor}22 45%, rgba(15,17,21,0.55) 100%)`,
                  border: `1px solid ${typeColor}77`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: `0 0 14px ${typeColor}44, inset 0 0 18px ${typeColor}22`,
                }}>
              {activeGuardian.archetype.video_url ? (
                <video src={activeGuardian.archetype.video_url} autoPlay loop muted playsInline
                  style={{ width: "100%", height: "100%", objectFit: "cover", filter: "url(#ma365-chroma-black)" }} />
              ) : activeGuardian.archetype.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={activeGuardian.archetype.image_url} alt={activeGuardian.archetype.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover", filter: "url(#ma365-chroma-black)" }} />
              ) : (
                <span style={{ fontSize: 40 }}>{activeGuardian.archetype.emoji}</span>
              )}
                </div>
              );
            })()}

            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 1.4, color: "#FF6B4A" }}>⚔️ AKTIVER WÄCHTER</div>
              <div style={{ color: "#FFF", fontSize: 16, fontWeight: 900, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {activeGuardian.archetype.name}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 4, fontSize: 11, flexWrap: "wrap" }}>
                <span style={{ color: "#FFD700", fontWeight: 800 }}>Lvl {activeGuardian.level}</span>
                <span style={{ color: "#4ade80", fontWeight: 800 }}>{activeGuardian.wins}W</span>
                <span style={{ color: "#FF2D78", fontWeight: 800 }}>{activeGuardian.losses}L</span>
                <span style={{ color: "#a855f7", fontWeight: 800 }}>🏅 {activeGuardian.siegel_count} Siegel</span>
              </div>
              {activeGuardian.current_hp_pct < 100 && (
                <div style={{ marginTop: 6, height: 4, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", width: `${activeGuardian.current_hp_pct}%`,
                    background: activeGuardian.current_hp_pct > 50 ? "#4ade80" : activeGuardian.current_hp_pct > 25 ? "#FFD700" : "#FF2D78",
                  }} />
                </div>
              )}
            </div>
            <span style={{
              flexShrink: 0,
              width: 120, padding: "8px 0", borderRadius: 10,
              background: "linear-gradient(135deg, #FF2D78, #FF6B4A)",
              color: "#FFF", fontSize: 12, fontWeight: 900, letterSpacing: 0.4,
              boxShadow: "0 0 14px rgba(255,45,120,0.45)",
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
              whiteSpace: "nowrap",
            }}>
              <span>Details</span>
              <span style={{ fontSize: 14 }}>›</span>
            </span>
          </button>
        )}

        {/* ═══ DEINE CREW — Kompakt-Banner (parallel zu Base/Wächter) ═══ */}
        {(() => {
          const isAdmin = !!(myCrew && p && myCrew.owner_id === p.id);
          const repCount = crewSummary?.count_alive ?? 0;
          const hqCount = crewSummary?.has_hq ? 1 : 0;
          const accent = myCrew?.color ?? "#22D1C3";

          if (!myCrew) {
            return (
              <button
                onClick={() => setActiveTab("crew")}
                style={{
                  marginTop: 12, width: "100%", padding: 14, borderRadius: 16,
                  background: "linear-gradient(135deg, rgba(34,209,195,0.10) 0%, rgba(168,85,247,0.10) 100%)",
                  border: `1px dashed ${BORDER}`,
                  display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left",
                }}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                  background: "rgba(34,209,195,0.15)", border: "1px solid rgba(34,209,195,0.4)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
                }}>👥</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 1.4, color: "#22D1C3" }}>👥 KEINE CREW</div>
                  <div style={{ color: "#FFF", fontSize: 15, fontWeight: 900, marginTop: 2 }}>Crew gründen oder beitreten</div>
                  <div style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>Turf beanspruchen, gemeinsam angreifen</div>
                </div>
                <span style={{ color: "#22D1C3", fontSize: 20, fontWeight: 900, flexShrink: 0 }}>›</span>
              </button>
            );
          }

          return (
            <button
              onClick={() => setActiveTab("crew")}
              style={{
                marginTop: 12, width: "100%", padding: 14, borderRadius: 16,
                background: `linear-gradient(135deg, ${accent}22 0%, rgba(70, 82, 122, 0.45) 100%)`,
                border: `1px solid ${accent}55`,
                display: "flex", alignItems: "center", gap: 12,
                cursor: "pointer", textAlign: "left",
                boxShadow: `0 2px 16px ${accent}25`,
              }}
              aria-label={tMD("ariaOpenCrew")}
            >
              {/* Crew-Wappen / Initial */}
              <div style={{
                width: 76, height: 84, borderRadius: 12, flexShrink: 0,
                background: `linear-gradient(135deg, ${accent}, ${accent}aa)`,
                color: BG_DEEP, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 38, fontWeight: 900,
                boxShadow: `0 0 14px ${accent}66, inset 0 0 18px ${accent}22`,
              }}>
                {myCrew.name.charAt(0).toUpperCase()}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 1.4, color: accent }}>
                  👥 {isAdmin ? "DEINE CREW · BOSS" : "DEINE CREW"}
                </div>
                <div style={{ color: "#FFF", fontSize: 16, fontWeight: 900, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {myCrew.name}
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 4, fontSize: 11, flexWrap: "wrap" }}>
                  <span style={{ color: "#a8b4cf", fontWeight: 800 }}>👤 {myCrew.member_count}</span>
                  <span style={{ color: hqCount > 0 ? "#22D1C3" : "#FFD700", fontWeight: 800 }}>
                    {hqCount > 0 ? "🏛️" : "⚠️"} {hqCount > 0 ? tMD("labelHQ") : tMD("labelNoHQ")}
                  </span>
                  <span style={{ color: "#FF6B4A", fontWeight: 800 }}>📶 {repCount} Repeater</span>
                  {repCount > 0 && (
                    <span style={{ color: "#4ade80", fontWeight: 800 }}>🗺️ Turf aktiv</span>
                  )}
                </div>
              </div>

              <span style={{
                flexShrink: 0,
                width: 120, padding: "8px 0", borderRadius: 10,
                background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                color: BG_DEEP, fontSize: 12, fontWeight: 900, letterSpacing: 0.4,
                boxShadow: `0 0 14px ${accent}55`,
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                whiteSpace: "nowrap",
              }}>
                <span>{isAdmin ? tMD("labelManage") : tMD("labelOpen")}</span>
                <span style={{ fontSize: 14 }}>›</span>
              </span>
            </button>
          );
        })()}

        {/* ═══ PREMIUM-HUB: Inventar + Monetarisierung ═══ */}
        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <ProfilHubButton color="#FFD700" icon="📦" label="Inventar"            onClick={() => setShowInventory(true)} />
          <ProfilHubButton color="#FFD700" icon="📈" label="Wachstumsfond"       onClick={() => setShowGrowthFund(true)} />
          <ProfilHubButton color="#22D1C3" icon="📅" label="Monatspakete"        onClick={() => setShowMonthly(true)} />
          <ProfilHubButton color="#FF2D78" icon="🎡" label="Glücksrad"           onClick={() => setShowWheel(true)} />
          <ProfilHubButton color="#a855f7" icon="🔥" label="Schmiede des Lichts" onClick={() => setShowForge(true)} style={{ gridColumn: "1 / -1" }} />
          <ProfilHubButton color="#4ade80" icon="🎁" label="Loot-Zentrale"        onClick={() => setShowLootHub(true)}  style={{ gridColumn: "1 / -1" }} />
        </div>

        {/* ═══ LETZTE LÄUFE ═══ */}
        <SectionHeader title={tMD("labelLastRuns")} />
        {effectiveRecentRuns.length === 0 ? (
          <div style={{ background: "rgba(70, 82, 122, 0.45)", padding: 20, borderRadius: 18, textAlign: "center", color: MUTED, border: "1px solid rgba(255, 255, 255, 0.1)" }}>
            Noch keine Läufe. Starte deine erste Eroberung auf der Karte!
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {effectiveRecentRuns.slice(0, 3).map((run) => (
              <RunCard key={run.id} run={run} teamColor={teamColor} />
            ))}
          </div>
        )}

        {/* ═══ CREW — einheitlicher Block für Admin & Mitglied ═══ */}
        {(() => {
          const isAdmin = !!(myCrew && p && myCrew.owner_id === p.id);
          return (
            <>
              <SectionHeader
                title={isAdmin ? tMD("labelManagedCrew") : tMD("labelYourCrew")}
                action={myCrew ? (
                  <button
                    onClick={() => setActiveTab("crew")}
                    style={{
                      background: `${myCrew.color}22`, border: `1px solid ${myCrew.color}88`,
                      borderRadius: 14, padding: "6px 12px",
                      color: myCrew.color, fontSize: 12, fontWeight: 800, cursor: "pointer",
                    }}
                  >{isAdmin ? tMD("labelDashboardArrow") : tMD("labelOpenArrow")}</button>
                ) : null}
              />
              {myCrew ? (
                <div
                  onClick={() => setCrewModalOpen(true)}
                  style={{
                  display: "flex", flexDirection: "row",
                  background: `linear-gradient(135deg, ${myCrew.color}22 0%, rgba(70, 82, 122, 0.45) 100%)`,
                  padding: 18, borderRadius: 18, alignItems: "center", gap: 14,
                  border: `1px solid ${myCrew.color}55`,
                  cursor: "pointer",
                }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 14,
                    background: `linear-gradient(135deg, ${myCrew.color}, ${myCrew.color}aa)`,
                    color: BG_DEEP, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 24, fontWeight: 900,
                    boxShadow: `0 0 14px ${myCrew.color}88`,
                  }}>
                    {myCrew.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ color: "#FFF", fontSize: 16, fontWeight: 900 }}>{myCrew.name}</span>
                      {isAdmin && (
                        <span style={{
                          fontSize: 9, fontWeight: 900, letterSpacing: 0.5,
                          padding: "2px 6px", borderRadius: 6,
                          background: `${PRIMARY}22`, color: PRIMARY, border: `1px solid ${PRIMARY}55`,
                        }}>👑 ADMIN</span>
                      )}
                      <span style={{
                        padding: "2px 8px", borderRadius: 10,
                        background: `${myCrew.color}20`, border: `1px solid ${myCrew.color}40`,
                        color: myCrew.color, fontSize: 9, fontWeight: 900,
                      }}>{normalizeFaction(p?.faction) === "kronenwacht" ? "👑 KRONENWACHT" : "🗝️ GOSSENBUND"}</span>
                    </div>
                    <div style={{ color: MUTED, fontSize: 12, marginTop: 4 }}>
                      PLZ {myCrew.zip} · {myCrew.member_count} Mitglieder
                      {isAdmin && <> · Invite: <span style={{ fontFamily: "monospace", color: myCrew.color }}>{myCrew.invite_code}</span></>}
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setActiveTab("crew")}
                  style={{
                    width: "100%", display: "flex", flexDirection: "row",
                    background: "rgba(70, 82, 122, 0.45)",
                    padding: 20, borderRadius: 18, alignItems: "center",
                    border: `1px dashed ${BORDER}`, cursor: "pointer", textAlign: "left",
                  }}
                >
                  <div style={{ width: 22, height: 44, borderRadius: 11, marginRight: 15, background: "#333" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#FFF", fontSize: 18, fontWeight: "bold" }}>Keine Crew</div>
                    <div style={{ color: MUTED, fontSize: 12, marginTop: 4 }}>{tMD("soloCrewHint")}</div>
                  </div>
                  <span style={{ color: PRIMARY, fontSize: 20, fontWeight: 900 }}>›</span>
                </button>
              )}
            </>
          );
        })()}

        {/* ═══ GESUNDHEITSDATEN (nur 2 Kennzahlen, Rest im Modal) ═══ */}
        <SectionHeader
          title={tMD("labelHealthData")}
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
          <StatBox emoji="👣" value={((p?.total_distance_m || 0) / 1000).toFixed(1)} label={tMD("labelKmTotal")} />
          <StatBox emoji="🔥" value={(p?.total_calories || 0).toLocaleString()} label={tMD("labelKcalBurned")} />
        </div>

        {/* ═══ ERFOLGE (Top 5 als Balken + Modal für Rest) ═══ */}
        <SectionHeader
          title={tMD("labelAchievements")}
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
        <SectionHeader title={tMD("labelCurrentMonth")} />
        <div style={{
          background: "rgba(70, 82, 122, 0.45)", borderRadius: 16, padding: 16,
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}>
          <MonthlyCalendar runs={effectiveRecentRuns} color={teamColor} />
        </div>

        {/* ═══ LOADOUT (Runner + Base) ═══ */}
        <SectionHeader title={tMD("labelLoadout")} />

        {/* Loadout-Sections: 1) Auf der Karte (Runner)  2) An der Base */}
        <LoadoutTrio
          userXp={userXp}
          equippedMarker={equippedMarker}
          equippedMarkerVariant={equippedMarkerVariant}
          equippedLight={equippedLight}
          onEquipMarker={equipMarker}
          onEquipLight={equipLight}
          isAdmin={["admin","super_admin"].includes((p as unknown as { role?: string })?.role ?? "user")}
          onPinThemeChange={(t) => setPinThemeOverride(t)}
        />

        {/* ═══ MENÜ als kompaktes 2-Spalten-Icon-Grid ═══ */}
        <div style={{ marginTop: 24 }}>
          {p && !isPremium(p as never) && (
            <div style={{
              padding: 14, borderRadius: 14, marginBottom: 10,
              background: "linear-gradient(135deg, rgba(255,215,0,0.08), rgba(255,107,74,0.08))",
              border: "1px solid rgba(255,215,0,0.3)",
              display: "flex", flexDirection: "column", gap: 8,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 20 }}>💛</span>
                <div style={{ color: "#FFF", fontSize: 13, fontWeight: 900 }}>{tMD("supportUs")}</div>
              </div>
              <div style={{ color: "#a8b4cf", fontSize: 11, lineHeight: 1.45 }}>
                Mit einem kurzen Werbevideo hilfst du uns, MyArea365 unabhängig weiterzuentwickeln — und kassierst selbst <b style={{ color: "#FFD700" }}>+100 🪙 Lauf-Bonus</b>. Danke! 🙏
              </div>
              <RewardedAdButton placement="post_walk" userId={p.id} />
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { icon: "❓", label: tMD("labelHelp"),  onClick: () => setOpenModal("faq") },
              { icon: "📤", label: tMD("shareProfile"), onClick: async () => {
                const shareText = `${p?.display_name || "Ich"} · ${currentRankLive.name} · ${userXp.toLocaleString()} 🪙\n${effectiveTerritoryCount} Gebiete · ${((p?.total_distance_m || 0) / 1000).toFixed(1)} km\n\nMyArea365.de`;
                const shareData = { title: "Mein MyArea365 Profil", text: shareText, url: typeof window !== "undefined" ? window.location.origin : "https://myarea365.de" };
                let shared = false;
                try {
                  if (navigator.share) { await navigator.share(shareData); shared = true; }
                  else { await navigator.clipboard.writeText(`${shareText}\n${shareData.url}`); appAlert(tMD("profileTextCopied")); shared = true; }
                } catch { /* cancel */ }
                // One-Time +50 🪙 für den ersten erfolgreichen Share — der
                // Endpunkt ist idempotent über users.profile_shared_at.
                if (shared) {
                  try {
                    const r = await fetch("/api/profile/share", { method: "POST" });
                    if (r.ok) {
                      const j = await r.json() as { awarded?: number };
                      if ((j.awarded ?? 0) > 0) appAlert(`+${j.awarded} 🪙 für deinen ersten Profil-Share!`);
                    }
                  } catch { /* fail-silent */ }
                }
              } },
              { icon: "🪙", label: tMD("labelCurrencyGuide"), onClick: () => setOpenModal("xpguide") },
              { icon: "🎫", label: "Support",      onClick: () => setOpenModal("support") },
              { icon: "⚙️", label: tMD("labelSettings"), onClick: () => setOpenModal("settings") },
            ].map((b, i) => (
              <button key={i} onClick={b.onClick} style={{
                padding: "14px 10px", borderRadius: 12,
                background: "rgba(30, 38, 60, 0.55)",
                border: `1px solid ${BORDER}`,
                color: "#FFF", cursor: "pointer", textAlign: "center",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              }}>
                <span style={{ fontSize: 22 }}>{b.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: TEXT_SOFT }}>{b.label}</span>
              </button>
            ))}
          </div>
        </div>

        {p && (
          <ReferralWidget
            userId={p.id}
            referralCode={(p as unknown as { referral_code?: string }).referral_code ?? null}
            displayName={p.display_name || p.username || "Runner"}
          />
        )}

        {/* Demo-Zone nur für Admins/Super-Admins */}
        {["admin","super_admin"].includes((p as unknown as { role?: string })?.role ?? "user") && (
        <div style={{
          marginTop: 20, padding: 14, borderRadius: 14,
          background: "rgba(255, 215, 0, 0.08)",
          border: `1px dashed rgba(255, 215, 0, 0.4)`,
        }}>
          <div style={{ color: "#FFD700", fontSize: 11, fontWeight: 900, letterSpacing: 1, marginBottom: 8 }}>
            🎮 DEMO-ZONE
          </div>
          <div style={{ color: MUTED, fontSize: 12, marginBottom: 10, lineHeight: 1.5 }}>
            Teste die Admin-Ansichten für Crew- und Shop-Besitzer — mit vollen Rechten auf Demo-Daten.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              onClick={toggleDemoOverride}
              style={{
                padding: "12px 16px", borderRadius: 12,
                background: demoOverride ? "rgba(74, 222, 128, 0.18)" : "rgba(255, 255, 255, 0.04)",
                border: `1px solid ${demoOverride ? "#4ade80" : BORDER}`,
                color: demoOverride ? "#4ade80" : "#FFF",
                fontSize: 13, fontWeight: 800, cursor: "pointer", textAlign: "left",
                display: "flex", alignItems: "center", gap: 10,
              }}
            >
              <span style={{ fontSize: 22 }}>{demoOverride ? "✅" : "🎲"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#FFF", fontSize: 13, fontWeight: 900 }}>
                  Demo-Profildaten {demoOverride ? "AN" : "AUS"}
                </div>
                <div style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>
                  {demoOverride
                    ? tMD("demoOnHint")
                    : tMD("demoOffHint")}
                </div>
              </div>
            </button>
            <button
              onClick={() => {
                if (!p) return appAlert(tMD("profileLoading"));
                setMyCrew({
                  id: "demo-crew-kaelthor",
                  name: "Kaelthors Kiez-Crew",
                  zip: "13435",
                  color: "#22D1C3",
                  owner_id: p.id,
                  faction: p.faction || "syndicate",
                  invite_code: "KAEL-DEMO",
                  member_count: 6,
                });
                setActiveTab("crew");
              }}
              style={{
                padding: "12px 16px", borderRadius: 12,
                background: "rgba(34, 209, 195, 0.15)",
                border: `1px solid ${PRIMARY}66`, color: PRIMARY,
                fontSize: 13, fontWeight: 800, cursor: "pointer", textAlign: "left",
                display: "flex", alignItems: "center", gap: 10,
              }}
            >
              <span style={{ fontSize: 22 }}>👥</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#FFF", fontSize: 13, fontWeight: 900 }}>Demo-Crew verwalten</div>
                <div style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>Kaelthors Kiez-Crew · als Admin öffnen</div>
              </div>
              <span style={{ color: MUTED }}>›</span>
            </button>
            {/* Demo-Shop-Dashboard-Link entfernt: local-businesses archived 2026-05-05 */}
            {myCrew?.id === "demo-crew-kaelthor" && (
              <button
                onClick={() => setMyCrew(null)}
                style={{
                  padding: "8px 14px", borderRadius: 10,
                  background: "transparent", border: `1px solid ${ACCENT}44`,
                  color: ACCENT, fontSize: 11, fontWeight: 700, cursor: "pointer",
                }}
              >
                Demo-Crew zurücksetzen
              </button>
            )}
          </div>
        </div>
        )}

        <div style={{ textAlign: "center", color: MUTED, fontSize: 11, marginTop: 20, lineHeight: 1.8 }}>
          <div>© MyArea365 {new Date().getFullYear()} · Alle Rechte vorbehalten · v0.3</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", alignItems: "center" }}>
            <FooterLink onClick={() => openLegalModal("impressum")}>Impressum</FooterLink>
            <span style={{ opacity: 0.4 }}>|</span>
            <FooterLink onClick={() => openLegalModal("datenschutz")}>Datenschutz</FooterLink>
            <span style={{ opacity: 0.4 }}>|</span>
            <FooterLink onClick={() => openLegalModal("agb")}>AGB</FooterLink>
            <span style={{ opacity: 0.4 }}>|</span>
            <a href="/support" style={{ color: MUTED, textDecoration: "none" }}>Support</a>
          </div>
          <div>{tMD("madeWithLove")}</div>
        </div>
      </div>

      {/* ═══════════ MODALS ═══════════ */}
      {openModal === "health" && (
        <Modal
          title={tMD("labelHealthDataModal")}
          subtitle={tMD("fitnessOverviewSubtitle")}
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
        <Modal title={tMD("labelSettingsModal")} subtitle={tMD("labelAppPreferences")} icon="⚙️" accent="#5ddaf0" onClose={() => setOpenModal(null)}>
          <AppSettingsContent
            p={p}
            updateSetting={updateSetting}
            onLogout={onLogout}
            onExportData={() => {
              const blob = new Blob([JSON.stringify({ profile: p, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = `myarea365-daten-${Date.now()}.json`; a.click();
              URL.revokeObjectURL(url);
            }}
          />
        </Modal>
      )}

      {showUpgrade && p && (
        <UpgradeModal
          mode={showUpgrade}
          userId={showUpgrade === "plus" ? p.id : undefined}
          crewId={showUpgrade === "crew" ? myCrew?.id : undefined}
          onClose={() => setShowUpgrade(null)}
        />
      )}

      {showBoostShop && p && (
        <PowerShopModal userId={p.id} onClose={() => setShowBoostShop(false)} />
      )}

      {showGemShop && <GemShopModal onClose={() => setShowGemShop(false)} />}

      {showShopHub && p && (
        <ShopHubModal userId={p.id} onClose={() => setShowShopHub(false)} initialTab={shopHubInitialTab} isAdmin={["admin","super_admin"].includes((p as unknown as { role?: string })?.role ?? "user")} />
      )}

      {openModal === "onboarding" && (
        <OnboardingModal onClose={() => { markOnboardingSeen(); setOpenModal(null); }} />
      )}
      {openModal === "faq" && (
        <FaqModal onClose={() => setOpenModal(null)} />
      )}

      {runnerProfileUserId && (
        <RunnerStatsModal userId={runnerProfileUserId} onClose={() => setRunnerProfileUserId(null)} />
      )}


      {openModal === "achievements" && (
        <Modal
          title={tMD("labelAllAchievements")}
          subtitle={`${achievementsUnlocked} von ${ACHIEVEMENTS.length} freigeschaltet · ${ACHIEVEMENT_CATEGORIES.length} Kategorien`}
          icon="🏆"
          accent="#FFD700"
          onClose={() => setOpenModal(null)}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {ACHIEVEMENT_CATEGORIES.map((cat) => {
              const catAchievements = sortedAchievements.filter((a) => (a as typeof a & { category?: string }).category === cat.id);
              if (catAchievements.length === 0) return null;
              const unlockedInCat = catAchievements.filter((a) => a.unlocked).length;
              return (
                <CategoryAccordion
                  key={cat.id}
                  cat={cat}
                  unlocked={unlockedInCat}
                  total={catAchievements.length}
                  items={catAchievements}
                />
              );
            })}
          </div>
        </Modal>
      )}

      {crewModalOpen && (
        <CrewModal onClose={() => setCrewModalOpen(false)} />
      )}

      {openModal === "ranks" && (
        <Modal
          title={tMD("labelAllRanks")}
          subtitle={tMD("labelRankRange", { n: RUNNER_RANKS.length })}
          icon="🏅"
          accent={currentRankLive.color}
          onClose={() => setOpenModal(null)}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {RUNNER_RANKS.map((r, i) => {
              const achieved = userXp >= r.minXp;
              const current = r.id === currentRankLive.id;
              const next = RUNNER_RANKS[i + 1];
              const xpToRank = achieved ? 0 : r.minXp - userXp;
              return (
                <div key={r.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "14px 16px", borderRadius: 14,
                  background: current
                    ? `linear-gradient(90deg, ${r.color}33 0%, rgba(70,82,122,0.5) 70%)`
                    : achieved
                      ? "rgba(70, 82, 122, 0.45)"
                      : "rgba(70, 82, 122, 0.2)",
                  border: current ? `1.5px solid ${r.color}` : achieved ? `1px solid ${r.color}44` : "1px solid rgba(255,255,255,0.06)",
                  boxShadow: current ? `0 0 18px ${r.color}55` : "none",
                  opacity: achieved ? 1 : 0.7,
                }}>
                  <div style={{ filter: achieved ? "none" : "grayscale(0.6) brightness(0.8)" }}>
                    <RankBadge rankId={r.id} color={r.color} size={48} rankArt={rankArt}
                      fallbackEmoji="🏅" showNumberOverlay />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      color: achieved ? "#FFF" : TEXT_SOFT,
                      fontSize: 14, fontWeight: 800,
                      display: "flex", alignItems: "center", gap: 6,
                    }}>
                      {r.name}
                      {current && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: r.color, color: BG_DEEP, fontWeight: 900 }}>{tMD("labelCurrent")}</span>}
                    </div>
                    <div style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>
                      {r.minXp.toLocaleString("de-DE")} 🪙 {next && `— ${(next.minXp - 1).toLocaleString("de-DE")} 🪙`}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {achieved ? (
                      <span style={{ color: r.color, fontSize: 18 }}>✓</span>
                    ) : (
                      <div style={{ color: MUTED, fontSize: 10 }}>
                        <div>{tMD("labelStillNeeded")}</div>
                        <div style={{ color: r.color, fontWeight: 800, fontSize: 12 }}>{xpToRank.toLocaleString("de-DE")} 🪙</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ textAlign: "center", color: MUTED, fontSize: 11, marginTop: 14, fontStyle: "italic" }}>
            🪙 Wegemünzen sammelst du durch Läufe, Gebiete, Streaks & Achievements.
          </div>
        </Modal>
      )}

      {openModal === "arena" && (
        <Modal title={tMD("modalArenaTitle")} subtitle={tMD("modalArenaSubtitle")} icon="⚔️" accent="#FF2D78" maxWidth={920} onClose={() => setOpenModal(null)}>
          <div className="text-center text-[#8b8fa3] py-8">⚔️ Marsch-System in Arbeit</div>
        </Modal>
      )}

      {openModal === "inbox" && (
        <Modal title={tMD("labelInboxModal")} subtitle={tMD("labelInboxSubtitle")} icon="📬" accent="#a855f7" maxWidth={1100} onClose={() => setOpenModal(null)}>
          <InboxClient />
        </Modal>
      )}

      {openModal === "support" && (
        <Modal title={tMD("labelSupportContact")} subtitle={tMD("labelSupportSubtitle")} icon="🎫" accent="#FFD700" onClose={() => setOpenModal(null)}>
          <SupportContent
            prefillEmail={(p as unknown as { email?: string })?.email ?? ""}
            prefillName={p?.display_name ?? p?.username ?? ""}
          />
          <div style={{ marginTop: 24, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 18 }}>📬</span>
              <div>
                <div style={{ color: "#FFF", fontWeight: 900, fontSize: 14 }}>Post vom MyArea365-Team</div>
                <div style={{ color: "#8B8FA3", fontSize: 11 }}>Antworten auf Tickets &amp; Ankündigungen</div>
              </div>
            </div>
            <InboxContent />
          </div>
        </Modal>
      )}

      {openModal === "xpguide" && (
        <Modal
          title={tXG("title")}
          subtitle={tXG("subtitle")}
          icon="🪙"
          accent="#FFD700"
          onClose={() => setOpenModal(null)}
        >
          <div style={{ color: TEXT_SOFT, fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>
            {tMD.rich("currencyHeaderIntro", { b: (c: React.ReactNode) => <b style={{ color: "#FFF" }}>{c}</b> })}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8, marginBottom: 18 }}>
            <div style={{ padding: 12, borderRadius: 10, background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.3)" }}>
              <div style={{ color: "#FFD700", fontSize: 13, fontWeight: 900, marginBottom: 3 }}>{tXG("pathCoinsTitle")}</div>
              <div style={{ color: "#a8b4cf", fontSize: 11, lineHeight: 1.5 }}>
                <b style={{ color: "#FFF" }}>{tXG("labelForWhat")}</b> {tXG("pathCoinsForWhat")}<br/>
                <b style={{ color: "#FFF" }}>{tXG("labelFromWhere")}</b> {tXG("pathCoinsFromWhere")}
              </div>
            </div>
            <div style={{ padding: 12, borderRadius: 10, background: "rgba(255,45,120,0.08)", border: "1px solid rgba(255,45,120,0.3)" }}>
              <div style={{ color: "#FF2D78", fontSize: 13, fontWeight: 900, marginBottom: 3 }}>{tXG("territoryRepTitle")}</div>
              <div style={{ color: "#a8b4cf", fontSize: 11, lineHeight: 1.5 }}>
                <b style={{ color: "#FFF" }}>{tXG("labelForWhat")}</b> {tXG("territoryRepForWhat")}<br/>
                <b style={{ color: "#FFF" }}>{tXG("labelFromWhere")}</b> {tXG("territoryRepFromWhere")}
              </div>
            </div>
            <div style={{ padding: 12, borderRadius: 10, background: "rgba(34,209,195,0.08)", border: "1px solid rgba(34,209,195,0.3)" }}>
              <div style={{ color: "#22D1C3", fontSize: 13, fontWeight: 900, marginBottom: 3 }}>{tXG("arenaHonorTitle")}</div>
              <div style={{ color: "#a8b4cf", fontSize: 11, lineHeight: 1.5 }}>
                <b style={{ color: "#FFF" }}>{tXG("labelForWhat")}</b> {tXG("arenaHonorForWhat")}<br/>
                <b style={{ color: "#FFF" }}>{tXG("labelFromWhere")}</b> {tXG("arenaHonorFromWhere")}<br/>
                <b style={{ color: "#FFF" }}>{tXG("labelWarning")}</b> {tXG("arenaHonorWarning")}
              </div>
            </div>
          </div>

          <div style={{ color: TEXT_SOFT, fontSize: 12, fontWeight: 800, marginBottom: 8 }}>{tXG("subtitlePathCoinsDetail")}</div>

          <XpGuideSection title={tXG("sectionPerActivityTitle")} subtitle={tXG("sectionPerActivitySubtitle")} defaultOpen>
            <XpGuideRow icon="🛤️" label={tXG("rowNewSegment")} xp={`+${XP_PER_SEGMENT}`} />
            <XpGuideRow icon="🛣️" label={tXG("rowFullStreet")} xp={`+${XP_PER_STREET_CLAIMED}${tXG("fullStreetSuffix")}`} />
            <XpGuideRow icon="🏆" label={tXG("rowClosedTerritory")} xp={`+${XP_PER_TERRITORY}`} />
            <XpGuideRow icon="📏" label={tXG("rowPerKm")} xp={`+${XP_PER_KM}`} />
            <XpGuideRow icon="✅" label={tXG("rowWalkBase")} xp={`+${XP_PER_WALK}`} last />
          </XpGuideSection>

          <XpGuideSection title={tXG("sectionStreakTitle")} subtitle={tXG("sectionStreakSubtitle")}>
            <XpGuideRow icon="2️⃣" label={tXG("rowStreak2_3")} xp={`+25 ${tXG("perDay")}`} />
            <XpGuideRow icon="4️⃣" label={tXG("rowStreak4_6")} xp={`+50 ${tXG("perDay")}`} />
            <XpGuideRow icon="7️⃣" label={tXG("rowStreak7_9")} xp={`+100 ${tXG("perDay")}`} />
            <XpGuideRow icon="🔟" label={tXG("rowStreak10")} xp={`+200 ${tXG("perDay")}`} last />
          </XpGuideSection>

          <XpGuideSection title={tXG("sectionMultsTitle")} subtitle={tXG("sectionMultsSubtitle")}>
            <div style={{ padding: "4px 2px 10px" }}>
              <button
                onClick={() => setGuideShopExpanded((v) => !v)}
                style={{
                  width: "100%",
                  padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                  background: guideShopExpanded ? "rgba(34,209,195,0.2)" : "linear-gradient(135deg,#22D1C3,#5ddaf0)",
                  color: guideShopExpanded ? "#22D1C3" : "#0F1115",
                  border: guideShopExpanded ? "1px solid rgba(34,209,195,0.4)" : "none",
                  fontSize: 12, fontWeight: 900, letterSpacing: 0.3,
                  display: "flex", justifyContent: "center", alignItems: "center", gap: 6,
                }}
              >
                <span>{guideShopExpanded ? tXG("boostBuyHide") : tXG("boostBuyShow")}</span>
                <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.7 }}>{guideShopExpanded ? tXG("boostBuyHideShort") : tXG("boostBuyShowShort")}</span>
              </button>
              {guideShopExpanded && p && (
                <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: "rgba(15,17,21,0.7)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <BoostShopBody userId={p.id} onDone={() => setGuideShopExpanded(false)} />
                </div>
              )}
            </div>
            <XpGuideRow icon="⚡" label={tXG("row24hBoost")} xp={tXG("boostDouble")} />
            <XpGuideRow icon="⚡" label={tXG("row48hBoost")} xp={tXG("boostDouble")} />
            <XpGuideRow icon="⚡" label={tXG("rowWeekDouble")} xp={tXG("boostDouble")} />
            <XpGuideRow icon="⚡" label={tXG("rowWeekTriple")} xp={tXG("boostTriple")} last />
            <div style={{ padding: "12px 0 2px", color: "#a8b4cf", fontSize: 10, fontWeight: 800, letterSpacing: 1 }}>
              {tXG("freeViaAd")}
            </div>
            <div style={{ padding: "0 2px 8px", color: "#8B8FA3", fontSize: 10, lineHeight: 1.45 }}>
              {tXG.rich("adExplainer", {
                b: (c: React.ReactNode) => <b style={{ color: "#FFF" }}>{c}</b>,
                c: (c: React.ReactNode) => <b style={{ color: "#FFD700" }}>{c}</b>,
                p: (c: React.ReactNode) => <b style={{ color: "#c084fc" }}>{c}</b>,
              })}
            </div>
            {p && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "2px 2px 4px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14 }}>📺</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#FFF", fontSize: 12, fontWeight: 800 }}>{tXG("row24hBoostFree")}</div>
                    <div style={{ color: "#8B8FA3", fontSize: 10 }}>{tXG("row24hBoostFreeSub")}</div>
                  </div>
                  <RewardedAdButton placement="boost_24h" userId={p.id} variant="chip" />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14 }}>📺</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#FFF", fontSize: 12, fontWeight: 800 }}>{tXG("row15minBoostFree")}</div>
                    <div style={{ color: "#8B8FA3", fontSize: 10 }}>{tXG("row15minBoostFreeSub")}</div>
                  </div>
                  <RewardedAdButton placement="double_xp" userId={p.id} variant="chip" />
                </div>
              </div>
            )}
          </XpGuideSection>

          <XpGuideSection title={tXG("sectionAdsTitle")} subtitle={tXG("sectionAdsSubtitle")}>
            {p && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 2px 10px" }}>
                <span style={{ fontSize: 14 }}>🏁</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#FFF", fontSize: 12, fontWeight: 800 }}>{tXG("rowWalkBonus")}</div>
                  <div style={{ color: "#8B8FA3", fontSize: 10 }}>{tXG("rowWalkBonusSub")}</div>
                </div>
                <RewardedAdButton placement="post_walk" userId={p.id} variant="chip" />
              </div>
            )}
            <XpGuideRow icon="🎯" label={tXG("rowPreWalk")} xp={tXG("rowPreWalkXp")} />
            <div style={{ padding: "0 8px 6px", fontSize: 10, color: "#8B8FA3", lineHeight: 1.45 }}>
              {tXG("preWalkExplainer")}
            </div>
            <XpGuideRow icon="❄️" label={tXG("rowStreakRescue")} xp={tXG("rowStreakRescueXp")} last />
            <div style={{ padding: "0 8px 4px", fontSize: 10, color: "#8B8FA3", lineHeight: 1.45 }}>
              {tXG("streakRescueExplainer")}
            </div>
          </XpGuideSection>

          <XpGuideSection title={tXG("sectionCommunityTitle")}>
            <XpGuideRow icon="🏪" label={tXG("rowKiezDeal")} xp={`+${XP_KIEZ_CHECKIN}`} />
            <XpGuideRow icon="🤝" label={tXG("rowFriendInvite")} xp={tXG("rowFriendInviteXp")} />
            <XpGuideRow icon="📤" label={tXG("rowProfileShare")} xp={tXG("rowProfileShareXp")} last />
            <div style={{ padding: "10px 8px 2px", fontSize: 10, color: "#8B8FA3", lineHeight: 1.45, fontStyle: "italic" }}>
              {tXG("crewWinHint")}
            </div>
          </XpGuideSection>

          <XpGuideSection title={tXG("sectionAchievementsTitle")} subtitle={tXG("sectionAchievementsSubtitle", { count: ACHIEVEMENTS.length })}>
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

          <XpGuideSection title={tXG("sectionPremiumTitle")} subtitle={tXG("sectionPremiumSubtitle")}>
            <XpGuideRow icon="❄️" label={tXG("rowStreakFreeze")} xp={tXG("rowStreakFreezeXp")} />
            <XpGuideRow icon="🚫" label={tXG("rowAdFree")} xp={tXG("dash")} />
            <XpGuideRow icon="🎨" label={tXG("rowExclusiveMarkers")} xp={tXG("dash")} />
            <XpGuideRow icon="📊" label={tXG("rowDetailedStats")} xp={tXG("dash")} last />
          </XpGuideSection>

          <XpGuideSection title={tXG("sectionSupporterTitle")} subtitle={tXG("sectionSupporterSubtitle")}>
            <XpGuideRow icon="🥉" label={tXG("rowBronze")} xp={tXG("supporterReward")} />
            <XpGuideRow icon="🥈" label={tXG("rowSilver")} xp={tXG("supporterReward")} />
            <XpGuideRow icon="🥇" label={tXG("rowGold")} xp={tXG("supporterReward")} last />
          </XpGuideSection>

          <div style={{ color: MUTED, fontSize: 12, marginTop: 16, textAlign: "center", fontStyle: "italic" }}>
            {tXG("footer")}
          </div>
        </Modal>
      )}

      {teaserDetailOpen && activeGuardian?.id && (
        <GuardianDetailModal
          guardianId={activeGuardian.id}
          onClose={() => setTeaserDetailOpen(false)}
          onArena={() => { setTeaserDetailOpen(false); setOpenModal("arena"); }}
          onSwitch={() => { setTeaserDetailOpen(false); void openGuardianGallery(); }}
          onOpenRanking={() => { setTeaserDetailOpen(false); onOpenMmrRanking(); }}
        />
      )}

      {guardianGalleryOpen && guardianGalleryData && (
        <GuardianGalleryModal
          archetypes={guardianGalleryData.archetypes}
          ownedIds={new Set(guardianGalleryData.owned.map((g) => g.archetype_id))}
          ownedGuardians={guardianGalleryData.owned}
          activeArchetypeId={guardianGalleryData.active_id}
          onClose={() => setGuardianGalleryOpen(false)}
          onActivate={async (archetypeId) => {
            const g = guardianGalleryData.owned.find((x) => x.archetype_id === archetypeId);
            if (!g) return;
            const res = await fetch("/api/guardian/my-collection", {
              method: "POST", headers: { "content-type": "application/json" },
              body: JSON.stringify({ action: "activate", guardian_id: g.id }),
            });
            if (!res.ok) {
              const j = await res.json().catch(() => ({}));
              alert(tMD("activationFailed", { error: String(j.error ?? res.status) }));
              return;
            }
            setGuardianGalleryOpen(false);
            window.location.reload();
          }}
        />
      )}

      {/* ═══ Premium-Hub Modals ═══ */}
      {showInventory  && <RunnerInventoryModal onClose={() => setShowInventory(false)} />}
      {showGrowthFund && <GrowthFundModal      onClose={() => setShowGrowthFund(false)} />}
      {showMonthly    && <MonthlyPackModal     onClose={() => setShowMonthly(false)} />}
      {showWheel      && <LuckyWheelModal      onClose={() => setShowWheel(false)} />}
      {showForge      && <ForgeOfLightModal    onClose={() => setShowForge(false)} />}
      {showLootHub    && <LootHubModal          onClose={() => setShowLootHub(false)} />}
    </div>
  );
}

function ProfilHubButton({ color, icon, label, onClick, style }: {
  color: string; icon: string; label: string; onClick: () => void; style?: React.CSSProperties;
}) {
  return (
    <button onClick={onClick} style={{
      padding: "12px 14px", borderRadius: 12,
      background: `linear-gradient(135deg, ${color}22, ${color}0a)`,
      border: `1px solid ${color}55`,
      color: "#FFF", fontSize: 13, fontWeight: 800, cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      boxShadow: `0 0 16px ${color}22`,
      ...style,
    }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span>{label}</span>
    </button>
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
    <svg width={size} height={size} style={{ position: "absolute", top: 0, left: 0, transform: "rotate(-90deg)", overflow: "visible" }}>
      {/* Track — dezente Rang-Farbe */}
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={`${colorFrom}33`} strokeWidth={stroke} />
      {/* Progress — satte Farbe, butt-Cap → kein Bump */}
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={colorFrom} strokeWidth={stroke}
        strokeLinecap="butt" strokeDasharray={c} strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 1s ease-out" }} />
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

function MapFactionPanel({ onSwitchTab }: { onSwitchTab: () => void }) {
  const tMP = useTranslations("MapPanels");
  const [expanded, setExpanded] = useState(false);
  const f = DEMO_FACTION_STATS;
  const total = f.nachtpuls.km_week + f.sonnenwacht.km_week;
  const pctN = total > 0 ? (f.nachtpuls.km_week / total) * 100 : 50;
  const leader = f.nachtpuls.km_week >= f.sonnenwacht.km_week ? "nachtpuls" : "sonnenwacht";

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        style={{
          position: "absolute", bottom: 110, left: 20, zIndex: 40,
          background: "rgba(18, 26, 46, 0.7)",
          backdropFilter: "blur(16px) saturate(180%)",
          WebkitBackdropFilter: "blur(16px) saturate(180%)",
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.14)",
          boxShadow: "0 4px 14px rgba(0,0,0,0.3)",
          padding: "6px 12px 6px 10px",
          display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
        }}
        aria-label={tMP("fpExpandAria")}
      >
        <span style={{ fontSize: 14 }}>⚔️</span>
        <span style={{ color: leader === "nachtpuls" ? "#22D1C3" : "#FFD700", fontSize: 12, fontWeight: 900 }}>
          {tMP("fpLeaderHint", { icon: leader === "nachtpuls" ? "🗝️" : "👑", city: f.city })}
        </span>
        <span style={{ color: "#a8b4cf", fontSize: 12, fontWeight: 900, marginLeft: 2 }}>›</span>
      </button>
    );
  }

  return (
    <div style={{
      position: "absolute", bottom: 110, left: 20, zIndex: 40,
      width: 260, maxWidth: "calc(100vw - 40px)",
      background: "rgba(18, 26, 46, 0.85)",
      backdropFilter: "blur(16px) saturate(180%)",
      WebkitBackdropFilter: "blur(16px) saturate(180%)",
      borderRadius: 16, padding: 14,
      border: "1px solid rgba(255,255,255,0.14)",
      boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ color: "#FFF", fontSize: 11, fontWeight: 900, letterSpacing: 1 }}>{tMP("fpHeader", { city: f.city.toUpperCase() })}</span>
        <button onClick={() => setExpanded(false)} aria-label={tMP("fpCloseAria")} style={{ background: "none", border: "none", color: "#a8b4cf", fontSize: 14, cursor: "pointer" }}>✕</button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, fontSize: 11 }}>
        <span style={{ color: "#22D1C3", fontWeight: 800 }}>🗝️ {f.nachtpuls.km_week.toFixed(0)} km</span>
        <span style={{ flex: 1 }} />
        <span style={{ color: "#FFD700", fontWeight: 800 }}>{f.sonnenwacht.km_week.toFixed(0)} km 👑</span>
      </div>
      <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", background: "rgba(255,255,255,0.08)" }}>
        <div style={{ width: `${pctN}%`, background: "linear-gradient(90deg, #22D1C3, #22D1C3aa)" }} />
        <div style={{ flex: 1, background: "linear-gradient(90deg, #FFD70088, #FFD700)" }} />
      </div>
      <div style={{ color: "#a8b4cf", fontSize: 10, marginTop: 4, display: "flex", justifyContent: "space-between" }}>
        <span>{tMP("fpRunners", { count: f.nachtpuls.runners })}</span>
        <span>{tMP("fpThisWeek")}</span>
        <span>{tMP("fpRunners", { count: f.sonnenwacht.runners })}</span>
      </div>

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", margin: "10px 0 8px" }} />

      <div style={{ color: "#a8b4cf", fontSize: 10, fontWeight: 900, letterSpacing: 1, marginBottom: 6 }}>{tMP("fpCrewsNearby")}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 180, overflowY: "auto" }}>
        {DEMO_NEARBY_CREWS_MAP.slice(0, 5).map((c) => (
          <button
            key={c.invite_code}
            onClick={onSwitchTab}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 8px", borderRadius: 8,
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${c.color}33`, cursor: "pointer",
              textAlign: "left",
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: 4, background: c.color, boxShadow: `0 0 6px ${c.color}` }} />
            <span style={{ flex: 1, color: "#FFF", fontSize: 11, fontWeight: 700 }}>{c.name}</span>
            <span style={{ color: "#a8b4cf", fontSize: 10 }}>{c.members}</span>
            <span style={{ color: "#8b8fa3", fontSize: 9 }}>
              {c.distance_m === 0 ? "★" : c.distance_m < 1000 ? `${c.distance_m}m` : `${(c.distance_m / 1000).toFixed(1)}km`}
            </span>
          </button>
        ))}
      </div>
      <button
        onClick={onSwitchTab}
        style={{
          marginTop: 8, width: "100%", padding: "6px 10px",
          background: "rgba(34,209,195,0.15)", border: `1px solid #22D1C366`,
          borderRadius: 8, color: "#22D1C3", fontSize: 11, fontWeight: 800, cursor: "pointer",
        }}
      >
        {tMP("fpAllCrewsBtn")}
      </button>
    </div>
  );
}

function MapLivePanel({ teamColor, onViewRunner }: { teamColor: string; onViewRunner: (username: string) => void }) {
  const tMP = useTranslations("MapPanels");
  const live = DEMO_MAP_LIVE;
  const aa = live.active_attack;
  const ta = live.territory_attack;
  const [expanded, setExpanded] = useState(false);

  const hasAlert = aa.active || ta.active;
  const alertColor = aa.active ? "#FF2D78" : ta.active ? "#FF6B4A" : null;

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

  // Collapsed: kompakter Chip
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        aria-label={tMP("lpExpandAria")}
        style={{
          position: "absolute", top: 20, left: 20, zIndex: 40,
          background: "rgba(18, 26, 46, 0.55)",
          backdropFilter: "blur(16px) saturate(180%)",
          WebkitBackdropFilter: "blur(16px) saturate(180%)",
          borderRadius: 999,
          border: hasAlert ? `1px solid ${alertColor}aa` : "1px solid rgba(255,255,255,0.14)",
          boxShadow: hasAlert
            ? `0 0 14px ${alertColor}66, 0 4px 14px rgba(0,0,0,0.3)`
            : "0 4px 14px rgba(0,0,0,0.3)",
          padding: "3px 8px 3px 7px",
          display: "flex", alignItems: "center", gap: 5,
          cursor: "pointer",
          animation: hasAlert ? "liveChipAlert 1.4s ease-in-out infinite" : "none",
        }}
      >
        <span style={{
          width: 5, height: 5, borderRadius: 3, background: "#4ade80",
          boxShadow: "0 0 6px #4ade80",
          animation: "livePanelPulse 1.6s ease-in-out infinite",
        }} />
        <span style={{ color: teamColor, fontSize: 10, fontWeight: 900 }}>👥 {live.runners_in_zip}</span>
        <span style={{ color: "#5ddaf0", fontSize: 10, fontWeight: 900 }}>🏙️ {live.runners_in_city}</span>
        {aa.active && <span style={{ fontSize: 11 }}>⚔️</span>}
        {ta.active && <span style={{ fontSize: 11 }}>🛡️</span>}
        <span style={{
          color: MUTED, fontSize: 9, marginLeft: 1, opacity: 0.9,
          borderLeft: "1px solid rgba(255,255,255,0.15)", paddingLeft: 5,
          fontWeight: 700,
        }}>▾</span>
        <style>{`
          @keyframes livePanelPulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.5);opacity:0.5} }
          @keyframes liveChipAlert { 0%,100%{box-shadow:0 0 14px ${alertColor}66, 0 4px 14px rgba(0,0,0,0.3)} 50%{box-shadow:0 0 22px ${alertColor}aa, 0 4px 14px rgba(0,0,0,0.3)} }
        `}</style>
      </button>
    );
  }

  // Expanded: volles Panel
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
    }}>
      {/* Header mit Close */}
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
          color: "#4ade80", fontSize: 9, fontWeight: 800, letterSpacing: 1.5, flex: 1,
        }}>{tMP("lpLiveLabel")}</span>
        <button
          onClick={() => setExpanded(false)}
          aria-label={tMP("lpCollapseAria")}
          style={{
            background: "transparent", border: "none", color: MUTED,
            cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 2,
          }}
        >×</button>
      </div>
      <style>{`@keyframes livePanelPulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.5);opacity:0.5} }`}</style>

      {row("👥", live.runners_in_zip, tMP("lpInDistrict", { district: live.district }), teamColor)}
      {row("🏙️", live.runners_in_city, tMP("lpInCity", { city: live.city }), "#5ddaf0")}

      <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "4px 0" }} />

      <AttackIndicator
        active={aa.active}
        icon="⚔️"
        labelActive={tMP("lpAttackActive")}
        labelInactive={tMP("lpAttackInactive")}
        street={aa.street_name}
        attacker={aa.attacker_username}
        attackerColor={aa.attacker_color}
        alertColor="#FF2D78"
        onViewRunner={onViewRunner}
      />

      <AttackIndicator
        active={ta.active}
        icon="🛡️"
        labelActive={tMP("lpTerritoryActive")}
        labelInactive={tMP("lpTerritoryInactive")}
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
  const rankArt = useRankArt();
  const rId = rankIdByName(runner.rank_name);
  const tMP = useTranslations("MapPanels");
  const locale = useLocale();
  const isEnemy = runner.faction !== myFaction;
  const relationColor = isEnemy ? "#FF2D78" : "#4ade80";
  const memberSince = new Date(runner.member_since).toLocaleDateString(getDateLocale(locale), {
    month: "short", year: "numeric",
  });

  return (
    <Modal
      title={runner.display_name}
      subtitle={tMP("rpSubtitle", { username: runner.username, lastSeen: runner.last_seen })}
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
            {isEnemy ? tMP("rpFactionEnemy") : tMP("rpFactionAllied")}
          </div>
          <div style={{ color: TEXT_SOFT, fontSize: 11, marginTop: 1 }}>
            {normalizeFaction(runner.faction) === "kronenwacht" ? tMP("rpFactionKronenwacht") : tMP("rpFactionGossenbund")}
            {runner.crew_name && (
              <> · {tMP("rpCrewLabel")}<span style={{ color: runner.crew_color || "#FFF", fontWeight: 700 }}>{runner.crew_name}</span></>
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
        {rId ? (
          <RankBadge rankId={rId} color={runner.rank_color} size={56} rankArt={rankArt} fallbackEmoji="🏆" showNumberOverlay />
        ) : (
          <div style={{
            width: 56, height: 56, borderRadius: 12,
            background: `linear-gradient(135deg, ${runner.rank_color}44, ${runner.rank_color}18)`,
            border: `1px solid ${runner.rank_color}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 14px ${runner.rank_color}55`,
          }}>
            <span style={{ fontSize: 22 }}>🏆</span>
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ color: MUTED, fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>{tMP("rpRankLabel")}</div>
          <div style={{ color: runner.rank_color, fontSize: 16, fontWeight: 900 }}>
            {runner.rank_name}
          </div>
          <div style={{ color: "#FFD700", fontSize: 12, fontWeight: 700, marginTop: 2 }}>
            {runner.xp.toLocaleString(getNumberLocale(locale))} 🪙
          </div>
        </div>
      </div>

      {/* Stats-Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <RunnerStat emoji="🏆" value={runner.territories.toString()} label={tMP("rpStatTerritories")} color={runner.team_color} />
        <RunnerStat emoji="🌍" value={runner.total_km.toFixed(1)} label={tMP("rpStatKmTotal")} unit={tMP("rpStatKmUnit")} color="#5ddaf0" />
        <RunnerStat emoji="🔥" value={runner.streak_days.toString()} label={tMP("rpStatStreakActive")} unit={tMP("rpStatDays")} color="#FFD700" />
        <RunnerStat emoji="⭐" value={runner.streak_best.toString()} label={tMP("rpStatStreakBest")} unit={tMP("rpStatDays")} color="#FF6B4A" />
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
            <div style={{ color: MUTED, fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>{tMP("rpMapIconLabel")}</div>
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
            <div style={{ color: MUTED, fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>{tMP("rpLightLabel")}</div>
          </div>
        </div>
      </div>

      {/* Mitglied seit */}
      <div style={{
        textAlign: "center", color: MUTED, fontSize: 11, fontStyle: "italic",
      }}>
        {tMP("rpMemberSince", { date: memberSince })}
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

/* ═══════════════════════════════════════════════════════
 * HAPPY HOUR Banner + Map-Buttons + Area/Boost/Mission-Modals
 * ═══════════════════════════════════════════════════════ */

function HappyHourBanner() {
  const tMD = useTranslations("MapDashboard");
  const hh = getCurrentHappyHour();
  const [remaining, setRemaining] = useState("");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!hh.active) return;
    const tick = () => {
      const diff = new Date(hh.ends_at).getTime() - Date.now();
      if (diff <= 0) { setRemaining("0:00"); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${m}:${s.toString().padStart(2, "0")}`);
    };
    tick();
    const int = setInterval(tick, 1000);
    return () => clearInterval(int);
  }, [hh.active, hh.ends_at]);

  if (!hh.active) return null;

  const baseStyle = {
    position: "absolute" as const, top: 60, left: 20, zIndex: 55,
    background: "linear-gradient(90deg, rgba(255, 215, 0, 0.22), rgba(255, 107, 74, 0.22))",
    backdropFilter: "blur(16px) saturate(180%)",
    WebkitBackdropFilter: "blur(16px) saturate(180%)",
    border: "1px solid rgba(255, 215, 0, 0.6)",
    boxShadow: "0 0 14px rgba(255, 215, 0, 0.35)",
    animation: "happyHourPulse 2s ease-in-out infinite",
    whiteSpace: "nowrap" as const,
    cursor: "pointer" as const,
  };
  const keyframes = `@keyframes happyHourPulse { 0%,100%{box-shadow:0 0 14px rgba(255,215,0,0.35)} 50%{box-shadow:0 0 22px rgba(255,215,0,0.6)} }`;

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        aria-label={tMD("ariaExpandHappyHour")}
        style={{
          ...baseStyle,
          borderRadius: 999,
          padding: "5px 8px",
          display: "flex", alignItems: "center", gap: 4,
        }}
      >
        <span style={{ fontSize: 12 }}>⚡</span>
        <span style={{ color: "#FFD700", fontSize: 10, fontWeight: 900, letterSpacing: 0.5 }}>
          {hh.multiplier}×
        </span>
        <style>{keyframes}</style>
      </button>
    );
  }

  return (
    <button
      onClick={() => setExpanded(false)}
      aria-label={tMD("ariaCollapseHappyHour")}
      style={{
        ...baseStyle,
        borderRadius: 999,
        padding: "4px 10px",
        display: "flex", alignItems: "center", gap: 6,
      }}
    >
      <span style={{ fontSize: 12 }}>⚡</span>
      <span style={{ color: "#FFD700", fontSize: 10, fontWeight: 900, letterSpacing: 0.5 }}>
        {hh.multiplier}× 🪙
      </span>
      <span style={{ color: "#FFF", fontSize: 10, fontWeight: 700, opacity: 0.85 }}>
        {remaining}
      </span>
      <span style={{
        color: MUTED, fontSize: 10, marginLeft: 2, opacity: 0.9,
        borderLeft: "1px solid rgba(255,255,255,0.18)", paddingLeft: 6,
        fontWeight: 700,
      }}>▸</span>
      <style>{keyframes}</style>
    </button>
  );
}

function MapIconButton({ icon, label, onClick, active, accent, badge, size = 48 }: {
  icon: string; label: string; onClick: () => void; active?: boolean; accent?: string; badge?: number; size?: number;
}) {
  const color = accent || (active ? PRIMARY : "#FFF");
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        width: size, height: size, borderRadius: size >= 40 ? 14 : 10,
        background: active ? `${color}28` : "rgba(18, 26, 46, 0.55)",
        backdropFilter: "blur(16px) saturate(160%)",
        WebkitBackdropFilter: "blur(16px) saturate(160%)",
        border: active ? `1px solid ${color}` : "1px solid rgba(255,255,255,0.14)",
        cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative",
        fontSize: size >= 40 ? 20 : 14,
        boxShadow: active ? `0 0 14px ${color}66` : "0 4px 14px rgba(0,0,0,0.3)",
        transition: "all 0.15s",
      }}
    >
      {icon}
      {badge !== undefined && badge > 0 && (
        <div style={{
          position: "absolute", top: -4, right: -4,
          minWidth: 18, height: 18, borderRadius: 9,
          background: ACCENT, color: "#FFF",
          fontSize: 10, fontWeight: 900,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "0 5px",
          boxShadow: `0 0 8px ${ACCENT}88`,
        }}>{badge}</div>
      )}
    </button>
  );
}

/* ═══ Lauf-Bildschirm-Sperre ═══ */
function LockOverlay({ onUnlock, teamColor, walking, currentStreet, distance }: {
  onUnlock: () => void;
  teamColor: string;
  walking: boolean;
  currentStreet: string | null;
  distance: number;
}) {
  const tMD = useTranslations("MapDashboard");
  const [pressing, setPressing] = useState(false);
  const [progress, setProgress] = useState(0); // 0..100
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const UNLOCK_MS = 1500;

  const startPress = useCallback(() => {
    setPressing(true);
    startRef.current = performance.now();
    const tick = () => {
      const elapsed = performance.now() - startRef.current;
      const p = Math.min(100, (elapsed / UNLOCK_MS) * 100);
      setProgress(p);
      if (p >= 100) {
        setPressing(false);
        setProgress(0);
        onUnlock();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [onUnlock]);

  const cancelPress = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setPressing(false);
    setProgress(0);
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: "fixed", inset: 0, zIndex: 2000,
        background: "radial-gradient(circle at 50% 30%, rgba(34, 209, 195, 0.15) 0%, rgba(15, 17, 21, 0.97) 60%)",
        backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between",
        padding: "max(40px, env(safe-area-inset-top)) 24px max(40px, env(safe-area-inset-bottom))",
        touchAction: "none", userSelect: "none", WebkitUserSelect: "none",
      }}
    >
      {/* Top: Uhrzeit */}
      <div style={{ textAlign: "center", color: "#FFF" }}>
        <div style={{ fontSize: 64, fontWeight: 300, letterSpacing: -1, lineHeight: 1 }}>
          {time.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
        </div>
        <div style={{ fontSize: 13, color: "#a8b4cf", marginTop: 8 }}>
          {time.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}
        </div>
      </div>

      {/* Middle: Status */}
      <div style={{ textAlign: "center", color: "#FFF" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "4px 12px", borderRadius: 999,
          background: walking ? `${teamColor}22` : "rgba(255,255,255,0.08)",
          border: `1px solid ${walking ? teamColor : "rgba(255,255,255,0.15)"}`,
          fontSize: 11, fontWeight: 900, letterSpacing: 1,
          marginBottom: 20,
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: 4,
            background: walking ? "#4ade80" : "#888",
            boxShadow: walking ? "0 0 8px #4ade80" : "none",
            animation: walking ? "lockDot 1.6s ease-in-out infinite" : "none",
          }} />
          <span style={{ color: walking ? teamColor : "#a8b4cf" }}>
            {walking ? tMD("labelRunRunning") : tMD("labelScreenLocked")}
          </span>
        </div>
        <style>{`@keyframes lockDot { 0%,100% { transform: scale(1); } 50% { transform: scale(1.5); } }`}</style>
        {walking && (
          <>
            <div style={{ fontSize: 56, fontWeight: 900, color: "#FFF", letterSpacing: -1, lineHeight: 1 }}>
              {(distance / 1000).toFixed(2)}
              <span style={{ fontSize: 20, color: "#a8b4cf", fontWeight: 600, marginLeft: 6 }}>km</span>
            </div>
            {currentStreet && (
              <div style={{ fontSize: 14, color: "#a8b4cf", marginTop: 10 }}>
                📍 {currentStreet}
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom: Unlock */}
      <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <div style={{
          color: pressing ? teamColor : "#a8b4cf",
          fontSize: 13, fontWeight: 700, letterSpacing: 0.5,
          textAlign: "center",
        }}>
          {pressing
            ? tMD("holdToUnlock")
            : tMD("labelTapHoldUnlock")}
        </div>
        <button
          onMouseDown={startPress}
          onMouseUp={cancelPress}
          onMouseLeave={cancelPress}
          onTouchStart={(e) => { e.preventDefault(); startPress(); }}
          onTouchEnd={cancelPress}
          onTouchCancel={cancelPress}
          aria-label={tMD("ariaHoldToUnlock")}
          style={{
            position: "relative",
            width: 96, height: 96, borderRadius: 48,
            background: pressing
              ? `conic-gradient(${teamColor} ${progress * 3.6}deg, rgba(255,255,255,0.08) 0deg)`
              : "rgba(255,255,255,0.08)",
            border: `2px solid ${pressing ? teamColor : "rgba(255,255,255,0.25)"}`,
            boxShadow: pressing ? `0 0 30px ${teamColor}cc` : "0 0 14px rgba(0,0,0,0.5)",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            transition: "box-shadow 0.2s, border-color 0.2s",
          }}
        >
          <div style={{
            width: 76, height: 76, borderRadius: 38,
            background: "rgba(15, 17, 21, 0.9)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 34,
          }}>
            {pressing ? "🔓" : "🔒"}
          </div>
        </button>
        <div style={{ color: "#a8b4cf", fontSize: 10, marginTop: 4, textAlign: "center", maxWidth: 240, lineHeight: 1.4 }}>
          Taps und Gesten werden ignoriert — Handy in die Tasche, Tracking läuft weiter.
        </div>
      </div>
    </div>
  );
}

function AreaDetailModal({ area, onClose, onViewRunner }: {
  area: ClaimedArea;
  onClose: () => void;
  onViewRunner: (username: string) => void;
}) {
  const tMP = useTranslations("MapPanels");
  const locale = useLocale();
  const ownerLabel: Record<string, string> = {
    me: tMP("adOwnerMe"),
    crew: tMP("adOwnerCrew"),
    enemy_crew: tMP("adOwnerEnemyCrew"),
    enemy_solo: tMP("adOwnerEnemySolo"),
  };
  const buffLabel: Record<string, string> = {
    xp_multiplier: tMP("adBuffXp", { value: area.buff_value }),
    shield:        tMP("adBuffShield", { value: area.buff_value }),
    radar:         tMP("adBuffRadar", { value: area.buff_value }),
    speed:         tMP("adBuffSpeed", { value: area.buff_value }),
    none:          tMP("adBuffNone"),
  };
  const isOwn = area.owner_type === "me" || area.owner_type === "crew";
  const captured = new Date(area.captured_at).toLocaleDateString(getDateLocale(locale), { day: "2-digit", month: "short", year: "numeric" });

  return (
    <Modal
      title={area.name}
      subtitle={ownerLabel[area.owner_type]}
      icon={isOwn ? "🏰" : "⚔️"}
      accent={area.owner_color}
      onClose={onClose}
    >
      {/* Owner & Level */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 14px", borderRadius: 12, marginBottom: 14,
        background: `${area.owner_color}15`,
        border: `1px solid ${area.owner_color}55`,
      }}>
        <div style={{
          width: 46, height: 46, borderRadius: 12,
          background: `linear-gradient(135deg, ${area.owner_color}55, ${area.owner_color}22)`,
          border: `1px solid ${area.owner_color}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 24, boxShadow: `0 0 14px ${area.owner_color}66`,
        }}>{area.level === 3 ? "🏰" : area.level === 2 ? "🏛" : "🏠"}</div>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#FFF", fontSize: 15, fontWeight: 800 }}>{area.owner_name}</div>
          <div style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>
            {"★".repeat(area.level)}{"☆".repeat(3 - area.level)} · {tMP("adLevelLabel", { n: area.level })}
          </div>
        </div>
      </div>

      {/* Buff */}
      <div style={{
        padding: "12px 14px", borderRadius: 12, marginBottom: 14,
        background: "linear-gradient(135deg, rgba(255, 215, 0, 0.12), rgba(70, 82, 122, 0.4))",
        border: "1px solid rgba(255, 215, 0, 0.3)",
      }}>
        <div style={{ color: "#FFD700", fontSize: 10, fontWeight: 800, letterSpacing: 1, marginBottom: 4 }}>
          {tMP("adActiveBuff")}
        </div>
        <div style={{ color: "#FFF", fontSize: 14, fontWeight: 700 }}>{buffLabel[area.buff_type]}</div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <RunnerStat emoji="⚡" value={area.passive_power_per_day.toString()} label={tMP("adStatPower")} color={PRIMARY} />
        <RunnerStat emoji="👥" value={area.contributors.length.toString()} label={tMP("adStatContributors")} color="#5ddaf0" />
      </div>

      {/* Contributors */}
      <div style={{
        padding: "12px 14px", borderRadius: 12, marginBottom: 14,
        background: "rgba(70, 82, 122, 0.45)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{ color: MUTED, fontSize: 10, fontWeight: 800, letterSpacing: 1, marginBottom: 6 }}>
          {tMP("adContributorsHeader")}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {area.contributors.map((c) => {
            const canView = c !== "Du" && !!DEMO_RUNNERS[c];
            return (
              <button
                key={c}
                onClick={canView ? () => onViewRunner(c) : undefined}
                disabled={!canView}
                style={{
                  padding: "5px 12px", borderRadius: 10,
                  background: `${area.owner_color}22`,
                  border: `1px solid ${area.owner_color}55`,
                  color: area.owner_color, fontSize: 12, fontWeight: 700,
                  cursor: canView ? "pointer" : "default",
                  display: "inline-flex", alignItems: "center", gap: 4,
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (canView) e.currentTarget.style.background = `${area.owner_color}44`;
                }}
                onMouseLeave={(e) => {
                  if (canView) e.currentTarget.style.background = `${area.owner_color}22`;
                }}
              >
                {c}
                {canView && <span style={{ fontSize: 9, opacity: 0.7 }}>→</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ textAlign: "center", color: MUTED, fontSize: 11, fontStyle: "italic" }}>
        {tMP("adCapturedOn", { date: captured })}
      </div>

      {isOwn && area.level < 3 && (() => {
        const next = area.level + 1;
        const cost = (area.level * 2000).toLocaleString(getNumberLocale(locale));
        return (
          <button
            onClick={() => appAlert(tMP("adUpgradeAlert", { next, cost }))}
            style={{
              width: "100%", marginTop: 16, padding: "12px 18px", borderRadius: 12,
              background: `linear-gradient(135deg, ${area.owner_color}, ${PRIMARY})`,
              border: "none", cursor: "pointer",
              color: BG_DEEP, fontSize: 14, fontWeight: 900,
              boxShadow: `0 4px 16px ${area.owner_color}66`,
            }}
          >
            {tMP("adUpgradeBtn", { next, cost })}
          </button>
        );
      })()}
    </Modal>
  );
}


type LiveMission = {
  assignment_id: string;
  id: string;
  code: string;
  type: "daily" | "weekly";
  category: string;
  name: string;
  description: string;
  icon: string;
  target_metric: string;
  target: number;
  reward_xp: number;
  progress: number;
  completed_at: string | null;
  claimed_at: string | null;
};

function MissionsModal({ onClose }: { onClose: () => void }) {
  const tM = useTranslations("Missions");
  const [missions, setMissions] = useState<LiveMission[] | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);

  const load = async () => {
    try {
      const r = await fetch("/api/missions/daily", { cache: "no-store" });
      const j = await r.json();
      setMissions(j.missions ?? []);
    } catch {
      setMissions([]);
    }
  };
  useEffect(() => deferIdle(() => void load()), []);

  const claim = async (assignmentId: string) => {
    setClaiming(assignmentId);
    try {
      const r = await fetch("/api/missions/daily", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assignment_id: assignmentId, action: "claim" }),
      });
      if (r.ok) {
        const j = await r.json();
        const amt = j.reward_wegemuenzen ?? j.reward_xp ?? 0;
        await appAlert(tM("claimedAlert", { xp: amt }));
        await load();
      } else {
        const j = await r.json().catch(() => ({}));
        await appAlert(tM("errorAlert", { error: String(j.error ?? tM("errorUnknown")) }));
      }
    } finally { setClaiming(null); }
  };

  const daily = (missions ?? []).filter((m) => m.type === "daily");
  const weekly = (missions ?? []).filter((m) => m.type === "weekly");

  return (
    <Modal
      title={tM("modalTitle")}
      subtitle={tM("modalSubtitle")}
      icon="🎯"
      accent="#FF6B4A"
      onClose={onClose}
    >
      {missions === null ? (
        <div style={{ padding: 30, textAlign: "center", color: "#8B8FA3", fontSize: 13 }}>{tM("loading")}</div>
      ) : missions.length === 0 ? (
        <div style={{ padding: 30, textAlign: "center", color: "#8B8FA3", fontSize: 13 }}>
          {tM("empty")}<br />
          <span style={{ fontSize: 11, opacity: 0.7 }}>{tM("emptyHint")}</span>
        </div>
      ) : (
        <>
          {daily.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#FF6B4A", fontWeight: 800, letterSpacing: 1, marginBottom: 8 }}>
                {tM("dailyHeader")}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {daily.map((m) => <MissionRow key={m.assignment_id} mission={m} claiming={claiming === m.assignment_id} onClaim={() => claim(m.assignment_id)} />)}
              </div>
            </div>
          )}
          {weekly.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: "#FFD700", fontWeight: 800, letterSpacing: 1, marginBottom: 8 }}>
                {tM("weeklyHeader")}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {weekly.map((m) => <MissionRow key={m.assignment_id} mission={m} claiming={claiming === m.assignment_id} onClaim={() => claim(m.assignment_id)} />)}
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

function MissionRow({ mission: m, claiming, onClaim }: { mission: LiveMission; claiming?: boolean; onClaim?: () => void }) {
  const tM = useTranslations("Missions");
  const pct = Math.min(100, (m.progress / m.target) * 100);
  const done = m.progress >= m.target;
  const accent = m.type === "daily" ? "#FF6B4A" : "#FFD700";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 14px", borderRadius: 14,
      background: done
        ? `linear-gradient(90deg, ${accent}28, rgba(70, 82, 122, 0.5))`
        : "rgba(70, 82, 122, 0.45)",
      border: done ? `1px solid ${accent}88` : "1px solid rgba(255,255,255,0.08)",
      boxShadow: done ? `0 0 14px ${accent}33` : "none",
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 21,
        background: `${accent}22`, border: `1px solid ${accent}66`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22, flexShrink: 0,
      }}>{m.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span style={{ color: "#FFF", fontSize: 13, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</span>
          <span style={{ color: accent, fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
            {typeof m.progress === "number" ? m.progress.toFixed(m.progress % 1 === 0 ? 0 : 1) : m.progress}/{m.target}
          </span>
        </div>
        <div style={{ color: MUTED, fontSize: 10, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.description}</div>
        <div style={{ marginTop: 6, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${pct}%`,
            background: `linear-gradient(90deg, ${accent}, ${PRIMARY})`,
            borderRadius: 3, boxShadow: `0 0 6px ${accent}88`,
            transition: "width 0.6s ease-out",
          }} />
        </div>
      </div>
      {done && !m.claimed_at && onClaim ? (
        <button
          onClick={onClaim}
          disabled={claiming}
          style={{
            padding: "6px 10px", borderRadius: 10, flexShrink: 0,
            background: accent, border: `1px solid ${accent}`,
            color: BG_DEEP, fontSize: 10, fontWeight: 900, cursor: "pointer",
            boxShadow: `0 0 10px ${accent}66`,
            opacity: claiming ? 0.5 : 1,
          }}
        >
          {claiming ? tM("claiming") : `💰 +${m.reward_xp} 🪙`}
        </button>
      ) : (
        <div style={{
          padding: "3px 8px", borderRadius: 8, flexShrink: 0,
          background: m.claimed_at ? "rgba(74,222,128,0.15)" : `${accent}22`,
          border: `1px solid ${m.claimed_at ? "#4ade80" : accent}`,
        }}>
          <span style={{ color: m.claimed_at ? "#4ade80" : accent, fontSize: 10, fontWeight: 900 }}>
            {m.claimed_at ? tM("claimed") : `+${m.reward_xp} 🪙`}
          </span>
        </div>
      )}
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
  const tMD = useTranslations("MapDashboard");
  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  // Lokaler YYYY-MM-DD (NICHT UTC) — sonst landet ein Lauf am Abend der falschen Tag
  const localKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const todayKey = localKey(now);

  // KM heute (r.created_at ist ISO UTC — in Date parsen dann localKey)
  const todayKm = runs
    .filter((r) => localKey(new Date(r.created_at)) === todayKey)
    .reduce((s, r) => s + r.distance_m, 0) / 1000;

  // Wochen-Trend: km pro Tag der aktuellen Woche (Mo–So)
  const weekKm: { label: string; km: number; isToday: boolean }[] = [];
  const monday = new Date(now);
  const dow = (now.getDay() + 6) % 7; // Mo=0 … So=6
  monday.setDate(now.getDate() - dow);
  monday.setHours(0, 0, 0, 0);
  const DAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday.getTime() + i * msPerDay);
    const key = localKey(d);
    const km = runs
      .filter((r) => localKey(new Date(r.created_at)) === key)
      .reduce((s, r) => s + r.distance_m, 0) / 1000;
    weekKm.push({
      label: DAY_LABELS[i],
      km,
      isToday: key === todayKey,
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
          {walking ? tMD("labelRunningNow") : tMD("labelReadyToStart")}
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
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 72 }}>
            {weekKm.map((w, i) => {
              const maxPx = 40; // reservierte Bar-Hoehe
              const h = w.km > 0 ? Math.max(6, (w.km / maxWeekKm) * maxPx) : 3;
              return (
                <div key={i} style={{
                  flex: 1, minWidth: 0,
                  display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 3,
                  justifyContent: "flex-end",
                }}>
                  <div style={{
                    width: "100%", height: `${h}px`,
                    background: w.km > 0
                      ? `linear-gradient(180deg, ${teamColor}, ${teamColor}55)`
                      : "rgba(255,255,255,0.08)",
                    borderRadius: 2,
                    boxShadow: w.km > 0 ? `0 0 6px ${teamColor}99` : "none",
                    border: w.isToday ? `1px solid ${w.km > 0 ? "#FFF" : teamColor}` : "none",
                  }} />
                  {/* Fixe 2-Zeilen-Höhe: Tag + optionaler km-Wert. Verhindert
                      uneinheitliche Spaltenhöhen, die den Bar nach oben schieben. */}
                  <span style={{
                    fontSize: 9, lineHeight: "11px",
                    color: w.isToday ? teamColor : MUTED,
                    fontWeight: w.isToday ? 800 : 600,
                    whiteSpace: "nowrap",
                  }}>{w.label}</span>
                  <span style={{
                    fontSize: 8, lineHeight: "10px",
                    color: w.isToday ? teamColor : MUTED,
                    fontWeight: w.isToday ? 700 : 500,
                    whiteSpace: "nowrap",
                    minHeight: 10,
                  }}>{w.km > 0 ? `${w.km.toFixed(1)} km` : ""}</span>
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

type AchItem = {
  id: string; icon: string; name: string; xp: number; unlocked: boolean;
  current: number; target: number; unit: string; pct: number;
  displayFmt: (v: number) => string;
  tier?: string;
};

function CategoryAccordion({ cat, unlocked, total, items }: {
  cat: { id: string; name: string; icon: string; color: string; description: string };
  unlocked: number;
  total: number;
  items: AchItem[];
}) {
  const [open, setOpen] = useState(false);
  const pct = Math.round((unlocked / total) * 100);
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10,
          padding: "10px 12px", borderRadius: 10,
          background: `${cat.color}18`, border: `1px solid ${cat.color}44`,
          color: "#FFF", cursor: "pointer", textAlign: "left",
        }}
      >
        <span style={{ fontSize: 22 }}>{cat.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: cat.color, fontSize: 13, fontWeight: 900 }}>{cat.name}</div>
          <div style={{ color: "#a8b4cf", fontSize: 10 }}>{cat.description}</div>
          <div style={{ height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: cat.color, transition: "width 0.3s" }} />
          </div>
        </div>
        <span style={{ color: cat.color, fontSize: 11, fontWeight: 800 }}>{unlocked}/{total}</span>
        <span style={{ color: "#a8b4cf", fontSize: 16, transform: open ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.2s" }}>›</span>
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6, marginBottom: 4 }}>
          {items.map((a) => (
            <AchievementRow
              key={a.id} icon={a.icon} name={a.name} xp={a.xp} unlocked={a.unlocked}
              current={a.current} target={a.target} unit={a.unit} pct={a.pct}
              displayFmt={a.displayFmt} tier={a.tier}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AchievementRow({ icon, name, xp, unlocked, current, target, unit, pct, displayFmt, tier }: {
  icon: string; name: string; xp: number; unlocked: boolean;
  current: number; target: number; unit: string; pct: number;
  displayFmt: (v: number) => string;
  tier?: string;
}) {
  const tMP = useTranslations("MapPanels");
  const locale = useLocale();
  const tierColors: Record<string, string> = { easy: "#CD7F32", medium: "#C0C0C0", hard: "#FFD700", epic: "#E5E4E2", legend: "#B9F2FF" };
  const tierLabels: Record<string, string> = {
    easy: tMP("achTierBronze"),
    medium: tMP("achTierSilber"),
    hard: tMP("achTierGold"),
    epic: tMP("achTierPlatin"),
    legend: tMP("achTierDiamant"),
  };
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
            display: "flex", alignItems: "center", gap: 6,
          }}>
            {name}
            {tier && (
              <span style={{
                fontSize: 9, fontWeight: 900, letterSpacing: 0.5,
                padding: "2px 5px", borderRadius: 4,
                background: `${tierColors[tier]}22`, color: tierColors[tier],
                border: `1px solid ${tierColors[tier]}66`,
              }}>{tierLabels[tier]}</span>
            )}
          </span>
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
          {unlocked ? "✓ " : ""}+{xp.toLocaleString(getNumberLocale(locale))} 🪙
        </span>
      </div>
    </div>
  );
}

function MonthlyCalendar({ runs, color }: { runs: Territory[]; color: string }) {
  const tMP = useTranslations("MapPanels");
  const locale = useLocale();
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastOfMonth.getDate();
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7; // Mo=0
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // km pro Tag aggregieren (lokale Zeit!)
  const kmMap = new Map<number, number>();
  const runsMap = new Map<number, Territory[]>();
  for (const r of runs) {
    const d = new Date(r.created_at);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      kmMap.set(day, (kmMap.get(day) || 0) + r.distance_m);
      const list = runsMap.get(day) || [];
      list.push(r);
      runsMap.set(day, list);
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

  const monthName = firstOfMonth.toLocaleDateString(getDateLocale(locale), { month: "long", year: "numeric" });
  const weekdays = [tMP("calWeekday0"), tMP("calWeekday1"), tMP("calWeekday2"), tMP("calWeekday3"), tMP("calWeekday4"), tMP("calWeekday5"), tMP("calWeekday6")];
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
          {tMP("calActiveDays", { active: activeDays, km: totalKm.toFixed(1) })}
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
            const hasRuns = (runsMap.get(day)?.length ?? 0) > 0;
            const isSelected = selectedDay === day;
            return (
              <button
                key={i}
                onClick={() => hasRuns && setSelectedDay(isSelected ? null : day)}
                disabled={!hasRuns}
                title={km > 0 ? tMP("calDayTooltip", { day, km: km.toFixed(2) }) : tMP("calDayPlain", { day })}
                style={{
                  width: 32, height: 32, borderRadius: 6,
                  background: isFuture ? "rgba(255,255,255,0.03)" : bgFor(intensity(km)),
                  border: isSelected ? `2px solid #FFD700` : isToday ? `2px solid ${color}` : "1px solid rgba(255,255,255,0.06)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: km > 0 ? 800 : 500,
                  color: isFuture ? MUTED : (km > 0 ? "#FFF" : TEXT_SOFT),
                  boxShadow: km > 0 ? `0 0 6px ${color}66` : "none",
                  opacity: isFuture ? 0.35 : 1,
                  cursor: hasRuns ? "pointer" : "default",
                  padding: 0,
                }}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legende */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: MUTED }}>
        <span>{tMP("calLess")}</span>
        {[0, 1, 2, 3, 4].map((lvl) => (
          <div key={lvl} style={{ width: 10, height: 10, borderRadius: 2, background: bgFor(lvl) }} />
        ))}
        <span>{tMP("calMore")}</span>
      </div>

      {/* Tages-Details bei Klick */}
      {selectedDay && (() => {
        const dayRuns = runsMap.get(selectedDay) || [];
        const totalM = dayRuns.reduce((s, r) => s + r.distance_m, 0);
        const totalS = dayRuns.reduce((s, r) => s + (r.duration_s || 0), 0);
        const totalXp = dayRuns.reduce((s, r) => s + (r.xp_earned || 0), 0);
        const segs = dayRuns.reduce((s, r) => s + (r.segments_claimed || 0), 0);
        const streets = dayRuns.reduce((s, r) => s + (r.streets_claimed || 0), 0);
        const polys = dayRuns.reduce((s, r) => s + (r.polygons_claimed || 0), 0);
        const kcal = Math.round((totalM / 1000) * 65); // 65 kcal/km Richtwert
        return (
          <div style={{
            width: "100%", maxWidth: 320, marginTop: 6,
            background: "rgba(26,29,35,0.7)", borderRadius: 12, padding: 12,
            border: `1px solid ${color}55`,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ color: "#FFF", fontSize: 13, fontWeight: 900 }}>
                {tMP("calDayHeader", { day: selectedDay, month: firstOfMonth.toLocaleDateString(getDateLocale(locale), { month: "long" }) })}
              </div>
              <button onClick={() => setSelectedDay(null)} style={{ background: "none", border: "none", color: MUTED, fontSize: 16, cursor: "pointer", padding: 0 }}>×</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
              <DayStat label={tMP("calStatKm")}      value={(totalM/1000).toFixed(2)} color={color} />
              <DayStat label={tMP("calStatMin")}     value={Math.round(totalS/60).toString()} color={color} />
              <DayStat label={tMP("calStatXp")}      value={totalXp.toString()} color="#FFD700" />
              <DayStat label={tMP("calStatKcal")}    value={kcal.toString()} color="#FF6B4A" />
              <DayStat label={tMP("calStatRuns")}    value={dayRuns.length.toString()} color={color} />
              <DayStat label={tMP("calStatTerritories")} value={(segs+streets+polys).toString()} color={color} />
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function DayStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: "rgba(15,17,21,0.5)", borderRadius: 8, padding: "6px 8px", textAlign: "center" }}>
      <div style={{ color, fontSize: 14, fontWeight: 900, lineHeight: 1 }}>{value}</div>
      <div style={{ color: "#8B8FA3", fontSize: 9, fontWeight: 700, marginTop: 2, letterSpacing: 0.5 }}>{label.toUpperCase()}</div>
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


function XpGuideSection({ title, subtitle, defaultOpen = false, children }: {
  title: string; subtitle?: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 10 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 14px", borderRadius: 12,
          background: "rgba(70, 82, 122, 0.45)",
          border: "1px solid rgba(255,255,255,0.1)",
          cursor: "pointer", textAlign: "left",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 13, color: PRIMARY, fontWeight: 900, letterSpacing: 0.5 }}>{title}</span>
          {subtitle && <span style={{ fontSize: 11, color: MUTED }}>{subtitle}</span>}
        </div>
        <span style={{ color: MUTED, fontSize: 14, transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>›</span>
      </button>
      {open && (
        <div style={{
          marginTop: 6,
          background: "rgba(70, 82, 122, 0.35)",
          borderRadius: 12, overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.08)",
        }}>
          {children}
        </div>
      )}
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

function Modal({ title, icon, subtitle, accent, children, onClose, maxWidth = 540 }: {
  title: string;
  icon?: string;
  subtitle?: string;
  accent?: string;
  children: React.ReactNode;
  onClose: () => void;
  maxWidth?: number;
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
          width: "100%", maxWidth,
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

type CrewSubTab = "overview" | "feed" | "members" | "guardians" | "challenges" | "events" | "chat" | "tech" | "buildings" | "bounties" | "shop" | "settings";

function CrewTab({
  profile: p,
  myCrew,
  setMyCrew,
  setProfile,
  onOpenRanking,
  onPlaceBuilding,
}: {
  profile: Profile | null;
  myCrew: Crew | null;
  setMyCrew: (c: Crew | null) => void;
  setProfile: (p: Profile) => void;
  onOpenRanking: () => void;
  onPlaceBuilding?: (kind: BuildingKind) => void;
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
    if (!await appConfirm(`"${myCrew.name}" wirklich verlassen/auflösen?`)) return;

    await supabase.from("crew_members").delete().eq("crew_id", myCrew.id).eq("user_id", p.id);
    if (myCrew.owner_id === p.id) {
      await supabase.from("crews").delete().eq("id", myCrew.id);
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
      />
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

/* ═══ RunCard — aufklappbare Lauf-Detail-Karte ═══ */
function fmtDurationLocal(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${m - h * 60}m`;
  }
  return `${m}:${String(sec).padStart(2, "0")}`;
}
function fmtDateLocal(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(today); yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Heute, " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === yest.toDateString()) return "Gestern, " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function RunCard({ run, teamColor }: { run: Territory; teamColor: string }) {
  const tMD = useTranslations("MapDashboard");
  const [open, setOpen] = useState(false);
  const [routeOpen, setRouteOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState<null | "share" | "gpx">(null);

  const km = run.distance_m / 1000;
  const duration = run.duration_s;
  const paceSec = duration > 0 && km > 0 ? duration / km : 0;
  const paceMin = Math.floor(paceSec / 60);
  const paceRestSec = Math.round(paceSec - paceMin * 60);
  const pace = paceSec > 0 ? `${paceMin}:${String(paceRestSec).padStart(2, "0")} min/km` : "–";
  // Schätzungen
  const steps = Math.round((run.distance_m / 0.76));      // ~76cm pro Schritt
  const kcal = Math.round(km * 62);                        // ~62kcal/km beim Laufen
  const avgHr = 118 + Math.round(Math.max(0, 180 / Math.max(paceSec / 60, 4)) * 0.25);
  // Demo-Straßen-Liste (aus street_name-Schnipsel) — falls nur Ein-Straßen-Name: als einziger Eintrag
  const streets = (run.street_name || "Unbekannter Weg").split(/\s*[,/|]\s*/).slice(0, 5);
  const segN = run.segments_claimed ?? 0;
  const strN = run.streets_claimed ?? 0;
  const polyN = run.polygons_claimed ?? 0;
  const baseBreakdown = [
    { label: "Basis-Lauf", value: XP_PER_WALK },
    { label: `${km.toFixed(2)} km × ${XP_PER_KM} Erfahrung`, value: Math.round(km * XP_PER_KM) },
    segN > 0 ? { label: `${segN}× Straßenabschnitt`, value: segN * XP_PER_SEGMENT } : null,
    strN > 0 ? { label: `${strN}× Straßenzug`, value: strN * XP_PER_STREET_CLAIMED } : null,
    polyN > 0 ? { label: `${polyN}× Gebiet`, value: polyN * XP_PER_TERRITORY } : null,
  ].filter((x): x is { label: string; value: number } => x !== null && x.value > 0);
  const breakdownSum = baseBreakdown.reduce((s, r) => s + r.value, 0);
  const bonusDelta = run.xp_earned - breakdownSum;
  const xpBreakdown = bonusDelta > 0
    ? [...baseBreakdown, { label: "Boni & Achievements", value: bonusDelta }]
    : baseBreakdown;

  return (
    <div style={{
      background: "rgba(70, 82, 122, 0.45)", borderRadius: 16,
      border: `1px solid ${open ? teamColor + "88" : "rgba(255, 255, 255, 0.1)"}`,
      overflow: "hidden",
      transition: "border-color 0.2s",
    }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 14,
          padding: 16, width: "100%",
          background: "transparent", border: "none", cursor: "pointer",
          textAlign: "left", color: "#FFF",
        }}
      >
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
            {run.start_address && run.end_address
              ? `${run.start_address} → ${run.end_address}`
              : (run.street_name || run.start_address || run.end_address || "Unbekannter Weg")}
          </div>
          <div style={{ color: MUTED, fontSize: 11, marginTop: 3 }}>
            {fmtDateLocal(run.created_at)} · {km.toFixed(2)} km · {fmtDurationLocal(duration)}
          </div>
        </div>
        <div style={{ color: PRIMARY, fontSize: 13, fontWeight: "bold" }}>+{run.xp_earned}</div>
        <span style={{ color: MUTED, fontSize: 16, transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "none" }}>▾</span>
      </button>

      {open && (
        <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${BORDER}` }}>
          {/* KPI-Grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
            gap: 8, marginTop: 12, marginBottom: 14,
          }}>
            <RunMiniStat icon="📏" value={`${km.toFixed(2)} km`}         label="Distanz"    color={teamColor} />
            <RunMiniStat icon="⏱️" value={fmtDurationLocal(duration)}     label="Dauer"      color="#5ddaf0" />
            <RunMiniStat icon="⚡" value={pace}                            label="Ø Pace"     color="#FFD700" />
            <RunMiniStat icon="👣" value={steps.toLocaleString("de-DE")}  label="Schritte"    color="#a855f7" />
            <RunMiniStat icon="🔥" value={`${kcal} kcal`}                 label={tMD("labelBurned")}   color="#FF6B4A" />
            <RunMiniStat icon="❤️" value={`${avgHr} bpm`}                 label="Ø Puls"      color="#FF2D78" />
          </div>

          {/* Straßen */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ color: MUTED, fontSize: 10, fontWeight: 800, letterSpacing: 0.8, marginBottom: 6 }}>
              GELAUFENE STRASSEN
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {streets.map((s, i) => (
                <span key={i} style={{
                  padding: "4px 10px", borderRadius: 999,
                  background: `${teamColor}14`, border: `1px solid ${teamColor}44`,
                  color: "#FFF", fontSize: 11, fontWeight: 700,
                }}>📍 {s}</span>
              ))}
            </div>
          </div>

          {/* Wegemünzen-Aufschlüsselung */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ color: MUTED, fontSize: 10, fontWeight: 800, letterSpacing: 0.8, marginBottom: 6 }}>
              🪙 WEGEMÜNZEN-AUFSCHLÜSSELUNG
            </div>
            <div style={{
              background: "rgba(0,0,0,0.2)", borderRadius: 10, padding: "8px 12px",
              border: `1px solid ${BORDER}`,
              display: "flex", flexDirection: "column", gap: 4,
            }}>
              {xpBreakdown.map((x, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: MUTED }}>{x.label}</span>
                  <span style={{ color: "#FFF", fontWeight: 700 }}>+{x.value} 🪙</span>
                </div>
              ))}
              <div style={{
                display: "flex", justifyContent: "space-between",
                marginTop: 4, paddingTop: 6, borderTop: `1px solid ${BORDER}`,
                fontSize: 13,
              }}>
                <span style={{ color: "#FFF", fontWeight: 800 }}>Gesamt</span>
                <span style={{ color: PRIMARY, fontWeight: 900 }}>+{run.xp_earned} 🪙</span>
              </div>
            </div>
          </div>

          {/* Ressourcen-Drops */}
          {((run.wood_dropped ?? 0) + (run.stone_dropped ?? 0) + (run.gold_dropped ?? 0) + (run.mana_dropped ?? 0)) > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ color: MUTED, fontSize: 10, fontWeight: 800, letterSpacing: 0.8, marginBottom: 6 }}>
                💎 RESSOURCEN
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                {[
                  { label: "Tech-Schrott", v: run.wood_dropped ?? 0,  c: "#FF6B4A" },
                  { label: "Komponenten",  v: run.stone_dropped ?? 0, c: "#9aa3b2" },
                  { label: "Krypto",       v: run.gold_dropped ?? 0,  c: "#FFD700" },
                  { label: "Bandbreite",   v: run.mana_dropped ?? 0,  c: "#5ddaf0" },
                ].map((r) => (
                  <div key={r.label} style={{ background: "rgba(0,0,0,0.25)", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "6px 8px", textAlign: "center" }}>
                    <div style={{ color: MUTED, fontSize: 9, fontWeight: 800 }}>{r.label}</div>
                    <div style={{ color: r.v > 0 ? r.c : "rgba(255,255,255,0.3)", fontSize: 12, fontWeight: 800 }}>+{r.v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Speed-Tokens */}
          {(run.tokens_dropped ?? 0) > 0 && (
            <div style={{ marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.4)", borderRadius: 10 }}>
              <span style={{ color: "#FFD700", fontSize: 12, fontWeight: 800 }}>⚡ Speed-Tokens (1 / km)</span>
              <span style={{ color: "#FFD700", fontSize: 13, fontWeight: 900 }}>+{run.tokens_dropped}</span>
            </div>
          )}

          {/* XP-Boni einzeln */}
          {(run.xp_bonuses?.length ?? 0) > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ color: MUTED, fontSize: 10, fontWeight: 800, letterSpacing: 0.8, marginBottom: 6 }}>
                🎁 BONI
              </div>
              <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 10, padding: "8px 12px", border: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", gap: 4 }}>
                {(run.xp_bonuses ?? []).map((b, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: MUTED }}>{b.label}{b.pct ? ` (+${b.pct}%)` : ""}</span>
                    <span style={{ color: "#4ade80", fontWeight: 700 }}>
                      {b.extra_amount != null ? `+${b.extra_amount} ${b.unit ?? ""}` : (b.amount != null ? `+${b.amount}` : "✓")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Achievements freigeschaltet */}
          {(run.achievements_unlocked?.length ?? 0) > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ color: MUTED, fontSize: 10, fontWeight: 800, letterSpacing: 0.8, marginBottom: 6 }}>
                🏆 ACHIEVEMENTS FREIGESCHALTET
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(run.achievements_unlocked ?? []).map((a, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.35)", borderRadius: 8 }}>
                    <span style={{ fontSize: 18 }}>{a.emoji ?? "🏆"}</span>
                    <span style={{ color: "#FFF", fontSize: 12, fontWeight: 700, flex: 1 }}>{a.name ?? a.id ?? "Achievement"}</span>
                    {a.xp != null && <span style={{ color: "#FFD700", fontSize: 11, fontWeight: 800 }}>+{a.xp} Erfahrung</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Truhen während des Laufs gesammelt */}
          {(run.chests_collected?.length ?? 0) > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ color: MUTED, fontSize: 10, fontWeight: 800, letterSpacing: 0.8, marginBottom: 6 }}>
                🗝️ TRUHEN GESAMMELT
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(run.chests_collected ?? []).map((c, i) => (
                  <span key={i} style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.45)", color: "#FFF", fontSize: 11, fontWeight: 700 }}>
                    🗝️ {c.name ?? c.id ?? "Truhe"}{c.rarity ? ` · ${c.rarity}` : ""}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Aktionen */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={actionBtnStyle()} onClick={() => setRouteOpen(true)}>
              🗺️ Route anzeigen
            </button>
            <button style={actionBtnStyle()} disabled={actionBusy === "share"} onClick={async () => {
              setActionBusy("share");
              try {
                const { shareRun } = await import("@/lib/run-export");
                const r = await shareRun({
                  street_name: run.street_name,
                  distance_m: run.distance_m,
                  duration_s: run.duration_s,
                  xp_earned: run.xp_earned,
                });
                if (r.ok && r.shared) await appAlert(tMD("sharedOrCopied"));
                else if (!r.ok) await appAlert(tMD("shareNotPossible"));
              } finally { setActionBusy(null); }
            }}>
              {actionBusy === "share" ? "…" : "📤 Teilen"}
            </button>
            <button style={actionBtnStyle()} disabled={actionBusy === "gpx"} onClick={async () => {
              setActionBusy("gpx");
              try {
                const { exportRunAsGPX } = await import("@/lib/run-export");
                const r = await exportRunAsGPX(run.id, run.street_name);
                if (!r.ok) await appAlert(r.error || tMD("gpxExportFailed"));
              } finally { setActionBusy(null); }
            }}>
              {actionBusy === "gpx" ? "…" : "📥 GPX-Export"}
            </button>
          </div>
        </div>
      )}
      {routeOpen && (
        <RunRouteModal runId={run.id} streetName={run.street_name} teamColor={teamColor} onClose={() => setRouteOpen(false)} />
      )}
    </div>
  );
}

function RunMiniStat({ icon, value, label, color }: { icon: string; value: string; label: string; color: string }) {
  return (
    <div style={{
      background: "rgba(0,0,0,0.25)", borderRadius: 10,
      padding: "8px 10px", border: `1px solid ${BORDER}`,
    }}>
      <div style={{ fontSize: 16 }}>{icon}</div>
      <div style={{ color, fontSize: 14, fontWeight: 900, marginTop: 2 }}>{value}</div>
      <div style={{ color: MUTED, fontSize: 9, fontWeight: 700, marginTop: 1, letterSpacing: 0.4 }}>
        {label.toUpperCase()}
      </div>
    </div>
  );
}

function actionBtnStyle(): React.CSSProperties {
  return {
    padding: "8px 12px", borderRadius: 10,
    background: "rgba(30, 38, 60, 0.55)", border: `1px solid ${BORDER}`,
    color: "#FFF", fontSize: 11, fontWeight: 700, cursor: "pointer",
  };
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

/* primaryBtnStyle, outlineBtnStyle, inputStyle moved to ./_tabs/_shared */

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
 * MY CREW VIEW — Dashboard + Tabs
 * ═══════════════════════════════════════════════════════ */
function MyCrewView({
  crew, profile, subTab, setSubTab, onLeave, onPlaceBuilding,
}: {
  crew: Crew;
  profile: Profile | null;
  subTab: CrewSubTab;
  setSubTab: (t: CrewSubTab) => void;
  onLeave: () => void;
  onPlaceBuilding?: (kind: BuildingKind) => void;
}) {
  const tC = useTranslations("Crew");
  const isAdmin = profile?.id === crew.owner_id;
  const tier = leagueTierFor(DEMO_CREW_STATS.weekly_km);
  const nextTier = nextLeagueTier(tier);
  const tierProgress = nextTier
    ? Math.min(1, (DEMO_CREW_STATS.weekly_km - tier.minWeeklyKm) / (nextTier.minWeeklyKm - tier.minWeeklyKm))
    : 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", paddingBottom: 40 }}>
      {/* Crew-Cover mit dynamischem Gradient */}
      <div style={{
        height: 120, position: "relative",
        background: `linear-gradient(135deg, ${crew.color}cc 0%, ${crew.color}44 50%, ${BG_DEEP} 100%)`,
        borderBottom: `1px solid ${BORDER}`,
      }}>
        {/* Radial-Muster für Textur */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `radial-gradient(circle at 20% 30%, ${crew.color}44 0%, transparent 40%), radial-gradient(circle at 80% 70%, ${crew.color}33 0%, transparent 50%)`,
        }} />
        {/* Top-right actions */}
        {isAdmin && (
          <button
            onClick={() => setSubTab("settings")}
            style={{
              position: "absolute", top: 12, right: 12,
              background: "rgba(0,0,0,0.4)", border: `1px solid ${BORDER}`,
              borderRadius: 10, padding: "6px 10px", color: "#FFF",
              fontSize: 11, fontWeight: 800, cursor: "pointer",
              backdropFilter: "blur(8px)",
            }}
          >
            {tC("myCoverChange")}
          </button>
        )}
      </div>

      {/* Crew-Header */}
      <div style={{
        background: CARD, padding: "0 20px 18px",
        borderBottom: `1px solid ${BORDER}`,
      }}>
       <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, marginTop: -32 }}>
          {/* Wappen */}
          <div style={{
            width: 72, height: 72, borderRadius: 18,
            background: `linear-gradient(135deg, ${crew.color} 0%, ${crew.color}aa 100%)`,
            color: BG_DEEP,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 32, fontWeight: 900,
            boxShadow: `0 4px 18px ${crew.color}88, 0 0 0 3px ${BG_DEEP}`,
            position: "relative",
          }}>
            {crew.name.charAt(0).toUpperCase()}
            <span style={{
              position: "absolute", bottom: -4, right: -4,
              background: BG_DEEP, borderRadius: 10, padding: "2px 4px",
              fontSize: 14, border: `1px solid ${crew.color}`,
            }}>🎉</span>
          </div>
          <div style={{ flex: 1, minWidth: 0, paddingBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div style={{ color: "#FFF", fontSize: 22, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {crew.name}
              </div>
              <LeagueBadge weeklyKm={DEMO_CREW_STATS.weekly_km} size="md" />
              <LastSeasonBadge tierId={DEMO_LAST_SEASON_TIER_ID} />
            </div>
            <div style={{ color: MUTED, fontSize: 12, marginTop: 3 }}>
              {tC("myMembersZipSeason", { members: DEMO_CREW_MEMBERS.length, zip: crew.zip ?? "", season: currentSeason().label, daysLeft: currentSeason().daysLeft })}
            </div>
          </div>
          {isAdmin && <span style={{
            fontSize: 10, fontWeight: 900, background: `${PRIMARY}22`,
            color: PRIMARY, padding: "3px 8px", borderRadius: 10,
            border: `1px solid ${PRIMARY}55`, alignSelf: "flex-start",
          }}>{tC("myAdminBadge")}</span>}
        </div>

        {/* Tier-Progress */}
        {nextTier && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: MUTED, marginBottom: 3 }}>
              <span style={{ color: tier.color, fontWeight: 800 }}>{tier.icon} {tier.name}</span>
              <span>{tC("myTierProgress", { km: (nextTier.minWeeklyKm - DEMO_CREW_STATS.weekly_km).toFixed(0), nextIcon: nextTier.icon, nextName: nextTier.name })}</span>
            </div>
            <div style={{ height: 6, background: "rgba(0,0,0,0.35)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${tierProgress * 100}%`,
                background: `linear-gradient(90deg, ${tier.color}, ${nextTier.color})`,
                boxShadow: `0 0 8px ${tier.color}88`,
                transition: "width 1s cubic-bezier(0.2, 0.8, 0.2, 1)",
              }} />
            </div>
          </div>
        )}

        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          <CrewStat label={tC("myStatWeekKm")}      value={`${DEMO_CREW_STATS.weekly_km}`} accent={crew.color} />
          <CrewStat label={tC("myStatTerritories")} value={`${DEMO_CREW_STATS.total_territories}`} accent="#FFD700" />
          <CrewStat label={tC("myStatRankCity")}    value={`#${DEMO_CREW_STATS.weekly_rank_city}`} accent={PRIMARY} />
        </div>
       </div>
      </div>

      {/* Sub-Tabs */}
      <div style={{
        display: "flex", gap: 4, padding: "12px 12px 0", overflowX: "auto",
        borderBottom: `1px solid ${BORDER}`, scrollbarWidth: "none",
        maxWidth: 960, margin: "0 auto", width: "100%",
      }}>
        {([
          { id: "overview",   label: tC("myTabOverview"),   icon: "🏠" },
          { id: "feed",       label: tC("myTabFeed"),       icon: "📰" },
          { id: "members",    label: tC("myTabMembers"),    icon: "👥" },
          { id: "guardians",  label: tC("myTabGuardians"),  icon: "🛡️" },
          { id: "challenges", label: tC("myTabChallenges"), icon: "🏆" },
          { id: "events",     label: tC("myTabEvents"),     icon: "📅" },
          { id: "chat",       label: tC("myTabChat"),       icon: "💬" },
          { id: "tech",       label: "Forschung",           icon: "🧪" },
          { id: "buildings",  label: "Bauwerke",            icon: "🏗️" },
          { id: "bounties",   label: "Kopfgelder",          icon: "🎯" },
          { id: "shop",       label: "Lagerhaus",           icon: "📦" },
          { id: "settings",   label: tC("myTabSettings"),   icon: "⚙️" },
        ] as { id: CrewSubTab; label: string; icon: string }[]).map((t) => {
          const active = subTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              style={{
                padding: "10px 14px", borderRadius: "12px 12px 0 0",
                background: active ? CARD : "transparent",
                border: "none", borderBottom: active ? `2px solid ${crew.color}` : "2px solid transparent",
                color: active ? "#FFF" : MUTED,
                fontSize: 12, fontWeight: 800, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
              }}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ padding: "18px 20px", maxWidth: 960, margin: "0 auto", width: "100%" }}>
        {/* Live-Zentrale: echte Daten aus DB (Members, Duelle, Challenges, Events, Chat, Feed, Shop).
            Nur auf der Übersicht — sonst dupliziert sich die Pill-Row mit den Haupt-Tabs. */}
        {subTab === "overview" && profile?.id && (
          <CrewLiveHub
            crew={{ id: crew.id, name: crew.name, color: crew.color, owner_id: crew.owner_id, invite_code: crew.invite_code ?? null }}
            userId={profile.id}
            isAdmin={isAdmin}
          />
        )}

        {subTab === "overview"   && <CrewOverview crew={crew} isAdmin={isAdmin} onLeave={onLeave} />}
        {subTab === "feed"       && <CrewFeed color={crew.color} />}
        {subTab === "members"    && <CrewMembers color={crew.color} isAdmin={isAdmin} />}
        {subTab === "guardians"  && <CrewGuardians crewId={crew.id} crewColor={crew.color} />}
        {subTab === "challenges" && <CrewChallenges color={crew.color} />}
        {subTab === "events"     && <CrewEvents color={crew.color} />}
        {subTab === "chat"       && <CrewChat color={crew.color} meUsername={profile?.username || "me"} />}
        {subTab === "tech"       && <TabTech />}
        {subTab === "buildings"  && <TabBauwerke onPlaceBuilding={onPlaceBuilding} />}
        {subTab === "bounties"   && <TabKopfgelder crewId={crew.id} />}
        {subTab === "shop"       && <TabShop />}
        {subTab === "settings"   && <CrewSettings crew={crew} isAdmin={isAdmin} />}
      </div>
    </div>
  );
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
    <div style={{
      background: "rgba(0,0,0,0.25)", borderRadius: 12, padding: "10px 8px",
      textAlign: "center", border: `1px solid ${BORDER}`,
    }}>
      <div style={{ color: accent, fontSize: 18, fontWeight: 900, textShadow: `0 0 10px ${accent}66` }}>{value}</div>
      <div style={{ color: MUTED, fontSize: 10, fontWeight: 700, marginTop: 2, letterSpacing: 0.5 }}>
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

function CrewMembers({ color, isAdmin }: { color: string; isAdmin: boolean }) {
  const tCrew = useTranslations("Crew");
  const rankArt = useRankArt();
  const inactive = DEMO_CREW_MEMBERS.filter((m) => m.weekly_km < 5);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <DemoBadge hint={tCrew("memDemoHint")} />
      </div>
      {inactive.length > 0 && (
        <div style={{
          background: "rgba(239, 113, 105, 0.12)", borderRadius: 12,
          padding: 12, border: `1px solid #ef716955`,
          fontSize: 12, color: TEXT_SOFT,
        }}>
          {tCrew.rich(inactive.length === 1 ? "memInactiveWarningOne" : "memInactiveWarningMany", {
            count: inactive.length,
            b: (chunks) => <b>{chunks}</b>,
          })}
          {isAdmin && (
            <button
              onClick={() => appAlert(tCrew("memReminderAlert"))}
              style={{
                marginLeft: 8, background: "transparent", border: "none",
                color: ACCENT, fontWeight: 800, cursor: "pointer", fontSize: 12,
              }}
            >
              {tCrew("memReminderBtn")}
            </button>
          )}
        </div>
      )}
      <div style={{ color: MUTED, fontSize: 11, marginBottom: 2 }}>
        {tCrew("memSortHint", { count: DEMO_CREW_MEMBERS.length })}
      </div>
      {DEMO_CREW_MEMBERS.map((m, idx) => (
        <div key={m.id} style={{
          background: "rgba(70, 82, 122, 0.45)", borderRadius: 14,
          padding: "10px 12px", display: "flex", alignItems: "center", gap: 10,
          border: `1px solid ${BORDER}`,
          opacity: m.weekly_km < 5 ? 0.6 : 1,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 18,
            background: `${color}22`, border: `1px solid ${color}55`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, position: "relative",
          }}>
            {m.avatar_emoji}
            {m.online && <span style={{
              position: "absolute", bottom: -2, right: -2,
              width: 10, height: 10, borderRadius: 5,
              background: "#4ade80", border: "2px solid #1a1f2e",
            }} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <div style={{ color: "#FFF", fontSize: 13, fontWeight: 900 }}>{m.display_name}</div>
              {m.role === "admin" && <Badge color={PRIMARY}>{tCrew("memBadgeAdmin")}</Badge>}
              {m.role === "captain" && <Badge color="#FFD700">{tCrew("memBadgeCaptain")}</Badge>}
              {idx === 0 && <Badge color="#FFD700">{tCrew("memBadgeWeekChamp")}</Badge>}
              {m.weekly_km < 5 && <Badge color="#ef7169">{tCrew("memBadgeInactive")}</Badge>}
            </div>
            <div style={{ color: MUTED, fontSize: 11, marginTop: 2, display: "flex", alignItems: "center", gap: 5 }}>
              {(() => {
                const rId = rankIdByName(m.rank_name);
                const rColor = RUNNER_RANKS.find((x) => x.id === rId)?.color ?? color;
                return rId ? <RankBadge rankId={rId} color={rColor} size={16} rankArt={rankArt} /> : null;
              })()}
              <span>{m.rank_name} · @{m.username}</span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#FFF", fontSize: 13, fontWeight: 900 }}>
              {tCrew("memMemberKm", { km: m.weekly_km })}
            </div>
            <div style={{ color: MUTED, fontSize: 10 }}>{tCrew("memMemberXp", { xp: m.weekly_xp })}</div>
          </div>
          {isAdmin && (
            <button
              onClick={() => appAlert(tCrew("memActionsAlert", { name: m.display_name }))}
              style={{
                background: "transparent", border: `1px solid ${BORDER}`,
                borderRadius: 8, padding: "4px 8px", color: MUTED,
                fontSize: 12, cursor: "pointer",
              }}
              aria-label={tCrew("memMoreActionsAria")}
            >⋯</button>
          )}
        </div>
      ))}
      {isAdmin && (
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <button style={outlineBtnStyle()}>
            {tCrew("memInviteMember")}
          </button>
          <button style={outlineBtnStyle()} onClick={() => appAlert(tCrew("memRolesAlert"))}>
            {tCrew("memManageRoles")}
          </button>
        </div>
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

/* ═══════════════════════════════════════════════════════
 * RANKING TAB (1:1 alte App)
 * ═══════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════
 * Generischer Vollbild-Map-Modal-Wrapper
 * Wird benutzt für Shops/Deals/Inbox/Ranking — Tabs als Modals.
 * ═══════════════════════════════════════════════════════ */
function FullscreenMapModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} className="fixed inset-0 z-[9100] bg-black/85 backdrop-blur-md flex items-stretch justify-center sm:items-center sm:p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-3xl sm:rounded-2xl bg-[#0F1115] sm:border sm:border-white/10 shadow-2xl flex flex-col max-h-[100vh] sm:max-h-[92vh] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 sticky top-0 bg-[#0F1115] z-10">
          <div className="text-[11px] font-black tracking-widest text-[#FFD700]">{title}</div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-black/40 text-white text-xl leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════
 * RANKING TAB — moved to ./_tabs/ranking-tab.tsx (lazy-loaded)
 * Helpers (FactionTile/Row/Duel*, RankingSort*, GuardianArt, RankingTab,
 * groupRunnersByLevel, EmptyHint, PodiumRunners/Crews, RunnerRankRow,
 * CrewRankRow, GuardianLeaderboardView, TurfWar/Mmr/ArenaLeaderboardView,
 * ArenaGlobal/Classes, StatCard) all live in ranking-tab.tsx now.
 * ═══════════════════════════════════════════════════════ */
const RankingTab = dynamic(() => import("./_tabs/ranking-tab").then((m) => m.RankingTab), { ssr: false, loading: () => <TabSkeleton /> });


/* ═══ Power-Zone Info Modal ═══ */
function PowerZoneModal({ zone, onClose }: {
  zone: { id: string; name: string; kind: string; center_lat: number; center_lng: number; radius_m: number; color: string; buff_hp: number; buff_atk: number; buff_def: number; buff_spd: number };
  onClose: () => void;
}) {
  const kindLabel: Record<string, string> = {
    park: "🌳 Park-Zone", water: "💧 Wasser-Zone", city: "🏙️ Stadt-Zone", forest: "🌲 Wald-Zone", landmark: "🗿 Wahrzeichen",
  };
  const buffs: Array<[string, number, string]> = [
    ["Leben",        zone.buff_hp,  "#4ade80"],
    ["Angriff",      zone.buff_atk, "#FF6B4A"],
    ["Verteidigung", zone.buff_def, "#5ddaf0"],
    ["Tempo",        zone.buff_spd, "#FFD700"],
  ];
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 3800, background: "rgba(15,17,21,0.9)", backdropFilter: "blur(14px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400, width: "100%", background: "linear-gradient(160deg, #0F1115 0%, #151823 100%)", borderRadius: 20, padding: 24, border: `2px solid ${zone.color}aa`, color: "#FFF", boxShadow: `0 0 30px ${zone.color}55` }}>
        <div style={{ fontSize: 11, color: zone.color, fontWeight: 900, letterSpacing: 0.8, marginBottom: 4 }}>
          {kindLabel[zone.kind] ?? "POWER-ZONE"}
        </div>
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 14 }}>{zone.name}</div>
        <div style={{ fontSize: 12, color: "#a8b4cf", marginBottom: 14, lineHeight: 1.55 }}>
          Wenn du innerhalb dieser Zone (Radius <strong>{zone.radius_m} m</strong>) läufst, bekommt dein <strong style={{ color: "#22D1C3" }}>Wächter</strong> folgende passive Buffs:
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 16 }}>
          {buffs.map(([label, val, color]) => (
            <div key={label} style={{
              padding: "10px 6px", borderRadius: 10, textAlign: "center",
              background: val > 0 ? `${color}15` : "rgba(255,255,255,0.04)",
              border: `1px solid ${val > 0 ? color : "rgba(255,255,255,0.1)"}55`,
            }}>
              <div style={{ color: val > 0 ? color : "#8B8FA3", fontSize: 15, fontWeight: 900 }}>
                {val > 0 ? `+${val}` : "—"}
              </div>
              <div style={{ color: "#8B8FA3", fontSize: 9, fontWeight: 700, marginTop: 2, letterSpacing: 0.5 }}>{label}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: "#8B8FA3", marginBottom: 14, lineHeight: 1.5, fontStyle: "italic" }}>
          Power-Zones sind strategische Orte. Nutze sie für Trainings-Runden, um deinen Wächter schneller zu leveln — vor allem vor großen Arena-Kämpfen oder Area-Boss-Raids.
        </div>
        <button onClick={onClose} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, background: `${zone.color}22`, border: `1px solid ${zone.color}`, color: zone.color, fontSize: 12, fontWeight: 900, cursor: "pointer" }}>Verstanden</button>
      </div>
    </div>
  );
}

/* ═══ Area-Boss Modal (Crew-Raid) ═══ */
function BossRaidModal({ boss, distM, inRange, onClose, onAttack }: {
  boss: { id: string; name: string; emoji: string; max_hp: number; current_hp: number };
  distM: number | null;
  inRange: boolean;
  onClose: () => void;
  onAttack: () => void | Promise<void>;
}) {
  const tMD = useTranslations("MapDashboard");
  const pct = Math.round((boss.current_hp / boss.max_hp) * 100);
  const [attacking, setAttacking] = useState(false);
  const fmtDist = (m: number) => m < 1000 ? `${m} m` : `${(m/1000).toFixed(1)} km`;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 3800, background: "rgba(15,17,21,0.92)", backdropFilter: "blur(14px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460, width: "100%", background: "linear-gradient(160deg, #2a0618 0%, #0F1115 90%)", borderRadius: 20, padding: 24, border: "2px solid rgba(255,45,120,0.7)", color: "#FFF", textAlign: "center", boxShadow: "0 0 40px rgba(255,45,120,0.5)" }}>
        <div style={{ fontSize: 64, lineHeight: 1, marginBottom: 8, filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.6))" }}>{boss.emoji}</div>
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 4, letterSpacing: 0.5 }}>{boss.name}</div>
        <div style={{ fontSize: 11, color: "#FF6BA1", fontWeight: 800, marginBottom: 14, letterSpacing: 0.6 }}>AREA-BOSS · LEGENDÄRER RAID</div>
        <div style={{ height: 12, background: "rgba(0,0,0,0.6)", borderRadius: 6, overflow: "hidden", border: "1px solid rgba(255,255,255,0.2)", marginBottom: 6 }}>
          <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #FF2D78, #FFD700)", transition: "width 0.4s" }} />
        </div>
        <div style={{ fontSize: 11, color: "#a8b4cf", marginBottom: 16 }}>
          {boss.current_hp.toLocaleString()} / {boss.max_hp.toLocaleString()} Leben ({pct}%)
        </div>

        {/* So funktioniert's — 3 Kacheln in Grid */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6,
          marginBottom: 10, textAlign: "left",
        }}>
          <div style={{ padding: 8, borderRadius: 10, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,215,0,0.3)" }}>
            <div style={{ fontSize: 18, marginBottom: 3 }}>🥇</div>
            <div style={{ color: "#FFD700", fontSize: 10, fontWeight: 900, marginBottom: 2 }}>NUR DIE STÄRKSTE CREW GEWINNT</div>
            <div style={{ color: "#a8b4cf", fontSize: 10, lineHeight: 1.4 }}>Crew mit dem meisten Gesamt-Damage holt den Loot. Wächter-Level + Ausrüstung entscheiden.</div>
          </div>
          <div style={{ padding: 8, borderRadius: 10, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(168,85,247,0.3)" }}>
            <div style={{ fontSize: 18, marginBottom: 3 }}>👥</div>
            <div style={{ color: "#a855f7", fontSize: 10, fontWeight: 900, marginBottom: 2 }}>MAX 10 / CREW</div>
            <div style={{ color: "#a8b4cf", fontSize: 10, lineHeight: 1.4 }}>Maximal 10 Mitglieder pro Crew dürfen teilnehmen. GPS ≤ 500 m vom Boss.</div>
          </div>
          <div style={{ padding: 8, borderRadius: 10, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,45,120,0.3)" }}>
            <div style={{ fontSize: 18, marginBottom: 3 }}>🎁</div>
            <div style={{ color: "#FF2D78", fontSize: 10, fontWeight: 900, marginBottom: 2 }}>LOOT SKALIERT</div>
            <div style={{ color: "#a8b4cf", fontSize: 10, lineHeight: 1.4 }}>1-3 Teilnehmer = 1 Loot · 4-6 = 2 · 7-10 = 3 — Kampfleader verteilt.</div>
          </div>
        </div>

        {/* Loot-Staffel-Detail */}
        <div style={{
          display: "flex", flexDirection: "column", gap: 3,
          marginBottom: 12, textAlign: "left",
          padding: "8px 10px", borderRadius: 10,
          background: "rgba(255,215,0,0.06)",
          border: "1px solid rgba(255,215,0,0.2)",
        }}>
          <div style={{ color: "#FFD700", fontSize: 10, fontWeight: 900, letterSpacing: 0.5, marginBottom: 2 }}>LOOT-STAFFELUNG (GEWINNER-CREW)</div>
          <div style={{ fontSize: 11, color: "#DDD", display: "flex", justifyContent: "space-between" }}>
            <span>7-10 Teilnehmer</span>
            <span><b style={{ color: "#FFD700" }}>🏆 Legend</b> + <b style={{ color: "#a855f7" }}>💎 Epic</b> + <b style={{ color: "#22D1C3" }}>💠 Rare</b></span>
          </div>
          <div style={{ fontSize: 11, color: "#DDD", display: "flex", justifyContent: "space-between" }}>
            <span>4-6 Teilnehmer</span>
            <span><b style={{ color: "#FFD700" }}>🏆 Legend</b> + <b style={{ color: "#a855f7" }}>💎 Epic</b></span>
          </div>
          <div style={{ fontSize: 11, color: "#DDD", display: "flex", justifyContent: "space-between" }}>
            <span>1-3 Teilnehmer</span>
            <span><b style={{ color: "#FFD700" }}>🏆 Legend</b></span>
          </div>
        </div>
        {distM !== null && (
          <div style={{
            fontSize: 11, marginBottom: 12, padding: "8px 12px", borderRadius: 10,
            background: inRange ? "rgba(74,222,128,0.12)" : "rgba(255,45,120,0.12)",
            border: inRange ? "1px solid #4ade80" : "1px solid rgba(255,45,120,0.5)",
            color: inRange ? "#4ade80" : "#FF6BA1",
            fontWeight: 800,
          }}>
            {inRange
              ? `✓ In Reichweite (${fmtDist(distM)})`
              : `📍 Lauf hin! ${fmtDist(distM)} entfernt (max 500 m)`}
          </div>
        )}
        <button
          onClick={async () => { setAttacking(true); await onAttack(); setAttacking(false); }}
          disabled={attacking || !inRange}
          style={{
            width: "100%", padding: "14px 20px", borderRadius: 12,
            background: !inRange ? "rgba(120,120,120,0.2)" : "linear-gradient(135deg, #FF2D78, #a855f7)",
            border: !inRange ? "1px solid rgba(255,255,255,0.1)" : "none",
            color: !inRange ? "#8B8FA3" : "#FFF",
            fontSize: 15, fontWeight: 900,
            cursor: (attacking || !inRange) ? "not-allowed" : "pointer",
            marginBottom: 8, letterSpacing: 0.5,
            boxShadow: !inRange ? "none" : "0 4px 14px rgba(255,45,120,0.5)",
          }}
        >{attacking ? tMD("labelAttacking") : !inRange ? tMD("labelTooFar") : tMD("labelAttack")}</button>
        <button onClick={onClose} style={{ width: "100%", padding: "8px 12px", borderRadius: 10, background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#a8b4cf", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{tMD("labelBack")}</button>
      </div>
    </div>
  );
}


/* ═══ Sanctuary Modal ═══ */
function SanctuaryModal({ sanctuary, distM, inRange, onClose, onTrain }: {
  sanctuary: { id: string; name: string; emoji: string; xp_reward: number; trained_today?: boolean };
  distM: number | null;
  inRange: boolean;
  onClose: () => void;
  onTrain: () => void | Promise<void>;
}) {
  const tMD = useTranslations("MapDashboard");
  const [training, setTraining] = useState(false);
  const done = !!sanctuary.trained_today;
  const disabled = done || training || !inRange;
  const fmtDist = (m: number) => m < 1000 ? `${m} m` : `${(m/1000).toFixed(1)} km`;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 3800, background: "rgba(15,17,21,0.9)", backdropFilter: "blur(14px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400, width: "100%", background: "linear-gradient(160deg, #002b30 0%, #0F1115 90%)", borderRadius: 20, padding: 24, border: "2px solid rgba(34,209,195,0.6)", color: "#FFF", textAlign: "center", boxShadow: "0 0 30px rgba(34,209,195,0.4)" }}>
        <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 8 }}>{sanctuary.emoji}</div>
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 4 }}>{sanctuary.name}</div>
        <div style={{ fontSize: 11, color: "#5ddaf0", fontWeight: 800, marginBottom: 14, letterSpacing: 0.6 }}>WÄCHTER-SANCTUARY</div>
        <div style={{ fontSize: 12, color: "#a8b4cf", marginBottom: 14, lineHeight: 1.5 }}>
          Tägliches Training stärkt deinen Wächter. Komm einmal pro Tag vorbei, um <strong style={{ color: "#22D1C3" }}>+{sanctuary.xp_reward} Wächter-Erfahrung</strong> zu holen.
        </div>
        {distM !== null && (
          <div style={{
            fontSize: 11, marginBottom: 12, padding: "8px 12px", borderRadius: 10,
            background: inRange ? "rgba(74,222,128,0.12)" : "rgba(255,45,120,0.12)",
            border: inRange ? "1px solid #4ade80" : "1px solid rgba(255,45,120,0.5)",
            color: inRange ? "#4ade80" : "#FF6BA1",
            fontWeight: 800,
          }}>
            {inRange
              ? `✓ In Reichweite (${fmtDist(distM)})`
              : `📍 Du musst vor Ort sein — ${fmtDist(distM)} entfernt (max 50 m)`}
          </div>
        )}
        {distM === null && (
          <div style={{ fontSize: 11, marginBottom: 12, color: "#FF6BA1" }}>
            📍 GPS-Position nicht verfügbar
          </div>
        )}
        <button
          onClick={async () => { setTraining(true); await onTrain(); setTraining(false); }}
          disabled={disabled}
          style={{
            width: "100%", padding: "14px 20px", borderRadius: 12,
            background: done ? "rgba(74,222,128,0.2)" : !inRange ? "rgba(120,120,120,0.2)" : "linear-gradient(135deg, #22D1C3, #5ddaf0)",
            border: done ? "1px solid #4ade80" : !inRange ? "1px solid rgba(255,255,255,0.1)" : "none",
            color: done ? "#4ade80" : !inRange ? "#8B8FA3" : "#0F1115",
            fontSize: 14, fontWeight: 900, cursor: disabled ? "not-allowed" : "pointer", marginBottom: 8,
          }}
        >{done ? tMD("labelAlreadyTrainedToday") : training ? tMD("labelTraining") : !inRange ? tMD("labelTooFar") : tMD("labelTrainAction", { xp: sanctuary.xp_reward })}</button>
        <button onClick={onClose} style={{ width: "100%", padding: "8px 12px", borderRadius: 10, background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#a8b4cf", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{tMD("labelBack")}</button>
      </div>
    </div>
  );
}


function FooterLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "none", border: "none", color: "inherit", font: "inherit",
        cursor: "pointer", padding: 0, textDecoration: "none",
      }}
    >
      {children}
    </button>
  );
}

