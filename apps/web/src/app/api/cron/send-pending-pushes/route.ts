import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import webpush from "web-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vercel-Cron (alle 2-5 Min): Sendet Push-Notifications für ungelesene
 * inbox-Einträge der letzten 24h.
 *
 * Pro Eintrag wird `get_push_targets_for_user(user_id, kind)` befragt → liefert
 * nur Subscriptions zurück deren User die jeweilige Notification-Kategorie nicht
 * deaktiviert hat und nicht im Quiet-Mode ist.
 *
 * Auth via CRON_SECRET.
 *
 * ENV-Voraussetzungen:
 *   - VAPID_PRIVATE_KEY
 *   - NEXT_PUBLIC_VAPID_PUBLIC_KEY
 *   - VAPID_SUBJECT (mailto:...)
 *   - CRON_SECRET
 */

// Mappt user_inbox.kind/category → notification-prefs-Spalte
function inboxKindToPushKind(category: string | null, kind: string | null): string {
  const k = kind ?? "";
  const cat = category ?? "";
  if (k.startsWith("crew_chat") || k === "chat_message")             return "crew_chat";
  if (k.startsWith("crew_") || cat === "crew")                       return "crew_events";
  if (k === "rally_report" || k === "duel_result" || k === "spy_warning") return "duels";
  if (k === "achievement_unlock" || cat === "achievement")           return "achievements";
  if (k === "rank_up" || k === "leaderboard_rank")                   return "rank_up";
  if (k === "shop_deal" || cat === "deal")                           return "shop_deals";
  if (k === "streak_warn" || k === "streak_save")                    return "streak_warn";
  // Fallback: behandle alles andere als "crew_events" (sichere Default)
  return "crew_events";
}

type PendingInbox = {
  id: string; user_id: string;
  title: string | null; body: string | null;
  category: string | null; kind: string | null;
  payload: unknown;
  created_at: string;
};

type PushTarget = { endpoint: string; p256dh: string; auth_secret: string };

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "supabase_env_missing" }, { status: 500 });

  const vapidPub  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPriv = process.env.VAPID_PRIVATE_KEY;
  const vapidSub  = process.env.VAPID_SUBJECT;
  if (!vapidPub || !vapidPriv || !vapidSub) {
    return NextResponse.json({ ok: false, error: "vapid_env_missing", processed: 0 }, { status: 200 });
  }
  webpush.setVapidDetails(vapidSub, vapidPub, vapidPriv);

  const sb = createAdminClient(url, key, { auth: { persistSession: false } });

  // 1) Pending Inbox holen
  const { data: pending, error: errPending } = await sb.rpc("get_pending_push_inbox", { p_limit: 100 });
  if (errPending) return NextResponse.json({ error: errPending.message }, { status: 500 });
  const rows = (pending ?? []) as PendingInbox[];
  if (rows.length === 0) return NextResponse.json({ ok: true, processed: 0, sent: 0 });

  let sent = 0;
  let failed = 0;
  const staleEndpoints: string[] = [];

  // 2) Pro Eintrag Push-Targets holen und senden
  for (const row of rows) {
    const pushKind = inboxKindToPushKind(row.category, row.kind);
    const { data: targets } = await sb.rpc("get_push_targets_for_user", {
      p_user_id: row.user_id, p_kind: pushKind,
    });
    const ts = (targets ?? []) as PushTarget[];
    if (ts.length === 0) continue;

    const notifPayload = JSON.stringify({
      title: row.title ?? "MyArea365",
      body: row.body ?? "",
      tag: row.id,
      data: {
        inboxId: row.id,
        kind: row.kind,
        category: row.category,
        payload: row.payload,
      },
    });

    for (const t of ts) {
      try {
        await webpush.sendNotification(
          { endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth_secret } },
          notifPayload,
        );
        sent++;
      } catch (e) {
        failed++;
        // 410 Gone / 404 = Subscription abgelaufen → Endpoint für Cleanup markieren
        const err = e as { statusCode?: number };
        if (err.statusCode === 410 || err.statusCode === 404) {
          staleEndpoints.push(t.endpoint);
        }
      }
    }
  }

  // 3) Inbox-Einträge als "Push versucht" markieren
  const ids = rows.map((r) => r.id);
  await sb.rpc("mark_inbox_push_attempted", { p_ids: ids });

  // 4) Stale Subscriptions löschen
  if (staleEndpoints.length > 0) {
    await sb.from("user_push_subscriptions").delete().in("endpoint", staleEndpoints);
  }

  return NextResponse.json({
    ok: true,
    processed: rows.length,
    sent,
    failed,
    stale_removed: staleEndpoints.length,
  });
}
