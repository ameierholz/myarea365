"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Z } from "@/lib/z-index";
import { pushModalStack, popModalStack } from "@/lib/modal-stack";

export type ModalSize = "sm" | "md" | "lg" | "xl" | "full";
export type ModalVariant = "modal" | "drawer";

const SIZE_MAX_WIDTH: Record<ModalSize, string> = {
  sm:   "420px",
  md:   "560px",
  lg:   "720px",
  xl:   "960px",
  full: "100vw",
};

const EXIT_MS = 220; // muss zu --motion-base passen

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  size?: ModalSize;
  variant?: ModalVariant;
  zIndex?: number;
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
  /** ARIA-Beschriftung — Heading-ID, falls vorhanden */
  ariaLabelledBy?: string;
  /** Wird nach abgeschlossenem Exit aufgerufen — z.B. um Reset-Logik laufen zu lassen. */
  onExited?: () => void;
  children: ReactNode;
};

export function Modal({
  open,
  onClose,
  size = "md",
  variant = "modal",
  zIndex = Z.modal,
  closeOnBackdrop = true,
  closeOnEsc = true,
  ariaLabelledBy,
  onExited,
  children,
}: ModalProps) {
  // Mount/Unmount-State-Machine: rendered → exiting → unmounted
  const [rendered, setRendered] = useState(open);
  const [phase, setPhase] = useState<"enter" | "exit">("enter");
  const exitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      if (exitTimerRef.current) { window.clearTimeout(exitTimerRef.current); exitTimerRef.current = null; }
      setRendered(true);
      // Reset auf "enter" damit beim Re-Open die in-Animation greift
      requestAnimationFrame(() => setPhase("enter"));
    } else if (rendered) {
      setPhase("exit");
      exitTimerRef.current = window.setTimeout(() => {
        setRendered(false);
        onExited?.();
      }, EXIT_MS);
    }
    return () => {
      if (exitTimerRef.current) { window.clearTimeout(exitTimerRef.current); exitTimerRef.current = null; }
    };
  }, [open, rendered, onExited]);

  // ESC-Handler
  useEffect(() => {
    if (!rendered || !closeOnEsc) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rendered, closeOnEsc, onClose]);

  // Body-Scroll-Lock während Modal offen ist
  useEffect(() => {
    if (!rendered) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prevOverflow; };
  }, [rendered]);

  // Modal-Stack-Counter: ChatWidget versteckt sich bei nested Modals
  useEffect(() => {
    if (!rendered) return;
    pushModalStack();
    return () => { popModalStack(); };
  }, [rendered]);

  if (!rendered) return null;
  if (typeof document === "undefined") return null;

  const isDrawer = variant === "drawer";
  const isExiting = phase === "exit";

  const backdropAnim = isExiting
    ? `ma365-backdrop-out var(--motion-fast) var(--ease-in) forwards`
    : `ma365-backdrop-in var(--motion-base) var(--ease-out) forwards`;

  const surfaceAnim = isDrawer
    ? (isExiting
        ? `ma365-modal-out var(--motion-fast) var(--ease-in) forwards`
        : `ma365-drawer-in var(--motion-base) var(--ease-out) forwards`)
    : (isExiting
        ? `ma365-modal-out var(--motion-fast) var(--ease-in) forwards`
        : `ma365-modal-in var(--motion-base) var(--ease-out) forwards`);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
      onClick={closeOnBackdrop ? onClose : undefined}
      style={{
        position: "fixed",
        inset: 0,
        zIndex,
        display: "flex",
        alignItems: isDrawer ? "flex-end" : "center",
        // Modal an rechtem Rand platziert — Chat hat links Platz.
        justifyContent: isDrawer ? "center" : "flex-end",
        background: "var(--color-modal-backdrop)",
        animation: backdropAnim,
        padding: isDrawer
          ? 0
          : "max(env(safe-area-inset-top, 0px), 8px) 12px max(env(safe-area-inset-bottom, 0px), 8px) 12px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: SIZE_MAX_WIDTH[size],
          maxHeight: isDrawer ? "92vh" : "calc(100vh - 16px)",
          display: "flex",
          flexDirection: "column",
          background: "var(--color-modal-surface)",
          backdropFilter: "blur(28px) saturate(160%)",
          WebkitBackdropFilter: "blur(28px) saturate(160%)",
          border: `1px solid var(--color-modal-border)`,
          borderRadius: isDrawer ? "var(--radius-modal) var(--radius-modal) 0 0" : "var(--radius-modal)",
          boxShadow: "var(--shadow-modal)",
          color: "var(--color-text)",
          overflow: "hidden",
          animation: surfaceAnim,
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
