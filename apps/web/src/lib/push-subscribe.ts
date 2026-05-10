/**
 * Web-Push Subscribe-Helper.
 *
 * Verwendung im Settings-Toggle:
 *   if (enabled) await enablePushNotifications();
 *   else         await disablePushNotifications();
 *
 * VAPID-Public-Key kommt aus NEXT_PUBLIC_VAPID_PUBLIC_KEY (env). Solange
 * dieser nicht gesetzt ist, schlägt das Subscribe ohne sichtbare Wirkung fehl
 * — Toggle bleibt dann reine UI-Präferenz (zumindest persistiert in DB).
 */

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) out[i] = rawData.charCodeAt(i);
  return out;
}

export async function enablePushNotifications(): Promise<{ ok: boolean; reason?: string }> {
  if (typeof window === "undefined") return { ok: false, reason: "ssr" };
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, reason: "unsupported" };
  }
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapid) return { ok: false, reason: "no_vapid_key" };

  const reg = await navigator.serviceWorker.ready.catch(() => null);
  if (!reg) return { ok: false, reason: "sw_not_ready" };

  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: "denied" };

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const keyArr = urlBase64ToUint8Array(vapid);
    // Cast notwendig: PushManager.subscribe erwartet BufferSource mit ArrayBuffer,
    // aber Uint8Array kann generisch über ArrayBufferLike typisiert sein.
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyArr.buffer as ArrayBuffer,
    });
  }
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  const r = await fetch("/api/me/push-subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      user_agent: navigator.userAgent,
    }),
  });
  return r.ok ? { ok: true } : { ok: false, reason: "save_failed" };
}

export async function disablePushNotifications(): Promise<{ ok: boolean }> {
  if (typeof window === "undefined") return { ok: false };
  if (!("serviceWorker" in navigator)) return { ok: true };
  const reg = await navigator.serviceWorker.ready.catch(() => null);
  if (!reg) return { ok: true };
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return { ok: true };
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => {});
  await fetch("/api/me/push-subscribe", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
  return { ok: true };
}
