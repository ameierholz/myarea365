"use client";

import { useEffect, useState } from "react";

export type ResourceKind = "wood" | "stone" | "gold" | "mana" | "speed_token";
export type ResourceArtMap = Record<string, { image_url: string | null; video_url: string | null }>;

let _cache: ResourceArtMap | null = null;
const _listeners = new Set<(m: ResourceArtMap) => void>();
let _fetching = false;

export function useResourceArt(): ResourceArtMap {
  const [art, setArt] = useState<ResourceArtMap>(_cache ?? {});
  useEffect(() => {
    if (_cache) { setArt(_cache); return; }
    _listeners.add(setArt);
    if (!_fetching) {
      _fetching = true;
      void (async () => {
        try {
          const r = await fetch("/api/cosmetic-artwork", { cache: "no-store" });
          if (!r.ok) return;
          const j = await r.json() as { resource?: ResourceArtMap };
          _cache = j.resource ?? {};
          _listeners.forEach((l) => l(_cache!));
        } catch { /* silent */ } finally { _fetching = false; }
      })();
    }
    return () => { _listeners.delete(setArt); };
  }, []);
  return art;
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
