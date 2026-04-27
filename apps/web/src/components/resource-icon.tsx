"use client";

import { useEffect, useState } from "react";

export type ResourceKind = "wood" | "stone" | "gold" | "mana" | "speed_token";
export type ChestKind = "silver" | "gold" | "event";
export type ResourceArtMap = Record<string, { image_url: string | null; video_url: string | null }>;

type AllArt = { resource: ResourceArtMap; chest: ResourceArtMap; stronghold: ResourceArtMap; base_theme: ResourceArtMap; building: ResourceArtMap };

let _cache: AllArt | null = null;
const _listeners = new Set<(m: AllArt) => void>();
let _fetching = false;

function ensureFetch() {
  if (_cache || _fetching) return;
  _fetching = true;
  void (async () => {
    try {
      const r = await fetch("/api/cosmetic-artwork", { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json() as { resource?: ResourceArtMap; chest?: ResourceArtMap; stronghold?: ResourceArtMap; base_theme?: ResourceArtMap; building?: ResourceArtMap };
      _cache = { resource: j.resource ?? {}, chest: j.chest ?? {}, stronghold: j.stronghold ?? {}, base_theme: j.base_theme ?? {}, building: j.building ?? {} };
      _listeners.forEach((l) => l(_cache!));
    } catch { /* silent */ } finally { _fetching = false; }
  })();
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

/**
 * Findet die passende Stronghold-Art für ein Level. Probiert in Reihenfolge:
 *   art["level_<n>"]  →  art.default  →  null
 */
export function pickStrongholdArt(art: ResourceArtMap, level: number): { image_url: string | null; video_url: string | null } | null {
  const exact = art[`level_${level}`];
  if (exact && (exact.image_url || exact.video_url)) return exact;
  const def = art.default;
  if (def && (def.image_url || def.video_url)) return def;
  return null;
}

export function ChestIcon({ kind, size = 32, fallback, art }: {
  kind: ChestKind; size?: number; fallback: string; art: ResourceArtMap;
}) {
  const a = art[kind];
  if (a?.video_url) {
    return <video src={a.video_url} autoPlay loop muted playsInline
      style={{ width: size, height: size, objectFit: "contain", display: "inline-block", verticalAlign: "middle" }} />;
  }
  if (a?.image_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={a.image_url} alt={`${kind}-chest`}
      style={{ width: size, height: size, objectFit: "contain", display: "inline-block", verticalAlign: "middle" }} />;
  }
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
  const a = art[kind];
  if (a?.video_url) {
    return <video src={a.video_url} autoPlay loop muted playsInline
      style={{ width: size, height: size, objectFit: "contain", display: "inline-block", verticalAlign: "middle" }} />;
  }
  if (a?.image_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={a.image_url} alt={kind}
      style={{ width: size, height: size, objectFit: "contain", display: "inline-block", verticalAlign: "middle" }} />;
  }
  return <span style={{ fontSize: size, lineHeight: 1, display: "inline-block", verticalAlign: "middle" }}>{fallback}</span>;
}
