"use client";

export const ADMOB_UNITS = {
  daily:    "ca-app-pub-9799640580685030/9672002739",
  cooldown: "ca-app-pub-9799640580685030/5530322606",
} as const;

export type AdKind = keyof typeof ADMOB_UNITS;

type CapacitorWindow = {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    Plugins?: Record<string, unknown>;
  };
};

type AdMobPlugin = {
  prepareRewardVideoAd: (opts: { adId: string }) => Promise<unknown>;
  showRewardVideoAd:    () => Promise<{ rewarded?: boolean; type?: string; amount?: number }>;
};

export async function showRewardedAd(kind: AdKind): Promise<{ rewarded: boolean; native: boolean }> {
  if (typeof window === "undefined") return { rewarded: false, native: false };

  const cap = (window as unknown as CapacitorWindow).Capacitor;
  if (cap?.isNativePlatform?.() && cap.Plugins?.AdMob) {
    try {
      const AdMob = cap.Plugins.AdMob as AdMobPlugin;
      await AdMob.prepareRewardVideoAd({ adId: ADMOB_UNITS[kind] });
      const result = await AdMob.showRewardVideoAd();
      return { rewarded: !!(result?.rewarded || result?.amount), native: true };
    } catch {
      return { rewarded: false, native: true };
    }
  }

  // Web/Dev-Fallback: bestätigen statt echtes Ad
  const label = kind === "daily" ? "Tagesvideo (+200 jede Resource + 1 Speed-Token)" : "Bonus-Video (+50 jede Resource)";
  const ok = window.confirm(`Dev-Modus: ${label} simulieren?\n\n(Im Mobile-Build wird hier ein echtes AdMob-Reward-Video abgespielt.)`);
  return { rewarded: ok, native: false };
}
