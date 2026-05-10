"use client";

/**
 * SplashGate — rendert den GameSplash über den Children solange der Splash
 * sich nicht selbst entlassen hat. Nach `onReady` bleibt der Splash erst
 * komplett unmounted, der echte Content (z.B. MapDashboard) ist während des
 * Splash-Fadeouts aber bereits live (z-Index unter dem Splash).
 *
 * Splash zeigt sich bei JEDEM Page-Load (Reload + neuer Tab). Bei interner
 * Soft-Navigation (z.B. /karte/base ↔ /karte) bleibt das Layout gemountet,
 * Splash läuft nicht erneut — das passiert ohne Extra-Logik via React-State.
 */

import { useState, useEffect } from "react";
import { GameSplash } from "./game-splash";

export function SplashGate({ children }: { children: React.ReactNode }) {
  const [showSplash, setShowSplash] = useState(true);
  // Splash erst nach Mount rendern — sonst Hydration-Mismatch durch
  // LocalStorage-Cache-Detection in GameSplash (server kennt cache nicht).
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const handleReady = () => {
    setShowSplash(false);
    // Trigger Re-Center der Map auf eigene Base nach Splash-Ende.
    // MapDashboard hört auf dieses Event und setzt recenterAt → flyTo zur Base.
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("ma365:splash-done"));
    }
  };

  return (
    <>
      {children}
      {mounted && showSplash && <GameSplash onReady={handleReady} />}
    </>
  );
}
