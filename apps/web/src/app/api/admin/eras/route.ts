import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET  /api/admin/eras  → Liste aller Städte mit aktueller Ära + History
 * POST /api/admin/eras  → { action: "end_era", city_slug, end_reason? }
 */
export async function GET() {
  await requireStaff();
  const sb = await createClient();

  // Alle Städte mit ihrer aktuellen + letzten 5 Ären
  const { data: cities, error: cityErr } = await sb
    .from("cities")
    .select("slug, name, country, is_active, opened_at, current_era_id")
    .order("opened_at");
  if (cityErr) return NextResponse.json({ error: cityErr.message }, { status: 500 });

  const { data: eras, error: eraErr } = await sb
    .from("eras")
    .select("id, city_slug, number, started_at, ended_at, end_reason, winner_crew_id, hof_snapshot")
    .order("started_at", { ascending: false })
    .limit(200);
  if (eraErr) return NextResponse.json({ error: eraErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, cities, eras });
}

export async function POST(req: NextRequest) {
  const { userId } = await requireStaff();
  const sb = await createClient();

  type Body = { action?: string; city_slug?: string; end_reason?: string };
  const body = (await req.json().catch(() => ({}))) as Body;

  if (body.action !== "end_era") {
    return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  }
  if (!body.city_slug) {
    return NextResponse.json({ error: "city_slug_required" }, { status: 400 });
  }

  const { data, error } = await sb.rpc("end_era_manual", {
    p_city_slug: body.city_slug,
    p_end_reason: body.end_reason ?? "manual",
    p_admin_user: userId,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Audit-Log
  try {
    await sb.from("admin_audit_log").insert({
      actor_id: userId,
      action: "end_era",
      target_type: "city",
      target_id: body.city_slug,
      details: { end_reason: body.end_reason ?? "manual", result: data },
    });
  } catch { /* audit nicht kritisch */ }

  return NextResponse.json({ ok: true, result: data });
}
