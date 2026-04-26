"use client";

import { useEffect, useState } from "react";
import { RUNNER_RANKS } from "@/lib/game-config";

export type RankArtMap = Record<string, { image_url: string | null; video_url: string | null }>;

let _rankArtCache: RankArtMap | null = null;
const _rankArtListeners = new Set<(m: RankArtMap) => void>();
let _rankArtFetching = false;

export function useRankArt(): RankArtMap {
  const [art, setArt] = useState<RankArtMap>(_rankArtCache ?? {});
  useEffect(() => {
    if (_rankArtCache) { setArt(_rankArtCache); return; }
    _rankArtListeners.add(setArt);
    if (!_rankArtFetching) {
      _rankArtFetching = true;
      void (async () => {
        try {
          const r = await fetch("/api/cosmetic-artwork", { cache: "no-store" });
          if (!r.ok) return;
          const j = await r.json() as { rank?: RankArtMap };
          _rankArtCache = j.rank ?? {};
          _rankArtListeners.forEach((l) => l(_rankArtCache!));
        } catch { /* silent */ } finally { _rankArtFetching = false; }
      })();
    }
    return () => { _rankArtListeners.delete(setArt); };
  }, []);
  return art;
}

export function rankIdByName(name: string | undefined | null): number | null {
  if (!name) return null;
  const hit = RUNNER_RANKS.find((r) => r.name === name);
  return hit?.id ?? null;
}

export function rankIdByXp(xp: number | null | undefined): number | null {
  if (xp == null) return null;
  let id: number = RUNNER_RANKS[0].id;
  for (const r of RUNNER_RANKS) {
    if (xp >= r.minXp) id = r.id;
  }
  return id;
}

export function rankColorById(id: number | null): string {
  if (id == null) return "#FFD700";
  return RUNNER_RANKS.find((r) => r.id === id)?.color ?? "#FFD700";
}

export function RankBadge({
  rankId, color, size = 32, rankArt,
  fallbackEmoji = "🏅", showNumberOverlay = false,
}: {
  rankId: number;
  color: string;
  size?: number;
  rankArt: RankArtMap;
  fallbackEmoji?: string;
  showNumberOverlay?: boolean;
}) {
  const art = rankArt[`rank_${rankId}`];
  const hasArt = !!(art?.image_url || art?.video_url);
  const radius = Math.max(6, Math.round(size * 0.22));
  return (
    <div style={{
      width: size, height: size, borderRadius: radius,
      background: hasArt ? "rgba(15,17,21,0.55)" : `linear-gradient(135deg, ${color}cc, ${color}66)`,
      border: hasArt ? `1px solid ${color}66` : `1px solid ${color}aa`,
      boxShadow: `0 0 ${Math.round(size * 0.3)}px ${color}55`,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0, overflow: "hidden", position: "relative",
    }}>
      {art?.video_url ? (
        <video src={art.video_url} autoPlay loop muted playsInline
          style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      ) : art?.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={art.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      ) : (
        <span style={{ fontSize: Math.round(size * 0.5), lineHeight: 1 }}>{fallbackEmoji}</span>
      )}
      {hasArt && showNumberOverlay && (
        <span style={{
          position: "absolute", bottom: 1, right: 2,
          fontSize: Math.max(8, Math.round(size * 0.22)), fontWeight: 900, color: "#FFF",
          textShadow: "0 1px 2px rgba(0,0,0,0.9)",
          padding: "1px 4px", borderRadius: 4,
          background: `${color}cc`,
        }}>{rankId}</span>
      )}
    </div>
  );
}
