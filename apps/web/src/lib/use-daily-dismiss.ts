"use client";

import { useCallback, useEffect, useState } from "react";

function todayUtcKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function msUntilNextUtcMidnight(): number {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0);
  return Math.max(1000, next - now.getTime());
}

export function useDailyDismiss(storageKey: string): {
  dismissed: boolean;
  dismiss: () => void;
} {
  const fullKey = `ma365:dismiss:${storageKey}`;
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(fullKey);
      setDismissed(stored === todayUtcKey());
    } catch { /* ignore */ }

    const t = setTimeout(() => setDismissed(false), msUntilNextUtcMidnight());
    return () => clearTimeout(t);
  }, [fullKey]);

  const dismiss = useCallback(() => {
    try { window.localStorage.setItem(fullKey, todayUtcKey()); } catch { /* ignore */ }
    setDismissed(true);
  }, [fullKey]);

  return { dismissed, dismiss };
}
