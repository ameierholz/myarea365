"use client";

/**
 * BaseModal — Click-Modal für Runner- und Crew-Base-Pins auf der Karte.
 * Eigene Base: voller Funktionsumfang (Bauen, Skip, Truhen öffnen, Theme/Visibility ändern).
 * Fremde Base: Read-only View (Owner, Stufe, Buildings).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { DailyDealTeaser } from "@/components/daily-deal-teaser";
import { useResourceArt, ResourceIcon, useChestArt, ChestIcon, useBuildingArt, useBaseThemeArt, type ResourceArtMap } from "@/components/resource-icon";
import { TroopDetailModal } from "@/components/troop-detail-modal";
import { BaseThemeShopModal } from "@/components/base-theme-shop-modal";
import { BaseRingPickerModal } from "@/components/base-ring-picker-modal";
import { NameplatePickerModal } from "@/components/nameplate-picker-modal";
import { createClient } from "@/lib/supabase/client";

type Theme = {
  id: string; name: string; description: string;
  pin_emoji: string; pin_color: string; accent_color: string;
  modal_bg_url: string | null;
  resource_icon_wood: string; resource_icon_stone: string;
  resource_icon_gold: string; resource_icon_mana: string;
  unlock_kind: "free" | "vip" | "coins" | "event" | "crew_level";
  unlock_value: number;
};

type Building = {
  id: string; building_id: string; level: number;
  status: "idle" | "building" | "upgrading"; last_collected_at: string | null;
};
type Catalog = {
  id: string; name: string; emoji: string; description: string;
  category: string; scope: string; max_level: number;
  base_cost_wood: number; base_cost_stone: number; base_cost_gold: number; base_cost_mana: number;
  base_buildtime_minutes: number;
  effect_key: string | null; effect_per_level: number;
  required_base_level: number; sort: number;
};
type QueueItem = {
  id: string; building_id: string; action: "build" | "upgrade"; target_level: number;
  started_at: string; ends_at: string; finished: boolean;
};
type Resources = { wood: number; stone: number; gold: number; mana: number; speed_tokens: number; vip_tickets?: number; guardian_xp?: number };
type VipProgress = { vip_level: number; vip_points: number; daily_login_streak: number };
type Chest = { id: string; kind: "silver" | "gold" | "event"; source: string; obtained_at: string; opens_at: string };

type OwnBaseData = {
  ok: boolean;
  base: { id: string; plz: string; level: number; exp: number; lat: number | null; lng: number | null;
          visibility: "public" | "crew" | "private"; theme_id: string; pin_label: string | null } | null;
  buildings: Building[];
  queue: QueueItem[];
  resources: Resources;
  vip: VipProgress;
  vip_thresholds: Array<{ vip_level: number; required_points: number; daily_chest_silver: number; daily_chest_gold: number; resource_bonus_pct: number; buildtime_bonus_pct: number; extra_build_slots?: number; extra_research_slots?: number; training_speed_pct?: number; research_speed_pct?: number; march_speed_pct?: number; gather_speed_pct?: number; troop_atk_pct?: number; troop_def_pct?: number; troop_hp_pct?: number; daily_speed_tokens?: number; daily_vip_tickets?: number }>;
  vip_daily_claim?: { claimed_today: boolean; last_claim_date: string | null };
  catalog: Catalog[];
  chests: Chest[];
  themes: Theme[];
};

type ForeignBaseData = {
  ok: boolean; error?: string;
  base?: { id: string; level: number; plz: string; theme_id: string; pin_label: string | null; lat: number | null; lng: number | null; visibility?: string };
  owner?: { display_name: string | null; avatar_url: string | null };
  crew?: { id: string; name: string; color: string | null } | null;
  buildings?: Array<{ building_id: string; level: number; name: string; emoji: string }>;
};

type Props = {
  /** Wenn target.is_own → eigene Base laden. Sonst fremde Base via /api/base/[id]. */
  target: { kind: "runner" | "crew"; id: string; is_own: boolean };
  onClose: () => void;
};

export function BaseModal({ target, onClose }: Props) {
  if (target.kind === "crew") return <CrewStub onClose={onClose} />;
  if (target.is_own) return <OwnRunnerBase onClose={onClose} />;
  return <ForeignRunnerBase baseId={target.id} onClose={onClose} />;
}

// ───────────────────────── OWN RUNNER BASE ─────────────────────────────

function OwnRunnerBase({ onClose }: { onClose: () => void }) {
  const t = useTranslations("BaseModal");
  const tBld = useTranslations("Buildings");
  const tEff = useTranslations("Effects");
  const [data, setData] = useState<OwnBaseData | null>(null);
  const [tab, setTab]   = useState<"overview" | "res" | "build" | "troops" | "research" | "chest" | "vip" | "settings">("overview");
  const [vipSection, setVipSection] = useState<"status" | "shop" | "tiers">("status");
  const [themeShopOpen, setThemeShopOpen] = useState(false);
  const [ringPickerOpen, setRingPickerOpen] = useState(false);
  const [bannerPickerOpen, setBannerPickerOpen] = useState(false);
  const [showRoadmap, setShowRoadmap] = useState(false);
  const [now, setNow]   = useState(Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr]   = useState<string | null>(null);
  const resourceArt = useResourceArt();
  const chestArt = useChestArt();
  const buildingArt = useBuildingArt();
  const baseThemeArt = useBaseThemeArt();

  const reload = useCallback(async () => {
    const r = await fetch("/api/base/me", { cache: "no-store" });
    setData(await r.json() as OwnBaseData);
  }, []);

  // Klappbare Bau-Kategorien — Default: alle zu, Toggle persistiert in localStorage
  const [openCategories, setOpenCategories] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = window.localStorage.getItem("ma365.base.openCats");
      if (!raw) return new Set();
      return new Set(JSON.parse(raw) as string[]);
    } catch {
      return new Set();
    }
  });
  const toggleCategory = useCallback((cat: string) => {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      try { window.localStorage.setItem("ma365.base.openCats", JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  // Auto-Reverse-Geocode für Bestandsbasen ohne richtige PLZ (z.B. "00000")
  useEffect(() => {
    if (!data?.base) return;
    const plz = data.base.plz?.trim();
    const looksDefault = !plz || plz === "00000" || /^0+$/.test(plz);
    if (!looksDefault) return;
    if (data.base.lat == null || data.base.lng == null) return;
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/base/refresh-plz", { method: "POST" });
        if (!r.ok) return;
        const j = await r.json() as { ok?: boolean };
        if (!cancelled && j.ok) await reload();
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [data?.base, reload]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!data?.queue.length) return;
    const earliest = Math.min(...data.queue.map((q) => new Date(q.ends_at).getTime()));
    if (earliest <= now) void reload();
  }, [data, now, reload]);

  const theme = useMemo(() => data?.themes.find((t) => t.id === (data.base?.theme_id ?? "plattenbau")) ?? null, [data]);
  const accent = theme?.accent_color ?? "#22D1C3";

  async function build(buildingId: string) {
    setBusy(buildingId); setErr(null);
    try {
      const r = await fetch("/api/base/build", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ building_id: buildingId }) });
      const j = await r.json() as { ok?: boolean; error?: string;
        target_level?: number; burg_level?: number; needed?: number;
        unmet?: Array<{ name: string; required_level: number; have_level: number }> };
      if (!r.ok || j?.ok === false) {
        if (j.error === "burg_requirements_unmet" && j.unmet?.length) {
          const list = j.unmet.map((u) => `${u.name} ${u.have_level}/${u.required_level}`).join(", ");
          setErr(t("errBurgRequirements", { list }));
        } else if (j.error === "burg_level_too_low") {
          setErr(t("errBurgLevelLow", { needed: j.needed ?? 0, have: j.burg_level ?? 0 }));
        } else if (j.error === "queue_full") {
          setErr(t("errQueueFull"));
        } else if (j.error === "max_level_reached") {
          setErr(t("errMaxLevel"));
        } else if (j.error === "not_enough_resources") {
          setErr(t("errNotEnoughRes"));
        } else {
          setErr(j?.error ?? t("errGeneric"));
        }
      } else { await reload(); }
    } finally { setBusy(null); }
  }
  async function speedUp(queueId: string, tokens: number) {
    setBusy(queueId);
    try {
      await fetch("/api/base/speed-up", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ queue_id: queueId, tokens }) });
      await reload();
    } finally { setBusy(null); }
  }
  async function openChest(chestId: string) {
    setBusy(chestId); setErr(null);
    try {
      const r = await fetch("/api/base/chest/open", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chest_id: chestId }) });
      const j = await r.json();
      if (!r.ok || j?.ok === false) setErr(j?.error ?? t("errGeneric"));
      await reload();
    } finally { setBusy(null); }
  }
  async function setVisibility(v: "public" | "crew") {
    await fetch("/api/base/visibility", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visibility: v }) });
    await reload();
  }
  async function setTheme(themeId: string) {
    setErr(null);
    const r = await fetch("/api/base/theme", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ theme_id: themeId }) });
    const j = await r.json();
    if (!r.ok || j?.ok === false) setErr(j?.error ?? t("errThemeNotUnlocked")); else await reload();
  }

  if (!data || !data.base) {
    return <Backdrop onClose={onClose}><Spinner label={t("loading")} /></Backdrop>;
  }
  const { base, buildings, queue, resources, vip, chests, themes, vip_thresholds } = data;
  const vipDailyClaimed = data.vip_daily_claim?.claimed_today ?? false;
  // Wenn Server-Catalog leer ist (z.B. Migration noch nicht gepusht), zeige Fallback
  // damit User trotzdem sieht was kommt — Build-Buttons sind dann disabled.
  const catalogFromServer = data.catalog ?? [];
  const catalog = catalogFromServer.length > 0 ? catalogFromServer : FALLBACK_CATALOG;
  const isCatalogPreview = catalogFromServer.length === 0;
  const builtMap = new Map(buildings.map((b) => [b.building_id, b]));
  const queueMap = new Map(queue.map((q) => [q.building_id, q]));

  // Resource-Icon-Fallback (Theme-Override > Default-Emoji). Artwork-Image wird
  // separat via <ResourceIcon> gerendert wenn ein Bild im cosmetic_artwork-Slot liegt.
  const RES = {
    wood:  { icon: theme?.resource_icon_wood  ?? "⚙️", color: "#FF6B4A", label: t("resWoodLabel"),  hint: t("resWoodHint"),  rate: 100 },
    stone: { icon: theme?.resource_icon_stone ?? "🔩", color: "#8B8FA3", label: t("resStoneLabel"), hint: t("resStoneHint"), rate: 100 },
    gold:  { icon: theme?.resource_icon_gold  ?? "💸", color: "#FFD700", label: t("resGoldLabel"),  hint: t("resGoldHint"),  rate: 100 },
    mana:  { icon: theme?.resource_icon_mana  ?? "📡", color: "#22D1C3", label: t("resManaLabel"),  hint: t("resManaHint"),  rate: 100 },
  } as const;

  // Passive Produktion pro Stunde — summiert effect_per_level × level für die
  // 4 passiven Produktions-Buildings (saegewerk/steinbruch/goldmine/mana_quelle).
  const passivePerHour: Record<keyof typeof RES, number> = { wood: 0, stone: 0, gold: 0, mana: 0 };
  const PASSIVE_MAP: Record<string, keyof typeof RES> = {
    wood_per_hour: "wood", stone_per_hour: "stone", gold_per_hour: "gold", mana_per_hour: "mana",
  };
  for (const b of buildings) {
    const c = catalog.find((x) => x.id === b.building_id);
    if (!c?.effect_key) continue;
    const target = PASSIVE_MAP[c.effect_key];
    if (target) passivePerHour[target] += c.effect_per_level * b.level;
  }

  // Burg-Level = Maß für Base-Stufe (XP-System ist deprecated). 0 wenn Burg noch nicht gebaut.
  const burgLevel = buildings.find((b) => b.building_id === "burg")?.level ?? 0;
  // Progress-Bar-Approximation: Anteil Burg-Level an Maximum 25.
  const xpPct = Math.min(100, (burgLevel / 25) * 100);

  // Helper: building name from translations (falls back to catalog name if no key exists)
  const bldName = (id: string, fallback: string): string => {
    return tBld.has(`${id}.name`) ? tBld(`${id}.name`) : fallback;
  };
  const effLabel = (key: string): string => {
    return tEff.has(key) ? tEff(key) : key;
  };

  // Effekte aller gebauten Buildings als Zusammenfassung
  const activeEffects = buildings
    .map((b) => {
      const c = catalog.find((x) => x.id === b.building_id);
      if (!c?.effect_key) return null;
      const value = c.effect_per_level * b.level;
      return { name: bldName(c.id, c.name), emoji: c.emoji, key: c.effect_key, value, level: b.level };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  // VIP-Progression
  const currentTier = vip_thresholds.find((t) => t.vip_level === vip.vip_level);
  const nextTier    = vip_thresholds.find((t) => t.vip_level === vip.vip_level + 1);
  const vipProgress = nextTier
    ? Math.min(100, ((vip.vip_points - (currentTier?.required_points ?? 0)) / (nextTier.required_points - (currentTier?.required_points ?? 0))) * 100)
    : 100;

  return (
    <Backdrop onClose={onClose}>
      <div className="bg-[#0F1115] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col flex-1 min-h-0">

        {/* ─── Hero-Header mit Theme-Banner + XP ─── */}
        <div style={{ background: `linear-gradient(135deg, ${accent}33 0%, ${accent}11 50%, transparent 100%)` }}>
          <div className="px-5 pt-5 pb-5 flex items-start gap-4">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-5xl shrink-0 overflow-hidden"
                 style={{ background: `radial-gradient(circle at 50% 30%, ${accent}66, ${accent}22 50%, rgba(15,17,21,0.6))`, border: `2px solid ${accent}99`, boxShadow: `0 0 20px ${accent}55` }}>
              {(() => {
                const tid = theme?.id ?? base.theme_id ?? "plattenbau";
                const a = baseThemeArt[`${tid}_runner_pin`] ?? baseThemeArt[`${tid}_runner_banner`] ?? baseThemeArt[tid];
                const f = "url(#ma365-chroma-black) drop-shadow(0 2px 6px rgba(0,0,0,0.5))";
                if (a?.image_url) return <img src={a.image_url} alt={theme?.name ?? "Base"} style={{ width: 72, height: 72, objectFit: "contain", filter: f }} />;
                if (a?.video_url) return <video src={a.video_url} autoPlay loop muted playsInline style={{ width: 72, height: 72, objectFit: "contain", filter: f }} />;
                return <span>{theme?.pin_emoji ?? "🏰"}</span>;
              })()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-black tracking-widest" style={{ color: accent }}>
                {t("burgLevelHeader", { label: base.pin_label ?? t("pinLabelDefault"), plz: base.plz })}
              </div>
              <div className="text-xl font-black text-white truncate mt-0.5">
                {t("burgTitle", { theme: theme?.name ?? t("themeFallback"), level: burgLevel })}
              </div>
              <div className="mt-2">
                <div className="flex justify-between text-[9px] text-[#a8b4cf] font-black mb-1">
                  <span>{t("burgProgressLabel", { level: burgLevel })}</span>
                  <span>{burgLevel < 25 ? t("burgNext", { level: burgLevel + 1 }) : t("burgMax")}</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${xpPct}%`, background: `linear-gradient(90deg, ${accent}, ${accent}cc)`, boxShadow: `0 0 8px ${accent}` }} />
                </div>
              </div>
            </div>
            {/* Action-Cluster: Settings + Close, rechts oben */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={() => setShowRoadmap(true)}
                title={t("roadmapTitle")}
                className="w-8 h-8 rounded-lg bg-black/40 hover:bg-black/60 text-white/80 hover:text-white text-base font-black transition-colors flex items-center justify-center">
                📜
              </button>
              <button onClick={() => setTab("settings")}
                title={t("settingsTitle")}
                className="w-8 h-8 rounded-lg bg-black/40 hover:bg-black/60 text-white/80 hover:text-white text-base font-black transition-colors flex items-center justify-center">
                ⚙️
              </button>
              <button onClick={onClose}
                title={t("close")}
                className="w-8 h-8 rounded-lg bg-black/40 hover:bg-black/60 text-white/80 hover:text-white text-lg font-black transition-colors flex items-center justify-center">
                ×
              </button>
            </div>
          </div>

          {/* Resource-HUD direkt unter Header — nur außerhalb des RES-Tabs sichtbar
              (auf RES-Tab zeigen die Cards darunter ohnehin alles im Detail) */}
          {tab !== "res" && tab !== "overview" && (
            <div className="px-3 pb-3" style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 6 }}>
              {(Object.keys(RES) as Array<keyof typeof RES>).map((k) => (
                <div key={k} className="rounded-lg bg-black/30 backdrop-blur px-2 py-1.5 text-center" style={{ minWidth: 0 }}>
                  <div className="leading-none flex items-center justify-center" style={{ height: 28 }}>
                    <ResourceIcon kind={k} size={28} fallback={RES[k].icon} art={resourceArt} />
                  </div>
                  <div className="text-[10px] font-black mt-0.5" style={{ color: RES[k].color }}>{compactNum(resources[k])}</div>
                </div>
              ))}
              <div className="rounded-lg bg-[#FFD700]/15 border border-[#FFD700]/40 px-2 py-1.5 text-center" style={{ minWidth: 0 }}>
                <div className="leading-none flex items-center justify-center" style={{ height: 28 }}>
                  <ResourceIcon kind="speed_token" size={28} fallback="⚡" art={resourceArt} />
                </div>
                <div className="text-[10px] font-black mt-0.5 text-[#FFD700]">{resources.speed_tokens}</div>
              </div>
            </div>
          )}
          {tab !== "res" && tab !== "overview" && ((resources.vip_tickets ?? 0) > 0 || (resources.guardian_xp ?? 0) > 0) && (
            <div className="px-3 pb-3 flex gap-2">
              {(resources.vip_tickets ?? 0) > 0 && (
                <div className="flex-1 rounded-lg bg-[#a855f7]/15 border border-[#a855f7]/40 px-2 py-1.5 text-center">
                  <div className="text-[9px] text-[#a8b4cf]">{t("vipTickets")}</div>
                  <div className="text-[11px] font-black text-[#a855f7]">{resources.vip_tickets}</div>
                </div>
              )}
              {(resources.guardian_xp ?? 0) > 0 && (
                <div className="flex-1 rounded-lg bg-[#22D1C3]/15 border border-[#22D1C3]/40 px-2 py-1.5 text-center">
                  <div className="text-[9px] text-[#a8b4cf]">{t("guardianXp")}</div>
                  <div className="text-[11px] font-black text-[#22D1C3]">{compactNum(resources.guardian_xp ?? 0)}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tabs (Settings ist als ⚙️ im Header) — kompakte Labels, alle 7 immer sichtbar */}
        <div className="flex border-y border-white/10 text-[11px] font-black tracking-wider bg-[#0F1115]">
          {(["overview","res","build","troops","research","chest","vip"] as const).map((tk) => {
            const titles: Record<string,string> = {overview:t("tabOverview"), res:t("tabRes"), build:t("tabBuild"), troops:t("tabTroops"), research:t("tabResearch"), chest:t("tabChest"), vip:t("tabVip")};
            const labels: Record<string,string> = {overview:t("tabBtnOverview"), res:t("tabBtnRes"), build:t("tabBtnBuild"), troops:t("tabBtnTroops"), research:t("tabBtnResearch"), chest:t("tabBtnChest"), vip:t("tabBtnVip")};
            return (
            <button key={tk} onClick={() => setTab(tk)}
              title={titles[tk]}
              className={`flex-1 min-w-0 py-2.5 px-1 whitespace-nowrap transition-colors ${tab === tk ? "text-white" : "text-[#a8b4cf] hover:text-white"}`}
              style={tab === tk ? { borderBottom: `2px solid ${accent}`, marginBottom: "-1px", background: `${accent}11` } : undefined}
            >
              {labels[tk]}
              {tk === "build" && queue.length > 0 && <span className="ml-1 px-1 rounded text-[9px] bg-[#FF6B4A] text-white">{queue.length}</span>}
              {tk === "chest" && chests.length > 0 && <span className="ml-1 px-1 rounded text-[9px] bg-[#FFD700] text-[#0F1115]">{chests.length}</span>}
            </button>
            );
          })}
        </div>

        {err && <div className="px-4 py-2 bg-[#FF2D78]/15 text-[#FF2D78] text-[11px] font-black">⚠ {err}</div>}

        <div className="p-4 overflow-y-auto flex-1 ma365-no-scrollbar" style={{ scrollbarWidth: "none" }}>
          <style>{`.ma365-no-scrollbar::-webkit-scrollbar{display:none}`}</style>
          <div className="mb-4">
            <DailyDealTeaser />
          </div>
          {/* ÜBERSICHT — alles auf einen Blick */}
          {tab === "overview" && (() => {
            const totalBuildings = catalog.length;
            const builtCount = buildings.length;
            const maxedCount = buildings.filter((b) => {
              const c = catalog.find((x) => x.id === b.building_id);
              return c && b.level >= c.max_level;
            }).length;
            const nextQueueEnd = queue.length > 0
              ? Math.min(...queue.map((q) => new Date(q.ends_at).getTime()))
              : null;
            const nextQueueMs = nextQueueEnd ? nextQueueEnd - now : null;
            const nextChestReady = chests.find((c) => new Date(c.opens_at).getTime() <= now);
            const nextChestPending = chests
              .filter((c) => new Date(c.opens_at).getTime() > now)
              .sort((a, b) => new Date(a.opens_at).getTime() - new Date(b.opens_at).getTime())[0];
            const topEffects = activeEffects
              .map((e) => ({ ...e, isAbs: ABSOLUTE_EFFECTS.has(e.key) }))
              .sort((a, b) => (b.isAbs ? b.value : b.value * 100) - (a.isAbs ? a.value : a.value * 100))
              .slice(0, 3);

            return (
              <div className="space-y-3">
                {/* Quick-Stats Grid */}
                <div className="grid grid-cols-2 gap-2">
                  <StatCard
                    icon="🏰" label={t("statBurgLabel")} value={`${burgLevel}/25`}
                    sub={burgLevel < 25 ? t("statBurgSubBuild") : t("statBurgSubMax")}
                    accent={accent} progress={xpPct}
                  />
                  <StatCard
                    icon="🏗️" label={t("statBuildingsLabel")} value={`${builtCount}/${totalBuildings}`}
                    sub={maxedCount > 0 ? t("statBuildingsSubMaxed", { n: maxedCount }) : t("statBuildingsSubMore")}
                    accent="#4ade80" progress={(builtCount / totalBuildings) * 100}
                  />
                  <StatCard
                    icon="⭐" label={t("statVipLabel")} value={String(vip.vip_level)}
                    sub={t("statVipSubStreak", { n: vip.daily_login_streak })}
                    accent="#FFD700" progress={vipProgress}
                  />
                  <StatCard
                    icon={<ResourceIcon kind="speed_token" size={40} fallback="⚡" art={resourceArt} />}
                    label={t("statSpeedLabel")} value={resources.speed_tokens.toLocaleString()}
                    sub={t("statSpeedSub")}
                    subInline
                    accent="#22D1C3"
                  />
                </div>

                {/* Resourcen kompakt */}
                <div>
                  <div className="text-[10px] font-black tracking-widest text-[#a8b4cf] mb-2">{t("sectionResources")}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 }}>
                    {(Object.keys(RES) as Array<keyof typeof RES>).map((k) => (
                      <div key={k} className="rounded-lg bg-[#1A1D23] border border-white/10 p-2 text-center">
                        <div className="leading-none flex items-center justify-center" style={{ height: 26 }}>
                          <ResourceIcon kind={k} size={26} fallback={RES[k].icon} art={resourceArt} />
                        </div>
                        <div className="text-sm font-black mt-1" style={{ color: RES[k].color }}>{compactNum(resources[k])}</div>
                        <div className="text-[8px] text-[#6c7590] mt-0.5">{RES[k].label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Aktivitäten — Bau + Truhen */}
                {(queue.length > 0 || chests.length > 0) && (
                  <div>
                    <div className="text-[10px] font-black tracking-widest text-[#a8b4cf] mb-2">{t("sectionActivities")}</div>
                    <div className="space-y-2">
                      {nextQueueMs !== null && nextQueueMs > 0 && (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-[#FF6B4A]/10 border border-[#FF6B4A]/30">
                          <span className="text-2xl">🔨</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-black text-white">{t("buildingsInBuild", { n: queue.length })}</div>
                            <div className="text-[10px] text-[#a8b4cf]">
                              {t("nextDoneIn", { time: `${Math.floor(nextQueueMs / 60000)}:${String(Math.floor((nextQueueMs / 1000) % 60)).padStart(2, "0")}` })}
                            </div>
                          </div>
                          <button onClick={() => setTab("build")} className="text-[10px] font-black px-2 py-1 rounded bg-[#FF6B4A]/20 border border-[#FF6B4A]/40 text-[#FF6B4A]">{t("toBuildBtn")}</button>
                        </div>
                      )}
                      {nextChestReady && (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-[#FFD700]/10 border border-[#FFD700]/30">
                          <ChestIcon kind={nextChestReady.kind} size={28} fallback="🗝️" art={chestArt} />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-black text-white">{t("chestsReady", { n: chests.filter((c) => new Date(c.opens_at).getTime() <= now).length })}</div>
                            <div className="text-[10px] text-[#a8b4cf]">{t("tapToOpen")}</div>
                          </div>
                          <button onClick={() => setTab("chest")} className="text-[10px] font-black px-2 py-1 rounded bg-[#FFD700]/20 border border-[#FFD700]/40 text-[#FFD700]">{t("toOpenBtn")}</button>
                        </div>
                      )}
                      {!nextChestReady && nextChestPending && (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-[#1A1D23] border border-white/10">
                          <div className="relative">
                            <ChestIcon kind={nextChestPending.kind} size={28} fallback="📦" art={chestArt} />
                            <span className="absolute -bottom-1 -right-1 text-[10px]">🔒</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-black text-white">{t("chestsWaiting", { n: chests.length })}</div>
                            <div className="text-[10px] text-[#a8b4cf]">
                              {(() => {
                                const ms = new Date(nextChestPending.opens_at).getTime() - now;
                                const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000);
                                return t("nextChestIn", { h, m });
                              })()}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Top-Effekte */}
                {topEffects.length > 0 && (
                  <div>
                    <div className="text-[10px] font-black tracking-widest text-[#a8b4cf] mb-2">{t("sectionTopEffects")}</div>
                    <div className="space-y-1">
                      {topEffects.map((e) => {
                        const effectLabel = effLabel(e.key);
                        const valueStr = e.isAbs
                          ? `+${e.value.toLocaleString(undefined, { maximumFractionDigits: 1 })}`
                          : `+${Math.round(e.value * 100)}%`;
                        return (
                          <div key={e.key} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1A1D23] border border-white/5 text-[11px]">
                            <span className="text-base">{e.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <div className="font-black text-white truncate">{e.name} <span className="text-[9px] text-[#FFD700]">{t("effectLevelTag", { level: e.level })}</span></div>
                              <div className="text-[9px] text-[#a8b4cf] truncate">{effectLabel}</div>
                            </div>
                            <span className="font-black whitespace-nowrap" style={{ color: accent }}>{valueStr}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Empty-State Hint wenn nichts läuft */}
                {builtCount === 0 && queue.length === 0 && (
                  <div className="rounded-xl border border-[#22D1C3]/40 bg-[#22D1C3]/5 p-4 text-center">
                    <div className="text-3xl mb-2">🚶</div>
                    <div className="text-sm font-black text-white mb-1">{t("emptyTitle")}</div>
                    <div className="text-[10px] text-[#a8b4cf]">{t("emptyHint")}</div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* RESSOURCEN */}
          {tab === "res" && (
            <div className="space-y-3">
              <IntroBox accent={accent} title={t("introResTitle")}>
                {t("introResBody1")}
                <b className="text-white">{t("introResWoodBold")}</b>,
                <b className="text-white">{t("introResStoneBold")}</b>,
                <b className="text-white">{t("introResGoldBold")}</b>,
                <b className="text-white">{t("introResManaBold")}</b>.
                {t("introResBody2")}
              </IntroBox>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {(Object.keys(RES) as Array<keyof typeof RES>).map((k) => (
                  <div key={k} className="rounded-xl bg-[#1A1D23] border border-white/5 p-3">
                    <div className="flex items-center gap-3">
                      <ResourceIcon kind={k} size={42} fallback={RES[k].icon} art={resourceArt} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-[#a8b4cf] font-black uppercase tracking-wider">{RES[k].label}</div>
                        <div className="text-xl font-black" style={{ color: RES[k].color }}>{resources[k].toLocaleString("de-DE")}</div>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-white/5 space-y-1">
                      <div className="text-[9px] text-[#a8b4cf]">
                        <span className="text-[#6c7590]">{t("resDropLabel")}</span> <span className="font-black text-white">{t("resPerKm", { n: RES[k].rate })}</span> · {RES[k].hint}
                      </div>
                      {passivePerHour[k] > 0 && (
                        <div className="text-[9px]" style={{ color: RES[k].color }}>
                          <span className="text-[#6c7590]">{t("resPassive")}</span> <span className="font-black">{t("resPerHour", { n: Math.round(passivePerHour[k]) })}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-xl bg-[#FFD700]/8 border border-[#FFD700]/30 p-3 flex items-center gap-3">
                <ResourceIcon kind="speed_token" size={72} fallback="⚡" art={resourceArt} />
                <div className="flex-1">
                  <div className="text-[10px] font-black tracking-wider text-[#FFD700]">{t("speedTokensHeader")}</div>
                  <div className="text-lg font-black text-[#FFD700]">{resources.speed_tokens}</div>
                  <div className="text-[9px] text-[#a8b4cf] mt-1">{t("statSpeedSub")}</div>
                </div>
              </div>
              {/* RESOURCEN VERDIENEN — alle Wege ohne (oder mit weniger) Laufen */}
              <EarnResourcesSection accent={accent} reload={reload} />

              {activeEffects.length > 0 && (
                <CollapsibleSection
                  storageKey="ma365.base.activeEffects"
                  title={t("activeEffectsTitle", { n: activeEffects.length })}
                  hint={t("activeEffectsHint")}
                  accent={accent}
                >
                  <div className="space-y-1">
                    {activeEffects.map((e) => {
                      const effectLabel = effLabel(e.key);
                      const isAbsolute = ABSOLUTE_EFFECTS.has(e.key);
                      const valueStr = isAbsolute
                        ? `+${e.value.toLocaleString(undefined, { maximumFractionDigits: 1 })}`
                        : `+${Math.round(e.value * 100)}%`;
                      return (
                        <div key={e.key} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1A1D23] border border-white/5 text-[11px]">
                          <span>{e.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-black text-white truncate">
                              {e.name} <span className="text-[9px] text-[#FFD700]">{t("effectLevelTag", { level: e.level })}</span>
                            </div>
                            <div className="text-[9px] text-[#a8b4cf] truncate">{effectLabel}</div>
                          </div>
                          <span className="font-black whitespace-nowrap" style={{ color: accent }}>{valueStr}</span>
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleSection>
              )}
            </div>
          )}

          {/* BAU */}
          {tab === "build" && (
            <div className="space-y-3">
              <IntroBox accent={accent} title={t("introBuildTitle")}>
                {t("introBuildBody1")}<b className="text-white">{t("introBuildPassive")}</b>{t("introBuildBody2")}<b className="text-white">{t("introBuildSpeedTokens")}</b>{t("introBuildBody3")}
              </IntroBox>
              {isCatalogPreview && (
                <div className="rounded-xl border border-[#FFD700]/40 bg-[#FFD700]/5 px-3 py-2 text-[11px] text-[#FFD700] font-black">
                  {t("previewModeNote")}
                </div>
              )}
              {queue.length > 0 && (
                <div className="rounded-xl border border-[#FF6B4A]/30 bg-[#FF6B4A]/5 p-2 space-y-2">
                  {queue.map((q) => {
                    const cat = catalog.find((c) => c.id === q.building_id);
                    const ms = new Date(q.ends_at).getTime() - now;
                    const sec = Math.max(0, Math.floor(ms / 1000));
                    const min = Math.floor(sec / 60); const restSec = sec % 60;
                    const ready = ms <= 0;
                    return (
                      <div key={q.id} className="flex items-center gap-2">
                        <BuildingThumb id={q.building_id} fallback={cat?.emoji ?? "🏗️"} art={buildingArt} size={28} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-black">{t("buildToLevel", { target: q.target_level })} {cat ? bldName(cat.id, cat.name) : q.building_id}</div>
                          <div className="text-[10px] text-[#a8b4cf]">{ready ? <span className="text-[#4ade80] font-black">{t("buildReady")}</span> : t("buildRemain", { min, sec: String(restSec).padStart(2,"0") })}</div>
                        </div>
                        {!ready && resources.speed_tokens > 0 && (
                          <button onClick={() => speedUp(q.id, Math.min(resources.speed_tokens, Math.ceil(sec/60/5)))} disabled={busy===q.id}
                            className="text-[10px] font-black px-2 py-1 rounded-lg bg-[#22D1C3]/15 border border-[#22D1C3]/40 text-[#22D1C3]">{t("buildSkip")}</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {(() => {
                // Gruppieren nach category, in fester Reihenfolge
                const order = ["production","storage","combat","utility","cosmetic"];
                const grouped = order
                  .map((c) => ({ category: c, items: catalog.filter((x) => x.category === c) }))
                  .filter((g) => g.items.length > 0);
                return grouped.map((g) => {
                  const catLabelMap: Record<string,string> = {
                    production: t("categoryProduction"), storage: t("categoryStorage"), combat: t("categoryCombat"),
                    utility: t("categoryUtility"), cosmetic: t("categoryCosmetic"),
                  };
                  const meta = { label: catLabelMap[g.category] ?? g.category.toUpperCase(), emoji: CATEGORY_META[g.category]?.emoji ?? "🏗️" };
                  const builtInCat = g.items.filter((c) => builtMap.has(c.id)).length;
                  const isOpen = openCategories.has(g.category);
                  return (
                    <div key={g.category}>
                      <button
                        onClick={() => toggleCategory(g.category)}
                        className="w-full flex items-center justify-between text-[10px] font-black tracking-widest text-[#a8b4cf] mb-2 mt-1 px-1 py-1 rounded hover:bg-white/5"
                      >
                        <span>{meta.emoji} {meta.label} <span className="text-[#6c7590] font-normal">({builtInCat}/{g.items.length})</span></span>
                        <span className="text-[#a8b4cf]">{isOpen ? "▼" : "▶"}</span>
                      </button>
                      {isOpen && (
                      <div className="gap-2" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
                        {g.items.map((cat) => {
                          const built = builtMap.get(cat.id);
                          const inQueue = queueMap.get(cat.id);
                          const lvl = built?.level ?? 0;
                          const isMax = lvl >= cat.max_level;
                          const targetLvl = lvl + 1;
                          const mult = lvl === 0 ? 1 : Math.pow(1.6, lvl);
                          const cost = {
                            wood: Math.round(cat.base_cost_wood * mult), stone: Math.round(cat.base_cost_stone * mult),
                            gold: Math.round(cat.base_cost_gold * mult), mana: Math.round(cat.base_cost_mana * mult),
                          };
                          const canPay = (["wood","stone","gold","mana"] as const).every((k) => resources[k] >= cost[k]);
                          const lvlLocked = base.level < cat.required_base_level;
                          // CoD-Style: Kein Building > Burg-Level (außer Burg selbst).
                          const burgCapped = cat.id !== "burg" && !isMax && targetLvl > Math.max(burgLevel, 1);
                          const effectAtNext = cat.effect_per_level * targetLvl;
                          const buildTime = cat.base_buildtime_minutes * (lvl === 0 ? 1 : Math.ceil(mult));
                          return (
                            <div key={cat.id} className="rounded-lg bg-[#1A1D23] border border-white/10 p-2 flex flex-col gap-1.5" style={{ minHeight: 0 }}>
                              {/* Header-Zeile: Icon + Name + Level kompakt */}
                              <div className="flex items-center gap-2">
                                <BuildingThumb id={cat.id} fallback={cat.emoji} art={buildingArt} size={28} />
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-black text-white truncate">{bldName(cat.id, cat.name)}</div>
                                  <div className="text-[9px] text-[#a8b4cf]">{t("buildLevel", { lvl, max: cat.max_level })} {cat.effect_key && !isMax && (() => {
                                    const isAbs = ABSOLUTE_EFFECTS.has(cat.effect_key);
                                    const v = isAbs
                                      ? `+${effectAtNext.toLocaleString(undefined, { maximumFractionDigits: 1 })}`
                                      : `+${Math.round(effectAtNext * 100)}%`;
                                    return <span style={{ color: accent }} title={`+${isAbs ? cat.effect_per_level : Math.round(cat.effect_per_level * 100) + "%"}`}>{t("buildEffectAtLevel", { value: v, level: targetLvl })}</span>;
                                  })()}</div>
                                </div>
                              </div>

                              {/* Beschreibung 1 Zeile */}
                              <div className="text-[10px] text-[#a8b4cf] leading-snug line-clamp-1">{tBld.has(`${cat.id}.description`) ? tBld(`${cat.id}.description`) : cat.description}</div>

                              {/* Zeile 1: Kosten-Pills */}
                              {!isMax && (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                  {(["wood","stone","gold","mana"] as const).filter((k) => cost[k] > 0).map((k) => (
                                    <span key={k}
                                      className="text-[10px] font-black px-1.5 py-0.5 rounded inline-flex items-center gap-0.5"
                                      style={{
                                        background: resources[k] >= cost[k] ? "rgba(255,255,255,0.06)" : "rgba(255,45,120,0.12)",
                                        color: resources[k] >= cost[k] ? "#fff" : "#FF2D78",
                                      }}>
                                      <ResourceIcon kind={k} size={12} fallback={RES[k].icon} art={resourceArt} />{compactNum(cost[k])}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {/* Zeile 2: Bauzeit eigene Pill */}
                              {!isMax && (
                                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-white/5 text-[#a8b4cf] self-start">
                                  {t("buildTime", { n: buildTime })}
                                </span>
                              )}

                              {/* CTA */}
                              {isMax ? (
                                <div className="text-[10px] text-[#FFD700] font-black text-center py-1 rounded bg-[#FFD700]/10">{t("buildCtaMax")}</div>
                              ) : inQueue ? (
                                <div className="text-[10px] text-[#FF6B4A] font-black text-center py-1 rounded bg-[#FF6B4A]/10">{t("buildCtaInBuild")}</div>
                              ) : lvlLocked ? (
                                <div className="text-[10px] text-[#6c7590] text-center py-1 rounded bg-white/5">{t("buildCtaLocked", { level: cat.required_base_level })}</div>
                              ) : burgCapped ? (
                                <div className="text-[10px] text-[#FFD700] text-center py-1 rounded bg-[#FFD700]/10" title={t("buildCtaBurgCappedTooltip", { needed: targetLvl, have: burgLevel })}>
                                  🏰 {t("buildCtaBurgCapped", { needed: targetLvl })}
                                </div>
                              ) : (
                                <button onClick={() => build(cat.id)} disabled={!canPay || busy === cat.id || isCatalogPreview}
                                  className="text-[11px] font-black py-1.5 rounded-lg disabled:opacity-40"
                                  style={{ background: `${accent}26`, border: `1px solid ${accent}66`, color: accent }}>
                                  {isCatalogPreview ? t("buildCtaPreview") : lvl === 0 ? t("buildCtaBuild") : t("buildCtaUpgrade", { level: targetLvl })}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          )}

          {/* TRUPPEN */}
          {tab === "troops" && <TroopsTab accent={accent} reload={reload} />}

          {/* FORSCHUNG */}
          {tab === "research" && <ResearchTab accent={accent} reload={reload} />}

          {/* TRUHEN */}
          {tab === "chest" && (() => {
            const KINDS: Array<{ k: Chest["kind"]; emoji: string; label: string; tint: string }> = [
              { k: "silver", emoji: "🥈", label: t("chestKindSilver"), tint: "#d8d8d8" },
              { k: "gold",   emoji: "🥇", label: t("chestKindGold"),   tint: "#FFD700" },
              { k: "event",  emoji: "🎉", label: t("chestKindEvent"),  tint: "#FF2D78" },
            ];
            const byKind = (k: Chest["kind"]) => chests.filter((c) => c.kind === k);
            const nextReady = (k: Chest["kind"]) => byKind(k).find((c) => new Date(c.opens_at).getTime() <= now);
            const nextChest = (k: Chest["kind"]) => byKind(k).slice().sort((a, b) => new Date(a.opens_at).getTime() - new Date(b.opens_at).getTime())[0];

            return (
              <div className="space-y-3">
                <IntroBox accent={accent} title={t("introChestTitle")}>
                  {t("introChestBody1")}<b className="text-white">{t("introChestArena")}</b>, <b className="text-white">{t("introChestRaids")}</b>, <b className="text-white">{t("introChestVip")}</b>{t("introChestBody2")}
                  <span className="block mt-1">{t("introChestSilver")}</span>
                  <span className="block">{t("introChestGold")}</span>
                  <span className="block mt-1 text-[#6c7590]">{t("introChestPity")}</span>
                </IntroBox>

                {/* Kategorie-Übersicht: immer sichtbar, mit Counter + Öffne-Button */}
                <div className="grid grid-cols-3 gap-2">
                  {KINDS.map(({ k, emoji, label, tint }) => {
                    const total = byKind(k).length;
                    const ready = byKind(k).filter((c) => new Date(c.opens_at).getTime() <= now).length;
                    const nextR = nextReady(k);
                    const upcoming = nextChest(k);
                    const ms = upcoming ? new Date(upcoming.opens_at).getTime() - now : 0;
                    const min = Math.max(0, Math.floor(ms / 60000));
                    const hr = Math.floor(min / 60); const restMin = min % 60;
                    return (
                      <div key={k} className="rounded-xl p-3 flex flex-col items-center gap-2"
                        style={{ background: `linear-gradient(180deg, ${tint}22, rgba(15,17,21,0.6))`, border: `1px solid ${tint}55` }}>
                        <ChestIcon kind={k} size={88} fallback={emoji} art={chestArt} />
                        <div className="text-[9px] font-black tracking-wider" style={{ color: tint }}>{label.toUpperCase()}</div>
                        <div className="text-xl font-black text-white leading-none">{total}</div>
                        {ready > 0 && (
                          <div className="text-[9px] font-black text-[#4ade80]">{t("chestReady", { n: ready })}</div>
                        )}
                        {nextR ? (
                          <button
                            onClick={() => openChest(nextR.id)}
                            disabled={busy === nextR.id}
                            className="w-full text-[10px] font-black px-2 py-1.5 rounded-lg disabled:opacity-40"
                            style={{ background: tint, color: "#0F1115" }}
                          >
                            {busy === nextR.id ? "…" : t("chestOpenBtn")}
                          </button>
                        ) : upcoming ? (
                          <div className="w-full text-[9px] font-black text-center py-1 rounded-lg bg-white/5 text-[#a8b4cf]">
                            {hr > 0 ? t("chestRemainHr", { h: hr, m: restMin }) : t("chestRemainMin", { m: restMin })}
                          </div>
                        ) : (
                          <div className="w-full text-[9px] text-center py-1 text-[#6c7590]">{t("chestEmpty")}</div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Detail-Liste aller Truhen (wenn vorhanden) */}
                {chests.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-black tracking-widest text-[#a8b4cf]">{t("yourChests")}</div>
                    {chests.map((c) => {
                      const ms = new Date(c.opens_at).getTime() - now;
                      const ready = ms <= 0;
                      const min = Math.max(0, Math.floor(ms / 60000));
                      const hr  = Math.floor(min / 60); const restMin = min % 60;
                      const kindLabel = c.kind === "gold" ? t("chestKindGold") : c.kind === "silver" ? t("chestKindSilver") : t("chestKindEvent");
                      return (
                        <div key={c.id} className="flex items-center gap-2 p-2 rounded-xl bg-[#1A1D23] border border-white/10">
                          <ChestIcon kind={c.kind} size={36} fallback={c.kind === "gold" ? "🥇" : c.kind === "silver" ? "🥈" : "🎉"} art={chestArt} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-black">{t("chestKindSuffix", { kind: kindLabel })}</div>
                            <div className="text-[10px] text-[#a8b4cf]">{ready ? t("chestReadyToOpen") : t("chestOpensIn", { h: hr, m: restMin })}</div>
                          </div>
                          <button onClick={() => openChest(c.id)} disabled={!ready || busy === c.id}
                            className="text-[10px] font-black px-3 py-1.5 rounded-lg disabled:opacity-40"
                            style={{ background: `${accent}26`, border: `1px solid ${accent}66`, color: accent }}>
                            {ready ? t("chestOpenBtn") : "🔒"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {chests.length === 0 && (
                  <div className="text-center text-[#6c7590] text-xs py-2">
                    {t("chestEmptyAll")}
                  </div>
                )}
              </div>
            );
          })()}

          {/* VIP */}
          {tab === "vip" && (
            <div className="space-y-3">
              {/* Sub-Tab-Leiste */}
              <div className="flex border border-[#FFD700]/30 rounded-lg overflow-hidden text-[12px] font-black">
                {(["status","shop","tiers"] as const).map((s) => {
                  const labels: Record<string,string> = { status: t("vipSubtabStatus"), shop: t("vipSubtabShop"), tiers: t("vipSubtabTiers") };
                  return (
                  <button key={s} onClick={() => setVipSection(s)}
                    className={`flex-1 py-2 transition-colors ${vipSection === s ? "bg-[#FFD700]/20 text-[#FFD700]" : "bg-transparent text-[#a8b4cf] hover:text-white"}`}>
                    {labels[s]}
                  </button>
                  );
                })}
              </div>

              {vipSection === "status" && <>
              <IntroBox accent="#FFD700" title={t("introVipTitle")}>
                {t("introVipBody1")}<b className="text-white">{t("introVipDailyLogins")}</b>, <b className="text-white">{t("introVipQuests")}</b>, <b className="text-white">{t("introVipPurchases")}</b> {t("introVipBody2")} <b>{t("introVipChests")}</b>, <b>{t("introVipResBonus")}</b>, <b>{t("introVipBuildBonus")}</b>{t("introVipBody3")}
              </IntroBox>
              <div className="rounded-xl bg-gradient-to-br from-[#FFD700]/20 to-[#FFD700]/5 border border-[#FFD700]/40 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-black tracking-widest text-[#FFD700]">{t("vipLevelHeader")}</div>
                    <div className="text-4xl font-black text-[#FFD700] mt-1">{vip.vip_level}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-[#a8b4cf]">{t("vipStreakHeader")}</div>
                    <div className="text-2xl font-black text-[#FF6B4A]">{vip.daily_login_streak}</div>
                  </div>
                </div>
                {nextTier && (
                  <div className="mt-3">
                    <div className="flex justify-between text-[9px] text-[#a8b4cf] font-black mb-1">
                      <span>{t("vipPoints", { cur: vip.vip_points.toLocaleString(), max: nextTier.required_points.toLocaleString() })}</span>
                      <span>{t("vipNextLevel", { level: nextTier.vip_level })}</span>
                    </div>
                    <div className="h-2 rounded-full bg-black/40 overflow-hidden">
                      <div className="h-full rounded-full transition-all bg-gradient-to-r from-[#FFD700] to-[#FF6B4A]" style={{ width: `${vipProgress}%` }} />
                    </div>
                  </div>
                )}
              </div>

              {currentTier && currentTier.vip_level > 0 && (
                <div className="rounded-xl bg-[#1A1D23] border border-white/10 p-3">
                  <div className="text-[10px] font-black tracking-widest text-[#a8b4cf] mb-2">{t("vipBenefitsHeader")}</div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <Benefit label={<><ChestIcon kind="silver" size={16} fallback="🥈" art={chestArt} />{t("benefitSilver")}</>} value={t("benefitPerDay", { n: currentTier.daily_chest_silver })} />
                    <Benefit label={<><ChestIcon kind="gold"   size={16} fallback="🥇" art={chestArt} />{t("benefitGold")}</>} value={t("benefitPerDay", { n: currentTier.daily_chest_gold })} />
                    <Benefit label={t("benefitResources")} value={t("benefitPercent", { n: Math.round(currentTier.resource_bonus_pct*100) })} />
                    <Benefit label={t("benefitBuildtime")} value={t("benefitMinusPercent", { n: Math.round(currentTier.buildtime_bonus_pct*100) })} />
                    {(currentTier.extra_build_slots ?? 0) > 0 && (
                      <Benefit label={t("benefitBuildSlots")} value={t("benefitPlus", { n: currentTier.extra_build_slots ?? 0 })} />
                    )}
                    {(currentTier.extra_research_slots ?? 0) > 0 && (
                      <Benefit label={t("benefitResearchSlots")} value={t("benefitPlus", { n: currentTier.extra_research_slots ?? 0 })} />
                    )}
                    {(currentTier.training_speed_pct ?? 0) > 0 && (
                      <Benefit label={t("benefitTraining")} value={t("benefitPercent", { n: Math.round((currentTier.training_speed_pct ?? 0)*100) })} />
                    )}
                    {(currentTier.research_speed_pct ?? 0) > 0 && (
                      <Benefit label={t("benefitResearch")} value={t("benefitPercent", { n: Math.round((currentTier.research_speed_pct ?? 0)*100) })} />
                    )}
                    {(currentTier.gather_speed_pct ?? 0) > 0 && (
                      <Benefit label={t("benefitGather")} value={t("benefitPercent", { n: Math.round((currentTier.gather_speed_pct ?? 0)*100) })} />
                    )}
                    {(currentTier.march_speed_pct ?? 0) > 0 && (
                      <Benefit label={t("benefitMarchSpeed")} value={t("benefitPercent", { n: Math.round((currentTier.march_speed_pct ?? 0)*100) })} />
                    )}
                    {(currentTier.troop_atk_pct ?? 0) > 0 && (
                      <Benefit label={t("benefitTroopAtk")} value={t("benefitPercent", { n: Math.round((currentTier.troop_atk_pct ?? 0)*100) })} />
                    )}
                    {(currentTier.troop_def_pct ?? 0) > 0 && (
                      <Benefit label={t("benefitTroopDef")} value={t("benefitPercent", { n: Math.round((currentTier.troop_def_pct ?? 0)*100) })} />
                    )}
                    {(currentTier.troop_hp_pct ?? 0) > 0 && (
                      <Benefit label={t("benefitTroopHp")} value={t("benefitPercent", { n: Math.round((currentTier.troop_hp_pct ?? 0)*100) })} />
                    )}
                  </div>
                </div>
              )}

              {currentTier && currentTier.vip_level > 0 && (
                <VipDailyClaim
                  tier={currentTier}
                  alreadyClaimed={vipDailyClaimed}
                  reload={reload}
                />
              )}

              {(resources.vip_tickets ?? 0) > 0 && (
                <VipTicketRedeem available={resources.vip_tickets ?? 0} reload={reload} />
              )}
              </>}

              {vipSection === "shop" && (
                <VipShopSection vipLevel={vip.vip_level} reload={reload} defaultOpen />
              )}

              {vipSection === "tiers" && (
                <VipTierProgression
                  thresholds={vip_thresholds}
                  currentLevel={vip.vip_level}
                  chestArt={chestArt}
                  resourceArt={resourceArt}
                />
              )}
            </div>
          )}

          {/* SETTINGS */}
          {tab === "settings" && (
            <div className="space-y-4">
              <IntroBox accent={accent} title={t("introSettingsTitle")}>
                {t("introSettingsBody1")}<b className="text-white">{t("introSettingsVis")}</b>{t("introSettingsBody2")}<b className="text-white">{t("introSettingsName")}</b>{t("introSettingsBody3")}<b className="text-white">{t("introSettingsTheme")}</b>{t("introSettingsBody4")}
              </IntroBox>

              <BaseLabelEditor
                accent={accent}
                currentLabel={base.pin_label}
                onSaved={() => void reload()}
              />

              <div>
                <div className="text-[10px] font-black tracking-widest text-[#a8b4cf] mb-2">{t("visibilityHeader")}</div>
                <div className="grid grid-cols-2 gap-1">
                  {(["public","crew"] as const).map((v) => (
                    <button key={v} onClick={() => setVisibility(v)}
                      disabled={base.visibility === "private"}
                      className={`py-2 text-[10px] font-black rounded-lg ${base.visibility === v ? "text-white" : "text-[#a8b4cf] bg-white/5"} ${base.visibility === "private" ? "opacity-40 cursor-not-allowed" : ""}`}
                      style={base.visibility === v ? { background: `${accent}26`, border: `1px solid ${accent}66` } : undefined}>
                      {v === "public" ? t("visibilityPublic") : t("visibilityCrew")}
                    </button>
                  ))}
                </div>
                <div className="text-[9px] text-[#6c7590] mt-1">
                  {base.visibility === "private"
                    ? t("visibilityShielded")
                    : t("visibilityHint")}
                </div>
              </div>

              <BaseShieldPanel accent={accent} reload={reload} />

              <BaseRelocatePanel accent={accent} reload={reload} tokenCount={(base as { relocate_tokens?: number }).relocate_tokens ?? 0} />

              <div>
                <div className="text-[10px] font-black tracking-widest text-[#a8b4cf] mb-2">{t("appearanceHeader")}</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {/* Theme */}
                  <button onClick={() => setThemeShopOpen(true)}
                    className="p-3 rounded-xl flex flex-col items-center text-center gap-2 transition hover:scale-[1.02]"
                    style={{
                      background: "linear-gradient(135deg, rgba(255,215,0,0.18) 0%, rgba(168,85,247,0.18) 100%)",
                      border: "1.5px solid rgba(255,215,0,0.45)",
                      boxShadow: "0 0 12px rgba(255,215,0,0.20)",
                      minHeight: 110,
                    }}>
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FFD700] via-[#a855f7] to-[#22D1C3] flex items-center justify-center text-2xl shadow-lg">🏰</div>
                    <div className="min-w-0">
                      <div className="text-[8px] font-black tracking-[2px] text-[#FFD700]">{t("appearanceTheme")}</div>
                      <div className="text-[11px] font-black text-white truncate">{themes.find((th) => th.id === base.theme_id)?.name ?? "—"}</div>
                      <div className="text-[9px] text-white/60 mt-0.5">{t("appearanceThemeAvail", { n: themes.length })}</div>
                    </div>
                  </button>
                  {/* Ring */}
                  <button onClick={() => setRingPickerOpen(true)}
                    className="p-3 rounded-xl flex flex-col items-center text-center gap-2 transition hover:scale-[1.02]"
                    style={{
                      background: "linear-gradient(135deg, rgba(34,209,195,0.18) 0%, rgba(93,218,240,0.16) 100%)",
                      border: "1.5px solid rgba(34,209,195,0.45)",
                      boxShadow: "0 0 12px rgba(34,209,195,0.20)",
                      minHeight: 110,
                    }}>
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-lg" style={{ border: "4px solid #22D1C3", boxShadow: "0 0 10px #22D1C388, inset 0 0 8px #22D1C355" }}>💍</div>
                    <div className="min-w-0">
                      <div className="text-[8px] font-black tracking-[2px] text-[#22D1C3]">{t("appearanceRing")}</div>
                      <div className="text-[11px] font-black text-white truncate">{t("appearanceRingName")}</div>
                      <div className="text-[9px] text-white/60 mt-0.5">{t("appearanceThemeAvail", { n: 20 })}</div>
                    </div>
                  </button>
                  {/* Banner */}
                  <button onClick={() => setBannerPickerOpen(true)}
                    className="p-3 rounded-xl flex flex-col items-center text-center gap-2 transition hover:scale-[1.02]"
                    style={{
                      background: "linear-gradient(135deg, rgba(255,45,120,0.18) 0%, rgba(168,85,247,0.16) 100%)",
                      border: "1.5px solid rgba(255,45,120,0.45)",
                      boxShadow: "0 0 12px rgba(255,45,120,0.20)",
                      minHeight: 110,
                    }}>
                    <div className="w-20 h-8 rounded-md bg-gradient-to-r from-[#FF2D78]/40 via-[#FF2D78]/20 to-[#FF2D78]/40 flex items-center justify-center text-base shadow-lg" style={{ border: "1px solid #FF2D78" }}>🎀</div>
                    <div className="min-w-0">
                      <div className="text-[8px] font-black tracking-[2px] text-[#FF2D78]">{t("appearanceBanner")}</div>
                      <div className="text-[11px] font-black text-white truncate">{t("appearanceBannerName")}</div>
                      <div className="text-[9px] text-white/60 mt-0.5">{t("appearanceThemeAvail", { n: 20 })}</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {themeShopOpen && (
        <BaseThemeShopModal onClose={() => setThemeShopOpen(false)} onChanged={() => void reload()} />
      )}
      {ringPickerOpen && (
        <BaseRingPickerModal onClose={() => setRingPickerOpen(false)} onChanged={() => void reload()} />
      )}
      {bannerPickerOpen && (
        <NameplatePickerModal onClose={() => { setBannerPickerOpen(false); void reload(); }} />
      )}
      {showRoadmap && (
        <BurgRoadmapModal currentLevel={burgLevel} accent={accent} onClose={() => setShowRoadmap(false)} />
      )}
    </Backdrop>
  );
}

// Festung-Roadmap: zeigt alle Burg-Level-Unlocks (March-Queue, Kapazität,
// Bau-Slots, Truppen-Tiers + Pre-Reqs).
const BURG_MILESTONES: Array<{ level: number; unlocks: string[] }> = [
  { level: 1,  unlocks: ["1 March-Queue", "30 March-Capacity", "1 Bau-Slot"] },
  { level: 4,  unlocks: ["+1 Bau-Slot (=2)", "March-Capacity 60"] },
  { level: 5,  unlocks: ["T2 Truppen freigeschaltet"] },
  { level: 10, unlocks: ["T3 Truppen freigeschaltet"] },
  { level: 11, unlocks: ["+1 March-Queue (=3)", "March-Capacity 100", "+2 Bau-Slots (=3)"] },
  { level: 15, unlocks: ["T4 Truppen freigeschaltet"] },
  { level: 17, unlocks: ["+1 March-Queue (=4)", "March-Capacity 150", "+3 Bau-Slots (=4)"] },
  { level: 20, unlocks: ["T5 Truppen freigeschaltet"] },
  { level: 22, unlocks: ["+1 March-Queue (=5)", "March-Capacity 200", "+4 Bau-Slots (=5)"] },
  { level: 25, unlocks: ["MAX — alle Slots offen"] },
];

function BurgRoadmapModal({ currentLevel, accent, onClose }: { currentLevel: number; accent: string; onClose: () => void }) {
  const t = useTranslations("BaseModal");
  return (
    <div onClick={onClose} className="fixed inset-0 z-[9300]" style={{ background: "rgba(15,17,21,0.92)", backdropFilter: "blur(14px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-[#1A1D23] border overflow-hidden flex flex-col"
        style={{ borderColor: `${accent}66`, boxShadow: `0 0 40px ${accent}33`, maxHeight: "90vh" }}>
        <div className="p-4 border-b border-white/10 flex items-center gap-3">
          <span className="text-2xl">📜</span>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-black tracking-widest" style={{ color: accent }}>{t("roadmapKicker")}</div>
            <div className="text-base font-black text-white">{t("roadmapTitle")}</div>
            <div className="text-[11px] text-[#a8b4cf] mt-0.5">{t("roadmapSub", { level: currentLevel })}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-black/40 text-white text-lg shrink-0">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {BURG_MILESTONES.map((m) => {
            const reached = currentLevel >= m.level;
            const next = !reached && BURG_MILESTONES.filter((x) => x.level > currentLevel)[0]?.level === m.level;
            return (
              <div key={m.level} className="rounded-lg p-3 flex gap-3"
                style={{
                  background: reached ? "rgba(74,222,128,0.08)" : next ? `${accent}14` : "rgba(255,255,255,0.04)",
                  border: `1px solid ${reached ? "rgba(74,222,128,0.4)" : next ? `${accent}66` : "rgba(255,255,255,0.08)"}`,
                }}>
                <div className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-base font-black"
                  style={{
                    background: reached ? "#4ade80" : next ? accent : "rgba(255,255,255,0.1)",
                    color: reached || next ? "#0F1115" : "#8B8FA3",
                  }}>
                  {reached ? "✓" : `Lv${m.level}`}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black mb-1" style={{ color: reached ? "#4ade80" : next ? accent : "#fff" }}>
                    {reached ? t("roadmapReached", { level: m.level }) : next ? t("roadmapNext", { level: m.level }) : t("roadmapFuture", { level: m.level })}
                  </div>
                  <ul className="text-[11px] text-[#a8b4cf] leading-relaxed list-disc list-inside space-y-0.5">
                    {m.unlocks.map((u, i) => <li key={i}>{u}</li>)}
                  </ul>
                </div>
              </div>
            );
          })}
          <div className="text-[10px] text-[#8B8FA3] text-center pt-2 leading-relaxed">
            {t("roadmapFooter")}
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── FOREIGN BASE ─────────────────────────────

function ForeignRunnerBase({ baseId, onClose }: { baseId: string; onClose: () => void }) {
  const t = useTranslations("BaseModal");
  const tBld = useTranslations("Buildings");
  const [data, setData] = useState<ForeignBaseData | null>(null);
  useEffect(() => {
    void (async () => {
      const r = await fetch(`/api/base/${baseId}`, { cache: "no-store" });
      setData(await r.json() as ForeignBaseData);
    })();
  }, [baseId]);

  if (!data) return <Backdrop onClose={onClose}><Spinner label={t("loading")} /></Backdrop>;
  if (!data.ok || !data.base) {
    return <Backdrop onClose={onClose}>
      <div className="bg-[#0F1115] border border-white/10 rounded-2xl p-6 text-center max-w-sm">
        <div className="text-3xl mb-2">🔒</div>
        <div className="text-sm font-black text-white">{t("private")}</div>
        <button onClick={onClose} className="mt-4 px-4 py-2 rounded-lg bg-white/10 text-white text-xs font-black">{t("close")}</button>
      </div>
    </Backdrop>;
  }

  const owner = data.owner?.display_name ?? t("foreignOwnerFallback");
  const crew = data.crew;
  const accent = crew?.color || "#22D1C3";
  return (
    <Backdrop onClose={onClose}>
      <ModalShell accent={accent} pinEmoji="🏰" title={data.base.pin_label ?? t("foreignBaseTitle", { owner })}
        subtitle={t("foreignBaseSubtitle", { level: data.base.level, plz: data.base.plz })} onClose={onClose}>
        <div className="p-4 space-y-3">
          {/* Owner + Crew-Karte */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#1A1D23] border border-white/10">
            {data.owner?.avatar_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={data.owner.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover border border-white/15" />
              : <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-base">👤</div>}
            <div className="flex-1 min-w-0">
              <div className="text-[9px] font-black tracking-widest text-[#a8b4cf]">{t("foreignRunner")}</div>
              <div className="text-sm font-black text-white truncate">{owner}</div>
              {crew ? (
                <div className="text-[10px] mt-0.5 truncate" style={{ color: crew.color || "#a8b4cf" }}>
                  {t("foreignCrewLabel", { name: crew.name })}
                </div>
              ) : (
                <div className="text-[10px] text-[#6c7590] mt-0.5">{t("foreignCrewSolo")}</div>
              )}
            </div>
          </div>

          <div className="text-[10px] font-black tracking-widest text-[#a8b4cf]">{t("foreignBuildings")}</div>
          <div className="grid grid-cols-2 gap-2">
            {(data.buildings ?? []).map((b) => (
              <div key={b.building_id} className="flex items-center gap-2 p-2 rounded-lg bg-[#1A1D23] border border-white/10">
                <span className="text-2xl">{b.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black truncate">{tBld.has(`${b.building_id}.name`) ? tBld(`${b.building_id}.name`) : b.name}</div>
                  <div className="text-[9px] text-[#a8b4cf]">{t("buildLevel", { lvl: b.level, max: 10 })}</div>
                </div>
              </div>
            ))}
            {(data.buildings ?? []).length === 0 && <div className="col-span-2 text-center text-[#6c7590] text-xs py-4">{t("foreignBuildingsEmpty")}</div>}
          </div>
          {/* Report-Button für Base-Label (nur sinnvoll wenn überhaupt eines gesetzt) */}
          {data.base.pin_label && (
            <ReportLabelButton baseId={data.base.id} kind="runner" />
          )}
        </div>
      </ModalShell>
    </Backdrop>
  );
}

// ───────────────────────── CREW STUB ─────────────────────────────

function CrewStub({ onClose }: { onClose: () => void }) {
  const t = useTranslations("BaseModal");
  return (
    <Backdrop onClose={onClose}>
      <ModalShell accent="#22D1C3" pinEmoji="⚔️" title={t("crewStubTitle")} subtitle={t("crewStubSubtitle")} onClose={onClose}>
        <div className="p-6 text-center text-[#a8b4cf] text-sm">{t("crewStubBody")}</div>
      </ModalShell>
    </Backdrop>
  );
}

// ───────────────────────── SHELL HELPERS ─────────────────────────────

function Backdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[1000] bg-black/75 backdrop-blur-md flex items-stretch justify-center p-3 sm:p-6"
         onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md sm:max-w-2xl lg:max-w-4xl flex flex-col min-h-0">{children}</div>
    </div>
  );
}

function ModalShell({ accent, pinEmoji, title, subtitle, onClose, children }: {
  accent: string; pinEmoji: string; title: string; subtitle: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="bg-[#0F1115] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-3" style={{ background: `linear-gradient(135deg, ${accent}33, transparent)`, borderBottom: `1px solid ${accent}44` }}>
        <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl" style={{ background: `${accent}22`, border: `2px solid ${accent}88` }}>{pinEmoji}</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-black text-white truncate">{title}</div>
          <div className="text-[10px] text-[#a8b4cf] truncate">{subtitle}</div>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 text-white/70 hover:text-white text-lg font-black">×</button>
      </div>
      {children}
    </div>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="bg-[#0F1115] border border-white/10 rounded-2xl p-6 text-center">
      <div className="text-3xl mb-2 animate-pulse">🏰</div>
      <div className="text-xs font-black text-[#a8b4cf]">{label}</div>
    </div>
  );
}

/**
 * Klappbare "Was ist das?"-Box. Default eingeklappt, merkt sich pro Titel im
 * localStorage ob der User es schon gelesen hat (dann bleibt eingeklappt).
 */
function IntroBox({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  const storageKey = `ma365.base.intro.${title}`;
  const [open, setOpen] = useState(false);
  // Default IMMER eingeklappt — User muss bewusst aufklappen.
  function toggle() {
    setOpen((v) => {
      const next = !v;
      try { if (!next) window.localStorage.setItem(storageKey, "1"); } catch {}
      return next;
    });
  }
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: `${accent}55`, background: `${accent}0d` }}>
      <button onClick={toggle} className="w-full flex items-center justify-between px-3 py-2 text-left">
        <span className="text-[10px] font-black tracking-widest" style={{ color: accent }}>{title}</span>
        <span className="text-[#a8b4cf] text-xs">{open ? "▼" : "▶"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 text-[11px] text-[#a8b4cf] leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Klappbare Section mit deutlichem Header + Hint. Default zu, persistiert in localStorage.
 * Anders als IntroBox: für reichere Inhalte (Listen, Tabellen, Buttons) gedacht.
 */
function CollapsibleSection({ storageKey, title, hint, accent, children }: {
  storageKey: string; title: string; hint?: string; accent: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw === "1") setOpen(true);
    } catch {}
  }, [storageKey]);
  function toggle() {
    setOpen((v) => {
      const next = !v;
      try { window.localStorage.setItem(storageKey, next ? "1" : "0"); } catch {}
      return next;
    });
  }
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: `${accent}55`, background: `${accent}0d` }}>
      <button onClick={toggle}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-white/5 transition-colors">
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-black tracking-widest" style={{ color: accent }}>{title}</div>
          {hint && !open && <div className="text-[10px] text-[#a8b4cf] mt-0.5 truncate">{hint}</div>}
        </div>
        <span className="text-[#a8b4cf] text-sm ml-2 shrink-0">{open ? "▼ Zuklappen" : "▶ Aufklappen"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3">
          {hint && <div className="text-[10px] text-[#a8b4cf] mb-2 leading-relaxed">{hint}</div>}
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Editor für Base-Name (pin_label). Validiert lokal Länge + erlaubte Zeichen,
 * Server validiert nochmal. Anti-Spam: max 1 Save pro 10s.
 */
function BaseLabelEditor({ accent, currentLabel, onSaved }: {
  accent: string; currentLabel: string | null; onSaved: () => void;
}) {
  const t = useTranslations("BaseModal");
  const [val, setVal] = useState(currentLabel ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number>(0);

  // Live-Verfügbarkeits-Check (debounced)
  const [available, setAvailable] = useState<null | boolean>(null);
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    const trimmed = val.trim();
    if (!trimmed || trimmed === (currentLabel ?? "")) { setAvailable(null); return; }
    if (trimmed.length < 3 || trimmed.length > 10) { setAvailable(null); return; }
    if (!/^[A-Za-zÄÖÜäöüß]+$/.test(trimmed)) { setAvailable(null); return; }
    setChecking(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/base/label-check?label=${encodeURIComponent(trimmed)}`);
        const j = await r.json() as { ok: boolean; available?: boolean };
        setAvailable(j.ok ? !!j.available : null);
      } finally { setChecking(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [val, currentLabel]);

  async function save() {
    setErr(null);
    const trimmed = val.trim();
    if (trimmed && (trimmed.length < 3 || trimmed.length > 10)) { setErr(t("labelEditorErrShort")); return; }
    if (trimmed && !/^[A-Za-zÄÖÜäöüß]+$/.test(trimmed)) { setErr(t("labelEditorErrChars")); return; }
    if (Date.now() - savedAt < 10000) { setErr(t("labelEditorErrThrottle")); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/base/label", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: trimmed }),
      });
      const j = await r.json();
      if (!r.ok || j?.error) {
        setErr(j?.error === "label_bad_chars" ? t("labelEditorErrChars")
             : j?.error === "label_too_short" ? t("labelEditorErrTooShort")
             : j?.error === "label_too_long"  ? t("labelEditorErrTooLong")
             : j?.error === "label_taken"     ? t("labelEditorErrTaken")
             : j?.error ?? t("errGeneric"));
      } else {
        setSavedAt(Date.now());
        onSaved();
      }
    } finally { setBusy(false); }
  }

  const canSave = !busy && val !== (currentLabel ?? "") && (val === "" || available === true);

  return (
    <div>
      <div className="text-[10px] font-black tracking-widest text-[#a8b4cf] mb-2">{t("labelEditorHeader")}</div>
      <div className="rounded-xl bg-[#1A1D23] border border-white/10 p-3">
        <div className="flex gap-2">
          <input value={val} onChange={(e) => setVal(e.target.value)} maxLength={10}
            placeholder={t("labelEditorPlaceholder")}
            className="flex-1 px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-sm text-white placeholder-[#6c7590] focus:outline-none focus:border-white/30"
          />
          <button onClick={save} disabled={!canSave}
            className="px-3 py-2 rounded-lg text-xs font-black disabled:opacity-40"
            style={{ background: `${accent}26`, border: `1px solid ${accent}66`, color: accent }}>
            {busy ? "…" : t("labelEditorSave")}
          </button>
        </div>
        <div className="flex items-center justify-between mt-2 text-[9px]">
          <span className="text-[#6c7590]">{t("labelEditorHint")}</span>
          {err && <span className="text-[#FF2D78] font-black">{err}</span>}
          {!err && checking && <span className="text-[#a8b4cf]">{t("labelEditorChecking")}</span>}
          {!err && !checking && available === true && <span className="text-[#4ade80] font-black">{t("labelEditorFree")}</span>}
          {!err && !checking && available === false && <span className="text-[#FF2D78] font-black">{t("labelEditorTaken")}</span>}
          {!err && Date.now() - savedAt < 3000 && <span className="text-[#4ade80] font-black">{t("labelEditorSaved")}</span>}
        </div>
      </div>
    </div>
  );
}

/**
 * Report-Button für unangemessene Base-Namen. Öffnet kleinen Confirm-Dialog,
 * sendet Report an /api/base/report-label. User kann nur 1× pro 24h pro Base reporten.
 */
// ───────────────────────── TRUPPEN-TAB ─────────────────────────────
function TroopsTab({ accent, reload }: { accent: string; reload: () => Promise<void> }) {
  const t = useTranslations("BaseModal");
  type Troop = {
    id: string; name: string; emoji: string; troop_class: string; tier: number;
    base_atk: number; base_def: number; base_hp: number;
    cost_wood: number; cost_stone: number; cost_gold: number; cost_mana: number;
    train_time_seconds: number; required_building_level: number; description: string;
  };
  type Owned = { troop_id: string; count: number };
  type QueueRow = { id: string; troop_id: string; count: number; ends_at: string };
  type Data = { catalog: Troop[]; owned: Owned[]; queue: QueueRow[]; caps?: Record<string, number> };
  const [data, setData] = useState<Data | null>(null);
  const [openClass, setOpenClass] = useState<string | null>("infantry");
  const [selectedTroopId, setSelectedTroopId] = useState<string | null>(null);
  const [gemsAvailable, setGemsAvailable] = useState<number>(0);
  const resourceArt = useResourceArt();

  const load = useCallback(async () => {
    const r = await fetch("/api/base/troops");
    setData(await r.json());
    try {
      const g = await fetch("/api/base/me", { cache: "no-store" });
      if (g.ok) {
        const j = await g.json() as { user_resources?: { gems?: number } };
        setGemsAvailable(j.user_resources?.gems ?? 0);
      }
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (!data) return <div className="text-[11px] text-[#a8b4cf]">{t("troopsLoading")}</div>;
  const ownedMap = new Map(data.owned.map((o) => [o.troop_id, o.count]));
  const classes: Array<{ id: string; label: string; building: string }> = [
    { id: "infantry",  label: t("troopClassInfantry"), building: t("troopBuildingBar") },
    { id: "cavalry",   label: t("troopClassCavalry"),  building: t("troopBuildingGarage") },
    { id: "marksman",  label: t("troopClassMarksman"), building: t("troopBuildingGym") },
    { id: "siege",     label: t("troopClassSiege"),    building: t("troopBuildingWerkhof") },
  ];

  return (
    <div className="space-y-3">
      <IntroBox accent={accent} title={t("introTroopsTitle")}>
        {t("introTroopsBody1")}<b className="text-white">{t("introTroopsBuildings")}</b>{t("introTroopsBody2")}<b className="text-white">{t("introTroopsT1")}</b>{t("introTroopsBody3")}<b className="text-white">{t("introTroopsT2T5")}</b>{t("introTroopsBody4")}<b className="text-white">{t("introTroopsResearchTab")}</b>{t("introTroopsBody5")}
        <span className="block mt-1 text-[#6c7590]">{t("introTroopsBody6")}</span>
      </IntroBox>


      {data.queue.length > 0 && (
        <div className="rounded-lg p-2 bg-[#FF6B4A]/10 border border-[#FF6B4A]/40 text-[11px]">
          <div className="font-black text-[#FF6B4A] mb-1">{t("trainingHeader")}</div>
          {data.queue.map((q) => {
            const tr = data.catalog.find((x) => x.id === q.troop_id);
            const remain = Math.max(0, Math.ceil((new Date(q.ends_at).getTime() - Date.now()) / 60000));
            return (
              <div key={q.id} className="flex justify-between text-[10px] text-white">
                <span>{tr?.emoji} {tr?.name} × {q.count}</span>
                <span className="text-[#a8b4cf]">{t("trainingMin", { n: remain })}</span>
              </div>
            );
          })}
        </div>
      )}

      {classes.map((c) => {
        const troops = data.catalog.filter((t) => t.troop_class === c.id);
        const totalCount = troops.reduce((s, t) => s + (ownedMap.get(t.id) ?? 0), 0);
        const open = openClass === c.id;
        return (
          <div key={c.id} className="rounded-lg overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <button onClick={() => setOpenClass(open ? null : c.id)} className="w-full flex items-center justify-between px-3 py-2 text-[12px] font-black text-white">
              <span>{c.label}</span>
              <span className="text-[#a8b4cf] text-[10px] flex items-center gap-2">
                {totalCount > 0 && (
                  <span className="text-[#FFD700] font-black">×{totalCount.toLocaleString("de-DE")}</span>
                )}
                <span>{c.building} · {open ? "▾" : "▸"}</span>
              </span>
            </button>
            {open && (
              <div className="p-2 space-y-1.5">
                {troops.map((tr) => {
                  const have = ownedMap.get(tr.id) ?? 0;
                  return (
                    <button key={tr.id} onClick={() => setSelectedTroopId(tr.id)}
                      className="w-full text-left rounded p-2 flex items-center gap-2 bg-[#0F1115]/60 border border-white/5 hover:bg-[#0F1115]/80 hover:border-white/15 transition">
                      <span className="text-2xl">{tr.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-black text-white truncate">
                          {tr.name} <span className="text-[9px] text-[#a8b4cf] font-bold ml-1">{t("troopTier", { tier: tr.tier })}{tr.tier > 1 ? t("troopResearchSuffix") : ""}</span>
                        </div>
                        <div className="text-[9px] text-[#a8b4cf]">⚔️ {tr.base_atk} · 🛡 {tr.base_def} · ❤️ {tr.base_hp} · ⏱ {tr.train_time_seconds}s</div>
                        <div className="text-[9px] text-[#a8b4cf] flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-0.5"><ResourceIcon kind="wood"  size={11} fallback="⚙️" art={resourceArt} />{tr.cost_wood}</span>·
                          <span className="inline-flex items-center gap-0.5"><ResourceIcon kind="stone" size={11} fallback="🔩" art={resourceArt} />{tr.cost_stone}</span>·
                          <span className="inline-flex items-center gap-0.5"><ResourceIcon kind="gold"  size={11} fallback="💸" art={resourceArt} />{tr.cost_gold}</span>·
                          <span className="inline-flex items-center gap-0.5"><ResourceIcon kind="mana"  size={11} fallback="📡" art={resourceArt} />{tr.cost_mana}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="text-[10px] text-[#FFD700] font-black">×{have}</div>
                        <div className="text-[9px] text-[#a8b4cf]">{t("troopTapToOpen")}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {selectedTroopId && (
        <TroopDetailModal
          catalog={data.catalog}
          owned={ownedMap}
          initialTroopId={selectedTroopId}
          gemsAvailable={gemsAvailable}
          caps={data.caps ?? { infantry: 0, cavalry: 0, marksman: 0, siege: 0 }}
          onClose={() => setSelectedTroopId(null)}
          onTrained={async () => { await Promise.all([load(), reload()]); }}
        />
      )}
    </div>
  );
}

// ───────────────────────── FORSCHUNG-TAB ─────────────────────────────
function ResearchTab({ accent, reload }: { accent: string; reload: () => Promise<void> }) {
  const t = useTranslations("BaseModal");
  type Def = {
    id: string; name: string; emoji: string; description: string; branch: string; tier: number;
    prereq_id: string | null; max_level: number;
    base_cost_wood: number; base_cost_stone: number; base_cost_gold: number; base_cost_mana: number;
    base_time_minutes: number; effect_key: string | null; effect_per_level: number;
    required_burg_level: number;
  };
  type Progress = { research_id: string; level: number };
  type QueueRow = { id: string; research_id: string; target_level: number; ends_at: string };
  type Data = { ok: boolean; definitions: Def[]; progress: Progress[]; queue: QueueRow[] };
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [openBranch, setOpenBranch] = useState<string | null>("economy");

  const load = useCallback(async () => {
    const r = await fetch("/api/base/research");
    setData(await r.json());
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function start(researchId: string) {
    setBusy(researchId); setMsg(null);
    try {
      const r = await fetch("/api/base/research", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ research_id: researchId }),
      });
      const j = await r.json() as { ok?: boolean; error?: string; minutes?: number };
      if (j.ok) { setMsg(t("researchStarted", { min: j.minutes ?? 0 })); await Promise.all([load(), reload()]); }
      else if (j.error === "prereq_missing") setMsg(t("researchErrPrereq"));
      else if (j.error === "burg_level_too_low") setMsg(t("researchErrBurgLow"));
      else if (j.error === "queue_full") setMsg(t("researchErrQueueFull"));
      else if (j.error === "not_enough_resources") setMsg(t("researchErrNotEnoughRes"));
      else setMsg(j.error ?? t("errGeneric"));
    } finally { setBusy(null); }
  }

  if (!data) return <div className="text-[11px] text-[#a8b4cf]">{t("troopsLoading")}</div>;
  const progressMap = new Map(data.progress.map((p) => [p.research_id, p.level]));
  const branches: Array<{ id: string; label: string; color: string }> = [
    { id: "economy",        label: t("researchBranchEconomy"),  color: "#FFD700" },
    { id: "military",       label: t("researchBranchMilitary"), color: "#FF2D78" },
    { id: "infrastructure", label: t("researchBranchInfra"),    color: "#22D1C3" },
    { id: "social",         label: t("researchBranchSocial"),   color: "#a855f7" },
  ];

  return (
    <div className="space-y-3">
      <IntroBox accent={accent} title={t("introResearchTitle")}>
        {t("introResearchBody1")}<b className="text-white">{t("introResearchBoni")}</b>{t("introResearchBody2")}
        <span className="block mt-1 text-[#6c7590]">{t("introResearchBody3")}</span>
      </IntroBox>

      {data.queue.length > 0 && (
        <div className="rounded-lg p-2 bg-[#22D1C3]/10 border border-[#22D1C3]/40 text-[11px]">
          <div className="font-black text-[#22D1C3] mb-1">{t("researchInProgress")}</div>
          {data.queue.map((q) => {
            const d = data.definitions.find((x) => x.id === q.research_id);
            const remain = Math.max(0, Math.ceil((new Date(q.ends_at).getTime() - Date.now()) / 60000));
            return (
              <div key={q.id} className="flex justify-between text-[10px] text-white">
                <span>{d?.emoji} {t("researchToLevel", { name: d?.name ?? "", target: q.target_level })}</span>
                <span className="text-[#a8b4cf]">{t("trainingMin", { n: remain })}</span>
              </div>
            );
          })}
        </div>
      )}

      {branches.map((b) => {
        const items = data.definitions.filter((d) => d.branch === b.id).sort((a, c) => (a.tier - c.tier) || a.name.localeCompare(c.name));
        const open = openBranch === b.id;
        const tiers = Array.from(new Set(items.map((d) => d.tier))).sort((a, c) => a - c);
        const totalProgress = items.filter((d) => (progressMap.get(d.id) ?? 0) > 0).length;
        return (
          <div key={b.id} className="rounded-lg overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${b.color}33` }}>
            <button onClick={() => setOpenBranch(open ? null : b.id)} className="w-full flex items-center justify-between px-3 py-2 text-[12px] font-black" style={{ color: b.color }}>
              <span>{b.label} <span className="text-[9px] text-[#a8b4cf] ml-1 font-normal">{totalProgress}/{items.length}</span></span><span className="text-[10px]">{open ? "▾" : "▸"}</span>
            </button>
            {open && (
              <div className="p-2 space-y-3">
                {tiers.map((tier) => (
                <div key={tier} className="space-y-1.5">
                  <div className="text-[9px] font-black tracking-widest text-[#6c7590] px-1">{t("researchTier", { tier })}</div>
                {items.filter((d) => d.tier === tier).map((d) => {
                  const lvl = progressMap.get(d.id) ?? 0;
                  const prereqLvl = d.prereq_id ? (progressMap.get(d.prereq_id) ?? 0) : 1;
                  const locked = d.prereq_id !== null && prereqLvl < 1;
                  const maxed = lvl >= d.max_level;
                  return (
                    <div key={d.id} className="rounded p-2 bg-[#0F1115]/60 border border-white/5">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{d.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-black text-white">
                            {d.name} <span className="text-[9px] text-[#a8b4cf] ml-1">{t("researchItemMeta", { tier: d.tier, lvl, max: d.max_level, burg: d.required_burg_level })}</span>
                          </div>
                          <div className="text-[9px] text-[#a8b4cf]">{d.description}</div>
                          {locked && <div className="text-[9px] text-[#FF6B4A]">{t("researchPrereqLocked")}</div>}
                        </div>
                        <button onClick={() => start(d.id)} disabled={busy === d.id || locked || maxed}
                          className="text-[10px] font-black px-2 py-1 rounded disabled:opacity-40"
                          style={{ background: `${b.color}26`, border: `1px solid ${b.color}66`, color: b.color }}>
                          {maxed ? "MAX" : busy === d.id ? "…" : t("researchToNextLevel", { level: lvl + 1 })}
                        </button>
                      </div>
                    </div>
                  );
                })}
                </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {msg && <div className="text-[11px] text-center font-black" style={{ color: msg.startsWith("✓") ? "#4ade80" : "#FF2D78" }}>{msg}</div>}
    </div>
  );
}

function BaseRelocatePanel({ accent, reload, tokenCount }: { accent: string; reload: () => Promise<void>; tokenCount: number }) {
  const t = useTranslations("BaseModal");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function relocate() {
    if (tokenCount < 1) {
      setMsg(t("relocateNeedToken"));
      return;
    }
    if (!window.confirm(t("relocateConfirm"))) return;
    setBusy(true); setMsg(null);
    try {
      window.dispatchEvent(new CustomEvent("ma365:relocate-base-mode"));
      setMsg(t("relocatePickHint"));
    } finally { setBusy(false); }
  }

  return (
    <div className="rounded-xl p-3" style={{ background: "rgba(34,209,195,0.06)", border: "1px solid rgba(34,209,195,0.3)" }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base">📍</span>
        <div className="text-[10px] font-black tracking-widest" style={{ color: "#22D1C3" }}>{t("relocateHeader")}</div>
      </div>
      <div className="text-[10px] text-[#a8b4cf] mb-2">
        {t("relocateBody1")}<b style={{ color: "#22D1C3" }}>1</b>{t("relocateBody2")}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-white font-black">{t("relocateTokens", { n: tokenCount })}</span>
        <button onClick={relocate} disabled={busy || tokenCount < 1}
          className="text-[10px] font-black px-3 py-1.5 rounded disabled:opacity-40"
          style={{ background: `${accent}26`, border: `1px solid ${accent}66`, color: accent }}>
          {busy ? "…" : t("relocateBtn")}
        </button>
      </div>
      {msg && <div className="text-[10px] text-center font-black mt-1" style={{ color: msg.startsWith("✓") || msg === t("relocatePickHint") ? "#4ade80" : "#FF2D78" }}>{msg}</div>}
      <button onClick={() => void reload()} className="hidden" />
    </div>
  );
}

function BaseShieldPanel({ accent, reload }: { accent: string; reload: () => Promise<void> }) {
  const t = useTranslations("BaseModal");
  type Status = {
    ok?: boolean; active?: boolean;
    remaining_seconds?: number; cooldown_remaining_seconds?: number;
    cost_gold?: number; duration_hours?: number;
    error?: string;
  };
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [, tick] = useState(0);
  const resourceArt = useResourceArt();

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/base/shield");
      setStatus(await r.json() as Status);
    } catch { /* silent */ }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  async function activate() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/base/shield", { method: "POST" });
      const j = await r.json() as Status;
      if (j.ok) { setMsg(t("shieldOk")); await Promise.all([load(), reload()]); }
      else if (j.error === "not_enough_gold") setMsg(t("shieldErrGold"));
      else if (j.error === "cooldown_active") setMsg(t("shieldErrCooldown", { h: Math.ceil((j.cooldown_remaining_seconds ?? 0) / 3600) }));
      else if (j.error === "already_active") setMsg(t("shieldErrAlreadyActive"));
      else setMsg(j.error ?? t("errGeneric"));
    } finally { setBusy(false); }
  }
  async function deactivate() {
    if (!window.confirm(t("shieldEndConfirm"))) return;
    setBusy(true); setMsg(null);
    try {
      await fetch("/api/base/shield", { method: "DELETE" });
      await Promise.all([load(), reload()]);
    } finally { setBusy(false); }
  }

  if (!status?.ok) return null;
  const fmt = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };
  const cdActive = (status.cooldown_remaining_seconds ?? 0) > 0 && !status.active;

  return (
    <div className="rounded-xl p-3" style={{ background: "rgba(255,107,74,0.06)", border: "1px solid rgba(255,107,74,0.3)" }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base">🛡️</span>
        <div className="text-[10px] font-black tracking-widest" style={{ color: "#FF6B4A" }}>{t("shieldHeader")}</div>
      </div>
      {status.active ? (
        <>
          <div className="text-[11px] text-white font-black">{t("shieldActive", { time: fmt(status.remaining_seconds ?? 0) })}</div>
          <div className="text-[9px] text-[#a8b4cf] mt-0.5 mb-2">{t("shieldActiveHint")}</div>
          <button onClick={deactivate} disabled={busy}
            className="w-full px-3 py-1.5 rounded-lg text-[10px] font-black bg-white/5 text-[#a8b4cf] disabled:opacity-40">
            {busy ? "…" : t("shieldEndBtn")}
          </button>
        </>
      ) : cdActive ? (
        <>
          <div className="text-[11px] text-white font-black">{t("shieldCooldown", { time: fmt(status.cooldown_remaining_seconds ?? 0) })}</div>
          <div className="text-[9px] text-[#a8b4cf] mt-0.5">{t("shieldCooldownHint")}</div>
        </>
      ) : (
        <>
          <div className="text-[10px] text-[#a8b4cf] mb-2 inline-flex items-center gap-1 flex-wrap">
            <span>{t("shieldOfferBefore", { hours: status.duration_hours ?? 24 })}</span>
            <b style={{ color: "#FFD700" }} className="inline-flex items-center gap-0.5">
              {status.cost_gold ?? 500}<ResourceIcon kind="gold" size={12} fallback="💸" art={resourceArt} />
            </b>
            <span>{t("shieldOfferAfter")}</span>
          </div>
          <button onClick={activate} disabled={busy}
            className="w-full px-3 py-2 rounded-lg text-[11px] font-black disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
            style={{ background: "linear-gradient(135deg, #FF6B4A, #FF6B4Acc)", color: "#0F1115" }}>
            🛡️ {busy ? t("shieldActivating") : t("shieldActivateBtn", { cost: status.cost_gold ?? 500 })}
            {!busy && <ResourceIcon kind="gold" size={14} fallback="💸" art={resourceArt} />}
          </button>
        </>
      )}
      {msg && <div className="text-[10px] text-center font-black mt-1" style={{ color: msg.startsWith("✓") ? "#4ade80" : "#FF2D78" }}>{msg}</div>}
    </div>
  );
}

function ReportLabelButton({ baseId, crewBaseId, kind }: { baseId?: string; crewBaseId?: string; kind: "runner" | "crew" }) {
  const t = useTranslations("BaseModal");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | "ok" | "duplicate" | "error">(null);

  async function submit() {
    setBusy(true);
    try {
      const r = await fetch("/api/base/report-label", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kind === "runner" ? { base_id: baseId, reason } : { crew_base_id: crewBaseId, reason }),
      });
      const j = await r.json();
      if (j?.error === "already_reported" || j?.ok === false) setDone("duplicate");
      else if (!r.ok || j?.error) setDone("error");
      else setDone("ok");
    } finally { setBusy(false); }
  }

  if (done === "ok") {
    return <div className="text-[10px] text-[#4ade80] text-center py-2">{t("reportLabelSent")}</div>;
  }
  if (done === "duplicate") {
    return <div className="text-[10px] text-[#a8b4cf] text-center py-2">{t("reportLabelDuplicate")}</div>;
  }
  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full text-[10px] text-[#6c7590] hover:text-[#FF2D78] py-2 transition-colors">
        {t("reportLabelBtn")}
      </button>
    );
  }
  return (
    <div className="rounded-xl border border-[#FF2D78]/40 bg-[#FF2D78]/5 p-3 space-y-2">
      <div className="text-[11px] font-black text-[#FF2D78]">{t("reportLabelHeader")}</div>
      <div className="text-[10px] text-[#a8b4cf]">{t("reportLabelHint")}</div>
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={200}
        placeholder={t("reportLabelPlaceholder")}
        className="w-full px-2 py-1.5 rounded bg-black/40 border border-white/10 text-[11px] text-white placeholder-[#6c7590] focus:outline-none"
      />
      <div className="flex gap-2">
        <button onClick={() => setOpen(false)} className="flex-1 text-[10px] font-black py-1.5 rounded bg-white/5 text-[#a8b4cf]">{t("reportLabelCancel")}</button>
        <button onClick={submit} disabled={busy} className="flex-1 text-[10px] font-black py-1.5 rounded bg-[#FF2D78]/20 border border-[#FF2D78]/50 text-[#FF2D78] disabled:opacity-40">
          {busy ? "…" : t("reportLabelSubmit")}
        </button>
      </div>
      {done === "error" && <div className="text-[10px] text-[#FF2D78]">{t("reportLabelErr")}</div>}
    </div>
  );
}

function StatCard({ icon, label, value, sub, subInline, accent, progress }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; subInline?: boolean; accent: string; progress?: number;
}) {
  return (
    <div className="rounded-xl bg-[#1A1D23] border border-white/10 p-3">
      <div className="flex items-center gap-2">
        {typeof icon === "string"
          ? <span className="text-2xl">{icon}</span>
          : <span className="flex items-center justify-center" style={{ width: 40, height: 40 }}>{icon}</span>}
        <div className="flex-1 min-w-0">
          <div className="text-[9px] font-black tracking-wider text-[#a8b4cf] uppercase truncate">{label}</div>
          <div className="text-lg font-black truncate" style={{ color: accent }}>{value}</div>
          {sub && subInline && <div className="text-[9px] text-[#a8b4cf] leading-tight mt-0.5">{sub}</div>}
        </div>
      </div>
      {sub && !subInline && <div className="text-[9px] text-[#a8b4cf] mt-1 truncate">{sub}</div>}
      {typeof progress === "number" && (
        <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(0, progress))}%`, background: accent }} />
        </div>
      )}
    </div>
  );
}

function Benefit({ label, value }: { label: React.ReactNode; value: string }) {
  return (
    <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-black/30">
      <span className="text-[#a8b4cf] inline-flex items-center gap-1 min-w-0">{label}</span>
      <span className="font-black text-white shrink-0">{value}</span>
    </div>
  );
}

function VipTierProgression({ thresholds, currentLevel, chestArt, resourceArt }: {
  thresholds: Array<{ vip_level: number; required_points: number; daily_chest_silver: number; daily_chest_gold: number; resource_bonus_pct: number; buildtime_bonus_pct: number; extra_build_slots?: number; extra_research_slots?: number; training_speed_pct?: number; research_speed_pct?: number; march_speed_pct?: number; gather_speed_pct?: number; troop_atk_pct?: number; troop_def_pct?: number; troop_hp_pct?: number; daily_speed_tokens?: number; daily_vip_tickets?: number }>;
  currentLevel: number;
  chestArt: ResourceArtMap;
  resourceArt: ResourceArtMap;
}) {
  const tt = useTranslations("BaseModal");
  const [expanded, setExpanded] = useState<number | null>(currentLevel + 1);
  const tiers = thresholds.filter((t) => t.vip_level > 0);

  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-black text-[#a8b4cf] tracking-widest mb-2">{tt("vipTiersHeader")}</div>
      {tiers.map((t) => {
        const reached = t.vip_level <= currentLevel;
        const isNext = t.vip_level === currentLevel + 1;
        const open = expanded === t.vip_level;

        // Top-3 Highlights für Compact-Row
        const highlights: React.ReactNode[] = [];
        if (t.daily_chest_gold > 0) highlights.push(<span key="g" className="inline-flex items-center gap-0.5"><ChestIcon kind="gold" size={20} fallback="🥇" art={chestArt} />×{t.daily_chest_gold}</span>);
        else if (t.daily_chest_silver > 0) highlights.push(<span key="s" className="inline-flex items-center gap-0.5"><ChestIcon kind="silver" size={20} fallback="🥈" art={chestArt} />×{t.daily_chest_silver}</span>);
        if ((t.daily_speed_tokens ?? 0) > 0) highlights.push(<span key="sp" className="inline-flex items-center gap-0.5"><ResourceIcon kind="speed_token" size={20} fallback="⚡" art={resourceArt} />×{t.daily_speed_tokens}</span>);
        if (t.resource_bonus_pct > 0) highlights.push(<span key="r" className="text-[#FFD700] font-black">+{Math.round(t.resource_bonus_pct*100)}% Res</span>);
        if (highlights.length < 3 && t.buildtime_bonus_pct > 0) highlights.push(<span key="b" className="text-[#22D1C3] font-black">−{Math.round(t.buildtime_bonus_pct*100)}% Zeit</span>);

        return (
          <div key={t.vip_level} className={`rounded-lg overflow-hidden ${reached ? "bg-[#FFD700]/10 border border-[#FFD700]/30" : isNext ? "bg-white/5 border border-[#FFD700]/40" : "bg-white/5 border border-white/5"}`}>
            <button
              onClick={() => setExpanded(open ? null : t.vip_level)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left"
            >
              <span className={`text-sm font-black w-16 shrink-0 ${reached ? "text-[#FFD700]" : isNext ? "text-[#FFD700]" : "text-[#6c7590]"}`}>
                {reached ? "✓ " : ""}{tt("vipTierLabel", { level: t.vip_level })}
              </span>
              <div className="flex-1 min-w-0 flex items-center gap-2 text-[12px] text-white">
                {highlights.slice(0, 3)}
              </div>
              <span className="text-[10px] font-black text-[#a8b4cf] shrink-0">{t.required_points.toLocaleString("de-DE")}</span>
              <span className="text-[#6c7590] text-[10px] shrink-0 w-3 text-right">{open ? "▾" : "▸"}</span>
            </button>
            {open && (
              <div className="px-3 pb-3 pt-1 border-t border-white/10 flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px] text-white">
                {t.daily_chest_silver > 0 && <span className="inline-flex items-center gap-1"><ChestIcon kind="silver" size={28} fallback="🥈" art={chestArt} /><span className="font-black">×{t.daily_chest_silver}/d</span></span>}
                {t.daily_chest_gold > 0 && <span className="inline-flex items-center gap-1"><ChestIcon kind="gold" size={28} fallback="🥇" art={chestArt} /><span className="font-black">×{t.daily_chest_gold}/d</span></span>}
                {(t.daily_speed_tokens ?? 0) > 0 && <span className="inline-flex items-center gap-1"><ResourceIcon kind="speed_token" size={28} fallback="⚡" art={resourceArt} /><span className="font-black">×{t.daily_speed_tokens}/d</span></span>}
                {(t.daily_vip_tickets ?? 0) > 0 && <span className="inline-flex items-center gap-1"><span className="text-[24px]">🎟</span><span className="font-black">×{t.daily_vip_tickets}/d</span></span>}
                {t.resource_bonus_pct > 0 && <span className="inline-flex items-center gap-1"><span className="text-[18px]">📦</span><span className="font-black text-[#FFD700]">+{Math.round(t.resource_bonus_pct*100)}%</span></span>}
                {t.buildtime_bonus_pct > 0 && <span className="inline-flex items-center gap-1"><span className="text-[18px]">🏗</span><span className="font-black text-[#22D1C3]">−{Math.round(t.buildtime_bonus_pct*100)}%</span></span>}
                {(t.gather_speed_pct ?? 0) > 0 && <span className="inline-flex items-center gap-1"><span className="text-[18px]">🌾</span><span className="font-black">+{Math.round((t.gather_speed_pct ?? 0)*100)}%</span></span>}
                {(t.training_speed_pct ?? 0) > 0 && <span className="inline-flex items-center gap-1"><span className="text-[18px]">⚔️</span><span className="font-black">+{Math.round((t.training_speed_pct ?? 0)*100)}%</span></span>}
                {(t.research_speed_pct ?? 0) > 0 && <span className="inline-flex items-center gap-1"><span className="text-[18px]">🔬</span><span className="font-black">+{Math.round((t.research_speed_pct ?? 0)*100)}%</span></span>}
                {(t.march_speed_pct ?? 0) > 0 && <span className="inline-flex items-center gap-1"><span className="text-[18px]">🐎</span><span className="font-black">+{Math.round((t.march_speed_pct ?? 0)*100)}%</span></span>}
                {(t.troop_atk_pct ?? 0) > 0 && <span className="inline-flex items-center gap-1"><span className="text-[18px]">⚔</span><span className="font-black text-[#FF6B4A]">+{Math.round((t.troop_atk_pct ?? 0)*100)}%</span></span>}
                {(t.troop_def_pct ?? 0) > 0 && <span className="inline-flex items-center gap-1"><span className="text-[18px]">🛡</span><span className="font-black text-[#22D1C3]">+{Math.round((t.troop_def_pct ?? 0)*100)}%</span></span>}
                {(t.troop_hp_pct ?? 0) > 0 && <span className="inline-flex items-center gap-1"><span className="text-[18px]">❤</span><span className="font-black text-[#FF2D78]">+{Math.round((t.troop_hp_pct ?? 0)*100)}%</span></span>}
                {(t.extra_build_slots ?? 0) > 0 && <span className="inline-flex items-center gap-1"><span className="text-[18px]">🔨</span><span className="font-black">+{t.extra_build_slots} Slot</span></span>}
                {(t.extra_research_slots ?? 0) > 0 && <span className="inline-flex items-center gap-1"><span className="text-[18px]">🔬</span><span className="font-black">+{t.extra_research_slots} Slot</span></span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function VipShopSection({ vipLevel, reload, defaultOpen = false }: { vipLevel: number; reload: () => Promise<void>; defaultOpen?: boolean }) {
  const t = useTranslations("BaseModal");
  type Offer = { id: string; name: string; description: string; emoji: string; required_vip: number; reward_kind: string; reward_amount: number; price_gems: number; original_gems: number | null; daily_limit: number; sort: number };
  type Data = { ok: boolean; offers: Offer[]; purchased_today: Record<string, number> };
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(defaultOpen);
  const sb = createClient();
  const chestArt = useChestArt();
  const resourceArt = useResourceArt();

  const load = useCallback(async () => {
    const { data: d } = await sb.rpc("get_vip_shop_state");
    setData(d as Data);
  }, [sb]);
  useEffect(() => { if (open && !data) void load(); }, [open, data, load]);

  async function buy(offerId: string) {
    setBusy(offerId); setMsg(null);
    const { data: res, error } = await sb.rpc("purchase_vip_shop_offer", { p_offer_id: offerId });
    setBusy(null);
    type Res = { ok?: boolean; error?: string; reward_kind?: string; reward_amount?: number };
    const r = (res ?? null) as Res | null;
    if (error || !r?.ok) {
      const errMap: Record<string, string> = {
        vip_level_too_low: t("vipShopErrLevel"),
        daily_limit_reached: t("vipShopErrLimit"),
        not_enough_gems: t("vipShopErrGems"),
      };
      setMsg(t("vipShopErrPrefix", { msg: errMap[r?.error ?? ""] ?? r?.error ?? error?.message ?? t("errGeneric") }));
    } else {
      setMsg(t("vipShopOk", { amount: r.reward_amount ?? 0, kind: r.reward_kind ?? "" }));
      await Promise.all([load(), reload()]);
    }
    setTimeout(() => setMsg(null), 2800);
  }

  return (
    <div className="rounded-xl bg-[#1A1D23] border border-[#FFD700]/30 overflow-hidden">
      {!defaultOpen && (
        <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-3 py-3 text-[13px] font-black text-[#FFD700]">
          <span>{t("vipShopHeader")} <span className="text-[10px] text-[#a8b4cf] font-normal ml-1">{t("vipShopHint")}</span></span>
          <span>{open ? "▾" : "▸"}</span>
        </button>
      )}
      {open && (
        <div className="p-2 space-y-2">
          {!data && <div className="text-[11px] text-[#a8b4cf] text-center py-3">{t("vipShopLoading")}</div>}
          {data && data.offers.filter((o) => o.required_vip <= 15).sort((a, b) => a.sort - b.sort).map((o) => {
            const purchasedToday = data.purchased_today[o.id] ?? 0;
            const remaining = Math.max(0, o.daily_limit - purchasedToday);
            const locked = vipLevel < o.required_vip;
            const soldOut = remaining === 0;
            const disabled = locked || soldOut || busy === o.id;
            const discount = o.original_gems && o.original_gems > o.price_gems
              ? Math.round((1 - o.price_gems / o.original_gems) * 100) : 0;

            // Icon pick
            const icon = o.reward_kind === "silver_chest"
              ? <ChestIcon kind="silver" size={36} fallback="🥈" art={chestArt} />
              : o.reward_kind === "gold_chest"
              ? <ChestIcon kind="gold" size={36} fallback="🥇" art={chestArt} />
              : ["wood","stone","gold","mana","speed_token"].includes(o.reward_kind)
              ? <ResourceIcon kind={o.reward_kind as "wood"|"stone"|"gold"|"mana"|"speed_token"} size={36} fallback={o.emoji} art={resourceArt} />
              : <span className="text-[28px]">{o.emoji}</span>;

            return (
              <div key={o.id} className={`flex items-center gap-3 p-2 rounded-lg ${locked ? "bg-white/[0.02] opacity-50" : "bg-black/30 border border-white/5"}`}>
                <div className="relative shrink-0">
                  {icon}
                  {discount > 0 && !locked && (
                    <span className="absolute -top-1 -right-2 px-1 rounded text-[8px] font-black bg-[#FF2D78] text-white">−{discount}%</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-black text-white">{o.name}</div>
                  <div className="text-[10px] text-[#a8b4cf]">{o.description}</div>
                  <div className="text-[9px] text-[#6c7590] mt-0.5">
                    {locked ? t("vipShopLockedAt", { level: o.required_vip }) : t("vipShopRemaining", { remain: remaining, limit: o.daily_limit })}
                  </div>
                </div>
                <button onClick={() => buy(o.id)} disabled={disabled}
                  className="text-[11px] font-black px-3 py-2 rounded-lg disabled:opacity-40 shrink-0"
                  style={{ background: disabled ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg, #FFD700, #FF6B4A)", color: disabled ? "#6c7590" : "#0F1115" }}>
                  {busy === o.id ? "…" : soldOut ? t("vipShopSoldOut") : (
                    <span className="flex flex-col items-center leading-tight">
                      {discount > 0 && <span className="text-[8px] line-through opacity-60">💎{o.original_gems}</span>}
                      <span>💎{o.price_gems}</span>
                    </span>
                  )}
                </button>
              </div>
            );
          })}
          {msg && <div className="text-[11px] text-center font-black text-white">{msg}</div>}
        </div>
      )}
    </div>
  );
}

function VipDailyClaim({ tier, alreadyClaimed, reload }: {
  tier: { vip_level: number; daily_chest_silver: number; daily_chest_gold: number; daily_speed_tokens?: number; daily_vip_tickets?: number };
  alreadyClaimed: boolean;
  reload: () => Promise<void>;
}) {
  const t = useTranslations("BaseModal");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const sb = createClient();
  const chestArt = useChestArt();
  const resourceArt = useResourceArt();

  type GiftItem = { node: React.ReactNode; label: string; n: number };
  const items: GiftItem[] = [
    { node: <ChestIcon kind="silver" size={20} fallback="🥈" art={chestArt} />, label: t("vipDailySilver"), n: tier.daily_chest_silver },
    { node: <ChestIcon kind="gold"   size={20} fallback="🥇" art={chestArt} />, label: t("vipDailyGold"),   n: tier.daily_chest_gold },
    { node: <ResourceIcon kind="speed_token" size={20} fallback="⚡" art={resourceArt} />, label: t("vipDailySpeedToken"), n: tier.daily_speed_tokens ?? 0 },
    { node: <span className="text-[16px]">🎟</span>, label: t("vipDailyTicket"), n: tier.daily_vip_tickets ?? 0 },
  ].filter((i) => i.n > 0);

  if (items.length === 0) return null;

  async function claim() {
    if (busy || alreadyClaimed) return;
    setBusy(true); setMsg(null);
    const { data, error } = await sb.rpc("claim_vip_daily_rewards");
    setBusy(false);
    type Res = { ok?: boolean; error?: string; silver_chests?: number; gold_chests?: number; speed_tokens?: number; vip_tickets?: number };
    const res = (data ?? null) as Res | null;
    if (error || !res?.ok) {
      setMsg(t("vipShopErrPrefix", { msg: res?.error ?? error?.message ?? t("errGeneric") }));
    } else {
      const parts: string[] = [];
      if ((res.silver_chests ?? 0) > 0) parts.push(`🥈×${res.silver_chests}`);
      if ((res.gold_chests ?? 0) > 0)   parts.push(`🥇×${res.gold_chests}`);
      if ((res.speed_tokens ?? 0) > 0)  parts.push(`⚡×${res.speed_tokens}`);
      if ((res.vip_tickets ?? 0) > 0)   parts.push(`🎟×${res.vip_tickets}`);
      setMsg(`✅ ${parts.join(" · ")}`);
      await reload();
    }
    setTimeout(() => setMsg(null), 3000);
  }

  return (
    <div className="rounded-xl bg-gradient-to-br from-[#FFD700]/15 to-[#FF6B4A]/10 border border-[#FFD700]/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-[10px] font-black tracking-widest text-[#FFD700]">{t("vipDailyHeader")}</div>
          <div className="text-[10px] text-[#a8b4cf] mt-0.5">
            {alreadyClaimed ? t("vipDailyClaimed") : t("vipDailyOncePerDay", { level: tier.vip_level })}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {items.map((i, idx) => (
          <div key={idx} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-black/40 border border-white/10 text-[11px] font-black text-white">
            {i.node}<span>×{i.n}</span><span className="text-[#a8b4cf] font-normal">{i.label}</span>
          </div>
        ))}
        <button onClick={claim} disabled={busy || alreadyClaimed}
          className="ml-auto px-3 h-9 rounded-lg bg-gradient-to-r from-[#FFD700] to-[#FF6B4A] text-[#0F1115] font-black text-xs disabled:opacity-40">
          {busy ? "…" : alreadyClaimed ? t("vipDailyClaimedBtn") : t("vipDailyClaimBtn")}
        </button>
      </div>
      {msg && <div className="mt-2 text-[10px] text-center text-white">{msg}</div>}
    </div>
  );
}

function VipTicketRedeem({ available, reload }: { available: number; reload: () => Promise<void> }) {
  const t = useTranslations("BaseModal");
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const sb = createClient();

  async function redeem() {
    if (busy || count < 1 || count > available) return;
    setBusy(true); setMsg(null);
    const { data, error } = await sb.rpc("redeem_vip_ticket", { p_count: count });
    setBusy(false);
    type RedeemResult = { ok?: boolean; error?: string; points_added?: number };
    const res = (data ?? null) as RedeemResult | null;
    if (error || !res?.ok) {
      setMsg(t("vipShopErrPrefix", { msg: res?.error ?? error?.message ?? t("errGeneric") }));
    } else {
      setMsg(t("vipTicketsResultOk", { points: res.points_added ?? 0 }));
      await reload();
    }
    setTimeout(() => setMsg(null), 2600);
  }

  return (
    <div className="rounded-xl bg-gradient-to-br from-[#FFD700]/15 to-transparent border border-[#FFD700]/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-[10px] font-black tracking-widest text-[#FFD700]">{t("vipTicketsHeader")}</div>
          <div className="text-[10px] text-[#a8b4cf] mt-0.5">{t("vipTicketsSub", { n: available })}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => setCount((c) => Math.max(1, c - 1))} disabled={count <= 1}
          className="w-8 h-8 rounded-lg bg-white/5 text-white font-black disabled:opacity-30">−</button>
        <input type="number" min={1} max={available} value={count}
          onChange={(e) => setCount(Math.max(1, Math.min(available, parseInt(e.target.value || "1", 10))))}
          className="w-16 text-center bg-black/40 border border-white/10 rounded-lg py-1.5 text-white font-black text-sm" />
        <button onClick={() => setCount((c) => Math.min(available, c + 1))} disabled={count >= available}
          className="w-8 h-8 rounded-lg bg-white/5 text-white font-black disabled:opacity-30">+</button>
        <button onClick={() => setCount(available)} disabled={count === available}
          className="px-2 h-8 rounded-lg bg-white/5 text-[#a8b4cf] text-[10px] font-black disabled:opacity-30">{t("vipTicketsMax")}</button>
        <button onClick={redeem} disabled={busy || count < 1 || count > available}
          className="ml-auto px-3 h-8 rounded-lg bg-gradient-to-r from-[#FFD700] to-[#FF6B4A] text-[#0F1115] font-black text-xs disabled:opacity-40">
          {busy ? "…" : t("vipTicketsRedeemBtn", { points: count * 50 })}
        </button>
      </div>
      {msg && <div className="mt-2 text-[10px] text-center text-white">{msg}</div>}
    </div>
  );
}

/** Building-Thumb: zieht Artwork aus cosmetic_artwork (slot_id = `building_<id>`),
 * mit Chroma-Key-Filter (Greenscreen-PNGs werden freigestellt). Emoji als Fallback. */
function BuildingThumb({ id, fallback, art, size = 28 }: {
  id: string; fallback: string; art: ResourceArtMap; size?: number;
}) {
  const a = art[id];
  const filterCss: React.CSSProperties = { filter: "url(#ma365-chroma-black) drop-shadow(0 1px 2px rgba(0,0,0,0.4))" };
  if (a?.image_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={a.image_url} alt={id} style={{ width: size, height: size, objectFit: "contain", flexShrink: 0, ...filterCss }} />;
  }
  if (a?.video_url) {
    return <video src={a.video_url} autoPlay loop muted playsInline style={{ width: size, height: size, objectFit: "contain", flexShrink: 0, ...filterCss }} />;
  }
  return <span style={{ fontSize: size - 4, lineHeight: 1, flexShrink: 0 }}>{fallback}</span>;
}

function compactNum(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 1_000_000) return (n / 1000).toFixed(n < 10_000 ? 1 : 0) + "k";
  return (n / 1_000_000).toFixed(1) + "M";
}

// Fallback-Catalog (1:1 Spiegel von Migrations 00079 + 00082 + 00085) damit das
// Modal sinnvolle Info zeigt auch wenn /api/base/me keinen Catalog liefert.
// Boni-% sind die rebalancten Werte aus Migration 00085 (effect_per_level halbiert).
const FALLBACK_CATALOG: Catalog[] = [
  // ── Phase-1 Solo (00079) ──
  { id: "wegekasse",      name: "Wegekasse",     emoji: "🏦", description: "Erhöht das Lager-Limit für alle Resourcen pro Stufe.",     category: "storage",    scope: "solo", max_level: 10, base_cost_wood: 100, base_cost_stone:  50, base_cost_gold:  0, base_cost_mana:  0, base_buildtime_minutes:  5, effect_key: "storage_cap_pct",   effect_per_level: 0.10, required_base_level: 1, sort: 1 },
  { id: "wald_pfad",      name: "Wald-Pfad",     emoji: "🌲", description: "Mehr Tech-Schrott pro km gelaufenem Park-Weg.",                    category: "production", scope: "solo", max_level: 10, base_cost_wood:  50, base_cost_stone: 100, base_cost_gold:  0, base_cost_mana:  0, base_buildtime_minutes:  5, effect_key: "wood_per_km_pct",   effect_per_level: 0.05, required_base_level: 1, sort: 2 },
  { id: "waechter_halle", name: "Wächter-Halle", emoji: "⚔️", description: "Aktive Wächter erhalten mehr Erfahrung nach jedem Lauf.",         category: "combat",     scope: "solo", max_level: 10, base_cost_wood: 150, base_cost_stone: 150, base_cost_gold: 20, base_cost_mana: 10, base_buildtime_minutes: 10, effect_key: "guardian_xp_pct",   effect_per_level: 0.03, required_base_level: 2, sort: 3 },
  { id: "laufturm",       name: "Lauftürme",     emoji: "🗼", description: "Erhöht die sichtbare Map-Reichweite + bessere Drops.",     category: "utility",    scope: "solo", max_level: 10, base_cost_wood: 200, base_cost_stone: 100, base_cost_gold: 30, base_cost_mana:  0, base_buildtime_minutes: 10, effect_key: "map_range_km",      effect_per_level: 0.30, required_base_level: 2, sort: 4 },
  // ── Starter (00082) ──
  { id: "lagerhalle",     name: "Lauf-Lager",    emoji: "📦", description: "Zusätzliches Lager für seltene Drops + Wächter-Inventar.", category: "storage",    scope: "solo", max_level: 10, base_cost_wood: 200, base_cost_stone: 200, base_cost_gold: 50, base_cost_mana:  0, base_buildtime_minutes: 15, effect_key: "rare_storage_pct",  effect_per_level: 0.08, required_base_level: 1, sort: 5 },
  { id: "schmiede",       name: "Schmiede",      emoji: "⚒️", description: "Schaltet Item-Crafting + Ausrüstungs-Upgrades frei.",      category: "utility",    scope: "solo", max_level: 10, base_cost_wood: 150, base_cost_stone: 250, base_cost_gold: 80, base_cost_mana: 20, base_buildtime_minutes: 20, effect_key: "craft_speed_pct",   effect_per_level: 0.05, required_base_level: 3, sort: 6 },
  { id: "gasthaus",       name: "Wegerast",      emoji: "🍻", description: "Tägliche Trank-Drops + Krypto-Bonus.",                       category: "production", scope: "solo", max_level: 10, base_cost_wood: 250, base_cost_stone: 100, base_cost_gold: 50, base_cost_mana:  0, base_buildtime_minutes: 15, effect_key: "gold_per_km_pct",   effect_per_level: 0.05, required_base_level: 2, sort: 7 },
  { id: "wachturm",       name: "Posten-Turm",   emoji: "🏯", description: "Verteidigt deine Base gegen Crew-Angriffe.",               category: "combat",     scope: "solo", max_level: 10, base_cost_wood: 300, base_cost_stone: 300, base_cost_gold: 100, base_cost_mana: 50, base_buildtime_minutes: 25, effect_key: "base_defense_pct",  effect_per_level: 0.05, required_base_level: 4, sort: 8 },
  // ── Expansion (00085) — Produktion ──
  { id: "saegewerk",      name: "Reisig-Bündler",emoji: "🪓", description: "Passive Tech-Schrott-Produktion pro Stunde — auch ohne Laufen.",   category: "production", scope: "solo", max_level: 10, base_cost_wood: 100, base_cost_stone:  50, base_cost_gold: 10, base_cost_mana:  0, base_buildtime_minutes: 10, effect_key: "wood_per_hour",     effect_per_level: 5.0,  required_base_level: 1, sort: 20 },
  { id: "steinbruch",     name: "Pflaster-Brecher",emoji: "⛏️", description: "Passive Komponenten-Produktion pro Stunde.",                     category: "production", scope: "solo", max_level: 10, base_cost_wood:  50, base_cost_stone: 100, base_cost_gold: 10, base_cost_mana:  0, base_buildtime_minutes: 10, effect_key: "stone_per_hour",    effect_per_level: 5.0,  required_base_level: 1, sort: 21 },
  { id: "goldmine",       name: "Zoll-Schacht",  emoji: "💰", description: "Passive Krypto-Produktion pro Stunde.",                      category: "production", scope: "solo", max_level: 10, base_cost_wood: 100, base_cost_stone: 100, base_cost_gold: 20, base_cost_mana:  0, base_buildtime_minutes: 15, effect_key: "gold_per_hour",     effect_per_level: 4.0,  required_base_level: 2, sort: 22 },
  { id: "mana_quelle",    name: "Quellbrunnen",  emoji: "🌊", description: "Passive Bandbreite-Produktion pro Stunde.",                      category: "production", scope: "solo", max_level: 10, base_cost_wood: 100, base_cost_stone: 100, base_cost_gold: 30, base_cost_mana: 20, base_buildtime_minutes: 15, effect_key: "mana_per_hour",     effect_per_level: 3.0,  required_base_level: 2, sort: 23 },
  // ── Lager ──
  { id: "tresorraum",     name: "Geheim-Tresor", emoji: "🏛️", description: "Resourcen geschützt vor Crew-Angriffen.",                  category: "storage",    scope: "solo", max_level: 10, base_cost_wood: 300, base_cost_stone: 300, base_cost_gold: 50, base_cost_mana:  0, base_buildtime_minutes: 20, effect_key: "safe_storage_pct",  effect_per_level: 0.10, required_base_level: 3, sort: 30 },
  { id: "kornkammer",     name: "Vorrats-Schober",emoji: "🌾", description: "Erhöht das Tech-Schrott-Lager-Cap zusätzlich.",                    category: "storage",    scope: "solo", max_level: 10, base_cost_wood: 150, base_cost_stone:  80, base_cost_gold:  0, base_cost_mana:  0, base_buildtime_minutes: 10, effect_key: "wood_storage_pct",  effect_per_level: 0.20, required_base_level: 1, sort: 31 },
  { id: "mauerwerk",      name: "Komponenten-Speicher",emoji: "🧱", description: "Erhöht das Komponenten-Lager-Cap zusätzlich.",                   category: "storage",    scope: "solo", max_level: 10, base_cost_wood:  80, base_cost_stone: 150, base_cost_gold:  0, base_cost_mana:  0, base_buildtime_minutes: 10, effect_key: "stone_storage_pct", effect_per_level: 0.20, required_base_level: 1, sort: 32 },
  // ── Kampf ──
  { id: "hospital",       name: "Heil-Stube",    emoji: "🏥", description: "Wächter regenerieren schneller nach Niederlagen.",          category: "combat",     scope: "solo", max_level: 10, base_cost_wood: 200, base_cost_stone: 150, base_cost_gold: 50, base_cost_mana: 20, base_buildtime_minutes: 20, effect_key: "heal_speed_pct",    effect_per_level: 0.10, required_base_level: 3, sort: 40 },
  { id: "trainingsplatz", name: "Übungs-Hof",    emoji: "🥋", description: "Aktive Wächter erhalten Bonus-Erfahrung pro Kampf.",              category: "combat",     scope: "solo", max_level: 10, base_cost_wood: 150, base_cost_stone: 150, base_cost_gold: 30, base_cost_mana: 10, base_buildtime_minutes: 15, effect_key: "arena_xp_pct",      effect_per_level: 0.05, required_base_level: 2, sort: 41 },
  { id: "ballistenwerk",  name: "Wurfgeschütz-Werk",emoji: "🎯", description: "Schaltet Belagerungs-Truppen für Crew-Wars frei.",     category: "combat",     scope: "solo", max_level: 10, base_cost_wood: 300, base_cost_stone: 400, base_cost_gold: 100, base_cost_mana: 30, base_buildtime_minutes: 30, effect_key: "siege_strength_pct",effect_per_level: 0.05, required_base_level: 5, sort: 42 },
  { id: "schwertkampflager",name: "Klingen-Kaserne",emoji: "⚔️", description: "Trainiert Schwertkämpfer schneller + günstiger.",  category: "combat",     scope: "solo", max_level: 10, base_cost_wood: 200, base_cost_stone: 250, base_cost_gold: 50, base_cost_mana: 10, base_buildtime_minutes: 20, effect_key: "melee_train_speed_pct", effect_per_level: 0.08, required_base_level: 3, sort: 43 },
  { id: "bogenschuetzenstand",name: "Pfeil-Kaserne",emoji: "🏹", description: "Trainiert Bogenschützen schneller + günstiger.",   category: "combat",     scope: "solo", max_level: 10, base_cost_wood: 250, base_cost_stone: 150, base_cost_gold: 50, base_cost_mana: 10, base_buildtime_minutes: 20, effect_key: "ranged_train_speed_pct",effect_per_level: 0.08, required_base_level: 3, sort: 44 },
  // ── Utility ──
  { id: "akademie",       name: "Gelehrten-Halle",emoji: "📚", description: "Schaltet Forschung frei: dauerhafte Boni.",                 category: "utility",    scope: "solo", max_level: 10, base_cost_wood: 250, base_cost_stone: 200, base_cost_gold: 80, base_cost_mana: 40, base_buildtime_minutes: 30, effect_key: "research_speed_pct",effect_per_level: 0.08, required_base_level: 4, sort: 50 },
  { id: "kloster",        name: "Mond-Kapelle",  emoji: "⛪", description: "Bandbreite-Boost auf Magier-Klassen + tägliche Bandbreite-Truhe.",       category: "utility",    scope: "solo", max_level: 10, base_cost_wood: 150, base_cost_stone: 200, base_cost_gold: 60, base_cost_mana: 100,base_buildtime_minutes: 25, effect_key: "mana_per_km_pct",   effect_per_level: 0.05, required_base_level: 3, sort: 51 },
  { id: "augurstein",     name: "Sternendeuter-Stein",emoji: "🔮", description: "Zeigt Saison-Events + kommende Bosse als Vorhersage.",      category: "utility",    scope: "solo", max_level: 10, base_cost_wood: 100, base_cost_stone: 100, base_cost_gold: 50, base_cost_mana: 200,base_buildtime_minutes: 20, effect_key: "event_preview_days",effect_per_level: 1.0,  required_base_level: 4, sort: 52 },
  { id: "schwarzes_brett",name: "Quest-Tafel",   emoji: "📋", description: "Tägliche Quests mit zusätzlichen Belohnungen.",             category: "utility",    scope: "solo", max_level: 10, base_cost_wood: 100, base_cost_stone:  50, base_cost_gold: 20, base_cost_mana:  0, base_buildtime_minutes: 10, effect_key: "daily_quest_count", effect_per_level: 0.5,  required_base_level: 2, sort: 53 },
  { id: "halbling_haus",  name: "Bau-Kontor",    emoji: "🏚️", description: "Zusätzliche Bauwarteschlangen-Slots (parallel bauen).",     category: "utility",    scope: "solo", max_level: 10, base_cost_wood: 200, base_cost_stone: 200, base_cost_gold: 80, base_cost_mana: 20, base_buildtime_minutes: 25, effect_key: "build_queue_slots", effect_per_level: 0.5,  required_base_level: 3, sort: 54 },
  { id: "basar",          name: "Tausch-Stand",  emoji: "🛒", description: "Tausch-Markt: Resourcen 1:1 zwischen Tech-Schrott/Komponenten/Krypto/Bandbreite.",category: "utility",    scope: "solo", max_level: 10, base_cost_wood: 200, base_cost_stone: 200, base_cost_gold: 50, base_cost_mana: 20, base_buildtime_minutes: 20, effect_key: "market_fee_pct",    effect_per_level:-0.02, required_base_level: 3, sort: 60 },
  { id: "shop",           name: "Kosmetik-Stand",emoji: "🏪", description: "Tägliche Kosmetik-Drops (Marker-Skins, Pin-Themes).",       category: "cosmetic",   scope: "solo", max_level: 10, base_cost_wood: 150, base_cost_stone: 100, base_cost_gold: 100, base_cost_mana: 50, base_buildtime_minutes: 20, effect_key: "cosmetic_drop_chance",effect_per_level: 0.05, required_base_level: 4, sort: 61 },
  { id: "brunnen",        name: "Brunnen",       emoji: "⛲", description: "Reine Kosmetik. Erhöht Base-Schönheit (Visitor-Boost).",    category: "cosmetic",   scope: "solo", max_level:  5, base_cost_wood: 200, base_cost_stone:  50, base_cost_gold: 30, base_cost_mana: 10, base_buildtime_minutes: 15, effect_key: "visitor_attract_pct",effect_per_level: 0.10, required_base_level: 2, sort: 62 },
  { id: "statue",         name: "Heldenstatue",  emoji: "🗿", description: "Reine Kosmetik. Zeigt deinen aktiven Wächter.",              category: "cosmetic",   scope: "solo", max_level:  5, base_cost_wood:  50, base_cost_stone: 200, base_cost_gold: 50, base_cost_mana: 10, base_buildtime_minutes: 20, effect_key: "visitor_attract_pct",effect_per_level: 0.05, required_base_level: 3, sort: 63 },
];

// Mapping: effect_key → was der Bonus tatsächlich macht (für Aktive-Effekte-Liste)
const EFFECT_LABEL: Record<string, string> = {
  storage_cap_pct:        "Lager-Kapazität",
  wood_per_km_pct:        "Tech-Schrott pro Park-km",
  stone_per_km_pct:       "Komponenten pro Wohngebiet-km",
  gold_per_km_pct:        "Krypto pro Stadtkern-km",
  mana_per_km_pct:        "Bandbreite pro Wasser-km",
  guardian_xp_pct:        "Wächter-Erfahrung nach Lauf",
  map_range_km:           "Map-Reichweite (km)",
  rare_storage_pct:       "Selten-Item-Lager",
  craft_speed_pct:        "Crafting-Geschwindigkeit",
  base_defense_pct:       "Base-Verteidigung",
  wood_per_hour:          "Tech-Schrott/Stunde (passiv)",
  stone_per_hour:         "Komponenten/Stunde (passiv)",
  gold_per_hour:          "Krypto/Stunde (passiv)",
  mana_per_hour:          "Bandbreite/Stunde (passiv)",
  safe_storage_pct:       "Geschützte Resourcen",
  wood_storage_pct:       "Tech-Schrott-Lager-Cap",
  stone_storage_pct:      "Komponenten-Lager-Cap",
  heal_speed_pct:         "Heil-Geschwindigkeit",
  arena_xp_pct:           "Arena-Erfahrung",
  siege_strength_pct:     "Belagerungs-Stärke",
  melee_train_speed_pct:  "Schwertkämpfer-Training",
  ranged_train_speed_pct: "Bogenschützen-Training",
  research_speed_pct:     "Forschungs-Geschwindigkeit",
  event_preview_days:     "Event-Vorschau (Tage)",
  daily_quest_count:      "Tägliche Quests",
  build_queue_slots:      "Bau-Slots",
  market_fee_pct:         "Markt-Gebühr",
  cosmetic_drop_chance:   "Kosmetik-Drop-Chance",
  visitor_attract_pct:    "Visitor-Boost",
  crew_resource_pct:      "Crew-Resourcen",
  chest_speed_pct:        "Truhen-Öffnungszeit",
  crew_help_speedup_pct:  "Crew-Hilfe Speedup",
  scout_strength_pct:     "Späher-Stärke",
  rally_capacity_pct:     "Sammel-Kapazität",
  legendary_recruit_pct:  "Legendär-Rekrut-Chance",
  crew_heal_speed_pct:    "Crew-Heil-Geschwindigkeit",
  crew_research_pct:      "Crew-Forschung",
  celestial_strength_pct: "Himmlische-Stärke",
  salvage_yield_pct:      "Verschrott-Ertrag",
};

// Welche Effekte sind absolute Werte (nicht %)?
const ABSOLUTE_EFFECTS = new Set(["map_range_km", "wood_per_hour", "stone_per_hour", "gold_per_hour", "mana_per_hour", "event_preview_days", "daily_quest_count", "build_queue_slots"]);

const CATEGORY_META: Record<string, { label: string; emoji: string }> = {
  production: { label: "PRODUKTION", emoji: "🏭" },
  storage:    { label: "LAGER",      emoji: "📦" },
  combat:     { label: "KAMPF",      emoji: "⚔️" },
  utility:    { label: "AUSBAU",     emoji: "🛠️" },
  cosmetic:   { label: "DEKO",       emoji: "✨" },
};

// ═════════════════════════════════════════════════════════════════════════
// EarnResourcesSection — A) Ad-Rewards, B) Quests, C) Crew-Spende,
//                       D) Schritte, E) Resource-Pakete
// ═════════════════════════════════════════════════════════════════════════

type QuestRow = { id: string; quest_id: string; progress: number; target: number; claimed: boolean };
type QuestDef = { id: string; name: string; description: string; emoji: string; quest_type: string; target: number; reward_wood: number; reward_stone: number; reward_gold: number; reward_mana: number };
type ResourcePackage = { id: string; name: string; description: string; price_cents: number; reward_wood: number; reward_stone: number; reward_gold: number; reward_mana: number; reward_speed_tokens: number; bonus_label: string | null };

function EarnResourcesSection({ accent, reload }: { accent: string; reload: () => Promise<void> }) {
  const t = useTranslations("BaseModal");
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-black tracking-widest text-[#a8b4cf] mt-3 mb-1">{t("earnHeader")}</div>

      <CollapsibleSection storageKey="ma365.earn.ads"
        title={t("earnAdsTitle")}
        hint={t("earnAdsHint")}
        accent={accent}>
        <AdRewardCard accent={accent} reload={reload} />
      </CollapsibleSection>

      <CollapsibleSection storageKey="ma365.earn.quests"
        title={t("earnQuestsTitle")}
        hint={t("earnQuestsHint")}
        accent={accent}>
        <QuestsCard accent={accent} reload={reload} />
      </CollapsibleSection>

      <CollapsibleSection storageKey="ma365.earn.crew"
        title={t("earnCrewTitle")}
        hint={t("earnCrewHint")}
        accent={accent}>
        <CrewDonateCard accent={accent} reload={reload} />
      </CollapsibleSection>

      <CollapsibleSection storageKey="ma365.earn.steps"
        title={t("earnStepsTitle")}
        hint={t("earnStepsHint")}
        accent={accent}>
        <StepsCard accent={accent} reload={reload} />
      </CollapsibleSection>

      <CollapsibleSection storageKey="ma365.earn.packages"
        title={t("earnPackagesTitle")}
        hint={t("earnPackagesHint")}
        accent={accent}>
        <PackagesCard accent={accent} />
      </CollapsibleSection>
    </div>
  );
}

type AdStatus = {
  daily_used: number;
  daily_limit: number;
  cooldown_used: number;
  cooldown_limit: number;
  cooldown_seconds: number;
  cooldown_remaining: number;
  daily_reward:    { wood: number; stone: number; gold: number; mana: number; speed_tokens: number };
  cooldown_reward: { wood: number; stone: number; gold: number; mana: number; speed_tokens: number };
};

function AdRewardCard({ accent, reload }: { accent: string; reload: () => Promise<void> }) {
  const t = useTranslations("BaseModal");
  const [busy, setBusy] = useState<"daily" | "cooldown" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [status, setStatus] = useState<AdStatus | null>(null);
  const [cdEndAt, setCdEndAt] = useState<number>(0);
  const [, forceTick] = useState(0);

  const loadStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/base/ad-status");
      const j = await r.json() as AdStatus;
      setStatus(j);
      setCdEndAt(j.cooldown_remaining > 0 ? Date.now() + j.cooldown_remaining * 1000 : 0);
    } catch { /* silent */ }
  }, []);
  useEffect(() => { void loadStatus(); }, [loadStatus]);
  useEffect(() => {
    const id = window.setInterval(() => forceTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  async function claim(kind: "daily" | "cooldown") {
    setBusy(kind); setMsg(null);
    try {
      const { showRewardedAd } = await import("@/lib/admob");
      const adResult = await showRewardedAd(kind);
      if (!adResult.rewarded) {
        setMsg(adResult.native ? t("adCancelledNoReward") : t("adCancelled"));
        return;
      }
      const r = await fetch("/api/base/claim-ad-reward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const j = await r.json() as {
        ok: boolean; error?: string;
        reward?: { wood: number; stone: number; gold: number; mana: number; speed_tokens: number };
        cooldown_remaining?: number; used?: number; limit?: number;
      };
      if (j.ok) {
        const rw = j.reward;
        const tokens = rw && rw.speed_tokens > 0 ? t("adTokensSuffix", { n: rw.speed_tokens }) : "";
        setMsg(t("adRewardOk", { n: rw?.wood ?? 0, tokens }));
        await Promise.all([loadStatus(), reload()]);
      } else if (j.error === "daily_already_claimed") {
        setMsg(t("adErrDailyClaimed"));
        await loadStatus();
      } else if (j.error === "cooldown_active") {
        setMsg(t("adErrCooldown", { min: Math.ceil((j.cooldown_remaining ?? 0) / 60) }));
        await loadStatus();
      } else if (j.error === "cooldown_limit_reached") {
        setMsg(t("adErrCooldownLimit"));
        await loadStatus();
      } else {
        setMsg(j.error ?? t("errGeneric"));
      }
    } finally { setBusy(null); }
  }

  if (!status) return <div className="text-[11px] text-[#a8b4cf]">{t("troopsLoading")}</div>;

  const dailyDone = status.daily_used >= status.daily_limit;
  const cdLimitReached = status.cooldown_used >= status.cooldown_limit;
  const cdRemain = cdEndAt > 0 ? Math.max(0, Math.ceil((cdEndAt - Date.now()) / 1000)) : 0;
  const cdActive = cdRemain > 0;
  const dailyReward = status.daily_reward;
  const cdReward = status.cooldown_reward;

  return (
    <div className="space-y-2">
      {/* DAILY BUTTON: 1×/Tag, +200 jede + 1 Speed-Token */}
      <button onClick={() => claim("daily")} disabled={busy !== null || dailyDone}
        className="w-full px-4 py-3 rounded-lg text-sm font-black disabled:opacity-40"
        style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, color: "#0F1115", boxShadow: `0 0 14px ${accent}66` }}>
        {busy === "daily"
          ? t("adVideoLoading")
          : dailyDone
            ? t("adDailyClaimed")
            : (dailyReward.speed_tokens > 0 ? t("adDailyOfferTokens", { n: dailyReward.wood, tokens: dailyReward.speed_tokens }) : t("adDailyOffer", { n: dailyReward.wood }))}
      </button>
      <div className="text-[10px] text-[#a8b4cf] text-center">
        {t("adDailyToday", { used: status.daily_used, limit: status.daily_limit })}
      </div>

      {/* COOLDOWN BUTTON: 4×/Tag, +50 jede, 60min Cooldown */}
      <button onClick={() => claim("cooldown")} disabled={busy !== null || cdLimitReached || cdActive}
        className="w-full px-4 py-3 rounded-lg text-sm font-black disabled:opacity-40"
        style={{
          background: cdActive || cdLimitReached
            ? "linear-gradient(135deg, #2a2f3a, #1a1d23)"
            : `linear-gradient(135deg, ${accent}33, ${accent}11)`,
          color: cdActive || cdLimitReached ? "#a8b4cf" : "#FFF",
          border: `1px solid ${accent}55`,
        }}>
        {busy === "cooldown"
          ? t("adVideoLoading")
          : cdLimitReached
            ? t("adCooldownExhausted")
            : cdActive
              ? t("adCooldownActive", { min: Math.floor(cdRemain / 60), sec: String(cdRemain % 60).padStart(2, "0") })
              : t("adCooldownOffer", { n: cdReward.wood })}
      </button>
      <div className="text-[10px] text-[#a8b4cf] text-center">
        {t("adCooldownToday", { used: status.cooldown_used, limit: status.cooldown_limit, min: Math.round(status.cooldown_seconds / 60) })}
      </div>

      {msg && <div className="text-[11px] text-center font-black" style={{ color: msg.startsWith("✓") ? "#4ade80" : "#FF2D78" }}>{msg}</div>}
    </div>
  );
}

function QuestsCard({ accent, reload }: { accent: string; reload: () => Promise<void> }) {
  const t = useTranslations("BaseModal");
  const [data, setData] = useState<{ quests: QuestRow[]; definitions: QuestDef[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const resourceArt = useResourceArt();

  const load = useCallback(async () => {
    const r = await fetch("/api/base/quests");
    setData(await r.json());
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function claim(qid: string) {
    setBusy(qid);
    try {
      await fetch("/api/base/quests/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quest_id: qid }) });
      await Promise.all([load(), reload()]);
    } finally { setBusy(null); }
  }

  if (!data) return <div className="text-[11px] text-[#a8b4cf]">{t("questsLoading")}</div>;
  const defMap = new Map(data.definitions.map((d) => [d.id, d]));
  return (
    <div className="space-y-2">
      {data.quests.length === 0 && <div className="text-[11px] text-[#a8b4cf]">{t("questsEmpty")}</div>}
      {data.quests.map((q) => {
        const def = defMap.get(q.quest_id);
        if (!def) return null;
        const done = q.progress >= q.target;
        const rewards = (["wood","stone","gold","mana"] as const)
          .map((k) => ({ k, v: def[`reward_${k}` as const] }))
          .filter((x) => x.v > 0);
        const fbMap = { wood: "🪵", stone: "🪨", gold: "🪙", mana: "💧" } as const;
        return (
          <div key={q.id} className="flex items-center gap-2 p-2 rounded-lg bg-[#1A1D23] border border-white/10">
            <span className="text-xl">{def.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-black text-white truncate">{def.name}</div>
              <div className="text-[9px] text-[#a8b4cf] truncate">{def.description}</div>
              <div className="mt-1 flex items-center gap-2">
                <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full" style={{ width: `${(q.progress / q.target) * 100}%`, background: accent }} />
                </div>
                <span className="text-[9px] text-[#a8b4cf]">{q.progress}/{q.target}</span>
              </div>
              <div className="text-[9px] text-[#a8b4cf] mt-1 inline-flex flex-wrap items-center gap-1">
                <span>{t("questReward")}</span>
                {rewards.map((x) => (
                  <span key={x.k} className="inline-flex items-center gap-0.5">
                    <ResourceIcon kind={x.k} size={11} fallback={fbMap[x.k]} art={resourceArt} />{x.v}
                  </span>
                ))}
              </div>
            </div>
            {q.claimed ? <span className="text-[10px] text-[#4ade80] font-black px-2">✓</span>
              : done ? <button onClick={() => claim(q.id)} disabled={busy === q.id} className="text-[10px] font-black px-2 py-1 rounded disabled:opacity-40" style={{ background: `${accent}26`, border: `1px solid ${accent}66`, color: accent }}>{busy === q.id ? "…" : t("questClaimBtn")}</button>
              : <span className="text-[10px] text-[#6c7590] px-2">⏳</span>}
          </div>
        );
      })}
    </div>
  );
}

type CrewMate = { user_id: string; display_name: string };

function CrewDonateCard({ accent, reload }: { accent: string; reload: () => Promise<void> }) {
  const t = useTranslations("BaseModal");
  const [mates, setMates] = useState<CrewMate[] | null>(null);
  const [target, setTarget] = useState<string>("");
  const [resType, setResType] = useState<"wood" | "stone" | "gold" | "mana">("gold");
  const [amount, setAmount] = useState<number>(100);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const resourceArt = useResourceArt();

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/crew/my-members");
        if (r.ok) {
          const j = await r.json() as { members?: CrewMate[] };
          setMates(j.members ?? []);
        } else { setMates([]); }
      } catch { setMates([]); }
    })();
  }, []);

  async function send() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/base/donate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to_user: target, resource_type: resType, amount }) });
      const j = await r.json();
      if (j.ok) { setMsg(t("crewDonateOk", { amount, res: resType, name: mates?.find((m) => m.user_id === target)?.display_name ?? t("crewDonateUnknown") })); await reload(); }
      else if (j.error === "recipient_daily_limit") setMsg(t("crewDonateErrLimit"));
      else if (j.error === "insufficient") setMsg(t("crewDonateErrInsuff"));
      else if (j.error === "not_same_crew") setMsg(t("crewDonateErrSameCrew"));
      else setMsg(j.error ?? t("errGeneric"));
    } finally { setBusy(false); }
  }

  if (!mates) return <div className="text-[11px] text-[#a8b4cf]">{t("crewDonateLoading")}</div>;
  if (mates.length === 0) return <div className="text-[11px] text-[#a8b4cf]">{t("crewDonateNoCrew")}</div>;

  return (
    <div className="space-y-2">
      <select value={target} onChange={(e) => setTarget(e.target.value)} className="w-full px-2 py-2 rounded bg-black/40 border border-white/10 text-sm text-white">
        <option value="">{t("crewDonatePickRecipient")}</option>
        {mates.map((m) => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}
      </select>
      <div className="flex gap-1">
        {(["wood","stone","gold","mana"] as const).map((k) => {
          const labels = { wood: t("resWoodLabel"), stone: t("resStoneLabel"), gold: t("resGoldLabel"), mana: t("resManaLabel") } as const;
          const fbs = { wood: "🪵", stone: "🪨", gold: "🪙", mana: "💧" } as const;
          return (
            <button key={k} onClick={() => setResType(k)}
              className={`flex-1 py-1.5 rounded text-[10px] font-black inline-flex items-center justify-center gap-1 ${resType === k ? "text-[#0F1115]" : "bg-white/5 text-[#a8b4cf]"}`}
              style={resType === k ? { background: accent } : undefined}>
              <ResourceIcon kind={k} size={14} fallback={fbs[k]} art={resourceArt} />{labels[k]}
            </button>
          );
        })}
      </div>
      <input type="number" min={1} max={1000} value={amount} onChange={(e) => setAmount(Math.max(1, Math.min(1000, Number(e.target.value) || 0)))}
        className="w-full px-3 py-2 rounded bg-black/40 border border-white/10 text-sm text-white" placeholder={t("crewDonatePlaceholder")} />
      <button onClick={send} disabled={busy || !target || amount <= 0}
        className="w-full py-2 rounded-lg text-sm font-black disabled:opacity-40"
        style={{ background: `${accent}26`, border: `1px solid ${accent}66`, color: accent }}>
        {busy ? "…" : t("crewDonateSendBtn")}
      </button>
      {msg && <div className="text-[10px] text-center" style={{ color: msg.startsWith("✓") ? "#4ade80" : "#FF2D78" }}>{msg}</div>}
    </div>
  );
}

function StepsCard({ accent, reload }: { accent: string; reload: () => Promise<void> }) {
  const t = useTranslations("BaseModal");
  const [steps, setSteps] = useState<number>(2000);
  const [source, setSource] = useState<"manual" | "wheelchair" | "healthkit" | "googlefit">("manual");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function record() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/base/record-steps", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ steps, source }) });
      const j = await r.json() as { ok?: boolean; error?: string; km?: number; reward?: { each: number; speed_tokens: number } };
      if (j.ok) { setMsg(t("stepsOk", { km: j.km ?? 0, each: j.reward?.each ?? 0, tokens: j.reward?.speed_tokens ?? 0 })); await reload(); }
      else if (j.error === "daily_limit") setMsg(t("stepsErrDailyLimit"));
      else setMsg(j.error ?? t("errGeneric"));
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {([["manual", t("stepsManual")], ["wheelchair", t("stepsWheelchair")], ["healthkit", t("stepsHealthkit")], ["googlefit", t("stepsGoogleFit")]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setSource(k as "manual" | "wheelchair" | "healthkit" | "googlefit")}
            className={`flex-1 py-1.5 rounded text-[10px] font-black ${source === k ? "text-[#0F1115]" : "bg-white/5 text-[#a8b4cf]"}`}
            style={source === k ? { background: accent } : undefined}>
            {label}
          </button>
        ))}
      </div>
      <input type="number" min={1} max={50000} value={steps} onChange={(e) => setSteps(Math.max(1, Math.min(50000, Number(e.target.value) || 0)))}
        className="w-full px-3 py-2 rounded bg-black/40 border border-white/10 text-sm text-white" />
      <div className="text-[9px] text-[#6c7590]">
        {t("stepsKmHint", { km: (steps / (source === "wheelchair" ? 1000 : 1300)).toFixed(2), coins: Math.round((steps / (source === "wheelchair" ? 1000 : 1300)) * 50) })}
      </div>
      <button onClick={record} disabled={busy || steps <= 0}
        className="w-full py-2 rounded-lg text-sm font-black disabled:opacity-40"
        style={{ background: `${accent}26`, border: `1px solid ${accent}66`, color: accent }}>
        {busy ? "…" : t("stepsRecordBtn")}
      </button>
      {msg && <div className="text-[10px] text-center" style={{ color: msg.startsWith("✓") ? "#4ade80" : "#FF2D78" }}>{msg}</div>}
    </div>
  );
}

function PackagesCard({ accent }: { accent: string }) {
  const t = useTranslations("BaseModal");
  const [pkgs, setPkgs] = useState<ResourcePackage[] | null>(null);
  const resourceArt = useResourceArt();
  useEffect(() => {
    void (async () => {
      const r = await fetch("/api/base/packages");
      const j = await r.json() as { packages?: ResourcePackage[] };
      setPkgs(j.packages ?? []);
    })();
  }, []);

  if (!pkgs) return <div className="text-[11px] text-[#a8b4cf]">{t("packagesLoading")}</div>;
  if (pkgs.length === 0) return <div className="text-[11px] text-[#a8b4cf]">{t("packagesEmpty")}</div>;

  return (
    <div className="space-y-2">
      {pkgs.map((p) => (
        <div key={p.id} className="rounded-lg bg-[#1A1D23] border border-white/10 p-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-white">{p.name}</span>
              {p.bonus_label && <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ background: accent, color: "#0F1115" }}>{p.bonus_label}</span>}
            </div>
            <div className="text-[10px] text-[#a8b4cf] mt-1 inline-flex flex-wrap items-center gap-1">
              <span className="inline-flex items-center gap-0.5"><ResourceIcon kind="wood"  size={12} fallback="⚙️" art={resourceArt} />{p.reward_wood.toLocaleString("de-DE")}</span>·
              <span className="inline-flex items-center gap-0.5"><ResourceIcon kind="stone" size={12} fallback="🔩" art={resourceArt} />{p.reward_stone.toLocaleString("de-DE")}</span>·
              <span className="inline-flex items-center gap-0.5"><ResourceIcon kind="gold"  size={12} fallback="💸" art={resourceArt} />{p.reward_gold.toLocaleString("de-DE")}</span>·
              <span className="inline-flex items-center gap-0.5"><ResourceIcon kind="mana"  size={12} fallback="📡" art={resourceArt} />{p.reward_mana.toLocaleString("de-DE")}</span>
              {p.reward_speed_tokens > 0 && <span className="inline-flex items-center gap-0.5">·<ResourceIcon kind="speed_token" size={12} fallback="⚡" art={resourceArt} />{p.reward_speed_tokens}</span>}
            </div>
          </div>
          <a href="/shop" className="text-xs font-black px-3 py-2 rounded-lg whitespace-nowrap"
            style={{ background: accent, color: "#0F1115" }}>
            {(p.price_cents / 100).toFixed(2).replace(".", ",")}€
          </a>
        </div>
      ))}
      <div className="text-[9px] text-[#6c7590] text-center">{t("packagesNote")}</div>
    </div>
  );
}

