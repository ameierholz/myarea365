"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Mission = {
  id: string;
  code: string;
  type: "daily" | "weekly";
  category: string;
  name: string;
  description: string;
  icon: string;
  target_metric: string;
  target_value: number;
  reward_xp: number;
  active: boolean;
  sort_order: number;
};

const METRIC_OPTIONS = [
  "new_streets", "new_segments", "reclaim_segments",
  "total_km_today", "morning_km", "night_km", "crew_km", "longest_walk_min",
  "territories_closed", "power_zone_visits",
  "arena_wins",
  "guardian_xp_today", "sanctuary_visits",
  "shop_scans", "daily_pack_bought",
  "streak_maintained",
  "weekly_new_streets", "weekly_km", "weekly_territories", "weekly_arena_wins",
  "weekly_crew_runs", "weekly_streak", "weekly_guardian_lvl", "weekly_shop_scans",
];

const CATEGORIES = ["general", "streets", "distance", "territory", "arena", "guardian", "shop", "streak", "crew"];

const EMPTY: Mission = {
  id: "", code: "", type: "daily", category: "general",
  name: "", description: "", icon: "🎯",
  target_metric: "new_streets", target_value: 1, reward_xp: 200,
  active: true, sort_order: 100,
};

export function MissionsClient() {
  const t = useTranslations("AdminMissions");
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Mission | null>(null);
  const [filter, setFilter] = useState<"all" | "daily" | "weekly">("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/missions");
      const j = await r.json();
      setMissions(j.missions ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function save(m: Mission) {
    const isNew = !m.id;
    const r = await fetch("/api/admin/missions", {
      method: isNew ? "POST" : "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(m),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert(t("saveFail", { error: String(j.error ?? r.status) }));
      return;
    }
    setEditing(null);
    await load();
  }

  async function del(id: string) {
    if (!confirm(t("deleteConfirm"))) return;
    const r = await fetch(`/api/admin/missions?id=${id}`, { method: "DELETE" });
    if (!r.ok) { alert(t("deleteFail")); return; }
    await load();
  }

  async function toggleActive(m: Mission) {
    await fetch("/api/admin/missions", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...m, active: !m.active }),
    });
    await load();
  }

  const filtered = missions
    .filter((m) => filter === "all" || m.type === filter)
    .filter((m) => !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.code.toLowerCase().includes(search.toLowerCase()));

  const countActive = missions.filter((m) => m.active).length;
  const countDailyActive = missions.filter((m) => m.active && m.type === "daily").length;
  const countWeeklyActive = missions.filter((m) => m.active && m.type === "weekly").length;

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black text-white mb-1">{t("title")}</h1>
          <p className="text-[13px] text-[#a8b4cf]">{t("subtitle")}</p>
        </div>
        <button
          onClick={() => setEditing({ ...EMPTY })}
          className="px-4 py-2 rounded-lg bg-[#22D1C3] text-[#0F1115] font-black text-sm hover:opacity-90"
        >{t("newMission")}</button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard label={t("statPoolActive")} value={countActive} total={missions.length} color="#22D1C3" />
        <StatCard label={t("statDailyActive")} value={countDailyActive} color="#FFD700" />
        <StatCard label={t("statWeeklyActive")} value={countWeeklyActive} color="#FF2D78" />
      </div>

      <div className="flex gap-3 mb-4">
        <div className="flex gap-1 p-1 rounded-lg bg-white/5">
          {(["all", "daily", "weekly"] as const).map((tab) => (
            <button key={tab} onClick={() => setFilter(tab)} className={`px-3 py-1.5 rounded-md text-xs font-bold ${filter === tab ? "bg-[#22D1C3] text-[#0F1115]" : "text-white/70 hover:text-white"}`}>
              {tab === "all" ? t("filterAll") : tab === "daily" ? t("filterDaily") : t("filterWeekly")}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-[#22D1C3]"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-[#8B8FA3]">{t("loading")}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-[#8B8FA3]">{t("empty")}</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((m) => (
            <div key={m.id} className={`p-4 rounded-lg border flex items-center gap-4 ${m.active ? "bg-white/5 border-white/10" : "bg-white/[0.02] border-white/5 opacity-60"}`}>
              <div className="text-3xl flex-shrink-0">{m.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black tracking-wider px-2 py-0.5 rounded" style={{ background: m.type === "daily" ? "rgba(255,215,0,0.2)" : "rgba(255,45,120,0.2)", color: m.type === "daily" ? "#FFD700" : "#FF2D78" }}>
                    {m.type.toUpperCase()}
                  </span>
                  <span className="text-[10px] text-[#8B8FA3] font-mono">{m.code}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-white/60">{m.category}</span>
                </div>
                <div className="text-white font-bold text-sm mt-1">{m.name}</div>
                <div className="text-[#a8b4cf] text-xs mt-0.5">{m.description}</div>
                <div className="flex gap-3 mt-1 text-[11px] text-[#8B8FA3]">
                  <span>🎯 {m.target_metric} ≥ <b className="text-white">{m.target_value}</b></span>
                  <span>⭐ <b className="text-[#FFD700]">{m.reward_xp}</b> XP</span>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => toggleActive(m)} className={`px-3 py-1.5 rounded-md text-xs font-bold ${m.active ? "bg-[#4ade80]/20 text-[#4ade80] border border-[#4ade80]/40" : "bg-white/5 text-white/40 border border-white/10"}`}>
                  {m.active ? t("active") : t("inactive")}
                </button>
                <button onClick={() => setEditing({ ...m })} className="px-3 py-1.5 rounded-md bg-white/5 text-white hover:bg-white/10 text-xs font-bold">
                  {t("edit")}
                </button>
                <button onClick={() => del(m.id)} className="px-3 py-1.5 rounded-md bg-[#FF2D78]/15 text-[#FF2D78] hover:bg-[#FF2D78]/25 text-xs font-bold">
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <MissionEditor
          mission={editing}
          onCancel={() => setEditing(null)}
          onSave={save}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, total, color }: { label: string; value: number; total?: number; color: string }) {
  return (
    <div className="p-4 rounded-lg bg-white/5 border border-white/10">
      <div className="text-[10px] font-black tracking-wider" style={{ color }}>{label}</div>
      <div className="text-2xl font-black text-white mt-1">
        {value}{total != null && <span className="text-white/40 text-sm font-bold"> / {total}</span>}
      </div>
    </div>
  );
}

function MissionEditor({ mission, onCancel, onSave }: {
  mission: Mission;
  onCancel: () => void;
  onSave: (m: Mission) => void;
}) {
  const t = useTranslations("AdminMissions");
  const [m, setM] = useState<Mission>(mission);
  const isNew = !m.id;

  const set = <K extends keyof Mission>(k: K, v: Mission[K]) => setM((prev) => ({ ...prev, [k]: v }));

  return (
    <div onClick={onCancel} className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div onClick={(e) => e.stopPropagation()} className="bg-[#1A1D23] border border-white/10 rounded-2xl p-6 w-full max-w-xl max-h-[90vh] overflow-auto">
        <h2 className="text-xl font-black text-white mb-4">{isNew ? t("editorNew") : t("editorEdit")}</h2>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t("fieldCode")}>
            <input value={m.code} onChange={(e) => set("code", e.target.value)} className={inputCls} placeholder="daily_3_new_streets" />
          </Field>
          <Field label={t("fieldIcon")}>
            <input value={m.icon} onChange={(e) => set("icon", e.target.value)} className={inputCls} placeholder="🎯" />
          </Field>
          <Field label={t("fieldType")}>
            <select value={m.type} onChange={(e) => set("type", e.target.value as "daily" | "weekly")} className={inputCls}>
              <option value="daily">{t("filterDaily")}</option>
              <option value="weekly">{t("filterWeekly")}</option>
            </select>
          </Field>
          <Field label={t("fieldCategory")}>
            <select value={m.category} onChange={(e) => set("category", e.target.value)} className={inputCls}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label={t("fieldName")} wide>
            <input value={m.name} onChange={(e) => set("name", e.target.value)} className={inputCls} />
          </Field>
          <Field label={t("fieldDescription")} wide>
            <textarea value={m.description} onChange={(e) => set("description", e.target.value)} className={`${inputCls} min-h-[60px]`} rows={2} />
          </Field>
          <Field label={t("fieldTargetMetric")}>
            <select value={m.target_metric} onChange={(e) => set("target_metric", e.target.value)} className={inputCls}>
              {METRIC_OPTIONS.map((mt) => <option key={mt} value={mt}>{mt}</option>)}
            </select>
          </Field>
          <Field label={t("fieldTargetValue")}>
            <input type="number" value={m.target_value} onChange={(e) => set("target_value", Number(e.target.value))} className={inputCls} />
          </Field>
          <Field label={t("fieldRewardXp")}>
            <input type="number" value={m.reward_xp} onChange={(e) => set("reward_xp", Number(e.target.value))} className={inputCls} />
          </Field>
          <Field label={t("fieldSortOrder")}>
            <input type="number" value={m.sort_order} onChange={(e) => set("sort_order", Number(e.target.value))} className={inputCls} />
          </Field>
          <Field label={t("fieldActive")} wide>
            <label className="flex items-center gap-2 text-sm text-white">
              <input type="checkbox" checked={m.active} onChange={(e) => set("active", e.target.checked)} />
              {t("activeHint")}
            </label>
          </Field>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 text-white font-bold hover:bg-white/10">{t("cancel")}</button>
          <button onClick={() => onSave(m)} className="flex-1 px-4 py-2.5 rounded-lg bg-[#22D1C3] text-[#0F1115] font-black hover:opacity-90">
            {isNew ? t("create") : t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-[#22D1C3]";

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <label className="block text-[10px] font-black tracking-wider text-[#8B8FA3] mb-1">{label.toUpperCase()}</label>
      {children}
    </div>
  );
}
