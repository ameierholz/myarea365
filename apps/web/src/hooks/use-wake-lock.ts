"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type WakeLockSentinelCompat = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
};

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelCompat> };
};

/**
 * Hält den Handy-Screen an während Tracking läuft.
 *
 * - `active` bestimmt ob Lock aktiv sein soll
 * - Greift bei `visibilitychange` erneut, wenn User zurück auf Tab wechselt
 * - Liefert `supported`, `locked` und eine optionale `error` Nachricht
 */
export function useWakeLock(active: boolean) {
  const sentinelRef = useRef<WakeLockSentinelCompat | null>(null);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      const nav = navigator as NavigatorWithWakeLock;
      setSupported(!!nav.wakeLock);
    }
  }, []);

  const request = useCallback(async () => {
    try {
      const nav = navigator as NavigatorWithWakeLock;
      if (!nav.wakeLock) {
        setSupported(false);
        return;
      }
      const s = await nav.wakeLock.request("screen");
      sentinelRef.current = s;
      setLocked(true);
      setError(null);
      s.addEventListener("release", () => {
        setLocked(false);
        sentinelRef.current = null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wake-Lock konnte nicht aktiviert werden");
      setLocked(false);
    }
  }, []);

  const release = useCallback(async () => {
    if (sentinelRef.current && !sentinelRef.current.released) {
      try { await sentinelRef.current.release(); } catch { /* ignore */ }
    }
    sentinelRef.current = null;
    setLocked(false);
  }, []);

  useEffect(() => {
    if (active) void request();
    else void release();
    return () => { void release(); };
  }, [active, request, release]);

  // Re-acquire wenn Tab wieder sichtbar wird (Wake-Lock wird beim Tab-Wechsel automatisch freigegeben)
  useEffect(() => {
    if (!active) return;
    const onVisible = () => {
      if (document.visibilityState === "visible" && !sentinelRef.current) {
        void request();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [active, request]);

  return { locked, supported, error };
}
