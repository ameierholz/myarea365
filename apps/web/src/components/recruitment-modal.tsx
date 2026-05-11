"use client";

import { useCallback, useEffect, useState } from "react";

type Tier = "silver" | "gold";
type PreviewTier = {
  label: string;
  chance_pct: number;
  color: string;
  contains: string[];
};
type Pity = {
  silver_opened?: number;
  gold_opened?: number;
  pity_epic_counter?: number;
  pity_leg_counter?: number;
  epic_guaranteed_in?: number;
  legendary_guaranteed_in?: number;
};
type MedalRow = {
  archetype_id: string;
  name: string;
  emoji: string;
  rarity: string;
  count: number;
  required: number;
};
type PreviewResponse = {
  tier: Tier;
  pity: Pity;
  tiers: PreviewTier[];
  stock: { chests: number; keys: number; medals: MedalRow[] };
};

type RewardItem =
  | { kind: "rss"; wood: number; stone: number; gold: number; mana: number; gems: number }
  | { kind: "medal"; archetype_id: string; archetype_name: string; count: number }
  | { kind: "hero_unlock"; archetype_id: string; archetype_name: string; rarity: string };

type PullResult = {
  ok: boolean;
  tier?: Tier;
  rarity?: "common" | "rare" | "epic" | "legend";
  drop_kind?: "material" | "medal" | "hero";
  reward?: RewardItem[];
  pity_triggered?: string | null;
  pity_epic?: number;
  pity_leg?: number;
  error?: string;
};

const TIER_BG: Record<Tier, string> = {
  silver: "linear-gradient(160deg, #3a4a55 0%, #1a2730 100%)",
  gold:   "linear-gradient(160deg, #6b4e1f 0%, #3b2a10 100%)",
};
const TIER_ACCENT: Record<Tier, string> = { silver: "#5ddaf0", gold: "#FFD700" };
const TIER_LABEL: Record<Tier, string> = { silver: "Silbertruhe", gold: "Goldtruhe" };
const TIER_EMOJI: Record<Tier, string> = { silver: "🥈", gold: "🥇" };

const RARITY_COLOR: Record<string, string> = {
  common: "#4ade80", rare: "#5ddaf0", epic: "#a855f7", legend: "#FFD700",
  advanced: "#4ade80", elite: "#5ddaf0", legendary: "#FFD700",
};

export function RecruitmentModal({ initialTier = "silver", onClose }: {
  initialTier?: Tier;
  onClose: () => void;
}) {
  const [tier, setTier] = useState<Tier>(initialTier);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [lastResult, setLastResult] = useState<PullResult | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/recruitment/preview?tier=${tier}`, { cache: "no-store" });
    if (r.ok) setPreview(await r.json() as PreviewResponse);
  }, [tier]);

  useEffect(() => { void load(); }, [load]);

  const canPull = (preview?.stock.chests ?? 0) >= 1 && (preview?.stock.keys ?? 0) >= 1;

  async function pull() {
    if (!canPull || pulling) return;
    setPulling(true); setLastResult(null);
    try {
      const r = await fetch("/api/recruitment/pull", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const j = await r.json() as PullResult;
      setLastResult(j);
      await load();
    } finally {
      setPulling(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9200,
        background: "rgba(15,17,21,0.92)", backdropFilter: "blur(14px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 8,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 440, width: "100%", maxHeight: "100dvh", overflowY: "auto",
          background: TIER_BG[tier], borderRadius: 16,
          border: `2px solid ${TIER_ACCENT[tier]}55`,
          boxShadow: `0 0 40px ${TIER_ACCENT[tier]}33`,
          color: "#FFF",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ flex: 1, fontSize: 12, fontWeight: 900, letterSpacing: 1.5, textTransform: "uppercase" }}>
            🛡 Wächter-Rekrutierung
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#FFF", fontSize: 20, cursor: "pointer", padding: 4 }}>✕</button>
        </div>

        {/* Tab-Switcher */}
        <div style={{ display: "flex", gap: 4, padding: "8px 10px", background: "rgba(0,0,0,0.25)" }}>
          {(["silver","gold"] as Tier[]).map((t) => (
            <button
              key={t}
              onClick={() => setTier(t)}
              style={{
                flex: 1, padding: "8px 12px", borderRadius: 8,
                background: t === tier ? `${TIER_ACCENT[t]}33` : "rgba(255,255,255,0.05)",
                border: t === tier ? `1.5px solid ${TIER_ACCENT[t]}` : "1px solid transparent",
                color: t === tier ? TIER_ACCENT[t] : "#a8b4cf",
                fontSize: 12, fontWeight: 900, cursor: "pointer",
              }}
            >
              {TIER_EMOJI[t]} {TIER_LABEL[t]}
            </button>
          ))}
        </div>

        {/* Stock + Pity */}
        <div style={{ padding: "12px 14px", textAlign: "center" }}>
          <div style={{ fontSize: 64, lineHeight: 1, marginBottom: 6 }}>{TIER_EMOJI[tier]}</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: TIER_ACCENT[tier], marginBottom: 8 }}>{TIER_LABEL[tier]}</div>

          <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 8 }}>
            <Stat label="Truhen" value={preview?.stock.chests ?? "?"} accent={TIER_ACCENT[tier]} />
            <Stat label="Schlüssel" value={preview?.stock.keys ?? "?"} accent={TIER_ACCENT[tier]} />
          </div>

          {tier === "gold" && preview?.pity && (
            <div style={{ fontSize: 10, color: "#a8b4cf", marginBottom: 8 }}>
              Episch garantiert in <strong style={{ color: "#a855f7" }}>{preview.pity.epic_guaranteed_in}</strong> ·
              Legendär garantiert in <strong style={{ color: "#FFD700" }}>{preview.pity.legendary_guaranteed_in}</strong>
            </div>
          )}

          {/* Result-Banner */}
          {lastResult && lastResult.ok && (
            <div style={{
              padding: 10, borderRadius: 10, marginBottom: 10,
              background: `${RARITY_COLOR[lastResult.rarity ?? "common"]}22`,
              border: `1.5px solid ${RARITY_COLOR[lastResult.rarity ?? "common"]}`,
            }}>
              {lastResult.pity_triggered && (
                <div style={{ fontSize: 9, fontWeight: 900, color: "#FFD700", marginBottom: 4 }}>
                  ⭐ PITY GARANTIE: {lastResult.pity_triggered.toUpperCase()}
                </div>
              )}
              {(lastResult.reward ?? []).map((r, i) => <RewardLine key={i} reward={r} />)}
            </div>
          )}
          {lastResult && !lastResult.ok && (
            <div style={{ padding: 10, borderRadius: 10, marginBottom: 10, background: "rgba(255,45,120,0.15)", border: "1px solid rgba(255,45,120,0.5)", fontSize: 11, color: "#FF6BA1" }}>
              ❌ {lastResult.error}
            </div>
          )}

          <button
            onClick={pull}
            disabled={!canPull || pulling}
            style={{
              width: "100%", padding: "14px 20px", borderRadius: 12,
              background: canPull ? `linear-gradient(135deg, ${TIER_ACCENT[tier]}, #FFF)` : "rgba(120,120,120,0.2)",
              border: "none",
              color: canPull ? "#0F1115" : "#8B8FA3",
              fontSize: 14, fontWeight: 900, letterSpacing: 1,
              cursor: canPull && !pulling ? "pointer" : "not-allowed",
              marginBottom: 6,
            }}
          >
            {pulling ? "ZIEHE…" : canPull ? "ZIEHEN (1× Truhe + 1× Schlüssel)" : !preview ? "Lade…" : (preview.stock.chests < 1 ? "Keine Truhe" : "Kein Schlüssel")}
          </button>

          <button
            onClick={() => setShowPreview((s) => !s)}
            style={{
              width: "100%", padding: "8px 12px", borderRadius: 10,
              background: "transparent", border: "1px solid rgba(255,255,255,0.15)",
              color: "#a8b4cf", fontSize: 10, fontWeight: 700, cursor: "pointer",
            }}
          >
            {showPreview ? "▲ Belohnungsvorschau ausblenden" : "▼ Belohnungsvorschau"}
          </button>
        </div>

        {/* Belohnungsvorschau */}
        {showPreview && preview?.tiers && (
          <div style={{ padding: "0 14px 12px" }}>
            {preview.tiers.map((row, i) => (
              <div key={i} style={{ padding: 8, marginBottom: 6, borderRadius: 8, background: "rgba(0,0,0,0.3)", border: `1px solid ${row.color}33` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 900, color: row.color }}>{row.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 900, color: row.color }}>{row.chance_pct.toFixed(2)}%</span>
                </div>
                {row.contains.map((c, j) => (
                  <div key={j} style={{ fontSize: 10, color: "#dde3f5", paddingLeft: 8 }}>· {c}</div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Marken-Stand */}
        {preview?.stock.medals && preview.stock.medals.length > 0 && (
          <div style={{ padding: "0 14px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1.5, color: "#a8b4cf", marginBottom: 6, textTransform: "uppercase" }}>
              🎖 Deine Marken
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {preview.stock.medals.slice(0, 8).map((m) => (
                <div key={m.archetype_id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", borderRadius: 6, background: "rgba(0,0,0,0.25)" }}>
                  <span style={{ fontSize: 16 }}>{m.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 900, color: RARITY_COLOR[m.rarity] ?? "#FFF" }}>{m.name}</div>
                    <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden", marginTop: 2 }}>
                      <div style={{
                        height: "100%",
                        width: `${Math.min(100, (m.count / m.required) * 100)}%`,
                        background: RARITY_COLOR[m.rarity] ?? "#FFF",
                      }} />
                    </div>
                  </div>
                  <span style={{ fontSize: 10, color: "#a8b4cf", fontVariantNumeric: "tabular-nums" }}>
                    {m.count}/{m.required}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div style={{ padding: "4px 12px", borderRadius: 8, background: "rgba(0,0,0,0.3)", minWidth: 60 }}>
      <div style={{ fontSize: 9, color: "#a8b4cf" }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 900, color: accent, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

function RewardLine({ reward }: { reward: RewardItem }) {
  if (reward.kind === "rss") {
    const parts = [
      reward.wood > 0 && `+${reward.wood.toLocaleString("de-DE")} Tech-Schrott`,
      reward.stone > 0 && `+${reward.stone.toLocaleString("de-DE")} Komponenten`,
      reward.gold > 0 && `+${reward.gold.toLocaleString("de-DE")} Krypto`,
      reward.mana > 0 && `+${reward.mana.toLocaleString("de-DE")} Bandbreite`,
      reward.gems > 0 && `+${reward.gems} Diamanten`,
    ].filter(Boolean);
    return <div style={{ fontSize: 11, color: "#FFD700", fontWeight: 700 }}>📦 {parts.join(" · ")}</div>;
  }
  if (reward.kind === "medal") {
    return <div style={{ fontSize: 12, color: "#FFF", fontWeight: 900 }}>🎖 +{reward.count}× {reward.archetype_name}-Marke</div>;
  }
  if (reward.kind === "hero_unlock") {
    return (
      <div style={{ fontSize: 13, color: RARITY_COLOR[reward.rarity] ?? "#FFF", fontWeight: 900 }}>
        ⭐ {reward.archetype_name} freigeschaltet!
      </div>
    );
  }
  return null;
}
