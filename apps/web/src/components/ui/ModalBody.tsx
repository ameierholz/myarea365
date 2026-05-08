"use client";

import type { CSSProperties, ReactNode } from "react";

export type ModalBodyProps = {
  children: ReactNode;
  /** "padded" = Standard-Innenabstand · "flush" = ohne Padding (für Hero-Images) */
  padding?: "flush" | "tight" | "padded" | "loose";
  /** Soll der Body scrollen können falls Inhalt zu groß? */
  scrollable?: boolean;
  style?: CSSProperties;
  className?: string;
};

const PADDING_MAP = {
  flush:  "0",
  tight:  "10px 12px",
  padded: "14px 16px",
  loose:  "20px 22px",
} as const;

export function ModalBody({
  children, padding = "padded", scrollable = true, style, className,
}: ModalBodyProps) {
  return (
    <div
      className={className}
      style={{
        flex: 1,
        minHeight: 0,
        padding: PADDING_MAP[padding],
        overflowY: scrollable ? "auto" : "hidden",
        overflowX: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
