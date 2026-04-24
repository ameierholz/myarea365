import { NextResponse, type NextRequest } from "next/server";

/**
 * CSRF-Schutz via Origin-/Referer-Header-Check.
 * Aufruf am Anfang state-changing API-Routen (POST/PATCH/DELETE).
 *
 * Gibt `null` zurück wenn ok, sonst `Response` 403 — direkt returnbar.
 *
 * ENV:
 *   ALLOWED_ORIGINS (optional, komma-separiert) — zusätzliche erlaubte Origins
 *   neben dem aktuellen Request-Host. Beispiel: "https://myarea365.de,https://www.myarea365.de"
 */
export function assertSameOrigin(req: NextRequest | Request): Response | null {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return null;

  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const check = origin ?? referer;
  if (!check) {
    // Kein Origin/Referer → nur erlauben wenn aus Same-Site-Fetch-Metadata klar
    const secSite = req.headers.get("sec-fetch-site");
    if (secSite === "same-origin" || secSite === "same-site") return null;
    return NextResponse.json({ error: "csrf_missing_origin" }, { status: 403 });
  }

  try {
    const o = new URL(check);
    const reqUrl = new URL(req.url);
    if (o.host === reqUrl.host) return null;
    const allowed = (process.env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (allowed.includes(o.origin)) return null;
  } catch {
    /* fall through */
  }
  return NextResponse.json({ error: "csrf_origin_mismatch" }, { status: 403 });
}
