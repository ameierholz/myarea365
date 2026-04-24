import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
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
import Script from "next/script";

export const metadata: Metadata = {
  title: {
    default: "MyArea365 – Erobere deine Stadt",
    template: "%s | MyArea365",
  },
  description:
    "Gamifizierte Geh- und Lauf-Community. Erschließe Straßenzüge, sammle Wegemünzen und entdecke lokale Geschäfte.",
  metadataBase: new URL("https://myarea365.de"),
  alternates: {
    canonical: "/",
    languages: {
      "de-DE": "https://myarea365.de",
      "x-default": "https://myarea365.de",
    },
  },
  applicationName: "MyArea365",
  keywords: [
    "Laufen", "Gehen", "Running", "Walking", "Gamification",
    "Crew", "Kiez", "Straße erobern", "Community", "Fitness",
    "lokale Shops", "Rabatte",
  ],
  authors: [{ name: "MyArea365" }],
  openGraph: {
    type: "website",
    locale: "de_DE",
    siteName: "MyArea365",
    url: "https://myarea365.de",
    title: "MyArea365 – Erobere deine Stadt",
    description:
      "Gamifizierte Geh- und Lauf-Community. Erschließe Straßenzüge, sammle Wegemünzen und entdecke lokale Geschäfte.",
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "MyArea365" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "MyArea365 – Erobere deine Stadt",
    description: "Gamifizierte Geh- und Lauf-Community. Deine Schritte erobern deinen Kiez.",
    images: ["/og-default.png"],
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/logo.png",
  },
  robots: { index: true, follow: true },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} className="dark h-full">
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
        <CapacitorAuthBridge />
        <ReferralCapture />
        <AppDialogProvider />
        <PinThemeStyles />
        <GlobalSvgFilters />
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
          <LegalFooter />
          <LegalModal />
          <CookieConsent />
        </NextIntlClientProvider>
        <UmpConsent />
        {/* AdSense — nach Hydration laden, um SSR/Client-Mismatch zu vermeiden.
            Manual Ad Units via <AdSenseSlot />; Auto-Ads in der Konsole ausgeschaltet. */}
        <Script
          id="adsense-script"
          async
          strategy="afterInteractive"
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9799640580685030"
          crossOrigin="anonymous"
        />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
