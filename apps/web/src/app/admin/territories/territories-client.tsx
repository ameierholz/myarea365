"use client";

import { useEffect, useState } from "react";

type Polygon = {
  id: string;
  owner_user_id: string | null;
  area_m2: number | null;
  xp_awarded: number;
  created_at: string;
  username: string | null;
  display_name: string | null;
};

export function TerritoriesClient() {
  const [rows, setRows] = useState<Polygon[] | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function load() {
    const res = await fetch(`/api/admin/territories?q=${encodeURIComponent(search)}`, { cache: "no-store" });
    const j = await res.json();
    setRows(j.rows ?? []);
    setSelected(new Set());
  }
  useEffect(() => { void load(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

  async function bulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`${selected.size} Territorium/Territorien unwiderruflich löschen?`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/territories", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "delete", ids: Array.from(selected) }),
      });
      const j = await res.json();
      if (!j.ok) { alert(j.error ?? "Fehler"); return; }
      await load();
    } finally { setBusy(false); }
  }

  function toggle(id: string) {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelected(s);
  }

  const filtered = (rows ?? []).filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.username ?? "").toLowerCase().includes(q) || (r.display_name ?? "").toLowerCase().includes(q);
  });

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void load(); }}
          placeholder="🔎 Suche nach Runner-Name oder Username…"
          className="flex-1 bg-[#0F1115] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-[#6c7590]"
        />
        <button onClick={() => load()} className="px-4 py-2 rounded-lg bg-[#22D1C3] text-[#0F1115] text-sm font-bold">Suchen</button>
        <button
          onClick={bulkDelete}
          disabled={busy || selected.size === 0}
          className="px-4 py-2 rounded-lg bg-[#FF2D78] text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
        >🗑️ Löschen ({selected.size})</button>
      </div>

      {!rows ? (
        <div className="text-sm text-[#8B8FA3] p-6 text-center">Lade Territorien …</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-[#8B8FA3] p-6 text-center">Keine Territorien gefunden.</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-white/5">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-[11px] tracking-wider text-[#8B8FA3]">
              <tr>
                <th className="p-2 w-8"></th>
                <th className="text-left p-2">Runner</th>
                <th className="text-right p-2">Fläche</th>
                <th className="text-right p-2">XP</th>
                <th className="text-left p-2">Claimed</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((r) => (
                <tr key={r.id} className="border-t border-white/5 hover:bg-white/5">
                  <td className="p-2 text-center">
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                  </td>
                  <td className="p-2">
                    {r.display_name || r.username ? (
                      <div>
                        <div className="font-bold text-white">{r.display_name ?? r.username}</div>
                        <div className="text-[10px] text-[#8B8FA3]">@{r.username}</div>
                      </div>
                    ) : <span className="text-[#8B8FA3]">— verwaist —</span>}
                  </td>
                  <td className="p-2 text-right text-[#a8b4cf]">{Number(r.area_m2 ?? 0).toLocaleString("de-DE", { maximumFractionDigits: 0 })} m²</td>
                  <td className="p-2 text-right text-[#FFD700] font-black">{r.xp_awarded}</td>
                  <td className="p-2 text-[#8B8FA3] text-xs">{new Date(r.created_at).toLocaleDateString("de-DE")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {filtered.length > 200 && (
        <div className="text-xs text-[#8B8FA3] mt-2 text-center">Zeige 200 von {filtered.length} — Suche verfeinern für mehr Fokus.</div>
      )}
    </div>
  );
}
