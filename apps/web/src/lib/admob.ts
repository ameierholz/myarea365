"use client";

/**
 * AdMob — Single Source of Truth für Rewarded-Ads.
 *
 * Diese Datei ist die ZENTRALE Abstraktion für alle Werbe-Slots in MyArea365.
 * Sie ersetzt die früher parallelen Module admob-config.ts und rewarded-ads.ts.
 *
 * Funktionsweise:
 * - Web/Dev: `window.confirm()` als Mock — sofortige Bestätigung statt echtes Video
 * - Capacitor/Android: dynamic-import von @capacitor-community/admob → echtes Reward-Video
 *
 * Konfiguration über Vercel-Env:
 *   NEXT_PUBLIC_ADMOB_TEST=1        → nutzt Google-Test-Unit-IDs (immer rewarded, kein Account-Risiko)
 *   NEXT_PUBLIC_ADMOB_PRODUCTION=1  → Production-Mode (DEV-default = TEST falls nicht gesetzt)
 *
 * Einzelne Slots können per `NEXT_PUBLIC_ADMOB_UNIT_<PLACEMENT>` überschrieben werden.
 */

// ─── Placements ─────────────────────────────────────────────────────────
// EIN durchgängiges Naming. Wer neue Slots anlegt: hier eintragen.
export type AdPlacement =
  | "daily"          // täglicher Resource-Booster (+200 jede + Speed-Token)
  | "cooldown"       // Cooldown-Override / Build-Speedup
  | "supply_drop"    // Resource-Karten-Drop-Boost
  | "streak_save"    // Streak-retten
  | "icon_shop"      // Cosmetic-Token aus Werbung
  | "post_run"       // Interstitial nach längerer Session
  | "ranking_banner" // statisches Banner Ranking
  | "pre_walk"       // (legacy aus Runner-Zeit, jetzt: vor Marsch-Start)
  | "post_walk";     // (legacy aus Runner-Zeit, jetzt: nach Marsch-Abschluss)

// ─── Ad-Unit-IDs ────────────────────────────────────────────────────────
// Production (AdMob-Konsole ameierholz@gmail.com). Fallback auf eingetragene
// Werte damit der Build auch ohne ENV läuft. Pro Slot per ENV überschreibbar.
const PROD_AD_UNIT_IDS: Record<AdPlacement, string> = {
  daily:          process.env.NEXT_PUBLIC_ADMOB_UNIT_DAILY          ?? "ca-app-pub-9799640580685030/9672002739",
  cooldown:       process.env.NEXT_PUBLIC_ADMOB_UNIT_COOLDOWN       ?? "ca-app-pub-9799640580685030/5530322606",
  supply_drop:    process.env.NEXT_PUBLIC_ADMOB_UNIT_SUPPLY_DROP    ?? "ca-app-pub-9799640580685030/2794153091",
  streak_save:    process.env.NEXT_PUBLIC_ADMOB_UNIT_STREAK_SAVE    ?? "ca-app-pub-9799640580685030/2590453591",
  icon_shop:      process.env.NEXT_PUBLIC_ADMOB_UNIT_ICON_SHOP      ?? "ca-app-pub-9799640580685030/5104413866",
  post_run:       process.env.NEXT_PUBLIC_ADMOB_UNIT_POST_RUN       ?? "ca-app-pub-9799640580685030/8852087181",
  ranking_banner: process.env.NEXT_PUBLIC_ADMOB_UNIT_RANKING_BANNER ?? "ca-app-pub-9799640580685030/1165168856",
  pre_walk:       process.env.NEXT_PUBLIC_ADMOB_UNIT_PRE_WALK       ?? "ca-app-pub-9799640580685030/6813289150",
  post_walk:      process.env.NEXT_PUBLIC_ADMOB_UNIT_POST_WALK      ?? "ca-app-pub-9799640580685030/5991162070",
};

// Google-Test-Unit-IDs — dürfen frei verwendet werden, zeigen Google-Branded-Demo-Ads.
const TEST_AD_UNIT_IDS: Record<AdPlacement, string> = {
  daily:          "ca-app-pub-3940256099942544/5224354917",
  cooldown:       "ca-app-pub-3940256099942544/5224354917",
  supply_drop:    "ca-app-pub-3940256099942544/5224354917",
  streak_save:    "ca-app-pub-3940256099942544/5224354917",
  icon_shop:      "ca-app-pub-3940256099942544/5224354917",
  post_run:       "ca-app-pub-3940256099942544/1033173712",
  ranking_banner: "ca-app-pub-3940256099942544/6300978111",
  pre_walk:       "ca-app-pub-3940256099942544/5224354917",
  post_walk:      "ca-app-pub-3940256099942544/5224354917",
};

// ─── App-IDs ────────────────────────────────────────────────────────────
export const ADMOB_APP_ID_ANDROID_PROD = "ca-app-pub-9799640580685030~9235230561";
export const ADMOB_APP_ID_ANDROID_TEST = "ca-app-pub-3940256099942544~3347511713";
export const ADMOB_APP_ID_IOS_TEST     = "ca-app-pub-3940256099942544~1458002511";

function isTestMode(): boolean {
  return process.env.NEXT_PUBLIC_ADMOB_TEST === "1"
      || process.env.NEXT_PUBLIC_ADMOB_PRODUCTION !== "1";
}

export function adUnitIdFor(placement: AdPlacement): string {
  return isTestMode() ? TEST_AD_UNIT_IDS[placement] : PROD_AD_UNIT_IDS[placement];
}

export const ADMOB = {
  isTestMode,
  appIdAndroid: () => isTestMode() ? ADMOB_APP_ID_ANDROID_TEST : ADMOB_APP_ID_ANDROID_PROD,
  appIdIos:     () => ADMOB_APP_ID_IOS_TEST,
};

// ─── Legacy-Alias ───────────────────────────────────────────────────────
// Wird von base-modal.tsx via "kind: 'daily' | 'cooldown'" erwartet.
// Bleibt vorerst bestehen, damit kein Callsite-Rewrite nötig ist.
export const ADMOB_UNITS: Record<"daily" | "cooldown", string> = {
  daily:    PROD_AD_UNIT_IDS.daily,
  cooldown: PROD_AD_UNIT_IDS.cooldown,
};
export type AdKind = keyof typeof ADMOB_UNITS;

// ─── Native Capacitor-Hooks ─────────────────────────────────────────────
type CapacitorWindow = {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    Plugins?: Record<string, unknown>;
  };
};

type AdMobNativePlugin = {
  prepareRewardVideoAd: (opts: { adId: string; isTesting?: boolean }) => Promise<unknown>;
  showRewardVideoAd:    () => Promise<{ rewarded?: boolean; type?: string; amount?: number }>;
  addListener?: (event: string, cb: (info: unknown) => void) => Promise<{ remove: () => void }>;
};

function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as CapacitorWindow).Capacitor;
  return !!cap?.isNativePlatform?.();
}

// ─── Public API ─────────────────────────────────────────────────────────
export type AdResult = { rewarded: boolean; native: boolean; error?: string };

/**
 * Zeige ein Rewarded-Ad für eine Placement.
 * Web/Dev: window.confirm()-Mock.
 * Native: echtes AdMob-Reward-Video.
 *
 * Legacy-Aufrufer benutzen weiterhin `"daily" | "cooldown"` als Kind —
 * der Code akzeptiert sowohl die alten Kind-Keys als auch die neuen AdPlacement-Werte.
 */
export async function showRewardedAd(
  kind: AdKind | AdPlacement,
): Promise<AdResult> {
  if (typeof window === "undefined") return { rewarded: false, native: false };

  const cap = (window as unknown as CapacitorWindow).Capacitor;
  if (isNativeApp() && cap?.Plugins?.AdMob) {
    try {
      const AdMob = cap.Plugins.AdMob as AdMobNativePlugin;
      await AdMob.prepareRewardVideoAd({
        adId: adUnitIdFor(kind as AdPlacement),
        isTesting: isTestMode(),
      });
      const result = await AdMob.showRewardVideoAd();
      return { rewarded: !!(result?.rewarded || result?.amount), native: true };
    } catch (e) {
      return { rewarded: false, native: true, error: e instanceof Error ? e.message : String(e) };
    }
  }

  // Web/Dev-Mock: bestätigen statt echtes Ad
  const label = labelFor(kind);
  const ok = window.confirm(`Dev-Modus: ${label} simulieren?\n\n(Im Mobile-Build wird hier ein echtes AdMob-Reward-Video abgespielt.)`);
  return { rewarded: ok, native: false };
}

function labelFor(kind: AdKind | AdPlacement): string {
  switch (kind) {
    case "daily":          return "Tagesvideo (+200 jede Resource + 1 Speed-Token)";
    case "cooldown":       return "Bonus-Video (+50 jede Resource)";
    case "supply_drop":    return "Supply-Drop-Boost";
    case "streak_save":    return "Streak retten";
    case "icon_shop":      return "Cosmetic-Token";
    case "post_run":       return "Interstitial nach Session";
    case "ranking_banner": return "Ranking-Banner";
    case "pre_walk":       return "Start-Booster";
    case "post_walk":      return "Aktivitäts-Bonus";
    default:               return kind;
  }
}
