import type { Metadata } from "next";
import { LOCALES, LOCALE_BCP47, type Locale } from "@/i18n/config";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://myarea365.de";

export interface SeoOptions {
  /** Pfad ohne führenden Slash, z.B. "dashboard" oder "" für Startseite. */
  path?: string;
  title: string;
  description: string;
  /** Aktuelle Locale dieser Seite. */
  locale: Locale;
  /** Optionales OG-Image (absolute URL). */
  image?: string;
  /** Soll diese Seite in Suchmaschinen indexiert werden? Default: true. */
  index?: boolean;
  /** Article/website/profile — Default: website. */
  ogType?: "website" | "article" | "profile";
}

/**
 * Baut Next.js Metadata mit:
 *  - canonical URL
 *  - hreflang für alle 10 Locales (+ x-default)
 *  - OG/Twitter Cards
 *  - Robots-Direktiven
 *
 * Verwendung in einer Page:
 *   export async function generateMetadata() {
 *     return buildSeoMetadata({
 *       path: "dashboard",
 *       title: t("metaTitle"),
 *       description: t("metaDesc"),
 *       locale: await getLocale(),
 *     });
 *   }
 */
export function buildSeoMetadata(opts: SeoOptions): Metadata {
  const path = opts.path ?? "";
  const canonical = `${SITE_URL}/${path}`.replace(/\/$/, "") || SITE_URL;

  const languages: Record<string, string> = { "x-default": canonical };
  for (const loc of LOCALES) {
    languages[LOCALE_BCP47[loc]] = canonical;
  }

  const ogImage = opts.image || `${SITE_URL}/og-image.png`;

  return {
    title: opts.title,
    description: opts.description,
    metadataBase: new URL(SITE_URL),
    alternates: { canonical, languages },
    openGraph: {
      title: opts.title,
      description: opts.description,
      url: canonical,
      siteName: "MyArea365",
      type: opts.ogType ?? "website",
      locale: LOCALE_BCP47[opts.locale],
      images: [{ url: ogImage, width: 1200, height: 630, alt: opts.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: opts.title,
      description: opts.description,
      images: [ogImage],
    },
    robots: opts.index === false
      ? { index: false, follow: false }
      : { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  };
}
