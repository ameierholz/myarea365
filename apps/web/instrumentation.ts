/**
 * Next.js 16 Instrumentation Hook — wird einmalig beim Server-Start aufgerufen.
 *
 * Aktuell: No-Op + strukturiertes stderr-Logging für Request-Errors.
 *
 * Sentry aktivieren:
 *   1) `pnpm add @sentry/nextjs`
 *   2) Drei Config-Dateien anlegen (siehe docs/sentry-setup.md)
 *   3) ENV: SENTRY_DSN, NEXT_PUBLIC_SENTRY_DSN
 *   4) Diesen File auf den auskommentierten Block umstellen.
 *
 * So wie diese Datei jetzt ist, läuft sie ohne Dependencies und bricht den
 * Dev-Server NICHT, falls @sentry/nextjs (noch) nicht installiert ist.
 */
export async function register(): Promise<void> {
  // Bewusst leer. Sentry-Init kommt später via dynamic-import,
  // aber NUR wenn das Package wirklich aufgelöst werden kann.
}

export function onRequestError(
  err: unknown,
  request: { path?: string; method?: string },
  context: { routePath?: string },
): void {
  // Strukturiertes JSON-Logging — Edge-Runtime hat kein process.stderr,
  // daher console.error (existiert in beiden Runtimes).
  const payload = {
    ts: new Date().toISOString(),
    kind: "request_error",
    route: context.routePath ?? request.path,
    method: request.method,
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  };
  console.error(JSON.stringify(payload));
}
