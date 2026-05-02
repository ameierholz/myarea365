"use client";

import { useEffect, useState } from "react";

const ACCENT = "#FFD700";
const TEXT = "#F0F0F0";
const MUTED = "#8B8FA3";

type Status = {
  ok: boolean;
  eligible?: boolean;
  already_claimed?: boolean;
  active_in_24h?: boolean;
  hq_count?: number;
  mega_count?: number;
  repeater_count?: number;
  total_coins?: number;
  reason?: string;
};

/**
 * Tagesdividende-Karte für aktive Crew-Mitglieder.
 * Wer in 24h gelaufen ist, bekommt einmal täglich Wegemünzen pro Crew-Repeater.
 * Inaktive sehen die Karte als "Lauf um zu claimen"-Hinweis.
 */
export function DividendClaimCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    try {
      const r = await fetch("/api/me/dividend", { cache: "no-store" });
      if (!r.ok) return;
      setStatus(await r.json() as Status);
    } catch { /* ignore */ }
  };

  useEffect(() => { void load(); }, []);

  const claim = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/me/dividend", { method: "POST" });
      const j = await r.json() as { ok?: boolean; claimed_coins?: number; error?: string };
      if (j.ok) {
        setToast(`+${j.claimed_coins?.toLocaleString("de-DE")} 🪙 kassiert`);
        try { window.dispatchEvent(new CustomEvent("ma365:profile-updated")); } catch { /* ignore */ }
        await load();
        setTimeout(() => setToast(null), 3500);
      } else {
        setToast(j.error ?? "Fehler");
        setTimeout(() => setToast(null), 2500);
      }
    } finally { setBusy(false); }
  };

  if (!status?.ok) return null;
  if (status.reason === "no_crew") return null;

  const total = status.total_coins ?? 0;
  if (total === 0) return null;

  return (
    <div style={{
      borderRadius: 14,
      background: status.eligible
        ? `linear-gradient(135deg, ${ACCENT}33, transparent 70%), rgba(15,17,21,0.85)`
        : "rgba(15,17,21,0.65)",
      border: `1px solid ${status.eligible ? ACCENT : "#2a2f38"}`,
      padding: "14px 16px",
      boxShadow: status.eligible ? `0 0 18px ${ACCENT}33` : "none",
      display: "flex", alignItems: "center", gap: 14,
      flexWrap: "wrap",
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: `linear-gradient(135deg, ${ACCENT}, #FFA500)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 26, flexShrink: 0,
        boxShadow: `0 4px 12px ${ACCENT}66, inset 0 1px 0 rgba(255,255,255,0.5)`,
      }}>📡</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: TEXT, fontSize: 14, fontWeight: 800, marginBottom: 2 }}>
          Repeater-Tagesdividende
        </div>
        <div style={{ color: MUTED, fontSize: 12, lineHeight: 1.4 }}>
          {status.hq_count ?? 0}× HQ · {status.mega_count ?? 0}× Mega · {status.repeater_count ?? 0}× Repeater
          {" → "}
          <span style={{ color: ACCENT, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
            {total.toLocaleString("de-DE")} 🪙/Tag
          </span>
        </div>
        {!status.active_in_24h && (
          <div style={{ color: "#FF6B4A", fontSize: 11, marginTop: 4, fontWeight: 700 }}>
            Lauf in den letzten 24 h, um zu kassieren
          </div>
        )}
        {status.already_claimed && (
          <div style={{ color: MUTED, fontSize: 11, marginTop: 4 }}>
            Heute schon kassiert — kommt morgen wieder
          </div>
        )}
      </div>
      {status.eligible && (
        <button
          onClick={claim}
          disabled={busy}
          style={{
            padding: "8px 14px", borderRadius: 10, border: "none", cursor: busy ? "wait" : "pointer",
            background: `linear-gradient(135deg, ${ACCENT}, #FFA500)`,
            color: "#0F1115", fontWeight: 900, fontSize: 13,
            boxShadow: `0 4px 14px ${ACCENT}77`,
            opacity: busy ? 0.6 : 1,
            flexShrink: 0,
          }}
        >{busy ? "…" : "Kassieren"}</button>
      )}
      {toast && (
        <div style={{
          width: "100%", marginTop: 6,
          padding: "6px 10px", borderRadius: 8,
          background: "rgba(34,209,195,0.12)", border: "1px solid rgba(34,209,195,0.4)",
          color: "#22D1C3", fontSize: 12, fontWeight: 700, textAlign: "center",
        }}>{toast}</div>
      )}
    </div>
  );
}
