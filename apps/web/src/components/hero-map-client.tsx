"use client";

import dynamic from "next/dynamic";

// Lazy: maplibre-gl ist ~180 KB gz, blockiert sonst LCP der Landing-Page.
// ssr:false muss in einem Client-Component-Wrapper liegen (Next 16 erlaubt
// ssr:false nicht mehr direkt in Server Components).
export const HeroMap = dynamic(
  () => import("@/components/hero-map").then((m) => ({ default: m.HeroMap })),
  {
    ssr: false,
    loading: () => <div className="absolute inset-0 bg-bg-deep" />,
  },
);
