"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Initial = {
  radius_m: number;
  min_claims: number;
  xp_bonus: number;
  siegel_bonus: number;
  until: string | null;
};

export function TerritoryBonusSettings({ shopId, initial }: { shopId: string; initial: Initial }) {
  const router = useRouter();
  const [radius, setRadius]           = useState(String(initial.radius_m));
  const [minClaims, setMinClaims]     = useState(String(initial.min_claims));
  const [xpBonus, setXpBonus]         = useState(String(initial.xp_bonus));
  const [siegelBonus, setSiegelBonus] = useState(String(initial.siegel_bonus));
  const [busy, setBusy] = useState(false);

  const active = initial.until && new Date(initial.until) > new Date();
  const daysLeft = active && initial.until
    ? Math.ceil((new Date(initial.until).getTime() - Date.now()) / 86400000)
    : 0;

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/shops/${shopId}/territory-bonus`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          radius_m:     parseInt(radius) || 500,
          min_claims:   parseInt(minClaims) || 10,
          xp_bonus:     parseInt(xpBonus) || 150,
          siegel_bonus: parseInt(siegelBonus) || 1,
        }),
      });
      const j = await res.json();
      if (!j.ok) { alert(j.error ?? "Fehler"); return; }
      router.refresh();
    } finally { setBusy(false); }
  }

  async function forceActivate(days: number) {
    if (!confirm(`Nachbarschafts-Prämie manuell für ${days} Tage aktivieren (ohne Zahlung)?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/shops/${shopId}/territory-bonus`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ force_activate_days: days }),
      });
      const j = await res.json();
      if (!j.ok) { alert(j.error ?? "Fehler"); return; }
      router.refresh();
    } finally { setBusy(false); }
  }

  async function deactivate() {
    if (!confirm("Laufende Nachbarschafts-Prämie SOFORT beenden?")) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/shops/${shopId}/territory-bonus`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ deactivate: true }),
      });
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      {/* Status */}
      <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-white/5 bg-white/[0.02]">
        <div>
          <div className="text-[10px] font-black tracking-widest text-[#8B8FA3]">STATUS</div>
          <div className="text-sm font-bold" style={{ color: active ? "#4ade80" : "#8B8FA3" }}>
            {active ? `AKTIV · noch ${daysLeft} ${daysLeft === 1 ? "Tag" : "Tage"}` : "INAKTIV"}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => forceActivate(30)} disabled={busy}
            className="px-3 py-1.5 rounded-lg bg-[#4ade80]/15 text-[#4ade80] text-xs font-bold border border-[#4ade80]/30 disabled:opacity-40">
            +30 Tage manuell
          </button>
          {active && (
            <button onClick={deactivate} disabled={busy}
              className="px-3 py-1.5 rounded-lg bg-[#FF2D78]/15 text-[#FF2D78] text-xs font-bold border border-[#FF2D78]/30 disabled:opacity-40">
              Sofort beenden
            </button>
          )}
        </div>
      </div>

      {/* Parameter */}
      <div>
        <div className="text-[10px] font-black tracking-widest text-[#8B8FA3] mb-2">BERECHTIGUNGS-KRITERIEN</div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Field label="Radius um Shop (Meter)" sub="200 bis 1000m sinnvoll">
            <input type="number" min={100} max={2000} step={50} value={radius}
              onChange={(e) => setRadius(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#0F1115] border border-white/10 text-sm text-white" />
          </Field>
          <Field label="Mindestens X Gebiete erobert" sub="Anzahl Territorien in den letzten 30 Tagen">
            <input type="number" min={1} max={100} value={minClaims}
              onChange={(e) => setMinClaims(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#0F1115] border border-white/10 text-sm text-white" />
          </Field>
        </div>

        <div className="text-[10px] font-black tracking-widest text-[#8B8FA3] mb-2 mt-4">BELOHNUNGS-GRÖSSE</div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="XP-Bonus pro Einlösung" sub="skaliert mit Wächter-Level">
            <input type="number" min={0} max={5000} step={25} value={xpBonus}
              onChange={(e) => setXpBonus(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#0F1115] border border-white/10 text-sm text-white" />
          </Field>
          <Field label="Universal-Siegel pro Einlösung" sub="1 = Standard, 2–3 = großzügig">
            <input type="number" min={0} max={10} value={siegelBonus}
              onChange={(e) => setSiegelBonus(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#0F1115] border border-white/10 text-sm text-white" />
          </Field>
        </div>
      </div>

      {/* Regel-Vorschau */}
      <div className="p-3 rounded-lg bg-[#0F1115] border border-white/10 text-xs text-[#a8b4cf] leading-relaxed">
        <b className="text-white">Daraus ergibt sich folgende Regel:</b>{" "}
        Ein Runner, der in den letzten 30 Tagen ≥{minClaims} Gebiete im {radius}m-Radius um den Shop erobert hat,
        erhält bei jeder Einlösung <span className="text-[#FFD700] font-bold">+{xpBonus} XP</span>
        {parseInt(siegelBonus) > 0 && <> und <span className="text-[#22D1C3] font-bold">+{siegelBonus} Universal-Siegel</span></>}
        {" "}zusätzlich zur regulären Deal-Belohnung.
      </div>

      <button onClick={save} disabled={busy}
        style={{
          width: "100%", padding: "12px 16px", borderRadius: 10,
          border: "none", cursor: busy ? "wait" : "pointer",
          background: "linear-gradient(135deg, #22D1C3 0%, #0f8178 100%)",
          color: "#0F1115", fontSize: 13, fontWeight: 900, letterSpacing: 1,
          opacity: busy ? 0.5 : 1,
        }}>
        {busy ? "…" : "Parameter speichern"}
      </button>
    </div>
  );
}

function Field({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-bold text-white mb-1">{label}</div>
      {sub && <div className="text-[10px] text-[#6c7590] mb-1">{sub}</div>}
      {children}
    </div>
  );
}
