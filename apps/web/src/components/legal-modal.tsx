"use client";

import { useEffect, useState, useCallback } from "react";

type LegalPage = "impressum" | "datenschutz" | "agb";

const TITLE: Record<LegalPage, string> = {
  impressum:   "Impressum",
  datenschutz: "Datenschutzerklärung",
  agb:         "AGB — Nutzungsbedingungen",
};

let openFn: ((page: LegalPage) => void) | null = null;

export function openLegalModal(page: LegalPage) {
  openFn?.(page);
}

export function LegalModal() {
  const [page, setPage] = useState<LegalPage | null>(null);

  useEffect(() => {
    openFn = (p) => setPage(p);
    return () => { openFn = null; };
  }, []);

  const close = useCallback(() => setPage(null), []);

  useEffect(() => {
    if (!page) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [page, close]);

  if (!page) return null;

  return (
    <div
      onClick={close}
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "rgba(10, 12, 20, 0.85)",
        backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 900, height: "90vh",
          background: "#0F1115",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
          overflow: "hidden",
          display: "flex", flexDirection: "column",
        }}
      >
        <div style={{
          padding: "12px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div style={{ color: "#FFF", fontSize: 15, fontWeight: 900 }}>
            {TITLE[page]}
          </div>
          <button
            onClick={close}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "none",
              color: "#a8b4cf",
              width: 32, height: 32, borderRadius: 999,
              cursor: "pointer", fontSize: 18,
            }}
            aria-label="Schließen"
          >✕</button>
        </div>

        <iframe
          src={`/${page}`}
          title={TITLE[page]}
          style={{
            flex: 1,
            width: "100%",
            border: "none",
            background: "#0F1115",
          }}
        />
      </div>
    </div>
  );
}
