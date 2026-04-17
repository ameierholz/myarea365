export const LOCALES = ["de", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "de";

export const LOCALE_LABELS: Record<Locale, { native: string; flag: string; iso: string }> = {
  de: { native: "Deutsch", flag: "🇩🇪", iso: "de" },
  en: { native: "English", flag: "🇬🇧", iso: "gb" },
};

export const LOCALE_COOKIE = "myarea-locale";

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}
