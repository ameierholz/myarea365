// Verteilte Rate-Limits via Upstash-Redis (REST, kein SDK) mit Fallback
// auf In-Memory, falls UPSTASH_REDIS_REST_URL/TOKEN nicht gesetzt sind.
//
// ENV (optional, empfohlen in Produktion):
//   UPSTASH_REDIS_REST_URL   = "https://<id>.upstash.io"
//   UPSTASH_REDIS_REST_TOKEN = "AY..."

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
 * Upstash-Redis-Rate-Limit via REST. Benutzt INCR + EXPIRE atomar über Pipeline.
 * Wenn keine Credentials gesetzt sind → null (Aufrufer soll In-Memory nutzen).
 */
export async function rateLimitRedis(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const ttlSec = Math.max(1, Math.ceil(windowMs / 1000));
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, String(ttlSec), "NX"],
        ["PTTL", key],
      ]),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const arr = (await res.json()) as Array<{ result: number }>;
    const count = Number(arr[0]?.result ?? 0);
    const pttl = Math.max(0, Number(arr[2]?.result ?? windowMs));
    const resetAt = Date.now() + pttl;
    if (count > limit) {
      return { ok: false, remaining: 0, resetAt, retryAfterSec: Math.max(1, Math.ceil(pttl / 1000)) };
    }
    return { ok: true, remaining: Math.max(0, limit - count), resetAt };
  } catch {
    return null;
  }
}

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
 * Bevorzugt Redis, fällt auf In-Memory zurück. Async.
 */
export async function rateLimitSmart(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const r = await rateLimitRedis(key, limit, windowMs);
  if (r) return r;
  return rateLimit(key, limit, windowMs);
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
