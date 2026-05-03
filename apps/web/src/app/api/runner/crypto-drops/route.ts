import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: drops } = await sb.from("crew_crypto_drops")
    .select("*").gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false }).limit(20);
  const ids = (drops ?? []).map(d => d.id);
  const claims = ids.length ? (await sb.from("crew_crypto_drop_claims")
    .select("drop_id, user_id, gems_received, claimed_at").in("drop_id", ids)).data ?? [] : [];
  return NextResponse.json({ drops: drops ?? [], claims });
}

export async function POST(req: Request) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null) as
    { action?: string; crew_id?: string; total_gems?: number; slots?: number; drop_id?: string } | null;
  if (body?.action === "create" && body.crew_id && body.total_gems && body.slots) {
    const { data, error } = await sb.rpc("create_crypto_drop", {
      p_crew_id: body.crew_id, p_total_gems: body.total_gems, p_slots: body.slots,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, drop_id: data });
  }
  if (body?.action === "claim" && body.drop_id) {
    const { data, error } = await sb.rpc("claim_crypto_drop", { p_drop_id: body.drop_id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, gems_received: data });
  }
  return NextResponse.json({ error: "bad_request" }, { status: 400 });
}
