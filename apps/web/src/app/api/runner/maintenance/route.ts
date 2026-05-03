import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET  /api/runner/maintenance              → list events (admin only via RLS)
 * POST /api/runner/maintenance              → { action: "grant", event_id }
 */
export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await sb.from("maintenance_events")
    .select("*").order("started_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ events: data ?? [] });
}

export async function POST(req: Request) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null) as { action?: string; event_id?: string } | null;
  if (body?.action !== "grant" || !body.event_id) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { data, error } = await sb.rpc("grant_maintenance_compensation", { p_event_id: body.event_id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, granted_count: data });
}
