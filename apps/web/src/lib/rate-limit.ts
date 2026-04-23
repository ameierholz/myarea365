// Leichtgewichtiges In-Memory-Rate-Limiting für Write-Routen.
//
// Für produktive verteilte Rate-Limits ist Upstash-Redis mit `@upstash/ratelimit`
// vorgesehen — siehe TODO unten. In-Memory ist bereits wirksam gegen Einzel-User-
// Bursts, weil Vercel Serverless-Funktionen für denselben User meist dieselbe
// Instanz wiederverwenden (warm starts). Fällt in wenigen Fällen auf Fail-Open
// zurück — besser als gar nichts, aber nicht zu 100 % dicht.

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

// Cleanup alle 60 s, damit Map nicht wächst.
let lastCleanup = Date.now();
function maybeCleanup() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  for (const [key, b] of buckets) if (b.resetAt < now) buckets.delete(key);
  lastCleanup = now;
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSec?: number;
};

/**
 * @param key Identifier (z. B. `walk:${userId}` oder `fight:${ip}`).
 * @param limit Max. Requests im Window.
 * @param windowMs Window-Länge in ms (z. B. 60_000 für 1 Minute).
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  maybeCleanup();
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: limit - 1, resetAt };
  }
  if (b.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      resetAt: b.resetAt,
      retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
    };
  }
  b.count += 1;
  return { ok: true, remaining: limit - b.count, resetAt: b.resetAt };
}

/**
 * Helper: nimmt einen User-ID-String und gibt die Response oder `null` zurück.
 * null = ok, response = 429.
 */
export function rateLimitResponse(result: RateLimitResult): Response | null {
  if (result.ok) return null;
  return new Response(
    JSON.stringify({
      error: "rate_limited",
      retry_after_sec: result.retryAfterSec,
    }),
    {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(result.retryAfterSec ?? 60),
      },
    },
  );
}
