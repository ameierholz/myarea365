/**
 * Module-Shim damit TypeScript nicht bricht bevor `pnpm add @sentry/nextjs` läuft.
 * Sobald @sentry/nextjs installiert ist, überschreiben dessen echte Types diese hier
 * (das Package kommt früher in der Resolution-Reihenfolge).
 *
 * Diese Datei darf gelöscht werden sobald @sentry/nextjs als Dep installiert ist.
 */
declare module "@sentry/nextjs" {
  // Minimaler Surface — nur was wir tatsächlich aufrufen
  export function init(options: Record<string, unknown>): void;
  export function captureRequestError(err: unknown, req: unknown, ctx: unknown): void;
  export function captureException(err: unknown, ctx?: unknown): string;
  export function captureMessage(msg: string, level?: string): string;
  export function setUser(user: { id?: string; email?: string } | null): void;
  export function setTag(key: string, value: string): void;
  export function replayIntegration(opts?: Record<string, unknown>): unknown;
}
