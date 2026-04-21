"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Row = {
  id: string; username: string | null; display_name: string | null;
  faction: string | null; total_distance_m: number | null; total_walks: number | null;
  role: string; is_banned: boolean; shadow_banned: boolean;
  created_at: string; last_seen_at: string | null;
};

export function RunnersTable({ rows }: { rows: Row[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  function toggle(id: string) {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelected(s);
  }
  function toggleAll() {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  }

  async function bulkAction(action: "ban" | "unban" | "shadow_ban" | "notify" | "export") {
    if (selected.size === 0) return;
    const ids = Array.from(selected);

    if (action === "notify") {
      const title = prompt("Titel der In-App-Nachricht?");
      if (!title) return;
      const body = prompt("Text der Nachricht?");
      if (!body) return;
      if (!confirm(`${ids.length} Runner benachrichtigen?`)) return;
      setBusy(true);
      try {
        await fetch("/api/admin/runners/bulk", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "notify", ids, title, body }),
        });
        alert(`Nachricht an ${ids.length} Runner gesendet.`);
      } finally { setBusy(false); }
      return;
    }

    if (action === "export") {
      // Separater Download pro User (DSGVO-Export)
      if (!confirm(`${ids.length} JSON-Exports erstellen? (Öffnet ${ids.length} Downloads)`)) return;
      for (const id of ids) {
        window.open(`/api/admin/export/user/${id}`, "_blank");
        await new Promise((r) => setTimeout(r, 300)); // Browser-Throttle
      }
      return;
    }

    const reason = (action === "ban" || action === "shadow_ban")
      ? prompt("Grund der Sperre:") || "Bulk-Action"
      : null;
    if (!confirm(`${ids.length} Runner: ${action}?`)) return;

    setBusy(true);
    try {
      const res = await fetch("/api/admin/runners/bulk", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ids, reason }),
      });
      const j = await res.json();
      if (!j.ok) { alert(j.error); return; }
      setSelected(new Set());
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <div>
      {selected.size > 0 && (
        <div className="mb-3 p-3 rounded-lg bg-[#22D1C3]/10 border border-[#22D1C3]/40 flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-[#22D1C3]">{selected.size} ausgewählt</span>
          <div className="flex-1" />
          <BulkBtn onClick={() => bulkAction("notify")} disabled={busy} color="#22D1C3">📢 Benachrichtigen</BulkBtn>
          <BulkBtn onClick={() => bulkAction("export")} disabled={busy} color="#FFD700">📥 DSGVO-Export</BulkBtn>
          <BulkBtn onClick={() => bulkAction("shadow_ban")} disabled={busy} color="#FF6B4A">🌑 Shadow-Ban</BulkBtn>
          <BulkBtn onClick={() => bulkAction("ban")} disabled={busy} color="#FF2D78">🚫 Sperren</BulkBtn>
          <BulkBtn onClick={() => bulkAction("unban")} disabled={busy} color="#4ade80">🔓 Entsperren</BulkBtn>
          <button onClick={() => setSelected(new Set())} className="text-xs text-[#8B8FA3] hover:text-white ml-2">✕ Auswahl aufheben</button>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-[11px] tracking-wider text-[#8B8FA3]">
            <tr>
              <th className="p-2 w-8">
                <input type="checkbox" checked={selected.size === rows.length && rows.length > 0} onChange={toggleAll} />
              </th>
              <th className="text-left p-2">Runner</th>
              <th className="text-left p-2">Aktivität</th>
              <th className="text-left p-2">Fraktion</th>
              <th className="text-right p-2">km / Läufe</th>
              <th className="text-left p-2">Status</th>
              <th className="text-right p-2">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/5 hover:bg-white/5">
                <td className="p-2 text-center">
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                </td>
                <td className="p-2">
                  <Link href={`/admin/runners/${r.id}`} className="hover:text-[#22D1C3]">
                    <div className="font-bold text-white">{r.display_name ?? r.username}</div>
                    <div className="text-xs text-[#8B8FA3]">@{r.username}</div>
                  </Link>
                </td>
                <td className="p-2"><LastActive at={r.last_seen_at} /></td>
                <td className="p-2 text-[#a8b4cf]">{r.faction === "syndicate" ? "🌙 Nachtpuls" : r.faction === "vanguard" ? "☀️ Sonnenwacht" : "—"}</td>
                <td className="p-2 text-right text-[#a8b4cf]">
                  {((r.total_distance_m ?? 0) / 1000).toFixed(1)} km
                  <div className="text-xs text-[#8B8FA3]">{r.total_walks ?? 0} Läufe</div>
                </td>
                <td className="p-2">
                  {r.is_banned && <Pill c="#FF2D78">GESPERRT</Pill>}
                  {r.shadow_banned && !r.is_banned && <Pill c="#FFD700">SHADOW</Pill>}
                  {!r.is_banned && !r.shadow_banned && <Pill c="#4ade80">AKTIV</Pill>}
                  {r.role !== "user" && <Pill c="#22D1C3">{r.role.toUpperCase()}</Pill>}
                </td>
                <td className="p-2 text-right">
                  <Link href={`/admin/runners/${r.id}`} className="text-xs text-[#22D1C3] hover:underline">Details →</Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-[#8B8FA3] text-sm">Keine Runner gefunden.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LastActive({ at }: { at: string | null }) {
  if (!at) return <span className="text-xs text-[#6c7590]">nie</span>;
  const ms = Date.now() - new Date(at).getTime();
  const hours = ms / 3_600_000;
  const days = hours / 24;

  const meta = days > 30 ? { c: "#FF2D78", l: `${Math.round(days)}d` }
             : days > 7  ? { c: "#FF6B4A", l: `${Math.round(days)}d` }
             : days > 1  ? { c: "#FFD700", l: `${Math.round(days)}d` }
             : hours > 1 ? { c: "#4ade80", l: `${Math.round(hours)}h` }
             :              { c: "#22D1C3", l: "jetzt" };

  return <span className="text-xs font-black" style={{ color: meta.c }}>{meta.l}</span>;
}
function Pill({ c, children }: { c: string; children: React.ReactNode }) {
  return <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-black mr-1" style={{ background: `${c}22`, color: c }}>{children}</span>;
}
function BulkBtn({ onClick, disabled, color, children }: { onClick: () => void; disabled: boolean; color: string; children: React.ReactNode }) {
  return <button onClick={onClick} disabled={disabled}
    className="px-3 py-1.5 rounded text-xs font-black disabled:opacity-40"
    style={{ background: `${color}22`, color, border: `1px solid ${color}66` }}>{children}</button>;
}
