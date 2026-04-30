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
    void (async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const r of regs) await r.unregister();
        if (typeof caches !== "undefined") {
          const keys = await caches.keys();
          await Promise.all(keys.filter((k) => k.startsWith("ma365-")).map((k) => caches.delete(k)));
        }
      } catch { /* ignore */ }
    })();
  }, []);
  return null;
}
