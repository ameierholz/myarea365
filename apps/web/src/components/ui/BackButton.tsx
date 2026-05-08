"use client";

import type { CSSProperties } from "react";

export type BackButtonProps = {
  onClick: () => void;
  size?: "sm" | "md" | "lg";
  ariaLabel?: string;
  style?: CSSProperties;
};

const SIZE_PX = { sm: 28, md: 32, lg: 38 } as const;
const FONT_PX = { sm: 16, md: 18, lg: 22 } as const;

export function BackButton({
  onClick,
  size = "md",
  ariaLabel = "Zurück",
  style,
}: BackButtonProps) {
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
        fontWeight: 700,
        lineHeight: 1,
        cursor: "pointer",
        transition: `all var(--motion-fast) var(--ease-out)`,
        padding: 0,
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--color-primary-soft)";
        e.currentTarget.style.color = "var(--color-primary)";
        e.currentTarget.style.borderColor = "var(--color-primary)";
        e.currentTarget.style.transform = "translateX(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--color-surface)";
        e.currentTarget.style.color = "var(--color-text-muted)";
        e.currentTarget.style.borderColor = "var(--color-border-soft)";
        e.currentTarget.style.transform = "";
      }}
    >
      ←
    </button>
  );
}
