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
