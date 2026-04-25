"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const STORAGE_KEY = "ma365_consent_v1";

export type ConsentState = {
  necessary: true; // immer
  analytics: boolean;
  ads: boolean;
  decided_at: string;
};

/** Liest den aktuellen Consent-Zustand. Server/SSR: immer `null`. */
export function getConsent(): ConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentState;
    if (parsed.necessary === true && typeof parsed.decided_at === "string") return parsed;
    return null;
  } catch { return null; }
}

/** Globale Helfer, die Third-Party-Scripts vor dem Laden abfragen sollten. */
export const Consent = {
  adsAllowed(): boolean { return getConsent()?.ads === true; },
  analyticsAllowed(): boolean { return getConsent()?.analytics === true; },
};

export function CookieConsent() {
  const tC = useTranslations("Cookie");
  const [state, setState] = useState<ConsentState | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setState(getConsent());
    setReady(true);
  }, []);

  function save(next: ConsentState) {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
    setState(next);
    // Dispatch Custom-Event statt Full-Reload; Third-Party-Scripts können darauf hören
    // und sich lazy initialisieren, ohne Form-State zu verlieren.
    try {
      window.dispatchEvent(new CustomEvent("ma365:consent-change", { detail: next }));
    } catch {}
  }

  function acceptAll() {
    save({ necessary: true, analytics: true, ads: true, decided_at: new Date().toISOString() });
  }
  function rejectOptional() {
    save({ necessary: true, analytics: false, ads: false, decided_at: new Date().toISOString() });
  }

  if (!ready || state) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={tC("ariaLabel")}
      className="fixed bottom-0 left-0 right-0 z-[2000] p-4 bg-bg-card/95 backdrop-blur-md border-t border-border"
      style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
    >
      <div className="max-w-3xl mx-auto flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1 text-xs sm:text-sm text-text-muted leading-relaxed">
          <b className="text-white">{tC("introBoldRich")}</b>{" "}
          {tC.rich("introRich", {
            a: (chunks) => <a href="/datenschutz" className="text-primary hover:underline">{chunks}</a>,
          })}
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={rejectOptional}
            className="px-4 py-2 rounded-lg border border-border text-text-muted hover:text-white text-xs font-bold"
          >
            {tC("rejectBtn")}
          </button>
          <button
            onClick={acceptAll}
            className="px-4 py-2 rounded-lg bg-primary text-bg-deep text-xs font-bold hover:bg-primary-dim"
          >
            {tC("acceptBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}
