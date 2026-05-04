"use client";

/**
 * Google UMP (User Messaging Platform / Funding Choices) — TCF-v2.2-konformes
 * Consent-Banner fuer AdSense.
 *
 * Laedt das Funding-Choices-Skript ausschliesslich im Browser. Google zeigt das
 * Banner automatisch in GDPR-Regionen (EU + UK), speichert den Consent-String
 * (iabtcf/*) in LocalStorage/Cookies und leitet ihn an AdSense weiter.
 *
 * Publisher-ID kommt aus NEXT_PUBLIC_ADSENSE_PUB_ID (z.B. "ca-pub-9799640580685030").
 * Ohne Pub-ID wird das Script nicht geladen — safe fuer Dev/Staging.
 *
 * Dokumentation:
 * - https://developers.google.com/funding-choices/fc-api-docs
 * - https://support.google.com/fundingchoices
 */

import Script from "next/script";
import { useEffect, useState } from "react";
import { onConsentChange } from "@/lib/consent";

// Fallback auf Publisher-ID aus admob-config falls keine ENV gesetzt — AdSense Web
// teilt sich denselben Account/Publisher mit AdMob Android.
const DEFAULT_PUB_ID = "ca-pub-9799640580685030";

function getPubId(): string | null {
  const raw = process.env.NEXT_PUBLIC_ADSENSE_PUB_ID ?? DEFAULT_PUB_ID;
  if (!raw || !raw.startsWith("ca-pub-")) return null;
  // Google-Funding-URL erwartet "pub-XXX" (ohne "ca-").
  return raw.replace(/^ca-/, "");
}

/**
 * Architektur-Entscheidung (siehe lib/consent.ts):
 * - Erst-Banner = unsere CookieConsent (custom UI, simpel, Single-Layer).
 * - UMP wird NUR geladen wenn der User «ads» bewusst akzeptiert hat —
 *   für TCF-2.2-konforme detaillierte Vendor/Purpose-Auswahl. So gibt es
 *   keinen Doppel-Banner und Consent-Layer 1 (custom) gatet Layer 2 (UMP/TCF).
 */
export function UmpConsent() {
  const pub = getPubId();
  const [adsOk, setAdsOk] = useState(false);

  useEffect(() => onConsentChange((s) => setAdsOk(s.ads)), []);

  if (!pub || !adsOk) return null;

  return (
    <>
      <Script
        id="google-fc-present"
        strategy="afterInteractive"
        // Google's official inline snippet — sorgt dafuer dass andere Scripts erkennen
        // koennen, dass Funding Choices aktiv ist (auch bevor es voll geladen ist).
        dangerouslySetInnerHTML={{
          __html: `(function() {
            function signalGooglefcPresent() {
              if (!window.frames['googlefcPresent']) {
                if (document.body) {
                  var iframe = document.createElement('iframe');
                  iframe.style = 'width: 0; height: 0; border: none; z-index: -1000; left: -1000px; top: -1000px;';
                  iframe.style.display = 'none';
                  iframe.name = 'googlefcPresent';
                  document.body.appendChild(iframe);
                } else {
                  setTimeout(signalGooglefcPresent, 0);
                }
              }
            }
            signalGooglefcPresent();
          })();`,
        }}
      />
      <Script
        id="google-funding-choices"
        src={`https://fundingchoicesmessages.google.com/i/${pub}?ers=1`}
        strategy="afterInteractive"
        async
      />
    </>
  );
}

/**
 * Oeffnet den Consent-Dialog erneut (z.B. aus einem "Datenschutz verwalten"-Button).
 * Google laedt die Optionen dynamisch nach; wenn Funding Choices noch nicht bereit
 * ist, wird der Aufruf automatisch in die Queue gelegt.
 */
export function openPrivacyOptions(): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as {
    googlefc?: {
      callbackQueue?: Array<(() => void) | { CONSENT_DATA_READY?: () => void }>;
      showRevocationMessage?: () => void;
    };
  };
  w.googlefc = w.googlefc ?? {};
  w.googlefc.callbackQueue = w.googlefc.callbackQueue ?? [];
  w.googlefc.callbackQueue.push(() => {
    w.googlefc?.showRevocationMessage?.();
  });
}
