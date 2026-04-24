/**
 * HMAC-signierte Tokens für unauthentifizierte Links (z. B. Unsubscribe).
 * Ein Angreifer kann ohne Kenntnis von SIGNED_TOKEN_SECRET keinen gültigen Token
 * erzeugen, selbst wenn die UID bekannt ist.
 *
 * ENV:
 *   SIGNED_TOKEN_SECRET — mind. 32 Zeichen Zufallsstring
 */
import { createHmac, timingSafeEqual } from "node:crypto";

function secret(): string {
  const s = process.env.SIGNED_TOKEN_SECRET;
  if (!s || s.length < 16) throw new Error("SIGNED_TOKEN_SECRET not set or too short");
  return s;
}

export function signPayload(payload: string): string {
  const sig = createHmac("sha256", secret()).update(payload).digest("hex").slice(0, 32);
  return sig;
}

export function verifyPayload(payload: string, token: string): boolean {
  try {
    const expected = signPayload(payload);
    if (expected.length !== token.length) return false;
    return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  } catch {
    return false;
  }
}

/** Convenience: Token für einen bestimmten "Zweck" + UID/E-Mail. */
export function signAction(action: string, id: string): string {
  return signPayload(`${action}:${id}`);
}
export function verifyAction(action: string, id: string, token: string): boolean {
  return verifyPayload(`${action}:${id}`, token);
}
