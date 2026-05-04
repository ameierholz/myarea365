"use client";

import { useEffect, useMemo, useState } from "react";
import { useResourceArt, ResourceIcon, type ResourceKind } from "@/components/resource-icon";

export type TroopDef = {
  id: string; name: string; emoji: string; troop_class: string; tier: number;
  base_atk: number; base_def: number; base_hp: number;
  cost_wood: number; cost_stone: number; cost_gold: number; cost_mana: number;
  train_time_seconds: number; required_building_level: number; description: string;
};

const CLASS_LABEL: Record<string, string> = {
  infantry:  "🛡 Türsteher",
  cavalry:   "🏍 Kurier",
  marksman:  "🎯 Schütze",
  siege:     "🔨 Brecher",
  collector: "📦 Sammler",
};
const CLASS_KIND: Record<string, string> = {
  infantry: "Nahkampf", cavalry: "Reiter", marksman: "Fernkampf", siege: "Schwer", collector: "Sammeln",
};
const CLASS_GRADIENT: Record<string, string> = {
  infantry:  "linear-gradient(180deg, #1e3a5f 0%, #0f1f33 100%)",
  cavalry:   "linear-gradient(180deg, #5b3b1f 0%, #2a1c0e 100%)",
  marksman:  "linear-gradient(180deg, #1f5b3b 0%, #0e2a1c 100%)",
  siege:     "linear-gradient(180deg, #5b1f3b 0%, #2a0e1c 100%)",
  collector: "linear-gradient(180deg, #1f4a2c 0%, #0e2517 100%)",
};

function fmtTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2,"0")}m`;
  return `${m}m ${s.toString().padStart(2,"0")}s`;
}

export function TroopDetailModal({
  catalog, owned, initialTroopId, onClose, onTrained, gemsAvailable, caps,
}: {
  catalog: TroopDef[];
  owned: Map<string, number>;
  initialTroopId: string;
  onClose: () => void;
  onTrained: () => void | Promise<void>;
  gemsAvailable: number;
  /** Trainings-Cap pro Klasse: Gebäude-Level × 10 */
  caps: Record<string, number>;
}) {
  const resourceArt = useResourceArt();
  // Aktuelle Klasse aus initial-Troop ableiten, dann Tier-Switching innerhalb der Klasse
  const initial = catalog.find((t) => t.id === initialTroopId);
  const [troopClass] = useState<string>(initial?.troop_class ?? "infantry");
  const [tier, setTier] = useState<number>(initial?.tier ?? 1);
  const [count, setCount] = useState<number>(100);
  const [busy, setBusy] = useState<null | "instant" | "train">(null);
  const [msg, setMsg] = useState<string | null>(null);

  // Aktive Truppe = höchstes verfügbares Tier in der gewählten Klasse, das ≤ tier ist
  const classTroops = useMemo(
    () => catalog.filter((t) => t.troop_class === troopClass).sort((a, b) => a.tier - b.tier),
    [catalog, troopClass]
  );
  const troop = classTroops.find((t) => t.tier === tier) ?? classTroops[0];

  if (!troop) return null;

  const maxAtOnce = Math.max(1, caps[troopClass] ?? 0);
  const safeCount = Math.min(count, maxAtOnce);
  const totalSeconds = troop.train_time_seconds * safeCount;
  const costWood  = troop.cost_wood  * safeCount;
  const costStone = troop.cost_stone * safeCount;
  const costGold  = troop.cost_gold  * safeCount;
  const costMana  = troop.cost_mana  * safeCount;
  const gemCost   = Math.max(1, Math.ceil(totalSeconds / 60));
  const enoughGems = gemsAvailable >= gemCost;

  const grad = CLASS_GRADIENT[troopClass] ?? CLASS_GRADIENT.infantry;

  async function action(instant: boolean) {
    setBusy(instant ? "instant" : "train"); setMsg(null);
    try {
      const r = await fetch("/api/base/troops", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ troop_id: troop!.id, count: safeCount, instant }),
      });
      const j = await r.json() as { ok?: boolean; error?: string; seconds?: number; training_seconds?: number; gem_cost?: number; max_at_once?: number };
      if (j.ok) {
        await onTrained();
        if (instant) setMsg(`✓ ${safeCount}× ${troop!.name} sofort trainiert (-${j.gem_cost} 💎)`);
        else setMsg(`✓ ${safeCount}× ${troop!.name} im Training (${fmtTime(j.training_seconds ?? j.seconds ?? totalSeconds)})`);
      } else if (j.error === "not_enough_gems") setMsg(`💎 Nicht genug Diamanten.`);
      else if (j.error === "tier_locked") setMsg("Tier noch nicht erforscht — siehe Forschung-Tab.");
      else if (j.error === "building_required") setMsg("Trainings-Gebäude fehlt.");
      else if (j.error === "building_level_too_low") setMsg("Trainings-Gebäude zu niedrig.");
      else if (j.error === "too_many_at_once") setMsg(`Max ${j.max_at_once} pro Auftrag.`);
      else if (j.error === "not_enough_resources") setMsg("Nicht genug Resourcen.");
      else setMsg(j.error ?? "Fehler");
    } finally { setBusy(null); }
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-[9300] bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-2 sm:p-4">
      <div onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[96vh]"
        style={{ background: grad }}>
        {/* Close */}
        <button onClick={onClose} aria-label="Schließen"
          className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-black/50 text-white text-lg font-black backdrop-blur">×</button>

        {/* Hero-Section */}
        <div className="relative flex flex-col sm:flex-row gap-3 sm:gap-5 p-4 sm:p-6 pb-2 overflow-y-auto">
          {/* Portrait */}
          <div className="relative shrink-0 w-full sm:w-56 h-56 sm:h-64 rounded-2xl overflow-hidden flex items-center justify-center"
            style={{ background: "radial-gradient(circle at 50% 35%, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.05) 60%, transparent 100%)" }}>
            <div style={{ fontSize: 140, filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.6))" }}>{troop.emoji}</div>
            {/* Goldener Ring-Akzent */}
            <div className="absolute inset-2 rounded-2xl pointer-events-none" style={{ border: "2px solid rgba(255,215,0,0.35)" }} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-wide">⚔ {troop.name.toUpperCase()}</h2>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="text-[10px] font-black px-2 py-1 rounded-full bg-[#FF2D78]/20 text-[#FF6B9A] border border-[#FF2D78]/40">{CLASS_LABEL[troop.troop_class] ?? troop.troop_class}</span>
              <span className="text-[10px] font-black px-2 py-1 rounded-full bg-[#22D1C3]/20 text-[#22D1C3] border border-[#22D1C3]/40">{CLASS_KIND[troop.troop_class] ?? "—"}</span>
              <span className="text-[10px] font-black px-2 py-1 rounded-full bg-[#FFD700]/20 text-[#FFD700] border border-[#FFD700]/40">T{troop.tier}</span>
            </div>
            <p className="text-[12px] text-white/85 mt-3 leading-snug">{troop.description}</p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 mt-3">
              <Stat label="Angriff"      value={troop.base_atk} color="#FF6B4A" />
              <Stat label="Verteidigung" value={troop.base_def} color="#22D1C3" />
              <Stat label="Leben"        value={troop.base_hp}  color="#4ade80" />
            </div>

            {/* Quantity-Slider + Live-Cost */}
            <div className="mt-3 rounded-xl bg-black/35 border border-white/10 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black tracking-widest text-white/70">
                  ANZAHL <span className="text-white/40 ml-1">max {maxAtOnce.toLocaleString("de-DE")}</span>
                </span>
                <input type="number" min={1} max={maxAtOnce} value={safeCount}
                  onChange={(e) => setCount(Math.max(1, Math.min(maxAtOnce, parseInt(e.target.value) || 1)))}
                  className="w-24 text-right px-2 py-1 rounded bg-black/50 border border-white/15 text-white text-[14px] font-black" />
              </div>
              <input type="range" min={1} max={maxAtOnce} value={safeCount}
                onChange={(e) => setCount(parseInt(e.target.value))}
                className="w-full accent-[#FFD700]" />
              <div className="flex justify-between text-[9px] text-white/50 mt-1">
                {[
                  Math.max(1, Math.floor(maxAtOnce * 0.05)),
                  Math.max(1, Math.floor(maxAtOnce * 0.25)),
                  Math.max(1, Math.floor(maxAtOnce * 0.50)),
                  Math.max(1, Math.floor(maxAtOnce * 0.75)),
                  maxAtOnce,
                ].map((v, i) => (
                  <button key={i} onClick={() => setCount(v)}>{v.toLocaleString("de-DE")}</button>
                ))}
              </div>
              {maxAtOnce <= 10 && (
                <div className="text-[9px] text-[#FF6B9A] mt-2 text-center">
                  ⓘ Cap = Gebäude-Lv × 10. Baue {troop.troop_class === "infantry" ? "Bar" : troop.troop_class === "cavalry" ? "Garage" : troop.troop_class === "marksman" ? "Gym" : troop.troop_class === "collector" ? "Depot" : "Werkhof"} aus für mehr.
                </div>
              )}

              {/* Cost */}
              <div className="grid grid-cols-4 gap-1.5 mt-3">
                <CostChip kind="gold"  fallback="💸" value={costGold}  label="Krypto"        art={resourceArt} />
                <CostChip kind="wood"  fallback="⚙️" value={costWood}  label="Tech-Schrott"  art={resourceArt} />
                <CostChip kind="stone" fallback="🔩" value={costStone} label="Komponenten"   art={resourceArt} />
                <CostChip kind="mana"  fallback="📡" value={costMana}  label="Bandbreite"    art={resourceArt} />
              </div>
              <div className="text-[10px] text-white/60 mt-2 text-center">
                Vorrat: <b className="text-[#FFD700]">{(owned.get(troop.id) ?? 0).toLocaleString("de-DE")}</b>
              </div>
            </div>
          </div>
        </div>

        {/* Tier-Switcher */}
        <div className="px-4 sm:px-6 pb-2">
          <div className="flex items-center gap-2">
            {classTroops.map((t) => {
              const active = t.tier === tier;
              const have = owned.get(t.id) ?? 0;
              return (
                <button key={t.id} onClick={() => setTier(t.tier)}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl border-2 transition ${active ? "border-[#FFD700] bg-[#FFD700]/15" : "border-white/15 bg-black/30 hover:bg-black/50"}`}>
                  <span className="text-xl leading-none">{t.emoji}</span>
                  <span className={`text-[9px] font-black ${active ? "text-[#FFD700]" : "text-white/70"}`}>T{t.tier}</span>
                  <span className="text-[9px] text-white/60">{have.toLocaleString("de-DE")}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Action-Bar */}
        <div className="px-4 sm:px-6 py-3 border-t border-white/10 bg-black/40">
          {msg && <div className="text-[11px] text-center font-black mb-2" style={{ color: msg.startsWith("✓") ? "#4ade80" : "#FF6B9A" }}>{msg}</div>}
          <div className="flex gap-2">
            {/* SOFORT */}
            <button onClick={() => void action(true)} disabled={!!busy || !enoughGems}
              className="flex-1 py-3.5 rounded-2xl font-black text-[15px] disabled:opacity-40 transition"
              style={{
                background: enoughGems ? "linear-gradient(180deg, #FFC044 0%, #FF8A00 100%)" : "rgba(255,255,255,0.08)",
                color: enoughGems ? "#1a0e00" : "#8B8FA3",
                boxShadow: enoughGems ? "0 4px 14px rgba(255,138,0,0.4), inset 0 1px 0 rgba(255,255,255,0.4)" : "none",
              }}>
              <div>{busy === "instant" ? "…" : "SOFORT"}</div>
              <div className="text-[10px] font-black mt-0.5 opacity-90">💎 {gemCost.toLocaleString("de-DE")}</div>
            </button>

            {/* TRAINIEREN */}
            <button onClick={() => void action(false)} disabled={!!busy}
              className="flex-1 py-3.5 rounded-2xl font-black text-[15px] disabled:opacity-40 transition"
              style={{
                background: "linear-gradient(180deg, #5ddaf0 0%, #22D1C3 100%)",
                color: "#0F1115",
                boxShadow: "0 4px 14px rgba(34,209,195,0.4), inset 0 1px 0 rgba(255,255,255,0.4)",
              }}>
              <div>{busy === "train" ? "…" : "TRAINIEREN"}</div>
              <div className="text-[10px] font-black mt-0.5 opacity-90">⏱ {fmtTime(totalSeconds)}</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg p-2 text-center" style={{ background: `${color}18`, border: `1px solid ${color}55` }}>
      <div className="text-[9px] font-black tracking-widest" style={{ color }}>{label}</div>
      <div className="text-base font-black text-white">{value}</div>
    </div>
  );
}
function CostChip({ kind, fallback, value, label, art }: {
  kind: ResourceKind; fallback: string; value: number; label: string;
  art: ReturnType<typeof useResourceArt>;
}) {
  return (
    <div className="rounded-lg bg-black/40 border border-white/10 p-1.5 text-center">
      <ResourceIcon kind={kind} size={20} fallback={fallback} art={art} />
      <div className="text-[11px] font-black text-white mt-0.5">{value >= 1000 ? `${Math.floor(value/1000)}K` : value.toLocaleString("de-DE")}</div>
      <div className="text-[8px] text-white/50">{label}</div>
    </div>
  );
}
