import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, logAudit } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/admin/banners — create | update | toggle | delete
export async function POST(req: NextRequest) {
  const { userId: actorId } = await requireAdmin();
  const sb = await createClient();
  const body = await req.json() as {
    action: "create" | "update" | "toggle" | "delete";
    id?: string;
    title?: string;
    body?: string;
    cta_label?: string;
    cta_href?: string;
    target?: string;
    starts_at?: string;
    ends_at?: string;
    dismissible?: boolean;
    background_color?: string;
    text_color?: string;
    priority?: number;
    active?: boolean;
  };

  if (body.action === "create") {
    if (!body.title || !body.body) return NextResponse.json({ ok: false, error: "title + body nötig" }, { status: 400 });
    const { data, error } = await sb.from("in_app_banners").insert({
      title: body.title, body: body.body,
      cta_label: body.cta_label ?? null, cta_href: body.cta_href ?? null,
      target: body.target ?? "all",
      starts_at: body.starts_at ?? new Date().toISOString(),
      ends_at: body.ends_at ?? null,
      dismissible: body.dismissible ?? true,
      background_color: body.background_color ?? "#22D1C3",
      text_color: body.text_color ?? "#0F1115",
      priority: body.priority ?? 0,
      created_by: actorId,
    }).select("id").single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    await logAudit({ action: "banner.created", targetType: "banner", targetId: data.id, details: { title: body.title } });
    return NextResponse.json({ ok: true, id: data.id });
  }

  if (!body.id) return NextResponse.json({ ok: false, error: "id nötig" }, { status: 400 });

  if (body.action === "delete") {
    const { error } = await sb.from("in_app_banners").delete().eq("id", body.id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    await logAudit({ action: "banner.deleted", targetType: "banner", targetId: body.id });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "toggle") {
    const { data: cur } = await sb.from("in_app_banners").select("active").eq("id", body.id).single();
    const { error } = await sb.from("in_app_banners").update({ active: !cur?.active }).eq("id", body.id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    await logAudit({ action: "banner.toggled", targetType: "banner", targetId: body.id, details: { now_active: !cur?.active } });
    return NextResponse.json({ ok: true });
  }

  // update
  const update: Record<string, unknown> = {};
  for (const k of ["title","body","cta_label","cta_href","target","starts_at","ends_at","dismissible","background_color","text_color","priority"] as const) {
    if (body[k] !== undefined) update[k] = body[k];
  }
  const { error } = await sb.from("in_app_banners").update(update).eq("id", body.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  await logAudit({ action: "banner.updated", targetType: "banner", targetId: body.id });
  return NextResponse.json({ ok: true });
}
