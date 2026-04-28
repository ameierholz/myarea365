"use client";

/**
 * BaseModal — Click-Modal für Runner- und Crew-Base-Pins auf der Karte.
 * Eigene Base: voller Funktionsumfang (Bauen, Skip, Truhen öffnen, Theme/Visibility ändern).
 * Fremde Base: Read-only View (Owner, Stufe, Buildings).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { DailyDealTeaser } from "@/components/daily-deal-teaser";
import { useResourceArt, ResourceIcon, useChestArt, ChestIcon, useBuildingArt, useBaseThemeArt, type ResourceArtMap } from "@/components/resource-icon";
import { TroopDetailModal } from "@/components/troop-detail-modal";
import { BaseThemeShopModal } from "@/components/base-theme-shop-modal";
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
  const [data, setData] = useState<OwnBaseData | null>(null);
  const [tab, setTab]   = useState<"overview" | "res" | "build" | "troops" | "research" | "chest" | "vip" | "settings">("overview");
  const [vipSection, setVipSection] = useState<"status" | "shop" | "tiers">("status");
  const [themeShopOpen, setThemeShopOpen] = useState(false);
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

  const theme = useMemo(() => data?.themes.find((t) => t.id === (data.base?.theme_id ?? "medieval")) ?? null, [data]);
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
          setErr(`Burg-Voraussetzungen fehlen: ${list}`);
        } else if (j.error === "burg_level_too_low") {
          setErr(`Burg-Level zu niedrig: brauchst Lv ${j.needed}, hast Lv ${j.burg_level}.`);
        } else if (j.error === "queue_full") {
          setErr("Bauslots voll — höhere Burg oder VIP erhöht Slots.");
        } else if (j.error === "max_level_reached") {
          setErr("Maximales Level erreicht.");
        } else if (j.error === "not_enough_resources") {
          setErr("Nicht genug Resourcen.");
        } else {
          setErr(j?.error ?? "Fehler");
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
      if (!r.ok || j?.ok === false) setErr(j?.error ?? "Fehler");
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
    if (!r.ok || j?.ok === false) setErr(j?.error ?? "Theme nicht freigeschaltet"); else await reload();
  }

  if (!data || !data.base) {
    return <Backdrop onClose={onClose}><Spinner label="Lade Base …" /></Backdrop>;
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
    wood:  { icon: theme?.resource_icon_wood  ?? "🪵", color: "#a16f32", label: "Holz",  hint: "🌳 Park-km",                  rate: 100 },
    stone: { icon: theme?.resource_icon_stone ?? "🪨", color: "#8B8FA3", label: "Stein", hint: "🏘 Wohngebiet-km",            rate: 100 },
    gold:  { icon: theme?.resource_icon_gold  ?? "🪙", color: "#FFD700", label: "Gold",  hint: "🏬 Stadtkern-km",             rate: 100 },
    mana:  { icon: theme?.resource_icon_mana  ?? "💧", color: "#22D1C3", label: "Mana",  hint: "💧 am Wasser-km",             rate: 100 },
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

  // Effekte aller gebauten Buildings als Zusammenfassung
  const activeEffects = buildings
    .map((b) => {
      const c = catalog.find((x) => x.id === b.building_id);
      if (!c?.effect_key) return null;
      const value = c.effect_per_level * b.level;
      return { name: c.name, emoji: c.emoji, key: c.effect_key, value, level: b.level };
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
                const tid = theme?.id ?? base.theme_id ?? "medieval";
                const a = baseThemeArt[`${tid}_runner_pin`] ?? baseThemeArt[`${tid}_runner_banner`] ?? baseThemeArt[tid];
                const f = "url(#ma365-chroma-black) drop-shadow(0 2px 6px rgba(0,0,0,0.5))";
                if (a?.image_url) return <img src={a.image_url} alt={theme?.name ?? "Base"} style={{ width: 72, height: 72, objectFit: "contain", filter: f }} />;
                if (a?.video_url) return <video src={a.video_url} autoPlay loop muted playsInline style={{ width: 72, height: 72, objectFit: "contain", filter: f }} />;
                return <span>{theme?.pin_emoji ?? "🏰"}</span>;
              })()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-black tracking-widest" style={{ color: accent }}>
                🏰 {base.pin_label ?? "RUNNER-BASE"} · PLZ {base.plz}
              </div>
              <div className="text-xl font-black text-white truncate mt-0.5">
                {theme?.name ?? "Mittelalter"} · Burg Stufe {burgLevel}
              </div>
              <div className="mt-2">
                <div className="flex justify-between text-[9px] text-[#a8b4cf] font-black mb-1">
                  <span>BURG-LEVEL {burgLevel}/25</span>
                  <span>{burgLevel < 25 ? `→ Lv ${burgLevel + 1}` : "MAX"}</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${xpPct}%`, background: `linear-gradient(90deg, ${accent}, ${accent}cc)`, boxShadow: `0 0 8px ${accent}` }} />
                </div>
              </div>
            </div>
            {/* Action-Cluster: Settings + Close, rechts oben */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={() => setTab("settings")}
                title="Base-Einstellungen"
                className="w-8 h-8 rounded-lg bg-black/40 hover:bg-black/60 text-white/80 hover:text-white text-base font-black transition-colors flex items-center justify-center">
                ⚙️
              </button>
              <button onClick={onClose}
                title="Schließen"
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
                  <div className="text-[9px] text-[#a8b4cf]">⭐ VIP-Tickets</div>
                  <div className="text-[11px] font-black text-[#a855f7]">{resources.vip_tickets}</div>
                </div>
              )}
              {(resources.guardian_xp ?? 0) > 0 && (
                <div className="flex-1 rounded-lg bg-[#22D1C3]/15 border border-[#22D1C3]/40 px-2 py-1.5 text-center">
                  <div className="text-[9px] text-[#a8b4cf]">⚔️ Wächter-XP</div>
                  <div className="text-[11px] font-black text-[#22D1C3]">{compactNum(resources.guardian_xp ?? 0)}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tabs (Settings ist als ⚙️ im Header) — kompakte Labels, alle 7 immer sichtbar */}
        <div className="flex border-y border-white/10 text-[11px] font-black tracking-wider bg-[#0F1115]">
          {(["overview","res","build","troops","research","chest","vip"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              title={{overview:"Übersicht", res:"Ressourcen", build:"Bau", troops:"Bande", research:"Forschung", chest:"Truhen", vip:"VIP"}[t]}
              className={`flex-1 min-w-0 py-2.5 px-1 whitespace-nowrap transition-colors ${tab === t ? "text-white" : "text-[#a8b4cf] hover:text-white"}`}
              style={tab === t ? { borderBottom: `2px solid ${accent}`, marginBottom: "-1px", background: `${accent}11` } : undefined}
            >
              {{overview:"📊 Info", res:"💰 RSS", build:"🏗 Bau", troops:"⚔ Bande", research:"🔬 Tech", chest:"🗝 Loot", vip:"⭐ VIP"}[t]}
              {t === "build" && queue.length > 0 && <span className="ml-1 px-1 rounded text-[9px] bg-[#FF6B4A] text-white">{queue.length}</span>}
              {t === "chest" && chests.length > 0 && <span className="ml-1 px-1 rounded text-[9px] bg-[#FFD700] text-[#0F1115]">{chests.length}</span>}
            </button>
          ))}
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
                    icon="🏰" label="Burg-Stufe" value={`${burgLevel}/25`}
                    sub={burgLevel < 25 ? "Bauen via Bau-Tab → Burg" : "Maximum erreicht"}
                    accent={accent} progress={xpPct}
                  />
                  <StatCard
                    icon="🏗️" label="Gebäude" value={`${builtCount}/${totalBuildings}`}
                    sub={maxedCount > 0 ? `${maxedCount} auf MAX-Stufe` : "Noch viel zu bauen"}
                    accent="#4ade80" progress={(builtCount / totalBuildings) * 100}
                  />
                  <StatCard
                    icon="⭐" label="VIP-Tier" value={String(vip.vip_level)}
                    sub={`🔥 ${vip.daily_login_streak} Tage Streak`}
                    accent="#FFD700" progress={vipProgress}
                  />
                  <StatCard
                    icon={<ResourceIcon kind="speed_token" size={40} fallback="⚡" art={resourceArt} />}
                    label="Speed-Tokens" value={resources.speed_tokens.toLocaleString("de-DE")}
                    sub="1 km laufen = 1 Token. Skippt Bauzeit (5 Min/Token)."
                    subInline
                    accent="#22D1C3"
                  />
                </div>

                {/* Resourcen kompakt */}
                <div>
                  <div className="text-[10px] font-black tracking-widest text-[#a8b4cf] mb-2">💰 RESSOURCEN</div>
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
                    <div className="text-[10px] font-black tracking-widest text-[#a8b4cf] mb-2">⏱️ AKTIVITÄTEN</div>
                    <div className="space-y-2">
                      {nextQueueMs !== null && nextQueueMs > 0 && (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-[#FF6B4A]/10 border border-[#FF6B4A]/30">
                          <span className="text-2xl">🔨</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-black text-white">{queue.length} {queue.length === 1 ? "Gebäude" : "Gebäude"} in Bau</div>
                            <div className="text-[10px] text-[#a8b4cf]">
                              Nächstes fertig in {Math.floor(nextQueueMs / 60000)}:{String(Math.floor((nextQueueMs / 1000) % 60)).padStart(2, "0")}
                            </div>
                          </div>
                          <button onClick={() => setTab("build")} className="text-[10px] font-black px-2 py-1 rounded bg-[#FF6B4A]/20 border border-[#FF6B4A]/40 text-[#FF6B4A]">→ Bau</button>
                        </div>
                      )}
                      {nextChestReady && (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-[#FFD700]/10 border border-[#FFD700]/30">
                          <ChestIcon kind={nextChestReady.kind} size={28} fallback="🗝️" art={chestArt} />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-black text-white">{chests.filter((c) => new Date(c.opens_at).getTime() <= now).length} Truhen bereit!</div>
                            <div className="text-[10px] text-[#a8b4cf]">Tippen zum Öffnen.</div>
                          </div>
                          <button onClick={() => setTab("chest")} className="text-[10px] font-black px-2 py-1 rounded bg-[#FFD700]/20 border border-[#FFD700]/40 text-[#FFD700]">→ Öffnen</button>
                        </div>
                      )}
                      {!nextChestReady && nextChestPending && (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-[#1A1D23] border border-white/10">
                          <div className="relative">
                            <ChestIcon kind={nextChestPending.kind} size={28} fallback="📦" art={chestArt} />
                            <span className="absolute -bottom-1 -right-1 text-[10px]">🔒</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-black text-white">{chests.length} Truhen wartend</div>
                            <div className="text-[10px] text-[#a8b4cf]">
                              Nächste in {(() => {
                                const ms = new Date(nextChestPending.opens_at).getTime() - now;
                                const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000);
                                return `${h}h ${m}min`;
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
                    <div className="text-[10px] font-black tracking-widest text-[#a8b4cf] mb-2">⚡ TOP-EFFEKTE</div>
                    <div className="space-y-1">
                      {topEffects.map((e) => {
                        const effectLabel = EFFECT_LABEL[e.key] ?? e.key;
                        const valueStr = e.isAbs
                          ? `+${e.value.toLocaleString("de-DE", { maximumFractionDigits: 1 })}`
                          : `+${Math.round(e.value * 100)}%`;
                        return (
                          <div key={e.key} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1A1D23] border border-white/5 text-[11px]">
                            <span className="text-base">{e.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <div className="font-black text-white truncate">{e.name} <span className="text-[9px] text-[#FFD700]">Lv {e.level}</span></div>
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
                    <div className="text-sm font-black text-white mb-1">Lauf los und sammle Resourcen!</div>
                    <div className="text-[10px] text-[#a8b4cf]">100/km für jede Resource. Dann kannst du dein erstes Gebäude bauen.</div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* RESSOURCEN */}
          {tab === "res" && (
            <div className="space-y-3">
              <IntroBox accent={accent} title="🏰 WAS IST DEINE BASE?">
                Deine persönliche Festung. Jeder Schritt im echten Leben füllt deine Schatzkammer:
                <b className="text-white"> Park-km → Holz</b>,
                <b className="text-white"> Wohngebiet-km → Stein</b>,
                <b className="text-white"> Stadtkern → Gold</b>,
                <b className="text-white"> Wasser → Mana</b>.
                Mit den Resourcen baust du Gebäude, die deinen Wächtern, Resourcen-Drops und Bauzeit dauerhafte Boni geben.
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
                        <span className="text-[#6c7590]">📥 Drop:</span> <span className="font-black text-white">{RES[k].rate}/km</span> · {RES[k].hint}
                      </div>
                      {passivePerHour[k] > 0 && (
                        <div className="text-[9px]" style={{ color: RES[k].color }}>
                          <span className="text-[#6c7590]">⏱ Passiv:</span> <span className="font-black">+{Math.round(passivePerHour[k])}/Std</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-xl bg-[#FFD700]/8 border border-[#FFD700]/30 p-3 flex items-center gap-3">
                <ResourceIcon kind="speed_token" size={72} fallback="⚡" art={resourceArt} />
                <div className="flex-1">
                  <div className="text-[10px] font-black tracking-wider text-[#FFD700]">SPEED-TOKENS</div>
                  <div className="text-lg font-black text-[#FFD700]">{resources.speed_tokens}</div>
                  <div className="text-[9px] text-[#a8b4cf] mt-1">1 km laufen = 1 Token. Skippt Bauzeit (5 Min/Token).</div>
                </div>
              </div>
              {/* RESOURCEN VERDIENEN — alle Wege ohne (oder mit weniger) Laufen */}
              <EarnResourcesSection accent={accent} reload={reload} />

              {activeEffects.length > 0 && (
                <CollapsibleSection
                  storageKey="ma365.base.activeEffects"
                  title={`⚡ AKTIVE EFFEKTE (${activeEffects.length})`}
                  hint="Boni aus deinen gebauten Gebäuden — wirken passiv auf Resourcen-Drops, Bauzeit und Wächter."
                  accent={accent}
                >
                  <div className="space-y-1">
                    {activeEffects.map((e) => {
                      const effectLabel = EFFECT_LABEL[e.key] ?? e.key;
                      const isAbsolute = ABSOLUTE_EFFECTS.has(e.key);
                      const valueStr = isAbsolute
                        ? `+${e.value.toLocaleString("de-DE", { maximumFractionDigits: 1 })}`
                        : `+${Math.round(e.value * 100)}%`;
                      return (
                        <div key={e.key} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1A1D23] border border-white/5 text-[11px]">
                          <span>{e.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-black text-white truncate">
                              {e.name} <span className="text-[9px] text-[#FFD700]">Lv {e.level}</span>
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
              <IntroBox accent={accent} title="🏗️ WIE FUNKTIONIERT BAUEN?">
                Jedes Gebäude gibt einen <b className="text-white">passiven Bonus</b> auf alle Wächter, Resourcen oder Bauzeit.
                Bauen kostet Resourcen + Zeit. Mit <b className="text-white">⚡ Speed-Tokens</b> (1 km laufen = 1 Token) skippst du je 5 Min Bauzeit.
                Höhere Stufen brauchen exponentiell mehr Resourcen, geben aber stärkere Boni.
              </IntroBox>
              {isCatalogPreview && (
                <div className="rounded-xl border border-[#FFD700]/40 bg-[#FFD700]/5 px-3 py-2 text-[11px] text-[#FFD700] font-black">
                  ⚠ Vorschau-Modus · DB-Migration ausstehend. Bauen wird aktiv sobald die Server-Migration gepusht ist.
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
                          <div className="text-sm font-black">{cat?.name ?? q.building_id} → Lv {q.target_level}</div>
                          <div className="text-[10px] text-[#a8b4cf]">{ready ? <span className="text-[#4ade80] font-black">FERTIG …</span> : `Noch ${min}:${String(restSec).padStart(2,"0")}`}</div>
                        </div>
                        {!ready && resources.speed_tokens > 0 && (
                          <button onClick={() => speedUp(q.id, Math.min(resources.speed_tokens, Math.ceil(sec/60/5)))} disabled={busy===q.id}
                            className="text-[10px] font-black px-2 py-1 rounded-lg bg-[#22D1C3]/15 border border-[#22D1C3]/40 text-[#22D1C3]">⚡ Skip</button>
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
                  const meta = CATEGORY_META[g.category] ?? { label: g.category.toUpperCase(), emoji: "🏗️" };
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
                          const effectAtNext = cat.effect_per_level * targetLvl;
                          const buildTime = cat.base_buildtime_minutes * (lvl === 0 ? 1 : Math.ceil(mult));
                          return (
                            <div key={cat.id} className="rounded-lg bg-[#1A1D23] border border-white/10 p-2 flex flex-col gap-1.5" style={{ minHeight: 0 }}>
                              {/* Header-Zeile: Icon + Name + Level kompakt */}
                              <div className="flex items-center gap-2">
                                <BuildingThumb id={cat.id} fallback={cat.emoji} art={buildingArt} size={28} />
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-black text-white truncate">{cat.name}</div>
                                  <div className="text-[9px] text-[#a8b4cf]">Lv {lvl}/{cat.max_level} {cat.effect_key && !isMax && (() => {
                                    const isAbs = ABSOLUTE_EFFECTS.has(cat.effect_key);
                                    const v = isAbs
                                      ? `+${effectAtNext.toLocaleString("de-DE", { maximumFractionDigits: 1 })}`
                                      : `+${Math.round(effectAtNext * 100)}%`;
                                    return <span style={{ color: accent }} title={`Pro Stufe: ${isAbs ? `+${cat.effect_per_level}` : `+${Math.round(cat.effect_per_level * 100)}%`}`}>· {v} gesamt auf Lv {targetLvl}</span>;
                                  })()}</div>
                                </div>
                              </div>

                              {/* Beschreibung 1 Zeile */}
                              <div className="text-[10px] text-[#a8b4cf] leading-snug line-clamp-1">{cat.description}</div>

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
                                  Bauzeit ⏱{buildTime}m
                                </span>
                              )}

                              {/* CTA */}
                              {isMax ? (
                                <div className="text-[10px] text-[#FFD700] font-black text-center py-1 rounded bg-[#FFD700]/10">★ MAX</div>
                              ) : inQueue ? (
                                <div className="text-[10px] text-[#FF6B4A] font-black text-center py-1 rounded bg-[#FF6B4A]/10">🔨 In Bau</div>
                              ) : lvlLocked ? (
                                <div className="text-[10px] text-[#6c7590] text-center py-1 rounded bg-white/5">🔒 Base Lv {cat.required_base_level} nötig</div>
                              ) : (
                                <button onClick={() => build(cat.id)} disabled={!canPay || busy === cat.id || isCatalogPreview}
                                  className="text-[11px] font-black py-1.5 rounded-lg disabled:opacity-40"
                                  style={{ background: `${accent}26`, border: `1px solid ${accent}66`, color: accent }}>
                                  {isCatalogPreview ? "🔒 Vorschau" : lvl === 0 ? "🏗️ Bauen" : `⬆️ Lv ${targetLvl}`}
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
              { k: "silver", emoji: "🥈", label: "Silber", tint: "#d8d8d8" },
              { k: "gold",   emoji: "🥇", label: "Gold",   tint: "#FFD700" },
              { k: "event",  emoji: "🎉", label: "Event",  tint: "#FF2D78" },
            ];
            const byKind = (k: Chest["kind"]) => chests.filter((c) => c.kind === k);
            const nextReady = (k: Chest["kind"]) => byKind(k).find((c) => new Date(c.opens_at).getTime() <= now);
            const nextChest = (k: Chest["kind"]) => byKind(k).slice().sort((a, b) => new Date(a.opens_at).getTime() - new Date(b.opens_at).getTime())[0];

            return (
              <div className="space-y-3">
                <IntroBox accent={accent} title="🗝️ WO KOMMEN TRUHEN HER?">
                  Truhen droppen aus <b className="text-white">Arena-Kämpfen</b>, <b className="text-white">Boss-Raids</b>, <b className="text-white">VIP-Daily-Rewards</b> und Crew-Aktivitäten.
                  <span className="block mt-1">🥈 <b>Silber</b>: 24h Wartezeit, häufige Items + Resourcen.</span>
                  <span className="block">🥇 <b>Gold</b>: 24h, seltene Items, Wächter-Splitter, große Resource-Drops.</span>
                  <span className="block mt-1 text-[#6c7590]">Pity-Garantie: alle 10 Truhen mind. 1 Episch, alle 30 mind. 1 Legendär.</span>
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
                          <div className="text-[9px] font-black text-[#4ade80]">{ready} bereit</div>
                        )}
                        {nextR ? (
                          <button
                            onClick={() => openChest(nextR.id)}
                            disabled={busy === nextR.id}
                            className="w-full text-[10px] font-black px-2 py-1.5 rounded-lg disabled:opacity-40"
                            style={{ background: tint, color: "#0F1115" }}
                          >
                            {busy === nextR.id ? "…" : "Öffnen"}
                          </button>
                        ) : upcoming ? (
                          <div className="w-full text-[9px] font-black text-center py-1 rounded-lg bg-white/5 text-[#a8b4cf]">
                            {hr > 0 ? `${hr}h ${restMin}m` : `${restMin}m`}
                          </div>
                        ) : (
                          <div className="w-full text-[9px] text-center py-1 text-[#6c7590]">leer</div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Detail-Liste aller Truhen (wenn vorhanden) */}
                {chests.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-black tracking-widest text-[#a8b4cf]">DEINE TRUHEN</div>
                    {chests.map((c) => {
                      const ms = new Date(c.opens_at).getTime() - now;
                      const ready = ms <= 0;
                      const min = Math.max(0, Math.floor(ms / 60000));
                      const hr  = Math.floor(min / 60); const restMin = min % 60;
                      return (
                        <div key={c.id} className="flex items-center gap-2 p-2 rounded-xl bg-[#1A1D23] border border-white/10">
                          <ChestIcon kind={c.kind} size={36} fallback={c.kind === "gold" ? "🥇" : c.kind === "silver" ? "🥈" : "🎉"} art={chestArt} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-black capitalize">{c.kind}-Truhe</div>
                            <div className="text-[10px] text-[#a8b4cf]">{ready ? "Bereit zum Öffnen" : `Öffnet in ${hr}h ${restMin}min`}</div>
                          </div>
                          <button onClick={() => openChest(c.id)} disabled={!ready || busy === c.id}
                            className="text-[10px] font-black px-3 py-1.5 rounded-lg disabled:opacity-40"
                            style={{ background: `${accent}26`, border: `1px solid ${accent}66`, color: accent }}>
                            {ready ? "Öffnen" : "🔒"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {chests.length === 0 && (
                  <div className="text-center text-[#6c7590] text-xs py-2">
                    Noch keine Truhen — kämpfe in der Arena, geh laufen oder check VIP-Daily!
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
                {(["status","shop","tiers"] as const).map((s) => (
                  <button key={s} onClick={() => setVipSection(s)}
                    className={`flex-1 py-2 transition-colors ${vipSection === s ? "bg-[#FFD700]/20 text-[#FFD700]" : "bg-transparent text-[#a8b4cf] hover:text-white"}`}>
                    {{ status: "📊 Status", shop: "🛒 Shop", tiers: "📈 Stufen" }[s]}
                  </button>
                ))}
              </div>

              {vipSection === "status" && <>
              <IntroBox accent="#FFD700" title="⭐ WAS IST VIP?">
                VIP-Punkte sammelst du durch <b className="text-white">tägliche Logins</b>, <b className="text-white">erfüllte Quests</b>, <b className="text-white">Premium-Käufe</b> und <b className="text-white">Events</b>.
                Höheres VIP-Tier = mehr tägliche <b>🥈/🥇 Truhen</b>, <b>+% Resourcen-Drops</b>, <b>−% Bauzeit</b> und exklusive Themes.
                Maximal Tier 15.
              </IntroBox>
              <div className="rounded-xl bg-gradient-to-br from-[#FFD700]/20 to-[#FFD700]/5 border border-[#FFD700]/40 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-black tracking-widest text-[#FFD700]">VIP-TIER</div>
                    <div className="text-4xl font-black text-[#FFD700] mt-1">{vip.vip_level}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-[#a8b4cf]">🔥 STREAK</div>
                    <div className="text-2xl font-black text-[#FF6B4A]">{vip.daily_login_streak}</div>
                  </div>
                </div>
                {nextTier && (
                  <div className="mt-3">
                    <div className="flex justify-between text-[9px] text-[#a8b4cf] font-black mb-1">
                      <span>{vip.vip_points.toLocaleString("de-DE")} / {nextTier.required_points.toLocaleString("de-DE")} Pkt</span>
                      <span>→ Lv {nextTier.vip_level}</span>
                    </div>
                    <div className="h-2 rounded-full bg-black/40 overflow-hidden">
                      <div className="h-full rounded-full transition-all bg-gradient-to-r from-[#FFD700] to-[#FF6B4A]" style={{ width: `${vipProgress}%` }} />
                    </div>
                  </div>
                )}
              </div>

              {currentTier && currentTier.vip_level > 0 && (
                <div className="rounded-xl bg-[#1A1D23] border border-white/10 p-3">
                  <div className="text-[10px] font-black tracking-widest text-[#a8b4cf] mb-2">🎁 DEINE TÄGLICHEN BENEFITS</div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <Benefit label={<><ChestIcon kind="silver" size={16} fallback="🥈" art={chestArt} />Silber-Truhen</>} value={`${currentTier.daily_chest_silver}/Tag`} />
                    <Benefit label={<><ChestIcon kind="gold"   size={16} fallback="🥇" art={chestArt} />Gold-Truhen</>} value={`${currentTier.daily_chest_gold}/Tag`} />
                    <Benefit label="📦 Resourcen" value={`+${Math.round(currentTier.resource_bonus_pct*100)}%`} />
                    <Benefit label="⏱ Bauzeit" value={`-${Math.round(currentTier.buildtime_bonus_pct*100)}%`} />
                    {(currentTier.extra_build_slots ?? 0) > 0 && (
                      <Benefit label="🔨 Bau-Slots" value={`+${currentTier.extra_build_slots}`} />
                    )}
                    {(currentTier.extra_research_slots ?? 0) > 0 && (
                      <Benefit label="🔬 Forsch.-Slots" value={`+${currentTier.extra_research_slots}`} />
                    )}
                    {(currentTier.training_speed_pct ?? 0) > 0 && (
                      <Benefit label="⚔️ Training" value={`+${Math.round((currentTier.training_speed_pct ?? 0)*100)}%`} />
                    )}
                    {(currentTier.research_speed_pct ?? 0) > 0 && (
                      <Benefit label="📚 Forschung" value={`+${Math.round((currentTier.research_speed_pct ?? 0)*100)}%`} />
                    )}
                    {(currentTier.gather_speed_pct ?? 0) > 0 && (
                      <Benefit label="🌾 Sammeln" value={`+${Math.round((currentTier.gather_speed_pct ?? 0)*100)}%`} />
                    )}
                    {(currentTier.march_speed_pct ?? 0) > 0 && (
                      <Benefit label="🐎 March-Speed" value={`+${Math.round((currentTier.march_speed_pct ?? 0)*100)}%`} />
                    )}
                    {(currentTier.troop_atk_pct ?? 0) > 0 && (
                      <Benefit label="⚔ Truppen-ATK" value={`+${Math.round((currentTier.troop_atk_pct ?? 0)*100)}%`} />
                    )}
                    {(currentTier.troop_def_pct ?? 0) > 0 && (
                      <Benefit label="🛡 Truppen-DEF" value={`+${Math.round((currentTier.troop_def_pct ?? 0)*100)}%`} />
                    )}
                    {(currentTier.troop_hp_pct ?? 0) > 0 && (
                      <Benefit label="❤ Truppen-HP" value={`+${Math.round((currentTier.troop_hp_pct ?? 0)*100)}%`} />
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
              <IntroBox accent={accent} title="⚙️ BASE-EINSTELLUNGEN">
                Stell ein, <b className="text-white">wer deine Base auf der Karte sieht</b>, gib ihr einen <b className="text-white">eigenen Namen</b> und wähle einen <b className="text-white">Theme-Skin</b>.
                Themes sind rein kosmetisch — Pin-Icon, Modal-Farbe und Resource-Icons ändern sich, Stats bleiben gleich.
              </IntroBox>

              <BaseLabelEditor
                accent={accent}
                currentLabel={base.pin_label}
                onSaved={() => void reload()}
              />

              <div>
                <div className="text-[10px] font-black tracking-widest text-[#a8b4cf] mb-2">SICHTBARKEIT</div>
                <div className="grid grid-cols-2 gap-1">
                  {(["public","crew"] as const).map((v) => (
                    <button key={v} onClick={() => setVisibility(v)}
                      disabled={base.visibility === "private"}
                      className={`py-2 text-[10px] font-black rounded-lg ${base.visibility === v ? "text-white" : "text-[#a8b4cf] bg-white/5"} ${base.visibility === "private" ? "opacity-40 cursor-not-allowed" : ""}`}
                      style={base.visibility === v ? { background: `${accent}26`, border: `1px solid ${accent}66` } : undefined}>
                      {v === "public" ? "🌍 Alle" : "⚔️ Crew"}
                    </button>
                  ))}
                </div>
                <div className="text-[9px] text-[#6c7590] mt-1">
                  {base.visibility === "private"
                    ? "🛡️ Schutzschild aktiv — Sichtbarkeit gesperrt bis Schild abläuft."
                    : "Bestimmt, wer deinen Base-Pin auf der Karte sieht."}
                </div>
              </div>

              <BaseShieldPanel accent={accent} reload={reload} />

              <BaseRelocatePanel accent={accent} reload={reload} tokenCount={(base as { relocate_tokens?: number }).relocate_tokens ?? 0} />

              <div>
                <div className="text-[10px] font-black tracking-widest text-[#a8b4cf] mb-2">THEME</div>
                <button onClick={() => setThemeShopOpen(true)}
                  className="w-full p-3 rounded-xl flex items-center gap-3 text-left transition hover:scale-[1.01]"
                  style={{
                    background: "linear-gradient(135deg, rgba(255,215,0,0.18) 0%, rgba(168,85,247,0.18) 60%, rgba(34,209,195,0.16) 100%)",
                    border: "1.5px solid rgba(255,215,0,0.45)",
                    boxShadow: "0 0 14px rgba(255,215,0,0.25), inset 0 1px 0 rgba(255,255,255,0.15)",
                  }}>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FFD700] via-[#a855f7] to-[#22D1C3] flex items-center justify-center text-2xl shadow-lg shrink-0">🏰</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[9px] font-black tracking-[2px] text-[#FFD700]">SAAL DER ORDNUNG</div>
                    <div className="text-[13px] font-black text-white truncate">Base-Themes ansehen →</div>
                    <div className="text-[10px] text-white/70 mt-0.5">Aktiv: <b>{themes.find((t) => t.id === base.theme_id)?.name ?? "—"}</b> · {themes.length} verfügbar</div>
                  </div>
                  <span className="text-white/60 text-xl">›</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {themeShopOpen && (
        <BaseThemeShopModal onClose={() => setThemeShopOpen(false)} onChanged={() => void reload()} />
      )}
    </Backdrop>
  );
}

// ───────────────────────── FOREIGN BASE ─────────────────────────────

function ForeignRunnerBase({ baseId, onClose }: { baseId: string; onClose: () => void }) {
  const [data, setData] = useState<ForeignBaseData | null>(null);
  useEffect(() => {
    void (async () => {
      const r = await fetch(`/api/base/${baseId}`, { cache: "no-store" });
      setData(await r.json() as ForeignBaseData);
    })();
  }, [baseId]);

  if (!data) return <Backdrop onClose={onClose}><Spinner label="Lade Base …" /></Backdrop>;
  if (!data.ok || !data.base) {
    return <Backdrop onClose={onClose}>
      <div className="bg-[#0F1115] border border-white/10 rounded-2xl p-6 text-center max-w-sm">
        <div className="text-3xl mb-2">🔒</div>
        <div className="text-sm font-black text-white">Diese Base ist privat</div>
        <button onClick={onClose} className="mt-4 px-4 py-2 rounded-lg bg-white/10 text-white text-xs font-black">Schließen</button>
      </div>
    </Backdrop>;
  }

  const owner = data.owner?.display_name ?? "Runner";
  const crew = data.crew;
  const accent = crew?.color || "#22D1C3";
  return (
    <Backdrop onClose={onClose}>
      <ModalShell accent={accent} pinEmoji="🏰" title={data.base.pin_label ?? `${owner}'s Base`}
        subtitle={`Stufe ${data.base.level} · PLZ ${data.base.plz}`} onClose={onClose}>
        <div className="p-4 space-y-3">
          {/* Owner + Crew-Karte */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#1A1D23] border border-white/10">
            {data.owner?.avatar_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={data.owner.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover border border-white/15" />
              : <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-base">👤</div>}
            <div className="flex-1 min-w-0">
              <div className="text-[9px] font-black tracking-widest text-[#a8b4cf]">RUNNER</div>
              <div className="text-sm font-black text-white truncate">{owner}</div>
              {crew ? (
                <div className="text-[10px] mt-0.5 truncate" style={{ color: crew.color || "#a8b4cf" }}>
                  ⚔️ {crew.name}
                </div>
              ) : (
                <div className="text-[10px] text-[#6c7590] mt-0.5">Solo · keine Crew</div>
              )}
            </div>
          </div>

          <div className="text-[10px] font-black tracking-widest text-[#a8b4cf]">GEBÄUDE</div>
          <div className="grid grid-cols-2 gap-2">
            {(data.buildings ?? []).map((b) => (
              <div key={b.building_id} className="flex items-center gap-2 p-2 rounded-lg bg-[#1A1D23] border border-white/10">
                <span className="text-2xl">{b.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black truncate">{b.name}</div>
                  <div className="text-[9px] text-[#a8b4cf]">Lv {b.level}</div>
                </div>
              </div>
            ))}
            {(data.buildings ?? []).length === 0 && <div className="col-span-2 text-center text-[#6c7590] text-xs py-4">Keine Gebäude.</div>}
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
  return (
    <Backdrop onClose={onClose}>
      <ModalShell accent="#22D1C3" pinEmoji="⚔️" title="Crew-Base" subtitle="Detail-View kommt bald" onClose={onClose}>
        <div className="p-6 text-center text-[#a8b4cf] text-sm">Crew-Base-Modal folgt im nächsten Patch.</div>
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
    if (trimmed && (trimmed.length < 3 || trimmed.length > 10)) { setErr("3-10 Buchstaben."); return; }
    if (trimmed && !/^[A-Za-zÄÖÜäöüß]+$/.test(trimmed)) { setErr("Nur Buchstaben."); return; }
    if (Date.now() - savedAt < 10000) { setErr("Bitte warte 10s zwischen Änderungen."); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/base/label", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: trimmed }),
      });
      const j = await r.json();
      if (!r.ok || j?.error) {
        setErr(j?.error === "label_bad_chars" ? "Nur Buchstaben."
             : j?.error === "label_too_short" ? "Mindestens 3 Buchstaben."
             : j?.error === "label_too_long"  ? "Maximal 10 Buchstaben."
             : j?.error === "label_taken"     ? "Name bereits vergeben."
             : j?.error ?? "Fehler");
      } else {
        setSavedAt(Date.now());
        onSaved();
      }
    } finally { setBusy(false); }
  }

  const canSave = !busy && val !== (currentLabel ?? "") && (val === "" || available === true);

  return (
    <div>
      <div className="text-[10px] font-black tracking-widest text-[#a8b4cf] mb-2">📝 BASE-NAME</div>
      <div className="rounded-xl bg-[#1A1D23] border border-white/10 p-3">
        <div className="flex gap-2">
          <input value={val} onChange={(e) => setVal(e.target.value)} maxLength={10}
            placeholder="z.B. Drachenfels"
            className="flex-1 px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-sm text-white placeholder-[#6c7590] focus:outline-none focus:border-white/30"
          />
          <button onClick={save} disabled={!canSave}
            className="px-3 py-2 rounded-lg text-xs font-black disabled:opacity-40"
            style={{ background: `${accent}26`, border: `1px solid ${accent}66`, color: accent }}>
            {busy ? "…" : "Speichern"}
          </button>
        </div>
        <div className="flex items-center justify-between mt-2 text-[9px]">
          <span className="text-[#6c7590]">3-10 Buchstaben · einzigartig · wird moderiert</span>
          {err && <span className="text-[#FF2D78] font-black">{err}</span>}
          {!err && checking && <span className="text-[#a8b4cf]">prüfe …</span>}
          {!err && !checking && available === true && <span className="text-[#4ade80] font-black">✓ frei</span>}
          {!err && !checking && available === false && <span className="text-[#FF2D78] font-black">✗ vergeben</span>}
          {!err && Date.now() - savedAt < 3000 && <span className="text-[#4ade80] font-black">✓ gespeichert</span>}
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

  if (!data) return <div className="text-[11px] text-[#a8b4cf]">Lade …</div>;
  const ownedMap = new Map(data.owned.map((o) => [o.troop_id, o.count]));
  const classes: Array<{ id: string; label: string; building: string }> = [
    { id: "infantry",  label: "🛡️ Türsteher",    building: "Bar" },
    { id: "cavalry",   label: "🏍️ Kuriere",      building: "Garage" },
    { id: "marksman",  label: "🎯 Schleuderer",  building: "Gym" },
    { id: "siege",     label: "🔨 Brecher",      building: "Werkhof" },
  ];

  return (
    <div className="space-y-3">
      <IntroBox accent={accent} title="⚔️ TRUPPEN AUSBILDEN">
        Heuere deine Crew in <b className="text-white">Bar / Garage / Gym / Werkhof</b> an.
        <b className="text-white">T1</b> ist sofort verfügbar. <b className="text-white">T2-T5</b> müssen erst erforscht werden — siehe <b className="text-white">🔬 FORSCHUNG-Tab → Militär</b>. T5-Forschungen dauern mehrere Tage.
        <span className="block mt-1 text-[#6c7590]">Trainings-Cap pro Auftrag = Gebäude-Level × 10.</span>
      </IntroBox>

      {data.queue.length > 0 && (
        <div className="rounded-lg p-2 bg-[#FF6B4A]/10 border border-[#FF6B4A]/40 text-[11px]">
          <div className="font-black text-[#FF6B4A] mb-1">⏱ IM TRAINING</div>
          {data.queue.map((q) => {
            const t = data.catalog.find((x) => x.id === q.troop_id);
            const remain = Math.max(0, Math.ceil((new Date(q.ends_at).getTime() - Date.now()) / 60000));
            return (
              <div key={q.id} className="flex justify-between text-[10px] text-white">
                <span>{t?.emoji} {t?.name} × {q.count}</span>
                <span className="text-[#a8b4cf]">{remain} min</span>
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
                {troops.map((t) => {
                  const have = ownedMap.get(t.id) ?? 0;
                  return (
                    <button key={t.id} onClick={() => setSelectedTroopId(t.id)}
                      className="w-full text-left rounded p-2 flex items-center gap-2 bg-[#0F1115]/60 border border-white/5 hover:bg-[#0F1115]/80 hover:border-white/15 transition">
                      <span className="text-2xl">{t.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-black text-white truncate">
                          {t.name} <span className="text-[9px] text-[#a8b4cf] font-bold ml-1">T{t.tier}{t.tier > 1 ? " · 🔬 Forschung" : ""}</span>
                        </div>
                        <div className="text-[9px] text-[#a8b4cf]">⚔️ {t.base_atk} · 🛡 {t.base_def} · ❤️ {t.base_hp} · ⏱ {t.train_time_seconds}s</div>
                        <div className="text-[9px] text-[#a8b4cf] flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-0.5"><ResourceIcon kind="wood"  size={11} fallback="🪵" art={resourceArt} />{t.cost_wood}</span>·
                          <span className="inline-flex items-center gap-0.5"><ResourceIcon kind="stone" size={11} fallback="🪨" art={resourceArt} />{t.cost_stone}</span>·
                          <span className="inline-flex items-center gap-0.5"><ResourceIcon kind="gold"  size={11} fallback="🪙" art={resourceArt} />{t.cost_gold}</span>·
                          <span className="inline-flex items-center gap-0.5"><ResourceIcon kind="mana"  size={11} fallback="💧" art={resourceArt} />{t.cost_mana}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="text-[10px] text-[#FFD700] font-black">×{have}</div>
                        <div className="text-[9px] text-[#a8b4cf]">tippen ›</div>
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
      if (j.ok) { setMsg(`✓ Forschung gestartet (${j.minutes} min)`); await Promise.all([load(), reload()]); }
      else if (j.error === "prereq_missing") setMsg("Vorgänger-Forschung fehlt.");
      else if (j.error === "burg_level_too_low") setMsg("Burg muss höher sein.");
      else if (j.error === "queue_full") setMsg("Forschungs-Slots voll (mehr ab VIP 4 / 7).");
      else if (j.error === "not_enough_resources") setMsg("Nicht genug Resourcen.");
      else setMsg(j.error ?? "Fehler");
    } finally { setBusy(null); }
  }

  if (!data) return <div className="text-[11px] text-[#a8b4cf]">Lade …</div>;
  const progressMap = new Map(data.progress.map((p) => [p.research_id, p.level]));
  const branches: Array<{ id: string; label: string; color: string }> = [
    { id: "economy",        label: "💰 Wirtschaft",     color: "#FFD700" },
    { id: "military",       label: "⚔️ Militär",        color: "#FF2D78" },
    { id: "infrastructure", label: "🏗️ Infrastruktur",  color: "#22D1C3" },
    { id: "social",         label: "🤝 Sozial",         color: "#a855f7" },
  ];

  return (
    <div className="space-y-3">
      <IntroBox accent={accent} title="🔬 FORSCHUNG">
        Forschungen geben permanente <b className="text-white">%-Boni</b> (Resourcen, Truppen, Bauzeit).
        Höhere Tiers brauchen Vorgänger-Forschung + entsprechendes Burg-Level.
        <span className="block mt-1 text-[#6c7590]">Forschungs-Slots: 1 (VIP 4 → 2 · VIP 7 → 3).</span>
      </IntroBox>

      {data.queue.length > 0 && (
        <div className="rounded-lg p-2 bg-[#22D1C3]/10 border border-[#22D1C3]/40 text-[11px]">
          <div className="font-black text-[#22D1C3] mb-1">⏱ IN FORSCHUNG</div>
          {data.queue.map((q) => {
            const d = data.definitions.find((x) => x.id === q.research_id);
            const remain = Math.max(0, Math.ceil((new Date(q.ends_at).getTime() - Date.now()) / 60000));
            return (
              <div key={q.id} className="flex justify-between text-[10px] text-white">
                <span>{d?.emoji} {d?.name} → Lv {q.target_level}</span>
                <span className="text-[#a8b4cf]">{remain} min</span>
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
                  <div className="text-[9px] font-black tracking-widest text-[#6c7590] px-1">TIER {tier}</div>
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
                            {d.name} <span className="text-[9px] text-[#a8b4cf] ml-1">T{d.tier} · Lv {lvl}/{d.max_level} · Burg {d.required_burg_level}+</span>
                          </div>
                          <div className="text-[9px] text-[#a8b4cf]">{d.description}</div>
                          {locked && <div className="text-[9px] text-[#FF6B4A]">🔒 Vorgänger nötig</div>}
                        </div>
                        <button onClick={() => start(d.id)} disabled={busy === d.id || locked || maxed}
                          className="text-[10px] font-black px-2 py-1 rounded disabled:opacity-40"
                          style={{ background: `${b.color}26`, border: `1px solid ${b.color}66`, color: b.color }}>
                          {maxed ? "MAX" : busy === d.id ? "…" : `→ Lv ${lvl + 1}`}
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
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function relocate() {
    if (tokenCount < 1) {
      setMsg("Du brauchst einen Verlege-Token (Drop aus Truhen).");
      return;
    }
    if (!window.confirm("Base verlegen? Klicke nach OK auf den neuen Punkt auf der Karte.")) return;
    setBusy(true); setMsg(null);
    try {
      // Trigger Place-Mode via globaler Event — der Map-Layer fängt den nächsten Klick.
      window.dispatchEvent(new CustomEvent("ma365:relocate-base-mode"));
      setMsg("Tippe auf der Karte den neuen Standort.");
    } finally { setBusy(false); }
  }

  return (
    <div className="rounded-xl p-3" style={{ background: "rgba(34,209,195,0.06)", border: "1px solid rgba(34,209,195,0.3)" }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base">📍</span>
        <div className="text-[10px] font-black tracking-widest" style={{ color: "#22D1C3" }}>BASE VERLEGEN</div>
      </div>
      <div className="text-[10px] text-[#a8b4cf] mb-2">
        Verlege deine Base auf einen neuen Standort. Kostet <b style={{ color: "#22D1C3" }}>1 Verlege-Token</b>.
        Tokens droppen aus Gold/Epic-Truhen.
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-white font-black">Tokens: {tokenCount}</span>
        <button onClick={relocate} disabled={busy || tokenCount < 1}
          className="text-[10px] font-black px-3 py-1.5 rounded disabled:opacity-40"
          style={{ background: `${accent}26`, border: `1px solid ${accent}66`, color: accent }}>
          {busy ? "…" : "Standort wählen"}
        </button>
      </div>
      {msg && <div className="text-[10px] text-center font-black mt-1" style={{ color: msg.startsWith("✓") || msg.startsWith("Tippe") ? "#4ade80" : "#FF2D78" }}>{msg}</div>}
      <button onClick={() => void reload()} className="hidden" />
    </div>
  );
}

function BaseShieldPanel({ accent, reload }: { accent: string; reload: () => Promise<void> }) {
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
      if (j.ok) { setMsg("✓ Schild aktiviert!"); await Promise.all([load(), reload()]); }
      else if (j.error === "not_enough_gold") setMsg("Nicht genug 🪙 (500 nötig).");
      else if (j.error === "cooldown_active") setMsg(`Cooldown aktiv (${Math.ceil((j.cooldown_remaining_seconds ?? 0) / 3600)}h).`);
      else if (j.error === "already_active") setMsg("Schild läuft bereits.");
      else setMsg(j.error ?? "Fehler");
    } finally { setBusy(false); }
  }
  async function deactivate() {
    if (!window.confirm("Schild jetzt beenden? Die Base wird wieder sichtbar und angreifbar.")) return;
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
        <div className="text-[10px] font-black tracking-widest" style={{ color: "#FF6B4A" }}>SCHUTZSCHILD</div>
      </div>
      {status.active ? (
        <>
          <div className="text-[11px] text-white font-black">Aktiv · läuft ab in {fmt(status.remaining_seconds ?? 0)}</div>
          <div className="text-[9px] text-[#a8b4cf] mt-0.5 mb-2">Base ist während dieser Zeit unsichtbar und unangreifbar.</div>
          <button onClick={deactivate} disabled={busy}
            className="w-full px-3 py-1.5 rounded-lg text-[10px] font-black bg-white/5 text-[#a8b4cf] disabled:opacity-40">
            {busy ? "…" : "Schild jetzt beenden"}
          </button>
        </>
      ) : cdActive ? (
        <>
          <div className="text-[11px] text-white font-black">Cooldown · nächster Einsatz in {fmt(status.cooldown_remaining_seconds ?? 0)}</div>
          <div className="text-[9px] text-[#a8b4cf] mt-0.5">Schutzschild kann max. 1× pro 7 Tage aktiviert werden.</div>
        </>
      ) : (
        <>
          <div className="text-[10px] text-[#a8b4cf] mb-2 inline-flex items-center gap-1 flex-wrap">
            <span>{status.duration_hours ?? 24}h unsichtbar + unangreifbar. Kostet</span>
            <b style={{ color: "#FFD700" }} className="inline-flex items-center gap-0.5">
              {status.cost_gold ?? 500}<ResourceIcon kind="gold" size={12} fallback="🪙" art={resourceArt} />
            </b>
            <span>. Cooldown: 7 Tage.</span>
          </div>
          <button onClick={activate} disabled={busy}
            className="w-full px-3 py-2 rounded-lg text-[11px] font-black disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
            style={{ background: "linear-gradient(135deg, #FF6B4A, #FF6B4Acc)", color: "#0F1115" }}>
            🛡️ {busy ? "Aktiviere…" : `Schild aktivieren · ${status.cost_gold ?? 500}`}
            {!busy && <ResourceIcon kind="gold" size={14} fallback="🪙" art={resourceArt} />}
          </button>
        </>
      )}
      {msg && <div className="text-[10px] text-center font-black mt-1" style={{ color: msg.startsWith("✓") ? "#4ade80" : "#FF2D78" }}>{msg}</div>}
    </div>
  );
}

function ReportLabelButton({ baseId, crewBaseId, kind }: { baseId?: string; crewBaseId?: string; kind: "runner" | "crew" }) {
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
    return <div className="text-[10px] text-[#4ade80] text-center py-2">✓ Danke — wird vom Team geprüft.</div>;
  }
  if (done === "duplicate") {
    return <div className="text-[10px] text-[#a8b4cf] text-center py-2">Du hast diese Base bereits gemeldet (max 1× pro 24h).</div>;
  }
  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full text-[10px] text-[#6c7590] hover:text-[#FF2D78] py-2 transition-colors">
        🚩 Namen melden
      </button>
    );
  }
  return (
    <div className="rounded-xl border border-[#FF2D78]/40 bg-[#FF2D78]/5 p-3 space-y-2">
      <div className="text-[11px] font-black text-[#FF2D78]">🚩 NAMEN MELDEN</div>
      <div className="text-[10px] text-[#a8b4cf]">Warum ist dieser Name unangemessen? (optional)</div>
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={200}
        placeholder="z.B. Beleidigung, Werbung, Hass-Symbole …"
        className="w-full px-2 py-1.5 rounded bg-black/40 border border-white/10 text-[11px] text-white placeholder-[#6c7590] focus:outline-none"
      />
      <div className="flex gap-2">
        <button onClick={() => setOpen(false)} className="flex-1 text-[10px] font-black py-1.5 rounded bg-white/5 text-[#a8b4cf]">Abbrechen</button>
        <button onClick={submit} disabled={busy} className="flex-1 text-[10px] font-black py-1.5 rounded bg-[#FF2D78]/20 border border-[#FF2D78]/50 text-[#FF2D78] disabled:opacity-40">
          {busy ? "…" : "Melden"}
        </button>
      </div>
      {done === "error" && <div className="text-[10px] text-[#FF2D78]">Fehler beim Senden.</div>}
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
  const [expanded, setExpanded] = useState<number | null>(currentLevel + 1);
  const tiers = thresholds.filter((t) => t.vip_level > 0);

  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-black text-[#a8b4cf] tracking-widest mb-2">ALLE 15 STUFEN — TIPP FÜR DETAILS</div>
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
                {reached ? "✓ " : ""}Lv{t.vip_level}
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
        vip_level_too_low: "VIP-Stufe zu niedrig",
        daily_limit_reached: "Tageslimit erreicht",
        not_enough_gems: "Nicht genug Edelsteine",
      };
      setMsg(`❌ ${errMap[r?.error ?? ""] ?? r?.error ?? error?.message ?? "Fehler"}`);
    } else {
      setMsg(`✅ +${r.reward_amount} ${r.reward_kind}`);
      await Promise.all([load(), reload()]);
    }
    setTimeout(() => setMsg(null), 2800);
  }

  return (
    <div className="rounded-xl bg-[#1A1D23] border border-[#FFD700]/30 overflow-hidden">
      {!defaultOpen && (
        <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-3 py-3 text-[13px] font-black text-[#FFD700]">
          <span>🛒 VIP-SHOP <span className="text-[10px] text-[#a8b4cf] font-normal ml-1">(Rabatt-Angebote)</span></span>
          <span>{open ? "▾" : "▸"}</span>
        </button>
      )}
      {open && (
        <div className="p-2 space-y-2">
          {!data && <div className="text-[11px] text-[#a8b4cf] text-center py-3">Lade Angebote …</div>}
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
                    {locked ? `🔒 Ab VIP ${o.required_vip}` : `${remaining}/${o.daily_limit} verfügbar heute`}
                  </div>
                </div>
                <button onClick={() => buy(o.id)} disabled={disabled}
                  className="text-[11px] font-black px-3 py-2 rounded-lg disabled:opacity-40 shrink-0"
                  style={{ background: disabled ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg, #FFD700, #FF6B4A)", color: disabled ? "#6c7590" : "#0F1115" }}>
                  {busy === o.id ? "…" : soldOut ? "✓ Aus" : (
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
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const sb = createClient();
  const chestArt = useChestArt();
  const resourceArt = useResourceArt();

  type GiftItem = { node: React.ReactNode; label: string; n: number };
  const items: GiftItem[] = [
    { node: <ChestIcon kind="silver" size={20} fallback="🥈" art={chestArt} />, label: "Silber-Truhe", n: tier.daily_chest_silver },
    { node: <ChestIcon kind="gold"   size={20} fallback="🥇" art={chestArt} />, label: "Gold-Truhe",   n: tier.daily_chest_gold },
    { node: <ResourceIcon kind="speed_token" size={20} fallback="⚡" art={resourceArt} />, label: "Speed-Token", n: tier.daily_speed_tokens ?? 0 },
    { node: <span className="text-[16px]">🎟</span>, label: "VIP-Ticket", n: tier.daily_vip_tickets ?? 0 },
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
      setMsg(`❌ ${res?.error ?? error?.message ?? "Fehler"}`);
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
          <div className="text-[10px] font-black tracking-widest text-[#FFD700]">🎁 TÄGLICHE VIP-BELOHNUNG</div>
          <div className="text-[10px] text-[#a8b4cf] mt-0.5">
            {alreadyClaimed ? "Heute schon abgeholt — kommt morgen wieder." : `Stufe ${tier.vip_level} · einmal pro Tag`}
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
          {busy ? "…" : alreadyClaimed ? "✓ Abgeholt" : "Abholen"}
        </button>
      </div>
      {msg && <div className="mt-2 text-[10px] text-center text-white">{msg}</div>}
    </div>
  );
}

function VipTicketRedeem({ available, reload }: { available: number; reload: () => Promise<void> }) {
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
      setMsg(`❌ ${res?.error ?? error?.message ?? "Fehler"}`);
    } else {
      setMsg(`✅ +${res.points_added ?? 0} VIP-Punkte`);
      await reload();
    }
    setTimeout(() => setMsg(null), 2600);
  }

  return (
    <div className="rounded-xl bg-gradient-to-br from-[#FFD700]/15 to-transparent border border-[#FFD700]/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-[10px] font-black tracking-widest text-[#FFD700]">🎟 VIP-TICKETS EINLÖSEN</div>
          <div className="text-[10px] text-[#a8b4cf] mt-0.5">1 Ticket = 50 VIP-Punkte · {available} verfügbar</div>
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
          className="px-2 h-8 rounded-lg bg-white/5 text-[#a8b4cf] text-[10px] font-black disabled:opacity-30">MAX</button>
        <button onClick={redeem} disabled={busy || count < 1 || count > available}
          className="ml-auto px-3 h-8 rounded-lg bg-gradient-to-r from-[#FFD700] to-[#FF6B4A] text-[#0F1115] font-black text-xs disabled:opacity-40">
          {busy ? "…" : `+${count * 50} Pkt`}
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
  const a = art[`building_${id}`];
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
  { id: "wald_pfad",      name: "Wald-Pfad",     emoji: "🌲", description: "Mehr Holz pro km gelaufenem Park-Weg.",                    category: "production", scope: "solo", max_level: 10, base_cost_wood:  50, base_cost_stone: 100, base_cost_gold:  0, base_cost_mana:  0, base_buildtime_minutes:  5, effect_key: "wood_per_km_pct",   effect_per_level: 0.05, required_base_level: 1, sort: 2 },
  { id: "waechter_halle", name: "Wächter-Halle", emoji: "⚔️", description: "Aktive Wächter erhalten mehr XP nach jedem Lauf.",         category: "combat",     scope: "solo", max_level: 10, base_cost_wood: 150, base_cost_stone: 150, base_cost_gold: 20, base_cost_mana: 10, base_buildtime_minutes: 10, effect_key: "guardian_xp_pct",   effect_per_level: 0.03, required_base_level: 2, sort: 3 },
  { id: "laufturm",       name: "Lauftürme",     emoji: "🗼", description: "Erhöht die sichtbare Map-Reichweite + bessere Drops.",     category: "utility",    scope: "solo", max_level: 10, base_cost_wood: 200, base_cost_stone: 100, base_cost_gold: 30, base_cost_mana:  0, base_buildtime_minutes: 10, effect_key: "map_range_km",      effect_per_level: 0.30, required_base_level: 2, sort: 4 },
  // ── Starter (00082) ──
  { id: "lagerhalle",     name: "Lauf-Lager",    emoji: "📦", description: "Zusätzliches Lager für seltene Drops + Wächter-Inventar.", category: "storage",    scope: "solo", max_level: 10, base_cost_wood: 200, base_cost_stone: 200, base_cost_gold: 50, base_cost_mana:  0, base_buildtime_minutes: 15, effect_key: "rare_storage_pct",  effect_per_level: 0.08, required_base_level: 1, sort: 5 },
  { id: "schmiede",       name: "Schmiede",      emoji: "⚒️", description: "Schaltet Item-Crafting + Ausrüstungs-Upgrades frei.",      category: "utility",    scope: "solo", max_level: 10, base_cost_wood: 150, base_cost_stone: 250, base_cost_gold: 80, base_cost_mana: 20, base_buildtime_minutes: 20, effect_key: "craft_speed_pct",   effect_per_level: 0.05, required_base_level: 3, sort: 6 },
  { id: "gasthaus",       name: "Wegerast",      emoji: "🍻", description: "Tägliche Trank-Drops + Gold-Bonus.",                       category: "production", scope: "solo", max_level: 10, base_cost_wood: 250, base_cost_stone: 100, base_cost_gold: 50, base_cost_mana:  0, base_buildtime_minutes: 15, effect_key: "gold_per_km_pct",   effect_per_level: 0.05, required_base_level: 2, sort: 7 },
  { id: "wachturm",       name: "Posten-Turm",   emoji: "🏯", description: "Verteidigt deine Base gegen Crew-Angriffe.",               category: "combat",     scope: "solo", max_level: 10, base_cost_wood: 300, base_cost_stone: 300, base_cost_gold: 100, base_cost_mana: 50, base_buildtime_minutes: 25, effect_key: "base_defense_pct",  effect_per_level: 0.05, required_base_level: 4, sort: 8 },
  // ── Expansion (00085) — Produktion ──
  { id: "saegewerk",      name: "Reisig-Bündler",emoji: "🪓", description: "Passive Holz-Produktion pro Stunde — auch ohne Laufen.",   category: "production", scope: "solo", max_level: 10, base_cost_wood: 100, base_cost_stone:  50, base_cost_gold: 10, base_cost_mana:  0, base_buildtime_minutes: 10, effect_key: "wood_per_hour",     effect_per_level: 5.0,  required_base_level: 1, sort: 20 },
  { id: "steinbruch",     name: "Pflaster-Brecher",emoji: "⛏️", description: "Passive Stein-Produktion pro Stunde.",                     category: "production", scope: "solo", max_level: 10, base_cost_wood:  50, base_cost_stone: 100, base_cost_gold: 10, base_cost_mana:  0, base_buildtime_minutes: 10, effect_key: "stone_per_hour",    effect_per_level: 5.0,  required_base_level: 1, sort: 21 },
  { id: "goldmine",       name: "Zoll-Schacht",  emoji: "💰", description: "Passive Gold-Produktion pro Stunde.",                      category: "production", scope: "solo", max_level: 10, base_cost_wood: 100, base_cost_stone: 100, base_cost_gold: 20, base_cost_mana:  0, base_buildtime_minutes: 15, effect_key: "gold_per_hour",     effect_per_level: 4.0,  required_base_level: 2, sort: 22 },
  { id: "mana_quelle",    name: "Quellbrunnen",  emoji: "🌊", description: "Passive Mana-Produktion pro Stunde.",                      category: "production", scope: "solo", max_level: 10, base_cost_wood: 100, base_cost_stone: 100, base_cost_gold: 30, base_cost_mana: 20, base_buildtime_minutes: 15, effect_key: "mana_per_hour",     effect_per_level: 3.0,  required_base_level: 2, sort: 23 },
  // ── Lager ──
  { id: "tresorraum",     name: "Geheim-Tresor", emoji: "🏛️", description: "Resourcen geschützt vor Crew-Angriffen.",                  category: "storage",    scope: "solo", max_level: 10, base_cost_wood: 300, base_cost_stone: 300, base_cost_gold: 50, base_cost_mana:  0, base_buildtime_minutes: 20, effect_key: "safe_storage_pct",  effect_per_level: 0.10, required_base_level: 3, sort: 30 },
  { id: "kornkammer",     name: "Vorrats-Schober",emoji: "🌾", description: "Erhöht das Holz-Lager-Cap zusätzlich.",                    category: "storage",    scope: "solo", max_level: 10, base_cost_wood: 150, base_cost_stone:  80, base_cost_gold:  0, base_cost_mana:  0, base_buildtime_minutes: 10, effect_key: "wood_storage_pct",  effect_per_level: 0.20, required_base_level: 1, sort: 31 },
  { id: "mauerwerk",      name: "Stein-Speicher",emoji: "🧱", description: "Erhöht das Stein-Lager-Cap zusätzlich.",                   category: "storage",    scope: "solo", max_level: 10, base_cost_wood:  80, base_cost_stone: 150, base_cost_gold:  0, base_cost_mana:  0, base_buildtime_minutes: 10, effect_key: "stone_storage_pct", effect_per_level: 0.20, required_base_level: 1, sort: 32 },
  // ── Kampf ──
  { id: "hospital",       name: "Heil-Stube",    emoji: "🏥", description: "Wächter regenerieren schneller nach Niederlagen.",          category: "combat",     scope: "solo", max_level: 10, base_cost_wood: 200, base_cost_stone: 150, base_cost_gold: 50, base_cost_mana: 20, base_buildtime_minutes: 20, effect_key: "heal_speed_pct",    effect_per_level: 0.10, required_base_level: 3, sort: 40 },
  { id: "trainingsplatz", name: "Übungs-Hof",    emoji: "🥋", description: "Aktive Wächter erhalten Bonus-XP pro Kampf.",              category: "combat",     scope: "solo", max_level: 10, base_cost_wood: 150, base_cost_stone: 150, base_cost_gold: 30, base_cost_mana: 10, base_buildtime_minutes: 15, effect_key: "arena_xp_pct",      effect_per_level: 0.05, required_base_level: 2, sort: 41 },
  { id: "ballistenwerk",  name: "Wurfgeschütz-Werk",emoji: "🎯", description: "Schaltet Belagerungs-Truppen für Crew-Wars frei.",     category: "combat",     scope: "solo", max_level: 10, base_cost_wood: 300, base_cost_stone: 400, base_cost_gold: 100, base_cost_mana: 30, base_buildtime_minutes: 30, effect_key: "siege_strength_pct",effect_per_level: 0.05, required_base_level: 5, sort: 42 },
  { id: "schwertkampflager",name: "Klingen-Kaserne",emoji: "⚔️", description: "Trainiert Schwertkämpfer schneller + günstiger.",  category: "combat",     scope: "solo", max_level: 10, base_cost_wood: 200, base_cost_stone: 250, base_cost_gold: 50, base_cost_mana: 10, base_buildtime_minutes: 20, effect_key: "melee_train_speed_pct", effect_per_level: 0.08, required_base_level: 3, sort: 43 },
  { id: "bogenschuetzenstand",name: "Pfeil-Kaserne",emoji: "🏹", description: "Trainiert Bogenschützen schneller + günstiger.",   category: "combat",     scope: "solo", max_level: 10, base_cost_wood: 250, base_cost_stone: 150, base_cost_gold: 50, base_cost_mana: 10, base_buildtime_minutes: 20, effect_key: "ranged_train_speed_pct",effect_per_level: 0.08, required_base_level: 3, sort: 44 },
  // ── Utility ──
  { id: "akademie",       name: "Gelehrten-Halle",emoji: "📚", description: "Schaltet Forschung frei: dauerhafte Boni.",                 category: "utility",    scope: "solo", max_level: 10, base_cost_wood: 250, base_cost_stone: 200, base_cost_gold: 80, base_cost_mana: 40, base_buildtime_minutes: 30, effect_key: "research_speed_pct",effect_per_level: 0.08, required_base_level: 4, sort: 50 },
  { id: "kloster",        name: "Mond-Kapelle",  emoji: "⛪", description: "Mana-Boost auf Magier-Klassen + tägliche Mana-Truhe.",       category: "utility",    scope: "solo", max_level: 10, base_cost_wood: 150, base_cost_stone: 200, base_cost_gold: 60, base_cost_mana: 100,base_buildtime_minutes: 25, effect_key: "mana_per_km_pct",   effect_per_level: 0.05, required_base_level: 3, sort: 51 },
  { id: "augurstein",     name: "Sternendeuter-Stein",emoji: "🔮", description: "Zeigt Saison-Events + kommende Bosse als Vorhersage.",      category: "utility",    scope: "solo", max_level: 10, base_cost_wood: 100, base_cost_stone: 100, base_cost_gold: 50, base_cost_mana: 200,base_buildtime_minutes: 20, effect_key: "event_preview_days",effect_per_level: 1.0,  required_base_level: 4, sort: 52 },
  { id: "schwarzes_brett",name: "Quest-Tafel",   emoji: "📋", description: "Tägliche Quests mit zusätzlichen Belohnungen.",             category: "utility",    scope: "solo", max_level: 10, base_cost_wood: 100, base_cost_stone:  50, base_cost_gold: 20, base_cost_mana:  0, base_buildtime_minutes: 10, effect_key: "daily_quest_count", effect_per_level: 0.5,  required_base_level: 2, sort: 53 },
  { id: "halbling_haus",  name: "Bau-Kontor",    emoji: "🏚️", description: "Zusätzliche Bauwarteschlangen-Slots (parallel bauen).",     category: "utility",    scope: "solo", max_level: 10, base_cost_wood: 200, base_cost_stone: 200, base_cost_gold: 80, base_cost_mana: 20, base_buildtime_minutes: 25, effect_key: "build_queue_slots", effect_per_level: 0.5,  required_base_level: 3, sort: 54 },
  { id: "basar",          name: "Tausch-Stand",  emoji: "🛒", description: "Tausch-Markt: Resourcen 1:1 zwischen Wood/Stone/Gold/Mana.",category: "utility",    scope: "solo", max_level: 10, base_cost_wood: 200, base_cost_stone: 200, base_cost_gold: 50, base_cost_mana: 20, base_buildtime_minutes: 20, effect_key: "market_fee_pct",    effect_per_level:-0.02, required_base_level: 3, sort: 60 },
  { id: "shop",           name: "Kosmetik-Stand",emoji: "🏪", description: "Tägliche Kosmetik-Drops (Marker-Skins, Pin-Themes).",       category: "cosmetic",   scope: "solo", max_level: 10, base_cost_wood: 150, base_cost_stone: 100, base_cost_gold: 100, base_cost_mana: 50, base_buildtime_minutes: 20, effect_key: "cosmetic_drop_chance",effect_per_level: 0.05, required_base_level: 4, sort: 61 },
  { id: "brunnen",        name: "Brunnen",       emoji: "⛲", description: "Reine Kosmetik. Erhöht Base-Schönheit (Visitor-Boost).",    category: "cosmetic",   scope: "solo", max_level:  5, base_cost_wood: 200, base_cost_stone:  50, base_cost_gold: 30, base_cost_mana: 10, base_buildtime_minutes: 15, effect_key: "visitor_attract_pct",effect_per_level: 0.10, required_base_level: 2, sort: 62 },
  { id: "statue",         name: "Heldenstatue",  emoji: "🗿", description: "Reine Kosmetik. Zeigt deinen aktiven Wächter.",              category: "cosmetic",   scope: "solo", max_level:  5, base_cost_wood:  50, base_cost_stone: 200, base_cost_gold: 50, base_cost_mana: 10, base_buildtime_minutes: 20, effect_key: "visitor_attract_pct",effect_per_level: 0.05, required_base_level: 3, sort: 63 },
];

// Mapping: effect_key → was der Bonus tatsächlich macht (für Aktive-Effekte-Liste)
const EFFECT_LABEL: Record<string, string> = {
  storage_cap_pct:        "Lager-Kapazität",
  wood_per_km_pct:        "Holz pro Park-km",
  stone_per_km_pct:       "Stein pro Wohngebiet-km",
  gold_per_km_pct:        "Gold pro Stadtkern-km",
  mana_per_km_pct:        "Mana pro Wasser-km",
  guardian_xp_pct:        "Wächter-XP nach Lauf",
  map_range_km:           "Map-Reichweite (km)",
  rare_storage_pct:       "Selten-Item-Lager",
  craft_speed_pct:        "Crafting-Geschwindigkeit",
  base_defense_pct:       "Base-Verteidigung",
  wood_per_hour:          "Holz/Stunde (passiv)",
  stone_per_hour:         "Stein/Stunde (passiv)",
  gold_per_hour:          "Gold/Stunde (passiv)",
  mana_per_hour:          "Mana/Stunde (passiv)",
  safe_storage_pct:       "Geschützte Resourcen",
  wood_storage_pct:       "Holz-Lager-Cap",
  stone_storage_pct:      "Stein-Lager-Cap",
  heal_speed_pct:         "Heil-Geschwindigkeit",
  arena_xp_pct:           "Arena-XP",
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
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-black tracking-widest text-[#a8b4cf] mt-3 mb-1">🎁 RESSOURCEN VERDIENEN</div>

      {/* A) Ad-Rewards */}
      <CollapsibleSection storageKey="ma365.earn.ads"
        title="🎬 VIDEO SCHAUEN"
        hint="Schau ein kurzes Video → +200 jeder Resource + 1 Speed-Token. Bis zu 5× pro Tag."
        accent={accent}>
        <AdRewardCard accent={accent} reload={reload} />
      </CollapsibleSection>

      {/* B) Daily Quests */}
      <CollapsibleSection storageKey="ma365.earn.quests"
        title="🎯 TAGES-QUESTS"
        hint="4 zufällige Tasks pro Tag — die meisten ohne Laufen erledigbar."
        accent={accent}>
        <QuestsCard accent={accent} reload={reload} />
      </CollapsibleSection>

      {/* C) Crew-Donations */}
      <CollapsibleSection storageKey="ma365.earn.crew"
        title="🤝 CREW-SPENDE"
        hint="Resourcen mit Crew-Mitgliedern teilen. Max 5.000 pro Tag empfangen."
        accent={accent}>
        <CrewDonateCard accent={accent} reload={reload} />
      </CollapsibleSection>

      {/* D) Steps */}
      <CollapsibleSection storageKey="ma365.earn.steps"
        title="👣 SCHRITTE / SCHÜBE"
        hint="Schritte oder Rollstuhl-Schübe vom Tag eintragen — 50 jeder Resource pro km."
        accent={accent}>
        <StepsCard accent={accent} reload={reload} />
      </CollapsibleSection>

      {/* E) Packages */}
      <CollapsibleSection storageKey="ma365.earn.packages"
        title="💎 RESOURCE-PAKETE"
        hint="Echtgeld-Boost — schneller voran ohne Wartezeit (kein Pay-to-Win, nur Komfort)."
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
        setMsg(adResult.native ? "Video abgebrochen — kein Reward." : "Abgebrochen.");
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
        const tokens = rw && rw.speed_tokens > 0 ? ` + ${rw.speed_tokens}⚡` : "";
        setMsg(`✓ +${rw?.wood ?? 0} jede Resource${tokens} erhalten!`);
        await Promise.all([loadStatus(), reload()]);
      } else if (j.error === "daily_already_claimed") {
        setMsg("Tagesbonus heute schon kassiert — morgen wieder!");
        await loadStatus();
      } else if (j.error === "cooldown_active") {
        setMsg(`Cooldown aktiv (${Math.ceil((j.cooldown_remaining ?? 0) / 60)} min).`);
        await loadStatus();
      } else if (j.error === "cooldown_limit_reached") {
        setMsg("Tageslimit für Bonus-Videos erreicht.");
        await loadStatus();
      } else {
        setMsg(j.error ?? "Fehler");
      }
    } finally { setBusy(null); }
  }

  if (!status) return <div className="text-[11px] text-[#a8b4cf]">Lade …</div>;

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
          ? "Video lädt …"
          : dailyDone
            ? "✓ Tagesbonus erhalten"
            : `🎬 Tagesvideo → +${dailyReward.wood} jede Resource${dailyReward.speed_tokens > 0 ? ` + ${dailyReward.speed_tokens}⚡` : ""}`}
      </button>
      <div className="text-[10px] text-[#a8b4cf] text-center">
        {status.daily_used}/{status.daily_limit} Tagesvideo heute
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
          ? "Video lädt …"
          : cdLimitReached
            ? "✓ Bonus-Videos heute aufgebraucht"
            : cdActive
              ? `⏱ Cooldown ${Math.floor(cdRemain / 60)}:${String(cdRemain % 60).padStart(2, "0")}`
              : `🎬 Bonus-Video → +${cdReward.wood} jede Resource`}
      </button>
      <div className="text-[10px] text-[#a8b4cf] text-center">
        {status.cooldown_used}/{status.cooldown_limit} Bonus-Videos heute · {Math.round(status.cooldown_seconds / 60)} min Cooldown
      </div>

      {msg && <div className="text-[11px] text-center font-black" style={{ color: msg.startsWith("✓") ? "#4ade80" : "#FF2D78" }}>{msg}</div>}
    </div>
  );
}

function QuestsCard({ accent, reload }: { accent: string; reload: () => Promise<void> }) {
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

  if (!data) return <div className="text-[11px] text-[#a8b4cf]">Lade …</div>;
  const defMap = new Map(data.definitions.map((d) => [d.id, d]));
  return (
    <div className="space-y-2">
      {data.quests.length === 0 && <div className="text-[11px] text-[#a8b4cf]">Heute keine Quests aktiv.</div>}
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
                <span>Belohnung:</span>
                {rewards.map((x) => (
                  <span key={x.k} className="inline-flex items-center gap-0.5">
                    <ResourceIcon kind={x.k} size={11} fallback={fbMap[x.k]} art={resourceArt} />{x.v}
                  </span>
                ))}
              </div>
            </div>
            {q.claimed ? <span className="text-[10px] text-[#4ade80] font-black px-2">✓</span>
              : done ? <button onClick={() => claim(q.id)} disabled={busy === q.id} className="text-[10px] font-black px-2 py-1 rounded disabled:opacity-40" style={{ background: `${accent}26`, border: `1px solid ${accent}66`, color: accent }}>{busy === q.id ? "…" : "Holen"}</button>
              : <span className="text-[10px] text-[#6c7590] px-2">⏳</span>}
          </div>
        );
      })}
    </div>
  );
}

type CrewMate = { user_id: string; display_name: string };

function CrewDonateCard({ accent, reload }: { accent: string; reload: () => Promise<void> }) {
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
      if (j.ok) { setMsg(`✓ ${amount} ${resType} an ${mates?.find((m) => m.user_id === target)?.display_name ?? "?"} gesendet`); await reload(); }
      else if (j.error === "recipient_daily_limit") setMsg("Empfänger hat Tageslimit erreicht.");
      else if (j.error === "insufficient") setMsg("Du hast nicht genug.");
      else if (j.error === "not_same_crew") setMsg("Beide müssen in derselben Crew sein.");
      else setMsg(j.error ?? "Fehler");
    } finally { setBusy(false); }
  }

  if (!mates) return <div className="text-[11px] text-[#a8b4cf]">Lade Crew …</div>;
  if (mates.length === 0) return <div className="text-[11px] text-[#a8b4cf]">Du bist in keiner Crew oder hast keine Mit-Mitglieder.</div>;

  return (
    <div className="space-y-2">
      <select value={target} onChange={(e) => setTarget(e.target.value)} className="w-full px-2 py-2 rounded bg-black/40 border border-white/10 text-sm text-white">
        <option value="">— Empfänger wählen —</option>
        {mates.map((m) => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}
      </select>
      <div className="flex gap-1">
        {(["wood","stone","gold","mana"] as const).map((k) => {
          const labels = { wood: "Holz", stone: "Stein", gold: "Gold", mana: "Mana" } as const;
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
        className="w-full px-3 py-2 rounded bg-black/40 border border-white/10 text-sm text-white" placeholder="Menge (1-1000)" />
      <button onClick={send} disabled={busy || !target || amount <= 0}
        className="w-full py-2 rounded-lg text-sm font-black disabled:opacity-40"
        style={{ background: `${accent}26`, border: `1px solid ${accent}66`, color: accent }}>
        {busy ? "…" : "Senden"}
      </button>
      {msg && <div className="text-[10px] text-center" style={{ color: msg.startsWith("✓") ? "#4ade80" : "#FF2D78" }}>{msg}</div>}
    </div>
  );
}

function StepsCard({ accent, reload }: { accent: string; reload: () => Promise<void> }) {
  const [steps, setSteps] = useState<number>(2000);
  const [source, setSource] = useState<"manual" | "wheelchair" | "healthkit" | "googlefit">("manual");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function record() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/base/record-steps", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ steps, source }) });
      const j = await r.json() as { ok?: boolean; error?: string; km?: number; reward?: { each: number; speed_tokens: number } };
      if (j.ok) { setMsg(`✓ ${j.km} km · +${j.reward?.each} jede Resource · ⚡ ${j.reward?.speed_tokens}`); await reload(); }
      else if (j.error === "daily_limit") setMsg("Tageslimit erreicht (50.000 Schritte).");
      else setMsg(j.error ?? "Fehler");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {([["manual","🚶 Schritte"],["wheelchair","♿ Schübe"],["healthkit","🍎 HealthKit"],["googlefit","🤖 GoogleFit"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setSource(k)}
            className={`flex-1 py-1.5 rounded text-[10px] font-black ${source === k ? "text-[#0F1115]" : "bg-white/5 text-[#a8b4cf]"}`}
            style={source === k ? { background: accent } : undefined}>
            {label}
          </button>
        ))}
      </div>
      <input type="number" min={1} max={50000} value={steps} onChange={(e) => setSteps(Math.max(1, Math.min(50000, Number(e.target.value) || 0)))}
        className="w-full px-3 py-2 rounded bg-black/40 border border-white/10 text-sm text-white" />
      <div className="text-[9px] text-[#6c7590]">
        ≈ {(steps / (source === "wheelchair" ? 1000 : 1300)).toFixed(2)} km · +{Math.round((steps / (source === "wheelchair" ? 1000 : 1300)) * 50)} jede Resource
      </div>
      <button onClick={record} disabled={busy || steps <= 0}
        className="w-full py-2 rounded-lg text-sm font-black disabled:opacity-40"
        style={{ background: `${accent}26`, border: `1px solid ${accent}66`, color: accent }}>
        {busy ? "…" : "Eintragen"}
      </button>
      {msg && <div className="text-[10px] text-center" style={{ color: msg.startsWith("✓") ? "#4ade80" : "#FF2D78" }}>{msg}</div>}
    </div>
  );
}

function PackagesCard({ accent }: { accent: string }) {
  const [pkgs, setPkgs] = useState<ResourcePackage[] | null>(null);
  const resourceArt = useResourceArt();
  useEffect(() => {
    void (async () => {
      const r = await fetch("/api/base/packages");
      const j = await r.json() as { packages?: ResourcePackage[] };
      setPkgs(j.packages ?? []);
    })();
  }, []);

  if (!pkgs) return <div className="text-[11px] text-[#a8b4cf]">Lade …</div>;
  if (pkgs.length === 0) return <div className="text-[11px] text-[#a8b4cf]">Keine Pakete verfügbar.</div>;

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
              <span className="inline-flex items-center gap-0.5"><ResourceIcon kind="wood"  size={12} fallback="🪵" art={resourceArt} />{p.reward_wood.toLocaleString("de-DE")}</span>·
              <span className="inline-flex items-center gap-0.5"><ResourceIcon kind="stone" size={12} fallback="🪨" art={resourceArt} />{p.reward_stone.toLocaleString("de-DE")}</span>·
              <span className="inline-flex items-center gap-0.5"><ResourceIcon kind="gold"  size={12} fallback="🪙" art={resourceArt} />{p.reward_gold.toLocaleString("de-DE")}</span>·
              <span className="inline-flex items-center gap-0.5"><ResourceIcon kind="mana"  size={12} fallback="💧" art={resourceArt} />{p.reward_mana.toLocaleString("de-DE")}</span>
              {p.reward_speed_tokens > 0 && <span className="inline-flex items-center gap-0.5">·<ResourceIcon kind="speed_token" size={12} fallback="⚡" art={resourceArt} />{p.reward_speed_tokens}</span>}
            </div>
          </div>
          <a href="/shop" className="text-xs font-black px-3 py-2 rounded-lg whitespace-nowrap"
            style={{ background: accent, color: "#0F1115" }}>
            {(p.price_cents / 100).toFixed(2).replace(".", ",")}€
          </a>
        </div>
      ))}
      <div className="text-[9px] text-[#6c7590] text-center">Käufe laufen über den Shop. Resourcen werden nach Zahlungsbestätigung sofort gutgeschrieben.</div>
    </div>
  );
}

