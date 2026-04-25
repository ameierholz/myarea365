"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { ShopDealsContent } from "./shop-deals-content";

/**
 * Modal-Overlay für Shop-Deals (lokale Kiez-Rabatte).
 * Wird vom Bottom-Nav-Button "🏪 Shop-Deals" geöffnet.
 *
 * Die zugrundeliegende Logik (Filter, Suche, GPS, Liste) ist in
 * ShopDealsContent gekapselt und wird identisch von /deals (Vollseite,
 * SEO/Bookmark-fähig) und von hier geteilt.
 */
export function ShopDealsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const tM = useTranslations("Modals");
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 4000,
        background: "rgba(10,12,20,0.85)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16, paddingBottom: "max(16px, env(safe-area-inset-bottom))",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 900, maxHeight: "92vh",
          borderRadius: 18, overflow: "hidden",
          background: "#0F1115",
          border: "1px solid rgba(74,222,128,0.4)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.7), 0 0 40px rgba(74,222,128,0.15)",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "14px 18px",
          background: "linear-gradient(135deg, rgba(74,222,128,0.18), rgba(34,209,195,0.10))",
          borderBottom: "1px solid rgba(74,222,128,0.3)",
        }}>
          <span style={{ fontSize: 22 }}>🏪</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 1.2, color: "#4ade80" }}>{tM("sdmKicker")}</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: "#FFF" }}>{tM("sdmTitle")}</div>
          </div>
          <button
            onClick={onClose}
            aria-label={tM("closeAria")}
            style={{
              background: "rgba(255,255,255,0.08)", border: "none",
              color: "#a8b4cf", width: 34, height: 34, borderRadius: 999,
              cursor: "pointer", fontSize: 18, lineHeight: 1, flexShrink: 0,
            }}
          >×</button>
        </div>

        {/* Inhalt — scrollbar */}
        <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
          <ShopDealsContent />
        </div>
      </div>
    </div>
  );
}
