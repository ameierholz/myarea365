"use client";

import { useEffect, useState } from "react";

type Round = {
  id: string; name: string; status: string;
  signup_starts: string; signup_ends: string; match_starts: string;
  auftakt_ends: string; main_ends: string; awards_ends: string; created_at: string;
};
type Signup = {
  round_id: string; crew_id: string; member_count_at_signup: number;
  power_score_at_signup: number; bracket_id: string | null;
  signed_up_at: string;
  crews?: { name: string | null; slug: string | null } | null;
};
type Bracket = {
  id: string; round_id: string; city_slug: string; size_tier: string;
  crew_count: number; status: string; current_phase: number; winner_crew_id: string | null;
};
type CityPool = { slug: string; name: string; size_tier: string; enabled: boolean };

type Snap = { rounds: Round[]; city_pool: CityPool[]; signups: Signup[]; brackets: Bracket[] };

export function SagaAdminClient() {
  const [snap, setSnap] = useState<Snap | null>(null);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    const r = await fetch("/api/admin/saga/round", { cache: "no-store" });
    const j = await r.json();
    if (j.ok) setSnap(j);
  }
  useEffect(() => { void load(); }, []);

  async function action(payload: Record<string, unknown>, msg: string) {
    if (!confirm(msg)) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/saga/round", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!j.ok) { alert("Fehler: " + (j.error ?? "")); return; }
      alert("OK: " + JSON.stringify(j, null, 2));
      await load();
    } finally { setBusy(false); }
  }

  async function generateMap(bracketId: string, cityName: string) {
    if (!confirm(`Map für ${cityName} generieren? Dauert 30-60 Sekunden (Overpass-API).`)) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/saga/generate-map", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ bracket_id: bracketId }),
      });
      const j = await r.json();
      if (!j.ok) alert("Fehler: " + (j.error ?? "") + (j.detail ? "\n" + j.detail : ""));
      else alert(`Map fertig:\n${j.zones_total} Zonen\n${j.spawn_zones} Spawn\n${j.gates} Tore\n${j.crews_assigned} Crews zugeteilt`);
    } finally { setBusy(false); }
  }

  if (!snap) return <div className="text-text-muted">Lade …</div>;

  return (
    <div className="space-y-6">
      {/* Rounds */}
      <Section title={`Saga-Rounds (${snap.rounds.length})`} accent="#22D1C3"
        actions={<button onClick={() => setShowCreate(true)}
          className="px-3 py-1.5 rounded bg-primary text-bg-deep font-bold text-xs">+ Neue Round</button>}>
        {snap.rounds.length === 0 ? (
          <div className="text-text-muted text-sm py-4">Noch keine Rounds angelegt.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-[10px] text-text-muted uppercase tracking-wider">
              <tr className="text-left">
                <th className="py-2">Name</th><th>Status</th><th>Signup</th><th>Auftakt</th><th>Main</th><th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {snap.rounds.map((r) => {
                const signupCount = snap.signups.filter((s) => s.round_id === r.id).length;
                const bracketCount = snap.brackets.filter((b) => b.round_id === r.id).length;
                return (
                  <tr key={r.id} className="border-t border-white/5">
                    <td className="py-2">
                      <div className="text-white font-bold">{r.name}</div>
                      <div className="text-[10px] text-text-muted">
                        {signupCount} Anmeldungen · {bracketCount} Brackets
                      </div>
                    </td>
                    <td><span className="text-primary font-bold">{r.status}</span></td>
                    <td className="text-xs">{fmt(r.signup_starts)}<br/>→ {fmt(r.signup_ends)}</td>
                    <td className="text-xs">→ {fmt(r.auftakt_ends)}</td>
                    <td className="text-xs">→ {fmt(r.main_ends)}</td>
                    <td>
                      <div className="flex flex-col gap-1">
                        {(r.status === "signup" || r.status === "matchmaking") && (
                          <button onClick={() => action({ action: "force_matchmake", round_id: r.id }, "Matchmaking jetzt erzwingen?")}
                            disabled={busy} className="px-2 py-1 rounded bg-xp text-bg-deep text-xs font-bold">▶ Matchmake</button>
                        )}
                        <button onClick={() => action({ action: "force_finalize_round", round_id: r.id }, "Round JETZT beenden + Rewards verteilen?")}
                          disabled={busy} className="px-2 py-1 rounded bg-accent text-white text-xs font-bold">⚠ Beenden</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>

      {/* Brackets */}
      <Section title={`Brackets (${snap.brackets.length})`} accent="#FFD700">
        {snap.brackets.length === 0 ? (
          <div className="text-text-muted text-sm py-4">Noch keine Brackets gematcht.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-[10px] text-text-muted uppercase tracking-wider">
              <tr className="text-left">
                <th className="py-2">Stadt</th><th>Größe</th><th>Crews</th><th>Status</th><th>Phase</th><th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {snap.brackets.map((b) => {
                const city = snap.city_pool.find((c) => c.slug === b.city_slug);
                return (
                  <tr key={b.id} className="border-t border-white/5">
                    <td className="py-2 text-white font-bold">{city?.name ?? b.city_slug}</td>
                    <td>{b.size_tier}</td>
                    <td>{b.crew_count}</td>
                    <td><span className="text-primary">{b.status}</span></td>
                    <td className="text-center">{b.current_phase}/4</td>
                    <td>
                      <div className="flex gap-1">
                        <button onClick={() => generateMap(b.id, city?.name ?? b.city_slug)} disabled={busy}
                          className="px-2 py-1 rounded bg-primary text-bg-deep text-xs font-bold">🗺 Map gen.</button>
                        <a href={`/admin/saga/${b.id}`}
                          className="px-2 py-1 rounded bg-xp text-bg-deep text-xs font-bold">👁 Preview</a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>

      {/* Global Force-Actions */}
      <Section title="Cron-Force-Aktionen" accent="#FF2D78">
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => action({ action: "force_advance_phases" }, "Phasen-Cron jetzt laufen lassen?")}
            disabled={busy} className="px-4 py-2 rounded bg-white/10 text-white text-sm font-bold">▶ Phases advance</button>
          <button onClick={() => action({ action: "force_resolve_marches" }, "Märsche jetzt auflösen?")}
            disabled={busy} className="px-4 py-2 rounded bg-white/10 text-white text-sm font-bold">▶ Resolve marches</button>
        </div>
      </Section>

      {/* City-Pool */}
      <Section title={`City-Pool (${snap.city_pool.length})`} accent="#8B8FA3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {snap.city_pool.map((c) => (
            <div key={c.slug} className="bg-white/[0.03] border border-white/10 rounded p-2">
              <div className="text-white font-bold">{c.name}</div>
              <div className="text-text-muted">{c.size_tier} {c.enabled ? "" : "(disabled)"}</div>
            </div>
          ))}
        </div>
      </Section>

      {showCreate && <CreateRoundModal onClose={() => setShowCreate(false)} onCreated={async () => { setShowCreate(false); await load(); }} />}
    </div>
  );
}

function CreateRoundModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => Promise<void> }) {
  const [name, setName] = useState("Saga Round " + new Date().toISOString().slice(0, 10));
  const [start, setStart] = useState(() => {
    const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 16);
  });
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/saga/round", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "create", name, signup_starts: new Date(start).toISOString() }),
      });
      const j = await r.json();
      if (!j.ok) { alert("Fehler: " + (j.error ?? "")); return; }
      await onCreated();
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-9999 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#1A1D23] border border-white/10 rounded-xl p-5 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="text-white font-bold text-lg mb-4">+ Neue Saga-Round</div>
        <label className="block text-xs text-text-muted mb-1">Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
          className="w-full bg-white/10 px-3 py-2 rounded text-white mb-3" />
        <label className="block text-xs text-text-muted mb-1">Signup-Start (UTC)</label>
        <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)}
          className="w-full bg-white/10 px-3 py-2 rounded text-white mb-2" />
        <div className="text-[10px] text-text-muted mb-4">
          → Anmeldung 7d → Auftakt 8d → Main-Phase 28d → Apex-Hold 2d → Awards 2d (Total ~47d)
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} disabled={busy} className="px-4 py-2 rounded bg-white/10 text-white text-sm font-bold">Abbrechen</button>
          <button onClick={submit} disabled={busy} className="px-4 py-2 rounded bg-primary text-bg-deep text-sm font-bold">▶ Round starten</button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children, accent, actions }: { title: string; children: React.ReactNode; accent: string; actions?: React.ReactNode }) {
  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: accent }}>{title}</div>
        {actions}
      </div>
      {children}
    </div>
  );
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
