"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

// v2: granulare 3-Stufen + Google Consent Mode v2 Integration.
// Storage-Key bewusst hochgezogen → alte v1-Entscheidungen werden re-prompted
// (jetzt mit zusätzlichen Kategorien wie ad_user_data + ad_personalization).
const STORAGE_KEY = "ma365_consent_v2";

export type ConsentCategory = "necessary" | "statistics" | "marketing";

export type ConsentState = {
  /** Immer true — notwendige Cookies (Login, CSRF, Sprache) sind funktional und nicht ablehnbar. */
  necessary: true;
  /** analytics_storage — Google Analytics, Plausible-ähnlich. */
  statistics: boolean;
  /** ad_storage + ad_user_data + ad_personalization — Google AdSense + Marketing-Pixel. */
  marketing: boolean;
  /** ISO-8601-Zeitstempel der Entscheidung. */
  decided_at: string;
  /** Schema-Version (für künftige Migrationen). */
  v: 2;
};

/** Liest den aktuellen Consent-Zustand. SSR/Server: immer `null`. */
export function getConsent(): ConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentState;
    if (parsed.necessary === true && typeof parsed.decided_at === "string" && parsed.v === 2) return parsed;
    return null;
  } catch { return null; }
}

/** Globale Helfer, die Third-Party-Scripts vor dem Laden abfragen sollten. */
export const Consent = {
  marketingAllowed(): boolean { return getConsent()?.marketing === true; },
  statisticsAllowed(): boolean { return getConsent()?.statistics === true; },
  // Backwards-compat aliases (vor v2 hießen sie ads/analytics)
  adsAllowed(): boolean { return getConsent()?.marketing === true; },
  analyticsAllowed(): boolean { return getConsent()?.statistics === true; },
};

/**
 * Update Google Consent Mode v2 nach User-Entscheidung.
 * Setzt voraus dass `gtag('consent', 'default', {...})` schon im <head> initial gesetzt wurde
 * (siehe app/layout.tsx → ConsentBoot Script-Tag).
 */
function pushGtagUpdate(state: ConsentState) {
  if (typeof window === "undefined") return;
  // dataLayer + gtag fn werden im Layout vor jedem Tracker initialisiert
  type GtagFn = (...args: unknown[]) => void;
  const w = window as unknown as { dataLayer?: unknown[]; gtag?: GtagFn };
  if (!w.dataLayer) w.dataLayer = [];
  const gtag: GtagFn = w.gtag ?? ((...a: unknown[]) => { w.dataLayer!.push(a); });
  gtag("consent", "update", {
    analytics_storage:    state.statistics ? "granted" : "denied",
    ad_storage:           state.marketing  ? "granted" : "denied",
    ad_user_data:         state.marketing  ? "granted" : "denied",
    ad_personalization:   state.marketing  ? "granted" : "denied",
  });
}

export function CookieConsent() {
  const tC = useTranslations("Cookie");
  const [state, setState] = useState<ConsentState | null>(null);
  const [ready, setReady] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [draftStats, setDraftStats] = useState(false);
  const [draftMkt, setDraftMkt] = useState(false);

  useEffect(() => {
    const cur = getConsent();
    setState(cur);
    setReady(true);
    // Re-Open via Footer-Button. DSGVO/ePrivacy verlangen jederzeit-revidierbar.
    const onOpen = () => {
      const c = getConsent();
      setDraftStats(c?.statistics ?? false);
      setDraftMkt(c?.marketing ?? false);
      setShowDetails(false);
      setState(null);
    };
    window.addEventListener("ma365:open-consent", onOpen);
    return () => window.removeEventListener("ma365:open-consent", onOpen);
  }, []);

  function save(stats: boolean, mkt: boolean) {
    const next: ConsentState = {
      necessary: true,
      statistics: stats,
      marketing: mkt,
      decided_at: new Date().toISOString(),
      v: 2,
    };
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
    setState(next);
    pushGtagUpdate(next);
    try {
      window.dispatchEvent(new CustomEvent("ma365:consent-change", { detail: next }));
    } catch {}
  }

  function acceptAll()      { save(true,  true);  }
  function rejectAll()      { save(false, false); }
  function saveSelection()  { save(draftStats, draftMkt); }

  if (!ready || state) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-modal="true"
      aria-label={tC("ariaLabel")}
      className="fixed inset-0 z-2000 flex items-end sm:items-center justify-center"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Backdrop — nicht klickbar zum Schließen, der User muss aktiv entscheiden. */}
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" aria-hidden="true" />

      <div
        className="relative w-full max-w-2xl mx-2 sm:mx-4 my-2 sm:my-4 bg-bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
        style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.55), 0 0 60px rgba(34,209,195,0.15)" }}
      >
        <div className="p-5 sm:p-6 max-h-[85vh] overflow-y-auto">
          <div className="flex items-start gap-3 mb-4">
            <span className="text-2xl shrink-0" aria-hidden="true">🍪</span>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-base sm:text-lg mb-1 text-text">{tC("title")}</h2>
              <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                {tC.rich("intro", {
                  a: (chunks) => <a href="/datenschutz" className="text-primary hover:underline">{chunks}</a>,
                })}
              </p>
            </div>
          </div>

          {/* Granulare Auswahl — sichtbar wenn "Auswahl anpassen" geklickt */}
          {showDetails && (
            <div className="space-y-2 mb-4 mt-2">
              <CategoryRow
                title={tC("catNecessary")}
                desc={tC("catNecessaryDesc")}
                checked
                disabled
                onChange={() => {}}
                badge={tC("alwaysActive")}
              />
              <CategoryRow
                title={tC("catStatistics")}
                desc={tC("catStatisticsDesc")}
                checked={draftStats}
                onChange={setDraftStats}
              />
              <CategoryRow
                title={tC("catMarketing")}
                desc={tC("catMarketingDesc")}
                checked={draftMkt}
                onChange={setDraftMkt}
              />
            </div>
          )}

          {/* Buttons — Reject + Accept gleich prominent (DSGVO/Google CMP-Anforderung) */}
          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            {showDetails ? (
              <>
                <button
                  onClick={rejectAll}
                  className="min-h-11 flex-1 px-4 py-2.5 rounded-lg border border-border text-text hover:bg-white/5 text-sm font-bold transition-colors"
                >
                  {tC("rejectAllBtn")}
                </button>
                <button
                  onClick={saveSelection}
                  className="min-h-11 flex-1 px-4 py-2.5 rounded-lg border border-primary/60 text-primary hover:bg-primary/10 text-sm font-bold transition-colors"
                >
                  {tC("saveSelectionBtn")}
                </button>
                <button
                  onClick={acceptAll}
                  className="min-h-11 flex-1 px-4 py-2.5 rounded-lg bg-primary text-bg-deep text-sm font-bold hover:bg-primary-dim transition-colors"
                >
                  {tC("acceptAllBtn")}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={rejectAll}
                  className="min-h-11 flex-1 px-4 py-2.5 rounded-lg border border-border text-text hover:bg-white/5 text-sm font-bold transition-colors"
                >
                  {tC("rejectAllBtn")}
                </button>
                <button
                  onClick={() => {
                    setDraftStats(false);
                    setDraftMkt(false);
                    setShowDetails(true);
                  }}
                  className="min-h-11 flex-1 px-4 py-2.5 rounded-lg border border-border text-text-muted hover:text-text text-sm font-bold transition-colors"
                >
                  {tC("customizeBtn")}
                </button>
                <button
                  onClick={acceptAll}
                  className="min-h-11 flex-1 px-4 py-2.5 rounded-lg bg-primary text-bg-deep text-sm font-bold hover:bg-primary-dim transition-colors"
                >
                  {tC("acceptAllBtn")}
                </button>
              </>
            )}
          </div>

          {/* Footer-Hinweis: Verarbeitungs-Rechtsgrundlage + Verantwortlicher */}
          <p className="text-[10px] text-text-muted/80 mt-4 leading-relaxed">
            {tC("footerHint")}
          </p>
        </div>
      </div>
    </div>
  );
}

function CategoryRow({
  title, desc, checked, disabled = false, onChange, badge,
}: {
  title: string;
  desc: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  badge?: string;
}) {
  return (
    <label
      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
        disabled
          ? "border-border bg-white/2 cursor-default"
          : "border-border hover:border-primary/30 cursor-pointer"
      }`}
    >
      <div className="flex items-center shrink-0 mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 rounded border-border accent-primary"
          aria-label={title}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-bold text-sm text-text">{title}</span>
          {badge && (
            <span className="text-[9px] font-black uppercase tracking-wider text-primary bg-primary/15 border border-primary/30 px-1.5 py-0.5 rounded">
              {badge}
            </span>
          )}
        </div>
        <div className="text-[11px] text-text-muted leading-snug">{desc}</div>
      </div>
    </label>
  );
}
