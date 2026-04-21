import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET  /api/admin/seasons
 *   → Liste aller Saisons mit Status.
 * POST /api/admin/seasons
 *   body: { action: "start", name, duration_days? }
 *       | { action: "end" }
 *       | { action: "rollover", next_name, duration_days? }
 */
export async function GET() {
  await requireStaff();
  const sb = await createClient();
  const { data } = await sb.from("arena_seasons")
    .select("id, number, name, starts_at, ends_at, status, created_at")
    .order("number", { ascending: false });
  return NextResponse.json({ ok: true, seasons: data ?? [] });
}

export async function POST(req: NextRequest) {
  await requireStaff();
  const sb = await createClient();
  const body = await req.json() as {
    action: "start" | "end" | "rollover";
    name?: string;
    next_name?: string;
    duration_days?: number;
  };

  if (body.action === "start") {
    if (!body.name) return NextResponse.json({ ok: false, error: "name fehlt" }, { status: 400 });
    const { data, error } = await sb.rpc("arena_season_start", {
      p_name: body.name,
      p_duration_days: body.duration_days ?? 90,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, season_id: data });
  }

  if (body.action === "end") {
    const { data, error } = await sb.rpc("arena_season_end");
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (body.action === "rollover") {
    if (!body.next_name) return NextResponse.json({ ok: false, error: "next_name fehlt" }, { status: 400 });
    const { data, error } = await sb.rpc("arena_season_rollover", {
      p_next_name: body.next_name,
      p_duration_days: body.duration_days ?? 90,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
}
