import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/shop-reports?status=open|reviewed|resolved|dismissed|all */
export async function GET(req: NextRequest) {
  await requireStaff();
  const sb = await createClient();
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "open";

  let q = sb.from("shop_reports")
    .select("id, business_id, user_id, reason, comment, status, created_at, resolved_at, business:business_id(id, name, address), reporter:user_id(username, display_name)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status !== "all") q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reports: data ?? [] });
}

/** PATCH /api/admin/shop-reports — status + optional admin-note */
export async function PATCH(req: NextRequest) {
  await requireStaff();
  const sb = await createClient();
  let body: { id?: string; status?: "open" | "reviewed" | "resolved" | "dismissed" };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  if (!body.id || !body.status) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const resolved = body.status === "resolved" || body.status === "dismissed";
  const { error } = await sb.from("shop_reports").update({
    status: body.status,
    resolved_at: resolved ? new Date().toISOString() : null,
  }).eq("id", body.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
