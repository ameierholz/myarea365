import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, logAudit } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/admin/xp-awards
// Manuelle XP/Crown-Vergabe durch Admin. Audit-Trail in xp_awards.
// Update users.total_xp atomar (kein Race), gleichzeitig xp_transactions
// für die normale History.
export async function POST(req: NextRequest) {
  const { userId: actorId } = await requireAdmin();
  const sb = await createClient();
  const body = await req.json() as {
    user_id: string;
    xp_delta?: number;
    crown_delta?: number;
    reason: string;
    category?: "compensation" | "contest_prize" | "bug_makeup" | "manual_grant" | "other";
  };
  if (!body.user_id || !body.reason) {
    return NextResponse.json({ ok: false, error: "user_id und reason erforderlich" }, { status: 400 });
  }
  const xp = Number(body.xp_delta ?? 0) | 0;
  const crowns = Number(body.crown_delta ?? 0) | 0;
  if (xp === 0 && crowns === 0) {
    return NextResponse.json({ ok: false, error: "xp_delta oder crown_delta != 0 erforderlich" }, { status: 400 });
  }

  // Award eintragen
  const { data: award, error: awardErr } = await sb.from("xp_awards").insert({
    user_id: body.user_id,
    awarded_by: actorId,
    xp_delta: xp,
    crown_delta: crowns,
    reason: body.reason,
    category: body.category ?? "manual_grant",
  }).select("id").single();
  if (awardErr) return NextResponse.json({ ok: false, error: awardErr.message }, { status: 500 });

  // User-Stats updaten (nur wenn das Felder hat — total_xp gibt es,
  // crowns evtl. nicht; safe-update)
  if (xp !== 0) {
    await sb.rpc("admin_increment_user_xp", { p_user_id: body.user_id, p_delta: xp }).then(() => null, () => null);
  }
  // Crown-Update (best-effort, ohne RPC: direkter update mit raw fallback)
  // Falls die Spalte nicht existiert, fängt Postgres es ab — wir loggen trotzdem.
  if (crowns !== 0) {
    await sb.from("users").update({ crown_count: crowns } as Record<string, unknown>).eq("id", body.user_id).then(() => null, () => null);
  }

  await logAudit({
    action: "xp_award.granted",
    targetType: "user",
    targetId: body.user_id,
    details: { xp, crowns, reason: body.reason, award_id: award.id },
  });

  return NextResponse.json({ ok: true, award_id: award.id });
}
