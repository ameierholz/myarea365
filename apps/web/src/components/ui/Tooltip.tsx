"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { Z } from "@/lib/z-index";

export type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
  /** Delay vor dem Anzeigen (ms). */
  delay?: number;
  /** Position relativ zum Trigger. */
  side?: "top" | "bottom" | "left" | "right";
  /** Maximalbreite des Tooltips. */
  maxWidth?: number;
};

export function Tooltip({
  content, children, delay = 350, side = "top", maxWidth = 240,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);

  function show() {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const ttRect = tooltipRef.current?.getBoundingClientRect();
      const ttW = ttRect?.width ?? 200;
      const ttH = ttRect?.height ?? 40;
      let top = 0, left = 0;
      switch (side) {
        case "top":    top = rect.top - ttH - 8;       left = rect.left + rect.width / 2 - ttW / 2; break;
        case "bottom": top = rect.bottom + 8;          left = rect.left + rect.width / 2 - ttW / 2; break;
        case "left":   top = rect.top + rect.height/2 - ttH/2; left = rect.left - ttW - 8;          break;
        case "right":  top = rect.top + rect.height/2 - ttH/2; left = rect.right + 8;               break;
      }
      // viewport clamp
      left = Math.max(6, Math.min(left, window.innerWidth - ttW - 6));
      top  = Math.max(6, Math.min(top, window.innerHeight - ttH - 6));
      setPos({ top, left });
      setOpen(true);
    }, delay);
  }

  function hide() {
    if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null; }
    setOpen(false);
    setPos(null);
  }

  useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current); }, []);

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        style={{ display: "inline-flex" }}
      >
        {children}
      </span>
      {open && pos && typeof document !== "undefined" && (
        <div
          ref={tooltipRef}
          role="tooltip"
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            zIndex: Z.tooltip,
            maxWidth,
            padding: "8px 12px",
            background: "var(--color-modal-surface-hi)",
            backdropFilter: "blur(20px) saturate(160%)",
            WebkitBackdropFilter: "blur(20px) saturate(160%)",
            border: "1px solid var(--color-modal-border)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow-lg)",
            color: "var(--color-text)",
            fontSize: 11,
            fontWeight: 600,
            lineHeight: 1.4,
            pointerEvents: "none",
            animation: "ma365-tooltip-in var(--motion-fast) var(--ease-out) forwards",
          }}
        >
          {content}
        </div>
      )}
    </>
  );
}
