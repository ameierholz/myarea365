"use client";

import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Script from "next/script";
import { useEffect, useState } from "react";
import { onConsentChange } from "@/lib/consent";

/**
 * DSGVO/ePrivacy-konformes Mounten von Tracking-/Werbe-Skripten.
 * Vercel Analytics + Speed-Insights laden nur bei `analytics`-Consent.
 * AdSense lädt nur bei `ads`-Consent.
 * Re-rendert automatisch beim Consent-Change (kein Page-Reload nötig).
 */
export function ConsentGatedTracking() {
  const [analytics, setAnalytics] = useState(false);
  const [ads, setAds] = useState(false);

  useEffect(() => {
    return onConsentChange((s) => {
      setAnalytics(s.analytics);
      setAds(s.ads);
    });
  }, []);

  return (
    <>
      {analytics && <Analytics />}
      {analytics && <SpeedInsights />}
      {ads && (
        <Script
          id="adsense-script"
          async
          strategy="afterInteractive"
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9799640580685030"
          crossOrigin="anonymous"
        />
      )}
    </>
  );
}
