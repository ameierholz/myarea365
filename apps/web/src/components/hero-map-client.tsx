"use client";

import dynamic from "next/dynamic";
import { HeroMap as HeroMapDirect } from "@/components/hero-map";

// PROD: Lazy via dynamic — maplibre-gl ist ~180 KB gz, blockiert sonst LCP.
// ssr:false muss in Client-Component-Wrapper (Next 16 erlaubt ssr:false nicht
// mehr direkt in Server Components).
//
// DEV: direkt importieren — Turbopack hat HMR-Bug mit dynamic+ssr:false der
// zu "module factory not available" führt (2 Chunks, ein Factory weg).
// Lazy-Loading-Vorteil in Dev egal, Korrektheit zählt mehr.
const HeroMapLazy = dynamic(
  () => import("@/components/hero-map").then((m) => ({ default: m.HeroMap })),
  {
    ssr: false,
    loading: () => <div className="absolute inset-0 bg-bg-deep" />,
  },
);

export const HeroMap = process.env.NODE_ENV === "production" ? HeroMapLazy : HeroMapDirect;
