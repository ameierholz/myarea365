"use client";

import { useState } from "react";

/**
 * Shared IntroBox-Helper für die Tab-Komponenten in base-modal.
 * Klappbare Erklärungs-Box, default eingeklappt, persistiert User-Aktion in localStorage.
 */
export function IntroBox({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  const storageKey = `ma365.base.intro.${title}`;
  const [open, setOpen] = useState(false);
  function toggle() {
    setOpen((v) => {
      const next = !v;
      try { if (!next) window.localStorage.setItem(storageKey, "1"); } catch {}
      return next;
    });
  }
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: `${accent}55`, background: `${accent}0d` }}>
      <button onClick={toggle} className="w-full flex items-center justify-between px-3 py-2 text-left">
        <span className="text-[10px] font-black tracking-widest" style={{ color: accent }}>{title}</span>
        <span className="text-[#a8b4cf] text-xs">{open ? "▼" : "▶"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 text-[11px] text-[#a8b4cf] leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
}
