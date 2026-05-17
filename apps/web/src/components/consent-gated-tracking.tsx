"use client";

import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { useEffect, useState } from "react";
import { onConsentChange } from "@/lib/consent";

/**
 * Tracking-/Werbe-Skripte mit DSGVO + Consent-Mode-v2-konformem Mounting.
 *
 * AdSense-Script wurde aus dieser Datei NACH layout.tsx <head> verschoben —
 * dort steht es SSR-gerendert im Initial-HTML, damit der AdSense-Crawler
 * (kein JS-Execute) den Code findet. next/script mit Strategy=afterInteractive
 * hängte das Script erst nach Hydration ein → AdSense-Status "Nicht gefunden".
 *
 * Vercel Analytics / Speed-Insights bleiben hier — setzen Cookies, sind echt
 * consent-gated.
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
    </>
  );
}
