"use client";

import { useEffect, useState } from "react";

type City = {
  slug: string;
  name: string;
  country: string;
  is_active: boolean;
  opened_at: string;
  current_era_id: string | null;
};

type Era = {
  id: string;
  city_slug: string;
  number: number;
  started_at: string;
  ended_at: string | null;
  end_reason: string | null;
  winner_crew_id: string | null;
  hof_snapshot: {
    top_crews?: Array<{ id: string; name: string; member_count: number }>;
    top_players?: Array<{ id: string; username: string; display_name: string }>;
    stats?: { total_players: number; total_crews: number; snapshot_at: string };
  };
};

export function ErasClient() {
  const [cities, setCities] = useState<City[]>([]);
  const [eras, setEras] = useState<Era[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyCity, setBusyCity] = useState<string | null>(null);
  const [confirmCity, setConfirmCity] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<unknown>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/eras", { cache: "no-store" });
      const j = await r.json() as { ok?: boolean; cities?: City[]; eras?: Era[]; error?: string };
      if (!r.ok) throw new Error(j.error ?? "Fehler beim Laden");
      setCities(j.cities ?? []);
      setEras(j.eras ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function endEra(citySlug: string) {
    setBusyCity(citySlug);
    setError(null);
    try {
      const r = await fetch("/api/admin/eras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end_era", city_slug: citySlug, end_reason: "manual" }),
      });
      const j = await r.json() as { ok?: boolean; result?: unknown; error?: string };
      if (!r.ok) throw new Error(j.error ?? "Fehler beim Beenden");
      setLastResult(j.result);
      setConfirmCity(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyCity(null);
    }
  }

  function fmtDate(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
  }
  function daysSince(iso: string): number {
    return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  }

  if (loading) return <div className="text-text-muted text-sm">Lade…</div>;

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm">
          ❌ {error}
        </div>
      )}

      {lastResult != null && (
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-mono">
          ✓ Ära beendet. Result: <pre className="mt-2 whitespace-pre-wrap">{JSON.stringify(lastResult, null, 2)}</pre>
        </div>
      )}

      <div className="space-y-3">
        {cities.length === 0 && (
          <div className="text-text-muted text-sm">Keine Städte konfiguriert.</div>
        )}
        {cities.map((city) => {
          const currentEra = eras.find((e) => e.id === city.current_era_id);
          const cityEras = eras.filter((e) => e.city_slug === city.slug).slice(0, 5);
          const isConfirming = confirmCity === city.slug;
          const days = currentEra ? daysSince(currentEra.started_at) : 0;

          return (
            <div key={city.slug} className="p-4 rounded-xl border border-white/10 bg-black/20">
              <div className="flex items-center justify-between gap-4 mb-3">
                <div>
                  <div className="text-white font-bold text-lg">
                    🏙️ {city.name} <span className="text-text-muted text-xs font-normal">({city.country})</span>
                  </div>
                  <div className="text-text-muted text-xs">
                    Server seit {fmtDate(city.opened_at)} · Status: {city.is_active ? "🟢 aktiv" : "⚪ inaktiv"}
                  </div>
                </div>
                {currentEra && (
                  <div className="text-right">
                    <div className="text-2xl font-black text-primary">Ära {currentEra.number}</div>
                    <div className="text-text-muted text-[11px]">läuft seit {days} {days === 1 ? "Tag" : "Tagen"}</div>
                  </div>
                )}
              </div>

              {/* Aktuelle Ära */}
              {currentEra ? (
                <div className="bg-black/30 rounded-lg p-3 mb-3 border border-primary/20">
                  <div className="text-[11px] text-text-muted mb-1">AKTUELLE ÄRA</div>
                  <div className="text-sm text-text">
                    Gestartet: {fmtDate(currentEra.started_at)}
                  </div>
                </div>
              ) : (
                <div className="text-text-muted text-sm py-2">Keine aktive Ära.</div>
              )}

              {/* Verlauf */}
              {cityEras.filter((e) => e.ended_at).length > 0 && (
                <details className="mb-3">
                  <summary className="text-[11px] text-text-muted cursor-pointer hover:text-text">
                    Beendete Ären ({cityEras.filter((e) => e.ended_at).length})
                  </summary>
                  <div className="mt-2 space-y-2">
                    {cityEras.filter((e) => e.ended_at).map((e) => (
                      <div key={e.id} className="text-[11px] text-text-muted bg-black/20 rounded p-2">
                        <div>
                          <span className="text-text font-bold">Ära {e.number}</span> · {fmtDate(e.started_at)} → {fmtDate(e.ended_at)} · {e.end_reason}
                        </div>
                        {e.hof_snapshot?.stats && (
                          <div className="mt-1">
                            👥 {e.hof_snapshot.stats.total_players} Spieler · 🏴 {e.hof_snapshot.stats.total_crews} Crews
                          </div>
                        )}
                        {e.hof_snapshot?.top_crews && e.hof_snapshot.top_crews.length > 0 && (
                          <div className="mt-1">
                            🥇 Sieger: <span className="text-primary">{e.hof_snapshot.top_crews[0].name}</span> ({e.hof_snapshot.top_crews[0].member_count} Mitglieder)
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* Action */}
              <div className="flex justify-end gap-2">
                {!isConfirming ? (
                  <button
                    onClick={() => setConfirmCity(city.slug)}
                    disabled={!currentEra || busyCity === city.slug}
                    className="px-4 py-2 rounded-lg bg-accent/15 border border-accent/40 text-accent text-xs font-bold hover:bg-accent/25 disabled:opacity-50"
                  >
                    ✕ Ära beenden
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setConfirmCity(null)}
                      disabled={busyCity === city.slug}
                      className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-text-muted text-xs hover:bg-white/10 disabled:opacity-50"
                    >
                      Abbrechen
                    </button>
                    <button
                      onClick={() => void endEra(city.slug)}
                      disabled={busyCity === city.slug}
                      className="px-4 py-2 rounded-lg bg-accent border-none text-white text-xs font-black shadow-[0_0_12px_rgba(255,45,120,0.4)] disabled:opacity-50"
                    >
                      {busyCity === city.slug ? "Beende…" : "✓ Wirklich beenden"}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-[11px] text-text-muted leading-relaxed pt-3 border-t border-white/5">
        <strong>Hinweis:</strong> Ende einer Ära speichert einen Hall-of-Fame-Snapshot
        (Top-Crews, Top-Spieler, Aggregate) und startet Ära N+1. Spielstand-Reset (Bases,
        Resourcen, Marsche) ist NICHT Teil von Phase 1 — wird in Phase 2/3 ergänzt sobald
        Carry-Over-Regeln definiert sind. Für Auto-Trigger ist später Vercel Cron geplant.
      </div>
    </div>
  );
}
