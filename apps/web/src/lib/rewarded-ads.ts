/**
 * Rewarded-Ad-Abstraction fuer MyArea365.
 *
 * - Web/Dev: zeigt einen 30-Sekunden-Mock-Timer (keine echten Ads im Browser).
 * - Capacitor/Android: laedt das AdMob-SDK dynamisch und spielt echte Rewarded-Ads ab.
 *
 * Die vier Popups (PreWalk, PostWalk, SupplyDrop, StreakSave) rufen
 * `showRewardedAd(placement)` → Promise<AdResult>. Code-Pfad bleibt identisch,
 * egal ob Mock oder Echt-Ad.
 *
 * Test-Modus: Setze NEXT_PUBLIC_ADMOB_TEST=1 im .env.local, dann werden die
 * Google-Test-IDs statt deiner Prod-IDs verwendet (unlimitiert, Account-safe).
 */

export type AdPlacement =
  | "pre_walk"
  | "post_walk"
  | "supply_drop"
  | "streak_save"
  | "icon_shop";

export type AdResult =
  | { ok: true; rewarded: true; placement: AdPlacement }
  | { ok: true; rewarded: false; placement: AdPlacement; reason: "skipped" }
  | { ok: false; placement: AdPlacement; reason: "no_fill" | "error"; message?: string };

/**
 * Produktive AdMob Ad-Unit-IDs (Android). Test-IDs siehe TEST_AD_UNIT_IDS.
 * Konfigurierbar per .env — Fallback auf eingetragene Werte, damit der Build
 * auch ohne Environment direkt lauffaehig ist.
 */
const PROD_AD_UNIT_IDS: Record<AdPlacement, string> = {
  pre_walk:    process.env.NEXT_PUBLIC_ADMOB_UNIT_PRE_WALK    ?? "ca-app-pub-9799640580685030/6813289150",
  post_walk:   process.env.NEXT_PUBLIC_ADMOB_UNIT_POST_WALK   ?? "ca-app-pub-9799640580685030/5991162070",
  supply_drop: process.env.NEXT_PUBLIC_ADMOB_UNIT_SUPPLY_DROP ?? "ca-app-pub-9799640580685030/2794153091",
  streak_save: process.env.NEXT_PUBLIC_ADMOB_UNIT_STREAK_SAVE ?? "ca-app-pub-9799640580685030/2590453591",
  icon_shop:   process.env.NEXT_PUBLIC_ADMOB_UNIT_ICON_SHOP   ?? "ca-app-pub-9799640580685030/5104413866",
};

/** Google-Test-IDs — zeigen immer Google-Branded-Fake-Ads, kein Account-Risiko. */
const TEST_AD_UNIT_IDS: Record<AdPlacement, string> = {
  pre_walk:    "ca-app-pub-3940256099942544/5224354917",
  post_walk:   "ca-app-pub-3940256099942544/5224354917",
  supply_drop: "ca-app-pub-3940256099942544/5224354917",
  streak_save: "ca-app-pub-3940256099942544/5224354917",
  icon_shop:   "ca-app-pub-3940256099942544/5224354917",
};

export function adUnitIdFor(placement: AdPlacement): string {
  const useTest = process.env.NEXT_PUBLIC_ADMOB_TEST === "1";
  return useTest ? TEST_AD_UNIT_IDS[placement] : PROD_AD_UNIT_IDS[placement];
}

/**
 * Laufzeit-Erkennung: sind wir in der nativen Capacitor-App?
 * Auf Web gibt `window.Capacitor` nicht existiert oder isNativePlatform() false.
 */
function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!cap?.isNativePlatform?.();
}

/**
 * Mock-Timer fuer Web (30 Sek). Die 4 Popups haben heute bereits ihre eigenen
 * Progress-Bars — diese Funktion ist fuer den Fall vorgesehen, dass wir spaeter
 * alle 4 Popups auf `showRewardedAd()` umstellen. Aktuell ruft keiner sie auf Web.
 */
async function showMockAd(placement: AdPlacement, durationSec = 30): Promise<AdResult> {
  await new Promise((resolve) => setTimeout(resolve, durationSec * 1000));
  return { ok: true, rewarded: true, placement };
}

/**
 * Native AdMob-Ad laden und spielen.
 * Benötigt: `@capacitor-community/admob` im Android-Build installiert.
 * Wenn das Package nicht da ist (z.B. Web-Build), faellt es auf Mock zurueck.
 */
async function showNativeAdMobAd(placement: AdPlacement): Promise<AdResult> {
  try {
    // Dynamic import — faellt auf Web durch (Module nicht vorhanden) → Mock
    const mod = await import(/* webpackIgnore: true */ "@capacitor-community/admob" as string).catch(() => null);
    if (!mod) return showMockAd(placement);

    const { AdMob, RewardAdPluginEvents } = mod as {
      AdMob: {
        prepareRewardVideoAd: (opts: { adId: string; isTesting?: boolean }) => Promise<unknown>;
        showRewardVideoAd: () => Promise<unknown>;
        addListener: (event: string, cb: (info: unknown) => void) => Promise<{ remove: () => void }>;
      };
      RewardAdPluginEvents: { Rewarded: string; Dismissed: string; FailedToLoad: string };
    };

    const adId = adUnitIdFor(placement);
    const isTesting = process.env.NEXT_PUBLIC_ADMOB_TEST === "1";

    return await new Promise<AdResult>(async (resolve) => {
      let rewarded = false;
      const rewardedSub = await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
        rewarded = true;
      });
      const dismissedSub = await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
        rewardedSub.remove();
        dismissedSub.remove();
        resolve(rewarded
          ? { ok: true, rewarded: true, placement }
          : { ok: true, rewarded: false, placement, reason: "skipped" }
        );
      });
      const failSub = await AdMob.addListener(RewardAdPluginEvents.FailedToLoad, (info) => {
        rewardedSub.remove();
        dismissedSub.remove();
        failSub.remove();
        const msg = typeof info === "object" && info !== null && "message" in info
          ? String((info as { message?: unknown }).message) : undefined;
        resolve({ ok: false, placement, reason: "no_fill", message: msg });
      });

      try {
        await AdMob.prepareRewardVideoAd({ adId, isTesting });
        await AdMob.showRewardVideoAd();
      } catch (e) {
        rewardedSub.remove();
        dismissedSub.remove();
        failSub.remove();
        resolve({ ok: false, placement, reason: "error", message: e instanceof Error ? e.message : String(e) });
      }
    });
  } catch (e) {
    return { ok: false, placement, reason: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Zentrale Entry-Funktion fuer alle Popups.
 * Auf Web: noop (die 4 Popups haben eigenen Mock — diese Funktion existiert
 * fuer den spaeteren Refactor wenn sie alle auf einen gemeinsamen Call gehen).
 * Auf Native: echtes AdMob-Rewarded-Video.
 */
export async function showRewardedAd(placement: AdPlacement): Promise<AdResult> {
  if (isNativeApp()) return showNativeAdMobAd(placement);
  return showMockAd(placement);
}
