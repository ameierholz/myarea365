import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/me/push-subscribe
 *  Body: { endpoint, p256dh, auth }  ← from PushSubscription.toJSON()
 *
 * Speichert (oder aktualisiert) die Push-Subscription für den eingeloggten User.
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json() as { endpoint?: string; p256dh?: string; auth?: string; user_agent?: string };
  if (!body.endpoint || !body.p256dh || !body.auth) {
    return NextResponse.json({ error: "invalid_subscription" }, { status: 400 });
  }

  const ua = (body.user_agent ?? req.headers.get("user-agent") ?? "").slice(0, 200);
  const { error } = await sb.from("user_push_subscriptions").upsert({
    user_id: user.id,
    endpoint: body.endpoint,
    p256dh: body.p256dh,
    auth_secret: body.auth,
    user_agent: ua,
    last_seen_at: new Date().toISOString(),
  }, { onConflict: "user_id,endpoint" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/me/push-subscribe
 *  Body: { endpoint }
 *
 * Entfernt eine Subscription (z. B. wenn der User Notifications deaktiviert).
 */
export async function DELETE(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json() as { endpoint?: string };
  if (!body.endpoint) return NextResponse.json({ error: "missing_endpoint" }, { status: 400 });

  const { error } = await sb.from("user_push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", body.endpoint);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
