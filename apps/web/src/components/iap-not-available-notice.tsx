"use client";

import { useEffect, useState } from "react";
import { isInAppPurchaseAllowed } from "@/lib/capacitor";

/**
 * Wird in Käufe-Modalen (Gem-Shop, Boost-Shop, Premium-Upgrade) eingeblendet,
 * wenn die App in der Capacitor-Android-WebView läuft. Verweist den User
 * auf den Browser, weil Google Play-Billing für digitale Goods Pflicht ist
 * und wir aktuell Stripe nutzen.
 *
 * Hinweis bleibt unsichtbar im Browser.
 */
export function IapNotAvailableNotice() {
  const [hide, setHide] = useState(true);

  useEffect(() => {
    setHide(isInAppPurchaseAllowed());
  }, []);

  if (hide) return null;

  return (
    <div className="rounded-lg border border-[#FFD700]/40 bg-[#FFD700]/10 px-3 py-2 text-[12px] text-[#FFD700]">
      <div className="font-black mb-1">Käufe nur im Browser</div>
      <div className="text-[11px] leading-snug text-[#FFD700]/85">
        In der Android-App sind Käufe deaktiviert. Bitte öffne deinen Browser
        unter <a href="https://myarea365.de" className="underline font-bold" target="_blank" rel="noopener noreferrer">myarea365.de</a> und logge dich mit deinem Konto ein, um Diamanten,
        Premium oder Boost-Pakete zu kaufen.
      </div>
    </div>
  );
}
