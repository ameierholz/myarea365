"use client";

import { useEffect, useState } from "react";

export type ResourceKind = "wood" | "stone" | "gold" | "mana" | "speed_token";
export type ChestKind = "silver" | "gold" | "event";
export type ResourceArtMap = Record<string, { image_url: string | null; video_url: string | null }>;

type AllArt = { resource: ResourceArtMap; chest: ResourceArtMap; stronghold: ResourceArtMap; base_theme: ResourceArtMap; building: ResourceArtMap; nameplate: ResourceArtMap; ui_icon: ResourceArtMap; troop: ResourceArtMap; resource_node: ResourceArtMap; loot_drop: ResourceArtMap; base_ring: ResourceArtMap; inventory_item: ResourceArtMap; modal_background: ResourceArtMap; rank: ResourceArtMap; light: ResourceArtMap; pin_theme: ResourceArtMap; siegel: ResourceArtMap; potion: ResourceArtMap; marker: Record<string, Record<string, { image_url: string | null; video_url: string | null }>> };

// localStorage-Cache: erspart Fallback-Flash bei jedem Reload.
// Format: { v: number, ts: number, art: AllArt }
const LS_KEY = "ma365_cosmetic_art_v2";
const LS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 Tage — Artwork ändert sich selten

function loadFromLocalStorage(): AllArt | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as { ts: number; art: AllArt };
    if (!j?.art || Date.now() - (j.ts ?? 0) > LS_TTL_MS) return null;
    return j.art;
  } catch { return null; }
}

function saveToLocalStorage(art: AllArt) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(LS_KEY, JSON.stringify({ ts: Date.now(), art })); }
  catch { /* quota / SSR */ }
}

// _cache MUSS initial null sein (auch im Browser), sonst Hydration-Mismatch
// zwischen SSR (=null) und Client-Hydrate (=cached). LocalStorage wird erst
// nach Mount via primeFromLocalStorage() reingespielt (siehe useEffect-Hooks).
let _cache: AllArt | null = null;
let _ready = false;
const _listeners = new Set<(m: AllArt) => void>();
const _readyListeners = new Set<(r: boolean) => void>();
let _fetching = false;
let _hasRevalidated = false;
let _primedFromLs = false;

// Hört auf "ma365:artwork-changed" (vom Admin-Upload dispatched) →
// invalidiert localStorage + erzwingt frischen Fetch.
let _changeListenerInstalled = false;
function installArtworkChangeListener() {
  if (_changeListenerInstalled || typeof window === "undefined") return;
  _changeListenerInstalled = true;
  window.addEventListener("ma365:artwork-changed", () => {
    try { window.localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
    _hasRevalidated = false;
    _fetching = false;
    // Neu fetchen — bypass-cache mit ts-Param damit auch CDN umgangen wird
    void (async () => {
      try {
        const r = await fetch(`/api/cosmetic-artwork?ts=${Date.now()}`, { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json() as { resource?: ResourceArtMap; chest?: ResourceArtMap; stronghold?: ResourceArtMap; base_theme?: ResourceArtMap; building?: ResourceArtMap; nameplate?: ResourceArtMap; ui_icon?: ResourceArtMap; troop?: ResourceArtMap; resource_node?: ResourceArtMap; loot_drop?: ResourceArtMap; base_ring?: ResourceArtMap; inventory_item?: ResourceArtMap; modal_background?: ResourceArtMap; rank?: ResourceArtMap; light?: ResourceArtMap; pin_theme?: ResourceArtMap; siegel?: ResourceArtMap; potion?: ResourceArtMap; marker?: Record<string, Record<string, { image_url: string | null; video_url: string | null }>> };
        const fresh: AllArt = { resource: j.resource ?? {}, chest: j.chest ?? {}, stronghold: j.stronghold ?? {}, base_theme: j.base_theme ?? {}, building: j.building ?? {}, nameplate: j.nameplate ?? {}, ui_icon: j.ui_icon ?? {}, troop: j.troop ?? {}, resource_node: j.resource_node ?? {}, loot_drop: j.loot_drop ?? {}, base_ring: j.base_ring ?? {}, inventory_item: j.inventory_item ?? {}, modal_background: j.modal_background ?? {}, rank: j.rank ?? {}, light: j.light ?? {}, pin_theme: j.pin_theme ?? {}, siegel: j.siegel ?? {}, potion: j.potion ?? {}, marker: j.marker ?? {} };
        _cache = fresh;
        _hasRevalidated = true;
        saveToLocalStorage(fresh);
        _listeners.forEach((l) => l(fresh));
      } catch { /* ignore */ }
    })();
  });
}

function primeFromLocalStorage() {
  if (_primedFromLs || _cache) return;
  _primedFromLs = true;
  const cached = loadFromLocalStorage();
  if (cached) {
    _cache = cached;
    _ready = true;
    _listeners.forEach((l) => l(cached));
    _readyListeners.forEach((l) => l(true));
  }
}

function ensureFetch() {
  // 1) zuerst Cache aus localStorage hydratisieren (post-mount, kein SSR-mismatch)
  primeFromLocalStorage();
  if (_cache && _hasRevalidated) return;
  if (_fetching) return;
  _fetching = true;
  installArtworkChangeListener();
  void (async () => {
    try {
      const r = await fetch("/api/cosmetic-artwork", { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json() as { resource?: ResourceArtMap; chest?: ResourceArtMap; stronghold?: ResourceArtMap; base_theme?: ResourceArtMap; building?: ResourceArtMap; nameplate?: ResourceArtMap; ui_icon?: ResourceArtMap; troop?: ResourceArtMap; resource_node?: ResourceArtMap; loot_drop?: ResourceArtMap; base_ring?: ResourceArtMap; inventory_item?: ResourceArtMap; modal_background?: ResourceArtMap; rank?: ResourceArtMap; light?: ResourceArtMap; pin_theme?: ResourceArtMap; siegel?: ResourceArtMap; potion?: ResourceArtMap; marker?: Record<string, Record<string, { image_url: string | null; video_url: string | null }>> };
      const fresh: AllArt = { resource: j.resource ?? {}, chest: j.chest ?? {}, stronghold: j.stronghold ?? {}, base_theme: j.base_theme ?? {}, building: j.building ?? {}, nameplate: j.nameplate ?? {}, ui_icon: j.ui_icon ?? {}, troop: j.troop ?? {}, resource_node: j.resource_node ?? {}, loot_drop: j.loot_drop ?? {}, base_ring: j.base_ring ?? {}, inventory_item: j.inventory_item ?? {}, modal_background: j.modal_background ?? {}, rank: (j as { rank?: ResourceArtMap }).rank ?? {}, light: (j as { light?: ResourceArtMap }).light ?? {}, pin_theme: (j as { pin_theme?: ResourceArtMap }).pin_theme ?? {}, siegel: (j as { siegel?: ResourceArtMap }).siegel ?? {}, potion: (j as { potion?: ResourceArtMap }).potion ?? {}, marker: j.marker ?? {} };
      _cache = fresh;
      _hasRevalidated = true;
      saveToLocalStorage(fresh);
      _listeners.forEach((l) => l(fresh));
    } catch { /* silent */ } finally {
      _fetching = false;
      _ready = true;
      _readyListeners.forEach((l) => l(true));
    }
  })();
}

/**
 * Wartet bis das Cosmetic-Artwork einmal geladen wurde.
 * Verhindert Flicker (Fallback → User-Art) bei Map-Markern, die Art aus DB beziehen.
 */
export function useArtworkReady(): boolean {
  // Initial IMMER false damit Server-HTML (false) und Client-First-Render matchen.
  // useEffect setzt sofort auf true wenn _ready beim Mount bereits true ist.
  const [ready, setReady] = useState<boolean>(false);
  useEffect(() => {
    if (_ready) { setReady(true); return; }
    const sub = (r: boolean) => setReady(r);
    _readyListeners.add(sub);
    ensureFetch();
    return () => { _readyListeners.delete(sub); };
  }, []);
  return ready;
}

export function useResourceArt(): ResourceArtMap {
  const [art, setArt] = useState<ResourceArtMap>({});
  useEffect(() => {
    if (_cache) { setArt(_cache.resource); return; }
    const sub = (m: AllArt) => setArt(m.resource);
    _listeners.add(sub);
    ensureFetch();
    return () => { _listeners.delete(sub); };
  }, []);
  return art;
}

export function useChestArt(): ResourceArtMap {
  const [art, setArt] = useState<ResourceArtMap>({});
  useEffect(() => {
    if (_cache) { setArt(_cache.chest); return; }
    const sub = (m: AllArt) => setArt(m.chest);
    _listeners.add(sub);
    ensureFetch();
    return () => { _listeners.delete(sub); };
  }, []);
  return art;
}

export function useStrongholdArt(): ResourceArtMap {
  const [art, setArt] = useState<ResourceArtMap>({});
  useEffect(() => {
    if (_cache) { setArt(_cache.stronghold); return; }
    const sub = (m: AllArt) => setArt(m.stronghold);
    _listeners.add(sub);
    ensureFetch();
    return () => { _listeners.delete(sub); };
  }, []);
  return art;
}

export function useBaseThemeArt(): ResourceArtMap {
  const [art, setArt] = useState<ResourceArtMap>({});
  useEffect(() => {
    if (_cache) { setArt(_cache.base_theme); return; }
    const sub = (m: AllArt) => setArt(m.base_theme);
    _listeners.add(sub);
    ensureFetch();
    return () => { _listeners.delete(sub); };
  }, []);
  return art;
}

export function useBuildingArt(): ResourceArtMap {
  const [art, setArt] = useState<ResourceArtMap>({});
  useEffect(() => {
    if (_cache) { setArt(_cache.building); return; }
    const sub = (m: AllArt) => setArt(m.building);
    _listeners.add(sub);
    ensureFetch();
    return () => { _listeners.delete(sub); };
  }, []);
  return art;
}

export function useNameplateArt(): ResourceArtMap {
  const [art, setArt] = useState<ResourceArtMap>({});
  useEffect(() => {
    if (_cache) { setArt(_cache.nameplate); return; }
    const sub = (m: AllArt) => setArt(m.nameplate);
    _listeners.add(sub);
    ensureFetch();
    return () => { _listeners.delete(sub); };
  }, []);
  return art;
}

export function useBaseRingArt(): ResourceArtMap {
  const [art, setArt] = useState<ResourceArtMap>({});
  useEffect(() => {
    if (_cache) { setArt(_cache.base_ring); return; }
    const sub = (m: AllArt) => setArt(m.base_ring);
    _listeners.add(sub);
    ensureFetch();
    return () => { _listeners.delete(sub); };
  }, []);
  return art;
}

export function useResourceNodeArt(): ResourceArtMap {
  const [art, setArt] = useState<ResourceArtMap>({});
  useEffect(() => {
    if (_cache) { setArt(_cache.resource_node); return; }
    const sub = (m: AllArt) => setArt(m.resource_node);
    _listeners.add(sub);
    ensureFetch();
    return () => { _listeners.delete(sub); };
  }, []);
  return art;
}

export function useLootDropArt(): ResourceArtMap {
  const [art, setArt] = useState<ResourceArtMap>({});
  useEffect(() => {
    if (_cache) { setArt(_cache.loot_drop); return; }
    const sub = (m: AllArt) => setArt(m.loot_drop);
    _listeners.add(sub);
    ensureFetch();
    return () => { _listeners.delete(sub); };
  }, []);
  return art;
}

export function useInventoryItemArt(): ResourceArtMap {
  const [art, setArt] = useState<ResourceArtMap>({});
  useEffect(() => {
    if (_cache) { setArt(_cache.inventory_item); return; }
    const sub = (m: AllArt) => setArt(m.inventory_item);
    _listeners.add(sub);
    ensureFetch();
    return () => { _listeners.delete(sub); };
  }, []);
  return art;
}

export function useTroopArt(): ResourceArtMap {
  const [art, setArt] = useState<ResourceArtMap>({});
  useEffect(() => {
    if (_cache) { setArt(_cache.troop); return; }
    const sub = (m: AllArt) => setArt(m.troop);
    _listeners.add(sub);
    ensureFetch();
    return () => { _listeners.delete(sub); };
  }, []);
  return art;
}

export function useMarkerArt(): Record<string, Record<string, { image_url: string | null; video_url: string | null }>> {
  const [art, setArt] = useState<AllArt["marker"]>({});
  useEffect(() => {
    if (_cache) { setArt(_cache.marker); return; }
    const sub = (m: AllArt) => setArt(m.marker);
    _listeners.add(sub);
    ensureFetch();
    return () => { _listeners.delete(sub); };
  }, []);
  return art;
}

export function useModalBackgroundArt(): ResourceArtMap {
  const [art, setArt] = useState<ResourceArtMap>({});
  useEffect(() => {
    if (_cache) { setArt(_cache.modal_background); return; }
    const sub = (m: AllArt) => setArt(m.modal_background);
    _listeners.add(sub);
    ensureFetch();
    return () => { _listeners.delete(sub); };
  }, []);
  return art;
}

export function useUiIconArt(): ResourceArtMap {
  const [art, setArt] = useState<ResourceArtMap>({});
  useEffect(() => {
    if (_cache) { setArt(_cache.ui_icon); return; }
    const sub = (m: AllArt) => setArt(m.ui_icon);
    _listeners.add(sub);
    ensureFetch();
    return () => { _listeners.delete(sub); };
  }, []);
  return art;
}

/**
 * Hook: liefert das gesamte AllArt-Objekt aus dem zentralen Cache.
 * Komponenten (app-map, loadout-trio, rank-badge, ...) sollten DIESEN
 * Hook benutzen statt /api/cosmetic-artwork direkt zu fetchen.
 */
export function useAllArt(): AllArt | null {
  const [art, setArt] = useState<AllArt | null>(_cache);
  useEffect(() => {
    if (_cache) { setArt(_cache); return; }
    const sub = (m: AllArt) => setArt(m);
    _listeners.add(sub);
    ensureFetch();
    return () => { _listeners.delete(sub); };
  }, []);
  return art;
}

/**
 * Promise-Variante (für Effekte ohne React-Subscription).
 * Coalesziert mit dem zentralen Cache; löst sich auf, sobald der Fetch
 * abgeschlossen ist (oder sofort, falls schon im Cache).
 */
export function fetchAllArt(): Promise<AllArt | null> {
  if (_cache && _hasRevalidated) return Promise.resolve(_cache);
  return new Promise((resolve) => {
    if (_cache) {
      // LS-Hit: sofort liefern, Revalidate läuft im Hintergrund
      ensureFetch();
      resolve(_cache);
      return;
    }
    const sub = (m: AllArt) => { _listeners.delete(sub); resolve(m); };
    _listeners.add(sub);
    ensureFetch();
    setTimeout(() => { _listeners.delete(sub); resolve(_cache); }, 8000);
  });
}

/**
 * Generischer Entity-Icon für TABLE_TARGETS (Research/Achievement/Boss/XP-Item/...).
 *
 * Anders als ResourceIcon/UiIcon, die Artwork via cosmetic_artwork-Tabelle ziehen,
 * nimmt EntityIcon image_url/video_url direkt von der Entity-Row entgegen.
 * Fallback auf Emoji wenn kein Pfad gesetzt ist.
 */
export function EntityIcon({
  imageUrl, videoUrl, size = 24, fallback, alt, rounded,
}: {
  imageUrl?: string | null;
  videoUrl?: string | null;
  size?: number;
  fallback: string;
  alt?: string;
  /** Wenn true: kreisförmig (für Avatare/Cards). Default: nur objectFit=contain. */
  rounded?: boolean;
}) {
  const baseStyle: React.CSSProperties = {
    width: size, height: size, objectFit: "contain",
    display: "inline-block", verticalAlign: "middle", filter: CHROMA,
    borderRadius: rounded ? "50%" : undefined,
  };
  if (videoUrl) return <video src={videoUrl} autoPlay loop muted playsInline style={baseStyle} />;
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imageUrl} alt={alt ?? ""} style={baseStyle} />;
  }
  return <span style={{ fontSize: size, lineHeight: 1, display: "inline-block", verticalAlign: "middle" }}>{fallback}</span>;
}

/** Generischer UI-Icon — fällt auf Emoji zurück, wenn kein Artwork hochgeladen ist. */
export function UiIcon({ slot, size = 24, fallback, art }: {
  slot: string;
  size?: number;
  fallback: string;
  art: ResourceArtMap;
}) {
  const a = art[slot];
  const baseStyle: React.CSSProperties = {
    width: size, height: size, objectFit: "contain",
    display: "inline-block", verticalAlign: "middle", filter: CHROMA,
  };
  if (a?.video_url) return <video src={a.video_url} autoPlay loop muted playsInline style={baseStyle} />;
  if (a?.image_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={a.image_url} alt={slot} style={baseStyle} />;
  }
  return <span style={{ fontSize: size, lineHeight: 1, display: "inline-block", verticalAlign: "middle" }}>{fallback}</span>;
}

/**
 * Findet die passende Stronghold-Art für ein Level. Probiert in Reihenfolge:
 *   art["level_<n>"]  →  art.default  →  null
 */
export function pickStrongholdArt(art: ResourceArtMap, level: number): { image_url: string | null; video_url: string | null } | null {
  const exact = art[`level_${level}`];
  if (exact && (exact.image_url || exact.video_url)) return exact;
  const wl = art.wegelager;
  if (wl && (wl.image_url || wl.video_url)) return wl;
  const def = art.default;
  if (def && (def.image_url || def.video_url)) return def;
  return null;
}

// Chroma-Key-Filter (Greenscreen #00FF00 → transparent), gleiche Pipeline wie Wächter.
const CHROMA = "url(#ma365-chroma-black)";

/**
 * Unsichtbarer Platzhalter mit gleicher Größe — verhindert Layout-Shift
 * solange der Cosmetic-Artwork-Cache noch nicht hydratisiert ist (kein
 * Fallback-Emoji-Flash bevor das hochgeladene Bild da ist).
 */
function ArtPlaceholder({ size }: { size: number }) {
  return <span style={{ display: "inline-block", verticalAlign: "middle", width: size, height: size }} aria-hidden />;
}

export function ChestIcon({ kind, size = 32, fallback, art }: {
  kind: ChestKind; size?: number; fallback: string; art: ResourceArtMap;
}) {
  const ready = useArtworkReady();
  const a = art[kind];
  const baseStyle: React.CSSProperties = {
    width: size, height: size, objectFit: "contain",
    display: "inline-block", verticalAlign: "middle", filter: CHROMA,
  };
  if (a?.video_url) return <video src={a.video_url} autoPlay loop muted playsInline style={baseStyle} />;
  if (a?.image_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={a.image_url} alt={`${kind}-chest`} style={baseStyle} />;
  }
  // Cache noch nicht geladen → Platzhalter statt Fallback (kein Flash)
  if (!ready) return <ArtPlaceholder size={size} />;
  return <span style={{ fontSize: size, lineHeight: 1, display: "inline-block", verticalAlign: "middle" }}>{fallback}</span>;
}

export function ResourceIcon({
  kind, size = 20, fallback, art,
}: {
  kind: ResourceKind;
  size?: number;
  fallback: string;
  art: ResourceArtMap;
}) {
  const ready = useArtworkReady();
  const a = art[kind];
  const baseStyle: React.CSSProperties = {
    width: size, height: size, objectFit: "contain",
    display: "inline-block", verticalAlign: "middle", filter: CHROMA,
  };
  if (a?.video_url) return <video src={a.video_url} autoPlay loop muted playsInline style={baseStyle} />;
  if (a?.image_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={a.image_url} alt={kind} style={baseStyle} />;
  }
  if (!ready) return <ArtPlaceholder size={size} />;
  return <span style={{ fontSize: size, lineHeight: 1, display: "inline-block", verticalAlign: "middle" }}>{fallback}</span>;
}
