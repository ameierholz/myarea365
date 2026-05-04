"use client";

import { useEffect, useState } from "react";

type SystemKey = "shop_league" | "arena" | "turf_war";

type Tier = {
  id?: string;
  system: SystemKey;
  rank_min: number;
  rank_max: number;
  gebietsruf: number;
  gems: number;
  siegel_universal: number;
  participation_only: boolean;
  label: string | null;
};

type ShopSeason = {
  id: string; business_id: string;
  starts_at: string; ends_at: string;
  total_battles: number;
  status?: string; finalized_at?: string;
};

type ArenaSeason = {
  id: string; name: string;
  starts_at: string; ends_at: string; status: string;
};

type CrewSeason = {
  id: string; year: number; month: number;
  starts_at: string; ends_at: string; status: string;
};

type Snapshot = {
  tiers: Tier[];
  shop_league: { active: ShopSeason[]; recent: ShopSeason[] };
  arena:       { active: ArenaSeason[]; recent: ArenaSeason[] };
  turf_war:    { active: CrewSeason[];  recent: CrewSeason[] };
};

const SYSTEM_LABEL: Record<SystemKey, string> = {
  shop_league: "🏟️ Shop-Liga",
  arena:       "⚔️ Arena",
  turf_war:    "🏴 Turf-Krieg",
};

const SYSTEM_DESC: Record<SystemKey, string> = {
  shop_league: "Wöchentliche Liga pro Shop. Cron Mo 00:05 UTC. Reward = Gebietsruf an Crew-Mitglieder.",
  arena:       "Globale Wächter-vs-Wächter-Liga. Cron 1. d. Monats 01:00 UTC. Reward = Diamanten + Siegel an Top-100.",
  turf_war:    "Monatliche Crew-Liga (Turf-Kriege + Flag-Events + Territorien). Cron Mo 00:10 UTC. Reward = Gebietsruf.",
};

export function SeasonsManagementClient() {
  const [tab, setTab] = useState<SystemKey>("shop_league");
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [editTiers, setEditTiers] = useState<Tier[] | null>(null);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/admin/season-management", { cache: "no-store" });
    const j = await r.json();
    if (j.ok) setSnap(j as Snapshot);
  }
  useEffect(() => { void load(); }, []);

  async function action(payload: Record<string, unknown>, confirmMsg: string) {
    if (!confirm(confirmMsg)) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/season-management", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!j.ok) { alert("Fehler: " + (j.error ?? "unbekannt")); return; }
      alert("Erfolg:\n" + JSON.stringify(j, null, 2));
      await load();
    } finally { setBusy(false); }
  }

  function startEditTiers() {
    if (!snap) return;
    setEditTiers(snap.tiers.filter((t) => t.system === tab).map((t) => ({ ...t })));
  }

  async function saveTiers() {
    if (!editTiers) return;
    // Validierung clientseitig
    for (const t of editTiers) {
      if (t.rank_min > t.rank_max) {
        alert(`Fehler: rank_min (${t.rank_min}) > rank_max (${t.rank_max}) bei "${t.label ?? "?"}"`);
        return;
      }
    }
    setBusy(true);
    try {
      const r = await fetch("/api/admin/season-management", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ system: tab, action: "update_tiers", tiers: editTiers }),
      });
      const j = await r.json();
      if (!j.ok) { alert("Speichern fehlgeschlagen: " + (j.error ?? "")); return; }
      setSavedToast(`✓ ${j.written} Tier-Einträge gespeichert`);
      setTimeout(() => setSavedToast(null), 3000);
      setEditTiers(null);
      await load();
    } finally { setBusy(false); }
  }

  function addTierRow() {
    if (!editTiers) return;
    const lastRank = editTiers.reduce((m, t) => Math.max(m, t.rank_max), 0);
    setEditTiers([
      ...editTiers,
      { system: tab, rank_min: lastRank + 1, rank_max: lastRank + 1,
        gebietsruf: 0, gems: 0, siegel_universal: 0, participation_only: false, label: "" },
    ]);
  }
  function removeTierRow(i: number) {
    if (!editTiers) return;
    setEditTiers(editTiers.filter((_, idx) => idx !== i));
  }
  function updateTierField(i: number, patch: Partial<Tier>) {
    if (!editTiers) return;
    setEditTiers(editTiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }

  if (!snap) return <div className="text-[#8b8fa3] text-sm">Lade …</div>;

  const sysData = snap[tab];
  const sysTiers = (editTiers ?? snap.tiers.filter((t) => t.system === tab));

  return (
    <div className="space-y-4">
      {savedToast && (
        <div className="px-4 py-2 rounded-lg bg-[#4ade80]/15 border border-[#4ade80]/40 text-[#4ade80] text-sm font-bold">
          {savedToast}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-3">
        {(Object.keys(SYSTEM_LABEL) as SystemKey[]).map((k) => (
          <button key={k} onClick={() => { setTab(k); setEditTiers(null); }}
            className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${
              tab === k ? "bg-[#22D1C3] text-[#0F1115]" : "bg-white/5 text-[#dde3f5] hover:bg-white/10"
            }`}>
            {SYSTEM_LABEL[k]}
          </button>
        ))}
      </div>

      <div className="text-xs text-[#8b8fa3]">{SYSTEM_DESC[tab]}</div>

      {/* Aktive Saisons */}
      <Section title={`Aktive Saisons (${sysData.active.length})`} accent="#22D1C3">
        {sysData.active.length === 0 ? (
          <div className="text-[#8b8fa3] text-sm py-4">Keine aktiven Saisons.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-[11px] text-[#8b8fa3] uppercase tracking-wider">
              <tr className="text-left">
                {tab === "shop_league" && (<>
                  <th className="py-2">Business-ID</th><th>Start</th><th>Ende</th><th>Battles</th>
                </>)}
                {tab === "arena" && (<>
                  <th className="py-2">Name</th><th>Start</th><th>Ende</th>
                </>)}
                {tab === "turf_war" && (<>
                  <th className="py-2">Saison</th><th>Start</th><th>Ende</th>
                </>)}
              </tr>
            </thead>
            <tbody>
              {sysData.active.map((s) => (
                <tr key={s.id} className="border-t border-white/5">
                  {tab === "shop_league" && (<>
                    <td className="py-2 text-[#a8b4cf] font-mono text-xs">{(s as ShopSeason).business_id.slice(0, 8)}…</td>
                    <td className="text-[#a8b4cf]">{fmtDate(s.starts_at)}</td>
                    <td className="text-[#a8b4cf]">{fmtDate(s.ends_at)}</td>
                    <td className="text-white font-bold">{(s as ShopSeason).total_battles}</td>
                  </>)}
                  {tab === "arena" && (<>
                    <td className="py-2 text-white font-bold">{(s as ArenaSeason).name}</td>
                    <td className="text-[#a8b4cf]">{fmtDate(s.starts_at)}</td>
                    <td className="text-[#a8b4cf]">{fmtDate(s.ends_at)}</td>
                  </>)}
                  {tab === "turf_war" && (<>
                    <td className="py-2 text-white font-bold">{(s as CrewSeason).year}-{String((s as CrewSeason).month).padStart(2, "0")}</td>
                    <td className="text-[#a8b4cf]">{fmtDate(s.starts_at)}</td>
                    <td className="text-[#a8b4cf]">{fmtDate(s.ends_at)}</td>
                  </>)}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Letzte Finalisierten */}
      <Section title={`Zuletzt abgeschlossen (${sysData.recent.length})`} accent="#8B8FA3">
        {sysData.recent.length === 0 ? (
          <div className="text-[#8b8fa3] text-sm py-4">Noch keine abgeschlossenen Saisons.</div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {sysData.recent.map((s) => (
                <tr key={s.id} className="border-t border-white/5">
                  <td className="py-2 text-[#dde3f5] text-xs font-mono">{s.id.slice(0, 8)}</td>
                  <td className="text-[#a8b4cf] text-xs">{fmtDate(s.starts_at)} → {fmtDate(s.ends_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Aktionen */}
      <Section title="Eingriffe" accent="#FFD700">
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => action({ system: tab, action: "finalize_now" }, "Abgelaufene Saisons jetzt finalisieren? (Cron-Lauf simulieren)")}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-[#22D1C3] text-[#0F1115] font-bold disabled:opacity-40 text-sm">
            ▶ Abgelaufene jetzt finalisieren
          </button>
          <button onClick={() => action({ system: tab, action: "force_close_active" },
            "ALLE aktiven Saisons SOFORT schließen + finalisieren? (Verteilt Rewards für laufende Saisons!)")}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-[#FF2D78] text-white font-bold disabled:opacity-40 text-sm">
            ⚠ Aktive Saisons sofort schließen
          </button>
        </div>
      </Section>

      {/* Tier-Editor */}
      <Section title="Reward-Tiers" accent="#FF2D78"
        actions={
          editTiers ? (
            <div className="flex gap-2">
              <button onClick={saveTiers} disabled={busy}
                className="px-3 py-1.5 rounded bg-[#22D1C3] text-[#0F1115] font-bold text-xs">💾 Speichern</button>
              <button onClick={() => setEditTiers(null)}
                className="px-3 py-1.5 rounded bg-white/10 text-white text-xs font-bold">Abbrechen</button>
            </div>
          ) : (
            <button onClick={startEditTiers}
              className="px-3 py-1.5 rounded bg-white/10 text-[#22D1C3] text-xs font-bold">✎ Bearbeiten</button>
          )
        }>
        <table className="w-full text-xs">
          <thead className="text-[10px] text-[#8b8fa3] uppercase tracking-wider">
            <tr className="text-left">
              <th className="py-2">Rank min</th>
              <th>max</th>
              <th>🏴</th>
              <th>💎</th>
              <th>⚔ Siegel</th>
              <th>Nur w/ Win</th>
              <th>Label</th>
              {editTiers && <th></th>}
            </tr>
          </thead>
          <tbody>
            {sysTiers.map((t, i) => (
              <tr key={t.id ?? `new-${i}`} className="border-t border-white/5">
                {editTiers ? (
                  <>
                    <td><NumIn v={t.rank_min} on={(v) => updateTierField(i, { rank_min: v })} /></td>
                    <td><NumIn v={t.rank_max} on={(v) => updateTierField(i, { rank_max: v })} /></td>
                    <td><NumIn v={t.gebietsruf} on={(v) => updateTierField(i, { gebietsruf: v })} /></td>
                    <td><NumIn v={t.gems} on={(v) => updateTierField(i, { gems: v })} /></td>
                    <td><NumIn v={t.siegel_universal} on={(v) => updateTierField(i, { siegel_universal: v })} /></td>
                    <td>
                      <input type="checkbox" checked={t.participation_only}
                        onChange={(e) => updateTierField(i, { participation_only: e.target.checked })} />
                    </td>
                    <td>
                      <input type="text" value={t.label ?? ""}
                        onChange={(e) => updateTierField(i, { label: e.target.value })}
                        className="bg-white/10 px-2 py-1 rounded text-white text-xs w-full" />
                    </td>
                    <td>
                      <button onClick={() => removeTierRow(i)} className="text-[#FF2D78] text-xs">✕</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-2 text-white font-bold">{t.rank_min}</td>
                    <td className="text-white">{t.rank_max >= 9999 ? "∞" : t.rank_max}</td>
                    <td className="text-[#FF2D78] font-bold">{t.gebietsruf || "—"}</td>
                    <td className="text-[#22D1C3] font-bold">{t.gems || "—"}</td>
                    <td className="text-[#FFD700] font-bold">{t.siegel_universal || "—"}</td>
                    <td>{t.participation_only ? "✓" : "—"}</td>
                    <td className="text-[#a8b4cf]">{t.label ?? ""}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {editTiers && (
          <button onClick={addTierRow} className="mt-3 px-3 py-1.5 rounded bg-white/10 text-[#22D1C3] text-xs font-bold">
            + Tier hinzufügen
          </button>
        )}
      </Section>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────
function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
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

function NumIn({ v, on }: { v: number; on: (v: number) => void }) {
  return (
    <input type="number" value={v} onChange={(e) => on(parseInt(e.target.value, 10) || 0)}
      className="bg-white/10 px-2 py-1 rounded text-white text-xs w-20" />
  );
}
