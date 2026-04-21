"use client";

import { useEffect, useState } from "react";

type Season = {
  id: string; number: number; name: string;
  starts_at: string; ends_at: string;
  status: "upcoming" | "active" | "archived";
  created_at: string;
};

const DEMO_SEASONS: Season[] = [
  { id: "d1", number: 1, name: "Saison der Klingen", starts_at: new Date(Date.now() - 12 * 86400_000).toISOString(), ends_at: new Date(Date.now() + 78 * 86400_000).toISOString(), status: "active",   created_at: new Date(Date.now() - 14 * 86400_000).toISOString() },
  { id: "d2", number: 0, name: "Pre-Saison (Beta)",   starts_at: new Date(Date.now() - 90 * 86400_000).toISOString(), ends_at: new Date(Date.now() - 12 * 86400_000).toISOString(), status: "archived", created_at: new Date(Date.now() - 90 * 86400_000).toISOString() },
];

export function SeasonsClient() {
  const [seasons, setSeasons] = useState<Season[] | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/seasons", { cache: "no-store" });
    const j = await res.json();
    const rows = (j.seasons ?? []) as Season[];
    if (rows.length === 0) { setSeasons(DEMO_SEASONS); setIsDemo(true); }
    else { setSeasons(rows); setIsDemo(false); }
  }
  useEffect(() => { void load(); }, []);

  async function action(body: Record<string, unknown>, confirmMsg: string) {
    if (!confirm(confirmMsg)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/seasons", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!j.ok) { alert(j.error ?? "Fehler"); return; }
      alert(JSON.stringify(j, null, 2));
      await load();
    } finally { setBusy(false); }
  }

  async function startSeason() {
    const name = prompt("Name der neuen Saison?", "Saison 1");
    if (!name) return;
    const daysStr = prompt("Dauer in Tagen?", "90");
    const days = daysStr ? parseInt(daysStr, 10) : 90;
    await action({ action: "start", name, duration_days: days }, `Saison „${name}" (${days} Tage) starten?`);
  }
  async function endSeason() {
    await action({ action: "end" }, "Aktive Saison JETZT beenden? Prestige wird vergeben, Saison-Wächter werden archiviert.");
  }
  async function rollover() {
    const name = prompt("Name der Folge-Saison?", "Saison 2");
    if (!name) return;
    const daysStr = prompt("Dauer in Tagen?", "90");
    const days = daysStr ? parseInt(daysStr, 10) : 90;
    await action({ action: "rollover", next_name: name, duration_days: days },
      `Rollover: aktuelle Saison beenden + „${name}" (${days} Tage) starten?`);
  }

  const active = seasons?.find((s) => s.status === "active");

  return (
    <div className="space-y-5">
      {isDemo && (
        <div className="p-2.5 rounded-lg bg-[#a855f7]/10 border border-[#a855f7]/40 text-xs text-[#c084fc] flex items-center gap-2">
          <span className="text-base">🤖</span>
          <span><b className="font-black tracking-wider">DEMO-DATEN</b> — noch keine Saisons. Migration 00031 im SQL Editor ausführen, dann ↻.</span>
        </div>
      )}
      <div className="flex gap-2 flex-wrap">
        <button onClick={startSeason} disabled={busy || !!active}
          title={active ? "Es läuft bereits eine Saison" : ""}
          className="px-4 py-2 rounded-lg bg-[#22D1C3] text-[#0F1115] font-bold disabled:opacity-40 disabled:cursor-not-allowed">
          ▶️ Saison starten
        </button>
        <button onClick={endSeason} disabled={busy || !active}
          className="px-4 py-2 rounded-lg bg-[#FF2D78] text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed">
          ⏹️ Saison beenden
        </button>
        <button onClick={rollover} disabled={busy || !active}
          className="px-4 py-2 rounded-lg bg-[#FFD700] text-[#0F1115] font-bold disabled:opacity-40 disabled:cursor-not-allowed">
          🔁 Rollover (end + start)
        </button>
      </div>

      {!seasons ? (
        <div className="text-sm text-[#8B8FA3]">Lade …</div>
      ) : seasons.length === 0 ? (
        <div className="text-sm text-[#8B8FA3]">Noch keine Saisons. Migration 00031 im Supabase SQL Editor ausführen.</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-[11px] tracking-wider text-[#8B8FA3]">
              <tr>
                <th className="text-left p-2">#</th>
                <th className="text-left p-2">Name</th>
                <th className="text-left p-2">Start</th>
                <th className="text-left p-2">Ende</th>
                <th className="text-left p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {seasons.map((s) => (
                <tr key={s.id} className="border-t border-white/5">
                  <td className="p-2 font-black text-[#FFD700]">{s.number}</td>
                  <td className="p-2 text-white font-bold">{s.name}</td>
                  <td className="p-2 text-[#a8b4cf]">{new Date(s.starts_at).toLocaleDateString("de-DE")}</td>
                  <td className="p-2 text-[#a8b4cf]">{new Date(s.ends_at).toLocaleDateString("de-DE")}</td>
                  <td className="p-2">
                    <StatusPill status={s.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: Season["status"] }) {
  const meta = status === "active"  ? { label: "AKTIV",    color: "#4ade80", bg: "rgba(74,222,128,0.15)" }
             : status === "upcoming" ? { label: "KOMMEND", color: "#22D1C3", bg: "rgba(34,209,195,0.15)" }
             :                         { label: "ARCHIVIERT",  color: "#8B8FA3", bg: "rgba(139,143,163,0.15)" };
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider"
      style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}44` }}>
      {meta.label}
    </span>
  );
}
