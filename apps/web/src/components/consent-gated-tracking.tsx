"use client";

import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Script from "next/script";
import { useEffect, useState } from "react";
import { onConsentChange } from "@/lib/consent";

/**
 * Tracking-/Werbe-Skripte mit DSGVO + Consent-Mode-v2-konformem Mounting.
 *
 * Wichtige Unterscheidung:
 *  - Vercel Analytics / Speed-Insights: setzen Cookies → ECHT consent-gated
 *  - AdSense: lädt IMMER (auch für Anonymous + Crawler), respektiert aber den
 *    Google-Consent-Mode-v2-State aus layout.tsx (default: ad_storage=denied →
 *    nur kontextuelle, nicht-personalisierte Anzeigen). Personalisierung wird
 *    erst nach User-Consent via gtag('consent','update',...) freigeschaltet.
 *
 * Warum AdSense nicht gated wird:
 *  AdSense-Crawler interagiert nicht mit dem Cookie-Banner. Bei strikt-gatedem
 *  Script bekommt der Crawler `ads=false` → Script lädt nie → AdSense-Site-Review
 *  schlägt mit "Code not found" fehl. Mit Consent-Mode-v2 ist das Always-On-Loading
 *  rechtlich sauber (keine Werbe-Cookies bevor Consent, nur das Script-Asset).
 */
export function ConsentGatedTracking() {
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    return onConsentChange((s) => {
      setAnalytics(s.analytics);
    });
  }, []);

  return (
    <>
      {analytics && <Analytics />}
      {analytics && <SpeedInsights />}

      {/* AdSense — IMMER laden (Consent-Mode-v2 regelt Personalisierung). */}
      <Script
        id="adsense-script"
        async
        strategy="afterInteractive"
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9799640580685030"
        crossOrigin="anonymous"
      />
    </>
  );
}
