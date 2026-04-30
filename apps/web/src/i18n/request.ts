import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, LOCALES, LOCALE_COOKIE, isLocale, type Locale } from "./config";

/**
 * Locale resolution order:
 *  1) Cookie (gesetzt vom LanguageSwitcher)
 *  2) Accept-Language Header (erste matching LOCALE)
 *  3) DEFAULT_LOCALE (de)
 */
export async function resolveLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;

  const h = await headers();
  const al = h.get("accept-language") || "";
  for (const part of al.split(",")) {
    const code = part.trim().split(/[-;]/)[0].toLowerCase();
    if (isLocale(code)) return code;
  }
  return DEFAULT_LOCALE;
}

/**
 * Lädt Messages für eine Locale mit Deep-Merge-Fallback auf Default-Locale.
 * Übersetzungs-Lücken werden so transparent von DE überdeckt — kein
 * "key.missing.like.this"-Output für End-User.
 */
async function loadMessages(locale: Locale): Promise<Record<string, unknown>> {
  const defaults = (await import(`../../messages/${DEFAULT_LOCALE}.json`)).default as Record<string, unknown>;
  if (locale === DEFAULT_LOCALE) return defaults;
  try {
    const localized = (await import(`../../messages/${locale}.json`)).default as Record<string, unknown>;
    return deepMerge(defaults, localized);
  } catch {
    // Skeleton-JSON noch nicht angelegt → fallback auf Default.
    return defaults;
  }
}

function deepMerge(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(override)) {
    const baseVal = base[k];
    if (
      baseVal && typeof baseVal === "object" && !Array.isArray(baseVal) &&
      v && typeof v === "object" && !Array.isArray(v)
    ) {
      out[k] = deepMerge(baseVal as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  const messages = await loadMessages(locale);
  return {
    locale,
    messages,
    timeZone: "Europe/Berlin",
    now: new Date(),
  };
});

export { LOCALES };
