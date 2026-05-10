/**
 * setInterval-Wrapper der bei `document.visibilityState === "hidden"` keine
 * Tasks mehr feuert. Senkt Hintergrund-Traffic auf null. Beim Sichtbar-Werden
 * wird sofort einmal getriggert.
 */
export function setVisibilityAwareInterval(cb: () => void, ms: number): () => void {
  let onVisible: (() => void) | null = null;
  const tick = () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    cb();
  };
  const id = setInterval(tick, ms);
  if (typeof document !== "undefined") {
    onVisible = () => { if (document.visibilityState === "visible") cb(); };
    document.addEventListener("visibilitychange", onVisible);
  }
  return () => {
    clearInterval(id);
    if (onVisible && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onVisible);
    }
  };
}
