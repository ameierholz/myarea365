"use client";

/**
 * Skip-Link für Tastatur-Navigation (WCAG 2.4.1 "Bypass Blocks").
 * Sichtbar nur bei Fokus — erlaubt Screenreader-/Tab-Usern, lange Navigation
 * zu überspringen und direkt zum Hauptinhalt zu springen.
 *
 * Voraussetzung: Hauptinhalt einer Page hat id="main".
 */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="ma365-skip-link"
      style={{
        position: "absolute",
        top: -100,
        left: 0,
        zIndex: 99999,
        padding: "12px 20px",
        background: "#22D1C3",
        color: "#0F1115",
        fontWeight: 900,
        textDecoration: "none",
        borderRadius: "0 0 8px 0",
      }}
      onFocus={(e) => { e.currentTarget.style.top = "0px"; }}
      onBlur={(e) => { e.currentTarget.style.top = "-100px"; }}
    >
      Zum Hauptinhalt springen
    </a>
  );
}
