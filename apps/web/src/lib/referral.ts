"use client";

export const REFERRAL_COOKIE = "myarea-ref";

export function captureReferralFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref");
  if (!ref || !/^[A-Z0-9]{4,10}$/i.test(ref)) return null;
  document.cookie = `${REFERRAL_COOKIE}=${ref.toUpperCase()};path=/;max-age=${60 * 60 * 24 * 30};samesite=lax`;
  return ref.toUpperCase();
}

export function getStoredReferralCode(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${REFERRAL_COOKIE}=([^;]+)`));
  return match?.[1] ?? null;
}

export function clearStoredReferralCode() {
  if (typeof document === "undefined") return;
  document.cookie = `${REFERRAL_COOKIE}=;path=/;max-age=0`;
}

export function buildInviteUrl(code: string): string {
  if (typeof window === "undefined") return `https://myarea365.de/?ref=${code}`;
  return `${window.location.origin}/?ref=${code}`;
}

export async function shareInvite(code: string, displayName: string) {
  const url = buildInviteUrl(code);
  const text = `${displayName} lädt dich zu MyArea365 ein 🏃 Erobert zusammen den Kiez — sammelt XP und nutzt sie bei lokalen Shops.`;
  if (typeof navigator !== "undefined" && navigator.share) {
    try { await navigator.share({ title: "MyArea365", text, url }); return true; } catch { /* user cancelled */ }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n\n${url}`);
    return true;
  } catch {
    return false;
  }
}
