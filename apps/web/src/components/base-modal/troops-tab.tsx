"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useResourceArt, ResourceIcon } from "@/components/resource-icon";
import { TroopDetailModal } from "@/components/troop-detail-modal";
import { HospitalModal } from "@/components/hospital-modal";
import { fetchBaseMe } from "@/lib/base-me-cache";
import { IntroBox } from "@/components/base-modal/_shared";

export function TroopsTab({ accent, reload }: { accent: string; reload: () => Promise<void> }) {
  const t = useTranslations("BaseModal");
  type Troop = {
    id: string; name: string; emoji: string; troop_class: string; tier: number;
    base_atk: number; base_def: number; base_hp: number;
    cost_wood: number; cost_stone: number; cost_gold: number; cost_mana: number;
    train_time_seconds: number; required_building_level: number; description: string;
  };
  type Owned = { troop_id: string; count: number };
  type QueueRow = { id: string; troop_id: string; count: number; ends_at: string };
  type Data = { catalog: Troop[]; owned: Owned[]; queue: QueueRow[]; caps?: Record<string, number> };
  const [data, setData] = useState<Data | null>(null);
  const [openClass, setOpenClass] = useState<string | null>("infantry");
  const [selectedTroopId, setSelectedTroopId] = useState<string | null>(null);
  const [hospitalOpen, setHospitalOpen] = useState(false);
  const [hospital, setHospital] = useState<{ injuredTotal: number; cap: number; queueCount: number }>({ injuredTotal: 0, cap: 50, queueCount: 0 });
  const [gemsAvailable, setGemsAvailable] = useState<number>(0);
  const resourceArt = useResourceArt();

  const load = useCallback(async () => {
    const r = await fetch("/api/base/troops");
    setData(await r.json());
    try {
      const j = await fetchBaseMe() as { user_resources?: { gems?: number } } | null;
      if (j) setGemsAvailable(j.user_resources?.gems ?? 0);
    } catch { /* ignore */ }
    try {
      const hr = await fetch("/api/heal", { cache: "no-store" });
      const hj = await hr.json() as { ok: boolean; injured: Array<{ count: number }>; queue: Array<unknown>; cap: number };
      if (hj.ok) {
        setHospital({
          injuredTotal: (hj.injured ?? []).reduce((s, i) => s + (i.count ?? 0), 0),
          cap: hj.cap ?? 50,
          queueCount: (hj.queue ?? []).length,
        });
      }
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (!data) return <div className="text-[11px] text-[#a8b4cf]">{t("troopsLoading")}</div>;
  const ownedMap = new Map(data.owned.map((o) => [o.troop_id, o.count]));
  const classes: Array<{ id: string; label: string; building: string }> = [
    { id: "infantry",  label: t("troopClassInfantry"),  building: t("troopBuildingBar") },
    { id: "cavalry",   label: t("troopClassCavalry"),   building: t("troopBuildingGarage") },
    { id: "marksman",  label: t("troopClassMarksman"),  building: t("troopBuildingGym") },
    { id: "siege",     label: t("troopClassSiege"),     building: t("troopBuildingWerkhof") },
    { id: "collector", label: t("troopClassCollector"), building: t("troopBuildingDepot") },
  ];

  return (
    <div className="space-y-3">
      <IntroBox accent={accent} title={t("introTroopsTitle")}>
        {t("introTroopsBody1")}<b className="text-white">{t("introTroopsBuildings")}</b>{t("introTroopsBody2")}<b className="text-white">{t("introTroopsT1")}</b>{t("introTroopsBody3")}<b className="text-white">{t("introTroopsT2T5")}</b>{t("introTroopsBody4")}<b className="text-white">{t("introTroopsResearchTab")}</b>{t("introTroopsBody5")}
        <span className="block mt-1 text-[#6c7590]">{t("introTroopsBody6")}</span>
      </IntroBox>

      {/* Lazarett-Trigger — leuchtet bei Verletzten */}
      <button onClick={() => setHospitalOpen(true)}
        className="w-full rounded-lg p-2 flex items-center justify-between transition border"
        style={{
          background: hospital.injuredTotal > 0 ? "rgba(255,45,120,0.12)" : "rgba(255,255,255,0.04)",
          borderColor: hospital.injuredTotal > 0 ? "rgba(255,45,120,0.45)" : "rgba(255,255,255,0.08)",
        }}>
        <div className="flex items-center gap-2">
          <span className="text-xl">🏥</span>
          <div className="text-left">
            <div className="text-[12px] font-black text-white">Lazarett</div>
            <div className="text-[9px]" style={{ color: hospital.injuredTotal > 0 ? "#FF6B9A" : "#a8b4cf" }}>
              {hospital.injuredTotal > 0
                ? `${hospital.injuredTotal} verletzte Truppen warten auf Behandlung`
                : "Keine verletzten Truppen"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hospital.queueCount > 0 && (
            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-[#22D1C3]/20 text-[#22D1C3] border border-[#22D1C3]/40">
              {hospital.queueCount} läuft
            </span>
          )}
          <span className="text-[#a8b4cf] text-[10px]">▸</span>
        </div>
      </button>

      {data.queue.length > 0 && (
        <div className="rounded-lg p-2 bg-[#FF6B4A]/10 border border-[#FF6B4A]/40 text-[11px]">
          <div className="font-black text-[#FF6B4A] mb-1">{t("trainingHeader")}</div>
          {data.queue.map((q) => {
            const tr = data.catalog.find((x) => x.id === q.troop_id);
            const remain = Math.max(0, Math.ceil((new Date(q.ends_at).getTime() - Date.now()) / 60000));
            return (
              <div key={q.id} className="flex justify-between text-[10px] text-white">
                <span>{tr?.emoji} {tr?.name} × {q.count}</span>
                <span className="text-[#a8b4cf]">{t("trainingMin", { n: remain })}</span>
              </div>
            );
          })}
        </div>
      )}

      {classes.map((c) => {
        const troops = data.catalog.filter((t) => t.troop_class === c.id);
        const totalCount = troops.reduce((s, t) => s + (ownedMap.get(t.id) ?? 0), 0);
        const open = openClass === c.id;
        return (
          <div key={c.id} className="rounded-lg overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <button onClick={() => setOpenClass(open ? null : c.id)} className="w-full flex items-center justify-between px-3 py-2 text-[12px] font-black text-white">
              <span>{c.label}</span>
              <span className="text-[#a8b4cf] text-[10px] flex items-center gap-2">
                {totalCount > 0 && (
                  <span className="text-[#FFD700] font-black">×{totalCount.toLocaleString("de-DE")}</span>
                )}
                <span>{c.building} · {open ? "▾" : "▸"}</span>
              </span>
            </button>
            {open && (
              <div className="p-2 space-y-1.5">
                {troops.map((tr) => {
                  const have = ownedMap.get(tr.id) ?? 0;
                  return (
                    <button key={tr.id} onClick={() => setSelectedTroopId(tr.id)}
                      className="w-full text-left rounded p-2 flex items-center gap-2 bg-[#0F1115]/60 border border-white/5 hover:bg-[#0F1115]/80 hover:border-white/15 transition">
                      <span className="text-2xl">{tr.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-black text-white truncate">
                          {tr.name} <span className="text-[9px] text-[#a8b4cf] font-bold ml-1">{t("troopTier", { tier: tr.tier })}{tr.tier > 1 ? t("troopResearchSuffix") : ""}</span>
                        </div>
                        <div className="text-[9px] text-[#a8b4cf]">⚔️ {tr.base_atk} · 🛡 {tr.base_def} · ❤️ {tr.base_hp} · ⏱ {tr.train_time_seconds}s</div>
                        <div className="text-[9px] text-[#a8b4cf] flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-0.5"><ResourceIcon kind="wood"  size={11} fallback="⚙️" art={resourceArt} />{tr.cost_wood}</span>·
                          <span className="inline-flex items-center gap-0.5"><ResourceIcon kind="stone" size={11} fallback="🔩" art={resourceArt} />{tr.cost_stone}</span>·
                          <span className="inline-flex items-center gap-0.5"><ResourceIcon kind="gold"  size={11} fallback="💸" art={resourceArt} />{tr.cost_gold}</span>·
                          <span className="inline-flex items-center gap-0.5"><ResourceIcon kind="mana"  size={11} fallback="📡" art={resourceArt} />{tr.cost_mana}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="text-[10px] text-[#FFD700] font-black">×{have}</div>
                        <div className="text-[9px] text-[#a8b4cf]">{t("troopTapToOpen")}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {selectedTroopId && (
        <TroopDetailModal
          catalog={data.catalog}
          owned={ownedMap}
          initialTroopId={selectedTroopId}
          gemsAvailable={gemsAvailable}
          caps={data.caps ?? { infantry: 0, cavalry: 0, marksman: 0, siege: 0, collector: 0 }}
          onClose={() => setSelectedTroopId(null)}
          onTrained={async () => { await Promise.all([load(), reload()]); }}
        />
      )}
      {hospitalOpen && (
        <HospitalModal
          catalog={data.catalog}
          onClose={() => { setHospitalOpen(false); void load(); }}
        />
      )}
    </div>
  );
}
