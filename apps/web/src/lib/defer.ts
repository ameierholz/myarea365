/**
 * Defer non-critical work bis Browser idle ist.
 * Hält First-Paint frei von API-Calls die nicht für die initiale Map-Anzeige gebraucht werden.
 */

interface IdleCallbackHandle {
  readonly didTimeout: boolean;
  timeRemaining: () => number;
}

type WindowWithIdle = Window & {
  requestIdleCallback?: (cb: (deadline: IdleCallbackHandle) => void, opts?: { timeout?: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export function deferIdle(fn: () => void, timeout = 2000): () => void {
  if (typeof window === "undefined") {
    fn();
    return () => {};
  }
  const w = window as WindowWithIdle;
  if (typeof w.requestIdleCallback === "function") {
    const id = w.requestIdleCallback(() => fn(), { timeout });
    return () => { w.cancelIdleCallback?.(id); };
  }
  const id = window.setTimeout(fn, 100);
  return () => window.clearTimeout(id);
}

/**
 * Fetch mit niedriger Priorität — Browser deprioritisiert gegenüber
 * kritischen Ressourcen (Mapbox-Tiles, JS-Chunks). Für Hintergrund-Daten.
 */
export function fetchLowPriority(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  // priority ist Standard-Fetch-Option (Chrome/Edge), TS-Lib kennt sie ggf. nicht
  return fetch(input, { ...init, priority: "low" } as RequestInit & { priority: "low" });
}
