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

const DEMO_RUNNERS: Row[] = [
  { id: "dx1",  username: "valkyr",   display_name: "Valkyr",   faction: "vanguard",  total_distance_m: 284_120, total_walks: 87, role: "user",    is_banned: false, shadow_banned: false, created_at: new Date(Date.now() - 120 * 86400_000).toISOString(), last_seen_at: new Date(Date.now() - 1 * 3600_000).toISOString() },
  { id: "dx2",  username: "nyx",      display_name: "Nyx",      faction: "syndicate", total_distance_m: 198_540, total_walks: 62, role: "user",    is_banned: false, shadow_banned: false, created_at: new Date(Date.now() - 90 * 86400_000).toISOString(),  last_seen_at: new Date(Date.now() - 4 * 3600_000).toISOString() },
  { id: "dx3",  username: "titan",    display_name: "Titan",    faction: "vanguard",  total_distance_m: 412_890, total_walks: 134, role: "admin",  is_banned: false, shadow_banned: false, created_at: new Date(Date.now() - 180 * 86400_000).toISOString(), last_seen_at: new Date(Date.now() - 15 * 60_000).toISOString() },
  { id: "dx4",  username: "shade",    display_name: "Shade",    faction: "syndicate", total_distance_m:  87_340, total_walks: 41, role: "user",    is_banned: false, shadow_banned: false, created_at: new Date(Date.now() - 60 * 86400_000).toISOString(),  last_seen_at: new Date(Date.now() - 26 * 3600_000).toISOString() },
  { id: "dx5",  username: "ember",    display_name: "Ember",    faction: "vanguard",  total_distance_m: 156_780, total_walks: 53, role: "support", is_banned: false, shadow_banned: false, created_at: new Date(Date.now() - 75 * 86400_000).toISOString(),  last_seen_at: new Date(Date.now() - 2 * 3600_000).toISOString() },
  { id: "dx6",  username: "kaelthor", display_name: "Kaelthor", faction: null,        total_distance_m: 321_450, total_walks: 98, role: "user",    is_banned: false, shadow_banned: false, created_at: new Date(Date.now() - 150 * 86400_000).toISOString(), last_seen_at: new Date(Date.now() - 8 * 86400_000).toISOString() },
  { id: "dx7",  username: "zephyr",   display_name: "Zephyr",   faction: "syndicate", total_distance_m:  42_180, total_walks: 18, role: "user",    is_banned: false, shadow_banned: false, created_at: new Date(Date.now() - 30 * 86400_000).toISOString(),  last_seen_at: new Date(Date.now() - 45 * 86400_000).toISOString() },
  { id: "dx8",  username: "frost",    display_name: "Frost",    faction: "vanguard",  total_distance_m:  68_920, total_walks: 27, role: "user",    is_banned: false, shadow_banned: true,  created_at: new Date(Date.now() - 45 * 86400_000).toISOString(),  last_seen_at: new Date(Date.now() - 12 * 3600_000).toISOString() },
  { id: "dx9",  username: "raze",     display_name: "Raze",     faction: "syndicate", total_distance_m:   8_430, total_walks: 4,  role: "user",    is_banned: true,  shadow_banned: false, created_at: new Date(Date.now() - 10 * 86400_000).toISOString(),  last_seen_at: new Date(Date.now() - 6 * 86400_000).toISOString() },
  { id: "dx10", username: "blaze",    display_name: "Blaze",    faction: "vanguard",  total_distance_m: 104_560, total_walks: 38, role: "marketing", is_banned: false, shadow_banned: false, created_at: new Date(Date.now() - 55 * 86400_000).toISOString(), last_seen_at: new Date(Date.now() - 30 * 60_000).toISOString() },
  { id: "dx11", username: "mira",     display_name: "Mira",     faction: "syndicate", total_distance_m:  52_110, total_walks: 22, role: "user",    is_banned: false, shadow_banned: false, created_at: new Date(Date.now() - 20 * 86400_000).toISOString(),  last_seen_at: new Date(Date.now() - 3 * 86400_000).toISOString() },
  { id: "dx12", username: "draven",   display_name: "Draven",   faction: null,        total_distance_m: 187_240, total_walks: 71, role: "sales",   is_banned: false, shadow_banned: false, created_at: new Date(Date.now() - 100 * 86400_000).toISOString(), last_seen_at: new Date(Date.now() - 5 * 3600_000).toISOString() },
];

export function RunnersTable({ rows }: { rows: Row[] }) {
  const isDemo = rows.length === 0;
  const displayRows = isDemo ? DEMO_RUNNERS : rows;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  function toggle(id: string) {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelected(s);
  }
  function toggleAll() {
    if (selected.size === displayRows.length) setSelected(new Set());
    else setSelected(new Set(displayRows.map((r) => r.id)));
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
      {isDemo && (
        <div className="mb-3 p-2.5 rounded-lg bg-[#a855f7]/10 border border-[#a855f7]/40 text-xs text-[#c084fc] flex items-center gap-2">
          <span className="text-base">🤖</span>
          <span><b className="font-black tracking-wider">DEMO-DATEN</b> — noch keine Runner passen zu den Filtern. Hier 12 fiktive Runner zum Testen der UI.</span>
        </div>
      )}
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
                <input type="checkbox" checked={selected.size === displayRows.length && displayRows.length > 0} onChange={toggleAll} />
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
            {displayRows.map((r) => (
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
            {displayRows.length === 0 && (
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
