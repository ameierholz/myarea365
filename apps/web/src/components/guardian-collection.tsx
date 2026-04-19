"use client";

import { useEffect, useState, useCallback } from "react";

type GuardianRow = {
  id: string; user_id: string; race_id: string | null; archetype_id: string;
  level: number; xp: number; wins: number; losses: number;
  is_active: boolean; last_switched_at: string | null; acquired_at: string; source: string;
  current_hp_pct: number; wounded_until: string | null;
  race_name: string | null; role: string | null; lore: string | null;
  material_desc: string | null; energy_color: string | null;
};

type Race = { id: string; name: string; role: string; lore: string | null; material_desc: string | null; energy_color: string | null };

type Collection = {
  owned: GuardianRow[];
  all_races: Race[];
  summoning_stones: number;
  km_milestone_unlocks: number[];
};

const ROLE_META: Record<string, { label: string; emoji: string; color: string }> = {
  tank:       { label: "Tank",          emoji: "🛡️", color: "#6991d8" },
  healer:     { label: "Heiler",        emoji: "💚", color: "#1db682" },
  melee_dps:  { label: "Nahkampf-DPS",  emoji: "⚔️", color: "#ef7169" },
  ranged_dps: { label: "Fernkampf-DPS", emoji: "🏹", color: "#a855f7" },
};

export function GuardianCollectionPanel({ onChange }: { onChange?: () => void }) {
  const [col, setCol] = useState<Collection | null>(null);
  const [busy, setBusy] = useState(false);
  const [summonRace, setSummonRace] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/guardian/collection");
    if (res.ok) setCol(await res.json() as Collection);
  }, []);
  useEffect(() => { load(); }, [load]);

  const activate = async (guardianId: string) => {
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/guardian/collection", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "activate", guardian_id: guardianId }),
      });
      const data = await res.json();
      if (data.error === "cooldown") {
        const retry = new Date(data.retry_at);
        const h = Math.ceil((retry.getTime() - Date.now()) / 3600000);
        setErr(`24h-Cooldown aktiv. Noch ~${h}h bis zum nächsten Wechsel.`);
      } else if (data.error) {
        setErr(data.error);
      } else {
        await load();
        onChange?.();
      }
    } finally { setBusy(false); }
  };

  const summon = async () => {
    if (!summonRace) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/guardian/collection", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "summon", race_id: summonRace }),
      });
      const data = await res.json();
      if (data.error === "no_stones") setErr("Keine Beschwörungssteine verfügbar.");
      else if (data.error) setErr(data.error);
      else {
        setSummonRace(null);
        await load();
        onChange?.();
      }
    } finally { setBusy(false); }
  };

  if (!col) return <div style={{ padding: 20, textAlign: "center", color: "#8B8FA3", fontSize: 12 }}>Lade Wächter-Sammlung…</div>;

  const ownedRaceIds = new Set(col.owned.map((g) => g.race_id).filter(Boolean));
  const unowned = col.all_races.filter((r) => !ownedRaceIds.has(r.id));

  return (
    <div>
      {/* Header: Sammel-Status */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px", borderRadius: 12,
        background: "linear-gradient(135deg, rgba(168,85,247,0.15), rgba(34,209,195,0.08))",
        border: "1px solid rgba(168,85,247,0.3)", marginBottom: 12,
      }}>
        <div>
          <div style={{ color: "#FFF", fontSize: 13, fontWeight: 900 }}>
            🛡️ Sammlung: {col.owned.length} / {col.all_races.length}
          </div>
          <div style={{ color: "#a8b4cf", fontSize: 10, marginTop: 1 }}>
            Meilensteine: {[10, 50, 100].map((ms) => col.km_milestone_unlocks.includes(ms) ? `✓${ms}km` : `${ms}km`).join(" · ")}
          </div>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 4,
          padding: "6px 10px", borderRadius: 999,
          background: "rgba(255,215,0,0.15)", border: "1px solid rgba(255,215,0,0.5)",
        }}>
          <span style={{ fontSize: 14 }}>💎</span>
          <span style={{ color: "#FFD700", fontSize: 12, fontWeight: 900 }}>{col.summoning_stones}</span>
        </div>
      </div>

      {/* Besessene Wächter */}
      <div style={{ color: "#8B8FA3", fontSize: 10, fontWeight: 800, letterSpacing: 0.8, marginBottom: 6 }}>
        DEINE WÄCHTER
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, marginBottom: 14 }}>
        {col.owned.map((g) => {
          const meta = g.role ? ROLE_META[g.role] : null;
          const color = g.energy_color || meta?.color || "#22D1C3";
          return (
            <div key={g.id} style={{
              padding: 10, borderRadius: 12,
              background: g.is_active ? `linear-gradient(135deg, ${color}25, rgba(15,17,21,0.7))` : "rgba(70,82,122,0.25)",
              border: `1px solid ${g.is_active ? color : "rgba(255,255,255,0.08)"}`,
              boxShadow: g.is_active ? `0 0 14px ${color}55` : "none",
            }}>
              {g.is_active && (
                <div style={{
                  display: "inline-block", padding: "1px 6px", borderRadius: 999,
                  background: color, color: "#0F1115", fontSize: 9, fontWeight: 900, marginBottom: 4, letterSpacing: 0.5,
                }}>AKTIV</div>
              )}
              {meta && (
                <div style={{ color: meta.color, fontSize: 9, fontWeight: 800, letterSpacing: 0.5 }}>
                  {meta.emoji} {meta.label}
                </div>
              )}
              <div style={{ color: "#FFF", fontSize: 12, fontWeight: 900, marginTop: 2 }}>
                {g.race_name || "Unbekannt"}
              </div>
              <div style={{ color: "#a8b4cf", fontSize: 10, marginTop: 2 }}>
                Lvl {g.level} · {g.wins}W/{g.losses}L
              </div>
              {!g.is_active && (
                <button
                  onClick={() => activate(g.id)}
                  disabled={busy}
                  style={{
                    width: "100%", marginTop: 8, padding: "5px 8px", borderRadius: 8,
                    background: `${color}33`, border: `1px solid ${color}`,
                    color, fontSize: 10, fontWeight: 900, cursor: "pointer",
                  }}
                >Aktivieren</button>
              )}
            </div>
          );
        })}
      </div>

      {/* Verfügbare Rassen zum Beschwören */}
      {unowned.length > 0 && (
        <>
          <div style={{ color: "#8B8FA3", fontSize: 10, fontWeight: 800, letterSpacing: 0.8, marginBottom: 6 }}>
            NOCH NICHT GESAMMELT ({unowned.length})
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 6 }}>
            {unowned.map((r) => {
              const meta = ROLE_META[r.role];
              const canAfford = col.summoning_stones >= 1;
              const selected = summonRace === r.id;
              return (
                <button
                  key={r.id}
                  disabled={!canAfford}
                  onClick={() => setSummonRace(selected ? null : r.id)}
                  title={r.lore || ""}
                  style={{
                    padding: 8, borderRadius: 10, textAlign: "left",
                    background: selected ? `linear-gradient(135deg, ${r.energy_color || meta.color}25, rgba(15,17,21,0.7))` : "rgba(70,82,122,0.15)",
                    border: `1px solid ${selected ? (r.energy_color || meta.color) : "rgba(255,255,255,0.06)"}`,
                    opacity: canAfford ? 1 : 0.5,
                    cursor: canAfford ? "pointer" : "not-allowed",
                  }}
                >
                  <div style={{ color: meta.color, fontSize: 8, fontWeight: 800, letterSpacing: 0.5 }}>
                    {meta.emoji} {meta.label}
                  </div>
                  <div style={{ color: "#FFF", fontSize: 11, fontWeight: 900, marginTop: 2 }}>{r.name}</div>
                  <div style={{ color: "#8B8FA3", fontSize: 9, marginTop: 1, lineHeight: 1.2 }}>
                    {r.material_desc?.slice(0, 40)}…
                  </div>
                </button>
              );
            })}
          </div>
          {summonRace && (
            <div style={{
              marginTop: 10, padding: 10, borderRadius: 10,
              background: "rgba(168,85,247,0.12)", border: "1px solid #a855f7",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <div style={{ flex: 1, fontSize: 11, color: "#FFF" }}>
                💎 1 Beschwörungsstein einlösen für <b>{col.all_races.find(r => r.id === summonRace)?.name}</b>?
              </div>
              <button
                onClick={summon}
                disabled={busy || col.summoning_stones < 1}
                style={{
                  padding: "6px 12px", borderRadius: 8, border: "none",
                  background: "#a855f7", color: "#FFF", fontSize: 11, fontWeight: 900, cursor: "pointer",
                }}
              >Beschwören</button>
            </div>
          )}
          {col.summoning_stones < 1 && (
            <div style={{
              marginTop: 10, padding: 8, borderRadius: 8,
              background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.3)",
              fontSize: 10, color: "#FFD700",
            }}>
              💡 Beschwörungssteine bekommst du durch Meilensteine (10/50/100 km gesamt), Boss-Raid-Siege und seltene Loot-Drops.
            </div>
          )}
        </>
      )}

      {err && (
        <div style={{
          marginTop: 10, padding: 8, borderRadius: 8,
          background: "rgba(255,45,120,0.1)", border: "1px solid rgba(255,45,120,0.4)",
          color: "#FF6BA1", fontSize: 11,
        }}>
          {err}
        </div>
      )}
    </div>
  );
}
