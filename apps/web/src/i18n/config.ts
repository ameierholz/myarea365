/**
 * i18n Konfiguration — zentrale Stelle für alle unterstützten Sprachen.
 *
 * NEUE SPRACHE HINZUFÜGEN:
 *   1) Locale-Code in `LOCALES` ergänzen (BCP-47-Kurzform, z.B. "es", "fr", "it").
 *   2) Eintrag in `LOCALE_LABELS` (native Name + Flag + ISO-Country fuer Flag-CDN).
 *   3) Eintrag in `LOCALE_BCP47` fuer Number/Date-Formatting (z.B. "es-ES").
 *   4) `apps/web/messages/<code>.json` anlegen (alle Keys aus `de.json` kopieren + uebersetzen).
 *   5) Optional: Eintrag in layout.tsx → metadata.alternates.languages.
 *   Fertig — neue Sprache erscheint automatisch im LanguageSwitcher.
 */

export const LOCALES = ["de", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "de";

export const LOCALE_LABELS: Record<Locale, { native: string; flag: string; iso: string }> = {
  de: { native: "Deutsch", flag: "🇩🇪", iso: "de" },
  en: { native: "English", flag: "🇬🇧", iso: "gb" },
};

/**
 * BCP-47-Tags fuer Intl-APIs (Number.toLocaleString, Date.toLocaleDateString, etc.).
 * Wird via getNumberLocale()/getDateLocale() abgefragt — niemals direkt
 * `locale === "en" ? "en-US" : "de-DE"` schreiben (nicht erweiterbar).
 */
export const LOCALE_BCP47: Record<Locale, string> = {
  de: "de-DE",
  en: "en-US",
};

export const LOCALE_COOKIE = "myarea-locale";

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

/** Locale -> BCP-47 fuer Number-Formatting. Fallback: de-DE. */
export function getNumberLocale(locale: string | undefined): string {
  if (locale && isLocale(locale)) return LOCALE_BCP47[locale];
  return LOCALE_BCP47[DEFAULT_LOCALE];
}

/** Locale -> BCP-47 fuer Date-Formatting. Fallback: de-DE. */
export function getDateLocale(locale: string | undefined): string {
  return getNumberLocale(locale);
}
