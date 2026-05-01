import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, logAudit } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { userId: actorId } = await requireAdmin();
  const sb = await createClient();
  const body = await req.json() as {
    action: "create" | "cancel" | "end_now";
    id?: string;
    event_kind?: "double_xp" | "hunt_reset" | "wegelager_storm" | "crown_drop" | "crew_war" | "custom";
    payload?: Record<string, unknown>;
    starts_at?: string;
    ends_at?: string;
    notify_users?: boolean;
    notify_text?: string;
  };

  if (body.action === "create") {
    if (!body.event_kind) return NextResponse.json({ ok: false, error: "event_kind nötig" }, { status: 400 });
    const { data, error } = await sb.from("bulk_event_triggers").insert({
      event_kind: body.event_kind,
      payload: body.payload ?? {},
      starts_at: body.starts_at ?? new Date().toISOString(),
      ends_at: body.ends_at ?? null,
      notify_users: body.notify_users ?? true,
      notify_text: body.notify_text ?? null,
      triggered_by: actorId,
    }).select("id").single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    await logAudit({ action: "event.created", targetType: "bulk_event", targetId: data.id, details: { kind: body.event_kind } });
    return NextResponse.json({ ok: true, id: data.id });
  }

  if (!body.id) return NextResponse.json({ ok: false, error: "id nötig" }, { status: 400 });
  const status = body.action === "cancel" ? "cancelled" : "ended";
  const updates: Record<string, unknown> = { status };
  if (body.action === "end_now") updates.ends_at = new Date().toISOString();
  const { error } = await sb.from("bulk_event_triggers").update(updates).eq("id", body.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  await logAudit({ action: `event.${status}`, targetType: "bulk_event", targetId: body.id });
  return NextResponse.json({ ok: true });
}
