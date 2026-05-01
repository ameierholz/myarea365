import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStaff, logAudit } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LADDER_HOURS: Record<string, number> = {
  warning: 0,            // soft, kein Ban
  timeout_24h: 24,
  timeout_7d: 24 * 7,
  permanent_ban: 0,      // Hard-Ban
};

// POST /api/admin/warnings — issue | revoke
// Bei timeout_24h/7d wird users.is_banned=true mit auto-expiry über expires_at gesetzt.
// Bei permanent_ban dauerhaft gebannt.
export async function POST(req: NextRequest) {
  const { userId: actorId } = await requireStaff();
  const sb = await createClient();
  const body = await req.json() as {
    action: "issue" | "revoke";
    user_id?: string;
    warning_id?: string;
    level?: "warning" | "timeout_24h" | "timeout_7d" | "permanent_ban";
    reason?: string;
  };

  if (body.action === "issue") {
    if (!body.user_id || !body.level || !body.reason) return NextResponse.json({ ok: false, error: "user_id, level, reason nötig" }, { status: 400 });
    const hours = LADDER_HOURS[body.level] ?? 0;
    const expiresAt = body.level === "warning" || body.level === "permanent_ban"
      ? null
      : new Date(Date.now() + hours * 3600 * 1000).toISOString();
    const { data, error } = await sb.from("user_warnings").insert({
      user_id: body.user_id, level: body.level, reason: body.reason,
      issued_by: actorId, expires_at: expiresAt,
    }).select("id").single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    if (body.level === "permanent_ban") {
      await sb.from("users").update({ is_banned: true, banned_reason: body.reason }).eq("id", body.user_id);
    } else if (body.level === "timeout_24h" || body.level === "timeout_7d") {
      await sb.from("users").update({ is_banned: true, banned_reason: `[${body.level}] ${body.reason}` }).eq("id", body.user_id);
    }
    await logAudit({ action: `user_warning.${body.level}`, targetType: "user", targetId: body.user_id, details: { reason: body.reason, expires_at: expiresAt } });
    return NextResponse.json({ ok: true, id: data.id });
  }

  // revoke
  if (!body.warning_id) return NextResponse.json({ ok: false, error: "warning_id nötig" }, { status: 400 });
  const { data: w } = await sb.from("user_warnings").select("user_id, level").eq("id", body.warning_id).single();
  await sb.from("user_warnings").update({ active: false }).eq("id", body.warning_id);
  // Wenn Timeout/Ban revoked: prüfen ob noch andere aktive Bans existieren, sonst entsperren
  if (w && (w.level === "timeout_24h" || w.level === "timeout_7d" || w.level === "permanent_ban")) {
    const { data: stillActive } = await sb.from("user_warnings").select("id")
      .eq("user_id", w.user_id).eq("active", true)
      .in("level", ["timeout_24h", "timeout_7d", "permanent_ban"]).limit(1);
    if (!stillActive || stillActive.length === 0) {
      await sb.from("users").update({ is_banned: false, banned_reason: null }).eq("id", w.user_id);
    }
  }
  await logAudit({ action: "user_warning.revoked", targetType: "user_warning", targetId: body.warning_id });
  return NextResponse.json({ ok: true });
}
