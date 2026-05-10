"use client";

import type { ReactNode } from "react";
import { CloseButton } from "./CloseButton";
import { BackButton } from "./BackButton";

export type ModalHeaderAccent = "primary" | "accent" | "gold" | "neutral";

const ACCENT_COLOR: Record<ModalHeaderAccent, string> = {
  primary: "var(--color-primary)",
  accent:  "var(--color-accent)",
  gold:    "var(--color-xp)",
  neutral: "var(--color-text-muted)",
};

export type ModalHeaderProps = {
  /** Kleine Überschrift oberhalb des Titels (z.B. "BAUEN", "SHOP"). */
  kicker?: string;
  /** Haupttitel des Modals. */
  title?: ReactNode;
  /** Untertitel / Beschreibung (klein, gemutet). */
  subtitle?: ReactNode;
  /** Falls gesetzt: zeigt einen ←-Button links und ruft die Funktion auf. */
  onBack?: () => void;
  /** ×-Button rechts. Pflicht — Modale müssen schließbar sein. */
  onClose: () => void;
  /** Steuert die Akzentfarbe des Kickers + Border-Glow. */
  accent?: ModalHeaderAccent;
  /** ID — Modal kann via aria-labelledby darauf zeigen. */
  id?: string;
  /** Zusätzlicher Inhalt rechts neben dem Titel (z.B. Tabs, Filter). */
  right?: ReactNode;
};

export function ModalHeader({
  kicker, title, subtitle, onBack, onClose,
  accent = "primary", id, right,
}: ModalHeaderProps) {
  const accentColor = ACCENT_COLOR[accent];
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px 8px",
        borderBottom: "1px solid var(--color-modal-divider)",
        background: `linear-gradient(180deg, ${accentColor}10 0%, transparent 100%)`,
        flexShrink: 0,
      }}
    >
      {onBack && <BackButton onClick={onBack} />}

      <div style={{ flex: 1, minWidth: 0 }}>
        {kicker && (
          <div
            style={{
              color: accentColor,
              fontSize: 8,
              fontWeight: 900,
              letterSpacing: 1.6,
              textTransform: "uppercase",
              marginBottom: 1,
              lineHeight: 1,
            }}
          >
            {kicker}
          </div>
        )}
        {title && (
          <h2
            id={id}
            className="font-display"
            style={{
              margin: 0,
              color: "var(--color-text)",
              fontSize: 15,
              fontWeight: 800,
              lineHeight: 1.15,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </h2>
        )}
        {subtitle && (
          <div
            style={{
              color: "var(--color-text-muted)",
              fontSize: 10,
              fontWeight: 600,
              marginTop: 1,
              lineHeight: 1.25,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>

      {right && <div style={{ flexShrink: 0 }}>{right}</div>}

      <CloseButton onClick={onClose} />
    </header>
  );
}
