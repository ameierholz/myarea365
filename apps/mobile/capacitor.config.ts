import type { CapacitorConfig } from "@capacitor/cli";

/**
 * MyArea365 Capacitor-Konfiguration.
 *
 * Modus: Remote-WebView — der Client-Code lebt auf myarea365.de,
 * Capacitor ist der native Shell. Vorteile:
 *  - Web + App teilen 1:1 denselben Code (kein zweites Build-Pipeline)
 *  - Jedes Vercel-Deploy ist sofort in der App ohne neuen APK-Upload
 *  - Native APIs (Geolocation, Push, Splash) laufen via Plugins
 *
 * Nachteil: keine Offline-Unterstützung. Für MyArea365 vertretbar,
 * weil Kern-Gameplay (Gebiete erobern, Arena, Shop) eh eine
 * Server-Verbindung braucht.
 */
const config: CapacitorConfig = {
  appId: "com.myarea365.app",
  appName: "MyArea365",
  webDir: "public", // Dummy — wird durch server.url überschrieben

  server: {
    // Produktions-URL. WebView lädt https://myarea365.de.
    // Cookies + Auth funktionieren identisch zum Browser.
    url: "https://myarea365.de",
    androidScheme: "https",
    // Gibt Content-Provider des Backends als "vertraut" frei.
    // Nötig, damit Stripe-Checkout, Supabase-Storage, AdMob laden.
    allowNavigation: [
      "myarea365.de",
      "*.myarea365.de",
      "checkout.stripe.com",
      "*.stripe.com",
      "*.supabase.co",
      "*.supabase.net",
      "accounts.google.com",
      "*.googleapis.com",
      "googleadservices.com",
      "*.googleadservices.com",
    ],
  },

  android: {
    // Standard-Background während des Splash-Screens — passt zu Brand.
    backgroundColor: "#0F1115",
    // WebView-Inhalt darf Cookies für Drittanbieter (Stripe, Google OAuth).
    allowMixedContent: false,
    // Hardware-Back-Button soll WebView-Navigation steuern, nicht App beenden.
    captureInput: true,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#0F1115",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      // Brand-Hintergrund, heller Text
      style: "DARK",
      backgroundColor: "#0F1115",
      overlaysWebView: false,
    },
    Geolocation: {
      // Permissions werden zur Laufzeit angefordert.
      // Hintergrund-Location (während Lauf) braucht Android-Manifest-Einträge,
      // die Capacitor generiert. ACCESS_BACKGROUND_LOCATION muss separat
      // abgefragt werden (Android 10+).
    },
  },
};

export default config;
