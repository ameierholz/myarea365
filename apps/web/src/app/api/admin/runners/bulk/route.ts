import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStaff, logAudit } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { userId } = await requireStaff();
  const sb = await createClient();
  const body = await req.json() as {
    action: "ban" | "unban" | "shadow_ban" | "notify";
    ids: string[];
    reason?: string;
    title?: string;
    body?: string;
  };
  if (!body.ids?.length) return NextResponse.json({ ok: false, error: "keine IDs" }, { status: 400 });

  if (body.action === "ban") {
    const { error } = await sb.from("users")
      .update({ is_banned: true, banned_reason: body.reason ?? "Bulk-Action" })
      .in("id", body.ids);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  } else if (body.action === "unban") {
    const { error } = await sb.from("users")
      .update({ is_banned: false, banned_reason: null, shadow_banned: false })
      .in("id", body.ids);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  } else if (body.action === "shadow_ban") {
    const { error } = await sb.from("users")
      .update({ shadow_banned: true })
      .in("id", body.ids);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  } else if (body.action === "notify") {
    if (!body.title || !body.body) return NextResponse.json({ ok: false, error: "title/body fehlt" }, { status: 400 });
    const { data: broadcast } = await sb.from("admin_broadcasts").insert({
      title: body.title, body: body.body, channel: "inapp",
      segment: { bulk: true, count: body.ids.length },
      recipient_count: body.ids.length,
      recipient_sample: body.ids.slice(0, 50),
      sent_by: userId,
      status: "sent",
      sent_at: new Date().toISOString(),
    }).select("id").single();

    const rows = body.ids.map((uid) => ({
      user_id: uid,
      broadcast_id: (broadcast as { id: string } | null)?.id ?? null,
      title: body.title!,
      body: body.body!,
    }));
    for (let i = 0; i < rows.length; i += 1000) {
      await sb.from("user_inbox").insert(rows.slice(i, i + 1000));
    }
  } else {
    return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
  }

  await logAudit({
    action: `user.bulk_${body.action}`,
    targetType: "user",
    details: { count: body.ids.length, reason: body.reason, ids: body.ids.slice(0, 50) },
  });

  return NextResponse.json({ ok: true, count: body.ids.length });
}
