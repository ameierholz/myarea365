"use client";

import { useEffect, useState } from "react";
import { ResourceIcon, useResourceArt } from "@/components/resource-icon";

const GOLD = "#FFD700";
const PRIMARY = "#22D1C3";
const PINK = "#FF2D78";
const BORDER = "rgba(255,255,255,0.10)";

type Resources = { wood: number; stone: number; gold: number; mana: number };

function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
      padding: "4px 8px",
      whiteSpace: "nowrap", minWidth: 56,
      textShadow: "0 1px 3px rgba(0,0,0,0.85), 0 0 6px rgba(0,0,0,0.6)",
      filter: `drop-shadow(0 1px 3px rgba(0,0,0,0.6)) drop-shadow(0 0 4px ${color}33)`,
    }}>{children}</div>
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
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const saved = window.localStorage.getItem("ma365_resbar_open");
    if (saved !== null) return saved === "1";
    return window.innerWidth >= 768;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("ma365_resbar_open", open ? "1" : "0");
  }, [open]);

  const items = [
    { kind: "gold"  as const, fallback: "💸", color: GOLD,    value: res?.gold  ?? 0, label: "Krypto" },
    { kind: "wood"  as const, fallback: "⚙️", color: "#a07a3c", value: res?.wood  ?? 0, label: "Tech-Schrott" },
    { kind: "stone" as const, fallback: "🔩", color: "#9ba8c7", value: res?.stone ?? 0, label: "Komponenten" },
    { kind: "mana"  as const, fallback: "📡", color: "#a855f7", value: res?.mana  ?? 0, label: "Bandbreite" },
  ];

  return (
    <div style={{
      position: "fixed",
      top: "50%",
      right: 8,
      transform: "translateY(-50%)",
      zIndex: 8500,
      display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6,
      maxHeight: "calc(100vh - 16px)",
    }}>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          aria-label="Ressourcen anzeigen"
          style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "5px 10px", borderRadius: 999,
            background: "rgba(15,17,21,0.92)",
            border: `1px solid ${GOLD}66`,
            color: GOLD, fontSize: 12, fontWeight: 900,
            backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
            cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.45)",
          }}
        >
          💎 {gems != null ? fmt(gems) : "…"} <span style={{ marginLeft: 2, opacity: 0.7 }}>‹</span>
        </button>
      ) : (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "stretch", gap: 5,
        }}>
          {/* Collapse-Toggle (frei schwebend) */}
          <button
            onClick={() => setOpen(false)}
            aria-label="Einklappen"
            style={{
              alignSelf: "flex-end",
              width: 18, height: 18, borderRadius: 9, border: "none",
              background: "rgba(15,17,21,0.55)",
              color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: 900, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
            }}
          >›</button>
          {items.map((it) => (
            <Pill key={it.kind} color={it.color}>
              <ResourceIcon kind={it.kind} size={38} fallback={it.fallback} art={art} />
              <span style={{ color: "#FFF", fontWeight: 900, fontSize: 11 }}>{fmt(it.value)}</span>
            </Pill>
          ))}
          <Pill color={PINK}>
            <span style={{ fontSize: 24, lineHeight: 1 }}>💎</span>
            <span style={{ color: "#FFF", fontWeight: 900, fontSize: 11 }}>{gems != null ? fmt(gems) : "…"}</span>
          </Pill>
          {onAddGems && (
            <button
              onClick={onAddGems}
              aria-label="Diamanten kaufen"
              style={{
                alignSelf: "center",
                width: 30, height: 30, borderRadius: 15, border: "none",
                background: `linear-gradient(135deg, ${PRIMARY}, #4ade80)`,
                color: "#0F1115", fontSize: 18, fontWeight: 900, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 0 12px ${PRIMARY}66`,
                marginTop: 2,
              }}
            >+</button>
          )}
        </div>
      )}
    </div>
  );
}
