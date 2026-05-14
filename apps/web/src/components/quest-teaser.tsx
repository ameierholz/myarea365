"use client";

/**
 * QuestTeaser — Call-of-Dragons-Style Quest-Vorschau neben dem Quest-Icon.
 *
 * Eingeklappt: NUR ein winziger 14px-Chevron-Button an der unteren-rechten
 *              Ecke des Quest-Icons. Pink-Badge wenn einsammelbare Quests da.
 * Ausgeklappt: Panel mit 5 nächsten Quests + Progress + Top-Belohnungen.
 *              Click auf Quest-Zeile öffnet das volle Modal. ◀-Button im
 *              Header klappt zurück.
 *
 * Auf-/Zuklappen wird in localStorage gemerkt (ma365_quest_teaser_open).
 * Default: eingeklappt (minimaler Screen-Footprint).
 */

import { useEffect, useState } from "react";
import { ResourceIcon, useResourceArt, useChestArt, type ResourceKind } from "@/components/resource-icon";

type RewardItem = { kind: string; amount?: number; code?: string };
type Quest = {
  id: string;
  code: string;
  kind: string;
  name: string;
  icon: string;
  progress: number;
  target_value: number;
  completed_at: string | null;
  claimed_at: string | null;
  rewards: RewardItem[];
};

const KIND_PRIORITY: Record<string, number> = {
  main: 1, daily: 2, side: 3, weekly: 4, seasonal: 5,
};

const LS_KEY = "ma365_quest_teaser_open";

export function QuestTeaser({
  onClick, hidden = false, reloadKey = 0,
}: {
  onClick: () => void;
  hidden?: boolean;
  reloadKey?: number;
}) {
  const [next5, setNext5] = useState<Quest[]>([]);
  const [expanded, setExpanded] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(LS_KEY) === "1";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try { window.localStorage.setItem(LS_KEY, expanded ? "1" : "0"); } catch { /* quota */ }
  }, [expanded]);

  useEffect(() => {
    if (hidden) return;
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch("/api/me/quests", { cache: "no-store" });
        const j = (await r.json()) as { ok: boolean; by_kind?: Record<string, Quest[]> };
        if (cancelled || !j.ok) return;
        const all: Quest[] = [];
        Object.entries(j.by_kind ?? {}).forEach(([kind, list]) => {
          (list ?? []).forEach((q) => all.push({ ...q, kind }));
        });
        const remaining = all.filter((q) => !q.claimed_at);
        remaining.sort((a, b) => {
          const ac = a.completed_at ? 0 : 1;
          const bc = b.completed_at ? 0 : 1;
          if (ac !== bc) return ac - bc;
          const ap = KIND_PRIORITY[a.kind] ?? 99;
          const bp = KIND_PRIORITY[b.kind] ?? 99;
          if (ap !== bp) return ap - bp;
          const aPct = Number(a.progress) / Math.max(1, a.target_value);
          const bPct = Number(b.progress) / Math.max(1, b.target_value);
          return bPct - aPct;
        });
        setNext5(remaining.slice(0, 5));
      } catch { /* silent */ }
    };
    void load();
    const id = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [hidden, reloadKey]);

  if (hidden || next5.length === 0) return null;

  const claimableCount = next5.filter((q) => q.completed_at && !q.claimed_at).length;
  const accent = claimableCount > 0 ? "#FFD700" : "#22D1C3";

  // ─── EINGEKLAPPT: winziger, dezenter Chevron oben an der Ecke vom Quest-Icon ──
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        style={{
          position: "fixed",
          // Quest-Icon: top:82, left:16, 44x44 (sitzt unter Avatar mit gap:12,
          // seit die Buffs neben VIP gewandert sind). Chevron sitzt oben-rechts
          // leicht überlappend → wirkt "angedockt" an der oberen-rechten Icon-Ecke.
          top: 78,
          left: 52,
          width: 14, height: 14, borderRadius: 7,
          background: "rgba(15,17,21,0.65)",
          border: "1px solid rgba(255,255,255,0.22)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          color: "rgba(255,255,255,0.85)",
          cursor: "pointer", padding: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
          zIndex: 9049, pointerEvents: "auto",
          fontFamily: "Inter,-apple-system,sans-serif",
          lineHeight: 1,
        }}
        title={`${next5.length} Quests anzeigen${claimableCount > 0 ? ` · ${claimableCount} einsammelbar` : ""}`}
        aria-label="Quest-Teaser ausklappen"
      >
        <ChevronRight size={8} />
        {claimableCount > 0 && (
          <span style={{
            position: "absolute", top: -2, right: -2,
            width: 7, height: 7, borderRadius: 4,
            background: "#FF2D78",
            border: "1px solid #0F1115",
            boxShadow: "0 0 5px rgba(255,45,120,0.7)",
          }} />
        )}
      </button>
    );
  }

  // ─── AUSGEKLAPPT: schmales Panel mit 5 Quest-Zeilen ──
  return (
    <div style={{
      position: "fixed",
      top: 82,
      left: 64,
      width: "min(176px, calc(100vw - 80px))",
      zIndex: 9049,
      pointerEvents: "auto",
      fontFamily: "Inter,-apple-system,sans-serif",
      background: "linear-gradient(180deg, rgba(15,17,21,0.94), rgba(15,17,21,0.78))",
      border: `1px solid ${accent}55`,
      borderLeft: `3px solid ${accent}`,
      borderRadius: 8,
      overflow: "hidden",
      boxShadow: `0 2px 8px rgba(0,0,0,0.45), 0 0 8px ${accent}22`,
    }}>
      {/* Header mit Einklapp-Button */}
      <div style={{
        padding: "3px 4px 3px 6px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", gap: 4,
      }}>
        <span style={{ fontSize: 11 }}>📜</span>
        <span style={{
          flex: 1, fontSize: 9, fontWeight: 900, letterSpacing: 0.6,
          color: accent,
        }}>QUESTS · {next5.length}{claimableCount > 0 && (
          <span style={{ color: "#FFD700" }}> · {claimableCount}!</span>
        )}</span>
        <button
          onClick={() => setExpanded(false)}
          style={{
            background: "transparent", border: "none",
            color: "rgba(255,255,255,0.55)",
            cursor: "pointer", padding: "2px 4px",
            lineHeight: 1, borderRadius: 3,
            fontFamily: "inherit",
            display: "inline-flex", alignItems: "center",
          }}
          aria-label="Quest-Teaser einklappen"
          title="Einklappen"
        ><ChevronLeft size={9} /></button>
      </div>

      {/* 5 Quest-Zeilen */}
      {next5.map((q, idx) => (
        <TeaserRow
          key={q.id}
          quest={q}
          isLast={idx === next5.length - 1}
          onClick={onClick}
        />
      ))}
    </div>
  );
}

function TeaserRow({
  quest: q, isLast, onClick,
}: {
  quest: Quest; isLast: boolean; onClick: () => void;
}) {
  const isClaimable = !!q.completed_at && !q.claimed_at;
  const pct = Math.min(100, Math.round((Number(q.progress) / Math.max(1, q.target_value)) * 100));
  const accent = isClaimable ? "#FFD700" : "#22D1C3";

  return (
    <button
      onClick={onClick}
      style={{
        display: "grid",
        gridTemplateColumns: "18px 1fr",
        gap: 4,
        padding: "4px 6px 5px 6px",
        background: isClaimable ? `${accent}1a` : "transparent",
        border: "none",
        borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.05)",
        width: "100%",
        textAlign: "left",
        cursor: "pointer",
        color: "#FFF",
        fontFamily: "inherit",
      }}
      title={`${q.name} — ${Math.floor(q.progress)}/${q.target_value}`}
    >
      <span style={{
        fontSize: 13, lineHeight: 1, alignSelf: "center",
        filter: isClaimable ? `drop-shadow(0 0 3px ${accent}88)` : "none",
      }}>{q.icon}</span>
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
        <div style={{
          fontSize: 9, fontWeight: 800,
          color: isClaimable ? accent : "#FFF",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          lineHeight: 1.2,
        }}>{q.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <div style={{
            flex: "0 0 30px",
            height: 2, background: "rgba(255,255,255,0.1)",
            borderRadius: 1, overflow: "hidden", position: "relative",
          }}>
            <div style={{
              position: "absolute", inset: 0, right: `${100 - pct}%`,
              background: accent,
            }} />
          </div>
          <span style={{
            fontSize: 7, fontWeight: 700,
            color: isClaimable ? accent : "rgba(255,255,255,0.55)",
            fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap",
            flexShrink: 0,
          }}>{Math.floor(q.progress)}/{q.target_value}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "nowrap", overflow: "hidden", minWidth: 0 }}>
            {q.rewards.slice(0, 2).map((r, i) => <MiniReward key={i} reward={r} />)}
          </div>
        </div>
      </div>
    </button>
  );
}

function ChevronRight({ size = 8 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" fill="none" style={{ display: "block" }} aria-hidden>
      <path d="M2.75 1.25L5.5 4L2.75 6.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronLeft({ size = 8 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" fill="none" style={{ display: "block" }} aria-hidden>
      <path d="M5.25 1.25L2.5 4L5.25 6.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MiniReward({ reward }: { reward: RewardItem }) {
  const resourceArt = useResourceArt();
  const chestArt = useChestArt();
  const amount = reward.amount ?? 1;
  const short = amount >= 1000 ? `${Math.round(amount / 100) / 10}k` : String(amount);

  const renderIcon = () => {
    const size = 9;
    if (reward.kind === "gems") return <span style={{ fontSize: 8 }}>💎</span>;
    if (reward.kind === "xp")   return <span style={{ fontSize: 8 }}>⭐</span>;
    if (reward.kind === "wood")        return <ResourceIcon kind="wood"        fallback="🔩" size={size} art={resourceArt} />;
    if (reward.kind === "stone")       return <ResourceIcon kind="stone"       fallback="⚙️" size={size} art={resourceArt} />;
    if (reward.kind === "gold")        return <ResourceIcon kind="gold"        fallback="💰" size={size} art={resourceArt} />;
    if (reward.kind === "mana")        return <ResourceIcon kind="mana"        fallback="📡" size={size} art={resourceArt} />;
    if (reward.kind === "speed_token") return <ResourceIcon kind={"speed_token" as ResourceKind} fallback="⚡" size={size} art={resourceArt} />;
    if (reward.kind === "item" && reward.code) {
      const code = reward.code;
      if (code.startsWith("chest_")) {
        const chestKind = code.replace("chest_", "");
        const a = chestArt[chestKind];
        if (a?.image_url) {
          // eslint-disable-next-line @next/next/no-img-element
          return <img src={a.image_url} alt={code} style={{ width: size, height: size, objectFit: "contain" }} />;
        }
        return <span style={{ fontSize: 8 }}>🎁</span>;
      }
      if (code.startsWith("xp_pot_")) return <span style={{ fontSize: 8 }}>🧪</span>;
      return <span style={{ fontSize: 8 }}>📦</span>;
    }
    return null;
  };

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 1,
      fontSize: 7, fontWeight: 800, color: "rgba(255,255,255,0.8)",
      fontVariantNumeric: "tabular-nums",
      whiteSpace: "nowrap",
    }}>
      {renderIcon()}{short}
    </span>
  );
}
