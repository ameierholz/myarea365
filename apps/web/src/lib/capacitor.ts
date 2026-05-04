/**
 * Capacitor-Runtime-Detection.
 *
 * Die Web-App läuft in drei Kontexten:
 *  - Desktop-/Mobile-Browser (reguläres HTTPS)
 *  - Capacitor-Android-App (WebView lädt https://myarea365.de)
 *  - Capacitor-iOS-App (später)
 *
 * `isCapacitorNative()` liefert true NUR in der nativen App. In Browsern
 * ist `window.Capacitor` undefined oder `.isNativePlatform()` === false.
 */
export function isCapacitorNative(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return cap?.isNativePlatform?.() ?? false;
}

/**
 * Custom-URL-Scheme für OAuth-Callback zurück in die App.
 * Muss in AndroidManifest.xml (intent-filter) und in der Supabase
 * Auth-Config (Redirect URLs) eingetragen sein.
 */
export const APP_SCHEME = "com.myarea365.app";
export const APP_AUTH_CALLBACK = `${APP_SCHEME}://auth/callback`;

/**
 * Sind In-App-Käufe in dieser Runtime-Umgebung erlaubt?
 *
 * Google Play verlangt für DIGITALE Goods in Android-Apps die Verwendung
 * von Play-Billing (15-30% Cut). Stripe ist nur erlaubt für physische
 * Goods/Services oder reines Web. Bis Play-Billing integriert ist,
 * blenden wir alle Käufe in der Capacitor-Android-App aus.
 *
 * Browser (Web/Mobile-Web) → Käufe via Stripe sichtbar.
 * Capacitor-Android-App   → Käufe ausgeblendet.
 *
 * Re-aktivieren sobald @capacitor-community/in-app-purchases o.ä.
 * mit Play-Billing-Integration eingebaut ist.
 */
export function isInAppPurchaseAllowed(): boolean {
  return !isCapacitorNative();
}
