"use client";

import { useEffect } from "react";

/**
 * Service-Worker-Lifecycle:
 *  - PROD: Registriert /sw.js für Tile- + Asset-Caching.
 *  - DEV:  Deregistriert eventuell vorhandene SWs (vom letzten Prod-Build),
 *          weil ein gecachter SW im Dev-Modus alte Chunks serviert
 *          → "localhost lädt nicht / weißer Screen".
 *
 * Defensive: SW darf die App nie blockieren — alle Fehler werden silent geschluckt.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV === "production") {
      const onLoad = () => {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      };
      if (document.readyState === "complete") onLoad();
      else window.addEventListener("load", onLoad, { once: true });
      return () => window.removeEventListener("load", onLoad);
    }

    // DEV: alle vorhandenen SWs killen + Caches leeren, sonst werden alte
    // Bundles ausgeliefert und HMR funktioniert nicht.
    // Wichtig: wenn ein SW gefunden + entfernt wird, MUSS die Seite einmal
    // hart reloadet werden — sonst lebt die aktuell-geladene Seite weiter mit
    // dem alten SW-Bundle. Marker im sessionStorage verhindert Reload-Loop.
    void (async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        let unregistered = 0;
        for (const r of regs) {
          if (await r.unregister()) unregistered++;
        }
        if (typeof caches !== "undefined") {
          const keys = await caches.keys();
          await Promise.all(keys.filter((k) => k.startsWith("ma365-")).map((k) => caches.delete(k)));
        }
        if (unregistered > 0 && !sessionStorage.getItem("ma365.dev.swPurged")) {
          sessionStorage.setItem("ma365.dev.swPurged", "1");
          // Reload bypassing SW (kommt nicht mehr durch — wir haben ihn ja gerade entfernt)
          window.location.reload();
        }
      } catch { /* ignore */ }
    })();
  }, []);
  return null;
}
