"use client";

import { useCallback, useEffect, useState } from "react";

type Variant = { key: string; weight: number };
type Experiment = {
  id: string; key: string; description: string | null;
  variants: Variant[]; status: "draft" | "running" | "paused" | "completed";
  started_at: string | null; ended_at: string | null; created_at: string;
  assignments?: number;
  events?: Array<{ variant: string; event: string; count: number }>;
};

const DEMO_EXPERIMENTS: Experiment[] = [
  { id: "d1", key: "onboarding_v2", description: "Vereinfachter Wächter-Pick-Flow beim ersten Login", variants: [{ key: "control", weight: 50 }, { key: "simplified", weight: 50 }], status: "running", started_at: new Date(Date.now() - 12 * 86400_000).toISOString(), ended_at: null, created_at: new Date(Date.now() - 15 * 86400_000).toISOString(), assignments: 1842 },
  { id: "d2", key: "gem_pricing_test", description: "15% günstigeres 500-Diamanten-Pack für Variante A", variants: [{ key: "control", weight: 50 }, { key: "discount_15", weight: 50 }], status: "running", started_at: new Date(Date.now() - 5 * 86400_000).toISOString(), ended_at: null, created_at: new Date(Date.now() - 5 * 86400_000).toISOString(), assignments: 673 },
  { id: "d3", key: "arena_cta_color", description: "Roter vs. pinker Angreifen-Button", variants: [{ key: "red", weight: 33 }, { key: "pink", weight: 33 }, { key: "gradient", weight: 34 }], status: "completed", started_at: new Date(Date.now() - 45 * 86400_000).toISOString(), ended_at: new Date(Date.now() - 15 * 86400_000).toISOString(), created_at: new Date(Date.now() - 50 * 86400_000).toISOString(), assignments: 3214 },
  { id: "d4", key: "push_morning_vs_evening", description: "Push-Reminder 08:00 vs. 18:00 Uhr", variants: [{ key: "morning", weight: 50 }, { key: "evening", weight: 50 }], status: "paused", started_at: new Date(Date.now() - 8 * 86400_000).toISOString(), ended_at: null, created_at: new Date(Date.now() - 10 * 86400_000).toISOString(), assignments: 412 },
  { id: "d5", key: "season_pass_price", description: "€ 4,99 vs. € 6,99 Season-Pass", variants: [{ key: "cheap", weight: 50 }, { key: "expensive", weight: 50 }], status: "draft", started_at: null, ended_at: null, created_at: new Date(Date.now() - 2 * 86400_000).toISOString(), assignments: 0 },
];

export function ExperimentsClient() {
  const [items, setItems] = useState<Experiment[] | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newVariants, setNewVariants] = useState("control,variant_a");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/experiments", { cache: "no-store" });
    const j = await res.json();
    const rows = (j.experiments ?? []) as Experiment[];
    if (rows.length === 0) { setItems(DEMO_EXPERIMENTS); setIsDemo(true); }
    else { setItems(rows); setIsDemo(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function create() {
    if (!newKey) return;
    const vars = newVariants.split(",").map((s) => s.trim()).filter(Boolean);
    const even = Math.floor(100 / vars.length);
    const variants: Variant[] = vars.map((v, i) => ({ key: v, weight: i === 0 ? 100 - even * (vars.length - 1) : even }));
    setBusy(true);
    try {
      const res = await fetch("/api/admin/experiments", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "create", key: newKey, description: newDesc, variants }),
      });
      const j = await res.json();
      if (!j.ok) { alert(j.error); return; }
      setNewKey(""); setNewDesc("");
      await load();
    } finally { setBusy(false); }
  }

  async function setStatus(id: string, status: Experiment["status"]) {
    setBusy(true);
    try {
      await fetch("/api/admin/experiments", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "set_status", id, status }),
      });
      await load();
    } finally { setBusy(false); }
  }

  return (
    <div>
      {isDemo && (
        <div className="mb-3 p-2.5 rounded-lg bg-[#a855f7]/10 border border-[#a855f7]/40 text-xs text-[#c084fc] flex items-center gap-2">
          <span className="text-base">🤖</span>
          <span><b className="font-black tracking-wider">DEMO-DATEN</b> — noch keine Experimente. Hier sind fiktive Beispiele.</span>
        </div>
      )}
      {/* Neu */}
      <div className="p-4 rounded-lg bg-[#0F1115] border border-white/10 mb-6">
        <h3 className="text-sm font-black text-[#FFD700] tracking-widest mb-3">NEUES EXPERIMENT</h3>
        <div className="grid md:grid-cols-3 gap-2">
          <input value={newKey} onChange={(e) => setNewKey(e.target.value.toLowerCase().replace(/\s+/g, "_"))}
            placeholder="Key (z.B. new_onboarding_v2)"
            className="bg-[#151922] border border-white/10 rounded px-3 py-2 text-sm" />
          <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Beschreibung"
            className="bg-[#151922] border border-white/10 rounded px-3 py-2 text-sm" />
          <input value={newVariants} onChange={(e) => setNewVariants(e.target.value)}
            placeholder="Varianten (comma-separated)"
            className="bg-[#151922] border border-white/10 rounded px-3 py-2 text-sm" />
        </div>
        <button onClick={create} disabled={busy || !newKey}
          className="mt-3 px-4 py-2 rounded-lg bg-[#22D1C3] text-[#0F1115] text-sm font-bold disabled:opacity-40">
          ➕ Erstellen
        </button>
      </div>

      {/* Liste */}
      {!items ? <div className="text-sm text-[#8B8FA3]">Lade …</div>
        : items.length === 0 ? <div className="text-sm text-[#8B8FA3]">Noch keine Experimente.</div>
        : (
          <div className="space-y-3">
            {items.map((e) => {
              const total = (e.variants ?? []).reduce((s, v) => s + v.weight, 0) || 100;
              return (
                <div key={e.id} className="p-4 rounded-lg bg-[#0F1115] border border-white/10">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-black text-white">{e.key}</span>
                        <StatusPill status={e.status} />
                      </div>
                      {e.description && <div className="text-xs text-[#a8b4cf] mt-0.5">{e.description}</div>}
                    </div>
                    <div className="flex gap-1">
                      {e.status === "draft" && <Btn onClick={() => setStatus(e.id, "running")} color="#4ade80">▶ Start</Btn>}
                      {e.status === "running" && <Btn onClick={() => setStatus(e.id, "paused")} color="#FFD700">⏸ Pause</Btn>}
                      {e.status === "paused" && <Btn onClick={() => setStatus(e.id, "running")} color="#4ade80">▶ Resume</Btn>}
                      {e.status !== "completed" && <Btn onClick={() => setStatus(e.id, "completed")} color="#8B8FA3">✓ Abschließen</Btn>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {(e.variants ?? []).map((v) => {
                      const pct = Math.round((v.weight / total) * 100);
                      return (
                        <div key={v.key} className="p-2 rounded bg-black/30 border border-white/5">
                          <div className="text-[10px] font-black tracking-wider text-[#8B8FA3]">{v.key.toUpperCase()}</div>
                          <div className="text-lg font-black text-[#22D1C3]">{pct}%</div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex justify-between text-[10px] text-[#6c7590]">
                    <span>Assignments: <b className="text-white">{e.assignments ?? 0}</b></span>
                    <span>Started: {e.started_at ? new Date(e.started_at).toLocaleDateString("de-DE") : "—"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}

function StatusPill({ status }: { status: Experiment["status"] }) {
  const m = status === "running" ? { c: "#4ade80", l: "LÄUFT" }
          : status === "paused"  ? { c: "#FFD700", l: "PAUSIERT" }
          : status === "completed" ? { c: "#8B8FA3", l: "BEENDET" }
          : { c: "#22D1C3", l: "DRAFT" };
  return <span className="px-2 py-0.5 rounded-full text-[9px] font-black" style={{ background: `${m.c}22`, color: m.c, border: `1px solid ${m.c}44` }}>{m.l}</span>;
}
function Btn({ onClick, color, children }: { onClick: () => void; color: string; children: React.ReactNode }) {
  return <button onClick={onClick} className="px-2 py-1 rounded text-[10px] font-black" style={{ background: `${color}22`, color, border: `1px solid ${color}66` }}>{children}</button>;
}
