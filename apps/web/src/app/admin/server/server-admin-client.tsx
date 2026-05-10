"use client";

import { useEffect, useState, useCallback } from "react";

type Stat = {
  city_slug: string;
  city_name: string;
  players_total: number;
  crew_members_total: number;
  power_sum_proxy: number;
  snapshot_at: string;
};

const PRIMARY = "#22D1C3";
const ACCENT = "#FF2D78";

export function ServerAdminClient() {
  const [stats, setStats] = useState<Stat[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    slug: "", name: "",
    bounds_sw_lng: 0, bounds_sw_lat: 0,
    bounds_ne_lng: 0, bounds_ne_lat: 0,
    center_lng: 0, center_lat: 0,
    plz_prefixes: "",
  });

  const loadStats = useCallback(async () => {
    const r = await fetch("/api/admin/server/stats", { cache: "no-store" });
    if (r.ok) {
      const j = await r.json() as { ok: boolean; stats: Stat[] };
      setStats(j.stats ?? []);
    }
  }, []);

  useEffect(() => { void loadStats(); }, [loadStats]);

  async function refreshMv() {
    setBusy("refresh"); setMsg(null);
    try {
      const r = await fetch("/api/admin/server/stats", { method: "POST" });
      const j = await r.json() as { ok: boolean; error?: string };
      setMsg(j.ok ? "Stats refreshed" : `Fehler: ${j.error}`);
      if (j.ok) await loadStats();
    } finally { setBusy(null); }
  }

  async function activateServer() {
    setBusy("activate"); setMsg(null);
    try {
      const prefixes = form.plz_prefixes.split(",").map(s => s.trim()).filter(Boolean);
      const r = await fetch("/api/admin/server/activate", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, plz_prefixes: prefixes }),
      });
      const j = await r.json() as { ok: boolean; error?: string; waitlist_notified?: number };
      setMsg(j.ok ? `✓ Server "${form.slug}" aktiv. ${j.waitlist_notified ?? 0} Wartelisten-User informiert.` : `Fehler: ${j.error}`);
      if (j.ok) {
        await loadStats();
        setForm({ ...form, slug: "", name: "", plz_prefixes: "" });
      }
    } finally { setBusy(null); }
  }

  async function startNewEra(slug: string) {
    if (!confirm(`Wirklich neue Era für "${slug}" starten? Alle Bauten/Truppen/Researches dieser Stadt werden gelöscht.`)) return;
    setBusy(`era:${slug}`); setMsg(null);
    try {
      const r = await fetch("/api/admin/server/new-era", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ city_slug: slug }),
      });
      const j = await r.json() as { ok: boolean; error?: string; new_era_number?: number };
      setMsg(j.ok ? `✓ Era ${j.new_era_number} gestartet für ${slug}` : `Fehler: ${j.error}`);
      if (j.ok) await loadStats();
    } finally { setBusy(null); }
  }

  return (
    <div style={{ maxWidth: 1100, margin: "20px auto", padding: 16, color: "#FFF", fontFamily: "Inter, system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 16 }}>Server-Verwaltung</h1>

      {msg && <div style={{ padding: 10, borderRadius: 8, background: msg.startsWith("✓") ? `${PRIMARY}33` : `${ACCENT}33`, marginBottom: 12 }}>{msg}</div>}

      {/* Stats-Tabelle */}
      <section style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Aktive Server ({stats.length})</h2>
          <button onClick={refreshMv} disabled={busy === "refresh"} style={btn(PRIMARY)}>
            {busy === "refresh" ? "…" : "Stats neu laden"}
          </button>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", background: "rgba(255,255,255,0.04)", borderRadius: 8 }}>
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.08)", textAlign: "left", fontSize: 12 }}>
              <th style={th}>Slug</th><th style={th}>Name</th><th style={th}>Spieler</th><th style={th}>Crew-Members</th><th style={th}>Power-Sum (Proxy)</th><th style={th}>Snapshot</th><th style={th}>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.city_slug} style={{ borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 13 }}>
                <td style={td}><code>{s.city_slug}</code></td>
                <td style={td}>{s.city_name}</td>
                <td style={td}>{s.players_total}</td>
                <td style={td}>{s.crew_members_total}</td>
                <td style={td}>{s.power_sum_proxy}</td>
                <td style={{ ...td, fontSize: 10, color: "#a8b4cf" }}>{new Date(s.snapshot_at).toLocaleString("de-DE")}</td>
                <td style={td}>
                  <button onClick={() => startNewEra(s.city_slug)} disabled={busy === `era:${s.city_slug}`} style={btn(ACCENT)}>
                    {busy === `era:${s.city_slug}` ? "…" : "Neue Era"}
                  </button>
                </td>
              </tr>
            ))}
            {stats.length === 0 && (
              <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: "#a8b4cf" }}>Keine Server geladen — klick "Stats neu laden".</td></tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Activate-Form */}
      <section>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Neuen Server aktivieren</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, background: "rgba(255,255,255,0.04)", padding: 12, borderRadius: 8 }}>
          {(["slug","name"] as const).map((k) => (
            <label key={k} style={{ fontSize: 11, color: "#a8b4cf" }}>
              {k}
              <input value={form[k] as string} onChange={(e) => setForm({ ...form, [k]: e.target.value })} style={inp} />
            </label>
          ))}
          {(["bounds_sw_lng","bounds_sw_lat","bounds_ne_lng","bounds_ne_lat","center_lng","center_lat"] as const).map((k) => (
            <label key={k} style={{ fontSize: 11, color: "#a8b4cf" }}>
              {k}
              <input type="number" step="0.001" value={form[k] as number} onChange={(e) => setForm({ ...form, [k]: parseFloat(e.target.value) })} style={inp} />
            </label>
          ))}
          <label style={{ fontSize: 11, color: "#a8b4cf", gridColumn: "span 2" }}>
            PLZ-Präfixe (kommagetrennt, z.B. "20,21,22")
            <input value={form.plz_prefixes} onChange={(e) => setForm({ ...form, plz_prefixes: e.target.value })} style={inp} placeholder="20,21,22" />
          </label>
          <button onClick={activateServer} disabled={busy === "activate" || !form.slug || !form.name} style={{ ...btn(PRIMARY), gridColumn: "span 2", padding: 12, fontSize: 14 }}>
            {busy === "activate" ? "…" : "Server aktivieren"}
          </button>
        </div>
      </section>
    </div>
  );
}

const btn = (color: string): React.CSSProperties => ({
  padding: "6px 12px", borderRadius: 6, background: color, color: "#000", fontWeight: 700, fontSize: 11, border: "none", cursor: "pointer",
});
const th: React.CSSProperties = { padding: "10px 12px", fontWeight: 700 };
const td: React.CSSProperties = { padding: "10px 12px" };
const inp: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: 6, marginTop: 4,
  background: "rgba(0,0,0,0.3)", color: "#FFF", border: "1px solid rgba(255,255,255,0.1)",
};
