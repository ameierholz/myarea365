"use client";

import type { CSSProperties, MouseEventHandler, ReactNode } from "react";

export type CardVariant = "default" | "active" | "outlined" | "muted";
export type CardPadding = "none" | "tight" | "padded" | "loose";

const PADDING_MAP: Record<CardPadding, string | 0> = {
  none:   0,
  tight:  "8px 10px",
  padded: "12px 14px",
  loose:  "18px 20px",
};

const VARIANT_STYLE: Record<CardVariant, CSSProperties> = {
  default: {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border-soft)",
    boxShadow: "var(--shadow)",
  },
  active: {
    background: "var(--color-surface-active)",
    border: "1px solid var(--color-primary)",
    boxShadow: "var(--shadow-glow-primary)",
  },
  outlined: {
    background: "transparent",
    border: "1px solid var(--color-border)",
    boxShadow: "none",
  },
  muted: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid var(--color-border-soft)",
    boxShadow: "none",
  },
};

export type CardProps = {
  children: ReactNode;
  variant?: CardVariant;
  padding?: CardPadding;
  interactive?: boolean;
  onClick?: MouseEventHandler<HTMLDivElement>;
  style?: CSSProperties;
  className?: string;
};

export function Card({
  children, variant = "default", padding = "padded",
  interactive = false, onClick, style, className,
}: CardProps) {
  const isInteractive = interactive || !!onClick;
  return (
    <div
      onClick={onClick}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      className={className}
      style={{
        borderRadius: "var(--radius-lg)",
        padding: PADDING_MAP[padding],
        cursor: isInteractive ? "pointer" : "default",
        transition: `transform var(--motion-fast) var(--ease-out), box-shadow var(--motion-fast) var(--ease-out), border-color var(--motion-fast) var(--ease-out)`,
        ...VARIANT_STYLE[variant],
        ...style,
      }}
      onMouseEnter={isInteractive ? (e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "var(--shadow-lg), var(--shadow-glow-primary)";
        e.currentTarget.style.borderColor = "var(--color-primary)";
      } : undefined}
      onMouseLeave={isInteractive ? (e) => {
        e.currentTarget.style.transform = "";
        e.currentTarget.style.boxShadow = VARIANT_STYLE[variant].boxShadow as string;
        e.currentTarget.style.borderColor = (VARIANT_STYLE[variant].border as string).split(" ").pop() || "";
      } : undefined}
    >
      {children}
    </div>
  );
}
