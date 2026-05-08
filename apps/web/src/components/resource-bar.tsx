"use client";

import { useEffect, useState } from "react";
import { ResourceIcon, useResourceArt } from "@/components/resource-icon";

const GOLD = "#FFD700";
const PRIMARY = "#22D1C3";
const PINK = "#FF2D78";
const BORDER = "rgba(255,255,255,0.10)";

type Resources = { wood: number; stone: number; gold: number; mana: number };

function usePillPulse(kind: string): boolean {
  const [pulsing, setPulsing] = useState(false);
  useEffect(() => {
    const onPulse = (e: Event) => {
      const ce = e as CustomEvent<{ kind: string; color?: string }>;
      if (ce.detail?.kind !== kind) return;
      setPulsing(false);
      requestAnimationFrame(() => setPulsing(true));
      window.setTimeout(() => setPulsing(false), 700);
    };
    window.addEventListener("ma365:pill-pulse", onPulse as EventListener);
    return () => window.removeEventListener("ma365:pill-pulse", onPulse as EventListener);
  }, [kind]);
  return pulsing;
}

function GemsPill({ gems, onAddGems }: { gems: number | null; onAddGems?: () => void }) {
  const pulsing = usePillPulse("gems");
  return (
    <div
      data-rss-pill="gems"
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 0,
        padding: "0 2px 0 4px", marginBottom: 0, whiteSpace: "nowrap", minWidth: 40,
        textShadow: "0 1px 3px rgba(0,0,0,0.85), 0 0 6px rgba(0,0,0,0.6)",
        filter: pulsing
          ? `drop-shadow(0 1px 3px rgba(0,0,0,0.6)) drop-shadow(0 0 14px ${PINK}) brightness(1.4)`
          : `drop-shadow(0 1px 3px rgba(0,0,0,0.6)) drop-shadow(0 0 4px ${PINK}33)`,
        transform: pulsing ? "scale(1.18)" : "scale(1)",
        transition: "transform 220ms cubic-bezier(.34,1.56,.64,1), filter 220ms ease",
        willChange: "transform, filter",
        position: "relative",
      }}
    >
      <span style={{ fontSize: 24, lineHeight: 1 }}>💎</span>
      <span style={{ color: "#FFF", fontWeight: 900, fontSize: 9 }}>{gems != null ? fmt(gems) : "…"}</span>
      {onAddGems && (
        <button
          onClick={onAddGems}
          aria-label="Diamanten kaufen"
          style={{
            position: "absolute", top: -2, right: -4,
            width: 14, height: 14, borderRadius: 7, border: `1px solid ${PINK}aa`,
            background: `linear-gradient(135deg, ${PINK}, #FF6B4A)`,
            color: "#FFF", fontSize: 10, fontWeight: 900, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
            boxShadow: `0 0 6px ${PINK}88`,
            paddingBottom: 1,
          }}
        >+</button>
      )}
    </div>
  );
}

function Pill({
  color, kind, children,
}: { color: string; kind: string; children: React.ReactNode }) {
  const pulsing = usePillPulse(kind);

  return (
    <div
      data-rss-pill={kind}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 0,
        padding: "0 2px 0 4px", marginBottom: 0,
        whiteSpace: "nowrap", minWidth: 40,
        textShadow: "0 1px 3px rgba(0,0,0,0.85), 0 0 6px rgba(0,0,0,0.6)",
        filter: pulsing
          ? `drop-shadow(0 1px 3px rgba(0,0,0,0.6)) drop-shadow(0 0 14px ${color}) brightness(1.4)`
          : `drop-shadow(0 1px 3px rgba(0,0,0,0.6)) drop-shadow(0 0 4px ${color}33)`,
        transform: pulsing ? "scale(1.18)" : "scale(1)",
        transition: "transform 220ms cubic-bezier(.34,1.56,.64,1), filter 220ms ease",
        willChange: "transform, filter",
      }}
    >{children}</div>
  );
}

function fmt(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "B";
  if (n >= 1_000_000)     return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 10_000)        return (n / 1000).toFixed(0) + "K";
  if (n >= 1000)          return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString("de-DE");
}

function useResources() {
  const [res, setRes] = useState<Resources | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch("/api/base/me", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json() as { resources?: Resources };
        if (!cancelled && j.resources) setRes(j.resources);
      } catch { /* silent */ }
    };
    void load();
    const onChange = () => void load();
    window.addEventListener("ma365:resources-changed", onChange);
    const iv = setInterval(load, 30000);
    return () => { cancelled = true; window.removeEventListener("ma365:resources-changed", onChange); clearInterval(iv); };
  }, []);
  return res;
}

function useGems(): number | null {
  const [gems, setGems] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch("/api/shop/gems", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json() as { gems?: { gems?: number } };
        if (!cancelled) setGems(j.gems?.gems ?? 0);
      } catch { /* silent */ }
    };
    void load();
    const onChange = () => void load();
    window.addEventListener("ma365:gems-changed", onChange);
    const iv = setInterval(load, 60000);
    return () => { cancelled = true; window.removeEventListener("ma365:gems-changed", onChange); clearInterval(iv); };
  }, []);
  return gems;
}

/**
 * Top-rechte Resource-Übersicht (Krypto/Tech-Schrott/Komponenten/Bandbreite/Gems).
 *
 * Mobile-first: kollabiert auf "+" Pill. Default-State persisted im LocalStorage.
 * Desktop: expanded by default (≥1024px).
 *
 * z-Index 8500 — über Karte, unter Modals (≥9000).
 */
export function ResourceBar({ onAddGems }: { onAddGems?: () => void }) {
  const art = useResourceArt();
  const res = useResources();
  const gems = useGems();
  // SSR-sicher: starte immer mit true (offen) — kein localStorage/window im Initializer.
  // Hydratisierung passiert dann clientseitig im useEffect.
  const [open, setOpen] = useState<boolean>(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("ma365_resbar_open");
      if (saved !== null) setOpen(saved === "1");
      else if (window.innerWidth < 768) setOpen(false);
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { window.localStorage.setItem("ma365_resbar_open", open ? "1" : "0"); } catch { /* ignore */ }
  }, [open, hydrated]);

  // Reihenfolge wie in der Map-UI: Tech-Schrott, Komponenten, Krypto, Bandbreite
  const items = [
    { kind: "wood"  as const, fallback: "⚙️", color: "#a07a3c", value: res?.wood  ?? 0, label: "Tech-Schrott" },
    { kind: "stone" as const, fallback: "🔩", color: "#9ba8c7", value: res?.stone ?? 0, label: "Komponenten" },
    { kind: "gold"  as const, fallback: "💸", color: GOLD,      value: res?.gold  ?? 0, label: "Krypto" },
    { kind: "mana"  as const, fallback: "📡", color: "#a855f7", value: res?.mana  ?? 0, label: "Bandbreite" },
  ];

  return (
    <div style={{
      position: "fixed",
      top: "50%",
      right: 0,
      transform: "translateY(-50%)",
      zIndex: 8500,
      display: "flex", flexDirection: "row", alignItems: "center", gap: 0,
      maxHeight: "calc(100vh - 24px)",
    }}>
      {!open ? (
        // Eingeklappt: vertikaler Mini-Stack — nur Icons, klein und elegant
        <button
          onClick={() => setOpen(true)}
          aria-label="Ressourcen anzeigen"
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            padding: 4, border: "none", background: "transparent", cursor: "pointer",
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.6))",
          }}
        >
          {items.map((it) => (
            <ResourceIcon key={it.kind} kind={it.kind} size={22} fallback={it.fallback} art={art} />
          ))}
          <span style={{ fontSize: 18, lineHeight: 1, filter: `drop-shadow(0 0 4px ${PINK}88)` }}>💎</span>
        </button>
      ) : (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "stretch", gap: 0,
          position: "relative",
        }}>
          {items.map((it) => (
            <Pill key={it.kind} color={it.color} kind={it.kind}>
              <ResourceIcon kind={it.kind} size={32} fallback={it.fallback} art={art} />
              <span style={{ color: "#FFF", fontWeight: 900, fontSize: 9 }}>{fmt(it.value)}</span>
            </Pill>
          ))}
          {/* Diamant-Pill mit integriertem "+" */}
          <GemsPill gems={gems} onAddGems={onAddGems} />
        </div>
      )}

      {/* Slimmer Vertikal-Griff RECHTS neben den Pillen (Richtung Bildschirmrand).
          › = einklappen (Pfeil zeigt nach rechts / raus zum Rand)
          ‹ = aufklappen (Pfeil zeigt nach links / rein in den Screen) */}
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        aria-label={open ? "Einklappen" : "Aufklappen"}
        title={open ? "Einklappen" : "Aufklappen"}
        style={{
          width: 12, height: 44, borderRadius: "6px 0 0 6px",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRight: "none",
          background: "rgba(15,17,21,0.55)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: 900, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 0, lineHeight: 1,
          boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
        }}
      >{open ? "›" : "‹"}</button>
    </div>
  );
}
