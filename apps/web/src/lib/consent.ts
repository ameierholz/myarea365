/**
 * Strict-Opt-In Consent-Gate für Tracking + Werbe-Cookies.
 *
 * Architektur:
 *  - Single Source of Truth ist `localStorage["ma365.consent"]`.
 *  - Tracking-Code (Analytics, AdSense, Sentry-Replay) MUSS vor jedem Aufruf
 *    `hasConsent("analytics")` / `hasConsent("ads")` / etc. fragen.
 *  - Niemals Tracking-Pixel, Cookies, Identifier setzen bevor User Consent erteilt hat.
 *  - Server-side Tracking läuft nur wenn Cookie ma365_consent=1 gesetzt ist.
 *
 * DSGVO + ePrivacy + TTDSG kompatibel.
 */

export type ConsentCategory = "necessary" | "analytics" | "ads" | "personalization";

export interface ConsentState {
  necessary: true;          // immer true — technisch nötig (Auth, Session)
  analytics: boolean;       // Vercel Analytics, Sentry Performance
  ads: boolean;             // AdSense, Google UMP
  personalization: boolean; // personalisierte Shop-Empfehlungen
  decidedAt: number;        // unix-ms
  version: number;          // bei Erweiterung der Kategorien hochsetzen → re-prompt
}

const STORAGE_KEY = "ma365.consent";
const CURRENT_VERSION = 1;

const DEFAULT_DENIED: ConsentState = {
  necessary: true,
  analytics: false,
  ads: false,
  personalization: false,
  decidedAt: 0,
  version: CURRENT_VERSION,
};

export function getConsent(): ConsentState {
  if (typeof window === "undefined") return DEFAULT_DENIED;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DENIED;
    const parsed = JSON.parse(raw) as ConsentState;
    if (parsed.version !== CURRENT_VERSION) return DEFAULT_DENIED;
    return { ...DEFAULT_DENIED, ...parsed, necessary: true };
  } catch {
    return DEFAULT_DENIED;
  }
}

export function hasConsent(cat: ConsentCategory): boolean {
  if (cat === "necessary") return true;
  return getConsent()[cat] === true;
}

export function hasDecided(): boolean {
  return getConsent().decidedAt > 0;
}

export function setConsent(partial: Partial<Omit<ConsentState, "necessary" | "decidedAt" | "version">>): ConsentState {
  if (typeof window === "undefined") return DEFAULT_DENIED;
  const next: ConsentState = {
    ...getConsent(),
    ...partial,
    necessary: true,
    decidedAt: Date.now(),
    version: CURRENT_VERSION,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  // Cookie für Server-Side-Auswertung (1 Jahr, SameSite=Lax)
  const cookieValue = next.analytics ? "1" : "0";
  document.cookie = `ma365_consent=${cookieValue}; Path=/; Max-Age=${365 * 24 * 3600}; SameSite=Lax; Secure`;
  notifyListeners(next);
  return next;
}

export function acceptAll(): ConsentState {
  return setConsent({ analytics: true, ads: true, personalization: true });
}

export function rejectAll(): ConsentState {
  return setConsent({ analytics: false, ads: false, personalization: false });
}

export function withdrawConsent(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  document.cookie = `ma365_consent=; Path=/; Max-Age=0; SameSite=Lax; Secure`;
  notifyListeners(DEFAULT_DENIED);
}

type Listener = (state: ConsentState) => void;
const listeners = new Set<Listener>();

export function onConsentChange(cb: Listener): () => void {
  listeners.add(cb);
  cb(getConsent());
  return () => { listeners.delete(cb); };
}

function notifyListeners(state: ConsentState) {
  for (const l of listeners) {
    try { l(state); } catch { /* keine Auswirkung */ }
  }
}

/**
 * Hilfsfunktion: führt fn nur aus wenn entsprechender Consent gegeben ist.
 * Beispiel:
 *   guarded("analytics", () => track("page_view"));
 */
export function guarded<T>(cat: ConsentCategory, fn: () => T): T | undefined {
  if (!hasConsent(cat)) return undefined;
  return fn();
}
