"use client";

/**
 * HEIMAT-MARKER-MODALS
 *  - PersonalMarkerModal: Allgemein/Freunde/Gegner
 *  - CrewMarkerModal: 9 Aktions-Icons (Angriff/Schild/Sammeln/...) + Dringend (5000 Krypto)
 *  - SharePinModal: Crew-Inbox oder einzelner Empfänger
 */

import { useEffect, useState } from "react";

type Coords = { lat: number; lng: number };

// ── 1) PersonalMarkerModal ─────────────────────────────────────────
export function PersonalMarkerModal({ coords, onClose, onSuccess }: {
  coords: Coords; onClose: () => void; onSuccess: () => void;
}) {
  const [category, setCategory] = useState<"allgemein" | "freunde" | "gegner">("allgemein");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function go() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/heimat/personal-marker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: coords.lat, lng: coords.lng, category, label: label || null }),
      });
      const j = await r.json() as { ok?: boolean; error?: string };
      if (j.ok) { setMsg("✅ Markierung gesetzt"); setTimeout(onSuccess, 800); }
      else setMsg(`❌ ${j.error ?? "Fehler"}`);
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[9200] bg-black/70 flex items-end sm:items-center justify-center p-2" onClick={onClose}>
      <div className="bg-[#1A1D23] border border-[#FFD700]/40 rounded-2xl p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-base font-bold text-[#F0F0F0] uppercase tracking-wider">Persönliche Markierung</div>
          <button onClick={onClose} className="text-[#8B8FA3] hover:text-white px-2">✕</button>
        </div>
        <div className="text-[10px] font-mono text-[#8B8FA3] mb-3">
          {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
        </div>
        <input
          value={label} onChange={(e) => setLabel(e.target.value)}
          placeholder="Notiz (optional)"
          className="w-full bg-[#0F1115] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#F0F0F0] mb-4"
        />
        <div className="grid grid-cols-3 gap-2 mb-4">
          {([
            { k: "allgemein", icon: "⭐", color: "#FFD700", label: "Allgemein" },
            { k: "freunde", icon: "🤝", color: "#22D1C3", label: "Freunde" },
            { k: "gegner", icon: "⚔️", color: "#FF2D78", label: "Gegner" },
          ] as const).map((c) => (
            <button
              key={c.k}
              onClick={() => setCategory(c.k)}
              className={`p-3 rounded-xl border-2 transition ${category === c.k ? "bg-white/10" : "bg-white/[0.03] border-white/10"}`}
              style={category === c.k ? { borderColor: c.color, boxShadow: `0 0 20px ${c.color}55` } : undefined}
            >
              <div className="text-2xl mb-1">{c.icon}</div>
              <div className="text-xs font-bold text-[#F0F0F0]">{c.label}</div>
            </button>
          ))}
        </div>
        {msg && <div className="text-xs mb-3 text-[#F0F0F0]">{msg}</div>}
        <button
          disabled={busy}
          onClick={go}
          className="w-full bg-gradient-to-r from-[#FFD700] to-[#FF6B4A] text-[#0F1115] font-bold py-2.5 rounded-lg disabled:opacity-50"
        >
          {busy ? "..." : "Bestätigen"}
        </button>
      </div>
    </div>
  );
}

// ── 2) CrewMarkerModal ─────────────────────────────────────────────
const CREW_ACTIONS: Array<{ k: string; icon: string; color: string; label: string }> = [
  { k: "angriff",      icon: "⚔️", color: "#FF2D78", label: "Angriff" },
  { k: "verteidigen",  icon: "🛡",  color: "#22D1C3", label: "Verteidigen" },
  { k: "warnung",      icon: "⚠️", color: "#FF6B4A", label: "Warnung" },
  { k: "sammeln",      icon: "⛏",  color: "#FFD700", label: "Sammeln" },
  { k: "aufbauen",     icon: "🔨", color: "#8B8FA3", label: "Aufbauen" },
  { k: "heilen",       icon: "💚", color: "#22D1C3", label: "Heilen" },
  { k: "schild",       icon: "🔵", color: "#22D1C3", label: "Schild" },
  { k: "ziel",         icon: "🎯", color: "#FF2D78", label: "Ziel" },
  { k: "wichtig",      icon: "⭐", color: "#FFD700", label: "Wichtig" },
];

export function CrewMarkerModal({ coords, onClose, onSuccess }: {
  coords: Coords; onClose: () => void; onSuccess: () => void;
}) {
  const [actionKind, setActionKind] = useState("angriff");
  const [label, setLabel] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [activeCount, setActiveCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/heimat/crew-marker", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { markers?: unknown[] }) => setActiveCount(j.markers?.length ?? 0))
      .catch(() => {});
  }, []);

  async function go() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/heimat/crew-marker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: coords.lat, lng: coords.lng, action_kind: actionKind, label: label || null, is_urgent: isUrgent }),
      });
      const j = await r.json() as { ok?: boolean; error?: string; need?: number };
      if (j.ok) { setMsg("✅ Crew-Marker gesetzt"); setTimeout(onSuccess, 800); }
      else if (j.error === "marker_limit_reached") setMsg("❌ Crew-Limit erreicht (20/20)");
      else if (j.error === "no_crew") setMsg("❌ Du bist in keiner Crew");
      else if (j.error === "not_enough_gold") setMsg(`❌ Nicht genug Krypto (${j.need ?? 0} nötig)`);
      else setMsg(`❌ ${j.error ?? "Fehler"}`);
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[9200] bg-black/70 flex items-end sm:items-center justify-center p-2" onClick={onClose}>
      <div className="bg-[#1A1D23] border border-[#FF2D78]/40 rounded-2xl p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-base font-bold text-[#F0F0F0] uppercase tracking-wider">Crew-Markierung</div>
          <div className="flex items-center gap-3">
            {activeCount !== null && <span className="text-xs text-[#8B8FA3]">Aktiv: <b className={activeCount >= 20 ? "text-[#FF2D78]" : "text-[#F0F0F0]"}>{activeCount}/20</b></span>}
            <button onClick={onClose} className="text-[#8B8FA3] hover:text-white px-2">✕</button>
          </div>
        </div>
        <div className="text-[10px] font-mono text-[#8B8FA3] mb-3">
          {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
        </div>
        <input
          value={label} onChange={(e) => setLabel(e.target.value)}
          placeholder="Hinweis (optional)"
          className="w-full bg-[#0F1115] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#F0F0F0] mb-3"
        />
        <div className="grid grid-cols-5 gap-2 mb-3">
          {CREW_ACTIONS.map((a) => (
            <button
              key={a.k}
              onClick={() => setActionKind(a.k)}
              className={`p-2 rounded-lg border-2 transition aspect-square flex flex-col items-center justify-center ${actionKind === a.k ? "bg-white/10" : "bg-white/[0.03] border-white/10"}`}
              style={actionKind === a.k ? { borderColor: a.color, boxShadow: `0 0 12px ${a.color}55` } : undefined}
            >
              <div className="text-xl">{a.icon}</div>
              <div className="text-[9px] font-bold text-[#F0F0F0] mt-0.5 leading-tight">{a.label}</div>
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-[#F0F0F0] mb-3 cursor-pointer">
          <input type="checkbox" checked={isUrgent} onChange={(e) => setIsUrgent(e.target.checked)} className="accent-[#FF2D78]" />
          <span>🔴 Dringend (Push an alle Crew · <b className="text-[#FFD700]">5.000 Krypto</b>)</span>
        </label>
        {msg && <div className="text-xs mb-3 text-[#F0F0F0]">{msg}</div>}
        <button
          disabled={busy}
          onClick={go}
          className="w-full bg-gradient-to-r from-[#FF2D78] to-[#22D1C3] text-white font-bold py-2.5 rounded-lg disabled:opacity-50"
        >
          {busy ? "..." : "Bestätigen"}
        </button>
      </div>
    </div>
  );
}

// ── 3) SharePinModal ───────────────────────────────────────────────
export function SharePinModal({ coords, onClose, onSuccess }: {
  coords: Coords; onClose: () => void; onSuccess: () => void;
}) {
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [hasCrew, setHasCrew] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/heimat/crew-marker", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { markers?: unknown[] }) => setHasCrew(Array.isArray(j.markers)))
      .catch(() => setHasCrew(false));
  }, []);

  async function shareTo(target: "crew" | "user") {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/heimat/share-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: coords.lat, lng: coords.lng, label: label || null, target }),
      });
      const j = await r.json() as { ok?: boolean; error?: string };
      if (j.ok) { setMsg(`✅ Geteilt`); setTimeout(onSuccess, 800); }
      else setMsg(`❌ ${j.error ?? "Fehler"}`);
    } finally { setBusy(false); }
  }

  function copyLink() {
    const url = `${window.location.origin}/dashboard?lat=${coords.lat.toFixed(5)}&lng=${coords.lng.toFixed(5)}`;
    navigator.clipboard?.writeText(url).then(
      () => { setMsg("✅ Link kopiert"); },
      () => { setMsg("❌ Clipboard nicht verfügbar"); }
    );
  }

  return (
    <div className="fixed inset-0 z-[9200] bg-black/70 flex items-end sm:items-center justify-center p-2" onClick={onClose}>
      <div className="bg-[#1A1D23] border border-[#22D1C3]/40 rounded-2xl p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-base font-bold text-[#F0F0F0] uppercase tracking-wider">Pin teilen</div>
          <button onClick={onClose} className="text-[#8B8FA3] hover:text-white px-2">✕</button>
        </div>
        <div className="text-[10px] font-mono text-[#8B8FA3] mb-3">
          {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
        </div>
        <input
          value={label} onChange={(e) => setLabel(e.target.value)}
          placeholder="Nachricht (optional)"
          className="w-full bg-[#0F1115] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#F0F0F0] mb-3"
        />
        <div className="space-y-2">
          <button
            disabled={busy || hasCrew === false}
            onClick={() => shareTo("crew")}
            className="w-full bg-gradient-to-r from-[#22D1C3] to-[#1AA89D] text-[#0F1115] font-bold py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>👥</span> <span>An Crew-Inbox</span>
          </button>
          <button
            disabled={busy}
            onClick={copyLink}
            className="w-full bg-white/5 hover:bg-white/10 text-[#F0F0F0] font-bold py-3 rounded-lg flex items-center justify-center gap-2"
          >
            <span>🔗</span> <span>Link kopieren</span>
          </button>
        </div>
        {hasCrew === false && (
          <div className="text-[11px] text-[#8B8FA3] mt-2">Du bist in keiner Crew — Crew-Sharing nicht verfügbar.</div>
        )}
        {msg && <div className="text-xs mt-3 text-[#F0F0F0]">{msg}</div>}
      </div>
    </div>
  );
}
