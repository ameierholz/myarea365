"use client";
import { useState } from "react";
import { Card, Badge, Button, Input, Select } from "../../_components/ui";

type SampleUser = {
  id: string; username: string | null; display_name: string | null; email: string | null;
  total_xp: number | null; total_distance_m: number | null; faction: string | null; created_at: string;
};

const PRESETS = [
  { id: "high_xp_inactive", label: "🚨 High-XP & inaktiv >14d", filters: { xp_min: 10000, inactive_for_days: 14 } },
  { id: "fresh_signups",     label: "🌱 Frische Signups (7d)",     filters: { signup_after: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10) } },
  { id: "kronenwacht_solo",  label: "👑 Kronenwacht ohne Crew",     filters: { faction: "kronenwacht", in_crew: false } },
  { id: "gossenbund_solo",   label: "🗝️ Gossenbund ohne Crew",      filters: { faction: "gossenbund", in_crew: false } },
  { id: "active_today",      label: "✅ Aktiv (24h)",                filters: { active_within_days: 1 } },
  { id: "dormant_30d",       label: "💤 Dormant (>30d)",            filters: { inactive_for_days: 30 } },
];

export function CohortsClient() {
  const [filters, setFilters] = useState<Record<string, unknown>>({});
  const [count, setCount] = useState<number | null>(null);
  const [sample, setSample] = useState<SampleUser[]>([]);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/cohorts?filters=${encodeURIComponent(JSON.stringify(filters))}`, { cache: "no-store" });
      const j = await r.json();
      if (j.ok) { setCount(j.count); setSample(j.sample); }
    } finally { setLoading(false); }
  }

  function set(key: string, val: unknown) {
    setFilters((f) => {
      const next = { ...f };
      if (val === "" || val == null) delete next[key];
      else next[key] = val;
      return next;
    });
  }

  function applyPreset(p: typeof PRESETS[number]) {
    setFilters(p.filters);
    setTimeout(run, 50);
  }

  function exportCSV() {
    if (sample.length === 0) return;
    const headers = ["id", "username", "display_name", "email", "total_xp", "total_km", "faction", "created_at"];
    const rows = sample.map((u) => [u.id, u.username, u.display_name, u.email, u.total_xp, ((u.total_distance_m ?? 0) / 1000).toFixed(2), u.faction, u.created_at].map((v) => `"${(v ?? "").toString().replace(/"/g, '""')}"`).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `cohort_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid lg:grid-cols-[400px_1fr] gap-6">
      <div className="space-y-4">
        <Card>
          <h2 className="font-bold mb-2">Presets</h2>
          <div className="space-y-1.5">
            {PRESETS.map((p) => (
              <button key={p.id} onClick={() => applyPreset(p)} className="block w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm">
                {p.label}
              </button>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="font-bold mb-3">Filter</h2>
          <div className="space-y-3">
            <div><label className="text-[11px] uppercase text-[#8b8fa3]">Signup nach (Datum)</label><Input type="date" value={(filters.signup_after as string) ?? ""} onChange={(e) => set("signup_after", e.target.value)} /></div>
            <div><label className="text-[11px] uppercase text-[#8b8fa3]">Signup vor (Datum)</label><Input type="date" value={(filters.signup_before as string) ?? ""} onChange={(e) => set("signup_before", e.target.value)} /></div>
            <div><label className="text-[11px] uppercase text-[#8b8fa3]">XP min</label><Input type="number" value={String(filters.xp_min ?? "")} onChange={(e) => set("xp_min", e.target.value ? Number(e.target.value) : null)} /></div>
            <div><label className="text-[11px] uppercase text-[#8b8fa3]">XP max</label><Input type="number" value={String(filters.xp_max ?? "")} onChange={(e) => set("xp_max", e.target.value ? Number(e.target.value) : null)} /></div>
            <div><label className="text-[11px] uppercase text-[#8b8fa3]">Aktiv innerhalb X Tagen</label><Input type="number" value={String(filters.active_within_days ?? "")} onChange={(e) => set("active_within_days", e.target.value ? Number(e.target.value) : null)} /></div>
            <div><label className="text-[11px] uppercase text-[#8b8fa3]">Inaktiv für X Tage</label><Input type="number" value={String(filters.inactive_for_days ?? "")} onChange={(e) => set("inactive_for_days", e.target.value ? Number(e.target.value) : null)} /></div>
            <div>
              <label className="text-[11px] uppercase text-[#8b8fa3]">Fraktion</label>
              <Select value={(filters.faction as string) ?? ""} onChange={(e) => set("faction", e.target.value || null)} className="w-full">
                <option value="">— egal —</option>
                <option value="kronenwacht">👑 Kronenwacht</option>
                <option value="gossenbund">🗝️ Gossenbund</option>
              </Select>
            </div>
            <div>
              <label className="text-[11px] uppercase text-[#8b8fa3]">In Crew?</label>
              <Select value={filters.in_crew == null ? "" : filters.in_crew ? "true" : "false"} onChange={(e) => set("in_crew", e.target.value === "" ? null : e.target.value === "true")} className="w-full">
                <option value="">— egal —</option>
                <option value="true">✅ Ja</option>
                <option value="false">❌ Solo</option>
              </Select>
            </div>
            <div className="pt-2 border-t border-white/5 flex gap-2">
              <Button onClick={run} disabled={loading}>{loading ? "Lade…" : "Cohort laden"}</Button>
              <Button variant="ghost" onClick={() => { setFilters({}); setCount(null); setSample([]); }}>Reset</Button>
            </div>
          </div>
        </Card>
      </div>

      <div>
        {count !== null ? (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm text-[#8b8fa3]">Cohort-Größe</div>
                <div className="text-4xl font-black text-[#22D1C3]">{count.toLocaleString("de-DE")}</div>
                <div className="text-xs text-[#8b8fa3] mt-1">Sample unten zeigt erste 20 Treffer</div>
              </div>
              {sample.length > 0 && <Button onClick={exportCSV}>📥 CSV-Export (Sample)</Button>}
            </div>
            <div className="space-y-1 max-h-[600px] overflow-y-auto">
              {sample.map((u) => (
                <div key={u.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 text-xs">
                  <div className="flex-1 min-w-0">
                    <a href={`/admin/runners/${u.id}`} className="text-[#22D1C3] hover:underline">{u.display_name ?? u.username}</a>
                    <span className="text-[#8b8fa3] ml-2">{u.email}</span>
                  </div>
                  <div className="flex gap-3 text-[10px] text-[#8b8fa3]">
                    <span>{(u.total_xp ?? 0).toLocaleString("de-DE")} XP</span>
                    <span>{((u.total_distance_m ?? 0) / 1000).toFixed(0)} km</span>
                    {u.faction && <Badge tone="info">{u.faction === "kronenwacht" ? "👑" : "🗝️"}</Badge>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <Card><p className="text-sm text-[#8b8fa3]">Filter setzen oder Preset wählen + "Cohort laden"</p></Card>
        )}
      </div>
    </div>
  );
}
