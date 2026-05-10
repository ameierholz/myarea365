/**
 * BASE-ME shared cache + in-flight dedupe.
 *
 * /api/base/me wird von ~9 Components beim Mount/Refresh aufgerufen
 * (splash, splash-radar-bg, chat-widget, resource-bar, build-modal,
 * heimat-overlay, einsatz-modals, base-modal, crew-member-modal).
 *
 * Ohne Dedupe = 4-9 parallel HTTP-Requests pro Page-Load, jeder ~1.4s
 * auf 4G. Dieser Cache koalesziert zu einem einzigen In-Flight-Request
 * und cached die Response für 30s (refreshable).
 *
 * Usage:
 *   const data = await fetchBaseMe();          // shared in-flight
 *   const data = await fetchBaseMe({ force: true });  // bypass cache
 *
 * Komponenten die ihre eigene fetch("/api/base/me") rufen sollten auf
 * diesen Helper umgestellt werden — minimaler Diff, max. Performance.
 */

const CACHE_TTL_MS = 30_000; // 30s — Resources/Queue ändern sich oft, aber 30s ok für Polling

type BaseMeResponse = unknown; // Komponenten typen das selbst

let _cache: { data: BaseMeResponse; ts: number } | null = null;
let _inFlight: Promise<BaseMeResponse | null> | null = null;

/**
 * Holt /api/base/me. Mehrere parallel-Aufrufe teilen denselben In-Flight-Request.
 * Cached für 30s. Mit `force: true` wird Cache umgangen (z.B. nach Mutation).
 */
export async function fetchBaseMe(opts?: { force?: boolean }): Promise<BaseMeResponse | null> {
  if (typeof window === "undefined") return null;
  const now = Date.now();

  // Cached + frisch genug → direkt zurück
  if (!opts?.force && _cache && now - _cache.ts < CACHE_TTL_MS) {
    return _cache.data;
  }

  // In-Flight läuft → derselbe Promise (Coalesce)
  if (_inFlight) return _inFlight;

  _inFlight = (async () => {
    try {
      const r = await fetch("/api/base/me", { cache: "no-store" });
      if (!r.ok) return null;
      const data = await r.json() as BaseMeResponse;
      _cache = { data, ts: Date.now() };
      return data;
    } catch {
      return null;
    } finally {
      _inFlight = null;
    }
  })();
  return _inFlight;
}

/** Cache invalidieren — nach Mutationen aufrufen damit nächster fetch frisch lädt. */
export function invalidateBaseMe(): void {
  _cache = null;
}
