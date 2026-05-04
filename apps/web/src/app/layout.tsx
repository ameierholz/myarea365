import type { Metadata } from "next";
import { Bebas_Neue } from "next/font/google";
import { ConsentGatedTracking } from "@/components/consent-gated-tracking";

// Display-Schrift für Headlines, Stats, Badges, Crew-Tags — urbaner Graffiti-Vibe.
// Bebas Neue hat nur ein Weight (400), wirkt aber durch die kondensierte Form auch
// ohne Bold markant. Wird via CSS-Variable verteilt, Body-Text bleibt System-Sans.
const bebas = Bebas_Neue({ subsets: ["latin"], weight: "400", variable: "--font-display", display: "swap" });
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { LOCALES, LOCALE_BCP47, getDir } from "@/i18n/config";
import "@/styles/globals.css";
import { PrefsBoot } from "@/components/prefs-boot";
import { ReferralCapture } from "@/components/referral-capture";
import { AppDialogProvider } from "@/components/app-dialog";
import { PinThemeStyles } from "@/components/pin-theme-styles";
import { LegalFooter } from "@/components/legal-footer";
import { LegalModal } from "@/components/legal-modal";
import { GlobalSvgFilters } from "@/components/global-svg-filters";
import { CookieConsent } from "@/components/cookie-consent";
import { CapacitorAuthBridge } from "@/components/capacitor-auth-bridge";
import { UmpConsent } from "@/components/ump-consent";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { OfflineOutboxBoot } from "@/components/offline-outbox-boot";
import { SkipLink } from "@/components/skip-link";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("Metadata");
  return {
    title: {
      default: t("titleDefault"),
      template: t("titleTemplate"),
    },
    description: t("description"),
    metadataBase: new URL("https://myarea365.de"),
    alternates: {
      canonical: "/",
      // Dynamisch aus LOCALES — neue Sprachen erscheinen automatisch.
      languages: {
        ...Object.fromEntries(LOCALES.map((l) => [LOCALE_BCP47[l], "https://myarea365.de"])),
        "x-default": "https://myarea365.de",
      },
    },
    applicationName: "MyArea365",
    keywords: t("keywords").split(",").map((k) => k.trim()),
    authors: [{ name: "MyArea365" }],
    openGraph: {
      type: "website",
      locale: LOCALE_BCP47[locale as (typeof LOCALES)[number]]?.replace("-", "_") ?? "de_DE",
      siteName: "MyArea365",
      url: "https://myarea365.de",
      title: t("ogTitle"),
      description: t("description"),
      images: [{ url: "/og-default.png", width: 1200, height: 630, alt: t("ogImageAlt") }],
    },
    twitter: {
      card: "summary_large_image",
      title: t("twitterTitle"),
      description: t("twitterDescription"),
      images: ["/og-default.png"],
    },
    icons: {
      icon: "/favicon.ico",
      apple: "/logo.png",
    },
    robots: { index: true, follow: true },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();
  const dir = getDir(locale);
  return (
    <html lang={locale} dir={dir} className={`dark h-full ${bebas.variable}`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#1b2436" />
        {/* Google AdSense — bestaetigt Site-Ownership + aktiviert Ad-Serving. */}
        <meta name="google-adsense-account" content="ca-pub-9799640580685030" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": "https://myarea365.de/#organization",
                  name: "MyArea365",
                  url: "https://myarea365.de",
                  logo: "https://myarea365.de/logo.png",
                  sameAs: [] as string[],
                },
                {
                  "@type": "WebSite",
                  "@id": "https://myarea365.de/#website",
                  url: "https://myarea365.de",
                  name: "MyArea365",
                  description:
                    "Gamifizierte Geh- und Lauf-Community. Erschließe Straßenzüge, sammle Wegemünzen und entdecke lokale Geschäfte.",
                  inLanguage: "de-DE",
                  publisher: { "@id": "https://myarea365.de/#organization" },
                  potentialAction: {
                    "@type": "SearchAction",
                    target: "https://myarea365.de/leaderboard?q={search_term_string}",
                    "query-input": "required name=search_term_string",
                  },
                },
              ],
            }),
          }}
        />
      </head>
      <body className="bg-bg text-text antialiased font-sans h-full">
        <PrefsBoot />
        <ServiceWorkerRegister />
        <OfflineOutboxBoot />
        <CapacitorAuthBridge />
        <ReferralCapture />
        <PinThemeStyles />
        <GlobalSvgFilters />
        <SkipLink />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AppDialogProvider />
          {children}
          <LegalFooter />
          <LegalModal />
          <CookieConsent />
        </NextIntlClientProvider>
        <UmpConsent />
        {/* DSGVO/ePrivacy: Tracking + AdSense laden NUR nach explizitem Consent.
            Via lib/consent.ts — re-rendered bei Consent-Change ohne Reload. */}
        <ConsentGatedTracking />
      </body>
    </html>
  );
}
