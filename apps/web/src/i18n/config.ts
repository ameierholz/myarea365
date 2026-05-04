/**
 * i18n Konfiguration — 10 unterstützte Sprachen.
 *
 * NEUE SPRACHE HINZUFÜGEN:
 *   1) Locale-Code in `LOCALES` ergänzen (BCP-47-Kurzform).
 *   2) Eintrag in `LOCALE_LABELS` (native Name + Flag + ISO-Country).
 *   3) Eintrag in `LOCALE_BCP47` (z.B. "es-ES").
 *   4) `apps/web/messages/<code>.json` anlegen (Keys aus de.json + Übersetzung).
 *   5) Wenn RTL: in `RTL_LOCALES` ergänzen.
 *   Fertig — neue Sprache erscheint im LanguageSwitcher und in hreflang.
 */

/**
 * Aktuell unterstützte Locales — nur Sprachen mit vollständiger Übersetzung
 * (Privacy + Terms + alle UI-Strings). DSGVO verlangt Verständlichkeit der
 * Rechtstexte; daher nur Locales aktivieren, deren Privacy/Terms vollständig
 * übersetzt sind. Stub-Locales (tr/pl/ru/ar/zh) reaktivieren sobald komplett.
 */
export const LOCALES = [
  "de",  // Deutsch (default)
  "en",  // English
  "es",  // Español
  "fr",  // Français
  "it",  // Italiano
] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "de";

export const LOCALE_LABELS: Record<Locale, { native: string; flag: string; iso: string }> = {
  de: { native: "Deutsch",    flag: "🇩🇪", iso: "de" },
  en: { native: "English",    flag: "🇬🇧", iso: "gb" },
  es: { native: "Español",    flag: "🇪🇸", iso: "es" },
  fr: { native: "Français",   flag: "🇫🇷", iso: "fr" },
  it: { native: "Italiano",   flag: "🇮🇹", iso: "it" },
};

/** BCP-47-Tags für Intl-APIs (Number/Date-Formatting). */
export const LOCALE_BCP47: Record<Locale, string> = {
  de: "de-DE",
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  it: "it-IT",
};

/** Rechts-nach-Links-Sprachen — `<html dir="rtl">` für diese setzen. */
export const RTL_LOCALES: ReadonlySet<Locale> = new Set();

export const LOCALE_COOKIE = "myarea-locale";

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

export function getNumberLocale(locale: string | undefined): string {
  if (locale && isLocale(locale)) return LOCALE_BCP47[locale];
  return LOCALE_BCP47[DEFAULT_LOCALE];
}

export function getDateLocale(locale: string | undefined): string {
  return getNumberLocale(locale);
}

export function getDir(locale: string | undefined): "ltr" | "rtl" {
  if (locale && isLocale(locale) && RTL_LOCALES.has(locale)) return "rtl";
  return "ltr";
}

/**
 * Alternates für hreflang-Tags. Liefert eine Map von BCP-47 → Pfad-Variante.
 * Verwendet wird Cookie-basierte Locale-Switching, daher haben alle Locales denselben Pfad
 * — der `lang`-Diskrimnator zwischen Versionen liegt in der Render-Antwort.
 *
 * Wenn ihr später Locale-Prefix-Routing einführt (`/en/dashboard`), Pfade hier mappen.
 */
export function buildAlternates(canonical: string): Record<string, string> {
  const out: Record<string, string> = { "x-default": canonical };
  for (const loc of LOCALES) {
    out[LOCALE_BCP47[loc]] = canonical;
  }
  return out;
}
