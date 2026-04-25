"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

const BaseScene = dynamic(() => import("@/components/base-3d/base-scene").then((m) => m.BaseScene), {
  ssr: false,
  loading: () => (
    <div className="h-[320px] flex items-center justify-center bg-gradient-to-b from-[#0e1a2c] to-[#0F1115]">
      <div className="text-center text-[#a8b4cf]"><div className="text-4xl animate-pulse">🏰</div><div className="text-xs mt-2">Lade 3D-Base …</div></div>
    </div>
  ),
});

// 4 Solo-Slots in 2x2-Grid für die 4 Phase-1-Buildings
const SOLO_SLOT_LAYOUT: Record<string, { x: number; y: number }> = {
  wegekasse:      { x: 0, y: 0 },
  wald_pfad:      { x: 1, y: 0 },
  waechter_halle: { x: 0, y: 1 },
  laufturm:       { x: 1, y: 1 },
};

type BuildingCatalog = {
  id: string; name: string; emoji: string; description: string; category: string; scope: string;
  max_level: number;
  base_cost_wood: number; base_cost_stone: number; base_cost_gold: number; base_cost_mana: number;
  base_buildtime_minutes: number;
  effect_key: string | null; effect_per_level: number;
  required_base_level: number; sort: number;
};
type BaseBuilding = {
  id: string; building_id: string; position_x: number; position_y: number;
  level: number; status: "idle" | "building" | "upgrading"; last_collected_at: string | null;
};
type QueueItem = {
  id: string; building_id: string; action: "build" | "upgrade"; target_level: number;
  started_at: string; ends_at: string; finished: boolean;
};
type Resources = { wood: number; stone: number; gold: number; mana: number; speed_tokens: number };
type VipProgress = { vip_level: number; vip_points: number; daily_login_streak: number };
type Chest = { id: string; kind: "silver" | "gold" | "event"; source: string; obtained_at: string; opens_at: string };

type BaseData = {
  ok: boolean;
  base: { id: string; plz: string; level: number; exp: number } | null;
  buildings: BaseBuilding[];
  queue: QueueItem[];
  resources: Resources;
  vip: VipProgress;
  catalog: BuildingCatalog[];
  chests: Chest[];
};

const RES_META = {
  wood:  { label: "Holz",       icon: "🪵", color: "#a16f32" },
  stone: { label: "Stein",      icon: "🪨", color: "#8B8FA3" },
  gold:  { label: "Gold",       icon: "🪙", color: "#FFD700" },
  mana:  { label: "Mana",       icon: "💧", color: "#22D1C3" },
} as const;

export function BaseClient() {
  const [data, setData] = useState<BaseData | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr]   = useState<string | null>(null);
  const [now, setNow]   = useState<number>(Date.now());

  const reload = useCallback(async () => {
    const r = await fetch("/api/base/me", { cache: "no-store" });
    const j = await r.json() as BaseData;
    setData(j);
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  // 1-Sekunden-Tick für Timer
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Auto-reload wenn ein Bau-Timer abgelaufen ist
  useEffect(() => {
    if (!data?.queue.length) return;
    const earliest = Math.min(...data.queue.map((q) => new Date(q.ends_at).getTime()));
    if (earliest <= now) void reload();
  }, [data, now, reload]);

  async function build(buildingId: string) {
    setBusy(buildingId); setErr(null);
    try {
      const r = await fetch("/api/base/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ building_id: buildingId }),
      });
      const j = await r.json();
      if (j?.ok === false || !r.ok) {
        setErr(j?.error ?? "Fehler");
      } else {
        await reload();
      }
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

  async function openChest(chestId: string) {
    setBusy(chestId); setErr(null);
    try {
      const r = await fetch("/api/base/chest/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chest_id: chestId }),
      });
      const j = await r.json();
      if (j?.ok === false || !r.ok) setErr(j?.error ?? "Fehler");
      await reload();
    } finally { setBusy(null); }
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F1115] text-[#a8b4cf]">
        <div className="text-center"><div className="text-4xl mb-3 animate-pulse">🏰</div><div className="text-sm font-bold">Lade Base …</div></div>
      </div>
    );
  }

  const { base, buildings, queue, resources, vip, catalog, chests } = data;
  const builtMap = new Map(buildings.map((b) => [b.building_id, b]));
  const queueMap = new Map(queue.map((q) => [q.building_id, q]));

  return (
    <div className="min-h-screen bg-[#0F1115] text-white pb-24">
      {/* Header: Resourcen-HUD (sticky) */}
      <header className="sticky top-0 z-30 bg-gradient-to-b from-[#0F1115] to-[#0F1115]/90 backdrop-blur-md border-b border-white/5 px-3 py-2">
        <div className="flex items-center justify-between gap-2 max-w-screen-md mx-auto">
          <Link href="/dashboard" className="text-[#22D1C3] text-xl font-black">←</Link>
          <div className="flex-1 grid grid-cols-4 gap-1 text-center">
            {(Object.keys(RES_META) as Array<keyof typeof RES_META>).map((k) => (
              <div key={k} className="px-1 py-1 rounded-md bg-white/5">
                <div className="text-[15px] leading-none">{RES_META[k].icon}</div>
                <div className="text-[10px] font-black mt-0.5" style={{ color: RES_META[k].color }}>{resources[k].toLocaleString("de-DE")}</div>
              </div>
            ))}
          </div>
          <div className="px-2 py-1 rounded-md bg-[#FFD700]/15 border border-[#FFD700]/40 text-center">
            <div className="text-[9px] text-[#FFD700] font-black tracking-wider">VIP</div>
            <div className="text-sm font-black text-[#FFD700]">{vip.vip_level}</div>
          </div>
        </div>
      </header>

      <main className="max-w-screen-md mx-auto px-3 py-4 space-y-5">
        {/* 3D-Base-Header */}
        <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#1A1D23] to-[#0F1115] overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between border-b border-white/5">
            <div>
              <div className="text-[10px] font-black tracking-widest text-[#22D1C3]">DEINE BASE</div>
              <div className="text-xl font-black mt-0.5">PLZ {base?.plz ?? "—"}</div>
              <div className="text-[10px] text-[#a8b4cf] mt-0.5">Stufe {base?.level ?? 1} · ⚡ {resources.speed_tokens} Tokens</div>
            </div>
            <Link
              href="/crew/base"
              className="text-[10px] font-black tracking-wider px-3 py-1.5 rounded-lg bg-[#22D1C3]/15 border border-[#22D1C3]/40 text-[#22D1C3]"
            >
              CREW-BASE →
            </Link>
          </div>
          <BaseScene
            variant="solo"
            buildings={buildings.map((b) => ({
              building_id: b.building_id,
              level: b.level,
              position_x: SOLO_SLOT_LAYOUT[b.building_id]?.x ?? 0,
              position_y: SOLO_SLOT_LAYOUT[b.building_id]?.y ?? 0,
              status: b.status,
            }))}
            emptySlots={catalog
              .filter((c) => !builtMap.has(c.id))
              .map((c) => ({
                position_x: SOLO_SLOT_LAYOUT[c.id]?.x ?? 0,
                position_y: SOLO_SLOT_LAYOUT[c.id]?.y ?? 0,
                empty_for: c.id,
              }))}
            onSlotTap={(id) => { void build(id); }}
            onBuildingTap={(id) => { void build(id); }}
            height={320}
          />
        </section>

        {/* Aktive Bauaufträge */}
        {queue.length > 0 && (
          <section className="rounded-2xl border border-[#FF6B4A]/30 bg-[#FF6B4A]/5 p-3">
            <div className="text-[10px] font-black tracking-widest text-[#FF6B4A] mb-2">🔨 IN BAU ({queue.length})</div>
            <div className="space-y-2">
              {queue.map((q) => {
                const cat = catalog.find((c) => c.id === q.building_id);
                const ms = new Date(q.ends_at).getTime() - now;
                const sec = Math.max(0, Math.floor(ms / 1000));
                const min = Math.floor(sec / 60);
                const restSec = sec % 60;
                const ready = ms <= 0;
                return (
                  <div key={q.id} className="flex items-center gap-2 p-2 rounded-lg bg-[#1A1D23] border border-white/5">
                    <span className="text-2xl">{cat?.emoji ?? "🏗️"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-black">{cat?.name ?? q.building_id} → Lv {q.target_level}</div>
                      <div className="text-[10px] text-[#a8b4cf]">
                        {ready ? <span className="text-[#4ade80] font-black">FERTIG · lädt neu …</span>
                               : `Noch ${min}:${String(restSec).padStart(2, "0")}`}
                      </div>
                    </div>
                    {!ready && resources.speed_tokens > 0 && (
                      <button
                        onClick={() => speedUp(q.id, Math.min(resources.speed_tokens, Math.ceil(sec / 60 / 5)))}
                        disabled={busy === q.id}
                        className="text-[10px] font-black px-2 py-1 rounded-lg bg-[#22D1C3]/15 border border-[#22D1C3]/40 text-[#22D1C3]"
                      >
                        ⚡ Skip
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Truhen */}
        {chests.length > 0 && (
          <section className="rounded-2xl border border-[#FFD700]/30 bg-[#FFD700]/5 p-3">
            <div className="text-[10px] font-black tracking-widest text-[#FFD700] mb-2">🗝️ TRUHEN ({chests.length})</div>
            <div className="grid grid-cols-2 gap-2">
              {chests.map((c) => {
                const ms = new Date(c.opens_at).getTime() - now;
                const ready = ms <= 0;
                const min = Math.max(0, Math.floor(ms / 60000));
                const hr  = Math.floor(min / 60);
                const restMin = min % 60;
                const icon = c.kind === "gold" ? "🟡" : c.kind === "event" ? "🎁" : "🪙";
                return (
                  <button
                    key={c.id} disabled={!ready || busy === c.id}
                    onClick={() => openChest(c.id)}
                    className={`p-3 rounded-xl text-center ${
                      ready
                        ? "bg-gradient-to-br from-[#FFD700]/30 to-[#FF6B4A]/20 border border-[#FFD700]/60 cursor-pointer"
                        : "bg-[#1A1D23] border border-white/5"
                    }`}
                  >
                    <div className="text-3xl">{icon}</div>
                    <div className="text-[10px] font-black uppercase tracking-wider mt-1" style={{ color: ready ? "#FFD700" : "#6c7590" }}>
                      {c.kind} {ready ? "ÖFFNEN" : `${hr > 0 ? hr + "h " : ""}${restMin}m`}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Gebäude-Grid (zentrales 2D-Layout, Phase-1-MVP) */}
        <section>
          <h2 className="text-[10px] font-black tracking-widest text-[#a8b4cf] mb-2">🏗️ GEBÄUDE</h2>
          <div className="grid grid-cols-2 gap-3">
            {catalog.map((cat) => {
              const built = builtMap.get(cat.id);
              const inQueue = queueMap.get(cat.id);
              const isBuilding = !!inQueue;
              const lvl = built?.level ?? 0;
              const targetLvl = lvl + 1;
              const costMult = lvl === 0 ? 1 : Math.pow(1.6, lvl);
              const cost = {
                wood:  Math.round(cat.base_cost_wood  * costMult),
                stone: Math.round(cat.base_cost_stone * costMult),
                gold:  Math.round(cat.base_cost_gold  * costMult),
                mana:  Math.round(cat.base_cost_mana  * costMult),
              };
              const canAfford = resources.wood >= cost.wood && resources.stone >= cost.stone
                              && resources.gold >= cost.gold && resources.mana >= cost.mana;
              const baseLevelOk = (base?.level ?? 1) >= cat.required_base_level;
              const maxed = lvl >= cat.max_level;
              const canBuild = !isBuilding && !maxed && baseLevelOk && canAfford;
              return (
                <div key={cat.id} className="rounded-2xl bg-[#1A1D23] border border-white/10 p-3 flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">{cat.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-black">{cat.name}</div>
                      <div className="text-[9px] text-[#a8b4cf]">Lv {lvl}/{cat.max_level}</div>
                    </div>
                  </div>
                  <div className="text-[10px] text-[#a8b4cf] mt-2 leading-snug">{cat.description}</div>
                  {!baseLevelOk && (
                    <div className="text-[10px] text-[#FF2D78] mt-1">🔒 Base Lv {cat.required_base_level} erforderlich</div>
                  )}
                  {!isBuilding && !maxed && baseLevelOk && (
                    <div className="text-[10px] text-[#a8b4cf] mt-2 grid grid-cols-4 gap-1">
                      {(["wood","stone","gold","mana"] as const).filter(k => cost[k] > 0).map((k) => (
                        <div key={k} className={resources[k] >= cost[k] ? "text-[#a8b4cf]" : "text-[#FF2D78]"}>
                          {RES_META[k].icon}{cost[k]}
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    disabled={!canBuild || busy === cat.id}
                    onClick={() => build(cat.id)}
                    className={`mt-3 text-[11px] font-black py-2 rounded-lg ${
                      isBuilding         ? "bg-[#FF6B4A]/15 border border-[#FF6B4A]/40 text-[#FF6B4A]"
                      : maxed            ? "bg-[#FFD700]/15 border border-[#FFD700]/40 text-[#FFD700]"
                      : !baseLevelOk     ? "bg-white/5 text-[#6c7590]"
                      : !canAfford       ? "bg-white/5 text-[#FF2D78]"
                                         : "bg-gradient-to-r from-[#22D1C3] to-[#a855f7] text-[#0F1115]"
                    }`}
                  >
                    {isBuilding   ? "🔨 in Bau"
                      : maxed     ? "MAX"
                      : lvl === 0 ? "🏗️ Bauen"
                                  : `⬆️ Lv ${targetLvl}`}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* VIP */}
        <section className="rounded-2xl border border-[#FFD700]/30 bg-gradient-to-br from-[#FFD700]/10 to-transparent p-4">
          <div className="text-[10px] font-black tracking-widest text-[#FFD700]">⭐ VIP-STATUS</div>
          <div className="flex items-center justify-between mt-2">
            <div>
              <div className="text-2xl font-black text-[#FFD700]">VIP {vip.vip_level}</div>
              <div className="text-[10px] text-[#a8b4cf]">🔥 {vip.daily_login_streak} Tage Streak · {vip.vip_points} Punkte</div>
            </div>
            <div className="text-right">
              <div className="text-[9px] text-[#a8b4cf]">tägliche Truhen</div>
              <div className="text-sm font-black">{vip.vip_level >= 5 ? "🟡" : "🪙"} {vip.vip_level >= 1 ? "1+" : "0"}</div>
            </div>
          </div>
        </section>

        {err && (
          <div className="rounded-xl bg-[#FF2D78]/15 border border-[#FF2D78]/40 text-[#FF2D78] text-xs font-bold px-3 py-2">
            ⚠️ {err}
          </div>
        )}

        <div className="text-[10px] text-[#6c7590] text-center pt-4">
          Phase 1 MVP · Crew-Base + Truhen + Truppen folgen in nächsten Releases
        </div>
      </main>
    </div>
  );
}
