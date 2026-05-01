import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, logAudit } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/admin/refunds — Refund-Request erstellen ODER bearbeiten.
// body.action = "create" | "approve" | "reject" | "mark_processed"
export async function POST(req: NextRequest) {
  const { userId: actorId } = await requireAdmin();
  const sb = await createClient();
  const body = await req.json() as {
    action: "create" | "approve" | "reject" | "mark_processed";
    id?: string;
    user_id?: string;
    amount_cents?: number;
    currency?: string;
    reason?: string;
    external_ref?: string;
    decision_note?: string;
  };

  if (body.action === "create") {
    if (!body.user_id || !body.amount_cents || !body.reason) {
      return NextResponse.json({ ok: false, error: "user_id, amount_cents, reason erforderlich" }, { status: 400 });
    }
    const { data, error } = await sb.from("refund_requests").insert({
      user_id: body.user_id,
      amount_cents: body.amount_cents,
      currency: body.currency ?? "EUR",
      reason: body.reason,
      external_ref: body.external_ref ?? null,
    }).select("id").single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    await logAudit({ action: "refund.created", targetType: "refund_request", targetId: data.id, details: { user_id: body.user_id, amount_cents: body.amount_cents } });
    return NextResponse.json({ ok: true, id: data.id });
  }

  if (!body.id) return NextResponse.json({ ok: false, error: "id erforderlich" }, { status: 400 });
  const newStatus = body.action === "approve" ? "approved"
                  : body.action === "reject"  ? "rejected"
                  : "processed";
  const { error } = await sb.from("refund_requests").update({
    status: newStatus,
    decision_by: actorId,
    decision_at: new Date().toISOString(),
    decision_note: body.decision_note ?? null,
  }).eq("id", body.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  await logAudit({ action: `refund.${newStatus}`, targetType: "refund_request", targetId: body.id, details: { note: body.decision_note } });
  return NextResponse.json({ ok: true });
}
