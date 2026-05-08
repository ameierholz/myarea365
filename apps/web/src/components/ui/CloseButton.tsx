"use client";

import type { CSSProperties } from "react";

export type CloseButtonProps = {
  onClick: () => void;
  size?: "sm" | "md" | "lg";
  ariaLabel?: string;
  style?: CSSProperties;
};

const SIZE_PX = { sm: 28, md: 32, lg: 38 } as const;
const FONT_PX = { sm: 18, md: 22, lg: 26 } as const;

export function CloseButton({
  onClick,
  size = "md",
  ariaLabel = "Schließen",
  style,
}: CloseButtonProps) {
  const dim = SIZE_PX[size];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        flexShrink: 0,
        width: dim,
        height: dim,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-surface)",
        border: "1px solid var(--color-border-soft)",
        borderRadius: "var(--radius-full)",
        color: "var(--color-text-muted)",
        fontSize: FONT_PX[size],
        fontWeight: 400,
        lineHeight: 1,
        cursor: "pointer",
        transition: `all var(--motion-fast) var(--ease-out)`,
        padding: 0,
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--color-accent-soft)";
        e.currentTarget.style.color = "var(--color-accent)";
        e.currentTarget.style.borderColor = "var(--color-accent)";
        e.currentTarget.style.transform = "scale(1.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--color-surface)";
        e.currentTarget.style.color = "var(--color-text-muted)";
        e.currentTarget.style.borderColor = "var(--color-border-soft)";
        e.currentTarget.style.transform = "";
      }}
    >
      ×
    </button>
  );
}
