"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createPortal } from "react-dom";

type DialogKind = "alert" | "confirm";
type DialogOpts = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  icon?: string;
};
type DialogState = DialogOpts & { kind: DialogKind; resolve: (v: boolean) => void };

let enqueue: ((d: DialogState) => void) | null = null;

export function appAlert(opts: DialogOpts | string): Promise<void> {
  const o = typeof opts === "string" ? { message: opts } : opts;
  return new Promise((resolve) => {
    if (enqueue) enqueue({ ...o, kind: "alert", resolve: () => resolve() });
    else { window.alert(o.message); resolve(); }
  });
}

export function appConfirm(opts: DialogOpts | string): Promise<boolean> {
  const o = typeof opts === "string" ? { message: opts } : opts;
  return new Promise((resolve) => {
    if (enqueue) enqueue({ ...o, kind: "confirm", resolve });
    else resolve(window.confirm(o.message));
  });
}

export function AppDialogProvider() {
  const t = useTranslations("Common");
  const [queue, setQueue] = useState<DialogState[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    enqueue = (d) => setQueue((q) => [...q, d]);
    return () => { enqueue = null; };
  }, []);

  const current = queue[0];

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") resolve(false);
      else if (e.key === "Enter") resolve(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current]); // eslint-disable-line react-hooks/exhaustive-deps

  function resolve(value: boolean) {
    if (!current) return;
    current.resolve(current.kind === "alert" ? true : value);
    setQueue((q) => q.slice(1));
  }

  if (!mounted || !current) return null;

  const isDanger = !!current.danger;
  const accent = isDanger ? "#FF2D78" : "#22D1C3";
  const icon = current.icon ?? (isDanger ? "⚠️" : current.kind === "confirm" ? "❓" : "ℹ️");

  return createPortal(
    <div
      onClick={() => current.kind === "alert" && resolve(true)}
      style={{
        position: "fixed", inset: 0, zIndex: 10000,
        background: "rgba(15,17,21,0.75)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        animation: "appDialogFade 0.18s ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 420,
          background: "#1A1D23",
          borderRadius: 18,
          border: `1px solid ${accent}55`,
          boxShadow: `0 20px 50px rgba(0,0,0,0.5), 0 0 40px ${accent}22`,
          padding: 22, color: "#F0F0F0",
          animation: "appDialogPop 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: `${accent}20`, border: `1px solid ${accent}55`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, flexShrink: 0,
          }}>{icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {current.title && (
              <div style={{ color: "#FFF", fontSize: 16, fontWeight: 900, marginBottom: 4 }}>
                {current.title}
              </div>
            )}
            <div style={{ color: "#d6ddeb", fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
              {current.message}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
          {current.kind === "confirm" && (
            <button
              onClick={() => resolve(false)}
              style={{
                padding: "10px 18px", borderRadius: 10,
                background: "transparent", border: "1px solid rgba(255,255,255,0.15)",
                color: "#a8b4cf", fontSize: 13, fontWeight: 800, cursor: "pointer",
              }}
            >
              {current.cancelLabel ?? t("cancel")}
            </button>
          )}
          <button
            onClick={() => resolve(true)}
            autoFocus
            style={{
              padding: "10px 22px", borderRadius: 10,
              background: accent, color: "#0F1115",
              border: "none", fontSize: 13, fontWeight: 900, cursor: "pointer",
              boxShadow: `0 4px 14px ${accent}66`,
            }}
          >
            {current.confirmLabel ?? (current.kind === "confirm" ? (isDanger ? t("delete") : t("confirm")) : t("ok"))}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes appDialogFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes appDialogPop { from { opacity: 0; transform: scale(0.92) translateY(8px) } to { opacity: 1; transform: scale(1) translateY(0) } }
      `}</style>
    </div>,
    document.body,
  );
}
