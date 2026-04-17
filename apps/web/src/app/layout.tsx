import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "@/styles/globals.css";
import { PrefsBoot } from "@/components/prefs-boot";

export const metadata: Metadata = {
  title: {
    default: "MyArea365 – Erobere deine Stadt",
    template: "%s | MyArea365",
  },
  description:
    "Gamifizierte Geh- und Lauf-Community. Erschließe Straßenzüge, sammle XP und entdecke lokale Geschäfte.",
  metadataBase: new URL("https://myarea365.de"),
  openGraph: {
    type: "website",
    locale: "de_DE",
    siteName: "MyArea365",
  },
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
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#1b2436" />
      </head>
      <body className="bg-bg text-text antialiased font-sans h-full">
        <PrefsBoot />
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
