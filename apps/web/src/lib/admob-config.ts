/**
 * AdMob-Konfiguration für die Mobile-App (Expo/React-Native).
 *
 * WICHTIG:
 * - In Development werden IMMER Test-IDs verwendet (Google-Pflicht, sonst Account-Sperre).
 * - In Production werden nur echte IDs geladen, wenn NEXT_PUBLIC_ADMOB_PRODUCTION=1.
 * - Diese Datei liegt im Web-Monorepo-Paket, damit sie auch von der kommenden Mobile-App
 *   (`apps/mobile/`) importiert werden kann (über den `shared`-Pfad wenn dorthin verlinkt).
 *
 * Google-Test-IDs kommen aus der offiziellen AdMob-Doku:
 * https://developers.google.com/admob/android/test-ads
 * https://developers.google.com/admob/ios/test-ads
 */

const IS_PROD = process.env.NEXT_PUBLIC_ADMOB_PRODUCTION === "1";

// ═══ PRODUKTIONS-IDs (AdMob-Konsole, ameierholz@gmail.com) ═══
const PRODUCTION = {
  app_id_android: "ca-app-pub-9799640580685030~9235230561",
  // iOS-App-ID noch nicht angelegt → wenn verfügbar, hier ergänzen
  app_id_ios: null as string | null,
  ad_units: {
    iconShopRewarded:   "ca-app-pub-9799640580685030/5104413866",
    postRunInterstitial:"ca-app-pub-9799640580685030/8852087181",
    rankingBanner:      "ca-app-pub-9799640580685030/1165168856",
  },
} as const;

// ═══ TEST-IDs (Google offiziell, dürfen jeder verwenden) ═══
const TEST = {
  app_id_android: "ca-app-pub-3940256099942544~3347511713",
  app_id_ios:     "ca-app-pub-3940256099942544~1458002511",
  ad_units: {
    iconShopRewarded:    "ca-app-pub-3940256099942544/5224354917",  // Rewarded
    postRunInterstitial: "ca-app-pub-3940256099942544/1033173712",  // Interstitial
    rankingBanner:       "ca-app-pub-3940256099942544/6300978111",  // Banner
  },
} as const;

const ACTIVE = IS_PROD ? PRODUCTION : TEST;

export const ADMOB = {
  isProduction: IS_PROD,
  appIdAndroid: ACTIVE.app_id_android,
  appIdIos: ACTIVE.app_id_ios,
  adUnits: ACTIVE.ad_units,
};

export type AdPlacement = keyof typeof PRODUCTION.ad_units;

/**
 * Liefert die passende Ad-Unit-ID für eine Platzierung.
 * Automatischer Test-ID-Fallback in Development.
 */
export function getAdUnitId(placement: AdPlacement): string {
  return ADMOB.adUnits[placement];
}
