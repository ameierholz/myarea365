"use client";

import { useEffect, useState } from "react";

export type ResourceKind = "wood" | "stone" | "gold" | "mana" | "speed_token";
export type ChestKind = "silver" | "gold" | "event";
export type ResourceArtMap = Record<string, { image_url: string | null; video_url: string | null }>;

type AllArt = { resource: ResourceArtMap; chest: ResourceArtMap; stronghold: ResourceArtMap; base_theme: ResourceArtMap; building: ResourceArtMap; nameplate: ResourceArtMap; ui_icon: ResourceArtMap; troop: ResourceArtMap; resource_node: ResourceArtMap; loot_drop: ResourceArtMap; base_ring: ResourceArtMap; inventory_item: ResourceArtMap; marker: Record<string, Record<string, { image_url: string | null; video_url: string | null }>> };

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
        const j = await r.json() as { resource?: ResourceArtMap; chest?: ResourceArtMap; stronghold?: ResourceArtMap; base_theme?: ResourceArtMap; building?: ResourceArtMap; nameplate?: ResourceArtMap; ui_icon?: ResourceArtMap; troop?: ResourceArtMap; resource_node?: ResourceArtMap; loot_drop?: ResourceArtMap; base_ring?: ResourceArtMap; inventory_item?: ResourceArtMap; marker?: Record<string, Record<string, { image_url: string | null; video_url: string | null }>> };
        const fresh: AllArt = { resource: j.resource ?? {}, chest: j.chest ?? {}, stronghold: j.stronghold ?? {}, base_theme: j.base_theme ?? {}, building: j.building ?? {}, nameplate: j.nameplate ?? {}, ui_icon: j.ui_icon ?? {}, troop: j.troop ?? {}, resource_node: j.resource_node ?? {}, loot_drop: j.loot_drop ?? {}, base_ring: j.base_ring ?? {}, inventory_item: j.inventory_item ?? {}, marker: j.marker ?? {} };
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
      const j = await r.json() as { resource?: ResourceArtMap; chest?: ResourceArtMap; stronghold?: ResourceArtMap; base_theme?: ResourceArtMap; building?: ResourceArtMap; nameplate?: ResourceArtMap; ui_icon?: ResourceArtMap; troop?: ResourceArtMap; resource_node?: ResourceArtMap; loot_drop?: ResourceArtMap; base_ring?: ResourceArtMap; inventory_item?: ResourceArtMap; marker?: Record<string, Record<string, { image_url: string | null; video_url: string | null }>> };
      const fresh: AllArt = { resource: j.resource ?? {}, chest: j.chest ?? {}, stronghold: j.stronghold ?? {}, base_theme: j.base_theme ?? {}, building: j.building ?? {}, nameplate: j.nameplate ?? {}, ui_icon: j.ui_icon ?? {}, troop: j.troop ?? {}, resource_node: j.resource_node ?? {}, loot_drop: j.loot_drop ?? {}, base_ring: j.base_ring ?? {}, inventory_item: j.inventory_item ?? {}, marker: j.marker ?? {} };
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
  const [ready, setReady] = useState<boolean>(_ready);
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
  const [art, setArt] = useState<ResourceArtMap>(_cache?.resource ?? {});
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
  const [art, setArt] = useState<ResourceArtMap>(_cache?.chest ?? {});
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
  const [art, setArt] = useState<ResourceArtMap>(_cache?.stronghold ?? {});
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
  const [art, setArt] = useState<ResourceArtMap>(_cache?.base_theme ?? {});
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
  const [art, setArt] = useState<ResourceArtMap>(_cache?.building ?? {});
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
  const [art, setArt] = useState<ResourceArtMap>(_cache?.nameplate ?? {});
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
  const [art, setArt] = useState<ResourceArtMap>(_cache?.base_ring ?? {});
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
  const [art, setArt] = useState<ResourceArtMap>(_cache?.resource_node ?? {});
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
  const [art, setArt] = useState<ResourceArtMap>(_cache?.loot_drop ?? {});
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
  const [art, setArt] = useState<ResourceArtMap>(_cache?.inventory_item ?? {});
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
  const [art, setArt] = useState<ResourceArtMap>(_cache?.troop ?? {});
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
  const [art, setArt] = useState(_cache?.marker ?? {});
  useEffect(() => {
    if (_cache) { setArt(_cache.marker); return; }
    const sub = (m: AllArt) => setArt(m.marker);
    _listeners.add(sub);
    ensureFetch();
    return () => { _listeners.delete(sub); };
  }, []);
  return art;
}

export function useUiIconArt(): ResourceArtMap {
  const [art, setArt] = useState<ResourceArtMap>(_cache?.ui_icon ?? {});
  useEffect(() => {
    if (_cache) { setArt(_cache.ui_icon); return; }
    const sub = (m: AllArt) => setArt(m.ui_icon);
    _listeners.add(sub);
    ensureFetch();
    return () => { _listeners.delete(sub); };
  }, []);
  return art;
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
