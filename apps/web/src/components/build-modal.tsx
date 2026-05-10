"use client";

/**
 * BuildModal — fokussiertes Bauen mit zwei Ebenen:
 *  1) Deck: Kategorien-Tab + Karten-Grid (Artwork + Stufe + Status). Klick → Detail.
 *  2) BuildingDetail: CoD-Style Pro-Gebäude-Modal mit Hero-Artwork, Stat-Vergleich,
 *     Anforderungen und SOFORT/VERBESSERN Buttons.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  useResourceArt, useBuildingArt, ResourceIcon,
  type ResourceArtMap,
} from "@/components/resource-icon";
import { LevelTableModal, type LevelRow } from "@/components/level-table-modal";
import { useRewardFx, getClickPoint } from "@/components/reward-fx";
import { Modal, Z } from "@/components/ui";
import { fetchBaseMe, invalidateBaseMe } from "@/lib/base-me-cache";

type Building = {
  id: string;
  building_id: string; level: number;
  status: "idle" | "building" | "upgrading";
  last_collected_at: string | null;
  created_at: string;
};
type Catalog = {
  id: string; name: string; emoji: string; description: string;
  category: string; max_level: number;
  base_cost_wood: number; base_cost_stone: number; base_cost_gold: number; base_cost_mana: number;
  base_buildtime_minutes: number;
  effect_key: string | null; effect_per_level: number;
  required_base_level: number; sort: number;
  /** Optional: explizite Per-Level-Werte (CoD-Style Kurve). Index 0 = Lv 1. */
  level_stats?: Array<{ rate: number; ansehen: number }> | null;
};
type QueueItem = {
  id: string; building_id: string; action: "build" | "upgrade"; target_level: number;
  started_at: string; ends_at: string; finished: boolean;
};
type Resources = { wood: number; stone: number; gold: number; mana: number; speed_tokens: number };
type BaseRow = { id: string; level: number; theme_id: string };

type BaseMe = {
  ok: boolean;
  base: BaseRow | null;
  buildings: Building[];
  queue: QueueItem[];
  resources: Resources & { vip_tickets?: number; guardian_xp?: number };
  catalog: Catalog[];
};

const ACCENT = "#22D1C3";
const PINK = "#FF2D78";
const ORANGE = "#FF6B4A";
const GOLD = "#FFD700";
const GREEN = "#4ade80";
const TEXT = "#F0F0F0";
const MUTED = "#a8b4cf";

// Freundlicher Modal-Look: warmer Slate-Verlauf + ambient Glow.
// Statt kalt schwarzgrau (vorher #0F1115/#1A1D23) jetzt blau-violetter Slate.
const MODAL_BG = "linear-gradient(165deg, #2A2F4A 0%, #1E2238 50%, #14182A 100%)";
const CARD_BG_DIM = "linear-gradient(155deg, rgba(255,255,255,0.04), rgba(40,44,68,0.85))";
const CARD_BG_ACTIVE = (color: string) => `linear-gradient(155deg, ${color}33, rgba(40,44,68,0.85))`;

type CategoryKey = "production" | "storage" | "combat" | "utility" | "cosmetic";
const CATEGORIES: Array<{ key: CategoryKey; label: string; emoji: string; color: string }> = [
  { key: "production", label: "Produktion", emoji: "🏭", color: GREEN },
  { key: "storage",    label: "Lager",      emoji: "📦", color: GOLD },
  { key: "combat",     label: "Kampf",      emoji: "⚔️", color: ORANGE },
  { key: "utility",    label: "Ausbau",     emoji: "🛠️", color: ACCENT },
  { key: "cosmetic",   label: "Deko",       emoji: "✨", color: PINK },
];

const ABSOLUTE_EFFECTS = new Set([
  "map_range_km", "wood_per_hour", "stone_per_hour", "gold_per_hour", "mana_per_hour",
  "event_preview_days", "daily_quest_count", "build_queue_slots",
]);

const PRODUCTION_KEYS: Record<string, "wood" | "stone" | "gold" | "mana"> = {
  wood_per_hour:  "wood",
  stone_per_hour: "stone",
  gold_per_hour:  "gold",
  mana_per_hour:  "mana",
};

type Pending = {
  resource: "wood" | "stone" | "gold" | "mana";
  amount: number;
  cap: number;
  rate: number;
  capped: boolean;
};

/** Pending-Berechnung für 1 Production-Building. Spiegelt _collect_one_building. */
function computePending(
  bb: Building,
  cat: Catalog,
  nowMs: number,
): Pending | null {
  const resource = PRODUCTION_KEYS[cat.effect_key ?? ""];
  if (!resource) return null;
  const { rate, cap } = rateForLevel(cat, bb.level);
  const anchor = bb.last_collected_at ?? bb.created_at;
  const elapsedH = Math.max(0, (nowMs - new Date(anchor).getTime()) / 3600000);
  const raw = elapsedH * rate;
  const amount = Math.floor(Math.min(raw, cap));
  return { resource, amount, cap, rate, capped: raw >= cap };
}

function compactNum(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 1_000_000) return (n / 1000).toFixed(n < 10_000 ? 1 : 0) + "k";
  return (n / 1_000_000).toFixed(1) + "M";
}
function fmtTime(sec: number): string {
  if (sec <= 0) return "00:00";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (d > 0) return `${d}T ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
function fmtBuildTime(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const restMin = min % 60;
  if (h < 24) return restMin > 0 ? `${h}h ${restMin}m` : `${h}h`;
  const d = Math.floor(h / 24);
  const restH = h % 24;
  return restH > 0 ? `${d}T ${restH}h` : `${d}T`;
}

/**
 * Liefert rate/cap/capMult für eine Stufe.
 * Bevorzugt `level_stats[level-1]` (CoD-Style Kurve mit 10h-Cap),
 * fällt zurück auf `effect_per_level × level` mit 6h-Cap (Legacy).
 *
 * Single Source of Truth — damit Stat-Vergleich, Stufen-Tabelle und Pending-Box
 * konsistent sind.
 */
function rateForLevel(cat: Catalog, level: number): { rate: number; cap: number; capMult: number } {
  if (cat.level_stats && cat.level_stats[level - 1]) {
    const rate = cat.level_stats[level - 1].rate;
    return { rate, cap: 10 * rate, capMult: 10 };
  }
  const rate = cat.effect_per_level * level;
  return { rate, cap: 6 * rate, capMult: 6 };
}

/** Optional: Ansehen für eine Stufe (nur mit level_stats). */
function ansehenForLevel(cat: Catalog, level: number): number | null {
  if (cat.level_stats && cat.level_stats[level - 1]) {
    return cat.level_stats[level - 1].ansehen ?? null;
  }
  return null;
}

function fmtEffect(key: string, value: number): string {
  if (ABSOLUTE_EFFECTS.has(key)) {
    return `+${value.toLocaleString("de-DE", { maximumFractionDigits: 1 })}`;
  }
  return `+${Math.round(value * 100)}%`;
}
function fmtEffectAbs(key: string, value: number): string {
  if (ABSOLUTE_EFFECTS.has(key)) {
    return value.toLocaleString("de-DE", { maximumFractionDigits: 1 });
  }
  return `${Math.round(value * 100)}%`;
}

const RES_FALLBACK: Record<keyof Resources, { icon: string; color: string }> = {
  wood:          { icon: "⚙️", color: ORANGE },
  stone:         { icon: "🔩", color: "#8B8FA3" },
  gold:          { icon: "💸", color: GOLD },
  mana:          { icon: "📡", color: ACCENT },
  speed_tokens:  { icon: "⚡", color: GOLD },
};

export function BuildModal({
  onClose,
  initialBuildingId,
}: {
  onClose: () => void;
  /** Wenn gesetzt: Detail-Sheet für dieses Gebäude öffnet automatisch nach Load
   *  (für Iso-Scene-Click-Through). */
  initialBuildingId?: string;
}) {
  const t = useTranslations("BaseModal");
  const tBld = useTranslations("Buildings");
  const tEff = useTranslations("Effects");
  const [data, setData] = useState<BaseMe | null>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState<CategoryKey>("production");
  const [detail, setDetail] = useState<Catalog | null>(null);
  // Auto-Open Detail bei initialBuildingId (Iso-Scene-Flow)
  const initialOpenedRef = useRef(false);
  useEffect(() => {
    if (initialOpenedRef.current) return;
    if (!data || !initialBuildingId) return;
    const cat = data.catalog.find((c) => c.id === initialBuildingId);
    if (cat) {
      setActiveCat((cat.category as CategoryKey) ?? "production");
      setDetail(cat);
      initialOpenedRef.current = true;
    }
  }, [data, initialBuildingId]);
  const [gems, setGems] = useState<number>(0);
  const resourceArt = useResourceArt();
  const buildingArt = useBuildingArt();
  const fx = useRewardFx();

  // Diamant-Balance: einmal laden + auf globales Event reagieren
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch("/api/shop/gems", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json() as { gems?: { gems?: number } };
        if (!cancelled) setGems(j.gems?.gems ?? 0);
      } catch { /* ignore */ }
    };
    void load();
    const onChange = () => void load();
    window.addEventListener("ma365:gems-changed", onChange);
    return () => { cancelled = true; window.removeEventListener("ma365:gems-changed", onChange); };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (detail) setDetail(null);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, detail]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  /**
   * Reload mit Level-Up-Detection.
   * Wenn ein Building zwischen prev und next gelevelt ist (Queue lief ab),
   * feuern wir eine Celebrate-FX am Bildschirm-Mittelpunkt — der Spieler
   * sieht "STUFE 5!" mit Sparkle-Burst auch wenn er gerade woanders schaut.
   * Skipped wenn `silent=true` (z.B. erstes Load).
   */
  const reload = useCallback(async (silent = false) => {
    const next = await fetchBaseMe({ force: true }) as BaseMe | null;
    if (!next) return;
    setData((prev) => {
      if (!silent && prev) {
        // Detect level-ups (Queue-Finishes via finish_building RPC)
        const prevLvl = new Map(prev.buildings.map((b) => [b.building_id, b.level]));
        const newLvl = new Map(next.buildings.map((b) => [b.building_id, b.level]));
        const newCat = new Map(next.catalog.map((c) => [c.id, c]));
        for (const [bid, nl] of newLvl) {
          const pl = prevLvl.get(bid) ?? 0;
          if (nl > pl) {
            const cat = newCat.get(bid);
            const name = cat ? (tBld.has(`${bid}.name`) ? tBld(`${bid}.name`) : cat.name) : bid;
            // Try to anchor at the building card if visible; else viewport center.
            // Bevorzugte Anchor-Reihenfolge:
            //  1. Click-Anchor (z.B. SOFORT-Button im Detail-Modal)
            //  2. Building-Card im Deck wenn sichtbar
            //  3. Viewport-Center (Fallback)
            const clickAnchor = (window as unknown as { __ma365_fx_anchor?: { x: number; y: number } })
              .__ma365_fx_anchor;
            const card = document.querySelector<HTMLElement>(`[data-build-card="${bid}"]`);
            const at = clickAnchor
              ? clickAnchor
              : card
                ? (() => {
                    const rect = card.getBoundingClientRect();
                    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
                  })()
                : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
            fx.celebrate({
              at,
              title: `STUFE ${nl}!`,
              subtitle: name,
              color: "#FFD700",
            });
          }
        }
      }
      return next;
    });
  }, [fx, tBld]);
  useEffect(() => { void reload(true); }, [reload]);

  async function build(buildingId: string): Promise<boolean> {
    setBusy(buildingId); setErr(null);
    try {
      const r = await fetch("/api/base/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ building_id: buildingId }),
      });
      const j = await r.json() as { ok?: boolean; error?: string;
        burg_level?: number; needed?: number;
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
        return false;
      }
      await reload();
      return true;
    } finally { setBusy(null); }
  }

  async function speedUp(queueId: string, tokens: number) {
    setBusy(queueId);
    try {
      await fetch("/api/base/speed-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queue_id: queueId, tokens }),
      });
      await reload();
    } finally { setBusy(null); }
  }

  /** SOFORT: build + Diamanten-Skip für Komplett-Fertigstellung */
  async function buildInstant(buildingId: string, ev?: { clientX: number; clientY: number }) {
    setBusy(buildingId); setErr(null);
    try {
      const ok = await build(buildingId);
      if (!ok) return;
      const fresh = await fetchBaseMe({ force: true }) as BaseMe | null;
      if (!fresh) return;
      setData(fresh);
      const q = fresh.queue.find((qi) => qi.building_id === buildingId);
      if (!q) return;
      const r2 = await fetch("/api/base/instant-finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queue_id: q.id }),
      });
      const j = await r2.json() as { ok?: boolean; error?: string; gems_used?: number; gems_needed?: number };
      if (!j.ok) {
        setErr(j.error === "not_enough_gems"
          ? `Nicht genug Diamanten — du brauchst 💎 ${j.gems_needed ?? 0}.`
          : (j.error ?? "Fehler beim Sofort-Bau."));
      } else {
        // Gems-Event broadcasten damit andere Pills (z.B. DiamantPill auf Map) sich updaten
        window.dispatchEvent(new CustomEvent("ma365:gems-changed"));
        // FX: Level-Up-Celebration. reload() unten erkennt das Level-Up und feuert
        // automatisch die Celebrate-FX. Wir brauchen hier nichts extra zu tun.
        // Aber: für direkte Click-Anchor-Lokalisierung übergeben wir ein temporäres
        // Mark via custom event — der Reload-Code nimmt dann den Click-Punkt.
        if (ev) {
          (window as unknown as { __ma365_fx_anchor?: { x: number; y: number } })
            .__ma365_fx_anchor = getClickPoint(ev);
        }
      }
      await reload();
      // Anchor wieder entfernen
      delete (window as unknown as { __ma365_fx_anchor?: unknown }).__ma365_fx_anchor;
    } finally { setBusy(null); }
  }

  async function collectBuilding(buildingId: string, ev?: { clientX: number; clientY: number }) {
    setBusy(`collect:${buildingId}`); setErr(null);
    try {
      const r = await fetch("/api/base/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ building_id: buildingId }),
      });
      const j = await r.json() as { ok?: boolean; resource?: "wood" | "stone" | "gold" | "mana" | null; amount?: number };

      if (j.ok && ev && j.resource && (j.amount ?? 0) > 0) {
        fx.collect({
          from: getClickPoint(ev),
          rewards: { [j.resource]: j.amount! },
        });
        // Reload erst nach Coin-Flugzeit, damit Bar nicht vor Coin-Ankunft updated
        await new Promise((res) => setTimeout(res, 1300));
      }
      await reload();
    } finally { setBusy(null); }
  }

  const bldName = (id: string, fallback: string): string =>
    tBld.has(`${id}.name`) ? tBld(`${id}.name`) : fallback;
  const effLabel = (key: string): string =>
    tEff.has(key) ? tEff(key) : key;

  const burgLevel = useMemo(() => {
    if (!data) return 0;
    return data.buildings.find((b) => b.building_id === "burg")?.level ?? 0;
  }, [data]);

  const builtMap = useMemo(() => new Map((data?.buildings ?? []).map((b) => [b.building_id, b])), [data]);
  const queueMap = useMemo(() => new Map((data?.queue ?? []).map((q) => [q.building_id, q])), [data]);

  const availableByCat = useMemo(() => {
    const out: Partial<Record<CategoryKey, number>> = {};
    if (!data) return out;
    for (const cat of CATEGORIES) {
      const items = data.catalog.filter((c) => c.category === cat.key);
      const count = items.filter((c) => {
        const built = builtMap.get(c.id);
        const lvl = built?.level ?? 0;
        if (lvl >= c.max_level) return false;
        if (queueMap.has(c.id)) return false;
        const targetLvl = lvl + 1;
        const mult = lvl === 0 ? 1 : Math.pow(1.6, lvl);
        const cost = {
          wood:  Math.round(c.base_cost_wood  * mult),
          stone: Math.round(c.base_cost_stone * mult),
          gold:  Math.round(c.base_cost_gold  * mult),
          mana:  Math.round(c.base_cost_mana  * mult),
        };
        const canPay = (["wood","stone","gold","mana"] as const)
          .every((k) => (data.resources[k] ?? 0) >= cost[k]);
        const lvlLocked = (data.base?.level ?? 1) < c.required_base_level;
        const burgCapped = c.id !== "burg" && targetLvl > Math.max(burgLevel, 1);
        return canPay && !lvlLocked && !burgCapped;
      }).length;
      out[cat.key] = count;
    }
    return out;
  }, [data, builtMap, queueMap, burgLevel]);

  const items = useMemo(() => {
    if (!data) return [];
    return data.catalog.filter((c) => c.category === activeCat);
  }, [data, activeCat]);

  const activeMeta = CATEGORIES.find((c) => c.key === activeCat)!;

  // Pending-Berechnung pro Production-Building (live, via now-Tick)
  const pendingByBuilding = useMemo(() => {
    if (!data) return new Map<string, Pending>();
    const m = new Map<string, Pending>();
    for (const bb of data.buildings) {
      const cat = data.catalog.find((c) => c.id === bb.building_id);
      if (!cat) continue;
      const p = computePending(bb, cat, now);
      if (p) m.set(bb.building_id, p);
    }
    return m;
  }, [data, now]);


  return (
    <>
      <Modal open={true} onClose={onClose} size="md" zIndex={Z.modal}>
        <style>{`
          @keyframes ma365BuildPulse { 0%,100% { opacity: 0.6; transform: scale(1); } 50% { opacity: 1; transform: scale(1.25); } }
          @keyframes ma365BuildShimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
          @keyframes ma365BuildFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
          .ma365-build-shell ::-webkit-scrollbar { display: none; }
          .ma365-build-card { transition: transform 0.15s, box-shadow 0.15s; }
          .ma365-build-card:active { transform: scale(0.97); }
          .ma365-build-card.is-buildable:hover { box-shadow: 0 6px 20px rgba(34,209,195,0.25); }
          .ma365-collect-badge { transition: transform 0.12s, box-shadow 0.12s; }
          .ma365-collect-badge:hover { transform: scale(1.12); box-shadow: 0 0 14px ${GOLD}, 0 3px 8px rgba(0,0,0,0.5) !important; }
          .ma365-collect-badge:active { transform: scale(0.94); }
          .ma365-collect-badge[data-busy="true"] { opacity: 0.55; cursor: not-allowed !important; transform: scale(0.95); }
        `}</style>

        <div
          className="ma365-build-shell"
          style={{
            position: "relative",
            width: "100%",
            display: "flex", flexDirection: "column",
            overflow: "hidden",
            minHeight: 0,
            flex: 1,
            // Solider Background — kein Durchschimmern des Karten-Hintergrunds.
            background: MODAL_BG,
            // Selber Radius wie ui/Modal, sonst überdeckt der Background die Ecken.
            borderRadius: "var(--radius-modal)",
          }}
        >
          {/* Ambient warm-Glow + Sparkles für freundlichere Atmosphäre */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
            background: `
              radial-gradient(ellipse at 50% -10%, ${ORANGE}22, transparent 50%),
              radial-gradient(ellipse at 100% 100%, ${ACCENT}11, transparent 55%),
              radial-gradient(ellipse at 0% 100%, ${PINK}11, transparent 50%)
            `,
          }} />
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden",
          }}>
            {Array.from({ length: 14 }).map((_, i) => (
              <span key={i} style={{
                position: "absolute",
                top: `${(i * 31) % 95}%`,
                left: `${(i * 47) % 95}%`,
                width: 2, height: 2, borderRadius: "50%",
                background: "#FFE4B8",
                boxShadow: "0 0 4px rgba(255,228,184,0.8)",
                animation: `ma365BuildPulse ${2 + (i % 3) * 0.6}s ease-in-out ${(i % 5) * 0.3}s infinite`,
                opacity: 0.5,
              }} />
            ))}
          </div>

          {/* HEADER */}
          <div style={{
            padding: "12px 14px",
            display: "flex", alignItems: "center", gap: 12,
            background: `linear-gradient(135deg, ${ORANGE}33, ${ORANGE}05 60%, transparent)`,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{ position: "relative", width: 52, height: 52, flexShrink: 0 }}>
              <div style={{
                position: "absolute", inset: 0,
                borderRadius: "50%",
                background: `conic-gradient(${ORANGE} ${(burgLevel / 25) * 360}deg, rgba(255,255,255,0.08) 0)`,
                padding: 3,
              }}>
                <div style={{
                  width: "100%", height: "100%", borderRadius: "50%",
                  background: `radial-gradient(circle at 30% 30%, ${ORANGE}55, ${ORANGE}11)`,
                  border: `1px solid ${ORANGE}66`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 24,
                }}>🔨</div>
              </div>
              <div style={{
                position: "absolute", bottom: -2, right: -2,
                minWidth: 22, height: 22, borderRadius: 11, padding: "0 5px",
                background: ORANGE, color: "#0F1115",
                fontSize: 10, fontWeight: 900,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 2px 6px rgba(0,0,0,0.6)",
                fontVariantNumeric: "tabular-nums",
              }}>{burgLevel}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: TEXT, fontSize: 16, fontWeight: 900, letterSpacing: 0.3 }}>BAUEN</div>
              <div style={{ color: MUTED, fontSize: 10, fontWeight: 700, marginTop: 1 }}>
                Base Lv {burgLevel}{burgLevel < 25 ? ` → ${burgLevel + 1}` : ""} · {data?.buildings.length ?? 0} Gebäude
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Schließen"
              style={{
                width: 32, height: 32, borderRadius: 10,
                background: "rgba(0,0,0,0.45)", border: "none",
                color: "rgba(255,255,255,0.85)",
                fontSize: 20, fontWeight: 900, cursor: "pointer",
                flexShrink: 0,
              }}
            >×</button>
          </div>

          {/* RESOURCEN — zusammenhängende Glas-Bar mit großen Icons */}
          {data && (
            <div style={{
              padding: "10px 12px",
              flexShrink: 0,
            }}>
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
                background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                overflow: "hidden",
              }}>
                {(["wood", "stone", "gold", "mana"] as const).map((k, i) => (
                  <div key={k}
                    data-rss-pill={k}
                    style={{
                      padding: "10px 8px",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                      borderRight: i < 3 ? "1px solid rgba(255,255,255,0.06)" : "none",
                      minWidth: 0,
                    }}>
                    <ResourceIcon kind={k} size={44} fallback={RES_FALLBACK[k].icon} art={resourceArt} />
                    <div style={{
                      fontSize: 16, fontWeight: 900, color: RES_FALLBACK[k].color,
                      fontVariantNumeric: "tabular-nums", letterSpacing: -0.3,
                      textShadow: "0 1px 2px rgba(0,0,0,0.6)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{compactNum(data.resources[k] ?? 0)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* KATEGORIE-TABS — oben (Standard für Modal-Tabs) */}
          <div style={{
            padding: "0 12px",
            display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 0,
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            flexShrink: 0,
          }}>
            {CATEGORIES.map((cat) => {
              const isActive = activeCat === cat.key;
              const availableCount = availableByCat[cat.key] ?? 0;
              return (
                <button
                  key={cat.key}
                  onClick={() => setActiveCat(cat.key)}
                  style={{
                    position: "relative",
                    padding: "10px 4px 8px", border: "none",
                    background: isActive ? `linear-gradient(180deg, ${cat.color}11, transparent)` : "transparent",
                    borderBottom: isActive ? `2px solid ${cat.color}` : "2px solid transparent",
                    marginBottom: -1,
                    cursor: "pointer",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                  }}
                >
                  <span style={{
                    fontSize: 22, lineHeight: 1,
                    filter: isActive ? `drop-shadow(0 0 6px ${cat.color}88)` : "none",
                    opacity: isActive ? 1 : 0.7,
                  }}>{cat.emoji}</span>
                  <span style={{
                    fontSize: 9, fontWeight: 900,
                    color: isActive ? cat.color : MUTED,
                    letterSpacing: 0.3,
                  }}>{cat.label}</span>
                  {availableCount > 0 && !isActive && (
                    <span style={{
                      position: "absolute", top: 6, right: "calc(50% - 18px)",
                      width: 7, height: 7, borderRadius: "50%",
                      background: cat.color, boxShadow: `0 0 8px ${cat.color}`,
                      animation: "ma365BuildPulse 1.6s ease-in-out infinite",
                    }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* FEHLER */}
          {err && (
            <div style={{
              padding: "8px 14px",
              background: `linear-gradient(90deg, ${PINK}33, ${PINK}11)`,
              color: PINK, fontSize: 11, fontWeight: 800,
            }}>⚠ {err}</div>
          )}

          {/* HERO QUEUE */}
          {data && data.queue.length > 0 && (
            <div style={{
              padding: "10px 12px",
              background: `linear-gradient(180deg, ${ORANGE}11, transparent)`,
              borderBottom: "1px solid rgba(255,255,255,0.05)",
              display: "flex", flexDirection: "column", gap: 6,
              flexShrink: 0,
            }}>
              {data.queue.map((q) => {
                const cat = data.catalog.find((c) => c.id === q.building_id);
                const total = new Date(q.ends_at).getTime() - new Date(q.started_at).getTime();
                const elapsed = now - new Date(q.started_at).getTime();
                const pct = Math.max(0, Math.min(100, (elapsed / total) * 100));
                const remainingSec = Math.max(0, Math.floor((new Date(q.ends_at).getTime() - now) / 1000));
                const ready = remainingSec === 0;
                const tokens = data.resources.speed_tokens ?? 0;
                return (
                  <div key={q.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <BuildingThumb id={q.building_id} fallback={cat?.emoji ?? "🏗️"} art={buildingArt} size={36} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
                        <span style={{
                          fontSize: 12, fontWeight: 900, color: TEXT,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {cat ? bldName(cat.id, cat.name) : q.building_id}
                          {" "}<span style={{ color: ORANGE }}>Lv {q.target_level}</span>
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 800,
                          color: ready ? GREEN : ORANGE,
                          fontVariantNumeric: "tabular-nums", flexShrink: 0,
                        }}>{ready ? "FERTIG" : fmtTime(remainingSec)}</span>
                      </div>
                      <div style={{
                        marginTop: 4, height: 5, borderRadius: 3,
                        background: "rgba(255,255,255,0.08)", overflow: "hidden",
                        position: "relative",
                      }}>
                        <div style={{
                          height: "100%", width: `${pct}%`,
                          background: ready
                            ? `linear-gradient(90deg, ${GREEN}, ${GREEN}cc)`
                            : `linear-gradient(90deg, ${ORANGE}, ${GOLD})`,
                          transition: "width 1s linear",
                          boxShadow: `0 0 8px ${ready ? GREEN : ORANGE}88`,
                        }} />
                        {!ready && (
                          <div style={{
                            position: "absolute", inset: 0,
                            background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)",
                            backgroundSize: "200% 100%",
                            animation: "ma365BuildShimmer 2s linear infinite",
                          }} />
                        )}
                      </div>
                    </div>
                    {!ready && tokens > 0 && (
                      <button
                        onClick={() => speedUp(q.id, Math.min(tokens, Math.ceil(remainingSec / 60 / 5)))}
                        disabled={busy === q.id}
                        style={{
                          flexShrink: 0,
                          fontSize: 10, fontWeight: 900,
                          padding: "5px 8px", borderRadius: 7,
                          background: `${ACCENT}22`, border: `1px solid ${ACCENT}66`, color: ACCENT,
                          cursor: busy === q.id ? "wait" : "pointer",
                        }}
                      >⚡ Skip</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* DECK */}
          <div style={{
            flex: 1, minHeight: 0, overflowY: "auto",
            padding: "12px 12px 8px",
            scrollbarWidth: "none",
          }}>
            {!data && (
              <div style={{ textAlign: "center", padding: "40px 0", color: MUTED, fontSize: 12 }}>
                Lade…
              </div>
            )}

            {data && (
              <>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "flex-end",
                  marginBottom: 8, padding: "0 2px",
                }}>
                  <div style={{ fontSize: 10, color: MUTED, fontWeight: 700 }}>
                    {items.filter((i) => builtMap.has(i.id)).length}/{items.length} gebaut
                  </div>
                </div>

                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: 8,
                }}>
                  {items.map((cat) => {
                    const built = builtMap.get(cat.id);
                    const inQueue = queueMap.get(cat.id);
                    const lvl = built?.level ?? 0;
                    const isMax = lvl >= cat.max_level;
                    const targetLvl = lvl + 1;
                    const mult = lvl === 0 ? 1 : Math.pow(1.6, lvl);
                    const cost = {
                      wood:  Math.round(cat.base_cost_wood  * mult),
                      stone: Math.round(cat.base_cost_stone * mult),
                      gold:  Math.round(cat.base_cost_gold  * mult),
                      mana:  Math.round(cat.base_cost_mana  * mult),
                    };
                    const canPay = (["wood","stone","gold","mana"] as const)
                      .every((k) => (data.resources[k] ?? 0) >= cost[k]);
                    const lvlLocked = (data.base?.level ?? 1) < cat.required_base_level;
                    const burgCapped = cat.id !== "burg" && !isMax && targetLvl > Math.max(burgLevel, 1);
                    const isBuildable = !isMax && !inQueue && !lvlLocked && !burgCapped && canPay;

                    let ringColor = "rgba(255,255,255,0.08)";
                    let statusBadge: { label: string; color: string } | null = null;
                    if (isMax) { ringColor = `${GOLD}88`; statusBadge = { label: "MAX", color: GOLD }; }
                    else if (inQueue) { ringColor = `${ORANGE}88`; statusBadge = { label: "BAU", color: ORANGE }; }
                    else if (lvlLocked) { ringColor = "rgba(255,255,255,0.06)"; statusBadge = { label: "🔒", color: MUTED }; }
                    else if (burgCapped) { ringColor = `${GOLD}44`; statusBadge = { label: "🏰", color: GOLD }; }
                    else if (isBuildable) { ringColor = `${activeMeta.color}99`; }

                    return (
                      <button
                        key={cat.id}
                        data-build-card={cat.id}
                        onClick={() => setDetail(cat)}
                        className={`ma365-build-card ${isBuildable ? "is-buildable" : ""}`}
                        style={{
                          position: "relative",
                          background: isBuildable ? CARD_BG_ACTIVE(activeMeta.color) : CARD_BG_DIM,
                          border: `1px solid ${ringColor}`,
                          borderRadius: 12,
                          padding: "10px 8px",
                          display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                          cursor: "pointer",
                          color: TEXT,
                          textAlign: "center",
                          opacity: lvlLocked ? 0.55 : 1,
                          boxShadow: isBuildable ? `0 4px 14px ${activeMeta.color}22` : "0 2px 6px rgba(0,0,0,0.3)",
                          minHeight: 132,
                        }}
                      >
                        {/* Status-Badge oben rechts */}
                        {statusBadge && (
                          <span style={{
                            position: "absolute", top: 6, right: 6,
                            padding: "2px 6px", borderRadius: 5,
                            background: `${statusBadge.color}22`,
                            color: statusBadge.color,
                            fontSize: 9, fontWeight: 900, letterSpacing: 0.5,
                            border: `1px solid ${statusBadge.color}55`,
                          }}>{statusBadge.label}</span>
                        )}
                        {/* Pending-Badge — direkt klickbar zum Einsammeln (spart einen Klick) */}
                        {(() => {
                          const p = pendingByBuilding.get(cat.id);
                          if (!p || p.amount <= 0) return null;
                          const collectBusy = busy === `collect:${cat.id}`;
                          return (
                            <span
                              role="button"
                              tabIndex={0}
                              aria-label={`${compactNum(p.amount)} ${p.resource} einsammeln`}
                              data-busy={collectBusy ? "true" : undefined}
                              className="ma365-collect-badge"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (collectBusy) return;
                                void collectBuilding(cat.id, { clientX: e.clientX, clientY: e.clientY });
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (collectBusy) return;
                                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                  void collectBuilding(cat.id, {
                                    clientX: r.left + r.width / 2,
                                    clientY: r.top + r.height / 2,
                                  });
                                }
                              }}
                              style={{
                                position: "absolute",
                                top: statusBadge ? 26 : 6, right: 6,
                                padding: "3px 7px", borderRadius: 5,
                                background: `linear-gradient(135deg, ${GOLD}, ${GOLD}cc)`,
                                color: "#0F1115",
                                fontSize: 10, fontWeight: 900, letterSpacing: 0.3,
                                boxShadow: `0 0 10px ${GOLD}88, 0 2px 5px rgba(0,0,0,0.35)`,
                                animation: p.capped ? "ma365BuildPulse 1.6s ease-in-out infinite" : "none",
                                fontVariantNumeric: "tabular-nums",
                                display: "inline-flex", alignItems: "center", gap: 2,
                                cursor: "pointer",
                                userSelect: "none",
                                zIndex: 2,
                              }}
                            >{collectBusy ? "…" : `🪙 +${compactNum(p.amount)}`}</span>
                          );
                        })()}
                        {/* Verfügbar-Glow oben links */}
                        {isBuildable && (
                          <span style={{
                            position: "absolute", top: 6, left: 6,
                            width: 8, height: 8, borderRadius: "50%",
                            background: activeMeta.color,
                            boxShadow: `0 0 8px ${activeMeta.color}`,
                            animation: "ma365BuildPulse 1.6s ease-in-out infinite",
                          }} />
                        )}
                        {/* Artwork */}
                        <div style={{
                          height: 64, width: "100%",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          position: "relative", marginTop: 4,
                        }}>
                          <div style={{
                            position: "absolute", bottom: 0, left: "50%",
                            transform: "translateX(-50%)",
                            width: 50, height: 6, borderRadius: "50%",
                            background: `radial-gradient(ellipse, ${activeMeta.color}55, transparent 70%)`,
                            filter: "blur(2px)",
                          }} />
                          <div style={{ animation: "ma365BuildFloat 3.5s ease-in-out infinite" }}>
                            <BuildingThumb id={cat.id} fallback={cat.emoji} art={buildingArt} size={60} />
                          </div>
                        </div>
                        {/* Name */}
                        <div style={{
                          fontSize: 11, fontWeight: 900, color: TEXT, lineHeight: 1.15,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          width: "100%",
                        }}>{bldName(cat.id, cat.name)}</div>
                        {/* Stufen-Pill */}
                        <div style={{
                          fontSize: 10, fontWeight: 800,
                          padding: "2px 7px", borderRadius: 5,
                          background: lvl > 0 ? `${activeMeta.color}22` : "rgba(255,255,255,0.05)",
                          color: lvl > 0 ? activeMeta.color : MUTED,
                          fontVariantNumeric: "tabular-nums",
                        }}>Lv {lvl}/{cat.max_level}</div>
                      </button>
                    );
                  })}
                  {items.length === 0 && (
                    <div style={{
                      gridColumn: "1 / -1",
                      textAlign: "center", padding: "30px 0",
                      color: MUTED, fontSize: 11,
                    }}>Keine Gebäude in dieser Kategorie.</div>
                  )}
                </div>
              </>
            )}
          </div>

        </div>
      </Modal>

      {/* DETAIL-MODAL */}
      {detail && data && (
        <BuildingDetail
          cat={detail}
          data={data}
          accent={activeMeta.color}
          burgLevel={burgLevel}
          gems={gems}
          busy={busy}
          builtMap={builtMap}
          queueMap={queueMap}
          pending={pendingByBuilding.get(detail.id) ?? null}
          buildingArt={buildingArt}
          resourceArt={resourceArt}
          bldName={bldName}
          effLabel={effLabel}
          onClose={() => setDetail(null)}
          onUpgrade={async (id) => {
            const ok = await build(id);
            if (ok) setDetail(null);
          }}
          onInstant={async (id, ev) => {
            await buildInstant(id, ev);
            setDetail(null);
          }}
          onCollect={async (id, ev) => {
            await collectBuilding(id, ev);
            // Modal nicht schließen — User sieht updated state
          }}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────
// BuildingDetail — CoD-Style Pro-Gebäude-Modal mit Stat-Vergleich
// ─────────────────────────────────────────────────────────────────────

function BuildingDetail({
  cat, data, accent, burgLevel, gems, busy,
  builtMap, queueMap, pending,
  buildingArt, resourceArt,
  bldName, effLabel, onClose, onUpgrade, onInstant, onCollect,
}: {
  cat: Catalog;
  data: BaseMe;
  accent: string;
  burgLevel: number;
  gems: number;
  busy: string | null;
  builtMap: Map<string, Building>;
  queueMap: Map<string, QueueItem>;
  pending: Pending | null;
  buildingArt: ResourceArtMap;
  resourceArt: ResourceArtMap;
  bldName: (id: string, fallback: string) => string;
  effLabel: (key: string) => string;
  onClose: () => void;
  onUpgrade: (buildingId: string, ev?: { clientX: number; clientY: number }) => Promise<void>;
  onInstant: (buildingId: string, ev?: { clientX: number; clientY: number }) => Promise<void>;
  onCollect: (buildingId: string, ev?: { clientX: number; clientY: number }) => Promise<void>;
}) {
  const built = builtMap.get(cat.id);
  const inQueue = queueMap.get(cat.id);
  const lvl = built?.level ?? 0;
  const isMax = lvl >= cat.max_level;
  const targetLvl = lvl + 1;
  const mult = lvl === 0 ? 1 : Math.pow(1.6, lvl);
  const cost = {
    wood:  Math.round(cat.base_cost_wood  * mult),
    stone: Math.round(cat.base_cost_stone * mult),
    gold:  Math.round(cat.base_cost_gold  * mult),
    mana:  Math.round(cat.base_cost_mana  * mult),
  };
  // Speed-Token-Pflicht beim finalen Sprung zur Max-Stufe (= 1 Token pro Max-Upgrade).
  // Spiegelt server-seitige Logik in start_building (Migration 00291).
  const speedTokenCost = (targetLvl === cat.max_level && lvl > 0) ? 1 : 0;
  const haveSpeedTokens = data.resources.speed_tokens ?? 0;
  const canPay = (["wood","stone","gold","mana"] as const)
    .every((k) => (data.resources[k] ?? 0) >= cost[k])
    && haveSpeedTokens >= speedTokenCost;
  const lvlLocked = (data.base?.level ?? 1) < cat.required_base_level;
  const burgCapped = cat.id !== "burg" && !isMax && targetLvl > Math.max(burgLevel, 1);
  const buildTime = cat.base_buildtime_minutes * (lvl === 0 ? 1 : Math.ceil(mult));
  const gemsNeeded = Math.max(1, buildTime);
  const canInstant = canPay && !lvlLocked && !burgCapped && !inQueue && !isMax && gems >= gemsNeeded;
  const canUpgrade = canPay && !lvlLocked && !burgCapped && !inQueue && !isMax;

  // Stufen-Tabellen-Modal-State
  const [showLevelTable, setShowLevelTable] = useState(false);

  // Stufen-Werte vorab-berechnet für die Tabelle
  const levelRows: LevelRow[] = useMemo(() => {
    const rows: LevelRow[] = [];
    const isProduction = !!cat.effect_key && PRODUCTION_KEYS[cat.effect_key] != null;
    for (let i = 1; i <= cat.max_level; i++) {
      const m = i === 1 ? 1 : Math.pow(1.6, i - 1);
      const { rate, cap } = rateForLevel(cat, i);
      rows.push({
        level: i,
        effect: cat.effect_key
          ? (ABSOLUTE_EFFECTS.has(cat.effect_key)
              ? `+${rate.toLocaleString("de-DE", { maximumFractionDigits: 1 })}`
              : `+${Math.round(rate * 100)}%`)
          : "—",
        // Bei Production-Buildings: Lager-Cap als Sub-Zeile
        effectSub: isProduction
          ? `Cap ${Math.floor(cap).toLocaleString("de-DE")}`
          : undefined,
        cost: {
          wood:  Math.round(cat.base_cost_wood  * m),
          stone: Math.round(cat.base_cost_stone * m),
          gold:  Math.round(cat.base_cost_gold  * m),
          mana:  Math.round(cat.base_cost_mana  * m),
        },
        timeMinutes: cat.base_buildtime_minutes * (i === 1 ? 1 : Math.ceil(m)),
      });
    }
    return rows;
  }, [cat]);

  return (
    <Modal open={true} onClose={onClose} size="md" zIndex={Z.modalNested}>
      <div
        style={{
          position: "relative",
          width: "100%",
          display: "flex", flexDirection: "column",
          overflow: "hidden", minHeight: 0,
          flex: 1,
          background: MODAL_BG,
          borderRadius: "var(--radius-modal)",
        }}
      >
        {/* Ambient warm-Glow + Sparkles */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
          background: `
            radial-gradient(ellipse at 30% -10%, ${accent}22, transparent 50%),
            radial-gradient(ellipse at 100% 100%, ${ORANGE}11, transparent 55%)
          `,
        }} />
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
          {Array.from({ length: 10 }).map((_, i) => (
            <span key={i} style={{
              position: "absolute",
              top: `${(i * 37) % 95}%`,
              left: `${(i * 53) % 95}%`,
              width: 2, height: 2, borderRadius: "50%",
              background: "#FFE4B8",
              boxShadow: "0 0 4px rgba(255,228,184,0.7)",
              animation: `ma365BuildPulse ${2 + (i % 3) * 0.5}s ease-in-out ${(i % 4) * 0.4}s infinite`,
              opacity: 0.45,
            }} />
          ))}
        </div>

        {/* HEADER */}
        <div style={{
          padding: "5px 8px",
          background: `linear-gradient(90deg, ${accent}33, ${accent}11)`,
          borderBottom: `1px solid ${accent}44`,
          display: "flex", alignItems: "center", gap: 5,
          flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            aria-label="Zurück"
            style={{
              width: 26, height: 26, borderRadius: 6, border: "none",
              background: "rgba(0,0,0,0.45)", color: "rgba(255,255,255,0.85)",
              fontSize: 14, fontWeight: 900, cursor: "pointer",
              flexShrink: 0,
            }}
          >‹</button>
          <div style={{
            flex: 1, fontSize: 12, fontWeight: 900,
            color: TEXT, letterSpacing: 1.2, textAlign: "center",
            textTransform: "uppercase",
          }}>{lvl === 0 ? "Gebäude bauen" : "Gebäudeverbesserung"}</div>
          {/* Info-Button: öffnet Stufen-Tabelle */}
          <button
            onClick={() => setShowLevelTable(true)}
            aria-label="Stufen-Tabelle"
            title="Stufen-Tabelle anzeigen"
            style={{
              width: 26, height: 26, borderRadius: 6, border: `1px solid ${accent}66`,
              background: `${accent}22`, color: accent,
              fontSize: 12, fontWeight: 900, cursor: "pointer",
              flexShrink: 0, fontFamily: "Georgia, serif",
            }}
          >i</button>
          <button
            onClick={onClose}
            aria-label="Schließen"
            style={{
              width: 26, height: 26, borderRadius: 6, border: "none",
              background: "rgba(0,0,0,0.45)", color: "rgba(255,255,255,0.85)",
              fontSize: 16, fontWeight: 900, cursor: "pointer",
              flexShrink: 0,
            }}
          >×</button>
        </div>

        {/* CONTENT — horizontaler Split: Bild links, Infos rechts (CoD-Style).
            Bewusst KEIN scroll: alles muss in Landscape (≈412px) ohne Scrollen
            sichtbar sein. Sehr kompakte Spacings — siehe feedback_no_scroll. */}
        <style>{`
          .ma365-bld-detail-row { display: grid; grid-template-columns: minmax(120px, 38%) 1fr; gap: 10px; align-items: start; }
          @media (max-width: 380px) { .ma365-bld-detail-row { grid-template-columns: 100px 1fr; gap: 8px; } }
        `}</style>
        <div style={{
          position: "relative",
          flex: 1, minHeight: 0, overflow: "hidden",
          padding: "8px 10px",
        }}>
          {/* Tech-Lines (Hex-Grid Pattern) im Hintergrund */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: `
              repeating-linear-gradient(0deg, transparent 0, transparent 28px, ${accent}05 28px, ${accent}05 29px),
              repeating-linear-gradient(90deg, transparent 0, transparent 28px, ${accent}05 28px, ${accent}05 29px),
              radial-gradient(ellipse at 20% 0%, ${accent}11, transparent 60%)
            `,
            opacity: 0.6, zIndex: 0,
          }} />
          <div style={{ position: "relative", zIndex: 1 }} className="ma365-bld-detail-row">
            {/* ═══ LINKS: Hero-Artwork + Pending-Box ═══ */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
            <div style={{
              position: "relative", height: 130,
              display: "flex", alignItems: "flex-end", justifyContent: "center",
              padding: "4px 2px 0",
            }}>
              {/* Glow */}
              <div style={{
                position: "absolute", top: 14, left: "50%",
                transform: "translateX(-50%)",
                width: "90%", maxWidth: 160, height: 110, borderRadius: "50%",
                background: `radial-gradient(ellipse, ${accent}33, transparent 70%)`,
                filter: "blur(22px)",
              }} />
              {/* Sockel */}
              <div style={{
                position: "absolute", bottom: 6, left: "50%",
                transform: "translateX(-50%)",
                width: "85%", maxWidth: 150, height: 14,
                background: `radial-gradient(ellipse, ${accent}77, transparent 70%)`,
                filter: "blur(4px)",
                borderRadius: "50%",
              }} />
              {/* Artwork */}
              <div style={{
                position: "relative", zIndex: 1,
                animation: "ma365BuildFloat 4s ease-in-out infinite",
                filter: `drop-shadow(0 6px 14px ${accent}55)`,
              }}>
                <BuildingThumb id={cat.id} fallback={cat.emoji} art={buildingArt} size={130} />
              </div>
            </div>

            </div>

            {/* ═══ RECHTS: Name + Stufe + Stats + Anforderungen ═══ */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
              {/* Name + Stufe-Pfeil inline — Stufe direkt neben dem Titel */}
              <div style={{
                display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "4px 10px",
              }}>
                <div style={{
                  fontSize: 15, fontWeight: 900, color: TEXT,
                  letterSpacing: 0.6, textTransform: "uppercase",
                  textShadow: `0 2px 6px ${accent}33`,
                  lineHeight: 1.05, wordBreak: "break-word",
                }}>{bldName(cat.id, cat.name)}</div>
                {!isMax && (
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    fontSize: 13, fontWeight: 800, color: MUTED,
                    flexShrink: 0,
                  }}>
                    <span>Stufe {lvl}</span>
                    <span style={{ color: GREEN, fontSize: 14 }}>➜</span>
                    <span style={{ color: GREEN, fontWeight: 900 }}>{targetLvl}</span>
                  </div>
                )}
                {isMax && (
                  <div style={{
                    fontSize: 13, fontWeight: 900, color: GOLD, flexShrink: 0,
                  }}>Stufe {lvl} — MAX</div>
                )}
              </div>

              {/* Stat-Vergleich (Tech-Frame mit Bar + Vorher/Nachher) */}
              {cat.effect_key && !isMax && (() => {
                const isProd = !!PRODUCTION_KEYS[cat.effect_key];
                const cur = lvl > 0 ? rateForLevel(cat, lvl) : { rate: 0, cap: 0, capMult: 6 };
                const nxt = rateForLevel(cat, targetLvl);
                const ansCur = lvl > 0 ? ansehenForLevel(cat, lvl) : null;
                const ansNxt = ansehenForLevel(cat, targetLvl);
                return (
                <TechStatFrame
                  accent={accent}
                  level={lvl}
                  maxLevel={cat.max_level}
                  rows={[
                    {
                      label: effLabel(cat.effect_key),
                      current: fmtEffectAbs(cat.effect_key, cur.rate),
                      next:    fmtEffectAbs(cat.effect_key, nxt.rate),
                      delta:   fmtEffect(cat.effect_key, nxt.rate - cur.rate),
                    },
                    // Bei Production-Buildings: zusätzlich Lager-Cap (×capMult Stunden)
                    ...(isProd ? [{
                      label: `Lager-Cap (${nxt.capMult}h)`,
                      current: Math.floor(cur.cap).toLocaleString("de-DE"),
                      next:    Math.floor(nxt.cap).toLocaleString("de-DE"),
                      delta:   `+${Math.floor(nxt.cap - cur.cap).toLocaleString("de-DE")}`,
                    }] : []),
                    // Ansehen-Delta wenn level_stats vorhanden
                    ...(ansNxt != null ? [{
                      label: "Ansehen",
                      current: (ansCur ?? 0).toLocaleString("de-DE"),
                      next:    ansNxt.toLocaleString("de-DE"),
                      delta:   `+${(ansNxt - (ansCur ?? 0)).toLocaleString("de-DE")}`,
                    }] : []),
                    // Bei Burg: Max-Stufe-Gebäude
                    ...(cat.id === "burg" ? [{
                      label: "Max-Stufe Gebäude",
                      current: `Lv ${Math.max(lvl, 1)}`,
                      next:    `Lv ${Math.max(lvl, 1) + 1}`,
                      delta:   "+1",
                    }] : []),
                  ]}
                />
              );
              })()}

              {/* Pending-Box wurde nach links unter das Hero-Bild verschoben */}

              {/* Anforderungen */}
              {!isMax && (() => {
                // RSS-Anforderungen
                const resCells = (["wood","stone","gold","mana"] as const)
                  .filter((k) => cost[k] > 0);
                // Burg-Anforderung: Lager max(required_base_level, targetLvl) — außer für die Burg selbst
                const burgReq = cat.id === "burg" ? null
                  : Math.max(cat.required_base_level, targetLvl);
                const burgMet = burgReq === null || burgLevel >= burgReq;
                const ICON_SIZE = 30;
                // Liste der Gebäude-Anforderungen (aktuell nur Burg, designed für mehrere)
                const buildingReqs = burgReq !== null
                  ? [{ id: "burg", label: "Base", currentLvl: burgLevel, requiredLvl: burgReq, met: burgMet }]
                  : [];
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {/* Caption */}
                    <div style={{
                      fontSize: 9, fontWeight: 900, color: MUTED, letterSpacing: 1.2,
                      paddingLeft: 2,
                    }}>ANFORDERUNGEN</div>
                    {/* RSS-Reihe + Bauzeit in EINER kompakten Zeile */}
                    <div style={{
                      display: "flex", flexWrap: "nowrap",
                      alignItems: "center", gap: 4,
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 8, padding: "4px 6px",
                      overflowX: "auto",
                    }}>
                      {resCells.map((k) => {
                        const have = data.resources[k] ?? 0;
                        const enough = have >= cost[k];
                        return (
                          <div key={k} style={{
                            display: "inline-flex", alignItems: "center", gap: 3,
                            flexShrink: 0,
                          }}>
                            <ResourceIcon kind={k} size={ICON_SIZE - 8} fallback={RES_FALLBACK[k].icon} art={resourceArt} />
                            <span style={{
                              fontSize: 10, fontWeight: 900,
                              color: enough ? TEXT : PINK,
                              fontVariantNumeric: "tabular-nums",
                            }}>{compactNum(cost[k])}</span>
                          </div>
                        );
                      })}
                      {/* Speed-Token-Cost beim Sprung zur Max-Stufe (Lv 24→25 etc.) */}
                      {speedTokenCost > 0 && (
                        <div style={{
                          display: "inline-flex", alignItems: "center", gap: 3,
                          flexShrink: 0,
                          padding: "1px 5px",
                          background: haveSpeedTokens >= speedTokenCost
                            ? `${GOLD}22`
                            : `${PINK}22`,
                          border: `1px solid ${haveSpeedTokens >= speedTokenCost ? GOLD + "66" : PINK + "66"}`,
                          borderRadius: 5,
                        }}>
                          <ResourceIcon kind="speed_token" size={ICON_SIZE - 8} fallback="⚡" art={resourceArt} />
                          <span style={{
                            fontSize: 10, fontWeight: 900,
                            color: haveSpeedTokens >= speedTokenCost ? GOLD : PINK,
                            fontVariantNumeric: "tabular-nums",
                          }}>{speedTokenCost}</span>
                        </div>
                      )}
                      <div style={{
                        display: "inline-flex", alignItems: "center", gap: 3,
                        flexShrink: 0, marginLeft: "auto",
                      }}>
                        <span style={{ fontSize: 14, lineHeight: 1 }}>⏱</span>
                        <span style={{
                          fontSize: 10, fontWeight: 900, color: TEXT,
                          fontVariantNumeric: "tabular-nums",
                        }}>{fmtBuildTime(buildTime)}</span>
                      </div>
                    </div>
                    {/* Speed-Token Buy-Button wenn nicht genug & Max-Upgrade ansteht */}
                    {speedTokenCost > 0 && haveSpeedTokens < speedTokenCost && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const r = await fetch("/api/base/buy-speed-token", { method: "POST" });
                            const j = await r.json() as { ok?: boolean; error?: string };
                            if (j.ok) {
                              window.dispatchEvent(new CustomEvent("ma365:gems-changed"));
                              window.dispatchEvent(new CustomEvent("ma365:base-resources-changed"));
                            } else {
                              alert(j.error === "not_enough_gems" ? "Nicht genug Krypto." : "Kauf fehlgeschlagen.");
                            }
                          } catch { alert("Netzwerk-Fehler."); }
                        }}
                        style={{
                          marginTop: 4,
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                          padding: "6px 10px",
                          borderRadius: 6,
                          background: `linear-gradient(180deg, ${GOLD}33, ${GOLD}11)`,
                          border: `1px solid ${GOLD}66`,
                          cursor: "pointer",
                          color: GOLD,
                          fontSize: 11,
                          fontWeight: 900,
                          letterSpacing: 0.3,
                        }}
                      >
                        <ResourceIcon kind="speed_token" size={18} fallback="⚡" art={resourceArt} />
                        Max-Stufe Token kaufen — 2000 💎
                      </button>
                    )}
                    {/* Gebäude-Anforderungen — zentriert, nebeneinander wenn mehrere */}
                    {buildingReqs.length > 0 && (
                      <div style={{
                        display: "flex", justifyContent: "center", gap: 10,
                        marginTop: 2,
                      }}>
                        {buildingReqs.map((req) => (
                          <div key={req.id} style={{
                            display: "flex", flexDirection: "column",
                            alignItems: "center", gap: 2,
                            opacity: req.met ? 1 : 0.95,
                          }}>
                            <div style={{
                              position: "relative",
                              width: 44, height: 44,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              background: req.met
                                ? "rgba(255,255,255,0.04)"
                                : `${PINK}15`,
                              border: `1px solid ${req.met ? "rgba(255,255,255,0.10)" : PINK + "55"}`,
                              borderRadius: 8,
                              boxShadow: req.met ? "none" : `0 0 8px ${PINK}33`,
                            }}>
                              <BuildingThumb id={req.id} fallback="🏰" art={buildingArt} size={36} />
                              {!req.met && (
                                <span style={{
                                  position: "absolute", top: -3, right: -3,
                                  width: 14, height: 14, borderRadius: "50%",
                                  background: PINK, color: "#FFF",
                                  fontSize: 9, fontWeight: 900,
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  border: "1px solid rgba(255,255,255,0.2)",
                                }}>!</span>
                              )}
                            </div>
                            <div style={{
                              fontSize: 10, fontWeight: 900,
                              color: req.met ? TEXT : PINK,
                              fontVariantNumeric: "tabular-nums",
                              whiteSpace: "nowrap",
                            }}>
                              Lv {req.currentLvl}<span style={{ color: MUTED, fontSize: 9 }}>/</span><span style={{ color: req.met ? GREEN : PINK }}>{req.requiredLvl}</span>
                            </div>
                            <div style={{
                              fontSize: 8, fontWeight: 700, color: MUTED,
                              letterSpacing: 0.3, lineHeight: 1,
                            }}>{req.label}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* SPERRE-HINWEIS — nur Queue (lvlLocked + burgCapped sind in Anforderungen integriert) */}
          {inQueue && (
            <div style={{
              marginTop: 6,
              padding: "5px 10px",
              background: `${ORANGE}11`, border: `1px solid ${ORANGE}33`,
              borderRadius: 8, color: ORANGE, fontSize: 10, fontWeight: 800,
              textAlign: "center",
            }}>
              🏗️ Bereits in der Bau-Queue.
            </div>
          )}
        </div>

        {/* CTA-BAR (CoD-Style) — kompakt, eine Zeile mit Sub-Info */}
        {!isMax && !inQueue && !lvlLocked && !burgCapped && (
          <div style={{
            padding: "6px 8px",
            background: "rgba(0,0,0,0.4)",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6,
            flexShrink: 0,
          }}>
            {/* SOFORT — mit Diamanten */}
            <button
              onClick={(e) => onInstant(cat.id, { clientX: e.clientX, clientY: e.clientY })}
              disabled={!canInstant || busy === cat.id}
              title={canInstant
                ? `Sofort fertigstellen für 💎 ${gemsNeeded.toLocaleString("de-DE")}`
                : `Diamanten fehlen: ${gems.toLocaleString("de-DE")} / ${gemsNeeded.toLocaleString("de-DE")}`}
              style={{
                padding: "6px 6px", borderRadius: 8, border: "none",
                background: canInstant
                  ? "linear-gradient(180deg, #C8B6FF, #7B61FF)"
                  : "rgba(255,255,255,0.05)",
                color: canInstant ? "#0F1115" : MUTED,
                cursor: canInstant && busy !== cat.id ? "pointer" : "not-allowed",
                fontSize: 12, fontWeight: 900, letterSpacing: 0.6,
                boxShadow: canInstant ? "0 4px 12px rgba(123,97,255,0.55)" : "none",
                opacity: busy === cat.id ? 0.5 : 1,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                whiteSpace: "nowrap",
              }}
            >
              <span>SOFORT</span>
              <span style={{
                fontSize: 10, fontWeight: 900,
                display: "inline-flex", alignItems: "center", gap: 2,
                color: canInstant ? "#0F1115" : MUTED,
                fontVariantNumeric: "tabular-nums",
              }}>
                <span style={{ fontSize: 11, lineHeight: 1 }}>💎</span>
                {gemsNeeded.toLocaleString("de-DE")}
              </span>
            </button>

            {/* VERBESSERN */}
            <button
              onClick={(e) => onUpgrade(cat.id, { clientX: e.clientX, clientY: e.clientY })}
              disabled={!canUpgrade || busy === cat.id}
              style={{
                padding: "6px 6px", borderRadius: 8, border: "none",
                background: canUpgrade
                  ? `linear-gradient(180deg, ${accent}, ${accent}aa)`
                  : "rgba(255,255,255,0.05)",
                color: canUpgrade ? "#0F1115" : MUTED,
                cursor: canUpgrade && busy !== cat.id ? "pointer" : "not-allowed",
                fontSize: 12, fontWeight: 900, letterSpacing: 0.6,
                boxShadow: canUpgrade ? `0 4px 12px ${accent}55` : "none",
                opacity: busy === cat.id ? 0.5 : 1,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                whiteSpace: "nowrap",
              }}
            >
              <span>{lvl === 0 ? "BAUEN" : "VERBESSERN"}</span>
              <span style={{
                fontSize: 10, fontWeight: 800,
                color: canUpgrade ? "rgba(15,17,21,0.75)" : MUTED,
                fontVariantNumeric: "tabular-nums",
              }}>⏱{fmtBuildTime(buildTime)}</span>
            </button>
          </div>
        )}
      </div>

      {/* Stufen-Tabellen-Modal (Sub-Modal über dem Detail) */}
      {showLevelTable && (
        <LevelTableModal
          title={bldName(cat.id, cat.name)}
          subtitle={cat.effect_key ? effLabel(cat.effect_key) : undefined}
          accent={accent}
          currentLevel={lvl}
          rows={levelRows}
          effectLabel={cat.effect_key ? effLabel(cat.effect_key) : "Effekt"}
          resourceArt={resourceArt}
          onClose={() => setShowLevelTable(false)}
        />
      )}
    </Modal>
  );
}

function TechStatFrame({
  accent, level, maxLevel, rows,
}: {
  accent: string;
  level: number;
  maxLevel: number;
  rows: Array<{ label: string; current: string; next: string; delta: string }>;
}) {
  const lvlPct = Math.min(100, (level / maxLevel) * 100);
  return (
    <div style={{
      position: "relative",
      background: "linear-gradient(155deg, rgba(255,255,255,0.04), rgba(0,0,0,0.25))",
      border: `1px solid ${accent}55`,
      borderRadius: 8,
      padding: "6px 8px 6px",
      display: "flex", flexDirection: "column", gap: 3,
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px ${accent}11`,
    }}>
      {/* Tech-Eckklammern */}
      {(["tl","tr","bl","br"] as const).map((corner) => {
        const pos = corner === "tl" ? { top: -1, left: -1 } :
                    corner === "tr" ? { top: -1, right: -1 } :
                    corner === "bl" ? { bottom: -1, left: -1 } :
                                       { bottom: -1, right: -1 };
        const rot = corner === "tl" ? 0 :
                    corner === "tr" ? 90 :
                    corner === "br" ? 180 : 270;
        return (
          <span key={corner} style={{
            position: "absolute", ...pos,
            width: 10, height: 10,
            borderTop: `2px solid ${accent}`,
            borderLeft: `2px solid ${accent}`,
            transform: `rotate(${rot}deg)`,
            pointerEvents: "none",
          }} />
        );
      })}
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        fontSize: 9, fontWeight: 900, letterSpacing: 1.2, color: accent,
      }}>
        <span>EFFEKT @ STUFE {level + 1}</span>
        <span style={{ color: MUTED }}>{level}/{maxLevel}</span>
      </div>
      {/* Stat-Zeilen — single-line: Label | current → next | delta */}
      {rows.map((row, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 5,
          fontSize: 11, fontVariantNumeric: "tabular-nums",
          minHeight: 18,
        }}>
          <span style={{
            fontSize: 9, fontWeight: 700, color: MUTED, letterSpacing: 0.2,
            flexShrink: 0, maxWidth: "40%",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{row.label}</span>
          <span style={{ color: TEXT, fontWeight: 800 }}>{row.current}</span>
          <span style={{ color: accent, fontSize: 10 }}>→</span>
          <span style={{ color: GREEN, fontWeight: 900, textShadow: `0 0 6px ${GREEN}66` }}>{row.next}</span>
          <span style={{
            marginLeft: "auto",
            fontSize: 9, fontWeight: 900,
            padding: "1px 5px", borderRadius: 3,
            background: `${GREEN}22`, color: GREEN,
            border: `1px solid ${GREEN}44`,
            flexShrink: 0,
          }}>{row.delta}</span>
        </div>
      ))}
      {/* Mini-Progress-Bar Lvl/Max */}
      <div style={{
        marginTop: 2, height: 4, borderRadius: 2,
        background: "rgba(255,255,255,0.06)",
        overflow: "hidden", position: "relative",
      }}>
        <div style={{
          height: "100%", width: `${lvlPct}%`,
          background: `linear-gradient(90deg, ${accent}, ${accent}aa)`,
          boxShadow: `0 0 6px ${accent}88`,
        }} />
      </div>
    </div>
  );
}

function StatRow({ label, current, delta }: { label: string; current: string; delta: string }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8,
      fontSize: 12,
    }}>
      <span style={{ color: MUTED, fontWeight: 700, flex: 1, minWidth: 0 }}>{label}</span>
      <span style={{
        color: TEXT, fontWeight: 900, fontVariantNumeric: "tabular-nums",
        flexShrink: 0,
      }}>
        {current}{" "}
        <span style={{ color: GREEN, marginLeft: 4 }}>{delta}</span>
      </span>
    </div>
  );
}

function BuildingThumb({ id, fallback, art, size = 32 }: {
  id: string; fallback: string; art: ResourceArtMap; size?: number;
}) {
  const a = art[id];
  const filterCss: React.CSSProperties = {
    filter: "url(#ma365-chroma-black) drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
  };
  if (a?.image_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={a.image_url} alt={id} style={{ width: size, height: size, objectFit: "contain", flexShrink: 0, ...filterCss }} />;
  }
  if (a?.video_url) {
    return <video src={a.video_url} autoPlay loop muted playsInline style={{ width: size, height: size, objectFit: "contain", flexShrink: 0, ...filterCss }} />;
  }
  return <span style={{ fontSize: size - 8, lineHeight: 1, flexShrink: 0 }}>{fallback}</span>;
}
