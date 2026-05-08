"use client";

import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

export type ButtonVariant = "primary" | "accent" | "gold" | "ghost" | "danger" | "success";
export type ButtonSize = "sm" | "md" | "lg";

const SIZE_STYLE: Record<ButtonSize, CSSProperties> = {
  sm: { padding: "6px 12px", fontSize: 11, height: 30,  borderRadius: "var(--radius-sm)" },
  md: { padding: "9px 18px", fontSize: 13, height: 38,  borderRadius: "var(--radius)"    },
  lg: { padding: "12px 24px", fontSize: 14, height: 46, borderRadius: "var(--radius-lg)" },
};

const VARIANT_STYLE: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: "linear-gradient(180deg, var(--color-primary) 0%, var(--color-primary-dim) 100%)",
    color: "#0F1115",
    border: "1px solid var(--color-primary)",
    boxShadow: "var(--shadow-glow-primary), inset 0 1px 0 rgba(255,255,255,0.20)",
  },
  accent: {
    background: "linear-gradient(180deg, var(--color-accent) 0%, var(--color-accent-dim) 100%)",
    color: "#FFFFFF",
    border: "1px solid var(--color-accent)",
    boxShadow: "var(--shadow-glow-accent), inset 0 1px 0 rgba(255,255,255,0.20)",
  },
  gold: {
    background: "linear-gradient(180deg, #FFD700 0%, #D4A300 100%)",
    color: "#1F1B30",
    border: "1px solid #FFD700",
    boxShadow: "0 0 24px rgba(255,215,0,0.45), inset 0 1px 0 rgba(255,255,255,0.30)",
  },
  ghost: {
    background: "var(--color-surface)",
    color: "var(--color-text)",
    border: "1px solid var(--color-border-soft)",
    boxShadow: "none",
  },
  danger: {
    background: "linear-gradient(180deg, var(--color-danger) 0%, #c54a4a 100%)",
    color: "#FFFFFF",
    border: "1px solid var(--color-danger)",
    boxShadow: "0 0 24px rgba(255,107,107,0.40), inset 0 1px 0 rgba(255,255,255,0.20)",
  },
  success: {
    background: "linear-gradient(180deg, var(--color-success) 0%, #2dba6a 100%)",
    color: "#0F1115",
    border: "1px solid var(--color-success)",
    boxShadow: "0 0 24px rgba(74,222,128,0.40), inset 0 1px 0 rgba(255,255,255,0.20)",
  },
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  loading = false,
  leftIcon,
  rightIcon,
  disabled,
  children,
  style,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      type="button"
      disabled={isDisabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        fontWeight: 800,
        letterSpacing: 0.4,
        textTransform: "uppercase",
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isDisabled ? 0.55 : 1,
        transition: `transform var(--motion-fast) var(--ease-out), filter var(--motion-fast) var(--ease-out)`,
        width: fullWidth ? "100%" : undefined,
        whiteSpace: "nowrap",
        ...SIZE_STYLE[size],
        ...VARIANT_STYLE[variant],
        ...style,
      }}
      onMouseEnter={(e) => { if (!isDisabled) { e.currentTarget.style.transform = "translateY(-1px) scale(1.02)"; e.currentTarget.style.filter = "brightness(1.08)"; } }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.filter = ""; }}
      onMouseDown={(e)  => { if (!isDisabled) e.currentTarget.style.transform = "translateY(0) scale(0.98)"; }}
      onMouseUp={(e)    => { if (!isDisabled) e.currentTarget.style.transform = "translateY(-1px) scale(1.02)"; }}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden="true"
          style={{
            display: "inline-block", width: 14, height: 14,
            border: "2px solid currentColor", borderTopColor: "transparent",
            borderRadius: "50%", animation: "spin 0.7s linear infinite",
          }}
        />
      ) : leftIcon}
      {children}
      {rightIcon}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </button>
  );
}
