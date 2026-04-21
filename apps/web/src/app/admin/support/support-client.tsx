"use client";

import { useCallback, useEffect, useState } from "react";

type Ticket = {
  id: string; email: string; name: string | null; subject: string; body: string;
  category: string; status: string; priority: string;
  created_at: string; resolved_at: string | null; internal_notes: string | null;
  source: string;
};

type Filter = "open" | "in_progress" | "resolved" | "all";

export function SupportClient() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [filter, setFilter] = useState<Filter>("open");
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/support?filter=${filter}`, { cache: "no-store" });
    const j = await res.json();
    setTickets(j.tickets ?? []);
  }, [filter]);
  useEffect(() => { void load(); }, [load]);

  async function updateTicket(id: string, patch: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/support", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "update", id, patch }),
      });
      const j = await res.json();
      if (!j.ok) { alert(j.error); return; }
      await load();
      if (selected?.id === id) setSelected({ ...selected, ...patch } as Ticket);
    } finally { setBusy(false); }
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {(["open","in_progress","resolved","all"] as Filter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
              filter === f ? "bg-[#22D1C3] text-[#0F1115]" : "bg-white/5 text-[#a8b4cf]"
            }`}>
            {f === "open" ? "OFFEN" : f === "in_progress" ? "IN BEARBEITUNG" : f === "resolved" ? "GELÖST" : "ALLE"}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-[1fr_1.4fr] gap-4">
        {/* Liste */}
        <div className="space-y-2 max-h-[640px] overflow-y-auto">
          {!tickets ? <div className="text-sm text-[#8B8FA3] p-4">Lade …</div>
            : tickets.length === 0 ? <div className="text-sm text-[#8B8FA3] p-4">Keine Tickets.</div>
            : tickets.map((t) => (
              <button key={t.id} onClick={() => setSelected(t)}
                className={`w-full p-3 rounded-lg text-left border ${
                  selected?.id === t.id ? "bg-[#22D1C3]/10 border-[#22D1C3]/50" : "bg-[#0F1115] border-white/5 hover:border-white/15"
                }`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm font-black text-white truncate">{t.subject}</div>
                  <PriorityBadge p={t.priority} />
                </div>
                <div className="text-[11px] text-[#a8b4cf] truncate">{t.email}</div>
                <div className="flex items-center justify-between mt-1">
                  <CategoryBadge c={t.category} />
                  <span className="text-[9px] text-[#6c7590]">{new Date(t.created_at).toLocaleString("de-DE")}</span>
                </div>
              </button>
            ))}
        </div>

        {/* Detail */}
        <div>
          {!selected ? (
            <div className="p-8 text-center text-[#8B8FA3] text-sm rounded-lg bg-[#0F1115] border border-white/5">
              Ticket auswählen
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-[#0F1115] border border-white/5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-lg font-black text-white">{selected.subject}</div>
                  <div className="text-xs text-[#a8b4cf]">{selected.name ? `${selected.name} · ` : ""}{selected.email}</div>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  <PriorityBadge p={selected.priority} />
                  <CategoryBadge c={selected.category} />
                </div>
              </div>

              <div className="p-3 rounded bg-black/30 text-sm whitespace-pre-wrap text-[#dde3f5]">{selected.body}</div>

              <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-white/5">
                <label className="text-[10px] font-black text-[#8B8FA3]">STATUS</label>
                <select value={selected.status} onChange={(e) => updateTicket(selected.id, { status: e.target.value, resolved_at: e.target.value === "resolved" ? new Date().toISOString() : null })}
                  disabled={busy}
                  className="bg-[#151922] border border-white/10 rounded px-2 py-1 text-xs">
                  <option value="open">Offen</option>
                  <option value="in_progress">In Bearbeitung</option>
                  <option value="resolved">Gelöst</option>
                  <option value="closed">Geschlossen</option>
                </select>
                <label className="text-[10px] font-black text-[#8B8FA3] ml-2">PRIORITÄT</label>
                <select value={selected.priority} onChange={(e) => updateTicket(selected.id, { priority: e.target.value })}
                  disabled={busy}
                  className="bg-[#151922] border border-white/10 rounded px-2 py-1 text-xs">
                  <option value="low">Niedrig</option>
                  <option value="normal">Normal</option>
                  <option value="high">Hoch</option>
                  <option value="urgent">Dringend</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-[#8B8FA3] block mb-1">INTERNE NOTIZEN</label>
                <textarea
                  defaultValue={selected.internal_notes ?? ""}
                  rows={3}
                  onBlur={(e) => updateTicket(selected.id, { internal_notes: e.target.value })}
                  placeholder="Nur für Staff sichtbar…"
                  className="w-full bg-[#151922] border border-white/10 rounded px-3 py-2 text-xs" />
              </div>

              <div className="text-[10px] text-[#6c7590] pt-2 border-t border-white/5">
                Ticket-ID: <span className="font-mono">{selected.id}</span> · Source: {selected.source} · Created {new Date(selected.created_at).toLocaleString("de-DE")}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PriorityBadge({ p }: { p: string }) {
  const meta = p === "urgent" ? { c: "#FF2D78", l: "DRINGEND" }
             : p === "high"    ? { c: "#FF6B4A", l: "HOCH" }
             : p === "low"     ? { c: "#8B8FA3", l: "NIEDRIG" }
             :                    { c: "#22D1C3", l: "NORMAL" };
  return <span className="px-1.5 py-0.5 rounded text-[9px] font-black" style={{ background: `${meta.c}22`, color: meta.c }}>{meta.l}</span>;
}
function CategoryBadge({ c }: { c: string }) {
  const map: Record<string, string> = {
    bug: "🐛", billing: "💳", partner: "🤝", abuse: "⚠️", general: "💬", other: "📎",
  };
  return <span className="text-[10px] text-[#a8b4cf]">{map[c] ?? "📎"} {c}</span>;
}
