"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { IntroBox } from "@/components/base-modal/_shared";

export function ResearchTab({ accent, reload }: { accent: string; reload: () => Promise<void> }) {
  const t = useTranslations("BaseModal");
  type Def = {
    id: string; name: string; emoji: string; description: string; branch: string; tier: number;
    prereq_id: string | null; max_level: number;
    base_cost_wood: number; base_cost_stone: number; base_cost_gold: number; base_cost_mana: number;
    base_time_minutes: number; effect_key: string | null; effect_per_level: number;
    required_burg_level: number;
  };
  type Progress = { research_id: string; level: number };
  type QueueRow = { id: string; research_id: string; target_level: number; ends_at: string };
  type Data = { ok: boolean; definitions: Def[]; progress: Progress[]; queue: QueueRow[] };
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [openBranch, setOpenBranch] = useState<string | null>("economy");

  const load = useCallback(async () => {
    const r = await fetch("/api/base/research");
    setData(await r.json());
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function start(researchId: string) {
    setBusy(researchId); setMsg(null);
    try {
      const r = await fetch("/api/base/research", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ research_id: researchId }),
      });
      const j = await r.json() as { ok?: boolean; error?: string; minutes?: number };
      if (j.ok) { setMsg(t("researchStarted", { min: j.minutes ?? 0 })); await Promise.all([load(), reload()]); }
      else if (j.error === "prereq_missing") setMsg(t("researchErrPrereq"));
      else if (j.error === "burg_level_too_low") setMsg(t("researchErrBurgLow"));
      else if (j.error === "queue_full") setMsg(t("researchErrQueueFull"));
      else if (j.error === "not_enough_resources") setMsg(t("researchErrNotEnoughRes"));
      else setMsg(j.error ?? t("errGeneric"));
    } finally { setBusy(null); }
  }

  if (!data) return <div className="text-[11px] text-[#a8b4cf]">{t("troopsLoading")}</div>;
  const progressMap = new Map(data.progress.map((p) => [p.research_id, p.level]));
  const branches: Array<{ id: string; label: string; color: string }> = [
    { id: "economy",        label: t("researchBranchEconomy"),  color: "#FFD700" },
    { id: "military",       label: t("researchBranchMilitary"), color: "#FF2D78" },
    { id: "infrastructure", label: t("researchBranchInfra"),    color: "#22D1C3" },
    { id: "social",         label: t("researchBranchSocial"),   color: "#a855f7" },
  ];

  return (
    <div className="space-y-3">
      <IntroBox accent={accent} title={t("introResearchTitle")}>
        {t("introResearchBody1")}<b className="text-white">{t("introResearchBoni")}</b>{t("introResearchBody2")}
        <span className="block mt-1 text-[#6c7590]">{t("introResearchBody3")}</span>
      </IntroBox>

      {data.queue.length > 0 && (
        <div className="rounded-lg p-2 bg-[#22D1C3]/10 border border-[#22D1C3]/40 text-[11px]">
          <div className="font-black text-[#22D1C3] mb-1">{t("researchInProgress")}</div>
          {data.queue.map((q) => {
            const d = data.definitions.find((x) => x.id === q.research_id);
            const remain = Math.max(0, Math.ceil((new Date(q.ends_at).getTime() - Date.now()) / 60000));
            return (
              <div key={q.id} className="flex justify-between text-[10px] text-white">
                <span>{d?.emoji} {t("researchToLevel", { name: d?.name ?? "", target: q.target_level })}</span>
                <span className="text-[#a8b4cf]">{t("trainingMin", { n: remain })}</span>
              </div>
            );
          })}
        </div>
      )}

      {branches.map((b) => {
        const items = data.definitions.filter((d) => d.branch === b.id).sort((a, c) => (a.tier - c.tier) || a.name.localeCompare(c.name));
        const open = openBranch === b.id;
        const tiers = Array.from(new Set(items.map((d) => d.tier))).sort((a, c) => a - c);
        const totalProgress = items.filter((d) => (progressMap.get(d.id) ?? 0) > 0).length;
        return (
          <div key={b.id} className="rounded-lg overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${b.color}33` }}>
            <button onClick={() => setOpenBranch(open ? null : b.id)} className="w-full flex items-center justify-between px-3 py-2 text-[12px] font-black" style={{ color: b.color }}>
              <span>{b.label} <span className="text-[9px] text-[#a8b4cf] ml-1 font-normal">{totalProgress}/{items.length}</span></span><span className="text-[10px]">{open ? "▾" : "▸"}</span>
            </button>
            {open && (
              <div className="p-2 space-y-3">
                {tiers.map((tier) => (
                <div key={tier} className="space-y-1.5">
                  <div className="text-[9px] font-black tracking-widest text-[#6c7590] px-1">{t("researchTier", { tier })}</div>
                {items.filter((d) => d.tier === tier).map((d) => {
                  const lvl = progressMap.get(d.id) ?? 0;
                  const prereqLvl = d.prereq_id ? (progressMap.get(d.prereq_id) ?? 0) : 1;
                  const locked = d.prereq_id !== null && prereqLvl < 1;
                  const maxed = lvl >= d.max_level;
                  return (
                    <div key={d.id} className="rounded p-2 bg-[#0F1115]/60 border border-white/5">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{d.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-black text-white">
                            {d.name} <span className="text-[9px] text-[#a8b4cf] ml-1">{t("researchItemMeta", { tier: d.tier, lvl, max: d.max_level, burg: d.required_burg_level })}</span>
                          </div>
                          <div className="text-[9px] text-[#a8b4cf]">{d.description}</div>
                          {locked && <div className="text-[9px] text-[#FF6B4A]">{t("researchPrereqLocked")}</div>}
                        </div>
                        <button onClick={() => start(d.id)} disabled={busy === d.id || locked || maxed}
                          className="text-[10px] font-black px-2 py-1 rounded disabled:opacity-40"
                          style={{ background: `${b.color}26`, border: `1px solid ${b.color}66`, color: b.color }}>
                          {maxed ? "MAX" : busy === d.id ? "…" : t("researchToNextLevel", { level: lvl + 1 })}
                        </button>
                      </div>
                    </div>
                  );
                })}
                </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {msg && <div className="text-[11px] text-center font-black" style={{ color: msg.startsWith("✓") ? "#4ade80" : "#FF2D78" }}>{msg}</div>}
    </div>
  );
}
