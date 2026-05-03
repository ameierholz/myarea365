"use client";

import { useTranslations } from "next-intl";

/**
 * i18n-Helfer für statische Catalogs aus game-config.ts und monetization.ts.
 * Pattern: `<obj>.id` → translation key in `Game`-Namespace.
 *
 * Server-Komponenten nutzen statt der Hooks `getTranslations({ namespace: "Game" })`.
 */

export function useRankName() {
  const t = useTranslations("Game.ranks");
  return (id: number | string) => t(String(id));
}

export function useFactionName() {
  const t = useTranslations("Game.factions");
  return (id: "syndicate" | "vanguard" | string) => t(`${id}.name`);
}
export function useFactionShort() {
  const t = useTranslations("Game.factions");
  return (id: "syndicate" | "vanguard" | string) => t(`${id}.short`);
}
export function useFactionMotto() {
  const t = useTranslations("Game.factions");
  return (id: "syndicate" | "vanguard" | string) => t(`${id}.motto`);
}

export function useMarkerName() {
  const t = useTranslations("Game.markers");
  return (id: string) => t(id);
}
export function useMarkerVariantLabel() {
  const t = useTranslations("Game.markerVariant");
  return (variant: "neutral" | "male" | "female") => t(variant);
}

export function useLightName() {
  const t = useTranslations("Game.lights");
  return (id: string) => t(id);
}

export function useCrewTypeName() {
  const t = useTranslations("Game.crewTypes");
  return (id: string) => t(`${id}.name`);
}
export function useCrewTypeTagline() {
  const t = useTranslations("Game.crewTypes");
  return (id: string) => t(`${id}.tagline`);
}
export function useCrewTypeDescription() {
  const t = useTranslations("Game.crewTypes");
  return (id: string) => t(`${id}.description`);
}

export function usePrivacyLabel() {
  const t = useTranslations("Game.privacy");
  return (id: "open" | "invite" | "closed" | string) => t(`${id}.label`);
}
export function usePrivacyHint() {
  const t = useTranslations("Game.privacy");
  return (id: "open" | "invite" | "closed" | string) => t(`${id}.hint`);
}

export function useLeagueName() {
  const t = useTranslations("Game.leagues");
  return (id: string) => t(id);
}

export function useMonthName() {
  const t = useTranslations("Game.months");
  return (m: number) => t(String(m));
}

export function useTierLabel() {
  const t = useTranslations("Game.tiers");
  return (id: "easy" | "medium" | "hard" | "epic" | "legend" | string) => t(id);
}

export function useCategoryName() {
  const t = useTranslations("Game.categories");
  return (id: string) => t(`${id}.name`);
}
export function useCategoryDescription() {
  const t = useTranslations("Game.categories");
  return (id: string) => t(`${id}.description`);
}

export function useGuardianRarityLabel() {
  const t = useTranslations("Game.guardianRarity");
  return (r: "common" | "rare" | "epic" | "legendary" | string) => t(r);
}

export function useUnitLabel() {
  const t = useTranslations("Game.units");
  return (id: "metric" | "imperial" | string) => t(id);
}

export function useLanguageLabel() {
  const t = useTranslations("Game.languages");
  return (id: "de" | "en" | string) => t(id);
}

/**
 * Shop / monetization helper. SKU → name (and optional desc).
 * Pool-Reihenfolge muss zur lib/monetization.ts passen.
 */
export function useSkuName() {
  const t = useTranslations("Game.shop");
  return (sku: string): string => {
    for (const pool of ["plans", "boostPacks", "xpPacks", "gameplayItems", "cosmetics", "extras", "crewGemPacks", "crewSlotPacks", "shopPlans", "shopBoosts", "guardianItems"]) {
      try {
        const v = t.raw(`${pool}.${sku}.name` as never) as unknown;
        if (typeof v === "string") return v;
      } catch { /* not in this pool */ }
    }
    return sku;
  };
}
export function useSkuDesc() {
  const t = useTranslations("Game.shop");
  return (sku: string): string | null => {
    for (const pool of ["plans", "boostPacks", "xpPacks", "gameplayItems", "cosmetics", "extras", "crewGemPacks", "crewSlotPacks", "shopPlans", "shopBoosts", "guardianItems"]) {
      try {
        const v = t.raw(`${pool}.${sku}.desc` as never) as unknown;
        if (typeof v === "string") return v;
      } catch { /* not in this pool */ }
    }
    return null;
  };
}

export function useAdRewardLabel() {
  const t = useTranslations("Game.shop.adRewards");
  return (id: string) => t(`${id}.label`);
}
export function useAdRewardDescription() {
  const t = useTranslations("Game.shop.adRewards");
  return (id: string) => t(`${id}.description`);
}
