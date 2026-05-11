"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";

const CrewBuildHelpModal = dynamic(
  () => import("@/components/crew-build-help-modal").then((m) => m.CrewBuildHelpModal),
  { ssr: false },
);

type CrewBuild = {
  queue_id: string;
  helps_total: number;
  i_helped_recently: boolean;
};

/**
 * Karten-Pille: zeigt offene Crew-Bauten + pulst wenn welche helfbar sind.
 * Klick öffnet CrewBuildHelpModal.
 *
 * Sichtbarkeit:
 *   - Keine offenen Crew-Bauten → versteckt
 *   - Bauten alle voll/cooldown → grau, kein Pulse
 *   - Mindestens einer helfbar → grün + Pulse
 */
export function CrewHelpPill() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [helpable, setHelpable] = useState(0);

  const reload = useCallback(async () => {
    try {
      const r = await fetch("/api/base/crew-build-help", { cache: "no-store" });
      if (!r.ok) { setCount(0); setHelpable(0); return; }
      const j = await r.json() as { builds?: CrewBuild[] };
      const builds = j.builds ?? [];
      setCount(builds.length);
      setHelpable(builds.filter((b) => !b.i_helped_recently && b.helps_total < 30).length);
    } catch {
      // Crew oder API nicht verfügbar → einfach verstecken
      setCount(0); setHelpable(0);
    }
  }, []);

  useEffect(() => {
    void reload();
    const id = setInterval(reload, 30_000);
    return () => clearInterval(id);
  }, [reload]);

  // Nach Modal-Close neu laden (Hilfen aktualisieren Counter)
  const handleClose = () => { setOpen(false); void reload(); };

  if (count === 0) return null;

  const isHelpable = helpable > 0;
  const bg = isHelpable
    ? "linear-gradient(135deg, rgba(34,197,94,0.30), rgba(34,209,195,0.22))"
    : "linear-gradient(135deg, rgba(70,82,122,0.30), rgba(139,143,163,0.18))";
  const border = isHelpable ? "rgba(34,197,94,0.55)" : "rgba(139,143,163,0.40)";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={isHelpable ? `${helpable} Crew-Bau${helpable === 1 ? "" : "ten"} brauchen Hilfe` : "Alle Crew-Bauten aktuell auf Cooldown / voll"}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "4px 10px", borderRadius: 999,
          background: bg,
          border: `1px solid ${border}`,
          fontSize: 11, fontWeight: 900, color: "#FFF",
          textShadow: "0 1px 2px rgba(0,0,0,0.7)",
          cursor: "pointer",
          animation: isHelpable ? "crew-help-pulse 2.2s ease-in-out infinite" : undefined,
        }}>
        <span style={{ fontSize: 14 }}>🤝</span>
        <span>Crew helfen</span>
        <span style={{
          minWidth: 16, padding: "1px 5px", borderRadius: 999,
          background: isHelpable ? "#22c55e" : "rgba(255,255,255,0.18)",
          color: isHelpable ? "#0F1115" : "#FFF",
          fontSize: 10, fontWeight: 900, textAlign: "center",
        }}>{count}</span>
        <style jsx>{`
          @keyframes crew-help-pulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.45); }
            50%      { box-shadow: 0 0 0 6px rgba(34,197,94,0); }
          }
        `}</style>
      </button>
      {open && <CrewBuildHelpModal onClose={handleClose} />}
    </>
  );
}
