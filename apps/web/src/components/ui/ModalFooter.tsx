"use client";

import type { CSSProperties, ReactNode } from "react";

export type ModalFooterProps = {
  children: ReactNode;
  /** "between" = links/rechts (zB Back + CTA) · "end" = nur rechts · "stretch" = volle Breite */
  align?: "between" | "end" | "stretch" | "center";
  style?: CSSProperties;
};

const JUSTIFY_MAP = {
  between: "space-between",
  end:     "flex-end",
  stretch: "stretch",
  center:  "center",
} as const;

export function ModalFooter({ children, align = "end", style }: ModalFooterProps) {
  return (
    <footer
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: JUSTIFY_MAP[align],
        gap: 10,
        padding: "12px 16px",
        borderTop: "1px solid var(--color-modal-divider)",
        background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.18) 100%)",
        flexShrink: 0,
        ...style,
      }}
    >
      {children}
    </footer>
  );
}
