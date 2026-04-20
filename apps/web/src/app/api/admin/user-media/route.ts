import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/user-media?filter=pending|rejected|all
 * Listet User mit Banner/Avatar zur Pruefung.
 */
export async function GET(req: Request) {
  await requireAdmin();
  const sb = await createClient();
  const url = new URL(req.url);
  const filter = url.searchParams.get("filter") || "pending";

  let q = sb.from("users").select("id, username, display_name, banner_url, banner_status, avatar_url, avatar_status, media_rejection_reason");
  if (filter === "pending") {
    q = q.or("and(banner_url.not.is.null,banner_status.eq.pending),and(avatar_url.not.is.null,avatar_status.eq.pending)");
  } else if (filter === "rejected") {
    q = q.or("banner_status.eq.rejected,avatar_status.eq.rejected");
  }
  const { data, error } = await q.order("username");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data ?? [] });
}

/**
 * POST /api/admin/user-media
 * Body: { user_id, kind: "banner"|"avatar", action: "approve"|"reject"|"delete", reason? }
 */
export async function POST(req: Request) {
  await requireAdmin();
  const sb = await createClient();

  const body = await req.json() as {
    user_id: string;
    kind: "banner" | "avatar";
    action: "approve" | "reject" | "delete";
    reason?: string;
  };

  const statusCol = body.kind === "banner" ? "banner_status" : "avatar_status";
  const urlCol = body.kind === "banner" ? "banner_url" : "avatar_url";

  if (body.action === "approve") {
    const { error } = await sb.from("users").update({ [statusCol]: "approved", media_rejection_reason: null }).eq("id", body.user_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "reject") {
    const { error } = await sb.from("users").update({
      [statusCol]: "rejected",
      media_rejection_reason: body.reason || "Unangemessener Inhalt",
    }).eq("id", body.user_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "delete") {
    const { error } = await sb.from("users").update({
      [urlCol]: null, [statusCol]: "approved", media_rejection_reason: null,
    }).eq("id", body.user_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "bad_action" }, { status: 400 });
}
