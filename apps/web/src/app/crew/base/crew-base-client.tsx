"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

const BaseScene = dynamic(() => import("@/components/base-3d/base-scene").then((m) => m.BaseScene), {
  ssr: false,
  loading: () => (
    <div className="h-[320px] flex items-center justify-center bg-gradient-to-b from-[#0a1d2c] to-[#0F1115]">
      <div className="text-center text-[#a8b4cf]"><div className="text-4xl animate-pulse">🏛️</div><div className="text-xs mt-2">Lade Crew-Base …</div></div>
    </div>
  ),
});

type CrewBuildingCatalog = {
  id: string; name: string; emoji: string; description: string;
  max_level: number;
  base_cost_wood: number; base_cost_stone: number; base_cost_gold: number; base_cost_mana: number;
  base_buildtime_minutes: number;
  required_base_level: number; sort: number;
};
type CrewBuilding = {
  id: string; building_id: string; position_x: number; position_y: number;
  level: number; status: "idle" | "building" | "upgrading"; last_collected_at: string | null;
};
type CrewQueue = { id: string; building_id: string; target_level: number; ends_at: string };
type CrewResources = { wood: number; stone: number; gold: number; mana: number };

type CrewBaseData = {
  ok: boolean;
  crew: { id: string; name: string } | null;
  base: { id: string; plz_cluster: string; level: number; exp: number } | null;
  buildings: CrewBuilding[];
  queue: CrewQueue[];
  resources: CrewResources | null;
  catalog: CrewBuildingCatalog[];
};

const RES_META = {
  wood:  { icon: "🪵", color: "#a16f32" },
  stone: { icon: "🪨", color: "#8B8FA3" },
  gold:  { icon: "🪙", color: "#FFD700" },
  mana:  { icon: "💧", color: "#22D1C3" },
} as const;

// 3x3 Grid mit Crew-Buildings auf 4 Ecken — Kreuz-Slots frei für Deko
const CREW_SLOT_LAYOUT: Record<string, { x: number; y: number }> = {
  crew_treffpunkt: { x: 0, y: 0 },
  truhenkammer:    { x: 2, y: 0 },
  arena_halle:     { x: 0, y: 2 },
  mana_quell:      { x: 2, y: 2 },
};

export function CrewBaseClient() {
  const [data, setData] = useState<CrewBaseData | null>(null);
  const [now, setNow]   = useState<number>(Date.now());

  const reload = useCallback(async () => {
    const r = await fetch("/api/crew/base", { cache: "no-store" });
    const j = await r.json() as CrewBaseData;
    setData(j);
  }, []);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F1115] text-[#a8b4cf]">
        <div className="text-center"><div className="text-4xl mb-3 animate-pulse">🏛️</div><div className="text-sm font-bold">Lade Crew-Base …</div></div>
      </div>
    );
  }

  if (!data.crew) {
    return (
      <div className="min-h-screen bg-[#0F1115] text-white flex flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl mb-4">🏛️</div>
        <div className="text-xl font-black mb-2">Du bist in keiner Crew</div>
        <div className="text-sm text-[#a8b4cf] mb-6">Tritt einer Crew bei oder gründe eine — dann steht hier eure gemeinsame Base.</div>
        <Link href="/dashboard" className="px-4 py-2 rounded-xl bg-[#22D1C3] text-[#0F1115] font-black">Zur Karte</Link>
      </div>
    );
  }

  const { crew, base, buildings, queue, resources, catalog } = data;
  const builtMap = new Map(buildings.map((b) => [b.building_id, b]));
  const res = resources ?? { wood: 0, stone: 0, gold: 0, mana: 0 };

  return (
    <div className="min-h-screen bg-[#0F1115] text-white pb-24">
      {/* Header: Crew-Resource-HUD */}
      <header className="sticky top-0 z-30 bg-gradient-to-b from-[#0F1115] to-[#0F1115]/90 backdrop-blur-md border-b border-white/5 px-3 py-2">
        <div className="flex items-center justify-between gap-2 max-w-screen-md mx-auto">
          <Link href="/base" className="text-[#22D1C3] text-xl font-black">←</Link>
          <div className="flex-1 grid grid-cols-4 gap-1 text-center">
            {(Object.keys(RES_META) as Array<keyof typeof RES_META>).map((k) => (
              <div key={k} className="px-1 py-1 rounded-md bg-white/5">
                <div className="text-[15px] leading-none">{RES_META[k].icon}</div>
                <div className="text-[10px] font-black mt-0.5" style={{ color: RES_META[k].color }}>{res[k].toLocaleString("de-DE")}</div>
              </div>
            ))}
          </div>
          <div className="px-2 py-1 rounded-md bg-[#22D1C3]/15 border border-[#22D1C3]/40 text-center">
            <div className="text-[9px] text-[#22D1C3] font-black tracking-wider">CREW</div>
          </div>
        </div>
      </header>

      <main className="max-w-screen-md mx-auto px-3 py-4 space-y-5">
        {/* 3D-Crew-Base */}
        <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#1A1D23] to-[#0F1115] overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between border-b border-white/5">
            <div>
              <div className="text-[10px] font-black tracking-widest text-[#22D1C3]">CREW-BASE</div>
              <div className="text-xl font-black mt-0.5">{crew.name}</div>
              <div className="text-[10px] text-[#a8b4cf] mt-0.5">PLZ-Cluster {base?.plz_cluster ?? "?"} · Stufe {base?.level ?? 1}</div>
            </div>
            <Link href="/base" className="text-[10px] font-black tracking-wider px-3 py-1.5 rounded-lg bg-[#FFD700]/15 border border-[#FFD700]/40 text-[#FFD700]">
              ← SOLO-BASE
            </Link>
          </div>
          <BaseScene
            variant="crew"
            buildings={buildings.map((b) => ({
              building_id: b.building_id,
              level: b.level,
              position_x: CREW_SLOT_LAYOUT[b.building_id]?.x ?? 0,
              position_y: CREW_SLOT_LAYOUT[b.building_id]?.y ?? 0,
              status: b.status,
            }))}
            emptySlots={catalog
              .filter((c) => !builtMap.has(c.id))
              .map((c) => ({
                position_x: CREW_SLOT_LAYOUT[c.id]?.x ?? 0,
                position_y: CREW_SLOT_LAYOUT[c.id]?.y ?? 0,
                empty_for: c.id,
              }))}
            height={320}
          />
        </section>

        {/* Bauauftrag-Anzeige */}
        {queue.length > 0 && (
          <section className="rounded-2xl border border-[#FF6B4A]/30 bg-[#FF6B4A]/5 p-3">
            <div className="text-[10px] font-black tracking-widest text-[#FF6B4A] mb-2">🔨 IN BAU</div>
            <div className="space-y-2">
              {queue.map((q) => {
                const cat = catalog.find((c) => c.id === q.building_id);
                const ms = new Date(q.ends_at).getTime() - now;
                const sec = Math.max(0, Math.floor(ms / 1000));
                const min = Math.floor(sec / 60);
                const restSec = sec % 60;
                return (
                  <div key={q.id} className="flex items-center gap-2 p-2 rounded-lg bg-[#1A1D23] border border-white/5">
                    <span className="text-2xl">{cat?.emoji ?? "🏗️"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-black">{cat?.name ?? q.building_id} → Lv {q.target_level}</div>
                      <div className="text-[10px] text-[#a8b4cf]">{`Noch ${min}:${String(restSec).padStart(2, "0")}`}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Building-Catalog */}
        <section>
          <h2 className="text-[10px] font-black tracking-widest text-[#a8b4cf] mb-2">🏗️ CREW-GEBÄUDE</h2>
          <div className="grid grid-cols-2 gap-3">
            {catalog.map((cat) => {
              const built = builtMap.get(cat.id);
              const lvl = built?.level ?? 0;
              const targetLvl = lvl + 1;
              const costMult = lvl === 0 ? 1 : Math.pow(1.6, lvl);
              const cost = {
                wood:  Math.round(cat.base_cost_wood  * costMult),
                stone: Math.round(cat.base_cost_stone * costMult),
                gold:  Math.round(cat.base_cost_gold  * costMult),
                mana:  Math.round(cat.base_cost_mana  * costMult),
              };
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
                  <div className="text-[10px] mt-2 grid grid-cols-4 gap-1">
                    {(["wood","stone","gold","mana"] as const).filter(k => cost[k] > 0).map((k) => (
                      <div key={k} className={res[k] >= cost[k] ? "text-[#a8b4cf]" : "text-[#FF2D78]"}>
                        {RES_META[k].icon}{cost[k]}
                      </div>
                    ))}
                  </div>
                  <div className="text-[10px] mt-2 text-[#6c7590] italic">
                    {lvl === 0 ? "🏗️ Crew-Bau-API folgt im nächsten Patch" : `Lv ${targetLvl} verfügbar`}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="text-[10px] text-[#6c7590] text-center pt-4">
          Phase 2 · Truhen + Boss-Raids + Crew-vs-Crew folgen
        </div>
      </main>
    </div>
  );
}
